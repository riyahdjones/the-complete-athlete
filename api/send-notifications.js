import { apnsConfigured, sendApplePush } from './_apns.js';
import { envValue, json, setCorsHeaders, supabaseServiceRequest } from './_supabase.js';

function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function authorized(req) {
  const secret = envValue('CRON_SECRET', 'NOTIFICATION_CRON_SECRET');
  if (!secret) return false;
  return req.headers.authorization === `Bearer ${secret}`;
}

async function latestDailyDeposit(date) {
  const result = await supabaseServiceRequest(
    `daily_deposits?select=id,body,focus_question,release_date,status&release_date=lte.${date}&order=release_date.desc&limit=1`
  );
  return result.error ? null : result.data?.[0] ?? null;
}

async function todaysPlan(date) {
  const result = await supabaseServiceRequest(
    `performance_plans?select=id,title,subject,release_date&release_date=eq.${date}&order=title.asc&limit=1`
  );
  return result.error ? null : result.data?.[0] ?? null;
}

async function pushDevices() {
  const result = await supabaseServiceRequest(
    'push_devices?select=token,user_id,platform&enabled=eq.true&order=last_seen_at.desc'
  );
  return result.error ? [] : result.data ?? [];
}

async function preferencesForUsers(userIds) {
  if (!userIds.length) return new Map();
  const result = await supabaseServiceRequest(
    `notification_preferences?select=user_id,daily_deposits,performance_plans,streaks,inactivity_reminders&user_id=in.(${userIds.join(',')})`
  );
  return new Map((result.data ?? []).map((row) => [row.user_id, row]));
}

async function inactiveProfiles() {
  const inactiveBefore = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const result = await supabaseServiceRequest(
    `profiles?select=id,role,full_name,last_active_at&last_active_at=lt.${inactiveBefore}&last_inactivity_notified_at=is.null`
  );
  return new Map((result.data ?? []).map((profile) => [profile.id, profile]));
}

async function markInactivityNotified(userId) {
  await supabaseServiceRequest(`profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ last_inactivity_notified_at: new Date().toISOString() })
  });
}

async function saveNotification(userId, notification) {
  await supabaseServiceRequest('app_notifications?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({
      id: notification.id,
      user_id: userId,
      notification_type: notification.type,
      title: notification.title,
      body: notification.body,
      tone: notification.tone || 'info',
      read: false,
      created_at: new Date().toISOString()
    })
  });
}

async function sendToDevice(device, notification) {
  await saveNotification(device.user_id, notification);
  if (!apnsConfigured()) return { pushed: false, stored: true };

  await sendApplePush({
    token: device.token,
    title: notification.title,
    body: notification.body,
    data: { notificationType: notification.type }
  });
  return { pushed: true, stored: true };
}

export default async function handler(req, res) {
  setCorsHeaders(res, 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (!['GET', 'POST'].includes(req.method)) {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  if (!authorized(req)) {
    return json(res, 401, { error: 'Notification job is not authorized.' });
  }

  const date = todayKey();
  const [deposit, plan, devices, inactiveUsers] = await Promise.all([
    latestDailyDeposit(date),
    todaysPlan(date),
    pushDevices(),
    inactiveProfiles()
  ]);
  const uniqueUserIds = [...new Set(devices.map((device) => device.user_id))];
  const preferences = await preferencesForUsers(uniqueUserIds);
  const sent = [];

  for (const device of devices) {
    const prefs = preferences.get(device.user_id) ?? {};

    if (deposit && prefs.daily_deposits !== false) {
      const body = String(deposit.body || deposit.focus_question || 'Today’s Daily Deposit is ready.').slice(0, 180);
      sent.push(sendToDevice(device, {
        id: `push-daily-deposit-${date}-${device.user_id}`,
        type: 'dailyDeposits',
        title: 'Daily Deposit',
        body,
        tone: 'info'
      }));
    }

    if (plan && prefs.performance_plans !== false) {
      sent.push(sendToDevice(device, {
        id: `push-performance-plan-${date}-${device.user_id}-${plan.id}`,
        type: 'performancePlans',
        title: 'New performance plan available',
        body: `${plan.title || 'A new plan'} is ready in Performance Plans.`,
        tone: 'info'
      }));
    }

    const inactiveUser = inactiveUsers.get(device.user_id);
    if (inactiveUser && prefs.inactivity_reminders !== false) {
      const isParent = inactiveUser.role === 'parent';
      sent.push(
        sendToDevice(device, {
          id: `push-inactivity-${date}-${device.user_id}`,
          type: 'inactivityReminders',
          title: isParent ? 'A quick check-in can help' : 'Your next deposit is waiting',
          body: isParent
            ? 'Open Parent Corner when you are ready for one simple way to support your athlete today.'
            : 'Open The Complete Athlete and take one small step back into your routine.',
          tone: 'info'
        }).then(async (result) => {
          await markInactivityNotified(device.user_id);
          return result;
        })
      );
    }
  }

  const results = await Promise.allSettled(sent);
  const pushed = results.filter((result) => result.status === 'fulfilled' && result.value.pushed).length;
  const stored = results.filter((result) => result.status === 'fulfilled' && result.value.stored).length;

  return json(res, 200, {
    ok: true,
    date,
    devices: devices.length,
    stored,
    pushed,
    inactivityCandidates: inactiveUsers.size,
    apnsConfigured: apnsConfigured()
  });
}
