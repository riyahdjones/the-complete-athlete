import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWidgetGoals } from '../src/goalWidget.js';

test('goal widget data excludes completion dates and keeps the next linked activity', () => {
  const goals = [{ id: 7, label: 'Make varsity', value: 'Earn my role', progress: 38, targetDate: '2027-08-01' }];
  const standards = [
    { goalId: 7, label: 'Film study', done: true },
    { goalId: 7, label: 'Complete speed workout', done: false }
  ];
  const [widgetGoal] = normalizeWidgetGoals(goals, standards);
  assert.deepEqual(widgetGoal, {
    id: '7',
    name: 'Make varsity',
    detail: 'Earn my role',
    progress: 38,
    linkedActivity: 'Complete speed workout'
  });
  assert.equal('targetDate' in widgetGoal, false);
});

test('goal widget progress is rounded and clamped', () => {
  const widgets = normalizeWidgetGoals([
    { id: 'a', label: 'First', progress: -10 },
    { id: 'b', label: 'Second', progress: 150.7 }
  ]);
  assert.deepEqual(widgets.map((goal) => goal.progress), [0, 100]);
});
