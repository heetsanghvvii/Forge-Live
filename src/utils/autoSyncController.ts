/**
 * Orchestrates automatic cloud saving, live refresh, link checks and Viewer mode.
 * Pure and dependency-injected (no window / firebase). Rules it enforces:
 *  - NEVER auto-links: saving is only enabled when the device is already linked to the signed-in account.
 *  - Opening the app / signing in writes nothing. Only a real user edit (or a pending marker left by an earlier
 *    real edit that was never saved) can trigger a save.
 *  - Live refresh only reads the cloud and merges into local state; it never calls save().
 *  - A merge applied by live refresh is recognised and does not retrigger a save.
 *  - 'Synced' is only reported after a save that the injected save() reports as successful (the real one verifies by read-back).
 */
import type { AppState } from '../types';
import { createAutoSaver, AUTOSAVE_PENDING_KEY } from './autoSave';
import type { AutoSaveResult, AutoSaveStorage, AutoSaver } from './autoSave';
import { createLiveRefresher } from './liveRefresh';
import type { LiveRefresher } from './liveRefresh';
import type { LinkState } from './accountLink';
import type { ConflictDoc } from './cloudMerge';
import type { BaseEntry } from './syncBase';
import { syncableHash, rebasePulled, safeBaseEntries } from './syncState';
import { dedupeConflicts } from './cloudMerge';
import { readFailureMessage } from './cloudRead';
import type { CloudProbeResult } from './cloudRead';

export type SyncBadgeKind = 'idle' | 'pending' | 'saving' | 'synced' | 'offline' | 'failed' | 'conflict' | 'disabled' | 'viewer' | 'checking' | 'cloud-found' | 'cloud-empty' | 'check-failed';
export type DisabledReason = 'signed-out' | 'unlinked' | 'mismatch';

export const DISABLED_MESSAGES: Record<DisabledReason, string> = {
  'signed-out': 'Sign in to back up',
  unlinked: 'Tap Save to cloud once to link this device',
  mismatch: 'Signed in as a different account'
};
export const CLOUD_FOUND_DETAIL = 'Your account already has data. Tap Load from cloud to bring it here.';
export const CLOUD_EMPTY_DETAIL = 'Tap Save to cloud to create it.';
export const VIEWER_BLOCKED_MESSAGE = 'Viewer mode is on: editing is off in this browser';
export const VIEWER_BANNER_TEXT = 'Viewer mode (this browser only)';

export interface PullLike {
  success: boolean;
  error?: string;
  merged?: AppState;
  baseEntries?: BaseEntry[];
  userId?: string;
  conflictDocs?: ConflictDoc[];
  added?: number;
}

export interface SyncBadgeStatus {
  kind: SyncBadgeKind;
  label: string;
  /** Extra line for the details popover. */
  detail?: string;
  /** "hh:mm" of the last verified save in this session. */
  lastSyncedLabel?: string;
  error?: string;
  retryInMs?: number;
  disabledReason?: DisabledReason;
  conflicts: number;
  refreshing: boolean;
  lastCheckedAt?: number;
  refreshError?: string;
}

export interface AutoSyncOptions {
  getState: () => AppState;
  getUid: () => string | null;
  evaluateLink: (state: Partial<AppState>, uid: string | null | undefined) => LinkState;
  /** Guarded save. Must NEVER prompt or link (first-link is excluded by the controller). */
  save: (state: AppState) => Promise<AutoSaveResult>;
  /** Guarded pull (read only). */
  pull: (state: AppState) => Promise<PullLike>;
  /** React-style state setter: setAppState. */
  applyState: (updater: (prev: AppState) => AppState) => void;
  commitBase: (uid: string, entries: BaseEntry[]) => void;
  /** Attaches the realtime listener. Returns detach. */
  subscribeRemote: (onChange: () => void) => () => void;
  isOnline: () => boolean;
  isViewer: () => boolean;
  /**
   * READ-ONLY check of whether the account already has cloud data, used only on a setup-only signed-in device.
   * Never writes and never loads. When omitted, that device keeps the generic "unlinked" message.
   */
  probe?: (uid: string) => Promise<CloudProbeResult>;
  storage?: AutoSaveStorage | null;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  debounceMs?: number;
  maxBackoffMs?: number;
  /** Save answer time limit (default 20 s). */
  saveTimeoutMs?: number;
  minRefreshIntervalMs?: number;
  random?: () => number;
}

