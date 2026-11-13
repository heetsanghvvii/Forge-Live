import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasMeaningfulLocalData, isSetupOnlyDevice, planPull, buildProfilePayload } from './cloudMerge';
import type { CloudSnapshot } from './cloudMerge';
import { evaluateLink, guardedPull, needsLinkConfirmation, FIRST_LINK_PULL_MESSAGE } from './accountLink';
import { runPull, readFailureMessage, ABSENT_CLOUD_MESSAGE, friendlyError } from './cloudRead';
import { rebasePulled } from './syncState';
import { emptyBase } from './syncBase';
import { getInitialState, createDefaultDailyLog } from './storage';
import type { AppState } from '../types';

/** What a device looks like after "Confirm programme start" before sign-in: 63 default logs, confirmed start. */
function setupOnly(over: any = {}): AppState {
  const s = getInitialState();
  s.settings = { ...s.settings, startDate: '2026-10-25', confirmedProgrammeStart: true, onboardingCompleted: true, activePhase: 'phase2', timezone: 'America/New_York', bodyweightKg: 80, startingWeightKg: 80, ...over };
  return s;
}
const withLog = (s: AppState, day: number, patch: any): AppState => ({ ...s, dailyLogs: { ...s.dailyLogs, [day]: { ...s.dailyLogs[day], ...patch } } });

const cloudSnap = (): CloudSnapshot => ({
  profile: { userId: 'u1', programmeStartDate: '2026-08-01', currentPhase: 'phase3', displayName: 'Heet', heightCm: 180, weighIns: [{ date: '2026-08-02', dayNumber: 2, weight: 90 }] },
  logDocs: [{ id: '2026-08-02', data: { date: '2026-08-02', dayNumber: 2, phase: 'phase1', waterMl: 2500, steps: 8000, entered: { water: true, steps: true } } }],
  workoutDocs: []
});

// ---- hasMeaningfulLocalData decisions ----
test('setup only (confirmed start, nothing else) is not meaningful', () => {
  assert.equal(hasMeaningfulLocalData(setupOnly()), false);
  assert.equal(isSetupOnlyDevice(setupOnly()), true);
});
test('defaults only (fresh install) is not meaningful', () => {
  assert.equal(hasMeaningfulLocalData(getInitialState()), false);
});
test('onboarding bodyweight alone creates no weigh-in and is not meaningful', () => {
  const s = setupOnly({ bodyweightKg: 77.5, startingWeightKg: 77.5 });
  assert.equal(s.weighIns.length, 0);
  assert.equal(hasMeaningfulLocalData(s), false);
});
test('setup + weigh-in / water / steps / note / workout are meaningful', () => {
  assert.equal(hasMeaningfulLocalData({ ...setupOnly(), weighIns: [{ date: '2026-10-25', dayNumber: 1, weight: 80 }] }), true);
  assert.equal(hasMeaningfulLocalData(withLog(setupOnly(), 1, { waterMl: 500 })), true);
  assert.equal(hasMeaningfulLocalData(withLog(setupOnly(), 1, { steps: 1200 })), true);
  assert.equal(hasMeaningfulLocalData(withLog(setupOnly(), 1, { notes: 'hi' })), true);
  assert.equal(hasMeaningfulLocalData({ ...setupOnly(), workoutLogs: { d1: { phase: 'phase1', workoutCompleted: true } as any } }), true);
});
test('an explicitly entered zero is a real entry', () => {
  for (const m of ['water', 'steps', 'sleep', 'calories'] as const) {
    assert.equal(hasMeaningfulLocalData(withLog(setupOnly(), 1, { entered: { [m]: true } })), true, m);
  }
  assert.equal(hasMeaningfulLocalData(withLog(setupOnly(), 1, { sleepHours: 0, entered: { sleep: true } })), true);
  assert.equal(hasMeaningfulLocalData(withLog(setupOnly(), 1, { mealEstimates: [{ name: 'zero meal', calories: 0 }] })), true);
});
test('untouched default values are not entries', () => {
  const log = createDefaultDailyLog(1, '2026-10-25');
  assert.equal(hasMeaningfulLocalData({ ...setupOnly(), dailyLogs: { 1: { ...log, waterMl: 0, steps: 0, addedCarbs: [], hungerRating: undefined } as any } }), false);
});
test('entries without any setup are meaningful', () => {
  assert.equal(hasMeaningfulLocalData(withLog(getInitialState(), 2, { waterMl: 250 })), true);
});

