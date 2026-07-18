import { supabaseAdmin } from './supabase-admin';

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dateKeyFromDate(date) {
  return date.toISOString().slice(0, 10);
}

function daysAgoKey(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return dateKeyFromDate(date);
}

export function formatShortDate(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
}

function averageReadiness(checks) {
  if (!checks.length) return 0;
  const total = checks.reduce(
    (sum, check) => sum + Number(check.confidence + check.energy + check.mood + check.belief) / 4,
    0
  );
  return Math.round((total / checks.length) * 10) / 10;
}

function buildDailyActivity(readinessChecks, standardsHistory) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = daysAgoKey(13 - index);
    return { date, label: formatShortDate(date), readiness: 0, standards: 0, total: 0 };
  });
  const byDate = new Map(days.map((day) => [day.date, day]));

  readinessChecks.forEach((check) => {
    const day = byDate.get(check.entry_date);
    if (day) {
      day.readiness += 1;
      day.total += 1;
    }
  });

  standardsHistory.forEach((entry) => {
    const day = byDate.get(entry.entry_date);
    if (day) {
      day.standards += 1;
      day.total += 1;
    }
  });

  return days;
}

function maxDate(values) {
  const valid = values.filter(Boolean).map((value) => new Date(value).getTime()).filter(Number.isFinite);
  if (!valid.length) return null;
  return new Date(Math.max(...valid)).toISOString();
}

function addActivity(activityMap, userId, createdAt) {
  if (!userId || !createdAt) return;
  const current = activityMap.get(userId);
  const next = maxDate([current, createdAt]);
  if (next) activityMap.set(userId, next);
}

function eventDateKey(row) {
  return row.entry_date || dateKeyFromDate(new Date(row.created_at || row.submitted_at));
}

