import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyChecklistItems, dailyProgress } from './dailyProgress';
import { DailyChecklist } from '../types';

const blank: DailyChecklist = { workout: false, cardio: false, water: false, photo: false, community: false };

test('phase 1 (days 1-7) has 6 items incl. cleanEating', () => {
  for (const d of [1, 3, 7]) {
    const items = dailyChecklistItems(d);
    assert.equal(items.length, 6);
    assert.ok(items.some((i) => i.key === 'cleanEating'));
    assert.ok(!items.some((i) => i.key === 'abs'));
  }
});

test('phase 2 (days 8-35) has 9 items incl. abs and steps', () => {
  for (const d of [8, 20, 35]) {
    const items = dailyChecklistItems(d);
    assert.equal(items.length, 9);
    assert.ok(items.some((i) => i.key === 'abs'));
    assert.ok(!items.some((i) => i.key === 'cleanEating'));
  }
});

test('phase 3 (day 36+) has 9 items incl. sleep and prePostCarbs', () => {
  const items = dailyChecklistItems(36);
  assert.equal(items.length, 9);
  assert.ok(items.some((i) => i.key === 'sleep'));
  assert.ok(items.some((i) => i.key === 'prePostCarbs'));
});

test('progress counts only the phase items that are ticked', () => {
  const p = dailyProgress({ ...blank, workout: true, water: true, sleep: true }, 8);
  assert.equal(p.completedCount, 2); // sleep is not a phase-2 item
  assert.equal(p.totalItems, 9);
  assert.equal(p.progressPercent, 22);
  assert.equal(p.isDayComplete, false);
});

test('completion when every phase item is ticked', () => {
  const all = Object.fromEntries(dailyChecklistItems(3).map((i) => [i.key, true])) as unknown as DailyChecklist;
  const p = dailyProgress(all, 3);
  assert.equal(p.isDayComplete, true);
  assert.equal(p.progressPercent, 100);
});

test('unticking drops completion back down', () => {
  const all = Object.fromEntries(dailyChecklistItems(3).map((i) => [i.key, true])) as unknown as DailyChecklist;
  const p = dailyProgress({ ...all, water: false }, 3);
  assert.equal(p.isDayComplete, false);
  assert.equal(p.completedCount, 5);
});
