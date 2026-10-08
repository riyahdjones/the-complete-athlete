import { startSocialAuth, finishSocialProfile, completeSocialRedirect } from './socialAuth';
import { canRequestNativeAppReview, recordParentAppOpen, requestAppReview } from './appReview';
import { syncGoalWidgets } from './goalWidget';
import { planAudioPlayer } from './planAudioPlayer';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock,
  Copy,
  Download,
  Dumbbell,
  Eye,
  EyeOff,
  Flame,
  GraduationCap,
  Goal,
  Home,
  Leaf,
  LineChart,
  LockKeyhole,
  MessageCircle,
  Mic,
  Pause,
  PenLine,
  Play,
  Plus,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  Star,
  Target,
  Trash2,
  Trophy,
  UserRound,
  Users,
  Volume2,
  X
} from 'lucide-react';
import { createCollegeRecruitingParentGuide } from './collegeRecruitingParentGuide';
import { createPerformancePlanSeeds } from './performancePlans';
import {
  athleteRankProgress,
  athleteRanks,
  deriveDevelopmentProfile,
  generateJourney,
  journeyProgress,
  journeyQuestions,
  reconcileJourney
} from './athleteJourney';
import {
  clearMembershipAccessCache,
  loadMembershipAccessCache,
  resolvePremiumAccess,
  saveMembershipAccessCache,
  shouldClearSavedSession
} from './membershipCache';
import spanishPlanTranslations from './performancePlans.es.json';
import {
  getInitialLanguage,
  installDocumentTranslation,
  localizePlans,
  translateText,
  saveLanguagePreference,
  supportedLanguages
} from './i18n';
import GameDayMode, { gameDayBadgeCounts, getRecentGameDayContext, loadGameDaySessions } from './GameDayMode';
import GoalCommandCenter from './GoalsScreen';
import { createCoachVoiceController } from './coachVoice';
import {
  canUseNativePurchases,
  loadRevenueCatSubscription,
  purchaseRevenueCatSubscription,
  restoreRevenueCatSubscription,
  revenueCatConfig
} from './revenueCat';
import { isSupabaseConfigured, supabase, oauthSupabase } from './supabaseClient';
import './styles.css';

const LEGAL_URLS = {
  privacy: 'https://the-complete-athlete.vercel.app/privacy.html',
  support: 'https://the-complete-athlete.vercel.app/support.html',
  terms: 'https://the-complete-athlete.vercel.app/terms.html'
};

const PASSWORD_RESET_REDIRECT_URL = 'https://the-complete-athlete.vercel.app/?passwordRecovery=1';

function hasPasswordRecoveryIntent() {
  if (typeof window === 'undefined') return false;
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return query.get('passwordRecovery') === '1' || hash.get('type') === 'recovery';
}

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
    if (updateKeyboardState() || isTextEntryActive()) return;
    const viewportHeight = Math.floor(window.visualViewport?.height || window.innerHeight || 0);
    if (viewportHeight > 0) {
      document.documentElement.style.setProperty('--app-height', `${viewportHeight}px`);
    }
  };

  if (isNativeShell) {
    document.documentElement.classList.add('native-shell');
    let nativeTouchStartX = 0;
    let nativeTouchStartY = 0;
    const isNativeHorizontalScroller = (element) => (
      element instanceof Element && Boolean(element.closest('[data-native-horizontal-scroll="true"]'))
    );
    const lockHorizontalScroll = () => {
      if (isTextEntryActive()) return;
      if (window.scrollX) window.scrollTo(0, window.scrollY);
      document.documentElement.scrollLeft = 0;
      if (document.body) document.body.scrollLeft = 0;
      document.querySelectorAll('*').forEach((element) => {
        if (element.scrollLeft && !element.matches('[data-native-horizontal-scroll="true"]')) element.scrollLeft = 0;
      });
    };
    const containNativeOverflow = () => {
      const viewportWidth = Math.floor(window.innerWidth || document.documentElement.clientWidth || 390);
      const offenders = [];

      document.querySelectorAll('body *').forEach((element) => {
        if (!(element instanceof HTMLElement)) return;
        if (element.closest('svg')) return;
        if (isNativeHorizontalScroller(element)) return;
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
      if (updateKeyboardState() || isTextEntryActive()) {
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
      if (isTextEntryActive() || target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type === 'range')) return;
      if (isNativeHorizontalScroller(target)) return;
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
  if (!Array.isArray(standards)) return standardsSeed;
  if (standards.length === 0) return [];
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
const athleteJourneyStorageKey = 'the-complete-athlete-first-21-journey';
const onboardingStorageKey = 'the-ninety-percent-onboarding-complete';
const athleteStartStorageKey = 'the-complete-athlete-start-today-complete';
const parentStartAccountsStorageKey = 'the-complete-athlete-parent-first-value-accounts';
const parentStarterPlanStorageKey = 'the-complete-athlete-parent-starter-plan';
const parentAssessmentStorageKey = 'the-complete-athlete-parent-assessments';
const trialAccessStorageKey = 'the-complete-athlete-trial-access-expires';
const authUsersStorageKey = 'the-ninety-percent-auth-users';
const authSessionStorageKey = 'the-ninety-percent-auth-session';
const notificationPrefsStorageKey = 'the-ninety-percent-notification-preferences';
const prototypeBypassLogin = false;
const appReviewPassword = 'Review2026!';
const appReviewEmails = {
  athlete: 'athlete-review@thecompleteathlete.app',
  parent: 'parent-review@thecompleteathlete.app',
  demo: 'review@thecompleteathlete.app'
};
const productionApiOrigin = import.meta.env.VITE_API_ORIGIN || 'https://the-complete-athlete.vercel.app';

function appReviewRoleForEmail(email, fallbackRole = 'athlete') {
  if (email === appReviewEmails.athlete) return 'athlete';
  if (email === appReviewEmails.parent) return 'parent';
  if (email === appReviewEmails.demo) return fallbackRole === 'parent' ? 'parent' : 'athlete';
  return '';
}

function appApiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window === 'undefined') return cleanPath;

  const host = window.location.host;
  const isProductionWeb = host === 'the-complete-athlete.vercel.app';
  return isProductionWeb ? cleanPath : `${productionApiOrigin}${cleanPath}`;
}

function syncAppUserToHighLevel(accessToken) {
  if (!accessToken) return;
  fetch(appApiUrl('/api/track?action=new-user'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  }).catch(() => {});
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
  gameDayCheckInCompleted: 15,
  integrationDayCompleted: 20,
  journeyCompleted: 250,
  streakBonusPerDay: 5,
  streakBonusCap: 25
};

let pointsAudioContext = null;

function playPointsEarnedSound(points = 0) {
  if (typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const context = pointsAudioContext && pointsAudioContext.state !== 'closed'
      ? pointsAudioContext
      : new AudioContextClass();
    pointsAudioContext = context;
    if (context.state === 'suspended') context.resume().catch(() => {});

    const now = context.currentTime + 0.02;
    const master = context.createGain();
    const bonus = Number(points) >= 100;
    const notes = bonus ? [392, 493.88, 659.25, 987.77, 1174.66] : [392, 493.88, 659.25, 987.77];
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.16, now + 0.035);
    master.gain.exponentialRampToValueAtTime(0.0001, now + (bonus ? 0.7 : 0.58));
    master.connect(context.destination);

    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + [0, 0.09, 0.18, 0.3, 0.43][index];
      const stop = start + (index >= notes.length - 2 ? 0.26 : 0.18);
      oscillator.type = index >= notes.length - 2 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(index >= notes.length - 2 ? 0.16 : 0.22, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, stop);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(stop + 0.02);
    });
  } catch {
    // Audio feedback is a bonus; never block the points flow.
  }
}

const notificationPreferenceSeed = {
  dailyDeposits: true,
  performancePlans: true,
  planUnlocks: true,
  streaks: true,
  productivity: true,
  points: true,
  parentUpdates: true,
  inactivityReminders: true,
  browserPush: true
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
    recommendedPlanTitle: 'Control the Controllables',
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
    recommendedPlanTitle: 'Building a Positive Self Image',
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
    recommendedPlanTitle: 'The 90%',
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
    recommendedPlanTitle: 'Champion Habits',
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
    recommendedPlanTitle: 'The Thermostat',
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
    recommendedPlanTitle: 'Compete Differently',
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
    recommendedPlanTitle: 'The Next Play',
    planKeywords: ['mindset', 'identity', 'confidence']
  }
];

function athleteChallengeById(id) {
  return athleteChallengeOptions.find((challenge) => challenge.id === id) ?? athleteChallengeOptions[0];
}

function athleteChallengesByIds(ids, fallbackId = '') {
  const requestedIds = Array.isArray(ids) ? ids : [];
  const cleanIds = [...new Set(requestedIds.map(String).filter(Boolean))];
  if (!cleanIds.length && fallbackId) cleanIds.push(String(fallbackId));
  const matches = cleanIds
    .map((id) => athleteChallengeOptions.find((challenge) => challenge.id === id))
    .filter(Boolean);
  return matches.length ? matches : [athleteChallengeOptions[0]];
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
  return String(email ?? '').trim().toLowerCase();
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
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

function notificationsFromLast24Hours(notifications, now = Date.now()) {
  const cutoff = now - (24 * 60 * 60 * 1000);
  return notifications.filter((notification) => {
    const createdAt = new Date(notification.createdAt).getTime();
    return Number.isFinite(createdAt) && createdAt >= cutoff && createdAt <= now;
  });
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
    inactivityReminders: row?.inactivity_reminders ?? notificationPreferenceSeed.inactivityReminders,
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
    inactivity_reminders: Boolean(preferences.inactivityReminders),
    browser_push: Boolean(preferences.browserPush),
    updated_at: new Date().toISOString()
  };
}

function loadJournalEntries(ownerId = loadAuthSession()?.id) {
  try {
    const key = `${journalStorageKey}:${ownerId || 'guest'}`;
    const legacyOwnerKey = `${journalStorageKey}:legacy-owner`;
    if (ownerId && ownerId === loadAuthSession()?.id && !localStorage.getItem(legacyOwnerKey)) {
      const legacy = localStorage.getItem(journalStorageKey);
      if (legacy && !localStorage.getItem(key)) localStorage.setItem(key, legacy);
      localStorage.setItem(legacyOwnerKey, ownerId);
    }
    const saved = JSON.parse(localStorage.getItem(key) ?? '[]');
    const entries = Array.isArray(saved) ? saved.map((entry) => ({ linkedGoalId: null, ...entry, ...(!isSupabaseId(entry.id) ? { id: crypto.randomUUID(), ownerId, pending: true } : {}) })) : [];
    localStorage.setItem(key, JSON.stringify(entries));
    return entries;
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

function parentSequencedPlanAccess(plans, planProgress, date = todayKey()) {
  const sortedPlans = [...plans].sort((first, second) => (
    planSeriesTitle(first).localeCompare(planSeriesTitle(second))
    || planDayNumber(first) - planDayNumber(second)
    || String(first.title).localeCompare(String(second.title))
  ));
  const previousBySeries = new Map();

  return sortedPlans.map((plan) => {
    const series = planSeriesTitle(plan);
    const previousPlan = previousBySeries.get(series);
    const previousCompleted = !previousPlan || Boolean(planProgress[String(previousPlan.id)]);
    const completedAt = planProgress[String(plan.id)] || '';
    const released = !plan.releaseDate || plan.releaseDate <= date;
    previousBySeries.set(series, plan);
    return {
      ...plan,
      completedAt,
      unlocked: released && previousCompleted,
      unlockDate: previousCompleted ? '' : 'Complete the previous day'
    };
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
      currentChallenges: Array.isArray(saved.currentChallenges)
        ? saved.currentChallenges
        : saved.currentChallenge ? [saved.currentChallenge] : [],
      journeyAnswers: saved.journeyAnswers && typeof saved.journeyAnswers === 'object' ? saved.journeyAnswers : {},
      developmentProfile: saved.developmentProfile && typeof saved.developmentProfile === 'object' ? saved.developmentProfile : null,
      parentAccessCode: saved.parentAccessCode ?? 'TCA-PARENT'
    };
  } catch {
    return { name: '', sport: '', age: '', location: '', photo: '', parentContact: '', currentChallenge: '', currentChallenges: [], journeyAnswers: {}, developmentProfile: null, parentAccessCode: 'TCA-PARENT' };
  }
}

function prepareProfilePhoto(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const maxDimension = 720;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');

      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Photo processing is unavailable.'));
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      const preview = canvas.toDataURL('image/jpeg', 0.82);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (!blob) {
          reject(new Error('Photo processing failed.'));
          return;
        }
        resolve({
          file: new File([blob], 'profile.jpg', { type: 'image/jpeg' }),
          preview
        });
      }, 'image/jpeg', 0.82);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('That photo could not be opened.'));
    };
    image.src = objectUrl;
  });
}

function loadOnboardingComplete() {
  try {
    return localStorage.getItem(onboardingStorageKey) === 'true';
  } catch {
    return false;
  }
}

function loadAthleteJourney(ownerId = loadAuthSession()?.id) {
  try {
    const saved = JSON.parse(localStorage.getItem(athleteJourneyStorageKey) || 'null');
    if (saved?.ownerId && ownerId && String(saved.ownerId) !== String(ownerId)) return null;
    return saved?.days?.length === 21 ? saved : null;
  } catch {
    return null;
  }
}

function loadAthleteStartComplete() {
  try {
    return localStorage.getItem(athleteStartStorageKey) === 'true';
  } catch {
    return false;
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
  { id: 4, label: 'Daily Activity Tracker', value: 'Win today through controllables', progress: 50 }
];

const plansSeed = createPerformancePlanSeeds(todayKey);

function normalizePlan(plan) {
  return {
    ...plan,
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

function planMergeKey(plan) {
  const series = planSeriesTitle(plan)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const day = String(plan?.challengeDay ?? '')
    .toLowerCase()
    .match(/\d+/)?.[0];

  if (series && series !== 'performance-plans' && day) {
    return `series:${series}:day:${day}`;
  }
  return `id:${String(plan?.id ?? '')}`;
}

function mergeWithSeedPlans(sourcePlans) {
  const nextPlans = [];
  (Array.isArray(sourcePlans) ? sourcePlans : []).map(normalizePlan).forEach((plan) => {
    const mergeKey = planMergeKey(plan);
    const existingIndex = nextPlans.findIndex((sourcePlan) => planMergeKey(sourcePlan) === mergeKey);
    if (existingIndex >= 0) {
      nextPlans[existingIndex] = plan;
    } else {
      nextPlans.push(plan);
    }
  });

  plansSeed.map(normalizePlan).forEach((plan) => {
    const mergeKey = planMergeKey(plan);
    const existingIndex = nextPlans.findIndex((sourcePlan) => planMergeKey(sourcePlan) === mergeKey);
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
    const stored = localStorage.getItem(goalsStorageKey);
    if (stored === null) return goalsSeed;
    const saved = JSON.parse(stored);
    return Array.isArray(saved) ? saved : goalsSeed;
  } catch {
    return goalsSeed;
  }
}

function isSupabaseId(id) {
  return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
}

function goalFromSupabase(row, localGoal = {}) {
  return {
    ...localGoal,
    id: row.id,
    label: row.label ?? '',
    value: row.value ?? '',
    progress: Math.max(0, Math.min(100, Number(row.progress) || 0)),
    category: row.category || localGoal.category || row.label || '',
    affirmation: row.affirmation ?? localGoal.affirmation ?? '',
    targetDate: row.target_date ?? localGoal.targetDate ?? '',
    milestones: Array.isArray(row.milestones)
      ? row.milestones
      : Array.isArray(localGoal.milestones) ? localGoal.milestones : []
  };
}

function goalToSupabase(goal, athleteUserId) {
  const payload = {
    athlete_user_id: athleteUserId,
    label: goal.label ?? '',
    value: goal.value ?? '',
    progress: Math.max(0, Math.min(100, Number(goal.progress) || 0)),
    category: goal.category ?? goal.label ?? '',
    affirmation: goal.affirmation ?? '',
    target_date: goal.targetDate || null,
    milestones: Array.isArray(goal.milestones) ? goal.milestones : []
  };

  if (isSupabaseId(goal.id)) payload.id = goal.id;
  return payload;
}

const goalSelectColumns = 'id, label, value, progress, category, affirmation, target_date, milestones';
const legacyGoalSelectColumns = 'id, label, value, progress';

async function fetchGoalsForAthlete(athleteUserId) {
  let result = await supabase
    .from('goals')
    .select(goalSelectColumns)
    .eq('athlete_user_id', athleteUserId)
    .order('created_at', { ascending: true });
  if (result.error) {
    result = await supabase
      .from('goals')
      .select(legacyGoalSelectColumns)
      .eq('athlete_user_id', athleteUserId)
      .order('created_at', { ascending: true });
  }
  return result;
}

function legacyGoalPayload(goal, athleteUserId) {
  const payload = goalToSupabase(goal, athleteUserId);
  delete payload.category;
  delete payload.affirmation;
  delete payload.target_date;
  delete payload.milestones;
  return payload;
}

async function insertGoalsForAthlete(goals, athleteUserId) {
  let result = await supabase
    .from('goals')
    .insert(goals.map((goal) => goalToSupabase(goal, athleteUserId)))
    .select(goalSelectColumns);
  if (result.error) {
    result = await supabase
      .from('goals')
      .insert(goals.map((goal) => legacyGoalPayload(goal, athleteUserId)))
      .select(legacyGoalSelectColumns);
  }
  return result;
}

async function upsertGoalsForAthlete(goals, athleteUserId) {
  let result = await supabase.from('goals').upsert(goals.map((goal) => goalToSupabase(goal, athleteUserId)));
  if (result.error) {
    result = await supabase.from('goals').upsert(goals.map((goal) => legacyGoalPayload(goal, athleteUserId)));
  }
  return result;
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
    currentChallenges: Array.isArray(currentProfile.currentChallenges) ? currentProfile.currentChallenges : [],
    parentAccessCode: row?.parent_access_code ?? currentProfile.parentAccessCode ?? 'TCA-PARENT'
  };
}

function standardFromSupabase(row) {
  const isToday = !row.entry_date || row.entry_date === todayKey();
  return {
    id: row.id,
    label: row.label ?? '',
    done: isToday ? Boolean(row.done) : false,
    goalId: row.goal_id ?? null
  };
}

function standardToSupabase(standard, athleteUserId) {
  const payload = {
    athlete_user_id: athleteUserId,
    label: standard.label ?? '',
    goal_id: isSupabaseId(standard.goalId) ? standard.goalId : null,
    done: Boolean(standard.done),
    entry_date: todayKey(),
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
    createdAt: row.created_at,
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
  if (entry.createdAt) payload.created_at = entry.createdAt;
  return payload;
}

async function fetchJournalHistory(ownerId) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const result = await supabase.from('journal_entries').select('id, goal_id, entry_type, body, created_at').eq('athlete_user_id', ownerId).order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
    if (result.error) return { data: null, error: result.error };
    rows.push(...result.data);
    if (result.data.length < 500) return { data: rows, error: null };
  }
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
    body: row.body ?? '',
    titleEs: row.title_es ?? '',
    bodyEs: row.body_es ?? '',
    focusQuestionEs: row.focus_question_es ?? ''
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
    challengeLength: row.challenge_length,
    titleEs: row.title_es,
    subjectEs: row.subject_es,
    stepsEs: Array.isArray(row.steps_es) ? row.steps_es : [],
    challengeDayEs: row.challenge_day_es
  });
}

function parentMessageFromSupabase(row) {
  return {
    title: row.title ?? parentMessageSeed.title,
    body: row.body ?? parentMessageSeed.body,
    conversationCue: row.conversation_cue ?? parentMessageSeed.conversationCue,
    avoid: row.avoid ?? parentMessageSeed.avoid,
    sendDate: row.send_date ?? todayKey(),
    status: row.status === 'sent' ? 'Sent' : row.status === 'scheduled' ? 'Scheduled' : 'Draft',
    titleEs: row.title_es ?? '',
    bodyEs: row.body_es ?? '',
    conversationCueEs: row.conversation_cue_es ?? '',
    avoidEs: row.avoid_es ?? ''
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
    guideLength: Number(row.guide_length) || 1,
    seriesTitleEs: row.series_title_es ?? '',
    titleEs: row.title_es ?? '',
    categoryEs: row.category_es ?? '',
    subjectEs: row.subject_es ?? '',
    stepsEs: Array.isArray(row.steps_es) ? row.steps_es : [],
    guideDayEs: row.guide_day_es ?? ''
  };
}

