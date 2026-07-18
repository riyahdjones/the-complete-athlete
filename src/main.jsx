import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  CalendarDays,
  Camera,
  Check,
  CircleHelp,
  Copy,
  Goal,
  Home,
  LineChart,
  LockKeyhole,
  MessageCircle,
  PenLine,
  Plus,
  Send,
  Shield,
  Sparkles,
  Star,
  Target,
  Trash2,
  Trophy,
  UserRound,
  Users,
  X
} from 'lucide-react';
import { createPerformancePlanSeeds } from './performancePlans';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import './styles.css';

if (typeof window !== 'undefined') {
  const isNativeShell =
    window.location.protocol === 'capacitor:' ||
    Boolean(window.Capacitor?.isNativePlatform?.()) ||
    Boolean(window.Capacitor?.getPlatform && window.Capacitor.getPlatform() !== 'web');
  const syncAppViewportHeight = () => {
    const viewportHeight = Math.floor(window.visualViewport?.height || window.innerHeight || 0);
    if (viewportHeight > 0) {
      document.documentElement.style.setProperty('--app-height', `${viewportHeight}px`);
    }
  };

  if (isNativeShell) {
    document.documentElement.classList.add('native-shell');
    let nativeTouchStartX = 0;
    let nativeTouchStartY = 0;
    const lockHorizontalScroll = () => {
      window.scrollTo(0, window.scrollY);
      document.documentElement.scrollLeft = 0;
      if (document.body) document.body.scrollLeft = 0;
      document.querySelectorAll('*').forEach((element) => {
        if (element.scrollLeft) element.scrollLeft = 0;
      });
    };
    const containNativeOverflow = () => {
      const viewportWidth = Math.floor(window.innerWidth || document.documentElement.clientWidth || 390);
      const offenders = [];

      document.querySelectorAll('body *').forEach((element) => {
        if (!(element instanceof HTMLElement)) return;
        if (element.closest('svg')) return;
        const rect = element.getBoundingClientRect();
        if (!rect.width || rect.height === 0) return;

        const overflowRight = rect.right - viewportWidth;
        const overflowLeft = 0 - rect.left;
        const tooWide = rect.width > viewportWidth;
        if (overflowRight > 1 || overflowLeft > 1 || tooWide) {
          offenders.push({
            tag: element.tagName.toLowerCase(),
            className: element.className,
            width: Math.round(rect.width),
            left: Math.round(rect.left),
            right: Math.round(rect.right)
          });
          element.classList.add('native-contained-overflow');
        }
      });

      window.__tcaOverflowReport = offenders.slice(0, 20);
      lockHorizontalScroll();
    };
    const runNativeLayoutPass = () => {
      syncAppViewportHeight();
      lockHorizontalScroll();
      requestAnimationFrame(containNativeOverflow);
    };
    const rememberNativeTouchStart = (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;
      nativeTouchStartX = touch.clientX;
      nativeTouchStartY = touch.clientY;
    };
    const blockNativeHorizontalPan = (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === 'range') return;
      const touch = event.touches?.[0];
      if (!touch) return;
      const dx = Math.abs(touch.clientX - nativeTouchStartX);
      const dy = Math.abs(touch.clientY - nativeTouchStartY);
      if (dx > dy && dx > 6) {
        event.preventDefault();
      }
      lockHorizontalScroll();
    };

    window.addEventListener('scroll', runNativeLayoutPass, { passive: true });
    window.addEventListener('resize', runNativeLayoutPass, { passive: true });
    window.addEventListener('orientationchange', runNativeLayoutPass, { passive: true });
    window.visualViewport?.addEventListener('resize', runNativeLayoutPass, { passive: true });
    window.visualViewport?.addEventListener('scroll', runNativeLayoutPass, { passive: true });
    document.addEventListener('scroll', runNativeLayoutPass, { passive: true, capture: true });
    document.addEventListener('touchstart', rememberNativeTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', blockNativeHorizontalPan, { passive: false, capture: true });
    document.addEventListener('touchend', runNativeLayoutPass, { passive: true, capture: true });
    document.addEventListener('DOMContentLoaded', runNativeLayoutPass, { once: true });
    syncAppViewportHeight();
    window.setTimeout(runNativeLayoutPass, 120);
    window.setTimeout(runNativeLayoutPass, 650);
    window.setTimeout(runNativeLayoutPass, 1400);
  }
}

const standardsSeed = [
  { id: 1, label: 'Quality training session', done: false, goalId: 2 },
  { id: 2, label: 'Recovery routine', done: false, goalId: 4 },
  { id: 3, label: 'Extra skill work', done: false, goalId: 1 },
  { id: 4, label: 'Schoolwork handled', done: false, goalId: 3 }
];

const retiredDefaultStandards = new Set([
  'Ten focused minutes before practice',
  'Respond to one hard moment with composure',
  'Write one confidence receipt',
  'Encourage a teammate first'
]);

function refreshDefaultStandards(standards) {
  if (!Array.isArray(standards) || standards.length === 0) return standardsSeed;
  const customStandards = standards.filter((standard) => !retiredDefaultStandards.has(standard.label));
  const hasRetiredDefaults = customStandards.length !== standards.length;
  return hasRetiredDefaults ? [...standardsSeed, ...customStandards] : standards;
}

const emptyReadinessScores = { confidence: 0, energy: 0, mood: 0, belief: 0 };
const dailyStateKey = 'the-ninety-percent-daily-state';
const journalStorageKey = 'the-ninety-percent-journal-entries';
const coachStorageKey = 'the-ninety-percent-coach-sessions';
const lessonStorageKey = 'the-ninety-percent-lessons';
const athleteProfileStorageKey = 'the-ninety-percent-athlete-profile';
const goalsStorageKey = 'the-ninety-percent-goals';
const plansStorageKey = 'the-ninety-percent-performance-plans';
const planProgressStorageKey = 'the-ninety-percent-performance-plan-progress';
const pointsLedgerStorageKey = 'the-ninety-percent-points-ledger';
const onboardingStorageKey = 'the-ninety-percent-onboarding-complete';
const authUsersStorageKey = 'the-ninety-percent-auth-users';
const authSessionStorageKey = 'the-ninety-percent-auth-session';
const prototypeBypassLogin = false;
const productionApiOrigin = import.meta.env.VITE_API_ORIGIN || 'https://the-complete-athlete.vercel.app';

function appApiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window === 'undefined') return cleanPath;

  const host = window.location.host;
  const isProductionWeb = host === 'the-complete-athlete.vercel.app';
  return isProductionWeb ? cleanPath : `${productionApiOrigin}${cleanPath}`;
}

const pointValues = {
  standardsCompleted: 25,
  journalSaved: 15,
  goalAdded: 10,
  goalCompleted: 150,
  planLessonCompleted: 10,
  planSeriesCompleted: 100,
  streakBonusPerDay: 5,
  streakBonusCap: 25
};

function todayKey() {
  return new Date().toLocaleDateString('en-CA');
}

function timeBasedGreeting(name) {
  const cleanName = String(name ?? '').trim() || 'Athlete';
  const greeting = new Date().getHours() < 12 ? 'Good morning' : 'Hello';
  return `${greeting}, ${cleanName}`;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function loadAuthUsers() {
  try {
    const saved = JSON.parse(localStorage.getItem(authUsersStorageKey) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function loadAuthSession() {
  try {
    return JSON.parse(localStorage.getItem(authSessionStorageKey) ?? 'null');
  } catch {
    return null;
  }
}

function dateFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(key, amount) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + amount);
  return date.toLocaleDateString('en-CA');
}

function daysBetween(startKey, endKey) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((dateFromKey(endKey) - dateFromKey(startKey)) / dayMs);
}

function resetStandardsForNewDay(standards) {
  return standards.map((standard) => ({ ...standard, done: false }));
}

function normalizeStreak(saved) {
  if (!saved.lastSubmittedDate) return { count: 0, lastSubmittedDate: null };
  const gap = daysBetween(saved.lastSubmittedDate, todayKey());
  return {
    count: gap > 1 ? 0 : Number(saved.streakCount) || 0,
    lastSubmittedDate: gap > 1 ? null : saved.lastSubmittedDate
  };
}

function normalizeReadinessHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((entry) => entry?.date && Number.isFinite(Number(entry.score)))
    .map((entry) => ({ date: entry.date, score: Math.max(0, Math.min(10, Number(entry.score))) }))
    .slice(-30);
}

function saveReadinessScore(history, date, score) {
  return [
    ...normalizeReadinessHistory(history).filter((entry) => entry.date !== date),
    { date, score }
  ].slice(-30);
}

function normalizeStandardsHistory(history) {
  return Array.isArray(history)
    ? history
        .filter((entry) => entry && entry.date)
        .map((entry) => ({
          date: entry.date,
          completed: Number(entry.completed) || 0,
          total: Number(entry.total) || 0,
          percent: Number(entry.percent) || 0,
          submittedAt: entry.submittedAt ?? '',
          standards: Array.isArray(entry.standards) ? entry.standards : []
        }))
        .slice(-60)
    : [];
}

function saveStandardsHistory(history, entry) {
  return [
    ...normalizeStandardsHistory(history).filter((item) => item.date !== entry.date),
    entry
  ].slice(-60);
}

function lastSevenReadinessScores(history, endDate = todayKey()) {
  const byDate = new Map(normalizeReadinessHistory(history).map((entry) => [entry.date, entry.score]));
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(endDate, index - 6);
    return { date, score: byDate.get(date) ?? 0 };
  });
}

function loadDailyState() {
  try {
    const saved = JSON.parse(localStorage.getItem(dailyStateKey) ?? '{}');
    const isToday = saved.date === todayKey();
    const savedStandards = refreshDefaultStandards(saved.standards);
    const streak = normalizeStreak(saved);
    return {
      date: todayKey(),
      standards: isToday ? savedStandards : resetStandardsForNewDay(savedStandards),
      scores: isToday ? { ...emptyReadinessScores, ...saved.scores } : emptyReadinessScores,
      streakCount: streak.count,
      lastSubmittedDate: streak.lastSubmittedDate,
      lastReminderDate: saved.lastReminderDate ?? null,
      readinessHistory: normalizeReadinessHistory(saved.readinessHistory),
      standardsHistory: normalizeStandardsHistory(saved.standardsHistory),
      notifications: Array.isArray(saved.notifications) ? saved.notifications : []
    };
  } catch {
    return {
      date: todayKey(),
      standards: standardsSeed,
      scores: emptyReadinessScores,
      streakCount: 0,
      lastSubmittedDate: null,
      lastReminderDate: null,
      readinessHistory: [],
      standardsHistory: [],
      notifications: []
    };
  }
}

function buildNotification(title, body, tone = 'info') {
  return {
    id: Date.now() + Math.random(),
    title,
    body,
    tone,
    createdAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  };
}

function loadJournalEntries() {
  try {
    const saved = JSON.parse(localStorage.getItem(journalStorageKey) ?? '[]');
    return Array.isArray(saved) ? saved.map((entry) => ({ linkedGoalId: null, ...entry })) : [];
  } catch {
    return [];
  }
}

