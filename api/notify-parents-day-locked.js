import { apnsConfigured, sendApplePush } from './_apns.js';
import { loadPremiumAccessUserIds } from './_premium.js';
import { json, readJson, setCorsHeaders, supabaseServiceRequest, verifyUser } from './_supabase.js';

function boundedCount(value) {
  return Math.max(0, Math.min(9999, Number(value) || 0));
}

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
    `profiles?select=role,full_name&id=eq.${encodeURIComponent(user.id)}&limit=1`
  );
  const athlete = profileResult.data?.[0];
  if (profileResult.error || athlete?.role !== 'athlete') {
    return json(res, 403, { error: 'Only athlete accounts can send a day lock-in update.' });
  }

  const linksResult = await supabaseServiceRequest(
    `parent_links?select=parent_user_id&athlete_user_id=eq.${encodeURIComponent(user.id)}`
  );
  if (linksResult.error) return json(res, 500, { error: 'Parent links could not be loaded.' });

  const linkedParentIds = [...new Set((linksResult.data ?? []).map((link) => link.parent_user_id).filter(Boolean))];
  if (!linkedParentIds.length) return json(res, 200, { ok: true, notified: 0, pushSent: 0 });
  const { userIds: premiumUserIds } = await loadPremiumAccessUserIds();
  const parentIds = linkedParentIds.filter((parentId) => premiumUserIds.has(parentId));
  if (!parentIds.length) return json(res, 200, { ok: true, notified: 0, pushSent: 0 });

  const input = await readJson(req);
  const entryDate = /^\d{4}-\d{2}-\d{2}$/.test(String(input.entryDate || ''))
    ? String(input.entryDate)
    : new Date().toISOString().slice(0, 10);
  const completed = boundedCount(input.completed);
  const total = boundedCount(input.total);
  const streak = boundedCount(input.streak);
  const athleteName = String(athlete.full_name || 'Your athlete').trim().slice(0, 50) || 'Your athlete';
  const title = `${athleteName} locked in the day`;
  const activityLine = total > 0 ? `${completed}/${total} activities completed.` : 'Today’s activities were submitted.';
  const body = `${activityLine}${streak > 0 ? ` Current streak: ${streak} day${streak === 1 ? '' : 's'}.` : ''}`;

  const notifications = parentIds.map((parentId) => ({
    id: `athlete-lock-${entryDate}-${user.id}-${parentId}`,
    user_id: parentId,
    notification_type: 'parentUpdates',
    title,
    body,
    tone: 'success',
    read: false,
    created_at: new Date().toISOString()
  }));
  const saveResult = await supabaseServiceRequest('app_notifications?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(notifications)
  });
  if (saveResult.error) return json(res, 500, { error: 'Parent notifications could not be saved.' });

  let pushSent = 0;
  if (apnsConfigured()) {
    const parentFilter = parentIds.map(encodeURIComponent).join(',');
    const [devicesResult, preferencesResult] = await Promise.all([
      supabaseServiceRequest(`push_devices?select=user_id,token,platform&enabled=eq.true&user_id=in.(${parentFilter})`),
      supabaseServiceRequest(`notification_preferences?select=user_id,parent_updates&user_id=in.(${parentFilter})`)
    ]);
    const preferences = new Map((preferencesResult.data ?? []).map((row) => [row.user_id, row.parent_updates]));
    const pushes = (devicesResult.data ?? [])
      .filter((device) => premiumUserIds.has(device.user_id) && preferences.get(device.user_id) !== false)
      .map((device) => sendApplePush({
        token: device.token,
        title,
        body,
        data: { notificationType: 'parentUpdates', athleteUserId: user.id }
      }));
    const results = await Promise.allSettled(pushes);
    pushSent = results.filter((result) => result.status === 'fulfilled').length;
  }

  return json(res, 200, { ok: true, notified: parentIds.length, pushSent });
}
