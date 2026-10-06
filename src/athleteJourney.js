export const JOURNEY_LENGTH = 21;

export const journeyQuestions = [
  {
    id: 'primaryGoal',
    question: 'What do you want to improve most right now?',
    helper: 'Choose the one that feels most important to you right now.',
    options: ['Confidence', 'Discipline', 'Focus', 'Consistency', 'Handling pressure', 'Emotional control', 'Goal-setting', 'Coachability']
  },
  {
    id: 'obstacle',
    question: 'What gets in your way most often?',
    helper: 'Choose the one that most closely matches your experience.',
    options: ['I lose confidence after mistakes', 'I procrastinate', 'I get distracted', 'I overthink', 'I get too emotional', 'I struggle to stay consistent', 'I don’t always know what to work on', 'I have trouble taking coaching']
  },
  {
    id: 'mistakeResponse',
    question: 'After a bad play, mistake, or performance, what usually happens?',
    helper: 'Choose the response that sounds most like you most often.',
    options: ['I move on quickly', 'I stay frustrated', 'I start doubting myself', 'I overthink what happened', 'I try too hard to make up for it', 'It depends on the situation']
  },
  {
    id: 'gameDayMindset',
    question: 'Before competition, which sounds most like you?',
    helper: 'Pick the one that best describes how you usually feel.',
    options: ['Calm and ready', 'Excited but sometimes unfocused', 'Nervous', 'I overthink', 'Confident', 'It changes depending on the game']
  },
  {
    id: 'followThrough',
    question: 'When you know what you need to do, how often do you actually follow through?',
    helper: 'Choose the answer that best reflects you right now.',
    options: ['Almost always', 'Most of the time', 'About half the time', 'I start strong but fall off', 'I struggle unless someone pushes me']
  },
  {
    id: 'strength',
    question: 'What’s one thing you already do really well as an athlete?',
    helper: 'Choose the strength you’re most proud of.',
    affirmation: 'That matters. Great athletes build from their strengths.',
    options: ['I work hard', 'I compete', 'I listen to coaching', 'I prepare', 'I encourage teammates', 'I bounce back', 'I stay disciplined', 'I believe in myself']
  },
  {
    id: 'pride',
    question: 'What are you most proud of about yourself as an athlete?',
    helper: 'Pick the one that feels most true to you.',
    affirmation: 'Remember that. You’ve already built evidence that you can grow.',
    options: ['How far I’ve come', 'My work ethic', 'My toughness', 'My attitude', 'My improvement', 'Being a good teammate', 'My commitment', 'I’m still figuring that out']
  },
  {
    id: 'identity',
    question: 'Which sounds most like you right now?',
    helper: 'Choose the statement that most strongly aligns with where you are today.',
    options: ['I know what I want, but I need more consistency', 'I work hard, but sometimes doubt myself', 'I’m confident, but I want better focus', 'I’m talented, but my emotions can affect my performance', 'I’m disciplined, but I want a stronger mental game', 'I’m still figuring out the athlete I want to become']
  }
];

const signalRules = [
  [/confidence|doubt|believe in myself/i, 'confidence', 3],
  [/discipline|procrastinate|pushes me|start strong but fall off/i, 'discipline', 3],
  [/focus|distracted|unfocused/i, 'focus', 3],
  [/consistent|consistency|commitment/i, 'consistency', 3],
  [/pressure|nervous|overthink/i, 'pressure', 3],
  [/emotional|frustrated|make up for it/i, 'emotional-control', 3],
  [/goal|what to work on/i, 'goal-setting', 3],
  [/coach/i, 'coachability', 3],
  [/bounce back|toughness|how far/i, 'resilience', 1],
  [/identity|athlete i want|figuring/i, 'identity', 2],
  [/prepare/i, 'habits', 1]
];

const positiveOffsets = [
  [/listen to coaching/i, 'coachability', -2],
  [/bounce back/i, 'resilience', -2],
  [/stay disciplined/i, 'discipline', -2],
  [/believe in myself/i, 'confidence', -2]
];

const focusLabels = {
  confidence: 'Confidence',
  discipline: 'Discipline',
  focus: 'Focus',
  consistency: 'Consistency',
  pressure: 'Handling Pressure',
  'emotional-control': 'Emotional Control',
  'goal-setting': 'Goal-Setting',
  coachability: 'Coachability',
  resilience: 'Resilience',
  identity: 'Identity',
  habits: 'Habits'
};