// ---- evaluateLink ----
test('setup-only: empty-device; setup + entry: first-link', () => {
  assert.equal(evaluateLink(setupOnly(), 'u1').kind, 'empty-device');
  assert.equal(evaluateLink(withLog(setupOnly(), 1, { entered: { water: true } }), 'u1').kind, 'first-link');
});
test('save confirmation: setup-only and first-link both ask, blank does not', () => {
  const link = (s: AppState) => evaluateLink(s, 'u1');
  assert.equal(needsLinkConfirmation(setupOnly(), link(setupOnly())), true);
  const withEntry = withLog(setupOnly(), 1, { waterMl: 1 });
  assert.equal(needsLinkConfirmation(withEntry, link(withEntry)), true);
  assert.equal(needsLinkConfirmation(getInitialState(), link(getInitialState())), false);
});

// ---- planPull: settings on a setup-only pull ----
test('setup-only pull adopts the cloud settings, phase dates, data and re-dates empty days', () => {
  const local = setupOnly();
  const plan = planPull(local, cloudSnap(), emptyBase());
  const st = plan.merged.settings;
  assert.equal(st.startDate, '2026-08-01');
  assert.equal(st.confirmedProgrammeStart, true);
  assert.equal(st.activePhase, 'phase3');
  assert.equal(st.phase2StartDate, '2026-08-08');
  assert.equal(st.phase3StartDate, '2026-09-05');
  assert.equal(st.displayName, 'Heet');
  assert.equal(st.heightCm, 180);
  assert.equal(st.bodyweightKg, 80); // cloud carries none: kept
  assert.equal(st.timezone, 'Asia/Kolkata'); // cloud omits defaults: default, not this device's pick
  assert.equal(plan.conflicts, 0);
  assert.equal(plan.merged.weighIns.length, 1);
  assert.equal(plan.merged.dailyLogs[2].waterMl, 2500);
  assert.equal(plan.merged.dailyLogs[3].date, '2026-08-03');
  assert.equal(plan.merged.currentDayNumber, 36);
});
test('setup-only pull with an unchanged phase keeps current day', () => {
  const local = setupOnly({ activePhase: 'phase1' });
  const snap = cloudSnap(); snap.profile.currentPhase = 'phase1';
  assert.equal(planPull({ ...local, currentDayNumber: 3 }, snap, emptyBase()).merged.currentDayNumber, 3);
});
test('with a real local entry, local settings win and conflicts are reported (unchanged behaviour)', () => {
  const local = withLog(setupOnly(), 1, { waterMl: 300 });
  const plan = planPull(local, cloudSnap(), emptyBase());
  assert.equal(plan.merged.settings.startDate, '2026-10-25');
  assert.equal(plan.merged.settings.activePhase, 'phase2');
  assert.ok(plan.conflictDocs.some((c) => c.id === 'programmeStartDate'));
});
test('a linked device with no entries still uses the three-way rules (never silently overwritten)', () => {
  const local = setupOnly({ linkedFirebaseUid: 'u1' });
  const plan = planPull(local, cloudSnap(), emptyBase());
  assert.equal(plan.merged.settings.startDate, '2026-10-25');
});
test('pull from a cloud with no programme start leaves setup alone', () => {
  const snap: CloudSnapshot = { profile: { userId: 'u1', weighIns: [{ date: '2026-08-02', dayNumber: 2, weight: 90 }] }, logDocs: [], workoutDocs: [] };
  const st = planPull(setupOnly(), snap, emptyBase()).merged.settings;
  assert.equal(st.startDate, '2026-10-25');
  assert.equal(st.activePhase, 'phase2');
});
test('rebasePulled carries the pulled start and phase dates', () => {
  const snapshot = setupOnly();
  const merged = planPull(snapshot, cloudSnap(), emptyBase()).merged;
  const r = rebasePulled(snapshot, merged, snapshot);
  assert.equal(r.state.settings.startDate, '2026-08-01');
  assert.equal(r.state.settings.confirmedProgrammeStart, true);
  assert.equal(r.state.settings.activePhase, 'phase3');
  assert.equal(r.state.settings.phase2StartDate, '2026-08-08');
  assert.equal(r.state.settings.phase3StartDate, '2026-09-05');
});

