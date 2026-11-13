import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNumberInput, fmtNum, addToCounter, undoCounterDelta, deltaToReachGoal,
  addMacros, subtractMacros, removeMealById, MAX_WATER_ML, MAX_STEPS,
} from './inputs';
import { parseSleepInput } from './sleep';

const R = { min: 20, max: 400, decimals: 1, label: 'Weight' };

test('parseNumberInput accepts comma and dot decimals', () => {
  assert.deepEqual(parseNumberInput('72,5', R), { ok: true, value: 72.5 });
  assert.deepEqual(parseNumberInput(' 72.5 ', R), { ok: true, value: 72.5 });
  assert.deepEqual(parseNumberInput('72', R), { ok: true, value: 72 });
});
test('parseNumberInput rejects blank, NaN, Infinity, scientific, hex, junk', () => {
  for (const bad of ['', '  ', 'NaN', 'Infinity', '-Infinity', '1e5', '1E5', '0x10', '7 2', '72kg', '1,000.5', '--5', '.', ',']) {
    assert.equal(parseNumberInput(bad, R).ok, false, `should reject "${bad}"`);
  }
  const sci = parseNumberInput('1e5', R);
  assert.ok(!sci.ok && /scientific/i.test(sci.error));
  assert.equal(parseNumberInput(null as any, R).ok, false);
});
test('parseNumberInput enforces bounds and negatives', () => {
  assert.equal(parseNumberInput('19.9', R).ok, false);
  assert.equal(parseNumberInput('401', R).ok, false);
  assert.equal(parseNumberInput('20', R).ok, true);
  assert.equal(parseNumberInput('400', R).ok, true);
  const neg = parseNumberInput('-5', { min: 0, max: 10 });
  assert.ok(!neg.ok && /negative/i.test(neg.error));
  assert.equal(parseNumberInput('0', { min: 0, max: 10000, decimals: 0 }).ok, true);
  assert.deepEqual(parseNumberInput('72.46', R), { ok: true, value: 72.5 });
});
test('sleep: 47 hours is rejected with a clear message', () => {
  const r = parseSleepInput('47');
  assert.ok(!r.ok && /0 and 24/.test(r.error));
});
test('fmtNum renders "-" for non-finite', () => {
  assert.equal(fmtNum(NaN), '-'); assert.equal(fmtNum(undefined), '-'); assert.equal(fmtNum(Infinity), '-');
  assert.equal(fmtNum(72.5), '72.5'); assert.equal(fmtNum(1.234, 1), '1.2');
});

test('undo of the OLDEST of three quick +500ml taps removes only 500ml', () => {
  let water = 0;
  const taps = [1, 2, 3].map(() => { const c = addToCounter(water, 500, MAX_WATER_ML, 'water'); water = c.next; return c; });
  assert.equal(water, 1500);
  water = undoCounterDelta(water, taps[0].applied); // old click-time restore would give 0
  assert.equal(water, 1000);
  water = undoCounterDelta(water, taps[2].applied);
  assert.equal(water, 500);
});
test('counter caps with message; undo only reverses what was applied', () => {
  const c = addToCounter(19900, 500, MAX_WATER_ML, 'water');
  assert.equal(c.next, 20000); assert.equal(c.applied, 100); assert.ok(c.message);
  assert.equal(undoCounterDelta(c.next, c.applied), 19900);
  const full = addToCounter(100000, 1000, MAX_STEPS, 'steps');
  assert.equal(full.applied, 0); assert.ok(full.message);
  assert.equal(addToCounter(0, -500, MAX_WATER_ML, 'water').next, 0);
});
test('Hit 10k never lowers steps above 10k and is undoable', () => {
  assert.equal(deltaToReachGoal(15000, 10000), 0);
  const d = deltaToReachGoal(4000, 10000);
  assert.equal(d, 6000);
  const c = addToCounter(4000, d, MAX_STEPS, 'steps');
  assert.equal(undoCounterDelta(c.next, c.applied), 4000);
});
test('macro undo subtracts only that action; meal removal removes only that meal', () => {
  const base = { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const a = addMacros(base, { protein: 25, calories: 120 });
  const b = addMacros(a, { protein: 10, calories: 50 });
  assert.deepEqual(subtractMacros(b, { protein: 25, calories: 120 }), { calories: 50, protein: 10, fat: 0, carbs: 0 });
  assert.deepEqual(subtractMacros(base, { protein: 5 }), base);
  assert.deepEqual(addMacros({ calories: NaN } as any, { calories: 5 }).calories, 5);
  const meals = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(removeMealById(meals, 'b').map((m) => m.id), ['a', 'c']);
  assert.deepEqual(removeMealById(undefined, 'x'), []);
});
