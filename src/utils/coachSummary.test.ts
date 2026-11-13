import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmedAverage, loggedDaySummary } from './coachSummary';
import type { DailyLog } from '../types';

const mk = (day: number, extra: Partial<DailyLog> = {}): DailyLog =>
  ({
    date: `2026-01-${String(day).padStart(2, '0')}`,
    dayNumber: day,
    phase: 'phase1',
    macrosConsumed: { calories: 0, protein: 0, fat: 0, carbs: 0 },
    waterMl: 0,
    steps: 0,
    ...extra
  }) as DailyLog;

test('entered zero counts and lowers the average', () => {
  const logs = [
    mk(1, { steps: 10000, entered: { steps: true } }),
    mk(2, { steps: 0, entered: { steps: true } })
  ];
  assert.equal(confirmedAverage(logs, 'steps'), 5000);
  assert.equal(loggedDaySummary(logs, 'steps').entered, 2);
});

test('unconfirmed and missing are excluded from the denominator', () => {
  const logs = [
    mk(1, { steps: 8000, entered: { steps: true } }),
    mk(2, { steps: 20000 }), // legacy, unconfirmed
    mk(3, { steps: 0 }), // legacy, missing
    mk(4, { steps: 3000, entered: { steps: false } }) // explicitly not entered
  ];
  assert.equal(confirmedAverage(logs, 'steps'), 8000);
  assert.deepEqual(loggedDaySummary(logs, 'steps'), { entered: 1, unconfirmed: 1, missing: 2, totalDays: 4 });
});

test('null when no entered days', () => {
  assert.equal(confirmedAverage([], 'sleep'), null);
  assert.equal(confirmedAverage([mk(1, { sleepHours: 7 })], 'sleep'), null);
});

test('per-metric denominators differ', () => {
  const logs = [
    mk(1, { sleepHours: 8, steps: 4000, entered: { sleep: true, steps: true } }),
    mk(2, { sleepHours: 6, entered: { sleep: true } }),
    mk(3, { steps: 6000, entered: { steps: true } })
  ];
  assert.equal(loggedDaySummary(logs, 'sleep').entered, 2);
  assert.equal(loggedDaySummary(logs, 'steps').entered, 2);
  assert.equal(loggedDaySummary(logs, 'water').entered, 0);
  assert.equal(confirmedAverage(logs, 'sleep'), 7);
  assert.equal(confirmedAverage(logs, 'steps'), 5000);
});
