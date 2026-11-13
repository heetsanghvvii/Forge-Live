import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAutoSyncController, DISABLED_MESSAGES } from './autoSyncController';
import type { PullLike } from './autoSyncController';
import { evaluateLink } from './accountLink';
import { AUTOSAVE_PENDING_KEY } from './autoSave';
import { syncableHash, rebasePulled } from './syncState';
import { planSave, planPull, hashDailyDoc, hashWorkoutDoc, hashEntry } from './cloudMerge';
import type { CloudSnapshot } from './cloudMerge';
import { emptyBase, applyBaseEntries } from './syncBase';
import type { SyncBase } from './syncBase';
import type { AppState, DailyLog } from '../types';

const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

const log = (day: number, over: any = {}): DailyLog => ({
  date: `2026-01-${String(day).padStart(2, '0')}`, dayNumber: day, phase: 'phase1',
  checklist: { workout: false, cardio: false, water: false, photo: false, community: false },
  macrosConsumed: { calories: 0, protein: 0, fat: 0, carbs: 0 }, waterMl: 0, steps: 0,
  supplements: { whey: false, creatine: false, multivitamin: false, vitaminD3: false, carnitine: false, acv: false }, ...over
});
const mkState = (over: any = {}): AppState => ({
  settings: { startDate: '2026-01-01', confirmedProgrammeStart: true, activePhase: 'phase1', phase2Unlocked: false, phase3Unlocked: false, fastingStartHour: 20, fastingEndHour: 12, waterGoalMl: 3000, stepGoal: 10000, onboardingCompleted: true, linkedFirebaseUid: 'u1', ...(over.settings || {}) },
  currentDayNumber: 1, selectedDayNumber: 1,
  dailyLogs: { 1: log(1, { steps: 1 }), 2: log(2, { steps: 2 }) }, workoutLogs: {}, weighIns: [], measurementHistory: [],
  photos: [], learnedLessonIds: [], quizAnswers: {}, avoidedMistakes: {}, ...Object.fromEntries(Object.entries(over).filter(([k]) => k !== 'settings'))
} as AppState);

interface Cfg {
  state?: AppState; uid?: string | null; online?: boolean; viewer?: boolean; marker?: boolean;
  save?: () => Promise<any>; commit?: (u: string, e: any[]) => void; pull?: (s: AppState) => Promise<PullLike>;
}
function setup(cfg: Cfg = {}) {
  let t = 1_000_000; let id = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const mem = new Map<string, string>();
  if (cfg.marker) mem.set(AUTOSAVE_PENDING_KEY, '{"since":1}');
  const env = { state: cfg.state ?? mkState(), uid: cfg.uid === undefined ? 'u1' : cfg.uid, online: cfg.online ?? true, viewer: cfg.viewer ?? false };
  const saves: AppState[] = []; const pulls: AppState[] = []; const committed: any[] = [];
  let remote: () => void = () => {}; let subs = 0; let unsubs = 0;
  const impl = {
    save: cfg.save ?? (async () => ({ success: true })),
    pull: cfg.pull ?? (async (): Promise<PullLike> => ({ success: true, merged: env.state, userId: 'u1', baseEntries: [] }))
  };
  const c = createAutoSyncController({
    getState: () => env.state, getUid: () => env.uid, evaluateLink,
    save: async s => { saves.push(s); return impl.save(); },
    pull: async s => { pulls.push(s); return impl.pull(s); },
    applyState: u => { env.state = u(env.state); },
    commitBase: (uid, e) => { committed.push([uid, e]); cfg.commit?.(uid, e); },
    subscribeRemote: cb => { remote = cb; subs++; return () => { unsubs++; }; },
    isOnline: () => env.online, isViewer: () => env.viewer,
    storage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, v); }, removeItem: k => { mem.delete(k); } },
    now: () => t,
    setTimer: (fn, ms) => { id++; timers.set(id, { at: t + ms, fn }); return id; },
    clearTimer: h => { timers.delete(h as number); },
    random: () => 0
  });
  const kinds: string[] = [];
  c.subscribe(s => { if (kinds[kinds.length - 1] !== s.kind) kinds.push(s.kind); });
  return {
    c, env, saves, pulls, committed, kinds, mem, fire: () => remote(), subs: () => subs, unsubs: () => unsubs,
    impl,
    /** user edit: new state, then the App effect notifies */
    edit(fn: (s: AppState) => AppState) { env.state = fn(env.state); c.onStateChanged(env.state); },
    async advance(ms: number) {
      const end = t + ms;
      for (;;) {
        const next = [...timers.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]); t = Math.max(t, next[1].at); next[1].fn(); await tick();
      }
      t = end; await tick();
    }
  };
}
const steps = (n: number) => (s: AppState): AppState => ({ ...s, dailyLogs: { ...s.dailyLogs, 1: { ...s.dailyLogs[1], steps: n } } });

