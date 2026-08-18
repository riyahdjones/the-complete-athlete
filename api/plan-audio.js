import { createHash } from 'node:crypto';
import { envValue, json, readJson, setCorsHeaders, verifyUser } from './_supabase.js';

const defaultModelId = 'eleven_multilingual_v2';
const maxTextLength = 3200;
const defaultAudioBucket = 'plan-audio-cache';
const outputFormat = 'mp3_44100_128';

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxTextLength);
}

function configured(value) {
  return Boolean(String(value ?? '').trim());
}

function safePathSegment(value, fallback = 'plan') {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || fallback;
}

function voiceSettings() {
  return {
    stability: Number(envValue('ELEVENLABS_STABILITY')) || 0.52,
    similarity_boost: Number(envValue('ELEVENLABS_SIMILARITY_BOOST')) || 0.78,
    style: Number(envValue('ELEVENLABS_STYLE')) || 0.12,
    use_speaker_boost: true
  };
}

function audioCachePath({ planId, text, voiceId, modelId, settings }) {
  const digest = createHash('sha256')
    .update(JSON.stringify({
      version: 1,
      outputFormat,
      planId: String(planId || ''),
      voiceId,
      modelId,
      settings,
      text
    }))
    .digest('hex');
  return `${safePathSegment(planId)}/${digest}.mp3`;
}

function storageConfig() {
  const supabaseUrl = envValue('VITE_SUPABASE_URL', 'SUPABASE_URL').replace(/\/+$/, '');
  const serviceRoleKey = envValue('SUPABASE_SERVICE_ROLE_KEY');
  const bucket = envValue('ELEVENLABS_AUDIO_BUCKET') || defaultAudioBucket;
  return {
    enabled: configured(supabaseUrl) && configured(serviceRoleKey),
    supabaseUrl,
    serviceRoleKey,
    bucket
  };
}

function storageHeaders(serviceRoleKey, contentType = 'application/json') {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...(contentType ? { 'Content-Type': contentType } : {})
  };
}

async function ensureAudioBucket(config) {
  const bucketUrl = `${config.supabaseUrl}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`;
  const existing = await fetch(bucketUrl, {
    headers: storageHeaders(config.serviceRoleKey, null)
  });
  if (existing.ok) return true;

  const created = await fetch(`${config.supabaseUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers: storageHeaders(config.serviceRoleKey),
    body: JSON.stringify({
      id: config.bucket,
      name: config.bucket,
      public: false,
      file_size_limit: 12000000,
      allowed_mime_types: ['audio/mpeg']
    })
  });
  return created.ok || created.status === 409;
}

async function readCachedAudio(config, path) {
  if (!config.enabled) return null;
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.bucket}/${path}`, {
    headers: storageHeaders(config.serviceRoleKey, null)
  });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

async function writeCachedAudio(config, path, audio) {
  if (!config.enabled || !audio?.length) return false;
  await ensureAudioBucket(config);
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.bucket}/${path}`, {
    method: 'POST',
    headers: {
      ...storageHeaders(config.serviceRoleKey, 'audio/mpeg'),
      'Cache-Control': '31536000',
      'x-upsert': 'false'
    },
    body: audio
  });
  return response.ok || response.status === 409;
}

function sendAudio(res, audio, cacheStatus = 'MISS') {
  res.statusCode = 200;
  setCorsHeaders(res);
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', cacheStatus === 'HIT' ? 'private, max-age=86400' : 'private, max-age=300');
  res.setHeader('X-Audio-Cache', cacheStatus);
  res.setHeader('Content-Length', String(audio.length));
  res.end(audio);
}

export default async function handler(req, res) {
  setCorsHeaders(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  const authToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = await verifyUser(authToken);
  if (!user?.id) return json(res, 401, { error: 'Sign in to use narrated audio.' });

  const apiKey = envValue('ELEVENLABS_API_KEY');
  const voiceId = envValue('ELEVENLABS_VOICE_ID');
  const modelId = envValue('ELEVENLABS_MODEL_ID') || defaultModelId;
  if (!apiKey || !voiceId) {
    return json(res, 503, { error: 'Narrated audio is not configured yet.' });
  }

  const body = await readJson(req);
  const planId = safePathSegment(body.planId);
  const text = cleanText(body.text);
  if (text.length < 12) return json(res, 400, { error: 'Not enough text to narrate.' });
  const settings = voiceSettings();
  const storage = storageConfig();
  const cachePath = audioCachePath({ planId, text, voiceId, modelId, settings });
  const cachedAudio = await readCachedAudio(storage, cachePath);
  if (cachedAudio) return sendAudio(res, cachedAudio, 'HIT');

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=${outputFormat}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: settings
    })
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    return json(res, response.status, {
      error: 'Narrated audio could not be generated.',
      detail: message.slice(0, 280)
    });
  }

  const audio = Buffer.from(await response.arrayBuffer());
  await writeCachedAudio(storage, cachePath, audio).catch(() => false);
  return sendAudio(res, audio, 'MISS');
}
