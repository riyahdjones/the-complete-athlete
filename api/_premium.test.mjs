import test from 'node:test';
import assert from 'node:assert/strict';
import { premiumAccessSetFromRows, subscriptionIsActive } from './_premium.js';

const now = new Date('2026-09-28T12:00:00Z').getTime();

test('only active or trialing unexpired subscriptions grant access', () => {
  assert.equal(subscriptionIsActive({ status: 'active', expires_at: '2026-09-29T12:00:00Z' }, now), true);
  assert.equal(subscriptionIsActive({ status: 'trialing', expires_at: '2026-09-29T12:00:00Z' }, now), true);
  assert.equal(subscriptionIsActive({ status: 'expired', expires_at: '2026-09-29T12:00:00Z' }, now), false);
  assert.equal(subscriptionIsActive({ status: 'active', expires_at: '2026-09-27T12:00:00Z' }, now), false);
});

test('a paid parent grants premium access to linked athletes', () => {
  const userIds = premiumAccessSetFromRows([
    { user_id: 'parent-paid', status: 'active', expires_at: '2026-10-01T12:00:00Z' },
    { user_id: 'parent-expired', status: 'expired', expires_at: '2026-09-20T12:00:00Z' }
  ], [
    { parent_user_id: 'parent-paid', athlete_user_id: 'athlete-covered' },
    { parent_user_id: 'parent-expired', athlete_user_id: 'athlete-uncovered' }
  ], now);

  assert.deepEqual([...userIds].sort(), ['athlete-covered', 'parent-paid']);
});