function parentGuideMergeKey(guide) {
  const series = String(guide?.seriesTitle ?? '').toLowerCase();
  if (series.includes('borrowed confidence')) return 'series:borrowed-confidence';
  if (series.includes('comparison trap')) return 'series:comparison-trap';
  if (series.includes('elite parents') || series.includes('elite athletes need elite parents')) return 'series:elite-parents';
  if (series.includes('pressure isn')) return 'series:pressure-isnt-the-enemy';
  if (series.includes('college recruiting')) return 'series:college-recruiting-101';
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
  if (normalized.includes('college recruiting')) {
    return '/parent-guides/college-recruiting-101-banner.jpg';
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
  if (normalized.includes('college recruiting')) {
    return '/parent-guides/college-recruiting-101-thumbnail.jpg';
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
  if (normalized.includes('college recruiting')) {
    return '50% 50%';
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

function streakFromStandardsHistory(history, endDate = todayKey()) {
  const dates = new Set(normalizeStandardsHistory(history).map((entry) => entry.date));
  const latestDate = [...dates].sort((a, b) => b.localeCompare(a))[0];
  if (!latestDate || daysBetween(latestDate, endDate) > 1) return 0;
  let streak = 0;
  let cursor = latestDate;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function linkedAthleteName(summary, athleteProfile) {
  return summary?.full_name || athleteProfile?.name || 'Linked athlete';
}

const coachTopics = [
  { category: 'Confidence', title: "I'm losing confidence.", prompt: "I'm losing confidence and need help finding my footing.", icon: Sparkles },
  { category: 'Pressure', title: "I'm nervous about tomorrow.", prompt: "I'm nervous about tomorrow and want to feel ready.", icon: Target },
  { category: 'Mistakes', title: 'I made a mistake in a game.', prompt: 'I made a mistake in a game and I keep thinking about it.', icon: RotateCcw },
  { category: 'Coaching', title: 'My coach is getting on me.', prompt: 'My coach is getting on me and I need help responding well.', icon: MessageCircle },
  { category: 'Burnout', title: "I'm feeling burnt out.", prompt: "I'm feeling burnt out and I need help figuring out what to do next.", icon: Dumbbell },
  { category: 'Focus', title: "I can't stop overthinking.", prompt: "I can't stop overthinking and I need help getting back to the present moment.", icon: Brain },
  { category: 'Playing time', title: "I'm frustrated with my role.", prompt: "I'm frustrated with my role and how much I'm playing.", icon: Trophy },
  { category: 'Motivation', title: "I don't feel motivated.", prompt: "I don't feel motivated to train right now.", icon: Flame },
  { category: 'Game day', title: 'Help me get locked in.', prompt: 'I have a game coming up and I need help getting locked in.', icon: Goal },
  { category: 'Team', title: "I'm frustrated with a teammate.", prompt: "I'm frustrated with a teammate and want to handle it the right way.", icon: Users },
  { category: 'Comparison', title: "Everyone feels ahead of me.", prompt: "I'm comparing myself to other athletes and it feels like everyone is ahead of me.", icon: LineChart },
  { category: 'After the game', title: 'I played badly today.', prompt: 'I played badly today and I need help processing it.', icon: Shield }
];

const parentMessageSeed = {
  title: 'Coach the daily work, not the scoreboard.',
  body: 'Your athlete is learning to separate identity from performance. Reinforce the work they are building, not only the result they produced.',
  conversationCue: 'Ask tonight: “What did you control today?”',
  avoid: 'Avoid leading with stats, mistakes, or playing time.',
  sendDate: todayKey(),
  status: 'Scheduled'
};

const parentStarterPlanRecommendations = [
  {
    id: 'home-court-advantage-seed',
    title: 'Home Court Advantage',
    category: 'Home Support',
    description: 'Create a safe home environment where your athlete can recover, grow, and stay connected.'
  },
  {
    id: 'raising-complete-athlete-seed',
    title: 'Raising a Complete Athlete',
    category: 'Whole Athlete',
    description: 'Build confidence, discipline, and character beyond the scoreboard.'
  },
  {
    id: 'pressure-isnt-the-enemy-3-day-plan',
    title: "Pressure Isn't the Enemy",
    category: 'Resilience',
    description: 'Help your athlete respond to pressure with preparation, calm, and resilience.'
  }
];

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
    createCollegeRecruitingParentGuide(releaseDate),
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

function ManifestoLandingPage() {
  const [manifestoFormOpen, setManifestoFormOpen] = useState(false);
  const [manifestoFormSubmitted, setManifestoFormSubmitted] = useState(false);
  const [manifestoFormSubmitting, setManifestoFormSubmitting] = useState(false);
  const [manifestoFormError, setManifestoFormError] = useState('');
  const [manifestoLead, setManifestoLead] = useState({ name: '', email: '', phone: '', smsConsent: false });
  const trainingList = ['their swing...', 'their shot...', 'their speed...', 'their mechanics...'];
  const painSignals = [
    ['It looks like', 'an athlete who dominates practice, then plays tight when the lights come on.'],
    ['It sounds like', '"I do not know what happened. I just could not get out of my head."'],
    ['It becomes', 'one mistake turning into a whole game of hesitation, frustration, and fear.'],
    ['So families try', 'more lessons, more tournaments, more reps, more pressure, and more correction.'],
    ['But underneath', 'confidence, identity, beliefs, habits, and pressure response are running the performance.'],
    ['And eventually', 'talent gets passed by athletes who know how to think, reset, and compete with control.']
  ];
  const learningCards = [
    ['The Lie We Have All Been Told', 'Why working harder is not always the answer.'],
    ['The Person Behind The Performance', 'The hidden identity creating every result.'],
    ['The Athletic Operating System', 'The framework elite performers unknowingly follow.'],
    ['Why Confidence Comes And Goes', 'How to build confidence that survives failure.'],
    ['How To Rewire Performance', 'Practical ways to change your habits, thoughts, and results.']
  ];
  const unlockCallouts = [
    'Unshakable Confidence',
    'Stronger Identity',
    'Mental Toughness',
    'Better Focus',
    'Emotional Control',
    'Championship Habits'
  ];
  const imagineList = [
    'walked into every game expecting success.',
    'stopped letting one mistake ruin an entire performance.',
    'knew exactly how to reset after failure.',
    'understood confidence instead of chasing it.',
    'began developing the same mental tools elite athletes spend years discovering.'
  ];
  const operatingLayers = [
    ['Performance', 'what everyone sees'],
    ['Habits', 'what athletes repeat'],
    ['Beliefs', 'what athletes expect'],
    ['Identity', 'who athletes believe they are']
  ];
  const openManifestoForm = (event) => {
    event.preventDefault();
    setManifestoFormSubmitted(false);
    setManifestoFormError('');
    setManifestoFormOpen(true);
  };
  const closeManifestoForm = () => {
    setManifestoFormOpen(false);
    setManifestoFormSubmitted(false);
    setManifestoFormError('');
  };
  const submitManifestoForm = async (event) => {
    event.preventDefault();
    setManifestoFormSubmitting(true);
    setManifestoFormError('');
    const lead = {
      name: manifestoLead.name.trim(),
      email: manifestoLead.email.trim(),
      phone: manifestoLead.phone.trim(),
      smsConsent: manifestoLead.smsConsent,
      source: 'Ninety Percent Manifesto',
      submittedAt: new Date().toISOString()
    };

    try {
      const response = await fetch(appApiUrl('/api/manifesto-lead'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Lead submission failed.');
      }

      try {
        const storedLeads = JSON.parse(window.localStorage?.getItem('manifestoLeads') || '[]');
        window.localStorage?.setItem('manifestoLeads', JSON.stringify([lead, ...storedLeads].slice(0, 50)));
      } catch {
        // GHL is the source of truth; local storage is only a convenience for local previews.
      }
      setManifestoFormSubmitted(true);
    } catch {
      setManifestoFormError('Something went wrong. Please check your details and try again.');
    } finally {
      setManifestoFormSubmitting(false);
    }
  };
  const updateManifestoLead = (field, value) => {
    setManifestoLead((current) => ({ ...current, [field]: value }));
  };

  return (
    <main className="manifesto-page">
      <section className="manifesto-hero">
        <div className="manifesto-mobile-hero-image">
          <img src="/landing/father-son-blue-hero.png" alt="Father and son preparing together for competition" />
        </div>

        <div className="manifesto-hero-content">
          <div className="manifesto-copy">
            <h1>Everyone says sports are 90% mental. Almost nobody teaches what that actually means.</h1>
            <p className="manifesto-lead">
              Every year, millions of athletes spend thousands of hours practicing:
            </p>
            <div className="manifesto-training-list" aria-label="Common physical training focus areas">
              {trainingList.map((item) => <span key={item}>{item}</span>)}
            </div>
            <p className="manifesto-parent-hook">
              while completely ignoring the part that controls all of them. If sports are truly 90% mental, why does
              nobody train the ninety percent?
            </p>
            <div className="manifesto-hero-offer">
              <div className="manifesto-actions">
                <a className="manifesto-primary" href="/the-90-manifesto.pdf" download onClick={openManifestoForm}>
                  <Download size={20} />
                  Download the Complete Athlete Manifesto
                </a>
                <span className="manifesto-free-badge">Free</span>
              </div>
              <ManifestoCoverMockup />
            </div>
          </div>
        </div>
      </section>

      <section className="manifesto-section manifesto-credibility">
        <div className="manifesto-section-copy">
          <p className="manifesto-kicker">Why I wrote this</p>
          <h2>Riyahd Jones learned the mental side the hard way.</h2>
          <p>
            Before becoming a coach, leader, and entrepreneur, Riyahd Jones was an SEC athlete at the University of
            Tennessee and a Top-10 nationally ranked junior college cornerback. But some of his most important lessons
            about performance came after the games were over.
          </p>
          <p>
            Years spent competing at a high level, building successful teams, leading in business, and studying the
            principles behind human performance revealed something he wishes he had understood much earlier:
          </p>
          <p className="manifesto-emphasis">
            Talent can get you in the room, but your mindset, identity, habits, beliefs, and ability to handle pressure
            determine what you do once you get there.
          </p>
          <p>
            This manifesto was built to give young athletes the mental tools he wishes someone had given him: to develop
            not just better players, but complete athletes.
          </p>
        </div>
        <div className="manifesto-credibility-photo">
          <img src="/landing/riyahd-tennessee-football.jpg" alt="Riyahd Jones playing football at the University of Tennessee" />
        </div>
      </section>

      <section className="manifesto-section manifesto-pain">
        <div className="manifesto-section-copy">
          <h2>Your Athlete Has the Talent. So Why Doesn't It Always Show Up?</h2>
          <p>
            You can see the ability. You've watched it show up in practice. You've seen flashes of what they're capable
            of. But when the pressure rises, adversity hits, or confidence starts to slip, something changes.
          </p>
          <p>
            And that's when everyone starts searching for the visible problem: mechanics, effort, toughness, coaching,
            playing time.
          </p>
          <p>
            But what if the problem isn't physical at all?
          </p>
          <p>
            What if your athlete has spent years training their body and their game, but almost no time learning how to
            train the part responsible for controlling both?
          </p>
        </div>
        <div className="manifesto-list manifesto-pain-list">
          {painSignals.map(([label, body]) => (
            <div className="manifesto-list-row manifesto-pain-row" key={label}>
              <AlertDot />
              <span>
                <strong>{label}</strong>
                {body}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="manifesto-section manifesto-big-idea">
        <div className="manifesto-section-copy">
          <h2>Performance isn't built on the field or the court. It's revealed there.</h2>
          <p>
            What happens during the game is only the part everyone gets to see.
          </p>
          <p>
            The missed shot. The bad swing. The dropped pass. The hesitation under pressure. The mistake that turns into
            three more.
          </p>
          <p>So that's where most athletes try to fix the problem.</p>
          <p>
            <strong>But the result isn't the source. It's the evidence.</strong>
          </p>
          <p>
            Long before performance shows up on the field, something deeper is already at work: an athlete's beliefs,
            identity, thoughts, habits, expectations, and response to pressure.
          </p>
          <p>
            Those invisible forces shape the decisions they make, the confidence they carry, and ultimately, the athlete
            who shows up when the moment gets big.
          </p>
          <p>
            <strong>
              You don't change performance by constantly chasing the result. You change the system producing it.
            </strong>
          </p>
          <p>
            And that's where the other 90% begins.
          </p>
        </div>
        <div className="manifesto-operating-stack" aria-label="Performance operating system">
          {operatingLayers.map(([layer, description], index) => (
            <React.Fragment key={layer}>
              <div className={index === 0 ? 'top' : ''}>
                <strong>{layer}</strong>
                <span>{description}</span>
              </div>
              {index < 3 ? <ArrowUpIcon /> : null}
            </React.Fragment>
          ))}
        </div>
      </section>

      <section className="manifesto-section manifesto-blue-band">
        <div className="manifesto-unlock-intro">
          <p className="manifesto-kicker">What the manifesto unlocks</p>
          <h2>The part of performance most athletes have never been taught to train.</h2>
          <div className="manifesto-unlock-copy">
            <p>
              This manifesto isn't about adding more pressure, more workouts, or more information to an athlete's
              plate. It's about unlocking the part of performance most athletes have never been taught to train.
            </p>
            <p>
              You'll begin to understand why some athletes rise under pressure while others shrink. Why confidence can
              disappear overnight. Why two athletes with similar talent can have completely different careers. Why
              habits, beliefs, identity, self-talk, focus, and imagination have such a powerful effect on what happens
              when it's time to perform.
            </p>
            <p>
              Most importantly, you'll discover that better performance doesn't always begin with doing more. Sometimes
              it begins with becoming different.
            </p>
            <p>
              This manifesto gives athletes and parents a new lens for understanding performance and a framework for
              developing the other 90%.
            </p>
          </div>
          <div className="manifesto-unlock-callouts" aria-label="What the manifesto helps develop">
            {unlockCallouts.map((callout) => (
              <span key={callout}>{callout}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="manifesto-section manifesto-learn-inside">
        <div className="manifesto-section-copy">
          <p className="manifesto-kicker">What you will learn inside</p>
          <h2>A clearer way to understand the ninety percent.</h2>
        </div>
        <div className="manifesto-promise-grid">
          {learningCards.map(([title, body]) => (
            <article className="manifesto-card" key={title}>
              <BadgeCheck size={22} />
              <strong>{title}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
        <div className="manifesto-plus-more">
          <span>Plus more</span>
          <strong>Additional lessons, reflection prompts, and practical language for helping athletes understand the ninety percent.</strong>
        </div>
      </section>

      <section className="manifesto-section manifesto-imagine">
        <div className="manifesto-visual-panel">
          <img src="/landing/baseball-dugout-blue.png" alt="Baseball player sitting in the dugout after striking out" />
          <div>
            <span>Imagine if</span>
            <strong>Your child had language for the part of the game nobody can see.</strong>
          </div>
        </div>
        <div className="manifesto-section-copy">
          <p className="manifesto-kicker">The transformation</p>
          <h2>Imagine if your child...</h2>
          <div className="manifesto-bridge-list manifesto-imagine-list">
            {imagineList.map((body) => (
              <div key={body}>
                <Check size={20} />
                <span>{body}</span>
              </div>
            ))}
          </div>
          <p className="manifesto-purpose">
            That is the purpose of this manifesto.
          </p>
        </div>
      </section>

      <section className="manifesto-final-cta">
        <p className="manifesto-kicker">Start with the missing piece</p>
        <h2>Download the Ninety Percent and learn what it means to be a complete athlete.</h2>
        <a className="manifesto-primary" href="/the-90-manifesto.pdf" download onClick={openManifestoForm}>
          Download Ninety Percent Manifesto
          <ArrowRight size={20} />
        </a>
      </section>

      <button
        className={`manifesto-sticky-cta${manifestoFormOpen ? ' is-hidden' : ''}`}
        type="button"
        onClick={openManifestoForm}
      >
        <span>
          <strong>Free manifesto</strong>
          Download the Ninety Percent
        </span>
        <ArrowRight size={20} />
      </button>

      {manifestoFormOpen ? (
        <div className="manifesto-modal" role="dialog" aria-modal="true" aria-labelledby="manifesto-form-title">
          <button className="manifesto-modal-backdrop" type="button" aria-label="Close download form" onClick={closeManifestoForm} />
          <div className="manifesto-modal-card">
            <button className="manifesto-modal-close" type="button" aria-label="Close download form" onClick={closeManifestoForm}>
              <X size={20} />
            </button>
            {manifestoFormSubmitted ? (
              <div className="manifesto-form-success">
                <BadgeCheck size={34} />
                <p className="manifesto-kicker">You're in</p>
                <h2 id="manifesto-form-title">Check your email for the manifesto.</h2>
                <p>
                  We sent the Ninety Percent Manifesto to the email you entered. If you do not see it in a few minutes,
                  check your spam or promotions folder.
                </p>
                <button className="manifesto-primary" type="button" onClick={closeManifestoForm}>
                  Back to the page
                  <ArrowRight size={20} />
                </button>
              </div>
            ) : (
              <form className="manifesto-opt-in-form" onSubmit={submitManifestoForm}>
                <p className="manifesto-kicker">Free download</p>
                <h2 id="manifesto-form-title">Get the Ninety Percent Manifesto</h2>
                <p>
                  Enter your details and we will send the manifesto to your inbox.
                </p>
                <label>
                  Name
                  <input
                    type="text"
                    name="name"
                    value={manifestoLead.name}
                    onChange={(event) => updateManifestoLead('name', event.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    name="email"
                    value={manifestoLead.email}
                    onChange={(event) => updateManifestoLead('email', event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </label>
                <label>
                  Phone number
                  <input
                    type="tel"
                    name="phone"
                    value={manifestoLead.phone}
                    onChange={(event) => updateManifestoLead('phone', event.target.value)}
                    placeholder="(555) 123-4567"
                    autoComplete="tel"
                    required
                  />
                </label>
                <label className="manifesto-sms-consent">
                  <input
                    type="checkbox"
                    name="smsConsent"
                    checked={manifestoLead.smsConsent}
                    onChange={(event) => updateManifestoLead('smsConsent', event.target.checked)}
                  />
                  <span>
                    I agree to receive text messages about the Ninety Percent Manifesto and Complete Athlete updates.
                    Message and data rates may apply. Reply STOP to unsubscribe.
                  </span>
                </label>
                {manifestoFormError ? <p className="manifesto-form-error">{manifestoFormError}</p> : null}
                <button className="manifesto-primary" type="submit" disabled={manifestoFormSubmitting}>
                  {manifestoFormSubmitting ? 'Sending...' : 'Send me the manifesto'}
                  <ArrowRight size={20} />
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ManifestoCoverMockup() {
  return (
    <div className="manifesto-cover-mockup" aria-label="The Complete Athlete Manifesto cover preview">
      <span>The Complete Athlete</span>
      <strong>The 90% Manifesto</strong>
      <em>What nobody teaches about the mental side of sports</em>
    </div>
  );
}

function ArrowUpIcon() {
  return <span className="manifesto-stack-arrow" aria-hidden="true" />;
}

function AlertDot() {
  return (
    <span className="manifesto-alert-dot" aria-hidden="true">
      <Target size={15} />
    </span>
  );
}

const privacySeed = {
  readinessVisible: true,
  standardsVisible: true,
  goalsVisible: false,
  journalPrivate: true,
  coachPrivate: true
};

function App() {
  const landingPath = typeof window !== 'undefined' ? window.location.pathname : '';
  if (landingPath === '/manifesto' || landingPath === '/the-90-manifesto') {
    return <ManifestoLandingPage />;
  }

  const [initialDailyState] = useState(loadDailyState);
  const [language, setLanguage] = useState(getInitialLanguage);
  const [authUsers, setAuthUsers] = useState(loadAuthUsers);
  const [authSession, setAuthSession] = useState(loadAuthSession);
  const parentOpenCountedSessionRef = useRef('');
  const [passwordRecoveryActive, setPasswordRecoveryActive] = useState(hasPasswordRecoveryIntent);
  const [onboardingComplete, setOnboardingComplete] = useState(() => (
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('firstTime') === 'athlete'
      ? false
      : loadOnboardingComplete()
  ));
  const [parentOnboardingAccounts, setParentOnboardingAccounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tca-parent-onboarding-accounts') || '{}'); }
    catch { return {}; }
  });
  const [parentStartAccounts, setParentStartAccounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(parentStartAccountsStorageKey) || '{}'); }
    catch { return {}; }
  });
  const [athleteStartComplete, setAthleteStartComplete] = useState(loadAthleteStartComplete);
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
  const [profileView, setProfileView] = useState('overview');
  const [requestedPlanSeriesId, setRequestedPlanSeriesId] = useState('');
  const [requestedPlanId, setRequestedPlanId] = useState('');
  const [parentTab, setParentTab] = useState('overview');
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
  const [journalEntries, setJournalEntries] = useState(() => loadJournalEntries(authSession?.id));
  const [journalOwner, setJournalOwner] = useState(authSession?.id);
  useEffect(() => {
    if (journalOwner !== authSession?.id) {
      setJournalOwner(authSession?.id);
      setJournalEntries(loadJournalEntries(authSession?.id));
    }
  }, [authSession?.id]);
  const [goals, setGoals] = useState(loadGoals);
  const [plans, setPlans] = useState(loadPlans);
  const localizedPlans = useMemo(
    () => localizePlans(plans, language, spanishPlanTranslations, plansSeed),
    [plans, language]
  );
  const [planProgress, setPlanProgress] = useState(loadPlanProgress);
  const [athleteJourney, setAthleteJourney] = useState(loadAthleteJourney);
  const [journeyRemoteReady, setJourneyRemoteReady] = useState(false);
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
  const [linkedAthletes, setLinkedAthletes] = useState([]);
  const [linkedAthleteId, setLinkedAthleteId] = useState(null);
  const [linkedAthleteSummary, setLinkedAthleteSummary] = useState(null);
  const [parentLinkRefreshKey, setParentLinkRefreshKey] = useState(0);
  const [premiumAccessRefreshKey, setPremiumAccessRefreshKey] = useState(0);
  const [, setMembershipCacheRevision] = useState(0);
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
    checked: false,
    package: null,
    message: revenueCatConfig.iosApiKey ? 'Checking premium access...' : 'RevenueCat key is not set yet.'
  });
  const [localTrialAccessActive, setLocalTrialAccessActive] = useState(false);
  const [accessCheckTime, setAccessCheckTime] = useState(() => Date.now());
  const [backendPremiumAccess, setBackendPremiumAccess] = useState({
    loading: isSupabaseConfigured,
    checked: false,
    hasAccess: false,
    activeTrial: false,
    source: 'none',
    sponsorUserId: null,
    expiresAt: ''
  });

  const baseActiveLesson = lessonLibrary.find((lesson) => lesson.id === selectedLessonId) ?? lessonLibrary[0];
  const activeLesson = useMemo(() => language === 'es' && baseActiveLesson ? {
    ...baseActiveLesson,
    title: baseActiveLesson.titleEs || baseActiveLesson.title,
    body: baseActiveLesson.bodyEs || baseActiveLesson.body,
    focusQuestion: baseActiveLesson.focusQuestionEs || baseActiveLesson.focusQuestion
  } : baseActiveLesson, [baseActiveLesson, language]);
  const localizedParentMessage = useMemo(() => language === 'es' ? {
    ...parentMessage,
    title: parentMessage.titleEs || parentMessage.title,
    body: parentMessage.bodyEs || parentMessage.body,
    conversationCue: parentMessage.conversationCueEs || parentMessage.conversationCue,
    avoid: parentMessage.avoidEs || parentMessage.avoid
  } : parentMessage, [parentMessage, language]);
  const localizedParentGuides = useMemo(() => language === 'es' ? parentGuides.map((guide) => ({
    ...guide,
    seriesTitleEn: guide.seriesTitle,
    seriesTitle: guide.seriesTitleEs || guide.seriesTitle,
    title: guide.titleEs || guide.title,
    category: guide.categoryEs || guide.category,
    subject: guide.subjectEs || guide.subject,
    steps: guide.stepsEs?.length ? guide.stepsEs : guide.steps,
    guideDay: guide.guideDayEs || guide.guideDay
  })) : parentGuides, [parentGuides, language]);
  const localAthletePreviewSession = useMemo(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const athletePreview = params.get('firstTime') === 'athlete'
      || params.get('startPreview') === 'athlete'
      || params.get('todayPreview') === 'athlete';
    if (params.get('role') !== 'athlete' || !athletePreview) return null;
    return { id: 'local-athlete-preview', role: 'athlete', name: 'Preview Athlete', email: 'preview-athlete@example.com' };
  }, []);
  const parentFirstTimePreview = Boolean(import.meta.env.DEV && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('firstTime') === 'parent');
  const localParentInviteSession = useMemo(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'parent' && params.get('firstTime') === 'parent') {
      return { id: `local-parent-preview-${params.get('previewId') || 'default'}`, role: 'parent', name: 'Preview Parent', email: 'preview-parent@example.com', parentAccessCode: 'TCA-FAMILY' };
    }
    if (authSession) return null;
    if (params.get('role') !== 'parent' || params.get('parentCode') !== 'TCA-PARENT') return null;
    return { id: 'local-parent-review', role: 'parent', name: 'App Review Parent', email: 'review-parent@example.com', parentAccessCode: 'TCA-FAMILY' };
  }, [authSession]);
  const effectiveSession = (parentFirstTimePreview ? localParentInviteSession : null) ?? localAthletePreviewSession ?? authSession ?? localParentInviteSession ?? (prototypeBypassLogin ? { id: 'demo-athlete', role: 'athlete', name: 'Demo Athlete', email: '' } : null);
  const interfaceLanguage = effectiveSession ? language : 'en';
  useEffect(() => {
    if (effectiveSession) saveLanguagePreference(language);
    else if (typeof document !== 'undefined') document.documentElement.lang = 'en';
    const removeTranslation = installDocumentTranslation(interfaceLanguage);
    return removeTranslation;
  }, [effectiveSession?.id, interfaceLanguage, language]);
  const changeLanguage = useCallback((nextLanguage) => {
    const normalized = saveLanguagePreference(nextLanguage);
    setLanguage(normalized);
    if (isSupabaseConfigured && isSupabaseId(authSession?.id)) {
      supabase.from('profiles').update({ preferred_language: normalized }).eq('id', authSession.id).then(({ error }) => {
        if (error) console.warn('Account language could not be saved.');
      });
      supabase.auth.updateUser({ data: { preferred_language: normalized } }).catch(() => {});
    }
  }, [authSession?.id]);
  useEffect(() => {
    if (!isSupabaseConfigured || !authSession?.id || authSession.role === 'admin') return;
    supabase.auth.getSession().then(({ data }) => {
      syncAppUserToHighLevel(data.session?.access_token || '');
    }).catch(() => {});
  }, [authSession?.id, authSession?.role]);
  const isAuthed = Boolean(effectiveSession) && !passwordRecoveryActive;
  const isLocalPreviewSession = Boolean(localAthletePreviewSession || localParentInviteSession || prototypeBypassLogin);
  const cachedPremiumAccess = loadMembershipAccessCache(effectiveSession?.id);
  const forcePaywallPreview = import.meta.env.DEV
    && typeof window !== 'undefined'
    && ['athlete', 'parent'].includes(new URLSearchParams(window.location.search).get('paywallPreview'));
  const resolvedPremiumAccess = resolvePremiumAccess({
    subscription,
    backendAccess: backendPremiumAccess,
    cachedAccess: cachedPremiumAccess,
    localTrialAccess: localTrialAccessActive,
    now: accessCheckTime
  });
  const effectiveSubscription = {
    ...subscription,
    ...resolvedPremiumAccess
  };
  const premiumAccessAllowed = forcePaywallPreview
    ? false
    : isLocalPreviewSession
      || !effectiveSubscription.configured
      || effectiveSubscription.active
      || effectiveSubscription.activeTrial
      || localTrialAccessActive;
  const premiumAccessLoading = !forcePaywallPreview
    && !isLocalPreviewSession
    && !premiumAccessAllowed
    && (effectiveSubscription.loading || backendPremiumAccess.loading);
  const trialPlanMode = !premiumAccessAllowed;
  const standardsCompleted = standards.filter((item) => item.done).length;
  const submittedToday = lastSubmittedDate === dailyDate;
  const athleteOnboardingPreview = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('firstTime') === 'athlete';
  const athleteStartPreview = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('startPreview') === 'athlete';
  const athleteTodayPreview = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('todayPreview') === 'athlete';
  const trackAnalyticsEvent = useCallback(async (eventType, metadata = {}, options = {}) => {
    if (typeof window === 'undefined') return;

    let accessToken = '';
    if (isSupabaseConfigured) {
      const { data } = await supabase.auth.getSession();
      accessToken = data.session?.access_token || '';
    }

    const payload = {
      area: options.area || metadata.area || 'app',
      eventType,
      severity: options.severity || 'info',
      metadata: {
        role: effectiveSession?.role || 'anonymous',
        view,
        tab,
        parentTab,
        premiumActive: Boolean(effectiveSubscription.active),
        activeTrial: Boolean(effectiveSubscription.activeTrial),
        trialPlanMode: Boolean(trialPlanMode),
        nativeRuntime: isNativePushRuntime(),
        path: window.location.pathname,
        ...metadata
      }
    };

    fetch(appApiUrl('/api/track?action=event'), {
      method: 'POST',
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }).catch(() => {});
  }, [
    effectiveSession?.role,
    effectiveSubscription.active,
    effectiveSubscription.activeTrial,
    parentTab,
    tab,
    trialPlanMode,
    view
  ]);

  const completion = standards.length
    ? Math.round((standardsCompleted / standards.length) * 100)
    : 0;
  const confidenceAverage = Math.round(
    (scores.confidence + scores.energy + scores.mood + scores.belief) / 4
  );
  const athleteScore = pointsTotal(pointsLedger);
  const todayPoints = pointsToday(pointsLedger, dailyDate);
  const recentPointEvents = latestPointEvents(pointsLedger);
  const recentNotifications = notificationsFromLast24Hours(notifications);
  const unreadNotifications = recentNotifications.filter((notification) => !notification.read);

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
      document.documentElement.classList.toggle('keyboard-open', keyboardLikelyOpen);
      setViewportRevision((current) => current + 1);
      if (textEntryActive) return;
      setIsPhoneViewport(phoneViewport);
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
    if (authSession?.role === 'athlete' && journalOwner === authSession.id) localStorage.setItem(`${journalStorageKey}:${authSession.id}`, JSON.stringify(journalEntries));
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
    if (authSession?.role !== 'athlete') return;
    syncGoalWidgets({ goals, standards }).catch(() => {});
  }, [authSession?.id, authSession?.role, goals, standards]);

  useEffect(() => {
    localStorage.setItem(plansStorageKey, JSON.stringify(plans));
  }, [plans]);

  useEffect(() => {
    localStorage.setItem(planProgressStorageKey, JSON.stringify(planProgress));
  }, [planProgress]);

  useEffect(() => {
    if (!athleteJourney) return;
    localStorage.setItem(athleteJourneyStorageKey, JSON.stringify(athleteJourney));
  }, [athleteJourney]);

  useEffect(() => {
    if (!isSupabaseConfigured || authSession?.role !== 'athlete' || !isSupabaseId(authSession.id)) {
      setJourneyRemoteReady(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('athlete_journeys')
      .select('journey')
      .eq('athlete_user_id', authSession.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data?.journey?.days?.length === 21) {
          setAthleteJourney({ ...data.journey, ownerId: authSession.id });
        }
        setJourneyRemoteReady(!error);
      });
    return () => { cancelled = true; };
  }, [authSession?.id, authSession?.role]);

  useEffect(() => {
    if (!journeyRemoteReady || !athleteJourney || authSession?.role !== 'athlete' || !isSupabaseId(authSession.id)) return;
    supabase.from('athlete_journeys').upsert({
      athlete_user_id: authSession.id,
      journey: athleteJourney,
      updated_at: new Date().toISOString()
    }, { onConflict: 'athlete_user_id' });
  }, [athleteJourney, authSession?.id, authSession?.role, journeyRemoteReady]);

  useEffect(() => {
    if (effectiveSession?.role !== 'athlete' || !athleteJourney?.ownerId) return;
    if (String(athleteJourney.ownerId) !== String(effectiveSession.id)) {
      setAthleteJourney(loadAthleteJourney(effectiveSession.id));
    }
  }, [athleteJourney?.ownerId, effectiveSession?.id, effectiveSession?.role]);

  useEffect(() => {
    if (effectiveSession?.role !== 'athlete' || athleteJourney || (!onboardingComplete && !athleteTodayPreview) || !plans.length) return;
    const fallbackAnswers = {
      primaryGoal: athleteProfile.currentChallenges?.[0] || athleteProfile.currentChallenge || 'Consistency',
      identity: 'I’m still figuring out the athlete I want to become'
    };
    const generated = { ...generateJourney({ answers: fallbackAnswers, plans }), ownerId: effectiveSession.id };
    setAthleteJourney(generated);
    trackAnalyticsEvent('journey_generated', {
      primaryFocus: generated.developmentProfile.primaryFocus,
      selectedSeries: generated.selectedSeries.map((series) => series.title),
      integrationDays: generated.days.filter((day) => day.type === 'integration').length,
      source: 'existing_athlete'
    }, { area: 'journey' });
  }, [athleteJourney, athleteProfile.currentChallenge, athleteProfile.currentChallenges, athleteTodayPreview, effectiveSession?.role, onboardingComplete, plans, trackAnalyticsEvent]);

  useEffect(() => {
    if (!athleteJourney) return;
    const reconciled = reconcileJourney(athleteJourney, planProgress);
    if (JSON.stringify(reconciled) !== JSON.stringify(athleteJourney)) setAthleteJourney(reconciled);
  }, [athleteJourney, planProgress]);

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
    if (!effectiveSession?.id) return;
    trackAnalyticsEvent('session_started', {
      sessionId: String(effectiveSession.id).slice(0, 18),
      onboardingComplete,
      notificationBrowserPush: notificationPreferences.browserPush
    }, { area: 'engagement' });
  }, [effectiveSession?.id]);

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
          .select('daily_deposits, performance_plans, plan_unlocks, streaks, productivity, points, parent_updates, inactivity_reminders, browser_push')
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
          trackAnalyticsEvent('native_push_received', {
            title: notification.title || '',
            hasBody: Boolean(notification.body)
          }, { area: 'notifications' });
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
        trackAnalyticsEvent('native_push_permission_checked', {
          permission: permission.receive
        }, { area: 'notifications' });
        if (notificationPreferences.browserPush) {
          const nextPermission = permission.receive === 'granted'
            ? permission
            : permission.receive === 'denied'
              ? permission
              : await PushNotifications.requestPermissions();
          const granted = nextPermission.receive === 'granted';
          setNotificationPreferences((current) => ({ ...current, browserPush: granted }));
          trackAnalyticsEvent(granted ? 'native_push_permission_ready' : 'native_push_permission_blocked', {
            permission: nextPermission.receive
          }, { area: 'notifications', severity: granted ? 'info' : 'warning' });
          if (granted) await PushNotifications.register();
        }
      } catch (error) {
        setNotificationPreferences((current) => ({ ...current, browserPush: false }));
        trackAnalyticsEvent('native_push_setup_failed', {
          message: error?.message || 'unknown'
        }, { area: 'notifications', severity: 'warning' });
      }
    }

    configureNativePush();

    return () => {
      active = false;
      listenerHandles.forEach((handle) => handle.remove());
    };
  }, [authSession?.id, notificationPreferences.browserPush]);

  useEffect(() => {
    if (!isSupabaseConfigured || !authSession?.id) return undefined;
    let active = true;
    let lastTrackedAt = 0;

    async function trackActivity(force = false) {
      const now = Date.now();
      if (!force && now - lastTrackedAt < 30 * 60 * 1000) return;
      lastTrackedAt = now;

      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!active || !accessToken) return;

      fetch(appApiUrl('/api/track?action=activity'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }).catch(() => {});
    }

    function handleActivity() {
      trackActivity(false);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') trackActivity(true);
    }

    trackActivity(true);
    window.addEventListener('focus', handleActivity);
    window.addEventListener('pointerdown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const interval = window.setInterval(() => trackActivity(false), 60 * 60 * 1000);

    return () => {
      active = false;
      window.removeEventListener('focus', handleActivity);
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(interval);
    };
  }, [authSession?.id]);

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
        fetchGoalsForAthlete(authSession.id),
        supabase
          .from('daily_standards')
          .select('id, label, goal_id, done, entry_date')
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
        fetchJournalHistory(authSession.id),
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

      if (!goalsResult.error && Array.isArray(goalsResult.data)) {
        setGoals((current) => goalsResult.data.map((row) => (
          goalFromSupabase(row, current.find((goal) => String(goal.id) === String(row.id)))
        )));
      }

      if (!standardsResult.error && Array.isArray(standardsResult.data)) {
        setStandards((current) => {
          const doneByLabel = new Map(current.map((standard) => [standard.label, standard.done]));
          const remoteStandards = standardsResult.data.map((row) => ({
            ...standardFromSupabase(row),
            done: row.entry_date === todayKey()
              ? Boolean(row.done)
              : doneByLabel.get(row.label) ?? false
          }));
          return remoteStandards;
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
        setJournalEntries([...new Map([...loadJournalEntries(authSession.id), ...journalResult.data.map(journalFromSupabase)].map((entry) => [entry.id, entry])).values()]);
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
      let [lessonsResult, plansResult, parentMessageResult, parentGuidesResult] = await Promise.all([
        supabase
          .from('daily_deposits')
          .select('id, title, body, focus_question, title_es, body_es, focus_question_es, release_date, status')
          .order('release_date', { ascending: false }),
        supabase
          .from('performance_plans')
          .select('id, title, subject, steps, title_es, subject_es, steps_es, challenge_day_es, release_date, challenge_day, challenge_length')
          .order('release_date', { ascending: true }),
        supabase
          .from('parent_messages')
          .select('title, body, conversation_cue, avoid, title_es, body_es, conversation_cue_es, avoid_es, send_date, status')
          .order('send_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('parent_guides')
          .select('id, series_title, title, category, subject, steps, series_title_es, title_es, category_es, subject_es, steps_es, guide_day_es, release_date, guide_day, guide_length, status')
          .eq('status', 'published')
          .lte('release_date', dailyDate)
          .order('release_date', { ascending: true })
      ]);

      if (lessonsResult.error) lessonsResult = await supabase.from('daily_deposits').select('id, title, body, focus_question, release_date, status').order('release_date', { ascending: false });
      if (plansResult.error) plansResult = await supabase.from('performance_plans').select('id, title, subject, steps, release_date, challenge_day, challenge_length').order('release_date', { ascending: true });
      if (parentMessageResult.error) parentMessageResult = await supabase.from('parent_messages').select('title, body, conversation_cue, avoid, send_date, status').order('send_date', { ascending: false }).limit(1).maybeSingle();
      if (parentGuidesResult.error) parentGuidesResult = await supabase.from('parent_guides').select('id, series_title, title, category, subject, steps, release_date, guide_day, guide_length, status').eq('status', 'published').lte('release_date', dailyDate).order('release_date', { ascending: true });

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
            id: `performance-plan-added-${releasedToday.id}-${authSession.id}`
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
    if (localParentInviteSession || String(authSession?.id || '').startsWith('app-review-parent')) {
      const localAthletes = [{ athlete_user_id: 'local-athlete-review', full_name: 'App Review Athlete', sport: athleteProfile.sport, age: athleteProfile.age, location: athleteProfile.location }];
      setParentLinkChecked(true);
      setLinkedAthletes(localAthletes);
      setLinkedAthleteId('local-athlete-review');
      setLinkedAthleteSummary(localAthletes[0]);
      return;
    }

    if (!isSupabaseConfigured || authSession?.role !== 'parent') {
      setParentLinkChecked(false);
      setLinkedAthletes([]);
      setLinkedAthleteId(null);
      setLinkedAthleteSummary(null);
      return;
    }
    let cancelled = false;
    setParentLinkChecked(false);

    async function loadLinkedAthleteData() {
      const linkedAthletesResult = await supabase.rpc('parent_linked_athletes');
      const summaries = !linkedAthletesResult.error && Array.isArray(linkedAthletesResult.data)
        ? linkedAthletesResult.data
        : [];
      if (cancelled) return;
      setLinkedAthletes(summaries);

      let savedAthleteId = '';
      try {
        savedAthleteId = localStorage.getItem(`the-complete-athlete-selected-parent-athlete-${authSession.id}`) || '';
      } catch {
        savedAthleteId = '';
      }
      const selectedSummary = summaries.find((item) => item.athlete_user_id === savedAthleteId) ?? summaries[0] ?? null;
      const athleteUserId = selectedSummary?.athlete_user_id;
      if (!athleteUserId) {
        setLinkedAthleteId(null);
        setLinkedAthleteSummary(null);
        setGoals([]);
        setStandardsHistory([]);
        setReadinessHistory([]);
        setJournalEntries([]);
        setPlanProgress({});
        setPointsLedger([]);
        setParentLinkChecked(true);
        return;
      }
      setLinkedAthleteId(athleteUserId);
      setLinkedAthleteSummary(selectedSummary);
      try {
        localStorage.setItem(`the-complete-athlete-selected-parent-athlete-${authSession.id}`, athleteUserId);
      } catch {
        // The first linked athlete remains selected for this session.
      }

      const [profileResult, goalsResult, standardsHistoryResult, readinessResult, journalResult, privacyResult, planProgressResult, pointsLedgerResult] = await Promise.all([
        supabase
          .from('athlete_profiles')
          .select('sport, age, location, photo_url, parent_contact, parent_access_code')
          .eq('user_id', athleteUserId)
          .maybeSingle(),
        fetchGoalsForAthlete(athleteUserId),
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
        setAthleteProfile((current) => {
          return {
            ...profileFromSupabase(profileResult.data, current, current),
            name: selectedSummary?.full_name || current.name,
            sport: selectedSummary?.sport ?? profileResult.data?.sport ?? current.sport,
            age: selectedSummary?.age ?? profileResult.data?.age ?? current.age,
            location: selectedSummary?.location ?? profileResult.data?.location ?? current.location
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

  async function persistAthleteProfile(profile = athleteProfile) {
    try {
      localStorage.setItem(athleteProfileStorageKey, JSON.stringify(profile));
    } catch {
      return 'Profile could not be saved on this device.';
    }

    if (!isSupabaseConfigured || authSession?.role !== 'athlete' || !isSupabaseId(authSession.id)) return '';

    const [accountResult, athleteResult] = await Promise.all([
      supabase
        .from('profiles')
        .update({ full_name: profile.name ?? '' })
        .eq('id', authSession.id),
      supabase
        .from('athlete_profiles')
        .upsert({
          user_id: authSession.id,
          sport: profile.sport ?? '',
          age: profile.age ?? '',
          location: profile.location ?? '',
          photo_url: profile.photo ?? '',
          parent_contact: profile.parentContact ?? '',
          parent_access_code: profile.parentAccessCode ?? 'TCA-PARENT',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
    ]);

    return accountResult.error?.message || athleteResult.error?.message || '';
  }

  useEffect(() => {
    if (!supabaseAthleteDataReady) return;
    persistAthleteProfile(athleteProfile);
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
        const { data, error } = await insertGoalsForAthlete(localGoals, authSession.id);

        if (!cancelled && !error && Array.isArray(data)) {
          const savedGoals = data.map((row, index) => goalFromSupabase(row, localGoals[index]));
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
        await upsertGoalsForAthlete(remoteGoals, authSession.id);
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
          .select('id, label, goal_id, done, entry_date');

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
      const pending = journalEntries.filter((entry) => entry.pending && entry.ownerId === authSession.id);
      if (pending.length) {
        const { error } = await supabase.from('journal_entries').upsert(pending.map((entry) => journalToSupabase(entry, authSession.id)), { onConflict: 'id' });
        if (cancelled || error) return;

        const savedIds = new Set(pending.map((entry) => entry.id));
        setJournalEntries((current) => current.map((entry) => savedIds.has(entry.id) ? { ...entry, pending: false } : entry));
      }

      const { data: existingRows, error: historyError } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('athlete_user_id', authSession.id);

      if (cancelled || historyError) return;

      const currentIds = new Set(journalEntries.map((entry) => entry.id));
      const deletedIds = (existingRows ?? [])
        .map((row) => row.id)
        .filter((id) => !currentIds.has(id));

      if (deletedIds.length) {
        await supabase
          .from('journal_entries')
          .delete()
          .eq('athlete_user_id', authSession.id)
          .in('id', deletedIds);
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
      trackAnalyticsEvent('signup_failed', { role, reason: 'missing_credentials' }, { area: 'auth', severity: 'warning' });
      return 'Email and password are required.';
    }

    if (authUsers.some((user) => user.email === cleanEmail)) {
      trackAnalyticsEvent('signup_failed', { role, reason: 'duplicate_email' }, { area: 'auth', severity: 'warning' });
      return 'An account already exists for that email.';
    }

    if (role === 'admin') {
      trackAnalyticsEvent('signup_failed', { role, reason: 'admin_blocked' }, { area: 'auth', severity: 'warning' });
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
            role,
            preferred_language: 'en'
          }
        }
      });

      if (error) {
        trackAnalyticsEvent('signup_failed', { role, reason: error.message }, { area: 'auth', severity: 'warning' });
        return error.message;
      }

      if (data.user && data.session) {
        if (role === 'parent' && parentCode) {
          const { error: linkError } = await supabase.rpc('link_parent_to_athlete', { access_code: parentCode.trim() });
          if (linkError) {
            trackAnalyticsEvent('family_link_failed', { source: 'signup_parent', reason: linkError.message }, { area: 'family', severity: 'warning' });
            return 'Account created, but the parent link could not be created. Check the access code.';
          }
          trackAnalyticsEvent('family_linked', { source: 'signup_parent' }, { area: 'family' });
        }
        if (role === 'athlete' && parentFamilyCode) {
          const { error: athleteLinkError } = await supabase.rpc('link_athlete_to_parent', { parent_code: parentFamilyCode.trim() });
          if (athleteLinkError) {
            trackAnalyticsEvent('family_link_failed', { source: 'signup_athlete', reason: athleteLinkError.message }, { area: 'family', severity: 'warning' });
            return 'Account created, but the family access code could not be linked. Check the code with your parent.';
          }
          trackAnalyticsEvent('family_linked', { source: 'signup_athlete' }, { area: 'family' });
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
        trackAnalyticsEvent('signup_completed', { role, parentCodeEntered: Boolean(parentCode || parentFamilyCode) }, { area: 'auth' });
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
    trackAnalyticsEvent('signup_completed', { role, mode: 'local' }, { area: 'auth' });
    return '';
  }

  async function loginUser({ role, email, password }) {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !password) {
      trackAnalyticsEvent('login_failed', { role, reason: 'missing_credentials' }, { area: 'auth', severity: 'warning' });
      return 'Email and password are required.';
    }
    const reviewRole = appReviewRoleForEmail(cleanEmail, role);
    if (reviewRole && password === appReviewPassword) {
      enterReviewerAccess(reviewRole);
      return '';
    }

    if (isSupabaseConfigured) {
      let signInResult;
      try {
        signInResult = await withTimeout(
          supabase.auth.signInWithPassword({
            email: cleanEmail,
            password
          }),
          12000,
          'Login is taking too long. Check your internet connection and try again.'
        );
      } catch (error) {
        trackAnalyticsEvent('login_failed', { role, reason: error.message || 'auth_timeout' }, { area: 'auth', severity: 'warning' });
        return error.message || 'Login could not be completed. Try again.';
      }

      const { data, error } = signInResult;

      if (error) {
        trackAnalyticsEvent('login_failed', { role, reason: error.message }, { area: 'auth', severity: 'warning' });
        return error.message;
      }

      let profileResult;
      try {
        profileResult = await withTimeout(
          supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle(),
          12000,
          'Login worked, but loading the account profile took too long. Try again.'
        );
      } catch (error) {
        await supabase.auth.signOut();
        trackAnalyticsEvent('login_failed', { role, reason: error.message || 'profile_timeout' }, { area: 'auth', severity: 'warning' });
        return error.message || 'Login worked, but the account profile could not be loaded. Try again.';
      }

      const { data: profile, error: profileError } = profileResult;

      if (profileError) {
        trackAnalyticsEvent('login_failed', { role, reason: profileError.message }, { area: 'auth', severity: 'warning' });
        return profileError.message;
      }
      if (!profile) {
        trackAnalyticsEvent('login_failed', { role, reason: 'missing_profile' }, { area: 'auth', severity: 'warning' });
        return 'No profile found for this account.';
      }
      if (profile.role === 'admin') {
        await supabase.auth.signOut();
        trackAnalyticsEvent('login_failed', { role, reason: 'admin_blocked' }, { area: 'auth', severity: 'warning' });
        return 'Admin access has moved outside the athlete app.';
      }
      if (profile.role !== role) {
        trackAnalyticsEvent('login_failed', { role, accountRole: profile.role, reason: 'wrong_portal' }, { area: 'auth', severity: 'warning' });
        return `This account is registered as ${profile.role}. Choose the correct portal.`;
      }

      setAuthSession({
        id: profile.id,
        role: profile.role,
        name: profile.full_name || profile.role,
        email: cleanEmail,
        parentAccessCode: profile.parent_access_code ?? ''
      });
      if (profile.preferred_language) setLanguage(profile.preferred_language);
      setView(role === 'parent' ? 'parent' : 'athlete');
      window.history.replaceState({}, '', window.location.pathname);
      trackAnalyticsEvent('login_completed', { role: profile.role }, { area: 'auth' });
      return '';
    }

    const user = authUsers.find((account) => account.email === cleanEmail && account.password === password);
    if (!user) {
      trackAnalyticsEvent('login_failed', { role, mode: 'local', reason: 'not_found' }, { area: 'auth', severity: 'warning' });
      return 'No account found with that email and password.';
    }
    if (user.role === 'admin') {
      trackAnalyticsEvent('login_failed', { role, mode: 'local', reason: 'admin_blocked' }, { area: 'auth', severity: 'warning' });
      return 'Admin access has moved outside the athlete app.';
    }
    if (user.role !== role) {
      trackAnalyticsEvent('login_failed', { role, mode: 'local', accountRole: user.role, reason: 'wrong_portal' }, { area: 'auth', severity: 'warning' });
      return `This account is registered as ${user.role}. Choose the correct portal.`;
    }
    setAuthSession({ id: user.id, role: user.role, name: user.name, email: user.email, parentAccessCode: user.parentAccessCode ?? '' });
    setView(role === 'parent' ? 'parent' : 'athlete');
    trackAnalyticsEvent('login_completed', { role: user.role, mode: 'local' }, { area: 'auth' });
    return '';
  }

  function enterReviewerAccess(role = 'athlete') {
    const reviewRole = role === 'parent' ? 'parent' : 'athlete';
    const reviewSession = {
      id: `app-review-${reviewRole}`,
      role: reviewRole,
      name: reviewRole === 'parent' ? 'App Review Parent' : 'App Review Athlete',
      email: `${reviewRole}-review@thecompleteathlete.app`,
      parentAccessCode: reviewRole === 'parent' ? 'TCA-FAMILY' : ''
    };
    const trialExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    saveTrialAccessWindow(reviewSession.id, trialExpiresAt);
    saveTrialPromptDismissed(reviewSession.id);
    localStorage.setItem(onboardingStorageKey, 'true');
    localStorage.setItem(athleteStartStorageKey, 'true');
    setAuthSession(reviewSession);
    setOnboardingComplete(true);
    setAthleteStartComplete(true);
    setLocalTrialAccessActive(true);
    setTrialPromptDismissed(true);
    setView(reviewRole === 'parent' ? 'parent' : 'athlete');
    setTab(reviewRole === 'parent' ? tab : 'plans');
    setParentTab('overview');
    setNotificationsOpen(false);
    trackAnalyticsEvent('review_access_started', { role: reviewRole }, { area: 'auth' });
  }

  async function requestPasswordReset(email) {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) return 'Enter your email first.';
    if (!isSupabaseConfigured) return 'Password reset is available when the live backend is connected.';

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: PASSWORD_RESET_REDIRECT_URL
    });
    if (error) return error.message;
    trackAnalyticsEvent('password_reset_requested', {}, { area: 'auth' });
    return 'If an account uses that email, a reset link is on the way. Check your inbox and spam folder.';
  }

  async function completePasswordRecovery(password) {
    if (!isSupabaseConfigured) return 'Password recovery is unavailable while the backend is disconnected.';
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return error.message;

    trackAnalyticsEvent('password_reset_completed', {}, { area: 'auth' });
    await supabase.auth.signOut();
    setAuthSession(null);
    setPasswordRecoveryActive(false);
    window.history.replaceState({}, '', window.location.pathname);
    return '';
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
    const previewSessionActive = isLocalPreviewSession;
    const loginPath = window.location.pathname;
    try {
      localStorage.removeItem(authSessionStorageKey);
    } catch {
      // React state still clears the session when local storage is unavailable.
    }
    setAuthSession(null);
    setNotificationsOpen(false);
    setView('athlete');
    setTab('home');
    setParentTab('overview');
    setProfileView('overview');
    setParentAccessDraft('');
    setParentLinkFeedback('');
    setParentLinkChecked(false);
    setLinkedAthletes([]);
    setLinkedAthleteId(null);
    setLinkedAthleteSummary(null);
    window.history.replaceState({}, '', loginPath);

    if (previewSessionActive) {
      window.location.replace(loginPath);
      return;
    }

    if (isSupabaseConfigured) {
      try {
        await withTimeout(
          supabase.auth.signOut({ scope: 'local' }),
          8000,
          'Sign out took too long.'
        );
      } catch {
        // Keep the user signed out locally even if the remote session request is unavailable.
      }
    }
  }

  function selectParentAthlete(athleteUserId) {
    if (!athleteUserId || athleteUserId === linkedAthleteId) return;
    try {
      localStorage.setItem(`the-complete-athlete-selected-parent-athlete-${authSession?.id || 'local'}`, athleteUserId);
    } catch {
      // The current selection still works even when local storage is unavailable.
    }
    setLinkedAthleteId(athleteUserId);
    setParentLinkFeedback('');
    setParentLinkRefreshKey((value) => value + 1);
  }

  async function unlinkParentAthlete(athleteUserId, athleteName = 'this athlete') {
    if (!athleteUserId || !window.confirm(`Remove ${athleteName} from your parent account?`)) return;
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setParentLinkFeedback('Sign in again before removing athlete access.');
      return;
    }
    const response = await fetch(appApiUrl('/api/unlink-parent-athlete'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ athleteUserId })
    }).catch(() => null);
    if (!response?.ok) {
      setParentLinkFeedback('Athlete access could not be removed. Try again.');
      return;
    }
    if (athleteUserId === linkedAthleteId) {
      try {
        localStorage.removeItem(`the-complete-athlete-selected-parent-athlete-${authSession.id}`);
      } catch {
        // The remaining athlete list will still reload correctly.
      }
    }
    setParentLinkFeedback(`${athleteName} was removed from your parent account.`);
    setParentLinkRefreshKey((value) => value + 1);
  }

  async function linkParentAccessCode(event) {
    event?.preventDefault();
    const accessCode = parentAccessDraft.trim();
    if (!accessCode) {
      setParentLinkFeedback('Enter the parent access code from your athlete.');
      return false;
    }
    if (!isSupabaseConfigured || authSession?.role !== 'parent') {
      setParentLinkFeedback('Log in as a parent before linking an athlete.');
      return false;
    }

    const { data: athleteUserId, error } = await supabase.rpc('link_parent_to_athlete', { access_code: accessCode });
    if (error) {
      trackAnalyticsEvent('family_link_failed', { source: 'parent_settings', reason: error.message }, { area: 'family', severity: 'warning' });
      setParentLinkFeedback('That code did not link. Check the code and try again.');
      return false;
    }

    trackAnalyticsEvent('family_linked', { source: 'parent_settings' }, { area: 'family' });
    setParentAccessDraft('');
    setParentLinkFeedback('Athlete linked. Loading parent dashboard...');
    if (athleteUserId) {
      try {
        localStorage.setItem(`the-complete-athlete-selected-parent-athlete-${authSession.id}`, athleteUserId);
      } catch {
        // The linked athlete will still be selected for the current session.
      }
      setLinkedAthleteId(athleteUserId);
    }
    setParentLinkRefreshKey((value) => value + 1);
    return true;
  }

  async function linkAthleteParentAccessCode(event) {
    event?.preventDefault();
    const accessCode = athleteParentAccessDraft.trim();
    if (!accessCode) {
      setAthleteParentLinkFeedback('Enter the family access code from your parent.');
      return false;
    }
    if (!isSupabaseConfigured || authSession?.role !== 'athlete') {
      setAthleteParentLinkFeedback('Log in as an athlete before linking a parent membership.');
      return false;
    }

    const { error } = await supabase.rpc('link_athlete_to_parent', { parent_code: accessCode });
    if (error) {
      trackAnalyticsEvent('family_link_failed', { source: 'athlete_profile', reason: error.message }, { area: 'family', severity: 'warning' });
      setAthleteParentLinkFeedback('That code did not link. Check the code and try again.');
      return false;
    }

    trackAnalyticsEvent('family_linked', { source: 'athlete_profile' }, { area: 'family' });
    setAthleteParentAccessDraft('');
    setAthleteParentLinkFeedback('Parent membership linked. Premium access is updating...');
    setPremiumAccessRefreshKey((value) => value + 1);
    return true;
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let disposed = false;
    async function restoreSession(session) {
      const user = session?.user;
      if (!user) return;
      try { await finishSocialProfile(supabase, user); } catch {
        window.dispatchEvent(new CustomEvent('tca-auth-error', { detail: 'Account setup could not finish. Please try signing in again.' }));
        return;
      }
      if (disposed) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
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
      if (profile.preferred_language) setLanguage(profile.preferred_language);
      setView(profile.role === 'parent' ? 'parent' : 'athlete');
      const linkWarning = localStorage.getItem('tca-social-link-warning');
      if (linkWarning) {
        setParentLinkFeedback(linkWarning);
        setAthleteParentLinkFeedback(linkWarning);
        localStorage.removeItem('tca-social-link-warning');
      }
    }
    completeSocialRedirect(supabase, oauthSupabase).then(() => supabase.auth.getSession()).then(({ data }) => restoreSession(data.session)).catch(() => {
      window.dispatchEvent(new CustomEvent('tca-auth-error', { detail: 'Sign-in could not be completed. Please try again.' }));
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryActive(true);
        return;
      }
      if (shouldClearSavedSession(event, session)) setAuthSession(null);
      // Defer Supabase requests outside the auth callback to avoid its session lock.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setTimeout(() => { if (!disposed) restoreSession(session); }, 0);
      }
    });

    return () => { disposed = true; authListener.subscription.unsubscribe(); };
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

  useEffect(() => {
    if (authSession?.role !== 'athlete') return;
    const groups = athleteBadgeGroups({ goals, journalEntries, plans, planProgress, standards, standardsHistory, streakCount });
    const earnedBadges = groups.flatMap(([family, badges]) => badges
      .filter((badge) => badge[2])
      .map((badge) => ({ key: `${family}:${badge[0]}`, family, name: badge[0], description: badge[1] }))
    );
    if (!earnedBadges.length) return;

    const storageKey = `the-complete-athlete-notified-badges-${authSession.id || 'local'}`;
    let notified = [];
    try { notified = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { notified = []; }
    const newlyEarned = earnedBadges.filter((badge) => !notified.includes(badge.key));
    if (!newlyEarned.length) return;

    localStorage.setItem(storageKey, JSON.stringify(Array.from(new Set([
      ...notified,
      ...earnedBadges.map((badge) => badge.key)
    ]))));
    newlyEarned.forEach((badge) => {
      const notificationId = `badge-unlocked-${badge.key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      notifyUser(`Badge unlocked: ${badge.name}`, badge.description, 'success', {
        id: notificationId,
        type: 'general'
      });
    });
  }, [authSession?.id, authSession?.role, goals, journalEntries, plans, planProgress, standards, standardsHistory, streakCount]);

  async function requestBrowserNotifications() {
    trackAnalyticsEvent('notification_permission_requested', {
      nativeRuntime: isNativePushRuntime()
    }, { area: 'notifications' });

    if (isNativePushRuntime()) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const permission = await PushNotifications.requestPermissions();
        const granted = permission.receive === 'granted';
        setNotificationPreferences((current) => ({ ...current, browserPush: granted }));
        if (granted) await PushNotifications.register();
        trackAnalyticsEvent(granted ? 'notification_permission_granted' : 'notification_permission_denied', {
          nativeRuntime: true,
          permission: permission.receive
        }, { area: 'notifications', severity: granted ? 'info' : 'warning' });
      } catch {
        setNotificationPreferences((current) => ({ ...current, browserPush: false }));
        trackAnalyticsEvent('notification_permission_failed', { nativeRuntime: true }, { area: 'notifications', severity: 'warning' });
      }
      return;
    }

    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPreferences((current) => ({ ...current, browserPush: permission === 'granted' }));
    trackAnalyticsEvent(permission === 'granted' ? 'notification_permission_granted' : 'notification_permission_denied', {
      nativeRuntime: false,
      permission
    }, { area: 'notifications', severity: permission === 'granted' ? 'info' : 'warning' });
  }

  async function registerPushDeviceToken(token, platform) {
    if (!token || !isSupabaseConfigured || !authSession?.id) return;
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) return;

    const response = await fetch(appApiUrl('/api/register-push-token'), {
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
    trackAnalyticsEvent(response?.ok ? 'push_token_registered' : 'push_token_registration_failed', {
      platform,
      status: response?.status || 0,
      tokenTail: String(token).slice(-6)
    }, { area: 'notifications', severity: response?.ok ? 'info' : 'warning' });
  }

  function updateNotificationPreference(field, value) {
    setNotificationPreferences((current) => ({ ...current, [field]: value }));
  }

  function markNotificationsRead() {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  }

  function toggleNotifications() {
    setNotificationsOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) {
        trackAnalyticsEvent('notification_tray_opened', {
          unreadCount: unreadNotifications.length,
          totalCount: notifications.length
        }, { area: 'notifications' });
        markNotificationsRead();
        if (isSupabaseConfigured && authSession?.id) {
          const cutoff = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString();
          supabase
            .from('app_notifications')
            .select('id, notification_type, title, body, tone, read, created_at')
            .eq('user_id', authSession.id)
            .gte('created_at', cutoff)
            .order('created_at', { ascending: false })
            .limit(40)
            .then(({ data, error }) => {
              if (!error && Array.isArray(data)) {
                setNotifications(data.map(notificationFromSupabase).map((notification) => ({ ...notification, read: true })));
              }
            });
        }
      }
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
    if (notificationPreferences.points) playPointsEarnedSound(cleanPoints);
    trackAnalyticsEvent('points_awarded', {
      pointType: type,
      points: cleanPoints,
      label,
      uniqueKey: cleanKey,
      metadataKeys: Object.keys(metadata || {})
    }, { area: 'engagement' });
    notifyUser('Performance Points earned', `+${cleanPoints} PP · ${label}`, 'success', {
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
    const completedPlan = plans.find((plan) => String(plan.id) === String(planId));

    await supabase
      .from('performance_plan_progress')
      .upsert({
        athlete_user_id: authSession.id,
        plan_id: String(planId),
        completed_at: completedAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'athlete_user_id,plan_id' });

    trackAnalyticsEvent('plan_lesson_completed', {
      planId: String(planId),
      planTitle: completedPlan?.title || '',
      seriesTitle: completedPlan ? planSeriesTitle(completedPlan) : '',
      day: completedPlan ? planDayNumber(completedPlan) : null
    }, { area: 'plans' });
  }

  function requestMilestoneReview(milestone) {
    if (!['athlete', 'parent'].includes(authSession?.role) || !authSession.id) return;
    requestAppReview({ userId: authSession.id, milestone }).catch(() => {});
  }

  useEffect(() => {
    if (authSession?.role !== 'parent' || !authSession.id || !canRequestNativeAppReview()) return undefined;
    let wasHidden = false;
    let reviewTimer;

    const recordOpen = () => {
      const openCount = recordParentAppOpen({ userId: authSession.id });
      if (openCount >= 5) {
        window.clearTimeout(reviewTimer);
        reviewTimer = window.setTimeout(() => requestMilestoneReview('parent_fifth_app_open'), 1500);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasHidden = true;
      } else if (document.visibilityState === 'visible' && wasHidden) {
        wasHidden = false;
        recordOpen();
      }
    };

    if (parentOpenCountedSessionRef.current !== authSession.id) {
      parentOpenCountedSessionRef.current = authSession.id;
      recordOpen();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearTimeout(reviewTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authSession?.id, authSession?.role]);

  function celebrate(message) {
    setCelebration(message);
    window.setTimeout(() => setCelebration(''), 2800);
  }

  async function completeParentOnboarding(setup = {}) {
    if (!effectiveSession?.id) return;
    const assessmentCompletedAt = setup.parentAssessmentCompletedAt || new Date().toISOString();
    const assessmentRecord = setup.parentAssessment ? {
      ...setup.parentAssessment,
      derived_parent_tags: setup.derivedParentTags || [],
      recommended_parent_plans: setup.recommendedParentPlans || [],
      parent_assessment_completed_at: assessmentCompletedAt
    } : null;
    if (assessmentRecord) {
      try {
        const savedAssessments = JSON.parse(localStorage.getItem(parentAssessmentStorageKey) || '{}');
        localStorage.setItem(parentAssessmentStorageKey, JSON.stringify({ ...savedAssessments, [effectiveSession.id]: assessmentRecord }));
      } catch {
        localStorage.setItem(parentAssessmentStorageKey, JSON.stringify({ [effectiveSession.id]: assessmentRecord }));
      }
      if (setup.recommendedParentPlans?.[0]?.id) {
        localStorage.setItem(parentStarterPlanStorageKey, String(setup.recommendedParentPlans[0].id));
      }
      if (isSupabaseConfigured && authSession?.role === 'parent' && isSupabaseId(authSession?.id)) {
        await supabase.auth.updateUser({ data: assessmentRecord }).catch(() => null);
      }
    }
    const nextAccounts = { ...parentOnboardingAccounts, [effectiveSession.id]: true };
    setParentOnboardingAccounts(nextAccounts);
    localStorage.setItem('tca-parent-onboarding-accounts', JSON.stringify(nextAccounts));
    const nextStartAccounts = { ...parentStartAccounts, [effectiveSession.id]: true };
    setParentStartAccounts(nextStartAccounts);
    localStorage.setItem(parentStartAccountsStorageKey, JSON.stringify(nextStartAccounts));
    setView('parent');
    setParentTab('overview');
    setOnboardingComplete(true);
    localStorage.setItem(onboardingStorageKey, 'true');
    trackAnalyticsEvent('onboarding_completed', {
      role: 'parent',
      assessmentCompleted: Boolean(assessmentRecord),
      primaryParentGoal: assessmentRecord?.primary_parent_goal || '',
      derivedTags: assessmentRecord?.derived_parent_tags || [],
      recommendedPlans: (assessmentRecord?.recommended_parent_plans || []).map((plan) => plan.title)
    }, { area: 'activation' });
  }

  function completeParentFirstValue(action = 'complete') {
    if (!effectiveSession?.id) return;
    const nextAccounts = { ...parentStartAccounts, [effectiveSession.id]: true };
    setParentStartAccounts(nextAccounts);
    localStorage.setItem(parentStartAccountsStorageKey, JSON.stringify(nextAccounts));
    trackAnalyticsEvent('parent_first_value_completed', { action }, { area: 'activation' });
  }

  async function completeOnboarding(setup) {
    if (effectiveSession?.role === 'parent') {
      await completeParentOnboarding(setup);
      return;
    }
    const selectedChallenges = athleteChallengesByIds(setup.currentChallenges, setup.currentChallenge);
    const selectedChallenge = selectedChallenges[0];
    const accountName = effectiveSession?.name || athleteProfile.name || 'Athlete';
    const nextProfile = {
      ...athleteProfile,
      name: accountName,
      sport: setup.sport,
      age: setup.age,
      photo: setup.photo || athleteProfile.photo || '',
      location: setup.location,
      parentContact: setup.parentContact,
      currentChallenge: selectedChallenge.id,
      currentChallenges: selectedChallenges.map((challenge) => challenge.id),
      journeyAnswers: setup.journeyAnswers || {},
      developmentProfile: setup.developmentProfile || null
    };
    const nextGoals = (setup.goals?.length ? setup.goals : selectedChallenges.map((challenge) => challenge.goal))
      .map((goal, index) => ({
        id: Date.now() + index,
        label: index === 0 ? 'Main Goal' : `Goal ${index + 1}`,
        value: goal,
        progress: 0
      }))
      .filter((goal) => goal.value.trim());
    const nextStandards = (setup.standards?.length ? setup.standards : selectedChallenges.map((challenge) => challenge.standard))
      .map((label, index) => ({
        id: Date.now() + 100 + index,
        label,
        done: false,
        goalId: nextGoals[index % Math.max(nextGoals.length, 1)]?.id ?? null
      }))
      .filter((standard) => standard.label.trim());

    setAthleteProfile(nextProfile);
    await persistAthleteProfile(nextProfile);
    if (nextGoals.length) setGoals(nextGoals);
    if (nextStandards.length) setStandards(nextStandards);
    const generatedJourney = { ...(setup.generatedJourney || generateJourney({
      answers: setup.journeyAnswers || { primaryGoal: selectedChallenge.shortLabel || selectedChallenge.label },
      plans
    })), ownerId: effectiveSession.id };
    setAthleteJourney(generatedJourney);
    setTab('home');
    setView('athlete');
    setAthleteStartComplete(true);
    setOnboardingComplete(true);
    localStorage.setItem(onboardingStorageKey, 'true');
    localStorage.setItem(athleteStartStorageKey, 'true');
    trackAnalyticsEvent('onboarding_completed', {
      challengeId: selectedChallenge.id,
      challengeIds: selectedChallenges.map((challenge) => challenge.id),
      challengeCount: selectedChallenges.length,
      sportProvided: Boolean(setup.sport),
      ageProvided: Boolean(setup.age),
      photoProvided: Boolean(setup.photo),
      locationProvided: Boolean(setup.location),
      parentContactProvided: Boolean(setup.parentContact),
      goalsCount: nextGoals.length,
      standardsCount: nextStandards.length
    }, { area: 'activation' });
    trackAnalyticsEvent('journey_generated', {
      primaryFocus: generatedJourney.developmentProfile.primaryFocus,
      selectedSeries: generatedJourney.selectedSeries.map((series) => series.title),
      integrationDays: generatedJourney.days.filter((day) => day.type === 'integration').length,
      source: 'onboarding'
    }, { area: 'journey' });
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
      'Keep your streak alive, lock in your day! 🔒',
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
    setLocalTrialAccessActive(loadTrialAccessActive(effectiveSession?.id));
    setAccessCheckTime(Date.now());
    if (!effectiveSession?.id) return undefined;
    const timer = window.setInterval(() => {
      setAccessCheckTime(Date.now());
      setLocalTrialAccessActive(loadTrialAccessActive(effectiveSession.id));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [effectiveSession?.id]);

  useEffect(() => {
    if (!effectiveSession?.id) return;
    let active = true;

    const loadSubscription = async () => {
      setSubscription((current) => ({ ...current, loading: true, checked: false }));
      try {
        const status = await loadRevenueCatSubscription({
          userId: effectiveSession.id,
          email: effectiveSession.email,
          name: effectiveSession.name
        });
        if (active) setSubscription((current) => ({ ...current, ...status, loading: false, checked: true }));
      } catch (error) {
        if (active) {
          setSubscription((current) => ({
            ...current,
            configured: Boolean(revenueCatConfig.iosApiKey),
            native: canUseNativePurchases(),
            loading: false,
            checked: false,
            message: error?.message || 'Premium access could not be checked yet.'
          }));
        }
      }
    };

    loadSubscription();

    return () => {
      active = false;
    };
  }, [effectiveSession?.email, effectiveSession?.id, effectiveSession?.name, premiumAccessRefreshKey]);

  useEffect(() => {
    if (!effectiveSession?.id || typeof document === 'undefined') return undefined;
    let wasHidden = false;
    const refreshMembershipOnResume = () => {
      if (document.visibilityState === 'hidden') {
        wasHidden = true;
      } else if (wasHidden) {
        wasHidden = false;
        setPremiumAccessRefreshKey((value) => value + 1);
      }
    };
    document.addEventListener('visibilitychange', refreshMembershipOnResume);
    return () => document.removeEventListener('visibilitychange', refreshMembershipOnResume);
  }, [effectiveSession?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured || !effectiveSession?.id || isLocalPreviewSession) {
      setBackendPremiumAccess({
        loading: false,
        checked: true,
        hasAccess: false,
        activeTrial: false,
        source: 'none',
        sponsorUserId: null,
        expiresAt: ''
      });
      return;
    }

    let active = true;
    setBackendPremiumAccess((current) => ({ ...current, loading: true, checked: false }));

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
      const checked = !error && !subscriptionResult.error;
      setBackendPremiumAccess({
        loading: false,
        checked,
        hasAccess: checked && Boolean(access?.has_access),
        activeTrial: checked && subscriptionRow?.status === 'trialing',
        source: checked ? access?.access_source || 'none' : 'none',
        sponsorUserId: checked ? access?.sponsor_user_id || null : null,
        expiresAt: checked ? access?.expires_at || '' : ''
      });
    }

    loadBackendPremiumAccess();

    return () => {
      active = false;
    };
  }, [effectiveSession?.id, isLocalPreviewSession, premiumAccessRefreshKey]);

  useEffect(() => {
    if (!effectiveSession?.id || isLocalPreviewSession) return;
    if (!subscription.checked || !backendPremiumAccess.checked) return;

    const nativeActive = Boolean(subscription.active);
    const backendActive = Boolean(backendPremiumAccess.hasAccess);
    if (!nativeActive && !backendActive) {
      clearMembershipAccessCache(effectiveSession.id);
      setMembershipCacheRevision((value) => value + 1);
      return;
    }

    saveMembershipAccessCache(effectiveSession.id, {
      hasAccess: true,
      activeTrial: nativeActive ? subscription.activeTrial : backendPremiumAccess.activeTrial,
      source: backendActive ? backendPremiumAccess.source : 'revenuecat',
      sponsorUserId: backendActive ? backendPremiumAccess.sponsorUserId : null,
      expiresAt: backendActive ? backendPremiumAccess.expiresAt : subscription.expirationDate
    });
    setMembershipCacheRevision((value) => value + 1);
  }, [
    backendPremiumAccess.activeTrial,
    backendPremiumAccess.checked,
    backendPremiumAccess.expiresAt,
    backendPremiumAccess.hasAccess,
    backendPremiumAccess.source,
    backendPremiumAccess.sponsorUserId,
    effectiveSession?.id,
    isLocalPreviewSession,
    subscription.active,
    subscription.activeTrial,
    subscription.checked,
    subscription.expirationDate
  ]);

  async function startPremiumSubscription() {
    setSubscription((current) => ({ ...current, loading: true, message: 'Opening App Store checkout...' }));
    trackAnalyticsEvent('trial_start_clicked', {
      configured: Boolean(effectiveSubscription.configured),
      nativeRuntime: canUseNativePurchases()
    }, { area: 'monetization' });
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
        trackAnalyticsEvent('purchase_completed', {
          activeTrial: Boolean(status.activeTrial),
          expirationDate: status.expirationDate || ''
        }, { area: 'monetization' });
        saveTrialAccessWindow(effectiveSession?.id, status.expirationDate);
        setLocalTrialAccessActive(true);
        if (effectiveSession?.role === 'athlete') setTab('home');
        setPremiumAccessRefreshKey((current) => current + 1);
        notifyUser('Premium unlocked', 'Your Complete Athlete subscription is active.', 'success', { type: 'points', id: `premium-active-${Date.now()}` });
      }
    } catch (error) {
      const cancelled = Boolean(error?.userCancelled);
      if (cancelled) {
        trackAnalyticsEvent('purchase_cancelled', {}, { area: 'monetization', severity: 'warning' });
        trackAnalyticsEvent('paywall_abandoned', { reason: 'purchase_cancelled' }, { area: 'monetization', severity: 'warning' });
        setSubscription((current) => ({
          ...current,
          loading: false,
          message: 'Purchase canceled.'
        }));
        return;
      }
      trackAnalyticsEvent('purchase_failed', {
        message: error?.message || 'unknown'
      }, { area: 'monetization', severity: 'error' });
      setSubscription((current) => ({
        ...current,
        loading: false,
        message: error?.message || 'The App Store checkout could not open yet. Try again or restore your purchase.'
      }));
    }
  }

  async function restorePremiumSubscription() {
    setSubscription((current) => ({ ...current, loading: true, message: 'Restoring purchases...' }));
    trackAnalyticsEvent('restore_purchase_clicked', {}, { area: 'monetization' });
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
        trackAnalyticsEvent('restore_purchase_completed', {
          activeTrial: Boolean(status.activeTrial),
          expirationDate: status.expirationDate || ''
        }, { area: 'monetization' });
        setTrialPromptDismissed(true);
        saveTrialPromptDismissed(effectiveSession?.id);
        saveTrialAccessWindow(effectiveSession?.id, status.expirationDate);
        setLocalTrialAccessActive(true);
        if (effectiveSession?.role === 'athlete') setTab('home');
        setPremiumAccessRefreshKey((current) => current + 1);
      }
    } catch (error) {
      trackAnalyticsEvent('restore_purchase_failed', {
        message: error?.message || 'unknown'
      }, { area: 'monetization', severity: 'warning' });
      setSubscription((current) => ({
        ...current,
        loading: false,
        message: error?.message || 'Purchases could not be restored yet.'
      }));
    }
  }

  function changeAthleteTab(nextTab) {
    if (nextTab !== tab) {
      trackAnalyticsEvent('tab_opened', { from: tab, to: nextTab }, { area: 'navigation' });
    }
    setTab(nextTab);
    if (nextTab === 'profile') setProfileView('overview');
  }

  function openAthleteProfileView(nextView) {
    setProfileView(nextView);
    setTab('profile');
  }

  function changeParentTab(nextTab) {
    if (nextTab !== parentTab) {
      trackAnalyticsEvent('parent_tab_opened', { from: parentTab, to: nextTab }, { area: 'navigation' });
    }
    setParentTab(nextTab);
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
          linkedAthletes={linkedAthletes}
          linkedAthleteId={linkedAthleteId}
          linkedAthleteSummary={linkedAthleteSummary}
          deleteAccount={deleteAccount}
          linkParentAccessCode={linkParentAccessCode}
          parentAccessDraft={parentAccessDraft}
          parentLinkChecked={parentLinkChecked}
          parentLinkFeedback={parentLinkFeedback}
          parentGuides={localizedParentGuides}
          parentMessage={localizedParentMessage}
          language={language}
          premiumAccessAllowed={premiumAccessAllowed}
          planProgress={planProgress}
          plans={localizedPlans}
          pointsLedger={pointsLedger}
          readinessHistory={readinessHistory}
          setParentAccessDraft={setParentAccessDraft}
          setParentLinkFeedback={setParentLinkFeedback}
          setLanguage={changeLanguage}
          selectLinkedAthlete={selectParentAthlete}
          unlinkParentAthlete={unlinkParentAthlete}
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
          setProfileView={setProfileView}
          standardsHistory={standardsHistory}
          requestMilestoneReview={requestMilestoneReview}
        />
      );
    }
    const screens = {
      home: (
        <HomeScreen
          athleteScore={athleteScore}
          athleteProfile={athleteProfile}
          athleteJourney={athleteJourney}
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
          openJournal={() => openAthleteProfileView('journal')}
          setRequestedPlanSeriesId={setRequestedPlanSeriesId}
          setRequestedPlanId={setRequestedPlanId}
          setAthleteJourney={setAthleteJourney}
          notifyUser={notifyUser}
          celebrate={celebrate}
          lastSubmittedDate={lastSubmittedDate}
          lesson={activeLesson}
          planProgress={planProgress}
          plans={localizedPlans}
          recentPointEvents={recentPointEvents}
          standardsHistory={standardsHistory}
          streakCount={streakCount}
          submittedToday={submittedToday}
          todayPoints={todayPoints}
          trackAnalyticsEvent={trackAnalyticsEvent}
          userId={authSession?.id}
          requestMilestoneReview={requestMilestoneReview}
        />
      ),
      plans: (
        <PlansScreen
          athleteProfile={athleteProfile}
          language={language}
          plans={localizedPlans}
          planProgress={planProgress}
          trialPlanMode={trialPlanMode}
          requestedPlanSeriesId={requestedPlanSeriesId}
          requestedPlanId={requestedPlanId}
          setRequestedPlanSeriesId={setRequestedPlanSeriesId}
          setRequestedPlanId={setRequestedPlanId}
          setPlanProgress={setPlanProgress}
          awardPoints={awardPoints}
          notifyUser={notifyUser}
          persistPlanCompletion={persistPlanCompletion}
          requestMilestoneReview={requestMilestoneReview}
          trackAnalyticsEvent={trackAnalyticsEvent}
        />
      ),
      journal: (
        <GoalCommandCenter
          awardPoints={awardPoints}
          celebrate={celebrate}
          goalAddedPoints={pointValues.goalAdded}
          goalCompletedPoints={pointValues.goalCompleted}
          goals={goals}
          setGoals={setGoals}
          setStandards={setStandards}
          standards={standards}
          standardsHistory={standardsHistory}
          streakCount={streakCount}
          trackAnalyticsEvent={trackAnalyticsEvent}
          userId={authSession?.id}
        />
      ),
      coach: (
        <CoachScreen
          activeCoachSessionId={activeCoachSessionId}
          athleteJourney={athleteJourney}
          athleteProfile={athleteProfile}
          authSession={authSession}
          coachComposerFocused={coachComposerFocused}
          coachSessions={coachSessions}
          lesson={activeLesson}
          language={language}
          goals={goals}
          messages={messages}
          planProgress={planProgress}
          plans={localizedPlans}
          standards={standards}
          streakCount={streakCount}
          setActiveCoachSessionId={setActiveCoachSessionId}
          setCoachSessions={setCoachSessions}
          setMessages={setMessages}
          messageDraft={messageDraft}
          setMessageDraft={setMessageDraft}
          setCoachComposerFocused={setCoachComposerFocused}
          trackAnalyticsEvent={trackAnalyticsEvent}
        />
      ),
      profile: (
        profileView === 'journal' ? (
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
            setProfileView={setProfileView}
            goals={goals}
            trackAnalyticsEvent={trackAnalyticsEvent}
          />
        ) : profileView === 'settings' ? (
        <AthleteSettingsScreen
          authSession={authSession}
          athleteProfile={athleteProfile}
          athleteParentAccessDraft={athleteParentAccessDraft}
          athleteParentLinkFeedback={athleteParentLinkFeedback}
          deleteAccount={deleteAccount}
          linkAthleteParentAccessCode={linkAthleteParentAccessCode}
          language={language}
          notificationPreferences={notificationPreferences}
          privacySettings={privacySettings}
          persistAthleteProfile={persistAthleteProfile}
          requestBrowserNotifications={requestBrowserNotifications}
          logoutUser={logoutUser}
          setAthleteParentAccessDraft={setAthleteParentAccessDraft}
          setAthleteParentLinkFeedback={setAthleteParentLinkFeedback}
          setAthleteProfile={setAthleteProfile}
          setLanguage={changeLanguage}
          setNotificationPreferences={setNotificationPreferences}
          setPrivacySettings={setPrivacySettings}
          setProfileView={setProfileView}
          restorePremiumSubscription={restorePremiumSubscription}
          startPremiumSubscription={startPremiumSubscription}
          subscription={effectiveSubscription}
          updateNotificationPreference={updateNotificationPreference}
        />
        ) : profileView === 'achievements' ? (
          <AchievementsScreen
            goals={goals}
            journalEntries={journalEntries}
            plans={plans}
            planProgress={planProgress}
            standards={standards}
            standardsHistory={standardsHistory}
            streakCount={streakCount}
            setProfileView={setProfileView}
            userId={authSession?.id}
          />
        ) : profileView === 'support' ? (
          <AthleteSupportScreen setProfileView={setProfileView} />
        ) : profileView === 'stats' ? (
          <AthleteStatsScreen
            athleteScore={athleteScore}
            goals={goals}
            plans={plans}
            planProgress={planProgress}
            standardsHistory={standardsHistory}
            streakCount={streakCount}
          />
        ) : (
          <ProfileScreen
            athleteProfile={athleteProfile}
            athleteScore={athleteScore}
            athleteJourney={athleteJourney}
            authSession={authSession}
            goals={goals}
            plans={localizedPlans}
            planProgress={planProgress}
            setProfileView={setProfileView}
            streakCount={streakCount}
          />
        )
      )
    };
    return screens[tab];
  }, [
    activeLesson,
    athleteScore,
    awardPoints,
    completion,
    confidenceAverage,
    goals,
    journal,
    journalEntries,
    journalGoalId,
    journalType,
    language,
    lessonLibrary,
    localTrialAccessActive,
    lastSubmittedDate,
    activeCoachSessionId,
    athleteStartComplete,
    athleteProfile,
    athleteJourney,
    athleteParentAccessDraft,
    athleteParentLinkFeedback,
    backendPremiumAccess,
    coachSessions,
    coachComposerFocused,
    messageDraft,
    messages,
    notificationPreferences,
    parentGuides,
    localizedParentGuides,
    parentTab,
    parentMessage,
    localizedParentMessage,
    linkedAthletes,
    linkedAthleteId,
    linkedAthleteSummary,
    premiumAccessAllowed,
    trialPlanMode,
    planProgress,
    plans,
    localizedPlans,
    changeLanguage,
    profileView,
    recentPointEvents,
    privacySettings,
    readinessHistory,
    requestedPlanSeriesId,
    requestedPlanId,
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
    trackAnalyticsEvent
  ]);

  if (!isAuthed) {
    return (
      <AuthScreen
        completePasswordRecovery={completePasswordRecovery}
        language={interfaceLanguage}
        loginUser={loginUser}
        enterReviewerAccess={enterReviewerAccess}
        passwordRecoveryActive={passwordRecoveryActive}
        requestPasswordReset={requestPasswordReset}
        signupUser={signupUser}
        parentAccessCode={athleteProfile.parentAccessCode}
      />
    );
  }

  if (!prototypeBypassLogin && (!localParentInviteSession || parentFirstTimePreview) && !athleteTodayPreview && (effectiveSession?.role === 'parent'
    ? (parentFirstTimePreview || parentLinkChecked) && !String(effectiveSession.id).startsWith('app-review-') && !parentOnboardingAccounts[effectiveSession.id]
    : !onboardingComplete)) {
    if (effectiveSession?.role === 'parent') {
      return <ParentOnboardingScreen
        authSession={effectiveSession}
        completeOnboarding={completeOnboarding}
        parentGuides={localizedParentGuides}
        trackAnalyticsEvent={trackAnalyticsEvent}
      />;
    }
    return <OnboardingScreen
      athleteParentAccessDraft={athleteParentAccessDraft}
      athleteParentLinkFeedback={athleteParentLinkFeedback}
      authSession={effectiveSession}
      completeOnboarding={completeOnboarding}
      linkAthleteParentAccessCode={linkAthleteParentAccessCode}
      plans={localizedPlans}
      setAthleteParentAccessDraft={setAthleteParentAccessDraft}
      setAthleteParentLinkFeedback={setAthleteParentLinkFeedback}
      trackAnalyticsEvent={trackAnalyticsEvent}
    />;
  }

  if (premiumAccessLoading) {
    return <MembershipCheckScreen />;
  }

  if (
    !premiumAccessAllowed
    && effectiveSession.role === 'athlete'
    && !athleteStartComplete
  ) {
    return (
      <main className="activation-rep-shell">
        <AthleteStartToday
          athleteProfile={athleteProfile}
          celebrate={celebrate}
          lesson={activeLesson}
          plans={localizedPlans}
          planProgress={planProgress}
          setAthleteStartComplete={setAthleteStartComplete}
          setJournal={setJournal}
          setJournalType={setJournalType}
          setStandards={setStandards}
          setTab={setTab}
          setRequestedPlanSeriesId={setRequestedPlanSeriesId}
          trackAnalyticsEvent={trackAnalyticsEvent}
        />
      </main>
    );
  }

  if (!premiumAccessAllowed) {
    return (
      <TrialPaywallScreen
        athleteProfile={athleteProfile}
        plans={localizedPlans}
        planProgress={planProgress}
        role={effectiveSession.role}
        restorePremiumSubscription={restorePremiumSubscription}
        startPremiumSubscription={startPremiumSubscription}
        subscription={effectiveSubscription}
        trackAnalyticsEvent={trackAnalyticsEvent}
      />
    );
  }

  const useMobileAppShell = typeof window !== 'undefined'
    && (
      document.documentElement.classList.contains('native-shell')
      || isPhoneViewport
    );
  const coachKeyboardOpen = typeof document !== 'undefined' && document.documentElement.classList.contains('keyboard-open');
  const coachTypingMode = useMobileAppShell && view === 'athlete' && tab === 'coach' && coachComposerFocused && coachKeyboardOpen;
  const isAthleteHome = view === 'athlete' && tab === 'home';
  const isParentOverview = view === 'parent' && parentTab === 'overview';

  return (
    <div
      className={`${useMobileAppShell ? 'mobile-native-app' : 'app-shell'} previous-design ${view}-experience ${view === 'athlete' ? `${tab}-tab` : `${parentTab}-parent-tab`}${coachTypingMode ? ' coach-typing-mode' : ''}${isParentOverview ? ' parent-dashboard-active' : ''}`}
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
            {(isAthleteHome || isParentOverview) && (
              <div className="home-greeting-block">
                <p className={`top-greeting${isAthleteHome ? ' athlete-home-greeting' : ' parent-home-greeting'}`}>{firstNameGreeting(effectiveSession.name)}</p>
              </div>
            )}
            {!isAthleteHome && !isParentOverview && (
              <h1>{view === 'athlete' ? (tab === 'profile' ? ({ overview: 'My Profile', journal: 'My Journal', achievements: 'My Badges', stats: 'My Stats', settings: 'Settings', support: 'Help & Support' }[profileView]) : screenTitles[tab]) : ({ overview: 'Parent Dashboard', 'parent-corner': 'Parent Corner', settings: 'Parent Settings' }[parentTab])}</h1>
            )}
          </div>
          <button className="icon-button notification-button" aria-label="Notifications" onClick={toggleNotifications}>
            <Bell size={19} />
            {unreadNotifications.length > 0 && <span>{unreadNotifications.length}</span>}
          </button>
        </header>

        {notificationsOpen && (
          <NotificationTray notifications={recentNotifications} onClose={() => setNotificationsOpen(false)} />
        )}

        {celebration && <div className="celebration-banner">{celebration}</div>}

        <section className="content">{content}</section>

        <PersistentPlanAudioPlayer />
        {view === 'athlete' && !coachTypingMode && <BottomNav tab={tab} setTab={changeAthleteTab} />}
        {view === 'parent' && <ParentBottomNav tab={parentTab} setTab={changeParentTab} />}
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

function LanguageSwitcher({ language, onChange, compact = false }) {
  return (
    <div className={`language-switcher${compact ? ' compact' : ''}`} aria-label="App language">
      {supportedLanguages.map((option) => (
        <button
          aria-pressed={language === option.code}
          className={language === option.code ? 'active' : ''}
          key={option.code}
          onClick={() => onChange(option.code)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function AuthScreen({ completePasswordRecovery, enterReviewerAccess, language, loginUser, passwordRecoveryActive, requestPasswordReset, signupUser, parentAccessCode }) {
  const inviteParams = new URLSearchParams(window.location.search);
  const invitedRole = inviteParams.get('role');
  const invitedCode = inviteParams.get('parentCode') ?? '';
  const invitedAsParent = invitedRole === 'parent' && invitedCode;
  const [mode, setMode] = useState(invitedAsParent ? 'signup' : 'login');
  const [authStep, setAuthStep] = useState(passwordRecoveryActive ? 'recovery' : 'form');
  const [role, setRole] = useState(invitedAsParent ? 'parent' : 'athlete');
  const [form, setForm] = useState({ name: '', email: '', password: '', parentCode: invitedCode, parentFamilyCode: '' });
  const [recoveryForm, setRecoveryForm] = useState({ password: '', confirmPassword: '' });
  const [passwordVisibility, setPasswordVisibility] = useState({ auth: false, recovery: false, confirmation: false });
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authSheetOpen, setAuthSheetOpen] = useState(Boolean(invitedAsParent || passwordRecoveryActive));
  const [videoFailed, setVideoFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ));
  const videoRef = useRef(null);
  const closeSheetRef = useRef(null);
  const sheetRef = useRef(null);
  const authTriggerRef = useRef(null);

  useEffect(() => {
    if (!passwordRecoveryActive) return;
    setAuthStep('recovery');
    setAuthSheetOpen(true);
    setMessage('');
  }, [passwordRecoveryActive]);

  useEffect(() => {
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReduceMotion(Boolean(motionQuery?.matches));
    const syncPlayback = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.hidden || motionQuery?.matches) {
        video.pause();
        return;
      }
      video.play().catch(() => {});
    };
    syncMotion();
    syncPlayback();
    motionQuery?.addEventListener?.('change', syncMotion);
    motionQuery?.addEventListener?.('change', syncPlayback);
    document.addEventListener('visibilitychange', syncPlayback);
    return () => {
      motionQuery?.removeEventListener?.('change', syncMotion);
      motionQuery?.removeEventListener?.('change', syncPlayback);
      document.removeEventListener('visibilitychange', syncPlayback);
    };
  }, []);

  useEffect(() => {
    if (!authSheetOpen) return undefined;
    window.requestAnimationFrame(() => closeSheetRef.current?.focus({ preventScroll: true }));
    const handleDialogKey = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        closeAuthSheet();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(sheetRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      ) || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleDialogKey);
    return () => document.removeEventListener('keydown', handleDialogKey);
  }, [authSheetOpen, isSubmitting]);

  function closeAuthSheet() {
    setAuthSheetOpen(false);
    window.requestAnimationFrame(() => authTriggerRef.current?.focus({ preventScroll: true }));
  }

  function openAuth(nextMode, event) {
    if (event?.currentTarget) authTriggerRef.current = event.currentTarget;
    setMode(nextMode);
    setAuthStep('form');
    setMessage('');
    setAuthSheetOpen(true);
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage('');
  }

  function togglePasswordVisibility(field) {
    setPasswordVisibility((current) => ({ ...current, [field]: !current[field] }));
  }

  useEffect(() => {
    const showError = (event) => { setMessage(event.detail); setAuthSheetOpen(true); setIsSubmitting(false); };
    window.addEventListener('tca-auth-error', showError);
    const params = new URLSearchParams(window.location.search);
    if (params.has('error')) { setMessage('Sign-in was not completed. Please try again.'); setAuthSheetOpen(true); }
    return () => window.removeEventListener('tca-auth-error', showError);
  }, []);

  async function socialSignIn(provider) {
    setIsSubmitting(true);
    setMessage('');
    try { await startSocialAuth(supabase, oauthSupabase, provider, { ...form, role, mode, language }); }
    catch (error) { setMessage(error?.message || 'Sign-in could not be completed. Please try again.'); }
    finally { setIsSubmitting(false); }
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (!role) {
      setMessage('Choose athlete or parent to continue.');
      return;
    }
    setIsSubmitting(true);
    setMessage(mode === 'login' ? 'Signing in...' : 'Creating account...');
    try {
      const error = mode === 'login'
        ? await loginUser({ role, email: form.email, password: form.password })
        : await signupUser({ role, name: form.name, email: form.email, password: form.password, parentCode: form.parentCode, parentFamilyCode: form.parentFamilyCode });
      setMessage(error);
    } catch (error) {
      setMessage(error?.message || 'Something went wrong. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function sendPasswordReset() {
    setIsSubmitting(true);
    setMessage('Sending reset email...');
    try {
      setMessage(await requestPasswordReset(form.email));
    } catch (error) {
      setMessage(error?.message || 'Password reset could not be sent. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitPasswordRecovery(event) {
    event.preventDefault();
    if (recoveryForm.password.length < 8) {
      setMessage('Use at least 8 characters for your new password.');
      return;
    }
    if (recoveryForm.password !== recoveryForm.confirmPassword) {
      setMessage('Those passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    setMessage('Updating your password...');
    try {
      const error = await completePasswordRecovery(recoveryForm.password);
      if (error) {
        setMessage(error);
        return;
      }
      setRecoveryForm({ password: '', confirmPassword: '' });
      setForm((current) => ({ ...current, password: '' }));
      setMode('login');
      setAuthStep('form');
      setMessage('Password updated. Log in with your new password.');
    } catch (error) {
      setMessage(error?.message || 'Your password could not be updated. Request a new reset link and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={`auth-cinematic-shell${authSheetOpen ? ' sheet-open' : ''}`} aria-label="The Complete Athlete login">
      <div className="auth-cinematic-media" aria-hidden="true">
        {!reduceMotion && !videoFailed && (
          <video
            ref={videoRef}
            className="auth-cinematic-video"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
            onError={() => setVideoFailed(true)}
          >
            <source src="/assets/onboarding-login-hero.mp4" type="video/mp4" />
          </video>
        )}
        <div className="auth-cinematic-scrim" />
      </div>

      <section className="auth-cinematic-foreground" aria-hidden={authSheetOpen ? 'true' : undefined} inert={authSheetOpen ? true : undefined}>
        <div className="auth-cinematic-brand">
          <p>THE COMPLETE ATHLETE</p>
          <h1>TRAIN THE PART OF YOUR GAME<br />NO ONE SEES.</h1>
        </div>
        <div className="auth-cinematic-actions" aria-label="Account actions">
          <button className="auth-create-button" onClick={(event) => openAuth('signup', event)} type="button">Create account</button>
          <button className="auth-login-button" onClick={(event) => openAuth('login', event)} type="button">Log in</button>
        </div>
        <div className="auth-cinematic-legal">
          <LegalLink href={LEGAL_URLS.privacy}>Privacy</LegalLink>
          <LegalLink href={LEGAL_URLS.terms}>Terms</LegalLink>
          <LegalLink href={LEGAL_URLS.support}>Support</LegalLink>
        </div>
      </section>

      {authSheetOpen && (
        <section
          ref={sheetRef}
          className="auth-bottom-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={authStep === 'forgot' ? 'Reset password' : authStep === 'recovery' ? 'Create a new password' : mode === 'signup' ? 'Create account' : 'Log in'}
        >
          <div className="auth-sheet-handle" aria-hidden="true" />
          <div className="auth-sheet-header">
            <div>
              <span>THE COMPLETE ATHLETE</span>
              <h2>{authStep === 'forgot' ? 'Reset your password.' : authStep === 'recovery' ? 'Create a new password.' : mode === 'signup' ? 'Choose your experience' : 'Welcome back.'}</h2>
              <p>{authStep === 'forgot' ? 'We’ll email you a secure reset link.' : authStep === 'recovery' ? 'Choose a password you have not used before.' : mode === 'signup' ? 'Create the account built for your role.' : 'Log in to continue building.'}</p>
            </div>
            <button ref={closeSheetRef} className="auth-sheet-close" aria-label="Close authentication form" disabled={isSubmitting} onClick={closeAuthSheet} type="button">
              <X size={20} />
            </button>
          </div>

          {authStep === 'form' && (
            <>
              <div className="auth-mode auth-sheet-mode">
                <button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setMessage(''); }} type="button">Create account</button>
                <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setMessage(''); }} type="button">Log in</button>
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

              <div className="auth-social-options" aria-label="Other ways to sign in">
                <button className="auth-social-button auth-social-apple" disabled={isSubmitting} onClick={() => socialSignIn('apple')} type="button">Continue with Apple</button>
                <button className="auth-social-button auth-social-google" disabled={isSubmitting} onClick={() => socialSignIn('google')} type="button">Continue with Google</button>
                <span className="auth-social-divider">or use email</span>
              </div>
              <form className="auth-form" onSubmit={submitAuth}>
                {mode === 'signup' && (
                  <label>
                    <span>Name</span>
                    <input className="text-field" placeholder="Full name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} />
                  </label>
                )}
                <label>
                  <span>Email</span>
                  <input autoComplete="email" className="text-field" placeholder="name@email.com" type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} />
                </label>
                <label>
                  <span>Password</span>
                  <div className="auth-password-field">
                    <input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="text-field" placeholder="Password" type={passwordVisibility.auth ? 'text' : 'password'} value={form.password} onChange={(event) => updateForm('password', event.target.value)} />
                    <button
                      aria-label={passwordVisibility.auth ? 'Hide password' : 'Show password'}
                      aria-pressed={passwordVisibility.auth}
                      className="auth-password-toggle"
                      onClick={() => togglePasswordVisibility('auth')}
                      type="button"
                    >
                      {passwordVisibility.auth ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                </label>
                {mode === 'signup' && role === 'parent' && (
                  <label>
                    <span>Parent access code</span>
                    <input className="text-field" placeholder={parentAccessCode} value={form.parentCode} onChange={(event) => updateForm('parentCode', event.target.value)} />
                  </label>
                )}
                {mode === 'signup' && role === 'athlete' && (
                  <label>
                    <span>Family access code</span>
                    <input className="text-field" placeholder="Optional parent code" value={form.parentFamilyCode} onChange={(event) => updateForm('parentFamilyCode', event.target.value)} />
                  </label>
                )}
                {message && <p className="inline-warning">{message}</p>}
                <button className="primary-action full" disabled={isSubmitting} type="submit">
                  <LockKeyhole size={18} />
                  {isSubmitting ? 'Working...' : mode === 'login' ? 'Log In' : 'Create Account'}
                </button>
                {mode === 'login' && (
                  <button className="auth-forgot-link" disabled={isSubmitting} onClick={() => { setAuthStep('forgot'); setMessage(''); }} type="button">Forgot password?</button>
                )}
                {mode === 'login' && message && message !== 'Signing in...' && (
                  <button className="ghost-action full review-access-button" disabled={isSubmitting} onClick={() => enterReviewerAccess(role)} type="button">Continue with review access</button>
                )}
              </form>
            </>
          )}

          {authStep === 'forgot' && (
            <form className="auth-form auth-recovery-form" onSubmit={(event) => { event.preventDefault(); sendPasswordReset(); }}>
              <label>
                <span>Email</span>
                <input autoComplete="email" autoFocus className="text-field" placeholder="name@email.com" required type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} />
              </label>
              {message && <p className="inline-warning auth-recovery-message">{message}</p>}
              <button className="primary-action full" disabled={isSubmitting} type="submit">
                <LockKeyhole size={18} />
                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
              </button>
              <button className="ghost-action full" disabled={isSubmitting} onClick={() => { setAuthStep('form'); setMode('login'); setMessage(''); }} type="button">Back to Log In</button>
            </form>
          )}

          {authStep === 'recovery' && (
            <form className="auth-form auth-recovery-form" onSubmit={submitPasswordRecovery}>
              <label>
                <span>New password</span>
                <div className="auth-password-field">
                  <input autoComplete="new-password" autoFocus className="text-field" minLength={8} placeholder="At least 8 characters" required type={passwordVisibility.recovery ? 'text' : 'password'} value={recoveryForm.password} onChange={(event) => { setRecoveryForm((current) => ({ ...current, password: event.target.value })); setMessage(''); }} />
                  <button
                    aria-label={passwordVisibility.recovery ? 'Hide new password' : 'Show new password'}
                    aria-pressed={passwordVisibility.recovery}
                    className="auth-password-toggle"
                    onClick={() => togglePasswordVisibility('recovery')}
                    type="button"
                  >
                    {passwordVisibility.recovery ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </label>
              <label>
                <span>Confirm new password</span>
                <div className="auth-password-field">
                  <input autoComplete="new-password" className="text-field" minLength={8} placeholder="Enter it again" required type={passwordVisibility.confirmation ? 'text' : 'password'} value={recoveryForm.confirmPassword} onChange={(event) => { setRecoveryForm((current) => ({ ...current, confirmPassword: event.target.value })); setMessage(''); }} />
                  <button
                    aria-label={passwordVisibility.confirmation ? 'Hide password confirmation' : 'Show password confirmation'}
                    aria-pressed={passwordVisibility.confirmation}
                    className="auth-password-toggle"
                    onClick={() => togglePasswordVisibility('confirmation')}
                    type="button"
                  >
                    {passwordVisibility.confirmation ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </label>
              {message && <p className="inline-warning auth-recovery-message">{message}</p>}
              <button className="primary-action full" disabled={isSubmitting} type="submit">
                <LockKeyhole size={18} />
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </button>
              <button className="ghost-action full" disabled={isSubmitting} onClick={() => { setAuthStep('forgot'); setMessage(''); }} type="button">Request Another Link</button>
            </form>
          )}
          <div className="auth-legal-links">
            <LegalLink href={LEGAL_URLS.privacy}>Privacy</LegalLink>
            <LegalLink href={LEGAL_URLS.terms}>Terms</LegalLink>
            <LegalLink href={LEGAL_URLS.support}>Support</LegalLink>
          </div>
        </section>
      )}
    </main>
  );
}

const parentAssessmentQuestions = [
  {
    id: 'primary_parent_goal',
    question: 'What do you want to help your athlete with most right now?',
    helper: 'Choose the one that feels most important right now.',
    options: ['Building confidence', 'Handling pressure', 'Staying motivated', 'Becoming more disciplined', 'Responding better to mistakes', 'Setting and working toward goals', 'Handling coaching and feedback', 'Preparing for the next level']
  },
  {
    id: 'observed_athlete_challenge',
    question: 'What do you notice most when things aren’t going well?',
    helper: 'Choose the one that best matches what you usually see.',
    options: ['They get down on themselves', 'They overthink', 'They get frustrated or emotional', 'They lose motivation', 'They struggle to stay consistent', 'They worry about what others are doing', 'They feel pressure to perform', 'I’m not always sure what’s going on']
  },
  {
    id: 'parent_response_style',
    question: 'When your athlete has a bad game or practice, what do you usually do first?',
    helper: 'Choose the response that sounds most like you.',
    options: ['Give them space', 'Ask what happened', 'Try to fix the problem', 'Encourage them', 'Talk about what they could improve', 'Wait for them to bring it up', 'It depends']
  },
  {
    id: 'parent_strength',
    question: 'What do you think you already do well as a sports parent?',
    helper: 'Choose the strength you’re most proud of.',
    affirmation: 'That matters. Great support starts with awareness.',
    options: ['I show up consistently', 'I encourage my athlete', 'I keep sports in perspective', 'I listen', 'I help them stay disciplined', 'I give them space to grow', 'I advocate for them', 'I’m still learning']
  },
  {
    id: 'desired_parent_value',
    question: 'What would be most valuable to you inside The Complete Athlete?',
    helper: 'Choose the one that would help you most right now.',
    options: ['Knowing how to support my athlete mentally', 'Understanding what they’re working on', 'Helping them stay accountable', 'Better conversations after games', 'Helping them build confidence', 'Tracking progress toward goals', 'Learning more about recruiting and exposure', 'A little bit of everything']
  }
];

const parentAssessmentAnswerTags = {
  'Building confidence': [['confidence', 4]],
  'Handling pressure': [['pressure', 4]],
  'Staying motivated': [['motivation', 4]],
  'Becoming more disciplined': [['discipline', 4], ['accountability', 2]],
  'Responding better to mistakes': [['mistakes', 4], ['resilience', 2]],
  'Setting and working toward goals': [['goals', 4], ['accountability', 1]],
  'Handling coaching and feedback': [['coachability', 4], ['communication', 1]],
  'Preparing for the next level': [['recruiting', 4]],
  'They get down on themselves': [['confidence', 3], ['mistakes', 2]],
  'They overthink': [['pressure', 2], ['mistakes', 2]],
  'They get frustrated or emotional': [['mistakes', 3], ['communication', 1]],
  'They lose motivation': [['motivation', 3]],
  'They struggle to stay consistent': [['discipline', 3], ['accountability', 1]],
  'They worry about what others are doing': [['comparison', 4], ['confidence', 1]],
  'They feel pressure to perform': [['pressure', 4]],
  'I’m not always sure what’s going on': [['support', 2], ['communication', 2]],
  'Give them space': [['support', 1]],
  'Ask what happened': [['communication', 2]],
  'Try to fix the problem': [['accountability', 1], ['communication', 1]],
  'Encourage them': [['confidence', 2]],
  'Talk about what they could improve': [['coachability', 1], ['accountability', 1]],
  'Wait for them to bring it up': [['communication', 1], ['support', 1]],
  'It depends': [['support', 1]],
  'I show up consistently': [['support', 2]],
  'I encourage my athlete': [['confidence', 1], ['support', 1]],
  'I keep sports in perspective': [['support', 2]],
  'I listen': [['communication', 2], ['support', 1]],
  'I help them stay disciplined': [['discipline', 1], ['accountability', 1]],
  'I give them space to grow': [['support', 2]],
  'I advocate for them': [['support', 2]],
  'I’m still learning': [['support', 1]],
  'Knowing how to support my athlete mentally': [['support', 3], ['confidence', 1]],
  'Understanding what they’re working on': [['communication', 3]],
  'Helping them stay accountable': [['accountability', 4], ['discipline', 2]],
  'Better conversations after games': [['communication', 4], ['mistakes', 1]],
  'Helping them build confidence': [['confidence', 4]],
  'Tracking progress toward goals': [['goals', 4], ['accountability', 1]],
  'Learning more about recruiting and exposure': [['recruiting', 4]],
  'A little bit of everything': [['support', 2], ['confidence', 1], ['discipline', 1]]
};

const parentFocusCopy = {
  confidence: { label: 'Confidence', title: 'Build confidence without adding pressure', statement: 'Help your athlete build belief while giving them room to grow.' },
  pressure: { label: 'Pressure', title: 'Help them handle pressure with more control', statement: 'Support calm preparation without trying to remove every difficult moment.' },
  motivation: { label: 'Motivation', title: 'Build motivation that lasts beyond the moment', statement: 'Create the environment that helps effort and ownership keep growing.' },
  discipline: { label: 'Discipline', title: 'Build consistency without constant pushing', statement: 'Help daily standards become something your athlete learns to own.' },
  accountability: { label: 'Accountability', title: 'Create accountability that builds ownership', statement: 'Support follow-through while keeping responsibility with your athlete.' },
  mistakes: { label: 'Resilience', title: 'Help them reset after hard moments', statement: 'Give mistakes less power and help the next response become stronger.' },
  resilience: { label: 'Resilience', title: 'Help them respond and recover', statement: 'Build a healthier response to adversity, pressure, and imperfect performances.' },
  goals: { label: 'Goals', title: 'Turn big goals into clear daily action', statement: 'Help your athlete connect what they want with what they can do today.' },
  coachability: { label: 'Coachability', title: 'Support growth through coaching', statement: 'Help feedback become fuel for development instead of a threat.' },
  comparison: { label: 'Comparison', title: 'Help them trust their own path', statement: 'Keep attention on their growth instead of someone else’s timeline.' },
  communication: { label: 'Communication', title: 'Create better conversations around sport', statement: 'Know when to listen, when to encourage, and when to help them think.' },
  recruiting: { label: 'Next Level', title: 'Prepare for the next level with clarity', statement: 'Make recruiting and exposure decisions from a stronger foundation.' },
  support: { label: 'Support', title: 'Support the whole athlete', statement: 'Create the environment, language, and perspective that help development last.' }
};

const parentPlanRecommendationCopy = {
  'Borrowed Confidence': 'Learn how your reactions can strengthen your athlete’s confidence.',
  "Pressure Isn't the Enemy": 'Help your athlete handle expectations without trying to remove every difficult moment.',
  'Home Court Advantage': 'Create a home environment that supports growth instead of adding pressure.',
  'The Comparison Trap': 'Help your athlete trust their own development instead of measuring it against someone else’s path.',
  'Elite Athletes Need Elite Parents': 'Lead with vision, environment, and example instead of pressure or panic.',
  'College Recruiting 101': 'Understand recruiting and help your athlete approach the next level with clarity.',
  'Raising a Complete Athlete': 'Build confidence, discipline, and character beyond the scoreboard.'
};

function deriveParentRecommendations(answers, parentGuides) {
  const tagScores = new Map();
  Object.values(answers).forEach((answer) => {
    (parentAssessmentAnswerTags[answer] || []).forEach(([tag, weight]) => {
      tagScores.set(tag, (tagScores.get(tag) || 0) + weight);
    });
  });

  const weightedPlans = {
    'Borrowed Confidence': { confidence: 6, mistakes: 2, communication: 2 },
    "Pressure Isn't the Enemy": { pressure: 6, mistakes: 4, resilience: 4, confidence: 2, communication: 1 },
    'Home Court Advantage': { support: 5, communication: 5, confidence: 3, pressure: 2, mistakes: 2, discipline: 4, accountability: 4, goals: 1, motivation: 1 },
    'The Comparison Trap': { comparison: 7 },
    'Elite Athletes Need Elite Parents': { discipline: 5, accountability: 5, coachability: 5, recruiting: 2, motivation: 3, pressure: 1, goals: 2 },
    'College Recruiting 101': { recruiting: 8 },
    'Raising a Complete Athlete': { support: 3, goals: 4, discipline: 3, motivation: 2, accountability: 2 }
  };

  const explicitPriorityGroups = [
    {
      answers: ['Building confidence', 'They get down on themselves', 'Helping them build confidence'],
      plans: ['Borrowed Confidence', 'Home Court Advantage', "Pressure Isn't the Enemy"]
    },
    {
      answers: ['Handling pressure', 'They feel pressure to perform'],
      plans: ["Pressure Isn't the Enemy", 'Home Court Advantage', 'Elite Athletes Need Elite Parents']
    },
    {
      answers: ['They worry about what others are doing'],
      plans: ['The Comparison Trap', 'Borrowed Confidence']
    },
    {
      answers: ['Handling coaching and feedback'],
      plans: ['Elite Athletes Need Elite Parents', 'Home Court Advantage']
    },
    {
      answers: ['Preparing for the next level', 'Learning more about recruiting and exposure'],
      plans: ['College Recruiting 101', 'Elite Athletes Need Elite Parents']
    },
    {
      answers: ['Better conversations after games'],
      plans: ['Home Court Advantage', 'Borrowed Confidence', "Pressure Isn't the Enemy"]
    },
    {
      answers: ['Helping them stay accountable', 'Becoming more disciplined'],
      plans: ['Elite Athletes Need Elite Parents', 'Home Court Advantage']
    }
  ];
  const selectedAnswers = new Set(Object.values(answers));
  const explicitPlanBoosts = new Map();
  explicitPriorityGroups.forEach((group) => {
    const matchCount = group.answers.filter((answer) => selectedAnswers.has(answer)).length;
    if (!matchCount) return;
    group.plans.forEach((plan, index) => {
      explicitPlanBoosts.set(plan, (explicitPlanBoosts.get(plan) || 0) + matchCount * (100 - index * 10));
    });
  });

  const guidesBySeries = new Map();
  (parentGuides || []).forEach((guide) => {
    const englishTitle = guide.seriesTitleEn || guide.seriesTitle;
    if (!guidesBySeries.has(englishTitle)) guidesBySeries.set(englishTitle, { ...guide, englishTitle });
  });

  const rankedTags = Array.from(tagScores.entries()).sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]));
  const primaryTag = rankedTags[0]?.[0] || 'support';
  const strength = answers.parent_strength;
  const recommendations = Array.from(guidesBySeries.values()).map((guide, index) => {
    const weights = weightedPlans[guide.englishTitle] || {};
    let score = Object.entries(weights).reduce((total, [tag, weight]) => total + (tagScores.get(tag) || 0) * weight, 0);
    score += explicitPlanBoosts.get(guide.englishTitle) || 0;
    if (strength === 'I give them space to grow' && !tagScores.get('discipline') && guide.englishTitle === 'Elite Athletes Need Elite Parents') score -= 8;
    if (strength === 'I listen' && (tagScores.get('communication') || 0) < 4 && guide.englishTitle === 'Home Court Advantage') score -= 4;
    if (strength === 'I keep sports in perspective' && ((tagScores.get('pressure') || 0) + (tagScores.get('mistakes') || 0) < 4) && guide.englishTitle === "Pressure Isn't the Enemy") score -= 6;
    return {
      id: guide.id,
      title: guide.seriesTitle,
      englishTitle: guide.englishTitle,
      description: parentPlanRecommendationCopy[guide.englishTitle] || guide.subject,
      score,
      order: index
    };
  }).sort((first, second) => second.score - first.score || first.order - second.order).slice(0, 3);

  const focus = parentFocusCopy[primaryTag] || parentFocusCopy.support;
  const supportingTags = rankedTags.map(([tag]) => tag).filter((tag) => tag !== primaryTag).slice(0, 2);
  return {
    primaryTag,
    focus,
    supportingTags,
    tags: rankedTags.map(([tag]) => tag),
    recommendations,
    why: `You told us ${focus.label.toLowerCase()} is one of the biggest areas you want to help with${supportingTags.length ? `, with ${supportingTags.map((tag) => (parentFocusCopy[tag] || parentFocusCopy.support).label.toLowerCase()).join(' and ')} also shaping what you see` : ''}. These plans were selected to give you practical support without adding more weight to the moment.`
  };
}

function ParentOnboardingScreen({ authSession, completeOnboarding, parentGuides, trackAnalyticsEvent }) {
  const [stage, setStage] = useState('intro');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showWhy, setShowWhy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const revealTrackedRef = useRef(false);
  const recommendations = useMemo(() => deriveParentRecommendations(answers, parentGuides), [answers, parentGuides]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [stage, questionIndex]);

  useEffect(() => {
    if (stage !== 'reveal' || revealTrackedRef.current) return;
    revealTrackedRef.current = true;
    trackAnalyticsEvent?.('parent_assessment_completed', { responses: answers }, { area: 'activation' });
    trackAnalyticsEvent?.('parent_recommendations_generated', {
      primaryFocus: recommendations.primaryTag,
      derivedTags: recommendations.tags,
      recommendedPlans: recommendations.recommendations.map((plan) => plan.englishTitle)
    }, { area: 'activation' });
    trackAnalyticsEvent?.('parent_recommendation_reveal_viewed', {
      primaryFocus: recommendations.primaryTag,
      recommendationCount: recommendations.recommendations.length
    }, { area: 'activation' });
    recommendations.recommendations.forEach((plan, index) => {
      trackAnalyticsEvent?.('parent_plan_viewed', { planId: plan.id, planTitle: plan.englishTitle, source: 'onboarding_recommendation', position: index + 1 }, { area: 'plans' });
    });
  }, [stage, answers, recommendations, trackAnalyticsEvent]);

  function beginAssessment() {
    trackAnalyticsEvent?.('parent_assessment_started', { questionCount: parentAssessmentQuestions.length }, { area: 'activation' });
    setQuestionIndex(0);
    setStage('questions');
  }

  function answerQuestion(answer) {
    const question = parentAssessmentQuestions[questionIndex];
    setAnswers((current) => ({ ...current, [question.id]: answer }));
    const delay = question.affirmation ? 650 : 140;
    window.setTimeout(() => {
      if (questionIndex < parentAssessmentQuestions.length - 1) setQuestionIndex((current) => current + 1);
      else setStage('reveal');
    }, delay);
  }

  async function continueToPaywall() {
    setSubmitting(true);
    await completeOnboarding({
      parentAssessment: answers,
      derivedParentTags: recommendations.tags,
      recommendedParentPlans: recommendations.recommendations.map((plan) => ({ id: plan.id, title: plan.englishTitle })),
      parentAssessmentCompletedAt: new Date().toISOString()
    });
    setSubmitting(false);
  }

  const question = parentAssessmentQuestions[questionIndex];
  return (
    <main className={`onboarding-shell parent-assessment-screen parent-assessment-${stage}`} aria-label="Parent onboarding">
      {stage === 'intro' && (
        <section className="parent-assessment-intro">
          <header>
            <p className="eyebrow">THE COMPLETE ATHLETE</p>
            <h1><span>Let’s personalize</span><span>your parent experience.</span></h1>
            <p>Every athlete needs something different from the people supporting them. Answer a few quick questions so we can recommend the best resources for you and your athlete.</p>
          </header>
          <div className="parent-assessment-count" aria-hidden="true"><strong>5</strong><span>QUESTIONS</span></div>
          <p className="parent-assessment-duration">5 QUESTIONS <i>•</i> ABOUT 45 SECONDS</p>
          <button className="primary-action full parent-assessment-cta" onClick={beginAssessment} type="button">Get Started <ArrowRight size={18}/></button>
        </section>
      )}

      {stage === 'questions' && (
        <section className="parent-question-stage">
          <div className="parent-question-progress" aria-label={`Question ${questionIndex + 1} of ${parentAssessmentQuestions.length}`}>
            <span>{String(questionIndex + 1).padStart(2, '0')} / 05</span>
            <div><i style={{ width: `${((questionIndex + 1) / parentAssessmentQuestions.length) * 100}%` }}/></div>
          </div>
          <div className="parent-question-copy">
            <p>YOU’RE HERE TO HELP.</p>
            <h1>{question.question}</h1>
            <span>{question.helper}</span>
          </div>
          <div className="parent-answer-grid" role="radiogroup" aria-label={question.question}>
            {question.options.map((option) => (
              <button
                aria-checked={answers[question.id] === option}
                className={answers[question.id] === option ? 'active' : ''}
                key={option}
                onClick={() => answerQuestion(option)}
                role="radio"
                type="button"
              >
                <span>{option}</span><ChevronRight size={18}/>
              </button>
            ))}
          </div>
          {question.affirmation && answers[question.id] && <p className="parent-question-affirmation" role="status">{question.affirmation}</p>}
          {questionIndex > 0 && <button className="parent-question-back" onClick={() => setQuestionIndex((current) => current - 1)} type="button">← Back</button>}
        </section>
      )}

      {stage === 'reveal' && (
        <section className="parent-recommendation-reveal">
          <header className="parent-reveal-header">
            <p className="eyebrow">THE COMPLETE ATHLETE</p>
            <h1><span>Your parent focus</span><span>is ready.</span></h1>
            <p>Based on what you told us, we picked the areas that can help you support your athlete most right now.</p>
          </header>

          <section className="parent-primary-focus" aria-labelledby="parent-focus-title">
            <span>Your primary focus</span>
            <h2 id="parent-focus-title">{recommendations.focus.title}</h2>
            <p>{recommendations.focus.statement}</p>
          </section>

          {recommendations.supportingTags.length > 0 && (
            <section className="parent-supporting-focuses" aria-label="Also supporting">
              <span>Also supporting</span>
              <div>{recommendations.supportingTags.map((tag) => <strong key={tag}>{(parentFocusCopy[tag] || parentFocusCopy.support).label}</strong>)}</div>
            </section>
          )}

          <section className="parent-recommended-plans" aria-labelledby="parent-recommended-title">
            <div className="parent-reveal-section-heading">
              <span>Recommended for you</span>
              <h2 id="parent-recommended-title">Your starting plans</h2>
            </div>
            <div className="parent-recommendation-sequence">
              {recommendations.recommendations.map((plan, index) => (
                <article key={plan.id}>
                  <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <div><h3>{plan.title}</h3><p>{plan.description}</p></div>
                </article>
              ))}
            </div>
          </section>

          <section className="parent-recommendation-why">
            <button aria-expanded={showWhy} onClick={() => setShowWhy((current) => !current)} type="button"><span>Why these?</span><ChevronDown size={18}/></button>
            {showWhy && <p>{recommendations.why}</p>}
          </section>

          <button className="primary-action full parent-assessment-cta" disabled={submitting} onClick={continueToPaywall} type="button">
            {submitting ? 'Preparing Your Parent Space...' : 'Continue'} <ArrowRight size={18}/>
          </button>
        </section>
      )}
    </main>
  );
}

const journeyFocusRevealCopy = {
  confidence: 'Build belief from evidence instead of emotion.',
  discipline: 'Become more consistent when motivation disappears.',
  focus: 'Train your attention and stay present when it matters.',
  consistency: 'Turn good intentions into repeatable daily actions.',
  pressure: 'Perform with more control when the moment gets bigger.',
  'emotional-control': 'Respond instead of reacting when competition gets intense.',
  coachability: 'Turn feedback into faster growth.',
  'goal-setting': 'Connect what you want to the work required every day.',
  resilience: 'Recover faster and respond with confidence after adversity.',
  identity: 'Build a stronger connection between who you are and how you compete.',
  habits: 'Create routines that make disciplined action easier.'
};

const journeyFocusRevealLabels = {
  confidence: 'Confidence',
  discipline: 'Discipline',
  focus: 'Focus',
  consistency: 'Consistency',
  pressure: 'Handling Pressure',
  'emotional-control': 'Emotional Control',
  coachability: 'Coachability',
  'goal-setting': 'Goal-Setting',
  resilience: 'Resilience',
  identity: 'Identity',
  habits: 'Habits'
};

const journeyPlanRevealDescriptions = [
  [['control the controllables', 'controllable'], 'Focus your energy on what you can control.'],
  [['slump'], 'Learn how to respond when performance dips.'],
  [['positive self image', 'self-image', 'mirror'], 'Strengthen how you see yourself as an athlete.'],
  [['confidence code', 'confidence'], 'Build confidence from evidence, preparation, and action.'],
  [['boring wins'], 'Discover why consistency creates separation.'],
  [['champion habits', 'habits'], 'Build routines that make consistency easier.'],
  [['coachable athlete', 'coachable'], 'Use feedback and tough coaching to grow faster.'],
  [['imagination', 'visualization'], 'Train your mind to see performance before it happens.'],
  [['emotional control', 'next play'], 'Stay in control when emotions run high.'],
  [['goal blueprint', 'goals'], 'Turn what you want into a clear plan of action.'],
  [['lock in', 'focus'], 'Train your attention and stay present.'],
  [['discipline'], 'Learn to execute even when you don’t feel like it.'],
  [['90%', 'athletic operating system'], 'Build the mental habits that support complete performance.'],
  [['compete differently'], 'Compete from a stronger foundation of purpose and identity.']
];

function journeyRevealLabel(tag) {
  return journeyFocusRevealLabels[tag] || String(tag || 'Mental Performance').replace('-', ' ');
}

function journeyRevealPlanDescription(seriesTitle, availablePlans = []) {
  const normalized = String(seriesTitle || '').toLowerCase();
  const mapped = journeyPlanRevealDescriptions.find(([needles]) => needles.some((needle) => normalized.includes(needle)));
  if (mapped) return mapped[1];
  const matchingPlan = availablePlans.find((plan) => planSeriesTitle(plan).toLowerCase() === normalized);
  const existing = matchingPlan ? planSeriesTagline(matchingPlan) : '';
  return existing || 'Build a stronger mental game through focused daily work.';
}

function OnboardingScreen({
  athleteParentAccessDraft,
  athleteParentLinkFeedback,
  authSession,
  completeOnboarding,
  linkAthleteParentAccessCode,
  plans,
  setAthleteParentAccessDraft,
  setAthleteParentLinkFeedback,
  trackAnalyticsEvent
}) {
  const [setup, setSetup] = useState({
    sport: '',
    age: '',
    photo: '',
    location: '',
    parentContact: '',
    currentChallenge: '',
    currentChallenges: [],
    goals: [],
    standards: []
  });
  const [stage, setStage] = useState('intro');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [journeyAnswers, setJourneyAnswers] = useState({});
  const [message, setMessage] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showJourneyWhy, setShowJourneyWhy] = useState(false);
  const [commitmentConfirmed, setCommitmentConfirmed] = useState(false);
  const [commitmentContinueReady, setCommitmentContinueReady] = useState(false);
  const [familyAccessExpanded, setFamilyAccessExpanded] = useState(false);
  const [familyAccessConnected, setFamilyAccessConnected] = useState(false);
  const [familyAccessConnecting, setFamilyAccessConnecting] = useState(false);
  const commitmentTimerRef = useRef(null);
  const commitmentContinueRef = useRef(null);

  useEffect(() => () => window.clearTimeout(commitmentTimerRef.current), []);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [stage]);
  useEffect(() => {
    if (!commitmentContinueReady || !commitmentContinueRef.current) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    commitmentContinueRef.current.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'end' });
  }, [commitmentContinueReady]);

  function updateField(field, value) {
    setSetup((current) => ({ ...current, [field]: value }));
    setMessage('');
  }

  async function choosePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('Choose a photo from your image library.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage('Choose a photo smaller than 10 MB.');
      return;
    }

    try {
      setMessage('Preparing your photo...');
      const prepared = await prepareProfilePhoto(file);
      setPhotoFile(prepared.file);
      setSetup((current) => ({ ...current, photo: prepared.preview }));
      setMessage('');
    } catch {
      setMessage('That photo could not be opened. Choose a different image.');
    }
  }

  function removePhoto() {
    setPhotoFile(null);
    setSetup((current) => ({ ...current, photo: '' }));
    setMessage('');
  }

  async function saveOnboardingPhoto() {
    if (!photoFile || !isSupabaseConfigured || !authSession?.id) return setup.photo;

    const extensionByType = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    };
    const extension = extensionByType[photoFile.type] || 'jpg';
    const path = `${authSession.id}/profile.${extension}`;
    const { error } = await supabase.storage
      .from('athlete-profile-photos')
      .upload(path, photoFile, { cacheControl: '3600', upsert: true });

    if (error) return setup.photo;
    const { data } = supabase.storage.from('athlete-profile-photos').getPublicUrl(path);
    return data.publicUrl || setup.photo;
  }

  function challengeIdForAnswer(answer) {
    const normalized = String(answer || '').toLowerCase();
    if (normalized.includes('confidence')) return 'confidence';
    if (normalized.includes('discipline') || normalized.includes('consistency') || normalized.includes('focus')) return 'discipline';
    if (normalized.includes('pressure') || normalized.includes('emotional')) return 'pressure';
    if (normalized.includes('coach')) return 'coach';
    return 'something-else';
  }

  const developmentProfile = useMemo(() => deriveDevelopmentProfile(journeyAnswers), [journeyAnswers]);
  const generatedJourney = useMemo(
    () => generateJourney({ answers: journeyAnswers, plans }),
    [journeyAnswers, plans]
  );

  function beginQuestions(event) {
    event.preventDefault();
    if (!setup.sport.trim()) {
      setMessage('Add your sport to continue.');
      return;
    }
    setMessage('');
    setStage('questions');
    setQuestionIndex(0);
    trackAnalyticsEvent?.('onboarding_started', { role: 'athlete' }, { area: 'activation' });
  }

  function answerQuestion(answer) {
    const question = journeyQuestions[questionIndex];
    const nextAnswers = { ...journeyAnswers, [question.id]: answer };
    setJourneyAnswers(nextAnswers);
    if (questionIndex < journeyQuestions.length - 1) {
      window.setTimeout(() => setQuestionIndex((current) => current + 1), 120);
    } else {
      window.setTimeout(() => setStage('reveal'), 120);
    }
  }

  async function startOnboarding() {
    const cleanSetup = {
      ...setup,
      sport: setup.sport.trim(),
      goals: setup.goals.map((goal) => goal.trim()).filter(Boolean),
      standards: setup.standards.map((standard) => standard.trim()).filter(Boolean)
    };

    const challengeId = challengeIdForAnswer(journeyAnswers.primaryGoal);
    cleanSetup.currentChallenge = challengeId;
    cleanSetup.currentChallenges = [challengeId];
    cleanSetup.journeyAnswers = journeyAnswers;
    cleanSetup.developmentProfile = developmentProfile;
    cleanSetup.generatedJourney = generatedJourney;

    setSubmitting(true);
    setMessage(photoFile ? 'Adding your profile photo...' : '');
    try {
      const photo = await saveOnboardingPhoto();
      await completeOnboarding({ ...cleanSetup, photo });
    } catch {
      await completeOnboarding(cleanSetup);
    } finally {
      setSubmitting(false);
    }
  }

  function openCommitment() {
    window.clearTimeout(commitmentTimerRef.current);
    setCommitmentConfirmed(false);
    setCommitmentContinueReady(false);
    setStage('commitment');
  }

  function confirmCommitment() {
    if (commitmentConfirmed) return;
    localStorage.setItem('commitment_completed', 'true');
    localStorage.setItem('commitment_completed_at', new Date().toISOString());
    setCommitmentConfirmed(true);
    commitmentTimerRef.current = window.setTimeout(() => setCommitmentContinueReady(true), 900);
  }

  async function connectFamilyAccess(event) {
    event?.preventDefault();
    if (familyAccessConnecting) return;
    setFamilyAccessConnecting(true);
    const connected = await linkAthleteParentAccessCode?.(event);
    setFamilyAccessConnecting(false);
    if (!connected) return;
    setFamilyAccessConnected(true);
    setFamilyAccessExpanded(false);
  }

  function openFamilyAccess() {
    setAthleteParentLinkFeedback?.('');
    setFamilyAccessExpanded(true);
  }

  function closeFamilyAccess() {
    setAthleteParentLinkFeedback?.('');
    setFamilyAccessExpanded(false);
  }

  return (
    <main className={`onboarding-shell simple-athlete-onboarding${stage === 'intro' ? ' journey-intro-screen' : ''}${stage === 'profile' ? ' journey-profile-screen' : ''}${stage === 'questions' ? ' journey-question-screen' : ''}${stage === 'reveal' ? ' journey-reveal-screen' : ''}${stage === 'commitment' ? ' athlete-commitment-screen' : ''}`} aria-label="The Complete Athlete onboarding">
      {stage !== 'commitment' && stage !== 'profile' && <section className="onboarding-hero">
        <p className="eyebrow">THE COMPLETE ATHLETE</p>
        {stage === 'intro' ? (
          <>
            <h1 className="journey-intro-heading"><span>Let’s build</span><span>your journey</span></h1>
            <strong className="journey-intro-promise">21 days. Built around you.</strong>
            <p>Answer 8 quick questions and we’ll build a personalized mental-performance journey around your goals, strengths, and what you want to improve most.</p>
          </>
        ) : (
          <>
            {stage === 'reveal' ? (
              <h1 className="journey-reveal-heading"><span>Your journey</span><span>is ready.</span></h1>
            ) : <h1>Build from where you are.</h1>}
            <p>{stage === 'reveal'
              ? 'Built from what you told us about your goals, strengths, and where you want to grow.'
              : 'Choose the one that most strongly aligns with you right now.'}</p>
            {stage === 'reveal' && <span className="journey-personalized-label"><Sparkles size={14}/> Personalized for you</span>}
          </>
        )}
      </section>}

      {stage === 'intro' && (
        <section className="journey-onboarding-intro">
          <div className="journey-days-visual" role="img" aria-label="A personalized 21-day journey built for you">
            <div className="journey-days-ring" aria-hidden="true">
              <span>21</span>
              <strong>DAYS</strong>
            </div>
            <small>BUILT FOR YOU</small>
          </div>
          <p className="journey-intro-duration">8 QUESTIONS <i>•</i> ABOUT 60 SECONDS</p>
          <button className="primary-action full onboarding-start" type="button" aria-label="Build my personalized 21-day journey" onClick={() => setStage('profile')}>Build My Journey <ArrowRight size={18}/></button>
        </section>
      )}

      {stage === 'profile' && <form className="onboarding-form journey-profile-form" onSubmit={beginQuestions}>
        <header className="journey-profile-header">
          <p className="eyebrow">THE COMPLETE ATHLETE</p>
          <h1><span>Let’s start</span><span>with you.</span></h1>
          <p>Give us a few basics so we can make your experience feel more personal.</p>
          <div className="journey-profile-progress" aria-label="Onboarding step 1 of 9">
            <span>01 / 09</span>
            <div><i /></div>
          </div>
        </header>

        <section className="journey-profile-details" aria-labelledby="journey-profile-title">
          <h2 id="journey-profile-title">YOUR PROFILE</h2>
          <div className="onboarding-photo-field journey-profile-photo">
            <div className={setup.photo ? 'onboarding-photo-preview has-photo' : 'onboarding-photo-preview'}>
              {setup.photo ? <img src={setup.photo} alt="Selected athlete profile" /> : <Camera size={26} />}
            </div>
            <div className="onboarding-photo-copy">
              <strong>PROFILE PHOTO</strong>
              <span>Optional · You can always add one later.</span>
              <div className="onboarding-photo-actions">
                <label className="photo-upload">
                  <Camera size={17} />
                  {setup.photo ? 'Change Photo' : 'Add Photo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={choosePhoto} />
                </label>
                {setup.photo && (
                  <button className="onboarding-photo-remove" type="button" onClick={removePhoto}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="form-grid journey-profile-field-row">
            <label className="journey-field journey-sport-field">
              <span>SPORT</span>
              <input
                className="text-field"
                placeholder="Basketball"
                autoComplete="off"
                value={setup.sport}
                onChange={(event) => updateField('sport', event.target.value)}
              />
            </label>
            <label className="journey-field journey-age-field">
              <span>AGE <em>· OPTIONAL</em></span>
              <input
                className="text-field"
                inputMode="numeric"
                maxLength="2"
                placeholder="14"
                value={setup.age}
                onChange={(event) => updateField('age', event.target.value.replace(/\D/g, '').slice(0, 2))}
              />
            </label>
          </div>
          <label className="journey-field">
            <span>LOCATION <em>· OPTIONAL</em></span>
            <input
              className="text-field"
              autoComplete="address-level1"
              placeholder="State or country"
              value={setup.location}
              onChange={(event) => updateField('location', event.target.value)}
            />
          </label>
        </section>

        <section className={familyAccessExpanded ? 'journey-family-access is-expanded' : 'journey-family-access'} aria-labelledby="family-access-title">
          <div className="journey-family-summary">
            <div>
              <span id="family-access-title">FAMILY ACCESS</span>
              <strong>{familyAccessConnected ? 'Parent Connected' : 'Have a parent code?'}</strong>
              <p>{familyAccessConnected ? 'You’re connected.' : 'Optional — connect a parent now or later in Settings.'}</p>
            </div>
            {familyAccessConnected ? (
              <span className="family-connected-mark" aria-label="Parent connected"><Check size={17}/></span>
            ) : !familyAccessExpanded && (
              <button type="button" onClick={openFamilyAccess}>Add Parent Code</button>
            )}
          </div>

          {familyAccessExpanded && !familyAccessConnected && (
            <div className="journey-family-expanded">
              <label className="journey-field" htmlFor="onboarding-parent-code">
                <span>PARENT CODE</span>
                <input
                  id="onboarding-parent-code"
                  className="text-field"
                  autoCapitalize="characters"
                  autoComplete="off"
                  aria-label="Parent code"
                  placeholder="Enter parent code"
                  value={athleteParentAccessDraft}
                  onChange={(event) => {
                    setAthleteParentAccessDraft?.(event.target.value);
                    setAthleteParentLinkFeedback?.('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') connectFamilyAccess(event);
                  }}
                />
              </label>
              <div className="journey-family-actions">
                <button className="journey-family-cancel" type="button" onClick={closeFamilyAccess}>Cancel</button>
                <button className="journey-family-connect" type="button" onClick={connectFamilyAccess} disabled={!athleteParentAccessDraft?.trim() || familyAccessConnecting}>
                  {familyAccessConnecting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
              {athleteParentLinkFeedback && <p className="journey-family-feedback" role="status">{athleteParentLinkFeedback}</p>}
            </div>
          )}
        </section>

        {message && <p className="inline-warning">{message}</p>}
        <button className="primary-action full onboarding-start journey-profile-continue" type="submit" disabled={submitting || !setup.sport.trim()}>
          Continue <ArrowRight size={18}/>
        </button>
      </form>}

      {stage === 'questions' && (() => {
        const question = journeyQuestions[questionIndex];
        return (
          <section className="journey-question-stage">
            <div className="journey-question-progress">
              <span>{questionIndex + 1} of {journeyQuestions.length}</span>
              <div><i style={{ width: `${((questionIndex + 1) / journeyQuestions.length) * 100}%` }}/></div>
            </div>
            <div className="journey-question-copy">
              <h2>{question.question}</h2>
              <p>{question.helper}</p>
            </div>
            <div className="journey-answer-grid">
              {question.options.map((option) => (
                <button
                  className={journeyAnswers[question.id] === option ? 'active' : ''}
                  key={option}
                  onClick={() => answerQuestion(option)}
                  type="button"
                >
                  <span>{option}</span><ChevronRight size={18}/>
                </button>
              ))}
            </div>
            {question.affirmation && journeyAnswers[question.id] && <p className="journey-affirmation">{question.affirmation}</p>}
            {questionIndex > 0 && <button className="journey-back-link" type="button" onClick={() => setQuestionIndex((current) => current - 1)}>← Back</button>}
          </section>
        );
      })()}

      {stage === 'reveal' && (
        <section className="journey-reveal-program">
          <section className="journey-primary-focus" aria-labelledby="journey-primary-focus-title">
            <span>Your primary focus</span>
            <h2 id="journey-primary-focus-title">{developmentProfile.primaryFocusLabel}</h2>
            <p>{journeyFocusRevealCopy[developmentProfile.primaryFocus] || 'Build the mental skills that help your performance hold up when it matters.'}</p>
          </section>

          {developmentProfile.tags.slice(1, 3).length > 0 && (
            <section className="journey-supporting-focuses" aria-label="Supporting development areas">
              <span>Also building</span>
              <div>{developmentProfile.tags.slice(1, 3).map((tag) => <strong key={tag}>{journeyRevealLabel(tag)}</strong>)}</div>
            </section>
          )}

          <section className="journey-path-section" aria-labelledby="journey-path-title">
            <div className="journey-section-heading">
              <span>Personalized program</span>
              <h3 id="journey-path-title">Your 21-Day Path</h3>
            </div>
            <div className="journey-plan-path">
              {generatedJourney.selectedSeries.map((series, index) => (
                <article className="journey-plan-step" key={series.title}>
                  <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h4>{series.title}</h4>
                    <p>{journeyRevealPlanDescription(series.title, plans)}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="journey-integration-days">
            <span><Plus size={15}/> Integration Days</span>
            <p>Reflection, application, visualization, and progress checkpoints connect everything across your 21 days.</p>
            <div aria-label="Learn, apply, reflect, and execute"><strong>Learn</strong><i>+</i><strong>Apply</strong><i>+</i><strong>Reflect</strong><i>+</i><strong>Execute</strong></div>
          </section>

          <section className="journey-why-section">
            <button aria-expanded={showJourneyWhy} onClick={() => setShowJourneyWhy((current) => !current)} type="button">
              <span>Why this journey?</span><ChevronDown size={18}/>
            </button>
            {showJourneyWhy && (
              <p>You told us {developmentProfile.primaryFocusLabel.toLowerCase()} is your biggest focus{developmentProfile.tags.slice(1, 3).length ? ` and that ${developmentProfile.tags.slice(1, 3).map(journeyRevealLabel).join(' and ').toLowerCase()} also matter` : ''}. This path was built to help you grow with focused work, application, and reflection.</p>
            )}
          </section>

          <section className="journey-length-summary" aria-label="21-day program summary">
            <strong>21 <span>Days</span></strong>
            <div><p>One personalized development path.</p><small>Your first step starts today.</small></div>
          </section>

          {message && <p className="inline-warning">{message}</p>}
          <button className="primary-action full onboarding-start journey-start-button" aria-label="Start my personalized 21-day journey" type="button" onClick={openCommitment}>
            Start My Journey <ArrowRight size={18}/>
          </button>
        </section>
      )}

      {stage === 'commitment' && (
        <section className={commitmentConfirmed ? 'athlete-commitment is-confirmed' : 'athlete-commitment'}>
          <header className="commitment-intro">
            <p className="commitment-brand">THE COMPLETE ATHLETE</p>
            <h1><span>You know what you want.</span><span>Now commit to the work.</span></h1>
            <p>You just told us where you want to go.</p>
            <p>The next 21 days are about proving it to yourself — one decision, one action, one day at a time.</p>
            <strong>This isn’t a promise to us.<br/>It’s a promise to you.</strong>
          </header>

          <section className="commitment-pledge" aria-labelledby="commitment-pledge-title">
            <h2 id="commitment-pledge-title">MY COMMITMENT</h2>
            <p>For the next 21 days, I’m choosing to show up.</p>
            <p>I’ll do the work when it’s easy — and when it isn’t.</p>
            <p>I’ll learn from mistakes instead of letting them define me.</p>
            <p>I’ll keep the promises I make to myself.</p>
            <p>I’ll train the part of my game no one sees.</p>
            <p>I’m ready to become the athlete my goals require.</p>
          </section>

          <div className="commitment-action-zone" aria-live="polite">
            <button
              className="commitment-fingerprint-button"
              type="button"
              aria-label={commitmentConfirmed ? 'Commitment made' : 'Make my 21-day commitment'}
              aria-pressed={commitmentConfirmed}
              onClick={confirmCommitment}
              disabled={commitmentConfirmed}
            >
              <span className="commitment-pulse" aria-hidden="true" />
              <svg className="commitment-fingerprint" viewBox="0 0 180 180" aria-hidden="true">
                <path d="M90 22c-37 0-67 30-67 67 0 13 2 25 6 37" />
                <path d="M90 36c-29 0-53 24-53 53 0 19 5 39 14 56" />
                <path d="M90 50c-22 0-39 17-39 39 0 24 8 47 22 66" />
                <path d="M90 64c-14 0-25 11-25 25 0 28 10 53 27 72" />
                <path d="M90 78c-6 0-11 5-11 11 0 26 10 49 28 65" />
                <path d="M90 22c37 0 67 30 67 67 0 29-8 57-23 80" />
                <path d="M90 36c29 0 53 24 53 53 0 27-7 51-20 72" />
                <path d="M90 50c22 0 39 17 39 39 0 23-6 45-18 63" />
                <path d="M90 64c14 0 25 11 25 25 0 17-4 34-12 48" />
                <path d="M90 78c6 0 11 5 11 11 0 11-2 22-7 32" />
                <path d="M32 74c4-18 15-34 30-44" />
                <path d="M148 74c-4-18-15-34-30-44" />
              </svg>
              {commitmentConfirmed && <span className="commitment-check" aria-hidden="true"><Check size={30} strokeWidth={3}/></span>}
            </button>

            <div className="commitment-state-copy">
              <strong>{commitmentConfirmed ? 'COMMITMENT MADE' : 'PRESS TO COMMIT'}</strong>
              {!commitmentConfirmed ? (
                <span>Make the promise to yourself.</span>
              ) : (
                <div className="commitment-confirmation-copy">
                  <h2>YOU’RE IN.</h2>
                  <p>Your next 21 days start with the decision you just made.</p>
                </div>
              )}
            </div>

            {commitmentContinueReady && (
              <div className="commitment-continue-wrap" ref={commitmentContinueRef}>
                <span>YOUR JOURNEY IS READY.</span>
                <button className="primary-action full commitment-continue" type="button" onClick={startOnboarding} disabled={submitting}>
                  {submitting ? 'Preparing Your Journey...' : 'Continue'} <ArrowRight size={18}/>
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

const defaultDailyActivityQuickAdds = [
  { id: 'training', label: 'Training', value: 'Complete training with intent', iconKey: 'training' },
  { id: 'recovery', label: 'Recovery', value: 'Handle recovery routine', iconKey: 'recovery' },
  { id: 'schoolwork', label: 'Schoolwork', value: 'Finish schoolwork', iconKey: 'schoolwork' },
  { id: 'extra-reps', label: 'Extra reps', value: 'Get extra quality reps', iconKey: 'extra-reps' }
];

const dailyQuickAddIcons = {
  training: Dumbbell,
  recovery: Leaf,
  schoolwork: GraduationCap,
  'extra-reps': Plus,
  custom: Plus
};

function dailyQuickAddStorageKey(userId) {
  return `tca-daily-quick-adds:${String(userId || 'local-athlete')}`;
}

function loadDailyActivityQuickAdds(userId) {
  try {
    const stored = JSON.parse(localStorage.getItem(dailyQuickAddStorageKey(userId)) || 'null');
    if (!Array.isArray(stored) || !stored.length) return defaultDailyActivityQuickAdds;
    const cleaned = stored.slice(0, 8).map((item, index) => ({
      id: String(item?.id || `custom-${index}`),
      label: String(item?.label || '').trim(),
      value: String(item?.value || '').trim(),
      iconKey: dailyQuickAddIcons[item?.iconKey] ? item.iconKey : 'custom'
    })).filter((item) => item.label && item.value);
    return cleaned.length ? cleaned : defaultDailyActivityQuickAdds;
  } catch {
    return defaultDailyActivityQuickAdds;
  }
}

function saveDailyActivityQuickAdds(userId, items) {
  localStorage.setItem(dailyQuickAddStorageKey(userId), JSON.stringify(items));
}

function ProgressStat({ icon, label, value, warm = false }) {
  return (
    <span className={`activity-stat${warm ? ' warm' : ''}`}>
      <i>{icon}</i>
      <b>{value}</b>
      <em>{label}</em>
    </span>
  );
}

function ActivityTrackerHero({ completed, percent, streak, total }) {
  return (
    <div className="activity-tracker-hero">
      <div className="activity-tracker-heading">
        <span className="activity-tracker-mark"><BarChart3 size={20} /></span>
        <div>
          <h2 id="activity-tracker-title">Daily Activity Tracker</h2>
          <p>Add what you need to handle today. Update it as you go, then lock in the day once everything is complete.</p>
        </div>
      </div>
      <div className="activity-stat-grid" aria-label="Daily activity tracker summary">
        <ProgressStat icon={<Check size={18} />} label="Done" value={completed} />
        <ProgressStat icon={<Clock size={18} />} label="Left" value={Math.max(total - completed, 0)} />
        <ProgressStat icon={<Flame size={18} />} label="Streak" value={streak} warm />
      </div>
      <div className="activity-progress-row" aria-label={`${percent}% of daily activities complete`}>
        <span className="activity-progress-track" aria-hidden="true">
          <i style={{ width: `${percent}%` }} />
        </span>
        <strong>{percent}%</strong>
      </div>
    </div>
  );
}

function QuickAddSection({ draft, onSelect, userId }) {
  const [quickAdds, setQuickAdds] = useState(() => loadDailyActivityQuickAdds(userId));
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDraft, setEditorDraft] = useState([]);

  useEffect(() => {
    setQuickAdds(loadDailyActivityQuickAdds(userId));
  }, [userId]);

  function openEditor() {
    setEditorDraft(quickAdds.map((item) => ({ ...item })));
    setEditorOpen(true);
  }

  function updateEditorItem(id, field, value) {
    setEditorDraft((items) => items.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function addEditorItem() {
    setEditorDraft((items) => items.length >= 8 ? items : [
      ...items,
      { id: `custom-${Date.now()}`, label: 'New option', value: '', iconKey: 'custom' }
    ]);
  }

  function saveEditor() {
    const cleaned = editorDraft
      .map((item) => ({ ...item, label: item.label.trim(), value: item.value.trim() }))
      .filter((item) => item.label && item.value)
      .slice(0, 8);
    const next = cleaned.length ? cleaned : defaultDailyActivityQuickAdds;
    setQuickAdds(next);
    saveDailyActivityQuickAdds(userId, next);
    setEditorOpen(false);
  }

  return (
    <>
      <div className="activity-quick-add">
        <div className="activity-section-heading">
          <div><strong>Add to today</strong><span>Choose a shortcut or write your own</span></div>
          <button className="quick-add-edit-button" onClick={openEditor} type="button">Edit</button>
        </div>
        <div className="activity-quick-grid" aria-label="Quick add daily activities">
          {quickAdds.map((item) => {
            const Icon = dailyQuickAddIcons[item.iconKey] || Plus;
            return (
              <button
                className={draft === item.value ? 'active' : ''}
                key={item.id}
                onClick={() => onSelect(item.value)}
                type="button"
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {editorOpen && (
        <div className="quick-add-editor-overlay" onClick={() => setEditorOpen(false)} role="presentation">
          <section
            aria-labelledby="quick-add-editor-title"
            aria-modal="true"
            className="quick-add-editor-sheet"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header>
              <div>
                <span>Daily Activity Tracker</span>
                <h2 id="quick-add-editor-title">Edit Quick Add</h2>
                <p>Choose the shortcuts that make building your day faster.</p>
              </div>
              <button aria-label="Close Quick Add editor" className="icon-button" onClick={() => setEditorOpen(false)} type="button"><X size={18}/></button>
            </header>

            <div className="quick-add-editor-list">
              {editorDraft.map((item) => {
                const Icon = dailyQuickAddIcons[item.iconKey] || Plus;
                return (
                  <div className="quick-add-editor-row" key={item.id}>
                    <i><Icon size={17}/></i>
                    <label>
                      <span>Button name</span>
                      <input
                        aria-label={`${item.label || 'Quick Add'} button name`}
                        maxLength={22}
                        onChange={(event) => updateEditorItem(item.id, 'label', event.target.value)}
                        value={item.label}
                      />
                    </label>
                    <label>
                      <span>Activity added</span>
                      <input
                        aria-label={`${item.label || 'Quick Add'} activity text`}
                        maxLength={100}
                        onChange={(event) => updateEditorItem(item.id, 'value', event.target.value)}
                        placeholder="What should be added?"
                        value={item.value}
                      />
                    </label>
                    <button
                      aria-label={`Remove ${item.label || 'Quick Add option'}`}
                      className="quick-add-remove-button"
                      disabled={editorDraft.length <= 1}
                      onClick={() => setEditorDraft((items) => items.filter((entry) => entry.id !== item.id))}
                      type="button"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                );
              })}
            </div>

            <button className="quick-add-new-button" disabled={editorDraft.length >= 8} onClick={addEditorItem} type="button"><Plus size={16}/> Add another option</button>
            <div className="quick-add-editor-actions">
              <button className="secondary-action" onClick={() => setEditorOpen(false)} type="button">Cancel</button>
              <button className="primary-action" onClick={saveEditor} type="button">Save Quick Add</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function ActivityComposer({ draft, goalId, goals, onDraftChange, onGoalChange, onSubmit }) {
  const selectedGoal = goals.find((goal) => String(goal.id) === String(goalId));
  return (
    <form className="activity-composer" onSubmit={onSubmit}>
      <label className="activity-composer-input">
        <Plus size={20} />
        <input
          aria-label="Add a daily activity item"
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Add something you need to do today…"
          value={draft}
        />
      </label>
      <div className="activity-composer-actions">
        <label className="activity-goal-picker">
          <span>Goal link</span>
          <strong>{selectedGoal?.label || 'No goal selected'}</strong>
          <select
            aria-label="Connect daily activity item to a goal"
            onChange={(event) => onGoalChange(event.target.value)}
            value={goalId}
          >
            <option value="">No goal selected</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>{goal.label}</option>
            ))}
          </select>
          <ChevronDown size={16} />
        </label>
        <button className="activity-add-button" disabled={!draft.trim()} type="submit">
          Add Task
          <ArrowRight size={17} />
        </button>
      </div>
    </form>
  );
}

function ActivityCard({
  editing,
  editingDraft,
  goals,
  item,
  onCancel,
  onDelete,
  onEdit,
  onEditingDraftChange,
  onGoalChange,
  onSave,
  onToggle
}) {
  const linkedGoal = goals.find((goal) => String(goal.id) === String(item.goalId));
  return (
    <article className={`activity-card${item.done ? ' completed' : ''}${editing ? ' editing' : ''}`}>
      <button
        aria-label={item.done ? `Mark ${item.label} incomplete` : `Mark ${item.label} complete`}
        aria-pressed={item.done}
        className="activity-checkbox"
        onClick={() => onToggle(item.id)}
        type="button"
      >
        {item.done && <Check size={17} />}
      </button>

      <div className="activity-card-copy">
        {editing ? (
          <>
            <input
              aria-label={`Edit ${item.label}`}
              autoFocus
              className="activity-edit-input"
              onChange={(event) => onEditingDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSave(item.id);
                if (event.key === 'Escape') onCancel();
              }}
              value={editingDraft}
            />
            <label className="activity-edit-goal">
              <Target size={14} />
              <select
                aria-label={`Link ${item.label} to goal`}
                onChange={(event) => onGoalChange(item.id, event.target.value)}
                value={item.goalId ?? ''}
              >
                <option value="">No goal linked</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>{goal.label}</option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <strong>{item.label}</strong>
            <span><Target size={13} /> {linkedGoal?.label || 'No goal linked'}</span>
          </>
        )}
      </div>

      <div className="activity-card-actions">
        {editing ? (
          <>
            <button className="save" onClick={() => onSave(item.id)} type="button" aria-label={`Save ${item.label}`}><Check size={16} /></button>
            <button onClick={onCancel} type="button" aria-label={`Cancel editing ${item.label}`}><X size={16} /></button>
          </>
        ) : (
          <>
            <button onClick={() => onEdit(item)} type="button" aria-label={`Edit ${item.label}`}><PenLine size={15} /></button>
            <button className="delete" onClick={() => onDelete(item.id)} type="button" aria-label={`Remove ${item.label}`}><Trash2 size={15} /></button>
          </>
        )}
      </div>
    </article>
  );
}

function AthleteJourneyCard({ journey, onContinue }) {
  if (!journey) return null;
  const progress = journeyProgress(journey);
  if (progress.complete) {
    return (
      <section className="journey-next-focus-card">
        <span>Your next focus</span>
        <strong>{journey.developmentProfile?.primaryFocusLabel || 'Mental Performance'}</strong>
        <p>Keep building on the work from your first 21 days.</p>
        <button type="button" onClick={() => onContinue(null)}>Choose My Next Plan <ArrowRight size={17}/></button>
      </section>
    );
  }
  const day = progress.nextDay;
  return (
    <section className="athlete-journey-card" aria-labelledby="journey-card-title">
      <div className="journey-card-topline"><span>Your 21-Day Journey</span><strong>Day {day?.day || 1} of 21</strong></div>
      <div className="journey-card-heading">
        <span>Current focus</span>
        <h2 id="journey-card-title">{day?.focus || journey.developmentProfile?.primaryFocusLabel || 'Mental Performance'}</h2>
      </div>
      <div className="journey-progress-row">
        <div aria-label={`${progress.percent}% of journey complete`}><i style={{ width: `${progress.percent}%` }}/></div>
        <span>{progress.percent}%</span>
      </div>
      <div className="journey-today-work">
        <span>{day?.type === 'plan' ? 'Today’s read' : 'Today’s action'}</span>
        <strong>{day?.title}</strong>
        {day?.type === 'plan' && <em>{day.seriesTitle} · Day {day.planDay}</em>}
        <p>{day?.action}</p>
      </div>
      <button className="journey-continue-button" type="button" onClick={() => onContinue(day)}>
        {journey.startedAt ? 'Continue Journey' : 'Start My Journey'} <ArrowRight size={18}/>
      </button>
    </section>
  );
}

function HomeScreen({
  athleteScore,
  athleteProfile,
  athleteJourney,
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
  openJournal,
  setRequestedPlanSeriesId,
  setRequestedPlanId,
  setAthleteJourney,
  notifyUser,
  lastSubmittedDate,
  lesson,
  planProgress,
  plans,
  recentPointEvents,
  standardsHistory,
  streakCount,
  submittedToday,
  todayPoints,
  trackAnalyticsEvent,
  userId,
  requestMilestoneReview
}) {
  const [standardsFeedback, setStandardsFeedback] = useState('');
  const [standardsHistoryOpen, setStandardsHistoryOpen] = useState(false);
  const [scoreInfoOpen, setScoreInfoOpen] = useState(false);
  const [editingStandardId, setEditingStandardId] = useState(null);
  const [editingStandardDraft, setEditingStandardDraft] = useState('');
  const [dayCompletion, setDayCompletion] = useState(null);
  const [integrationDayOpen, setIntegrationDayOpen] = useState(null);
  const [integrationReflection, setIntegrationReflection] = useState('');
  const completedStandards = standards.filter((standard) => standard.done);
  const allStandardsCompleted = standards.length > 0 && completedStandards.length === standards.length;
  const activityCompletionPercent = standards.length
    ? Math.round((completedStandards.length / standards.length) * 100)
    : 0;
  const recentStandardsHistory = [...standardsHistory].reverse().slice(0, 7);
  const averageGoalProgress = goals.length
    ? Math.round(goals.reduce((total, goal) => total + Number(goal.progress), 0) / goals.length)
    : 0;
  const planSeriesStats = planSeriesCompletion(plans, planProgress);
  const todaysFocus = lessonFocusQuestion(lesson);

  function openJourneyDay(day) {
    if (!day) {
      setTab('plans');
      return;
    }
    if (!athleteJourney?.startedAt) {
      setAthleteJourney((current) => current ? { ...current, startedAt: new Date().toISOString() } : current);
      trackAnalyticsEvent?.('journey_started', { journeyId: athleteJourney?.id }, { area: 'journey' });
    }
    trackAnalyticsEvent?.('journey_day_started', { journeyId: athleteJourney?.id, day: day.day, dayType: day.type }, { area: 'journey' });
    if (day.type === 'plan') {
      const seriesId = String(day.seriesTitle || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      setRequestedPlanSeriesId(seriesId);
      setRequestedPlanId(String(day.planId));
      setTab('plans');
      return;
    }
    setIntegrationReflection('');
    setIntegrationDayOpen(day);
  }

  function completeIntegrationDay() {
    if (!integrationDayOpen || !athleteJourney) return;
    const completedAt = new Date().toISOString();
    const nextDays = athleteJourney.days.map((day) => day.day === integrationDayOpen.day
      ? { ...day, completedAt, reflection: integrationReflection.trim() }
      : day);
    const journeyComplete = nextDays.every((day) => Boolean(day.completedAt));
    setAthleteJourney({
      ...athleteJourney,
      startedAt: athleteJourney.startedAt || completedAt,
      days: nextDays,
      completedAt: journeyComplete ? completedAt : athleteJourney.completedAt
    });
    awardPoints?.({
      type: 'integration_day_completed',
      points: pointValues.integrationDayCompleted,
      label: `Journey Day ${integrationDayOpen.day} completed`,
      uniqueKey: `journey-integration-${athleteJourney.id}-${integrationDayOpen.day}`,
      metadata: { journeyId: athleteJourney.id, day: integrationDayOpen.day, integrationKind: integrationDayOpen.integrationKind }
    });
    trackAnalyticsEvent?.('integration_day_completed', { journeyId: athleteJourney.id, day: integrationDayOpen.day, integrationKind: integrationDayOpen.integrationKind }, { area: 'journey' });
    trackAnalyticsEvent?.('journey_day_completed', { journeyId: athleteJourney.id, day: integrationDayOpen.day, dayType: 'integration' }, { area: 'journey' });
    if (journeyComplete) {
      awardPoints?.({
        type: 'journey_completed',
        points: pointValues.journeyCompleted,
        label: 'First 21-Day Journey completed',
        uniqueKey: `journey-completed-${athleteJourney.id}`,
        metadata: { journeyId: athleteJourney.id }
      });
      trackAnalyticsEvent?.('journey_completed', { journeyId: athleteJourney.id }, { area: 'journey' });
    }
    setIntegrationDayOpen(null);
    setIntegrationReflection('');
    celebrate(journeyComplete ? 'Your first 21 is complete. The climb isn’t.' : `Journey Day ${integrationDayOpen.day} complete. +${pointValues.integrationDayCompleted} PP.`);
  }

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
    trackAnalyticsEvent?.('daily_productivity_item_added', {
      linkedToGoal: Boolean(standardGoalId)
    }, { area: 'daily' });
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
    const isFirstLockedDay = new Set(standardsHistory.map((entry) => entry.date)).size === 0;
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
          goalId: standard.goalId ?? null,
          goalLabel: goals.find((goal) => goal.id === standard.goalId)?.label ?? '',
          goalValue: goals.find((goal) => goal.id === standard.goalId)?.value ?? ''
        }))
      })
    );
    setGoals((current) =>
      current.map((goal) =>
        completedGoalIds.includes(goal.id)
          ? { ...goal, progress: Math.min(100, Number(goal.progress) + 1) }
          : goal
      )
    );
    const streakBonus = Math.min(nextStreak * pointValues.streakBonusPerDay, pointValues.streakBonusCap);
    const standardsPoints = allStandardsCompleted ? pointValues.standardsCompleted + streakBonus : 0;
    const awarded = standardsPoints > 0 && awardPoints({
      type: 'standards_completed',
      points: standardsPoints,
      label: streakBonus > 0 ? `Daily activity tracker complete with ${nextStreak}-day streak bonus` : 'Daily activity tracker complete',
      uniqueKey: `standards-completed-${submissionDate}`,
      metadata: { completed: completedStandards.length, total: standards.length, streak: nextStreak, streakBonus }
    });
    setDayCompletion({
      points: awarded ? standardsPoints : 0,
      scoreBefore: athleteScore,
      scoreAfter: athleteScore + (awarded ? standardsPoints : 0),
      streakBefore: streakCount,
      streakAfter: nextStreak,
      completed: completedStandards.length,
      total: standards.length,
      goalDeposits: completedGoalIds.map((goalId) => goals.find((goal) => String(goal.id) === String(goalId))?.value).filter(Boolean),
      requestReview: isFirstLockedDay
    });
    setStandardsFeedback('');
    trackAnalyticsEvent?.('daily_productivity_submitted', {
      completed: completedStandards.length,
      total: standards.length,
      percent: standards.length ? Math.round((completedStandards.length / standards.length) * 100) : 0,
      allCompleted: allStandardsCompleted,
      streak: nextStreak,
      pointsAwarded: standardsPoints
    }, { area: 'daily' });
    celebrate(awarded ? `Day locked in. +${standardsPoints} points.` : 'Day submitted. Finish every item to earn activity points.');

    notifyUser(
      allStandardsCompleted ? 'Daily activity tracker locked' : 'Daily activity submitted',
      allStandardsCompleted
        ? `Your day is locked in. Current streak: ${nextStreak} day${nextStreak === 1 ? '' : 's'}.`
        : `You submitted ${completedStandards.length} of ${standards.length} items. Complete every item to earn activity points.`,
      'success',
      {
        type: 'productivity',
        id: `productivity-${submissionDate}`
      }
    );

    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data }) => {
        const accessToken = data.session?.access_token;
        if (!accessToken) return;
        fetch(appApiUrl('/api/notify-parents-day-locked'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            entryDate: submissionDate,
            completed: completedStandards.length,
            total: standards.length,
            streak: nextStreak
          })
        }).catch(() => {});
      });
    }

    if (nextStreak === 3 || nextStreak % 7 === 0) {
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
    trackAnalyticsEvent?.('daily_reflection_started', {
      completed: completedStandards.length,
      total: standards.length
    }, { area: 'daily' });
    if (openJournal) openJournal();
    else setTab('profile');
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
        setRequestedPlanSeriesId={setRequestedPlanSeriesId}
        trackAnalyticsEvent={trackAnalyticsEvent}
      />
    );
  }

  return (
    <>
      {dayCompletion && (
        <div className="day-complete-overlay" role="dialog" aria-modal="true" aria-label="Day complete">
          <div className="day-complete-check"><Check size={46}/></div>
          <h2>Day Complete</h2>
          <strong className="day-complete-points">+{dayCompletion.points} PP</strong>
          <p>Discipline today. A stronger tomorrow.</p>
          <div className="day-complete-results">
            <span><em>Score</em><strong>{dayCompletion.scoreBefore} → {dayCompletion.scoreAfter}</strong></span>
            <span><em>Productivity</em><strong>{dayCompletion.completed}/{dayCompletion.total}</strong></span>
            <span><em>Streak</em><strong>{dayCompletion.streakBefore} → {dayCompletion.streakAfter}</strong></span>
          </div>
          {dayCompletion.goalDeposits?.length > 0 && (
            <div className="goal-day-deposit-celebration">
              <span>You made today count.</span>
              <strong>+1 Locked-In Day</strong>
              <p>Another deposit toward {dayCompletion.goalDeposits[0]}.</p>
            </div>
          )}
          <blockquote>“You showed up. That’s who you are becoming.”</blockquote>
          <button
            className="secondary-action full day-complete-secondary"
            onClick={() => {
              const shouldRequestReview = dayCompletion.requestReview;
              setDayCompletion(null);
              if (shouldRequestReview) {
                window.setTimeout(() => requestMilestoneReview?.('first_locked_day'), 350);
              }
            }}
            type="button"
          >
            View Today
          </button>
        </div>
      )}
      <section className="panel daily-deposit-panel today-page-hero">
        <PanelTitle icon={<Brain size={18} />} title="Daily Deposit" />
        <div className="today-hero-copy">
          <p>{lesson.body}</p>
        </div>
        <div className="today-focus-callout">
          <span>Today’s focus</span>
          <strong>{todaysFocus}</strong>
        </div>
        <div className="today-command-grid" aria-label="Today’s snapshot">
          <span>
            <i><Check size={17} /></i>
            <strong>{completedStandards.length}/{standards.length}</strong>
            <em>Productivity</em>
          </span>
          <span>
            <i><Star size={17} /></i>
            <strong>{athleteScore}</strong>
            <em>Points</em>
          </span>
          <span>
            <i><Flame size={17} /></i>
            <strong>{streakCount}</strong>
            <em>Streak</em>
          </span>
        </div>
      </section>

      <AthleteJourneyCard journey={athleteJourney} onContinue={openJourneyDay} />

      <section className="activity-tracker" aria-labelledby="activity-tracker-title">
        <ActivityTrackerHero
          completed={completedStandards.length}
          percent={activityCompletionPercent}
          streak={streakCount}
          total={standards.length}
        />

        <section className="activity-builder" aria-label="Add something you need to do today">
          <QuickAddSection draft={standardDraft} onSelect={setStandardDraft} userId={userId} />

          <ActivityComposer
            draft={standardDraft}
            goalId={standardGoalId}
            goals={goals}
            onDraftChange={setStandardDraft}
            onGoalChange={setStandardGoalId}
            onSubmit={addStandard}
          />
        </section>

        <div className="activity-list-section">
          <div className="activity-list-heading">
            <div>
              <span>Today’s activities</span>
              <strong>{standards.length ? `${completedStandards.length} of ${standards.length} complete` : 'Build today’s work'}</strong>
            </div>
            <button className="activity-history-link" onClick={() => setStandardsHistoryOpen(true)} type="button">
              <BarChart3 size={15} />
              History
            </button>
          </div>

          <div className="activity-card-list">
            {standards.map((item) => (
              <ActivityCard
                editing={editingStandardId === item.id}
                editingDraft={editingStandardDraft}
                goals={goals}
                item={item}
                key={item.id}
                onCancel={cancelEditingStandard}
                onDelete={removeStandard}
                onEdit={startEditingStandard}
                onEditingDraftChange={setEditingStandardDraft}
                onGoalChange={updateStandardGoal}
                onSave={saveEditingStandard}
                onToggle={(id) => {
                  setStandards((current) =>
                    current.map((standard) =>
                      standard.id === id ? { ...standard, done: !standard.done } : standard
                    )
                  );
                  navigator.vibrate?.(8);
                }}
              />
            ))}
          </div>

          {standards.length === 0 && (
            <div className="activity-empty-state">
              <Check size={20} />
              <div>
                <strong>Your work starts here.</strong>
                <span>Add the actions that will move you forward today.</span>
              </div>
            </div>
          )}
          {standardsFeedback && <p className="inline-warning activity-feedback">{standardsFeedback}</p>}

          {allStandardsCompleted && !submittedToday && (
            <div className="activity-ready-banner">
              <span><Check size={16} /> Today’s work is complete.</span>
              <strong>100%</strong>
            </div>
          )}

          <button
            className={`activity-lock-button${allStandardsCompleted ? ' ready' : ''}${submittedToday ? ' submitted' : ''}`}
            onClick={submitStandards}
            type="button"
          >
            {submittedToday ? (
              <><Check size={18} /> Locked In For Today</>
            ) : (
              <>Lock In My Day <ArrowRight size={18} /></>
            )}
          </button>

          {submittedToday && (
            <button className="reflection-cta" onClick={openDailyReflection}>
              <PenLine size={17} />
              Write what you need to remember
            </button>
          )}
        </div>
      </section>

      <GameDayMode
        athleteProfile={athleteProfile}
        awardPoints={awardPoints}
        checkInPoints={pointValues.gameDayCheckInCompleted}
        notifyUser={notifyUser}
        userId={userId}
        trackAnalyticsEvent={trackAnalyticsEvent}
      />

      {integrationDayOpen && (
        <div className="bottom-sheet-backdrop journey-integration-backdrop" role="presentation" onClick={() => setIntegrationDayOpen(null)}>
          <section className="journey-integration-sheet" role="dialog" aria-modal="true" aria-label={`Journey Day ${integrationDayOpen.day}`} onClick={(event) => event.stopPropagation()}>
            <button className="sheet-close-button" type="button" onClick={() => setIntegrationDayOpen(null)} aria-label="Close Journey day"><X size={18}/></button>
            <span>Day {integrationDayOpen.day} of 21 · Integration Day</span>
            <h2>{integrationDayOpen.title}</h2>
            <div className="journey-integration-action"><strong>Today’s action</strong><p>{integrationDayOpen.action}</p></div>
            <label>
              <span>Today’s reflection</span>
              <strong>{integrationDayOpen.reflection}</strong>
              <textarea value={integrationReflection} onChange={(event) => setIntegrationReflection(event.target.value)} placeholder="Write what you noticed…" />
            </label>
            <button className="primary-action full" type="button" onClick={completeIntegrationDay}>Complete Today’s Work <Check size={17}/></button>
          </section>
        </div>
      )}

      <section className="panel athlete-score-panel">
        <PanelTitle icon={<Star size={18} />} title="Performance Points" action={`Today +${todayPoints} PP`} />
        <div className="score-hero">
          <strong>{athleteScore}</strong>
          <span>Evidence of work earned through daily activity, goals, plans, and reflection.</span>
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
                <span>Performance Points</span>
                <strong>How points work</strong>
              </div>
              <button className="icon-button sheet-close" onClick={() => setScoreInfoOpen(false)} type="button" aria-label="Close points explanation">
                <X size={18} />
              </button>
            </div>
            <div className="points-breakdown">
              <span>
                <strong>+25</strong>
                Full activity day completed
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
                <strong>+15</strong>
                Game Day check-in completed · once daily
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
            <p className="score-info-note">Your score is the total proof you have stacked through daily action, reflection, Game Day preparation, goals, and performance plans.</p>
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
                <strong>Activity History</strong>
              </div>
              <button className="icon-button sheet-close" onClick={() => setStandardsHistoryOpen(false)} type="button" aria-label="Close activity history">
                <X size={18} />
              </button>
            </div>
            {recentStandardsHistory.length === 0 ? (
              <p className="empty-note">Your locked-in activity days will appear here after you submit a day.</p>
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
  setTab,
  setRequestedPlanSeriesId,
  trackAnalyticsEvent
}) {
  const challenges = athleteChallengesByIds(athleteProfile?.currentChallenges, athleteProfile?.currentChallenge);
  const challenge = challenges[0];
  const planLibrary = buildPlanLibrary(sequencedPlanAccess(plans, planProgress, todayKey()));
  const recommendedPlans = challenges.map((selectedChallenge) => {
    const exactMatch = planLibrary.find((series) => series.title === selectedChallenge.recommendedPlanTitle);
    const keywordMatch = planLibrary.find((series) => {
      const text = `${series.title} ${series.tagline} ${series.category}`.toLowerCase();
      return selectedChallenge.planKeywords.some((keyword) => text.includes(keyword));
    });
    return {
      challenge: selectedChallenge,
      series: exactMatch ?? keywordMatch ?? planLibrary.find((series) => series.openCount > 0) ?? planLibrary[0]
    };
  });

  useEffect(() => {
    trackAnalyticsEvent?.('first_rep_viewed', {
      challengeId: challenge.id,
      challengeIds: challenges.map((selectedChallenge) => selectedChallenge.id)
    }, { area: 'activation' });
  }, []);

  function revealPersonalizedPlan(action) {
    const recommendation = recommendedPlans[0];
    trackAnalyticsEvent?.('personalized_plan_revealed', {
      action,
      challengeId: challenge.id,
      seriesTitle: recommendation?.series?.title || ''
    }, { area: 'activation' });
  }

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
    trackAnalyticsEvent?.('first_rep_completed', {
      challengeId: challenge.id
    }, { area: 'activation' });
    revealPersonalizedPlan('mark_complete');
    celebrate('First rep complete. Your personalized path is ready.');
  }

  function openRecommendedPlan(recommendation) {
    setAthleteStartComplete(true);
    localStorage.setItem(athleteStartStorageKey, 'true');
    trackAnalyticsEvent?.('recommended_plan_opened', {
      challengeId: recommendation.challenge.id,
      seriesTitle: recommendation.series?.title || ''
    }, { area: 'activation' });
    revealPersonalizedPlan('recommended_plan');
    setRequestedPlanSeriesId?.(recommendation.series?.id || '');
    setTab('plans');
  }

  function goStraightHome() {
    setAthleteStartComplete(true);
    localStorage.setItem(athleteStartStorageKey, 'true');
    trackAnalyticsEvent?.('first_time_home_skipped', {
      challengeId: challenge.id
    }, { area: 'activation' });
    revealPersonalizedPlan('go_home');
    setTab('home');
    celebrate('Your personalized path is ready.');
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

      <div className="recommended-start-plans" aria-label="Recommended plans">
        {recommendedPlans.map((recommendation) => recommendation.series && (
          <button className="recommended-start-plan has-cover" key={recommendation.challenge.id} onClick={() => openRecommendedPlan(recommendation)} style={{ '--plan-cover': `url(${recommendation.series.thumbnailImage})`, '--plan-cover-position': recommendation.series.coverPosition }} type="button">
            <div className="plan-cover-thumb" aria-hidden="true" />
            <div>
              <span>For {recommendation.challenge.shortLabel}</span>
              <strong>{recommendation.series.title}</strong>
              <em>{nextPlanLabel(recommendation.series)}</em>
            </div>
          </button>
        ))}
      </div>

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

function NotificationTray({ notifications, onClose }) {
  return (
    <section className="notification-tray" aria-label="Notifications">
      <div className="tray-head">
        <div className="tray-title"><strong>Notifications</strong><span>Last 24 hours</span></div>
        <button className="icon-button" type="button" aria-label="Close notifications" onClick={onClose}><X size={20} /></button>
      </div>
      {notifications.length === 0 ? (
        <p>No notifications in the last 24 hours.</p>
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


const performancePlanNeeds = [
  { id: 'confidence', label: 'Confidence', terms: ['confidence', 'positive self image', 'self image', 'belief', '90%'] },
  { id: 'focus', label: 'Focus', terms: ['focus', 'lock in', 'controllables', 'boring wins'] },
  { id: 'pressure', label: 'Pressure', terms: ['pressure', 'controllables', 'next play', 'thermostat'] },
  { id: 'motivation', label: 'Motivation', terms: ['motivation', 'champion habits', 'boring wins', 'discipline'] },
  { id: 'bad-game', label: 'Bad Game', terms: ['next play', 'slump', 'controllables', 'reset'] },
  { id: 'slump', label: 'Slump', terms: ['slump'] },
  { id: 'coach', label: 'Coach Issues', terms: ['coachable athlete', 'coach', 'thermostat', 'leadership'] },
  { id: 'discipline', label: 'Discipline', terms: ['champion habits', 'discipline', 'habit', 'boring wins'] },
  { id: 'leadership', label: 'Leadership', terms: ['leadership', 'leader', 'thermostat', 'coachable athlete'] },
  { id: 'goals', label: 'Goals', terms: ['goal blueprint', 'goal', '90-day target'] }
];

const planOutcomeOverrides = [
  [/slump/i, 'Stop chasing confidence. Rebuild trust in your game.'],
  [/positive self image|self-image|mirror/i, 'Build confidence that is not controlled by your last performance.'],
  [/champion habits?/i, 'Build the habits that make consistency automatic.'],
  [/control the controllables?/i, 'Stay composed and spend your energy on the next response.'],
  [/coachable athlete/i, 'Turn feedback into growth without losing confidence.'],
  [/goal blueprint/i, 'Turn a meaningful target into daily actions you can execute.'],
  [/imagination station|visualization/i, 'Train your mind to see, rehearse, and trust the response you want.'],
  [/compete differently|faith/i, 'Compete with purpose, freedom, and faith beyond the outcome.'],
  [/boring wins/i, 'Build the consistency that keeps working after motivation fades.'],
  [/next play/i, 'Reset faster after mistakes and return to the moment in front of you.'],
  [/lock in|focus/i, 'Protect your attention and bring it back to the next rep.'],
  [/thermostat/i, 'Lead your emotions instead of letting the environment lead you.'],
  [/90%|ninety/i, 'Build the invisible mindset and habits underneath performance.']
];

function planDiscoveryText(series) {
  return `${series?.title || ''} ${series?.category || ''} ${series?.tagline || ''}`.toLowerCase();
}

function planOutcome(series) {
  const text = planDiscoveryText(series);
  const override = planOutcomeOverrides.find(([pattern]) => pattern.test(text));
  if (override) return override[1];
  const firstSentence = String(series?.tagline || '').match(/^[^.!?]+[.!?]?/)?.[0]?.trim() || '';
  return firstSentence || 'Build a stronger response for the moments that test your game.';
}

function nextOpenPlan(series) {
  return series?.plans?.find((plan) => plan.unlocked && !plan.completedAt)
    ?? [...(series?.plans || [])].reverse().find((plan) => plan.unlocked)
    ?? series?.plans?.[0];
}

function seriesDayNumber(series, plan = nextOpenPlan(series)) {
  const index = (series?.plans || []).findIndex((item) => String(item.id) === String(plan?.id));
  return planDayNumber(plan) || Math.max(1, index + 1);
}

function planStatusLabel(series, trialPlanMode = false) {
  if (!series?.plans?.length) return 'Start plan';
  if (series.completedCount >= series.plans.length) return 'Completed';
  const day = seriesDayNumber(series);
  if (series.completedCount > 0) return `In progress · Day ${day}`;
  if (trialPlanMode) return 'Day 1 ready';
  return `Day ${day} ready`;
}

function TrainingProgress({ completed, total }) {
  return (
    <div className="training-progress" aria-label={`${completed} of ${total} training days complete`}>
      {Array.from({ length: total }, (_, index) => <i className={index < completed ? 'complete' : index === completed ? 'current' : ''} key={index} />)}
    </div>
  );
}

function PlanStatusBadge({ series, trialPlanMode = false }) {
  const complete = series.completedCount >= series.plans.length;
  return <span className={`training-plan-status${complete ? ' complete' : series.completedCount > 0 ? ' active' : ''}`}>{planStatusLabel(series, trialPlanMode)}{complete ? ' ✓' : ''}</span>;
}

function PerformancePlanHero({ series, onContinue }) {
  if (!series) return null;
  const nextPlan = nextOpenPlan(series);
  const day = seriesDayNumber(series, nextPlan);
  const total = series.plans.length;
  const completed = series.completedCount;
  const isComplete = completed >= total;
  return (
    <section className="performance-plan-hero" style={{ '--plan-cover': `url(${series.coverImage})`, '--plan-cover-position': series.coverPosition }}>
      <div className="performance-plan-hero-media" aria-hidden="true" />
      <div className="performance-plan-hero-copy">
        <span className="training-eyebrow">{isComplete ? 'Training complete' : 'Continue training'}</span>
        <small>{series.category}</small>
        <h2>{series.title}</h2>
        <div className="performance-plan-next">
          <b>{isComplete ? `${total} days complete` : `Day ${day} of ${total}`}</b>
          <strong>{isComplete ? 'Review your training' : nextPlan?.title || 'Your next lesson'}</strong>
        </div>
        <TrainingProgress completed={completed} total={total} />
        <p>{isComplete ? 'Every day complete. Revisit the lessons whenever you need them.' : `${completed} day${completed === 1 ? '' : 's'} complete · ${Math.max(total - completed, 0)} to go`}</p>
        <button onClick={onContinue} type="button">{isComplete ? 'Review Plan' : `Continue Day ${day}`} <ArrowRight size={17}/></button>
      </div>
    </section>
  );
}

function useHorizontalPointerDrag() {
  const railRef = useRef(null);
  const dragStateRef = useRef({
    active: false,
    axis: null,
    moved: false,
    pointerId: null,
    touchId: null,
    startX: 0,
    startY: 0,
    startScrollLeft: 0
  });

  function finishDrag(event) {
    const rail = railRef.current;
    const drag = dragStateRef.current;
    if (!rail || !drag.active) return;
    drag.active = false;
    rail.classList.remove('is-dragging');
    if (drag.pointerId !== null && rail.hasPointerCapture?.(drag.pointerId)) {
      try { rail.releasePointerCapture(drag.pointerId); } catch { /* capture may already be released */ }
    }
    window.setTimeout(() => {
      dragStateRef.current.moved = false;
    }, 0);
  }

  const dragHandlers = {
    onClickCapture(event) {
      if (!dragStateRef.current.moved) return;
      event.preventDefault();
      event.stopPropagation();
      dragStateRef.current.moved = false;
    },
    onPointerCancel: finishDrag,
    onPointerDown(event) {
      if (event.pointerType === 'touch' || event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
      const rail = railRef.current;
      if (!rail) return;
      dragStateRef.current = {
        active: true,
        axis: null,
        moved: false,
        pointerId: event.pointerId,
        touchId: null,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: rail.scrollLeft
      };
      rail.setPointerCapture?.(event.pointerId);
    },
    onPointerMove(event) {
      const rail = railRef.current;
      const drag = dragStateRef.current;
      if (!rail || !drag.active || drag.pointerId !== event.pointerId) return;
      const distanceX = event.clientX - drag.startX;
      const distanceY = event.clientY - drag.startY;
      if (!drag.axis && Math.max(Math.abs(distanceX), Math.abs(distanceY)) > 6) {
        drag.axis = Math.abs(distanceX) > Math.abs(distanceY) ? 'horizontal' : 'vertical';
      }
      if (drag.axis !== 'horizontal') return;
      drag.moved = true;
      rail.classList.add('is-dragging');
      event.preventDefault();
      rail.scrollLeft = drag.startScrollLeft - distanceX;
    },
    onPointerUp: finishDrag,
    onTouchStart(event) {
      if (event.touches.length !== 1) return;
      const rail = railRef.current;
      const touch = event.touches[0];
      if (!rail || !touch) return;
      dragStateRef.current = {
        active: true,
        axis: null,
        moved: false,
        pointerId: null,
        touchId: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        startScrollLeft: rail.scrollLeft
      };
    },
    onTouchMove(event) {
      const rail = railRef.current;
      const drag = dragStateRef.current;
      if (!rail || !drag.active) return;
      const touch = Array.from(event.touches).find((item) => item.identifier === drag.touchId);
      if (!touch) return;
      const distanceX = touch.clientX - drag.startX;
      const distanceY = touch.clientY - drag.startY;
      if (!drag.axis && Math.max(Math.abs(distanceX), Math.abs(distanceY)) > 6) {
        drag.axis = Math.abs(distanceX) > Math.abs(distanceY) ? 'horizontal' : 'vertical';
      }
      if (drag.axis !== 'horizontal') return;
      drag.moved = true;
      rail.classList.add('is-dragging');
      event.preventDefault();
      rail.scrollLeft = drag.startScrollLeft - distanceX;
    },
    onTouchCancel: finishDrag,
    onTouchEnd: finishDrag
  };

  return { dragHandlers, railRef };
}

function NeedSelector({ activeNeed, onSelect }) {
  const { dragHandlers, railRef } = useHorizontalPointerDrag();
  return (
    <section className="plan-discovery-section">
      <header className="training-section-heading">
        <div><span>Find your training</span><h2>What do you need right now?</h2><p>Tell us what you’re dealing with. We’ll help you find the right training.</p></div>
      </header>
      <div className="plan-need-rail" aria-label="Choose what you need help with" ref={railRef} {...dragHandlers}>
        {performancePlanNeeds.map((need) => (
          <button aria-pressed={activeNeed === need.id} className={activeNeed === need.id ? 'active' : ''} key={need.id} onClick={() => onSelect(activeNeed === need.id ? '' : need.id)} type="button">{need.label}</button>
        ))}
      </div>
    </section>
  );
}

function RecommendedPlans({ plans, onOpen, trialPlanMode }) {
  const { dragHandlers, railRef } = useHorizontalPointerDrag();
  if (!plans.length) return null;

  function moveRecommendedRail(direction) {
    const rail = railRef.current;
    if (!rail) return;
    const distance = Math.max(240, rail.clientWidth * 0.82);
    rail.scrollLeft = Math.max(0, Math.min(rail.scrollWidth - rail.clientWidth, rail.scrollLeft + (direction * distance)));
  }

  return (
    <section className="recommended-training-section">
      <header className="training-section-heading compact">
        <div><span>Recommended for you</span><h2>Based on where you are in your game.</h2></div>
        <div className="training-carousel-controls" aria-label="Move through recommended plans">
          <button aria-label="Previous recommended plan" onClick={() => moveRecommendedRail(-1)} type="button"><ChevronLeft size={16}/></button>
          <button aria-label="Next recommended plan" onClick={() => moveRecommendedRail(1)} type="button"><ChevronRight size={16}/></button>
        </div>
      </header>
      <div className="recommended-plan-rail" ref={railRef} {...dragHandlers}>
        {plans.map((series) => (
          <button className={`recommended-training-card${series.completedCount >= series.plans.length ? ' completed' : ''}`} key={series.id} onClick={() => onOpen(series, 'recommended')} style={{ '--plan-cover': `url(${series.coverImage})`, '--plan-cover-position': series.coverPosition }} type="button">
            <span className="recommended-plan-cover" aria-hidden="true" />
            <span className="recommended-plan-copy">
              <small>{series.category}</small>
              <strong>{series.title}</strong>
              <p>{planOutcome(series)}</p>
              <span><b>{series.plans.length} days · 10 min/day</b><PlanStatusBadge series={series} trialPlanMode={trialPlanMode} /></span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function PlanCategoryRail({ activeCategory, categories, onSelect }) {
  const { dragHandlers, railRef } = useHorizontalPointerDrag();
  return (
    <div className="training-category-rail" aria-label="Plan categories" ref={railRef} {...dragHandlers}>
      {categories.map((category) => <button className={category === activeCategory ? 'active' : ''} key={category} onClick={() => onSelect(category)} type="button">{category}</button>)}
    </div>
  );
}

function PerformancePlanCard({ series, onOpen, trialPlanMode }) {
  const complete = series.completedCount >= series.plans.length;
  return (
    <button className={`performance-plan-card${complete ? ' completed' : ''}`} onClick={() => onOpen(series, 'browse_plans')} style={{ '--plan-thumb': `url(${series.thumbnailImage})`, '--plan-cover-position': series.coverPosition }} type="button">
      <span className="performance-plan-card-image" aria-hidden="true" />
      <span className="performance-plan-card-copy">
        <small>{series.category}</small>
        <strong>{series.title}</strong>
        <p>{planOutcome(series)}</p>
        <span><b>{series.plans.length} days · 10 min/day</b><PlanStatusBadge series={series} trialPlanMode={trialPlanMode} /></span>
      </span>
      <ChevronRight className="performance-plan-chevron" size={18}/>
    </button>
  );
}

function PlansScreen({ athleteProfile, language = 'en', plans, planProgress, trialPlanMode = false, requestedPlanSeriesId = '', requestedPlanId = '', setRequestedPlanSeriesId, setRequestedPlanId, setPlanProgress, awardPoints, notifyUser, persistPlanCompletion, requestMilestoneReview, trackAnalyticsEvent }) {
  const readOnly = !setPlanProgress;
  const { dragHandlers: dayStripDragHandlers, railRef: dayStripRef } = useHorizontalPointerDrag();
  const today = todayKey();
  const sequencedPlans = trialPlanMode
    ? trialPlanAccess(plans, planProgress)
    : sequencedPlanAccess(plans, planProgress, today);
  const planLibrary = buildPlanLibrary(sequencedPlans);
  const [selectedSeriesId, setSelectedSeriesId] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeNeed, setActiveNeed] = useState('');
  const [planDetailTab, setPlanDetailTab] = useState('summary');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const selectedSeries = planLibrary.find((series) => series.id === selectedSeriesId) ?? null;
  const continueSeries = planLibrary.find((series) => series.completedCount > 0 && series.completedCount < series.plans.length)
    ?? planLibrary.find((series) => series.openCount > 0 && series.completedCount < series.plans.length)
    ?? planLibrary[0];
  const categoryOrder = ['Mindset', 'Discipline', 'Pressure', 'Leadership', 'Faith', 'Goals'];
  const availableCategories = Array.from(new Set(planLibrary.map((series) => series.category)));
  const categories = ['All', ...categoryOrder.filter((category) => availableCategories.includes(category)), ...availableCategories.filter((category) => !categoryOrder.includes(category))];
  const categoryLibrary = activeCategory === 'All'
    ? planLibrary
    : planLibrary.filter((series) => series.category === activeCategory);
  const filteredLibrary = categoryLibrary;
  const activeNeedConfig = performancePlanNeeds.find((need) => need.id === activeNeed);
  const challenges = athleteChallengesByIds(athleteProfile?.currentChallenges, athleteProfile?.currentChallenge);
  const recommendationPool = [];
  const addRecommendation = (series) => {
    if (series && !recommendationPool.some((item) => item.id === series.id)) recommendationPool.push(series);
  };
  if (activeNeedConfig) {
    planLibrary.filter((series) => activeNeedConfig.terms.some((term) => planDiscoveryText(series).includes(term))).forEach(addRecommendation);
  } else {
    challenges.forEach((challenge) => {
      addRecommendation(planLibrary.find((series) => series.title === challenge.recommendedPlanTitle));
      addRecommendation(planLibrary.find((series) => challenge.planKeywords.some((keyword) => planDiscoveryText(series).includes(keyword))));
    });
  }
  planLibrary.filter((series) => series.id !== continueSeries?.id && series.completedCount < series.plans.length).forEach(addRecommendation);
  const recommendedSeries = recommendationPool.slice(0, 4);
  const visiblePlans = selectedSeries?.plans ?? [];
  const defaultVisiblePlan = visiblePlans.find((plan) => plan.unlocked && !plan.completedAt)
    ?? [...visiblePlans].reverse().find((plan) => plan.unlocked)
    ?? visiblePlans[0];
  const selectedVisiblePlan = visiblePlans.find((plan) => String(plan.id) === String(selectedPlanId)) ?? defaultVisiblePlan;

  useEffect(() => {
    if (selectedSeriesId && !planLibrary.some((series) => series.id === selectedSeriesId)) {
      setSelectedSeriesId('');
    }
  }, [planLibrary, selectedSeriesId]);

  useEffect(() => {
    if (!requestedPlanSeriesId) return;
    if (planLibrary.some((series) => series.id === requestedPlanSeriesId)) {
      setSelectedSeriesId(requestedPlanSeriesId);
      if (requestedPlanId) {
        setPlanDetailTab('lessons');
        setSelectedPlanId(String(requestedPlanId));
      }
    }
    setRequestedPlanSeriesId?.('');
    setRequestedPlanId?.('');
  }, [planLibrary, requestedPlanId, requestedPlanSeriesId, setRequestedPlanId, setRequestedPlanSeriesId]);

  function openSeries(series, source, continueToLesson = false) {
    setSelectedSeriesId(series.id);
    const nextPlan = nextOpenPlan(series);
    setPlanDetailTab(continueToLesson ? 'lessons' : 'summary');
    setSelectedPlanId(continueToLesson && nextPlan ? String(nextPlan.id) : '');
    trackAnalyticsEvent?.('plan_series_opened', {
      source,
      seriesTitle: series.title,
      category: series.category,
      openCount: series.openCount,
      totalLessons: series.plans.length,
      trialPlanMode: Boolean(trialPlanMode)
    }, { area: 'plans' });
  }

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
    const firstSeriesCompleted = seriesAwarded
      && planSeriesCompletion(plans, planProgress).completed === 0
      && planSeriesCompletion(plans, nextProgress).completed === 1;

    trackAnalyticsEvent?.('plan_lesson_complete_clicked', {
      planId: String(planId),
      planTitle: plan?.title || '',
      seriesTitle,
      day: plan ? planDayNumber(plan) : null,
      seriesCompleted: seriesAwarded
    }, { area: 'plans' });

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
      if (firstSeriesCompleted) {
        window.setTimeout(() => requestMilestoneReview?.('first_completed_plan'), 500);
      }
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
      <div className="cinematic-plan-detail">
        <section className="series-overview has-cover" style={{ '--plan-cover': `url(${selectedSeries.coverImage})`, '--plan-cover-position': selectedSeries.coverPosition }}>
          <div className="series-cover" aria-hidden="true" />
          <button className="plan-back-button cinematic-back" onClick={() => setSelectedSeriesId('')} type="button" aria-label="Back to plan library">
            ←
          </button>
        </section>
        <section className="cinematic-plan-copy">
          <span className="plan-category-badge">{selectedSeries.category}</span>
          <h2>{selectedSeries.title}</h2>
          <strong>{visiblePlans.length} Days</strong>
          <p>{selectedSeries.tagline}</p>
          <button className="primary-action full" type="button" onClick={() => setPlanDetailTab('lessons')}>Continue Plan <ArrowRight size={18}/></button>
        </section>
        {planDetailTab === 'lessons' && <div className="plan-reader-stack single-plan-reader">
          <div className="plan-day-strip" aria-label="Plan days" ref={dayStripRef} {...dayStripDragHandlers}>
            {visiblePlans.map((plan, index) => <button className={String(plan.id) === String(selectedVisiblePlan?.id) ? 'active' : ''} disabled={!plan.unlocked} key={plan.id} onClick={() => setSelectedPlanId(String(plan.id))} type="button">{plan.completedAt ? <Check size={13}/> : plan.unlocked ? index + 1 : <LockKeyhole size={12}/>}</button>)}
          </div>
          {selectedVisiblePlan && (
            <section className={selectedVisiblePlan.unlocked ? 'goal-card plan-card readonly-plan' : 'goal-card plan-card readonly-plan locked-plan'} key={selectedVisiblePlan.id}>
              <div className="plan-read-header">
                <span>{selectedVisiblePlan.completedAt ? 'Completed' : selectedVisiblePlan.unlocked ? (selectedVisiblePlan.challengeDay || `Day ${planDayNumber(selectedVisiblePlan) || planCurrentDay(selectedVisiblePlan)}`) : 'Locked'}</span>
                <strong>{selectedVisiblePlan.title}</strong>
                <em>
                  {selectedVisiblePlan.completedAt
                    ? `Completed ${selectedVisiblePlan.completedAt}`
                    : selectedVisiblePlan.unlocked
                      ? `${selectedVisiblePlan.challengeDay || `Day ${planDayNumber(selectedVisiblePlan) || planCurrentDay(selectedVisiblePlan)}`} of ${selectedVisiblePlan.challengeLength || 7}`
                      : trialPlanMode
                        ? 'Unlocks with membership'
                      : selectedVisiblePlan.unlockDate && selectedVisiblePlan.unlockDate > today
                        ? `Unlocks ${selectedVisiblePlan.unlockDate}`
                        : 'Complete the previous plan first'}
                </em>
                <p>{planDisplaySubject(selectedVisiblePlan)}</p>
              </div>
              {selectedVisiblePlan.unlocked && selectedVisiblePlan.steps.length > 0 && (
                <PlanEpisode language={language} steps={selectedVisiblePlan.steps} planId={selectedVisiblePlan.id} planTitle={selectedVisiblePlan.title} preserveHeadings={shouldPreservePlanHeadings(selectedVisiblePlan.id)} />
              )}
              {!selectedVisiblePlan.unlocked && (
                <div className="locked-message">
                  <LockKeyhole size={18} />
                  <p>{trialPlanMode ? 'Day 1 is open during the trial. Membership unlocks the rest of this plan.' : 'Finish the previous lesson, then come back the next day to unlock this one.'}</p>
                </div>
              )}
              {selectedVisiblePlan.unlocked && !readOnly && (
                <button
                  className={selectedVisiblePlan.completedAt ? 'secondary-action submitted' : 'secondary-action'}
                  disabled={Boolean(selectedVisiblePlan.completedAt)}
                  onClick={() => completePlan(selectedVisiblePlan.id)}
                  type="button"
                >
                  <Check size={16} />
                  {selectedVisiblePlan.completedAt ? 'Lesson Completed' : 'Mark Lesson Complete'}
                </button>
              )}
            </section>
          )}
        </div>}
      </div>
    );
  }

  return (
    <div className="performance-training-center">
      <section className="performance-plans-intro">
        <div><span>Mental training center</span><h2>Build your mental game. One day at a time.</h2></div>
        <small><Clock size={13}/> 10 focused min/day</small>
      </section>

      <PerformancePlanHero series={continueSeries} onContinue={() => openSeries(continueSeries, 'continue_training', true)} />
      <NeedSelector activeNeed={activeNeed} onSelect={setActiveNeed} />
      <RecommendedPlans plans={recommendedSeries} onOpen={openSeries} trialPlanMode={trialPlanMode} />

      <section className="browse-training-section">
        <header className="training-section-heading browse-heading">
          <div><span>Browse plans</span><h2>Find your next edge.</h2></div>
          <strong>{planLibrary.length} Plans</strong>
        </header>
        {planLibrary.length === 0 ? (
          <p className="empty-note">No performance plans are open yet. Check back on the next release day.</p>
        ) : (
          <>
            <PlanCategoryRail activeCategory={activeCategory} categories={categories} onSelect={setActiveCategory} />
            <div className="performance-plan-list">
              {filteredLibrary.map((series) => <PerformancePlanCard key={series.id} onOpen={openSeries} series={series} trialPlanMode={trialPlanMode} />)}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function planSeriesTitle(plan) {
  const subject = String(plan?.subjectEn ?? plan?.subject ?? '');
  const match = subject.match(/Series:\s*([^.!]+)[.!]?/i);
  return match?.[1]?.trim() || 'Performance Plans';
}

function planSeriesTagline(plan) {
  const subject = String(plan?.subject ?? '');
  const withoutSeries = subject.replace(/(?:Series|Serie):\s*[^.!]+[.!]?\s*/i, '').trim();
  return withoutSeries || 'Mental performance lessons for practice, games, and pressure moments.';
}

function planDisplaySubject(plan) {
  return planSeriesTagline(plan);
}

function planCategory(plan) {
  const text = `${planSeriesTitle(plan)} ${plan?.subjectEn ?? plan?.subject ?? ''}`.toLowerCase();
  if (text.includes('goal blueprint') || text.includes('90-day target')) return 'Goals';
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
  if (normalized.includes('coachable athlete')) {
    return '/plan-covers/coachable-athlete-banner.jpg';
  }
  if (normalized.includes('goal blueprint')) {
    return '/plan-covers/goal-blueprint-banner.jpg';
  }
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
  if (normalized.includes('coachable athlete')) {
    return '/plan-covers/coachable-athlete-thumbnail.jpg';
  }
  if (normalized.includes('goal blueprint')) {
    return '/plan-covers/goal-blueprint-thumbnail.jpg';
  }
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
  if (normalized.includes('coachable athlete')) {
    return '50% 50%';
  }
  if (normalized.includes('goal blueprint')) {
    return '54% 50%';
  }
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
        title: String(plan.subject || '').match(/(?:Series|Serie):\s*([^.!]+)[.!]?/i)?.[1]?.trim() || title,
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
  'Modelo mental',
  'Este capítulo le ayudará',
  'Este capítulo te ayudará',
  'Apertura',
  'Retirar el telón',
  'Historia',
  'historia',
  'La historia',
  'Por qué esto importa',
  'Actualización del sistema',
  'Instalación de práctica',
  'Sala de reflexión',
  'Principio de Complete Athlete',
  'Siguiente capítulo',
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
  'Final Complete Athlete Principle',
  'DAY 1 — GIVE YOUR MIND A TARGET',
  'THE FOUR-MINUTE WALL',
  'PULL BACK THE CURTAIN',
  'YOUR MIND NEEDS DIRECTION',
  'EVERYTHING HAPPENS THREE TIMES',
  'FILM ROOM',
  'PRACTICE INSTALL — BUILD YOUR TARGET',
  'MY 90-DAY TARGET',
  'NOW PUT IT IN THE APP',
  'CLOSING THE DAY',
  'DAY 2 — REVERSE ENGINEER THE WIN',
  'THE SCOREBOARD PROBLEM',
  'START AT THE FINISH LINE',
  'THE GOAL LADDER',
  'GOAL → MILESTONES → WEEKLY STANDARDS → DAILY PRIORITIES',
  '1. THE GOAL',
  '2. THE MILESTONES',
  '3. THE WEEKLY STANDARDS',
  '4. THE DAILY PRIORITIES',
  'THE TWO SCOREBOARDS',
  'PRACTICE INSTALL — BUILD YOUR GOAL LADDER',
  'MY 90-DAY GOAL',
  'MY MILESTONES',
  'MY WEEKLY STANDARDS',
  'MY DAILY PRIORITIES',
  'NOW OPEN THE APP',
  "DON'T CONFUSE MOTION WITH PROGRESS",
  'DAY 3 — BECOME THE PERSON THE GOAL REQUIRES',
  'BEFORE SHOHEI OHTANI BECAME SHOHEI OHTANI',
  'THE BOX THAT CHANGES EVERYTHING',
  'YOUR GOAL HAS HIDDEN REQUIREMENTS',
  'THE OHTANI METHOD',
  'CURRENT YOU VS. REQUIRED YOU',
  "THE MOST IMPORTANT PART OF OHTANI'S CHART",
  'FILM ROOM — BUILD YOUR 8',
  'PRACTICE INSTALL — GO FROM 8 TO 64',
  'NOW CONNECT IT TO THE APP',
  "DON'T JUST CHASE THE ATHLETE",
  'DAY 4 — KEEP THE TARGET ALIVE',
  'BRUCE LEE WROTE IT DOWN',
  'THE GOAL YOU FORGOT',
  'A REVIEW SYSTEM.',
  'THE GOAL LOOP',
  'WRITE → REVIEW → PRIORITIZE → EXECUTE → MEASURE → ADJUST → REPEAT',
  '1. WRITE',
  '2. REVIEW',
  '3. PRIORITIZE',
  '4. EXECUTE',
  '5. MEASURE',
  '6. ADJUST',
  '7. REPEAT',
  'YOUR DAILY GOAL ROUTINE',
  'YOUR WEEKLY RESET',
  '1. WHAT DID I SAY I WOULD DO?',
  '2. WHAT DID I ACTUALLY DO?',
  "3. WHAT'S WORKING?",
  '4. WHAT NEEDS TO CHANGE?',
  'PRACTICE INSTALL — COMPLETE YOUR 90-DAY GOAL CARD',
  'MY DEADLINE',
  'MY WHY',
  'MY 8 DEVELOPMENT AREAS',
  'MY 64 ACTIONS',
  'THE PERSON I MUST BECOME',
  'PUT THE SYSTEM TO WORK',
  "DON'T DIG UP THE SEED",
  'CLOSING THE PLAN — FROM PAPER TO PROOF',
  'DAY 1 — YOU DEFINED THE TARGET.',
  'DAY 2 — YOU BUILT THE PATH.',
  'DAY 3 — YOU BUILT THE ATHLETE.',
  'DAY 4 — YOU BUILT THE SYSTEM.'
]);

function shouldPreservePlanHeadings(planId) {
  return String(planId ?? '').startsWith('goal-blueprint-');
}

function sectionTone(title) {
  const normalized = title.toLowerCase();
  if (normalized.includes('practice') || normalized.includes('blueprint') || normalized.includes('reset framework')) return 'practice';
  if (normalized.includes('daily challenge')) return 'practice';
  if (normalized.includes('journal') || normalized.includes('reflection')) return 'practice';
  if (normalized.includes('film') || normalized.includes('story') || normalized.includes('curtain') || normalized.includes('deeper look')) return 'film';
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
    const imageMatch = line.match(/^\[IMAGE:([^|\]]+)(?:\|([^\]]+))?\]$/);
    if (imageMatch) {
      flushBody();
      flushBullet();
      flushQuote();
      blocks.push({
        type: 'image',
        src: imageMatch[1].trim(),
        alt: imageMatch[2]?.trim() || ''
      });
      return;
    }

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

function isPreservedHeadingLine(line) {
  if (!line || line.length > 96) return false;
  if (/^(YES \/ NO|___ \/ \d+|___ \/ \d+|___ \/|[0-9]+\.|[A-Z]\.)/.test(line)) return false;
  if (/^["']/.test(line)) return false;
  if (/^[A-Z0-9&/.,:'"() -]+$/.test(line) && /[A-Z]/.test(line)) return true;
  return false;
}

function explicitPlanReaderSections(body, preserveHeadings = false) {
  const headingSet = new Set([...explicitPlanSectionHeadings].flatMap((heading) => [heading, translateText(heading, 'es')]));
  const lines = planReaderBody(body)
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (!lines.some((line) =>
    headingSet.has(line) ||
    /^Day\s+\d+:/i.test(line) ||
    /^DAY\s+\d+\s+-/i.test(line) ||
    /^Next Chapter:/i.test(line) ||
    (preserveHeadings && isPreservedHeadingLine(line))
  )) return [];

  const sections = [];
  let current = null;

  lines.forEach((line) => {
    if (
      headingSet.has(line) ||
      /^Day\s+\d+:/i.test(line) ||
      /^DAY\s+\d+\s+-/i.test(line) ||
      /^Next Chapter:/i.test(line) ||
      (preserveHeadings && isPreservedHeadingLine(line))
    ) {
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

function blockAudioText(block) {
  if (block.type === 'image') {
    return block.alt ? `Image: ${block.alt}.` : '';
  }
  return (block.paragraphs ?? []).join(' ');
}

function cleanAudioText(text) {
  return String(text ?? '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/→/g, ' to ')
    .replace(/[—–]/g, '. ')
    .replace(/[•✓]/g, '')
    .replace(/_{2,}/g, ' blank ')
    .replace(/\s*\/\s*/g, ' or ')
    .replace(/\bAPP\b/g, 'app')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

function sectionAudioText(section) {
  const title = section.title ? `${section.title}. ` : '';
  const body = section.blocks.map(blockAudioText).filter(Boolean).join(' ');
  return cleanAudioText(`${title}${body}`);
}

function PersistentPlanAudioPlayer() {
  const audioState = usePlanAudioState();
  if (audioState.status === 'idle') return null;
  const progress = audioState.duration > 0
    ? Math.min(100, Math.max(0, (audioState.currentTime / audioState.duration) * 100))
    : 0;

  return (
    <aside className="persistent-plan-player" aria-label="Current plan audio">
      <div className="persistent-plan-player-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <button
        className="persistent-plan-player-toggle"
        disabled={audioState.status === 'loading'}
        onClick={() => planAudioPlayer.toggle()}
        type="button"
        aria-label={audioState.status === 'playing' ? 'Pause plan audio' : 'Resume plan audio'}
      >
        {audioState.status === 'playing' ? <Pause size={17} /> : <Play size={17} />}
      </button>
      <div className="persistent-plan-player-copy">
        <strong>{audioState.planTitle || 'Performance Plan'}</strong>
        <span>
          {audioState.status === 'loading'
            ? 'Preparing audio…'
            : audioState.status === 'error'
              ? audioState.error
              : `${audioState.status === 'paused' ? 'Paused' : 'Playing'} · ${audioState.sectionTitle}`}
        </span>
      </div>
      <button className="persistent-plan-player-close" onClick={() => planAudioPlayer.stop()} type="button" aria-label="Stop plan audio">
        <X size={16} />
      </button>
    </aside>
  );
}

function usePlanAudioState() {
  const [audioState, setAudioState] = useState(planAudioPlayer.getState());
  useEffect(() => planAudioPlayer.subscribe(setAudioState), []);
  return audioState;
}

function PlanAudioControls({ language = 'en', sections, planId, planTitle = 'Performance Plan' }) {
  const audioState = usePlanAudioState();
  const { rate } = audioState;
  const isCurrentPlan = String(audioState.planId) === String(planId);
  const status = isCurrentPlan ? audioState.status : 'idle';
  const activeSectionIndex = isCurrentPlan ? audioState.sectionIndex : -1;
  const playbackMode = isCurrentPlan ? audioState.mode : 'plan';
  const currentTime = isCurrentPlan ? audioState.currentTime : 0;
  const currentDuration = isCurrentPlan ? audioState.duration : 0;
  const canPlayAudio = typeof window !== 'undefined' && typeof Audio !== 'undefined';
  const availableSections = sections
    .map((section, index) => ({ ...section, index, audioText: sectionAudioText(section) }));
  const estimatedSectionSeconds = sections.map((section) => {
    const wordCount = sectionAudioText(section).split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round((wordCount / 150) * 60));
  });
  const estimatedDaySeconds = estimatedSectionSeconds.reduce((total, seconds) => total + seconds, 0);
  const estimatedCompletedSeconds = estimatedSectionSeconds
    .slice(0, Math.max(activeSectionIndex, 0))
    .reduce((total, seconds) => total + seconds, 0);
  const activeEstimate = estimatedSectionSeconds[activeSectionIndex] || 1;
  const activeProgress = currentDuration > 0 ? Math.min(currentTime / currentDuration, 1) : 0;
  const progressSeconds = playbackMode === 'plan'
    ? estimatedCompletedSeconds + (activeEstimate * activeProgress)
    : currentTime;
  const totalSeconds = playbackMode === 'plan' ? estimatedDaySeconds : (currentDuration || activeEstimate);
  const progressPercent = totalSeconds > 0
    ? Math.min(100, Math.max(0, (progressSeconds / totalSeconds) * 100))
    : 0;

  function formatAudioTime(seconds) {
    const adjustedSeconds = Math.max(0, Math.round(seconds / rate));
    const minutes = Math.floor(adjustedSeconds / 60);
    return `${minutes}:${String(adjustedSeconds % 60).padStart(2, '0')}`;
  }

  useEffect(() => {
    function handleSectionListen(event) {
      if (event.detail?.planId !== planId) return;
      const sectionIndex = Number(event.detail?.sectionIndex ?? 0);
      startSpeech(sectionIndex, 'section');
    }

    window.addEventListener('tca-plan-section-listen', handleSectionListen);
    return () => window.removeEventListener('tca-plan-section-listen', handleSectionListen);
  });

  async function requestNarratedAudio(text) {
    const session = await supabase?.auth?.getSession?.().catch(() => null);
    const token = session?.data?.session?.access_token;
    if (!token) throw new Error('No signed-in session for narrated audio.');

    const response = await fetch(appApiUrl('/api/plan-audio'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ language, planId, text })
    });

    if (!response.ok) throw new Error('Narrated audio unavailable.');
    const blob = await response.blob();
    if (!blob.size || !blob.type.startsWith('audio/')) throw new Error('Invalid narrated audio.');
    return blob;
  }

  function startSpeech(sectionIndex = 0, mode = 'section') {
    planAudioPlayer.start({
      language,
      planId,
      planTitle,
      sections: availableSections,
      loadAudio: (_index, text) => requestNarratedAudio(text)
    }, sectionIndex, mode);
  }

  async function togglePause() {
    if (status === 'loading') return;
    if (status === 'playing' || status === 'paused') { planAudioPlayer.toggle(); return; }
    if (status === 'error') { restartCurrentSection(); return; }
    startSpeech(availableSections[0]?.index ?? 0, 'plan');
  }

  function restartCurrentSection() {
    const sectionIndex = activeSectionIndex >= 0 ? activeSectionIndex : availableSections[0]?.index ?? 0;
    if (isCurrentPlan) planAudioPlayer.restart();
    else startSpeech(sectionIndex, playbackMode || 'section');
  }


  if (!canPlayAudio || !availableSections.some((section) => section.audioText.length > 12)) return null;

  return (
    <div className="plan-audio-panel" aria-label="Plan audio controls">
      <div className="plan-audio-head">
        <span>
          <Volume2 size={16} />
          Listen to this day
        </span>
        <select
          aria-label="Reading speed"
          value={rate}
          onChange={(event) => {
            const nextRate = Number(event.target.value);
            planAudioPlayer.setRate(nextRate);
          }}
        >
          <option value="0.9">0.9x</option>
          <option value="1">1x</option>
          <option value="1.15">1.15x</option>
          <option value="1.3">1.3x</option>
        </select>
      </div>
      <div className="plan-audio-progress-row">
        <div className="plan-audio-progress" role="progressbar" aria-label="Audio progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progressPercent)}>
          <span style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="plan-audio-time">
          {formatAudioTime(progressSeconds)} / {status === 'idle' ? '~' : ''}{formatAudioTime(totalSeconds)}
        </span>
      </div>
      <div className="plan-audio-actions">
        <button className="plan-audio-primary" type="button" onClick={togglePause} disabled={status === 'loading'}>
          {status === 'playing' ? <Pause size={16} /> : <Play size={16} />}
          {status === 'playing' ? 'Pause' : status === 'paused' ? 'Resume' : status === 'error' ? 'Retry Audio' : 'Play audio'}
        </button>
        {activeSectionIndex >= 0 && status !== 'loading' && (
          <button className="plan-audio-restart" type="button" onClick={restartCurrentSection} aria-label="Restart current audio">
            <RotateCcw size={15} /> Restart
          </button>
        )}
      </div>
      {status === 'error' && <p className="plan-audio-status" role="status">ElevenLabs audio is unavailable right now. Tap Retry Audio to try again.</p>}
      {status !== 'idle' && status !== 'error' && activeSectionIndex >= 0 && (
        <p className="plan-audio-status">
          {status === 'loading' ? 'Preparing audio' : status === 'paused' ? 'Paused' : 'Now reading'}: {sections[activeSectionIndex]?.title || 'Current section'}
        </p>
      )}
    </div>
  );
}

function PlanEpisode({ language = 'en', steps, planId, planTitle = 'Performance Plan', preserveHeadings = false }) {
  const body = steps.join('\n\n');
  const sections = explicitPlanReaderSections(body, preserveHeadings);
  const readerSections = sections.length ? sections : buildPlanReaderSections(planReaderBlocks(body), planId);

  return (
    <div className="episode-flow episode-page-flow">
      <article className="episode-section episode-page" key={`${planId}-page`}>
        <PlanAudioControls language={language} sections={readerSections} planId={planId} planTitle={planTitle} />
        {readerSections.map((section, sectionIndex) => (
          <section className={`reader-section reader-section-${section.tone}`} key={`${planId}-section-${sectionIndex}`}>
            <div className="reader-section-header">
              {section.title && <h3>{section.title}</h3>}
              <button
                className="reader-section-listen"
                onClick={() => {
                  const event = new CustomEvent('tca-plan-section-listen', {
                    detail: { planId, sectionIndex }
                  });
                  window.dispatchEvent(event);
                }}
                type="button"
              >
                <Volume2 size={14} />
                Listen
              </button>
            </div>
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

              if (block.type === 'image') {
                return (
                  <figure className="reader-image" key={`${planId}-image-${sectionIndex}-${blockIndex}`}>
                    <img alt={block.alt} src={block.src} />
                    {block.alt && <figcaption>{block.alt}</figcaption>}
                  </figure>
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
  goals,
  journal,
  journalEntries,
  journalGoalId,
  journalType,
  setJournal,
  setJournalEntries,
  setJournalGoalId,
  setJournalType,
  setProfileView,
  trackAnalyticsEvent
}) {
  const [reflectionHistoryOpen, setReflectionHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [deletingEntryId, setDeletingEntryId] = useState('');

  function saveJournalEntry() {
    const body = journal.trim();
    if (!body) return;
    const entry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      pending: true,
      ownerId: loadAuthSession()?.id,
      body,
      type: journalType,
      linkedGoalId: journalGoalId || null,
      date: todayKey(),
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    };
    setJournalEntries((current) => {
      const next = [entry, ...current];
      localStorage.setItem(`${journalStorageKey}:${entry.ownerId || 'guest'}`, JSON.stringify(next));
      return next;
    });
    setJournal('');
    setJournalGoalId('');
    const awarded = awardPoints({
      type: 'journal_saved',
      points: pointValues.journalSaved,
      label: 'Journal reflection saved',
      uniqueKey: `journal-saved-${entry.id}`,
      metadata: { entryType: entry.type }
    });
    trackAnalyticsEvent?.('journal_saved', {
      entryType: entry.type,
      bodyLength: body.length,
      linkedToGoal: Boolean(entry.linkedGoalId)
    }, { area: 'journal' });
    celebrate(awarded ? `Journal saved. +${pointValues.journalSaved} points.` : 'Journal saved. That reflection is yours to revisit.');
  }

  async function deleteJournalEntry(entry) {
    if (deletingEntryId) return;
    const confirmed = window.confirm('Delete this journal entry? This cannot be undone.');
    if (!confirmed) return;

    setDeletingEntryId(entry.id);
    const ownerId = loadAuthSession()?.id || entry.ownerId;

    if (isSupabaseConfigured && isSupabaseId(ownerId)) {
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('athlete_user_id', ownerId)
        .eq('id', entry.id);

      if (error) {
        setDeletingEntryId('');
        celebrate('That entry could not be deleted. Please try again.');
        return;
      }
    }

    setJournalEntries((current) => {
      const next = current.filter((item) => item.id !== entry.id);
      localStorage.setItem(`${journalStorageKey}:${ownerId || 'guest'}`, JSON.stringify(next));
      return next;
    });
    trackAnalyticsEvent?.('journal_deleted', {
      entryType: entry.type
    }, { area: 'journal' });
    setDeletingEntryId('');
    celebrate('Journal entry deleted.');
  }


  const journalHistoryList = journalEntries.length === 0 ? (
    <p className="empty-note">Saved reflections will appear here so you can review your growth over time.</p>
  ) : (
    <div className="journal-history sheet-history-list">
      {journalEntries.filter((entry) => `${entry.body} ${entry.type} ${entry.date}`.toLowerCase().includes(historySearch.toLowerCase())).map((entry) => {
        const linkedGoal = entry.linkedGoalId
          ? goals.find((goal) => goal.id === entry.linkedGoalId)
          : null;

        return (
          <article className="journal-entry" key={entry.id}>
            <div className="journal-entry-content">
              <span>{entry.type}</span>
              <strong>{entry.date} at {entry.time}</strong>
              {linkedGoal && <em>Connected to {linkedGoal.label}</em>}
              <p translate="no">{entry.body}</p>
            </div>
            <button
              aria-label={`Delete journal entry from ${entry.date}`}
              className="journal-delete"
              disabled={deletingEntryId === entry.id}
              onClick={() => deleteJournalEntry(entry)}
              type="button"
            >
              <Trash2 size={17} />
            </button>
          </article>
        );
      })}
    </div>
  );

  return (
    <>
      <button className="profile-subview-back" type="button" onClick={() => setProfileView?.('overview')}>← Back to Profile</button>
      <section className="panel journal-panel">
        <PanelTitle icon={<PenLine size={18} />} title="Journal" action="Private" />
        <div className="journal-intro">
          <strong>Write what you need to remember.</strong>
          <span>Use this private space to reflect, reset, and remember what matters.</span>
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
          <option>Game Day Reflection</option>
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
            <input className="text-field" aria-label="Search reflections" placeholder="Search all reflections…" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} />
            {journalHistoryList}
          </section>
        </div>
      )}
    </>
  );
}

function CoachScreen({
  activeCoachSessionId,
  athleteJourney,
  athleteProfile,
  authSession,
  coachComposerFocused,
  coachSessions,
  lesson,
  language,
  goals,
  messages,
  messageDraft,
  planProgress,
  plans,
  standards,
  streakCount,
  setActiveCoachSessionId,
  setCoachSessions,
  setMessages,
  setMessageDraft,
  setCoachComposerFocused,
  trackAnalyticsEvent
}) {
  const [coachStatus, setCoachStatus] = useState('');
  const [coachThinking, setCoachThinking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscribing, setVoiceTranscribing] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [coachHistoryOpen, setCoachHistoryOpen] = useState(false);
  const coachFirstName = String(athleteProfile?.name || authSession?.name || 'Athlete').trim().split(/\s+/)[0];
  const rotatingCoachTopics = useMemo(() => {
    const daySeed = Number(todayKey().replaceAll('-', '')) || 0;
    const nameSeed = [...coachFirstName].reduce((total, character) => total + character.charCodeAt(0), 0);
    const offset = (daySeed + nameSeed) % coachTopics.length;
    return Array.from({ length: 6 }, (_, index) => coachTopics[(offset + index * 5) % coachTopics.length]);
  }, [coachFirstName]);
  const chatPanelRef = useRef(null);
  const coachDraftRef = useRef(null);
  const voiceControllerRef = useRef(null);
  const voiceModeRef = useRef(false);
  const voiceSendRef = useRef(null);
  const voiceListenRef = useRef(null);
  const resumeListeningAfterSpeechRef = useRef(false);

  function resizeCoachDraft(target = coachDraftRef.current) {
    if (!target) return;
    target.style.height = '46px';
    const nextHeight = Math.min(Math.max(target.scrollHeight, 46), 120);
    target.style.height = `${nextHeight}px`;
    target.style.overflowY = target.scrollHeight > 120 ? 'auto' : 'hidden';
    if (target.scrollHeight > 120) {
      target.scrollTop = target.scrollHeight;
    }
  }

  useEffect(() => {
    resizeCoachDraft();
  }, [messageDraft]);

  useEffect(() => {
    const panel = chatPanelRef.current;
    if (panel) {
      panel.scrollTop = panel.scrollHeight;
    }
  }, [messages, coachThinking]);

  useEffect(() => {
    const controller = createCoachVoiceController({
      locale: language === 'es' ? 'es-US' : 'en-US',
      transcribeAudio: transcribeCoachAudio,
      onTranscript(text, isFinal) {
        setVoiceTranscript(text);
        setMessageDraft(text);
        if (isFinal && voiceModeRef.current && text.trim()) {
          setVoiceTranscript('');
          voiceSendRef.current?.(text.trim());
        }
      },
      onListeningChange(active) {
        setVoiceListening(active);
      },
      onTranscribingChange(active) {
        setVoiceTranscribing(active);
      },
      onSpeakingChange(active) {
        setVoiceSpeaking(active);
        if (!active && resumeListeningAfterSpeechRef.current && voiceModeRef.current) {
          resumeListeningAfterSpeechRef.current = false;
          window.setTimeout(() => voiceListenRef.current?.(), 420);
        }
      },
      onError(message) {
        setVoiceError(message);
        setVoiceListening(false);
        setVoiceSpeaking(false);
      }
    });
    voiceControllerRef.current = controller;
    setVoiceError('');
    setVoiceSupported(controller.isSupported());
    return () => {
      voiceModeRef.current = false;
      controller.destroy();
      if (voiceControllerRef.current === controller) voiceControllerRef.current = null;
    };
  }, [language]);

  async function transcribeCoachAudio(blob) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('The voice recording could not be read.'));
      reader.readAsDataURL(blob);
    });
    const audio = dataUrl.split(',')[1] || '';
    const headers = { 'Content-Type': 'application/json' };
    if (isSupabaseConfigured) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    }
    const response = await fetch(appApiUrl('/api/coach'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'transcribe',
        audio,
        mimeType: blob.type || 'audio/webm',
        language
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.text) {
      throw new Error(payload.error || 'Voice recognition could not connect. Please try again.');
    }
    return payload.text;
  }

  async function startVoiceListening() {
    if (coachThinking || voiceTranscribing || !voiceControllerRef.current) return;
    setVoiceError('');
    setVoiceTranscript('');
    try {
      await voiceControllerRef.current.startListening();
      trackAnalyticsEvent?.('coach_voice_listening_started', {}, { area: 'coach' });
    } catch (error) {
      setVoiceError(error?.message || 'Voice Coach could not start. Please try again.');
      setVoiceListening(false);
    }
  }

  voiceListenRef.current = startVoiceListening;

  async function startVoiceSession() {
    if (!voiceSupported || !voiceControllerRef.current) return;
    voiceModeRef.current = true;
    setVoiceMode(true);
    setVoiceError('');
    trackAnalyticsEvent?.('coach_voice_session_started', {}, { area: 'coach' });
    await startVoiceListening();
  }

  async function endVoiceSession() {
    voiceModeRef.current = false;
    resumeListeningAfterSpeechRef.current = false;
    setVoiceMode(false);
    setVoiceListening(false);
    setVoiceSpeaking(false);
    setVoiceTranscribing(false);
    setVoiceTranscript('');
    try {
      await voiceControllerRef.current?.stopListening({ submit: false });
      await voiceControllerRef.current?.stopSpeaking();
    } catch {
      // Ending a voice session should always return the interface to text chat.
    }
    trackAnalyticsEvent?.('coach_voice_session_ended', {}, { area: 'coach' });
  }

  async function speakCoachMessage(text, continueConversation = false) {
    if (!voiceControllerRef.current || !text) return;
    setVoiceError('');
    resumeListeningAfterSpeechRef.current = continueConversation;
    try {
      await voiceControllerRef.current.speak(text);
      trackAnalyticsEvent?.('coach_reply_played', {
        automatic: continueConversation,
        replyLength: String(text).length
      }, { area: 'coach' });
    } catch (error) {
      resumeListeningAfterSpeechRef.current = false;
      setVoiceError(error?.message || 'The coach response could not be played.');
    }
  }

  async function handleVoiceControl() {
    if (voiceTranscribing) return;
    if (voiceListening) {
      await voiceControllerRef.current?.stopListening({ submit: true });
      return;
    }
    if (voiceSpeaking) {
      resumeListeningAfterSpeechRef.current = false;
      await voiceControllerRef.current?.stopSpeaking();
      await startVoiceListening();
      return;
    }
    await startVoiceListening();
  }

  function coachReply(text) {
    const lower = text.toLowerCase();
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (/^(yo+|hey+|hi+|hello+|sup|what'?s up|you there|are you there|u there|can you help|help me|coach|mindset coach)[\s?.!]*$/i.test(text)) {
      const firstName = String(athleteProfile?.name || authSession?.name || '').trim().split(/\s+/)[0];
      const namePhrase = firstName ? `, ${firstName}` : '';
      return `I'm here${namePhrase}. What's going on today?`;
    }
    if (words.length < 12) {
      return "I'm with you. What happened in the most recent moment?";
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
      return `I get why that feels frustrating. What happened in the exact ${topic} moment, and what did you do right after it?`;
    }

    return `I do not want to guess at the whole story. What happened right before that ${topic} moment, and what do you wish you had done differently?`;
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

    const recentGameDay = getRecentGameDayContext(authSession?.id, 1)[0] || null;
    const currentJourney = athleteJourney ? journeyProgress(athleteJourney) : null;
    const response = await fetch(appApiUrl('/api/coach'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        language,
        locale: language === 'es' ? 'es-US' : 'en-US',
        message: clean,
        sessionId: String(sessionId),
        sessionTitle,
        history: nextMessages.slice(-12),
        athlete: {
          name: athleteProfile?.name || authSession?.name || '',
          sport: athleteProfile?.sport || '',
          age: athleteProfile?.age || '',
          position: athleteProfile?.position || '',
          teamLevel: athleteProfile?.teamLevel || athleteProfile?.team_level || '',
          dreamGoal: athleteProfile?.dreamGoal || athleteProfile?.dream_goal || '',
          goals: goals.map((goal) => `${goal.label}: ${goal.value}`),
          standards: standards.filter((standard) => standard.active !== false).map((standard) => standard.label),
          lockedInDays: streakCount,
          journey: currentJourney ? {
            currentDay: currentJourney.nextDay?.day || currentJourney.total || 1,
            completedDays: currentJourney.completed,
            totalDays: currentJourney.total,
            percent: currentJourney.percent,
            primaryFocus: athleteJourney?.developmentProfile?.primaryFocusLabel || ''
          } : null,
          recentGameDay
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

  async function sendMessage(voiceText = '') {
    const clean = (typeof voiceText === 'string' && voiceText ? voiceText : messageDraft).trim();
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
    trackAnalyticsEvent?.('coach_message_sent', {
      sessionStarted: !activeCoachSessionId,
      messageLength: clean.length,
      historyCount: messages.length,
      goalsCount: goals.length,
      activeStandardsCount: standards.filter((standard) => standard.active !== false).length
    }, { area: 'coach' });

    try {
      const payload = await requestCoachReply(clean, nextMessages, sessionId, sessionTitle);
      if (payload.messageLimit) {
        setCoachStatus(`${payload.messageCount} of ${payload.messageLimit} coach messages used today.`);
      }
      trackAnalyticsEvent?.('coach_reply_received', {
        messageCount: payload.messageCount || null,
        messageLimit: payload.messageLimit || null,
        replyLength: String(payload.reply || '').length
      }, { area: 'coach' });
      saveCoachSession(sessionId, sessionTitle, [...nextMessages, { role: 'coach', text: payload.reply }]);
      if (voiceModeRef.current) await speakCoachMessage(payload.reply, true);
    } catch (error) {
      if (error.code === 'coach_daily_limit') {
        trackAnalyticsEvent?.('coach_daily_limit_hit', {
          messageCount: error.messageCount || null,
          messageLimit: error.messageLimit || null
        }, { area: 'coach', severity: 'warning' });
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
        trackAnalyticsEvent?.('coach_fallback_reply_used', {
          reason: error.message || 'backend_unavailable'
        }, { area: 'coach', severity: 'warning' });
        saveCoachSession(sessionId, sessionTitle, [...nextMessages, { role: 'coach', text: reply }]);
        if (voiceModeRef.current) await speakCoachMessage(reply, true);
      } else {
        const backendMessage =
          error.status === 401
            ? 'Sign out and log back in, then try My Mindset Coach again.'
            : error.message || 'My Mindset Coach could not connect. Try again in a moment.';
        setCoachStatus(backendMessage);
        trackAnalyticsEvent?.('coach_reply_failed', {
          status: error.status || null,
          reason: error.message || 'unknown'
        }, { area: 'coach', severity: 'error' });
        saveCoachSession(sessionId, sessionTitle, nextMessages);
      }
    } finally {
      setCoachThinking(false);
    }
  }

  voiceSendRef.current = sendMessage;

  function useTopic(prompt, category = '') {
    trackAnalyticsEvent?.('coach_topic_selected', {
      promptLength: prompt.length,
      category
    }, { area: 'coach' });
    void sendMessage(prompt);
  }

  function startNewChat() {
    void endVoiceSession();
    setCoachComposerFocused(false);
    setActiveCoachSessionId(null);
    setMessages([]);
    setMessageDraft('');
    setCoachStatus('');
    trackAnalyticsEvent?.('coach_new_chat_started', {}, { area: 'coach' });
  }

  function openCoachSession(session) {
    void endVoiceSession();
    setCoachHistoryOpen(false);
    setCoachComposerFocused(false);
    setActiveCoachSessionId(session.id);
    setMessages(session.messages);
    setMessageDraft('');
    setCoachStatus('');
    trackAnalyticsEvent?.('coach_session_opened', {
      messagesCount: session.messages?.length || 0
    }, { area: 'coach' });
  }

  function removeCoachSession(id) {
    setCoachSessions((current) => current.filter((session) => session.id !== id));
    if (activeCoachSessionId === id) {
      startNewChat();
    }
  }

  function dismissCoachComposer() {
    coachDraftRef.current?.blur();
    setCoachComposerFocused(false);
  }

  return (
    <div className="coach-screen">
      <section className={`coach-conversation${messages.length === 0 ? ' is-starting' : ' is-active'}`}>
        <div className="coach-command-head">
          <div className="coach-identity">
            <div className="coach-mark" aria-hidden="true">
              <UserRound size={22} strokeWidth={2.35} />
              <i />
            </div>
            <div className="coach-conversation-title">
              <strong>Ready when you are.</strong>
            </div>
          </div>
          <div className="coach-head-actions">
            <button className="coach-head-icon" onClick={() => setCoachHistoryOpen(true)} type="button" aria-label="Open conversation history">
              <BookOpen size={17} />
              {coachSessions.length > 0 && <span>{coachSessions.length}</span>}
            </button>
            <button className="coach-new-chat" onClick={startNewChat} type="button" aria-label="Start new conversation">
              <Plus size={16} />
              <span>New chat</span>
            </button>
          </div>
        </div>

        {messages.length === 0 && (
          <div className="coach-starting-state">
            <div className="coach-performance-orb" aria-hidden="true">
              <span><UserRound size={29} strokeWidth={2.2} /></span>
            </div>
            <div className="coach-welcome-copy">
              <span>Built for the moments between the highlights.</span>
              <h2>What’s on your mind today, {coachFirstName}?</h2>
            </div>

            <div className="coach-quick-starts">
              <div className="coach-section-label">
                <div>
                  <strong>Quick starts</strong>
                  <span>Choose what’s closest to what you’re feeling.</span>
                </div>
                <Sparkles size={16} />
              </div>
              <div className="coach-topic-grid">
                {rotatingCoachTopics.map((topic) => {
                  const TopicIcon = topic.icon;
                  return (
                    <button key={`${topic.category}-${topic.title}`} onClick={() => useTopic(topic.prompt, topic.category)} type="button">
                      <span className="coach-topic-icon"><TopicIcon size={16} /></span>
                      <span>
                        <small>{topic.category}</small>
                        <strong>{topic.title}</strong>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {messages.length > 0 && <section className="chat-panel" ref={chatPanelRef}>
          {messages.map((message, index) => (
            <div className={`coach-message-row ${message.role}`} key={`${message.role}-${index}`}>
              {message.role === 'coach' && <span className="coach-message-avatar" aria-hidden="true"><UserRound size={15} strokeWidth={2.35} /></span>}
              <div translate="no" className={message.role === 'coach' ? 'bubble coach' : 'bubble athlete'}>
                {message.role === 'coach' && <small className="coach-message-label">Coach</small>}
                <span>{message.text}</span>
              </div>
            </div>
          ))}
          {coachThinking && (
            <div className="coach-message-row coach">
              <span className="coach-message-avatar" aria-hidden="true"><UserRound size={15} strokeWidth={2.35} /></span>
              <div className="bubble coach thinking" aria-label="Coach is thinking">
                <small className="coach-message-label">Coach is thinking</small>
                <i /><i /><i />
              </div>
            </div>
          )}
        </section>}

        {coachStatus && <p className="coach-status">{coachStatus}</p>}
        {coachComposerFocused && (
          <div className="coach-composer-modebar">
            {messages.length === 0 && (
              <button onClick={dismissCoachComposer} type="button">
                <Sparkles size={14} />
                Quick starts
              </button>
            )}
            <button className="coach-composer-done" onClick={dismissCoachComposer} type="button">
              <ChevronDown size={15} />
              Done
            </button>
          </div>
        )}
        <div className="composer">
          <textarea
            ref={coachDraftRef}
            value={messageDraft}
            onChange={(event) => {
              setMessageDraft(event.target.value);
              resizeCoachDraft(event.currentTarget);
            }}
            onFocus={(event) => {
              setCoachComposerFocused(true);
              resizeCoachDraft(event.currentTarget);
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
            placeholder="What would you like to work on today?"
            enterKeyHint="send"
            rows={2}
          />
          <button className="icon-button dark" onClick={() => sendMessage()} aria-label="Send message" disabled={coachThinking || !messageDraft.trim()}>
            <Send size={18} />
          </button>
        </div>
        <div className="coach-private-note"><Shield size={13} /><span>Your conversations stay private.</span></div>
      </section>

      {coachHistoryOpen && (
        <div className="bottom-sheet-backdrop" role="presentation" onClick={() => setCoachHistoryOpen(false)}>
          <section className="bottom-sheet coach-history-sheet" role="dialog" aria-modal="true" aria-label="Conversation history" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-head">
              <div>
                <span>{coachSessions.length} saved</span>
                <strong>Recent Conversations</strong>
              </div>
              <button className="icon-button sheet-close" onClick={() => setCoachHistoryOpen(false)} type="button" aria-label="Close conversation history"><X size={18} /></button>
            </div>
            {coachSessions.length === 0 ? (
              <div className="coach-history-empty"><MessageCircle size={22} /><strong>No conversations yet</strong><span>Your saved coach conversations will appear here.</span></div>
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
          </section>
        </div>
      )}
    </div>
  );
}

function ParentStartToday({ authSession, completeParentFirstValue, trackAnalyticsEvent }) {
  const firstName = String(authSession?.name || 'Parent').trim().split(/\s+/)[0];
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const selectedPlan = parentStarterPlanRecommendations.find((plan) => plan.id === selectedPlanId);

  useEffect(() => {
    trackAnalyticsEvent?.('parent_first_value_viewed', {
      recommendationCount: parentStarterPlanRecommendations.length
    }, { area: 'activation' });
  }, []);

  function choosePlan() {
    if (!selectedPlan) return;
    localStorage.setItem(parentStarterPlanStorageKey, selectedPlan.id);
    trackAnalyticsEvent?.('parent_starter_plan_selected', {
      planId: selectedPlan.id,
      planTitle: selectedPlan.title
    }, { area: 'activation' });
    completeParentFirstValue(`parent_plan_selected:${selectedPlan.id}`);
  }

  return (
    <section className="parent-start-today" aria-label="Choose a recommended parent performance plan">
      <div className="parent-start-hero">
        <span>Start Here</span>
        <h1>Choose where to start.</h1>
        <p>{firstName}, pick the plan that would help your athlete most right now.</p>
      </div>
      <div className="parent-starter-plan-list" role="radiogroup" aria-label="Recommended parent plans">
        {parentStarterPlanRecommendations.map((plan) => {
          const selected = plan.id === selectedPlanId;
          return (
            <button
              aria-checked={selected}
              className={`parent-starter-plan${selected ? ' selected' : ''}`}
              key={plan.id}
              onClick={() => setSelectedPlanId(plan.id)}
              role="radio"
              type="button"
            >
              <span className="parent-starter-plan-icon"><BookOpen size={19} /></span>
              <span className="parent-starter-plan-copy">
                <small>{plan.category} · 3-Day Plan</small>
                <strong>{plan.title}</strong>
                <span>{plan.description}</span>
              </span>
              <span className="parent-starter-plan-check">{selected ? <Check size={16} /> : <ArrowRight size={16} />}</span>
            </button>
          );
        })}
      </div>
      <button className="primary-action full" disabled={!selectedPlan} onClick={choosePlan} type="button">
        {selectedPlan ? `Choose ${selectedPlan.title}` : 'Choose a Plan'} <ArrowRight size={18} />
      </button>
    </section>
  );
}

function MembershipCheckScreen() {
  return (
    <main className="trial-gate-shell">
      <section className="trial-gate-card membership-check-card" aria-live="polite">
        <span className="trial-kicker">The Complete Athlete</span>
        <h1>Welcome back</h1>
        <p>Opening your account...</p>
      </section>
    </main>
  );
}

function TrialPaywallScreen({
  athleteProfile,
  plans,
  planProgress,
  restorePremiumSubscription,
  role,
  startPremiumSubscription,
  subscription,
  trackAnalyticsEvent
}) {
  const paywallViewed = useRef(false);
  const product = subscription.package;
  const canRestore = subscription.configured && subscription.native;
  const expirationTime = new Date(subscription.expirationDate || '').getTime();
  const trialEnded = Number.isFinite(expirationTime) && expirationTime <= Date.now();
  const priceLine = product?.price
    ? `${product.price}/month${trialEnded ? '' : ' after trial'}`
    : `$5.99/month${trialEnded ? '' : ' after trial'}`;
  const challenges = athleteChallengesByIds(athleteProfile?.currentChallenges, athleteProfile?.currentChallenge);
  const planLibrary = buildPlanLibrary(sequencedPlanAccess(plans || [], planProgress || {}, todayKey()));
  const primaryChallenge = challenges[0];
  const recommendedPlan = planLibrary.find((series) => series.title === primaryChallenge.recommendedPlanTitle)
    ?? planLibrary.find((series) => {
      const text = `${series.title} ${series.tagline} ${series.category}`.toLowerCase();
      return primaryChallenge.planKeywords.some((keyword) => text.includes(keyword));
    })
    ?? planLibrary[0];
  const personalizedAthletePaywall = role === 'athlete' && !trialEnded;
  const personalizedParentPaywall = role === 'parent' && !trialEnded;
  const athleteFirstName = String(athleteProfile?.name || '').trim().split(/\s+/)[0];
  const displayAthleteFirstName = athleteFirstName
    ? `${athleteFirstName.charAt(0).toLocaleUpperCase()}${athleteFirstName.slice(1)}`
    : '';

  useEffect(() => {
    if (paywallViewed.current) return;
    paywallViewed.current = true;
    trackAnalyticsEvent?.('paywall_viewed', {
      context: personalizedAthletePaywall ? 'after_first_rep' : personalizedParentPaywall ? 'after_first_parent_rep' : trialEnded ? 'trial_expired' : 'membership_required',
      challengeIds: challenges.map((challenge) => challenge.id),
      recommendedPlan: recommendedPlan?.title || ''
    }, { area: 'monetization' });
    if (role === 'parent') {
      trackAnalyticsEvent?.('parent_paywall_viewed', {
        context: personalizedParentPaywall ? 'after_parent_recommendations' : trialEnded ? 'trial_expired' : 'membership_required'
      }, { area: 'monetization' });
    }
  }, [personalizedAthletePaywall, personalizedParentPaywall, role, trialEnded]);

  const title = trialEnded
    ? 'Your free trial has ended'
    : personalizedAthletePaywall
      ? 'Keep building the athlete you started becoming today.'
      : personalizedParentPaywall
        ? 'Keep building the athlete they’re becoming.'
      : 'Unlock The Complete Athlete';
  const roleLine = role === 'parent'
    ? personalizedParentPaywall
      ? 'Give your athlete daily mindset training and structure, with clear progress and parent guidance for you.'
      : 'Support your athlete with clear progress, parent guidance, and the full plan library.'
    : personalizedAthletePaywall
      ? `Your first rep is complete${displayAthleteFirstName ? `, ${displayAthleteFirstName}` : ''}. Now keep building the habits, mindset, and support system that move you forward.`
      : 'Keep your mindset training, daily discipline, and personalized plan moving forward.';

  function beginTrial() {
    trackAnalyticsEvent?.('trial_cta_tapped', {
      context: personalizedAthletePaywall ? 'after_first_rep' : personalizedParentPaywall ? 'after_first_parent_rep' : trialEnded ? 'trial_expired' : 'membership_required',
      recommendedPlan: recommendedPlan?.title || '',
      cta: trialEnded ? 'subscribe_to_continue' : 'start_7_day_trial'
    }, { area: 'monetization' });
    startPremiumSubscription();
  }

  return (
    <main className="trial-gate-shell">
      <section className="trial-gate-card">
        <span className="trial-kicker">{trialEnded ? 'Membership required' : personalizedAthletePaywall ? 'Your personalized path is ready' : personalizedParentPaywall ? 'Your parent support system is ready' : '7-day free trial'}</span>
        <h1>{title}</h1>
        <p>{roleLine}</p>

        {personalizedAthletePaywall && (
          <div className="paywall-plan-result">
            {recommendedPlan?.thumbnailImage && (
              <div
                className="paywall-plan-cover"
                style={{ backgroundImage: `linear-gradient(90deg, rgba(5, 12, 28, 0.1), rgba(5, 12, 28, 0.72)), url(${recommendedPlan.thumbnailImage})`, backgroundPosition: recommendedPlan.coverPosition }}
                aria-hidden="true"
              />
            )}
            <div>
              <span>Your next recommended plan</span>
              <strong>{recommendedPlan?.title || primaryChallenge.recommendedPlanTitle}</strong>
              <em>10 focused minutes a day</em>
            </div>
          </div>
        )}

        {role === 'parent' ? (
          <div className="trial-benefit-list outcome-list">
            <span><Brain size={18} />Build confidence, discipline, and resilience</span>
            <span><Target size={18} />Turn goals into consistent daily work</span>
            <span><LineChart size={18} />See progress without hovering</span>
            <span><BookOpen size={18} />Get simple parent guidance when needed</span>
          </div>
        ) : (
          <div className="trial-benefit-list outcome-list athlete-development-list" aria-label="Your athlete development progression">
            <span><BadgeCheck size={18} /><b>Build confidence through daily evidence</b></span>
            <span><RotateCcw size={18} /><b>Reset faster after mistakes and tough performances</b></span>
            <span><Target size={18} /><b>Stay disciplined when motivation fades</b></span>
            <span><Goal size={18} /><b>Set meaningful goals and turn them into daily action</b></span>
            <span><BookOpen size={18} /><b>Follow focused performance plans built around what you need most</b></span>
            <span><MessageCircle size={18} /><b>Get personal guidance from your AI performance coach</b></span>
            <span><Users size={18} /><b>Give your family a clear way to support your progress</b></span>
          </div>
        )}
        {!trialEnded && (
          <div className="trial-timeline" aria-label="Free trial timeline">
            <div><b>Today</b><span>{role === 'parent' ? 'Unlock parent guidance and every linked athlete dashboard' : 'Unlock your complete personalized plan'}</span></div>
            <div><b>Day 7</b><span>{priceLine.replace(' after trial', '')} begins unless canceled</span></div>
          </div>
        )}
        <div className="trial-price-card">
          <span>{trialEnded ? 'Keep building' : 'Start free today'}</span>
          <strong>{trialEnded ? priceLine : `7 days free, then ${priceLine.replace(' after trial', '')}`}</strong>
          <em>Cancel anytime through your Apple subscription settings.</em>
        </div>
        {subscription.message && <p className="inline-note">{subscription.message}</p>}
        <div className="trial-actions">
          <button
            className="primary-action full"
            disabled={subscription.loading}
            onClick={beginTrial}
            type="button"
          >
            <Sparkles size={18} />
            {subscription.loading ? 'Checking...' : trialEnded ? 'Subscribe to Continue' : 'Start My 7-Day Free Trial'}
          </button>
          <button
            className="secondary-action inline"
            disabled={!canRestore || subscription.loading}
            onClick={restorePremiumSubscription}
            type="button"
          >
            Restore Purchase
          </button>
        </div>
        <div className="trial-legal-links">
          <LegalLink href={LEGAL_URLS.terms}>Terms of Use</LegalLink>
          <LegalLink href={LEGAL_URLS.privacy}>Privacy Policy</LegalLink>
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
  const canRestore = subscription.configured && subscription.native;

  return (
    <section className={compact ? 'panel premium-panel compact' : 'panel premium-panel'}>
      <PanelTitle icon={<Sparkles size={18} />} title="Premium Access" action={statusLabel} />
      <div className="premium-status-row">
        <span>{subscription.active ? (coveredByParent ? 'Covered by parent' : 'Premium is active') : '7-day free trial'}</span>
        <strong>{subscription.active ? 'Unlocked' : priceLine}</strong>
      </div>
      <p className="privacy-note">
        Unlock the full Complete Athlete experience with plans, Daily Deposit and Today tools, goals, journal, parent access, and limited mindset coach messages.
      </p>
      <p className="subscription-terms-note">
        The Complete Athlete is $5.99/month after the 7-day free trial. Payment is charged to your Apple ID, renews monthly unless canceled at least 24 hours before renewal, and can be managed in Apple subscription settings.
      </p>
      <div className="premium-legal-links" aria-label="Subscription legal links">
        <LegalLink href={LEGAL_URLS.terms}>Terms of Use</LegalLink>
        <LegalLink href={LEGAL_URLS.privacy}>Privacy Policy</LegalLink>
      </div>
      {subscription.message && <p className="inline-note">{subscription.message}</p>}
      <div className="premium-actions">
        {!subscription.active && (
          <button
            className="primary-action full"
            disabled={subscription.loading}
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

function LegalLink({ href, children }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  useEffect(() => {
    if (open && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, [open]);
  return <>
    <a href={href} onClick={(event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      setOpen(true);
    }}>{children}</a>
    {open && <dialog ref={dialogRef} className="legal-document-dialog" aria-label={children}
      onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
      <header>
        <strong>{children}</strong>
        <button className="secondary-action inline" type="button" autoFocus onClick={() => setOpen(false)}>Close</button>
      </header>
      <iframe src={new URL(href).pathname} title={children} />
    </dialog>}
  </>;
}

function LegalAccountPanel({ deleteAccount, logoutUser, showAction = true, subscription }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const canRestore = subscription?.configured && subscription?.native;

  async function confirmDeleteAccount() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      setAccountMessage(subscription?.active
        ? 'Tap Delete Account again to permanently remove this account and app data. Apple billing is managed separately, so cancel your subscription in Apple settings if needed.'
        : 'Tap Delete Account again to permanently remove this account and app data.');
      return;
    }

    const message = await deleteAccount();
    if (message) {
      setAccountMessage(message);
      setConfirmingDelete(false);
    }
  }

  return (
    <section className="panel legal-account-panel">
      <PanelTitle icon={<Shield size={18} />} title="Legal & Account" action={showAction ? 'Review' : undefined} />
      <div className="legal-link-grid">
        <LegalLink href={LEGAL_URLS.privacy}>Privacy Policy</LegalLink>
        <LegalLink href={LEGAL_URLS.terms}>Terms of Use</LegalLink>
        <LegalLink href={LEGAL_URLS.support}>Support</LegalLink>
        <a href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noreferrer">Manage Subscription</a>
      </div>
      <p className="subscription-terms-note">
        Purchases are handled by Apple. The subscription is $5.99/month after the 7-day free trial and can be canceled in Apple subscription settings.
      </p>
      {!canRestore && <p className="privacy-note">Restore Purchase is available inside the iPhone app when Apple purchases are enabled.</p>}
      {accountMessage && <p className={confirmingDelete ? 'inline-warning' : 'inline-note'}>{accountMessage}</p>}
      <div className="account-danger-actions">
        <button className="secondary-action inline account-signout-button" onClick={logoutUser} type="button">
          Sign Out
        </button>
        <button className="danger-action inline" onClick={confirmDeleteAccount} type="button">
          {confirmingDelete ? 'Confirm Delete Account' : 'Delete Account'}
        </button>
      </div>
    </section>
  );
}

function ProfileScreen({ athleteProfile, athleteScore, athleteJourney, authSession, goals, plans, planProgress, setProfileView, streakCount }) {
  const planStats = planSeriesCompletion(plans, planProgress);
  const rank = athleteRankProgress(athleteScore);
  const first21 = journeyProgress(athleteJourney);
  const averageGoalProgress = goals.length
    ? Math.round(goals.reduce((total, goal) => total + Number(goal.progress || 0), 0) / goals.length)
    : 0;
  const ageAndState = [athleteProfile.age, athleteProfile.location].filter(Boolean).join(' | ') || 'Age | State';
  const navigation = [
    ['journal', 'My Journal', PenLine, 'Private reflections and game notes'],
    ['achievements', 'My Badges', Trophy, 'See the rewards your progress has unlocked'],
    ['settings', 'Settings', Shield, 'Account, notifications and privacy'],
    ['support', 'Help & Support', CircleHelp, 'Get help with your account']
  ];

  function openDestination(destination) {
    setProfileView(destination);
  }

  return (
    <>
      <section className="profile-head refreshed-profile-head">
        <div className="profile-avatar">
          {athleteProfile.photo ? <img src={athleteProfile.photo} alt="Athlete profile" /> : <span>{String(athleteProfile.name || authSession?.name || 'A').charAt(0)}</span>}
        </div>
        <div>
          <h2>{athleteProfile.name || authSession?.name || 'Athlete'}</h2>
          <span>{ageAndState}</span>
        </div>
      </section>
      <section className="profile-score-card athlete-rank-card">
        <div className="rank-badge-mark"><Trophy size={28} /></div>
        <div className="rank-current-copy"><span>Current rank</span><strong>{rank.current.name}</strong><p>{rank.current.identity}</p></div>
        <div className="rank-points-row"><strong>{athleteScore.toLocaleString()} PP</strong><span>{rank.next ? `${rank.remaining.toLocaleString()} PP to ${rank.next.name}` : 'Highest rank achieved'}</span></div>
        <div className="rank-progress-track"><i style={{ width: `${rank.percent}%` }}/></div>
        <div className="profile-score-meta">
          <span><strong>{streakCount}</strong>Day streak</span>
          <span><strong>{averageGoalProgress}%</strong>Goal progress</span>
          <span><strong>{planStats.completed}/{planStats.total}</strong>Plans complete</span>
          <span><strong>{first21.completed}/{first21.total || 21}</strong>Journey days</span>
        </div>
        <div className="rank-roadmap-shell">
          <div className="rank-roadmap" aria-label="All seven ranks. Swipe horizontally to see each rank." data-native-horizontal-scroll="true" tabIndex={0}>
            {athleteRanks.map((item, index) => (
              <span className={index < rank.currentIndex ? 'earned' : index === rank.currentIndex ? 'current' : 'locked'} key={item.name}>
                {index <= rank.currentIndex ? <Check size={12}/> : <LockKeyhole size={11}/>} {item.name}
              </span>
            ))}
          </div>
          <span className="rank-roadmap-hint">Swipe to see every rank <ChevronRight size={13} /></span>
        </div>
      </section>
      <section className="profile-menu" aria-label="Profile navigation">
        {navigation.map(([destination, label, Icon, description]) => (
          <button key={destination} onClick={() => openDestination(destination)} type="button">
            <span className="profile-menu-icon"><Icon size={20} /></span>
            <span><strong>{label}</strong><em>{description}</em></span>
            <ArrowRight size={18} />
          </button>
        ))}
      </section>
    </>
  );
}

function AthleteSupportScreen({ setProfileView }) {
  return (
    <>
      <button className="profile-subview-back" type="button" onClick={() => setProfileView('overview')}>← Back to Profile</button>
      <section className="panel athlete-support-screen">
        <PanelTitle icon={<CircleHelp size={18} />} title="Help & Support" action="We’re here" />
        <p>Need help with your account, parent access, notifications, subscriptions, or an app issue?</p>
        <a className="support-email-link" href="mailto:help@completeathlete.io">help@completeathlete.io</a>
        <div className="support-request-list">
          <span><strong>Password reset</strong>Use Reset Password on the login screen.</span>
          <span><strong>Parent access</strong>Find linking and access-code controls in Settings.</span>
          <span><strong>Notifications</strong>Manage app notifications in Settings or your device settings.</span>
          <span><strong>Subscriptions</strong>Manage billing through your Apple subscription settings.</span>
        </div>
      </section>
    </>
  );
}

function AthleteStatsScreen({ athleteScore, goals, plans, planProgress, standardsHistory, streakCount }) {
  const planStats = planSeriesCompletion(plans, planProgress);
  const completedActivities = standardsHistory.reduce((total, day) => total + Number(day.completed || 0), 0);
  const averageGoalProgress = goals.length ? Math.round(goals.reduce((sum, goal) => sum + Number(goal.progress || 0), 0) / goals.length) : 0;
  return (
    <section className="stats-dashboard">
      <div className="stats-hero"><span>Performance Points</span><strong>{athleteScore} PP</strong><p>Evidence of work built through daily activity, goals, plans, and reflection.</p></div>
      <div className="stats-grid">
        <article><BadgeCheck size={22}/><strong>{completedActivities}</strong><span>Activities completed</span></article>
        <article><Target size={22}/><strong>{averageGoalProgress}%</strong><span>Average goal progress</span></article>
        <article><BookOpen size={22}/><strong>{planStats.completed}</strong><span>Plans completed</span></article>
        <article><Sparkles size={22}/><strong>{streakCount}</strong><span>Current day streak</span></article>
      </div>
    </section>
  );
}

function athleteBadgeGroups({ gameDaySessions = [], goals, journalEntries, plans, planProgress, standards, standardsHistory, streakCount }) {
  const completedActivities = standardsHistory.reduce((total, day) => total + Number(day.completed || 0), 0);
  const completedLessons = Object.values(planProgress).filter(Boolean).length;
  const planSeries = buildPlanLibrary(plans);
  const completedSeries = planSeries.filter((series) => series.plans.length > 0 && series.plans.every((plan) => Boolean(planProgress[String(plan.id)])));
  const completedPlans = completedSeries.length;
  const completedSeriesNames = completedSeries.map((series) => series.title.toLowerCase());
  const linkedGoal = goals.some((goal) => standards.some((standard) => String(standard.goalId) === String(goal.id)));
  const closerEarned = standardsHistory.some((day) => day.total > 0 && day.completed >= day.total);
  const latestSevenDays = [...standardsHistory].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 7);
  const latestSevenDates = new Set(latestSevenDays.map((day) => day.date));
  const latestLabels = latestSevenDays.flatMap((day) => day.standards || []).filter((item) => item.done).map((item) => String(item.label || '').toLowerCase());
  const allAroundEarned = latestLabels.some((label) => /train|practice|workout/.test(label))
    && latestLabels.some((label) => /recover|stretch|sleep|rest/.test(label))
    && latestLabels.some((label) => /school|study|homework|class/.test(label))
    && journalEntries.some((entry) => latestSevenDates.has(entry.date));
  const leadershipEarned = standardsHistory.some((day) => (day.standards || []).some((item) => (
    item.done && /lead|captain|accountab|encourag|help.*team|team.*help/i.test(item.label || '')
  )));
  const seriesComplete = (...needles) => completedSeriesNames.some((title) => needles.some((needle) => title.includes(needle)));
  const badgeGroups = [
    ['Discipline', [
      ['Locked In', 'You showed up for a full week. Consistency is becoming part of who you are.', streakCount >= 7, Math.min(streakCount, 7), 7, '7-Day Streak'],
      ['No Days Off', 'Thirty straight days of intentional action.', streakCount >= 30, Math.min(streakCount, 30), 30, '30-Day Streak'],
      ['Relentless', 'You kept showing up long after the excitement wore off.', streakCount >= 60, Math.min(streakCount, 60), 60, '60-Day Streak'],
      ['Built Different', 'One hundred days of consistency. Your habits are separating you.', streakCount >= 100, Math.min(streakCount, 100), 100, '100-Day Streak'],
      ['Unshakeable', 'Discipline has become part of your identity.', streakCount >= 180, Math.min(streakCount, 180), 180, '180-Day Streak'],
      ['365 Strong', 'You showed up for an entire year. Consistency is now part of who you are.', streakCount >= 365, Math.min(streakCount, 365), 365, '365-Day Streak']
    ]],
    ['Work Ethic', [
      ['Extra Work', 'You did more than what was required.', completedActivities >= 25, Math.min(completedActivities, 25), 25, 'Activities'],
      ['Blue Collar', 'Quiet work. Repeated effort. Real progress.', completedActivities >= 100, Math.min(completedActivities, 100), 100, 'Activities'],
      ['Workhorse', "You've built a serious body of work.", completedActivities >= 250, Math.min(completedActivities, 250), 250, 'Activities'],
      ['Obsessed', 'Your actions prove how serious you are about getting better.', completedActivities >= 500, Math.min(completedActivities, 500), 500, 'Activities']
    ]],
    ['Mindset', [
      ['Student of the Game', 'You started training the part of the game most athletes ignore.', completedPlans >= 1, Math.min(completedPlans, 1), 1, 'Plans'],
      ['Mental Edge', 'Ten lessons invested into your mental game.', completedLessons >= 10, Math.min(completedLessons, 10), 10, 'Lessons'],
      ['Film Room', "You're learning to study yourself, not just your opponent.", journalEntries.length >= 20, Math.min(journalEntries.length, 20), 20, 'Reflections'],
      ['Reset Ready', 'You learned how to reset instead of letting one moment control the next.', seriesComplete('next play', 'emotional control'), seriesComplete('next play', 'emotional control') ? 1 : 0, 1, 'Plan'],
      ['Uncommon Confidence', "You're learning to build confidence instead of waiting to feel it.", seriesComplete('confidence code'), seriesComplete('confidence code') ? 1 : 0, 1, 'Plan'],
      ['Boring Wins', 'You understand that greatness is built through repeated ordinary actions.', seriesComplete('boring wins'), seriesComplete('boring wins') ? 1 : 0, 1, 'Plan'],
      ['Focused', 'You trained your ability to put your attention where it matters.', seriesComplete('focus', 'lock in'), seriesComplete('focus', 'lock in') ? 1 : 0, 1, 'Plan'],
      ['Coachable', 'You learned how to receive coaching, criticism, and correction without losing yourself.', seriesComplete('coachable athlete'), seriesComplete('coachable athlete') ? 1 : 0, 1, 'Plan']
    ]],
    ['Milestone', [
      ['Goal Getter', 'You turned a dream into something you can work toward today.', goals.length > 0 && linkedGoal, goals.length > 0 && linkedGoal ? 1 : 0, 1, 'Goal + Link'],
      ['Closer', 'You finished what you said you were going to do.', closerEarned, closerEarned ? 1 : 0, 1, 'Perfect Day'],
      ['Finisher', 'Starting matters. Finishing separates you.', completedPlans >= 5, Math.min(completedPlans, 5), 5, 'Plans'],
      ['The 90%', 'You trained the part of performance most athletes leave untouched.', seriesComplete('90%', 'ninety percent', 'athletic operating system'), seriesComplete('90%', 'ninety percent', 'athletic operating system') ? 1 : 0, 1, 'Plan'],
      ['All Around', 'Complete athletes develop more than one part of themselves.', allAroundEarned, allAroundEarned ? 1 : 0, 1, '7-Day Mix'],
      ['Leader', 'Leadership begins with the standard you live by.', leadershipEarned, leadershipEarned ? 1 : 0, 1, 'Leadership Action']
    ]]
  ];
  const gameDayCounts = gameDayBadgeCounts(gameDaySessions);
  badgeGroups.push(['Game Day', [
    ['Game Ready', 'You prepared your mind before competition.', gameDayCounts.pregame >= 1, Math.min(gameDayCounts.pregame, 1), 1, 'Routine', 'Complete your first full Game Day pregame routine.'],
    ['Game Day Veteran', 'Mental preparation has become part of how you compete.', gameDayCounts.pregame >= 5, Math.min(gameDayCounts.pregame, 5), 5, 'Routines', 'Complete 5 full Game Day pregame routines.']
  ]]);
  const lockedDays = new Set(standardsHistory.map((day) => day.date)).size;
  const completedGoals = goals.filter((goal) => Number(goal.progress) >= 100).length;
  const requirements = [
    [lockedDays, 365, 'total days locked in'],
    [completedPlans, 10, 'Performance Plans completed'],
    [completedGoals, 20, 'goals accomplished']
  ];
  const completeAthleteProgress = requirements.filter(([value, target]) => value >= target).length;
  badgeGroups.push(['Prestige', [
    ['Complete Athlete', "You're building the habits, mindset, and standards of a complete athlete.", completeAthleteProgress === 3, completeAthleteProgress, 3, 'requirements', requirements.map(([value, target, label]) => `${Math.min(value, target)} / ${target} ${label}`).join(' • ')]
  ]]);
  const specific = {
    'Reset Ready': 'Complete every day of Next Play or an emotional-control plan.',
    'Uncommon Confidence': 'Complete every day of The Confidence Code.',
    'Boring Wins': 'Complete every day of Boring Wins.',
    Focused: 'Complete every day of a Focus or Lock In plan.',
    Coachable: 'Complete every day of The Coachable Athlete.',
    'Goal Getter': 'Create a goal and link a daily activity to it.',
    Closer: 'Complete every planned activity, then lock in that day.',
    'The 90%': 'Complete the entire 90% / Athletic Operating System series.',
    'All Around': 'Within seven days, complete Training, Recovery, Schoolwork and save a journal reflection.',
    Leader: 'Complete and lock in an activity about leadership, accountability or helping your team.'
  };
  badgeGroups.forEach(([family, badges]) => badges.forEach((badge) => {
    if (badge[6]) return;
    badge[6] = specific[badge[0]] || (family === 'Discipline' ? `Lock in your day ${badge[4]} days in a row.` : `Complete ${badge[4]} ${badge[5].toLowerCase()}${badge[5] === 'Plans' ? ' (all days in each plan)' : ''}.`);
    if (badge[5] === 'Reflections') badge[6] = `Save ${badge[4]} journal reflections.`;
    if (badge[5] === 'Activities') badge[6] = `Complete ${badge[4]} daily activities and lock in those days.`;
  }));
  return badgeGroups;
}

function AchievementsScreen({ goals, journalEntries, plans, planProgress, standards, standardsHistory, streakCount, setProfileView, userId }) {
  const [achievementFilter, setAchievementFilter] = useState('All');
  const badgeGroups = athleteBadgeGroups({ gameDaySessions: loadGameDaySessions(userId), goals, journalEntries, plans, planProgress, standards, standardsHistory, streakCount });
  const earned = badgeGroups.flatMap(([, badges]) => badges).filter((badge) => badge[2]).length;

  return (
    <>
      <button className="profile-subview-back" type="button" onClick={() => setProfileView?.('overview')}>← My Profile</button>
      <section className="achievement-summary"><Trophy size={28}/><div><strong>{earned}</strong><span>badges earned</span></div><p>Your work becomes visible here.</p></section>
      <div className="achievement-filters" aria-label="Filter achievements">
        {['All', ...badgeGroups.map(([group]) => group)].map((filter) => <button className={achievementFilter === filter ? 'active' : ''} key={filter} onClick={() => setAchievementFilter(filter)} type="button">{filter}</button>)}
      </div>
      {badgeGroups.filter(([group]) => achievementFilter === 'All' || group === achievementFilter).map(([group, badges]) => (
        <section className="achievement-group" key={group}>
          <h2>{group}</h2>
          <div className="achievement-grid">
            {badges.map(([name, description, unlocked, value, target, criteria, requirement]) => (
              <article className={`${unlocked ? 'achievement-card unlocked' : 'achievement-card'} family-${group.toLowerCase().replace(/\s+/g, '-')}${target == null ? ' undefined-progress' : ''}`} key={name}>
                <span className="achievement-shield">{unlocked ? <Trophy size={24}/> : <LockKeyhole size={20}/>}</span>
                <strong>{name}</strong><p>{description}</p><p className="badge-requirement"><b>How to earn</b><br />{requirement}</p>
                {!unlocked && target != null && <><Progress value={Math.round((value / target) * 100)} /><em>{value} / {target} {criteria}</em></>}
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function AthleteSettingsScreen({
  authSession,
  athleteProfile,
  athleteParentAccessDraft,
  athleteParentLinkFeedback,
  deleteAccount,
  linkAthleteParentAccessCode,
  language,
  logoutUser,
  notificationPreferences,
  persistAthleteProfile,
  privacySettings,
  requestBrowserNotifications,
  restorePremiumSubscription,
  setAthleteParentAccessDraft,
  setAthleteParentLinkFeedback,
  setAthleteProfile,
  setLanguage,
  setNotificationPreferences,
  setPrivacySettings,
  startPremiumSubscription,
  subscription,
  updateNotificationPreference,
  setProfileView
}) {
  const [shareFeedback, setShareFeedback] = useState('');
  const [profileSaveFeedback, setProfileSaveFeedback] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [openProfileSections, setOpenProfileSections] = useState({ notifications: false, privacy: false });
  const accountEmail = authSession?.email || 'No email found';

  function updateAthleteProfile(field, value) {
    setAthleteProfile((current) => ({ ...current, [field]: value }));
  }

  async function commitProfile(nextProfile, successMessage = 'Profile saved.') {
    setProfileSaving(true);
    setProfileSaveFeedback('Saving...');
    const error = await persistAthleteProfile(nextProfile);
    setProfileSaving(false);
    setProfileSaveFeedback(error || successMessage);
  }

  async function updatePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setProfileSaveFeedback('Preparing photo...');
      const prepared = await prepareProfilePhoto(file);
      let photo = prepared.preview;

      if (isSupabaseConfigured && isSupabaseId(authSession?.id)) {
        const path = `${authSession.id}/profile.jpg`;
        const { error } = await supabase.storage
          .from('athlete-profile-photos')
          .upload(path, prepared.file, { cacheControl: '3600', contentType: 'image/jpeg', upsert: true });

        if (!error) {
          const { data } = supabase.storage.from('athlete-profile-photos').getPublicUrl(path);
          photo = `${data.publicUrl}?v=${Date.now()}`;
        }
      }

      const nextProfile = { ...athleteProfile, photo };
      setAthleteProfile(nextProfile);
      await commitProfile(nextProfile, 'Profile photo saved.');
    } catch {
      setProfileSaveFeedback('Photo could not be added. Choose a different image.');
    } finally {
      event.target.value = '';
    }
  }

  async function saveProfileDetails() {
    await commitProfile(athleteProfile);
  }

  async function removeProfilePhoto() {
    const nextProfile = { ...athleteProfile, photo: '' };
    setAthleteProfile(nextProfile);
    await commitProfile(nextProfile, 'Profile photo removed.');
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
      <button className="profile-subview-back" type="button" onClick={() => setProfileView?.('overview')}>← Back to Profile</button>
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
        <div className="photo-actions">
          <label className="photo-upload">
            <Camera size={18} />
            Choose Photo
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={updatePhoto} />
          </label>
          {athleteProfile.photo && (
            <button className="secondary-action inline" onClick={removeProfilePhoto} type="button">
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
        <button className="primary-action full" disabled={profileSaving} onClick={saveProfileDetails} type="button">
          <Check size={18} />
          {profileSaving ? 'Saving Profile...' : 'Save Profile'}
        </button>
        {profileSaveFeedback && <p className="inline-note" role="status">{profileSaveFeedback}</p>}
      </section>
      <LegalAccountPanel deleteAccount={deleteAccount} logoutUser={logoutUser} subscription={subscription} />
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
                <span>Inactivity reminders</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.inactivityReminders}
                  onChange={(event) => updateNotificationPreference('inactivityReminders', event.target.checked)}
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
                <span>Daily activity tracker visible to parent</span>
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

function ParentAthleteSwitcher({ athletes, selectedAthleteId, onSelect }) {
  if (!athletes.length) return null;
  const selected = athletes.find((athlete) => athlete.athlete_user_id === selectedAthleteId) ?? athletes[0];
  return (
    <section className="parent-athlete-switcher" aria-label="Choose an athlete">
      <div className="parent-athlete-switcher-head">
        <div><span>Viewing athlete</span><strong>{selected?.full_name || 'Linked athlete'}</strong></div>
        <small>{athletes.length} linked</small>
      </div>
      <div className="parent-athlete-options">
        {athletes.map((athlete) => {
          const active = athlete.athlete_user_id === selectedAthleteId;
          const details = [athlete.age, athlete.location].filter(Boolean).join(' | ') || athlete.sport || 'Athlete';
          return (
            <button className={active ? 'active' : ''} key={athlete.athlete_user_id} onClick={() => onSelect(athlete.athlete_user_id)} type="button">
              <span className="parent-athlete-initial">{String(athlete.full_name || 'A').charAt(0)}</span>
              <span><strong>{athlete.full_name || 'Linked athlete'}</strong><em>{details}</em></span>
              {active && <BadgeCheck size={18} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ParentSettingsScreen({
  athleteName,
  authSession,
  deleteAccount,
  linkedAthletes,
  linkedAthleteSummary,
  linkParentAccessCode,
  language,
  logoutUser,
  notificationPreferences,
  parentAccessDraft,
  parentGuides,
  parentLinkFeedback,
  planSeriesStats,
  requestBrowserNotifications,
  setParentAccessDraft,
  setParentLinkFeedback,
  setLanguage,
  subscription,
  unlinkParentAthlete,
  updateNotificationPreference,
  requestMilestoneReview
}) {
  const [parentNotificationsOpen, setParentNotificationsOpen] = useState(true);
  const [familyAccessFeedback, setFamilyAccessFeedback] = useState('');
  const parentName = authSession?.name || 'Parent';
  const parentEmail = authSession?.email || 'No email found';
  const familyAccessCode = authSession?.parentAccessCode || 'TCA-FAMILY';

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
      <section className="profile-head refreshed-profile-head parent-settings-head">
        <div className="profile-avatar parent-profile-avatar">
          <span>{String(parentName).charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <p className="eyebrow">Parent Profile</p>
          <h2>{parentName}</h2>
          <span>{linkedAthleteSummary ? `${linkedAthletes.length} athlete${linkedAthletes.length === 1 ? '' : 's'} linked | Viewing ${athleteName}` : 'Not linked yet'}</span>
        </div>
      </section>

      <section className="panel parent-account-panel">
        <PanelTitle icon={<UserRound size={18} />} title="Account" />
        <div className="account-email-card parent-account-card">
          <span>Registered email</span>
          <strong>{parentEmail}</strong>
        </div>
        <div className="parent-access-code-card parent-family-access-card">
          <div className="parent-family-access-head">
            <span className="parent-family-access-icon"><Users size={20} /></span>
            <div>
              <span>Family access</span>
              <strong>{linkedAthleteSummary ? `Connected to ${athleteName}` : 'Connect your athlete'}</strong>
            </div>
            <em className={linkedAthleteSummary ? 'connected' : ''}>{linkedAthleteSummary ? 'Connected' : 'Ready'}</em>
          </div>
          <div className="parent-family-access-route">
            <div className="family-access-option">
              <span>Link with an athlete code</span>
              <p>Enter the code from your athlete’s profile to see their progress here.</p>
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
                {linkedAthleteSummary ? 'Add Athlete' : 'Connect'}
              </button>
            </form>
          </div>
          <div className="family-access-divider parent-family-access-divider" aria-hidden="true">
            <span>or share your family code</span>
          </div>
          <div className="parent-family-access-route share-code-route">
            <div className="family-access-option">
              <span>Invite through your membership</span>
              <p>Your athlete can enter this code while creating their account.</p>
            </div>
            <div className="family-access-code-display">
              <strong>{familyAccessCode}</strong>
              <button className="secondary-action inline family-invite-button" onClick={copyFamilyAccessCode} type="button">
                <Copy size={18} />
                Copy Code
              </button>
            </div>
          </div>
          {(parentLinkFeedback || familyAccessFeedback) && <p className="inline-note">{parentLinkFeedback || familyAccessFeedback}</p>}
          {linkedAthletes.some((athlete) => !String(athlete.athlete_user_id).startsWith('local-')) && (
            <div className="parent-linked-athlete-list">
              <span>Linked athletes</span>
              {linkedAthletes.map((athlete) => (
                <div key={athlete.athlete_user_id}>
                  <strong>{athlete.full_name || 'Linked athlete'}</strong>
                  {!String(athlete.athlete_user_id).startsWith('local-') && (
                    <button className="ghost-action inline" onClick={() => unlinkParentAthlete(athlete.athlete_user_id, athlete.full_name || 'this athlete')} type="button">
                      Remove access
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
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
                <span>Inactivity reminders</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.inactivityReminders}
                  onChange={(event) => updateNotificationPreference('inactivityReminders', event.target.checked)}
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

      <LegalAccountPanel deleteAccount={deleteAccount} logoutUser={logoutUser} showAction={false} subscription={subscription} />
    </>
  );
}

function ParentDashboard({
  parentTab,
  authSession,
  athleteScore,
  athleteProfile,
  deleteAccount,
  goals,
  journalEntries,
  language,
  lesson,
  linkedAthletes,
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
  requestMilestoneReview,
  restorePremiumSubscription,
  setParentAccessDraft,
  setParentLinkFeedback,
  setLanguage,
  setPlanProgress,
  selectLinkedAthlete,
  startPremiumSubscription,
  standardsCompleted,
  standardsHistory,
  standardsTotal,
  subscription,
  unlinkParentAthlete,
  updateNotificationPreference
}) {
  const planSeriesStats = planSeriesCompletion(plans, planProgress);
  const weeklySnapshot = weeklyParentSnapshot({ standardsHistory, readinessHistory, journalEntries, pointsLedger, planProgress });
  const currentPlan = parentCurrentPlanSummary(plans, planProgress);
  const athleteName = linkedAthleteName(linkedAthleteSummary, athleteProfile);
  const selectedAthleteStreak = streakFromStandardsHistory(standardsHistory);
  const [actionFeedback, setActionFeedback] = useState('');
  const athleteFirstName = String(athleteName || 'Athlete').trim().split(/\s+/)[0] || 'Athlete';
  const athleteMeta = [
    athleteProfile?.sport,
    athleteProfile?.age ? `Age ${athleteProfile.age}` : ''
  ].filter(Boolean).join(' • ');
  const currentPlanPercent = currentPlan.totalCount
    ? Math.round((currentPlan.completedCount / currentPlan.totalCount) * 100)
    : 0;
  const scoreSignalSegments = linkedAthleteId
    ? Math.min(5, Math.max(0, Math.ceil(Number(athleteScore || 0) / 100)))
    : 0;

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

  if (!parentLinkChecked && parentTab === 'overview') {
    return (
      <section className="panel parent-access-panel">
        <PanelTitle icon={<Users size={18} />} title="Parent Access" action="Checking" />
        <p className="empty-note">Checking your athlete connection...</p>
      </section>
    );
  }

  return (
    <div className={parentTab === 'overview' ? 'parent-dashboard-overview' : 'parent-dashboard-subscreen'}>
      {parentTab === 'settings' && linkedAthletes.length > 0 && (
        <ParentAthleteSwitcher
          athletes={linkedAthletes}
          selectedAthleteId={linkedAthleteId}
          onSelect={selectLinkedAthlete}
        />
      )}
      {parentTab === 'overview' && (
        <>
          <section className="parent-athlete-snapshot" aria-label={`Viewing ${athleteName}`}>
            <div className="parent-athlete-avatar" aria-hidden="true">
              {athleteProfile?.photo ? <img src={athleteProfile.photo} alt="" /> : <span>{athleteFirstName.charAt(0)}</span>}
            </div>
            <div>
              <span>Your athlete</span>
              <strong>{linkedAthleteId ? athleteFirstName : 'No athlete linked'}</strong>
              {linkedAthleteId && athleteMeta && <p>{athleteMeta}</p>}
            </div>
            <div className={`parent-athlete-status${linkedAthleteId ? ' connected' : ''}`}><i />{linkedAthleteId ? 'Connected' : 'Link needed'}</div>
          </section>

          {!linkedAthleteId && (
            <section className="parent-dashboard-card parent-link-card">
              <div className="parent-dashboard-section-label"><Users size={16} /> Link athlete</div>
              <p>Enter the parent access code from your athlete’s profile or invitation.</p>
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
                <button className="primary-action" type="submit">Link Athlete</button>
              </form>
              {parentLinkFeedback && <p className="inline-note">{parentLinkFeedback}</p>}
            </section>
          )}

          <section className="panel daily-deposit-panel today-page-hero parent-daily-deposit-card">
            <PanelTitle icon={<Brain size={18} />} title="Daily Deposit" />
            <div className="today-hero-copy parent-daily-deposit-copy">
              {lesson.title && <h2>{lesson.title}</h2>}
              <p>{lesson.body}</p>
            </div>
          </section>

          <section className="parent-score-hero" aria-labelledby="parent-score-title">
            <div className="parent-score-heading">
              <div>
                <span id="parent-score-title">Performance Points</span>
                <small>Overall development signal</small>
              </div>
              <BarChart3 size={20} aria-hidden="true" />
            </div>
            <div className="parent-score-value-row">
              <strong>{linkedAthleteId ? athleteScore : '—'}</strong>
              <div className="parent-score-signal" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((segment) => <i className={segment < scoreSignalSegments ? 'active' : ''} key={segment} />)}
              </div>
            </div>
            <p>{linkedAthleteId ? parentProgressTone(weeklySnapshot, selectedAthleteStreak) : 'Link your athlete to see their progress.'}</p>
          </section>

          <section className="parent-dashboard-metrics" aria-label="Athlete progress metrics">
            <div><i><Flame size={16} /></i><strong>{linkedAthleteId ? selectedAthleteStreak : '—'}</strong><span>Day streak</span></div>
            <div><i><Target size={16} /></i><strong>{linkedAthleteId ? `${weeklySnapshot.productivityAverage}%` : '—'}</strong><span>7-day work rate</span></div>
            <div><i><BookOpen size={16} /></i><strong>{linkedAthleteId ? `${planSeriesStats.completed}/${planSeriesStats.total}` : '—'}</strong><span>Plans completed</span></div>
          </section>

          <section className="parent-dashboard-card parent-plan-focus-card">
            <div className="parent-dashboard-section-label"><BookOpen size={16} /> Your Athlete’s Current Plan</div>
            {linkedAthleteId ? (
              <div className="parent-plan-focus-content">
                <div className="parent-plan-focus-icon" aria-hidden="true"><BookOpen size={23} /></div>
                <div className="parent-plan-focus-copy">
                  <span>{currentPlan.seriesTitle}</span>
                  <strong>{currentPlan.lessonTitle}</strong>
                  <div className="parent-plan-progress-meta"><span>{currentPlan.completedCount} / {currentPlan.totalCount} lessons completed</span><b>{currentPlanPercent}%</b></div>
                  <div className="parent-plan-progress-track" aria-label={`${currentPlanPercent}% complete`}><i style={{ width: `${currentPlanPercent}%` }} /></div>
                  {currentPlan.nextUnlock && <em>Next lesson opens {currentPlan.nextUnlock}.</em>}
                </div>
              </div>
            ) : <p className="parent-dashboard-empty">Link your athlete to see what they are actively working through.</p>}
          </section>

          <section className="parent-support-today" aria-labelledby="parent-support-title">
            <div className="parent-dashboard-heading">
              <span>Parent coaching</span>
              <h2 id="parent-support-title">How to support today</h2>
            </div>
            <div className="parent-support-nudges">
              <button disabled={!linkedAthleteId} onClick={() => sendParentEncouragement('effort')} type="button">
                <i><BadgeCheck size={17} /></i><span><strong>Encourage effort</strong><small>Reinforce the work, not just the result.</small></span><ChevronRight size={17} />
              </button>
              <button disabled={!linkedAthleteId} onClick={() => sendParentEncouragement('plan')} type="button">
                <i><BookOpen size={17} /></i><span><strong>Talk through the plan</strong><small>Use today’s lesson as the bridge.</small></span><ChevronRight size={17} />
              </button>
              <button disabled={!linkedAthleteId} onClick={() => sendParentEncouragement('goals')} type="button">
                <i><Goal size={17} /></i><span><strong>Reconnect the goal</strong><small>Ask which action supports the goal they chose.</small></span><ChevronRight size={17} />
              </button>
            </div>
            {actionFeedback && <p className="parent-action-feedback">{actionFeedback}</p>}
          </section>

          {linkedAthleteId && privacySettings.goalsVisible && (
            <section className="parent-dashboard-card parent-dashboard-goals">
              <div className="parent-dashboard-section-label"><Goal size={16} /> Goal snapshot <em>{goals.length} goals</em></div>
              <div className="parent-goals">
                {goals.slice(0, 3).map((goal) => (
                  <span key={goal.id}><strong>{goal.label}</strong>{goal.progress}%</span>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {parentTab === 'settings' && (
        <ParentSettingsScreen
          athleteName={athleteName}
          authSession={authSession}
          deleteAccount={deleteAccount}
          linkParentAccessCode={linkParentAccessCode}
          linkedAthletes={linkedAthletes}
          linkedAthleteSummary={linkedAthleteSummary}
          language={language}
          logoutUser={logoutUser}
          notificationPreferences={notificationPreferences}
          parentAccessDraft={parentAccessDraft}
          parentGuides={parentGuides}
          parentLinkFeedback={parentLinkFeedback}
          planSeriesStats={planSeriesStats}
          requestBrowserNotifications={requestBrowserNotifications}
          setParentAccessDraft={setParentAccessDraft}
          setParentLinkFeedback={setParentLinkFeedback}
          setLanguage={setLanguage}
          subscription={subscription}
          unlinkParentAthlete={unlinkParentAthlete}
          updateNotificationPreference={updateNotificationPreference}
        />
      )}

      {parentTab === 'parent-corner' && !linkedAthleteId && !premiumAccessAllowed && (
        <ParentCornerSection language={language} parentGuides={parentGuides} parentMessage={parentMessage} requestMilestoneReview={requestMilestoneReview} />
      )}
      {parentTab === 'parent-corner' && (
        premiumAccessAllowed ? (
          <>
            <ParentCornerSection language={language} parentGuides={parentGuides} parentMessage={parentMessage} requestMilestoneReview={requestMilestoneReview} />
            <ParentPlanLibrary language={language} plans={plans} planProgress={planProgress} setPlanProgress={setPlanProgress} notifyUser={notifyUser} requestMilestoneReview={requestMilestoneReview} />
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

    </div>
  );
}

function ParentCornerSection({ language = 'en', parentGuides = [], parentMessage, requestMilestoneReview }) {
  const [selectedParentContentId, setSelectedParentContentId] = useState(() => (
    localStorage.getItem(parentStarterPlanStorageKey) || ''
  ));
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
      coverImage: parentGuideCoverImage(guide.seriesTitleEn || guide.seriesTitle),
      thumbnailImage: parentGuideThumbnailImage(guide.seriesTitleEn || guide.seriesTitle),
      coverPosition: parentGuideCoverPosition(guide.seriesTitleEn || guide.seriesTitle),
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
  const selectedGuideSteps = selectedContent?.steps ?? [];
  const selectedGuideDayCount = selectedGuideSteps.length;
  const completedGuideDays = selectedContent?.completedAt
    ? selectedGuideDayCount
    : selectedGuideSteps.reduce((count, step, index) => (
      parentGuideProgress[`${selectedContent.id}:day:${index + 1}`] ? count + 1 : count
    ), 0);
  const activeGuideDayIndex = selectedGuideDayCount
    ? Math.min(completedGuideDays, selectedGuideDayCount - 1)
    : 0;
  const activeGuideDayCompleted = Boolean(
    selectedContent?.completedAt
    || parentGuideProgress[`${selectedContent?.id}:day:${activeGuideDayIndex + 1}`]
  );

  useEffect(() => {
    localStorage.setItem(parentGuideProgressStorageKey, JSON.stringify(parentGuideProgress));
  }, [parentGuideProgress]);

  function completeParentGuideDay(guideId, dayIndex, dayCount) {
    setParentGuideProgress((current) => {
      const dayKey = `${guideId}:day:${dayIndex + 1}`;
      if (current[dayKey]) return current;
      const next = {
        ...current,
        [dayKey]: todayKey()
      };
      if (dayIndex + 1 >= dayCount) next[String(guideId)] = todayKey();
      return next;
    });
    if (dayIndex === 0) {
      window.setTimeout(() => requestMilestoneReview?.('parent_day_one_plan'), 500);
    }
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
          {selectedGuideDayCount ? (
            <>
              <div className="parent-guide-day-status">
                <span>Day {activeGuideDayIndex + 1} of {selectedGuideDayCount}</span>
                <Progress value={Math.round((completedGuideDays / selectedGuideDayCount) * 100)} />
                <p>{selectedContent.completedAt ? 'Plan complete' : 'Complete this day to unlock the next one.'}</p>
              </div>
              <PlanEpisode
                language={language}
                steps={[selectedGuideSteps[activeGuideDayIndex]]}
                planId={`${selectedContent.id}-day-${activeGuideDayIndex + 1}`}
                planTitle={selectedContent.title}
                preserveHeadings
              />
            </>
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
            className={activeGuideDayCompleted ? 'secondary-action submitted parent-guide-complete' : 'secondary-action parent-guide-complete'}
            disabled={activeGuideDayCompleted}
            onClick={() => completeParentGuideDay(selectedContent.id, activeGuideDayIndex, Math.max(selectedGuideDayCount, 1))}
            type="button"
          >
            <Check size={16} />
            {selectedContent.completedAt
              ? 'Plan Completed'
              : activeGuideDayCompleted
                ? `Day ${activeGuideDayIndex + 1} Completed`
                : selectedGuideDayCount
                  ? `Complete Day ${activeGuideDayIndex + 1}`
                  : 'Mark as Complete'}
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

function ParentPlanLibrary({ language = 'en', plans, planProgress, setPlanProgress, notifyUser, requestMilestoneReview }) {
  const today = todayKey();
  const sequencedPlans = parentSequencedPlanAccess(plans, planProgress, today);
  const planLibrary = buildPlanLibrary(sequencedPlans);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [selectedSeriesId, setSelectedSeriesId] = useState('');
  const selectedSeries = planLibrary.find((series) => series.id === selectedSeriesId) ?? null;
  const selectedPlan = selectedSeries?.plans.find((plan) => plan.unlocked && !plan.completedAt)
    ?? [...(selectedSeries?.plans ?? [])].reverse().find((plan) => plan.completedAt)
    ?? selectedSeries?.plans[0]
    ?? null;
  const openSeriesCount = planLibrary.filter((series) => series.openCount > 0).length;
  const completedSeriesCount = planLibrary.filter((series) => series.completedCount === series.plans.length).length;

  function completeParentPlan(planId) {
    const plan = sequencedPlans.find((item) => String(item.id) === String(planId));
    if (!plan?.unlocked || plan.completedAt || !setPlanProgress) return;

    setPlanProgress((current) => ({
      ...current,
      [String(planId)]: today
    }));
    notifyUser?.('Day complete', 'The next day is now ready.', 'success', {
      type: 'planUnlocks',
      id: `parent-plan-complete-${planId}-${Date.now()}`
    });
    if (planDayNumber(plan) === 1) {
      window.setTimeout(() => requestMilestoneReview?.('parent_day_one_plan'), 500);
    }
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
        <div className="parent-plan-sequence-status">
          <span>{selectedSeries.completedCount} of {selectedSeries.plans.length} days completed</span>
          <Progress value={selectedSeries.plans.length ? Math.round((selectedSeries.completedCount / selectedSeries.plans.length) * 100) : 0} />
          <p>Complete today’s lesson to open the next day.</p>
        </div>
        <div className="parent-plan-detail-layout single-plan">
          <article className={selectedPlan?.unlocked ? 'goal-card plan-card readonly-plan parent-plan-reader' : 'goal-card plan-card readonly-plan parent-plan-reader locked-plan'}>
            {selectedPlan ? (
              <>
                <div className="plan-read-header">
                  <span>{selectedPlan.completedAt ? 'Completed' : selectedPlan.unlocked ? selectedPlan.challengeDay : 'Locked'}</span>
                  <strong>{selectedPlan.title}</strong>
                  <em>{selectedPlan.unlocked ? `${selectedPlan.challengeDay || 'Current day'} of ${selectedSeries.plans.length}` : 'Complete the previous day to unlock'}</em>
                  <p>{planDisplaySubject(selectedPlan)}</p>
                </div>
                {selectedPlan.unlocked ? (
                  <PlanEpisode language={language} steps={selectedPlan.steps} planId={selectedPlan.id} planTitle={selectedPlan.title} preserveHeadings={shouldPreservePlanHeadings(selectedPlan.id)} />
                ) : (
                  <div className="locked-message">
                    <LockKeyhole size={18} />
                    <p>Complete the previous day before opening this lesson.</p>
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
