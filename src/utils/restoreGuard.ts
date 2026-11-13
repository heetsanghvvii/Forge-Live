/**
 * Atomic restore helper. Pure: works on any storage-like object (localStorage or a test fake).
 *
 * commitState stringifies inside try/catch, writes, reads back and compares, and on ANY failure puts the previous
 * stored string back, so a failed restore never leaves half-written or missing data.
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type CommitResult = { ok: true } | { ok: false; error: string };

function describeError(err: unknown, stage: 'stringify' | 'write' | 'verify'): string {
  const e = err as { name?: string; code?: number; message?: string } | undefined;
  if (stage === 'stringify') {
    if (e instanceof RangeError || /call stack|circular|nest/i.test(e?.message || '')) {
      return 'The backup is too deeply nested to be saved.';
    }
    return 'The backup could not be converted for saving' + (e?.message ? ` (${e.message}).` : '.');
  }
  if (stage === 'verify') return 'The browser did not store the backup completely.';
  if (e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014)) {
    return 'Not enough browser storage space to save this backup.';
  }
  return 'The browser refused to save the backup' + (e?.message ? ` (${e.message}).` : '.');
}

export function commitState(storage: StorageLike, key: string, state: unknown): CommitResult {
  let json: string | undefined;
  try {
    json = JSON.stringify(state);
  } catch (err) {
    return { ok: false, error: describeError(err, 'stringify') };
  }
  if (typeof json !== 'string' || json.length === 0) {
    return { ok: false, error: 'The backup could not be converted for saving.' };
  }

  let previous: string | null = null;
  try {
    previous = storage.getItem(key);
  } catch (err) {
    return { ok: false, error: describeError(err, 'write') };
  }

  const rollback = () => {
    try {
      if (previous === null) storage.removeItem(key);
      else storage.setItem(key, previous);
    } catch {
      /* nothing more we can do */
    }
  };

  try {
    storage.setItem(key, json);
  } catch (err) {
    rollback();
    return { ok: false, error: describeError(err, 'write') };
  }
  try {
    const back = storage.getItem(key);
    if (back === null || back.length !== json.length || back !== json) {
      rollback();
      return { ok: false, error: describeError(undefined, 'verify') };
    }
  } catch (err) {
    rollback();
    return { ok: false, error: describeError(err, 'verify') };
  }
  return { ok: true };
}

export interface AbortableReader {
  abort(): void;
}

/**
 * Tracks the one restore file read that is allowed to finish. cancel() (called when Settings closes or unmounts)
 * aborts the reader and makes every late callback see isCurrent() === false, so a late restore or alert never happens.
 */
export class RestoreSession {
  private reader: AbortableReader | null = null;
  private cancelled = false;

  /** Begin tracking a reader; any previous reader is aborted. */
  begin(reader: AbortableReader): void {
    this.abortCurrent();
    this.reader = reader;
  }

  isCurrent(reader: AbortableReader): boolean {
    return !this.cancelled && this.reader === reader;
  }

  finish(reader: AbortableReader): void {
    if (this.reader === reader) this.reader = null;
  }

  cancel(): void {
    this.cancelled = true;
    this.abortCurrent();
  }

  private abortCurrent(): void {
    const r = this.reader;
    this.reader = null;
    try { r?.abort(); } catch { /* already finished */ }
  }
}