function loadCoachSessions() {
  try {
    const saved = JSON.parse(localStorage.getItem(coachStorageKey) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function coachSessionFromSupabase(row) {
  return {
    id: row.id,
    title: row.title || 'Coach conversation',
    date: row.session_date || todayKey(),
    time: row.session_time || '',
    messages: Array.isArray(row.messages) ? row.messages : []
  };
}

const lessons = [
  {
    id: 1,
    title: 'Identity Beats Outcome',
    time: '4 min',
    status: 'Scheduled',
    sendDate: todayKey(),
    focusQuestion: 'What identity do I need to train today, no matter what the scoreboard says?',
    body:
      'Your scoreboard changes. Your identity is trained. Today, separate how you played from who you are becoming.'
  },
  {
    id: 2,
    title: 'Pressure Is Information',
    time: '6 min',
    status: 'Draft',
    sendDate: addDays(todayKey(), 1),
    focusQuestion: 'What pressure can I treat as information instead of a threat today?',
    body:
      'Pressure points to something you care about. Slow down, name it, and choose the next controllable action.'
  },
  {
    id: 3,
    title: 'Confidence Receipts',
    time: '3 min',
    status: 'Ready',
    sendDate: addDays(todayKey(), 2),
    focusQuestion: 'What proof can I collect today that I am becoming the athlete I say I am?',
    body:
      'Confidence grows when you keep proof. Capture one moment today where effort, discipline, or courage showed up.'
  }
];

function lessonFocusQuestion(lesson) {
  if (lesson?.focusQuestion) return lesson.focusQuestion;

  const title = String(lesson?.title ?? '').toLowerCase();
  if (title.includes('identity')) {
    return 'What identity do I need to train today, no matter what the scoreboard says?';
  }
  if (title.includes('pressure')) {
    return 'What pressure can I treat as information instead of a threat today?';
  }
  if (title.includes('confidence')) {
    return 'What proof can I collect today that I am becoming the athlete I say I am?';
  }
  return 'What is the one idea from today’s Daily Deposit that I need to carry into my next rep?';
}

function dailyLessonId(library, date = todayKey()) {
  const available = Array.isArray(library) && library.length ? library : lessons;
  const released = available
    .filter((lesson) => !lesson.sendDate || lesson.sendDate <= date)
    .sort((a, b) => String(b.sendDate ?? '').localeCompare(String(a.sendDate ?? '')));
  return (released[0] ?? available[0])?.id;
}

function planCurrentDay(plan, date = todayKey()) {
  const start = new Date(`${plan?.releaseDate || date}T00:00:00`);
  const current = new Date(`${date}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(current.getTime())) return 1;
  const diffDays = Math.floor((current.getTime() - start.getTime()) / 86400000) + 1;
  const length = Number(plan?.challengeLength) || 7;
  return Math.min(Math.max(diffDays, 1), length);
}

function planDayNumber(plan) {
  const match = String(plan?.challengeDay ?? '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function sequencedPlanAccess(plans, planProgress, date = todayKey()) {
  const seriesStartDates = new Map();
  plans.forEach((plan) => {
    const series = planSeriesTitle(plan);
    const current = seriesStartDates.get(series);
    const releaseDate = plan.releaseDate || '';
    if (!current || (releaseDate && releaseDate < current)) {
      seriesStartDates.set(series, releaseDate);
    }
  });

  const sortedPlans = [...plans]
    .sort((first, second) => {
      const firstSeries = planSeriesTitle(first);
      const secondSeries = planSeriesTitle(second);
      const seriesDateSort = (seriesStartDates.get(firstSeries) || '').localeCompare(seriesStartDates.get(secondSeries) || '');
      const seriesSort = firstSeries.localeCompare(secondSeries);
      return seriesDateSort || seriesSort || planDayNumber(first) - planDayNumber(second) || String(first.title).localeCompare(String(second.title));
    });

  const previousBySeries = new Map();
  const localReviewUnlock =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    ['127.0.0.1', 'localhost'].includes(window.location.hostname);
  return sortedPlans.map((plan) => {
    const series = planSeriesTitle(plan);
    const previousPlan = previousBySeries.get(series);
    const previousCompletedAt = previousPlan ? planProgress[String(previousPlan.id)] : '';
    const completedAt = planProgress[String(plan.id)] || '';
    const released = !plan.releaseDate || plan.releaseDate <= date;
    const sequenceUnlocked = !previousPlan || localReviewUnlock || Boolean(previousCompletedAt && addDays(previousCompletedAt, 1) <= date);
    const unlocked = released && sequenceUnlocked;
    const unlockDate = !previousPlan ? plan.releaseDate : previousCompletedAt ? addDays(previousCompletedAt, 1) : plan.releaseDate;
    previousBySeries.set(series, plan);
    return { ...plan, completedAt, unlocked, unlockDate };
  });
}

function planSeriesCompletion(plans, planProgress) {
  const series = new Map();
  plans.forEach((plan) => {
    const title = planSeriesTitle(plan);
    if (!series.has(title)) series.set(title, []);
    series.get(title).push(plan);
  });

  const total = series.size;
  const completed = Array.from(series.values()).filter((seriesPlans) =>
    seriesPlans.length > 0 && seriesPlans.every((plan) => Boolean(planProgress[String(plan.id)]))
  ).length;

  return { completed, total };
}

function loadLessons() {
  try {
    const saved = JSON.parse(localStorage.getItem(lessonStorageKey) ?? '[]');
    return Array.isArray(saved) && saved.length ? saved : lessons;
  } catch {
    return lessons;
  }
}

function loadAthleteProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(athleteProfileStorageKey) ?? '{}');
    return {
      name: saved.name ?? '',
      sport: saved.sport ?? '',
      age: saved.age ?? '',
      location: saved.location ?? '',
      photo: saved.photo ?? '',
      parentContact: saved.parentContact ?? '',
      parentAccessCode: saved.parentAccessCode ?? 'TCA-PARENT'
    };
  } catch {
    return { name: '', sport: '', age: '', location: '', photo: '', parentContact: '', parentAccessCode: 'TCA-PARENT' };
  }
}

function loadOnboardingComplete() {
  try {
    return localStorage.getItem(onboardingStorageKey) === 'true';
  } catch {
    return false;
  }
}

const goalsSeed = [
  { id: 1, label: 'Dream Goal', value: 'Earn a varsity leadership role', progress: 42 },
  { id: 2, label: 'Season Goal', value: 'Become a dependable fourth-quarter player', progress: 64 },
  { id: 3, label: 'Monthly Goal', value: 'Complete 22 of 30 Daily Deposit sessions', progress: 73 },
  { id: 4, label: 'Today’s Productivity', value: 'Win today through controllables', progress: 50 }
];

const plansSeed = createPerformancePlanSeeds(todayKey);

function normalizePlan(plan) {
  return {
    id: plan.id ?? Date.now() + Math.random(),
    title: plan.title ?? '',
    subject: plan.subject ?? plan.focus ?? '',
    releaseDate: plan.releaseDate ?? todayKey(),
    challengeDay: plan.challengeDay ?? '',
    challengeLength: Number(plan.challengeLength) || 7,
    steps: Array.isArray(plan.steps) ? plan.steps : []
  };
}

function loadGoals() {
  try {
    const saved = JSON.parse(localStorage.getItem(goalsStorageKey) ?? '[]');
    return Array.isArray(saved) && saved.length ? saved : goalsSeed;
  } catch {
    return goalsSeed;
  }
}

function isSupabaseId(id) {
  return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
}

function goalFromSupabase(row) {
  return {
    id: row.id,
    label: row.label ?? '',
    value: row.value ?? '',
    progress: Math.max(0, Math.min(100, Number(row.progress) || 0))
  };
}

function goalToSupabase(goal, athleteUserId) {
  const payload = {
    athlete_user_id: athleteUserId,
    label: goal.label ?? '',
    value: goal.value ?? '',
    progress: Math.max(0, Math.min(100, Number(goal.progress) || 0))
  };

  if (isSupabaseId(goal.id)) payload.id = goal.id;
  return payload;
}

function profileFromSupabase(row, authSession, currentProfile) {
  return {
    ...currentProfile,
    name: authSession?.name ?? currentProfile.name,
    sport: row?.sport ?? currentProfile.sport,
    age: row?.age ?? currentProfile.age,
    location: row?.location ?? currentProfile.location,
    photo: row?.photo_url ?? currentProfile.photo,
    parentContact: row?.parent_contact ?? currentProfile.parentContact,
    parentAccessCode: row?.parent_access_code ?? currentProfile.parentAccessCode ?? 'TCA-PARENT'
  };
}

function standardFromSupabase(row) {
  return {
    id: row.id,
    label: row.label ?? '',
    done: false,
    goalId: row.goal_id ?? null
  };
}

function standardToSupabase(standard, athleteUserId) {
  const payload = {
    athlete_user_id: athleteUserId,
    label: standard.label ?? '',
    goal_id: isSupabaseId(standard.goalId) ? standard.goalId : null,
    active: true
  };

  if (isSupabaseId(standard.id)) payload.id = standard.id;
  return payload;
}

function standardsHistoryFromSupabase(rows) {
  return normalizeStandardsHistory(
    (rows ?? []).map((row) => ({
      date: row.entry_date,
      completed: row.completed,
      total: row.total,
      percent: row.percent,
      standards: row.standards,
      submittedAt: row.submitted_at
        ? new Date(row.submitted_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : ''
    }))
  );
}

function readinessFromSupabase(rows) {
  return normalizeReadinessHistory(
    (rows ?? []).map((row) => ({
      date: row.entry_date,
      score: Math.round((Number(row.confidence) + Number(row.energy) + Number(row.mood) + Number(row.belief)) / 4)
    }))
  );
}

function journalFromSupabase(row) {
  const createdAt = row.created_at ? new Date(row.created_at) : new Date();
  return {
    id: row.id,
    body: row.body ?? '',
    type: row.entry_type ?? 'Daily Reflection',
    linkedGoalId: row.goal_id ?? null,
    date: createdAt.toLocaleDateString('en-CA'),
    time: createdAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  };
}

function journalToSupabase(entry, athleteUserId) {
  const payload = {
    athlete_user_id: athleteUserId,
    body: entry.body ?? '',
    entry_type: entry.type ?? 'Daily Reflection',
    goal_id: isSupabaseId(entry.linkedGoalId) ? entry.linkedGoalId : null
  };

  if (isSupabaseId(entry.id)) payload.id = entry.id;
  return payload;
}

function pointEventFromSupabase(row) {
  return {
    id: row.id,
    uniqueKey: row.event_key,
    type: row.event_type,
    points: Number(row.points) || 0,
    label: row.label ?? 'Points earned',
    metadata: row.metadata ?? {},
    date: row.entry_date ?? todayKey(),
    createdAt: row.created_at ?? new Date().toISOString()
  };
}

function pointEventToSupabase(entry, athleteUserId) {
  return {
    athlete_user_id: athleteUserId,
    event_key: entry.uniqueKey,
    event_type: entry.type,
    points: Number(entry.points) || 0,
    label: entry.label ?? 'Points earned',
    metadata: entry.metadata ?? {},
    entry_date: entry.date ?? todayKey(),
    created_at: entry.createdAt ?? new Date().toISOString()
  };
}

function lessonFromSupabase(row) {
  return {
    id: row.id,
    title: row.title ?? '',
    time: '2 min',
    status: row.status === 'posted' ? 'Posted' : row.status === 'scheduled' ? 'Scheduled' : 'Draft',
    sendDate: row.release_date ?? todayKey(),
    focusQuestion: row.focus_question ?? '',
    body: row.body ?? ''
  };
}

function planFromSupabase(row) {
  return normalizePlan({
    id: row.id,
    title: row.title,
    subject: row.subject,
    steps: Array.isArray(row.steps) ? row.steps : [],
    releaseDate: row.release_date,
    challengeDay: row.challenge_day,
    challengeLength: row.challenge_length
  });
}

function parentMessageFromSupabase(row) {
  return {
    title: row.title ?? parentMessageSeed.title,
    body: row.body ?? parentMessageSeed.body,
    conversationCue: row.conversation_cue ?? parentMessageSeed.conversationCue,
    avoid: row.avoid ?? parentMessageSeed.avoid,
    sendDate: row.send_date ?? todayKey(),
    status: row.status === 'sent' ? 'Sent' : row.status === 'scheduled' ? 'Scheduled' : 'Draft'
  };
}

function loadPlans() {
  try {
    const saved = JSON.parse(localStorage.getItem(plansStorageKey) ?? '[]');
    const savedPlans = Array.isArray(saved) ? saved.map(normalizePlan) : [];
    const hasCurrentNinetyPlan = savedPlans.some((plan) => String(plan.id).startsWith('ninety-percent-day-'));
    const hasDocumentStructuredNinetyPlan = savedPlans.some((plan) =>
      String(plan.id).startsWith('ninety-percent-day-') &&
      plan.steps.some((step) => String(step).includes('This Chapter Will Help You'))
    );
    const hasCurrentSlumpPlan = savedPlans.some((plan) =>
      (String(plan.id).startsWith('slump-series-day-') || String(plan.subject).includes("I'm In A Slump")) &&
      plan.steps.some((step) => String(step).includes('Final Complete Athlete Principle') || String(step).includes('The Second Opponent'))
    );
    return savedPlans.length && (!hasCurrentNinetyPlan || hasDocumentStructuredNinetyPlan) && hasCurrentSlumpPlan
      ? savedPlans
      : plansSeed.map(normalizePlan);
  } catch {
    return plansSeed.map(normalizePlan);
  }
}

function loadPlanProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(planProgressStorageKey) ?? '{}');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

function loadPointsLedger() {
  try {
    const saved = JSON.parse(localStorage.getItem(pointsLedgerStorageKey) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function pointsTotal(ledger) {
  return ledger.reduce((total, entry) => total + Number(entry.points || 0), 0);
}

function pointsToday(ledger, date = todayKey()) {
  return ledger
    .filter((entry) => entry.date === date)
    .reduce((total, entry) => total + Number(entry.points || 0), 0);
}

function latestPointEvents(ledger, count = 3) {
  return [...ledger]
    .sort((first, second) => String(second.createdAt).localeCompare(String(first.createdAt)))
    .slice(0, count);
}

const coachTopics = [
  {
    title: 'Pressure',
    prompt: 'I feel pressure today and need help staying calm.'
  },
  {
    title: 'Slump',
    prompt: 'I feel stuck in a slump and need to reset my confidence.'
  },
  {
    title: 'Fear',
    prompt: 'I am afraid of failing and letting people down.'
  },
  {
    title: 'Coach',
    prompt: 'I need help handling a hard relationship with my coach.'
  },
  {
    title: 'Identity',
    prompt: 'I am tying who I am to how I perform.'
  },
  {
    title: 'Training',
    prompt: 'How do I get more disciplined with training when I do not feel motivated?'
  },
  {
    title: 'Team',
    prompt: 'How should I handle a teammate issue without making it worse?'
  },
  {
    title: 'Injury',
    prompt: 'I am injured and frustrated. How do I stay mentally strong?'
  }
];

const parentMessageSeed = {
  title: 'Coach the daily work, not the scoreboard.',
  body: 'Your athlete is learning to separate identity from performance. Reinforce the work they are building, not only the result they produced.',
  conversationCue: 'Ask tonight: “What did you control today?”',
  avoid: 'Avoid leading with stats, mistakes, or playing time.',
  sendDate: todayKey(),
  status: 'Scheduled'
};

const privacySeed = {
  readinessVisible: true,
  standardsVisible: true,
  goalsVisible: false,
  journalPrivate: true,
  coachPrivate: true
};

function App() {
  const [initialDailyState] = useState(loadDailyState);
  const [authUsers, setAuthUsers] = useState(loadAuthUsers);
  const [authSession, setAuthSession] = useState(loadAuthSession);
  const [onboardingComplete, setOnboardingComplete] = useState(loadOnboardingComplete);
  const [viewportRevision, setViewportRevision] = useState(0);
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 720px)').matches : false
  ));
  const [dailyDate, setDailyDate] = useState(initialDailyState.date);
  const [view, setView] = useState('athlete');
  const [tab, setTab] = useState('home');
  const [standards, setStandards] = useState(initialDailyState.standards);
  const [standardDraft, setStandardDraft] = useState('');
  const [standardGoalId, setStandardGoalId] = useState('');
  const [scores, setScores] = useState(initialDailyState.scores);
  const [streakCount, setStreakCount] = useState(initialDailyState.streakCount);
  const [lastSubmittedDate, setLastSubmittedDate] = useState(initialDailyState.lastSubmittedDate);
  const [lastReminderDate, setLastReminderDate] = useState(initialDailyState.lastReminderDate);
  const [readinessHistory, setReadinessHistory] = useState(initialDailyState.readinessHistory);
  const [standardsHistory, setStandardsHistory] = useState(initialDailyState.standardsHistory);
  const [notifications, setNotifications] = useState(initialDailyState.notifications);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [journal, setJournal] = useState('');
  const [journalType, setJournalType] = useState('Daily Reflection');
  const [journalGoalId, setJournalGoalId] = useState('');
  const [journalEntries, setJournalEntries] = useState(loadJournalEntries);
  const [goals, setGoals] = useState(loadGoals);
  const [goalDraft, setGoalDraft] = useState({ label: '', value: '' });
  const [plans, setPlans] = useState(loadPlans);
  const [planProgress, setPlanProgress] = useState(loadPlanProgress);
  const [pointsLedger, setPointsLedger] = useState(loadPointsLedger);
  const [messages, setMessages] = useState([]);
  const [coachSessions, setCoachSessions] = useState(loadCoachSessions);
  const [activeCoachSessionId, setActiveCoachSessionId] = useState(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [parentMessage, setParentMessage] = useState(parentMessageSeed);
  const [parentAccessDraft, setParentAccessDraft] = useState('');
  const [parentLinkFeedback, setParentLinkFeedback] = useState('');
  const [parentLinkChecked, setParentLinkChecked] = useState(false);
  const [linkedAthleteId, setLinkedAthleteId] = useState(null);
  const [parentLinkRefreshKey, setParentLinkRefreshKey] = useState(0);
  const [privacySettings, setPrivacySettings] = useState(privacySeed);
  const [athleteProfile, setAthleteProfile] = useState(loadAthleteProfile);
  const [supabaseAthleteDataReady, setSupabaseAthleteDataReady] = useState(false);
  const [celebration, setCelebration] = useState('');
  const [lessonLibrary, setLessonLibrary] = useState(loadLessons);
  const [selectedLessonId, setSelectedLessonId] = useState(() => dailyLessonId(loadLessons(), todayKey()));

  const activeLesson = lessonLibrary.find((lesson) => lesson.id === selectedLessonId) ?? lessonLibrary[0];
  const effectiveSession = authSession ?? (prototypeBypassLogin ? { id: 'demo-athlete', role: 'athlete', name: 'Demo Athlete', email: '' } : null);
  const isAuthed = Boolean(effectiveSession);
  const standardsCompleted = standards.filter((item) => item.done).length;
  const submittedToday = lastSubmittedDate === dailyDate;

  const completion = standards.length
    ? Math.round((standardsCompleted / standards.length) * 100)
    : 0;
  const confidenceAverage = Math.round(
    (scores.confidence + scores.energy + scores.mood + scores.belief) / 4
  );
  const athleteScore = pointsTotal(pointsLedger);
  const todayPoints = pointsToday(pointsLedger, dailyDate);
  const recentPointEvents = latestPointEvents(pointsLedger);

  useEffect(() => {
    localStorage.setItem(
      dailyStateKey,
      JSON.stringify({
        date: dailyDate,
        standards,
        scores,
        streakCount,
        lastSubmittedDate,
        lastReminderDate,
        readinessHistory,
        standardsHistory,
        notifications
      })
    );
  }, [dailyDate, lastReminderDate, lastSubmittedDate, notifications, readinessHistory, scores, standards, standardsHistory, streakCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const refreshViewport = () => {
      const phoneViewport = window.matchMedia('(max-width: 720px)').matches;
      const viewportHeight = Math.floor(window.visualViewport?.height || window.innerHeight || 0);
      setIsPhoneViewport(phoneViewport);
      setViewportRevision((current) => current + 1);
      if (viewportHeight > 0) {
        document.documentElement.style.setProperty('--app-height', `${viewportHeight}px`);
      }
      document.documentElement.scrollLeft = 0;
      if (document.body) document.body.scrollLeft = 0;
      document.querySelectorAll('*').forEach((element) => {
        if (element instanceof HTMLElement && element.scrollLeft) element.scrollLeft = 0;
      });
    };

    const timeouts = [0, 80, 240, 700, 1400].map((delay) => window.setTimeout(refreshViewport, delay));
    window.addEventListener('resize', refreshViewport, { passive: true });
    window.addEventListener('orientationchange', refreshViewport, { passive: true });
    window.visualViewport?.addEventListener('resize', refreshViewport, { passive: true });
    window.visualViewport?.addEventListener('scroll', refreshViewport, { passive: true });

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
      window.removeEventListener('resize', refreshViewport);
      window.removeEventListener('orientationchange', refreshViewport);
      window.visualViewport?.removeEventListener('resize', refreshViewport);
      window.visualViewport?.removeEventListener('scroll', refreshViewport);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(journalStorageKey, JSON.stringify(journalEntries));
  }, [journalEntries]);

  useEffect(() => {
    localStorage.setItem(coachStorageKey, JSON.stringify(coachSessions));
  }, [coachSessions]);

  useEffect(() => {
    localStorage.setItem(lessonStorageKey, JSON.stringify(lessonLibrary));
  }, [lessonLibrary]);

  useEffect(() => {
    localStorage.setItem(athleteProfileStorageKey, JSON.stringify(athleteProfile));
  }, [athleteProfile]);

  useEffect(() => {
    localStorage.setItem(goalsStorageKey, JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    localStorage.setItem(plansStorageKey, JSON.stringify(plans));
  }, [plans]);

  useEffect(() => {
    localStorage.setItem(planProgressStorageKey, JSON.stringify(planProgress));
  }, [planProgress]);

  useEffect(() => {
    localStorage.setItem(pointsLedgerStorageKey, JSON.stringify(pointsLedger));
  }, [pointsLedger]);

  useEffect(() => {
    localStorage.setItem(authUsersStorageKey, JSON.stringify(authUsers));
  }, [authUsers]);

  useEffect(() => {
    if (authSession) {
      localStorage.setItem(authSessionStorageKey, JSON.stringify(authSession));
    } else {
      localStorage.removeItem(authSessionStorageKey);
    }
  }, [authSession]);

  useEffect(() => {
    if (!isSupabaseConfigured || authSession?.role !== 'athlete') {
      setSupabaseAthleteDataReady(false);
      return;
    }

    let cancelled = false;

    async function loadAthleteData() {
      const [
        profileResult,
        goalsResult,
        standardsResult,
        standardsHistoryResult,
        readinessResult,
        journalResult,
        planProgressResult,
        pointsLedgerResult,
        privacyResult
      ] = await Promise.all([
        supabase
          .from('athlete_profiles')
          .select('sport, age, location, photo_url, parent_contact, parent_access_code')
          .eq('user_id', authSession.id)
          .maybeSingle(),
        supabase
          .from('goals')
          .select('id, label, value, progress')
          .eq('athlete_user_id', authSession.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('daily_standards')
          .select('id, label, goal_id')
          .eq('athlete_user_id', authSession.id)
          .eq('active', true)
          .order('created_at', { ascending: true }),
        supabase
          .from('standards_history')
          .select('entry_date, completed, total, percent, standards, submitted_at')
          .eq('athlete_user_id', authSession.id)
          .order('entry_date', { ascending: true }),
        supabase
          .from('readiness_checks')
          .select('entry_date, confidence, energy, mood, belief')
          .eq('athlete_user_id', authSession.id)
          .order('entry_date', { ascending: true }),
        supabase
          .from('journal_entries')
          .select('id, goal_id, entry_type, body, created_at')
          .eq('athlete_user_id', authSession.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('performance_plan_progress')
          .select('plan_id, completed_at')
          .eq('athlete_user_id', authSession.id),
        supabase
          .from('athlete_points_ledger')
          .select('id, event_key, event_type, points, label, metadata, entry_date, created_at')
          .eq('athlete_user_id', authSession.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('athlete_privacy_settings')
          .select('readiness_visible, standards_visible, goals_visible, journal_private, coach_private')
          .eq('athlete_user_id', authSession.id)
          .maybeSingle()
      ]);

      if (cancelled) return;

      if (!profileResult.error) {
        setAthleteProfile((current) => profileFromSupabase(profileResult.data, authSession, current));
      }

      if (!goalsResult.error && Array.isArray(goalsResult.data) && goalsResult.data.length) {
        setGoals(goalsResult.data.map(goalFromSupabase));
      }

      if (!standardsResult.error && Array.isArray(standardsResult.data) && standardsResult.data.length) {
        setStandards((current) => {
          const doneByLabel = new Map(current.map((standard) => [standard.label, standard.done]));
          return standardsResult.data.map((row) => ({
            ...standardFromSupabase(row),
            done: doneByLabel.get(row.label) ?? false
          }));
        });
      }

      if (!standardsHistoryResult.error) {
        const remoteHistory = standardsHistoryFromSupabase(standardsHistoryResult.data);
        if (remoteHistory.length) setStandardsHistory(remoteHistory);
      }

      if (!readinessResult.error) {
        const remoteReadiness = readinessFromSupabase(readinessResult.data);
        if (remoteReadiness.length) setReadinessHistory(remoteReadiness);
        const todayReadiness = readinessResult.data?.find((entry) => entry.entry_date === todayKey());
        if (todayReadiness) {
          setScores({
            confidence: Number(todayReadiness.confidence) || 0,
            energy: Number(todayReadiness.energy) || 0,
            mood: Number(todayReadiness.mood) || 0,
            belief: Number(todayReadiness.belief) || 0
          });
        }
      }

      if (!journalResult.error && Array.isArray(journalResult.data)) {
        setJournalEntries(journalResult.data.map(journalFromSupabase));
      }

      if (!planProgressResult.error && Array.isArray(planProgressResult.data)) {
        setPlanProgress(Object.fromEntries(
          planProgressResult.data.map((entry) => [String(entry.plan_id), entry.completed_at])
        ));
      }

      if (!pointsLedgerResult.error && Array.isArray(pointsLedgerResult.data)) {
        setPointsLedger(pointsLedgerResult.data.map(pointEventFromSupabase));
      }

      if (!privacyResult.error && privacyResult.data) {
        setPrivacySettings({
          readinessVisible: Boolean(privacyResult.data.readiness_visible),
          standardsVisible: Boolean(privacyResult.data.standards_visible),
          goalsVisible: Boolean(privacyResult.data.goals_visible),
          journalPrivate: Boolean(privacyResult.data.journal_private),
          coachPrivate: Boolean(privacyResult.data.coach_private)
        });
      }

      setSupabaseAthleteDataReady(true);
    }

    loadAthleteData();

    return () => {
      cancelled = true;
    };
  }, [authSession?.id, authSession?.name, authSession?.role]);

  useEffect(() => {
    if (!isSupabaseConfigured || authSession?.role !== 'athlete') return;
    let cancelled = false;

    async function loadCoachData() {
      const { data, error } = await supabase
        .from('coach_sessions')
        .select('id, title, session_date, session_time, messages, updated_at')
        .eq('athlete_user_id', authSession.id)
        .order('updated_at', { ascending: false })
        .limit(30);

      if (cancelled || error || !Array.isArray(data)) return;
      const sessions = data.map(coachSessionFromSupabase);
      setCoachSessions(sessions);
      if (sessions.length && !activeCoachSessionId && messages.length === 0) {
        setActiveCoachSessionId(sessions[0].id);
        setMessages(sessions[0].messages);
      }
    }

    loadCoachData();

    return () => {
      cancelled = true;
    };
  }, [authSession?.id, authSession?.role, dailyDate]);

  useEffect(() => {
    if (!isSupabaseConfigured || !authSession) {
      return;
    }

    let cancelled = false;

    async function loadSharedContent() {
      const [lessonsResult, plansResult, parentMessageResult] = await Promise.all([
        supabase
          .from('daily_deposits')
          .select('id, title, body, focus_question, release_date, status')
          .order('release_date', { ascending: false }),
        supabase
          .from('performance_plans')
          .select('id, title, subject, steps, release_date, challenge_day, challenge_length')
          .order('release_date', { ascending: true }),
        supabase
          .from('parent_messages')
          .select('title, body, conversation_cue, avoid, send_date, status')
          .order('send_date', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      if (cancelled) return;

      if (!lessonsResult.error && Array.isArray(lessonsResult.data) && lessonsResult.data.length) {
        const nextLessons = lessonsResult.data.map(lessonFromSupabase);
        setLessonLibrary(nextLessons);
        setSelectedLessonId(dailyLessonId(nextLessons, dailyDate));
      }

      if (!plansResult.error && Array.isArray(plansResult.data) && plansResult.data.length) {
        setPlans(plansResult.data.map(planFromSupabase));
      }

      if (!parentMessageResult.error && parentMessageResult.data) {
        setParentMessage(parentMessageFromSupabase(parentMessageResult.data));
      }

    }

    loadSharedContent();

    return () => {
      cancelled = true;
    };
  }, [authSession?.id, authSession?.role]);

  useEffect(() => {
    setSelectedLessonId(dailyLessonId(lessonLibrary, dailyDate));
  }, [dailyDate, lessonLibrary]);

  useEffect(() => {
    if (!isSupabaseConfigured || authSession?.role !== 'parent') {
      setParentLinkChecked(false);
      setLinkedAthleteId(null);
      return;
    }
    let cancelled = false;
    setParentLinkChecked(false);

    async function loadLinkedAthleteData() {
      const { data: links, error: linksError } = await supabase
        .from('parent_links')
        .select('athlete_user_id')
        .eq('parent_user_id', authSession.id)
        .limit(1);

      const athleteUserId = links?.[0]?.athlete_user_id;
      if (linksError || !athleteUserId || cancelled) {
        setLinkedAthleteId(null);
        setParentLinkChecked(true);
        return;
      }
      setLinkedAthleteId(athleteUserId);

      const [profileResult, goalsResult, standardsHistoryResult, readinessResult, journalResult, privacyResult, planProgressResult, pointsLedgerResult] = await Promise.all([
        supabase
          .from('athlete_profiles')
          .select('sport, age, location, photo_url, parent_contact, parent_access_code')
          .eq('user_id', athleteUserId)
          .maybeSingle(),
        supabase
          .from('goals')
          .select('id, label, value, progress')
          .eq('athlete_user_id', athleteUserId)
          .order('created_at', { ascending: true }),
        supabase
          .from('standards_history')
          .select('entry_date, completed, total, percent, standards, submitted_at')
          .eq('athlete_user_id', athleteUserId)
          .order('entry_date', { ascending: true }),
        supabase
          .from('readiness_checks')
          .select('entry_date, confidence, energy, mood, belief')
          .eq('athlete_user_id', athleteUserId)
          .order('entry_date', { ascending: true }),
        supabase
          .from('journal_entries')
          .select('id, goal_id, entry_type, body, created_at')
          .eq('athlete_user_id', athleteUserId)
          .order('created_at', { ascending: false }),
        supabase
          .from('athlete_privacy_settings')
          .select('readiness_visible, standards_visible, goals_visible, journal_private, coach_private')
          .eq('athlete_user_id', athleteUserId)
          .maybeSingle(),
        supabase
          .from('performance_plan_progress')
          .select('plan_id, completed_at')
          .eq('athlete_user_id', athleteUserId),
        supabase
          .from('athlete_points_ledger')
          .select('id, event_key, event_type, points, label, metadata, entry_date, created_at')
          .eq('athlete_user_id', athleteUserId)
          .order('created_at', { ascending: false })
      ]);

      if (cancelled) return;

      if (!profileResult.error) {
        setAthleteProfile((current) => profileFromSupabase(profileResult.data, current, current));
      }
      if (!goalsResult.error) setGoals((goalsResult.data ?? []).map(goalFromSupabase));
      if (!standardsHistoryResult.error) setStandardsHistory(standardsHistoryFromSupabase(standardsHistoryResult.data));
      if (!readinessResult.error) setReadinessHistory(readinessFromSupabase(readinessResult.data));
      if (!journalResult.error) setJournalEntries((journalResult.data ?? []).map(journalFromSupabase));
      if (!planProgressResult.error && Array.isArray(planProgressResult.data)) {
        setPlanProgress(Object.fromEntries(
          planProgressResult.data.map((entry) => [String(entry.plan_id), entry.completed_at])
        ));
      }
      if (!pointsLedgerResult.error && Array.isArray(pointsLedgerResult.data)) {
        setPointsLedger(pointsLedgerResult.data.map(pointEventFromSupabase));
      } else {
        setPointsLedger([]);
      }
      if (!privacyResult.error && privacyResult.data) {
        setPrivacySettings({
          readinessVisible: Boolean(privacyResult.data.readiness_visible),
          standardsVisible: Boolean(privacyResult.data.standards_visible),
          goalsVisible: Boolean(privacyResult.data.goals_visible),
          journalPrivate: Boolean(privacyResult.data.journal_private),
          coachPrivate: Boolean(privacyResult.data.coach_private)
        });
      }
      setParentLinkChecked(true);
    }

    loadLinkedAthleteData();

    return () => {
      cancelled = true;
    };
  }, [authSession?.id, authSession?.role, parentLinkRefreshKey]);

  useEffect(() => {
    if (!isSupabaseConfigured || authSession?.role !== 'athlete' || !supabaseAthleteDataReady) return;

    supabase
      .from('profiles')
      .update({ full_name: athleteProfile.name ?? '' })
      .eq('id', authSession.id);

    supabase
      .from('athlete_profiles')
      .upsert({
        user_id: authSession.id,
        sport: athleteProfile.sport ?? '',
        age: athleteProfile.age ?? '',
        location: athleteProfile.location ?? '',
        photo_url: athleteProfile.photo ?? '',
        parent_contact: athleteProfile.parentContact ?? '',
        parent_access_code: athleteProfile.parentAccessCode ?? 'TCA-PARENT',
        updated_at: new Date().toISOString()
      });
  }, [athleteProfile, authSession?.id, authSession?.role, supabaseAthleteDataReady]);

  useEffect(() => {
    if (!isSupabaseConfigured || authSession?.role !== 'athlete' || !supabaseAthleteDataReady) return;

    supabase
      .from('athlete_privacy_settings')
      .upsert({
        athlete_user_id: authSession.id,
        readiness_visible: privacySettings.readinessVisible,
        standards_visible: privacySettings.standardsVisible,
        goals_visible: privacySettings.goalsVisible,
        journal_private: privacySettings.journalPrivate,
        coach_private: privacySettings.coachPrivate,
        updated_at: new Date().toISOString()
      });
  }, [authSession?.id, authSession?.role, privacySettings, supabaseAthleteDataReady]);

  useEffect(() => {
    if (!isSupabaseConfigured || authSession?.role !== 'athlete' || !supabaseAthleteDataReady) return;
    let cancelled = false;

    async function persistGoals() {
      const remoteGoals = goals.filter((goal) => isSupabaseId(goal.id));
      const localGoals = goals.filter((goal) => !isSupabaseId(goal.id));

      if (localGoals.length) {
        const { data, error } = await supabase
          .from('goals')
          .insert(localGoals.map((goal) => goalToSupabase(goal, authSession.id)))
          .select('id, label, value, progress');

        if (!cancelled && !error && Array.isArray(data)) {
          const savedGoals = data.map(goalFromSupabase);
          const idMap = new Map(localGoals.map((goal, index) => [goal.id, savedGoals[index]?.id]).filter(([, id]) => id));

          setGoals([...remoteGoals, ...savedGoals]);
          setStandards((current) =>
            current.map((standard) => ({
              ...standard,
              goalId: idMap.get(standard.goalId) ?? standard.goalId
            }))
          );
          setJournalEntries((current) =>
            current.map((entry) => ({
              ...entry,
              linkedGoalId: idMap.get(entry.linkedGoalId) ?? entry.linkedGoalId
            }))
          );
        }
        return;
      }

      const { data: existingRows } = await supabase
        .from('goals')
        .select('id')
        .eq('athlete_user_id', authSession.id);

      if (cancelled) return;

      const currentIds = new Set(remoteGoals.map((goal) => goal.id));
      const deletedIds = (existingRows ?? [])
        .map((row) => row.id)
        .filter((id) => !currentIds.has(id));

      if (deletedIds.length) {
        await supabase.from('goals').delete().in('id', deletedIds);
      }

      if (remoteGoals.length) {
        await supabase.from('goals').upsert(remoteGoals.map((goal) => goalToSupabase(goal, authSession.id)));
      }
    }

    persistGoals();

    return () => {
      cancelled = true;
    };
  }, [authSession?.id, authSession?.role, goals, supabaseAthleteDataReady]);

  useEffect(() => {
    if (!isSupabaseConfigured || authSession?.role !== 'athlete' || !supabaseAthleteDataReady) return;
    let cancelled = false;

    async function persistStandards() {
      const remoteStandards = standards.filter((standard) => isSupabaseId(standard.id));
      const localStandards = standards.filter((standard) => !isSupabaseId(standard.id));

      if (localStandards.length) {
        const { data, error } = await supabase
          .from('daily_standards')
          .insert(localStandards.map((standard) => standardToSupabase(standard, authSession.id)))
          .select('id, label, goal_id');

        if (!cancelled && !error && Array.isArray(data)) {
          const savedStandards = data.map(standardFromSupabase);
          const idMap = new Map(localStandards.map((standard, index) => [standard.id, savedStandards[index]?.id]).filter(([, id]) => id));
          setStandards([...remoteStandards, ...savedStandards].map((standard) => ({
            ...standard,
            done: standards.find((item) => item.id === standard.id || idMap.get(item.id) === standard.id)?.done ?? false
          })));
        }
        return;
      }

      const { data: existingRows } = await supabase
        .from('daily_standards')
        .select('id')
        .eq('athlete_user_id', authSession.id);

      if (cancelled) return;

      const currentIds = new Set(remoteStandards.map((standard) => standard.id));
      const deletedIds = (existingRows ?? [])
        .map((row) => row.id)
        .filter((id) => !currentIds.has(id));

      if (deletedIds.length) {
        await supabase.from('daily_standards').delete().in('id', deletedIds);
      }

      if (remoteStandards.length) {
        await supabase
          .from('daily_standards')
          .upsert(remoteStandards.map((standard) => standardToSupabase(standard, authSession.id)));
      }
    }

    persistStandards();

    return () => {
      cancelled = true;
    };
  }, [authSession?.id, authSession?.role, standards, supabaseAthleteDataReady]);

  useEffect(() => {
    if (!isSupabaseConfigured || authSession?.role !== 'athlete' || !supabaseAthleteDataReady) return;

    const checkedIn = Object.values(scores).some((score) => Number(score) > 0);
    if (!checkedIn) return;

    const readinessScore = Math.round(
      (Number(scores.confidence) + Number(scores.energy) + Number(scores.mood) + Number(scores.belief)) / 4
    );

    setReadinessHistory((current) => saveReadinessScore(current, dailyDate, readinessScore));

    supabase
      .from('readiness_checks')
      .upsert({
        athlete_user_id: authSession.id,
        entry_date: dailyDate,
        confidence: Number(scores.confidence) || 0,
        energy: Number(scores.energy) || 0,
        mood: Number(scores.mood) || 0,
        belief: Number(scores.belief) || 0
      }, { onConflict: 'athlete_user_id,entry_date' });
  }, [authSession?.id, authSession?.role, dailyDate, scores, supabaseAthleteDataReady]);

  useEffect(() => {
    if (!isSupabaseConfigured || authSession?.role !== 'athlete' || !supabaseAthleteDataReady || !standardsHistory.length) return;

    supabase
      .from('standards_history')
      .upsert(
        standardsHistory.map((entry) => ({
          athlete_user_id: authSession.id,
          entry_date: entry.date,
          completed: Number(entry.completed) || 0,
          total: Number(entry.total) || 0,
          percent: Number(entry.percent) || 0,
          standards: entry.standards ?? [],
          submitted_at: new Date().toISOString()
        })),
        { onConflict: 'athlete_user_id,entry_date' }
      );
  }, [authSession?.id, authSession?.role, standardsHistory, supabaseAthleteDataReady]);

  useEffect(() => {
    if (!isSupabaseConfigured || authSession?.role !== 'athlete' || !supabaseAthleteDataReady) return;
    let cancelled = false;

    async function persistJournal() {
      const remoteEntries = journalEntries.filter((entry) => isSupabaseId(entry.id));
      const localEntries = journalEntries.filter((entry) => !isSupabaseId(entry.id));

      if (localEntries.length) {
        const { data, error } = await supabase
          .from('journal_entries')
          .insert(localEntries.map((entry) => journalToSupabase(entry, authSession.id)))
          .select('id, goal_id, entry_type, body, created_at');

        if (!cancelled && !error && Array.isArray(data)) {
          setJournalEntries([...data.map(journalFromSupabase), ...remoteEntries]);
        }
        return;
      }

      const { data: existingRows } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('athlete_user_id', authSession.id);

      if (cancelled) return;

      const currentIds = new Set(remoteEntries.map((entry) => entry.id));
      const deletedIds = (existingRows ?? [])
        .map((row) => row.id)
        .filter((id) => !currentIds.has(id));

      if (deletedIds.length) {
        await supabase.from('journal_entries').delete().in('id', deletedIds);
      }

      if (remoteEntries.length) {
        await supabase
          .from('journal_entries')
          .upsert(remoteEntries.map((entry) => journalToSupabase(entry, authSession.id)));
      }
    }

    persistJournal();

    return () => {
      cancelled = true;
    };
  }, [authSession?.id, authSession?.role, journalEntries, supabaseAthleteDataReady]);

  useEffect(() => {
    if (!isSupabaseConfigured || authSession?.role !== 'athlete' || !supabaseAthleteDataReady) return;

    const entries = Object.entries(planProgress).filter(([, completedAt]) => completedAt);
    if (!entries.length) return;

    supabase
      .from('performance_plan_progress')
      .upsert(
        entries.map(([planId, completedAt]) => ({
          athlete_user_id: authSession.id,
          plan_id: String(planId),
          completed_at: completedAt,
          updated_at: new Date().toISOString()
        })),
        { onConflict: 'athlete_user_id,plan_id' }
      );
  }, [authSession?.id, authSession?.role, planProgress, supabaseAthleteDataReady]);

  useEffect(() => {
    if (!isSupabaseConfigured || authSession?.role !== 'athlete' || !supabaseAthleteDataReady || !pointsLedger.length) return;

    supabase
      .from('athlete_points_ledger')
      .upsert(
        pointsLedger.map((entry) => pointEventToSupabase(entry, authSession.id)),
        { onConflict: 'athlete_user_id,event_key' }
      );
  }, [authSession?.id, authSession?.role, pointsLedger, supabaseAthleteDataReady]);

  async function signupUser({ role, name, email, password, parentCode }) {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !password) {
      return 'Email and password are required.';
    }

    if (authUsers.some((user) => user.email === cleanEmail)) {
      return 'An account already exists for that email.';
    }

    if (role === 'admin') {
      return 'Admin access has moved outside the athlete app.';
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: name.trim(),
            role
          }
        }
      });

      if (error) return error.message;

      if (data.user && data.session) {
        if (role === 'parent' && parentCode) {
          const { error: linkError } = await supabase.rpc('link_parent_to_athlete', { access_code: parentCode.trim() });
          if (linkError) {
            return 'Account created, but the parent link could not be created. Check the access code.';
          }
        }

        const fullName = name.trim() || role;
        setAuthSession({ id: data.user.id, role, name: fullName, email: cleanEmail });
        setView(role === 'parent' ? 'parent' : 'athlete');
        window.history.replaceState({}, '', window.location.pathname);
      }

      return data.session ? '' : 'Account created. Check your email if confirmation is required, then log in.';
    }

    const nextUser = {
      id: Date.now(),
      role,
      name: name.trim() || role,
      email: cleanEmail,
      password
    };
    setAuthUsers((current) => [...current, nextUser]);
    setAuthSession({ id: nextUser.id, role: nextUser.role, name: nextUser.name, email: nextUser.email });
    setView(role === 'parent' ? 'parent' : 'athlete');
    return '';
  }

  async function loginUser({ role, email, password }) {
    const cleanEmail = normalizeEmail(email);

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (error) return error.message;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) return profileError.message;
      if (!profile) return 'No profile found for this account.';
      if (profile.role === 'admin') {
        await supabase.auth.signOut();
        return 'Admin access has moved outside the athlete app.';
      }
      if (profile.role !== role) return `This account is registered as ${profile.role}. Choose the correct portal.`;

      setAuthSession({
        id: profile.id,
        role: profile.role,
        name: profile.full_name || profile.role,
        email: cleanEmail
      });
      setView(role === 'parent' ? 'parent' : 'athlete');
      window.history.replaceState({}, '', window.location.pathname);
      return '';
    }

    const user = authUsers.find((account) => account.email === cleanEmail && account.password === password);
    if (!user) return 'No account found with that email and password.';
    if (user.role === 'admin') return 'Admin access has moved outside the athlete app.';
    if (user.role !== role) return `This account is registered as ${user.role}. Choose the correct portal.`;
    setAuthSession({ id: user.id, role: user.role, name: user.name, email: user.email });
    setView(role === 'parent' ? 'parent' : 'athlete');
    return '';
  }

  async function requestPasswordReset(email) {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) return 'Enter your email first.';
    if (!isSupabaseConfigured) return 'Password reset is available when the live backend is connected.';

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/`
    });
    if (error) return error.message;
    return 'Password reset email sent. Check your inbox.';
  }

  async function deleteAccount() {
    if (!isSupabaseConfigured) return 'Account deletion is available when the live backend is connected.';
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return 'Sign in again before deleting your account.';

    const response = await fetch(appApiUrl('/api/delete-account'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return payload.error || 'Account deletion failed. Contact support.';

    await supabase.auth.signOut();
    setAuthSession(null);
    setNotificationsOpen(false);
    setView('athlete');
    setTab('home');
    return '';
  }

  async function logoutUser() {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setAuthSession(null);
    setNotificationsOpen(false);
    setView('athlete');
    setTab('home');
    setParentAccessDraft('');
    setParentLinkFeedback('');
    setParentLinkChecked(false);
    setLinkedAthleteId(null);
  }

  async function linkParentAccessCode(event) {
    event?.preventDefault();
    const accessCode = parentAccessDraft.trim();
    if (!accessCode) {
      setParentLinkFeedback('Enter the parent access code from your athlete.');
      return;
    }
    if (!isSupabaseConfigured || authSession?.role !== 'parent') {
      setParentLinkFeedback('Log in as a parent before linking an athlete.');
      return;
    }

    const { error } = await supabase.rpc('link_parent_to_athlete', { access_code: accessCode });
    if (error) {
      setParentLinkFeedback('That code did not link. Check the code and try again.');
      return;
    }

    setParentAccessDraft('');
    setParentLinkFeedback('Athlete linked. Loading parent dashboard...');
    setParentLinkRefreshKey((value) => value + 1);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile) return;
      if (profile.role === 'admin') {
        await supabase.auth.signOut();
        return;
      }

      setAuthSession({
        id: profile.id,
        role: profile.role,
        name: profile.full_name || profile.role,
        email: user.email ?? ''
      });
      setView(profile.role === 'parent' ? 'parent' : 'athlete');
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setAuthSession(null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  function notifyUser(title, body, tone = 'info') {
    setNotifications((current) => [buildNotification(title, body, tone), ...current].slice(0, 8));

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }

  function requestBrowserNotifications() {
    if (!('Notification' in window)) return;
    Notification.requestPermission();
  }

  function awardPoints({ type, points, label, uniqueKey, metadata = {} }) {
    const cleanKey = uniqueKey || `${type}-${Date.now()}`;
    const cleanPoints = Number(points) || 0;
    if (cleanPoints <= 0) return false;
    if (pointsLedger.some((entry) => entry.uniqueKey === cleanKey)) return false;
    const pointEvent = {
      id: `${cleanKey}-${Date.now()}`,
      uniqueKey: cleanKey,
      type,
      points: cleanPoints,
      label,
      metadata,
      date: todayKey(),
      createdAt: new Date().toISOString()
    };

    setPointsLedger((current) => {
      if (current.some((entry) => entry.uniqueKey === cleanKey)) return current;
      return [pointEvent, ...current];
    });

    persistPointEvent(pointEvent);
    notifyUser('Points earned', `+${cleanPoints} points · ${label}`, 'success');
    return true;
  }

  async function persistPointEvent(entry) {
    if (!isSupabaseConfigured || authSession?.role !== 'athlete' || !authSession.id) return;

    await supabase
      .from('athlete_points_ledger')
      .upsert(pointEventToSupabase(entry, authSession.id), { onConflict: 'athlete_user_id,event_key' });
  }

  async function persistPlanCompletion(planId, completedAt) {
    if (!isSupabaseConfigured || authSession?.role !== 'athlete' || !authSession.id) return;

    await supabase
      .from('performance_plan_progress')
      .upsert({
        athlete_user_id: authSession.id,
        plan_id: String(planId),
        completed_at: completedAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'athlete_user_id,plan_id' });
  }

  function celebrate(message) {
    setCelebration(message);
    window.setTimeout(() => setCelebration(''), 2800);
  }

  function completeOnboarding(setup) {
    const nextProfile = {
      ...athleteProfile,
      name: setup.name,
      sport: setup.sport,
      age: setup.age,
      location: setup.location,
      parentContact: setup.parentContact
    };
    const nextGoals = setup.goals
      .map((goal, index) => ({
        id: Date.now() + index,
        label: index === 0 ? 'Main Goal' : `Goal ${index + 1}`,
        value: goal,
        progress: 0
      }))
      .filter((goal) => goal.value.trim());
    const nextStandards = setup.standards
      .map((label, index) => ({
        id: Date.now() + 100 + index,
        label,
        done: false,
        goalId: nextGoals[index % Math.max(nextGoals.length, 1)]?.id ?? null
      }))
      .filter((standard) => standard.label.trim());

    setAthleteProfile(nextProfile);
    if (nextGoals.length) setGoals(nextGoals);
    if (nextStandards.length) setStandards(nextStandards);
    setTab('home');
    setView('athlete');
    setOnboardingComplete(true);
    localStorage.setItem(onboardingStorageKey, 'true');
    celebrate('Setup complete. Start with today.');
  }

  useEffect(() => {
    const resetIfNewDay = () => {
      const currentDate = todayKey();
      if (currentDate === dailyDate) return;
      setDailyDate(currentDate);
      setStandards((current) => resetStandardsForNewDay(current));
      setScores(emptyReadinessScores);
      setStreakCount((current) => {
        const submittedYesterday = lastSubmittedDate === addDays(currentDate, -1);
        return submittedYesterday ? current : 0;
      });
      if (lastSubmittedDate !== addDays(currentDate, -1)) {
        setLastSubmittedDate(null);
      }
    };

    resetIfNewDay();
    const timer = window.setInterval(resetIfNewDay, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [dailyDate, lastSubmittedDate]);

  useEffect(() => {
    const shouldWarn =
      streakCount >= 3 &&
      !submittedToday &&
      lastSubmittedDate === addDays(dailyDate, -1) &&
      lastReminderDate !== dailyDate;

    if (!shouldWarn) return;

    notifyUser(
      `${streakCount}-day streak on the line`,
      'Check off today’s productivity list and lock in your day to keep your streak alive.',
      'warning'
    );
    setLastReminderDate(dailyDate);
  }, [dailyDate, lastReminderDate, lastSubmittedDate, streakCount, submittedToday]);

  useEffect(() => {
    if (!effectiveSession) return;
    if (effectiveSession.role === 'athlete' && view !== 'athlete') setView('athlete');
    if (effectiveSession.role === 'parent' && view !== 'parent') setView('parent');
  }, [effectiveSession, view]);

  const content = useMemo(() => {
    if (view === 'parent') {
      return (
        <ParentDashboard
          athleteScore={athleteScore}
          standardsCompleted={standardsCompleted}
          standardsTotal={standards.length}
          linkedAthleteId={linkedAthleteId}
          linkParentAccessCode={linkParentAccessCode}
          parentAccessDraft={parentAccessDraft}
          parentLinkChecked={parentLinkChecked}
          parentLinkFeedback={parentLinkFeedback}
          parentMessage={parentMessage}
          planProgress={planProgress}
          plans={plans}
          setParentAccessDraft={setParentAccessDraft}
          setParentLinkFeedback={setParentLinkFeedback}
          privacySettings={privacySettings}
          goals={goals}
          lesson={activeLesson}
        />
      );
    }
    const screens = {
      home: (
        <HomeScreen
          athleteScore={athleteScore}
          awardPoints={awardPoints}
          completion={completion}
          confidenceAverage={confidenceAverage}
          scores={scores}
          goals={goals}
          standards={standards}
          standardDraft={standardDraft}
          standardGoalId={standardGoalId}
          setStandardGoalId={setStandardGoalId}
          setStandardDraft={setStandardDraft}
          setScores={setScores}
          setStandards={setStandards}
          setGoals={setGoals}
          setLastSubmittedDate={setLastSubmittedDate}
          setStreakCount={setStreakCount}
          setReadinessHistory={setReadinessHistory}
          setStandardsHistory={setStandardsHistory}
          setJournal={setJournal}
          setJournalType={setJournalType}
          setTab={setTab}
          notifyUser={notifyUser}
          celebrate={celebrate}
          lastSubmittedDate={lastSubmittedDate}
          lesson={activeLesson}
          planProgress={planProgress}
          plans={plans}
          recentPointEvents={recentPointEvents}
          standardsHistory={standardsHistory}
          streakCount={streakCount}
          submittedToday={submittedToday}
          todayPoints={todayPoints}
        />
      ),
      plans: (
        <PlansScreen
          plans={plans}
          planProgress={planProgress}
          setPlanProgress={setPlanProgress}
          awardPoints={awardPoints}
          persistPlanCompletion={persistPlanCompletion}
        />
      ),
      journal: (
        <JournalScreen
          awardPoints={awardPoints}
          celebrate={celebrate}
          journal={journal}
          journalEntries={journalEntries}
          journalGoalId={journalGoalId}
          journalType={journalType}
          setJournal={setJournal}
          setJournalEntries={setJournalEntries}
          setJournalGoalId={setJournalGoalId}
          setJournalType={setJournalType}
          goalDraft={goalDraft}
          goals={goals}
          setGoalDraft={setGoalDraft}
          setGoals={setGoals}
          standards={standards}
        />
      ),
      coach: (
        <CoachScreen
          activeCoachSessionId={activeCoachSessionId}
          athleteProfile={athleteProfile}
          authSession={authSession}
          coachSessions={coachSessions}
          lesson={activeLesson}
          goals={goals}
          messages={messages}
          planProgress={planProgress}
          plans={plans}
          standards={standards}
          setActiveCoachSessionId={setActiveCoachSessionId}
          setCoachSessions={setCoachSessions}
          setMessages={setMessages}
          messageDraft={messageDraft}
          setMessageDraft={setMessageDraft}
        />
      ),
      profile: (
        <ProfileScreen
          authSession={authSession}
          athleteProfile={athleteProfile}
          privacySettings={privacySettings}
          setAthleteProfile={setAthleteProfile}
          setPrivacySettings={setPrivacySettings}
        />
      )
    };
    return screens[tab];
  }, [
    activeLesson,
    athleteScore,
    awardPoints,
    completion,
    confidenceAverage,
    goalDraft,
    goals,
    journal,
    journalEntries,
    journalGoalId,
    journalType,
    lessonLibrary,
    lastSubmittedDate,
    activeCoachSessionId,
    athleteProfile,
    coachSessions,
    messageDraft,
    messages,
    parentMessage,
    planProgress,
    plans,
    recentPointEvents,
    privacySettings,
    readinessHistory,
    scores,
    selectedLessonId,
    standardDraft,
    standardGoalId,
    standards,
    standardsHistory,
    standardsCompleted,
    streakCount,
    submittedToday,
    tab,
    todayPoints,
    view
  ]);

  if (!isAuthed) {
    return (
      <AuthScreen
        loginUser={loginUser}
        requestPasswordReset={requestPasswordReset}
        signupUser={signupUser}
        parentAccessCode={athleteProfile.parentAccessCode}
      />
    );
  }

  if (!prototypeBypassLogin && !onboardingComplete) {
    return <OnboardingScreen completeOnboarding={completeOnboarding} />;
  }

  const useMobileAppShell = typeof window !== 'undefined'
    && (
      document.documentElement.classList.contains('native-shell')
      || isPhoneViewport
    );

  return (
    <div className={useMobileAppShell ? 'mobile-native-app' : 'app-shell'} data-viewport-revision={viewportRevision}>
      {!useMobileAppShell && (
        <aside className="rail">
          <div className="brand-mark">
            <span>TCA</span>
          </div>
          {effectiveSession.role === 'athlete' && (
            <button className="rail-btn active" onClick={() => setView('athlete')}>
              <Trophy size={20} />
              <span>Athlete</span>
            </button>
          )}
          {effectiveSession.role === 'parent' && (
            <button className="rail-btn active" onClick={() => setView('parent')}>
              <Users size={20} />
              <span>Parent</span>
            </button>
          )}
          <div className="rail-account">
            <strong>{effectiveSession.name}</strong>
            {!prototypeBypassLogin && <button onClick={logoutUser}>Log out</button>}
          </div>
        </aside>
      )}

      <main className={useMobileAppShell ? 'mobile-native-frame' : 'phone-frame'} aria-label="The Complete Athlete app prototype">
        <header className="topbar">
          <div>
            <p className="top-greeting">{timeBasedGreeting(effectiveSession.name)}</p>
            {view === 'athlete' && tab === 'home' ? null : (
              <h1>{view === 'athlete' ? screenTitles[tab] : 'Parent Dashboard'}</h1>
            )}
          </div>
          <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotificationsOpen((open) => !open)}>
            <Bell size={19} />
            {notifications.length > 0 && <span>{notifications.length}</span>}
          </button>
        </header>

        {notificationsOpen && (
          <NotificationTray
            notifications={notifications}
            requestBrowserNotifications={requestBrowserNotifications}
          />
        )}

        {celebration && <div className="celebration-banner">{celebration}</div>}

        <section className="content">{content}</section>

        {view === 'athlete' && <BottomNav tab={tab} setTab={setTab} />}
      </main>
    </div>
  );
}

const screenTitles = {
  home: 'Daily Deposit',
  plans: 'Performance Plans',
  journal: 'My Goals',
  coach: 'My Mindset Coach',
  profile: 'My Profile'
};

function AuthScreen({ loginUser, requestPasswordReset, signupUser, parentAccessCode }) {
  const inviteParams = new URLSearchParams(window.location.search);
  const invitedRole = inviteParams.get('role');
  const invitedCode = inviteParams.get('parentCode') ?? '';
  const invitedAsParent = invitedRole === 'parent' && invitedCode;
  const [mode, setMode] = useState(invitedRole === 'parent' && invitedCode ? 'signup' : 'login');
  const [role, setRole] = useState(invitedAsParent ? 'parent' : '');
  const [form, setForm] = useState({ name: '', email: '', password: '', parentCode: invitedCode });
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage('');
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (!role) {
      setMessage('Choose athlete or parent to continue.');
      return;
    }
    setIsSubmitting(true);
    const error = mode === 'login'
      ? loginUser({ role, email: form.email, password: form.password })
      : signupUser({ role, name: form.name, email: form.email, password: form.password, parentCode: form.parentCode });
    setMessage(await error);
    setIsSubmitting(false);
  }

  async function sendPasswordReset() {
    setIsSubmitting(true);
    setMessage(await requestPasswordReset(form.email));
    setIsSubmitting(false);
  }

  function chooseRole(nextRole) {
    setRole(nextRole);
    setMessage('');
    if (nextRole === 'parent' && invitedCode) setMode('signup');
  }

  if (!role) {
    return (
      <main className="auth-shell role-gate-shell" aria-label="Choose The Complete Athlete role">
        <section className="auth-brand-panel">
          <p className="eyebrow">The Complete Athlete</p>
          <h1>How are you using the app?</h1>
          <p>Start in the space built for your role. Athletes train the habits. Parents stay connected to the growth.</p>
        </section>

        <section className="auth-card role-choice-card">
          <button className="role-choice-button" onClick={() => chooseRole('athlete')} type="button">
            <span><Trophy size={18} /> Athlete</span>
            <strong>I’m an Athlete</strong>
            <em>Build goals, track daily work, train plans, journal, and use mindset coaching.</em>
          </button>
          <button className="role-choice-button" onClick={() => chooseRole('parent')} type="button">
            <span><Users size={18} /> Parent</span>
            <strong>I’m a Parent</strong>
            <em>Follow progress, support the plans, and stay connected to your athlete’s growth.</em>
          </button>
          <div className="auth-legal-links role-gate-links">
            <a href="/terms.html" target="_blank" rel="noreferrer">Terms of Use</a>
            <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell auth-login-shell" aria-label="The Complete Athlete login">
      <section className="auth-brand-panel">
        <p className="eyebrow">The Complete Athlete</p>
        <h1>Access the side built for you.</h1>
        <p>Athletes build the day. Parents support the day.</p>
        <div className="auth-role-summary">
          <span><Trophy size={16} /> Athlete</span>
          <span><Users size={16} /> Parent</span>
        </div>
      </section>

      <section className="auth-card">
        {!invitedAsParent && (
          <button className="plan-back-button auth-back-button" onClick={() => setRole('')} type="button">
            Change role
          </button>
        )}
        <div className="auth-mode">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">
            Login
          </button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')} type="button">
            Create account
          </button>
        </div>

        <div className="role-tabs">
          {[
            ['athlete', Trophy, 'Athlete'],
            ['parent', Users, 'Parent']
          ].map(([id, Icon, label]) => (
            <button className={role === id ? 'active' : ''} key={id} onClick={() => setRole(id)} type="button">
              <Icon size={17} />
              {label}
            </button>
          ))}
        </div>

        <form className="auth-form" onSubmit={submitAuth}>
          {mode === 'signup' && (
            <label>
              <span>Name</span>
              <input
                className="text-field"
                placeholder="Full name"
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
              />
            </label>
          )}
          <label>
            <span>Email</span>
            <input
              className="text-field"
              placeholder="name@email.com"
              type="email"
              value={form.email}
              onChange={(event) => updateForm('email', event.target.value)}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              className="text-field"
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(event) => updateForm('password', event.target.value)}
            />
          </label>
          {mode === 'signup' && role === 'parent' && (
            <label>
              <span>Parent access code</span>
              <input
                className="text-field"
                placeholder={parentAccessCode}
                value={form.parentCode}
                onChange={(event) => updateForm('parentCode', event.target.value)}
              />
            </label>
          )}
          {message && <p className="inline-warning">{message}</p>}
          <button className="primary-action full" disabled={isSubmitting} type="submit">
            <LockKeyhole size={18} />
            {isSubmitting ? 'Working...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
          {mode === 'login' && (
            <button className="ghost-action full" disabled={isSubmitting} onClick={sendPasswordReset} type="button">
              Reset Password
            </button>
          )}
        </form>
        <div className="auth-legal-links">
          <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy</a>
          <a href="/terms.html" target="_blank" rel="noreferrer">Terms</a>
          <a href="/support.html" target="_blank" rel="noreferrer">Support</a>
        </div>
      </section>
    </main>
  );
}

function OnboardingScreen({ completeOnboarding }) {
  const [setup, setSetup] = useState({
    name: '',
    sport: '',
    age: '',
    location: '',
    parentContact: '',
    goals: [''],
    standards: standardsSeed.map((standard) => standard.label)
  });
  const [message, setMessage] = useState('');

  function updateField(field, value) {
    setSetup((current) => ({ ...current, [field]: value }));
    setMessage('');
  }

  function updateList(field, index, value) {
    setSetup((current) => ({
      ...current,
      [field]: current[field].map((item, itemIndex) => (itemIndex === index ? value : item))
    }));
    setMessage('');
  }

  function addListItem(field, value = '') {
    setSetup((current) => ({ ...current, [field]: [...current[field], value] }));
  }

  function removeListItem(field, index) {
    setSetup((current) => ({
      ...current,
      [field]: current[field].filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  function startOnboarding(event) {
    event.preventDefault();
    const cleanSetup = {
      ...setup,
      goals: setup.goals.map((goal) => goal.trim()).filter(Boolean),
      standards: setup.standards.map((standard) => standard.trim()).filter(Boolean)
    };

    if (!cleanSetup.name.trim() || !cleanSetup.sport.trim()) {
      setMessage('Add the athlete name and sport to start.');
      return;
    }

    if (cleanSetup.goals.length === 0) {
      setMessage('Set at least one goal.');
      return;
    }

    if (cleanSetup.standards.length === 0) {
      setMessage('Add at least one daily productivity item.');
      return;
    }

    completeOnboarding(cleanSetup);
  }

  return (
    <main className="onboarding-shell" aria-label="The Complete Athlete onboarding">
      <section className="onboarding-hero">
        <p className="eyebrow">The Complete Athlete</p>
        <h1>Set your foundation.</h1>
        <p>Add the details that shape your experience: who you are, what you are working toward, and the daily work you want to track.</p>
      </section>

      <form className="onboarding-form" onSubmit={startOnboarding}>
        <section className="panel onboarding-panel">
          <PanelTitle icon={<UserRound size={18} />} title="Athlete" action="Profile" />
          <div className="form-grid">
            <label>
              <span>Name</span>
              <input
                className="text-field"
                placeholder="Athlete name"
                value={setup.name}
                onChange={(event) => updateField('name', event.target.value)}
              />
            </label>
            <label>
              <span>Sport</span>
              <input
                className="text-field"
                placeholder="Sport"
                value={setup.sport}
                onChange={(event) => updateField('sport', event.target.value)}
              />
            </label>
            <label>
              <span>Age</span>
              <input
                className="text-field"
                inputMode="numeric"
                maxLength="2"
                placeholder="Age"
                value={setup.age}
                onChange={(event) => updateField('age', event.target.value.replace(/\D/g, '').slice(0, 2))}
              />
            </label>
            <label>
              <span>State or country</span>
              <input
                className="text-field"
                placeholder="Location"
                value={setup.location}
                onChange={(event) => updateField('location', event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="panel onboarding-panel">
          <PanelTitle icon={<Target size={18} />} title="Goals" action={`${setup.goals.filter(Boolean).length} set`} />
          <div className="onboarding-list">
            {setup.goals.map((goal, index) => (
              <label key={`goal-${index}`}>
                <span>Goal {index + 1}</span>
                <div>
                  <input
                    className="text-field"
                    placeholder="Write one goal clearly"
                    value={goal}
                    onChange={(event) => updateList('goals', index, event.target.value)}
                  />
                  {setup.goals.length > 1 && (
                    <button className="remove-standard" type="button" onClick={() => removeListItem('goals', index)}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </label>
            ))}
          </div>
          <button className="secondary-action inline" type="button" onClick={() => addListItem('goals')}>
            <Plus size={18} />
            Add Goal
          </button>
        </section>

        <section className="panel onboarding-panel">
          <PanelTitle icon={<BadgeCheck size={18} />} title="Daily Productivity" action={`${setup.standards.filter(Boolean).length} tasks`} />
          <div className="onboarding-list">
            {setup.standards.map((standard, index) => (
              <label key={`standard-${index}`}>
                <span>Task {index + 1}</span>
                <div>
                  <input
                    className="text-field"
                    placeholder="Task they can prove today"
                    value={standard}
                    onChange={(event) => updateList('standards', index, event.target.value)}
                  />
                  {setup.standards.length > 1 && (
                    <button className="remove-standard" type="button" onClick={() => removeListItem('standards', index)}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </label>
            ))}
          </div>
          <button className="secondary-action inline" type="button" onClick={() => addListItem('standards')}>
            <Plus size={18} />
            Add Task
          </button>
        </section>

        <section className="panel onboarding-panel">
          <PanelTitle icon={<Users size={18} />} title="Parent Access" action="Optional" />
          <label className="journal-label" htmlFor="onboarding-parent">
            Parent email or phone
          </label>
          <input
            id="onboarding-parent"
            className="text-field"
            placeholder="Add parent contact"
            value={setup.parentContact}
            onChange={(event) => updateField('parentContact', event.target.value)}
          />
        </section>

        {message && <p className="inline-warning">{message}</p>}
        <button className="primary-action full onboarding-start" type="submit">
          <Check size={18} />
          Start Today
        </button>
      </form>
    </main>
  );
}

function HomeScreen({
  athleteScore,
  awardPoints,
  celebrate,
  completion,
  confidenceAverage,
  goals,
  scores,
  standards,
  standardDraft,
  standardGoalId,
  setStandardGoalId,
  setStandardDraft,
  setGoals,
  setJournal,
  setJournalType,
  setScores,
  setStandards,
  setLastSubmittedDate,
  setStreakCount,
  setReadinessHistory,
  setStandardsHistory,
  setTab,
  notifyUser,
  lastSubmittedDate,
  lesson,
  planProgress,
  plans,
  recentPointEvents,
  standardsHistory,
  streakCount,
  submittedToday,
  todayPoints
}) {
  const [standardsFeedback, setStandardsFeedback] = useState('');
  const [standardsHistoryOpen, setStandardsHistoryOpen] = useState(false);
  const [scoreInfoOpen, setScoreInfoOpen] = useState(false);
  const [editingStandardId, setEditingStandardId] = useState(null);
  const [editingStandardDraft, setEditingStandardDraft] = useState('');
  const completedStandards = standards.filter((standard) => standard.done);
  const allStandardsCompleted = standards.length > 0 && completedStandards.length === standards.length;
  const recentStandardsHistory = [...standardsHistory].reverse().slice(0, 7);
  const averageGoalProgress = goals.length
    ? Math.round(goals.reduce((total, goal) => total + Number(goal.progress), 0) / goals.length)
    : 0;
  const planSeriesStats = planSeriesCompletion(plans, planProgress);
  const focusGoal = goals.find((goal) => Number(goal.progress) < 100) ?? goals[0];
  const todaysFocus = lessonFocusQuestion(lesson);

  function addStandard(event) {
    event.preventDefault();
    const label = standardDraft.trim();
    if (!label) return;
    setStandards((current) => [
      ...current,
      { id: Date.now(), label, done: false, goalId: standardGoalId || null }
    ]);
    setStandardDraft('');
    setStandardGoalId('');
    setStandardsFeedback('');
    celebrate('Added to today. Check it off when it is done.');
  }

  function removeStandard(id) {
    setStandards((current) => current.filter((standard) => standard.id !== id));
    if (editingStandardId === id) {
      setEditingStandardId(null);
      setEditingStandardDraft('');
    }
    setStandardsFeedback('');
  }

  function startEditingStandard(item) {
    setEditingStandardId(item.id);
    setEditingStandardDraft(item.label);
    setStandardsFeedback('');
  }

  function cancelEditingStandard() {
    setEditingStandardId(null);
    setEditingStandardDraft('');
    setStandardsFeedback('');
  }

  function saveEditingStandard(id) {
    const label = editingStandardDraft.trim();
    if (!label) {
      setStandardsFeedback('Add a task name before saving.');
      return;
    }
    setStandards((current) =>
      current.map((standard) =>
        standard.id === id ? { ...standard, label } : standard
      )
    );
    setEditingStandardId(null);
    setEditingStandardDraft('');
    setStandardsFeedback('');
  }

  function updateStandardGoal(id, goalId) {
    setStandards((current) =>
      current.map((standard) =>
        standard.id === id ? { ...standard, goalId: goalId || null } : standard
      )
    );
  }

  function submitStandards() {
    if (standards.length === 0) {
      setStandardsFeedback('Start by adding one thing you need to handle today.');
      return;
    }

    if (submittedToday) {
      setStandardsFeedback('Your day is locked in. Start fresh tomorrow.');
      return;
    }

    const submissionDate = todayKey();
    const nextStreak = lastSubmittedDate === addDays(submissionDate, -1) ? streakCount + 1 : 1;
    const completedGoalIds = [...new Set(completedStandards.map((standard) => standard.goalId).filter(Boolean))];
    setStreakCount(nextStreak);
    setLastSubmittedDate(submissionDate);
    setReadinessHistory((current) => saveReadinessScore(current, submissionDate, confidenceAverage));
    setStandardsHistory((current) =>
      saveStandardsHistory(current, {
        date: submissionDate,
        completed: completedStandards.length,
        total: standards.length,
        percent: standards.length ? Math.round((completedStandards.length / standards.length) * 100) : 0,
        submittedAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        standards: standards.map((standard) => ({
          label: standard.label,
          done: standard.done,
          goalLabel: goals.find((goal) => goal.id === standard.goalId)?.label ?? ''
        }))
      })
    );
    setGoals((current) =>
      current.map((goal) =>
        completedGoalIds.includes(goal.id)
          ? { ...goal, progress: Math.min(100, Number(goal.progress) + 5) }
          : goal
      )
    );
    const streakBonus = Math.min(nextStreak * pointValues.streakBonusPerDay, pointValues.streakBonusCap);
    const standardsPoints = allStandardsCompleted ? pointValues.standardsCompleted + streakBonus : 0;
    const awarded = standardsPoints > 0 && awardPoints({
      type: 'standards_completed',
      points: standardsPoints,
      label: streakBonus > 0 ? `Productivity tracker complete with ${nextStreak}-day streak bonus` : 'Productivity tracker complete',
      uniqueKey: `standards-completed-${submissionDate}`,
      metadata: { completed: completedStandards.length, total: standards.length, streak: nextStreak, streakBonus }
    });
    setStandardsFeedback('');
    celebrate(awarded ? `Day locked in. +${standardsPoints} points.` : 'Day submitted. Finish every item to earn productivity points.');

    notifyUser(
      allStandardsCompleted ? 'Productivity tracker locked' : 'Productivity submitted',
      allStandardsCompleted
        ? `Your day is locked in. Current streak: ${nextStreak} day${nextStreak === 1 ? '' : 's'}.`
        : `You submitted ${completedStandards.length} of ${standards.length} items. Complete every item to earn productivity points.`,
      'success'
    );

    if (nextStreak % 7 === 0) {
      notifyUser(
        `${nextStreak}-day streak`,
        `You have protected your daily work for ${nextStreak} straight days.`,
        'success'
      );
    }
  }

  function openDailyReflection() {
    const keptStandards = completedStandards.map((standard) => standard.label).join(', ') || 'I handled my work today.';
    setJournalType('Daily Reflection');
    setJournal(
      `Daily Deposit: ${lesson.title ? `${lesson.title}\n` : ''}Focus question: ${todaysFocus}\nWhat I handled today: ${keptStandards}\nWhat I need to remember: `
    );
    setTab('journal');
  }

  return (
    <>
      <section className="panel daily-deposit-panel">
        <PanelTitle icon={<Brain size={18} />} title="Daily Deposit" action={lesson.time} />
        {lesson.title && <h2>{lesson.title}</h2>}
        <p>{lesson.body}</p>
      </section>

      <section className="panel today-focus-panel">
        <PanelTitle icon={<Target size={18} />} title="Today's Focus" />
        <div className="focus-question">
          <strong>{todaysFocus}</strong>
        </div>
      </section>

      <section className="panel progress-snapshot">
        <PanelTitle icon={<BarChart3 size={18} />} title="Progress Snapshot" action={submittedToday ? 'Locked' : 'Today'} />
        <div className="progress-scoreboard">
          <span>
            <strong>{completion}%</strong>
            Productivity today
          </span>
          <span>
            <strong>{streakCount}</strong>
            Day streak
          </span>
          <span>
            <strong>{averageGoalProgress}%</strong>
            Goal progress
          </span>
          <span>
            <strong>{planSeriesStats.completed}/{planSeriesStats.total}</strong>
            Plans completed
          </span>
        </div>
        {focusGoal && (
          <div className="goal-progress-callout">
            <span>Current goal</span>
            <strong>{focusGoal.value}</strong>
            <Progress value={focusGoal.progress} />
          </div>
        )}
      </section>

      <section className="panel athlete-score-panel">
        <PanelTitle icon={<Star size={18} />} title="Complete Athlete Score" action={`Today +${todayPoints}`} />
        <div className="score-hero">
          <strong>{athleteScore}</strong>
          <span>Total points earned through productivity, goals, plans, and reflection.</span>
          <button className="score-info-trigger" onClick={() => setScoreInfoOpen(true)} type="button">
            <CircleHelp size={15} />
            How points work
          </button>
        </div>
        <div className="point-event-list">
          {recentPointEvents.length === 0 ? (
            <p>No points yet. Complete today’s work to start building your score.</p>
          ) : (
            recentPointEvents.map((entry) => (
              <span key={entry.id}>
                <strong>+{entry.points}</strong>
                {entry.label}
              </span>
            ))
          )}
        </div>
      </section>

      {scoreInfoOpen && (
        <div className="bottom-sheet-backdrop" role="presentation" onClick={() => setScoreInfoOpen(false)}>
          <section
            aria-label="How points are calculated"
            aria-modal="true"
            className="bottom-sheet score-info-sheet"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-head">
              <div>
                <span>Complete Athlete Score</span>
                <strong>How points work</strong>
              </div>
              <button className="icon-button sheet-close" onClick={() => setScoreInfoOpen(false)} type="button" aria-label="Close points explanation">
                <X size={18} />
              </button>
            </div>
            <div className="points-breakdown">
              <span>
                <strong>+25</strong>
                Full productivity day completed
              </span>
              <span>
                <strong>+5</strong>
                Streak bonus per day, up to +25
              </span>
              <span>
                <strong>+15</strong>
                Reflection saved
              </span>
              <span>
                <strong>+10</strong>
                Goal added
              </span>
              <span>
                <strong>+150</strong>
                Goal completed
              </span>
              <span>
                <strong>+10</strong>
                Plan lesson completed
              </span>
              <span>
                <strong>+100</strong>
                Full plan series completed
              </span>
            </div>
            <p className="score-info-note">Your score is the total proof you have stacked through daily action, reflection, goals, and performance plans.</p>
          </section>
        </div>
      )}

      <section className="panel readiness-panel">
        <PanelTitle icon={<LineChart size={18} />} title="Morning Readiness Check-In" action="Daily" />
        {Object.entries(scores).map(([key, value]) => (
          <label className="slider-row" key={key}>
            <span>{key}</span>
            <input
              type="range"
              min="0"
              max="10"
              value={value}
              onChange={(event) => setScores((current) => ({ ...current, [key]: Number(event.target.value) }))}
            />
            <strong>{value}</strong>
          </label>
        ))}
      </section>

      <section className="panel daily-standards-panel">
        <PanelTitle icon={<BadgeCheck size={18} />} title="Today’s Productivity" action={`${completedStandards.length}/${standards.length} done`} />
        <div className="daily-standards-card">
          <p className="info-note">Add what you need to handle today. Update it as you go, then lock in the day once everything is complete.</p>
          <div className="productivity-summary" aria-label="Today’s productivity summary">
            <span>
              <strong>{completedStandards.length}</strong>
              Done
            </span>
            <span>
              <strong>{Math.max(standards.length - completedStandards.length, 0)}</strong>
              Left
            </span>
            <span>
              <strong>{streakCount}</strong>
              Streak
            </span>
          </div>
          <div className="standard-examples" aria-label="Productivity examples">
            <span>Quick add</span>
            <button type="button" onClick={() => setStandardDraft('Complete training with intent')}>
              Training
            </button>
            <button type="button" onClick={() => setStandardDraft('Handle recovery routine')}>
              Recovery
            </button>
            <button type="button" onClick={() => setStandardDraft('Finish schoolwork')}>
              Schoolwork
            </button>
            <button type="button" onClick={() => setStandardDraft('Get extra quality reps')}>
              Extra reps
            </button>
          </div>
          <form className="standard-form" onSubmit={addStandard}>
            <input
              value={standardDraft}
              onChange={(event) => setStandardDraft(event.target.value)}
              placeholder="Add something you need to do today"
              aria-label="Add a productivity item"
            />
            <select
              aria-label="Connect productivity item to a goal"
              value={standardGoalId}
              onChange={(event) => setStandardGoalId(event.target.value)}
            >
              <option value="">Goal link</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.label}
                </option>
              ))}
            </select>
            <button className="icon-button dark" type="submit" aria-label="Add productivity item">
              <Plus size={18} />
            </button>
          </form>
          <div className="checklist">
            {standards.map((item) => (
              <div
                className={item.done ? 'check-row checked' : 'check-row'}
                key={item.id}
              >
                <button
                  className="standard-toggle"
                  onClick={() =>
                    setStandards((current) =>
                      current.map((standard) =>
                        standard.id === item.id ? { ...standard, done: !standard.done } : standard
                      )
                    )
                  }
                  type="button"
                >
                  <span className="check-box">{item.done && <Check size={14} />}</span>
                </button>
                <span className="standard-task-copy">
                  {editingStandardId === item.id ? (
                    <input
                      className="standard-edit-input"
                      value={editingStandardDraft}
                      onChange={(event) => setEditingStandardDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') saveEditingStandard(item.id);
                        if (event.key === 'Escape') cancelEditingStandard();
                      }}
                      aria-label={`Edit ${item.label}`}
                      autoFocus
                    />
                  ) : (
                    <strong>{item.label}</strong>
                  )}
                  <em>{goals.find((goal) => goal.id === item.goalId)?.label ?? 'No goal linked'}</em>
                </span>
                <select
                  aria-label={`Link ${item.label} to goal`}
                  value={item.goalId ?? ''}
                  onChange={(event) => updateStandardGoal(item.id, event.target.value)}
                >
                  <option value="">No goal</option>
                  {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.label}
                    </option>
                  ))}
                </select>
                <div className="standard-row-actions">
                  {editingStandardId === item.id ? (
                    <>
                      <button className="standard-action-button" onClick={() => saveEditingStandard(item.id)} type="button" aria-label={`Save ${item.label}`}>
                        <Check size={16} />
                      </button>
                      <button className="standard-action-button" onClick={cancelEditingStandard} type="button" aria-label={`Cancel editing ${item.label}`}>
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="standard-action-button" onClick={() => startEditingStandard(item)} type="button" aria-label={`Edit ${item.label}`}>
                        <PenLine size={16} />
                      </button>
                      <button className="remove-standard" onClick={() => removeStandard(item.id)} type="button" aria-label={`Remove ${item.label}`}>
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          {standards.length === 0 && <p className="empty-note">Start by adding one thing you need to handle today.</p>}
          {standardsFeedback && <p className="inline-warning">{standardsFeedback}</p>}
          <button className={submittedToday ? 'secondary-action submitted' : 'secondary-action'} onClick={submitStandards}>
            {submittedToday ? 'Locked In For Today' : 'Lock In My Day'}
          </button>
          <button className="history-sheet-trigger" onClick={() => setStandardsHistoryOpen(true)} type="button">
            <BarChart3 size={16} />
            View productivity history
          </button>
          {submittedToday && (
            <button className="reflection-cta" onClick={openDailyReflection}>
              <PenLine size={17} />
              Write what you need to remember
            </button>
          )}
        </div>
      </section>

      {standardsHistoryOpen && (
        <div className="bottom-sheet-backdrop" role="presentation" onClick={() => setStandardsHistoryOpen(false)}>
          <section
            aria-label="Productivity history"
            aria-modal="true"
            className="bottom-sheet standards-history-sheet"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-head">
              <div>
                <span>Last 7 locked days</span>
                <strong>Productivity History</strong>
              </div>
              <button className="icon-button sheet-close" onClick={() => setStandardsHistoryOpen(false)} type="button" aria-label="Close productivity history">
                <X size={18} />
              </button>
            </div>
            {recentStandardsHistory.length === 0 ? (
              <p className="empty-note">Your locked-in productivity days will appear here after you submit a day.</p>
            ) : (
              <div className="standards-history sheet-history-list">
                {recentStandardsHistory.map((entry) => (
                  <article className="standards-history-row" key={entry.date}>
                    <div className="standards-history-row-head">
                      <div>
                        <strong>{entry.date}</strong>
                        <span>{entry.completed}/{entry.total} completed at {entry.submittedAt || 'submission'}</span>
                      </div>
                      <b>{entry.percent}%</b>
                    </div>
                    <ul>
                      {entry.standards.map((standard, index) => (
                        <li className={standard.done ? 'done' : ''} key={`${entry.date}-${index}`}>
                          {standard.label}
                          {standard.goalLabel && <em>{standard.goalLabel}</em>}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

    </>
  );
}

function NotificationTray({ notifications, requestBrowserNotifications }) {
  return (
    <section className="notification-tray" aria-label="Notifications">
      <div className="tray-head">
        <strong>Notifications</strong>
        <button onClick={requestBrowserNotifications}>Enable</button>
      </div>
      {notifications.length === 0 ? (
        <p>No notifications yet.</p>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => (
            <article className={`notice ${notification.tone}`} key={notification.id}>
              <span>{notification.createdAt}</span>
              <strong>{notification.title}</strong>
              <p>{notification.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function GoalsScreen({
  awardPoints,
  celebrate,
  goalDraft,
  goals,
  setGoalDraft,
  setGoals,
  standards
}) {
  const completedGoals = goals.filter((goal) => Number(goal.progress) >= 100);
  const linkedStandards = standards.filter((standard) => standard.goalId);
  const completedLinkedStandards = linkedStandards.filter((standard) => standard.done);

  function updateGoal(id, field, value) {
    setGoals((current) =>
      current.map((goal) =>
        goal.id === id
          ? { ...goal, [field]: field === 'progress' ? Number(value) : value }
          : goal
      )
    );
  }

  function addGoal(event) {
    event.preventDefault();
    const label = goalDraft.label.trim();
    const value = goalDraft.value.trim();
    if (!label || !value) return;
    const id = Date.now();
    setGoals((current) => [...current, { id, label, value, progress: 0 }]);
    setGoalDraft({ label: '', value: '' });
    const awarded = awardPoints({
      type: 'goal_added',
      points: pointValues.goalAdded,
      label: 'Goal added',
      uniqueKey: `goal-added-${id}`,
      metadata: { goalLabel: label }
    });
    celebrate(awarded ? `Goal added. +${pointValues.goalAdded} points.` : 'Goal added. Write it, read it, prove it.');
  }

  function removeGoal(id) {
    setGoals((current) => current.filter((goal) => goal.id !== id));
  }

  function completeGoal(id) {
    const goal = goals.find((item) => item.id === id);
    const wasComplete = Number(goal?.progress) >= 100;
    setGoals((current) =>
      current.map((goal) => (goal.id === id ? { ...goal, progress: 100 } : goal))
    );
    const awarded = !wasComplete && awardPoints({
      type: 'goal_completed',
      points: pointValues.goalCompleted,
      label: `${goal?.label || 'Goal'} completed`,
      uniqueKey: `goal-completed-${id}`,
      metadata: { goalLabel: goal?.label || '' }
    });
    celebrate(awarded ? `Goal complete. +${pointValues.goalCompleted} points.` : 'Goal complete. Achievement unlocked.');
  }

  return (
    <>
      <section className="panel goal-lead">
        <PanelTitle icon={<Target size={18} />} title="Goal System" action={`${goals.length} goals`} />
        <p>Your goals show where you are going. Today’s productivity proves you are becoming that athlete.</p>
        <div className="goal-reminder">
          <strong>How it works</strong>
          <span>Link daily productivity to goals. When you complete those items and lock in the day, that goal earns progress.</span>
        </div>
      </section>

      <section className="panel goal-proof-panel">
        <PanelTitle icon={<BadgeCheck size={18} />} title="Productivity Builds Goals" action="Daily proof" />
        <div className="goal-proof-grid">
          <span>
            <strong>{linkedStandards.length}</strong>
            Items linked to goals
          </span>
          <span>
            <strong>{completedLinkedStandards.length}</strong>
            Completed today
          </span>
        </div>
        <p>Keep the goal big, then make today small enough to execute. The work is the proof.</p>
      </section>

      <section className="panel">
        <PanelTitle icon={<Plus size={18} />} title="Add Goal" action="Athlete controlled" />
        <form className="goal-form" onSubmit={addGoal}>
          <input
            className="text-field"
            placeholder="Goal type, like Dream Goal"
            value={goalDraft.label}
            onChange={(event) => setGoalDraft((current) => ({ ...current, label: event.target.value }))}
          />
          <textarea
            className="goal-textarea"
            placeholder="Write the goal clearly"
            value={goalDraft.value}
            onChange={(event) => setGoalDraft((current) => ({ ...current, value: event.target.value }))}
          />
          <button className="primary-action full" type="submit">
            <Plus size={18} />
            Add Goal
          </button>
        </form>
      </section>

      <div className="stack">
        {goals.map((goal) => {
          const goalStandards = standards.filter((standard) => standard.goalId === goal.id);
          const completedGoalStandards = goalStandards.filter((standard) => standard.done);
          return (
            <section className="goal-card editable" key={goal.id}>
              <label>
                <span>Goal type</span>
                <input
                  value={goal.label}
                  onChange={(event) => updateGoal(goal.id, 'label', event.target.value)}
                />
              </label>
              <label>
                <span>Write it down</span>
                <textarea
                  value={goal.value}
                  onChange={(event) => updateGoal(goal.id, 'value', event.target.value)}
                />
              </label>
              <div className="goal-proof-summary">
                <span>
                  <strong>{goalStandards.length}</strong>
                  Linked items
                </span>
                <span>
                  <strong>{completedGoalStandards.length}</strong>
                  Done today
                </span>
                <span>
                  <strong>{goal.progress}%</strong>
                  Goal progress
                </span>
              </div>
              <Progress value={goal.progress} />
              <label className="goal-progress">
                <span>Progress</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={goal.progress}
                  onChange={(event) => updateGoal(goal.id, 'progress', event.target.value)}
                  onInput={(event) => updateGoal(goal.id, 'progress', event.target.value)}
                />
                <strong>{goal.progress}%</strong>
              </label>
              <div className="goal-linked-standards">
                <strong>Today’s productivity helping this goal</strong>
                {goalStandards.length === 0 ? (
                  <p>No items linked yet. Add something on Home and connect it to this goal.</p>
                ) : (
                  goalStandards.map((standard) => (
                      <span className={standard.done ? 'linked-standard done' : 'linked-standard'} key={standard.id}>
                        {standard.done && <Check size={14} />}
                        {standard.label}
                      </span>
                    ))
                )}
              </div>
              <div className="goal-actions">
                <button
                  className={goal.progress >= 100 ? 'complete-goal done' : 'complete-goal'}
                  type="button"
                  onClick={() => completeGoal(goal.id)}
                >
                  <Check size={16} />
                  {goal.progress >= 100 ? 'Goal Complete' : 'Complete Goal'}
                </button>
                <button className="remove-goal" type="button" onClick={() => removeGoal(goal.id)}>
                  <Trash2 size={16} />
                  Remove Goal
                </button>
              </div>
            </section>
          );
        })}
      </div>
      <section className="panel">
        <PanelTitle icon={<Star size={18} />} title="Achievements" action={`${completedGoals.length} earned`} />
        {completedGoals.length === 0 ? (
          <p className="empty-note">Completed goals will appear here when they reach 100%.</p>
        ) : (
          <div className="badge-grid">
            {completedGoals.map((goal) => (
              <span className="badge" key={goal.id}>
                <Sparkles size={14} />
                {goal.label} Complete
              </span>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function PlansScreen({ plans, planProgress, setPlanProgress, awardPoints, persistPlanCompletion }) {
  const readOnly = !setPlanProgress;
  const today = todayKey();
  const sequencedPlans = sequencedPlanAccess(plans, planProgress, today);
  const planLibrary = buildPlanLibrary(sequencedPlans);
  const [selectedSeriesId, setSelectedSeriesId] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const selectedSeries = planLibrary.find((series) => series.id === selectedSeriesId) ?? null;
  const continueSeries = planLibrary.find((series) => series.openCount > 0 && series.completedCount < series.plans.length) ?? planLibrary[0];
  const categories = ['All', ...Array.from(new Set(planLibrary.map((series) => series.category)))];
  const filteredLibrary = activeCategory === 'All'
    ? planLibrary
    : planLibrary.filter((series) => series.category === activeCategory);
  const visiblePlans = selectedSeries?.plans ?? [];
  const openCount = visiblePlans.filter((plan) => plan.unlocked).length;
  const completedCount = visiblePlans.filter((plan) => plan.completedAt).length;
  const lockedCount = visiblePlans.length - openCount;

  useEffect(() => {
    if (selectedSeriesId && !planLibrary.some((series) => series.id === selectedSeriesId)) {
      setSelectedSeriesId('');
    }
  }, [planLibrary, selectedSeriesId]);

  function completePlan(planId) {
    if (readOnly) return;
    if (planProgress[String(planId)]) return;
    const plan = sequencedPlans.find((item) => String(item.id) === String(planId));
    const seriesTitle = plan ? planSeriesTitle(plan) : 'Performance Plan';
    const seriesPlans = sequencedPlans.filter((item) => planSeriesTitle(item) === seriesTitle);
    const nextProgress = {
      ...planProgress,
      [String(planId)]: today
    };
    const seriesAwarded = seriesPlans.length > 0 && seriesPlans.every((item) => Boolean(nextProgress[String(item.id)]));

    setPlanProgress(nextProgress);
    persistPlanCompletion?.(planId, today);

    awardPoints?.({
      type: 'plan_lesson_completed',
      points: pointValues.planLessonCompleted,
      label: `${plan?.challengeDay || 'Plan lesson'} completed`,
      uniqueKey: `plan-lesson-completed-${planId}`,
      metadata: { planId, seriesTitle, title: plan?.title || '' }
    });

    if (seriesAwarded) {
      awardPoints?.({
        type: 'plan_series_completed',
        points: pointValues.planSeriesCompleted,
        label: `${seriesTitle} completed`,
        uniqueKey: `plan-series-completed-${seriesTitle}`,
        metadata: { seriesTitle, lessonCount: seriesPlans.length }
      });
    }
  }

  if (selectedSeries) {
    return (
      <>
        <section className="panel series-overview has-cover" style={{ '--plan-cover': `url(${selectedSeries.coverImage})`, '--plan-cover-position': selectedSeries.coverPosition }}>
          <div className="series-cover" aria-hidden="true" />
          <button className="plan-back-button" onClick={() => setSelectedSeriesId('')} type="button">
            Back to Library
          </button>
          <PanelTitle icon={<CalendarDays size={18} />} title={selectedSeries.title} action={`${completedCount}/${visiblePlans.length} done`} />
          <p>{selectedSeries.tagline}</p>
          {lockedCount > 0 && <span>{lockedCount} lessons are waiting behind the completion flow.</span>}
        </section>

        <div className="plan-reader-stack">
          {visiblePlans.map((plan) => (
            <section className={plan.unlocked ? 'goal-card plan-card readonly-plan' : 'goal-card plan-card readonly-plan locked-plan'} key={plan.id}>
              <div className="plan-read-header">
                <span>{plan.completedAt ? 'Completed' : plan.unlocked ? (plan.challengeDay || `Day ${planDayNumber(plan) || planCurrentDay(plan)}`) : 'Locked'}</span>
                <strong>{plan.title}</strong>
                <em>
                  {plan.completedAt
                    ? `Completed ${plan.completedAt}`
                    : plan.unlocked
                      ? `${plan.challengeDay || `Day ${planDayNumber(plan) || planCurrentDay(plan)}`} of ${plan.challengeLength || 7}`
                      : plan.unlockDate && plan.unlockDate > today
                        ? `Unlocks ${plan.unlockDate}`
                        : 'Complete the previous plan first'}
                </em>
                <p>{planDisplaySubject(plan)}</p>
              </div>
              {plan.unlocked && plan.steps.length > 0 && (
                <PlanEpisode steps={plan.steps} planId={plan.id} />
              )}
              {!plan.unlocked && (
                <div className="locked-message">
                  <LockKeyhole size={18} />
                  <p>Finish the previous lesson, then come back the next day to unlock this one.</p>
                </div>
              )}
              {plan.unlocked && !readOnly && (
                <button
                  className={plan.completedAt ? 'secondary-action submitted' : 'secondary-action'}
                  disabled={Boolean(plan.completedAt)}
                  onClick={() => completePlan(plan.id)}
                  type="button"
                >
                  <Check size={16} />
                  {plan.completedAt ? 'Lesson Completed' : 'Mark Lesson Complete'}
                </button>
              )}
            </section>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <section className="panel plan-hero">
        <PanelTitle icon={<BookOpen size={18} />} title="Plan Library" action={`${planLibrary.length} series`} />
        <h2>Choose a plan. Work the next lesson. Carry it into the day.</h2>
        <div className="goal-reminder">
          <strong>How to use this</strong>
          <span>Start with Continue Training, or browse by category when you need a new focus.</span>
        </div>
      </section>

      {continueSeries && (
        <section className="panel continue-plan-panel">
          <PanelTitle icon={<Sparkles size={18} />} title="Continue Training" action={`${continueSeries.completedCount}/${continueSeries.plans.length} done`} />
          <button className="continue-plan-card has-cover" onClick={() => setSelectedSeriesId(continueSeries.id)} style={{ '--plan-cover': `url(${continueSeries.coverImage})`, '--plan-cover-position': continueSeries.coverPosition }} type="button">
            <div className="plan-cover" aria-hidden="true" />
            <div className="plan-card-copy">
              <span>{continueSeries.category}</span>
              <strong>{continueSeries.title}</strong>
              <em>{nextPlanLabel(continueSeries)}</em>
              <p>{continueSeries.tagline}</p>
            </div>
          </button>
        </section>
      )}

      <section className="panel plan-library-panel">
        <PanelTitle icon={<Target size={18} />} title="Browse Library" action={`${filteredLibrary.length} shown`} />
        {planLibrary.length === 0 ? (
          <p className="empty-note">No performance plans are open yet. Check back on the next release day.</p>
        ) : (
          <>
            <div className="plan-category-strip" aria-label="Plan categories">
              {categories.map((category) => (
                <button
                  className={category === activeCategory ? 'active' : ''}
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  type="button"
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="plan-list">
              {filteredLibrary.map((series) => (
                <button className="plan-list-row has-cover" key={series.id} onClick={() => setSelectedSeriesId(series.id)} style={{ '--plan-cover': `url(${series.coverImage})`, '--plan-thumb': `url(${series.thumbnailImage})`, '--plan-cover-position': series.coverPosition }} type="button">
                  <div className="plan-cover-thumb" aria-hidden="true" />
                  <span>{series.category}</span>
                  <strong>{series.title}</strong>
                  <p>{series.tagline}</p>
                  <em>{series.completedCount}/{series.plans.length} complete · {series.openCount} open</em>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}

function planSeriesTitle(plan) {
  const subject = String(plan?.subject ?? '');
  const match = subject.match(/Series:\s*([^.!]+)[.!]?/i);
  return match?.[1]?.trim() || 'Performance Plans';
}

function planSeriesTagline(plan) {
  const subject = String(plan?.subject ?? '');
  const withoutSeries = subject.replace(/Series:\s*[^.!]+[.!]?\s*/i, '').trim();
  return withoutSeries || 'Mental performance lessons for practice, games, and pressure moments.';
}

function planDisplaySubject(plan) {
  return planSeriesTagline(plan);
}

function planCategory(plan) {
  const text = `${planSeriesTitle(plan)} ${plan?.subject ?? ''}`.toLowerCase();
  if (text.includes('90%') || text.includes('ninety') || text.includes('identity')) return 'Mindset';
  if (text.includes('slump') || text.includes('mindset') || text.includes('belief')) return 'Mindset';
  if (text.includes('confidence')) return 'Confidence';
  if (text.includes('pressure') || text.includes('game')) return 'Pressure';
  if (text.includes('leader') || text.includes('team')) return 'Leadership';
  if (text.includes('recover') || text.includes('rest')) return 'Recovery';
  if (text.includes('discipline') || text.includes('habit') || text.includes('standard')) return 'Discipline';
  return 'Mindset';
}

function planCoverImage(seriesTitle) {
  const normalized = String(seriesTitle ?? '').toLowerCase();
  if (normalized.includes('90') || normalized.includes('blueprint')) {
    return '/plan-covers/90-percent-blueprint.jpg';
  }
  if (normalized.includes('slump')) {
    return '/plan-covers/slump-mindset.jpg';
  }
  if (normalized.includes('champion') || normalized.includes('habit')) {
    return '/plan-covers/champion-habits-banner.jpg';
  }
  if (normalized.includes('control') || normalized.includes('controllable')) {
    return '/plan-covers/control-controllables-banner.jpg';
  }
  if (normalized.includes('mirror') || normalized.includes('positive self image') || normalized.includes('self-image')) {
    return '/plan-covers/mirror-banner.jpg';
  }
  if (normalized.includes('imagination') || normalized.includes('visualization')) {
    return '/plan-covers/imagination-station-banner.png';
  }
  return '/plan-covers/90-percent-blueprint.jpg';
}

function planThumbnailImage(seriesTitle) {
  const normalized = String(seriesTitle ?? '').toLowerCase();
  if (normalized.includes('champion') || normalized.includes('habit')) {
    return '/plan-covers/champion-habits-thumbnail.jpg';
  }
  if (normalized.includes('control') || normalized.includes('controllable')) {
    return '/plan-covers/control-controllables-thumbnail.jpg';
  }
  if (normalized.includes('mirror') || normalized.includes('positive self image') || normalized.includes('self-image')) {
    return '/plan-covers/mirror-thumbnail.jpg';
  }
  if (normalized.includes('imagination') || normalized.includes('visualization')) {
    return '/plan-covers/imagination-station-thumbnail.png';
  }
  return planCoverImage(seriesTitle);
}

function planCoverPosition(seriesTitle) {
  const normalized = String(seriesTitle ?? '').toLowerCase();
  if (normalized.includes('90') || normalized.includes('blueprint')) {
    return '64% 52%';
  }
  if (normalized.includes('slump')) {
    return '80% 50%';
  }
  if (normalized.includes('champion') || normalized.includes('habit')) {
    return '50% 45%';
  }
  if (normalized.includes('control') || normalized.includes('controllable')) {
    return '58% 50%';
  }
  if (normalized.includes('mirror') || normalized.includes('positive self image') || normalized.includes('self-image')) {
    return '54% 50%';
  }
  if (normalized.includes('imagination') || normalized.includes('visualization')) {
    return '58% 50%';
  }
  return '70% 50%';
}

function nextPlanLabel(series) {
  const nextOpen = series.plans.find((plan) => plan.unlocked && !plan.completedAt);
  if (nextOpen) return `${nextOpen.challengeDay || 'Next lesson'} · ${nextOpen.title}`;
  if (series.completedCount === series.plans.length) return 'Series complete';
  return 'Next lesson unlocks after completion';
}

function buildPlanLibrary(plans) {
  const groups = new Map();

  plans.forEach((plan) => {
    const title = planSeriesTitle(plan);
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'performance-plans';
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        title,
        category: planCategory(plan),
        coverImage: planCoverImage(title),
        thumbnailImage: planThumbnailImage(title),
        coverPosition: planCoverPosition(title),
        tagline: planSeriesTagline(plan),
        plans: []
      });
    }
    groups.get(id).plans.push(plan);
  });

  return Array.from(groups.values()).map((series) => {
    const orderedPlans = series.plans.sort((first, second) => planDayNumber(first) - planDayNumber(second));
    return {
      ...series,
      plans: orderedPlans,
      openCount: orderedPlans.filter((plan) => plan.unlocked).length,
      completedCount: orderedPlans.filter((plan) => plan.completedAt).length
    };
  });
}

function splitEpisodeStep(step) {
  const value = String(step ?? '').trim();
  const separator = value.indexOf(':');
  if (separator < 0) return { label: '', body: value };
  return {
    label: value.slice(0, separator).trim(),
    body: value.slice(separator + 1).trim()
  };
}

function planReaderBody(body) {
  return String(body ?? '').replace(/\r\n/g, '\n').trim();
}

function readerLineType(line, previousType) {
  const normalized = line.toLowerCase();
  if (/^["“]/.test(line)) return 'quote';
  if (normalized.includes('ai coach') || (previousType === 'coach' && /^["“]|^then ask|^based on/.test(normalized))) {
    return 'coach';
  }
  if (
    normalized.includes('in-app journal') ||
    normalized.includes('create a page') ||
    normalized.includes('answer honestly') ||
    normalized.includes('reflect honestly') ||
    normalized.startsWith('•') ||
    (previousType === 'journal' && /^my |^captain says|^crew learns|^deposits|^withdrawals|^outcome goal|^performance goal|^identity goal|^today's action/.test(normalized))
  ) {
    return 'journal';
  }
  return 'body';
}

function isStoryStartLine(line) {
  return /^(Imagine|Think about|When |Long before|For years|In \d{4}|One day|Now imagine|Maybe you|Have you ever)/.test(line);
}

function planReaderBlocks(body) {
  const rawLines = planReaderBody(body)
    .split(/\n{2,}/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const lines = rawLines.reduce((merged, line) => {
    const previous = merged[merged.length - 1] ?? '';
    const isWrappedPrompt = previous.startsWith('•') && !/[.!?]$/.test(previous) && /^[a-z]/.test(line);
    if (isWrappedPrompt) {
      merged[merged.length - 1] = `${previous} ${line}`;
      return merged;
    }
    merged.push(line);
    return merged;
  }, []);
  const blocks = [];
  let bodyBuffer = [];

  function pushBlock(type, paragraphs) {
    const content = paragraphs.map((paragraph) => paragraph.trim()).filter(Boolean);
    if (!content.length) return;
    const lastBlock = blocks[blocks.length - 1];
    if (lastBlock?.type === type && type !== 'body') {
      lastBlock.paragraphs.push(...content);
      return;
    }
    blocks.push({ type, paragraphs: content });
  }

  function flushBody() {
    if (!bodyBuffer.length) return;
    pushBlock('body', [bodyBuffer.join(' ')]);
    bodyBuffer = [];
  }

  lines.forEach((line) => {
    const previousType = blocks[blocks.length - 1]?.type ?? 'body';
    const type = readerLineType(line, previousType);

    if (type === 'quote') {
      flushBody();
      pushBlock('quote', [line]);
      return;
    }

    if (type === 'body') {
      if (bodyBuffer.length && isStoryStartLine(line)) {
        flushBody();
      }
      bodyBuffer.push(line);
      const paragraph = bodyBuffer.join(' ');
      if (bodyBuffer.length >= 5 || paragraph.length > 520) {
        flushBody();
      }
      return;
    }

    flushBody();
    pushBlock(type, [line]);
  });

  flushBody();
  return blocks;
}

function planDayFromId(planId) {
  const match = String(planId ?? '').match(/day-(\d+)/);
  return match ? Number(match[1]) : 0;
}

function blockText(block) {
  return block.paragraphs.join(' ');
}

function isFilmRoomStart(block) {
  return /John Wooden|Allyson Felix|Roger Bannister|Ichiro Suzuki|Pat Summitt|Derek Jeter|Bethany Hamilton|John F\. Kennedy|United States faced|Hall of Fame/i.test(blockText(block));
}

function isPrincipleBlock(block) {
  const text = blockText(block).trim();
  return (
    block.type === 'body' &&
    text.length < 260 &&
    (/↓|->|determines|build|become|repeated|pressure|self-trust|success is/i.test(text))
  );
}

function buildPlanReaderSections(blocks, planId) {
  const day = planDayFromId(planId);
  const practiceStart = blocks.findIndex((block) => block.type === 'journal' || block.type === 'coach');
  const beforePractice = practiceStart >= 0 ? blocks.slice(0, practiceStart) : blocks;
  const practiceBlocks = practiceStart >= 0 ? blocks.slice(practiceStart).filter((block) => block.type === 'journal' || block.type === 'coach') : [];
  const afterPractice = practiceStart >= 0 ? blocks.slice(practiceStart).filter((block) => block.type !== 'journal' && block.type !== 'coach') : [];
  const sections = [];
  const prePractice = [...beforePractice];
  const principleBlocks = [];

  const principleIndex = prePractice.findLastIndex(isPrincipleBlock);
  if (principleIndex >= 0) {
    principleBlocks.push(...prePractice.splice(principleIndex, 1));
  }

  const filmIndex = prePractice.findIndex(isFilmRoomStart);
  const systemBlocks = filmIndex >= 0 ? prePractice.slice(0, filmIndex) : prePractice;
  const filmBlocks = filmIndex >= 0 ? prePractice.slice(filmIndex) : [];

  if (systemBlocks.length) sections.push({ title: 'System Update', tone: 'system', blocks: systemBlocks });
  if (filmBlocks.length) sections.push({ title: 'Film Room', tone: 'film', blocks: filmBlocks });
  if (practiceBlocks.length) sections.push({ title: 'Practice Install', tone: 'practice', blocks: practiceBlocks });
  if (principleBlocks.length) {
    sections.push({ title: 'Complete Athlete Principle', tone: 'principle', blocks: principleBlocks });
  }
  if (afterPractice.length) {
    sections.push({
      title: day === 9 ? 'What You Carry Forward' : 'What You Will Learn Next Chapter',
      tone: 'next',
      blocks: afterPractice
    });
  }

  return sections.length ? sections : [{ title: '', tone: 'system', blocks }];
}

const explicitPlanSectionHeadings = new Set([
  'Mental Model',
  'This Chapter Will Help You',
  'Opening',
  'Pull Back the Curtain',
  'Story',
  'The Story',
  'Why This Matters',
  'The Turning Point',
  'Mirror Check',
  'System Update',
  'Practice Install',
  'Your Championship Habit Blueprint',
  'Film Room',
  'Complete Athlete Principle',
  'Next Chapter',
  'The Complete Athlete Declaration',
  'One Last Thought',
  'Final Thoughts',
  'Series Finale',
  'Final Complete Athlete Principle'
]);

function sectionTone(title) {
  const normalized = title.toLowerCase();
  if (normalized.includes('practice') || normalized.includes('blueprint')) return 'practice';
  if (normalized.includes('film') || normalized.includes('story') || normalized.includes('curtain')) return 'film';
  if (normalized.includes('principle') || normalized.includes('declaration')) return 'principle';
  if (normalized.includes('next') || normalized.includes('last') || normalized.includes('finale') || normalized.includes('final thoughts')) return 'next';
  if (normalized.includes('mental') || normalized.includes('system') || normalized.includes('mirror')) return 'system';
  return 'body';
}

function sectionLinesToBlocks(lines) {
  const blocks = [];
  let bodyBuffer = [];
  let quoteBuffer = [];
  let bulletBuffer = [];

  function flushBody() {
    if (!bodyBuffer.length) return;
    blocks.push({ type: 'body', paragraphs: [bodyBuffer.join(' ')] });
    bodyBuffer = [];
  }

  function flushBullet() {
    if (!bulletBuffer.length) return;
    blocks.push({ type: 'body', paragraphs: [bulletBuffer.join(' ')] });
    bulletBuffer = [];
  }

  function flushQuote() {
    if (!quoteBuffer.length) return;
    blocks.push({ type: 'quote', paragraphs: [quoteBuffer.join(' ')] });
    quoteBuffer = [];
  }

  lines.forEach((line) => {
    if (quoteBuffer.length) {
      quoteBuffer.push(line);
      if (/["”]$/.test(line)) flushQuote();
      return;
    }

    if (bulletBuffer.length) {
      if (/^[a-z]/.test(line) && !/[.!?]$/.test(bulletBuffer[bulletBuffer.length - 1])) {
        bulletBuffer.push(line);
        return;
      }
      flushBullet();
    }

    if (/^["“]/.test(line)) {
      flushBody();
      quoteBuffer.push(line);
      if (/["”]$/.test(line)) flushQuote();
      return;
    }

    if (/^(✓|•)/.test(line) || /^Old Programming$|^New Programming$|^⬇$|^↓$/.test(line)) {
      flushBody();
      flushQuote();
      if (/^(✓|•)/.test(line)) {
        bulletBuffer.push(line);
      } else {
        blocks.push({ type: 'body', paragraphs: [line] });
      }
      return;
    }

    if (bodyBuffer.length && isStoryStartLine(line)) {
      flushBody();
    }

    bodyBuffer.push(line);
    if (bodyBuffer.length >= 4 || bodyBuffer.join(' ').length > 460) {
      flushBody();
    }
  });

  flushBody();
  flushBullet();
  flushQuote();
  return blocks;
}

function explicitPlanReaderSections(body) {
  const lines = planReaderBody(body)
    .split(/\n{2,}/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (!lines.some((line) => explicitPlanSectionHeadings.has(line))) return [];

  const sections = [];
  let current = null;

  lines.forEach((line) => {
    if (explicitPlanSectionHeadings.has(line)) {
      const sectionTitleMap = {
        'Mental Model': '',
        Opening: 'Start Here',
        'Pull Back the Curtain': 'Deeper Look',
        Story: 'Athlete Story',
        'The Story': 'Athlete Story'
      };
      const title = sectionTitleMap[line] ?? line;
      current = { title, tone: line === 'Mental Model' ? 'model' : sectionTone(title), lines: [] };
      sections.push(current);
      return;
    }

    if (!current) {
      current = { title: 'System Update', tone: 'system', lines: [] };
      sections.push(current);
    }
    current.lines.push(line);
  });

  return sections
    .map((section) => ({
      title: section.title,
      tone: section.tone,
      blocks: sectionLinesToBlocks(section.lines)
    }))
    .filter((section) => section.blocks.length);
}

function episodeTone(label) {
  const normalized = label.toLowerCase();
  if (normalized.includes('train')) return 'action';
  if (normalized.includes('film')) return 'reflect';
  if (normalized.includes('principle')) return 'principle';
  if (normalized.includes('next')) return 'next';
  return 'story';
}

function episodeDisplayLabel(label) {
  const normalized = label.toLowerCase();
  if (
    normalized.includes('opening') ||
    normalized.includes('lesson') ||
    normalized.includes('greats') ||
    normalized.includes('shift')
  ) {
    return '';
  }
  if (normalized.includes('train')) return "Today's Training";
  if (normalized.includes('film')) return 'Film Room';
  if (normalized.includes('principle')) return 'Complete Athlete Principle';
  if (normalized.includes('next')) return 'Next Lesson';
  return label;
}

function PlanEpisode({ steps, planId }) {
  const body = steps.join('\n\n');
  const sections = explicitPlanReaderSections(body);
  const readerSections = sections.length ? sections : buildPlanReaderSections(planReaderBlocks(body), planId);

  return (
    <div className="episode-flow episode-page-flow">
      <article className="episode-section episode-page" key={`${planId}-page`}>
        {readerSections.map((section, sectionIndex) => (
          <section className={`reader-section reader-section-${section.tone}`} key={`${planId}-section-${sectionIndex}`}>
            {section.title && <h3>{section.title}</h3>}
            {section.blocks.map((block, blockIndex) => {
              if (block.type === 'quote') {
                return (
                  <blockquote className="reader-quote" key={`${planId}-quote-${sectionIndex}-${blockIndex}`}>
                    {block.paragraphs.map((paragraph, paragraphIndex) => (
                      <p key={`${planId}-quote-${sectionIndex}-${blockIndex}-${paragraphIndex}`}>{paragraph}</p>
                    ))}
                  </blockquote>
                );
              }

              return (
                <div className="reader-copy" key={`${planId}-copy-${sectionIndex}-${blockIndex}`}>
                  {block.paragraphs.map((paragraph, paragraphIndex) => (
                    <p key={`${planId}-copy-${sectionIndex}-${blockIndex}-${paragraphIndex}`}>{paragraph}</p>
                  ))}
                </div>
              );
            })}
          </section>
        ))}
      </article>
    </div>
  );
}

function JournalScreen({
  awardPoints,
  celebrate,
  goalDraft,
  goals,
  journal,
  journalEntries,
  journalGoalId,
  journalType,
  setJournal,
  setJournalEntries,
  setJournalGoalId,
  setJournalType,
  setGoalDraft,
  setGoals,
  standards
}) {
  const [reflectionHistoryOpen, setReflectionHistoryOpen] = useState(false);

  function saveJournalEntry() {
    const body = journal.trim();
    if (!body) return;
    const entry = {
      id: Date.now(),
      body,
      type: journalType,
      linkedGoalId: journalGoalId || null,
      date: todayKey(),
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    };
    setJournalEntries((current) => [entry, ...current]);
    setJournal('');
    setJournalGoalId('');
    const awarded = awardPoints({
      type: 'journal_saved',
      points: pointValues.journalSaved,
      label: 'Journal reflection saved',
      uniqueKey: `journal-saved-${entry.id}`,
      metadata: { entryType: entry.type }
    });
    celebrate(awarded ? `Journal saved. +${pointValues.journalSaved} points.` : 'Journal saved. That reflection is yours to revisit.');
  }

  function openJournalEntry(entry) {
    setJournalType(entry.type);
    setJournal(entry.body);
    setJournalGoalId(entry.linkedGoalId ? String(entry.linkedGoalId) : '');
  }

  function removeJournalEntry(id) {
    setJournalEntries((current) => current.filter((entry) => entry.id !== id));
  }

  const journalHistoryList = journalEntries.length === 0 ? (
    <p className="empty-note">Saved reflections will appear here so you can review your growth over time.</p>
  ) : (
    <div className="journal-history sheet-history-list">
      {journalEntries.map((entry) => {
        const linkedGoal = entry.linkedGoalId
          ? goals.find((goal) => goal.id === entry.linkedGoalId)
          : null;

        return (
          <article className="journal-entry" key={entry.id}>
            <button
              onClick={() => {
                openJournalEntry(entry);
                setReflectionHistoryOpen(false);
              }}
              type="button"
            >
              <span>{entry.type}</span>
              <strong>{entry.date} at {entry.time}</strong>
              {linkedGoal && <em>Connected to {linkedGoal.label}</em>}
              <p>{entry.body}</p>
            </button>
            <button className="remove-standard" onClick={() => removeJournalEntry(entry.id)} type="button" aria-label={`Remove journal entry from ${entry.date}`}>
              <Trash2 size={16} />
            </button>
          </article>
        );
      })}
    </div>
  );

  return (
    <>
      <section className="panel journal-panel">
        <PanelTitle icon={<PenLine size={18} />} title="Journal" action="Private" />
        <div className="journal-intro">
          <strong>Write what you need to remember.</strong>
          <span>Use this space for reflection. Your goals and productivity tracker live below.</span>
        </div>
        <label className="journal-label" htmlFor="journal-type">
          Entry type
        </label>
        <select
          id="journal-type"
          className="text-field select-field"
          value={journalType}
          onChange={(event) => setJournalType(event.target.value)}
        >
          <option>Daily Reflection</option>
          <option>Game Reflection</option>
          <option>Open Thoughts</option>
          <option>Pressure Moment</option>
        </select>
        <label className="journal-label" htmlFor="journal-goal">
          Connect to a goal
        </label>
        <select
          id="journal-goal"
          className="text-field select-field"
          value={journalGoalId}
          onChange={(event) => setJournalGoalId(event.target.value)}
        >
          <option value="">No goal attached</option>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>{goal.label}</option>
          ))}
        </select>
        <label className="journal-label" htmlFor="journal">
          Write what you need to remember.
        </label>
        <textarea
          id="journal"
          value={journal}
          onChange={(event) => setJournal(event.target.value)}
          placeholder="Express freely"
        />
        <p className="privacy-note">Only you can see your journal unless you choose to share it.</p>
        <button className="primary-action full" onClick={saveJournalEntry}>
          <PenLine size={18} />
          Save Reflection
        </button>
        <button className="history-sheet-trigger" onClick={() => setReflectionHistoryOpen(true)} type="button">
          <BookOpen size={16} />
          View reflection history
          <span>{journalEntries.length}</span>
        </button>
      </section>
      {reflectionHistoryOpen && (
        <div className="bottom-sheet-backdrop" role="presentation" onClick={() => setReflectionHistoryOpen(false)}>
          <section
            aria-label="Reflection history"
            aria-modal="true"
            className="bottom-sheet reflection-history-sheet"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-head">
              <div>
                <span>{journalEntries.length} saved</span>
                <strong>Reflection History</strong>
              </div>
              <button className="icon-button sheet-close" onClick={() => setReflectionHistoryOpen(false)} type="button" aria-label="Close reflection history">
                <X size={18} />
              </button>
            </div>
            {journalHistoryList}
          </section>
        </div>
      )}
      <GoalsScreen
        awardPoints={awardPoints}
        celebrate={celebrate}
        goalDraft={goalDraft}
        goals={goals}
        setGoalDraft={setGoalDraft}
        setGoals={setGoals}
        standards={standards}
      />
    </>
  );
}

function CoachScreen({
  activeCoachSessionId,
  athleteProfile,
  authSession,
  coachSessions,
  lesson,
  goals,
  messages,
  messageDraft,
  planProgress,
  plans,
  standards,
  setActiveCoachSessionId,
  setCoachSessions,
  setMessages,
  setMessageDraft
}) {
  const [coachStatus, setCoachStatus] = useState('');
  const [coachThinking, setCoachThinking] = useState(false);

  function coachReply(text) {
    const lower = text.toLowerCase();
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (/^(yo+|hey+|hi+|hello+|sup|what'?s up|you there|are you there|u there|can you help|help me|coach|mindset coach)[\s?.!]*$/i.test(text)) {
      const firstName = String(athleteProfile?.name || authSession?.name || '').trim().split(/\s+/)[0];
      const namePhrase = firstName ? `, ${firstName}` : '';
      return `I'm here${namePhrase}. What's going on today?`;
    }
    if (words.length < 12) {
      return "I'm with you. Help me understand the moment a little more. What happened most recently?";
    }
    const hasExcuse =
      lower.includes('not my fault') ||
      lower.includes('unfair') ||
      lower.includes('they always') ||
      lower.includes('coach hates') ||
      lower.includes('i can’t') ||
      lower.includes("i can't");
    const topic = lower.includes('injur')
      ? 'injury response'
      : lower.includes('team') || lower.includes('teammate')
        ? 'team situation'
        : lower.includes('train') || lower.includes('practice') || lower.includes('motivat')
          ? 'training discipline'
          : lower.includes('coach')
            ? 'coach relationship'
            : lower.includes('slump')
              ? 'slump'
              : lower.includes('fear') || lower.includes('fail')
                ? 'fear of failure'
                : lower.includes('identity') || lower.includes('perform')
                  ? 'identity'
                  : 'pressure';
    if (hasExcuse) {
      return `I get why that feels frustrating. I am still going to challenge you: even if part of this is unfair, the useful question is what you can own next. Tell me the exact ${topic} moment and what you did right after it, then we can choose the response you want to train.`;
    }

    return `That sounds like a real ${topic} moment, but I do not want to guess at the whole story. What happened right before you felt this, and what do you wish you had done differently? Once I know that, we can turn it into one clear action for today.`;
  }

  function saveCoachSession(sessionId, sessionTitle, nextMessages) {
    setMessages(nextMessages);
    setActiveCoachSessionId(sessionId);
    setCoachSessions((current) => {
      const existing = current.find((session) => session.id === sessionId);
      const nextSession = {
        id: sessionId,
        title: existing?.title ?? sessionTitle,
        date: todayKey(),
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        messages: nextMessages
      };
      return [nextSession, ...current.filter((session) => session.id !== sessionId)].slice(0, 30);
    });
  }

  async function requestCoachReply(clean, nextMessages, sessionId, sessionTitle) {
    const headers = { 'Content-Type': 'application/json' };

    if (isSupabaseConfigured) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        headers.Authorization = `Bearer ${data.session.access_token}`;
      }
    }

    const response = await fetch(appApiUrl('/api/coach'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: clean,
        sessionId: String(sessionId),
        sessionTitle,
        history: nextMessages.slice(-12),
        athlete: {
          name: athleteProfile?.name || authSession?.name || '',
          sport: athleteProfile?.sport || '',
          age: athleteProfile?.age || '',
          location: athleteProfile?.location || '',
          goals: goals.map((goal) => `${goal.label}: ${goal.value}`),
          standards: standards.filter((standard) => standard.active !== false).map((standard) => standard.label)
        },
        curriculum: {
          dailyDeposit: {
            title: lesson?.title || '',
            body: lesson?.body || '',
            focusQuestion: lessonFocusQuestion(lesson),
            releaseDate: lesson?.releaseDate || todayKey()
          },
          performancePlans: sequencedPlanAccess(plans, planProgress)
            .slice(0, 18)
            .map((plan) => ({
              title: plan.title,
              seriesTitle: planSeriesTitle(plan),
              subject: plan.subject,
              steps: plan.steps,
              releaseDate: plan.releaseDate,
              challengeDay: plan.challengeDay,
              challengeLength: plan.challengeLength,
              currentDay: planCurrentDay(plan),
              completedAt: plan.completedAt || '',
              unlocked: plan.unlocked,
              unlockDate: plan.unlockDate || ''
            }))
        }
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Coach backend unavailable.');
      error.code = payload.code;
      error.messageCount = payload.messageCount;
      error.messageLimit = payload.messageLimit;
      throw error;
    }
    if (!payload.reply) {
      throw new Error('Coach backend returned an empty reply.');
    }
    return payload;
  }

  async function sendMessage() {
    const clean = messageDraft.trim();
    if (!clean || coachThinking) return;
    const nextMessages = [
      ...messages,
      { role: 'athlete', text: clean }
    ];
    const sessionId = activeCoachSessionId ?? String(Date.now());
    const sessionTitle = clean.length > 42 ? `${clean.slice(0, 42)}...` : clean;

    setMessageDraft('');
    setCoachStatus('');
    setCoachThinking(true);
    saveCoachSession(sessionId, sessionTitle, nextMessages);

    try {
      const payload = await requestCoachReply(clean, nextMessages, sessionId, sessionTitle);
      if (payload.messageLimit) {
        setCoachStatus(`${payload.messageCount} of ${payload.messageLimit} coach messages used today.`);
      }
      saveCoachSession(sessionId, sessionTitle, [...nextMessages, { role: 'coach', text: payload.reply }]);
    } catch (error) {
      if (error.code === 'coach_daily_limit') {
        setCoachStatus(error.message);
        setMessages(messages);
        if (messages.length === 0 && !activeCoachSessionId) {
          setActiveCoachSessionId(null);
          setCoachSessions((current) => current.filter((session) => session.id !== sessionId));
        } else {
          saveCoachSession(sessionId, sessionTitle, messages);
        }
        return;
      }
      if (import.meta.env.DEV) {
        const reply = coachReply(clean);
        setCoachStatus('Local coach backend is not connected, so this chat used the prototype coach.');
        saveCoachSession(sessionId, sessionTitle, [...nextMessages, { role: 'coach', text: reply }]);
      } else {
        setCoachStatus('My Mindset Coach could not connect to the backend. Try again in a moment.');
        saveCoachSession(sessionId, sessionTitle, nextMessages);
      }
    } finally {
      setCoachThinking(false);
    }
  }

  function useTopic(prompt) {
    setMessageDraft(prompt);
  }

  function startNewChat() {
    setActiveCoachSessionId(null);
    setMessages([]);
    setMessageDraft('');
    setCoachStatus('');
  }

  function openCoachSession(session) {
    setActiveCoachSessionId(session.id);
    setMessages(session.messages);
    setMessageDraft('');
    setCoachStatus('');
  }

  function removeCoachSession(id) {
    setCoachSessions((current) => current.filter((session) => session.id !== id));
    if (activeCoachSessionId === id) {
      startNewChat();
    }
  }

  return (
    <div className="coach-screen">
      <section className="coach-conversation">
        <div className="coach-conversation-head">
          <div className="coach-mark">
            <Sparkles size={18} />
          </div>
          <div>
            <span>Mindset Coach</span>
            <strong>{activeCoachSessionId ? 'Conversation open' : 'New conversation'}</strong>
          </div>
          <button className="ghost-action" onClick={startNewChat}>
            <Plus size={16} />
            New
          </button>
        </div>

        <div className="coach-topics">
          {coachTopics.map((topic) => (
            <button key={topic.title} onClick={() => useTopic(topic.prompt)}>
              {topic.title}
            </button>
          ))}
        </div>
        <p className="privacy-note">
          My Mindset Coach is for performance mindset support, not therapy or medical care. If safety, injury, abuse, or self-harm is involved, tell a trusted adult immediately.
        </p>

        <section className="chat-panel">
          {messages.length === 0 && (
            <div className="coach-empty-state">
              <MessageCircle size={24} />
              <strong>What do you want to work on today?</strong>
              <span>Bring a goal, a game moment, a question, or something you want to sharpen.</span>
            </div>
          )}
          {messages.map((message, index) => (
            <div className={message.role === 'coach' ? 'bubble coach' : 'bubble athlete'} key={`${message.role}-${index}`}>
              {message.text}
            </div>
          ))}
          {coachThinking && <div className="bubble coach thinking">Thinking it through...</div>}
        </section>

        {coachStatus && <p className="coach-status">{coachStatus}</p>}
        <div className="composer">
          <input
            value={messageDraft}
            onChange={(event) => setMessageDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') sendMessage();
            }}
            disabled={coachThinking}
            placeholder="Ask your coach..."
          />
          <button className="icon-button dark" onClick={sendMessage} aria-label="Send message" disabled={coachThinking}>
            <Send size={18} />
          </button>
        </div>
      </section>

      <section className="coach-support-grid">
        <div className="panel coach-history-panel">
          <PanelTitle icon={<BookOpen size={18} />} title="History" action={`${coachSessions.length} saved`} />
          {coachSessions.length === 0 ? (
            <p className="empty-note">Saved coach conversations will appear here.</p>
          ) : (
            <div className="coach-history">
              {coachSessions.map((session) => (
                <article className={session.id === activeCoachSessionId ? 'coach-session active' : 'coach-session'} key={session.id}>
                  <button onClick={() => openCoachSession(session)}>
                    <strong>{session.title}</strong>
                    <span>{session.date} at {session.time}</span>
                  </button>
                  <button className="remove-standard" onClick={() => removeCoachSession(session.id)} aria-label={`Remove coach chat from ${session.date}`}>
                    <Trash2 size={16} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ProfileScreen({ authSession, athleteProfile, privacySettings, setAthleteProfile, setPrivacySettings }) {
  const [shareFeedback, setShareFeedback] = useState('');

  function updateAthleteProfile(field, value) {
    setAthleteProfile((current) => ({ ...current, [field]: value }));
  }

  async function updatePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (isSupabaseConfigured && authSession?.id) {
      const extension = file.name.split('.').pop() || 'jpg';
      const path = `${authSession.id}/profile.${extension}`;
      const { error } = await supabase.storage
        .from('athlete-profile-photos')
        .upload(path, file, { cacheControl: '3600', upsert: true });

      if (!error) {
        const { data } = supabase.storage.from('athlete-profile-photos').getPublicUrl(path);
        updateAthleteProfile('photo', data.publicUrl);
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = () => updateAthleteProfile('photo', reader.result);
    reader.readAsDataURL(file);
  }

  function updatePrivacy(field, value) {
    setPrivacySettings((current) => ({ ...current, [field]: value }));
  }

  const parentInviteUrl = `${window.location.origin}${window.location.pathname}?role=parent&parentCode=${encodeURIComponent(athleteProfile.parentAccessCode)}`;
  const inviteMessage = `${athleteProfile.name || 'Your athlete'} invited you to The Complete Athlete parent portal.\n\nOpen this link and create a parent account:\n${parentInviteUrl}\n\nParent access code: ${athleteProfile.parentAccessCode}`;
  const parentContact = athleteProfile.parentContact.trim();
  const parentContactIsEmail = parentContact.includes('@');
  const parentContactDigits = parentContact.replace(/\D/g, '');
  const emailInviteUrl = `mailto:${parentContactIsEmail ? parentContact : ''}?subject=${encodeURIComponent('The Complete Athlete parent access')}&body=${encodeURIComponent(inviteMessage)}`;
  const smsInviteUrl = `sms:${parentContactDigits || ''}?&body=${encodeURIComponent(inviteMessage)}`;

  async function copyParentInvite() {
    try {
      await navigator.clipboard.writeText(inviteMessage);
      setShareFeedback('Invite copied. Send it to your parent.');
    } catch {
      setShareFeedback(`Share this code: ${athleteProfile.parentAccessCode}`);
    }
  }

  function openInvite(target) {
    window.location.href = target;
    setShareFeedback('Invite opened. Send it from your device.');
  }

  return (
    <>
      <section className="profile-head">
        <div className="profile-avatar">
          {athleteProfile.photo ? (
            <img src={athleteProfile.photo} alt="Athlete profile" />
          ) : (
            <UserRound size={30} />
          )}
        </div>
        <div>
          <p className="eyebrow">Athlete Profile</p>
          <h2>Riyahd Jones</h2>
          {(athleteProfile.age || athleteProfile.location) && (
            <span>
              {athleteProfile.age ? `Age ${athleteProfile.age}` : ''}
              {athleteProfile.age && athleteProfile.location ? ' | ' : ''}
              {athleteProfile.location}
            </span>
          )}
        </div>
      </section>
      <section className="panel add-goal-panel">
        <PanelTitle icon={<UserRound size={18} />} title="Profile Details" action="Athlete controlled" />
        <div className="photo-actions">
          <label className="photo-upload">
            <Camera size={18} />
            Add Photo
            <input type="file" accept="image/*" onChange={updatePhoto} />
          </label>
          {athleteProfile.photo && (
            <button className="secondary-action inline" onClick={() => updateAthleteProfile('photo', '')}>
              Remove Photo
            </button>
          )}
        </div>
        <div className="profile-fields">
          <label>
            <span>Age</span>
            <input
              className="text-field"
              inputMode="numeric"
              maxLength="2"
              placeholder="Add age"
              value={athleteProfile.age}
              onChange={(event) => updateAthleteProfile('age', event.target.value.replace(/\D/g, '').slice(0, 2))}
            />
          </label>
          <label>
            <span>State or country</span>
            <input
              className="text-field"
              placeholder="Add state or country"
              value={athleteProfile.location}
              onChange={(event) => updateAthleteProfile('location', event.target.value)}
            />
          </label>
        </div>
      </section>
      <section className="panel achievements-panel">
        <PanelTitle icon={<Users size={18} />} title="Parent Access" action="Share" />
        <label className="journal-label" htmlFor="parent-contact">
          Parent email or phone
        </label>
        <input
          id="parent-contact"
          className="text-field"
          placeholder="Add parent email or phone"
          value={athleteProfile.parentContact}
          onChange={(event) => updateAthleteProfile('parentContact', event.target.value)}
        />
        <div className="access-code-box">
          <span>Parent access code</span>
          <strong>{athleteProfile.parentAccessCode}</strong>
        </div>
        <p className="privacy-note">Invite includes the parent access link and code.</p>
        <div className="parent-share-actions">
          <button className="primary-action full" onClick={copyParentInvite}>
            <Copy size={18} />
            Copy Invite
          </button>
          <button className="secondary-action inline" onClick={() => openInvite(emailInviteUrl)}>
            <Send size={18} />
            Email
          </button>
          <button className="secondary-action inline" onClick={() => openInvite(smsInviteUrl)}>
            <MessageCircle size={18} />
            Text
          </button>
        </div>
        {shareFeedback && <p className="inline-note">{shareFeedback}</p>}
      </section>
      <section className="panel privacy-controls-panel">
        <PanelTitle icon={<Shield size={18} />} title="Privacy Controls" action="Parent view" />
        <div className="privacy-list">
          <label>
            <span>Readiness trend visible to parent</span>
            <input
              type="checkbox"
              checked={privacySettings.readinessVisible}
              onChange={(event) => updatePrivacy('readinessVisible', event.target.checked)}
            />
          </label>
          <label>
            <span>Productivity tracker visible to parent</span>
            <input
              type="checkbox"
              checked={privacySettings.standardsVisible}
              onChange={(event) => updatePrivacy('standardsVisible', event.target.checked)}
            />
          </label>
          <label>
            <span>Goals summary visible to parent</span>
            <input
              type="checkbox"
              checked={privacySettings.goalsVisible}
              onChange={(event) => updatePrivacy('goalsVisible', event.target.checked)}
            />
          </label>
        </div>
        <div className="privacy-boundaries">
          <span>Journal is private unless you choose to share it.</span>
          <span>My Mindset Coach chats stay private.</span>
        </div>
      </section>
    </>
  );
}

function ParentDashboard({
  athleteScore,
  goals,
  lesson,
  linkedAthleteId,
  linkParentAccessCode,
  parentAccessDraft,
  parentLinkChecked,
  parentLinkFeedback,
  parentMessage,
  planProgress,
  plans,
  privacySettings,
  setParentAccessDraft,
  setParentLinkFeedback,
  standardsCompleted,
  standardsTotal
}) {
  const planSeriesStats = planSeriesCompletion(plans, planProgress);

  if (!parentLinkChecked) {
    return (
      <section className="panel parent-access-panel">
        <PanelTitle icon={<Users size={18} />} title="Parent Access" action="Checking" />
        <p className="empty-note">Checking your athlete connection...</p>
      </section>
    );
  }

  if (!linkedAthleteId) {
    return (
      <>
        <section className="panel parent-access-panel">
          <PanelTitle icon={<Users size={18} />} title="Link Athlete" action="Access code" />
          <p className="info-note">Enter the parent access code from your athlete’s profile or invite link.</p>
          <form className="standard-form" onSubmit={linkParentAccessCode}>
            <input
              aria-label="Parent access code"
              placeholder="Parent access code"
              value={parentAccessDraft}
              onChange={(event) => {
                setParentAccessDraft(event.target.value);
                setParentLinkFeedback('');
              }}
            />
            <button className="primary-action" type="submit">
              Link Athlete
            </button>
          </form>
          {parentLinkFeedback && <p className="inline-note">{parentLinkFeedback}</p>}
        </section>
        <ParentCornerSection parentMessage={parentMessage} />
      </>
    );
  }

  return (
    <>
      <div className="metric-grid">
        <Metric icon={<Trophy size={18} />} label="Athlete Score" value={athleteScore} />
        {privacySettings.standardsVisible && (
          <Metric icon={<BadgeCheck size={18} />} label="Productivity" value={`${standardsCompleted}/${standardsTotal}`} />
        )}
        {privacySettings.standardsVisible && (
          <Metric icon={<BookOpen size={18} />} label="Plans Completed" value={`${planSeriesStats.completed}/${planSeriesStats.total}`} />
        )}
        {!privacySettings.standardsVisible && (
          <Metric icon={<Shield size={18} />} label="Privacy" value="Limited" />
        )}
      </div>
      <section className="panel daily-deposit-panel parent-daily-deposit-panel">
        <PanelTitle icon={<Brain size={18} />} title="Daily Deposit" />
        <h2>{lesson.title}</h2>
        <p>{lesson.body}</p>
      </section>
      <ParentCornerSection parentMessage={parentMessage} />
      <ParentPlanLibrary plans={plans} planProgress={planProgress} />
      {privacySettings.goalsVisible && (
        <section className="panel parent-goal-panel">
          <PanelTitle icon={<Goal size={18} />} title="Goal Snapshot" action={`${goals.length} goals`} />
          <div className="parent-goals">
            {goals.slice(0, 3).map((goal) => (
              <span key={goal.id}>
                <strong>{goal.label}</strong>
                {goal.progress}%
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ParentCornerSection({ parentMessage }) {
  const [selectedParentContentId, setSelectedParentContentId] = useState('');
  const parentContent = [
    {
      id: 'daily-parent-corner',
      category: 'Mindset Support',
      title: parentMessage.title,
      date: parentMessage.sendDate,
      promise: parentMessage.body,
      ask: parentMessage.conversationCue,
      avoid: parentMessage.avoid
    }
  ];
  const selectedContent = parentContent.find((item) => item.id === selectedParentContentId);

  if (selectedContent) {
    return (
      <section className="panel parent-corner-detail">
        <button className="plan-back-button" onClick={() => setSelectedParentContentId('')} type="button">
          Back to Parent Corner
        </button>
        <PanelTitle icon={<Users size={18} />} title={selectedContent.title} action={selectedContent.date} />
        <p>{selectedContent.promise}</p>
        <div className="parent-cues">
          <span>
            <strong>Ask</strong>
            {selectedContent.ask}
          </span>
          <span>
            <strong>Avoid</strong>
            {selectedContent.avoid}
          </span>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="panel parent-corner-hero">
        <PanelTitle icon={<Users size={18} />} title="Parent Corner" action={`${parentContent.length} guide`} />
        <h2>Support the daily work behind the scenes.</h2>
        <div className="goal-reminder">
          <strong>How to use this</strong>
          <span>Read the parent guide, then use the conversation cue to help your athlete think through the day without taking over the work.</span>
        </div>
      </section>

      <section className="panel parent-corner-library">
        <PanelTitle icon={<Sparkles size={18} />} title="Continue Parent Guide" action={parentMessage.sendDate} />
        <button className="continue-plan-card parent-guide-card" onClick={() => setSelectedParentContentId(parentContent[0].id)} type="button">
          <span>{parentContent[0].category}</span>
          <strong>{parentContent[0].title}</strong>
          <em>Today’s parent focus</em>
          <p>{parentContent[0].promise}</p>
        </button>
      </section>

      <section className="panel parent-corner-library">
        <PanelTitle icon={<Target size={18} />} title="Browse Parent Content" action={`${parentContent.length} shown`} />
        <div className="plan-category-strip" aria-label="Parent content categories">
          <button className="active" type="button">All</button>
          <button type="button">Mindset Support</button>
        </div>
        <div className="plan-list">
          {parentContent.map((item) => (
            <button className="plan-list-row parent-guide-row" key={item.id} onClick={() => setSelectedParentContentId(item.id)} type="button">
              <span>{item.category}</span>
              <strong>{item.title}</strong>
              <p>{item.promise}</p>
              <em>{item.date}</em>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function ParentPlanLibrary({ plans, planProgress }) {
  const today = todayKey();
  const sequencedPlans = sequencedPlanAccess(plans, planProgress, today);
  const planLibrary = buildPlanLibrary(sequencedPlans);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [selectedSeriesId, setSelectedSeriesId] = useState('');
  const selectedSeries = planLibrary.find((series) => series.id === selectedSeriesId) ?? null;
  const defaultLesson = selectedSeries?.plans.find((plan) => plan.unlocked && !plan.completedAt)
    ?? selectedSeries?.plans.find((plan) => plan.unlocked)
    ?? selectedSeries?.plans[0]
    ?? null;
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const selectedPlan = selectedSeries?.plans.find((plan) => String(plan.id) === String(selectedPlanId)) ?? defaultLesson;
  const openSeriesCount = planLibrary.filter((series) => series.openCount > 0).length;
  const completedSeriesCount = planLibrary.filter((series) => series.completedCount === series.plans.length).length;

  useEffect(() => {
    if (!libraryOpen) {
      setSelectedSeriesId('');
    }
  }, [libraryOpen]);

  useEffect(() => {
    if (selectedSeriesId && !planLibrary.some((series) => series.id === selectedSeriesId)) {
      setSelectedSeriesId('');
    }
  }, [planLibrary, selectedSeriesId]);

  useEffect(() => {
    if (!selectedSeries) {
      setSelectedPlanId('');
      return;
    }
    if (!selectedPlanId || !selectedSeries.plans.some((plan) => String(plan.id) === String(selectedPlanId))) {
      setSelectedPlanId(defaultLesson?.id ?? '');
    }
  }, [defaultLesson?.id, selectedPlanId, selectedSeries]);

  if (!libraryOpen) {
    return (
      <section className="panel parent-plans-panel parent-plans-closed">
        <PanelTitle icon={<BookOpen size={18} />} title="Performance Plans" action={`${planLibrary.length} series`} />
        <div>
          <h2>Review the same plans your athlete is working through.</h2>
          <p>Open the library when you want to see each series, follow lesson progress, or talk through a chapter together.</p>
        </div>
        <button className="primary-action full" onClick={() => setLibraryOpen(true)} type="button">
          Open Performance Plans
        </button>
      </section>
    );
  }

  if (selectedSeries) {
    return (
      <section className="panel parent-plans-panel parent-plans-detail">
        <button className="plan-back-button" onClick={() => setSelectedSeriesId('')} type="button">
          Back to Plan Library
        </button>
        <div className="parent-plans-banner has-cover" style={{ '--plan-cover': `url(${selectedSeries.coverImage})`, '--plan-cover-position': selectedSeries.coverPosition }}>
          <div className="series-cover" aria-hidden="true" />
          <PanelTitle icon={<BookOpen size={18} />} title={selectedSeries.title} action={`${selectedSeries.completedCount}/${selectedSeries.plans.length} done`} />
          <p>{selectedSeries.tagline}</p>
        </div>
        <div className="parent-plan-detail-layout">
          <div className="parent-lesson-list" aria-label={`${selectedSeries.title} lessons`}>
            {selectedSeries.plans.map((plan) => (
              <button
                className={String(selectedPlan?.id) === String(plan.id) ? 'active' : ''}
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                type="button"
              >
                <span>{plan.completedAt ? 'Completed' : plan.unlocked ? plan.challengeDay : 'Locked'}</span>
                <strong>{plan.title}</strong>
                <em>
                  {plan.completedAt
                    ? `Completed ${plan.completedAt}`
                    : plan.unlocked
                      ? 'Available to review'
                      : 'Unlocks through athlete progress'}
                </em>
              </button>
            ))}
          </div>
          <article className={selectedPlan?.unlocked ? 'goal-card plan-card readonly-plan parent-plan-reader' : 'goal-card plan-card readonly-plan parent-plan-reader locked-plan'}>
            {selectedPlan ? (
              <>
                <div className="plan-read-header">
                  <span>{selectedPlan.completedAt ? 'Completed' : selectedPlan.unlocked ? selectedPlan.challengeDay : 'Locked'}</span>
                  <strong>{selectedPlan.title}</strong>
                  <em>{selectedPlan.unlocked ? 'Parent review mode' : 'Athlete unlock required'}</em>
                  <p>{planDisplaySubject(selectedPlan)}</p>
                </div>
                {selectedPlan.unlocked ? (
                  <PlanEpisode steps={selectedPlan.steps} planId={selectedPlan.id} />
                ) : (
                  <div className="locked-message">
                    <LockKeyhole size={18} />
                    <p>This lesson is still locked for the athlete. Parents can see the roadmap here without crowding the dashboard.</p>
                  </div>
                )}
              </>
            ) : (
              <p className="empty-note">Choose a plan lesson to review.</p>
            )}
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className="panel parent-plans-panel">
      <div className="parent-library-header">
        <PanelTitle icon={<BookOpen size={18} />} title="Athlete Plan Library" action={`${planLibrary.length} series`} />
        <button className="ghost-action compact" onClick={() => setLibraryOpen(false)} type="button">
          Close
        </button>
      </div>
      <div className="parent-plan-overview">
        <span>
          <strong>{openSeriesCount}</strong>
          Open series
        </span>
        <span>
          <strong>{completedSeriesCount}</strong>
          Completed series
        </span>
        <span>
          <strong>{planLibrary.length}</strong>
          Plan series
        </span>
      </div>
      <p className="parent-plan-intro">Review what your athlete is working through, then use one idea from the lesson to start a thoughtful conversation.</p>
      <div className="parent-plan-series-grid">
        {planLibrary.map((series) => (
          <button
            className="parent-plan-series-card has-cover"
            key={series.id}
            onClick={() => setSelectedSeriesId(series.id)}
            style={{ '--plan-cover': `url(${series.coverImage})`, '--plan-thumb': `url(${series.thumbnailImage})`, '--plan-cover-position': series.coverPosition }}
            type="button"
          >
            <div className="plan-cover-thumb" aria-hidden="true" />
            <span>{series.category}</span>
            <strong>{series.title}</strong>
            <p>{series.tagline}</p>
            <em>{series.completedCount}/{series.plans.length} complete · {series.openCount} open</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    ['home', Home, 'home'],
    ['journal', PenLine, 'goals'],
    ['plans', BookOpen, 'plans'],
    ['coach', MessageCircle, 'coach'],
    ['profile', UserRound, 'profile']
  ];
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {items.map(([id, Icon, label]) => (
        <button className={tab === id ? 'nav-item active' : 'nav-item'} key={id} onClick={() => setTab(id)}>
          <Icon size={19} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="metric-card">
      <span className="metric-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PanelTitle({ icon, title, action }) {
  return (
    <div className="panel-title">
      <span>
        {icon}
        {title}
      </span>
      <em>{action}</em>
    </div>
  );
}

function Progress({ value }) {
  return (
    <div className="progress-track" aria-label={`${value}% progress`}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
