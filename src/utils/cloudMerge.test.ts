import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasMeaningfulLocalData, mergeCloudIntoLocal, unionByDate } from './cloudMerge';
import type { AppState, DailyLog } from '../types';

const blankLog = (day: number): DailyLog => ({
  date: `2026-01-${String(day).padStart(2, '0')}`,
  dayNumber: day,
  phase: 'phase1',
  checklist: { workout: false, cardio: false, water: false, photo: false, community: false },
  macrosConsumed: { calories: 0, protein: 0, fat: 0, carbs: 0 },
  waterMl: 0,
  steps: 0,
  supplements: { whey: false, creatine: false, multivitamin: false, vitaminD3: false, carnitine: false, acv: false }
});

const blankState = (): AppState => ({
  settings: { startDate: '', activePhase: 'phase1', phase2Unlocked: false, phase3Unlocked: false, fastingStartHour: 20, fastingEndHour: 12, waterGoalMl: 3000, stepGoal: 10000, onboardingCompleted: false },
  currentDayNumber: 1,
  selectedDayNumber: 1,
  dailyLogs: {},
  workoutLogs: {},
  weighIns: [],
  measurementHistory: [],
  photos: [],
  learnedLessonIds: [],
  quizAnswers: {},
  avoidedMistakes: {}
});

const workout = (over: any = {}): any => ({
  phase: 'phase1', workoutCompleted: false, warmupCompleted: false, cooldownCompleted: false,
  absCompleted: false, cardioCompleted: false, cardioMinutes: 0, exercises: [], totalVolumeKg: 0, ...over
});

const fullCloud = (): Partial<AppState> => ({
  settings: { heightCm: 180, startDate: '2026-01-01', waterGoalMl: 4000 } as any,
  dailyLogs: { 1: { ...blankLog(1), waterMl: 2000 }, 2: { ...blankLog(2), steps: 9000 } },
  workoutLogs: { d1: workout({ workoutCompleted: true }) },
  weighIns: [{ date: '2026-01-01', dayNumber: 1, weight: 90 }, { date: '2026-01-08', dayNumber: 8, weight: 89 }],
  measurementHistory: [{ date: '2026-01-01', dayNumber: 1, measurements: { chest: 100, waist: 90, hips: 100, arms: 35 } }]
});

test('hasMeaningfulLocalData: blank state is false', () => {
  assert.equal(hasMeaningfulLocalData(blankState()), false);
  assert.equal(hasMeaningfulLocalData({ ...blankState(), dailyLogs: { 1: blankLog(1) } }), false);
});

test('hasMeaningfulLocalData: each kind of data is true', () => {
  const b = blankState();
  assert.equal(hasMeaningfulLocalData({ ...b, weighIns: [{ date: 'x', dayNumber: 1, weight: 80 }] }), true);
  assert.equal(hasMeaningfulLocalData({ ...b, measurementHistory: [{ date: 'x', dayNumber: 1, measurements: { chest: 1, waist: 1, hips: 1, arms: 1 } }] }), true);
  assert.equal(hasMeaningfulLocalData({ ...b, dailyLogs: { 1: { ...blankLog(1), waterMl: 1 } } }), true);
  assert.equal(hasMeaningfulLocalData({ ...b, dailyLogs: { 1: { ...blankLog(1), steps: 1 } } }), true);
  assert.equal(hasMeaningfulLocalData({ ...b, dailyLogs: { 1: { ...blankLog(1), notes: 'hi' } } }), true);
  assert.equal(hasMeaningfulLocalData({ ...b, dailyLogs: { 1: { ...blankLog(1), macrosConsumed: { calories: 5, protein: 0, fat: 0, carbs: 0 } } } }), true);
  assert.equal(hasMeaningfulLocalData({ ...b, dailyLogs: { 1: { ...blankLog(1), checklist: { ...blankLog(1).checklist, workout: true } } } }), true);
  assert.equal(hasMeaningfulLocalData({ ...b, workoutLogs: { d1: workout({ isRest: true }) } }), true);
  // A confirmed programme start alone is setup, not an entry (it used to count; that blocked Load from cloud).
  assert.equal(hasMeaningfulLocalData({ ...b, settings: { ...b.settings, startDate: '2026-01-01', confirmedProgrammeStart: true } }), false);
});

test('blank local vs full cloud: everything comes down', () => {
  const { merged, added } = mergeCloudIntoLocal(blankState(), fullCloud());
  assert.equal(Object.keys(merged.dailyLogs).length, 2);
  assert.equal(Object.keys(merged.workoutLogs).length, 1);
  assert.equal(merged.weighIns.length, 2);
  assert.equal(merged.measurementHistory.length, 1);
  assert.equal(merged.settings.heightCm, 180);
  assert.equal(merged.settings.startDate, '2026-01-01');  // unconfirmed local date yields to the cloud's confirmed one
  assert.equal(merged.settings.waterGoalMl, 3000); // local defined wins
  assert.equal(added, 2 + 1 + 2 + 1);
});

test('conflict: local wins when both have data; cloud fills absent fields', () => {
  const local = blankState();
  local.dailyLogs = { 1: { ...blankLog(1), waterMl: 500 } };
  local.workoutLogs = { d1: workout({ isSkipped: true }) };
  local.weighIns = [{ date: '2026-01-01', dayNumber: 1, weight: 95 }];
  const remote = fullCloud();
  (remote.dailyLogs![1] as DailyLog).sleepHours = 7;
  const { merged } = mergeCloudIntoLocal(local, remote);
  assert.equal(merged.dailyLogs[1].waterMl, 500);
  assert.equal(merged.dailyLogs[1].sleepHours, 7);
  assert.equal(merged.workoutLogs.d1.isSkipped, true);
  assert.equal(merged.workoutLogs.d1.workoutCompleted, false);
  assert.equal(merged.weighIns.find((w) => w.date === '2026-01-01')!.weight, 95);
  assert.equal(merged.dailyLogs[2].steps, 9000);
});

test('arrays and records never shrink', () => {
  const local = blankState();
  local.dailyLogs = { 5: { ...blankLog(5), waterMl: 100 } };
  local.weighIns = [{ date: '2026-02-01', dayNumber: 30, weight: 80 }];
  local.measurementHistory = [{ date: '2026-02-01', dayNumber: 30, measurements: { chest: 1, waist: 1, hips: 1, arms: 1 } }];
  // empty cloud
  const a = mergeCloudIntoLocal(local, {}).merged;
  assert.equal(a.weighIns.length, 1);
  assert.equal(a.measurementHistory.length, 1);
  assert.equal(Object.keys(a.dailyLogs).length, 1);
  // full cloud adds, keeps local
  const b = mergeCloudIntoLocal(local, fullCloud()).merged;
  assert.equal(b.weighIns.length, 3);
  assert.equal(b.measurementHistory.length, 2);
  assert.equal(Object.keys(b.dailyLogs).length, 3);
  assert.ok(b.dailyLogs[5]);
  // unionByDate directly
  assert.equal(unionByDate([{ date: 'a' }], undefined).length, 1);
  assert.equal(unionByDate(undefined, [{ date: 'a' }]).length, 1);
});

