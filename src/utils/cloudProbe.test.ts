import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCloudProbe, readFailureMessage } from './cloudRead';
import { createAutoSyncController, CLOUD_FOUND_DETAIL, CLOUD_EMPTY_DETAIL, DISABLED_MESSAGES } from './autoSyncController';
import type { SyncBadgeStatus } from './autoSyncController';
import { evaluateLink } from './accountLink';
import { getInitialState } from './storage';
import type { AppState } from '../types';

const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const snap = (logs = 0) => ({ profile: {}, logDocs: Array.from({ length: logs }, (_, i) => ({ id: `d${i}`, data: {} })), workoutDocs: [] });

test('probe: profile exists -> has-data; logs only -> has-data; nothing -> empty', async () => {
  assert.equal((await runCloudProbe(async () => ({ profileExists: true, snap: snap() }))).status, 'has-data');
  assert.equal((await runCloudProbe(async () => ({ profileExists: false, snap: snap(2) }))).status, 'has-data');
  assert.equal((await runCloudProbe(async () => ({ profileExists: false, snap: snap() }))).status, 'empty');
});
test('probe: permission-denied and network failures are error, never empty', async () => {
  const denied = await runCloudProbe(async () => { throw { code: 'permission-denied' }; });
  assert.equal(denied.status, 'error');
  assert.match(denied.reason || '', /Permission denied/);
  const off = await runCloudProbe(async () => { throw { code: 'unavailable' }; });
  assert.equal(off.status, 'error');
  assert.equal((await runCloudProbe(async () => { throw new Error('boom'); })).status, 'error');
});

// ---- controller badge states ----
function setupOnly(linked?: string): AppState {
  const s = getInitialState();
  s.settings = { ...s.settings, startDate: '2026-10-25', confirmedProgrammeStart: true, onboardingCompleted: true, ...(linked ? { linkedFirebaseUid: linked } : {}) };
  return s;
}
function mk(opts: { state?: AppState; uid?: string | null; viewer?: boolean; probe: () => Promise<any> }) {
  const env = { state: opts.state ?? setupOnly(), uid: opts.uid === undefined ? 'u1' : opts.uid };
  let probes = 0; const saves: any[] = []; const pulls: any[] = []; const applied: any[] = [];
  const c = createAutoSyncController({
    getState: () => env.state, getUid: () => env.uid, evaluateLink,
    save: async s => { saves.push(s); return { success: true }; },
    pull: async s => { pulls.push(s); return { success: true }; },
    applyState: u => { applied.push(u); },
    commitBase: () => {}, subscribeRemote: () => () => {},
    isOnline: () => true, isViewer: () => opts.viewer ?? false,
    probe: async () => { probes++; return opts.probe(); },
    storage: null, now: () => 1_000_000, setTimer: () => 1, clearTimer: () => {}, random: () => 0
  });
  return { c, env, probes: () => probes, saves, pulls, applied };
}
const noWritesOrLoads = (h: ReturnType<typeof mk>) => { assert.equal(h.saves.length, 0); assert.equal(h.pulls.length, 0); assert.equal(h.applied.length, 0); };

test('empty-device: checking, then has-data -> Cloud data found; no save, no pull, no apply', async () => {
  const h = mk({ probe: async () => ({ status: 'has-data' }) });
  assert.equal(h.c.getStatus().kind, 'checking');
  assert.equal(h.c.getStatus().label, 'Checking cloud…');
  await tick();
  const s = h.c.getStatus();
  assert.equal(s.kind, 'cloud-found'); assert.equal(s.label, 'Cloud data found'); assert.equal(s.detail, CLOUD_FOUND_DETAIL);
  h.c.refresh(); h.c.notifyFocus(); await tick();
  assert.equal(h.probes(), 1); // once per uid
  noWritesOrLoads(h);
});
test('empty-device: empty -> No cloud data yet', async () => {
  const h = mk({ probe: async () => ({ status: 'empty' }) });
  await tick();
  const s = h.c.getStatus();
  assert.equal(s.kind, 'cloud-empty'); assert.equal(s.label, 'No cloud data yet'); assert.equal(s.detail, CLOUD_EMPTY_DETAIL);
  noWritesOrLoads(h);
});
test('empty-device: error -> Could not check the cloud, Nothing was changed, Retry re-probes', async () => {
  let n = 0;
  const h = mk({ probe: async () => (++n === 1 ? { status: 'error', reason: 'Permission denied: sign in with the account that owns these records.' } : { status: 'has-data' }) });
  await tick();
  let s = h.c.getStatus();
  assert.equal(s.kind, 'check-failed'); assert.equal(s.label, 'Could not check the cloud');
  assert.equal(s.detail, readFailureMessage('Permission denied: sign in with the account that owns these records.'));
  assert.match(s.detail || '', /Nothing was changed/);
  await h.c.retryNow(); await tick();
  s = h.c.getStatus();
  assert.equal(s.kind, 'cloud-found'); assert.equal(h.probes(), 2);
  noWritesOrLoads(h);
});
test('a probe that throws is an error, not empty', async () => {
  const h = mk({ probe: async () => { throw new Error('x'); } });
  await tick();
  assert.equal(h.c.getStatus().kind, 'check-failed');
});
test('real local entries (first-link) keep the unlinked message and never probe', async () => {
  const st = setupOnly(); st.dailyLogs = { ...st.dailyLogs, 1: { ...st.dailyLogs[1], waterMl: 500 } };
  const h = mk({ state: st, probe: async () => ({ status: 'has-data' }) });
  await tick();
  const s = h.c.getStatus();
  assert.equal(s.kind, 'disabled'); assert.equal(s.detail, DISABLED_MESSAGES.unlinked);
  assert.equal(h.probes(), 0);
});
test('signed out and viewer never probe', async () => {
  const a = mk({ uid: null, probe: async () => ({ status: 'has-data' }) });
  const b = mk({ viewer: true, probe: async () => ({ status: 'has-data' }) });
  await tick();
  assert.equal(a.probes(), 0); assert.equal(b.probes(), 0);
  assert.equal(a.c.getStatus().kind, 'disabled'); assert.equal(b.c.getStatus().kind, 'viewer');
});
