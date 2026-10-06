import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearMembershipAccessCache,
  loadMembershipAccessCache,
  resolvePremiumAccess,
  saveMembershipAccessCache,
  shouldClearSavedSession
} from '../src/membershipCache.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

test('valid cached premium access opens immediately until its expiration', () => {
  const storage = memoryStorage();
  saveMembershipAccessCache('athlete-1', {
    hasAccess: true,
    activeTrial: false,
    source: 'revenuecat',
    expiresAt: '2026-11-01T12:00:00Z'
  }, storage);

  assert.equal(
    loadMembershipAccessCache('athlete-1', storage, new Date('2026-10-03T12:00:00Z').getTime())?.hasAccess,
    true
  );
  assert.equal(
    loadMembershipAccessCache('athlete-1', storage, new Date('2026-11-02T12:00:00Z').getTime()),
    null
  );
});

test('inactive checks clear cached access', () => {
  const storage = memoryStorage();
  saveMembershipAccessCache('parent-1', { hasAccess: true, source: 'parent' }, storage);
  clearMembershipAccessCache('parent-1', storage);
  assert.equal(loadMembershipAccessCache('parent-1', storage), null);
});

test('temporary empty auth events do not clear a saved login', () => {
  assert.equal(shouldClearSavedSession('INITIAL_SESSION', null), false);
  assert.equal(shouldClearSavedSession('TOKEN_REFRESHED', null), false);
  assert.equal(shouldClearSavedSession('SIGNED_OUT', null), true);
  assert.equal(shouldClearSavedSession('SIGNED_IN', { user: { id: 'user-1' } }), false);
});

test('RevenueCat active entitlement stays unlocked when its reported expiration is stale', () => {
  const access = resolvePremiumAccess({
    subscription: {
      active: true,
      activeTrial: false,
      expirationDate: '2026-09-01T12:00:00Z',
      message: 'Premium access is active.'
    },
    backendAccess: { hasAccess: false },
    now: new Date('2026-10-04T12:00:00Z').getTime()
  });

  assert.equal(access.active, true);
  assert.equal(access.accessSource, 'revenuecat');
  assert.equal(access.message, 'Premium access is active.');
});

test('inactive access never displays an active membership message', () => {
  const access = resolvePremiumAccess({
    subscription: { active: false, message: '' },
    backendAccess: { hasAccess: false, source: 'none' },
    cachedAccess: null
  });

  assert.equal(access.active, false);
  assert.equal(access.message, '');
});
