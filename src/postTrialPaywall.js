export const POST_TRIAL_ACTIVITY_THRESHOLDS = Object.freeze({
  meaningfulDays: 3,
  completedLessons: 3,
  trialDays: 7
});

function dateKey(value) {
  if (!value) return '';
  const direct = String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (direct) return direct;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : '';
}

function trialWindow(expirationDate, trialDays) {
  const endTime = new Date(expirationDate || '').getTime();
  if (!Number.isFinite(endTime)) return null;
  const startTime = endTime - (trialDays * 24 * 60 * 60 * 1000);
  return {
    start: new Date(startTime).toISOString().slice(0, 10),
    end: new Date(endTime).toISOString().slice(0, 10)
  };
}

function isWithin(date, window) {
  return Boolean(date && window && date >= window.start && date <= window.end);
}

export function derivePostTrialActivity({
  expirationDate,
  planProgress = {},
  pointsLedger = [],
  standardsHistory = [],
  thresholds = POST_TRIAL_ACTIVITY_THRESHOLDS
} = {}) {
  const window = trialWindow(expirationDate, thresholds.trialDays);
  const planEntries = Object.entries(planProgress || {})
    .map(([planId, completedAt]) => ({ planId, date: dateKey(completedAt) }))
    .filter((entry) => entry.date);
  const pointEntries = (Array.isArray(pointsLedger) ? pointsLedger : [])
    .map((entry) => ({ ...entry, normalizedDate: dateKey(entry.date || entry.createdAt) }))
    .filter((entry) => entry.normalizedDate && Number(entry.points || 0) > 0);
  const dayEntries = (Array.isArray(standardsHistory) ? standardsHistory : [])
    .map((entry) => dateKey(entry.date || entry.submittedAt))
    .filter(Boolean);

  const scopedPlans = window ? planEntries.filter((entry) => isWithin(entry.date, window)) : [];
  const scopedPoints = window ? pointEntries.filter((entry) => isWithin(entry.normalizedDate, window)) : [];
  const scopedDays = window ? dayEntries.filter((date) => isWithin(date, window)) : [];
  const meaningfulDates = new Set([
    ...scopedDays,
    ...scopedPlans.map((entry) => entry.date),
    ...scopedPoints.map((entry) => entry.normalizedDate)
  ]);
  const completedLessons = scopedPlans.length;
  const pointsEarned = scopedPoints.reduce((total, entry) => total + Number(entry.points || 0), 0);
  const meaningfulDays = meaningfulDates.size;
  const verifiedActivityCount = meaningfulDays + completedLessons;

  const lifetime = {
    meaningfulDays: new Set([
      ...dayEntries,
      ...planEntries.map((entry) => entry.date),
      ...pointEntries.map((entry) => entry.normalizedDate)
    ]).size,
    completedLessons: planEntries.length,
    pointsEarned: pointEntries.reduce((total, entry) => total + Number(entry.points || 0), 0)
  };

  return {
    active: Boolean(window) && (
      meaningfulDays >= thresholds.meaningfulDays
      || completedLessons >= thresholds.completedLessons
    ),
    hasVerifiedActivity: Boolean(window) && verifiedActivityCount > 0,
    meaningfulDays,
    completedLessons,
    pointsEarned,
    window,
    lifetime,
    dataScope: window ? 'trial' : 'unavailable'
  };
}

export function selectPostTrialVariant({ role, activity, previewVariant = '' } = {}) {
  if (role === 'parent') return 'parent';
  // A visual preview must never promote an athlete into the active experience
  // without the same verified activity required in production.
  if (previewVariant === 'active-athlete' && activity?.active) return 'active-athlete';
  if (previewVariant === 'low-activity-athlete') return 'low-activity-athlete';
  return activity?.active ? 'active-athlete' : 'low-activity-athlete';
}
