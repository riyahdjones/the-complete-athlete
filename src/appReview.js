import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeReview = registerPlugin('TCAReview');
const reviewStoragePrefix = 'tca-app-review-requested';
const supportedMilestones = new Set([
  'first_locked_day',
  'first_completed_plan',
  'parent_day_one_plan',
  'parent_fifth_app_open'
]);

export function appReviewStorageKey(userId) {
  return `${reviewStoragePrefix}:${String(userId || 'anonymous')}`;
}

export function shouldRequestAppReview({ userId, milestone, storage = globalThis.localStorage }) {
  if (!userId || !supportedMilestones.has(milestone) || !storage) return false;
  return !storage.getItem(appReviewStorageKey(userId));
}

export function parentAppOpenStorageKey(userId) {
  return `tca-parent-app-open-count:${String(userId || 'anonymous')}`;
}

export function recordParentAppOpen({ userId, storage = globalThis.localStorage }) {
  if (!userId || !storage) return 0;
  const key = parentAppOpenStorageKey(userId);
  const previous = Math.max(0, Number.parseInt(storage.getItem(key) || '0', 10) || 0);
  const next = previous + 1;
  storage.setItem(key, String(next));
  return next;
}

export function canRequestNativeAppReview() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

export async function requestAppReview({ userId, milestone }) {
  if (!canRequestNativeAppReview()) return false;
  const storage = globalThis.localStorage;
  if (!shouldRequestAppReview({ userId, milestone, storage })) return false;

  const key = appReviewStorageKey(userId);
  storage.setItem(key, JSON.stringify({ milestone, requestedAt: new Date().toISOString() }));
  try {
    await NativeReview.requestReview();
    return true;
  } catch (error) {
    storage.removeItem(key);
    throw error;
  }
}