test('(a) opening the app and signing in trigger zero saves', async () => {
  const s = setup({ uid: null });
  await s.advance(60000);
  s.env.uid = 'u1'; s.c.refresh();
  s.c.onStateChanged(s.env.state);
  await s.advance(60000);
  assert.equal(s.saves.length, 0);
});

test('(b) one edit => exactly one debounced save; Pending -> Saving -> Synced', async () => {
  const s = setup();
  s.edit(steps(5));
  assert.equal(s.c.getStatus().kind, 'pending');
  await s.advance(2900); assert.equal(s.saves.length, 0);
  await s.advance(200); assert.equal(s.saves.length, 1);
  assert.equal(s.c.getStatus().kind, 'synced');
  assert.match(s.c.getStatus().lastSyncedLabel!, /^\d\d:\d\d$/);
  assert.deepEqual(s.kinds.filter(k => ['pending', 'saving', 'synced'].includes(k)), ['pending', 'saving', 'synced']);
  s.edit(steps(6)); s.edit(steps(7));
  await s.advance(4000); assert.equal(s.saves.length, 2); // two quick edits coalesce into one more save
});

test('(c) offline edit queues, shows Offline, flushes once on reconnect', async () => {
  const s = setup({ online: false });
  s.env.online = false; s.c.setOnline(false);
  s.edit(steps(5)); await s.advance(30000);
  assert.equal(s.saves.length, 0); assert.equal(s.c.getStatus().kind, 'offline');
  s.env.online = true; s.c.setOnline(true); await s.advance(100);
  assert.equal(s.saves.length, 1); assert.equal(s.c.getStatus().kind, 'synced');
  await s.advance(60000); assert.equal(s.saves.length, 1);
});

test('(d) failure shows Failed with the honest error and retries with backoff', async () => {
  let n = 0;
  const s = setup({ save: async () => (++n < 3 ? { success: false, error: 'Permission denied: x' } : { success: true }) });
  s.edit(steps(5)); await s.advance(3100);
  assert.equal(s.saves.length, 1);
  assert.equal(s.c.getStatus().kind, 'failed'); assert.equal(s.c.getStatus().error, 'Permission denied: x');
  await s.advance(1000); assert.equal(s.saves.length, 2);   // 1st retry after cap/2 = 1s
  await s.advance(1700); assert.equal(s.saves.length, 2);   // 2nd backoff is longer (cap 4s => 2s)
  await s.advance(400); assert.equal(s.saves.length, 3);
  assert.equal(s.c.getStatus().kind, 'synced');
});

test('(e) conflict result => Conflict, no retry loop, never reported as Synced', async () => {
  const s = setup({ save: async () => ({ success: true, conflicts: 1, conflictDocs: [{ kind: 'daily', id: 'x', label: 'day 1' }] }) });
  s.edit(steps(5)); await s.advance(3100);
  assert.equal(s.c.getStatus().kind, 'conflict');
  await s.advance(10 * 60000); assert.equal(s.saves.length, 1);
  assert.equal(s.c.getConflicts().length, 1);
  assert.equal(s.kinds.includes('synced'), false);
});

test('(f) unlinked / mismatched / signed-out device => Disabled, zero saves after edits', async () => {
  for (const [settings, uid, reason] of [
    [{ linkedFirebaseUid: undefined }, 'u1', 'unlinked'],
    [{ linkedFirebaseUid: 'other' }, 'u1', 'mismatch'],
    [{}, null, 'signed-out']
  ] as const) {
    const s = setup({ state: mkState({ settings }), uid });
    s.edit(steps(5)); await s.advance(60000);
    assert.equal(s.saves.length, 0, reason);
    assert.equal(s.c.getStatus().kind, 'disabled');
    assert.equal(s.c.getStatus().detail, DISABLED_MESSAGES[reason]);
    assert.equal(s.subs(), 0, 'no realtime listener while not linked');
  }
});

