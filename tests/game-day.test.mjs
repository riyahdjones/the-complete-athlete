import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_DAY_QUESTIONS, selectGameDayQuestions } from '../src/gameDayQuestions.js';

test('question bank contains all 80 active questions', () => {
  assert.equal(GAME_DAY_QUESTIONS.length, 80);
  assert.equal(GAME_DAY_QUESTIONS.every((question) => question.active), true);
});

test('a session selects three different categories', () => {
  const selected = selectGameDayQuestions([], () => 0.42);
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((question) => question.category)).size, 3);
});

test('questions from the last five sessions are excluded when alternatives exist', () => {
  const recent = [{ questionIds: ['gd-confidence-1', 'gd-focus-1', 'gd-controllables-1'] }];
  const selected = selectGameDayQuestions(recent, () => 0.42);
  assert.equal(selected.some((question) => recent[0].questionIds.includes(question.id)), false);
});
