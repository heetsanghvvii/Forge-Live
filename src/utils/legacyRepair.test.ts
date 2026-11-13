import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectAmbiguousSleep,
  detectDateMismatches,
  buildRepairPreview,
  preflightSaveReview,
  applyDateRepair,
  applySleepRepair,
  revertDateRepair,
  revertSleepRepair,
  confirmSleepEntries,
  undoSleepConfirmation,
} from './legacyRepair';
import { planDailyWrites, dailyLogHasData } from './cloudMerge';
import { calculateDateForDayNumber } from './storage';
import type { AppState, DailyLog } from '../types';

const NOW = '2026-10-25T17:00:00.000Z';

const blankLog = (day: number, date: string): DailyLog => ({
  date,
  dayNumber: day,
  phase: day >= 36 ? 'phase3' : day >= 8 ? 'phase2' : 'phase1',
  checklist: { workout: false, cardio: false, water: false, photo: false, community: false },
  macrosConsumed: { calories: 0, protein: 0, fat: 0, carbs: 0 },
  waterMl: 0,
  steps: 0,
  addedCarbs: [],
  supplements: { whey: false, creatine: false, multivitamin: false, vitaminD3: false, carnitine: false, acv: false },
});

/** Fresh state exactly as the current (94d1b7a) generator makes it: sequential dates, no sleep. */
const freshState = (start = '2026-10-25'): AppState => {
  const dailyLogs: Record<number, DailyLog> = {};
  for (let d = 1; d <= 63; d++) dailyLogs[d] = blankLog(d, calculateDateForDayNumber(start, d));
  return { settings: { startDate: start }, dailyLogs } as unknown as AppState;
};

/** Legacy state as observed on a real device (old-build generator): broken dates + phantom 7.5 sleep. */
const legacyState = (): AppState => {
  const s = freshState('2026-10-24');
  const logs = s.dailyLogs as Record<number, DailyLog>;
  // old generator's broken anchors, matching the observed device export:
  logs[8] = { ...logs[8], date: '2026-10-23' };   // day 8 overlaps backwards
  logs[9] = { ...logs[9], date: '2026-10-24' };   // day 9 duplicates day 1's date
  logs[17] = { ...logs[17], date: '2026-11-01' }; // duplicate with day 18
  logs[18] = { ...logs[18], date: '2026-11-01' };
  for (let d = 1; d <= 63; d++) logs[d] = { ...logs[d], sleepHours: 7.5 }; // phantom prefill, no entered flags
  // one genuinely entered day (user typed sleep 7 and a note on day 8)
  logs[8] = { ...logs[8], sleepHours: 7, entered: { sleep: true }, generalNotes: 'real entry' };
  return s;
};

test('clean fresh state needs no review (preflight returns null)', () => {
  const s = freshState();
  assert.equal(preflightSaveReview(s, NOW), null);
  const p = buildRepairPreview(s, NOW);
  assert.equal(p.isClean, true);
  assert.equal(p.plannedCollisions.length, 0);
});

test('legacy state: preview flags date mismatches, phantom sleep and collisions without mutating input', () => {
  const s = legacyState();
  const frozen = structuredClone(s);
  Object.freeze(s); Object.freeze(s.dailyLogs);
  const p = buildRepairPreview(s, NOW);
  assert.equal(p.isClean, false);
  const days = p.dateMismatches.map((m) => m.day);
  assert.ok(days.includes(8) && days.includes(9) && days.includes(17) && days.includes(18), JSON.stringify(days));
  const m8 = p.dateMismatches.find((m) => m.day === 8)!;
  assert.equal(m8.currentDate, '2026-10-23');
  assert.equal(m8.derivedDate, calculateDateForDayNumber('2026-10-24', 8));
  // phantom sleep flagged on untouched days only: 62 days (day 8 is entered)
  assert.equal(p.ambiguousSleep.length, 62);
  assert.ok(!p.ambiguousSleep.some((a) => a.day === 8));
  assert.ok(p.plannedCollisions.length > 0, 'expected collisions reproducing the first-link failure');
  // input untouched
  assert.deepEqual(structuredClone(s), frozen);
});

