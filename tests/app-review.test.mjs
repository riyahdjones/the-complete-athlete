import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appReviewStorageKey,
  parentAppOpenStorageKey,
  recordParentAppOpen,
  shouldRequestAppReview
} from '../src/appReview.js';

function memoryStorage(entries = []) {
  const values = new Map(entries);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

test('first locked day and first completed plan are eligible review milestones', () => {
  const storage = memoryStorage();
  assert.equal(shouldRequestAppReview({ userId: 'athlete-1', milestone: 'first_locked_day', storage }), true);
  assert.equal(shouldRequestAppReview({ userId: 'athlete-1', milestone: 'first_completed_plan', storage }), true);
});

test('review milestone is limited to one request per athlete on the device', () => {
  const key = appReviewStorageKey('athlete-1');
  const storage = memoryStorage([[key, JSON.stringify({ milestone: 'first_locked_day' })]]);
  assert.equal(shouldRequestAppReview({ userId: 'athlete-1', milestone: 'first_completed_plan', storage }), false);
  assert.equal(shouldRequestAppReview({ userId: 'athlete-2', milestone: 'first_completed_plan', storage }), true);
});

test('invalid milestone and missing athlete are never eligible', () => {
  const storage = memoryStorage();
  assert.equal(shouldRequestAppReview({ userId: '', milestone: 'first_locked_day', storage }), false);
  assert.equal(shouldRequestAppReview({ userId: 'athlete-1', milestone: 'daily_login', storage }), false);
});

test('parent Day 1 and fifth opening use the same one-time review gate', () => {
  const storage = memoryStorage();
  assert.equal(shouldRequestAppReview({ userId: 'parent-1', milestone: 'parent_day_one_plan', storage }), true);
  storage.setItem(appReviewStorageKey('parent-1'), JSON.stringify({ milestone: 'parent_day_one_plan' }));
  assert.equal(shouldRequestAppReview({ userId: 'parent-1', milestone: 'parent_fifth_app_open', storage }), false);
});

test('parent app openings are counted independently per account', () => {
  const storage = memoryStorage();
  for (let count = 1; count <= 5; count += 1) {
    assert.equal(recordParentAppOpen({ userId: 'parent-1', storage }), count);
  }
  assert.equal(storage.getItem(parentAppOpenStorageKey('parent-1')), '5');
  assert.equal(recordParentAppOpen({ userId: 'parent-2', storage }), 1);
});