test('a day with only an entered flag (e.g. logged zero) counts as data', async () => {
  const { dailyLogHasData } = await import('./cloudMerge');
  assert.equal(dailyLogHasData({ entered: { steps: true }, checklist: {}, macrosConsumed: {} } as any), true);
});

// ---- merge safety: entered flags, confirmed zero, conflicts, empty-overwrite guard ----
import { shouldBlockEmptyOverwrite, buildCoachSummary, COACH_SUMMARY_FIELDS } from './cloudMerge';

const withDay = (day: number, over: any = {}): DailyLog => ({ ...blankLog(day), ...over });
const stateWith = (logs: DailyLog[]): AppState => {
  const s = blankState();
  for (const l of logs) s.dailyLogs[l.dayNumber] = l;
  return s;
};

test('entered flags: cloud-only day keeps its flags', () => {
  const remote = { dailyLogs: { 4: withDay(4, { steps: 0, entered: { steps: true, sleep: false } }) } };
  const { merged } = mergeCloudIntoLocal(blankState(), remote);
  assert.deepEqual(merged.dailyLogs[4].entered, { steps: true, sleep: false });
});

test('entered flags: local day wins whole-day (local flags are kept, cloud flags do not overwrite)', () => {
  const local = stateWith([withDay(1, { waterMl: 500, entered: { water: true } })]);
  const remote = { dailyLogs: { 1: withDay(1, { waterMl: 500, entered: { water: false, steps: true }, steps: 0 }) } };
  const { merged } = mergeCloudIntoLocal(local, remote);
  assert.equal(merged.dailyLogs[1].entered!.water, true);
});

test('confirmed zero (entered:true, value 0) is never replaced by a blank from the other side', () => {
  const local = stateWith([withDay(1, { steps: 0, entered: { steps: true } })]);
  const blankRemote = { dailyLogs: { 1: withDay(1) } };
  assert.equal(mergeCloudIntoLocal(local, blankRemote).merged.dailyLogs[1].entered!.steps, true);
  // and the other direction: local blank-with-data elsewhere, cloud has confirmed zero
  const local2 = stateWith([withDay(2, { waterMl: 100 })]);
  const remote2 = { dailyLogs: { 2: withDay(2, { steps: 0, entered: { steps: true } }) } };
  const m = mergeCloudIntoLocal(local2, remote2).merged.dailyLogs[2];
  assert.equal(m.entered!.steps, true);
  assert.equal(m.steps, 0);
  // blank local day entirely: cloud confirmed zero comes down
  const m3 = mergeCloudIntoLocal(stateWith([withDay(3)]), { dailyLogs: { 3: withDay(3, { steps: 0, entered: { steps: true } }) } }).merged.dailyLogs[3];
  assert.equal(m3.entered!.steps, true);
});

test('unconfirmed history stays unconfirmed (no flag stays no flag)', () => {
  const local = stateWith([withDay(1, { steps: 4000 })]);
  const remote = { dailyLogs: { 1: withDay(1, { steps: 4000, waterMl: 100 }) } };
  const { merged, conflicts } = mergeCloudIntoLocal(local, remote);
  assert.equal(merged.dailyLogs[1].entered, undefined);
  assert.equal(conflicts, 0);
  const cloudOnly = mergeCloudIntoLocal(blankState(), { dailyLogs: { 2: withDay(2, { steps: 4000 }) } }).merged;
  assert.equal(cloudOnly.dailyLogs[2].entered, undefined);
});

test('flag false is preserved and a cloud confirmation of a different value is reported', () => {
  const local = stateWith([withDay(1, { waterMl: 1, entered: { sleep: false } })]);
  const remote = { dailyLogs: { 1: withDay(1, { sleepHours: 7, entered: { sleep: true } }) } };
  const { merged, conflicts, conflictList } = mergeCloudIntoLocal(local, remote);
  assert.equal(merged.dailyLogs[1].entered!.sleep, false);
  assert.equal(conflicts, 1);
  assert.deepEqual(conflictList, ['day 1 sleep']);
  // cloud-only false is kept
  const m = mergeCloudIntoLocal(blankState(), { dailyLogs: { 5: withDay(5, { entered: { energy: false } }) } }).merged;
  assert.equal(m.dailyLogs[5].entered!.energy, false);
});

test('conflicting device updates: local wins, cloud values counted not silently lost', () => {
  const local = stateWith([withDay(1, { steps: 3000, entered: { steps: true } })]);
  local.weighIns = [{ date: '2026-01-01', dayNumber: 1, weight: 95 }];
  local.workoutLogs = { d1: workout({ isSkipped: true }) };
  const remote = fullCloud();
  remote.dailyLogs = { 1: withDay(1, { steps: 9000, entered: { steps: true } }) };
  const r = mergeCloudIntoLocal(local, remote);
  assert.equal(r.merged.dailyLogs[1].steps, 3000);
  assert.equal(r.merged.weighIns[0].weight, 95);
  assert.equal(r.conflicts, 3);
  assert.deepEqual(r.conflictList.sort(), ['day 1 steps', 'weigh-in 2026-01-01', 'workout d1']);
});

test('no conflicts when both sides agree or only one has data', () => {
  assert.equal(mergeCloudIntoLocal(blankState(), fullCloud()).conflicts, 0);
  assert.equal(mergeCloudIntoLocal(mergeCloudIntoLocal(blankState(), fullCloud()).merged, fullCloud()).conflicts, 0);
});

test('adopted cloud value brings its flag (local sleep absent)', () => {
  const local = stateWith([withDay(1, { waterMl: 10 })]);
  const remote = { dailyLogs: { 1: withDay(1, { sleepHours: 0, entered: { sleep: true } }) } };
  const m = mergeCloudIntoLocal(local, remote).merged.dailyLogs[1];
  assert.equal(m.sleepHours, 0);
  assert.equal(m.entered!.sleep, true);
});