export async function getDashboardData() {
  const supabase = supabaseAdmin();
  const activityStart = daysAgoKey(13);
  const sevenDayStart = daysAgoKey(6);

  const [
    profiles,
    athleteProfiles,
    parentLinks,
    athleteCount,
    parentCount,
    parentLinkCount,
    readinessChecks,
    standardsHistory,
    goals,
    journalEntries,
    dailyStandards,
    coachUsageToday,
    coachUsage7Days,
    coachUsageAll,
    appEvents,
    criticalEvents,
    checkInsToday,
    standardsToday,
    plans,
    planProgress,
    pointsLedger,
    safetyEvents
  ] = await Promise.all([
    supabase.from('profiles').select('id, role, full_name, created_at').order('created_at', { ascending: false }).limit(1000),
    supabase.from('athlete_profiles').select('user_id, sport, location').limit(1000),
    supabase.from('parent_links').select('parent_user_id, athlete_user_id, created_at').order('created_at', { ascending: false }).limit(1000),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'athlete'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'parent'),
    supabase.from('parent_links').select('id', { count: 'exact', head: true }),
    supabase
      .from('readiness_checks')
      .select('athlete_user_id, entry_date, confidence, energy, mood, belief, created_at')
      .gte('entry_date', activityStart)
      .order('entry_date', { ascending: false })
      .limit(1000),
    supabase
      .from('standards_history')
      .select('athlete_user_id, entry_date, completed, total, percent, submitted_at')
      .gte('entry_date', activityStart)
      .order('submitted_at', { ascending: false })
      .limit(1000),
    supabase.from('goals').select('athlete_user_id, progress, created_at, updated_at').limit(2000),
    supabase.from('journal_entries').select('athlete_user_id, created_at').order('created_at', { ascending: false }).limit(1000),
    supabase.from('daily_standards').select('athlete_user_id, active, created_at, updated_at').limit(2000),
    supabase.from('coach_daily_usage').select('athlete_user_id, message_count, usage_date').eq('usage_date', todayKey()).limit(1000),
    supabase.from('coach_daily_usage').select('athlete_user_id, message_count, usage_date').gte('usage_date', sevenDayStart).limit(3000),
    supabase.from('coach_daily_usage').select('athlete_user_id, message_count, usage_date').order('usage_date', { ascending: false }).limit(5000),
    supabase.from('app_events').select('id, user_id, area, event_type, severity, metadata, created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('app_events').select('id', { count: 'exact', head: true }).in('severity', ['error', 'critical']).gte('created_at', `${sevenDayStart}T00:00:00Z`),
    supabase.from('readiness_checks').select('id', { count: 'exact', head: true }).eq('entry_date', todayKey()),
    supabase.from('standards_history').select('id', { count: 'exact', head: true }).eq('entry_date', todayKey()),
    supabase.from('performance_plans').select('id, title, challenge_day, challenge_length, release_date').order('release_date', { ascending: true }).limit(500),
    supabase.from('performance_plan_progress').select('athlete_user_id, plan_id, completed_at').order('completed_at', { ascending: false }).limit(5000),
    supabase.from('athlete_points_ledger').select('athlete_user_id, event_type, points, label, entry_date, created_at').order('created_at', { ascending: false }).limit(5000),
    supabase.from('app_events').select('id, user_id, area, event_type, severity, created_at').or('severity.eq.critical,event_type.ilike.%crisis%,event_type.ilike.%safety%').order('created_at', { ascending: false }).limit(30)
  ]);

  const authUsers = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authUserMap = new Map((authUsers.data?.users ?? []).map((user) => [user.id, user]));
  const profileRows = profiles.data ?? [];
  const athleteProfileMap = new Map((athleteProfiles.data ?? []).map((profile) => [profile.user_id, profile]));
  const parentLinkRows = parentLinks.data ?? [];
  const readinessRows = readinessChecks.data ?? [];
  const standardsRows = standardsHistory.data ?? [];
  const journalRows = journalEntries.data ?? [];
  const goalRows = goals.data ?? [];
  const standardRows = dailyStandards.data ?? [];
  const coachUsageTodayRows = coachUsageToday.data ?? [];
  const coachUsage7DayRows = coachUsage7Days.data ?? [];
  const coachUsageAllRows = coachUsageAll.data ?? [];
  const eventRows = appEvents.data ?? [];
  const planRows = plans.data ?? [];
  const planProgressRows = planProgress.data ?? [];
  const pointsRows = pointsLedger.data ?? [];
  const activityByUser = new Map();

  readinessRows.forEach((row) => addActivity(activityByUser, row.athlete_user_id, `${row.entry_date}T12:00:00Z`));
  standardsRows.forEach((row) => addActivity(activityByUser, row.athlete_user_id, row.submitted_at || `${row.entry_date}T12:00:00Z`));
  journalRows.forEach((row) => addActivity(activityByUser, row.athlete_user_id, row.created_at));
  planProgressRows.forEach((row) => addActivity(activityByUser, row.athlete_user_id, row.completed_at));
  pointsRows.forEach((row) => addActivity(activityByUser, row.athlete_user_id, row.created_at || `${row.entry_date}T12:00:00Z`));
  coachUsageAllRows.forEach((row) => addActivity(activityByUser, row.athlete_user_id, `${row.usage_date}T12:00:00Z`));
  eventRows.forEach((row) => addActivity(activityByUser, row.user_id, row.created_at));

  const activeAthletes = new Set(
    [...activityByUser.entries()]
      .filter(([, lastActive]) => dateKeyFromDate(new Date(lastActive)) >= sevenDayStart)
      .map(([userId]) => userId)
  );
  const parentIds = new Set(profileRows.filter((profile) => profile.role === 'parent').map((profile) => profile.id));
  const activeParents7Days = [...activeAthletes].filter((userId) => parentIds.has(userId)).length;
  const completedGoals = goalRows.filter((goal) => Number(goal.progress) === 100).length;
  const activeStandards = standardRows.filter((standard) => standard.active).length;
  const avgStandardsPercent = standardsRows.length
    ? Math.round(standardsRows.reduce((sum, entry) => sum + Number(entry.percent || 0), 0) / standardsRows.length)
    : 0;
  const completedAllStandardsToday = standardsRows.filter(
    (entry) => entry.entry_date === todayKey() && Number(entry.completed) >= Number(entry.total) && Number(entry.total) > 0
  ).length;
  const totalPoints = pointsRows.reduce((sum, row) => sum + Number(row.points || 0), 0);
  const pointsToday = pointsRows
    .filter((row) => eventDateKey(row) === todayKey())
    .reduce((sum, row) => sum + Number(row.points || 0), 0);
  const points7Days = pointsRows
    .filter((row) => eventDateKey(row) >= sevenDayStart)
    .reduce((sum, row) => sum + Number(row.points || 0), 0);
  const pointsByAthlete = new Map();
  pointsRows.forEach((row) => pointsByAthlete.set(row.athlete_user_id, (pointsByAthlete.get(row.athlete_user_id) ?? 0) + Number(row.points || 0)));
  const topScore = Math.max(0, ...pointsByAthlete.values());
  const averageScore = pointsByAthlete.size ? Math.round(totalPoints / pointsByAthlete.size) : 0;
  const planTitleById = new Map(planRows.map((plan) => [plan.id, plan.title]));
  const planCompletionsById = new Map();
  planProgressRows.forEach((row) => planCompletionsById.set(row.plan_id, (planCompletionsById.get(row.plan_id) ?? 0) + 1));
  const topPlans = [...planCompletionsById.entries()]
    .map(([planId, count]) => ({ title: planTitleById.get(planId) || 'Unknown plan', count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const planDayCounts = planRows.map((plan) => ({
    label: plan.challenge_day || 'Lesson',
    title: plan.title,
    completed: planCompletionsById.get(plan.id) ?? 0
  }));
  const plansStarted = new Set(planProgressRows.map((row) => `${row.athlete_user_id}:${row.plan_id}`)).size;
  const planCompletionRate = planRows.length && (athleteCount.count ?? 0)
    ? Math.round((planProgressRows.length / (planRows.length * (athleteCount.count ?? 1))) * 100)
    : 0;
  const coachLimitHits = coachUsageTodayRows.filter((row) => Number(row.message_count || 0) >= 15).length;
  const userRows = profileRows.map((profile) => {
    const authUser = authUserMap.get(profile.id);
    const athleteProfile = athleteProfileMap.get(profile.id);
    const lastActive = maxDate([activityByUser.get(profile.id), authUser?.last_sign_in_at]);
    return {
      id: profile.id,
      name: profile.full_name || authUser?.user_metadata?.full_name || 'Unnamed',
      email: authUser?.email || 'No email found',
      role: profile.role || 'unknown',
      sport: athleteProfile?.sport || '-',
      location: athleteProfile?.location || '-',
      createdAt: profile.created_at || authUser?.created_at,
      lastActive,
      linkedAccounts: parentLinkRows.filter((link) => link.parent_user_id === profile.id || link.athlete_user_id === profile.id).length,
      score: pointsByAthlete.get(profile.id) ?? 0
    };
  });
  const recentActivity = [
    ...readinessRows.slice(0, 8).map((row) => ({
      id: `readiness-${row.athlete_user_id}-${row.entry_date}`,
      label: 'Readiness check',
      detail: formatShortDate(row.entry_date),
      createdAt: row.created_at || `${row.entry_date}T12:00:00Z`
    })),
    ...standardsRows.slice(0, 8).map((row) => ({
      id: `standards-${row.athlete_user_id}-${row.entry_date}`,
      label: 'Productivity day locked',
      detail: `${row.completed}/${row.total} complete`,
      createdAt: row.submitted_at
    })),
    ...planProgressRows.slice(0, 8).map((row) => ({
      id: `plan-${row.athlete_user_id}-${row.plan_id}`,
      label: 'Plan lesson completed',
      detail: planTitleById.get(row.plan_id) || 'Performance plan',
      createdAt: row.completed_at
    }))
  ]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  return {
    profiles: userRows,
    parentLinks: parentLinkRows,
    analytics: {
      athleteCount: athleteCount.count ?? 0,
      parentCount: parentCount.count ?? 0,
      totalUsers: (athleteCount.count ?? 0) + (parentCount.count ?? 0),
      newUsersToday: profileRows.filter((profile) => dateKeyFromDate(new Date(profile.created_at)) === todayKey()).length,
      newUsers7Days: profileRows.filter((profile) => dateKeyFromDate(new Date(profile.created_at)) >= sevenDayStart).length,
      activeAthletes7Days: activeAthletes.size,
      checkInsToday: checkInsToday.count ?? 0,
      standardsToday: standardsToday.count ?? 0,
      completedAllStandardsToday,
      parentLinks: parentLinkCount.count ?? 0,
      parentLinkRate:
        athleteCount.count && athleteCount.count > 0
          ? Math.round(((parentLinkCount.count ?? 0) / athleteCount.count) * 100)
          : 0,
      activeParents7Days,
      averageReadiness: averageReadiness(readinessRows),
      averageStandardsPercent: avgStandardsPercent,
      goalsCreated: goalRows.length,
      goalsCompleted: completedGoals,
      activeStandards,
      journalEntries: journalRows.length,
      coachMessagesToday: coachUsageTodayRows.reduce((sum, row) => sum + Number(row.message_count || 0), 0),
      coachMessages7Days: coachUsage7DayRows.reduce((sum, row) => sum + Number(row.message_count || 0), 0),
      coachLimitHits,
      monitoredIssues7Days: criticalEvents.count ?? 0,
      safetyEvents: safetyEvents.data ?? [],
      recentEvents: eventRows,
      dailyActivity: buildDailyActivity(readinessRows, standardsRows),
      recentActivity,
      plansAvailable: planRows.length,
      plansStarted,
      planLessonsCompleted: planProgressRows.length,
      planCompletionRate,
      topPlans,
      planDayCounts,
      totalPoints,
      pointsToday,
      points7Days,
      averageScore,
      topScore,
      recentPoints: pointsRows.slice(0, 12)
    },
    errors: [
      profiles.error,
      parentLinks.error,
      athleteCount.error,
      parentCount.error,
      parentLinkCount.error,
      readinessChecks.error,
      standardsHistory.error,
      goals.error,
      journalEntries.error,
      dailyStandards.error,
      coachUsageToday.error,
      coachUsage7Days.error,
      coachUsageAll.error,
      appEvents.error,
      criticalEvents.error,
      checkInsToday.error,
      standardsToday.error,
      plans.error,
      planProgress.error,
      pointsLedger.error,
      safetyEvents.error,
      authUsers.error
    ].filter(Boolean)
  };
}
