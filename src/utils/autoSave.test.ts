import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAutoSaver, backoffCap, AUTOSAVE_PENDING_KEY, AutoSaveResult } from './autoSave';

function fakeClock() {
  let t = 1000;
  let id = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => t,
    setTimer: (fn: () => void, ms: number) => { id += 1; timers.set(id, { at: t + ms, fn }); return id; },
    clearTimer: (h: unknown) => { timers.delete(h as number); },
    count: () => timers.size,
    async advance(ms: number) {
      const end = t + ms;
      for (;;) {
        const next = [...timers.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]);
        t = Math.max(t, next[1].at);
        next[1].fn();
        await tick();
      }
      t = end;
      await tick();
    }
  };
}
const tick = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function memStore() {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
}
function setup(over: any = {}) {
  const clock = fakeClock();
  const storage = memStore();
  const calls: number[] = [];
  let results: Array<AutoSaveResult | (() => Promise<AutoSaveResult>)> = over.results || [];
  let online = over.online ?? true;
  const saver = createAutoSaver({
    save: async () => {
      calls.push(clock.now());
      const r = results.length > 1 ? results.shift()! : results[0] ?? { success: true };
      return typeof r === 'function' ? r() : r;
    },
    isOnline: () => online,
    storage, now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    random: over.random ?? (() => 1),
    canSave: over.canSave,
    maxBackoffMs: over.maxBackoffMs
  });
  return { clock, storage, calls, saver, setResults: (r: any) => { results = r; }, setOnline: (v: boolean) => { online = v; saver.setOnline(v); } };
}

test('creation, subscribe and getStatus alone never call save', async () => {
  const s = setup();
  s.saver.subscribe(() => {});
  s.saver.getStatus();
  await s.clock.advance(600000);
  assert.equal(s.calls.length, 0);
  assert.equal(s.saver.getStatus().state, 'idle');
  assert.equal(s.storage.m.size, 0);
});

test('debounce coalesces many changes into one save', async () => {
  const s = setup();
  s.saver.notifyChange(); await s.clock.advance(2000);
  s.saver.notifyChange(); await s.clock.advance(2000);
  s.saver.notifyChange(); await s.clock.advance(2999);
  assert.equal(s.calls.length, 0);
  assert.equal(s.saver.getStatus().state, 'pending');
  await s.clock.advance(1);
  assert.equal(s.calls.length, 1);
  assert.equal(s.saver.getStatus().state, 'synced');
  assert.ok(s.saver.getStatus().lastSyncedAt);
  assert.equal(s.storage.m.has(AUTOSAVE_PENDING_KEY), false);
});

test('only one save in flight; change during save triggers one follow-up', async () => {
  let release!: (r: AutoSaveResult) => void;
  const s = setup({ results: [() => new Promise<AutoSaveResult>(r => { release = r; }), { success: true }] });
  s.saver.notifyChange(); await s.clock.advance(3000);
  assert.equal(s.calls.length, 1);
  assert.equal(s.saver.getStatus().state, 'syncing');
  s.saver.notifyChange(); s.saver.notifyChange();
  await s.clock.advance(10000);
  assert.equal(s.calls.length, 1);
  release({ success: true }); await tick();
  await s.clock.advance(3000);
  assert.equal(s.calls.length, 2);
  await s.clock.advance(600000);
  assert.equal(s.calls.length, 2);
});

test('backoff sequence, jitter bounds and cap', async () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map(a => backoffCap(a, 300000)), [2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000, 300000]);
  const s = setup({ results: [{ success: false, error: 'boom' }], random: () => 0, maxBackoffMs: 10000 });
  s.saver.notifyChange(); await s.clock.advance(3000);
  assert.equal(s.calls.length, 1);
  let st = s.saver.getStatus();
  assert.equal(st.state, 'failed'); assert.equal(st.lastError, 'boom');
  assert.equal(st.retryInMs, 1000); // random 0 => cap/2 of 2000
  await s.clock.advance(1000);
  assert.equal(s.calls.length, 2);
  st = s.saver.getStatus();
  assert.equal(st.retryInMs, 2000); // cap 4000 -> half
  await s.clock.advance(2000); // attempt 3 -> cap 8000 -> 4000
  await s.clock.advance(4000); // attempt 4 -> cap 10000 (capped) -> 5000
  assert.equal(s.calls.length, 4);
  assert.equal(s.saver.getStatus().retryInMs, 5000);
});