test('sleep WITH entered flag is never flagged ambiguous, whatever the value', () => {
  const logs: Record<number, DailyLog> = {
    1: { ...blankLog(1, '2026-10-25'), sleepHours: 7.5, entered: { sleep: true } },
    2: { ...blankLog(2, '2026-10-26'), sleepHours: 7.5 },
  };
  const flagged = detectAmbiguousSleep(logs as any);
  assert.deepEqual(flagged.map((f) => f.day), [2]);
});

test('explicit zero (entered.sleep=false, sleepHours 0) counts as real data and is not flagged', () => {
  const log = { ...blankLog(1, '2026-10-25'), sleepHours: 0, entered: { sleep: false } };
  assert.equal(dailyLogHasData(log), true);
  assert.equal(detectAmbiguousSleep({ 1: log } as any).length, 0);
});

test('applyDateRepair: unique sequential dates, user data intact, provenance kept, input unchanged', () => {
  const s = legacyState();
  const original = structuredClone(s);
  const repaired = applyDateRepair(s);
  // input untouched
  assert.deepEqual(structuredClone(s), original);
  const logs = repaired.dailyLogs as Record<number, any>;
  const dates = Array.from({ length: 63 }, (_, i) => logs[i + 1].date);
  assert.equal(new Set(dates).size, 63, 'all dates unique after repair');
  for (let d = 1; d <= 63; d++) {
    assert.equal(logs[d].date, calculateDateForDayNumber('2026-10-24', d), `day ${d}`);
  }
  // user data preserved on the entered day
  assert.equal(logs[8].sleepHours, 7);
  assert.equal(logs[8].generalNotes, 'real entry');
  assert.deepEqual(logs[8].entered, { sleep: true });
  // provenance recorded
  assert.equal(logs[8].legacyDate, '2026-10-23');
  assert.equal(logs[9].legacyDate, '2026-10-24');
  // untouched-by-repair day has no provenance
  assert.equal(logs[1].legacyDate, undefined);
});

test('after consented date+sleep repair, save plans ONLY entered days with zero collisions', () => {
  const s = legacyState();
  const preview = buildRepairPreview(s, NOW);
  const step1 = applyDateRepair(s);
  // user confirms: the 62 pre-filled sleeps were placeholders
  const step2 = applySleepRepair(step1, preview.ambiguousSleep.map((a) => a.day));
  const plan = planDailyWrites(step2.dailyLogs as any, [], {}, NOW);
  assert.equal(plan.collisions.length, 0);
  assert.equal(plan.writes.length, 1, 'only the genuinely entered day 8 is written');
  assert.equal(plan.writes[0].payload.dayNumber, 8);
  assert.equal(plan.writes[0].payload.sleepHours, 7);
  // phantom sleeps cleared, with provenance
  const logs = step2.dailyLogs as Record<number, any>;
  assert.equal(logs[9].sleepHours, undefined);
  assert.equal(logs[9].legacySleepHours, 7.5);
});

test('applySleepRepair touches ONLY the listed days and never entered values', () => {
  const s = legacyState();
  const repaired = applySleepRepair(s, [9]); // user confirms only day 9
  const logs = repaired.dailyLogs as Record<number, any>;
  assert.equal(logs[9].sleepHours, undefined);
  assert.equal(logs[10].sleepHours, 7.5, 'unlisted ambiguous day keeps its value');
  assert.equal(logs[8].sleepHours, 7, 'entered day never cleared');
});

test('collision guard preserved: UNrepaired legacy state still collides (no silent bypass)', () => {
  const s = legacyState();
  const plan = planDailyWrites(s.dailyLogs as any, [], {}, NOW);
  assert.ok(plan.collisions.length > 0);
});

