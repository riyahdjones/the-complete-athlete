import { json, readJson, setCorsHeaders, supabaseServiceRequest, verifyUser } from './_supabase.js';

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  const authHeader = req.headers.authorization || '';
  const authToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  const user = await verifyUser(authToken);
  if (!user?.id) return json(res, 401, { error: 'Session expired. Sign in again.' });

  const profileResult = await supabaseServiceRequest(
    `profiles?select=role&id=eq.${encodeURIComponent(user.id)}&limit=1`
  );
  if (profileResult.error || profileResult.data?.[0]?.role !== 'parent') {
    return json(res, 403, { error: 'Only parent accounts can remove athlete access.' });
  }

  const input = await readJson(req);
  const athleteUserId = String(input.athleteUserId || '');
  if (!/^[0-9a-f-]{36}$/i.test(athleteUserId)) {
    return json(res, 400, { error: 'Choose a valid linked athlete.' });
  }

  const result = await supabaseServiceRequest(
    `parent_links?parent_user_id=eq.${encodeURIComponent(user.id)}&athlete_user_id=eq.${encodeURIComponent(athleteUserId)}`,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
  );
  if (result.error) return json(res, 500, { error: 'Athlete access could not be removed.' });

  return json(res, 200, { ok: true });
}