// ---- guardedPull / runPull with fakes ----
const okRead = async () => ({ profileExists: true, snap: cloudSnap() });
const deps = (pull: any, uid: string | null = 'u1') => ({ uid: () => uid, pull });

test('guardedPull on setup-only device loads the cloud and links it', async () => {
  const local = setupOnly();
  const res = await guardedPull(local, deps((s: AppState) => runPull(s, 'u1', okRead, () => emptyBase())));
  assert.equal(res.success, true);
  assert.equal(res.merged!.settings.startDate, '2026-08-01');
  assert.equal(res.merged!.settings.linkedFirebaseUid, 'u1');
});
test('guardedPull refuses setup + real entry and never reads the cloud', async () => {
  let reads = 0;
  const local = withLog(setupOnly(), 1, { entered: { water: true } });
  const res = await guardedPull(local, deps(async () => { reads++; return { success: true } as any; }));
  assert.equal(res.success, false);
  assert.equal(res.error, FIRST_LINK_PULL_MESSAGE);
  assert.equal(reads, 0);
});
test('absent cloud profile => reason absent, local untouched, nothing written', async () => {
  const local = setupOnly();
  const before = JSON.stringify(local);
  let writes = 0;
  const res = await guardedPull(local, deps((s: AppState) => runPull(s, 'u1', async () => ({ profileExists: false, snap: { profile: {}, logDocs: [], workoutDocs: [] } }), () => emptyBase())));
  assert.equal(res.success, false);
  assert.equal(res.reason, 'absent');
  assert.equal(res.merged, undefined);
  assert.equal(JSON.stringify(local), before);
  assert.equal(writes, 0);
  assert.match(ABSENT_CLOUD_MESSAGE, /no cloud data yet.*local setup was kept.*Save to cloud/);
});
test('failed reads are errors, never "absent"', async () => {
  for (const [code, text] of [['permission-denied', /Permission denied/], ['unavailable', /offline/], ['network-request-failed', /offline/], ['weird', /boom/]] as const) {
    const local = setupOnly();
    const before = JSON.stringify(local);
    const res = await guardedPull(local, deps((s: AppState) => runPull(s, 'u1', async () => { throw Object.assign(new Error('boom'), { code }); }, () => emptyBase())));
    assert.equal(res.success, false);
    assert.equal(res.reason, 'error', code);
    assert.equal(res.merged, undefined);
    assert.equal(res.baseEntries, undefined);
    assert.match(res.error!, text);
    assert.equal(JSON.stringify(local), before);
  }
});
test('read failure message is honest and plain', () => {
  assert.equal(readFailureMessage(friendlyError({ code: 'permission-denied' }, 'x')), 'Could not read the cloud (Permission denied: sign in with the account that owns these records). Nothing was changed.');
});
test('signed out and mismatch are blocked before any read', async () => {
  let reads = 0;
  const pull = async () => { reads++; return { success: true } as any; };
  assert.equal((await guardedPull(setupOnly(), deps(pull, null))).success, false);
  assert.equal((await guardedPull(setupOnly({ linkedFirebaseUid: 'other' }), deps(pull))).success, false);
  assert.equal(reads, 0);
});

// ---- coach summary / payload unaffected: a setup alone is still shareable only when confirmed ----
test('profile payload still carries the confirmed start for a later explicit Save', () => {
  assert.equal(buildProfilePayload(setupOnly().settings, 'u1', 'now').programmeStartDate, '2026-10-25');
});
