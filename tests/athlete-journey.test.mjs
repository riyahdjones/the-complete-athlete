import test from 'node:test';
import assert from 'node:assert/strict';
import { athleteRankProgress, deriveDevelopmentProfile, generateJourney, journeyQuestions, reconcileJourney } from '../src/athleteJourney.js';

const plans = [
  ...Array.from({ length: 5 }, (_, index) => ({ id: `confidence-${index + 1}`, title: `Confidence ${index + 1}`, challengeDay: `Day ${index + 1}`, subject: 'Series: The Confidence Code. Build confidence.' })),
  ...Array.from({ length: 4 }, (_, index) => ({ id: `goals-${index + 1}`, title: `Goals ${index + 1}`, challengeDay: `Day ${index + 1}`, subject: 'Series: Goal Blueprint. Build goals.' })),
  ...Array.from({ length: 5 }, (_, index) => ({ id: `habits-${index + 1}`, title: `Habits ${index + 1}`, challengeDay: `Day ${index + 1}`, subject: 'Series: Champion Habits. Build discipline.' }))
];

test('athlete onboarding contains nine questions with two multi-select questions', () => {
  assert.equal(journeyQuestions.length, 9);
  assert.deepEqual(journeyQuestions.filter((question) => question.maxSelections).map((question) => question.id), ['primaryGoal', 'pressureSignals']);
  assert.equal(journeyQuestions.at(-1).id, 'strength');
});

test('development answers produce a clear primary focus', () => {
  const profile = deriveDevelopmentProfile({ primaryGoal: 'Confidence', obstacle: 'I lose confidence after mistakes', identity: 'I work hard, but sometimes doubt myself' });
  assert.equal(profile.primaryFocus, 'confidence');
});

test('multi-select onboarding answers contribute independent recommendation signals', () => {
  const profile = deriveDevelopmentProfile({
    primaryGoal: ['Stay focused', 'Handle pressure better'],
    pressureSignals: ['My thoughts start racing', 'My body feels tight'],
    resetResponse: 'Take a breath or use a reset routine',
    followThrough: 'Almost always',
    strength: 'I believe in myself'
  });

  assert.equal(profile.primaryFocus, 'pressure');
  assert.ok(profile.tags.includes('focus'));
  assert.ok(profile.scores.pressure > profile.scores.focus);
  assert.equal(profile.scores.confidence, 0);
});

test('journeys always contain exactly 21 days and preserve full selected plans', () => {
  const journey = generateJourney({ answers: { primaryGoal: 'Confidence' }, plans, createdAt: '2026-10-04T12:00:00.000Z' });
  assert.equal(journey.days.length, 21);
  assert.equal(journey.days.at(-1).integrationKind, 'journey-review');
  journey.selectedSeries.forEach((series) => {
    assert.equal(journey.days.filter((day) => day.seriesTitle === series.title).length, series.lessonCount);
  });
  assert.ok(journey.days.slice(0, -1).some((day) => day.type === 'integration'));
});

test('plan completion reconciles without awarding or duplicating points', () => {
  const journey = generateJourney({ answers: { primaryGoal: 'Confidence' }, plans });
  const planDay = journey.days.find((day) => day.type === 'plan');
  const reconciled = reconcileJourney(journey, { [planDay.planId]: '2026-10-04' });
  assert.equal(reconciled.days.find((day) => day.planId === planDay.planId).completedAt, '2026-10-04');
});

test('rank progress uses major PP thresholds', () => {
  const progress = athleteRankProgress(1840);
  assert.equal(progress.current.name, 'Starter');
  assert.equal(progress.next.name, 'Playmaker');
  assert.equal(progress.remaining, 1160);
});

test('rank progress measures only the current rank interval at boundaries', () => {
  assert.equal(athleteRankProgress(499).percent, 99);
  assert.equal(athleteRankProgress(500).percent, 0);
  assert.equal(athleteRankProgress(1000).percent, 50);
  assert.equal(athleteRankProgress(1499).remaining, 1);

  const advanced = athleteRankProgress(1500);
  assert.equal(advanced.current.name, 'Starter');
  assert.equal(advanced.percent, 0);
  assert.equal(advanced.remaining, 1500);
});

test('highest rank returns a complete max-rank state', () => {
  const progress = athleteRankProgress(18000);
  assert.equal(progress.current.name, 'Complete Athlete');
  assert.equal(progress.next, null);
  assert.equal(progress.remaining, 0);
  assert.equal(progress.percent, 100);
});