test('phase boundaries: day 7/8 straddle phase2StartDate, day 35/36 straddle phase3StartDate', () => {
  const start = '2026-10-25';
  assert.equal(calculateDateForDayNumber(start, 8), calculateDateForDayNumber(start, 1 + 7));
  const s = freshState(start);
  const logs = s.dailyLogs as Record<number, DailyLog>;
  const d7 = Date.parse(logs[7].date + 'T00:00:00Z');
  const d8 = Date.parse(logs[8].date + 'T00:00:00Z');
  const d35 = Date.parse(logs[35].date + 'T00:00:00Z');
  const d36 = Date.parse(logs[36].date + 'T00:00:00Z');
  assert.equal(d8 - d7, 86400000);
  assert.equal(d36 - d35, 86400000);
});

test('repair is idempotent: second pass changes nothing', () => {
  const once = applyDateRepair(legacyState());
  const twice = applyDateRepair(once);
  assert.deepEqual(twice, once);
  assert.equal(buildRepairPreview(once, NOW).dateMismatches.length, 0);
});test('revertDateRepair restores old dates only when untouched since repair', () => {
  const s = legacyState();
  const repaired = applyDateRepair(s);
  // user edits day 9's date after the repair (simulated)
  const logs = repaired.dailyLogs as Record<number, any>;
  const edited = { ...repaired, dailyLogs: { ...logs, 9: { ...logs[9], date: '2026-10-20' } } };
  const reverted = revertDateRepair(edited as AppState);
  const rl = reverted.dailyLogs as Record<number, any>;
  assert.equal(rl[8].date, '2026-10-23', 'day 8 back to its legacy date');
  assert.equal(rl[8].legacyDate, undefined, 'provenance cleared');
  assert.equal(rl[9].date, '2026-10-20', 'post-repair user edit is never clobbered');
  assert.equal(rl[9].legacyDate, '2026-10-24', 'provenance kept for the edited day');
  // round trip: repair -> revert == original dates
  const full = revertDateRepair(applyDateRepair(s));
  const fl = full.dailyLogs as Record<number, any>;
  assert.equal(fl[17].date, '2026-11-01');
  assert.equal(fl[1].date, '2026-10-24');
});

test('revertSleepRepair restores values only where nothing new was entered', () => {
  const s = legacyState();
  const preview = buildRepairPreview(s, NOW);
  const cleared = applySleepRepair(s, preview.ambiguousSleep.map((a) => a.day));
  const logs = cleared.dailyLogs as Record<number, any>;
  // user enters sleep 6.5 on day 10 after clearing
  const edited = { ...cleared, dailyLogs: { ...logs, 10: { ...logs[10], sleepHours: 6.5, entered: { sleep: true } } } };
  const reverted = revertSleepRepair(edited as AppState);
  const rl = reverted.dailyLogs as Record<number, any>;
  assert.equal(rl[9].sleepHours, 7.5, 'cleared value restored');
  assert.equal(rl[9].legacySleepHours, undefined);
  assert.equal(rl[10].sleepHours, 6.5, 'new user entry never overwritten');
  assert.equal(rl[10].legacySleepHours, 7.5, 'its provenance survives');
});
test('keep-as-logged CONFIRMS values as real: semantics preserved, gate clears, data syncs', () => {
  const s = legacyState();
  const fixed = applyDateRepair(s);
  assert.ok(preflightSaveReview(fixed, NOW) !== null, 'gated before review');
  const ambiguous = buildRepairPreview(fixed, NOW).ambiguousSleep.map((a) => a.day);
  const kept = confirmSleepEntries(fixed, ambiguous);
  const logs = kept.dailyLogs as Record<number, any>;
  // semantics: value is now an explicitly confirmed real entry, not rejected, not phantom
  assert.equal(logs[9].sleepHours, 7.5, 'value unchanged');
  assert.equal(logs[9].entered.sleep, true, 'confirmed as real (native semantics)');
  assert.equal(logs[9].legacySleepConfirmedByReview, true, 'provenance marks review-added confirmation');
  assert.equal(logs[8].legacySleepConfirmedByReview, undefined, 'directly entered day has no review provenance');
  assert.equal(dailyLogHasData(logs[9]), true, 'still counts as real data');
  assert.equal(preflightSaveReview(kept, NOW), null, 'gate clears after review');
  // save planning INCLUDES kept days (data syncs, not excluded) with zero collisions
  const plan = planDailyWrites(kept.dailyLogs as any, [], {}, NOW);
  assert.equal(plan.collisions.length, 0);
  assert.equal(plan.writes.length, 63, 'every day with data is written - kept values sync to cloud');
  const w9 = plan.writes.find((w) => w.payload.dayNumber === 9)!;
  assert.equal(w9.payload.sleepHours, 7.5, 'kept value actually goes to the cloud payload');
});

