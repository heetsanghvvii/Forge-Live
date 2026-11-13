import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLiveRefresher } from './liveRefresh';

const tick = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function setup(over: any = {}) {
  let t = 100000; let id = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let remote: () => void = () => {};
  let unsubbed = 0;
  let busy = false;
  const pulls: number[] = []; const applied: any[] = [];
  const r = createLiveRefresher<{ n: number }>({
    pull: over.pull ?? (async () => { pulls.push(t); return { n: pulls.length }; }),
    apply: x => { applied.push(x); },
    subscribe: cb => { remote = cb; return () => { unsubbed++; }; },
    isBusy: () => busy,
    now: () => t,
    setTimer: (fn, ms) => { id++; timers.set(id, { at: t + ms, fn }); return id; },
    clearTimer: h => { timers.delete(h as number); }
  });
  return {
    r, pulls, applied, fire: () => remote(), setBusy: (b: boolean) => { busy = b; }, unsubbed: () => unsubbed,
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

test('creation alone does not pull', async () => {
  const s = setup(); await s.advance(60000);
  assert.equal(s.pulls.length, 0);
});

test('remote change pulls once and applies result', async () => {
  const s = setup();
  s.fire(); await tick();
  assert.equal(s.pulls.length, 1);
  assert.deepEqual(s.applied, [{ n: 1 }]);
  assert.ok(s.r.getStatus().lastCheckedAt);
  assert.equal(s.r.getStatus().lastError, undefined);
});

test('bursts within min interval coalesce into one later pull', async () => {
  const s = setup();
  s.fire(); await tick();
  s.fire(); s.r.notifyFocus(); s.r.notifyOnline(); await tick();
  assert.equal(s.pulls.length, 1);
  await s.advance(4999); assert.equal(s.pulls.length, 1);
  await s.advance(1); assert.equal(s.pulls.length, 2);
  await s.advance(60000); assert.equal(s.pulls.length, 2);
});

test('skips while busy and re-checks afterwards', async () => {
  const s = setup();
  s.setBusy(true);
  s.fire(); await s.advance(30000);
  assert.equal(s.pulls.length, 0);
  s.setBusy(false); await s.advance(1000);
  assert.equal(s.pulls.length, 1);
});

test('busy starting during pull discards the result and retries', async () => {
  let release!: () => void; let calls = 0;
  const s = setup({ pull: () => new Promise(res => { calls++; release = () => res({ n: calls }); }) });
  s.fire(); await tick();
  s.setBusy(true); release(); await tick();
  assert.equal(s.applied.length, 0);
  s.setBusy(false); await s.advance(5000);
  assert.equal(calls, 2);
  release(); await tick();
  assert.equal(s.applied.length, 1);
});

test('pull failure is reported and a later success clears it', async () => {
  let fail = true;
  const s = setup({ pull: async () => { if (fail) throw new Error('offline'); return { n: 1 }; } });
  s.fire(); await tick();
  assert.equal(s.r.getStatus().lastError, 'offline');
  assert.equal(s.applied.length, 0);
  fail = false; s.fire(); await s.advance(5000);
  assert.equal(s.r.getStatus().lastError, undefined);
  assert.equal(s.applied.length, 1);
});

test('only one pull in flight', async () => {
  let release!: () => void; let calls = 0;
  const s = setup({ pull: () => new Promise(res => { calls++; release = () => res({ n: 1 }); }) });
  s.fire(); s.fire(); s.r.notifyFocus(); await tick();
  assert.equal(calls, 1);
  release(); await tick();
  await s.advance(60000);
  assert.equal(calls, 2); // the requests made during the pull are served by one more pull
  release(); await tick();
});

test('dispose unsubscribes and stops pulling', async () => {
  const s = setup();
  s.setBusy(true); s.fire(); s.r.dispose();
  s.setBusy(false); await s.advance(60000);
  assert.equal(s.unsubbed(), 1);
  assert.equal(s.pulls.length, 0);
});
