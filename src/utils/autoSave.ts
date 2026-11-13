/**
 * Automatic cloud saving with debounce, offline queue and backoff retry.
 * Pure and dependency-injected: no window / firebase access. Nothing is saved on creation,
 * sign-in or app open; only notifyChange() (a real local edit), flush(), resolved() or a
 * restored pending marker can trigger save().
 */

export const AUTOSAVE_PENDING_KEY = 'forge_autosave_pending_v1';

export type AutoSaveState =
  | 'idle' | 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict' | 'offline' | 'disabled';

export interface AutoSaveStatus {
  state: AutoSaveState;
  pendingSince?: number;
  lastSyncedAt?: number;
  lastError?: string;
  conflicts: number;
  retryInMs?: number;
}

export interface AutoSaveResult {
  success: boolean;
  error?: string;
  /** Count, or the list of conflicting item labels. */
  conflicts?: number | string[];
}

export interface AutoSaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AutoSaverOptions {
  save: () => Promise<AutoSaveResult>;
  isOnline: () => boolean;
  storage?: AutoSaveStorage | null;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  debounceMs?: number;
  maxBackoffMs?: number;
  /** A save that has not answered after this long is reported as failed (and retried). Default 20 s. */
  saveTimeoutMs?: number;
  /** false when signed out, in viewer mode or the link does not match: save() is never called. */
  canSave?: () => boolean;
  /** Returns [0,1). Injectable for tests. */
  random?: () => number;
}

export interface AutoSaver {
  notifyChange(stateHash?: string): void;
  flush(): Promise<void>;
  getStatus(): AutoSaveStatus;
  subscribe(fn: (s: AutoSaveStatus) => void): () => void;
  setOnline(online: boolean): void;
  /** Conflicts handled. By default the device re-saves (verifying save); pass {save:false} when the cloud values were just applied here. */
  resolved(opts?: { save?: boolean }): void;
  restorePending(): boolean;
  dispose(): void;
}

export const BASE_BACKOFF_MS = 2000;
export const DEFAULT_SAVE_TIMEOUT_MS = 20000;
export const SAVE_TIMEOUT_MESSAGE = 'The cloud did not answer. Your changes are kept on this device. Retrying.';

/** Upper bound of the retry delay for the given attempt (1-based). Actual delay is in [cap/2, cap]. */
export function backoffCap(attempt: number, maxBackoffMs: number): number {
  return Math.min(maxBackoffMs, BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempt - 1)));
}