test('empty-overwrite guard: empty local never overwrites a cloud that has records', () => {
  assert.equal(shouldBlockEmptyOverwrite(true, blankState()), true);
  assert.equal(shouldBlockEmptyOverwrite(true, null), true);
  assert.equal(shouldBlockEmptyOverwrite(true, { ...blankState(), weighIns: [{ date: 'x', dayNumber: 1, weight: 80 }] }), false);
  assert.equal(shouldBlockEmptyOverwrite(false, blankState()), false);
});

test('buildCoachSummary: allowlist only, validated, never leaks private fields', () => {
  const settings: any = {
    displayName: 'Heet', startDate: '2026-01-05', activePhase: 'phase2', timezone: 'Asia/Kolkata',
    bodyweightKg: 89, startingWeightKg: 90, age: 30, gender: 'male', heightCm: 178,
    injuriesAndConstraints: 'knee', dietaryExclusions: 'none', proposedGoalWeightKg: 80, authorizedCoachUid: 'c'
  };
  const out = buildCoachSummary(settings, 'T');
  for (const k of Object.keys(out)) assert.ok((COACH_SUMMARY_FIELDS as readonly string[]).includes(k), k);
  assert.equal(out.currentPhase, 'phase2');
  const bad = buildCoachSummary({ displayName: 'x'.repeat(500), bodyweightKg: NaN, activePhase: 'weird' as any }, 'T');
  assert.equal((bad.displayName as string).length, 200);
  assert.equal('bodyweightKg' in bad, false);
  assert.equal(bad.currentPhase, 'phase1');
});

test('unconfirmed pre-filled start date is not data, is not shared, and yields to the cloud date', async () => {
  const m = await import('./cloudMerge');
  const fresh: any = { settings: { startDate: '2026-10-24', confirmedProgrammeStart: false }, dailyLogs: {}, workoutLogs: {}, weighIns: [], measurementHistory: [] };
  assert.equal(m.hasMeaningfulLocalData(fresh), false);
  assert.equal((m.buildCoachSummary(fresh.settings, 'now') as any).programmeStartDate, undefined);
  const r = m.mergeCloudIntoLocal(fresh, { settings: { startDate: '2026-09-01' } } as any);
  assert.equal(r.merged.settings.startDate, '2026-09-01');
  assert.equal(r.merged.settings.confirmedProgrammeStart, true);
});

// ---- review fixes: default-field merge, day merge, normalisation, sanitiser, sync planning, profile ----
import { mergeDayLogs, normalizeDailyLog, normalizeWorkout, sanitizeForFirestore, dailyLogHasData, planDailyWrites, planWorkoutWrites, hashDailyDoc, hashWorkoutDoc, buildProfilePayload, contentMismatches, dailyLogDocId, PROFILE_DEFAULTS } from './cloudMerge';
import { getInitialState } from './storage';

test('merge: cloud values fill local DEFAULT fields (0/false) that are not flagged entered', () => {
  const local = stateWith([withDay(1)]);
  const remote = { dailyLogs: { 1: withDay(1, { steps: 8000, waterMl: 2500, macrosConsumed: { calories: 1800, protein: 120, fat: 50, carbs: 150 }, checklist: { ...blankLog(1).checklist, workout: true }, notes: 'felt good', supplements: { ...blankLog(1).supplements, whey: true } }) } };
  const { merged, conflicts } = mergeCloudIntoLocal(local, remote);
  const d = merged.dailyLogs[1];
  assert.equal(d.steps, 8000);
  assert.equal(d.waterMl, 2500);
  assert.equal(d.macrosConsumed.calories, 1800);
  assert.equal(d.macrosConsumed.carbs, 150);
  assert.equal(d.checklist.workout, true);
  assert.equal(d.supplements.whey, true);
  assert.equal(d.notes, 'felt good');
  assert.equal(conflicts, 0);
});

test('merge: checklist booleans OR together; both non-default differing -> local wins + conflict listed', () => {
  const local = stateWith([withDay(2, { checklist: { ...blankLog(2).checklist, cardio: true }, steps: 3000, notes: 'mine' })]);
  const remote = { dailyLogs: { 2: withDay(2, { checklist: { ...blankLog(2).checklist, workout: true }, steps: 9000, notes: 'theirs' }) } };
  const { merged, conflictList } = mergeCloudIntoLocal(local, remote);
  assert.equal(merged.dailyLogs[2].checklist.cardio, true);
  assert.equal(merged.dailyLogs[2].checklist.workout, true);
  assert.equal(merged.dailyLogs[2].steps, 3000);
  assert.equal(merged.dailyLogs[2].notes, 'mine');
  assert.deepEqual(conflictList.sort(), ['day 2 notes', 'day 2 steps']);
});

test('merge: cloud entered:true zero fills a local unflagged default; local flagged zero is not replaced by cloud unflagged value', () => {
  const m = mergeCloudIntoLocal(stateWith([withDay(1)]), { dailyLogs: { 1: withDay(1, { waterMl: 0, entered: { water: true } }) } }).merged.dailyLogs[1];
  assert.equal(m.entered!.water, true);
  const r = mergeDayLogs(withDay(1, { steps: 0, entered: { steps: true } }), withDay(1, { steps: 5000 }), 1);
  assert.equal(r.merged.steps, 0);
  assert.deepEqual(r.conflicts, ['day 1 steps']);
});

test('mergeDayLogs never reduces data: result is a superset of both sides', () => {
  const a = withDay(3, { steps: 100, isRestDay: true, hungerRating: 3 });
  const b = withDay(3, { waterMl: 900, sorenessRating: 2, addedCarbs: ['rice'], mealEstimates: [{ id: 'm', name: 'x', estimateCalories: 1, estimateProtein: 1, isEstimateOnly: true }] });
  const { merged, conflicts } = mergeDayLogs(a, b, 3);
  assert.equal(conflicts.length, 0);
  assert.equal(merged.steps, 100);
  assert.equal(merged.waterMl, 900);
  assert.equal(merged.isRestDay, true);
  assert.equal(merged.hungerRating, 3);
  assert.equal(merged.sorenessRating, 2);
  assert.deepEqual(merged.addedCarbs, ['rice']);
  assert.equal(merged.mealEstimates!.length, 1);
});

test('dailyLogHasData covers rest/skip/modified, ratings, supplements, lists, entered flags and sleep', () => {
  const b = blankLog(1);
  assert.equal(dailyLogHasData(b), false);
  for (const over of [
    { isRestDay: true }, { isSkipped: true }, { isModified: true }, { hungerRating: 2 }, { sorenessRating: 1 },
    { energyRating: 5 }, { sleepHours: 7 }, { addedCarbs: ['x'] }, { entered: { sleep: false } },
    { supplements: { ...b.supplements, creatine: true } },
    { mealEstimates: [{ id: 'a', name: 'n', estimateCalories: 1, estimateProtein: 1, isEstimateOnly: true }] }
  ]) {
    assert.equal(dailyLogHasData({ ...b, ...over } as any), true, JSON.stringify(over));
  }
  assert.equal(dailyLogHasData({ ...b, sleepHours: undefined, isRestDay: false } as any), false);
});

