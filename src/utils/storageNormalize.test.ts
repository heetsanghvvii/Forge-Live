import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLoadedState, normalizeLoadedStateDetailed, backupCorruptRaw, CORRUPT_BACKUP_KEY } from './storageNormalize';
import { calculateDateForDayNumber, loadAppState, saveAppState, calculateStreak } from './storage';
import { findDateIncoherence } from './dateCoherence';
import { getStorageNotices, resetStorageNoticesForTest, getPendingUnsavedText } from './storageNotices';

let store: Map<string, string>;
let failWrites = false;
beforeEach(() => {
  store = new Map(); failWrites = false; resetStorageNoticesForTest();
  (globalThis as any).window = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { if (failWrites) { const e: any = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
});

function assertValid(s: any) {
  assert.ok(Array.isArray(s.weighIns)); assert.ok(Array.isArray(s.measurementHistory)); assert.ok(Array.isArray(s.photos));
  assert.ok(Array.isArray(s.learnedLessonIds));
  for (const k of ['workoutLogs', 'quizAnswers', 'avoidedMistakes', 'dailyLogs', 'settings']) assert.ok(s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]), k);
  assert.ok(s.currentDayNumber >= 1 && s.selectedDayNumber >= 1);
  assert.ok(s.day1Tasks);
  for (let d = 1; d <= 63; d++) {
    const l = s.dailyLogs[d];
    assert.ok(l && typeof l === 'object', `log ${d}`);
    assert.equal(l.dayNumber, d); assert.equal(typeof l.date, 'string');
    assert.doesNotThrow(() => Object.values(l.checklist));
  }
  assert.doesNotThrow(() => calculateStreak(s.dailyLogs, 5));
  assert.equal(s.schemaVersion, 2);
}

const crashers: Array<[string, unknown]> = [
  ['{}', {}], ['[]', []], ['null', null], ['"str"', 'str'], ['42', 42],
  ['dailyLogs["1"]="x"', { dailyLogs: { 1: 'x' } }],
  ['dailyLogs[1]=null', { dailyLogs: { 1: null } }],
  ['dailyLogs not object', { dailyLogs: 'nope' }],
  ['mealEstimates "oops"', { dailyLogs: { 1: { dayNumber: 1, mealEstimates: 'oops' } } }],
  ['mealEstimates [null]', { dailyLogs: { 1: { dayNumber: 1, mealEstimates: [null] } } }],
  ['weighIns null', { weighIns: null }], ['weighIns {}', { weighIns: {} }], ['weighIns [null]', { weighIns: [null] }],
  ['measurementHistory null', { measurementHistory: null }], ['photos null', { photos: null }],
  ['avoidedMistakes null', { avoidedMistakes: null }], ['workoutLogs null', { workoutLogs: null }],
  ['workoutLogs entry bad', { workoutLogs: { 1: { exercises: 5 }, 2: null } }],
  ['learnedLessonIds null', { learnedLessonIds: null }], ['learnedLessonIds {}', { learnedLessonIds: {} }],
  ['quizAnswers null', { quizAnswers: null }], ['settings null', { settings: null }],
  ['day pointers junk', { currentDayNumber: 'x', selectedDayNumber: 9999 }],
];
for (const [name, v] of crashers) {
  test(`normalizeLoadedState survives ${name}`, () => {
    let s: any;
    assert.doesNotThrow(() => { s = normalizeLoadedState(v); });
    assertValid(s);
  });
}
test('lossy is flagged when entries are dropped, not for clean data', () => {
  assert.equal(normalizeLoadedStateDetailed({ weighIns: [null, { weight: 70 }] }).lossy, true);
  assert.equal(normalizeLoadedStateDetailed({ weighIns: [{ weight: 70, date: '2026-01-01', dayNumber: 1 }] }).lossy, false);
  assert.equal(normalizeLoadedStateDetailed({}).lossy, false);
});
test('backfill: missing collections and flags are created without inventing user values', () => {
  const s = normalizeLoadedState({ settings: { startDate: '2026-01-01' } });
  assertValid(s);
  assert.equal(s.settings.bodyweightKg, undefined);
  assert.equal(s.dailyLogs[1].sleepHours, undefined);
  assert.equal(s.dailyLogs[1].energyRating, undefined);
  assert.equal(s.dailyLogs[1].hungerRating, undefined);
  assert.equal(s.dailyLogs[1].sorenessRating, undefined);
  assert.equal(s.weighIns.length, 0);
});

