import { apnsConfigured, sendApplePush } from './_apns.js';
import { envValue, json, setCorsHeaders, supabaseServiceRequest } from './_supabase.js';

function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function yesterdayKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function easternHour() {
  return Number(new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    hour12: false
  }));
}

function daysInactive(lastActiveAt) {
  const lastActiveTime = new Date(lastActiveAt).getTime();
  if (!Number.isFinite(lastActiveTime)) return 0;
  return Math.floor((Date.now() - lastActiveTime) / (24 * 60 * 60 * 1000));
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
    `notification_preferences?select=user_id,daily_deposits,performance_plans,plan_unlocks,streaks,parent_updates,inactivity_reminders&user_id=in.(${userIds.join(',')})`
  );
  return new Map((result.data ?? []).map((row) => [row.user_id, row]));
}

async function inactiveProfiles() {
  const inactiveBefore = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const result = await supabaseServiceRequest(
    `profiles?select=id,role,full_name,last_active_at,last_inactivity_notified_at,last_winback_10_notified_at,last_winback_21_notified_at,last_parent_nudge_notified_at&last_active_at=lt.${inactiveBefore}`
  );
  return new Map((result.data ?? []).map((profile) => [profile.id, profile]));
}

async function markProfileNotification(userId, column) {
  await supabaseServiceRequest(`profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ [column]: new Date().toISOString() })
  });
}

async function planUnlockUsers(yesterday) {
  const result = await supabaseServiceRequest(
    `performance_plan_progress?select=athlete_user_id&completed_at=eq.${yesterday}`
  );
  return new Set((result.data ?? []).map((row) => row.athlete_user_id));
}

async function streakRescueUsers(today, yesterday) {
  const result = await supabaseServiceRequest(
    `standards_history?select=athlete_user_id,entry_date,completed&entry_date=in.(${yesterday},${today})`
  );
  const yesterdayUsers = new Set();
  const todayUsers = new Set();

  (result.data ?? []).forEach((row) => {
    if (row.entry_date === yesterday && Number(row.completed) > 0) yesterdayUsers.add(row.athlete_user_id);
    if (row.entry_date === today && Number(row.completed) > 0) todayUsers.add(row.athlete_user_id);
  });

  return new Set([...yesterdayUsers].filter((userId) => !todayUsers.has(userId)));
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
  const yesterday = yesterdayKey();
  const hour = easternHour();
  const isMorningWindow = hour === 7;
  const isReengagementWindow = hour === 7 || hour === 10;
  const isEveningWindow = hour === 20;
  const [deposit, plan, devices, inactiveUsers, unlockUsers, rescueUsers] = await Promise.all([
    latestDailyDeposit(date),
    todaysPlan(date),
    pushDevices(),
    inactiveProfiles(),
    isMorningWindow ? planUnlockUsers(yesterday) : Promise.resolve(new Set()),
    isEveningWindow ? streakRescueUsers(date, yesterday) : Promise.resolve(new Set())
  ]);
  const uniqueUserIds = [...new Set(devices.map((device) => device.user_id))];
  const preferences = await preferencesForUsers(uniqueUserIds);
  const sent = [];

  for (const device of devices) {
    const prefs = preferences.get(device.user_id) ?? {};

    if (isMorningWindow && deposit && prefs.daily_deposits !== false) {
      const body = String(deposit.body || deposit.focus_question || 'Today’s Daily Deposit is ready.').slice(0, 180);
      sent.push(sendToDevice(device, {
        id: `push-daily-deposit-${date}-${device.user_id}`,
        type: 'dailyDeposits',
        title: 'Daily Deposit',
        body,
        tone: 'info'
      }));
    }

    if (isMorningWindow && plan && prefs.performance_plans !== false) {
      sent.push(sendToDevice(device, {
        id: `push-performance-plan-${date}-${device.user_id}-${plan.id}`,
        type: 'performancePlans',
        title: 'New performance plan available',
        body: `${plan.title || 'A new plan'} is ready in Performance Plans.`,
        tone: 'info'
      }));
    }

    if (isMorningWindow && unlockUsers.has(device.user_id) && prefs.plan_unlocks !== false) {
      sent.push(sendToDevice(device, {
        id: `push-plan-unlock-${date}-${device.user_id}`,
        type: 'planUnlocks',
        title: 'Your next plan lesson is open',
        body: 'Keep the momentum going with the next step in your performance plan.',
        tone: 'info'
      }));
    }

    if (isEveningWindow && rescueUsers.has(device.user_id) && prefs.streaks !== false) {
      sent.push(sendToDevice(device, {
        id: `push-streak-rescue-${date}-${device.user_id}`,
        type: 'streaks',
        title: 'Still time for today’s deposit',
        body: 'Open the app, complete one priority, or ask Coach for a quick reset before the day ends.',
        tone: 'info'
      }));
    }

    const inactiveUser = inactiveUsers.get(device.user_id);
    if (isReengagementWindow && inactiveUser) {
      const isParent = inactiveUser.role === 'parent';
      const inactiveDays = daysInactive(inactiveUser.last_active_at);
      let notification = null;
      let markerColumn = '';

      if (inactiveDays >= 21 && prefs.inactivity_reminders !== false && !inactiveUser.last_winback_21_notified_at) {
        notification = {
          id: `push-winback-21-${date}-${device.user_id}`,
          type: 'inactivityReminders',
          title: isParent ? 'Your athlete still has support here' : 'Your reset is still here',
          body: isParent
            ? 'When life slows down, Parent Corner can give you one simple way to reconnect.'
            : 'No guilt. Open the app when you are ready and take one small step back into your routine.',
          tone: 'info'
        };
        markerColumn = 'last_winback_21_notified_at';
      } else if (inactiveDays >= 10 && prefs.inactivity_reminders !== false && !inactiveUser.last_winback_10_notified_at) {
        notification = {
          id: `push-winback-10-${date}-${device.user_id}`,
          type: 'inactivityReminders',
          title: isParent ? 'A small support moment helps' : 'Come back with one small deposit',
          body: isParent
            ? 'Open Parent Corner for a quick way to support without hovering.'
            : 'Open The Complete Athlete and let Coach help you restart with one clear action.',
          tone: 'info'
        };
        markerColumn = 'last_winback_10_notified_at';
      } else if (isParent && inactiveDays >= 7 && prefs.parent_updates !== false && !inactiveUser.last_parent_nudge_notified_at) {
        notification = {
          id: `push-parent-nudge-${date}-${device.user_id}`,
          type: 'parentUpdates',
          title: 'Parent Corner has a simple next step',
          body: 'A quick check-in can shape the home environment without adding pressure.',
          tone: 'info'
        };
        markerColumn = 'last_parent_nudge_notified_at';
      } else if (inactiveDays >= 3 && prefs.inactivity_reminders !== false && !inactiveUser.last_inactivity_notified_at) {
        notification = {
          id: `push-inactivity-${date}-${device.user_id}`,
          type: 'inactivityReminders',
          title: isParent ? 'A quick check-in can help' : 'Your next deposit is waiting',
          body: isParent
            ? 'Open Parent Corner when you are ready for one simple way to support your athlete today.'
            : 'Open The Complete Athlete and take one small step back into your routine.',
          tone: 'info'
        };
        markerColumn = 'last_inactivity_notified_at';
      }

      if (notification && markerColumn) {
        sent.push(
          sendToDevice(device, notification).then(async (result) => {
            await markProfileNotification(device.user_id, markerColumn);
            return result;
          })
        );
      }
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
    planUnlockCandidates: unlockUsers.size,
    streakRescueCandidates: rescueUsers.size,
    easternHour: hour,
    apnsConfigured: apnsConfigured()
  });
}