test('(g) viewer mode: zero saves, edit guard blocks, refresh still pulls, never saves', async () => {
  const s = setup({ viewer: true });
  assert.equal(s.c.isEditBlocked(), true);
  s.edit(steps(5)); await s.advance(60000);
  assert.equal(s.saves.length, 0);
  assert.equal(s.c.getStatus().kind, 'viewer');
  const pulledBefore = s.pulls.length;
  s.fire(); await s.advance(6000);
  assert.ok(s.pulls.length > pulledBefore);
  assert.equal(s.saves.length, 0);
});

test('(h) remote change => one coalesced pull; merge uses latest state; applied merge does NOT save', async () => {
  const cloudDay1 = log(1, { steps: 900 });
  let release: (v: PullLike) => void = () => {};
  const s = setup({ pull: () => new Promise<PullLike>(r => { release = r; }) });
  await s.advance(100); // startup read-only pull is in flight
  s.fire(); s.fire(); s.fire(); await s.advance(6000);
  assert.equal(s.pulls.length, 1);
  // user edit of day 2 lands in state in the render gap, before onStateChanged saw it
  s.env.state = { ...s.env.state, dailyLogs: { ...s.env.state.dailyLogs, 2: log(2, { steps: 77 }) } };
  const snapshot = s.pulls[0];
  release({ success: true, userId: 'u1', baseEntries: [{ section: 'daily', id: 'd1', hash: 'h' }], merged: { ...snapshot, dailyLogs: { ...snapshot.dailyLogs, 1: cloudDay1 } } });
  await tick();
  assert.equal(s.env.state.dailyLogs[1].steps, 900); // cloud change adopted
  assert.equal(s.env.state.dailyLogs[2].steps, 77);  // concurrent edit kept
  s.c.onStateChanged(s.env.state); await s.advance(5000);
  assert.equal(s.saves.length, 1, 'the unseen user edit is still saved');
});

test('(h2) a pure remote merge does not trigger any save (no loop) and commits base after persistence', async () => {
  const s = setup({});
  await s.advance(100);
  s.impl.pull = async (st) => ({ success: true, userId: 'u1', baseEntries: [{ section: 'daily', id: 'd1', hash: 'h' }], merged: { ...st, dailyLogs: { ...st.dailyLogs, 1: log(1, { steps: 900 }) } } });
  s.fire(); await s.advance(6000);
  assert.equal(s.env.state.dailyLogs[1].steps, 900);
  assert.equal(s.committed.length, 0, 'base is not committed before the caller persisted the state');
  s.c.onStateChanged(s.env.state);
  assert.equal(s.committed.length, 1);
  await s.advance(60000);
  assert.equal(s.saves.length, 0);
});

test('(i) local pending work defers the pull until saved', async () => {
  const s = setup();
  await s.advance(100);
  const before = s.pulls.length;
  s.edit(steps(5));
  s.fire(); await s.advance(2000);
  assert.equal(s.pulls.length, before);
  await s.advance(10000);
  assert.equal(s.saves.length, 1);
  assert.equal(s.pulls.length, before + 1);
});

test('realtime listener attaches only when linked and detaches on sign-out', async () => {
  const s = setup({ uid: null });
  assert.equal(s.subs(), 0);
  s.env.uid = 'u1'; s.c.refresh(); assert.equal(s.subs(), 1);
  s.env.uid = null; s.c.refresh(); assert.equal(s.unsubs(), 1);
});

test('reload: a pending marker from an earlier edit is restored only once signed in AND linked, then saves; plain open does not', async () => {
  const s = setup({ uid: null, marker: true });
  await s.advance(60000); assert.equal(s.saves.length, 0);
  s.env.uid = 'u1'; s.c.refresh(); assert.equal(s.c.getStatus().kind, 'pending');
  await s.advance(3100); assert.equal(s.saves.length, 1);
  assert.equal(s.mem.has(AUTOSAVE_PENDING_KEY), false);
  const clean = setup({ uid: 'u1' }); await clean.advance(60000); assert.equal(clean.saves.length, 0);
});