test('jitter with random=1 hits the cap exactly and never exceeds it', async () => {
  const s = setup({ results: [{ success: false, error: 'x' }], random: () => 0.999999, maxBackoffMs: 3000 });
  s.saver.notifyChange(); await s.clock.advance(3000);
  assert.ok(s.saver.getStatus().retryInMs! <= 2000);
  await s.clock.advance(2000);
  assert.ok(s.saver.getStatus().retryInMs! <= 3000);
});

test('failure then success clears the error', async () => {
  const s = setup({ results: [{ success: false, error: 'net' }, { success: true }], random: () => 0 });
  s.saver.notifyChange(); await s.clock.advance(3000);
  assert.equal(s.saver.getStatus().state, 'failed');
  await s.clock.advance(1000);
  const st = s.saver.getStatus();
  assert.equal(st.state, 'synced'); assert.equal(st.lastError, undefined);
  assert.equal(s.storage.m.has(AUTOSAVE_PENDING_KEY), false);
});

test('thrown save error is reported as failed', async () => {
  const s = setup({ results: [() => Promise.reject(new Error('kaboom'))] });
  s.saver.notifyChange(); await s.clock.advance(3000);
  assert.equal(s.saver.getStatus().state, 'failed');
  assert.equal(s.saver.getStatus().lastError, 'kaboom');
});

test('offline queues, then flushes immediately on reconnect', async () => {
  const s = setup({ online: false });
  s.saver.notifyChange(); await s.clock.advance(600000);
  assert.equal(s.calls.length, 0);
  assert.equal(s.saver.getStatus().state, 'offline');
  assert.ok(s.saver.getStatus().pendingSince);
  s.setOnline(true); await tick();
  assert.equal(s.calls.length, 1);
  assert.equal(s.saver.getStatus().state, 'synced');
});

test('going offline mid-retry pauses retries until reconnect', async () => {
  const s = setup({ results: [{ success: false, error: 'x' }, { success: true }], random: () => 0 });
  s.saver.notifyChange(); await s.clock.advance(3000);
  s.setOnline(false);
  await s.clock.advance(600000);
  assert.equal(s.calls.length, 1);
  assert.equal(s.saver.getStatus().state, 'offline');
  s.setOnline(true); await tick();
  assert.equal(s.calls.length, 2);
  assert.equal(s.saver.getStatus().state, 'synced');
});

test('conflict stops retries until a new change or resolved()', async () => {
  const s = setup({ results: [{ success: true, conflicts: ['Day 3'] }, { success: true }] });
  s.saver.notifyChange(); await s.clock.advance(3000);
  assert.equal(s.saver.getStatus().state, 'conflict');
  assert.equal(s.saver.getStatus().conflicts, 1);
  await s.clock.advance(900000);
  assert.equal(s.calls.length, 1);
  s.saver.resolved();
  await s.clock.advance(3000);
  assert.equal(s.calls.length, 2);
  assert.equal(s.saver.getStatus().state, 'synced');
  assert.equal(s.saver.getStatus().conflicts, 0);
});

test('new change after a conflict resumes saving', async () => {
  const s = setup({ results: [{ success: true, conflicts: 2 }, { success: true }] });
  s.saver.notifyChange(); await s.clock.advance(3000);
  s.saver.notifyChange(); await s.clock.advance(3000);
  assert.equal(s.calls.length, 2);
});

