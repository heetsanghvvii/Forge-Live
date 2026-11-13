import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedMacroMetrics, mealEnteredMetrics, nextConfirmedProgrammeStart, loadFromCloudMessage } from './settingsLogic';

const m = (calories: number, protein: number) => ({ calories, protein, fat: 0, carbs: 0 });

test('changedMacroMetrics marks only the changed metric', () => {
  assert.deepEqual(changedMacroMetrics(m(100, 10), m(200, 10)), { calories: true, protein: false });
  assert.deepEqual(changedMacroMetrics(m(100, 10), m(100, 0)), { calories: false, protein: true });
  assert.deepEqual(changedMacroMetrics(m(100, 10), m(100, 10)), { calories: false, protein: false });
  assert.deepEqual(changedMacroMetrics(undefined, m(0, 0)), { calories: true, protein: true });
});

test('mealEnteredMetrics only includes touched fields (0 counts)', () => {
  assert.deepEqual(mealEnteredMetrics({ calories: false, protein: false }), []);
  assert.deepEqual(mealEnteredMetrics({ calories: true, protein: false }), ['calories']);
  assert.deepEqual(mealEnteredMetrics({ calories: true, protein: true }), ['calories', 'protein']);
});

test('nextConfirmedProgrammeStart preserves flag unless date changed', () => {
  assert.equal(nextConfirmedProgrammeStart(undefined, false, '2026-10-25'), undefined);
  assert.equal(nextConfirmedProgrammeStart(false, false, '2026-10-25'), false);
  assert.equal(nextConfirmedProgrammeStart(true, false, ''), true);
  assert.equal(nextConfirmedProgrammeStart(undefined, true, '2026-10-26'), true);
});

test('loadFromCloudMessage shows conflicts and never says nothing new with conflicts', () => {
  const r = loadFromCloudMessage({ added: 0, conflicts: 7, conflictList: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
  assert.ok(r.text.includes('7 value(s) differ between this device and the cloud; your local values were kept; nothing was overwritten'));
  assert.ok(!r.text.includes('nothing new'));
  assert.ok(r.text.includes('e') && !r.text.includes('f;') && r.text.includes('+2 more'));
  assert.ok(loadFromCloudMessage({ added: 0, conflicts: 0 }).text.includes('nothing new'));
  assert.ok(loadFromCloudMessage({ added: 3, conflicts: 0 }).text.startsWith('Loaded 3'));
});
