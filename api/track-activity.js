import { json, setCorsHeaders, supabaseServiceRequest, verifyUser } from './_supabase.js';

export default async function handler(req, res) {
  setCorsHeaders(res, 'POST, OPTIONS');

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

  const result = await supabaseServiceRequest(`profiles?id=eq.${encodeURIComponent(user.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      last_active_at: new Date().toISOString(),
      last_inactivity_notified_at: null
    })
  });

  if (result.error) {
    return json(res, result.status || 500, { error: 'Activity tracking failed.' });
  }

  return json(res, 200, { ok: true });
}
