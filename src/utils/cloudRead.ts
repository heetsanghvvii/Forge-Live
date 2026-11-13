/**
 * Pure (no firebase) outcome handling for "Load from cloud", so it can be unit tested with a fake read.
 * Rule: a FAILED read (permission-denied, network, unavailable, anything thrown) is never the same as an EMPTY account.
 *  - reason 'absent': the read succeeded and the account has no profile document. Local data is kept.
 *  - reason 'error' : the read failed. Nothing is changed and nothing is written.
 */
import type { AppState } from '../types';
import { planPull } from './cloudMerge';
import type { CloudSnapshot, ConflictDoc } from './cloudMerge';
import type { BaseEntry, SyncBase } from './syncBase';

export type PullFailureReason = 'absent' | 'error';

export const ABSENT_CLOUD_ERROR = 'No cloud record found for this user.';
export const ABSENT_CLOUD_MESSAGE = 'Your account has no cloud data yet. Your local setup was kept. Tap Save to cloud to create it.';

/** Plain-language reason for a failed Firebase call. */
export function friendlyError(error: any, fallback: string): string {
  const code = String(error?.code || '');
  const msg = String(error?.message || '');
  if (code === 'permission-denied' || msg.includes('insufficient permissions') || msg.includes('PERMISSION_DENIED')) {
    return 'Permission denied: sign in with the account that owns these records.';
  }
  if (code === 'unavailable' || code === 'network-request-failed' || /offline|network|Failed to get document because the client is offline/i.test(msg)) {
    return 'You appear to be offline. Check your internet connection and try again.';
  }
  return msg || fallback;
}

/** Text shown when a cloud read failed. Never implies the account is empty. */
export function readFailureMessage(plainReason: string | undefined): string {
  const r = (plainReason || 'unknown problem').trim().replace(/\.+$/, '');
  return `Could not read the cloud (${r}). Nothing was changed.`;
}

export interface PullOutcome {
  success: boolean;
  reason?: PullFailureReason;
  merged?: AppState;
  added?: number;
  conflicts?: number;
  conflictList?: string[];
  conflictDocs?: ConflictDoc[];
  baseEntries?: BaseEntry[];
  userId?: string;
  error?: string;
}

export interface CloudReadLike {
  profileExists: boolean;
  snap: CloudSnapshot;
}

/** Reads the cloud via `read` and plans the pull. Reads only; never writes. */
export async function runPull(
  local: AppState,
  userId: string,
  read: () => Promise<CloudReadLike>,
  getBase: (uid: string) => SyncBase
): Promise<PullOutcome> {
  let cloud: CloudReadLike;
  try {
    cloud = await read();
  } catch (error: any) {
    return { success: false, reason: 'error', error: friendlyError(error, 'Could not load records from cloud.') };
  }
  if (!cloud.profileExists) return { success: false, reason: 'absent', error: ABSENT_CLOUD_ERROR };
  try {
    const plan = planPull(local, cloud.snap, getBase(userId));
    return {
      success: true,
      merged: plan.merged,
      added: plan.added,
      conflicts: plan.conflicts,
      conflictList: plan.conflictList,
      conflictDocs: plan.conflictDocs,
      baseEntries: plan.baseEntries,
      userId
    };
  } catch (error: any) {
    return { success: false, reason: 'error', error: friendlyError(error, 'Could not load records from cloud.') };
  }
}

export type CloudProbeStatus = 'has-data' | 'empty' | 'error';
export interface CloudProbeResult { status: CloudProbeStatus; reason?: string }

/**
 * READ-ONLY check of whether the signed-in account already has cloud data. Never writes.
 * A failed or denied read is 'error', never 'empty'.
 */
export async function runCloudProbe(read: () => Promise<CloudReadLike>): Promise<CloudProbeResult> {
  try {
    const cloud = await read();
    const has = cloud.profileExists || cloud.snap.logDocs.length > 0 || cloud.snap.workoutDocs.length > 0;
    return { status: has ? 'has-data' : 'empty' };
  } catch (error: any) {
    return { status: 'error', reason: friendlyError(error, 'Could not check the cloud.') };
  }
}
