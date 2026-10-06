const premiumAccessCachePrefix = 'the-complete-athlete-premium-access';

function cacheKey(userId) {
  return `${premiumAccessCachePrefix}:${String(userId || 'guest')}`;
}

export function loadMembershipAccessCache(userId, storage = globalThis.localStorage, now = Date.now()) {
  if (!userId || !storage) return null;
  try {
    const cached = JSON.parse(storage.getItem(cacheKey(userId)) || 'null');
    if (!cached?.hasAccess) return null;
    const expirationTime = new Date(cached.expiresAt || '').getTime();
    if (Number.isFinite(expirationTime) && expirationTime <= now) {
      storage.removeItem(cacheKey(userId));
      return null;
    }
    return {
      hasAccess: true,
      activeTrial: Boolean(cached.activeTrial),
      source: cached.source || 'cached',
      sponsorUserId: cached.sponsorUserId || null,
      expiresAt: cached.expiresAt || '',
      checkedAt: cached.checkedAt || ''
    };
  } catch {
    return null;
  }
}

export function saveMembershipAccessCache(userId, access, storage = globalThis.localStorage) {
  if (!userId || !storage || !access?.hasAccess) return;
  storage.setItem(cacheKey(userId), JSON.stringify({
    hasAccess: true,
    activeTrial: Boolean(access.activeTrial),
    source: access.source || 'subscription',
    sponsorUserId: access.sponsorUserId || null,
    expiresAt: access.expiresAt || '',
    checkedAt: new Date().toISOString()
  }));
}

export function clearMembershipAccessCache(userId, storage = globalThis.localStorage) {
  if (!userId || !storage) return;
  storage.removeItem(cacheKey(userId));
}

export function shouldClearSavedSession(event, session) {
  return event === 'SIGNED_OUT' && !session;
}

export function resolvePremiumAccess({
  subscription = {},
  backendAccess = {},
  cachedAccess = null,
  localTrialAccess = false,
  now = Date.now()
} = {}) {
  // RevenueCat's active entitlement map and the server RPC already validate
  // expiration. Re-checking those dates against the device clock can reject a
  // valid entitlement when RevenueCat supplies an older latestExpirationDate.
  const nativeAccessCurrent = Boolean(subscription.active);
  const backendAccessCurrent = Boolean(backendAccess.hasAccess);
  const cachedExpirationTime = new Date(cachedAccess?.expiresAt || '').getTime();
  const cachedAccessCurrent = Boolean(cachedAccess?.hasAccess)
    && (!Number.isFinite(cachedExpirationTime) || cachedExpirationTime > now);
  const active = nativeAccessCurrent || backendAccessCurrent || cachedAccessCurrent;

  return {
    active,
    activeTrial: Boolean(
      (subscription.activeTrial && nativeAccessCurrent)
      || (backendAccess.activeTrial && backendAccessCurrent)
      || (cachedAccess?.activeTrial && cachedAccessCurrent)
      || localTrialAccess
    ),
    accessSource: backendAccessCurrent
      ? backendAccess.source
      : nativeAccessCurrent
        ? 'revenuecat'
        : cachedAccess?.source,
    sponsorUserId: backendAccessCurrent
      ? backendAccess.sponsorUserId
      : cachedAccessCurrent
        ? cachedAccess?.sponsorUserId
        : null,
    expirationDate: nativeAccessCurrent
      ? subscription.expirationDate || ''
      : backendAccessCurrent
        ? backendAccess.expiresAt || ''
        : cachedAccessCurrent
          ? cachedAccess?.expiresAt || ''
          : subscription.expirationDate || backendAccess.expiresAt || '',
    message: backendAccessCurrent
      ? backendAccess.source === 'parent'
        ? 'Premium access is covered by a linked parent account.'
        : 'Premium access is active.'
      : nativeAccessCurrent || cachedAccessCurrent
        ? 'Premium access is active.'
        : subscription.message || ''
  };
}
