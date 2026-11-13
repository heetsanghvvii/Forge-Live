import { useEffect, useRef, useState, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import type { AppState } from '../types';
import { createAutoSyncController } from '../utils/autoSyncController';
import type { AutoSyncController, SyncBadgeStatus } from '../utils/autoSyncController';
import { evaluateLink, guardedSync, guardedPull } from '../utils/accountLink';
import { commitBaseEntries } from '../utils/syncBase';
import { subscribeToCloudChanges, probeCloudData } from '../utils/cloudSync';
import { isViewerMode, setViewerMode } from '../utils/viewerMode';
import { applyViewerParam } from '../utils/viewerUrl';

const safeStorage = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };

/** Reads ?viewer=1 once at startup (persists the per-browser flag). */
export function initialViewerMode(): boolean {
  try { return applyViewerParam(typeof window !== 'undefined' ? window.location.search : '', safeStorage()); }
  catch { return false; }
}

/**
 * Wires the pure controller to the real window, Firebase listener and App state.
 * Call AFTER the effect that persists appState locally (the controller commits sync base only after persistence).
 */
export function useAutoSync(appState: AppState, setAppState: (u: (prev: AppState) => AppState) => void) {
  const stateRef = useRef(appState);
  stateRef.current = appState;
  const setRef = useRef(setAppState);
  setRef.current = setAppState;
  const [viewer, setViewerState] = useState<boolean>(() => isViewerMode(safeStorage()));
  const viewerRef = useRef(viewer);
  viewerRef.current = viewer;
  const [status, setStatus] = useState<SyncBadgeStatus | null>(null);
  const [ctrl, setCtrl] = useState<AutoSyncController | null>(null);

  useEffect(() => {
    const c = createAutoSyncController({
      getState: () => stateRef.current,
      getUid: () => auth.currentUser?.uid ?? null,
      evaluateLink,
      // never links and never prompts: first-link is excluded by the controller and by the confirm callback.
      save: async (state) => {
        const res = await guardedSync(state, () => false);
        if (res.success && res.verified === false) return { success: false, error: res.error || 'The save could not be verified.' };
        if (res.success && res.timestamp) {
          setRef.current((prev) => ({ ...prev, settings: { ...prev.settings, lastSyncTimestamp: res.timestamp } }));
        }
        return { success: res.success, error: res.error, conflicts: res.conflicts, conflictDocs: res.conflictDocs } as any;
      },
      pull: (state) => guardedPull(state) as any,
      applyState: (u) => setRef.current(u),
      commitBase: commitBaseEntries,
      subscribeRemote: (onChange) => subscribeToCloudChanges(onChange),
      isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
      isViewer: () => viewerRef.current,
      probe: probeCloudData,
      storage: safeStorage(),
      now: () => Date.now(),
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (h) => window.clearTimeout(h as number)
    });
    setStatus(c.getStatus());
    const unsub = c.subscribe(setStatus);
    const onOnline = () => c.setOnline(true);
    const onOffline = () => c.setOnline(false);
    const onFocus = () => c.notifyFocus();
    const onVisible = () => { if (document.visibilityState === 'visible') c.notifyFocus(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    const stopAuth = onAuthStateChanged(auth, () => c.refresh());
    setCtrl(c);
    return () => {
      unsub(); stopAuth();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      c.dispose();
      setCtrl(null);
    };
  }, []);

  // After every committed state change (the persistence effect in App runs before this one).
  useEffect(() => { ctrl?.onStateChanged(appState); }, [appState, ctrl]);
  useEffect(() => { ctrl?.refresh(); }, [viewer, ctrl]);

  const setViewer = useCallback((on: boolean) => {
    setViewerMode(safeStorage(), on);
    viewerRef.current = on;
    setViewerState(on);
    ctrl?.refresh();
  }, [ctrl]);

  return {
    status,
    viewer,
    setViewer,
    retry: () => { void ctrl?.retryNow(); },
    conflictsResolved: (opts?: { save?: boolean }) => ctrl?.conflictsResolved(opts),
    noteAppliedFromCloud: (state: AppState) => ctrl?.noteAppliedFromCloud(state),
    getConflicts: () => ctrl?.getConflicts() ?? []
  };
}
