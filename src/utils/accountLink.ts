import { auth } from '../lib/firebase';
import { AppState } from '../types';
import { hasMeaningfulLocalData } from './cloudMerge';
import { syncOwnerStateToCloud, pullCloudIntoLocal, SyncResult } from './cloudSync';
import type { PullOutcome } from './cloudRead';

export type LinkState =
  | { kind: 'signed-out' }
  | { kind: 'linked'; uid: string }          // device data already belongs to this account
  | { kind: 'first-link'; uid: string }      // device has real entries that were never tied to any account
  | { kind: 'empty-device'; uid: string }    // no real entries locally (a confirmed programme setup alone does not count)
  | { kind: 'mismatch'; uid: string; linkedUid: string };

/** Decides whether this device's local records may be sent to / merged with the signed-in cloud account. */
export function evaluateLink(state: Partial<AppState>, uid: string | null | undefined): LinkState {
  if (!uid) return { kind: 'signed-out' };
  const linked = state.settings?.linkedFirebaseUid;
  if (linked && linked !== uid) return { kind: 'mismatch', uid, linkedUid: linked };
  if (linked === uid) return { kind: 'linked', uid };
  return hasMeaningfulLocalData(state) ? { kind: 'first-link', uid } : { kind: 'empty-device', uid };
}

export const MISMATCH_MESSAGE =
  'This device\'s records belong to a different cloud account. Nothing was sent or loaded. Sign in with the original account, or export a backup and reset local data first.';

export const SIGN_IN_FIRST_MESSAGE = 'Sign in first (Google or email) in Settings. Nothing was sent.';

export interface GuardedResult extends SyncResult {
  linkedUid?: string;
  cancelled?: boolean;
}

/**
 * Whether Save to cloud must ask the person first. Real entries never linked: yes (first-link). A device that has only
 * a confirmed programme setup (no entries) is 'empty-device' for Load, but its first Save still creates the account's
 * cloud record, so it keeps the same explicit confirmation.
 */
export function needsLinkConfirmation(state: Partial<AppState>, link: LinkState): boolean {
  if (link.kind === 'first-link') return true;
  return link.kind === 'empty-device' && Boolean(state.settings?.confirmedProgrammeStart);
}

/**
 * Save to cloud only for the signed-in account the device is linked to.
 * First link of existing local data needs explicit confirmation (confirmFirstLink).
 */
export async function guardedSync(
  appState: AppState,
  confirmFirstLink: (accountLabel: string) => boolean
): Promise<GuardedResult> {
  const user = auth.currentUser;
  const link = evaluateLink(appState, user?.uid);
  if (link.kind === 'signed-out') return { success: false, error: SIGN_IN_FIRST_MESSAGE };
  if (link.kind === 'mismatch') return { success: false, error: MISMATCH_MESSAGE };
  if (needsLinkConfirmation(appState, link)) {
    const label = user?.email || user?.displayName || 'this account';
    if (!confirmFirstLink(label)) {
      return { success: false, cancelled: true, error: 'Cancelled. Nothing was sent.' };
    }
  }
  const res = await syncOwnerStateToCloud(appState);
  return res.success ? { ...res, linkedUid: link.uid } : res;
}

export const FIRST_LINK_PULL_MESSAGE =
  'This device has local records that are not linked to any account yet. Use "Save to cloud" first to link them, or export a backup and reset before loading another account.';

/** Load from cloud only for the account this device is linked to (or a device with no real entries). */
export async function guardedPull(
  appState: AppState,
  deps: { uid: () => string | null | undefined; pull: (s: AppState) => Promise<PullOutcome> } = {
    uid: () => auth.currentUser?.uid,
    pull: pullCloudIntoLocal
  }
): Promise<PullOutcome> {
  const uid = deps.uid();
  const link = evaluateLink(appState, uid);
  if (link.kind === 'signed-out') return { success: false, error: SIGN_IN_FIRST_MESSAGE };
  if (link.kind === 'mismatch') return { success: false, error: MISMATCH_MESSAGE };
  if (link.kind === 'first-link') return { success: false, error: FIRST_LINK_PULL_MESSAGE };
  const res = await deps.pull(appState);
  return res.success && res.merged
    ? { ...res, merged: { ...res.merged, settings: { ...res.merged.settings, linkedFirebaseUid: link.uid } } }
    : res;
}
