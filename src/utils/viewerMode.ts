/** Per-browser Viewer mode. A convenience guard against accidental edits, not a permission system. */

export const VIEWER_MODE_KEY = 'forge_viewer_mode_v1';
export const VIEWER_MODE_NOTICE =
  'Viewer mode stops accidental edits in this browser only. It does not limit what anyone signed in to this account can do on any device.';

export interface ViewerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

let memoryFallback = false;

export function isViewerMode(storage?: ViewerStorage | null): boolean {
  try {
    if (storage) {
      const v = storage.getItem(VIEWER_MODE_KEY);
      if (v !== null) return v === '1';
    }
  } catch { /* fall through to memory */ }
  return memoryFallback;
}

export function setViewerMode(storage: ViewerStorage | null | undefined, on: boolean): void {
  memoryFallback = on;
  try { storage?.setItem(VIEWER_MODE_KEY, on ? '1' : '0'); } catch { /* memory fallback keeps it for this page */ }
}

/** Runs fn only when editing is allowed. */
export function guardEdit(storage: ViewerStorage | null | undefined, fn?: () => void): { allowed: boolean } {
  if (isViewerMode(storage)) return { allowed: false };
  fn?.();
  return { allowed: true };
}