test('minimal cloud doc {date, dayNumber} is normalised so the UI cannot crash', () => {
  const remote: any = { dailyLogs: { 7: { date: '2026-01-07', dayNumber: 7 } }, workoutLogs: { d7: { dayKey: 'd7', isRest: true } } };
  const { merged } = mergeCloudIntoLocal(blankState(), remote);
  const d = merged.dailyLogs[7];
  assert.equal(typeof d.checklist, 'object');
  assert.equal(d.macrosConsumed.calories, 0);
  assert.equal(d.supplements.whey, false);
  assert.equal(d.steps, 0);
  assert.equal(d.phase, 'phase1');
  assert.equal(Array.isArray(merged.workoutLogs.d7.exercises), true);
  // existing values are never altered
  const kept = normalizeDailyLog({ date: 'x', dayNumber: 1, phase: 'phase3', steps: 5, checklist: { workout: true } } as any);
  assert.equal(kept.steps, 5); assert.equal(kept.phase, 'phase3'); assert.equal(kept.checklist.workout, true);
  assert.equal(normalizeWorkout({ workoutCompleted: true, cardioMinutes: 9 }).cardioMinutes, 9);
});

test('sanitizeForFirestore drops undefined recursively, keeps null/0/false, nulls array holes', () => {
  const out: any = sanitizeForFirestore({ a: undefined, b: null, c: 0, d: false, e: { f: undefined, g: 1, h: [undefined, 2, { i: undefined }] } });
  assert.deepEqual(out, { b: null, c: 0, d: false, e: { g: 1, h: [null, 2, {}] } });
  assert.equal('a' in out, false);
  assert.equal('f' in out.e, false);
  // SleepEntry "Clear" case
  assert.equal('sleepHours' in (sanitizeForFirestore({ ...blankLog(1), sleepHours: undefined }) as any), false);
});

const sentinel = '2026-02-01T00:00:00.000Z';
const NOW = '2026-03-01T00:00:00.000Z';
const cloudDoc = (log: DailyLog, updatedAt = sentinel) => ({ id: log.date, data: { ...log, updatedAt } });

test('plan: no base + differing cloud doc is a conflict (stale device cannot replace newer cloud values)', () => {
  const stale = { 5: withDay(5, { notes: 'x' }) };
  const cloud = [cloudDoc(withDay(5, { steps: 9000, waterMl: 3000 }))];
  const plan = planDailyWrites(stale as any, cloud, {}, NOW);
  assert.equal(plan.writes.length, 0);
  assert.deepEqual(plan.conflicts.map((c) => c.id), [withDay(5).date]);
});

test('plan: differing real values are a conflict, day not written, listed with fields', () => {
  const local = { 5: withDay(5, { steps: 1000 }), 6: withDay(6, { steps: 50 }) };
  const cloud = [cloudDoc(withDay(5, { steps: 9000 }))];
  const plan = planDailyWrites(local as any, cloud, {}, NOW);
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].kind, 'daily');
  assert.match(plan.conflicts[0].label, /^day 5 \(.*steps/);
  assert.deepEqual(plan.writes.map((w) => w.id), [withDay(6).date]);
});

test('plan: cloud unchanged since this device last synced (cloud === base) -> local edit wins, no conflict', () => {
  const local = { 5: withDay(5, { steps: 1000 }) };
  const c = withDay(5, { steps: 900 });
  const cloud = [cloudDoc(c)];
  const base = { [c.date]: hashDailyDoc(c, 5) };
  const plan = planDailyWrites(local as any, cloud, base, NOW);
  assert.equal(plan.conflicts.length, 0);
  assert.equal(plan.writes[0].payload.steps, 1000);
  // cloud changed by someone else since the base -> conflict
  const newer = [cloudDoc(withDay(5, { steps: 777 }))];
  assert.equal(planDailyWrites(local as any, newer, base, NOW).conflicts.length, 1);
});

test('plan: payload never contains undefined and carries dayNumber/updatedAt', () => {
  const plan = planDailyWrites({ 1: { ...withDay(1, { steps: 1 }), sleepHours: undefined } } as any, [], {}, NOW);
  assert.equal(JSON.stringify(plan.writes[0].payload).includes('undefined'), false);
  assert.equal('sleepHours' in plan.writes[0].payload, false);
  assert.equal(plan.writes[0].payload.dayNumber, 1);
  assert.equal(plan.writes[0].payload.updatedAt, NOW);
});

test('doc ids: day-N when date missing; existing cloud id reused for the day; collisions reported not overwritten', () => {
  assert.equal(dailyLogDocId({ date: '' }, 4), 'day-4');
  assert.equal(dailyLogDocId({ date: '2026-01-04' }, 4), '2026-01-04');
  // same date on two different days
  const dup = { 1: withDay(1, { steps: 1, date: 'same' }), 2: withDay(2, { steps: 2, date: 'same' }) };
  const plan = planDailyWrites(dup as any, [], {}, NOW);
  assert.equal(plan.writes.length, 1);
  assert.equal(plan.collisions.length, 1);
  // cloud id for that day number is reused even if this device computes a different date
  const cloud = [{ id: 'old-date', data: { ...withDay(3, { steps: 5 }), date: 'old-date' } }];
  const p2 = planDailyWrites({ 3: withDay(3, { steps: 5, date: 'new-date' }) } as any, cloud, { 'old-date': hashDailyDoc(cloud[0].data, 3) }, NOW);
  assert.equal(p2.writes[0].id, 'old-date');
  // without a base the re-dated day is a conflict on the existing doc id (date differs), never a new doc
  assert.equal(planDailyWrites({ 3: withDay(3, { steps: 5, date: 'new-date' }) } as any, cloud, {}, NOW).conflicts[0].id, 'old-date');
  // local date equals a cloud doc that belongs to another day
  const p3 = planDailyWrites({ 4: withDay(4, { steps: 5, date: 'old-date' }) } as any, cloud, {}, NOW);
  assert.equal(p3.writes.length, 0);
  assert.equal(p3.collisions.length, 1);
});

