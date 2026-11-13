import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeBackup, parseBackup, restoreIsSafe, stateForRestore, padDailyLogs, BACKUP_VERSION, BACKUP_LIMITS } from './backup';
import { createDefaultChecklist } from './storage';
import type { AppState, DailyLog } from '../types';

const dayDate = (d: number) => new Date(Date.UTC(2026, 0, d)).toISOString().slice(0, 10);

const mkLog = (day: number): DailyLog => ({
  date: dayDate(day), dayNumber: day, phase: 'phase1',
  checklist: createDefaultChecklist('phase1'),
  macrosConsumed: { calories: 0, protein: 0, fat: 0, carbs: 0 }, waterMl: 0, steps: 0,
  sleepHours: 0, entered: { sleep: true },
  supplements: { whey: false, creatine: false, multivitamin: false, vitaminD3: false, carnitine: false, acv: false }
});

const mkState = (logs: number, weighIns = 0): AppState => ({
  settings: { startDate: '2026-01-01' } as any,
  currentDayNumber: 1, selectedDayNumber: 1,
  dailyLogs: Object.fromEntries(Array.from({ length: logs }, (_, i) => [i + 1, mkLog(i + 1)])),
  workoutLogs: {},
  weighIns: Array.from({ length: weighIns }, (_, i) => ({ date: dayDate(i + 1), dayNumber: i + 1, weight: 80 })),
  measurementHistory: [], photos: [], learnedLessonIds: [], quizAnswers: {}, avoidedMistakes: {}
});

test('round trip is deep-equal and carries version + exportedAt', () => {
  const s = mkState(3, 2);
  const text = serializeBackup(s, new Date('2026-02-01T00:00:00Z'));
  const raw = JSON.parse(text);
  assert.equal(raw.version, BACKUP_VERSION);
  assert.equal(raw.exportedAt, '2026-02-01T00:00:00.000Z');
  const r = parseBackup(text);
  assert.equal(r.ok, true);
  assert.deepEqual(r.state, s);
});

test('legacy un-versioned shape is accepted', () => {
  const s = mkState(2, 1);
  const r = parseBackup(JSON.stringify(s));
  assert.equal(r.ok, true);
  assert.equal(r.version, undefined);
  assert.deepEqual(r.state, s);
});

test('malformed input is rejected without throwing', () => {
  const bad = ['', 'not json', 'null', '[]', '42', '{}', '{"settings":{}}',
    JSON.stringify({ ...mkState(1), weighIns: {} }),
    JSON.stringify({ ...mkState(1), workoutLogs: [] }),
    JSON.stringify({ ...mkState(1), settings: 'x' }),
    JSON.stringify({ ...mkState(1), dailyLogs: { 1: { dayNumber: 1 } } }),
    JSON.stringify({ ...mkState(1), dailyLogs: { 1: { date: '2026-01-01' } } }),
    JSON.stringify({ version: 'x', state: mkState(1) }),
    JSON.stringify({ version: 99, state: mkState(1) }),
    JSON.stringify({ version: 2 })];
  for (const t of bad) {
    const r = parseBackup(t);
    assert.equal(r.ok, false, t);
    assert.equal(r.state, undefined);
    assert.ok(r.errors.length > 0);
  }
});

test('parse does not alter values (entered zero survives)', () => {
  const r = parseBackup(serializeBackup(mkState(1)));
  assert.equal(r.state!.dailyLogs[1].sleepHours, 0);
  assert.equal(r.state!.dailyLogs[1].entered?.sleep, true);
});

test('restoreIsSafe warns on shrink, not on growth or equal', () => {
  const cur = mkState(5, 3);
  const shrink = restoreIsSafe(cur, mkState(2, 3));
  assert.equal(shrink.safe, false);
  assert.equal(shrink.warnings.length, 2); // daily logs + confirmed entries
  const both = restoreIsSafe(cur, mkState(2, 1));
  assert.equal(both.warnings.length, 3);
  assert.equal(restoreIsSafe(cur, mkState(5, 3)).safe, true);
  assert.equal(restoreIsSafe(cur, mkState(9, 9)).safe, true);
});

