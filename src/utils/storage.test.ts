import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStoredDailyLogs, calculateStreak, loadAppState } from './storage';

test('normalizeStoredDailyLogs fills absent structural keys only; values are never altered', () => {
  const out = normalizeStoredDailyLogs({
    1: { date: '2026-01-01', dayNumber: 1, phase: 'phase1' } as any,
    2: { date: '2026-01-02', dayNumber: 2, phase: 'phase1', checklist: { workout: true }, macrosConsumed: { calories: 500 }, supplements: { whey: true }, steps: 7, waterMl: 0 } as any
  });
  assert.equal(typeof out[1].checklist, 'object');
  assert.equal(out[1].macrosConsumed.protein, 0);
  assert.equal(out[1].supplements.creatine, false);
  assert.equal(out[1].steps, 0);
  assert.equal(out[2].checklist.workout, true);
  assert.deepEqual(Object.keys(out[2].checklist), ['workout']);
  assert.equal(out[2].macrosConsumed.calories, 500);
  assert.equal(out[2].macrosConsumed.fat, 0);
  assert.equal(out[2].supplements.whey, true);
  assert.equal(out[2].steps, 7);
  assert.doesNotThrow(() => calculateStreak(out, 2));
});

test('loadAppState: stored logs lacking checklist/supplements/macros no longer crash calculateStreak', () => {
  const store = new Map<string, string>();
  store.set('bollywood_body_p2_v1', JSON.stringify({
    settings: { startDate: '2026-01-01' },
    currentDayNumber: 3,
    dailyLogs: { 1: { date: '2026-01-01', dayNumber: 1 }, 2: { date: '2026-01-02', dayNumber: 2, steps: 5 } },
    workoutLogs: {}, weighIns: [], measurementHistory: []
  }));
  (globalThis as any).window = {};
  (globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
  try {
    const s = loadAppState();
    assert.doesNotThrow(() => calculateStreak(s.dailyLogs, 3));
    assert.equal(s.dailyLogs[2].steps, 5);
    assert.equal(typeof s.dailyLogs[1].supplements, 'object');
    assert.equal(typeof s.dailyLogs[3].checklist, 'object');
  } finally {
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
  }
});

test('a fresh install has no invented body measurements or weigh-ins', async () => {
  const { getInitialState } = await import('./storage');
  const s = getInitialState();
  assert.deepEqual(s.measurementHistory, []);
  assert.deepEqual(s.weighIns, []);
});