test('plan workouts: differing data conflicts, cloud === base lets local win, empty ones skipped', () => {
  const local: any = { d1: workout({ workoutCompleted: true }), d2: workout(), d3: workout({ isRest: true }) };
  const cdata = { ...workout({ isSkipped: true }), dayKey: 'd1', updatedAt: sentinel };
  const cloud = [{ id: 'd1', data: cdata }];
  const plan = planWorkoutWrites(local, cloud, {}, NOW);
  assert.deepEqual(plan.conflicts.map((c) => c.id), ['d1']);
  assert.deepEqual(plan.writes.map((w) => w.id), ['d3']);
  const ok = planWorkoutWrites(local, cloud, { d1: hashWorkoutDoc(cdata, 'd1') }, NOW);
  assert.equal(ok.writes.length, 2);
});

test('profile payload: defaults are not pushed from a fresh device; user-chosen values are; onboarding does not make defaults user-chosen', () => {
  const fresh = getInitialState().settings;
  const p = buildProfilePayload(fresh, 'u1', NOW);
  for (const k of ['displayName', 'timezone', 'currentPhase', 'dietaryExclusions', 'gymTime', 'workTime', 'wakeTime', 'programmeStartDate', 'authorizedCoachUid']) {
    assert.equal(k in p, false, k);
  }
  assert.equal(p.userId, 'u1');
  const changed = buildProfilePayload({ ...fresh, timezone: 'Europe/London', gymTime: '6 AM', displayName: 'Heet' }, 'u1', NOW);
  assert.equal(changed.timezone, 'Europe/London'); assert.equal(changed.gymTime, '6 AM'); assert.equal(changed.displayName, 'Heet');
  assert.equal('dietaryExclusions' in changed, false);
  // onboarding collects only start date, bodyweight and fasting hours - never diet/times - so completing it
  // cannot turn the built-in defaults into user choices (regression: defaults must not sync as facts)
  const onboarded = buildProfilePayload({ ...fresh, onboardingCompleted: true }, 'u1', NOW);
  assert.equal('dietaryExclusions' in onboarded, false);
  assert.equal('authorizedCoachUid' in onboarded, false);
  assert.equal(JSON.stringify(onboarded).includes('undefined'), false);
});

test('PROFILE_DEFAULTS stays in sync with storage getInitialState', () => {
  const s = getInitialState().settings;
  assert.equal(s.timezone, PROFILE_DEFAULTS.timezone);
  assert.equal(s.activePhase, PROFILE_DEFAULTS.currentPhase);
  assert.equal(s.dietaryExclusions, PROFILE_DEFAULTS.dietaryExclusions);
  assert.equal(s.wakeTime, PROFILE_DEFAULTS.wakeTime);
  assert.equal(s.workTime, PROFILE_DEFAULTS.workTime);
  assert.equal(s.gymTime, PROFILE_DEFAULTS.gymTime);
});

test('contentMismatches: detects different/missing fields, ignores defaults and updatedAt', () => {
  const written = { steps: 5, waterMl: 0, notes: '', updatedAt: 'a', entered: { steps: true }, checklist: { workout: true, cardio: false } };
  assert.deepEqual(contentMismatches(written, { steps: 5, updatedAt: 'b', entered: { steps: true }, checklist: { workout: true } }), []);
  assert.deepEqual(contentMismatches(written, { steps: 4, entered: { steps: true }, checklist: { workout: true } }), ['steps']);
  assert.deepEqual(contentMismatches(written, { steps: 5, checklist: { workout: false } }).sort(), ['checklist.workout', 'entered']);
  assert.deepEqual(contentMismatches(written, undefined), ['(document missing)']);
});

// ---- three-way (content-hash base) scenarios, simulated through the pure planners ----
import { planSave, planPull, planUseCloud, pullMessage, summariseConflicts, hashEntry } from './cloudMerge';
import type { CloudSnapshot } from './cloudMerge';
import { emptyBase, applyBaseEntries } from './syncBase';
import type { SyncBase } from './syncBase';

/** A fake Firestore + one device: save/pull mirror what cloudSync.ts does with the planners. */
class Sim {
  cloud: { profile: Record<string, any>; logs: Map<string, any>; workouts: Map<string, any> } = { profile: { userId: 'u' }, logs: new Map(), workouts: new Map() };
  snap(): CloudSnapshot {
    return {
      profile: JSON.parse(JSON.stringify(this.cloud.profile)),
      logDocs: [...this.cloud.logs].map(([id, data]) => ({ id, data: JSON.parse(JSON.stringify(data)) })),
      workoutDocs: [...this.cloud.workouts].map(([id, data]) => ({ id, data: JSON.parse(JSON.stringify(data)) }))
    };
  }
}
class Device {
  base: SyncBase = emptyBase();
  constructor(public state: AppState, public sim: Sim) {}
  save(now = NOW, only?: any[]) {
    const plan = planSave(this.state, this.sim.snap(), this.base, 'u', now, only);
    this.base = applyBaseEntries(this.base, plan.inSync);
    const entries: any[] = [];
    for (const w of plan.daily.writes) {
      this.sim.cloud.logs.set(w.id, JSON.parse(JSON.stringify(w.payload)));
      entries.push({ section: 'daily', id: w.id, hash: hashDailyDoc(this.sim.cloud.logs.get(w.id), w.payload.dayNumber) });
    }
    for (const w of plan.workouts.writes) {
      this.sim.cloud.workouts.set(w.id, JSON.parse(JSON.stringify(w.payload)));
      entries.push({ section: 'workouts', id: w.id, hash: hashWorkoutDoc(this.sim.cloud.workouts.get(w.id), w.payload.dayKey) });
    }
    const pf = plan.profile;
    Object.assign(this.sim.cloud.profile, JSON.parse(JSON.stringify(pf.fields)));
    for (const f of Object.keys(pf.fields)) entries.push({ section: 'profile', id: f, hash: hashEntry(this.sim.cloud.profile[f]) });
    if (pf.weighIns) { this.sim.cloud.profile.weighIns = JSON.parse(JSON.stringify(pf.weighIns)); for (const d of pf.writtenWeighInDates) entries.push({ section: 'weighIns', id: d, hash: hashEntry(pf.weighIns.find((x) => x.date === d)) }); }
    for (const d of pf.deletedWeighInDates) entries.push({ section: 'weighIns', id: d, hash: null });
    if (pf.measurementHistory) { this.sim.cloud.profile.measurementHistory = JSON.parse(JSON.stringify(pf.measurementHistory)); for (const d of pf.writtenMeasurementDates) entries.push({ section: 'measurements', id: d, hash: hashEntry(pf.measurementHistory.find((x) => x.date === d)) }); }
    for (const d of pf.deletedMeasurementDates) entries.push({ section: 'measurements', id: d, hash: null });
    this.base = applyBaseEntries(this.base, entries);
    return plan;
  }
  pull() {
    const plan = planPull(this.state, this.sim.snap(), this.base);
    this.state = plan.merged;
    this.base = applyBaseEntries(this.base, plan.baseEntries);
    return plan;
  }
}
const ownerState = (logs: DailyLog[]): AppState => {
  const s = stateWith(logs);
  s.settings = { ...s.settings, startDate: '2026-01-01', confirmedProgrammeStart: true, onboardingCompleted: true } as any;
  return s;
};