test('restoreIsSafe warns on workout logs, measurements and confirmed entries', () => {
  const cur = mkState(2); const inc = mkState(2);
  cur.workoutLogs = { a: { workoutCompleted: true } as any, b: { isRest: true } as any };
  cur.measurementHistory = [{} as any];
  for (const l of Object.values(inc.dailyLogs)) l.entered = {};
  const r = restoreIsSafe(cur, inc);
  assert.equal(r.safe, false);
  assert.ok(r.warnings.some((w) => w.includes('workout logs')));
  assert.ok(r.warnings.some((w) => w.includes('measurement')));
  assert.ok(r.warnings.some((w) => w.includes('confirmed entries')));
});

test('restoreIsSafe: fewer confirmed entries with equal log counts warns; growth does not', () => {
  const cur = mkState(2); const inc = mkState(2);
  inc.dailyLogs[1].entered = {};
  assert.equal(restoreIsSafe(cur, inc).safe, false);
  assert.equal(restoreIsSafe(inc, cur).safe, true);
});

test('restoreIsSafe warns on missing or different linkedFirebaseUid', () => {
  const cur = mkState(1); cur.settings = { ...cur.settings, linkedFirebaseUid: 'A' } as any;
  const none = mkState(1);
  assert.ok(restoreIsSafe(cur, none).warnings.some((w) => w.includes('not linked')));
  const other = mkState(1); other.settings = { ...other.settings, linkedFirebaseUid: 'B' } as any;
  assert.ok(restoreIsSafe(cur, other).warnings.some((w) => w.includes('different cloud account')));
  const same = mkState(1); same.settings = { ...same.settings, linkedFirebaseUid: 'A' } as any;
  assert.equal(restoreIsSafe(cur, same).safe, true);
  assert.equal(restoreIsSafe(none, cur).safe, true);
});

test('stateForRestore keeps current linkedFirebaseUid when backup has none', () => {
  const cur = mkState(1); cur.settings = { ...cur.settings, linkedFirebaseUid: 'A' } as any;
  assert.equal(stateForRestore(cur, mkState(1)).settings.linkedFirebaseUid, 'A');
  const other = mkState(1); other.settings = { ...other.settings, linkedFirebaseUid: 'B' } as any;
  assert.equal(stateForRestore(cur, other).settings.linkedFirebaseUid, 'B');
  assert.equal(stateForRestore(mkState(1), mkState(1)).settings.linkedFirebaseUid, undefined);
});

test('sparse 63-key backup vs populated state warns (padded empty logs do not count)', () => {
  const populated = mkState(10);
  for (const l of Object.values(populated.dailyLogs)) l.macrosConsumed.calories = 1800;
  const sparse = padDailyLogs({ ...mkState(0), settings: { startDate: '2026-01-01' } as any });
  assert.equal(Object.keys(sparse.dailyLogs).length, 63);
  const r = restoreIsSafe(populated, sparse);
  assert.equal(r.safe, false);
  assert.equal(r.incoming.dailyLogs, 0);
  assert.equal(r.current.dailyLogs, 10);
  assert.equal(restoreIsSafe(sparse, populated).safe, true);
});

test('padDailyLogs fills missing days dated from start date, keeps existing', () => {
  const s = mkState(2);
  const p = padDailyLogs(s);
  assert.equal(Object.keys(p.dailyLogs).length, 63);
  assert.equal(p.dailyLogs[1], s.dailyLogs[1]);
  assert.equal(p.dailyLogs[5].date, '2026-01-05');
});

test('parseBackup normalises a minimal log without altering existing values', () => {
  const text = JSON.stringify({ settings: {}, dailyLogs: { 1: { date: '2026-01-01', dayNumber: 1, steps: 500 } }, weighIns: [], workoutLogs: {} });
  const r = parseBackup(text);
  assert.equal(r.ok, true);
  const l = r.state!.dailyLogs[1];
  assert.equal(l.steps, 500);
  assert.equal(l.checklist.workout, false);
  assert.equal(l.macrosConsumed.calories, 0);
  assert.equal(l.supplements.whey, false);
});

// ---------------------------------------------------------------- restore hardening (B1-B5, P1-P2)

const rejects = (obj: unknown, needle?: string) => {
  const r = parseBackup(typeof obj === 'string' ? obj : JSON.stringify(obj));
  assert.equal(r.ok, false, JSON.stringify(r.errors));
  assert.equal(r.state, undefined);
  if (needle) assert.ok(r.errors.join('\n').includes(needle), r.errors.join('\n'));
  return r;
};

