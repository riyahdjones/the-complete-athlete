export const JOURNEY_LENGTH = 21;

export const journeyQuestions = [
  {
    id: 'primaryGoal',
    question: 'What would help you most right now?',
    helper: 'Choose up to two.',
    maxSelections: 2,
    options: ['Believe in myself more', 'Stay focused', 'Be more consistent', 'Handle pressure better', 'Bounce back after mistakes', 'Stay calm when I get emotional', 'Set goals and follow them', 'Use coaching and feedback better']
  },
  {
    id: 'obstacle',
    question: 'What gets in your way most often?',
    helper: 'Choose the one that most closely matches your experience.',
    options: ['I doubt myself', 'I get distracted', 'I overthink', 'I put things off', 'I get frustrated or emotional', 'I start strong but stop being consistent', 'I don’t know what to work on', 'I have trouble using feedback']
  },
  {
    id: 'resetSpeed',
    question: 'After a mistake, how long does it usually take you to reset?',
    helper: 'Choose what happens most often.',
    options: ['I’m ready by the next play', 'It takes me a few plays', 'It affects the rest of the game or practice', 'I think about it for the rest of the day', 'I sometimes carry it into the next day']
  },
  {
    id: 'gameDayState',
    question: 'Before a game or competition, how do you usually feel?',
    helper: 'Choose what sounds most like you.',
    options: ['Calm and ready', 'Excited and focused', 'Nervous, but I can still focus', 'I overthink', 'I feel pressure to perform', 'It changes from game to game']
  },
  {
    id: 'pressureSignals',
    question: 'When pressure shows up, what do you notice first?',
    helper: 'Choose up to two.',
    maxSelections: 2,
    options: ['My thoughts start racing', 'My body feels tight', 'My breathing changes', 'I rush', 'I hesitate or freeze', 'I lose focus', 'I stay steady', 'I’m not sure yet']
  },
  {
    id: 'resetResponse',
    question: 'When you get pulled off track, what do you usually do?',
    helper: 'Choose what happens most often.',
    options: ['Take a breath or use a reset routine', 'Focus on the next play or job', 'Try harder and sometimes rush', 'Get down on myself', 'Wait for the feeling to pass', 'Look to a coach or teammate', 'I’m not sure what to do']
  },
  {
    id: 'followThrough',
    question: 'When no one is reminding you, how often do you do what you said you would do?',
    helper: 'Choose the answer that sounds most like you right now.',
    options: ['Almost always', 'Most of the time', 'About half the time', 'I start strong but fall off', 'I usually need someone to push me']
  },
  {
    id: 'mentalSideInterest',
    question: 'How important is it to you to understand the mental side of sports better?',
    helper: 'There’s no wrong answer. Choose what feels true right now.',
    options: ['Very important', 'Important', 'A little important', 'I’m curious, but not sure yet', 'Not important to me right now']
  },
  {
    id: 'strength',
    question: 'What is already one of your strengths?',
    helper: 'Choose the strength that feels most true to you.',
    affirmation: 'That matters. Great athletes build from their strengths.',
    options: ['I work hard', 'I compete', 'I prepare', 'I listen and use coaching', 'I encourage teammates', 'I bounce back', 'I stay disciplined', 'I believe in myself', 'I’m still discovering my strengths']
  }
];

const signalRules = [
  [/confidence|doubt|believe in myself|get down on myself|hesitate|freeze/i, 'confidence', 3],
  [/discipline|procrastinate|put things off|pushes me|push me|start strong but fall off/i, 'discipline', 3],
  [/focus|distracted|unfocused|thoughts start racing/i, 'focus', 3],
  [/consistent|consistency|commitment|stop being consistent/i, 'consistency', 3],
  [/pressure|nervous|overthink|body feels tight|breathing changes/i, 'pressure', 3],
  [/emotional|frustrated|make up for it|rush|feeling to pass/i, 'emotional-control', 3],
  [/goal|what to work on/i, 'goal-setting', 3],
  [/coach|feedback/i, 'coachability', 3],
  [/bounce back|toughness|how far|few plays|rest of the game|rest of the day|next day/i, 'resilience', 2],
  [/identity|athlete i want|figuring/i, 'identity', 2],
  [/prepare/i, 'habits', 1]
];