test('undo of keep-as-logged returns days to unconfirmed and re-gates the save', () => {
  const s = legacyState();
  const fixed = applyDateRepair(s);
  const ambiguous = buildRepairPreview(fixed, NOW).ambiguousSleep.map((a) => a.day);
  const kept = confirmSleepEntries(fixed, ambiguous);
  const undone = undoSleepConfirmation(kept);
  const logs = undone.dailyLogs as Record<number, any>;
  assert.equal(logs[9].sleepHours, 7.5, 'value still preserved after undo');
  assert.equal(logs[9].entered, undefined, 'confirmation flag removed');
  assert.equal(logs[9].legacySleepConfirmedByReview, undefined, 'provenance cleared');
  assert.ok(preflightSaveReview(undone, NOW) !== null, 'save is honestly gated again');
  // directly entered day 8 is never touched by the undo
  assert.equal(logs[8].entered.sleep, true);
});

test('clear path: value removed with provenance, undo restores it exactly', () => {
  const s = legacyState();
  const cleared = applySleepRepair(s, [9, 10]);
  const logs = cleared.dailyLogs as Record<number, any>;
  assert.equal(logs[9].sleepHours, undefined);
  assert.equal(logs[9].legacySleepHours, 7.5);
  const restored = revertSleepRepair(cleared);
  const rl = restored.dailyLogs as Record<number, any>;
  assert.equal(rl[9].sleepHours, 7.5, 'value restored exactly');
  assert.equal(rl[9].legacySleepHours, undefined);
  assert.equal(rl[9].entered, undefined, 'back to unconfirmed, not reinterpreted');
});

test('save/load round trip: kept values survive a planned write -> cloud doc -> merge into blank device', async () => {
  const { mergeCloudIntoLocal } = await import('./cloudMerge');
  const s = legacyState();
  const fixed = applyDateRepair(s);
  const ambiguous = buildRepairPreview(fixed, NOW).ambiguousSleep.map((a) => a.day);
  const kept = confirmSleepEntries(fixed, ambiguous);
  // 1) plan the save
  const plan = planDailyWrites(kept.dailyLogs as any, [], {}, NOW);
  assert.equal(plan.collisions.length, 0);
  // 2) pretend the cloud stored exactly the planned payloads
  const remoteLogs: Record<number, any> = {};
  for (const w of plan.writes) remoteLogs[w.payload.dayNumber] = w.payload;
  // 3) a blank device pulls and merges
  const blank: any = { settings: { startDate: '2026-10-24' }, dailyLogs: {} };
  const merged = mergeCloudIntoLocal(blank, { dailyLogs: remoteLogs } as any);
  const m9 = (merged.merged.dailyLogs as any)[9];
  assert.equal(m9.sleepHours, 7.5, 'kept value survives the full save -> load round trip');
  assert.equal(m9.entered?.sleep, true, 'confirmation survives the round trip');
});
