/**
 * `?viewer=1` turns this browser's Viewer mode ON (persisted until switched off in Settings); `?viewer=0` turns it off.
 * Meant for the coach / Instinct browser's bookmark. Anything else leaves the flag alone. Pure with injected storage.
 */
import { setViewerMode, isViewerMode } from './viewerMode';
import type { ViewerStorage } from './viewerMode';

export function applyViewerParam(search: string, storage: ViewerStorage | null | undefined): boolean {
  let v: string | null = null;
  try { v = new URLSearchParams(search).get('viewer'); } catch { v = null; }
  if (v === '1' || v === 'true') setViewerMode(storage, true);
  else if (v === '0' || v === 'false') setViewerMode(storage, false);
  return isViewerMode(storage);
}