test('3-way save: cloud absent writes; cloud === base writes (unticks propagate); nothing to write when identical', () => {
  const sim = new Sim();
  const a = new Device(ownerState([withDay(1, { checklist: { ...blankLog(1).checklist, workout: true, cardio: true } })]), sim);
  assert.equal(a.save().daily.writes.length, 1);
  assert.equal(sim.cloud.logs.get(withDay(1).date).checklist.cardio, true);
  // untick on the same device: cloud === base so local overwrites as-is, no OR re-merge
  a.state.dailyLogs[1] = { ...a.state.dailyLogs[1], checklist: { ...a.state.dailyLogs[1].checklist, cardio: false } };
  const p2 = a.save();
  assert.equal(p2.conflicts.length, 0);
  assert.equal(sim.cloud.logs.get(withDay(1).date).checklist.cardio, false);
  // nothing changed: nothing written, base still equal
  const p3 = a.save();
  assert.equal(p3.daily.writes.length, 0);
  assert.equal(p3.conflicts.length, 0);
});

test('3-way save: cloud changed by another device since base is a CONFLICT and is not written', () => {
  const sim = new Sim();
  const a = new Device(ownerState([withDay(1, { steps: 1000 })]), sim);
  a.save();
  const id = withDay(1).date;
  sim.cloud.logs.set(id, { ...sim.cloud.logs.get(id), steps: 5000, updatedAt: 'later' }); // device B
  a.state.dailyLogs[1] = { ...a.state.dailyLogs[1], steps: 2000 };
  const p = a.save();
  assert.equal(p.conflicts.length, 1);
  assert.equal(p.conflicts[0].id, id);
  assert.match(p.conflicts[0].label, /steps/);
  assert.equal(sim.cloud.logs.get(id).steps, 5000);
});

test('3-way save: repeated same-device edits do not conflict after a successful save (base advanced)', () => {
  const sim = new Sim();
  const a = new Device(ownerState([withDay(1, { steps: 1 })]), sim);
  a.save();
  for (const steps of [2, 3, 4]) {
    a.state.dailyLogs[1] = { ...a.state.dailyLogs[1], steps };
    const p = a.save();
    assert.equal(p.conflicts.length, 0, `steps ${steps}`);
    assert.equal(sim.cloud.logs.get(withDay(1).date).steps, steps);
  }
});

test('3-way save: first-ever sync with no base and a differing cloud doc is a conflict', () => {
  const sim = new Sim();
  sim.cloud.logs.set(withDay(1).date, { ...withDay(1, { steps: 9000 }), updatedAt: 'x' });
  const d = new Device(ownerState([withDay(1, { steps: 100 })]), sim);
  const p = d.save();
  assert.equal(p.conflicts.length, 1);
  assert.equal(p.daily.writes.length, 0);
  assert.equal(sim.cloud.logs.get(withDay(1).date).steps, 9000);
});

test('3-way load: unedited device fast-forwards, so another device\'s untick arrives', () => {
  const sim = new Sim();
  const a = new Device(ownerState([withDay(1, { checklist: { ...blankLog(1).checklist, workout: true, cardio: true } })]), sim);
  a.save();
  const b = new Device(ownerState([withDay(1)]), sim);
  b.pull();
  assert.equal(b.state.dailyLogs[1].checklist.cardio, true);
  // B unticks and saves
  b.state.dailyLogs[1] = { ...b.state.dailyLogs[1], checklist: { ...b.state.dailyLogs[1].checklist, cardio: false } };
  assert.equal(b.save().conflicts.length, 0);
  // A has not edited: load fast-forwards and the untick arrives (no OR re-tick)
  const p = a.pull();
  assert.equal(p.conflicts, 0);
  assert.equal(a.state.dailyLogs[1].checklist.cardio, false);
});

test('3-way load: local edits are kept when the cloud is untouched; both changed -> kept local + conflict + base unchanged', () => {
  const sim = new Sim();
  const a = new Device(ownerState([withDay(1, { steps: 10 })]), sim);
  a.save();
  a.state.dailyLogs[1] = { ...a.state.dailyLogs[1], steps: 20 };
  const p1 = a.pull();
  assert.equal(p1.conflicts, 0);
  assert.equal(a.state.dailyLogs[1].steps, 20);
  // now someone else also changes the cloud
  const id = withDay(1).date;
  sim.cloud.logs.set(id, { ...sim.cloud.logs.get(id), steps: 99, waterMl: 1234 });
  const before = a.base.daily[id];
  const p2 = a.pull();
  assert.equal(p2.conflicts, 1);
  assert.equal(p2.conflictDocs[0].kind, 'daily');
  assert.equal(a.state.dailyLogs[1].steps, 20);          // local kept
  assert.equal(a.state.dailyLogs[1].waterMl, 1234);      // absent/default field filled from cloud (never reduce data)
  assert.equal(a.base.daily[id], before);                // base NOT advanced
  assert.match(pullMessage(p2), /Choose which version/);
});

test('NEW-1: load of a conflicting day, then save, does NOT overwrite the newer cloud value', () => {
  const sim = new Sim();
  const id = withDay(1).date;
  // device A (this one) previously synced steps 100; device B later set 5000 in the cloud
  const a = new Device(ownerState([withDay(1, { steps: 100 })]), sim);
  a.save();
  sim.cloud.logs.set(id, { ...sim.cloud.logs.get(id), steps: 5000, updatedAt: '2099-01-01T00:00:00.000Z' });
  a.state.dailyLogs[1] = { ...a.state.dailyLogs[1], steps: 150 }; // A also edited
  assert.equal(a.pull().conflicts, 1);
  const p = a.save();
  assert.equal(p.conflicts.length, 1);
  assert.equal(p.daily.writes.length, 0);
  assert.equal(sim.cloud.logs.get(id).steps, 5000);
  // and a brand new device that loads and then edits other fields still cannot clobber via a stale baseline
  const c = new Device(ownerState([withDay(1, { steps: 77 })]), sim);
  assert.equal(c.pull().conflicts, 1);
  assert.equal(c.save().daily.writes.length, 0);
  assert.equal(sim.cloud.logs.get(id).steps, 5000);
});