test('edit while signed out leaves a marker; it is saved only after sign-in (never falsely Synced)', async () => {
  const s = setup({ uid: null });
  s.edit(steps(5)); await s.advance(10000);
  assert.equal(s.mem.has(AUTOSAVE_PENDING_KEY), true);
  assert.notEqual(s.c.getStatus().kind, 'synced');
  s.env.uid = 'u1'; s.c.refresh(); await s.advance(3100);
  assert.equal(s.saves.length, 1);
});

test('conflict survives reload: the startup pull re-detects it and the badge shows Conflict, no save', async () => {
  const conflict = { kind: 'daily' as const, id: 'x', label: 'day 1' };
  const s = setup({ pull: async st => ({ success: true, userId: 'u1', merged: st, conflictDocs: [conflict], baseEntries: [] }) });
  await s.advance(6000);
  assert.equal(s.c.getStatus().kind, 'conflict'); assert.equal(s.saves.length, 0);
  assert.deepEqual(s.c.getConflicts(), [conflict]);
});

// ---- (j)/(k) stale browsers through the real pure planners ----
const fresh = (): AppState => mkState({ dailyLogs: {}, settings: { linkedFirebaseUid: 'u1' } });
class Cloud {
  profile: Record<string, any> = { userId: 'u1' }; logs = new Map<string, any>(); workouts = new Map<string, any>(); writes = 0;
  snap(): CloudSnapshot {
    return { profile: JSON.parse(JSON.stringify(this.profile)), logDocs: [...this.logs].map(([id, data]) => ({ id, data: JSON.parse(JSON.stringify(data)) })), workoutDocs: [...this.workouts].map(([id, data]) => ({ id, data: JSON.parse(JSON.stringify(data)) })) };
  }
}
function planners(cloud: Cloud, getState: () => AppState) {
  let base: SyncBase = emptyBase();
  return {
    save: async () => {
      const p = planSave(getState(), cloud.snap(), base, 'u1', '2026-01-01T00:00:00Z');
      base = applyBaseEntries(base, p.inSync);
      const entries: any[] = [];
      for (const w of p.daily.writes) { cloud.writes++; cloud.logs.set(w.id, JSON.parse(JSON.stringify(w.payload))); entries.push({ section: 'daily', id: w.id, hash: hashDailyDoc(cloud.logs.get(w.id), w.payload.dayNumber) }); }
      for (const w of p.workouts.writes) { cloud.writes++; cloud.workouts.set(w.id, w.payload); entries.push({ section: 'workouts', id: w.id, hash: hashWorkoutDoc(w.payload, w.payload.dayKey) }); }
      const pf = p.profile;
      if (Object.keys(pf.fields).length) { cloud.writes++; Object.assign(cloud.profile, JSON.parse(JSON.stringify(pf.fields))); for (const f of Object.keys(pf.fields)) entries.push({ section: 'profile', id: f, hash: hashEntry(cloud.profile[f]) }); }
      if (pf.weighIns) { cloud.writes++; cloud.profile.weighIns = pf.weighIns; for (const d of pf.writtenWeighInDates) entries.push({ section: 'weighIns', id: d, hash: hashEntry(pf.weighIns.find(x => x.date === d)) }); }
      for (const d of pf.deletedWeighInDates) entries.push({ section: 'weighIns', id: d, hash: null });
      base = applyBaseEntries(base, entries);
      return { success: true, conflicts: p.conflicts.length, conflictDocs: p.conflicts } as any;
    },
    pull: async (st: AppState): Promise<PullLike> => {
      const p = planPull(st, cloud.snap(), base);
      return { success: true, userId: 'u1', merged: p.merged, baseEntries: p.baseEntries, conflictDocs: p.conflictDocs };
    },
    commit: (_u: string, e: any[]) => { base = applyBaseEntries(base, e); },
    getBase: () => base
  };
}

