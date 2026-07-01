import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  CalendarDays,
  Camera,
  Check,
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
  Users
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import './styles.css';

const standardsSeed = [
  { id: 1, label: 'Quality training session', done: false, goalId: 2 },
  { id: 2, label: 'Write down goals', done: false, goalId: 3 },
  { id: 3, label: '50 extra catches', done: false, goalId: 1 },
  { id: 4, label: 'Visualize for 5 mins', done: false, goalId: 4 }
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
const onboardingStorageKey = 'the-ninety-percent-onboarding-complete';
const authUsersStorageKey = 'the-ninety-percent-auth-users';
const authSessionStorageKey = 'the-ninety-percent-auth-session';
const prototypeBypassLogin = false;

function todayKey() {
  return new Date().toLocaleDateString('en-CA');
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
    body:
      'Your scoreboard changes. Your identity is trained. Today, separate how you played from who you are becoming.'
  },
  {
    id: 2,
    title: 'Pressure Is Information',
    time: '6 min',
    status: 'Draft',
    sendDate: addDays(todayKey(), 1),
    body:
      'Pressure points to something you care about. Slow down, name it, and choose the next controllable action.'
  },
  {
    id: 3,
    title: 'Confidence Receipts',
    time: '3 min',
    status: 'Ready',
    sendDate: addDays(todayKey(), 2),
    body:
      'Confidence grows when you keep proof. Capture one moment today where effort, discipline, or courage showed up.'
  }
];

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
  { id: 4, label: 'Daily Standards', value: 'Win today through controllables', progress: 50 }
];

const plansSeed = [
  {
    id: 1,
    title: 'Game Day Calm',
    subject: 'Breathe, see the first play, trust the work.',
    releaseDate: todayKey(),
    challengeDay: 'Day 1',
    steps: ['Settle your breathing', 'Picture one strong start', 'Choose one controllable']
  },
  {
    id: 2,
    title: 'Practice Lock In',
    subject: 'Arrive with one clear job and attack it.',
    releaseDate: addDays(todayKey(), 1),
    challengeDay: 'Day 2',
    steps: ['Name today’s skill', 'Visualize the first rep', 'Bring full effort early']
  }
];

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