const optionSignals = new Map(Object.entries({
  'Believe in myself more': [['confidence', 4]],
  'Stay focused': [['focus', 4]],
  'Be more consistent': [['consistency', 4]],
  'Handle pressure better': [['pressure', 4]],
  'Bounce back after mistakes': [['resilience', 4]],
  'Stay calm when I get emotional': [['emotional-control', 4]],
  'Set goals and follow them': [['goal-setting', 4]],
  'Use coaching and feedback better': [['coachability', 4]],
  'I doubt myself': [['confidence', 3]],
  'I get distracted': [['focus', 3]],
  'I overthink': [['pressure', 3]],
  'I put things off': [['discipline', 3]],
  'I get frustrated or emotional': [['emotional-control', 3]],
  'I start strong but stop being consistent': [['consistency', 3], ['discipline', 1]],
  'I don’t know what to work on': [['goal-setting', 3]],
  'I have trouble using feedback': [['coachability', 3]],
  'I’m ready by the next play': [],
  'It takes me a few plays': [['resilience', 1]],
  'It affects the rest of the game or practice': [['resilience', 3], ['emotional-control', 1]],
  'I think about it for the rest of the day': [['resilience', 4], ['confidence', 1]],
  'I sometimes carry it into the next day': [['resilience', 5], ['confidence', 1]],
  'Calm and ready': [],
  'Excited and focused': [],
  'Nervous, but I can still focus': [['pressure', 1]],
  'I feel pressure to perform': [['pressure', 3]],
  'It changes from game to game': [['pressure', 1]],
  'My thoughts start racing': [['pressure', 2], ['focus', 2]],
  'My body feels tight': [['pressure', 3]],
  'My breathing changes': [['pressure', 3]],
  'I rush': [['emotional-control', 3], ['focus', 1]],
  'I hesitate or freeze': [['confidence', 3], ['pressure', 2]],
  'I lose focus': [['focus', 3]],
  'I stay steady': [],
  'I’m not sure yet': [['pressure', 1]],
  'Take a breath or use a reset routine': [],
  'Focus on the next play or job': [],
  'Try harder and sometimes rush': [['emotional-control', 3], ['pressure', 1]],
  'Get down on myself': [['confidence', 3]],
  'Wait for the feeling to pass': [['emotional-control', 2]],
  'Look to a coach or teammate': [],
  'I’m not sure what to do': [['pressure', 1], ['habits', 1]],
  'Almost always': [],
  'Most of the time': [['consistency', 1]],
  'About half the time': [['consistency', 2], ['discipline', 2]],
  'I start strong but fall off': [['consistency', 3], ['discipline', 2]],
  'I usually need someone to push me': [['discipline', 4]],
  'I work hard': [],
  'I compete': [],
  'I prepare': [],
  'I listen and use coaching': [],
  'I encourage teammates': [],
  'I bounce back': [],
  'I stay disciplined': [],
  'I believe in myself': [],
  'I’m still discovering my strengths': []
}));

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
  Object.values(answers).flatMap((answer) => Array.isArray(answer) ? answer : [answer]).forEach((answer) => {
    const exactSignals = optionSignals.get(String(answer));
    if (exactSignals) {
      exactSignals.forEach(([tag, weight]) => { scores[tag] = (scores[tag] || 0) + weight; });
      return;
    }
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
  // Floor interval progress so an athlete never sees 100% until the next rank
  // threshold has actually been reached.
  const progress = next ? Math.floor(((total - current.minimum) / span) * 100) : 100;
  return { current, next, points: total, remaining: next ? Math.max(0, next.minimum - total) : 0, percent: Math.max(0, Math.min(100, progress)), currentIndex };
}