test('(j) a stale browser with no local edits fast-forwards to newer cloud data and never writes', async () => {
  const cloud = new Cloud();
  let aState = mkState({ dailyLogs: { 1: log(1, { steps: 5 }) } });
  const A = planners(cloud, () => aState); await A.save();
  const holder = { st: mkState({ dailyLogs: { 1: log(1, { steps: 5 }) } }) };
  const B = planners(cloud, () => holder.st);
  const first = await B.pull(holder.st); B.commit('u1', first.baseEntries as any);
  const s = setup({ state: holder.st, pull: B.pull, save: B.save, commit: B.commit });
  await s.advance(6000); // startup read-only pull: nothing new
  aState = mkState({ dailyLogs: { 1: log(1, { steps: 9 }) } }); await A.save();
  const writesBefore = cloud.writes;
  s.fire(); await s.advance(6000);
  assert.equal(s.env.state.dailyLogs[1].steps, 9);
  s.c.onStateChanged(s.env.state); await s.advance(60000);
  assert.equal(cloud.writes, writesBefore, 'B wrote nothing');
  assert.equal(s.saves.length, 0);
});

test('(j2) a stale browser WITH a local edit keeps it as a conflict and does not overwrite newer cloud data', async () => {
  const cloud = new Cloud();
  let aState = mkState({ dailyLogs: { 1: log(1, { steps: 5 }) } });
  const A = planners(cloud, () => aState); await A.save();
  const bState = mkState({ dailyLogs: { 1: log(1, { steps: 5 }) } });
  // B's base: it saw the same version
  const holder = { st: bState };
  const B = planners(cloud, () => holder.st);
  const first = await B.pull(holder.st); B.commit('u1', first.baseEntries as any);
  aState = mkState({ dailyLogs: { 1: log(1, { steps: 9 }) } }); await A.save();
  holder.st = mkState({ dailyLogs: { 1: log(1, { steps: 6 }) } }); // B edited offline, stale
  const writesBefore = cloud.writes;
  const r = await B.save();
  assert.equal(r.conflicts, 1);
  assert.equal(cloud.writes, writesBefore);
  assert.equal([...cloud.logs.values()][0].steps, 9);
});

test('(k) a weigh-in deleted on device A is not restored by a stale pull on B, nor re-uploaded by B', async () => {
  const cloud = new Cloud();
  const w = (d: string, kg: number) => ({ date: d, dayNumber: 1, weight: kg });
  let aState = mkState({ weighIns: [w('2026-01-01', 90), w('2026-01-08', 89)] });
  const A = planners(cloud, () => aState); await A.save();
  const holder = { st: mkState({ weighIns: [w('2026-01-01', 90), w('2026-01-08', 89)] }) };
  const B = planners(cloud, () => holder.st);
  const first = await B.pull(holder.st); B.commit('u1', first.baseEntries as any);
  aState = mkState({ weighIns: [w('2026-01-01', 90)] }); await A.save(); // A deletes Jan 8
  assert.deepEqual(cloud.profile.weighIns.map((x: any) => x.date), ['2026-01-01']);
  // B (stale, unedited) pulls; its Jan 8 copy is untouched by the pull and must not be re-uploaded
  const p = await B.pull(holder.st);
  holder.st = p.merged!;
  assert.deepEqual(holder.st.weighIns.map(x => x.date), ['2026-01-01'], 'the deletion reaches B');
  B.commit('u1', p.baseEntries as any);
  await B.save();
  assert.deepEqual(cloud.profile.weighIns.map((x: any) => x.date), ['2026-01-01'], 'cloud did not regain the deleted entry');
  // a stale B that did NOT pull first must not re-upload it on an unrelated save either
  const stale = { st: mkState({ weighIns: [w('2026-01-01', 90), w('2026-01-08', 89)] }) };
  const C = planners(cloud, () => stale.st);
  C.commit('u1', [{ section: 'weighIns', id: '2026-01-01', hash: hashEntry(w('2026-01-01', 90)) }, { section: 'weighIns', id: '2026-01-08', hash: hashEntry(w('2026-01-08', 89)) }]);
  await C.save();
  assert.deepEqual(cloud.profile.weighIns.map((x: any) => x.date), ['2026-01-01']);
});