test('conflict in one day does not block other days or array-field counts (whole doc is the unit)', () => {
  const sim = new Sim();
  const a = new Device(ownerState([withDay(1, { steps: 1 }), withDay(2, { steps: 2 })]), sim);
  a.save();
  const id1 = withDay(1).date;
  sim.cloud.logs.set(id1, { ...sim.cloud.logs.get(id1), steps: 500 });
  a.state.dailyLogs[1] = { ...a.state.dailyLogs[1], steps: 11 };
  a.state.dailyLogs[2] = { ...a.state.dailyLogs[2], steps: 22, addedCarbs: ['rice'] };
  const p = a.save();
  assert.deepEqual(p.conflicts.map((c) => c.id), [id1]);
  assert.equal(sim.cloud.logs.get(withDay(2).date).steps, 22);
});

test('weigh-in same-date conflicts are detected per entry and not written; new dates still save', () => {
  const sim = new Sim();
  const a = new Device(ownerState([]), sim);
  a.state.weighIns = [{ date: '2026-01-01', dayNumber: 1, weight: 90 }];
  a.save();
  sim.cloud.profile.weighIns = [{ date: '2026-01-01', dayNumber: 1, weight: 88.5 }]; // other device corrected it
  a.state.weighIns = [{ date: '2026-01-01', dayNumber: 1, weight: 89 }, { date: '2026-01-08', dayNumber: 8, weight: 87 }];
  const p = a.save();
  assert.deepEqual(p.conflicts.map((c) => [c.kind, c.id]), [['weighIn', '2026-01-01']]);
  assert.equal(sim.cloud.profile.weighIns.find((x: any) => x.date === '2026-01-01').weight, 88.5);
  assert.equal(sim.cloud.profile.weighIns.find((x: any) => x.date === '2026-01-08').weight, 87);
});

test('profile scalar conflict: cloud differs from base and local -> not written; unchanged cloud -> written', () => {
  const sim = new Sim();
  const a = new Device(ownerState([]), sim);
  a.state.settings = { ...a.state.settings, bodyweightKg: 90 };
  a.save();
  assert.equal(sim.cloud.profile.bodyweightKg, 90);
  a.state.settings = { ...a.state.settings, bodyweightKg: 89 };
  assert.equal(a.save().conflicts.length, 0);
  assert.equal(sim.cloud.profile.bodyweightKg, 89);
  sim.cloud.profile.bodyweightKg = 85;           // other device
  a.state.settings = { ...a.state.settings, bodyweightKg: 88 };
  const p = a.save();
  assert.deepEqual(p.conflicts.map((c) => [c.kind, c.id]), [['profile', 'bodyweightKg']]);
  assert.equal(sim.cloud.profile.bodyweightKg, 85);
  assert.equal('authorizedCoachUid' in p.profile.fields, false);
});

test('resolve use-local writes ONLY the listed ids; use-cloud replaces exactly those and returns base entries', () => {
  const sim = new Sim();
  const a = new Device(ownerState([withDay(1, { steps: 1 }), withDay(2, { steps: 2 }), withDay(3, { steps: 3 })]), sim);
  a.save();
  for (const d of [1, 2, 3]) { const id = withDay(d).date; sim.cloud.logs.set(id, { ...sim.cloud.logs.get(id), steps: d * 1000 }); }
  a.state.dailyLogs[1] = { ...a.state.dailyLogs[1], steps: 11 };
  a.state.dailyLogs[2] = { ...a.state.dailyLogs[2], steps: 22 };
  a.state.dailyLogs[3] = { ...a.state.dailyLogs[3], steps: 33 };
  const conflicts = a.save().conflicts;
  assert.equal(conflicts.length, 3);
  const listed = conflicts.filter((c) => c.id !== withDay(3).date);
  const p = a.save(NOW, listed);
  assert.deepEqual(p.daily.writes.map((w) => w.id).sort(), listed.map((c) => c.id).sort());
  assert.equal(sim.cloud.logs.get(withDay(1).date).steps, 11);
  assert.equal(sim.cloud.logs.get(withDay(2).date).steps, 22);
  assert.equal(sim.cloud.logs.get(withDay(3).date).steps, 3000);  // not listed: untouched
  assert.equal(a.save().conflicts.length, 1);                      // only the unlisted one remains
  // use cloud for the remaining one
  const r = planUseCloud(a.state, sim.snap(), conflicts.filter((c) => c.id === withDay(3).date));
  assert.equal(r.applied, 1);
  assert.equal(r.merged.dailyLogs[3].steps, 3000);
  assert.equal(r.merged.dailyLogs[1].steps, 11);
  a.base = applyBaseEntries(a.base, r.baseEntries);
  a.state = r.merged;
  assert.equal(a.save().conflicts.length, 0);
  assert.deepEqual(planUseCloud(a.state, sim.snap(), [{ kind: 'daily', id: 'nope' }]).missing, ['daily:nope']);
});

test('local day cleared after a sync still propagates (blank previously-synced day is written)', () => {
  const sim = new Sim();
  const a = new Device(ownerState([withDay(1, { steps: 5 })]), sim);
  a.save();
  a.state.dailyLogs[1] = withDay(1);
  const p = a.save();
  assert.equal(p.daily.writes.length, 1);
  assert.equal(sim.cloud.logs.get(withDay(1).date).steps, 0);
});

test('blank device first load adopts cloud; a day with no local data adopts without conflict', () => {
  const sim = new Sim();
  const a = new Device(ownerState([withDay(1, { steps: 5 })]), sim);
  a.state.weighIns = [{ date: '2026-01-01', dayNumber: 1, weight: 80 }];
  a.save();
  const fresh = new Device(blankState(), sim);
  const p = fresh.pull();
  assert.equal(p.conflicts, 0);
  assert.equal(fresh.state.dailyLogs[1].steps, 5);
  assert.equal(fresh.state.weighIns.length, 1);
  assert.equal(fresh.state.settings.startDate, '2026-01-01');
  const half = new Device(stateWith([withDay(1)]), sim);   // day exists but is blank
  assert.equal(half.pull().conflicts, 0);
  assert.equal(half.state.dailyLogs[1].steps, 5);
});

test('summariseConflicts caps at five', () => {
  assert.equal(summariseConflicts(['a', 'b']), 'a; b');
  assert.equal(summariseConflicts(['1', '2', '3', '4', '5', '6', '7']), '1; 2; 3; 4; 5 (+2 more)');
});

