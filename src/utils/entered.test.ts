import test from 'node:test';
import assert from 'node:assert/strict';
import { DailyLog } from '../types';
import { metricStatus, markEntered, confirmedValue } from './entered';

const blank = (over: Partial<DailyLog> = {}): DailyLog =>
  ({
    date: '2026-01-01',
    dayNumber: 1,
    phase: 'phase1',
    checklist: {},
    macrosConsumed: { calories: 0, protein: 0, fat: 0, carbs: 0 },
    waterMl: 0,
    steps: 0,
    supplements: {},
    ...over
  }) as unknown as DailyLog;

test('legacy 7.5 sleep with no flag is unconfirmed, not entered', () => {
  const log = blank({ sleepHours: 7.5 });
  assert.equal(metricStatus(log, 'sleep'), 'unconfirmed');
  assert.equal(confirmedValue(log, 'sleep'), undefined);
});

test('new record with no sleep is missing', () => {
  assert.equal(metricStatus(blank(), 'sleep'), 'missing');
  assert.equal(metricStatus(blank(), 'energy'), 'missing');
});

test('explicit 0 with flag true counts as entered', () => {
  const log = markEntered(blank(), 'steps');
  assert.equal(metricStatus(log, 'steps'), 'entered');
  assert.equal(confirmedValue(log, 'steps'), 0);
});

test('flag false means missing even if a value is stored, value is kept', () => {
  const log = blank({ sleepHours: 7.5, entered: { sleep: false } });
  assert.equal(metricStatus(log, 'sleep'), 'missing');
  assert.equal(log.sleepHours, 7.5);
});

test('markEntered only touches the entered flags', () => {
  const log = blank({ waterMl: 500, entered: { steps: false } });
  const next = markEntered(log, 'water');
  assert.equal(next.waterMl, 500);
  assert.deepEqual(next.entered, { steps: false, water: true });
  assert.deepEqual({ ...next, entered: undefined }, { ...log, entered: undefined });
  assert.deepEqual(log.entered, { steps: false });
});
