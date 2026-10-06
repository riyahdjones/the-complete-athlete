import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeGoalWidget = registerPlugin('TCAGoalWidget');

export function normalizeWidgetGoals(goals = [], standards = []) {
  return goals
    .filter((goal) => goal && goal.id != null && String(goal.label || '').trim())
    .map((goal) => {
      const linkedStandards = standards.filter((standard) => String(standard.goalId) === String(goal.id));
      const nextActivity = linkedStandards.find((standard) => !standard.done) ?? linkedStandards[0];
      return {
        id: String(goal.id),
        name: String(goal.label).trim(),
        detail: String(goal.value || '').trim(),
        progress: Math.max(0, Math.min(100, Math.round(Number(goal.progress) || 0))),
        linkedActivity: String(nextActivity?.label || goal.value || 'Keep building today.').trim()
      };
    });
}

export async function syncGoalWidgets({ goals, standards }) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return false;
  await NativeGoalWidget.syncGoals({ goals: normalizeWidgetGoals(goals, standards) });
  return true;
}
