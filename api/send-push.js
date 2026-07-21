import { apnsConfigured, sendApplePush } from './_apns.js';
import { json, readJson, setCorsHeaders, supabaseUserRequest, verifyUser } from './_supabase.js';

async function userPushTokens(token) {
  const result = await supabaseUserRequest(
    'push_devices?select=token,platform&enabled=eq.true',
    token
  );
  return result.error ? [] : result.data ?? [];
}

async function saveInAppNotification(authToken, userId, { id, type, title, body, tone = 'info' }) {
  await supabaseUserRequest('app_notifications?on_conflict=id', authToken, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id,
      user_id: userId,
      notification_type: type,
      title,
      body,
      tone,
      read: false,
      created_at: new Date().toISOString()
    })
  });
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
  const authToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  const user = await verifyUser(authToken);
  if (!user?.id) {
    return json(res, 401, { error: 'Session expired. Sign in again.' });
  }

  const body = await readJson(req);
  const title = String(body.title || 'The Complete Athlete').slice(0, 80);
  const message = String(body.body || 'You have a new update.').slice(0, 220);
  const type = String(body.type || 'general').slice(0, 60);
  const notificationId = String(body.id || `manual-push-${user.id}-${Date.now()}`);

  await saveInAppNotification(authToken, user.id, {
    id: notificationId,
    type,
    title,
    body: message,
    tone: body.tone || 'info'
  });

  if (!apnsConfigured()) {
    return json(res, 202, { ok: true, pushSent: false, reason: 'APNs is not configured yet.' });
  }

  const devices = await userPushTokens(authToken);
  const results = await Promise.allSettled(
    devices.map((device) => sendApplePush({
      token: device.token,
      title,
      body: message,
      data: { notificationType: type }
    }))
  );

  return json(res, 200, {
    ok: true,
    pushSent: results.some((result) => result.status === 'fulfilled'),
    attempted: devices.length
  });
}
