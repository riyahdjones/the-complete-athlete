import assert from 'node:assert/strict';
import test from 'node:test';
import { gameDayCheckInPointKey, localGameDayDateKey } from '../src/gameDayRewards.js';

test('uses the athlete local calendar date', () => {
  const morning = new Date(2026, 8, 24, 8, 15);
  const evening = new Date(2026, 8, 24, 21, 45);

  assert.equal(localGameDayDateKey(morning), '2026-09-24');
  assert.equal(localGameDayDateKey(evening), '2026-09-24');
});

test('every check-in for the same athlete and day gets one point key', () => {
  const firstCheckIn = gameDayCheckInPointKey('athlete-1', new Date(2026, 8, 24, 9, 0));
  const secondCheckIn = gameDayCheckInPointKey('athlete-1', new Date(2026, 8, 24, 18, 30));

  assert.equal(firstCheckIn, secondCheckIn);
});

test('a new day can earn a new reward', () => {
  const firstDay = gameDayCheckInPointKey('athlete-1', new Date(2026, 8, 24, 18, 30));
  const nextDay = gameDayCheckInPointKey('athlete-1', new Date(2026, 8, 25, 7, 0));

  assert.notEqual(firstDay, nextDay);
});

test('different athletes do not share a reward key', () => {
  const date = new Date(2026, 8, 24, 18, 30);

  assert.notEqual(gameDayCheckInPointKey('athlete-1', date), gameDayCheckInPointKey('athlete-2', date));
});
