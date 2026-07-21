import { json, readJson, setCorsHeaders, supabaseUserRequest, verifyUser } from './_supabase.js';

function cleanToken(value) {
  return String(value ?? '').trim().slice(0, 500);
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  const user = await verifyUser(token);
  if (!user?.id) {
    return json(res, 401, { error: 'Session expired. Sign in again.' });
  }

  const body = await readJson(req);
  const deviceToken = cleanToken(body.token);
  if (!deviceToken) {
    return json(res, 400, { error: 'Missing push token.' });
  }

  const payload = {
    token: deviceToken,
    user_id: user.id,
    platform: String(body.platform || 'ios').slice(0, 40),
    app_version: String(body.appVersion || '').slice(0, 40),
    enabled: true,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const result = await supabaseUserRequest('push_devices?on_conflict=token', token, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payload)
  });

  if (result.error) {
    return json(res, result.status || 500, { error: 'Push registration failed.' });
  }

  return json(res, 200, { ok: true });
}
