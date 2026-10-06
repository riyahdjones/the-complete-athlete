import { logAppEvent } from '../server/monitoring.js';

const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const allowedMimeTypes = new Map([
  ['audio/webm', 'webm'],
  ['audio/mp4', 'mp4'],
  ['audio/mpeg', 'mp3'],
  ['audio/mp3', 'mp3'],
  ['audio/ogg', 'ogg'],
  ['audio/wav', 'wav'],
  ['audio/x-m4a', 'm4a']
]);

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function json(res, status, payload) {
  setCorsHeaders(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function verifyAthlete(req) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const authHeader = req.headers.authorization || '';
  if (!supabaseUrl || !supabaseAnonKey || !authHeader.startsWith('Bearer ')) return null;

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnonKey, Authorization: authHeader }
  });
  if (!authResponse.ok) return null;
  const user = await authResponse.json();
  const metadataRole = user.user_metadata?.role || user.app_metadata?.role;
  if (metadataRole === 'athlete') return user;

  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}&limit=1`, {
    headers: { apikey: supabaseAnonKey, Authorization: authHeader }
  });
  if (!profileResponse.ok) return null;
  const profiles = await profileResponse.json().catch(() => []);
  return profiles?.[0]?.role === 'athlete' ? user : null;
}

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json(res, 501, { error: 'Voice transcription is not configured.' });

  const user = await verifyAthlete(req);
  if (!user) return json(res, 401, { error: 'Sign in again before starting a Voice Coach session.' });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: 'The voice recording could not be read.' });
  }

  const mimeType = String(body.mimeType || '').split(';')[0].toLowerCase();
  const extension = allowedMimeTypes.get(mimeType);
  if (!extension) return json(res, 400, { error: 'This audio format is not supported.' });

  let audio;
  try {
    audio = Buffer.from(String(body.audio || ''), 'base64');
  } catch {
    return json(res, 400, { error: 'The voice recording is invalid.' });
  }
  if (!audio.length) return json(res, 400, { error: 'No voice recording was received.' });
  if (audio.length > MAX_AUDIO_BYTES) return json(res, 413, { error: 'Keep each voice turn under 45 seconds.' });

  const form = new FormData();
  form.append('file', new Blob([audio], { type: mimeType }), `coach-turn.${extension}`);
  form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe');
  form.append('language', String(body.language || '').toLowerCase().startsWith('es') ? 'es' : 'en');
  form.append('response_format', 'json');

  const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });

  if (!response.ok) {
    await logAppEvent({
      area: 'coach',
      eventType: 'voice_transcription_failed',
      severity: 'error',
      userId: user.id,
      metadata: { status: response.status, mimeType, bytes: audio.length }
    });
    return json(res, 502, { error: 'Voice recognition could not connect. Please try again.' });
  }

  const payload = await response.json().catch(() => ({}));
  const text = String(payload.text || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
  if (!text) return json(res, 422, { error: 'I did not hear a clear message. Tap the microphone and try again.' });

  await logAppEvent({
    area: 'coach',
    eventType: 'voice_transcribed',
    severity: 'info',
    userId: user.id,
    metadata: { characters: text.length, bytes: audio.length }
  });
  return json(res, 200, { text });
}