export function createAutoSaver(opts: AutoSaverOptions): AutoSaver {
  const debounceMs = opts.debounceMs ?? 3000;
  const maxBackoffMs = opts.maxBackoffMs ?? 300000;
  const random = opts.random ?? Math.random;
  const canSave = opts.canSave ?? (() => true);
  const saveTimeoutMs = opts.saveTimeoutMs ?? DEFAULT_SAVE_TIMEOUT_MS;
  let editSeq = 0;
  let runSeq = 0;

  let online = opts.isOnline();
  let dirty = false;
  let pendingSince: number | undefined;
  let lastSyncedAt: number | undefined;
  let lastError: string | undefined;
  let conflicts = 0;
  let inFlight: Promise<void> | null = null;
  let timer: unknown = null;
  let timerKind: 'debounce' | 'retry' | null = null;
  let retryAt: number | undefined;
  let attempt = 0;
  let failed = false;
  let synced = false;
  let disposed = false;
  let restored = false;
  const listeners = new Set<(s: AutoSaveStatus) => void>();

  const store = (fn: (s: AutoSaveStorage) => void) => {
    try { if (opts.storage) fn(opts.storage); } catch { /* storage unavailable: marker is best effort */ }
  };
  const mark = () => store(s => s.setItem(AUTOSAVE_PENDING_KEY, JSON.stringify({ since: pendingSince ?? opts.now() })));
  const unmark = () => store(s => s.removeItem(AUTOSAVE_PENDING_KEY));

  const computeStatus = (): AutoSaveStatus => {
    let state: AutoSaveState;
    const hasWork = dirty || timer !== null || inFlight !== null;
    if (!canSave()) state = 'disabled';
    else if (inFlight) state = 'syncing';
    else if (conflicts > 0) state = 'conflict';
    else if (!online && (dirty || failed)) state = 'offline';
    else if (failed) state = 'failed';
    else if (hasWork) state = 'pending';
    else state = synced ? 'synced' : 'idle';
    const s: AutoSaveStatus = { state, conflicts };
    if (pendingSince !== undefined && (state === 'pending' || state === 'offline' || state === 'failed' || state === 'syncing')) s.pendingSince = pendingSince;
    if (lastSyncedAt !== undefined) s.lastSyncedAt = lastSyncedAt;
    if (lastError !== undefined && (state === 'failed' || state === 'conflict')) s.lastError = lastError;
    if (timerKind === 'retry' && retryAt !== undefined) s.retryInMs = Math.max(0, retryAt - opts.now());
    return s;
  };
  const emit = () => { const s = computeStatus(); listeners.forEach(l => { try { l(s); } catch { /* ignore */ } }); };

  const cancelTimer = () => {
    if (timer !== null) opts.clearTimer(timer);
    timer = null; timerKind = null; retryAt = undefined;
  };
  const arm = (kind: 'debounce' | 'retry', ms: number) => {
    cancelTimer();
    timerKind = kind;
    retryAt = opts.now() + ms;
    timer = opts.setTimer(() => { timer = null; timerKind = null; retryAt = undefined; void run(); }, ms);
  };

  async function run(): Promise<void> {
    if (disposed) return;
    if (inFlight) return inFlight;
    if (!dirty) { emit(); return; }
    if (!canSave()) { emit(); return; }
    if (!online) { emit(); return; }
    cancelTimer();
    dirty = false;
    const myRun = ++runSeq;
    const editsAtStart = editSeq;
    const p = (async () => {
      let res: AutoSaveResult;
      let timedOut = false;
      let toHandle: unknown = null;
      const real = opts.save();
      const timeout = new Promise<AutoSaveResult>((resolve) => {
        toHandle = opts.setTimer(() => { timedOut = true; resolve({ success: false, error: SAVE_TIMEOUT_MESSAGE }); }, saveTimeoutMs);
      });
      try { res = await Promise.race([real, timeout]); }
      catch (e: any) { res = { success: false, error: String(e?.message || e || 'Save failed') }; }
      if (!timedOut && toHandle !== null) opts.clearTimer(toHandle);
      if (timedOut) {
        // The stalled save may still finish: if nothing newer happened, a late verified success clears the failure.
        real.then((late) => {
          if (disposed || runSeq !== myRun || editSeq !== editsAtStart || inFlight) return;
          const lc = Array.isArray(late?.conflicts) ? late.conflicts.length : (late?.conflicts || 0);
          if (!late?.success || lc > 0) return;
          cancelTimer();
          dirty = false; failed = false; lastError = undefined; conflicts = 0; attempt = 0;
          lastSyncedAt = opts.now(); synced = true; pendingSince = undefined; unmark();
          emit();
        }, () => { /* the stalled save failed: the retry already scheduled stays */ });
      }
      inFlight = null;
      if (disposed) return;
      const c = Array.isArray(res.conflicts) ? res.conflicts.length : (res.conflicts || 0);
      if (!res.success) {
        dirty = true; failed = true; synced = false;
        lastError = res.error || 'Save failed';
        attempt += 1;
        if (online) {
          const cap = backoffCap(attempt, maxBackoffMs);
          arm('retry', Math.floor(cap / 2 + (cap / 2) * random()));
        }
      } else if (c > 0) {
        failed = false; synced = false; conflicts = c; attempt = 0;
        lastError = 'Some items changed both here and in the cloud. Nothing was overwritten.';
        pendingSince = undefined; unmark();
        if (dirty) { /* new edits during save: re-arm below via notifyChange semantics */ }
      } else {
        failed = false; lastError = undefined; conflicts = 0; attempt = 0;
        lastSyncedAt = opts.now(); synced = true;
        if (dirty) { arm('debounce', debounceMs); }
        else { pendingSince = undefined; unmark(); }
      }
      emit();
    })();
    inFlight = p;
    emit();
    return p;
  }

  return {
    notifyChange() {
      if (disposed) return;
      if (!canSave()) { emit(); return; }
      editSeq++;
      dirty = true; synced = false;
      if (conflicts > 0) { conflicts = 0; }
      if (pendingSince === undefined) pendingSince = opts.now();
      mark();
      if (inFlight) { emit(); return; } // follow-up armed when the in-flight save finishes
      if (!online) { cancelTimer(); emit(); return; }
      if (failed && timerKind === 'retry') { emit(); return; } // keep backoff schedule
      arm('debounce', debounceMs);
      emit();
    },
    async flush() {
      if (disposed) return;
      if (inFlight) { await inFlight; }
      if (dirty && !inFlight) { cancelTimer(); await run(); } else emit();
    },
    getStatus: computeStatus,
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    setOnline(v) {
      if (disposed) return;
      const was = online; online = v;
      if (!v) { cancelTimer(); emit(); return; }
      if (!was && dirty) { attempt = 0; cancelTimer(); void run(); } else emit();
    },
    resolved(o) {
      if (disposed) return;
      conflicts = 0; lastError = undefined; failed = false;
      if (o && o.save === false) {
        if (dirty && !inFlight && online && canSave()) arm('debounce', debounceMs);
        emit();
        return;
      }
      editSeq++;
      dirty = true; if (pendingSince === undefined) pendingSince = opts.now();
      mark();
      if (!inFlight && online && canSave()) arm('debounce', debounceMs);
      emit();
    },
    restorePending() {
      if (disposed || restored) return false;
      restored = true;
      let found = false;
      store(s => { found = s.getItem(AUTOSAVE_PENDING_KEY) !== null; });
      if (!found) return false;
      if (!canSave()) { emit(); return false; } // keep the marker for when saving is allowed again
      dirty = true; pendingSince = opts.now();
      if (online) arm('debounce', debounceMs);
      emit();
      return true;
    },
    dispose() { disposed = true; cancelTimer(); listeners.clear(); }
  };
}