export interface AutoSyncController {
  /** Call after every committed render of app state, AFTER it was persisted locally. */
  onStateChanged(state: AppState): void;
  /** Re-evaluate sign-in / link / viewer (call on auth change or viewer toggle). */
  refresh(): void;
  setOnline(online: boolean): void;
  notifyFocus(): void;
  retryNow(): Promise<void>;
  /** Call after the user resolved conflicts in Settings. */
  conflictsResolved(opts?: { save?: boolean }): void;
  /**
   * Tell the controller that `state` was just built from cloud data (Load from cloud, "Use cloud values"). Call it
   * BEFORE applying the state. That state is then already in sync: it is the new baseline, not a user edit, so no save.
   */
  noteAppliedFromCloud(state: AppState): void;
  isEditBlocked(): boolean;
  getConflicts(): ConflictDoc[];
  getStatus(): SyncBadgeStatus;
  subscribe(fn: (s: SyncBadgeStatus) => void): () => void;
  dispose(): void;
}

export function formatClock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface PullPayload { skipped: boolean; snapshot: AppState; res?: PullLike }

export function createAutoSyncController(o: AutoSyncOptions): AutoSyncController {
  const store = (fn: (s: AutoSaveStorage) => void) => { try { if (o.storage) fn(o.storage); } catch { /* best effort */ } };
  let lastHash = syncableHash(o.getState());
  const appliedHashes = new Set<string>();
  let pendingBase: { uid: string; entries: BaseEntry[] } | null = null;
  let pullConflicts: ConflictDoc[] = [];
  let saveConflicts: ConflictDoc[] = [];
  let online = o.isOnline();
  let disposed = false;
  let detachRemote: (() => void) | null = null;
  let firstPullRequested = false;
  let lastVerifiedAt: number | undefined;
  const listeners = new Set<(s: SyncBadgeStatus) => void>();
  // An earlier real edit that was never saved (marker from a previous page load) waits for permission to save.
  let unsavedWhileDisabled = false;
  store(s => { if (s.getItem(AUTOSAVE_PENDING_KEY) !== null) unsavedWhileDisabled = true; });

  let probeState: { uid: string; status: 'checking' | CloudProbeResult['status']; reason?: string } | null = null;
  let probeSeq = 0;

  const link = (): LinkState => o.evaluateLink(o.getState(), o.getUid());
  const disabledReason = (): DisabledReason | null => {
    if (o.isViewer()) return null; // viewer has its own kind
    const l = link();
    if (l.kind === 'linked') return null;
    if (l.kind === 'signed-out') return 'signed-out';
    if (l.kind === 'mismatch') return 'mismatch';
    return 'unlinked';
  };
  const canSave = () => !o.isViewer() && link().kind === 'linked';
  const canPull = () => link().kind === 'linked';

  /** Runs the read-only probe once per uid (again only on retry). Never writes, never loads. */
  const runProbe = (uid: string) => {
    if (!o.probe || disposed) return;
    const seq = ++probeSeq;
    probeState = { uid, status: 'checking' };
    let p: Promise<CloudProbeResult>;
    try { p = o.probe(uid); } catch (e: any) { p = Promise.resolve({ status: 'error', reason: e?.message }); }
    p.then(r => r, (e: any): CloudProbeResult => ({ status: 'error', reason: e?.message })).then(r => {
      if (disposed || seq !== probeSeq) return;
      probeState = { uid, status: r.status, reason: r.reason };
      emit();
    });
  };
  const probeEligible = (): string | null => {
    if (!o.probe || o.isViewer()) return null;
    const l = link();
    return l.kind === 'empty-device' ? l.uid : null;
  };

  const saver: AutoSaver = createAutoSaver({
    save: async () => {
      if (!canSave()) return { success: false, error: 'Auto-save is not allowed right now.' };
      const res = await o.save(o.getState());
      if (res.success && !(Array.isArray(res.conflicts) ? res.conflicts.length : res.conflicts)) lastVerifiedAt = o.now();
      if (res.success) {
        // conflictDocs may ride along on the result
        const docs = (res as any).conflictDocs as ConflictDoc[] | undefined;
        saveConflicts = dedupeConflicts(docs ?? []);
      }
      return res;
    },
    isOnline: () => online,
    storage: o.storage ?? null,
    now: o.now,
    setTimer: o.setTimer,
    clearTimer: o.clearTimer,
    debounceMs: o.debounceMs,
    maxBackoffMs: o.maxBackoffMs,
    saveTimeoutMs: o.saveTimeoutMs,
    canSave,
    random: o.random
  });

  const refresher: LiveRefresher = createLiveRefresher<PullPayload>({
    pull: async () => {
      const snapshot = o.getState();
      if (!canPull() || !online) return { skipped: true, snapshot };
      return { skipped: false, snapshot, res: await o.pull(snapshot) };
    },
    apply: (p) => {
      if (p.skipped || !p.res) return;
      const res = p.res;
      if (!res.success) throw new Error(res.error || 'Could not check the cloud');
      pullConflicts = dedupeConflicts(res.conflictDocs ?? []);
      if (!res.merged) return;
      const l = link();
      if (l.kind !== 'linked' || (res.userId && res.userId !== l.uid)) return; // account changed meanwhile
      const merged = res.merged;
      o.applyState((prev) => {
        const r = rebasePulled(p.snapshot, merged, prev);
        // If the state we are rebasing onto has an edit that onStateChanged has not seen yet, the result carries that edit:
        // do not mark it as remote-only, so the edit still gets saved.
        if (syncableHash(prev) === lastHash) appliedHashes.add(syncableHash(r.state));
        if (res.userId) pendingBase = { uid: res.userId, entries: safeBaseEntries(res.baseEntries, r.contested) };
        return r.state;
      });
    },
    // Listener is attached/detached by syncEnvironment(); the refresher just needs a hook for notifications.
    subscribe: () => () => {},
    isBusy: () => {
      const st = saver.getStatus().state;
      return st === 'pending' || st === 'syncing' || st === 'offline' || st === 'failed';
    },
    now: o.now,
    setTimer: o.setTimer,
    clearTimer: o.clearTimer,
    minIntervalMs: o.minRefreshIntervalMs
  });

  const compute = (): SyncBadgeStatus => {
    const a = saver.getStatus();
    const r = refresher.getStatus();
    const base: Pick<SyncBadgeStatus, 'refreshing' | 'lastCheckedAt' | 'refreshError'> = {
      refreshing: r.checking, lastCheckedAt: r.lastCheckedAt, refreshError: r.lastError
    };
    const lastSyncedLabel = a.lastSyncedAt !== undefined ? formatClock(a.lastSyncedAt) : undefined;
    const conflicts = dedupeConflicts([...saveConflicts, ...pullConflicts]).length || a.conflicts;
    if (o.isViewer()) return { ...base, kind: 'viewer', label: 'Viewer', detail: VIEWER_BANNER_TEXT + '. Auto-save is off; this screen still refreshes from the cloud.', conflicts, lastSyncedLabel };
    const reason = disabledReason();
    const pu = probeEligible();
    if (pu && probeState && probeState.uid === pu) {
      switch (probeState.status) {
        case 'checking': return { ...base, kind: 'checking', label: 'Checking cloud…', conflicts };
        case 'has-data': return { ...base, kind: 'cloud-found', label: 'Cloud data found', detail: CLOUD_FOUND_DETAIL, disabledReason: 'unlinked', conflicts };
        case 'empty': return { ...base, kind: 'cloud-empty', label: 'No cloud data yet', detail: CLOUD_EMPTY_DETAIL, disabledReason: 'unlinked', conflicts };
        default: return { ...base, kind: 'check-failed', label: 'Could not check the cloud', detail: readFailureMessage(probeState.reason), error: probeState.reason, disabledReason: 'unlinked', conflicts };
      }
    }
    if (pu) return { ...base, kind: 'checking', label: 'Checking cloud…', conflicts };
    if (reason) return { ...base, kind: 'disabled', label: 'Auto-save off', detail: DISABLED_MESSAGES[reason], disabledReason: reason, conflicts };
    switch (a.state) {
      case 'syncing': return { ...base, kind: 'saving', label: 'Saving', conflicts };
      case 'pending': return { ...base, kind: 'pending', label: 'Pending', detail: 'Will save in a few seconds.', conflicts };
      case 'offline': return { ...base, kind: 'offline', label: 'Offline', detail: 'Offline (will retry). Your changes are kept on this device.', conflicts };
      case 'failed': return { ...base, kind: 'failed', label: 'Failed', error: a.lastError, retryInMs: a.retryInMs, detail: a.lastError, conflicts };
      case 'conflict': return { ...base, kind: 'conflict', label: 'Conflict', error: a.lastError, detail: a.lastError, conflicts };
      case 'synced':
        if (pullConflicts.length) return { ...base, kind: 'conflict', label: 'Conflict', detail: 'Some items changed both here and in the cloud. Nothing was overwritten.', conflicts };
        return { ...base, kind: 'synced', label: 'Synced', lastSyncedLabel, detail: lastSyncedLabel ? `Last synced ${lastSyncedLabel}` : undefined, conflicts };
      default:
        if (pullConflicts.length) return { ...base, kind: 'conflict', label: 'Conflict', detail: 'Some items changed both here and in the cloud. Nothing was overwritten.', conflicts };
        return { ...base, kind: 'idle', label: 'Auto-save on', detail: 'Nothing unsaved. "Synced" appears after the next verified save.', conflicts };
    }
  };
  const emit = () => { if (disposed) return; const s = compute(); listeners.forEach(l => { try { l(s); } catch { /* ignore */ } }); };
  saver.subscribe(emit);
  refresher.subscribe(emit);

  /** Attach / detach the realtime listener and release deferred work when permission changed. */
  function syncEnvironment() {
    const pu = probeEligible();
    if (pu && (!probeState || probeState.uid !== pu)) runProbe(pu);
    const linked = canPull();
    if (linked && !detachRemote) {
      try { detachRemote = o.subscribeRemote(() => refresher.notifyRemoteChange()); } catch { detachRemote = null; }
      // Re-detect differences (including conflicts) after a reload. Read only.
      if (!firstPullRequested) { firstPullRequested = true; refresher.notifyRemoteChange(); }
    } else if (!linked && detachRemote) {
      try { detachRemote(); } catch { /* ignore */ }
      detachRemote = null;
      firstPullRequested = false;
    }
    if (unsavedWhileDisabled && canSave()) {
      unsavedWhileDisabled = false;
      saver.notifyChange(); // keeps the pending marker and arms the debounce: a real earlier edit, not the sign-in itself
    }
  }

  const flushPendingBase = () => {
    if (pendingBase) { const b = pendingBase; pendingBase = null; try { o.commitBase(b.uid, b.entries); } catch { /* base is an optimisation: a missing entry only costs a conflict prompt */ } }
  };

  syncEnvironment();

  return {
    onStateChanged(state) {
      if (disposed) return;
      flushPendingBase(); // only after the merged state has been persisted by the caller
      const hsh = syncableHash(state);
      if (hsh !== lastHash) {
        lastHash = hsh;
        if (appliedHashes.has(hsh)) {
          appliedHashes.delete(hsh); // remote merge: never a reason to save
        } else if (!o.isViewer()) {
          appliedHashes.clear(); // a real edit supersedes any earlier applied-from-cloud expectation
          if (canSave()) saver.notifyChange(hsh);
          else store(s => s.setItem(AUTOSAVE_PENDING_KEY, JSON.stringify({ since: o.now() })));
          if (!canSave()) unsavedWhileDisabled = true;
        }
      }
      syncEnvironment();
      emit();
    },
    refresh() { syncEnvironment(); emit(); },
    setOnline(v) {
      online = v;
      saver.setOnline(v);
      if (v) refresher.notifyOnline();
      emit();
    },
    notifyFocus() { refresher.notifyFocus(); },
    async retryNow() {
      const pu = probeEligible();
      if (pu && (!probeState || probeState.uid !== pu || probeState.status === 'error')) { runProbe(pu); emit(); return; }
      await saver.flush();
    },
    noteAppliedFromCloud(state) {
      if (disposed) return;
      const hsh = syncableHash(state);
      if (hsh !== lastHash) appliedHashes.add(hsh);
    },
    conflictsResolved(opts) {
      pullConflicts = []; saveConflicts = [];
      saver.resolved(opts);
      refresher.notifyRemoteChange();
      emit();
    },
    isEditBlocked: () => o.isViewer(),
    getConflicts: () => dedupeConflicts([...saveConflicts, ...pullConflicts]),
    getStatus: compute,
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    dispose() {
      disposed = true;
      try { detachRemote?.(); } catch { /* ignore */ }
      detachRemote = null;
      saver.dispose(); refresher.dispose(); listeners.clear();
    }
  };
}