test('canSave false => disabled and zero save calls', async () => {
  let allowed = false;
  const s = setup({ canSave: () => allowed });
  s.saver.notifyChange(); s.saver.notifyChange();
  await s.saver.flush();
  await s.clock.advance(600000);
  assert.equal(s.calls.length, 0);
  assert.equal(s.saver.getStatus().state, 'disabled');
  assert.equal(s.storage.m.size, 0);
  allowed = true;
  s.saver.notifyChange(); await s.clock.advance(3000);
  assert.equal(s.calls.length, 1);
});

test('canSave turning false while pending stops the save', async () => {
  let allowed = true;
  const s = setup({ canSave: () => allowed });
  s.saver.notifyChange();
  allowed = false;
  await s.clock.advance(3000);
  assert.equal(s.calls.length, 0);
  assert.equal(s.saver.getStatus().state, 'disabled');
});

test('pending marker persisted on change and restored once after reload', async () => {
  const s = setup();
  s.saver.notifyChange();
  assert.ok(s.storage.m.has(AUTOSAVE_PENDING_KEY));
  // "reload": new saver, same storage, no timers carried over
  const s2 = setup();
  s2.storage.m.set(AUTOSAVE_PENDING_KEY, '{}');
  assert.equal(s2.calls.length, 0);
  assert.equal(s2.saver.restorePending(), true);
  assert.equal(s2.saver.restorePending(), false);
  await s2.clock.advance(3000);
  assert.equal(s2.calls.length, 1);
  assert.equal(s2.storage.m.has(AUTOSAVE_PENDING_KEY), false);
});

test('restorePending with no marker does nothing; with canSave false keeps marker', async () => {
  const a = setup();
  assert.equal(a.saver.restorePending(), false);
  await a.clock.advance(600000);
  assert.equal(a.calls.length, 0);
  const b = setup({ canSave: () => false });
  b.storage.m.set(AUTOSAVE_PENDING_KEY, '{}');
  assert.equal(b.saver.restorePending(), false);
  assert.ok(b.storage.m.has(AUTOSAVE_PENDING_KEY));
  assert.equal(b.calls.length, 0);
});

test('flush saves immediately and storage failures do not break saving', async () => {
  const clock = fakeClock(); let n = 0;
  const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
  const saver = createAutoSaver({ save: async () => { n++; return { success: true }; }, isOnline: () => true, storage: bad, now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  saver.notifyChange();
  await saver.flush();
  assert.equal(n, 1);
  assert.equal(saver.getStatus().state, 'synced');
});

test('dispose cancels timers and ignores later changes', async () => {
  const s = setup();
  s.saver.notifyChange(); s.saver.dispose();
  await s.clock.advance(600000);
  s.saver.notifyChange();
  await s.clock.advance(600000);
  assert.equal(s.calls.length, 0);
});

test('S4: a save that never answers is reported failed with an honest message, then retried', async () => {
  const never = () => new Promise<AutoSaveResult>(() => {});
  const s = setup({ results: [never, { success: true }] });
  s.saver.notifyChange();
  await s.clock.advance(3000);
  assert.equal(s.saver.getStatus().state, 'syncing');
  await s.clock.advance(19000);
  assert.equal(s.saver.getStatus().state, 'syncing');
  await s.clock.advance(2000);
  const st = s.saver.getStatus();
  assert.equal(st.state, 'failed');
  assert.equal(st.lastError, 'The cloud did not answer. Your changes are kept on this device. Retrying.');
  await s.clock.advance(5000);
  assert.equal(s.calls.length, 2, 'backoff retry ran');
  assert.equal(s.saver.getStatus().state, 'synced');
});

test('S4: a stalled save that finally completes clears the failure', async () => {
  let release: (r: AutoSaveResult) => void = () => {};
  const slow = () => new Promise<AutoSaveResult>((r) => { release = r; });
  const s = setup({ results: [slow] });
  s.saver.notifyChange();
  await s.clock.advance(3000 + 21000);
  assert.equal(s.saver.getStatus().state, 'failed');
  release({ success: true });
  await s.clock.advance(0);
  assert.equal(s.saver.getStatus().state, 'synced');
  assert.equal(s.saver.getStatus().lastError, undefined);
});
