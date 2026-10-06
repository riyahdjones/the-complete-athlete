import test from 'node:test';
import assert from 'node:assert/strict';
import { localizePlans, translateText } from '../src/i18n.js';
import spanishPlans from '../src/performancePlans.es.json' with { type: 'json' };

test('Spanish lesson assets contain 44 complete lessons with stable IDs', () => {
  assert.equal(Object.keys(spanishPlans).length, 44);
  for (const [id, plan] of Object.entries(spanishPlans)) {
    assert.ok(id && plan.title && plan.subject && plan.challengeDay);
    assert.ok(plan.steps.length && plan.steps.every((step) => step.trim().length > 100));
  }
});

test('empty database translations fall back to bundled Spanish text without changing progress keys', () => {
  const english = [{ id: 'lesson-1', title: 'English', subject: 'Series: Confidence. Original', steps: ['English lesson'], stepsEs: [], completedAt: '2026-10-01' }];
  const localized = localizePlans(english, 'es', { 'lesson-1': { title: 'Español', subject: 'Serie: Confianza.', steps: ['Lección en español'] } });
  assert.equal(localized[0].id, 'lesson-1');
  assert.equal(localized[0].completedAt, '2026-10-01');
  assert.equal(localized[0].subjectEn, english[0].subject);
  assert.deepEqual(localized[0].steps, ['Lección en español']);
  assert.equal(english[0].title, 'English');
  assert.equal(localizePlans(english, 'en'), english);
});

test('Spanish interface copy preserves dynamic names and whitespace', () => {
  assert.equal(translateText('  Create account  ', 'es'), '  Crear cuenta  ');
  assert.equal(translateText('Good morning, Kegan', 'es'), 'Buenos días, Kegan');
  assert.equal(translateText('5 Days', 'es'), '5 Días');
  assert.equal(translateText('Settings', 'en'), 'Settings');
  assert.equal(translateText('review-parent@example.com', 'es'), 'review-parent@example.com');
});

test('published lessons with new IDs use a translation only for matching seed content', () => {
  const seed = { id: 'seed', title: 'Original', subject: 'Series: Original.', steps: ['Original text'] };
  const published = { ...seed, id: 'database-uuid' };
  const assets = { seed: { title: 'Traducción', steps: ['Texto traducido'] } };
  assert.equal(localizePlans([published], 'es', assets, [seed])[0].title, 'Traducción');
  assert.equal(localizePlans([{ ...published, steps: ['Updated text'] }], 'es', assets, [seed])[0].title, 'Original');
});
