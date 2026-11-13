/** Tiny pub/sub so storage code can surface honest, persistent notices without importing React. */
export interface StorageNoticeState {
  /** localStorage key holding a kept copy of data we could not read (null = none this session). */
  corruptCopyKey: string | null;
  /** True while the latest state could not be written to this device. */
  unsaved: boolean;
  unsavedError: string | null;
  dismissedCorrupt: boolean;
}

let state: StorageNoticeState = { corruptCopyKey: null, unsaved: false, unsavedError: null, dismissedCorrupt: false };
let pendingUnsaved: string | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => { try { l(); } catch { /* ignore */ } });

export function getStorageNotices(): StorageNoticeState { return state; }
export function subscribeStorageNotices(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }

export function noteCorruptCopy(key: string): void { state = { ...state, corruptCopyKey: key, dismissedCorrupt: false }; emit(); }
export function dismissCorruptNotice(): void { state = { ...state, dismissedCorrupt: true }; emit(); }

/** Called by saveAppState. `serialized` is kept in memory so nothing is lost while storage is failing. */
export function noteSaveFailed(serialized: string | null, error: string): void {
  pendingUnsaved = serialized;
  state = { ...state, unsaved: true, unsavedError: error }; emit();
}
export function noteSaveOk(): void {
  if (!state.unsaved && pendingUnsaved === null) return;
  pendingUnsaved = null;
  state = { ...state, unsaved: false, unsavedError: null }; emit();
}
export function getPendingUnsavedText(): string | null { return pendingUnsaved; }

export function resetStorageNoticesForTest(): void {
  state = { corruptCopyKey: null, unsaved: false, unsavedError: null, dismissedCorrupt: false };
  pendingUnsaved = null;
}