test('B1: weighIns containing null / non-object entries are rejected with the path', () => {
  rejects({ ...mkState(1), weighIns: [null] }, 'weighIns[0]');
  rejects({ ...mkState(1), weighIns: [{ date: '2026-01-01', dayNumber: 1, weight: 80 }, 5] }, 'weighIns[1]');
  rejects({ ...mkState(1), measurementHistory: [null] }, 'measurementHistory[0]');
  rejects({ ...mkState(1), photos: [null] }, 'photos[0]');
  rejects({ ...mkState(1), weighIns: [{ date: 'x', weight: 80 }] }, 'weighIns[0].date');
  rejects({ ...mkState(1), weighIns: [{ date: '2026-02-30', weight: 80 }] }, 'weighIns[0].date');
  rejects({ ...mkState(1), weighIns: [{ date: '2026-01-01', weight: -3 }] }, 'weighIns[0].weight');
});

test('B2: learnedLessonIds must be an array of strings', () => {
  rejects({ ...mkState(1), learnedLessonIds: 'abc' }, 'learnedLessonIds');
  rejects({ ...mkState(1), learnedLessonIds: { a: 1 } }, 'learnedLessonIds');
  rejects({ ...mkState(1), learnedLessonIds: [1] }, 'learnedLessonIds[0]');
  assert.equal(parseBackup(JSON.stringify(mkState(1))).ok, true);
});

test('B3: oversized text is rejected before JSON.parse with a clear message', () => {
  const big = JSON.stringify({ ...mkState(1), generalNotes: 'x'.repeat(BACKUP_LIMITS.maxTextChars + 10) });
  const r = rejects(big, 'too large');
  assert.equal(r.errors.length, 1);
  const real = JSON.parse;
  let parsed = false;
  JSON.parse = ((...a: any[]) => { parsed = true; return (real as any)(...a); }) as any;
  try { parseBackup(big); } finally { JSON.parse = real; }
  assert.equal(parsed, false);
});

test('B3/B5: lists over the cap (3000) are rejected', () => {
  const w = Array.from({ length: 3001 }, () => ({ date: '2026-01-01', dayNumber: 1, weight: 80 }));
  rejects({ ...mkState(1), weighIns: w }, 'weighIns');
  const ok = Array.from({ length: 3000 }, () => ({ date: '2026-01-01', dayNumber: 1, weight: 80 }));
  assert.equal(parseBackup(JSON.stringify({ ...mkState(1), weighIns: ok })).ok, true);
  rejects({ ...mkState(1), learnedLessonIds: Array.from({ length: 3001 }, (_, i) => String(i)) }, 'learnedLessonIds');
});

test('B4: deep nesting anywhere is rejected without throwing (text and parsed)', () => {
  const deep = (n: number) => '{"a":'.repeat(n) + '1' + '}'.repeat(n);
  const text = JSON.stringify(mkState(1)).slice(0, -1) + ',"extra":' + deep(10000) + '}';
  rejects(text, 'nested');
  rejects(JSON.stringify(mkState(1)).slice(0, -1) + ',"extra":' + deep(41) + '}', 'nested');
  const r = parseBackup(JSON.stringify(mkState(1)).slice(0, -1) + ',"extra":' + deep(30) + '}');
  assert.equal(r.ok, true);
  // brackets inside strings do not count
  assert.equal(parseBackup(JSON.stringify({ ...mkState(1), note: '['.repeat(500) })).ok, true);
});

test('too many nodes is rejected', () => {
  const extra = Array.from({ length: BACKUP_LIMITS.maxNodes + 5 }, () => 1);
  rejects({ ...mkState(1), extra }, 'values');
});