test('deleted weigh-in stays deleted: save removes it from the cloud and pull does not resurrect it', () => {
  const sim = new Sim();
  const a = new Device(ownerState([]), sim);
  a.state.weighIns = [
    { date: '2026-01-01', dayNumber: 1, weight: 90 },
    { date: '2026-01-08', dayNumber: 8, weight: 89 }
  ];
  a.save();
  assert.equal(sim.cloud.profile.weighIns.length, 2);
  // user deletes the Jan 8 entry on this device
  a.state.weighIns = [{ date: '2026-01-01', dayNumber: 1, weight: 90 }];
  const p = a.save();
  assert.equal(p.conflicts.length, 0);
  assert.deepEqual(sim.cloud.profile.weighIns.map((x: any) => x.date), ['2026-01-01']);
  // a later pull must not bring the deleted entry back
  a.pull();
  assert.deepEqual(a.state.weighIns.map((x) => x.date), ['2026-01-01']);
});

test('deleted measurement stays deleted on save and pull (mirrors weigh-ins)', () => {
  const sim = new Sim();
  const a = new Device(ownerState([]), sim);
  const m1 = { date: '2026-01-01', dayNumber: 1, measurements: { chest: 100, waist: 90, hips: 100, arms: 35 } };
  const m2 = { date: '2026-01-08', dayNumber: 8, measurements: { chest: 99, waist: 89, hips: 99, arms: 34 } };
  a.state.measurementHistory = [m1, m2];
  a.save();
  a.state.measurementHistory = [m1];
  const p = a.save();
  assert.equal(p.conflicts.length, 0);
  assert.deepEqual(sim.cloud.profile.measurementHistory.map((x: any) => x.date), ['2026-01-01']);
  a.pull();
  assert.deepEqual(a.state.measurementHistory.map((x) => x.date), ['2026-01-01']);
});

test('delete here + changed in the cloud is a conflict on save AND pull; nothing silently deleted or resurrected', () => {
  const sim = new Sim();
  const a = new Device(ownerState([]), sim);
  a.state.weighIns = [{ date: '2026-01-01', dayNumber: 1, weight: 90 }];
  a.save();
  sim.cloud.profile.weighIns = [{ date: '2026-01-01', dayNumber: 1, weight: 88.5 }]; // another device corrected it
  a.state.weighIns = []; // user deleted it here
  const p = a.save();
  assert.deepEqual(p.conflicts.map((c) => [c.kind, c.id]), [['weighIn', '2026-01-01']]);
  assert.equal(sim.cloud.profile.weighIns.length, 1); // cloud untouched
  const pull = a.pull();
  assert.equal(pull.conflictDocs.some((c) => c.kind === 'weighIn' && c.id === '2026-01-01'), true);
  assert.equal(a.state.weighIns.length, 0); // local deletion kept, conflict left for the user to resolve
});

test('cloud-only weigh-in from another device (no base entry) is still adopted on pull', () => {
  const sim = new Sim();
  const a = new Device(ownerState([]), sim);
  sim.cloud.profile.weighIns = [{ date: '2026-01-02', dayNumber: 2, weight: 91 }];
  a.pull();
  assert.deepEqual(a.state.weighIns.map((x) => x.date), ['2026-01-02']);
});

test('default diet/times text never syncs as facts, even after onboarding; custom edits do sync', () => {
  const sim = new Sim();
  const a = new Device(ownerState([]), sim); // onboardingCompleted: true
  a.state.settings = {
    ...a.state.settings,
    dietaryExclusions: PROFILE_DEFAULTS.dietaryExclusions,
    wakeTime: PROFILE_DEFAULTS.wakeTime,
    workTime: PROFILE_DEFAULTS.workTime,
    gymTime: PROFILE_DEFAULTS.gymTime
  } as any;
  a.save();
  assert.equal('dietaryExclusions' in sim.cloud.profile, false);
  assert.equal('wakeTime' in sim.cloud.profile, false);
  assert.equal('workTime' in sim.cloud.profile, false);
  assert.equal('gymTime' in sim.cloud.profile, false);
  a.state.settings = { ...a.state.settings, gymTime: '06:00 AM to 07:00 AM' } as any;
  a.save();
  assert.equal(sim.cloud.profile.gymTime, '06:00 AM to 07:00 AM');
});

import { dedupeConflicts, buildProfileWrite } from './cloudMerge';

test('S2: dedupeConflicts keeps one entry per (kind,id), first label wins', () => {
  const out = dedupeConflicts([
    { kind: 'daily', id: '1', label: 'day 1 (waterMl)' }, { kind: 'daily', id: '1', label: 'day 1 (waterMl)' },
    { kind: 'workout', id: '1', label: 'workout' }, { kind: 'daily', id: '2', label: 'day 2' }
  ] as any);
  assert.equal(out.length, 3);
  assert.equal((out[0] as any).label, 'day 1 (waterMl)');
  assert.deepEqual(dedupeConflicts(undefined), []);
});

test('S3: profile doc is not written when only the timestamp would change', () => {
  const empty: any = { fields: {}, writtenWeighInDates: [], writtenMeasurementDates: [], deletedWeighInDates: [], deletedMeasurementDates: [], conflicts: [], inSync: [] };
  assert.equal(buildProfileWrite(empty, 'u1', 'now', true), null);
  const created = buildProfileWrite(empty, 'u1', 'now', false);
  assert.equal(created?.userId, 'u1'); // a missing doc is still created
  const real = buildProfileWrite({ ...empty, fields: { age: 30 } }, 'u1', 'now', true);
  assert.deepEqual(real, { userId: 'u1', role: 'owner', updatedAt: 'now', age: 30 });
  const wi = buildProfileWrite({ ...empty, weighIns: [{ date: '2026-01-01', weightKg: 90 }] }, 'u1', 'now', true);
  assert.ok(wi && wi.weighIns);
});

test('S3: a save whose only difference is a day conflict plans no profile field change', () => {
  const st = getInitialState();
  st.settings = { ...st.settings, displayName: 'Heet' } as any;
  const local = { ...st, dailyLogs: { 1: { ...(getInitialState().dailyLogs[1] as any), waterMl: 500 } } } as any;
  const cloudDay = { ...(getInitialState().dailyLogs[1] as any), waterMl: 900, dayNumber: 1 };
  const cloud: any = { profile: { userId: 'u1', role: 'owner', displayName: 'Heet' }, logDocs: [{ id: '2026-01-01', data: cloudDay }], workoutDocs: [] };
  const base: any = { daily: { '2026-01-01': 'old-hash' }, workouts: {}, profile: {}, weighIns: {}, measurements: {} };
  const plan = planSave(local, cloud, base, 'u1', 'now');
  assert.equal(plan.daily.conflicts.length <= 1, true);
  if (plan.conflicts.length) assert.equal(buildProfileWrite(plan.profile, 'u1', 'now', true), null);
});