const planSignals = {
  confidence: ['confidence', 'positive self image', 'slump'],
  discipline: ['champion habits', 'boring wins', 'discipline', '90%'],
  focus: ['imagination', 'focus', 'boring wins'],
  consistency: ['champion habits', 'boring wins', 'discipline'],
  pressure: ['control the controllables', 'imagination', 'confidence'],
  'emotional-control': ['control the controllables', 'slump', 'compete differently'],
  'goal-setting': ['goal blueprint', 'champion habits', '90%'],
  coachability: ['coachable', 'control the controllables', 'positive self image'],
  resilience: ['slump', 'confidence', 'compete differently'],
  identity: ['positive self image', '90%', 'imagination'],
  habits: ['champion habits', 'boring wins', '90%']
};

function seriesTitle(plan) {
  const subject = String(plan?.subjectEn ?? plan?.subject ?? '');
  return subject.match(/Series:\s*([^.!]+)[.!]?/i)?.[1]?.replace(/^['"]|['"]$/g, '').trim() || plan?.seriesTitle || 'Performance Plan';
}

function planDay(plan) {
  const value = Number(String(plan?.challengeDay || '').match(/\d+/)?.[0]);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function deriveDevelopmentProfile(answers = {}) {
  const scores = {};
  Object.values(answers).forEach((answer) => {
    signalRules.forEach(([pattern, tag, weight]) => {
      if (pattern.test(String(answer))) scores[tag] = (scores[tag] || 0) + weight;
    });
  });
  positiveOffsets.forEach(([pattern, tag, weight]) => {
    if (pattern.test(String(answers.strength || ''))) scores[tag] = Math.max(0, (scores[tag] || 0) + weight);
  });
  const rankedTags = Object.entries(scores)
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .map(([tag]) => tag);
  if (!rankedTags.length) rankedTags.push('identity', 'consistency', 'confidence');
  return {
    primaryFocus: rankedTags[0],
    primaryFocusLabel: focusLabels[rankedTags[0]] || 'Mental Performance',
    tags: rankedTags.slice(0, 5),
    scores
  };
}

function groupPlans(plans = []) {
  const groups = new Map();
  plans.forEach((plan) => {
    const title = seriesTitle(plan);
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(plan);
  });
  return Array.from(groups, ([title, lessons]) => ({
    title,
    lessons: [...lessons].sort((first, second) => planDay(first) - planDay(second))
  }));
}

export function scoreJourneyPlans(profile, plans = []) {
  return groupPlans(plans).map((series) => {
    const haystack = series.title.toLowerCase();
    const score = profile.tags.reduce((total, tag, index) => {
      const match = (planSignals[tag] || []).some((signal) => haystack.includes(signal));
      return total + (match ? Math.max(2, 8 - index) : 0);
    }, 0);
    return { ...series, score };
  }).sort((first, second) => second.score - first.score || first.title.localeCompare(second.title));
}

const integrationTemplates = [
  { kind: 'reflection', title: 'Notice the Change', action: 'Name one lesson that has helped you most so far.', reflection: 'What have you noticed about yourself?' },
  { kind: 'application', title: 'Put It Into Practice', action: 'Choose one idea from your last plan and deliberately use it today.', reflection: 'Did your actions match your standard?' },
  { kind: 'goal-check', title: 'Goal Check-In', action: 'Review your main goal and choose one adjustment for the next week.', reflection: 'Did your actions move you closer to your goal?' },
  { kind: 'visualization', title: 'See the Next Rep', action: 'Take 90 seconds to rehearse responding with confidence and control.', reflection: 'What response did you see yourself choosing?' },
  { kind: 'identity', title: 'Identity Day', action: 'Make one choice the athlete you want to become would make today.', reflection: 'What are your actions proving about who you are becoming?' },
  { kind: 'reset', title: 'Reset + Recommit', action: 'Choose one promise you will protect for the next seven days.', reflection: 'What needs your commitment again?' },
  { kind: 'progress', title: 'Progress Review', action: 'Review the work you have completed and name the evidence of growth.', reflection: 'What are you proud you kept doing?' }
];

function integrationFor(index, profile, final = false) {
  if (final) {
    return {
      type: 'integration',
      integrationKind: 'journey-review',
      focus: profile.primaryFocusLabel,
      title: 'Your First 21',
      action: 'Review the evidence you built and choose the standard you will carry forward.',
      reflection: 'What kind of athlete are your actions proving you are becoming?'
    };
  }
  const preferred = profile.primaryFocus === 'goal-setting' ? 2
    : profile.primaryFocus === 'pressure' || profile.primaryFocus === 'focus' ? 3
      : profile.primaryFocus === 'identity' ? 4 : index % integrationTemplates.length;
  const template = integrationTemplates[(preferred + index) % integrationTemplates.length];
  return { type: 'integration', integrationKind: template.kind, focus: profile.primaryFocusLabel, ...template };
}

export function generateJourney({ answers = {}, plans = [], createdAt = new Date().toISOString() } = {}) {
  const profile = deriveDevelopmentProfile(answers);
  const scoredPlans = scoreJourneyPlans(profile, plans);
  const selected = [];
  let lessonCount = 0;
  for (const series of scoredPlans) {
    if (!series.lessons.length || selected.length >= 4) continue;
    if (lessonCount + series.lessons.length > 18) continue;
    selected.push(series);
    lessonCount += series.lessons.length;
    if (lessonCount >= 12 && selected.length >= 3) break;
  }
  if (!selected.length && scoredPlans[0]) selected.push(scoredPlans[0]);

  const sequence = [];
  let integrationIndex = 0;
  const availableBeforeReview = JOURNEY_LENGTH - 1;
  selected.forEach((series, seriesIndex) => {
    series.lessons.forEach((plan) => sequence.push({
      type: 'plan',
      focus: profile.primaryFocusLabel,
      title: plan.title,
      action: `Complete today’s lesson from ${series.title}.`,
      planId: String(plan.id),
      planDay: planDay(plan),
      seriesTitle: series.title
    }));
    if (seriesIndex < selected.length - 1 && sequence.length < availableBeforeReview) {
      sequence.push(integrationFor(integrationIndex++, profile));
    }
  });
  while (sequence.length < availableBeforeReview) {
    const remaining = availableBeforeReview - sequence.length;
    const next = integrationFor(integrationIndex++, profile);
    const target = Math.max(1, Math.min(sequence.length, Math.round((availableBeforeReview / (remaining + 1)) * integrationIndex)));
    sequence.splice(target, 0, next);
  }
  sequence.splice(availableBeforeReview);
  sequence.push(integrationFor(integrationIndex, profile, true));

  const days = sequence.map((day, index) => ({ ...day, day: index + 1, completedAt: '' }));
  return {
    id: `journey-${Date.parse(createdAt) || Date.now()}`,
    version: 1,
    createdAt,
    startedAt: '',
    completedAt: '',
    answers,
    developmentProfile: profile,
    planScores: scoredPlans.map(({ title, score, lessons }) => ({ title, score, lessonCount: lessons.length })),
    selectedSeries: selected.map(({ title, lessons }) => ({ title, lessonCount: lessons.length })),
    days
  };
}

export function reconcileJourney(journey, planProgress = {}) {
  if (!journey?.days?.length) return journey;
  const days = journey.days.map((day) => day.type === 'plan' && planProgress[String(day.planId)]
    ? { ...day, completedAt: day.completedAt || planProgress[String(day.planId)] }
    : day);
  const completed = days.every((day) => Boolean(day.completedAt));
  return { ...journey, days, completedAt: completed ? journey.completedAt || new Date().toISOString() : '' };
}

export function journeyProgress(journey) {
  const days = journey?.days || [];
  const completed = days.filter((day) => day.completedAt).length;
  const nextDay = days.find((day) => !day.completedAt) || days[days.length - 1] || null;
  return {
    completed,
    total: days.length,
    percent: days.length ? Math.round((completed / days.length) * 100) : 0,
    nextDay,
    complete: Boolean(journey?.completedAt) || (days.length > 0 && completed === days.length)
  };
}

export const athleteRanks = [
  { name: 'Prospect', minimum: 0, identity: 'You’ve entered the journey.' },
  { name: 'Competitor', minimum: 500, identity: 'You’re starting to build consistency.' },
  { name: 'Starter', minimum: 1500, identity: 'Your habits are becoming part of who you are.' },
  { name: 'Playmaker', minimum: 3000, identity: 'Your work is creating separation.' },
  { name: 'Elite', minimum: 6000, identity: 'Your consistency is uncommon.' },
  { name: 'All-Pro', minimum: 10000, identity: 'You operate at a different standard.' },
  { name: 'Complete Athlete', minimum: 15000, identity: 'Mind. Habits. Preparation. Performance.' }
];

export function athleteRankProgress(points = 0) {
  const total = Math.max(0, Number(points) || 0);
  const currentIndex = athleteRanks.reduce((found, rank, index) => total >= rank.minimum ? index : found, 0);
  const current = athleteRanks[currentIndex];
  const next = athleteRanks[currentIndex + 1] || null;
  const span = next ? next.minimum - current.minimum : 1;
  const progress = next ? Math.round(((total - current.minimum) / span) * 100) : 100;
  return { current, next, points: total, remaining: next ? Math.max(0, next.minimum - total) : 0, percent: Math.max(0, Math.min(100, progress)), currentIndex };
}