test('P1: dailyLogs keys, dayNumbers, dates and duplicates', () => {
  const s = mkState(2);
  for (const bad of [0, 64, -5, 999]) {
    const st = mkState(2);
    st.dailyLogs[bad as number] = { ...mkLog(1), dayNumber: bad, date: '2027-05-05' };
    rejects(st, `dailyLogs[${bad}]`);
  }
  rejects({ ...s, dailyLogs: { 1: { ...mkLog(1), dayNumber: 2 } } }, 'dayNumber');
  for (const d of ['01/02/2026', '2026-1-2', '2026-02-30', 'nope', '', 12]) {
    rejects({ ...s, dailyLogs: { 1: { ...mkLog(1), date: d } } }, 'dailyLogs[1].date');
  }
  rejects({ ...s, dailyLogs: { 1: mkLog(1), 2: { ...mkLog(2), date: mkLog(1).date } } }, 'already used');
  for (const d of [0, 9999, 64, 1.5]) rejects({ ...s, selectedDayNumber: d }, 'selectedDayNumber');
  for (const d of [-4, 'abc', null, 0, 64]) rejects({ ...s, currentDayNumber: d }, 'currentDayNumber');
  rejects({ ...s, settings: { startDate: 'nope' } }, 'settings.startDate');
  assert.equal(parseBackup(JSON.stringify({ ...s, settings: { startDate: '' } })).ok, true);
  assert.equal(parseBackup(JSON.stringify({ ...s, settings: {} })).ok, true);
  // all 63 days valid
  assert.equal(parseBackup(JSON.stringify(mkState(63))).ok, true);
});

test('P1: numeric ranges are enforced (steps, water, sleep, macros, ratings)', () => {
  const t = (over: Record<string, unknown>, needle: string) => rejects({ ...mkState(1), dailyLogs: { 1: { ...mkLog(1), ...over } } }, needle);
  t({ steps: -1 }, 'steps');
  t({ steps: 1e12 }, 'steps');
  t({ waterMl: -5 }, 'waterMl');
  t({ sleepHours: 25 }, 'sleepHours');
  t({ sleepHours: -1 }, 'sleepHours');
  t({ energyRating: 99 }, 'energyRating');
  t({ hungerRating: -1 }, 'hungerRating');
  t({ sorenessRating: 'abc' }, 'sorenessRating');
  t({ macrosConsumed: { calories: -1, protein: 0, fat: 0, carbs: 0 } }, 'macrosConsumed.calories');
  t({ macrosConsumed: { calories: 0, protein: 1e9, fat: 0, carbs: 0 } }, 'macrosConsumed.protein');
});

test('P2: canonical numeric text is migrated to numbers and reported', () => {
  const st = mkState(1, 1) as any;
  st.dailyLogs[1].steps = '9000';
  st.dailyLogs[1].macrosConsumed.protein = '71.5';
  st.weighIns[0].weight = '80.5';
  const r = parseBackup(JSON.stringify(st));
  assert.equal(r.ok, true);
  assert.equal(r.state!.dailyLogs[1].steps, 9000);
  assert.equal(r.state!.dailyLogs[1].macrosConsumed.protein, 71.5);
  assert.equal(r.state!.weighIns[0].weight, 80.5);
  assert.deepEqual(r.migrated!.slice().sort(), ['dailyLogs[1].macrosConsumed.protein', 'dailyLogs[1].steps', 'weighIns[0].weight']);
  // clean backups report no migration
  assert.deepEqual(parseBackup(JSON.stringify(mkState(1))).migrated, []);
});

test('P2: non-numeric text in a numeric field is rejected', () => {
  for (const v of ['abc', '1e3', '', ' 5', '5 ', '0x10', 'NaN', '-3', '1,5', '007']) {
    const st = mkState(1) as any;
    st.dailyLogs[1].steps = v;
    rejects(st, 'dailyLogs[1].steps');
  }
});

test('valid backups still round-trip: v2, legacy, with unknown extra keys', () => {
  const s = { ...mkState(63, 40), futureKey: { nested: [1, 2, { a: 'b' }] } } as any;
  s.settings = { startDate: '2026-01-01', displayName: 'A', linkedFirebaseUid: 'u' };
  const v2 = parseBackup(serializeBackup(s));
  assert.equal(v2.ok, true);
  assert.deepEqual(v2.state, s);
  const legacy = parseBackup(JSON.stringify(s));
  assert.equal(legacy.ok, true);
  assert.deepEqual(legacy.state, s);
});

test('multi-line error names path and reason, capped at 20 plus a count', () => {
  const w = Array.from({ length: 100 }, () => null);
  const r = rejects({ ...mkState(1), weighIns: w });
  assert.equal(r.errors.length, 21);
  assert.match(r.errors[0], /^weighIns\[0\]: /);
  assert.match(r.errors[20], /80 more/);
});