test('rebasePulled: concurrent edit kept, untouched item fast-forwarded, contested section reported', () => {
  const snap = mkState(); const merged = { ...snap, dailyLogs: { ...snap.dailyLogs, 1: log(1, { steps: 900 }) } };
  const latest = { ...snap, dailyLogs: { ...snap.dailyLogs, 1: log(1, { steps: 55 }), 2: log(2, { steps: 66 }) } };
  const r = rebasePulled(snap, merged, latest);
  assert.equal(r.state.dailyLogs[1].steps, 55); assert.equal(r.state.dailyLogs[2].steps, 66);
  assert.ok(r.contested.has('daily'));
  const ok = rebasePulled(snap, merged, snap);
  assert.equal(ok.state.dailyLogs[1].steps, 900); assert.equal(ok.contested.size, 0);
  assert.notEqual(syncableHash(snap), syncableHash(merged));
  assert.equal(syncableHash(snap), syncableHash({ ...snap, settings: { ...snap.settings, lastSyncTimestamp: 'x' } }));
});

// ---- applying cloud data is not a user edit (S1) ----
test('S1: noteAppliedFromCloud => applying cloud state causes zero saves, a real edit afterwards exactly one', async () => {
  const s = setup();
  const fromCloud = steps(99)(s.env.state);
  s.c.noteAppliedFromCloud(fromCloud);
  s.env.state = fromCloud; s.c.onStateChanged(fromCloud);
  await s.advance(60000);
  assert.equal(s.saves.length, 0);
  assert.notEqual(s.c.getStatus().kind, 'pending');
  s.edit(steps(100));
  await s.advance(3100);
  assert.equal(s.saves.length, 1);
});

test('S1: an unlinked/blank device that loads cloud data and then links writes nothing', async () => {
  const s = setup({ uid: null, state: mkState({ settings: { linkedFirebaseUid: undefined } }) });
  const loaded = steps(77)(s.env.state);
  s.c.noteAppliedFromCloud(loaded);
  s.env.state = loaded; s.c.onStateChanged(loaded);
  s.env.uid = 'u1'; s.env.state = { ...loaded, settings: { ...loaded.settings, linkedFirebaseUid: 'u1' } };
  s.c.refresh(); s.c.onStateChanged(s.env.state);
  await s.advance(60000);
  assert.equal(s.saves.length, 0);
});

test('S1: a real edit before the cloud state was noted still saves (applied hash is single-use)', async () => {
  const s = setup();
  s.edit(steps(5));
  await s.advance(3100);
  assert.equal(s.saves.length, 1);
  const applied = steps(6)(s.env.state);
  s.c.noteAppliedFromCloud(applied);
  s.env.state = applied; s.c.onStateChanged(applied);
  s.edit(steps(5)); // user edits back to an earlier value: a genuine edit
  await s.advance(3100);
  assert.equal(s.saves.length, 2);
});

test('S1: conflictsResolved({save:false}) (use cloud values) does not save; default (use this device) does one verifying save', async () => {
  const conflictDocs = [{ kind: 'daily' as const, id: '1', label: 'day 1 (steps)' }];
  const mk = () => setup({ save: async () => ({ success: true, conflicts: ['day 1'], conflictDocs }) });
  const a = mk();
  a.edit(steps(5)); await a.advance(3100);
  assert.equal(a.saves.length, 1);
  assert.equal(a.c.getConflicts().length, 1);
  a.c.conflictsResolved({ save: false });
  await a.advance(60000);
  assert.equal(a.saves.length, 1, 'no extra save');
  assert.equal(a.c.getConflicts().length, 0);
  assert.notEqual(a.c.getStatus().kind, 'conflict');

  const b = setup({ save: async () => ({ success: true }) });
  b.c.conflictsResolved();
  await b.advance(3100);
  assert.equal(b.saves.length, 1, 'resolve-use-local keeps its one verifying save');
});

// ---- S2: a conflict is listed once ----
test('S2: the same conflict reported by a save and a pull is listed and counted once', async () => {
  const doc = { kind: 'daily' as const, id: '1', label: 'day 1 (waterMl)' };
  const s = setup({
    save: async () => ({ success: true, conflicts: ['day 1 (waterMl)'], conflictDocs: [doc, { ...doc }] }),
    pull: async () => ({ success: true, merged: s.env.state, userId: 'u1', baseEntries: [], conflictDocs: [doc, { ...doc }] })
  });
  s.edit(steps(5)); await s.advance(3100);
  s.fire(); await s.advance(60000);
  assert.equal(s.c.getConflicts().length, 1);
  assert.equal(s.c.getStatus().conflicts, 1);
});
