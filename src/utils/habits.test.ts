import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addHabit,
  defaultHabits,
  dueNow,
  emptyStore,
  loadNotified,
  loadStore,
  markNotified,
  reminderText,
  removeHabit,
  saveStore,
  setDone,
  streakFor,
  toLocalNow,
  updateHabit,
  validateHabitInput,
  weekProgress,
  weekdayOf,
  HABITS_STORAGE_KEY,
  MAX_HABITS,
  type Habit,
  type HabitStore,
} from './habits';

const NOW = '2026-11-01T00:00:00.000Z';
// 2026-11-12 is a Thursday.
const TODAY = '2026-11-12';

function mem(initial?: Record<string, string>) {
  const m = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

const custom = (store: HabitStore, name = 'Stretch', time = '08:30', days = [0, 1, 2, 3, 4, 5, 6], remind = true) =>
  addHabit(store, { name, time, days, remind }, { id: 'h_' + name.toLowerCase(), now: '2026-11-01T00:00:00.000Z' });

test('H1: built-in habits start with reminders off and cannot be removed', () => {
  const s = emptyStore(NOW);
  assert.equal(s.habits.length, 6);
  assert.ok(s.habits.every((h) => h.builtin && h.remind === false));
  assert.throws(() => removeHabit(s, 'b_water'), /Built-in/);
});

test('H2: weekday and local-now helpers', () => {
  assert.equal(weekdayOf(TODAY), 4);
  const n = toLocalNow(new Date(2026, 10, 12, 9, 5));
  assert.deepEqual(n, { date: '2026-11-12', minutes: 545, weekday: 4 });
});

test('H3: validation rejects blank, long, duplicate, bad time and no days', () => {
  const s = custom(emptyStore(NOW));
  const ok = { name: 'Read', time: '21:00', days: [1], remind: true };
  assert.deepEqual(validateHabitInput(ok, s.habits), []);
  assert.ok(validateHabitInput({ ...ok, name: '  ' }, s.habits).length > 0);
  assert.ok(validateHabitInput({ ...ok, name: 'x'.repeat(41) }, s.habits).length > 0);
  assert.ok(validateHabitInput({ ...ok, name: 'stretch' }, s.habits).some((e) => e.includes('already')));
  assert.ok(validateHabitInput({ ...ok, time: '24:00' }, s.habits).length > 0);
  assert.ok(validateHabitInput({ ...ok, time: '9:00' }, s.habits).length > 0);
  assert.ok(validateHabitInput({ ...ok, days: [] }, s.habits).length > 0);
  assert.ok(validateHabitInput({ ...ok, days: [7] }, s.habits).length > 0);
});

test('H4: add, update, remove a custom habit; removal drops its history only', () => {
  let s = custom(emptyStore(NOW));
  s = setDone(s, 'h_stretch', TODAY, true, TODAY);
  s = setDone(s, 'b_water', TODAY, true, TODAY);
  s = updateHabit(s, 'h_stretch', { time: '07:15', remind: false });
  const h = s.habits.find((x) => x.id === 'h_stretch')!;
  assert.equal(h.time, '07:15');
  assert.equal(h.remind, false);
  assert.throws(() => updateHabit(s, 'h_stretch', { name: 'Drink water' }), /already/);
  s = removeHabit(s, 'h_stretch');
  assert.equal(s.habits.some((x) => x.id === 'h_stretch'), false);
  assert.deepEqual(s.done[TODAY], ['b_water']);
});

test('H5: a store holds at most 20 habits', () => {
  let s = emptyStore(NOW);
  for (let i = 0; s.habits.length < MAX_HABITS; i++) s = custom(s, 'Habit ' + i);
  assert.throws(() => custom(s, 'One too many'), /up to 20/);
});

test('H6: done toggles, refuses future days, and is idempotent', () => {
  let s = emptyStore(NOW);
  s = setDone(s, 'b_water', TODAY, true, TODAY);
  s = setDone(s, 'b_water', TODAY, true, TODAY);
  assert.deepEqual(s.done[TODAY], ['b_water']);
  s = setDone(s, 'b_water', TODAY, false, TODAY);
  assert.equal(TODAY in s.done, false);
  assert.throws(() => setDone(s, 'b_water', '2026-11-13', true, TODAY), /future/);
  assert.throws(() => setDone(s, 'nope', TODAY, true, TODAY), /not found/);
  assert.throws(() => setDone(s, 'b_water', 'x', true, TODAY), /valid date/);
});

test('H7: streak counts consecutive scheduled days and is not broken by today not yet done', () => {
  let s = custom(emptyStore(NOW), 'Stretch');
  const h = s.habits.find((x) => x.id === 'h_stretch')!;
  assert.equal(streakFor(s, h, TODAY), 0);
  s = setDone(s, 'h_stretch', '2026-11-10', true, TODAY);
  s = setDone(s, 'h_stretch', '2026-11-11', true, TODAY);
  assert.equal(streakFor(s, h, TODAY), 2); // today not done yet: streak stays 2
  s = setDone(s, 'h_stretch', TODAY, true, TODAY);
  assert.equal(streakFor(s, h, TODAY), 3);
  s = setDone(s, 'h_stretch', '2026-11-08', true, TODAY); // gap on the 9th breaks it
  assert.equal(streakFor(s, h, TODAY), 3);
});

test('H8: streak skips days the habit is not scheduled', () => {
  // Mon, Wed, Fri habit. TODAY is Thursday: not scheduled.
  let s = custom(emptyStore(NOW), 'Lift', '18:00', [1, 3, 5]);
  const h = s.habits.find((x) => x.id === 'h_lift')!;
  s = setDone(s, 'h_lift', '2026-11-11', true, TODAY); // Wed
  s = setDone(s, 'h_lift', '2026-11-09', true, TODAY); // Mon
  s = setDone(s, 'h_lift', '2026-11-06', true, TODAY); // Fri
  assert.equal(streakFor(s, h, TODAY), 3);
  const p = weekProgress(s, h, TODAY);
  assert.deepEqual(p, { done: 3, scheduled: 3 });
});

test('H9: dueNow respects reminder flag, weekday, time, done and already reminded', () => {
  let s = custom(emptyStore(NOW), 'Stretch', '08:30');
  s = custom(s, 'Late', '20:00');
  s = custom(s, 'Off', '08:00', [0, 1, 2, 3, 4, 5, 6], false);
  s = custom(s, 'Weekend', '08:00', [0, 6]);
  const now = { date: TODAY, minutes: 9 * 60, weekday: 4 };
  assert.deepEqual(dueNow(s, now, {}).map((h) => h.name), ['Stretch']);
  assert.deepEqual(dueNow(s, { ...now, minutes: 8 * 60 + 29 }, {}), []);
  const done = setDone(s, 'h_stretch', TODAY, true, TODAY);
  assert.deepEqual(dueNow(done, now, {}), []);
  assert.deepEqual(dueNow(s, now, { [TODAY]: ['h_stretch'] }), []);
  assert.deepEqual(dueNow(s, { ...now, minutes: 21 * 60 }, { [TODAY]: ['h_stretch'] }).map((h) => h.name), ['Late']);
});

test('H10: markNotified keeps only today and never duplicates', () => {
  const n = markNotified({ '2026-11-11': ['a'] }, ['x', 'x'], TODAY);
  assert.deepEqual(n, { [TODAY]: ['x'] });
  assert.deepEqual(markNotified(n, ['y', 'x'], TODAY), { [TODAY]: ['x', 'y'] });
});

test('H11: reminder text is neutral and names the habit', () => {
  const h = defaultHabits(NOW)[0] as Habit;
  const t = reminderText(h);
  assert.ok(t.body.includes(h.name));
  assert.ok(!/(should|must|doctor|treat|cure|risk|disease)/i.test(t.title + t.body));
});

test('H12: storage round trip; malformed data is dropped; built-ins are restored', () => {
  let s = custom(emptyStore(NOW));
  s = setDone(s, 'h_stretch', TODAY, true, TODAY);
  const st = mem();
  assert.equal(saveStore(st, s), true);
  assert.deepEqual(loadStore(st, NOW), s);
  assert.deepEqual(loadStore(mem({ [HABITS_STORAGE_KEY]: 'not json' }), NOW), emptyStore(NOW));
  const partial = { habits: [{ id: 'junk' }, s.habits[6]], done: { bad: ['x'], [TODAY]: ['h_stretch', 5] } };
  const loaded = loadStore(mem({ [HABITS_STORAGE_KEY]: JSON.stringify(partial) }), NOW);
  assert.equal(loaded.habits.filter((h) => h.builtin).length, 6);
  assert.equal(loaded.habits.some((h) => h.id === 'junk'), false);
  assert.deepEqual(loaded.done, { [TODAY]: ['h_stretch'] });
  const full = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.equal(saveStore(full, s), false);
  assert.deepEqual(loadNotified(mem({ forge_habits_notified_v1: '[1]' })), {});
});
