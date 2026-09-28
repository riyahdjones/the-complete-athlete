import { json, readJson, setCorsHeaders, supabaseServiceRequest, verifyUser } from '../server/supabase.js';

const allowedSeverities = new Set(['info', 'warning', 'error', 'critical']);

function cleanToken(value, fallback, maxLength = 80) {
  const clean = String(value || fallback || '')
    .trim()
    .replace(/[^a-zA-Z0-9_.:-]/g, '_')
    .slice(0, maxLength);
  return clean || fallback;
}

function cleanMetadata(value, depth = 0) {
  if (depth > 3) return null;
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.slice(0, 300);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => cleanMetadata(item, depth + 1));
  if (typeof value !== 'object') return String(value).slice(0, 120);

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 40)
      .map(([key, item]) => [String(key).slice(0, 60), cleanMetadata(item, depth + 1)])
  );
}

async function trackActivity(req, res, user) {
  if (!user?.id) {
    return json(res, 401, { error: 'Session expired. Sign in again.' });
  }

  const result = await supabaseServiceRequest(`profiles?id=eq.${encodeURIComponent(user.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      last_active_at: new Date().toISOString(),
      last_inactivity_notified_at: null,
      last_winback_10_notified_at: null,
      last_winback_21_notified_at: null,
      last_parent_nudge_notified_at: null
    })
  });

  if (result.error) {
    return json(res, result.status || 500, { error: 'Activity tracking failed.' });
  }

  return json(res, 200, { ok: true });
}

async function trackEvent(req, res, user) {
  const body = await readJson(req);
  const eventType = cleanToken(body.eventType || body.event_type, 'unknown_event');
  const area = cleanToken(body.area, 'app', 48);
  const severity = allowedSeverities.has(body.severity) ? body.severity : 'info';
  const metadata = cleanMetadata(body.metadata || {});

  const result = await supabaseServiceRequest('app_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: user?.id || null,
      area,
      event_type: eventType,
      severity,
      metadata
    })
  });

  if (result.error) return json(res, result.status || 500, { error: result.error });
  return json(res, 200, { ok: true });
}

export default async function handler(req, res) {
  setCorsHeaders(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = token ? await verifyUser(token) : null;
  const action = String(req.query?.action || '').toLowerCase();

  if (action === 'activity') return trackActivity(req, res, user);
  if (action === 'event') return trackEvent(req, res, user);
  return json(res, 404, { error: 'Unknown tracking action.' });
}