function lessonFromSupabase(row) {
  return {
    id: row.id,
    title: row.title ?? '',
    time: '5 min',
    status: row.status === 'posted' ? 'Posted' : row.status === 'scheduled' ? 'Scheduled' : 'Draft',
    sendDate: row.release_date ?? todayKey(),
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
    return Array.isArray(saved) && saved.length ? saved.map(normalizePlan) : plansSeed.map(normalizePlan);
  } catch {
    return plansSeed.map(normalizePlan);
  }
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
  title: 'Coach the standard, not the scoreboard.',
  body: 'Your athlete is learning to separate identity from performance. Reinforce the standard they are building, not only the result they produced.',
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
  const [messages, setMessages] = useState([]);
  const [coachSessions, setCoachSessions] = useState(loadCoachSessions);
  const [activeCoachSessionId, setActiveCoachSessionId] = useState(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [parentMessage, setParentMessage] = useState(parentMessageSeed);
  const [privacySettings, setPrivacySettings] = useState(privacySeed);
  const [athleteProfile, setAthleteProfile] = useState(loadAthleteProfile);
  const [supabaseAthleteDataReady, setSupabaseAthleteDataReady] = useState(false);
  const [celebration, setCelebration] = useState('');
  const [lessonLibrary, setLessonLibrary] = useState(loadLessons);
  const [selectedLessonId, setSelectedLessonId] = useState(() => loadLessons()[0]?.id ?? lessons[0].id);

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
  }, [authSession?.id, authSession?.role]);

  useEffect(() => {
    if (!isSupabaseConfigured || !authSession) {
      return;
    }

    let cancelled = false;

    async function loadSharedContent() {
      const [lessonsResult, plansResult, parentMessageResult] = await Promise.all([
        supabase
          .from('daily_deposits')
          .select('id, title, body, release_date, status')
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
        setSelectedLessonId((current) => nextLessons.some((lesson) => lesson.id === current) ? current : nextLessons[0].id);
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
    if (!isSupabaseConfigured || authSession?.role !== 'parent') return;
    let cancelled = false;

    async function loadLinkedAthleteData() {
      const { data: links, error: linksError } = await supabase
        .from('parent_links')
        .select('athlete_user_id')
        .eq('parent_user_id', authSession.id)
        .limit(1);

      const athleteUserId = links?.[0]?.athlete_user_id;
      if (linksError || !athleteUserId || cancelled) return;

      const [profileResult, goalsResult, standardsHistoryResult, readinessResult, journalResult, privacyResult] = await Promise.all([
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
          .maybeSingle()
      ]);

      if (cancelled) return;

      if (!profileResult.error) {
        setAthleteProfile((current) => profileFromSupabase(profileResult.data, current, current));
      }
      if (!goalsResult.error) setGoals((goalsResult.data ?? []).map(goalFromSupabase));
      if (!standardsHistoryResult.error) setStandardsHistory(standardsHistoryFromSupabase(standardsHistoryResult.data));
      if (!readinessResult.error) setReadinessHistory(readinessFromSupabase(readinessResult.data));
      if (!journalResult.error) setJournalEntries((journalResult.data ?? []).map(journalFromSupabase));
      if (!privacyResult.error && privacyResult.data) {
        setPrivacySettings({
          readinessVisible: Boolean(privacyResult.data.readiness_visible),
          standardsVisible: Boolean(privacyResult.data.standards_visible),
          goalsVisible: Boolean(privacyResult.data.goals_visible),
          journalPrivate: Boolean(privacyResult.data.journal_private),
          coachPrivate: Boolean(privacyResult.data.coach_private)
        });
      }
    }

    loadLinkedAthleteData();

    return () => {
      cancelled = true;
    };
  }, [authSession?.id, authSession?.role]);

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

    if (role === 'parent' && parentCode && parentCode !== athleteProfile.parentAccessCode) {
      return 'Parent access code does not match.';
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
      if (role === 'parent' && athleteProfile.parentAccessCode) {
        await supabase.rpc('link_parent_to_athlete', { access_code: athleteProfile.parentAccessCode });
      }
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

  async function logoutUser() {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setAuthSession(null);
    setNotificationsOpen(false);
    setView('athlete');
    setTab('home');
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
      'Check off your Daily Standards and submit them today to keep your streak alive.',
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
          completion={completion}
          confidenceAverage={confidenceAverage}
          standardsCompleted={standardsCompleted}
          standardsHistory={standardsHistory}
          standardsTotal={standards.length}
          readinessScores={lastSevenReadinessScores(readinessHistory, dailyDate)}
          parentMessage={parentMessage}
          submittedToday={submittedToday}
          privacySettings={privacySettings}
          goals={goals}
          journalEntries={journalEntries}
          lesson={activeLesson}
        />
      );
    }
    const screens = {
      home: (
        <HomeScreen
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
          standardsHistory={standardsHistory}
          streakCount={streakCount}
          submittedToday={submittedToday}
        />
      ),
      plans: (
        <PlansScreen
          plans={plans}
        />
      ),
      journal: (
        <JournalScreen
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
          goals={goals}
          messages={messages}
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
    plans,
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
    view
  ]);

  if (!isAuthed) {
    return (
      <AuthScreen
        loginUser={loginUser}
        signupUser={signupUser}
        parentAccessCode={athleteProfile.parentAccessCode}
      />
    );
  }

  if (!prototypeBypassLogin && !onboardingComplete) {
    return <OnboardingScreen completeOnboarding={completeOnboarding} />;
  }

  return (
    <div className="app-shell">
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

      <main className="phone-frame" aria-label="The Complete Athlete app prototype">
        <header className="topbar">
          <div>
            <p className="eyebrow">The Complete Athlete</p>
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
  plans: 'Plans',
  journal: 'Reflect',
  coach: 'My Mindset Coach',
  profile: 'My Profile'
};

function AuthScreen({ loginUser, signupUser, parentAccessCode }) {
  const inviteParams = new URLSearchParams(window.location.search);
  const invitedRole = inviteParams.get('role');
  const invitedCode = inviteParams.get('parentCode') ?? '';
  const [mode, setMode] = useState(invitedRole === 'parent' && invitedCode ? 'signup' : 'login');
  const [role, setRole] = useState(invitedRole === 'parent' && invitedCode ? 'parent' : 'athlete');
  const [form, setForm] = useState({ name: '', email: '', password: '', parentCode: invitedCode });
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage('');
  }

  async function submitAuth(event) {
    event.preventDefault();
    setIsSubmitting(true);
    const error = mode === 'login'
      ? loginUser({ role, email: form.email, password: form.password })
      : signupUser({ role, name: form.name, email: form.email, password: form.password, parentCode: form.parentCode });
    setMessage(await error);
    setIsSubmitting(false);
  }

  return (
    <main className="auth-shell" aria-label="The Complete Athlete login">
      <section className="auth-brand-panel">
        <p className="eyebrow">The Complete Athlete</p>
        <h1>Access the right side of the standard.</h1>
        <p>Athletes build the day. Parents support the day.</p>
        <div className="auth-role-summary">
          <span><Trophy size={16} /> Athlete</span>
          <span><Users size={16} /> Parent</span>
        </div>
      </section>

      <section className="auth-card">
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
        </form>
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
      setMessage('Set at least one daily standard.');
      return;
    }

    completeOnboarding(cleanSetup);
  }

  return (
    <main className="onboarding-shell" aria-label="The Complete Athlete onboarding">
      <section className="onboarding-hero">
        <p className="eyebrow">The Complete Athlete</p>
        <h1>Set the standard before the day starts.</h1>
        <p>Build the first version of the athlete experience: who they are, what they are chasing, and what they can prove today.</p>
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
          <PanelTitle icon={<BadgeCheck size={18} />} title="Daily Standards" action={`${setup.standards.filter(Boolean).length} tasks`} />
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
  standardsHistory,
  streakCount,
  submittedToday
}) {
  const [standardsFeedback, setStandardsFeedback] = useState('');
  const completedStandards = standards.filter((standard) => standard.done);
  const recentStandardsHistory = [...standardsHistory].reverse().slice(0, 7);
  const standardsTrend = standardsHistory.slice(-7);
  const averageGoalProgress = goals.length
    ? Math.round(goals.reduce((total, goal) => total + Number(goal.progress), 0) / goals.length)
    : 0;
  const linkedStandardsCount = standards.filter((standard) => standard.goalId).length;
  const focusGoal = goals.find((goal) => Number(goal.progress) < 100) ?? goals[0];

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
    celebrate('Standard added. Now prove it today.');
  }

  function removeStandard(id) {
    setStandards((current) => current.filter((standard) => standard.id !== id));
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
      setStandardsFeedback('Start by setting one standard for today.');
      return;
    }

    if (standards.some((standard) => !standard.done)) {
      setStandardsFeedback('Finish your standards before locking in today.');
      return;
    }

    if (submittedToday) {
      setStandardsFeedback('You are locked in for today. Do it again tomorrow.');
      return;
    }

    const submissionDate = todayKey();
    const nextStreak = lastSubmittedDate === addDays(submissionDate, -1) ? streakCount + 1 : 1;
    const completedGoalIds = [...new Set(standards.map((standard) => standard.goalId).filter(Boolean))];
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
    setStandardsFeedback('');
    celebrate('Day locked in. Stack another one tomorrow.');

    notifyUser(
      'Daily Standards submitted',
      `Your standards are locked in. Current streak: ${nextStreak} day${nextStreak === 1 ? '' : 's'}.`,
      'success'
    );

    if (nextStreak % 7 === 0) {
      notifyUser(
        `${nextStreak}-day streak`,
        `You have protected your standard for ${nextStreak} straight days.`,
        'success'
      );
    }
  }

  function openDailyReflection() {
    const keptStandards = completedStandards.map((standard) => standard.label).join(', ') || 'I kept my standard today.';
    setJournalType('Daily Reflection');
    setJournal(
      `Daily Deposit: ${lesson.title}\nFocus question: What is the one thing I need to carry into today?\nStandard I kept: ${keptStandards}\nWhat I need to remember: `
    );
    setTab('journal');
  }

  return (
    <>
      <section className="panel">
        <PanelTitle icon={<BookOpen size={18} />} title="Daily Deposit" action={lesson.time} />
        <h2>{lesson.title}</h2>
        <p>{lesson.body}</p>
      </section>

      <section className="panel today-focus-panel">
        <PanelTitle icon={<Target size={18} />} title="Today's Focus" action="Question" />
        <div className="focus-question">
          <strong>What is the one thing I need to carry into today?</strong>
          <p>Read it, answer it in your head, and let it shape how you show up.</p>
        </div>
      </section>

      <section className="panel progress-snapshot">
        <PanelTitle icon={<BarChart3 size={18} />} title="Progress Snapshot" action={submittedToday ? 'Locked' : 'Today'} />
        <div className="progress-scoreboard">
          <span>
            <strong>{completion}%</strong>
            Standards today
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
            <strong>{linkedStandardsCount}/{standards.length}</strong>
            Tasks linked
          </span>
        </div>
        {focusGoal && (
          <div className="goal-progress-callout">
            <span>Current goal</span>
            <strong>{focusGoal.value}</strong>
            <Progress value={focusGoal.progress} />
          </div>
        )}
        <div className="standards-trend-strip" aria-label="Recent standards completion trend">
          {standardsTrend.length === 0 ? (
            <p>No locked-in days yet.</p>
          ) : (
            standardsTrend.map((entry) => (
              <span key={entry.date} style={{ height: `${Math.max(entry.percent, 8)}%` }}>
                <em>{entry.percent}%</em>
              </span>
            ))
          )}
        </div>
      </section>

      <section className="panel">
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

      <section className="panel">
        <PanelTitle icon={<BadgeCheck size={18} />} title="Daily Standards" action={`${standards.length} total`} />
        <p className="info-note">Your goals need evidence. Add the tasks you can prove today. Set your goals in Reflect.</p>
        <form className="standard-form" onSubmit={addStandard}>
          <input
            value={standardDraft}
            onChange={(event) => setStandardDraft(event.target.value)}
            placeholder="Add your own standard"
            aria-label="Add a daily standard"
          />
          <select
            aria-label="Connect standard to a goal"
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
          <button className="icon-button dark" type="submit" aria-label="Add standard">
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
              <span>
                {item.label}
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
              <button className="remove-standard" onClick={() => removeStandard(item.id)} type="button" aria-label={`Remove ${item.label}`}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        {standards.length === 0 && <p className="empty-note">Start by setting one standard for today.</p>}
        {standardsFeedback && <p className="inline-warning">{standardsFeedback}</p>}
        <button className={submittedToday ? 'secondary-action submitted' : 'secondary-action'} onClick={submitStandards}>
          {submittedToday ? 'Do It Again Tomorrow' : 'I Gave My All Today'}
        </button>
        {submittedToday && (
          <button className="reflection-cta" onClick={openDailyReflection}>
            <PenLine size={17} />
            Write what you need to remember
          </button>
        )}
      </section>

      <section className="panel">
        <PanelTitle icon={<BarChart3 size={18} />} title="Standards History" action={`${standardsHistory.length} days`} />
        {recentStandardsHistory.length === 0 ? (
          <p className="empty-note">Daily progress will appear here after the athlete locks in their standards.</p>
        ) : (
          <div className="standards-history">
            {recentStandardsHistory.map((entry) => (
              <article className="standards-history-row" key={entry.date}>
                <div>
                  <strong>{entry.date}</strong>
                  <span>{entry.completed}/{entry.total} completed at {entry.submittedAt || 'submission'}</span>
                </div>
                <b>{entry.percent}%</b>
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
  celebrate,
  goalDraft,
  goals,
  journalHistory,
  setGoalDraft,
  setGoals,
  standards
}) {
  const completedGoals = goals.filter((goal) => Number(goal.progress) >= 100);

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
    setGoals((current) => [...current, { id: Date.now(), label, value, progress: 0 }]);
    setGoalDraft({ label: '', value: '' });
    celebrate('Goal added. Write it, read it, prove it.');
  }

  function removeGoal(id) {
    setGoals((current) => current.filter((goal) => goal.id !== id));
  }

  function completeGoal(id) {
    setGoals((current) =>
      current.map((goal) => (goal.id === id ? { ...goal, progress: 100 } : goal))
    );
    celebrate('Goal complete. Achievement unlocked.');
  }

  return (
    <>
      <section className="panel goal-lead">
        <PanelTitle icon={<Target size={18} />} title="Goal System" action={`${goals.length} goals`} />
        <p>Goals dont guarantee success, but success rarely exists without them.</p>
        <div className="goal-reminder">
          <strong>Goal rhythm</strong>
          <span>Review monthly. Write daily. Prove one small piece today.</span>
        </div>
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
        {goals.map((goal) => (
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
              <strong>Daily standards helping this goal</strong>
              {standards.filter((standard) => standard.goalId === goal.id).length === 0 ? (
                <p>No standards linked yet.</p>
              ) : (
                standards
                  .filter((standard) => standard.goalId === goal.id)
                  .map((standard) => (
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
        ))}
      </div>

      {journalHistory}

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

function PlansScreen({ plans }) {
  const today = todayKey();
  const releasedPlans = plans
    .filter((plan) => !plan.releaseDate || plan.releaseDate <= today)
    .sort((first, second) => (first.releaseDate || '').localeCompare(second.releaseDate || ''));
  const lockedCount = plans.length - releasedPlans.length;

  return (
    <>
      <section className="panel goal-lead">
        <PanelTitle icon={<BookOpen size={18} />} title="Performance Plans" action={`${releasedPlans.length} open`} />
        <p>Simple mental performance plans to read before practice, games, or pressure moments.</p>
        <div className="goal-reminder">
          <strong>How to use this</strong>
          <span>New plans open on the day your coach sets. Read slowly and carry one step into your next rep.</span>
        </div>
      </section>

      {lockedCount > 0 && (
        <section className="panel plan-lock-note">
          <PanelTitle icon={<CalendarDays size={18} />} title="Scheduled" action={`${lockedCount} locked`} />
          <p>More performance plan content is scheduled and will open automatically on its release day.</p>
        </section>
      )}

      <div className="stack">
        {releasedPlans.length === 0 ? (
          <section className="panel">
            <p className="empty-note">No performance plans are open yet. Check back on the next release day.</p>
          </section>
        ) : releasedPlans.map((plan) => (
          <section className="goal-card plan-card readonly-plan" key={plan.id}>
            <div className="plan-read-header">
              <span>{plan.challengeDay || plan.releaseDate}</span>
              <strong>{plan.title}</strong>
              <p>{plan.subject}</p>
            </div>
            {plan.steps.length > 0 && (
              <div className="plan-steps">
                <strong>Plan steps</strong>
                {plan.steps.map((step, index) => (
                  <span key={`${plan.id}-${index}-${step}`}>
                    <em>{index + 1}</em>
                    {step}
                  </span>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}

function JournalScreen({
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
    celebrate('Journal saved. That reflection is yours to revisit.');
  }

  function openJournalEntry(entry) {
    setJournalType(entry.type);
    setJournal(entry.body);
    setJournalGoalId(entry.linkedGoalId ? String(entry.linkedGoalId) : '');
  }

  function removeJournalEntry(id) {
    setJournalEntries((current) => current.filter((entry) => entry.id !== id));
  }

  const journalHistory = (
    <section className="panel">
      <PanelTitle icon={<BookOpen size={18} />} title="Reflection History" action={`${journalEntries.length} saved`} />
      {journalEntries.length === 0 ? (
        <p className="empty-note">Saved reflections will appear here so you can review your growth over time.</p>
      ) : (
        <div className="journal-history">
          {journalEntries.map((entry) => {
            const linkedGoal = entry.linkedGoalId
              ? goals.find((goal) => goal.id === entry.linkedGoalId)
              : null;

            return (
              <article className="journal-entry" key={entry.id}>
                <button onClick={() => openJournalEntry(entry)}>
                  <span>{entry.type}</span>
                  <strong>{entry.date} at {entry.time}</strong>
                  {linkedGoal && <em>Connected to {linkedGoal.label}</em>}
                  <p>{entry.body}</p>
                </button>
                <button className="remove-standard" onClick={() => removeJournalEntry(entry.id)} aria-label={`Remove journal entry from ${entry.date}`}>
                  <Trash2 size={16} />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <>
      <section className="panel">
        <PanelTitle icon={<PenLine size={18} />} title="Write What You Need To Remember" action={todayKey()} />
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
      </section>
      <GoalsScreen
        celebrate={celebrate}
        goalDraft={goalDraft}
        goals={goals}
        journalHistory={journalHistory}
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
  goals,
  messages,
  messageDraft,
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
    if (words.length < 12) {
      return 'I hear you. Before I coach it too hard, help me understand the moment: what happened, and what part of it is sticking with you right now?';
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

    return `That sounds like a real ${topic} moment, but I do not want to guess at the whole story. What happened right before you felt this, and what do you wish you had done differently? Once I know that, we can turn it into one clear standard for today.`;
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

    const response = await fetch('/api/coach', {
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
        }
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Coach backend unavailable.');
    }
    if (!payload.reply) {
      throw new Error('Coach backend returned an empty reply.');
    }
    return payload.reply;
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
      const reply = await requestCoachReply(clean, nextMessages, sessionId, sessionTitle);
      saveCoachSession(sessionId, sessionTitle, [...nextMessages, { role: 'coach', text: reply }]);
    } catch (error) {
      const reply = coachReply(clean);
      setCoachStatus('Backend coach is not configured yet, so this chat used the prototype coach.');
      saveCoachSession(sessionId, sessionTitle, [...nextMessages, { role: 'coach', text: reply }]);
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
    <>
      <section className="panel">
        <PanelTitle icon={<MessageCircle size={18} />} title="Quick Coaching" action="Choose one" />
        <div className="coach-topics">
          {coachTopics.map((topic) => (
            <button key={topic.title} onClick={() => useTopic(topic.prompt)}>
              {topic.title}
            </button>
          ))}
        </div>
      </section>
      <section className="panel mental-reps-panel">
        <PanelTitle icon={<Brain size={18} />} title="Lock In" action="Guided" />
        <div className="visualization-flow">
          <span>
            <strong>Breathe</strong>
            In through your nose. Out slow. Let your shoulders drop.
          </span>
          <span>
            <strong>See it</strong>
            Picture one practice or game moment where you stay composed.
          </span>
          <span>
            <strong>Feel it</strong>
            See your body language, your pace, your voice, and your next rep.
          </span>
          <span>
            <strong>Carry it</strong>
            Repeat: I am ready for the next play.
          </span>
        </div>
      </section>
      <section className="panel">
        <PanelTitle icon={<BookOpen size={18} />} title="Coach History" action={`${coachSessions.length} saved`} />
        <button className="primary-action full" onClick={startNewChat}>
          <Plus size={18} />
          New Chat
        </button>
        {coachSessions.length === 0 ? (
          <p className="empty-note">Saved coach conversations will appear here for review.</p>
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
      <section className="chat-panel">
        {messages.map((message, index) => (
          <div className={message.role === 'coach' ? 'bubble coach' : 'bubble athlete'} key={`${message.role}-${index}`}>
            {message.text}
          </div>
        ))}
        {coachThinking && <div className="bubble coach">Thinking it through...</div>}
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
          placeholder="Ask about mindset, training, pressure, team, injury..."
        />
        <button className="icon-button dark" onClick={sendMessage} aria-label="Send message" disabled={coachThinking}>
          <Send size={18} />
        </button>
      </div>
    </>
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
      <section className="panel">
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
      <section className="panel">
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
      <section className="panel">
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
            <span>Standards submitted visible to parent</span>
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
  completion,
  confidenceAverage,
  goals,
  journalEntries,
  lesson,
  parentMessage,
  privacySettings,
  readinessScores,
  standardsCompleted,
  standardsHistory,
  standardsTotal,
  submittedToday
}) {
  const completedGoals = goals.filter((goal) => Number(goal.progress) >= 100).length;
  const latestJournalDate = journalEntries[0]?.date ?? 'None yet';
  const recentStandardsHistory = [...standardsHistory].reverse().slice(0, 7);

  return (
    <>
      <div className="metric-grid">
        {privacySettings.standardsVisible && (
          <Metric icon={<BookOpen size={18} />} label="Standards Submitted" value={submittedToday ? 'Yes' : 'No'} />
        )}
        {privacySettings.readinessVisible && (
          <Metric icon={<BarChart3 size={18} />} label="Daily Readiness" value={`${confidenceAverage}/10`} />
        )}
        {privacySettings.standardsVisible && (
          <Metric icon={<BadgeCheck size={18} />} label="Standards" value={`${standardsCompleted}/${standardsTotal}`} />
        )}
        {!privacySettings.readinessVisible && !privacySettings.standardsVisible && (
          <Metric icon={<Shield size={18} />} label="Privacy" value="Limited" />
        )}
      </div>
      <section className="panel">
        <PanelTitle icon={<Activity size={18} />} title="Athlete Snapshot" action="Today" />
        <div className="parent-snapshot">
          <span>
            <strong>Daily Deposit</strong>
            {lesson.title}
          </span>
          {privacySettings.standardsVisible && (
            <span>
              <strong>Standards</strong>
              {standardsCompleted}/{standardsTotal} complete
            </span>
          )}
          {privacySettings.readinessVisible && (
            <span>
              <strong>Readiness</strong>
              {confidenceAverage}/10
            </span>
          )}
          {privacySettings.goalsVisible && (
            <span>
              <strong>Goals</strong>
              {completedGoals} complete
            </span>
          )}
          <span>
            <strong>Reflection</strong>
            Latest saved: {latestJournalDate}
          </span>
        </div>
      </section>
      <section className="panel">
        <PanelTitle icon={<Users size={18} />} title="Parent Corner" action={parentMessage.sendDate} />
        <h2>{parentMessage.title}</h2>
        <p>{parentMessage.body}</p>
        <div className="parent-cues">
          <span>
            <strong>Ask</strong>
            {parentMessage.conversationCue}
          </span>
          <span>
            <strong>Avoid</strong>
            {parentMessage.avoid}
          </span>
        </div>
      </section>
      {privacySettings.goalsVisible && (
        <section className="panel">
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
      {privacySettings.readinessVisible && (
        <section className="panel">
          <PanelTitle icon={<LineChart size={18} />} title="Readiness Trend" action="7 days" />
          <div className="trend-bars">
            {readinessScores.map((entry) => (
              <span
                aria-label={`${entry.date}: ${entry.score}/10`}
                className={entry.score === 0 ? 'empty' : ''}
                key={entry.date}
                style={{ height: `${Math.max(entry.score, 0.7) * 10}%` }}
              >
                <em>{entry.score}</em>
              </span>
            ))}
          </div>
        </section>
      )}
      {privacySettings.standardsVisible && (
        <section className="panel">
          <PanelTitle icon={<BadgeCheck size={18} />} title="Standards History" action={`${standardsHistory.length} days`} />
          {recentStandardsHistory.length === 0 ? (
            <p className="empty-note">Submitted standards history will appear here after the athlete locks in a day.</p>
          ) : (
            <div className="standards-history parent-history">
              {recentStandardsHistory.map((entry) => (
                <article className="standards-history-row" key={entry.date}>
                  <div>
                    <strong>{entry.date}</strong>
                    <span>{entry.completed}/{entry.total} completed at {entry.submittedAt || 'submission'}</span>
                  </div>
                  <b>{entry.percent}%</b>
                  <ul>
                    {entry.standards.filter((standard) => standard.done).map((standard, index) => (
                      <li className="done" key={`${entry.date}-${index}`}>
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
      )}
    </>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    ['home', Home, 'home'],
    ['plans', BookOpen, 'plans'],
    ['journal', PenLine, 'reflect'],
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
