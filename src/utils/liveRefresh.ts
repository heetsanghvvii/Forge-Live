/**
 * Read-only live refresh. On a remote change / focus / reconnect it schedules ONE coalesced pull,
 * skips while local work is pending or syncing, and hands the result to apply().
 * This module never writes anything itself.
 */

export interface LiveRefreshStatus {
  lastCheckedAt?: number;
  lastError?: string;
  checking: boolean;
}

export interface LiveRefresherOptions<R> {
  pull: () => Promise<R>;
  apply: (result: R) => void | Promise<void>;
  /** Injected cloud listener; call onRemoteChange when the cloud changed. Returns an unsubscribe. */
  subscribe: (onRemoteChange: () => void) => () => void;
  isBusy: () => boolean;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  minIntervalMs?: number;
  /** Delay before re-checking while busy. Default 1000. */
  busyRecheckMs?: number;
}

export interface LiveRefresher {
  notifyRemoteChange(): void;
  notifyFocus(): void;
  notifyOnline(): void;
  getStatus(): LiveRefreshStatus;
  subscribe(fn: (s: LiveRefreshStatus) => void): () => void;
  dispose(): void;
}

export function createLiveRefresher<R>(opts: LiveRefresherOptions<R>): LiveRefresher {
  const minIntervalMs = opts.minIntervalMs ?? 5000;
  const busyRecheckMs = opts.busyRecheckMs ?? 1000;
  let lastCheckedAt: number | undefined;
  let lastStart: number | undefined;
  let lastError: string | undefined;
  let checking = false;
  let wanted = false;
  let timer: unknown = null;
  let disposed = false;
  const listeners = new Set<(s: LiveRefreshStatus) => void>();

  const status = (): LiveRefreshStatus => {
    const s: LiveRefreshStatus = { checking };
    if (lastCheckedAt !== undefined) s.lastCheckedAt = lastCheckedAt;
    if (lastError !== undefined) s.lastError = lastError;
    return s;
  };
  const emit = () => { const s = status(); listeners.forEach(l => { try { l(s); } catch { /* ignore */ } }); };

  const schedule = (ms: number) => {
    if (timer !== null || disposed) return;
    timer = opts.setTimer(() => { timer = null; void attempt(); }, ms);
  };

  async function attempt(): Promise<void> {
    if (disposed || !wanted || checking) return;
    if (opts.isBusy()) { schedule(busyRecheckMs); return; }
    const since = lastStart === undefined ? Infinity : opts.now() - lastStart;
    if (since < minIntervalMs) { schedule(minIntervalMs - since); return; }
    wanted = false;
    checking = true; lastStart = opts.now();
    emit();
    try {
      const result = await opts.pull();
      if (disposed) return;
      if (opts.isBusy()) {
        // Local work started while pulling: do not apply over it; look again later.
        wanted = true;
      } else {
        await opts.apply(result);
        lastError = undefined;
      }
      lastCheckedAt = opts.now();
    } catch (e: any) {
      lastError = String(e?.message || e || 'Could not check the cloud');
      lastCheckedAt = opts.now();
    } finally {
      checking = false;
    }
    if (disposed) return;
    emit();
    if (wanted) schedule(opts.isBusy() ? busyRecheckMs : minIntervalMs);
  }

  const request = () => { if (disposed) return; wanted = true; void attempt(); };
  const unsubscribe = opts.subscribe(request);

  return {
    notifyRemoteChange: request,
    notifyFocus: request,
    notifyOnline: request,
    getStatus: status,
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    dispose() {
      disposed = true;
      if (timer !== null) opts.clearTimer(timer);
      timer = null;
      try { unsubscribe(); } catch { /* ignore */ }
      listeners.clear();
    }
  };
}