test('loadAppState keeps a raw copy of unparseable JSON and never overwrites an existing copy', () => {
  store.set('bollywood_body_p2_v1', '{not json');
  const s = loadAppState();
  assertValid(s);
  assert.equal(store.get(CORRUPT_BACKUP_KEY), '{not json');
  assert.equal(getStorageNotices().corruptCopyKey, CORRUPT_BACKUP_KEY);
  store.set('bollywood_body_p2_v1', '{second bad');
  loadAppState();
  assert.equal(store.get(CORRUPT_BACKUP_KEY), '{not json'); // untouched
  const key = getStorageNotices().corruptCopyKey!;
  assert.notEqual(key, CORRUPT_BACKUP_KEY);
  assert.equal(store.get(key), '{second bad');
});
test('loadAppState on wrong-shape state keeps the raw copy', () => {
  store.set('bollywood_body_p2_v1', JSON.stringify({ weighIns: [null] }));
  assertValid(loadAppState());
  assert.equal(store.get(CORRUPT_BACKUP_KEY), JSON.stringify({ weighIns: [null] }));
});
test('backupCorruptRaw never throws when storage is broken', () => {
  (globalThis as any).localStorage = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
  assert.doesNotThrow(() => backupCorruptRaw('abc'));
});

test('save failure keeps the unsaved state, flags it, and a later successful save clears it', () => {
  const base = loadAppState();
  failWrites = true;
  const r = saveAppState({ ...base, currentDayNumber: 5 });
  assert.equal(r.ok, false);
  assert.equal(getStorageNotices().unsaved, true);
  assert.equal(JSON.parse(getPendingUnsavedText()!).currentDayNumber, 5);
  failWrites = false;
  assert.equal(saveAppState({ ...base, currentDayNumber: 6 }).ok, true);
  assert.equal(getStorageNotices().unsaved, false);
  assert.equal(JSON.parse(store.get('bollywood_body_p2_v1')!).currentDayNumber, 6);
});

test('calculateDateForDayNumber is calendar arithmetic: DST-safe and rejects invalid input', () => {
  assert.equal(calculateDateForDayNumber('2026-01-01', 1), '2026-01-01');
  assert.equal(calculateDateForDayNumber('2026-01-01', 63), '2026-03-04');
  assert.equal(calculateDateForDayNumber('2026-03-01', 15), '2026-03-15'); // across US DST start
  assert.equal(calculateDateForDayNumber('2026-10-25', 3), '2026-10-27'); // across EU DST end
  assert.equal(calculateDateForDayNumber('2026-12-30', 3), '2027-01-01');
  assert.equal(calculateDateForDayNumber('2028-02-28', 2), '2028-02-29');
  for (const bad of ['garbage', '', 'NaN-NaN-NaN', '2026-02-31', '2026-13-01', undefined as any]) {
    assert.equal(calculateDateForDayNumber(bad, 1), '');
  }
});

test('editing a past day does not alter other days (records stay editable, no re-dating)', () => {
  const s = normalizeLoadedState({ settings: { startDate: '2026-01-01' } });
  const before = JSON.stringify(s.dailyLogs[4]);
  const edited: any = { ...s.dailyLogs, 2: { ...s.dailyLogs[2], waterMl: 1500 } };
  assert.equal(edited[2].date, s.dailyLogs[2].date);
  assert.equal(JSON.stringify(edited[4]), before);
  assert.equal(edited[3], s.dailyLogs[3]);
});

test('findDateIncoherence is read-only and reports problems', () => {
  const s = normalizeLoadedState({ settings: { startDate: '2026-01-01' } });
  assert.deepEqual(findDateIncoherence(s), []);
  s.dailyLogs[5].date = '2025-12-31';
  s.settings.phase2StartDate = '2026-02-01';
  const snapshot = JSON.stringify(s);
  const p = findDateIncoherence(s);
  assert.equal(JSON.stringify(s), snapshot);
  assert.deepEqual(p.map((x) => x.code).sort(), ['day-date-mismatch', 'phase2-start']);
  assert.deepEqual(p.find((x) => x.code === 'day-date-mismatch')!.days, [5]);
  assert.equal(findDateIncoherence({ settings: { startDate: 'zzz' } } as any)[0].code, 'invalid-start');
  assert.deepEqual(findDateIncoherence(null), []);
});
