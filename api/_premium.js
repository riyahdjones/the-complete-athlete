import { supabaseServiceRequest } from './_supabase.js';

export function subscriptionIsActive(subscription, now = Date.now()) {
  if (!['active', 'trialing'].includes(String(subscription?.status || ''))) return false;
  if (!subscription?.expires_at) return true;
  const expiresAt = new Date(subscription.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function premiumAccessSetFromRows(subscriptions = [], parentLinks = [], now = Date.now()) {
  const premiumUserIds = new Set(
    subscriptions
      .filter((subscription) => subscriptionIsActive(subscription, now))
      .map((subscription) => subscription.user_id)
      .filter(Boolean)
  );

  parentLinks.forEach((link) => {
    if (premiumUserIds.has(link.parent_user_id) && link.athlete_user_id) {
      premiumUserIds.add(link.athlete_user_id);
    }
  });

  return premiumUserIds;
}

export async function loadPremiumAccessUserIds() {
  const [subscriptionsResult, linksResult] = await Promise.all([
    supabaseServiceRequest('user_subscriptions?select=user_id,status,expires_at&status=in.(active,trialing)'),
    supabaseServiceRequest('parent_links?select=parent_user_id,athlete_user_id')
  ]);

  if (subscriptionsResult.error || linksResult.error) {
    return { userIds: new Set(), error: subscriptionsResult.error || linksResult.error };
  }

  return {
    userIds: premiumAccessSetFromRows(subscriptionsResult.data, linksResult.data),
    error: null
  };
}

export async function userHasPremiumAccess(userId) {
  if (!userId) return false;
  const { userIds, error } = await loadPremiumAccessUserIds();
  return !error && userIds.has(userId);
}
