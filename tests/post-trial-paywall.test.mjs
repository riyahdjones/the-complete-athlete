import test from 'node:test';
import assert from 'node:assert/strict';
import {
  derivePostTrialActivity,
  selectPostTrialVariant
} from '../src/postTrialPaywall.js';

const expirationDate = '2026-10-08T12:00:00.000Z';

test('parent role overrides athlete activity', () => {
  assert.equal(selectPostTrialVariant({ role: 'parent', activity: { active: true } }), 'parent');
});

test('zero, one, and two meaningful activity days remain low activity', () => {
  for (const count of [0, 1, 2]) {
    const standardsHistory = Array.from({ length: count }, (_, index) => ({ date: `2026-10-0${index + 2}` }));
    const activity = derivePostTrialActivity({ expirationDate, standardsHistory });
    assert.equal(activity.active, false);
    assert.equal(activity.meaningfulDays, count);
  }
});

test('three distinct meaningful days produce the active variant', () => {
  const activity = derivePostTrialActivity({
    expirationDate,
    standardsHistory: [{ date: '2026-10-02' }, { date: '2026-10-03' }, { date: '2026-10-04' }]
  });
  assert.equal(activity.active, true);
  assert.equal(selectPostTrialVariant({ role: 'athlete', activity }), 'active-athlete');
});

test('three plan lessons produce the active variant even on one day', () => {
  const activity = derivePostTrialActivity({
    expirationDate,
    planProgress: {
      first: '2026-10-04T10:00:00Z',
      second: '2026-10-04T10:05:00Z',
      third: '2026-10-04T10:10:00Z'
    }
  });
  assert.equal(activity.active, true);
  assert.equal(activity.completedLessons, 3);
});

test('only trial-period points and progress are counted', () => {
  const activity = derivePostTrialActivity({
    expirationDate,
    planProgress: { inTrial: '2026-10-04', beforeTrial: '2026-09-01' },
    pointsLedger: [
      { date: '2026-10-04', points: 25 },
      { date: '2026-09-01', points: 999 }
    ]
  });
  assert.equal(activity.completedLessons, 1);
  assert.equal(activity.pointsEarned, 25);
  assert.equal(activity.lifetime.pointsEarned, 1024);
});

test('missing trial dates use neutral low-activity segmentation', () => {
  const activity = derivePostTrialActivity({
    planProgress: { first: '2026-10-04' },
    pointsLedger: [{ date: '2026-10-04', points: 25 }]
  });
  assert.equal(activity.active, false);
  assert.equal(activity.hasVerifiedActivity, false);
  assert.equal(activity.dataScope, 'unavailable');
});

test('active preview cannot fabricate an active athlete without verified activity', () => {
  assert.equal(selectPostTrialVariant({
    role: 'athlete',
    activity: { active: false, hasVerifiedActivity: false },
    previewVariant: 'active-athlete'
  }), 'low-activity-athlete');
});
