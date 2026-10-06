import test from 'node:test';
import assert from 'node:assert/strict';
import { athleteRankProgress, deriveDevelopmentProfile, generateJourney, reconcileJourney } from '../src/athleteJourney.js';

const plans = [
  ...Array.from({ length: 5 }, (_, index) => ({ id: `confidence-${index + 1}`, title: `Confidence ${index + 1}`, challengeDay: `Day ${index + 1}`, subject: 'Series: The Confidence Code. Build confidence.' })),
  ...Array.from({ length: 4 }, (_, index) => ({ id: `goals-${index + 1}`, title: `Goals ${index + 1}`, challengeDay: `Day ${index + 1}`, subject: 'Series: Goal Blueprint. Build goals.' })),
  ...Array.from({ length: 5 }, (_, index) => ({ id: `habits-${index + 1}`, title: `Habits ${index + 1}`, challengeDay: `Day ${index + 1}`, subject: 'Series: Champion Habits. Build discipline.' }))
];

test('development answers produce a clear primary focus', () => {
  const profile = deriveDevelopmentProfile({ primaryGoal: 'Confidence', obstacle: 'I lose confidence after mistakes', identity: 'I work hard, but sometimes doubt myself' });
  assert.equal(profile.primaryFocus, 'confidence');
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
