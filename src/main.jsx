import React, { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
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
  ChevronDown,
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
import {
  canUseNativePurchases,
  loadRevenueCatSubscription,
  purchaseRevenueCatSubscription,
  restoreRevenueCatSubscription,
  revenueCatConfig
} from './revenueCat';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import './styles.css';

if (typeof window !== 'undefined') {
  const isNativeShell =
    window.location.protocol === 'capacitor:' ||
    new URLSearchParams(window.location.search).has('nativePreview') ||
    Boolean(window.Capacitor?.isNativePlatform?.()) ||
    Boolean(window.Capacitor?.getPlatform && window.Capacitor.getPlatform() !== 'web');
  const isTextEntryActive = () => {
    const element = document.activeElement;
    return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element?.isContentEditable;
  };
  const updateKeyboardState = () => {
    const viewportHeight = window.visualViewport?.height || window.innerHeight || 0;
    const keyboardLikelyOpen = isTextEntryActive() && viewportHeight > 0 && window.innerHeight - viewportHeight > 120;
    document.documentElement.classList.toggle('keyboard-open', keyboardLikelyOpen);
    return keyboardLikelyOpen;
  };
  const syncAppViewportHeight = () => {
    if (updateKeyboardState()) return;
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
      if (updateKeyboardState()) {
        lockHorizontalScroll();
        return;
      }
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
    document.addEventListener('focusin', runNativeLayoutPass, { passive: true });
    document.addEventListener('focusout', () => window.setTimeout(runNativeLayoutPass, 180), { passive: true });
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
const parentGuideProgressStorageKey = 'the-ninety-percent-parent-guide-progress';
const pointsLedgerStorageKey = 'the-ninety-percent-points-ledger';
const onboardingStorageKey = 'the-ninety-percent-onboarding-complete';
const athleteStartStorageKey = 'the-complete-athlete-start-today-complete';
const trialPromptStorageKey = 'the-complete-athlete-trial-prompt-dismissed';
const trialAccessStorageKey = 'the-complete-athlete-trial-access-expires';
const authUsersStorageKey = 'the-ninety-percent-auth-users';
const authSessionStorageKey = 'the-ninety-percent-auth-session';
const notificationPrefsStorageKey = 'the-ninety-percent-notification-preferences';
const prototypeBypassLogin = false;
const productionApiOrigin = import.meta.env.VITE_API_ORIGIN || 'https://the-complete-athlete.vercel.app';

function appApiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window === 'undefined') return cleanPath;

  const host = window.location.host;
  const isProductionWeb = host === 'the-complete-athlete.vercel.app';
  return isProductionWeb ? cleanPath : `${productionApiOrigin}${cleanPath}`;
}

function isNativePushRuntime() {
  return typeof window !== 'undefined' && Boolean(Capacitor?.isNativePlatform?.());
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

const notificationPreferenceSeed = {
  dailyDeposits: true,
  performancePlans: true,
  planUnlocks: true,
  streaks: true,
  productivity: true,
  points: true,
  parentUpdates: true,
  browserPush: false
};

const athleteChallengeOptions = [
  {
    id: 'pressure',
    title: 'Pressure',
    shortLabel: 'Handle pressure',
    description: 'Stay steady when the moment feels big.',
    goal: 'Stay composed in high-pressure moments',
    standard: 'Use one reset breath before a hard rep',
    lessonTitle: 'Pressure is information',
    lessonBody: 'Pressure does not mean you are unprepared. It means the moment matters. Today, your job is to slow the moment down and control the next response.',
    focus: 'What pressure can I treat as information instead of a threat today?',
    planKeywords: ['pressure', 'game']
  },
  {
    id: 'confidence',
    title: 'Confidence',
    shortLabel: 'Build confidence',
    description: 'Collect proof instead of waiting to feel ready.',
    goal: 'Build confidence through daily proof',
    standard: 'Write down one confidence receipt',
    lessonTitle: 'Confidence needs evidence',
    lessonBody: 'Confidence grows when you prove something to yourself. Today, do one thing that gives your future self evidence to trust.',
    focus: 'What proof can I collect today that I am becoming the athlete I say I am?',
    planKeywords: ['confidence', 'belief']
  },
  {
    id: 'comparison',
    title: 'Comparison',
    shortLabel: 'Stop comparing',
    description: 'Focus on your own season and assignment.',
    goal: 'Compete against my standard, not someone else',
    standard: 'Name one controllable before practice',
    lessonTitle: 'Run your race',
    lessonBody: 'Comparison steals energy from the work in front of you. Today, bring your attention back to what you can control.',
    focus: 'What part of my own game deserves my full attention today?',
    planKeywords: ['identity', '90%', 'ninety']
  },
  {
    id: 'discipline',
    title: 'Discipline',
    shortLabel: 'Get disciplined',
    description: 'Do the work even when motivation is quiet.',
    goal: 'Become consistent with the daily work',
    standard: 'Finish one training task before comfort wins',
    lessonTitle: 'Discipline goes first',
    lessonBody: 'Motivation is helpful, but discipline is dependable. Today, choose the next right action before you negotiate with it.',
    focus: 'What is one small action I can complete before I feel ready?',
    planKeywords: ['discipline', 'training', 'leader']
  },
  {
    id: 'coach',
    title: 'Coach',
    shortLabel: 'Handle coach feedback',
    description: 'Respond to correction without losing yourself.',
    goal: 'Receive coaching with maturity',
    standard: 'Ask one clarifying question after feedback',
    lessonTitle: 'Correction can sharpen you',
    lessonBody: 'Feedback is not an attack on who you are. Today, separate your identity from correction and look for the useful part.',
    focus: 'What feedback can I receive without letting it define me?',
    planKeywords: ['coach', 'leadership']
  },
  {
    id: 'identity',
    title: 'Identity',
    shortLabel: 'Separate identity from results',
    description: 'Remember who you are beyond the scoreboard.',
    goal: 'Play from identity, not for identity',
    standard: 'Say one identity statement before competing',
    lessonTitle: 'You are more than the result',
    lessonBody: 'The scoreboard can measure a game. It cannot measure your worth. Today, compete with freedom because your identity is already bigger than performance.',
    focus: 'What identity do I need to train today, no matter what the scoreboard says?',
    planKeywords: ['identity', '90%', 'ninety']
  },
  {
    id: 'something-else',
    title: 'Something Else',
    shortLabel: 'Something else',
    description: 'Start with a general reset and find the right support after.',
    goal: 'Get clear on what I need and take the next right step',
    standard: 'Write one sentence about what I need help with today',
    lessonTitle: 'Start with what is true',
    lessonBody: 'You do not have to have the perfect label for what you are feeling. Start by being honest, choose one controllable, and take the next right step.',
    focus: 'What is the real thing I need help with today?',
    planKeywords: ['mindset', 'identity', 'confidence']
  }
];

function athleteChallengeById(id) {
  return athleteChallengeOptions.find((challenge) => challenge.id === id) ?? athleteChallengeOptions[0];
}

function todayKey() {
  return new Date().toLocaleDateString('en-CA');
}

function timeBasedGreeting(name) {
  const cleanName = String(name ?? '').trim() || 'Athlete';
  const greeting = new Date().getHours() < 12 ? 'Good morning' : 'Hello';
  return `${greeting}, ${cleanName}`;
}

function firstNameGreeting(name) {
  const firstName = String(name ?? '').trim().split(/\s+/)[0] || 'Athlete';
  const greeting = new Date().getHours() < 12 ? 'Good morning' : 'Hello';
  return `${greeting}, ${firstName}`;
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
      notifications: normalizeNotifications(saved.notifications)
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

function buildNotification(title, body, tone = 'info', options = {}) {
  const createdAt = options.createdAt || new Date().toISOString();
  return {
    id: options.id || `${options.type || 'notice'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: options.type || 'general',
    title,
    body,
    tone,
    createdAt,
    displayTime: new Date(createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    read: Boolean(options.read)
  };
}

function normalizeNotifications(value) {
  return Array.isArray(value)
    ? value
        .filter((notification) => notification?.title && notification?.body)
        .map((notification) => ({
          ...buildNotification(notification.title, notification.body, notification.tone || 'info', notification),
          displayTime: notification.displayTime || new Date(notification.createdAt || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        }))
        .slice(0, 40)
    : [];
}

function loadNotificationPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(notificationPrefsStorageKey) ?? '{}');
    return { ...notificationPreferenceSeed, ...saved };
  } catch {
    return notificationPreferenceSeed;
  }
}

function notificationFromSupabase(row) {
  return buildNotification(row.title, row.body, row.tone || 'info', {
    id: row.id,
    type: row.notification_type || row.type || 'general',
    createdAt: row.created_at,
    read: row.read
  });
}

function notificationToSupabase(notification, userId) {
  return {
    id: String(notification.id),
    user_id: userId,
    notification_type: notification.type || 'general',
    title: notification.title || '',
    body: notification.body || '',
    tone: notification.tone || 'info',
    read: Boolean(notification.read),
    created_at: notification.createdAt || new Date().toISOString()
  };
}

function notificationPreferencesFromSupabase(row) {
  return {
    ...notificationPreferenceSeed,
    dailyDeposits: row?.daily_deposits ?? notificationPreferenceSeed.dailyDeposits,
    performancePlans: row?.performance_plans ?? notificationPreferenceSeed.performancePlans,
    planUnlocks: row?.plan_unlocks ?? notificationPreferenceSeed.planUnlocks,
    streaks: row?.streaks ?? notificationPreferenceSeed.streaks,
    productivity: row?.productivity ?? notificationPreferenceSeed.productivity,
    points: row?.points ?? notificationPreferenceSeed.points,
    parentUpdates: row?.parent_updates ?? notificationPreferenceSeed.parentUpdates,
    browserPush: row?.browser_push ?? notificationPreferenceSeed.browserPush
  };
}

function notificationPreferencesToSupabase(preferences, userId) {
  return {
    user_id: userId,
    daily_deposits: Boolean(preferences.dailyDeposits),
    performance_plans: Boolean(preferences.performancePlans),
    plan_unlocks: Boolean(preferences.planUnlocks),
    streaks: Boolean(preferences.streaks),
    productivity: Boolean(preferences.productivity),
    points: Boolean(preferences.points),
    parent_updates: Boolean(preferences.parentUpdates),
    browser_push: Boolean(preferences.browserPush),
    updated_at: new Date().toISOString()
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
  return sortedPlans.map((plan) => {
    const series = planSeriesTitle(plan);
    const previousPlan = previousBySeries.get(series);
    const previousCompletedAt = previousPlan ? planProgress[String(previousPlan.id)] : '';
    const completedAt = planProgress[String(plan.id)] || '';
    const released = !plan.releaseDate || plan.releaseDate <= date;
    const sequenceUnlocked = !previousPlan || Boolean(previousCompletedAt && addDays(previousCompletedAt, 1) <= date);
    const unlocked = released && sequenceUnlocked;
    const unlockDate = !previousPlan ? plan.releaseDate : previousCompletedAt ? addDays(previousCompletedAt, 1) : '';
    previousBySeries.set(series, plan);
    return { ...plan, completedAt, unlocked, unlockDate };
  });
}

function trialPlanAccess(plans, planProgress) {
  const sortedPlans = [...plans].sort((first, second) => (
    planSeriesTitle(first).localeCompare(planSeriesTitle(second)) ||
    planDayNumber(first) - planDayNumber(second) ||
    String(first.title).localeCompare(String(second.title))
  ));
  const firstPlanBySeries = new Map();

  sortedPlans.forEach((plan) => {
    const series = planSeriesTitle(plan);
    if (!firstPlanBySeries.has(series)) firstPlanBySeries.set(series, String(plan.id));
  });

  return sortedPlans.map((plan) => {
    const dayOneOpen = firstPlanBySeries.get(planSeriesTitle(plan)) === String(plan.id);
    return {
      ...plan,
      completedAt: planProgress[String(plan.id)] || '',
      unlocked: dayOneOpen,
      unlockDate: dayOneOpen ? '' : 'After trial upgrade'
    };
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
      currentChallenge: saved.currentChallenge ?? '',
      parentAccessCode: saved.parentAccessCode ?? 'TCA-PARENT'
    };
  } catch {
    return { name: '', sport: '', age: '', location: '', photo: '', parentContact: '', currentChallenge: '', parentAccessCode: 'TCA-PARENT' };
  }
}

function loadOnboardingComplete() {
  try {
    return localStorage.getItem(onboardingStorageKey) === 'true';
  } catch {
    return false;
  }
}

function loadAthleteStartComplete() {
  try {
    return localStorage.getItem(athleteStartStorageKey) === 'true';
  } catch {
    return false;
  }
}

function scopedTrialPromptStorageKey(userId) {
  return `${trialPromptStorageKey}:${String(userId || 'guest')}`;
}

function loadTrialPromptDismissed(userId) {
  try {
    if (!userId) return false;
    return localStorage.getItem(scopedTrialPromptStorageKey(userId)) === 'true';
  } catch {
    return false;
  }
}

function saveTrialPromptDismissed(userId) {
  try {
    if (userId) localStorage.setItem(scopedTrialPromptStorageKey(userId), 'true');
  } catch {
    // Ignore storage failures so purchase and restore flows can finish.
  }
}

function scopedTrialAccessStorageKey(userId) {
  return `${trialAccessStorageKey}:${String(userId || 'guest')}`;
}

function loadTrialAccessActive(userId) {
  try {
    if (!userId) return false;
    const expiresAt = localStorage.getItem(scopedTrialAccessStorageKey(userId));
    return Boolean(expiresAt && new Date(expiresAt).getTime() > Date.now());
  } catch {
    return false;
  }
}

function saveTrialAccessWindow(userId, expirationDate) {
  try {
    if (!userId) return;
    const fallbackExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(scopedTrialAccessStorageKey(userId), expirationDate || fallbackExpiresAt);
  } catch {
    // Trial access still depends on RevenueCat/backend when storage is unavailable.
  }
}

function clearTrialAccessWindow(userId) {
  try {
    if (userId) localStorage.removeItem(scopedTrialAccessStorageKey(userId));
  } catch {
    // Ignore storage failures during purchase cancellation.
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

function shouldPreferSeedPlan(planId) {
  const id = String(planId ?? '');
  return id.startsWith('imagination-station-day-') || id.startsWith('compete-differently-day-');
}

function mergeWithSeedPlans(sourcePlans) {
  const nextPlans = Array.isArray(sourcePlans) ? sourcePlans.map(normalizePlan) : [];
  plansSeed.map(normalizePlan).forEach((plan) => {
    const existingIndex = nextPlans.findIndex((sourcePlan) => String(sourcePlan.id) === String(plan.id));
    if (existingIndex >= 0 && shouldPreferSeedPlan(plan.id)) {
      nextPlans[existingIndex] = plan;
      return;
    }
    if (existingIndex < 0) {
      nextPlans.push(plan);
    }
  });
  return nextPlans;
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
    currentChallenge: currentProfile.currentChallenge ?? '',
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

function parentGuideFromSupabase(row) {
  return {
    id: row.id,
    seriesTitle: row.series_title ?? 'Parent Guide',
    title: row.title ?? '',
    category: row.category ?? 'Parent Support',
    subject: row.subject ?? '',
    steps: Array.isArray(row.steps) ? row.steps : [],
    releaseDate: row.release_date ?? todayKey(),
    guideDay: row.guide_day ?? '',
    guideLength: Number(row.guide_length) || 1
  };
}

function parentGuideMergeKey(guide) {
  const series = String(guide?.seriesTitle ?? '').toLowerCase();
  if (series.includes('borrowed confidence')) return 'series:borrowed-confidence';
  if (series.includes('comparison trap')) return 'series:comparison-trap';
  if (series.includes('elite parents') || series.includes('elite athletes need elite parents')) return 'series:elite-parents';
  if (series.includes('pressure isn')) return 'series:pressure-isnt-the-enemy';
  if (series.includes('raising a complete athlete')) return 'series:raising-complete-athlete';
  if (series.includes('home court advantage')) return 'series:home-court-advantage';
  return `id:${String(guide?.id ?? '')}`;
}

function mergeParentGuidesWithSeeds(guides) {
  const merged = new Map();
  createParentGuideSeeds().forEach((guide) => merged.set(parentGuideMergeKey(guide), guide));
  (Array.isArray(guides) ? guides : []).forEach((guide) => merged.set(parentGuideMergeKey(guide), guide));
  return Array.from(merged.values()).sort((first, second) =>
    String(first.releaseDate || '').localeCompare(String(second.releaseDate || '')) ||
    String(first.id).localeCompare(String(second.id))
  );
}

function parentGuideCoverImage(seriesTitle) {
  const normalized = String(seriesTitle ?? '').toLowerCase();
  if (normalized.includes('borrowed confidence')) {
    return '/parent-guides/borrowed-confidence-banner.jpg';
  }
  if (normalized.includes('comparison trap')) {
    return '/parent-guides/comparison-trap-banner.jpg';
  }
  if (normalized.includes('elite parents') || normalized.includes('elite athletes need elite parents')) {
    return '/parent-guides/elite-parents-banner.png';
  }
  if (normalized.includes('pressure isn')) {
    return '/parent-guides/pressure-isnt-the-enemy-banner.png';
  }
  if (normalized.includes('raising a complete athlete')) {
    return '/parent-guides/raising-complete-athlete-banner.png';
  }
  if (normalized.includes('home court advantage')) {
    return '/parent-guides/home-court-advantage-banner.jpg';
  }
  return '/parent-guides/home-court-advantage-banner.jpg';
}

function parentGuideThumbnailImage(seriesTitle) {
  const normalized = String(seriesTitle ?? '').toLowerCase();
  if (normalized.includes('borrowed confidence')) {
    return '/parent-guides/borrowed-confidence-thumbnail.png';
  }
  if (normalized.includes('comparison trap')) {
    return '/parent-guides/comparison-trap-thumbnail.png';
  }
  if (normalized.includes('elite parents') || normalized.includes('elite athletes need elite parents')) {
    return '/parent-guides/elite-parents-thumbnail.png';
  }
  if (normalized.includes('pressure isn')) {
    return '/parent-guides/pressure-isnt-the-enemy-thumbnail.png';
  }
  if (normalized.includes('raising a complete athlete')) {
    return '/parent-guides/raising-complete-athlete-thumbnail.png';
  }
  if (normalized.includes('home court advantage')) {
    return '/parent-guides/home-court-advantage-thumbnail.jpg';
  }
  return parentGuideCoverImage(seriesTitle);
}

function parentGuideCoverPosition(seriesTitle) {
  const normalized = String(seriesTitle ?? '').toLowerCase();
  if (normalized.includes('borrowed confidence')) {
    return '50% 50%';
  }
  if (normalized.includes('comparison trap')) {
    return '50% 48%';
  }
  if (normalized.includes('elite parents') || normalized.includes('elite athletes need elite parents')) {
    return '50% 50%';
  }
  if (normalized.includes('pressure isn')) {
    return '44% 50%';
  }
  if (normalized.includes('raising a complete athlete')) {
    return '58% 50%';
  }
  if (normalized.includes('home court advantage')) {
    return '50% 48%';
  }
  return '50% 50%';
}


function loadPlans() {
  try {
    const saved = JSON.parse(localStorage.getItem(plansStorageKey) ?? '[]');
    const savedPlans = mergeWithSeedPlans(Array.isArray(saved) ? saved.map(normalizePlan) : []);
    const hasCurrentNinetyPlan = savedPlans.some((plan) => String(plan.id).startsWith('ninety-percent-day-'));
    const hasDocumentStructuredNinetyPlan = savedPlans.some((plan) =>
      String(plan.id).startsWith('ninety-percent-day-') &&
      plan.steps.some((step) => String(step).includes('This Chapter Will Help You'))
    );
    const hasCurrentSlumpPlan = savedPlans.some((plan) =>
      (String(plan.id).startsWith('slump-series-day-') || String(plan.subject).includes("I'm In A Slump")) &&
      plan.steps.some((step) => String(step).includes('Final Complete Athlete Principle') || String(step).includes('The Second Opponent'))
    );
    const hasCompeteDifferentlyPlan = savedPlans.some((plan) => String(plan.id).startsWith('compete-differently-day-'));
    return savedPlans.length && (!hasCurrentNinetyPlan || hasDocumentStructuredNinetyPlan) && hasCurrentSlumpPlan && hasCompeteDifferentlyPlan
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

function loadParentGuideProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(parentGuideProgressStorageKey) ?? '{}');
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

function averagePercent(entries, count = 7) {
  const recentEntries = [...normalizeStandardsHistory(entries)].slice(-count);
  if (!recentEntries.length) return 0;
  return Math.round(recentEntries.reduce((total, entry) => total + Number(entry.percent || 0), 0) / recentEntries.length);
}

function weeklyParentSnapshot({ standardsHistory, readinessHistory, journalEntries, pointsLedger, planProgress, date = todayKey() }) {
  const weekStart = addDays(date, -6);
  const standardsWeek = normalizeStandardsHistory(standardsHistory).filter((entry) => entry.date >= weekStart && entry.date <= date);
  const readinessWeek = normalizeReadinessHistory(readinessHistory).filter((entry) => entry.date >= weekStart && entry.date <= date);
  const journalWeek = (Array.isArray(journalEntries) ? journalEntries : []).filter((entry) => entry.date >= weekStart && entry.date <= date);
  const pointsWeek = (Array.isArray(pointsLedger) ? pointsLedger : []).filter((entry) => entry.date >= weekStart && entry.date <= date);
  const completedPlanIds = new Set(
    Object.entries(planProgress || {})
      .filter(([, completedAt]) => completedAt && completedAt >= weekStart && completedAt <= date)
      .map(([planId]) => planId)
  );
  const bestDay = standardsWeek
    .filter((entry) => Number(entry.total) > 0)
    .sort((first, second) => Number(second.percent) - Number(first.percent))[0];
  const readinessAverage = readinessWeek.length
    ? Math.round(readinessWeek.reduce((total, entry) => total + Number(entry.score || 0), 0) / readinessWeek.length)
    : 0;

  return {
    productivityAverage: averagePercent(standardsWeek),
    readinessAverage,
    journalCount: journalWeek.length,
    pointsEarned: pointsWeek.reduce((total, entry) => total + Number(entry.points || 0), 0),
    plansCompleted: completedPlanIds.size,
    activeDays: standardsWeek.length,
    bestDay: bestDay?.date || ''
  };
}

function parentCurrentPlanSummary(plans, planProgress, date = todayKey()) {
  const library = buildPlanLibrary(sequencedPlanAccess(plans, planProgress, date));
  const activeSeries = library.find((series) => series.plans.some((plan) => plan.unlocked && !plan.completedAt))
    ?? library.find((series) => series.openCount > 0)
    ?? library[0]
    ?? null;
  const activeLesson = activeSeries?.plans.find((plan) => plan.unlocked && !plan.completedAt)
    ?? activeSeries?.plans.find((plan) => plan.unlocked)
    ?? activeSeries?.plans[0]
    ?? null;

  if (!activeSeries || !activeLesson) {
    return {
      seriesTitle: 'No plan started',
      lessonTitle: 'Open a plan with your athlete',
      dayLabel: 'Ready',
      completedCount: 0,
      totalCount: 0,
      nextUnlock: '',
      cue: 'Choose one plan together and make the first lesson easy to start.'
    };
  }

  const completedCount = activeSeries.completedCount;
  const totalCount = activeSeries.plans.length;
  const nextLocked = activeSeries.plans.find((plan) => !plan.unlocked && !plan.completedAt);
  return {
    seriesTitle: activeSeries.title,
    lessonTitle: activeLesson.title,
    dayLabel: activeLesson.completedAt ? 'Completed' : activeLesson.challengeDay || 'Current lesson',
    completedCount,
    totalCount,
    nextUnlock: nextLocked?.unlockDate || '',
    cue: `Ask what stood out from ${activeLesson.challengeDay || 'this lesson'} and where they can apply it today.`
  };
}

function parentProgressTone(snapshot, streakCount) {
  if (streakCount >= 7) return 'Strong rhythm. Celebrate the consistency and keep the pressure low.';
  if (snapshot.productivityAverage >= 80) return 'The daily work is trending well. Reinforce the habits behind it.';
  if (snapshot.activeDays >= 3) return 'They are showing up. Help them tighten one controllable this week.';
  return 'Start simple. One calm check-in can help them rebuild rhythm.';
}

function linkedAthleteName(summary, athleteProfile) {
  return summary?.full_name || athleteProfile?.name || 'Linked athlete';
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

function createParentGuideSeeds() {
  const releaseDate = todayKey();
  return [
    {
      id: 'home-court-advantage-seed',
      seriesTitle: 'Home Court Advantage',
      title: 'The Safe Place',
      category: 'Home Support',
      subject: 'A parent guide for creating the home environment young athletes need after pressure, failure, and growth moments.',
      releaseDate,
      guideDay: '3-Day Plan',
      guideLength: 3,
      steps: [
        `Day 1: The Safe Place

Story

Every athlete needs a place where the scoreboard stops following them. Home should be the place where they can breathe, recover, and remember they are loved before they are evaluated.

Deeper Look

Young athletes already receive feedback from coaches, teammates, opponents, rankings, stats, and social media. If home becomes one more performance review, they rarely get the emotional space needed to grow.

The Living Room

Ask yourself what your athlete feels when they walk through the door after a hard game. Do they feel analyzed, corrected, rescued, or received?

This Week at Home

Give your athlete a calm landing place after competition. Start with food, rest, presence, and one simple question before advice.

Today's Challenge

Ask, "What do you need from me tonight: space, encouragement, or help thinking it through?"

Key Takeaway

Home court advantage begins when your athlete knows home is a safe place to be loved, rebuilt, and reminded who they are.`
      ]
    },
    {
      id: 'pressure-isnt-the-enemy-3-day-plan',
      seriesTitle: "Pressure Isn't the Enemy",
      title: 'A 3-Day Parent Plan',
      category: 'Parent Support',
      subject: 'A three-day parent plan for helping athletes see pressure as preparation, growth, and opportunity instead of something to fear.',
      releaseDate,
      guideDay: '3-Day Plan',
      guideLength: 3,
      steps: [
        `Day 1: Pressure Reveals What Preparation Built

Story

Before anyone earns the right to call themselves a Navy SEAL, they must first survive one of the most demanding training environments in the world.

The goal is not simply to make them stronger. It is to discover what remains when they are tired, cold, hungry, frustrated, and unsure how much longer they can continue.

During training, candidates are placed in situations designed to create pressure. They operate on little sleep. They carry heavy equipment. They run through freezing water. They complete difficult tasks while their bodies and minds are exhausted.

The instructors are not only watching how fast they move. They are watching how they respond.

Do they panic? Do they blame someone else? Do they lose focus? Do they stop communicating? Do they abandon the team?

Pressure reveals answers that comfort never could.

A candidate may look disciplined when rested, confident when everything is going well, and focused when the instructions are easy. But when exhaustion sets in and the plan begins to fall apart, training exposes whether those qualities are truly part of them.

The pressure does not suddenly create their habits. It reveals the habits they built before the moment arrived.

That is why SEALs do not wait until the mission begins to learn how to stay calm. They practice under stress. They rehearse communication under stress. They make decisions under stress. They train their minds and bodies to recognize pressure without being controlled by it.

Because when the real moment arrives, there may not be time to become prepared. There is only time to reveal what preparation already built.

Deeper Look

Most parents do not enjoy watching their children struggle. We want to help, fix it, protect them, and make the moment easier.

That instinct comes from love.

But sometimes, in trying to protect our athletes from pressure, we accidentally protect them from growth.

Pressure is not always a warning that something is wrong. Sometimes it is proof that something important is being developed.

A close game creates pressure. Trying out for a team creates pressure. Batting with two outs creates pressure. Competing against stronger athletes creates pressure. Returning after a mistake creates pressure.

Those moments are uncomfortable. But they are also classrooms.

Your athlete cannot learn how to stay composed under pressure if every pressure-filled situation is removed. They cannot learn how to recover from disappointment if every disappointment is immediately fixed. They cannot develop confidence in difficult moments if they are never trusted to walk through one.

The goal is not to throw children into situations they are not ready for. The goal is to stop treating every uncomfortable moment like an emergency.

Pressure reveals what has already been practiced.

If your child has practiced blaming others, pressure will reveal blame. If they have practiced giving up, pressure will reveal quitting. If they have practiced breathing, resetting, communicating, and focusing on the next play, pressure will reveal those habits too.

That means the most important work usually happens before the pressure arrives: at home, at practice, in ordinary conversations, and during small disappointments.

That is where resilience is trained. That is where emotional control is rehearsed. That is where confidence becomes more than a feeling.

Parents often ask, "How do I help my child perform better under pressure?"

The answer usually is not removing pressure. It is helping them prepare for it.

Teach them how to breathe. How to slow the moment down. How to focus on what they can control. How to respond after a mistake. How to speak to themselves when fear shows up.

Pressure is not the enemy. Being unprepared for pressure is.

The Living Room

Take a few moments to reflect honestly.

1. When my child feels pressure, is my first instinct to prepare them or rescue them?
2. Have I ever treated a difficult sports moment like a crisis instead of a learning opportunity?
3. What habits does my athlete currently reveal when things become uncomfortable?
4. Am I helping my child practice emotional control before high-pressure moments arrive?
5. What pressure-filled situation might my child be ready to handle with support instead of rescue?

This Week at Home

This week, teach your athlete a simple pressure routine.

Keep it short enough that they can remember it during competition.

Use these three steps:

1. Breathe

Take one slow breath. Pressure speeds everything up. Breathing helps the mind slow back down.

2. Name What You Control

Ask, "What can I control right now?"

Their effort. Their attitude. Their preparation. Their communication. The next play.

3. Reset

Give them one short phrase to use: "Next play." "I'm ready." "One moment at a time." "Trust my work."

Practice this routine at home when the pressure is low. Use it during homework frustration, during a difficult drill, after a mistake, or before a competition.

The goal is for the routine to become familiar enough that your athlete can access it when emotions rise.

Today's Challenge

Think of one recent moment when your athlete felt pressure. Maybe they struck out, missed an important shot, made an error, lost a starting position, or struggled during a tryout.

Instead of discussing what they did wrong, ask, "What did that moment reveal about what we need to practice?"

Then choose one response skill to work on together. Not a physical skill. A mental response.

Breathing. Resetting. Staying positive. Communicating. Recovering after a mistake.

Let your athlete know: "I'm not disappointed that you felt pressure. Pressure is part of competing. We're going to learn how to handle it together."

That sentence changes the moment. Pressure stops feeling like proof that they are not ready. It becomes an invitation to keep preparing.

Key Takeaway

Pressure does not magically create character, confidence, or composure. It reveals what has already been practiced. Elite parents do not spend all their energy removing pressure. They help their athletes build the habits needed to face it.`,
        `Day 2: Pressure Produces Strength

Story

Deep beneath the surface of the earth, something extraordinary happens.

Carbon.

One of the most common elements on the planet. Soft. Ordinary. Unremarkable.

Yet under the right conditions, carbon begins a remarkable transformation.

Not because life becomes easier. But because it becomes harder.

Miles beneath the earth's surface, immense pressure presses against it. Temperatures rise beyond what most materials can withstand.

The process is not quick. It does not happen overnight. For years, sometimes millions of years, that ordinary carbon remains hidden, enduring pressure no one can see.

Then, over time, something incredible emerges.

A diamond.

One of the strongest and most valuable natural substances on Earth.

What changed?

The pressure.

Not because pressure magically made it valuable. But because pressure transformed what was already inside.

Without that pressure, the diamond never becomes a diamond. It remains ordinary carbon.

The very thing that seemed unbearable became the reason it was extraordinary.

Deeper Look

As parents, we naturally want to make life easier for our children. When they struggle, we want to step in. When they hurt, we want to protect them. When pressure begins to build, we often feel responsible for making it disappear.

But what if some pressure is not working against your athlete?

What if it is working for them?

Pressure exposes things comfort never can. It reveals where confidence is fragile, where preparation is lacking, where emotions still need maturity, and where focus begins to drift.

Those discoveries are not failures. They are opportunities.

Think about how athletes improve.

A basketball player does not become a better free-throw shooter by only practicing when nobody is watching. A quarterback does not learn composure by never facing a pass rush. A hitter does not develop confidence by only swinging when there is no count, no runners, and no consequences.

Growth happens when athletes are stretched just beyond what feels comfortable.

Pressure becomes the classroom.

That is why elite parents do not panic every time their child feels nervous. They do not immediately rescue them from every uncomfortable moment.

Instead, they ask a different question: "What is this moment trying to teach?"

Maybe it is resilience. Maybe it is patience. Maybe it is emotional control. Maybe it is preparation. Maybe it is trust.

The lesson is not found by avoiding pressure. It is found by walking through it.

Parents often believe confidence comes first, then children become brave.

The opposite is usually true.

Children become confident because they have survived moments they once thought they could not.

Every difficult game, every failed tryout, every tough inning, every missed shot, and every setback successfully navigated whispers something powerful:

"I made it through that."

That is how confidence is built. Not by avoiding pressure, but by discovering they are stronger than they imagined.

The Living Room

Take a few moments to reflect.

1. When my child feels pressure, do I immediately try to remove it?
2. Have I ever prevented growth by rescuing too quickly?
3. What lesson might my athlete be learning through their current challenge?
4. Do I see pressure as something harmful or something that can develop strength?
5. How can I support my child without taking away the opportunity to grow?

This Week at Home

The next time your athlete says, "I'm nervous," do not immediately respond with, "Don't be nervous."

Instead, say, "That's okay. Pressure means you're doing something that matters."

Then ask, "What can this moment teach you?"

Help your athlete stop viewing pressure as a signal to retreat. Help them see it as an invitation to grow.

Over time, they will stop fearing difficult moments. They will begin expecting them because they will know something valuable is being built every time they face one.

Today's Challenge

Think about one pressure-filled moment your athlete is currently facing: a new team, a tryout, a championship, a batting slump, more playing time, or less playing time.

Instead of asking, "How do we get out of this?"

Ask, "Who could my child become because of this?"

That one question shifts your focus from escaping pressure to embracing its purpose.

Then tell your athlete, "I know this feels hard. But I also know hard things grow strong people."

Sometimes the greatest gift a parent can give is not removing the weight. It is reminding their child they are strong enough to carry it.

Key Takeaway

Pressure does not exist to crush your athlete. It exists to reveal, refine, and strengthen them. Elite parents do not see pressure as the enemy. They see it as one of life's greatest teachers, preparing their children for challenges both in sports and beyond.`,
        `Day 3: Great Athletes Don't Avoid Pressure - They Embrace It

Story

Game 6. 1998 NBA Finals. Chicago Bulls vs. Utah Jazz.

Less than a minute remained. The Bulls trailed by three. Everything rested on the shoulders of one player.

Michael Jordan.

He drove to the basket for a quick layup.

One-point game.

On the next possession, Jordan stripped Karl Malone of the basketball. Now the Bulls had one final chance.

No timeout. No drawn-up play. Just one possession.

The entire basketball world knew who was going to take the shot.

Utah knew. The fans knew. His teammates knew. Michael Jordan knew.

With the clock winding down, Jordan dribbled to his right, crossed back to his left, created just enough space, rose into his jump shot.

Nothing but net.

The Bulls took the lead. Seconds later, the buzzer sounded. Chicago had won its sixth NBA championship.

People remember the shot. But what they often overlook is what happened afterward.

When reporters asked Jordan about moments like these, he never talked about enjoying pressure because he was fearless. He talked about preparation, about thousands of shots taken when no one was watching, and about trusting the work he had already put in.

Pressure did not suddenly make Michael Jordan great. Pressure simply gave him an opportunity to reveal what years of preparation had already built.

While many athletes hoped pressure would disappear, Jordan learned to welcome it.

Because pressure gave preparation a chance to shine.

Deeper Look

One of the greatest gifts we can give our children is changing the way they think about pressure.

Many young athletes believe pressure is something to fear, something to survive, something to avoid.

But elite athletes eventually discover something different.

Pressure is not a punishment. It is a privilege.

Only athletes who put themselves in meaningful situations experience meaningful pressure.

Championship games create pressure. The final inning creates pressure. The game-winning free throw creates pressure. Tryouts create pressure. Big opportunities create pressure.

Pressure usually means your child is standing in a moment they have worked hard to reach.

The goal is not to eliminate those moments. The goal is to prepare them to embrace them.

As parents, we unintentionally create fear when we treat pressure like it is dangerous.

We say things like, "Don't mess up." "This is a big one." "Everyone's watching."

Without realizing it, we are adding weight instead of removing it.

Elite parents speak differently.

They remind their athletes: "This is why you prepared." "Trust your training." "Compete one play at a time." "You don't have to be perfect. You just have to be present."

Pressure is simply an invitation to trust what has already been built.

Children who learn this lesson early do not just become better athletes. They become adults who are not intimidated by difficult conversations, big presentations, leadership opportunities, or life's unexpected challenges.

Because they learned something through sports.

Pressure is not something to run from. It is something to rise through.

The Living Room

Reflect honestly.

1. What message do I unintentionally send my child about pressure?
2. Do I make big moments feel bigger than they need to be?
3. What phrases do I use before games that either calm my athlete or increase anxiety?
4. How can I help my child view pressure as an opportunity instead of a threat?

This Week at Home

This week, replace pressure language with preparation language.

Instead of saying, "This is a huge game," say, "You've prepared for this."

Instead of, "Don't strike out," say, "Compete one pitch at a time."

Instead of, "Don't let everyone down," say, "Trust your work."

The goal is to remind your athlete that pressure does not determine success. Preparation does.

Over time, they will stop associating pressure with fear. They will begin associating it with opportunity.

Today's Challenge

Before your athlete's next competition, ask them one question: "What have you done to prepare for this moment?"

Let them answer.

Help them remember the practices, the repetitions, the early mornings, and the extra work.

Then finish with one sentence:

"Pressure doesn't change who you are. It simply gives you the opportunity to show who you've been becoming."

Walk into the game with peace instead of panic, confidence instead of fear, and trust instead of tension.

Key Takeaway

Pressure is not the enemy of great athletes. It is often the stage where preparation, resilience, and confidence are revealed. Elite parents do not teach their children to avoid pressure. They teach them to welcome it as an opportunity to trust the work they have already done.

Closing the Plan

As parents, one of the greatest temptations is to protect our children from anything uncomfortable. We want to remove disappointment, eliminate failure, and shield them from pressure.

But a life without pressure does not prepare a child for the real world. It prepares them for a world that does not exist.

Over these last three days, we have discovered a different perspective.

Pressure does not create character overnight. It reveals what has already been practiced.

Pressure is not meant to crush your athlete. It strengthens them, refines them, and teaches lessons comfort never could.

And pressure is not something to fear. It is often a sign that your child has stepped into a meaningful opportunity.

One day, your athlete will leave the playing field. But pressure will not leave their life.

There will be job interviews. College exams. Business presentations. Marriage. Parenthood. Leadership. Financial decisions. Moments where everything seems to be on the line.

Sports are simply preparing them for those moments.

Every difficult inning, every missed shot, and every tough conversation after a loss is helping develop a person who knows how to stay steady when life becomes difficult.

That is why your role is not to remove every obstacle. It is to walk beside them until they learn they can overcome it.

Because children who learn to handle pressure do not just become better athletes. They become stronger adults. And that is the greatest victory of all.

Complete Athlete Parenting Principle

Do not pray for a life with less pressure for your athlete. Help them become the kind of person who can carry greater pressure with greater confidence. That is where resilience is built, character is formed, and greatness begins.`
      ]
    },
    {
      id: 'raising-complete-athlete-seed',
      seriesTitle: 'Raising a Complete Athlete',
      title: 'A 3-Day Parent Plan',
      category: 'Parent Support',
      subject: 'A three-day parent plan for building the person, mind, and heart behind the athlete.',
      releaseDate,
      guideDay: '3-Day Plan',
      guideLength: 3,
      steps: [
        `Day 1: Build the Person

Story

The athlete your child is becoming matters, but the person they are becoming matters more. Sports can shape discipline, humility, courage, patience, and leadership when parents keep the bigger picture in view.

Deeper Look

It is easy to make the game the whole story. Complete Athlete parenting keeps character at the center, especially when the performance is loud.

The Living Room

What character trait is sports developing in your child right now? What trait is being tested?

This Week at Home

Praise one character choice before you discuss one performance detail.

Today's Challenge

Tell your athlete one trait you see growing in them because of sports.

Key Takeaway

The goal is not just a better athlete. The goal is a stronger person.`,
        `Day 2: Build the Mind

Story

Confidence is not built by pretending pressure is easy. It is built by helping your athlete learn how to think when pressure shows up.

Deeper Look

Your words become part of your athlete's inner voice. Calm, clear, growth-minded language at home gives them a better script when the game gets hard.

The Living Room

What does your athlete hear most from you after mistakes?

This Week at Home

Replace outcome language with process language: effort, response, preparation, focus, and next-play thinking.

Today's Challenge

Ask, "What did you learn about how you respond?"

Key Takeaway

The mind grows when the home conversation points toward learning instead of fear.`,
        `Day 3: Build the Heart

Story

The heart of an athlete is shaped in ordinary moments: how they treat people, how they handle disappointment, and how they carry success.

Deeper Look

Parents help guard the heart by keeping identity bigger than performance and purpose bigger than attention.

The Living Room

Where does your athlete need more peace, gratitude, or perspective right now?

This Week at Home

Create one moment this week that has nothing to do with sports and everything to do with connection.

Today's Challenge

Tell your athlete, "I love watching you grow, not just watching you play."

Key Takeaway

A complete athlete has more than skill. They have character, mindset, and a grounded heart.`
      ]
    },
    {
      id: 'comparison-trap-3-day-plan',
      seriesTitle: 'The Comparison Trap',
      title: 'A 3-Day Parent Plan',
      category: 'Parent Support',
      subject: 'A three-day parent plan for helping your athlete stop wearing someone else\'s armor, trust their own season, and develop the gifts God placed in them.',
      releaseDate,
      guideDay: '3-Day Plan',
      guideLength: 3,
      steps: [
        `Day 1: Don't Wear Someone Else's Armor

Story

When David arrived in the Valley of Elah, he was not dressed like a soldier. He was a young shepherd bringing food to his brothers when he heard Goliath mocking the armies of God.

David volunteered to fight, and Saul tried to help by placing his own armor on him. From the outside, David finally looked like a warrior. But the armor was too heavy, too unfamiliar, and too unnatural.

David took it off. He picked up the weapons he knew: his staff, his sling, and five smooth stones.

The crowd saw a boy with no armor. God saw a young man who finally looked like himself.

Deeper Look

This story is not only about armor. It is about identity.

Parents often do what Saul did with good intentions. We see another athlete thriving, so we wonder if our child should train like them, compete like them, join the same team, hire the same coach, or take the same path.

Before long, we can start placing someone else's armor on our own child.

Comparison whispers, "Why isn't my child there yet?" "Should we be doing what they are doing?" "Are we falling behind?"

But God has never created two athletes with the exact same journey. Some mature early. Some develop later. Some rely on size. Others rely on skill. Different gifts. Different paths. Different assignments.

Your child does not need to become the best version of someone else. They need the freedom to become the best version of themselves.

The Living Room

Take a few moments to honestly reflect.

1. Have I compared my child's journey to another athlete's journey?
2. Am I unintentionally placing someone else's armor on my child?
3. Do my conversations communicate trust in my child's journey or anxiety about keeping up?
4. What unique strengths might I be overlooking because I am focused on someone else's gifts?

This Week at Home

Shift your focus from what another athlete is doing to what your own child is becoming.

Notice the small improvements. Celebrate quiet victories. Point out their unique gifts: coachability, resilience, encouragement, effort, leadership, or the way they respond after mistakes.

Each evening, tell your athlete one thing you noticed about their growth compared to who they were yesterday.

Today's Challenge

Before the next game or practice, make one commitment: do not compare your child to another athlete in your mind, your words, or your conversations with other parents.

Afterward, ask your athlete, "What's one thing you're getting better at that has nothing to do with the scoreboard?"

Key Takeaway

Comparison places someone else's armor on your child. Elite parents have the courage to take the armor off, trust God's design, and help their athlete become who they were created to be.`,
        `Day 2: Different Seeds. Different Seasons.

Story

An oak tree and Chinese bamboo grow in completely different ways.

The oak grows slowly and steadily, season after season. The bamboo can appear inactive for years while the person who planted it keeps watering. Then, after its root system is ready, it can shoot upward dramatically.

Neither tree is wrong. Neither tree is behind. Neither tree is trying to become the other.

They grow according to their design.

Deeper Look

One of the greatest mistakes parents make is assuming every athlete should develop on the same timeline.

Another child gets stronger, makes the all-star team, earns more playing time, or grows before everyone else. Suddenly comparison asks, "Are we behind?"

But what you see on the surface is only part of the story.

Some athletes mature physically at ten. Others at sixteen. Some gain confidence early. Others develop it after years of failure. Some shine in youth sports. Others do not discover their stride until later.

God has never promised identical timelines. He has promised faithful growth.

Not every season produces visible fruit. Some seasons produce roots: character, resilience, faith, coachability, patience, and confidence.

The Living Room

Take a few moments to reflect.

1. Have I mistaken slow growth for no growth?
2. Do I become discouraged when another child develops faster than mine?
3. Am I celebrating invisible growth or only visible success?
4. What roots might God be developing in my child during this season?

This Week at Home

Create a simple growth journal.

Each evening, write down one way your child grew personally, not statistically. Maybe they bounced back after a mistake, encouraged a teammate, stayed positive after sitting, or worked harder than last week.

At the end of the week, read the list together. You may discover growth was happening all along.

Today's Challenge

The next time you compare your child to another athlete, pause and ask, "Am I looking at their fruit while forgetting my child's roots?"

Then thank God for one area where your child is growing, even if no one else sees it yet.

Key Takeaway

Comparison becomes dangerous when we expect every athlete to grow on the same timeline. Some seasons produce fruit. Others produce roots. Both are essential, and neither should be rushed.`,
        `Day 3: Be Faithful to Your Child's Gifts

Story

Shohei Ohtani grew into one of Japan's brightest baseball players with two extraordinary gifts. He could pitch at an elite level, and he could hit at an elite level.

Many people believed he needed to choose one. Baseball had an unwritten rule: be a pitcher or be a hitter, but do not try to be both.

Shohei did not allow someone else's expectations to become the blueprint for his life. He kept developing the gifts he had been given.

He became something baseball had not seen in generations, not because he copied someone else's path, but because he stayed faithful to his own.

Deeper Look

Comparison often begins with good intentions. We see another athlete succeeding, another family making different decisions, or another child receiving attention, and we wonder if we should do what they are doing.

Sometimes that is wisdom. More often, it is fear: fear of falling behind, missing an opportunity, or taking a path that looks different.

The moment comparison becomes your compass, you stop asking what is best for your child and start chasing what seems to be working for someone else.

Your responsibility is not to help your child become the next great athlete everyone is talking about. Your responsibility is to help them become the fullest version of who God created them to be.

The Living Room

Take a few moments to reflect.

1. Have I tried to shape my child into the athlete I admire instead of the athlete they were created to become?
2. What unique gifts has God placed in my child?
3. Do my expectations reflect my child's strengths or someone else's success?
4. Am I helping my child discover who they are, or encouraging them to imitate someone else?

This Week at Home

Talk with your athlete about what makes them unique.

Write down five qualities that are truly theirs: leadership, resilience, calm under pressure, encouragement, joy, coachability, toughness, humility, or love for the game.

Then tell them, "God didn't create you to become someone else. He created you to faithfully develop the gifts He's already placed inside you."

Today's Challenge

Replace comparison with celebration.

When another athlete succeeds, celebrate them. Then immediately find one unique gift in your own child to celebrate as well.

Teach your athlete that someone else's success does not diminish their own potential.

Key Takeaway

Comparison asks your child to become the next great athlete. Elite parents help their child become the first and only version of themselves.

Complete Athlete Parenting Principle

Comparison distracts you from your assignment. Elite parents keep their eyes on the child God entrusted to them, trusting that His plan, His timing, and His purpose are enough.`
      ]
    },
    {
      id: 'borrowed-confidence-3-day-plan',
      seriesTitle: 'Borrowed Confidence',
      title: 'A 3-Day Parent Plan',
      category: 'Parent Support',
      subject: 'A three-day parent plan for helping your athlete borrow your words, calm, and belief until they learn to carry confidence for themselves.',
      releaseDate,
      guideDay: '3-Day Plan',
      guideLength: 3,
      steps: [
        `Day 1: Your Words Become Their Inner Voice

Story

Long before Tiger Woods became one of the greatest golfers in history, he was a little boy following his dad around the course.

People often point to Tiger's work ethic, talent, and competitive drive. Those things mattered. But another theme shows up again and again: Earl Woods believed in him long before the world did.

Earl was not only teaching Tiger how to swing. He was teaching him how to think.

He spoke confidence before confidence had fully grown. He reminded Tiger what he was capable of becoming. Eventually, his father's voice became part of Tiger's own.

Deeper Look

Every athlete has an inner voice.

It speaks before the at-bat, free throw, pitch, race, tryout, and big moment. Sometimes it says, "I've got this." Other times it whispers, "Don't mess this up."

That inner voice does not appear out of nowhere. Long before children know how to speak to themselves, they borrow the voices of the people they trust most.

They borrow ours.

The way we respond after mistakes, talk about challenges, celebrate effort, and describe them slowly becomes the soundtrack in their minds.

One day your athlete will step onto a field, court, or into a locker room without you. When that moment comes, what voice will they hear?

The Living Room

Take a few moments to reflect.

1. If my child repeated my words to themselves before competition, would those words build confidence or create pressure?
2. What phrases do I say most often after mistakes?
3. When my athlete thinks about my voice, do they hear encouragement or evaluation first?
4. What kind of inner voice am I helping build?

This Week at Home

Choose one encouraging phrase and repeat it consistently, especially after struggle.

Try: "I believe in you." "One play never defines you." "Keep competing." "You're growing." "Mistakes help us learn."

Children do not need a new message every day. They need the right message repeated until it becomes part of them.

Today's Challenge

Tonight, tell your athlete something you believe about them that they may not believe yet.

Be specific: "I believe you're becoming a leader." "I believe you're stronger than you realize." "I believe your best days are ahead of you."

Key Takeaway

Before children develop confidence of their own, they borrow yours. The words you speak today become the voice they carry into tomorrow.

Complete Athlete Parenting Principle

Every conversation is shaping your athlete's inner voice. Make sure the voice they carry into competition sounds like belief, not fear.`,
        `Day 2: Your Reactions Become Their Emotional Blueprint

Story

Cal Ripken Jr. is remembered for playing 2,632 consecutive Major League Baseball games.

People talk about his toughness, consistency, and discipline. But those traits were shaped long before the streak became famous.

His father, Cal Ripken Sr., taught the game with steadiness. Whether practice went well or poorly, whether a player succeeded or failed, he stayed remarkably composed.

He corrected mistakes without humiliation. He did not ride every emotional high or explode after every failure.

Cal Jr. grew up watching his father respond to pressure with composure. Years later, people saw those lessons in the way Cal Jr. handled slumps, pressure, criticism, and the grind of the season.

Deeper Look

Every parent teaches emotional control. The question is: what are we teaching?

When an umpire misses a call, your athlete is watching. When they strike out with the bases loaded, they are watching. When playing time disappoints you, they are watching.

Your reaction becomes their lesson.

If we panic, they learn mistakes are emergencies. If we become angry, they learn failure is something to fear. If we blame others, they learn responsibility belongs somewhere else.

But when we stay calm, ask better questions, and remind them one game does not define them, we create emotional safety.

Children borrow emotional stability before they develop their own.

The Living Room

Take a few moments to reflect.

1. How would my child describe my emotions during their games?
2. What do they usually see after a mistake: calm or frustration?
3. Have I made one bad performance feel bigger than it really was?
4. If my child handled adversity the way I do, would I be proud?

This Week at Home

Before every game, ask yourself, "What emotional environment do I want to create today?"

Choose one word: calm, patient, encouraging, steady, or present.

Then let that word guide your tone, face, posture, and car ride.

Today's Challenge

After the next game, do not talk about performance for the first ten minutes.

Smile. Give them a hug. Tell them you are glad you got to watch them play. Ask if they had fun.

Let the ride home become a place of peace instead of pressure.

Key Takeaway

Children borrow emotional stability before they develop their own. Your reactions teach your athlete whether mistakes are something to fear or opportunities to grow.

Complete Athlete Parenting Principle

Your athlete will not always remember what you said after the game. They will remember how you made them feel. Become the calm they can borrow.`,
        `Day 3: Your Expectations Become Their Identity

Story

When A'ja Wilson arrived at the University of South Carolina, everyone knew she was talented. The expectations were enormous.

Then she met Dawn Staley.

Coach Staley did not lower the standard because A'ja was young. She challenged her, corrected her, pushed her, and expected more from her than she expected from herself.

But A'ja never questioned one thing: Coach Staley believed in her.

The standards were high, and so was the belief.

That combination helped A'ja become an NCAA champion, Olympic gold medalist, WNBA champion, MVP, and one of the greatest players in women's basketball.

Deeper Look

One misconception about confidence is that it comes from constant praise.

It does not.

Real confidence is built when high expectations are matched with unwavering belief.

Children need to know two truths at the same time: "I expect a lot from you" and "my love for you never depends on whether you meet those expectations."

Some parents become so performance-focused that every mistake feels like disappointment. Others become so afraid of hurting confidence that they stop challenging their child.

Neither produces lasting confidence.

Confidence grows when children experience love and challenge together.

The Living Room

Reflect honestly.

1. Do my expectations inspire my child or intimidate them?
2. Does my athlete know I believe in them even when they fall short?
3. Am I correcting behavior without attacking identity?
4. If my child described my expectations, would they also describe my encouragement?

This Week at Home

Pair every correction with belief.

Instead of, "That wasn't good enough," try, "I know what you're capable of, and that's why I'm challenging you."

Instead of, "You have to stop making that mistake," try, "I know you're capable of more, and I'll help you get there."

Make sure your athlete knows they never have to earn your love. They simply have the opportunity to keep growing.

Today's Challenge

Tell your athlete these two sentences:

"I will always love you exactly the same."

"And because I believe in you, I'll never stop helping you grow."

One creates security. The other creates growth. Together, they create confidence.

Key Takeaway

Borrowed confidence is created when children know they are deeply loved while being consistently challenged to become everything they are capable of becoming.

Complete Athlete Parenting Principle

Your voice is only borrowed for a season. Speak so much life into your child that one day, when you are no longer beside them, they continue saying to themselves what you taught them to believe.`
      ]
    },
    {
      id: 'elite-parents-3-day-plan',
      seriesTitle: 'Elite Athletes Need Elite Parents',
      title: 'A 3-Day Framework for Elite Parents',
      category: 'Parent Support',
      subject: 'A three-day parent plan for leading your athlete with vision, environment, and example instead of pressure, panic, or short-term results.',
      releaseDate,
      guideDay: '3-Day Plan',
      guideLength: 3,
      steps: [
        `Day 1: Elite Parents Have a Vision

Story

Long before Venus and Serena Williams became household names, there was a father with a vision. Richard Williams was not standing in the winner's circle. He was not holding championship trophies. He was simply a father who believed his daughters were capable of something extraordinary.

Most parents dream. Richard planned.

That vision shaped where his daughters practiced, how they trained, who influenced them, and what they did not do. When people urged him to chase more tournaments and more attention, he chose development over exposure. Growth over recognition. Purpose over popularity.

He was not parenting for the next weekend. He was parenting for the next twenty years.

Deeper Look

One of the greatest gifts you can give your child is not a private trainer, the best travel team, or more exposure. It is a clear vision.

Without vision, every game feels like the biggest game. Every strikeout feels like a crisis. Every setback feels like failure. But when you have a vision, today's game becomes one page in a much bigger story.

Most parents ask, "How can I help my child become a better athlete?"

Elite parents ask a better question: "Who do I want my child to become because of sports?"

At The Complete Athlete, we believe sports are one of God's greatest classrooms. Discipline, resilience, humility, leadership, perseverance, and self-control are preparing our children for something much bigger than a scoreboard.

The Living Room

Take a few moments to think about these questions.

1. What is my vision for my child beyond sports?
2. If someone watched the way I parent at games, what would they believe my greatest priority is?
3. Am I making decisions based on short-term success or long-term development?
4. If my child never earned a scholarship or won a championship, would I still consider this journey a success?

This Week at Home

Take 15-20 minutes this week and write a vision statement for your athlete. Do not write about statistics, championships, or scholarships.

Instead, finish this sentence:

"When my child is 25 years old, I hope people describe them as..."

Fill the page with character traits: faithful, humble, confident, disciplined, resilient, compassionate, courageous.

Today's Challenge

Share your vision with your athlete. Not your vision for their career. Your vision for their life.

Then ask, "What kind of person do you hope sports helps you become?"

Key Takeaway

Elite parents do not allow today's results to define tomorrow's decisions. They lead with a vision bigger than trophies, rankings, or scholarships.`,
        `Day 2: Elite Parents Build the Environment

Story

Long before the world knew Susan, Sofia, and Judit Polgar, there was a father asking a question most parents never think to ask.

Can greatness be developed?

Laszlo Polgar believed the answer was yes. He and his wife, Klara, intentionally created a home where learning was celebrated, curiosity was encouraged, and excellence became normal.

Books filled the shelves. Chess boards were always within reach. Conversations challenged the girls' thinking. Practice was not forced. It became part of everyday life.

People later saw extraordinary talent. But behind every move was an extraordinary environment.

Deeper Look

Every home is teaching something. The question is: what is your home teaching?

Children learn how to respond to adversity by watching us. They learn how to speak to themselves by listening to us. They learn what matters most by observing what we celebrate.

Some homes celebrate effort. Others celebrate outcomes. Some homes embrace mistakes as opportunities to learn. Others quietly teach children to fear failure.

You do not build confidence on game day. You build it in the environment your child lives in every day.

The greatest advantage your athlete may ever have might simply be coming home to an environment that reminds them:

"You are loved."
"You are capable."
"You are growing."
"We value character more than trophies."
"We learn from failure."

The Living Room

Reflect on these questions with complete honesty.

1. If someone spent one week in our home, what would they say we value most?
2. Does our home create pressure or peace?
3. What words do my children hear most often from me?
4. If my child treated themselves the way I speak to them, would they become more confident or less?

This Week at Home

Choose one family value to strengthen this week. Maybe it is gratitude, effort, coachability, joy, discipline, faith, or encouragement.

Write it somewhere visible. Then intentionally point out every time you see your athlete living out that value.

The goal is not to catch them doing something wrong. It is to catch them becoming who they are capable of becoming.

Today's Challenge

As a family, answer this question together:

"What do we want our home to be known for?"

Write down three words and commit to protecting them before practices, games, and difficult seasons.

Key Takeaway

Elite athletes are shaped by healthy environments every single day. The culture of your home will influence your athlete long after they leave it.`,
        `Day 3: Elite Parents Lead by Example

Story

In 1997, Admiral William McRaven stood before a graduating class at the University of Texas and shared a lesson from Navy SEAL training.

It was about making your bed.

Every morning, instructors inspected the recruits' beds with incredible attention to detail. The sheets had to be tight. The corners had to be perfect. The pillow had to be centered.

To an outsider, it seemed ridiculous. But the bed was never the point. The habit was.

"If you want to change the world, start off by making your bed."

Not because beds change lives. Because habits do.

Deeper Look

Children learn far more from what they observe than from what they are told.

You can tell your child to be disciplined, but if they never see discipline, the lesson will not stick. You can tell them to respect coaches, but if they hear you criticize coaches every weekend, they will believe your actions more than your words.

Whether we realize it or not, we are constantly giving our children permission: permission to complain, persevere, blame, own mistakes, serve others, or quit when things get hard.

Our example becomes their expectation.

Elite parenting begins with a difficult question: who am I becoming?

The Living Room

Spend a few moments reflecting honestly.

1. What habits do I hope my child develops that I do not consistently model myself?
2. How do I respond when things do not go my way?
3. If my child handled adversity exactly the way I do, would I be proud?
4. What character quality do I need to strengthen before I expect it from my athlete?

This Week at Home

Choose one habit you want your athlete to develop. Maybe it is discipline, gratitude, self-control, kindness, faithfulness, or consistency.

Then ask a harder question:

"Have they seen me consistently live this?"

This week, do not just talk about that habit. Demonstrate it.

Today's Challenge

Tonight, ask your athlete:

"What's one thing you've learned from watching me?"

Then just listen. Do not defend, explain, or interrupt.

Finish by asking:

"What's one area where I can become a better parent for you?"

Key Takeaway

The greatest coaching your child will ever receive may come from the life they watch you live every single day. Before you ask your athlete to become elite, be willing to become the example they deserve.

Complete Athlete Parenting Principle

Elite athletes do not just need great coaching. They need parents whose lives reinforce the lessons the game is trying to teach.`
      ]
    }
  ];
}

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
  const [onboardingComplete, setOnboardingComplete] = useState(() => (
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('firstTime') === 'athlete'
      ? false
      : loadOnboardingComplete()
  ));
  const [athleteStartComplete, setAthleteStartComplete] = useState(() => (loadOnboardingComplete() ? true : loadAthleteStartComplete()));
  const [viewportRevision, setViewportRevision] = useState(0);
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 720px)').matches : false
  ));
  const [dailyDate, setDailyDate] = useState(initialDailyState.date);
  const [view, setView] = useState(() => (
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('role') === 'parent'
      ? 'parent'
      : 'athlete'
  ));
  const [tab, setTab] = useState('home');
  const [parentTab, setParentTab] = useState(() => (
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('role') === 'parent'
      ? 'parent-corner'
      : 'overview'
  ));
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
  const [notificationPreferences, setNotificationPreferences] = useState(loadNotificationPreferences);
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
  const [coachComposerFocused, setCoachComposerFocused] = useState(false);
  const [parentMessage, setParentMessage] = useState(parentMessageSeed);
  const [parentGuides, setParentGuides] = useState(() => mergeParentGuidesWithSeeds([]));
  const [parentAccessDraft, setParentAccessDraft] = useState('');
  const [parentLinkFeedback, setParentLinkFeedback] = useState('');
  const [athleteParentAccessDraft, setAthleteParentAccessDraft] = useState('');
  const [athleteParentLinkFeedback, setAthleteParentLinkFeedback] = useState('');
  const [parentLinkChecked, setParentLinkChecked] = useState(false);
  const [linkedAthleteId, setLinkedAthleteId] = useState(null);
  const [linkedAthleteSummary, setLinkedAthleteSummary] = useState(null);
  const [parentLinkRefreshKey, setParentLinkRefreshKey] = useState(0);
  const [premiumAccessRefreshKey, setPremiumAccessRefreshKey] = useState(0);
  const [privacySettings, setPrivacySettings] = useState(privacySeed);
  const [athleteProfile, setAthleteProfile] = useState(loadAthleteProfile);
  const [supabaseAthleteDataReady, setSupabaseAthleteDataReady] = useState(false);
  const [celebration, setCelebration] = useState('');
  const [lessonLibrary, setLessonLibrary] = useState(loadLessons);
  const [selectedLessonId, setSelectedLessonId] = useState(() => dailyLessonId(loadLessons(), todayKey()));
  const [subscription, setSubscription] = useState({
    configured: Boolean(revenueCatConfig.iosApiKey),
    native: canUseNativePurchases(),
    active: false,
    activeTrial: false,
    loading: Boolean(revenueCatConfig.iosApiKey),
    package: null,
    message: revenueCatConfig.iosApiKey ? 'Checking premium access...' : 'RevenueCat key is not set yet.'
  });
  const [trialPromptDismissed, setTrialPromptDismissed] = useState(false);
  const [localTrialAccessActive, setLocalTrialAccessActive] = useState(false);
  const [backendPremiumAccess, setBackendPremiumAccess] = useState({
    hasAccess: false,
    activeTrial: false,
    source: 'none',
    sponsorUserId: null,
    expiresAt: ''
  });

  const activeLesson = lessonLibrary.find((lesson) => lesson.id === selectedLessonId) ?? lessonLibrary[0];
  const localAthletePreviewSession = useMemo(() => {
    if (!import.meta.env.DEV || authSession || typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const athletePreview = params.get('firstTime') === 'athlete'
      || params.get('startPreview') === 'athlete'
      || params.get('todayPreview') === 'athlete';
    if (params.get('role') !== 'athlete' || !athletePreview) return null;
    return { id: 'local-athlete-preview', role: 'athlete', name: 'Preview Athlete', email: 'preview-athlete@example.com' };
  }, [authSession]);
  const localParentInviteSession = useMemo(() => {
    if (!import.meta.env.DEV || authSession || typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') !== 'parent' || params.get('parentCode') !== 'TCA-PARENT') return null;
    return { id: 'local-parent-review', role: 'parent', name: 'App Review Parent', email: 'review-parent@example.com', parentAccessCode: 'TCA-FAMILY' };
  }, [authSession]);
  const effectiveSession = authSession ?? localAthletePreviewSession ?? localParentInviteSession ?? (prototypeBypassLogin ? { id: 'demo-athlete', role: 'athlete', name: 'Demo Athlete', email: '' } : null);
  const isAuthed = Boolean(effectiveSession);
  const effectiveSubscription = {
    ...subscription,
    active: subscription.active || backendPremiumAccess.hasAccess,
    activeTrial: Boolean(subscription.activeTrial || backendPremiumAccess.activeTrial || localTrialAccessActive),
    accessSource: backendPremiumAccess.source,
    sponsorUserId: backendPremiumAccess.sponsorUserId,
    expirationDate: subscription.expirationDate || backendPremiumAccess.expiresAt,
    message: backendPremiumAccess.hasAccess
      ? backendPremiumAccess.source === 'parent'
        ? 'Premium access is covered by a linked parent account.'
        : 'Premium access is active.'
      : subscription.message
  };
  const premiumAccessAllowed = !effectiveSubscription.configured || effectiveSubscription.active;
  const planAccessAllowed = premiumAccessAllowed || effectiveSubscription.activeTrial;
  const standardsCompleted = standards.filter((item) => item.done).length;
  const submittedToday = lastSubmittedDate === dailyDate;
  const athleteOnboardingPreview = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('firstTime') === 'athlete';
  const athleteStartPreview = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('startPreview') === 'athlete';
  const athleteTodayPreview = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('todayPreview') === 'athlete';
  const trialGatePreview = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('trialPreview') === 'true';

  const completion = standards.length
    ? Math.round((standardsCompleted / standards.length) * 100)
    : 0;
  const confidenceAverage = Math.round(
    (scores.confidence + scores.energy + scores.mood + scores.belief) / 4
  );
  const athleteScore = pointsTotal(pointsLedger);
  const todayPoints = pointsToday(pointsLedger, dailyDate);
  const recentPointEvents = latestPointEvents(pointsLedger);
  const unreadNotifications = notifications.filter((notification) => !notification.read);

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
      const textEntryActive =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement?.isContentEditable;
      const keyboardLikelyOpen = textEntryActive && viewportHeight > 0 && window.innerHeight - viewportHeight > 120;
      setIsPhoneViewport(phoneViewport);
      setViewportRevision((current) => current + 1);
      document.documentElement.classList.toggle('keyboard-open', keyboardLikelyOpen);
      if (!keyboardLikelyOpen && viewportHeight > 0) {
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
    localStorage.setItem(notificationPrefsStorageKey, JSON.stringify(notificationPreferences));
  }, [notificationPreferences]);

  useEffect(() => {
    localStorage.setItem(athleteStartStorageKey, athleteStartComplete ? 'true' : 'false');
  }, [athleteStartComplete]);

  useEffect(() => {
    if (!isSupabaseConfigured || !authSession?.id || !notifications.length) return;

    supabase
      .from('app_notifications')
      .upsert(
        notifications.map((notification) => notificationToSupabase(notification, authSession.id)),
        { onConflict: 'id' }
      );
  }, [authSession?.id, notifications]);

  useEffect(() => {
    if (!isSupabaseConfigured || !authSession?.id) return;

    supabase
      .from('notification_preferences')
      .upsert(notificationPreferencesToSupabase(notificationPreferences, authSession.id), { onConflict: 'user_id' });
  }, [authSession?.id, notificationPreferences]);

  useEffect(() => {
    if (!isSupabaseConfigured || !authSession?.id) return;
    let cancelled = false;

    async function loadNotifications() {
      const [notificationsResult, preferencesResult] = await Promise.all([
        supabase
          .from('app_notifications')
          .select('id, notification_type, title, body, tone, read, created_at')
          .eq('user_id', authSession.id)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('notification_preferences')
          .select('daily_deposits, performance_plans, plan_unlocks, streaks, productivity, points, parent_updates, browser_push')
          .eq('user_id', authSession.id)
          .maybeSingle()
      ]);

      if (cancelled) return;
      if (!notificationsResult.error && Array.isArray(notificationsResult.data)) {
        setNotifications(notificationsResult.data.map(notificationFromSupabase));
      }
      if (!preferencesResult.error && preferencesResult.data) {
        setNotificationPreferences(notificationPreferencesFromSupabase(preferencesResult.data));
      }
    }

    loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [authSession?.id]);

  useEffect(() => {
    if (!authSession?.id || !isNativePushRuntime()) return undefined;
    let active = true;
    const listenerHandles = [];

    async function configureNativePush() {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const registration = await PushNotifications.addListener('registration', (token) => {
          if (active && token?.value) registerPushDeviceToken(token.value, 'ios');
        });
        const registrationError = await PushNotifications.addListener('registrationError', () => {
          setNotificationPreferences((current) => ({ ...current, browserPush: false }));
        });
        const received = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          if (!active) return;
          notifyUser(
            notification.title || 'The Complete Athlete',
            notification.body || 'You have a new update.',
            'info',
            {
              type: 'general',
              id: `native-push-${Date.now()}`
            }
          );
        });
        listenerHandles.push(registration, registrationError, received);

        const permission = await PushNotifications.checkPermissions();
        if (notificationPreferences.browserPush && permission.receive === 'granted') {
          await PushNotifications.register();
        }
      } catch {
        setNotificationPreferences((current) => ({ ...current, browserPush: false }));
      }
    }

    configureNativePush();

    return () => {
      active = false;
      listenerHandles.forEach((handle) => handle.remove());
    };
  }, [authSession?.id, notificationPreferences.browserPush]);

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
      const [lessonsResult, plansResult, parentMessageResult, parentGuidesResult] = await Promise.all([
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
          .maybeSingle(),
        supabase
          .from('parent_guides')
          .select('id, series_title, title, category, subject, steps, release_date, guide_day, guide_length, status')
          .eq('status', 'published')
          .lte('release_date', dailyDate)
          .order('release_date', { ascending: true })
      ]);

      if (cancelled) return;

      if (!lessonsResult.error && Array.isArray(lessonsResult.data) && lessonsResult.data.length) {
        const nextLessons = lessonsResult.data.map(lessonFromSupabase);
        setLessonLibrary(nextLessons);
        const nextLessonId = dailyLessonId(nextLessons, dailyDate);
        const nextLesson = nextLessons.find((lesson) => String(lesson.id) === String(nextLessonId));
        setSelectedLessonId(nextLessonId);
        if (nextLesson) {
          notifyUser('Daily Deposit', 'Today’s Daily Deposit is available.', 'info', {
            type: 'dailyDeposits',
            id: `daily-deposit-${dailyDate}-${nextLesson.id}`
          });
        }
      }

      if (!plansResult.error && Array.isArray(plansResult.data) && plansResult.data.length) {
        const nextPlans = mergeWithSeedPlans(plansResult.data.map(planFromSupabase));
        const releasedToday = nextPlans.find((plan) => plan.releaseDate === dailyDate);
        setPlans(nextPlans);
        if (releasedToday) {
          notifyUser('New performance plan available', `${planSeriesTitle(releasedToday)} is ready in Performance Plans.`, 'info', {
            type: 'performancePlans',
            id: `plan-release-${dailyDate}-${planSeriesTitle(releasedToday)}`
          });
        }
      }

      if (!parentMessageResult.error && parentMessageResult.data) {
        setParentMessage(parentMessageFromSupabase(parentMessageResult.data));
      }

      if (!parentGuidesResult.error && Array.isArray(parentGuidesResult.data)) {
        setParentGuides(mergeParentGuidesWithSeeds(parentGuidesResult.data.map(parentGuideFromSupabase)));
      }

    }

    loadSharedContent();

    return () => {
      cancelled = true;
    };
  }, [authSession?.id, authSession?.role, dailyDate]);

  useEffect(() => {
    setSelectedLessonId(dailyLessonId(lessonLibrary, dailyDate));
  }, [dailyDate, lessonLibrary]);

  useEffect(() => {
    if (localParentInviteSession) {
      setParentLinkChecked(true);
      setLinkedAthleteId('local-athlete-review');
      setLinkedAthleteSummary({ full_name: 'App Review Athlete' });
      return;
    }

    if (!isSupabaseConfigured || authSession?.role !== 'parent') {
      setParentLinkChecked(false);
      setLinkedAthleteId(null);
      setLinkedAthleteSummary(null);
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
        setLinkedAthleteSummary(null);
        setParentLinkChecked(true);
        return;
      }
      setLinkedAthleteId(athleteUserId);

      const [linkedAthletesResult, profileResult, goalsResult, standardsHistoryResult, readinessResult, journalResult, privacyResult, planProgressResult, pointsLedgerResult] = await Promise.all([
        supabase.rpc('parent_linked_athletes'),
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

      if (!linkedAthletesResult.error && Array.isArray(linkedAthletesResult.data)) {
        const linkedSummary = linkedAthletesResult.data.find((item) => item.athlete_user_id === athleteUserId) ?? linkedAthletesResult.data[0] ?? null;
        setLinkedAthleteSummary(linkedSummary);
      }

      if (!profileResult.error) {
        setAthleteProfile((current) => {
          const linkedSummary = !linkedAthletesResult.error && Array.isArray(linkedAthletesResult.data)
            ? linkedAthletesResult.data.find((item) => item.athlete_user_id === athleteUserId) ?? linkedAthletesResult.data[0]
            : null;
          return {
            ...profileFromSupabase(profileResult.data, current, current),
            name: linkedSummary?.full_name || current.name,
            sport: linkedSummary?.sport ?? profileResult.data?.sport ?? current.sport,
            age: linkedSummary?.age ?? profileResult.data?.age ?? current.age,
            location: linkedSummary?.location ?? profileResult.data?.location ?? current.location
          };
        });
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
  }, [authSession?.id, authSession?.role, localParentInviteSession, parentLinkRefreshKey]);

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

  async function signupUser({ role, name, email, password, parentCode, parentFamilyCode }) {
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
        if (role === 'athlete' && parentFamilyCode) {
          const { error: athleteLinkError } = await supabase.rpc('link_athlete_to_parent', { parent_code: parentFamilyCode.trim() });
          if (athleteLinkError) {
            return 'Account created, but the family access code could not be linked. Check the code with your parent.';
          }
        }

        let parentAccessCode = '';
        if (role === 'parent') {
          const { data: createdProfile } = await supabase
            .from('profiles')
            .select('parent_access_code')
            .eq('id', data.user.id)
            .maybeSingle();
          parentAccessCode = createdProfile?.parent_access_code ?? '';
        }

        const fullName = name.trim() || role;
        setAuthSession({ id: data.user.id, role, name: fullName, email: cleanEmail, parentAccessCode });
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
      password,
      parentAccessCode: role === 'parent' ? `TCA-${Math.random().toString(36).slice(2, 8).toUpperCase()}` : ''
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
        .select('id, role, full_name, parent_access_code')
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
        email: cleanEmail,
        parentAccessCode: profile.parent_access_code ?? ''
      });
      setView(role === 'parent' ? 'parent' : 'athlete');
      window.history.replaceState({}, '', window.location.pathname);
      return '';
    }

    const user = authUsers.find((account) => account.email === cleanEmail && account.password === password);
    if (!user) return 'No account found with that email and password.';
    if (user.role === 'admin') return 'Admin access has moved outside the athlete app.';
    if (user.role !== role) return `This account is registered as ${user.role}. Choose the correct portal.`;
    setAuthSession({ id: user.id, role: user.role, name: user.name, email: user.email, parentAccessCode: user.parentAccessCode ?? '' });
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
    setLinkedAthleteSummary(null);
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

  async function linkAthleteParentAccessCode(event) {
    event?.preventDefault();
    const accessCode = athleteParentAccessDraft.trim();
    if (!accessCode) {
      setAthleteParentLinkFeedback('Enter the family access code from your parent.');
      return;
    }
    if (!isSupabaseConfigured || authSession?.role !== 'athlete') {
      setAthleteParentLinkFeedback('Log in as an athlete before linking a parent membership.');
      return;
    }

    const { error } = await supabase.rpc('link_athlete_to_parent', { parent_code: accessCode });
    if (error) {
      setAthleteParentLinkFeedback('That code did not link. Check the code and try again.');
      return;
    }

    setAthleteParentAccessDraft('');
    setAthleteParentLinkFeedback('Parent membership linked. Premium access is updating...');
    setPremiumAccessRefreshKey((value) => value + 1);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, full_name, parent_access_code')
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
        email: user.email ?? '',
        parentAccessCode: profile.parent_access_code ?? ''
      });
      setView(profile.role === 'parent' ? 'parent' : 'athlete');
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setAuthSession(null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  function notifyUser(title, body, tone = 'info', options = {}) {
    const type = options.type || 'general';
    if (type !== 'general' && notificationPreferences[type] === false) return;

    const nextNotification = buildNotification(title, body, tone, { ...options, type });
    setNotifications((current) => {
      if (current.some((notification) => notification.id === nextNotification.id)) return current;
      return [nextNotification, ...current].slice(0, 40);
    });

    if (notificationPreferences.browserPush && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }

  async function requestBrowserNotifications() {
    if (isNativePushRuntime()) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const permission = await PushNotifications.requestPermissions();
        const granted = permission.receive === 'granted';
        setNotificationPreferences((current) => ({ ...current, browserPush: granted }));
        if (granted) await PushNotifications.register();
      } catch {
        setNotificationPreferences((current) => ({ ...current, browserPush: false }));
      }
      return;
    }

    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPreferences((current) => ({ ...current, browserPush: permission === 'granted' }));
  }

  async function registerPushDeviceToken(token, platform) {
    if (!token || !isSupabaseConfigured || !authSession?.id) return;
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) return;

    await fetch(appApiUrl('/api/register-push-token'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token,
        platform,
        appVersion: '1.0.0'
      })
    }).catch(() => {});
  }

  function updateNotificationPreference(field, value) {
    setNotificationPreferences((current) => ({ ...current, [field]: value }));
  }

  function markNotificationsRead() {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  }

  async function clearNotifications() {
    setNotifications([]);
    if (isSupabaseConfigured && authSession?.id) {
      await supabase.from('app_notifications').delete().eq('user_id', authSession.id);
    }
  }

  function toggleNotifications() {
    setNotificationsOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) markNotificationsRead();
      return nextOpen;
    });
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
    notifyUser('Points earned', `+${cleanPoints} points · ${label}`, 'success', {
      type: 'points',
      id: `points-${cleanKey}`
    });
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
    const selectedChallenge = athleteChallengeById(setup.currentChallenge);
    const accountName = effectiveSession?.name || athleteProfile.name || 'Athlete';
    const nextProfile = {
      ...athleteProfile,
      name: accountName,
      sport: setup.sport,
      age: setup.age,
      location: setup.location,
      parentContact: setup.parentContact,
      currentChallenge: selectedChallenge.id
    };
    const nextGoals = (setup.goals?.length ? setup.goals : [selectedChallenge.goal])
      .map((goal, index) => ({
        id: Date.now() + index,
        label: index === 0 ? 'Main Goal' : `Goal ${index + 1}`,
        value: goal,
        progress: 0
      }))
      .filter((goal) => goal.value.trim());
    const nextStandards = (setup.standards?.length ? setup.standards : [selectedChallenge.standard])
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
    setAthleteStartComplete(false);
    setOnboardingComplete(true);
    localStorage.setItem(onboardingStorageKey, 'true');
    localStorage.setItem(athleteStartStorageKey, 'false');
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
      'warning',
      {
        type: 'streaks',
        id: `streak-warning-${dailyDate}-${streakCount}`
      }
    );
    setLastReminderDate(dailyDate);
  }, [dailyDate, lastReminderDate, lastSubmittedDate, streakCount, submittedToday]);

  useEffect(() => {
    if (!effectiveSession) return;
    if (effectiveSession.role === 'athlete' && view !== 'athlete') setView('athlete');
    if (effectiveSession.role === 'parent' && view !== 'parent') setView('parent');
  }, [effectiveSession, view]);

  useEffect(() => {
    setTrialPromptDismissed(loadTrialPromptDismissed(effectiveSession?.id));
    setLocalTrialAccessActive(loadTrialAccessActive(effectiveSession?.id));
  }, [effectiveSession?.id]);

  useEffect(() => {
    if (!effectiveSession?.id) return;
    let active = true;

    const loadSubscription = async () => {
      setSubscription((current) => ({ ...current, loading: true }));
      try {
        const status = await loadRevenueCatSubscription({
          userId: effectiveSession.id,
          email: effectiveSession.email,
          name: effectiveSession.name
        });
        if (active) setSubscription((current) => ({ ...current, ...status, loading: false }));
      } catch (error) {
        if (active) {
          setSubscription((current) => ({
            ...current,
            configured: Boolean(revenueCatConfig.iosApiKey),
            native: canUseNativePurchases(),
            loading: false,
            message: error?.message || 'Premium access could not be checked yet.'
          }));
        }
      }
    };

    loadSubscription();

    return () => {
      active = false;
    };
  }, [effectiveSession?.email, effectiveSession?.id, effectiveSession?.name]);

  useEffect(() => {
    if (!isSupabaseConfigured || !effectiveSession?.id || String(effectiveSession.id).startsWith('demo-')) {
      setBackendPremiumAccess({
        hasAccess: false,
        activeTrial: false,
        source: 'none',
        sponsorUserId: null,
        expiresAt: ''
      });
      return;
    }

    let active = true;

    async function loadBackendPremiumAccess() {
      const [{ data, error }, subscriptionResult] = await Promise.all([
        supabase.rpc('user_has_premium_access', { target_user_id: effectiveSession.id }),
        supabase
          .from('user_subscriptions')
          .select('status, expires_at')
          .eq('user_id', effectiveSession.id)
          .order('updated_at', { ascending: false })
          .limit(1)
      ]);
      if (!active) return;
      const access = Array.isArray(data) ? data[0] : data;
      const subscriptionRow = Array.isArray(subscriptionResult.data) ? subscriptionResult.data[0] : null;
      setBackendPremiumAccess({
        hasAccess: !error && Boolean(access?.has_access),
        activeTrial: subscriptionRow?.status === 'trialing',
        source: access?.access_source || 'none',
        sponsorUserId: access?.sponsor_user_id || null,
        expiresAt: access?.expires_at || ''
      });
    }

    loadBackendPremiumAccess();

    return () => {
      active = false;
    };
  }, [effectiveSession?.id, premiumAccessRefreshKey]);

  async function startPremiumSubscription() {
    saveTrialAccessWindow(effectiveSession?.id);
    setLocalTrialAccessActive(true);
    setTrialPromptDismissed(true);
    saveTrialPromptDismissed(effectiveSession?.id);
    if (effectiveSession?.role === 'athlete') setTab('plans');
    setSubscription((current) => ({ ...current, loading: true, message: 'Opening App Store checkout...' }));
    try {
      const status = await purchaseRevenueCatSubscription();
      setSubscription((current) => ({
        ...current,
        active: status.active,
        activeTrial: status.activeTrial,
        expirationDate: status.expirationDate,
        managementURL: status.managementURL,
        loading: false,
        message: status.active ? 'Premium access is active.' : 'Purchase finished, but premium access is not active yet.'
      }));
      if (status.active) {
        setTrialPromptDismissed(true);
        saveTrialPromptDismissed(effectiveSession?.id);
        saveTrialAccessWindow(effectiveSession?.id, status.expirationDate);
        setLocalTrialAccessActive(true);
        if (effectiveSession?.role === 'athlete') setTab('plans');
        setPremiumAccessRefreshKey((current) => current + 1);
        notifyUser('Premium unlocked', 'Your Complete Athlete subscription is active.', 'success', { type: 'points', id: `premium-active-${Date.now()}` });
      }
    } catch (error) {
      const cancelled = Boolean(error?.userCancelled);
      if (cancelled) {
        setLocalTrialAccessActive(false);
        clearTrialAccessWindow(effectiveSession?.id);
        setTrialPromptDismissed(loadTrialPromptDismissed(effectiveSession?.id));
        setTab('home');
      }
      setSubscription((current) => ({
        ...current,
        loading: false,
        message: cancelled
          ? 'Purchase canceled.'
          : 'Trial plan access is open while subscription setup is being finalized.'
      }));
    }
  }

  function skipTrialPrompt() {
    setTrialPromptDismissed(true);
    saveTrialPromptDismissed(effectiveSession?.id);
    notifyUser('Free mode started', 'You can start the 7-day trial any time from Profile.', 'info', {
      type: 'points',
      id: `trial-skipped-${Date.now()}`
    });
  }

  async function restorePremiumSubscription() {
    setSubscription((current) => ({ ...current, loading: true, message: 'Restoring purchases...' }));
    try {
      const status = await restoreRevenueCatSubscription();
      setSubscription((current) => ({
        ...current,
        active: status.active,
        activeTrial: status.activeTrial,
        expirationDate: status.expirationDate,
        managementURL: status.managementURL,
        loading: false,
        message: status.active ? 'Premium access restored.' : 'No active subscription was found.'
      }));
      if (status.active) {
        setTrialPromptDismissed(true);
        saveTrialPromptDismissed(effectiveSession?.id);
        saveTrialAccessWindow(effectiveSession?.id, status.expirationDate);
        setLocalTrialAccessActive(true);
        if (effectiveSession?.role === 'athlete') setTab('plans');
        setPremiumAccessRefreshKey((current) => current + 1);
      }
    } catch (error) {
      setSubscription((current) => ({
        ...current,
        loading: false,
        message: error?.message || 'Purchases could not be restored yet.'
      }));
    }
  }

  const content = useMemo(() => {
    if (view === 'parent') {
      return (
        <ParentDashboard
          parentTab={parentTab}
          authSession={effectiveSession}
          athleteScore={athleteScore}
          standardsCompleted={standardsCompleted}
          standardsTotal={standards.length}
          linkedAthleteId={linkedAthleteId}
          linkedAthleteSummary={linkedAthleteSummary}
          linkParentAccessCode={linkParentAccessCode}
          parentAccessDraft={parentAccessDraft}
          parentLinkChecked={parentLinkChecked}
          parentLinkFeedback={parentLinkFeedback}
          parentGuides={parentGuides}
          parentMessage={parentMessage}
          premiumAccessAllowed={premiumAccessAllowed}
          planProgress={planProgress}
          plans={plans}
          pointsLedger={pointsLedger}
          readinessHistory={readinessHistory}
          setParentAccessDraft={setParentAccessDraft}
          setParentLinkFeedback={setParentLinkFeedback}
          setPlanProgress={setPlanProgress}
          privacySettings={privacySettings}
          goals={goals}
          athleteProfile={athleteProfile}
          journalEntries={journalEntries}
          lesson={activeLesson}
          logoutUser={logoutUser}
          notifyUser={notifyUser}
          notificationPreferences={notificationPreferences}
          requestBrowserNotifications={requestBrowserNotifications}
          restorePremiumSubscription={restorePremiumSubscription}
          startPremiumSubscription={startPremiumSubscription}
          subscription={effectiveSubscription}
          updateNotificationPreference={updateNotificationPreference}
          standardsHistory={standardsHistory}
          streakCount={streakCount}
        />
      );
    }
    const screens = {
      home: (
        <HomeScreen
          athleteScore={athleteScore}
          athleteProfile={athleteProfile}
          athleteStartComplete={athleteTodayPreview || (!athleteStartPreview && athleteStartComplete)}
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
          setAthleteStartComplete={setAthleteStartComplete}
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
        planAccessAllowed ? (
          <PlansScreen
            plans={plans}
            planProgress={planProgress}
            trialPlanMode={effectiveSubscription.activeTrial || localTrialAccessActive}
            setPlanProgress={setPlanProgress}
            awardPoints={awardPoints}
            notifyUser={notifyUser}
            persistPlanCompletion={persistPlanCompletion}
          />
        ) : (
          <PremiumAccessPanel
            compact={false}
            restorePremiumSubscription={restorePremiumSubscription}
            startPremiumSubscription={startPremiumSubscription}
            subscription={effectiveSubscription}
          />
        )
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
          setCoachComposerFocused={setCoachComposerFocused}
        />
      ),
      profile: (
        <ProfileScreen
          authSession={authSession}
          athleteProfile={athleteProfile}
          athleteParentAccessDraft={athleteParentAccessDraft}
          athleteParentLinkFeedback={athleteParentLinkFeedback}
          linkAthleteParentAccessCode={linkAthleteParentAccessCode}
          notificationPreferences={notificationPreferences}
          privacySettings={privacySettings}
          requestBrowserNotifications={requestBrowserNotifications}
          logoutUser={logoutUser}
          setAthleteParentAccessDraft={setAthleteParentAccessDraft}
          setAthleteParentLinkFeedback={setAthleteParentLinkFeedback}
          setAthleteProfile={setAthleteProfile}
          setNotificationPreferences={setNotificationPreferences}
          setPrivacySettings={setPrivacySettings}
          restorePremiumSubscription={restorePremiumSubscription}
          startPremiumSubscription={startPremiumSubscription}
          subscription={effectiveSubscription}
          updateNotificationPreference={updateNotificationPreference}
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
    localTrialAccessActive,
    lastSubmittedDate,
    activeCoachSessionId,
    athleteStartComplete,
    athleteProfile,
    athleteParentAccessDraft,
    athleteParentLinkFeedback,
    backendPremiumAccess,
    coachSessions,
    coachComposerFocused,
    messageDraft,
    messages,
    notificationPreferences,
    parentGuides,
    parentTab,
    parentMessage,
    planAccessAllowed,
    premiumAccessAllowed,
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
    effectiveSubscription,
    effectiveSession,
    streakCount,
    submittedToday,
    tab,
    todayPoints,
    view,
    athleteStartPreview,
    athleteTodayPreview,
    trialGatePreview
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

  if (!prototypeBypassLogin && !localParentInviteSession && !athleteTodayPreview && !onboardingComplete) {
    return <OnboardingScreen completeOnboarding={completeOnboarding} />;
  }

  if (!effectiveSubscription.loading && !premiumAccessAllowed && (!trialPromptDismissed || trialGatePreview)) {
    return (
      <TrialPaywallScreen
        role={effectiveSession.role}
        restorePremiumSubscription={restorePremiumSubscription}
        skipTrialPrompt={skipTrialPrompt}
        startPremiumSubscription={startPremiumSubscription}
        subscription={effectiveSubscription}
      />
    );
  }

  const useMobileAppShell = typeof window !== 'undefined'
    && (
      document.documentElement.classList.contains('native-shell')
      || isPhoneViewport
    );
  const coachTypingMode = useMobileAppShell && view === 'athlete' && tab === 'coach' && coachComposerFocused;
  const isAthleteHome = view === 'athlete' && tab === 'home';

  return (
    <div
      className={`${useMobileAppShell ? 'mobile-native-app' : 'app-shell'}${coachTypingMode ? ' coach-typing-mode' : ''}`}
      data-viewport-revision={viewportRevision}
    >
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

      <main
        className={`${useMobileAppShell ? 'mobile-native-frame' : 'phone-frame'}${coachTypingMode ? ' coach-typing-mode' : ''}`}
        aria-label="The Complete Athlete app prototype"
      >
        <header className="topbar">
          <div>
            <p className={isAthleteHome ? 'top-greeting athlete-home-greeting' : 'top-greeting'}>
              {view === 'athlete' ? firstNameGreeting(effectiveSession.name) : timeBasedGreeting(effectiveSession.name)}
            </p>
            {!isAthleteHome && (
              <h1>{view === 'athlete' ? screenTitles[tab] : 'Parent Dashboard'}</h1>
            )}
          </div>
          <button className="icon-button notification-button" aria-label="Notifications" onClick={toggleNotifications}>
            <Bell size={19} />
            {unreadNotifications.length > 0 && <span>{unreadNotifications.length}</span>}
          </button>
        </header>

        {notificationsOpen && (
          <NotificationTray
            clearNotifications={clearNotifications}
            notifications={notifications}
            onMarkAllRead={markNotificationsRead}
            requestBrowserNotifications={requestBrowserNotifications}
          />
        )}

        {celebration && <div className="celebration-banner">{celebration}</div>}

        <section className="content">{content}</section>

        {view === 'athlete' && !coachTypingMode && <BottomNav tab={tab} setTab={setTab} />}
        {view === 'parent' && <ParentBottomNav tab={parentTab} setTab={setParentTab} />}
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
  const [mode, setMode] = useState(invitedAsParent ? 'signup' : 'login');
  const [role, setRole] = useState(invitedAsParent ? 'parent' : '');
  const [form, setForm] = useState({ name: '', email: '', password: '', parentCode: invitedCode, parentFamilyCode: '' });
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
      : signupUser({ role, name: form.name, email: form.email, password: form.password, parentCode: form.parentCode, parentFamilyCode: form.parentFamilyCode });
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
        <section className="auth-brand-panel auth-photo-panel">
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
      <section className="auth-brand-panel auth-photo-panel">
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
          {mode === 'signup' && role === 'athlete' && (
            <label>
              <span>Family access code</span>
              <input
                className="text-field"
                placeholder="Optional parent code"
                value={form.parentFamilyCode}
                onChange={(event) => updateForm('parentFamilyCode', event.target.value)}
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
    sport: '',
    age: '',
    location: '',
    parentContact: '',
    currentChallenge: '',
    goals: [],
    standards: []
  });
  const [message, setMessage] = useState('');

  function updateField(field, value) {
    setSetup((current) => ({ ...current, [field]: value }));
    setMessage('');
  }

  function startOnboarding(event) {
    event.preventDefault();
    const cleanSetup = {
      ...setup,
      sport: setup.sport.trim(),
      goals: setup.goals.map((goal) => goal.trim()).filter(Boolean),
      standards: setup.standards.map((standard) => standard.trim()).filter(Boolean)
    };

    if (!cleanSetup.sport.trim()) {
      setMessage('Add the athlete sport to start.');
      return;
    }

    if (!cleanSetup.currentChallenge) {
      setMessage('Choose what you want help with first.');
      return;
    }

    completeOnboarding(cleanSetup);
  }

  return (
    <main className="onboarding-shell simple-athlete-onboarding" aria-label="The Complete Athlete onboarding">
      <section className="onboarding-hero">
        <p className="eyebrow">The Complete Athlete</p>
        <h1>Start with today.</h1>
        <p>Answer a few quick things. We will recommend the right plan and keep the rest out of the way.</p>
      </section>

      <form className="onboarding-form" onSubmit={startOnboarding}>
        <section className="panel onboarding-panel">
          <PanelTitle icon={<UserRound size={18} />} title="Athlete" action="Step 1" />
          <div className="form-grid">
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
                placeholder="Optional"
                value={setup.age}
                onChange={(event) => updateField('age', event.target.value.replace(/\D/g, '').slice(0, 2))}
              />
            </label>
          </div>
        </section>

        <section className="panel onboarding-panel">
          <PanelTitle icon={<Target size={18} />} title="What do you need help with?" action="Step 2" />
          <div className="challenge-choice-grid" aria-label="Athlete challenge options">
            {athleteChallengeOptions.map((challenge) => (
              <button
                className={setup.currentChallenge === challenge.id ? 'challenge-choice active' : 'challenge-choice'}
                key={challenge.id}
                onClick={() => updateField('currentChallenge', challenge.id)}
                type="button"
              >
                <strong>{challenge.shortLabel}</strong>
                <span>{challenge.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel onboarding-panel optional-onboarding-panel">
          <PanelTitle icon={<Users size={18} />} title="Family access" action="Optional" />
          <div className="optional-link-copy">
            <strong>Already have a parent code?</strong>
            <span>You can add it now or later in Settings.</span>
          </div>
          <input
            id="onboarding-parent"
            className="text-field"
            placeholder="Optional family code"
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
  athleteProfile,
  athleteStartComplete,
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
  setAthleteStartComplete,
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
      'success',
      {
        type: 'productivity',
        id: `productivity-${submissionDate}`
      }
    );

    if (nextStreak % 7 === 0) {
      notifyUser(
        `${nextStreak}-day streak`,
        `You have protected your daily work for ${nextStreak} straight days.`,
        'success',
        {
          type: 'streaks',
          id: `streak-${submissionDate}-${nextStreak}`
        }
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

  if (!athleteStartComplete) {
    return (
      <AthleteStartToday
        athleteProfile={athleteProfile}
        celebrate={celebrate}
        lesson={lesson}
        plans={plans}
        planProgress={planProgress}
        setAthleteStartComplete={setAthleteStartComplete}
        setJournal={setJournal}
        setJournalType={setJournalType}
        setStandards={setStandards}
        setTab={setTab}
      />
    );
  }

  return (
    <>
      <section className="panel daily-deposit-panel today-page-hero">
        <PanelTitle icon={<Brain size={18} />} title="Daily Deposit" action={submittedToday ? 'Locked in' : ''} />
        <div className="today-hero-copy">
          {lesson.title && <h2>{lesson.title}</h2>}
          <p>{lesson.body}</p>
        </div>
        <div className="today-focus-callout">
          <span>Today’s focus</span>
          <strong>{todaysFocus}</strong>
        </div>
        <div className="today-command-grid" aria-label="Today’s snapshot">
          <span>
            <strong>{completedStandards.length}/{standards.length}</strong>
            Productivity
          </span>
          <span>
            <strong>{athleteScore}</strong>
            Score
          </span>
          <span>
            <strong>{streakCount}</strong>
            Streak
          </span>
        </div>
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

      <section className="panel progress-snapshot">
        <PanelTitle icon={<BarChart3 size={18} />} title="Progress Snapshot" />
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

function AthleteStartToday({
  athleteProfile,
  celebrate,
  lesson,
  plans,
  planProgress,
  setAthleteStartComplete,
  setJournal,
  setJournalType,
  setStandards,
  setTab
}) {
  const challenge = athleteChallengeById(athleteProfile?.currentChallenge);
  const planLibrary = buildPlanLibrary(sequencedPlanAccess(plans, planProgress, todayKey()));
  const recommendedSeries = planLibrary.find((series) => {
    const text = `${series.title} ${series.tagline} ${series.category}`.toLowerCase();
    return challenge.planKeywords.some((keyword) => text.includes(keyword));
  }) ?? planLibrary.find((series) => series.openCount > 0) ?? planLibrary[0];

  function markStartComplete() {
    setStandards((current) => {
      if (!current.length) {
        return [{ id: Date.now(), label: challenge.standard, done: true, goalId: null }];
      }
      return current.map((standard, index) => (index === 0 ? { ...standard, done: true } : standard));
    });
    setJournalType('Daily Reflection');
    setJournal(
      `Today’s Training: ${challenge.lessonTitle}\nFocus question: ${challenge.focus}\nOne action: ${challenge.standard}\nWhat I need to remember: `
    );
    setAthleteStartComplete(true);
    localStorage.setItem(athleteStartStorageKey, 'true');
    celebrate('First rep complete. Your full dashboard is ready.');
  }

  function openRecommendedPlan() {
    setAthleteStartComplete(true);
    localStorage.setItem(athleteStartStorageKey, 'true');
    setTab('plans');
  }

  function goStraightHome() {
    setAthleteStartComplete(true);
    localStorage.setItem(athleteStartStorageKey, 'true');
    setTab('home');
    celebrate('Home screen is ready when you are.');
  }

  return (
    <section className="athlete-start-today" aria-label="Start today">
      <div className="start-today-hero">
        <span>Start Here</span>
        <h2>Today’s Training</h2>
        <p>{athleteProfile?.sport ? `${athleteProfile.sport} mindset rep` : 'One mindset rep. One action. Then go work.'}</p>
      </div>

      <article className="start-today-card">
        <div className="start-today-label">
          <Brain size={17} />
          <span>{challenge.title}</span>
        </div>
        <strong>{challenge.lessonTitle || lesson?.title}</strong>
        <p>{challenge.lessonBody || lesson?.body}</p>
        <div className="start-focus-box">
          <span>Focus question</span>
          <b>{challenge.focus}</b>
        </div>
      </article>

      <article className="start-action-card">
        <div>
          <span>One action</span>
          <strong>{challenge.standard}</strong>
        </div>
        <BadgeCheck size={24} />
      </article>

      {recommendedSeries && (
        <button className="recommended-start-plan has-cover" onClick={openRecommendedPlan} style={{ '--plan-cover': `url(${recommendedSeries.thumbnailImage})`, '--plan-cover-position': recommendedSeries.coverPosition }} type="button">
          <div className="plan-cover-thumb" aria-hidden="true" />
          <div>
            <span>Recommended plan</span>
            <strong>{recommendedSeries.title}</strong>
            <em>{nextPlanLabel(recommendedSeries)}</em>
          </div>
        </button>
      )}

      <button className="primary-action full start-today-complete" onClick={markStartComplete} type="button">
        <Check size={18} />
        Mark Complete
      </button>
      <button className="ghost-action full start-home-skip" onClick={goStraightHome} type="button">
        Go to Home
      </button>
    </section>
  );
}

function NotificationTray({ clearNotifications, notifications, onMarkAllRead, requestBrowserNotifications }) {
  return (
    <section className="notification-tray" aria-label="Notifications">
      <div className="tray-head">
        <strong>Notifications</strong>
        <div className="tray-actions">
          <button onClick={requestBrowserNotifications}>Enable</button>
          {notifications.length > 0 && <button onClick={onMarkAllRead}>Read</button>}
          {notifications.length > 0 && <button onClick={clearNotifications}>Clear</button>}
        </div>
      </div>
      {notifications.length === 0 ? (
        <p>No notifications yet.</p>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => (
            <article className={`notice ${notification.tone}${notification.read ? '' : ' unread'}`} key={notification.id}>
              <span>{notification.displayTime}</span>
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
        <p>Goals give your effort a direction, but it’s discipline to constantly pursue them that gives you momentum.</p>
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

function PlansScreen({ plans, planProgress, trialPlanMode = false, setPlanProgress, awardPoints, notifyUser, persistPlanCompletion }) {
  const readOnly = !setPlanProgress;
  const today = todayKey();
  const sequencedPlans = trialPlanMode
    ? trialPlanAccess(plans, planProgress)
    : sequencedPlanAccess(plans, planProgress, today);
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
      notifyUser?.('Full series completed', `${seriesTitle} is complete. That is a major rep banked.`, 'success', {
        type: 'planUnlocks',
        id: `plan-series-notification-${seriesTitle}`
      });
    } else {
      const nextPlan = seriesPlans
        .sort((first, second) => planDayNumber(first) - planDayNumber(second))
        .find((item) => !nextProgress[String(item.id)]);
      notifyUser?.('Lesson complete', nextPlan
        ? 'The next lesson will unlock after today so the work has time to sink in.'
        : 'Lesson complete. Keep stacking the work.',
      'success',
      {
        type: 'planUnlocks',
        id: `plan-lesson-notification-${planId}`
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
          <PanelTitle icon={<CalendarDays size={18} />} title={selectedSeries.title} action={trialPlanMode ? 'Trial: Day 1 open' : `${completedCount}/${visiblePlans.length} done`} />
          <p>{selectedSeries.tagline}</p>
          {trialPlanMode
            ? <span>Your trial opens Day 1 of every plan. The remaining days unlock with membership.</span>
            : lockedCount > 0 && <span>{lockedCount} lessons are waiting behind the completion flow.</span>}
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
                      : trialPlanMode
                        ? 'Unlocks with membership'
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
                  <p>{trialPlanMode ? 'Day 1 is open during the trial. Membership unlocks the rest of this plan.' : 'Finish the previous lesson, then come back the next day to unlock this one.'}</p>
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
          <PanelTitle icon={<Sparkles size={18} />} title="Continue Training" action={trialPlanMode ? 'Trial access' : `${continueSeries.completedCount}/${continueSeries.plans.length} done`} />
          <button className="continue-plan-card has-cover" onClick={() => setSelectedSeriesId(continueSeries.id)} style={{ '--plan-cover': `url(${continueSeries.coverImage})`, '--plan-cover-position': continueSeries.coverPosition }} type="button">
            <div className="plan-cover" aria-hidden="true" />
            <div className="plan-card-copy">
              <span>{continueSeries.category}</span>
              <strong>{continueSeries.title}</strong>
              <em>{trialPlanMode ? 'Day 1 open during trial' : nextPlanLabel(continueSeries)}</em>
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
                  <em>{trialPlanMode ? 'Day 1 open during trial' : `${series.completedCount}/${series.plans.length} complete · ${series.openCount} open`}</em>
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
  if (text.includes('faith') || text.includes('god') || text.includes('scripture') || text.includes('compete differently')) return 'Faith';
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
  if (normalized.includes('compete differently') || normalized.includes('faith')) {
    return '/plan-covers/compete-differently-banner.png';
  }
  if (normalized.includes('lock in') || normalized.includes('focus')) {
    return '/plan-covers/lock-in-banner.jpg';
  }
  if (normalized.includes('boring wins')) {
    return '/plan-covers/boring-wins-banner.jpg';
  }
  if (normalized.includes('next play')) {
    return '/plan-covers/next-play-banner.jpg';
  }
  if (normalized.includes('thermostat')) {
    return '/plan-covers/thermostat-banner.jpg';
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
  if (normalized.includes('compete differently') || normalized.includes('faith')) {
    return '/plan-covers/compete-differently-thumbnail.png';
  }
  if (normalized.includes('lock in') || normalized.includes('focus')) {
    return '/plan-covers/lock-in-thumbnail.jpg';
  }
  if (normalized.includes('boring wins')) {
    return '/plan-covers/boring-wins-thumbnail.jpg';
  }
  if (normalized.includes('next play')) {
    return '/plan-covers/next-play-thumbnail.jpg';
  }
  if (normalized.includes('thermostat')) {
    return '/plan-covers/thermostat-thumbnail.jpg';
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
  if (normalized.includes('compete differently') || normalized.includes('faith')) {
    return '60% 50%';
  }
  if (normalized.includes('lock in') || normalized.includes('focus')) {
    return '50% 52%';
  }
  if (normalized.includes('boring wins')) {
    return '50% 52%';
  }
  if (normalized.includes('next play')) {
    return '55% 50%';
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
  'Deeper Look',
  'The Living Room',
  'This Week at Home',
  "Today's Challenge",
  'Why This Matters',
  'The Turning Point',
  'Mirror Check',
  'System Update',
  'Practice Install',
  'Journal',
  'Your Championship Habit Blueprint',
  'Film Room',
  'Complete Athlete Principle',
  'Daily Challenge',
  'Key Takeaway',
  'Closing the Plan',
  'Closing Thought',
  'The RESET Framework',
  'Next Chapter',
  'The Complete Athlete Declaration',
  'One Last Thought',
  'Final Thoughts',
  'Final Thought',
  'Closing Reflection',
  'Series Finale',
  'Final Complete Athlete Principle'
]);

function sectionTone(title) {
  const normalized = title.toLowerCase();
  if (normalized.includes('practice') || normalized.includes('blueprint') || normalized.includes('reset framework')) return 'practice';
  if (normalized.includes('daily challenge')) return 'practice';
  if (normalized.includes('journal') || normalized.includes('reflection')) return 'practice';
  if (normalized.includes('film') || normalized.includes('story') || normalized.includes('curtain')) return 'film';
  if (normalized.includes('principle') || normalized.includes('declaration') || normalized.includes('key takeaway')) return 'principle';
  if (normalized.includes('closing') || normalized.includes('next') || normalized.includes('last') || normalized.includes('finale') || normalized.includes('final thoughts')) return 'next';
  if (normalized.includes('mental') || normalized.includes('system') || normalized.includes('mirror')) return 'system';
  return 'body';
}

function sectionLinesToBlocks(lines) {
  const blocks = [];
  let bodyBuffer = [];
  let quoteBuffer = [];
  let bulletBuffer = [];
  const readableLines = lines.flatMap((line) => {
    if (!/^["“]/.test(line) || line.length <= 220) return [line];
    const closingQuoteIndex = line.slice(1).search(/["”]/);
    if (closingQuoteIndex < 0) return [line];
    const quoteEnd = closingQuoteIndex + 2;
    return [line.slice(0, quoteEnd), line.slice(quoteEnd).trim()].filter(Boolean);
  });

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

  readableLines.forEach((line) => {
    const previousBody = bodyBuffer[bodyBuffer.length - 1] ?? '';
    const previousBullet = bulletBuffer[bulletBuffer.length - 1] ?? '';
    const previousQuote = quoteBuffer[quoteBuffer.length - 1] ?? '';
    const isWrappedLine =
      /^[a-z]/.test(line) &&
      !/^[•✓]/.test(line) &&
      !/[.!?:;"”)]$/.test(previousBody || previousBullet || previousQuote);

    if (quoteBuffer.length) {
      const nextQuote = `${previousQuote} ${line}`;
      if (isWrappedLine && nextQuote.length <= 180) {
        quoteBuffer[quoteBuffer.length - 1] = nextQuote;
        return;
      }
      flushQuote();
    }

    if (bulletBuffer.length) {
      if (isWrappedLine) {
        bulletBuffer[bulletBuffer.length - 1] = `${previousBullet} ${line}`;
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

    if (bodyBuffer.length && isWrappedLine) {
      bodyBuffer[bodyBuffer.length - 1] = `${previousBody} ${line}`;
      return;
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

function explicitPlanReaderSections(body, preserveHeadings = false) {
  const lines = planReaderBody(body)
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (!lines.some((line) => explicitPlanSectionHeadings.has(line) || /^Day\s+\d+:/i.test(line) || /^Next Chapter:/i.test(line))) return [];

  const sections = [];
  let current = null;

  lines.forEach((line) => {
    if (explicitPlanSectionHeadings.has(line) || /^Day\s+\d+:/i.test(line) || /^Next Chapter:/i.test(line)) {
      const sectionTitleMap = {
        'Mental Model': '',
        Opening: 'Start Here',
        'Pull Back the Curtain': 'Deeper Look',
        Story: 'Athlete Story',
        'The Story': 'Athlete Story',
        Journal: 'Film Room'
      };
      const title = preserveHeadings
        ? line
        : /^Next Chapter:/i.test(line) ? 'What You Will Learn Next Chapter' : sectionTitleMap[line] ?? line;
      current = { title, tone: line === 'Mental Model' ? 'model' : sectionTone(title), lines: [] };
      sections.push(current);
      if (/^Next Chapter:/i.test(line)) {
        current.lines.push(line.replace(/^Next Chapter:\s*/i, '').trim());
      }
      return;
    }

    if (!current) {
      current = { title: preserveHeadings ? '' : 'System Update', tone: 'system', lines: [] };
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
    .filter((section) => section.blocks.length || /^Day\s+\d+:/i.test(section.title));
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

function PlanEpisode({ steps, planId, preserveHeadings = false }) {
  const body = steps.join('\n\n');
  const sections = explicitPlanReaderSections(body, preserveHeadings);
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
  setMessageDraft,
  setCoachComposerFocused
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
      error.status = response.status;
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
        const backendMessage =
          error.status === 401
            ? 'Sign out and log back in, then try My Mindset Coach again.'
            : error.message || 'My Mindset Coach could not connect. Try again in a moment.';
        setCoachStatus(backendMessage);
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
    setCoachComposerFocused(false);
    setActiveCoachSessionId(null);
    setMessages([]);
    setMessageDraft('');
    setCoachStatus('');
  }

  function openCoachSession(session) {
    setCoachComposerFocused(false);
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
          {coachThinking && (
            <div className="bubble coach thinking" aria-label="Coach is typing">
              <span />
              <span />
              <span />
            </div>
          )}
        </section>

        {coachStatus && <p className="coach-status">{coachStatus}</p>}
        <div className="composer">
          <textarea
            value={messageDraft}
            onChange={(event) => setMessageDraft(event.target.value)}
            onFocus={(event) => {
              setCoachComposerFocused(true);
              setTimeout(() => {
                event.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }, 120);
            }}
            onBlur={() => {
              setTimeout(() => setCoachComposerFocused(false), 140);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            disabled={coachThinking}
            placeholder="Ask your coach..."
            rows={2}
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

function TrialPaywallScreen({
  restorePremiumSubscription,
  role,
  skipTrialPrompt,
  startPremiumSubscription,
  subscription
}) {
  const product = subscription.package;
  const priceLine = product?.price ? `${product.price}/month after trial` : '$5.99/month after trial';
  const canPurchase = subscription.configured && subscription.native && !subscription.active;
  const canRestore = subscription.configured && subscription.native;
  const roleLine = role === 'parent'
    ? 'Support your athlete with every parent guide and the full plan library.'
    : 'Train your mindset with every plan, daily tools, and focused coach support.';

  return (
    <main className="trial-gate-shell">
      <section className="trial-gate-card">
        <span className="trial-kicker">7-day free trial</span>
        <h1>Unlock The Complete Athlete</h1>
        <p>{roleLine}</p>
        <div className="trial-benefit-list">
          <span>
            <BookOpen size={18} />
            Full performance plan library
          </span>
          <span>
            <Users size={18} />
            Parent Corner access
          </span>
          <span>
            <BadgeCheck size={18} />
            Daily Deposit and Today tools
          </span>
          <span>
            <Goal size={18} />
            Goals, journal, and family access
          </span>
          <span>
            <MessageCircle size={18} />
            Limited mindset coach messages
          </span>
        </div>
        <div className="trial-price-card">
          <span>Try everything first</span>
          <strong>{priceLine}</strong>
          <em>Cancel anytime through your Apple subscription settings.</em>
        </div>
        {subscription.message && <p className="inline-note">{subscription.message}</p>}
        <div className="trial-actions">
          <button
            className="primary-action full"
            disabled={!canPurchase || subscription.loading}
            onClick={startPremiumSubscription}
            type="button"
          >
            <Sparkles size={18} />
            {subscription.loading ? 'Checking...' : 'Start Free Trial'}
          </button>
          <button
            className="secondary-action inline"
            disabled={!canRestore || subscription.loading}
            onClick={restorePremiumSubscription}
            type="button"
          >
            Restore Purchase
          </button>
          <button className="trial-skip-button" onClick={skipTrialPrompt} type="button">
            Not now. Continue in free mode.
          </button>
        </div>
      </section>
    </main>
  );
}

function PremiumAccessPanel({
  compact = true,
  restorePremiumSubscription,
  startPremiumSubscription,
  subscription
}) {
  const product = subscription.package;
  const coveredByParent = subscription.active && subscription.accessSource === 'parent';
  const statusLabel = subscription.active ? (coveredByParent ? 'Parent covered' : 'Active') : 'Required';
  const priceLine = product?.price ? `${product.price}/month after trial` : '$5.99/month after trial';
  const canPurchase = subscription.configured && subscription.native && !subscription.active;
  const canRestore = subscription.configured && subscription.native;

  return (
    <section className={compact ? 'panel premium-panel compact' : 'panel premium-panel'}>
      <PanelTitle icon={<Sparkles size={18} />} title="Premium Access" action={statusLabel} />
      <div className="premium-status-row">
        <span>{subscription.active ? (coveredByParent ? 'Covered by parent' : 'Premium is active') : '7-day free trial'}</span>
        <strong>{subscription.active ? 'Unlocked' : priceLine}</strong>
      </div>
      <p className="privacy-note">
        Unlock the full Complete Athlete experience with plans, mindset coaching, daily growth tools, and future member features.
      </p>
      {subscription.message && <p className="inline-note">{subscription.message}</p>}
      <div className="premium-actions">
        {!subscription.active && (
          <button
            className="primary-action full"
            disabled={!canPurchase || subscription.loading}
            onClick={startPremiumSubscription}
            type="button"
          >
            <LockKeyhole size={18} />
            {subscription.loading ? 'Checking...' : 'Start Free Trial'}
          </button>
        )}
        <button
          className="secondary-action inline"
          disabled={!canRestore || subscription.loading}
          onClick={restorePremiumSubscription}
          type="button"
        >
          Restore Purchase
        </button>
      </div>
      {!subscription.native && !subscription.message && (
        <p className="privacy-note">Purchases are handled by Apple inside the iPhone app.</p>
      )}
    </section>
  );
}

function ProfileScreen({
  authSession,
  athleteProfile,
  athleteParentAccessDraft,
  athleteParentLinkFeedback,
  linkAthleteParentAccessCode,
  logoutUser,
  notificationPreferences,
  privacySettings,
  requestBrowserNotifications,
  restorePremiumSubscription,
  setAthleteParentAccessDraft,
  setAthleteParentLinkFeedback,
  setAthleteProfile,
  setNotificationPreferences,
  setPrivacySettings,
  startPremiumSubscription,
  subscription,
  updateNotificationPreference
}) {
  const [shareFeedback, setShareFeedback] = useState('');
  const [openProfileSections, setOpenProfileSections] = useState({ notifications: false, privacy: false });
  const accountEmail = authSession?.email || 'No email found';

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

  function toggleBrowserPush(checked) {
    if (checked) {
      requestBrowserNotifications();
      return;
    }
    setNotificationPreferences((current) => ({ ...current, browserPush: false }));
  }

  function toggleProfileSection(section) {
    setOpenProfileSections((current) => ({ ...current, [section]: !current[section] }));
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
          <h2>{athleteProfile.name || authSession?.name || 'Athlete'}</h2>
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
        <PanelTitle icon={<UserRound size={18} />} title="Profile Details" />
        <div className="account-email-card">
          <span>Registered email</span>
          <strong>{accountEmail}</strong>
        </div>
        <button className="secondary-action inline account-signout-button" onClick={logoutUser} type="button">
          Sign Out
        </button>
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
      <section className={openProfileSections.notifications ? 'panel notification-settings-panel collapsible-panel open' : 'panel notification-settings-panel collapsible-panel'}>
        <button
          className="collapsible-trigger"
          type="button"
          aria-expanded={openProfileSections.notifications}
          onClick={() => toggleProfileSection('notifications')}
        >
          <span className="collapsible-title">
            <span>
              <Bell size={18} />
              Notifications
            </span>
            <em>iPhone alerts</em>
          </span>
          <ChevronDown size={18} />
        </button>
        {openProfileSections.notifications && (
          <div className="collapsible-content">
            <div className="privacy-list notification-settings-list">
              <label>
                <span>iPhone lock-screen notifications</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.browserPush}
                  onChange={(event) => toggleBrowserPush(event.target.checked)}
                />
              </label>
              <label>
                <span>Daily Deposit reminders</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.dailyDeposits}
                  onChange={(event) => updateNotificationPreference('dailyDeposits', event.target.checked)}
                />
              </label>
              <label>
                <span>New performance plans</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.performancePlans}
                  onChange={(event) => updateNotificationPreference('performancePlans', event.target.checked)}
                />
              </label>
              <label>
                <span>Plan unlocks and completions</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.planUnlocks}
                  onChange={(event) => updateNotificationPreference('planUnlocks', event.target.checked)}
                />
              </label>
              <label>
                <span>Streak reminders</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.streaks}
                  onChange={(event) => updateNotificationPreference('streaks', event.target.checked)}
                />
              </label>
              <label>
                <span>Productivity updates</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.productivity}
                  onChange={(event) => updateNotificationPreference('productivity', event.target.checked)}
                />
              </label>
              <label>
                <span>Points earned</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.points}
                  onChange={(event) => updateNotificationPreference('points', event.target.checked)}
                />
              </label>
            </div>
            <p className="privacy-note">Turn on iPhone notifications here, then accept the Apple permission popup when it appears.</p>
          </div>
        )}
      </section>
      <PremiumAccessPanel
        restorePremiumSubscription={restorePremiumSubscription}
        startPremiumSubscription={startPremiumSubscription}
        subscription={subscription}
      />
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
        <div className="family-access-divider" aria-hidden="true">
          <span>or</span>
        </div>
        <div className="family-access-option">
          <span>Have a parent code?</span>
          <p>Enter the Family Access Code from your parent to join their membership.</p>
        </div>
        <form className="standard-form athlete-parent-code-form" onSubmit={linkAthleteParentAccessCode}>
          <input
            aria-label="Family access code"
            placeholder="Enter parent code"
            value={athleteParentAccessDraft}
            onChange={(event) => {
              setAthleteParentAccessDraft(event.target.value);
              setAthleteParentLinkFeedback('');
            }}
          />
          <button className="primary-action" type="submit">
            Link Parent
          </button>
        </form>
        {athleteParentLinkFeedback && <p className="inline-note">{athleteParentLinkFeedback}</p>}
      </section>
      <section className={openProfileSections.privacy ? 'panel privacy-controls-panel collapsible-panel open' : 'panel privacy-controls-panel collapsible-panel'}>
        <button
          className="collapsible-trigger"
          type="button"
          aria-expanded={openProfileSections.privacy}
          onClick={() => toggleProfileSection('privacy')}
        >
          <span className="collapsible-title">
            <span>
              <Shield size={18} />
              Privacy Controls
            </span>
            <em>Parent view</em>
          </span>
          <ChevronDown size={18} />
        </button>
        {openProfileSections.privacy && (
          <div className="collapsible-content">
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
          </div>
        )}
      </section>
    </>
  );
}

function ParentSettingsScreen({
  athleteName,
  authSession,
  linkedAthleteSummary,
  linkParentAccessCode,
  logoutUser,
  notificationPreferences,
  parentAccessDraft,
  parentGuides,
  parentLinkFeedback,
  planSeriesStats,
  requestBrowserNotifications,
  setParentAccessDraft,
  setParentLinkFeedback,
  updateNotificationPreference
}) {
  const [parentNotificationsOpen, setParentNotificationsOpen] = useState(true);
  const [familyAccessFeedback, setFamilyAccessFeedback] = useState('');
  const parentName = authSession?.name || 'Parent';
  const parentEmail = authSession?.email || 'No email found';
  const familyAccessCode = authSession?.parentAccessCode || 'TCA-FAMILY';
  const parentPhotoStorageKey = `the-ninety-percent-parent-photo-${authSession?.id || authSession?.email || 'local-parent'}`;
  const [parentPhoto, setParentPhoto] = useState(() => {
    try {
      return localStorage.getItem(parentPhotoStorageKey) || '';
    } catch {
      return '';
    }
  });
  const sportLine = linkedAthleteSummary?.sport ? `${linkedAthleteSummary.sport} support` : 'Athlete support';

  useEffect(() => {
    try {
      if (parentPhoto) {
        localStorage.setItem(parentPhotoStorageKey, parentPhoto);
      } else {
        localStorage.removeItem(parentPhotoStorageKey);
      }
    } catch {
      // Local photo saving is a convenience; the account still works if storage is unavailable.
    }
  }, [parentPhoto, parentPhotoStorageKey]);

  function updateParentPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setParentPhoto(reader.result);
    reader.readAsDataURL(file);
  }

  function toggleBrowserPush(checked) {
    if (checked) {
      requestBrowserNotifications();
      return;
    }
    updateNotificationPreference('browserPush', false);
  }

  async function copyFamilyAccessCode() {
    try {
      await navigator.clipboard.writeText(familyAccessCode);
      setFamilyAccessFeedback('Family access code copied.');
    } catch {
      setFamilyAccessFeedback(`Give this code to your athlete: ${familyAccessCode}`);
    }
  }

  return (
    <>
      <section className="profile-head parent-settings-head">
        <div className="profile-avatar parent-profile-avatar">
          {parentPhoto ? (
            <img src={parentPhoto} alt="Parent profile" />
          ) : (
            <Users size={30} />
          )}
        </div>
        <div>
          <p className="eyebrow">Parent Profile</p>
          <h2>{parentName}</h2>
          <span>Linked to {athleteName} | {sportLine}</span>
        </div>
      </section>

      <section className="panel parent-account-panel">
        <PanelTitle icon={<UserRound size={18} />} title="Account" action="Parent" />
        <div className="account-email-card parent-account-card">
          <span>Registered email</span>
          <strong>{parentEmail}</strong>
        </div>
        <div className="photo-actions parent-photo-actions">
          <label className="photo-upload">
            <Camera size={18} />
            Add Photo
            <input type="file" accept="image/*" onChange={updateParentPhoto} />
          </label>
          {parentPhoto && (
            <button className="secondary-action inline" onClick={() => setParentPhoto('')} type="button">
              Remove Photo
            </button>
          )}
        </div>
        <div className="parent-access-code-card">
          <div>
            <span>Family access</span>
            <strong>{linkedAthleteSummary ? `Linked to ${athleteName}` : 'Not linked yet'}</strong>
          </div>
          <div className="family-access-option">
            <span>Parent has athlete code</span>
            <p>Enter the code from your athlete’s profile to connect their account.</p>
          </div>
          <form className="standard-form parent-access-code-form" onSubmit={linkParentAccessCode}>
            <input
              aria-label="Parent access code"
              placeholder="Enter athlete code"
              value={parentAccessDraft}
              onChange={(event) => {
                setParentAccessDraft(event.target.value);
                setParentLinkFeedback('');
                setFamilyAccessFeedback('');
              }}
            />
            <button className="primary-action" type="submit">
              {linkedAthleteSummary ? 'Update Link' : 'Link Athlete'}
            </button>
          </form>
          <div className="family-access-divider" aria-hidden="true">
            <span>or</span>
          </div>
          <div className="family-access-option">
            <span>Athlete uses parent code</span>
            <p>Give this code to your athlete. They can enter it when creating their account to join your membership.</p>
          </div>
          <div className="family-access-code-display">
            <strong>{familyAccessCode}</strong>
            <button className="secondary-action inline family-invite-button" onClick={copyFamilyAccessCode} type="button">
              <Copy size={18} />
              Copy Code
            </button>
          </div>
          {(parentLinkFeedback || familyAccessFeedback) && <p className="inline-note">{parentLinkFeedback || familyAccessFeedback}</p>}
        </div>
        <div className="parent-settings-stats">
          <span>
            <strong>{athleteName}</strong>
            Linked athlete
          </span>
          <span>
            <strong>{parentGuides.length}</strong>
            Parent guides
          </span>
          <span>
            <strong>{planSeriesStats.completed}/{planSeriesStats.total}</strong>
            Plans complete
          </span>
        </div>
      </section>

      <section className={parentNotificationsOpen ? 'panel parent-notifications-panel collapsible-panel open' : 'panel parent-notifications-panel collapsible-panel'}>
        <button
          className="collapsible-trigger"
          type="button"
          aria-expanded={parentNotificationsOpen}
          onClick={() => setParentNotificationsOpen((current) => !current)}
        >
          <span className="collapsible-title">
            <span>
              <Bell size={18} />
              Notifications
            </span>
            <em>{notificationPreferences.parentUpdates ? 'On' : 'Off'}</em>
          </span>
          <ChevronDown size={18} />
        </button>
        {parentNotificationsOpen && (
          <div className="collapsible-content">
            <div className="privacy-list notification-settings-list">
              <label>
                <span>iPhone lock-screen notifications</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.browserPush}
                  onChange={(event) => toggleBrowserPush(event.target.checked)}
                />
              </label>
              <label>
                <span>New performance plans</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.performancePlans}
                  onChange={(event) => updateNotificationPreference('performancePlans', event.target.checked)}
                />
              </label>
              <label>
                <span>Streak and progress moments</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.streaks}
                  onChange={(event) => updateNotificationPreference('streaks', event.target.checked)}
                />
              </label>
              <label>
                <span>Parent support updates</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.parentUpdates}
                  onChange={(event) => updateNotificationPreference('parentUpdates', event.target.checked)}
                />
              </label>
            </div>
            <p className="privacy-note">Turn on parent alerts for the moments you want surfaced without hovering over your athlete.</p>
          </div>
        )}
      </section>

      <section className="panel parent-support-settings-panel">
        <PanelTitle icon={<Sparkles size={18} />} title="Support Menu" action="Quick view" />
        <div className="parent-support-menu">
          <span>
            <BookOpen size={18} />
            <strong>Parent Corner</strong>
            New guides for conversations at home.
          </span>
          <span>
            <BarChart3 size={18} />
            <strong>Progress Snapshot</strong>
            Streaks, work rate, and plan progress.
          </span>
          <span>
            <MessageCircle size={18} />
            <strong>Encouragement</strong>
            Send quick support from Overview.
          </span>
        </div>
      </section>

      <section className="parent-signout-panel">
        <button className="secondary-action inline account-signout-button" onClick={logoutUser} type="button">
          Sign Out
        </button>
      </section>
    </>
  );
}

function ParentDashboard({
  parentTab,
  authSession,
  athleteScore,
  athleteProfile,
  goals,
  journalEntries,
  lesson,
  linkedAthleteId,
  linkedAthleteSummary,
  linkParentAccessCode,
  logoutUser,
  notificationPreferences,
  notifyUser,
  parentAccessDraft,
  parentLinkChecked,
  parentLinkFeedback,
  parentGuides,
  parentMessage,
  premiumAccessAllowed,
  planProgress,
  plans,
  pointsLedger,
  privacySettings,
  readinessHistory,
  requestBrowserNotifications,
  restorePremiumSubscription,
  setParentAccessDraft,
  setParentLinkFeedback,
  setPlanProgress,
  startPremiumSubscription,
  standardsCompleted,
  standardsHistory,
  standardsTotal,
  subscription,
  streakCount,
  updateNotificationPreference
}) {
  const planSeriesStats = planSeriesCompletion(plans, planProgress);
  const weeklySnapshot = weeklyParentSnapshot({ standardsHistory, readinessHistory, journalEntries, pointsLedger, planProgress });
  const currentPlan = parentCurrentPlanSummary(plans, planProgress);
  const athleteName = linkedAthleteName(linkedAthleteSummary, athleteProfile);
  const [actionFeedback, setActionFeedback] = useState('');

  async function sendParentEncouragement(type) {
    const encouragements = {
      effort: {
        title: 'Keep stacking the work',
        body: `${athleteName}, your daily work matters. Keep building the habits that travel with you.`
      },
      plan: {
        title: 'Talk through the plan',
        body: `${athleteName}, take one idea from your current plan and bring it into today.`
      },
      goals: {
        title: 'Stay locked on your goals',
        body: `${athleteName}, remember what you are building toward. Match today’s choices to the goals you set.`
      }
    };
    const message = encouragements[type] ?? encouragements.effort;

    if (isSupabaseConfigured && linkedAthleteId) {
      const { error } = await supabase.rpc('create_parent_athlete_notification', {
        target_athlete_id: linkedAthleteId,
        notice_title: message.title,
        notice_body: message.body,
        notice_type: 'parentUpdates'
      });
      if (!error) {
        setActionFeedback('Sent to your athlete.');
        notifyUser('Encouragement sent', 'Your athlete will see it in the app.', 'success', {
          type: 'parentUpdates',
          id: `parent-action-${type}-${Date.now()}`
        });
        return;
      }
    }

    setActionFeedback('Saved as a parent action. Athlete alerts require the live linked backend.');
  }

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
        <ParentCornerSection parentGuides={parentGuides} parentMessage={parentMessage} />
      </>
    );
  }

  return (
    <>
      {parentTab === 'overview' && (
      <section className="panel daily-deposit-panel parent-daily-deposit-panel">
        <PanelTitle icon={<Brain size={18} />} title="Daily Deposit" />
        <h2>{lesson.title}</h2>
        <p>{lesson.body}</p>
      </section>
      )}

      {parentTab === 'overview' && (
      <section className="panel parent-progress-panel">
        <PanelTitle icon={<BarChart3 size={18} />} title="Athlete Progress" />
        <div className="parent-progress-hero">
          <div>
            <span>Complete Athlete Score</span>
            <strong>{athleteScore}</strong>
          </div>
          <p>{parentProgressTone(weeklySnapshot, streakCount)}</p>
        </div>
        <div className="parent-progress-grid">
          <span>
            <strong>{streakCount}</strong>
            Day streak
          </span>
          <span>
            <strong>{weeklySnapshot.productivityAverage}%</strong>
            7-day work rate
          </span>
          <span>
            <strong>{planSeriesStats.completed}/{planSeriesStats.total}</strong>
            Plans completed
          </span>
        </div>
        <div className="parent-action-grid parent-action-grid-inline">
          <button onClick={() => sendParentEncouragement('effort')} type="button">
            <BadgeCheck size={18} />
            <strong>Encourage effort</strong>
            <span>Reinforce the work, not just the result.</span>
          </button>
          <button onClick={() => sendParentEncouragement('plan')} type="button">
            <BookOpen size={18} />
            <strong>Talk through plan</strong>
            <span>Use today’s lesson as the bridge.</span>
          </button>
          <button onClick={() => sendParentEncouragement('goals')} type="button">
            <Goal size={18} />
            <strong>Hold accountable</strong>
            <span>Point them back to the goals they chose.</span>
          </button>
        </div>
        {actionFeedback && <p className="inline-note">{actionFeedback}</p>}
      </section>
      )}

      {parentTab === 'overview' && (
      <section className="panel parent-current-plan-panel">
        <PanelTitle icon={<BookOpen size={18} />} title="Your Athlete’s Current Plan" />
        <div className="parent-current-plan">
          <span>{currentPlan.seriesTitle}</span>
          <strong>{currentPlan.lessonTitle}</strong>
          <Progress value={currentPlan.totalCount ? Math.round((currentPlan.completedCount / currentPlan.totalCount) * 100) : 0} />
          <p>{currentPlan.completedCount}/{currentPlan.totalCount} lessons completed</p>
          {currentPlan.nextUnlock && <em>Next lesson opens {currentPlan.nextUnlock}.</em>}
        </div>
        <div className="parent-cue-card">
          <strong>Tonight’s conversation starter</strong>
          <span>{currentPlan.cue}</span>
        </div>
      </section>
      )}

      {parentTab === 'settings' && (
        <ParentSettingsScreen
          athleteName={athleteName}
          authSession={authSession}
          linkParentAccessCode={linkParentAccessCode}
          linkedAthleteSummary={linkedAthleteSummary}
          logoutUser={logoutUser}
          notificationPreferences={notificationPreferences}
          parentAccessDraft={parentAccessDraft}
          parentGuides={parentGuides}
          parentLinkFeedback={parentLinkFeedback}
          planSeriesStats={planSeriesStats}
          requestBrowserNotifications={requestBrowserNotifications}
          setParentAccessDraft={setParentAccessDraft}
          setParentLinkFeedback={setParentLinkFeedback}
          updateNotificationPreference={updateNotificationPreference}
        />
      )}

      {parentTab === 'parent-corner' && (
        premiumAccessAllowed ? (
          <>
            <ParentCornerSection parentGuides={parentGuides} parentMessage={parentMessage} />
            <ParentPlanLibrary plans={plans} planProgress={planProgress} setPlanProgress={setPlanProgress} notifyUser={notifyUser} />
          </>
        ) : (
          <PremiumAccessPanel
            compact={false}
            restorePremiumSubscription={restorePremiumSubscription}
            startPremiumSubscription={startPremiumSubscription}
            subscription={subscription}
          />
        )
      )}

      {parentTab === 'overview' && privacySettings.goalsVisible && (
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

function ParentCornerSection({ parentGuides = [], parentMessage }) {
  const [selectedParentContentId, setSelectedParentContentId] = useState('');
  const [parentGuideProgress, setParentGuideProgress] = useState(loadParentGuideProgress);
  const parentContent = parentGuides.length
    ? parentGuides.map((guide) => ({
      id: guide.id,
      category: guide.category,
      seriesTitle: guide.seriesTitle,
      title: guide.title,
      date: guide.guideDay || guide.releaseDate,
      promise: guide.subject,
      steps: guide.steps,
      guideDay: guide.guideDay,
      guideLength: guide.guideLength,
      coverImage: parentGuideCoverImage(guide.seriesTitle),
      thumbnailImage: parentGuideThumbnailImage(guide.seriesTitle),
      coverPosition: parentGuideCoverPosition(guide.seriesTitle),
      completedAt: parentGuideProgress[String(guide.id)] || ''
    }))
    : [
      {
        id: 'daily-parent-corner',
        category: 'Mindset Support',
        seriesTitle: 'Parent Corner',
        title: parentMessage.title,
        date: parentMessage.sendDate,
        promise: parentMessage.body,
        ask: parentMessage.conversationCue,
        avoid: parentMessage.avoid,
        steps: [],
        coverImage: parentGuideCoverImage('Parent Corner'),
        thumbnailImage: parentGuideThumbnailImage('Parent Corner'),
        coverPosition: parentGuideCoverPosition('Parent Corner'),
        completedAt: parentGuideProgress['daily-parent-corner'] || ''
      }
    ];
  const selectedContent = parentContent.find((item) => item.id === selectedParentContentId);
  const latestGuide = parentContent[0];

  useEffect(() => {
    localStorage.setItem(parentGuideProgressStorageKey, JSON.stringify(parentGuideProgress));
  }, [parentGuideProgress]);

  function completeParentGuide(guideId) {
    setParentGuideProgress((current) => {
      if (current[String(guideId)]) return current;
      return {
        ...current,
        [String(guideId)]: todayKey()
      };
    });
  }

  if (selectedContent) {
    return (
      <section className="panel parent-corner-detail">
        <button className="plan-back-button" onClick={() => setSelectedParentContentId('')} type="button">
          Back to Parent Corner
        </button>
        <PanelTitle icon={<Users size={18} />} title={selectedContent.seriesTitle} action={selectedContent.date} />
        <div className="parent-guide-read-header">
          <span>{selectedContent.category}</span>
          <h2>{selectedContent.title}</h2>
          {selectedContent.completedAt && <em>Completed {selectedContent.completedAt}</em>}
          <p>{selectedContent.promise}</p>
        </div>
        <div className="parent-guide-reader-body">
          {selectedContent.steps.length ? (
            <PlanEpisode steps={selectedContent.steps} planId={selectedContent.id} preserveHeadings />
          ) : (
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
          )}
          <button
            className={selectedContent.completedAt ? 'secondary-action submitted parent-guide-complete' : 'secondary-action parent-guide-complete'}
            disabled={Boolean(selectedContent.completedAt)}
            onClick={() => completeParentGuide(selectedContent.id)}
            type="button"
          >
            <Check size={16} />
            {selectedContent.completedAt ? 'Guide Completed' : 'Mark as Complete'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="panel parent-corner-hero">
        <PanelTitle icon={<Users size={18} />} title="Parent Corner" action={`${parentContent.length} ${parentContent.length === 1 ? 'guide' : 'guides'}`} />
        <h2>Lead the home environment with purpose.</h2>
        <div className="goal-reminder">
          <strong>How to use this</strong>
          <span>Open a parent guide when you want a clear framework for supporting your athlete without crowding their process.</span>
        </div>
      </section>

      <section className="panel parent-corner-library">
        <PanelTitle icon={<Sparkles size={18} />} title="Continue Parent Guide" action={latestGuide.date} />
        <button
          className="continue-plan-card parent-guide-card has-cover"
          onClick={() => setSelectedParentContentId(latestGuide.id)}
          style={{ '--plan-cover': `url(${latestGuide.coverImage})`, '--plan-cover-position': latestGuide.coverPosition }}
          type="button"
        >
          <div className="plan-cover" aria-hidden="true" />
          <div className="plan-card-copy">
            <strong>{latestGuide.seriesTitle}</strong>
            <em>{latestGuide.completedAt ? `Completed ${latestGuide.completedAt}` : latestGuide.title}</em>
            <p>{latestGuide.promise}</p>
          </div>
        </button>
      </section>

      <section className="panel parent-corner-library">
        <PanelTitle icon={<Target size={18} />} title="Browse Parent Content" action={`${parentContent.length} shown`} />
        <div className="plan-category-strip" aria-label="Parent content categories">
          <button className="active" type="button">All</button>
        </div>
        <div className="plan-list">
          {parentContent.map((item) => (
            <button
              className="plan-list-row parent-guide-row has-cover"
              key={item.id}
              onClick={() => setSelectedParentContentId(item.id)}
              style={{ '--plan-cover': `url(${item.coverImage})`, '--plan-thumb': `url(${item.thumbnailImage})`, '--plan-cover-position': item.coverPosition }}
              type="button"
            >
              <div className="plan-cover-thumb" aria-hidden="true" />
              <strong>{item.seriesTitle}</strong>
              <p>{item.promise}</p>
              <em>{item.completedAt ? `Completed ${item.completedAt}` : item.date}</em>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function ParentPlanLibrary({ plans, planProgress, setPlanProgress, notifyUser }) {
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

  function completeParentPlan(planId) {
    const plan = sequencedPlans.find((item) => String(item.id) === String(planId));
    if (!plan?.unlocked || plan.completedAt || !setPlanProgress) return;

    setPlanProgress((current) => ({
      ...current,
      [String(planId)]: today
    }));
    notifyUser?.('Lesson marked complete', 'The next lesson will open tomorrow.', 'success', {
      type: 'planUnlocks',
      id: `parent-plan-complete-${planId}-${Date.now()}`
    });
  }

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
                {selectedPlan.unlocked && (
                  <button
                    className={selectedPlan.completedAt ? 'secondary-action submitted' : 'secondary-action'}
                    disabled={Boolean(selectedPlan.completedAt)}
                    onClick={() => completeParentPlan(selectedPlan.id)}
                    type="button"
                  >
                    <Check size={16} />
                    {selectedPlan.completedAt ? 'Lesson Completed' : 'Mark Lesson Complete'}
                  </button>
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
    ['home', Home, 'today'],
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

function ParentBottomNav({ tab, setTab }) {
  const items = [
    ['overview', BarChart3, 'overview'],
    ['parent-corner', BookOpen, 'parent corner'],
    ['settings', Bell, 'settings']
  ];
  return (
    <nav className="bottom-nav parent-bottom-nav" aria-label="Parent navigation">
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
      {action ? <em>{action}</em> : null}
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
