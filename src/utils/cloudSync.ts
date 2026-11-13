import { doc, getDoc, getDocFromServer, getDocsFromServer, setDoc, deleteDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ensureGoogleSignIn } from './googleAuth';
import { buildCoachSummary, shouldBlockEmptyOverwrite, planSave, planPull, planUseCloud, sanitizeForFirestore, contentMismatches, normalizeDailyLog, normalizeWorkout, dayNumberOfCloudDoc, hashDailyDoc, hashWorkoutDoc, hashEntry, summariseConflicts, buildProfileWrite } from './cloudMerge';
import type { CloudDocLike, CloudSnapshot, ConflictDoc, ConflictRef } from './cloudMerge';
import { getSyncBase, commitBaseEntries } from './syncBase';
import { friendlyError, runPull, runCloudProbe, ABSENT_CLOUD_ERROR } from './cloudRead';
import type { CloudProbeResult } from './cloudRead';
import type { PullOutcome } from './cloudRead';
import type { BaseEntry } from './syncBase';
import { dailyLogsToCsv, workoutSetsToCsv, weighInsToCsv, measurementsToCsv } from './exportCsv';
import { serializeBackup } from './backup';
import { AppState, DailyLog, WorkoutHistory, WeighInRecord, MeasurementRecord } from '../types';

export { ensureGoogleSignIn } from './googleAuth';
export { commitBaseEntries } from './syncBase';
export type { BaseEntry } from './syncBase';
export type { ConflictDoc, ConflictRef } from './cloudMerge';

export interface SyncResult {
  success: boolean;
  /** For display only; set when no write failed. Never used to decide what to write. */
  timestamp?: string;
  count?: number;
  verified?: boolean;
  userId?: string;
  error?: string;
  /** Human-readable labels of items that changed both here and in the cloud and were NOT written. */
  conflicts?: string[];
  /** The same items as structured ids, for the resolve-conflict actions. */
  conflictDocs?: ConflictDoc[];
  /** Human-readable note when the save succeeded but something needs attention. */
  message?: string;
}

const COACH_SUMMARY_ID = 'current';

export interface CoachDashboardData {
  ownerProfile: {
    displayName?: string;
    programmeStartDate?: string;
    currentPhase?: string;
    timezone?: string;
    bodyweightKg?: number;
    startingWeightKg?: number;
    updatedAt?: string;
    // Never shared (always undefined for coaches); kept so CoachView keeps compiling.
    proposedGoalWeightKg?: number;
    heightCm?: number;
    age?: number;
    trainingExperience?: string;
    dietaryExclusions?: string;
    injuriesAndConstraints?: string;
  };
  dailyLogs: DailyLog[];
  workoutLogs: WorkoutHistory;
  lastUpdated: string;
}

interface CloudRead {
  snap: CloudSnapshot;
  profileExists: boolean;
  hasAuthorizedCoach: boolean;
}

/** Reads everything we might touch from the SERVER (never the local cache). */
async function fetchCloud(userId: string): Promise<CloudRead> {
  const profileSnap = await getDocFromServer(doc(db, 'users', userId));
  const logsSnap = await getDocsFromServer(collection(db, 'users', userId, 'dailyLogs'));
  const workoutsSnap = await getDocsFromServer(collection(db, 'users', userId, 'workoutLogs'));
  const coachSnap = await getDocsFromServer(collection(db, 'users', userId, 'coachAccess'));
  return {
    profileExists: profileSnap.exists(),
    hasAuthorizedCoach: coachSnap.docs.some((d) => d.data()?.status === 'authorized'),
    snap: {
      profile: profileSnap.exists() ? (profileSnap.data() as Record<string, any>) : {},
      logDocs: logsSnap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, any> })),
      workoutDocs: workoutsSnap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, any> }))
    }
  };
}

function cloudHasRecords(snap: CloudSnapshot): boolean {
  const p = snap.profile;
  return (
    snap.logDocs.length > 0 ||
    snap.workoutDocs.length > 0 ||
    (Array.isArray(p.weighIns) && p.weighIns.length > 0) ||
    (Array.isArray(p.measurementHistory) && p.measurementHistory.length > 0) ||
    Boolean(p.programmeStartDate)
  );
}

const COLLISION_HINT =
  'Skipped so no other day is overwritten (usually the programme start date changed after these days were saved, so two days now share a date)';

/**
 * Plans and performs a save. `only` limits it to exactly the listed docs and force-writes them (resolve: use this device).
 * Per document the cloud is only overwritten when it is unchanged since this device's base version; otherwise it is a
 * conflict and nothing is written. The base advances only for documents verified by a server read-back.
 */
async function executeSave(
  userId: string,
  local: AppState,
  cloud: CloudRead,
  only?: ConflictRef[]
): Promise<SyncResult> {
  const nowIso = new Date().toISOString();
  const userPath = `users/${userId}`;
  const snap = cloud.snap;
  const plan = planSave(local, snap, getSyncBase(userId), userId, nowIso, only);
  // Docs that are byte-for-byte equal in the cloud are already synced.
  commitBaseEntries(userId, plan.inSync);

  const pf = plan.profile;
  const profileExists = !!snap.profile && Object.keys(snap.profile).length > 0;
  // null = nothing real changed: do not write the profile doc (its updatedAt must not move for nothing).
  const profileWrite = buildProfileWrite(pf, userId, nowIso, profileExists);
  const finalProfile = { ...snap.profile, ...(profileWrite ?? {}) };

  type W = { label: string; run: () => Promise<unknown>; ok: boolean; kind: 'profile' | 'daily' | 'workout' | 'other'; id?: string; payload?: Record<string, any> };
  const writes: W[] = [];
  // authorizedCoachUid and coachAccess are NEVER touched here.
  if (profileWrite) writes.push({ label: 'profile', kind: 'profile', ok: false, run: () => setDoc(doc(db, 'users', userId), sanitizeForFirestore(profileWrite), { merge: true }) });
  for (const w of plan.daily.writes) {
    writes.push({ label: w.label, kind: 'daily', id: w.id, payload: w.payload, ok: false, run: () => setDoc(doc(db, 'users', userId, 'dailyLogs', w.id), sanitizeForFirestore(w.payload)) });
  }
  for (const w of plan.workouts.writes) {
    writes.push({ label: w.label, kind: 'workout', id: w.id, payload: w.payload, ok: false, run: () => setDoc(doc(db, 'users', userId, 'workoutLogs', w.id), sanitizeForFirestore(w.payload)) });
  }

  // Coach summary: only REFRESHED while a grant already exists in the cloud; never creates/changes grants.
  if (cloud.hasAuthorizedCoach) {
    writes.push({
      label: 'coach summary',
      kind: 'other',
      ok: false,
      run: () =>
        setDoc(
          doc(db, 'users', userId, 'coachSummary', COACH_SUMMARY_ID),
          buildCoachSummary(
            {
              displayName: finalProfile.displayName,
              startDate: finalProfile.programmeStartDate,
              confirmedProgrammeStart: Boolean(finalProfile.programmeStartDate),
              activePhase: finalProfile.currentPhase,
              timezone: finalProfile.timezone,
              bodyweightKg: finalProfile.bodyweightKg,
              startingWeightKg: finalProfile.startingWeightKg
            } as any,
            nowIso
          )
        )
    });
  } else {
    writes.push({
      label: 'coach summary removal',
      kind: 'other',
      ok: false,
      // Best effort: older deployed rules reject deleting a doc that does not exist; never fail the save for it.
      run: () => deleteDoc(doc(db, 'users', userId, 'coachSummary', COACH_SUMMARY_ID)).catch((e) => { console.warn('coach summary cleanup skipped:', e?.code || e); })
    });
  }

  let failCount = 0;
  let firstReason = '';
  for (const w of writes) {
    try {
      await w.run();
      w.ok = true;
    } catch (err: any) {
      failCount++;
      if (!firstReason) firstReason = friendlyError(err, 'Unknown error');
      try {
        handleFirestoreError(err, OperationType.WRITE, `${userPath} (${w.label})`);
      } catch {
        // Error logged by handler
      }
    }
  }
  const okCount = writes.filter((w) => w.ok).length;

  // Read back from the server; compare content; advance the base ONLY for verified documents.
  const bad: string[] = [];
  const newBase: BaseEntry[] = [];
  let readBackFailed = false;
  try {
    const afterProfileSnap = await getDocFromServer(doc(db, 'users', userId));
    const afterProfile: Record<string, any> = afterProfileSnap.exists() ? (afterProfileSnap.data() as Record<string, any>) : {};
    const afterLogs = new Map((await getDocsFromServer(collection(db, 'users', userId, 'dailyLogs'))).docs.map((d) => [d.id, d.data() as Record<string, any>]));
    const afterWorkouts = new Map((await getDocsFromServer(collection(db, 'users', userId, 'workoutLogs'))).docs.map((d) => [d.id, d.data() as Record<string, any>]));
    for (const w of writes) {
      if (!w.ok) continue;
      if (w.kind === 'daily') {
        const after = afterLogs.get(w.id!);
        const m = contentMismatches(w.payload!, after);
        if (m.length) bad.push(`${w.label} (${m.slice(0, 3).join(', ')})`);
        else newBase.push({ section: 'daily', id: w.id!, hash: hashDailyDoc(after!, Number(w.payload!.dayNumber)) });
      } else if (w.kind === 'workout') {
        const after = afterWorkouts.get(w.id!);
        const m = contentMismatches(w.payload!, after);
        if (m.length) bad.push(`${w.label} (${m.slice(0, 3).join(', ')})`);
        else newBase.push({ section: 'workouts', id: w.id!, hash: hashWorkoutDoc(after!, String(w.payload!.dayKey)) });
      } else if (w.kind === 'profile') {
        const m = contentMismatches(sanitizeForFirestore(pf.fields), afterProfile);
        if (m.length) {
          bad.push(`profile (${m.slice(0, 3).join(', ')})`);
        } else {
          for (const f of Object.keys(pf.fields)) newBase.push({ section: 'profile', id: f, hash: hashEntry(afterProfile[f]) });
        }
        const check = (section: 'weighIns' | 'measurements', arrKey: 'weighIns' | 'measurementHistory', planned: any[] | undefined, dates: string[]) => {
          for (const date of dates) {
            const want = planned?.find((x) => x?.date === date);
            const got = (afterProfile[arrKey] as any[] | undefined)?.find((x) => x?.date === date);
            if (want && got && hashEntry(want) === hashEntry(got)) newBase.push({ section, id: date, hash: hashEntry(got) });
            else bad.push(`${arrKey} ${date}`);
          }
        };
        check('weighIns', 'weighIns', pf.weighIns, pf.writtenWeighInDates);
        check('measurements', 'measurementHistory', pf.measurementHistory, pf.writtenMeasurementDates);
        // Deleted dates: verified by their ABSENCE on read-back, then dropped from the base so the
        // deletion is remembered as synced (and never written back).
        const checkDeleted = (section: 'weighIns' | 'measurements', arrKey: 'weighIns' | 'measurementHistory', dates: string[]) => {
          for (const date of dates) {
            const got = (afterProfile[arrKey] as any[] | undefined)?.find((x) => x?.date === date);
            if (!got) newBase.push({ section, id: date, hash: null });
            else bad.push(`${arrKey} ${date} (delete)`);
          }
        };
        checkDeleted('weighIns', 'weighIns', pf.deletedWeighInDates);
        checkDeleted('measurements', 'measurementHistory', pf.deletedMeasurementDates);
      }
    }
  } catch (err: any) {
    readBackFailed = true;
    firstReason = firstReason || friendlyError(err, 'Could not read the records back from the cloud.');
  }
  commitBaseEntries(userId, newBase);

  const conflictLabels = plan.conflicts.map((c) => c.label);
  const conflictMessage = plan.conflicts.length > 0
    ? `${plan.conflicts.length} item(s) changed both here and in the cloud, so they were not saved: ${summariseConflicts(conflictLabels)}. Nothing was overwritten. Choose which version to keep.`
    : undefined;
  const common = { userId, count: okCount, conflicts: conflictLabels, conflictDocs: plan.conflicts, message: conflictMessage };

  if (failCount > 0 || plan.collisions.length > 0 || readBackFailed || bad.length > 0) {
    const parts: string[] = [];
    if (failCount > 0) parts.push(`${failCount} of ${writes.length} records failed to save: ${firstReason}`);
    else if (readBackFailed) parts.push(`Saved, but the records could not be read back to verify: ${firstReason}`);
    if (bad.length > 0) parts.push(`Saved, but verification failed: the cloud copy does not match for ${bad.length} record(s): ${bad.slice(0, 3).join('; ')}.`);
    if (plan.collisions.length > 0) parts.push(`${COLLISION_HINT}: ${plan.collisions.join('; ')}`);
    return { success: false, verified: false, ...common, error: parts.join(' ') };
  }
  return { success: true, verified: true, timestamp: nowIso, ...common };
}

async function signedInUser() {
  let currentUser = auth.currentUser;
  if (!currentUser) currentUser = await ensureGoogleSignIn();
  return currentUser;
}

const EMPTY_DEVICE_ERROR = 'Cloud already has records but this device is empty. Load from cloud first — nothing was changed.';

/**
 * Saves Owner state to Cloud Firestore strictly under /users/{auth.currentUser.uid}.
 * Three-way: a document is only overwritten when the cloud copy is unchanged since this device last synced it.
 */
export async function syncOwnerStateToCloud(appState: AppState): Promise<SyncResult> {
  let currentUser;
  try {
    currentUser = await signedInUser();
  } catch (authErr: any) {
    return { success: false, error: authErr?.message || 'Google sign-in required to sync with Cloud Firestore.' };
  }
  const userId = currentUser.uid;
  try {
    const cloud = await fetchCloud(userId);
    if (shouldBlockEmptyOverwrite(cloudHasRecords(cloud.snap), appState)) {
      return { success: false, verified: false, error: EMPTY_DEVICE_ERROR };
    }
    return await executeSave(userId, appState, cloud);
  } catch (error: any) {
    try {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
    } catch {
      // Error logged by handler
    }
    return { success: false, verified: false, error: friendlyError(error, 'Sync failed. Local data remains safe.') };
  }
}

/**
 * Resolve: "Use this device's values". Writes ONLY the listed conflicting docs (cloud is overwritten for those),
 * then advances their base. Everything else is left exactly as it is in the cloud.
 */
export async function resolveConflictsUseLocal(appState: AppState, conflictIds: ConflictRef[]): Promise<SyncResult> {
  if (!conflictIds.length) return { success: false, error: 'Nothing to resolve.' };
  let currentUser;
  try {
    currentUser = await signedInUser();
  } catch (authErr: any) {
    return { success: false, error: authErr?.message || 'Sign-in required.' };
  }
  const userId = currentUser.uid;
  try {
    const cloud = await fetchCloud(userId);
    if (shouldBlockEmptyOverwrite(cloudHasRecords(cloud.snap), appState)) {
      return { success: false, verified: false, error: EMPTY_DEVICE_ERROR };
    }
    return await executeSave(userId, appState, cloud, conflictIds);
  } catch (error: any) {
    try {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
    } catch {
      // Error logged by handler
    }
    return { success: false, verified: false, error: friendlyError(error, 'Could not resolve the differences. Nothing was changed.') };
  }
}

/**
 * Resolve: "Use cloud values". Returns the local state with exactly the listed items replaced by the cloud versions.
 * Nothing is written to the cloud. The caller applies `merged`, then calls commitBaseEntries(userId, baseEntries).
 */
export async function resolveConflictsUseCloud(
  appState: AppState,
  conflictIds: ConflictRef[]
): Promise<{ success: boolean; reason?: 'absent' | 'error'; merged?: AppState; baseEntries?: BaseEntry[]; userId?: string; error?: string }> {
  if (!conflictIds.length) return { success: false, error: 'Nothing to resolve.' };
  try {
    const user = await signedInUser();
    const cloud = await fetchCloud(user.uid);
    if (!cloud.profileExists) return { success: false, reason: 'absent', error: ABSENT_CLOUD_ERROR };
    const r = planUseCloud(appState, cloud.snap, conflictIds);
    if (r.applied === 0) return { success: false, error: 'Those items no longer exist in the cloud. Nothing was changed.' };
    return { success: true, merged: r.merged, baseEntries: r.baseEntries, userId: user.uid };
  } catch (error: any) {
    return { success: false, reason: 'error', error: friendlyError(error, 'Could not load the cloud versions. Nothing was changed.') };
  }
}

async function requireUser(whyError: string) {
  let currentUser = auth.currentUser;
  if (!currentUser) {
    try {
      currentUser = await ensureGoogleSignIn();
    } catch (err: any) {
      throw new Error(err?.message || whyError);
    }
  }
  return currentUser;
}

async function fetchAuthorizedCoachUids(userId: string): Promise<string[]> {
  const snap = await getDocsFromServer(collection(db, 'users', userId, 'coachAccess'));
  return snap.docs.filter((d) => d.data()?.status === 'authorized').map((d) => d.id);
}

/** Uids of coaches with status 'authorized' in users/{me}/coachAccess. Returns [] when signed out or on read failure. */
export async function listAuthorizedCoachUids(): Promise<string[]> {
  const user = auth.currentUser;
  if (!user) return [];
  try {
    return await fetchAuthorizedCoachUids(user.uid);
  } catch (error) {
    console.warn('Could not list coach access:', error);
    return [];
  }
}

async function revokeCoaches(userId: string, coachUids: string[]): Promise<{ success: boolean; error?: string }> {
  const nowIso = new Date().toISOString();
  let firstError = '';
  let failed = 0;
  const attempt = async (path: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (error: any) {
      failed++;
      if (!firstError) firstError = friendlyError(error, 'Failed to revoke coach access in cloud database.');
      try {
        handleFirestoreError(error, OperationType.DELETE, path);
      } catch {
        // Error logged by handler
      }
    }
  };
  // Summary first so nothing is left to read, then every consent record.
  await attempt(`users/${userId}/coachSummary/${COACH_SUMMARY_ID}`, () => deleteDoc(doc(db, 'users', userId, 'coachSummary', COACH_SUMMARY_ID)));
  for (const uid of coachUids) {
    await attempt(`users/${userId}/coachAccess/${uid}`, () => deleteDoc(doc(db, 'users', userId, 'coachAccess', uid)));
  }
  if (failed === 0) {
    await attempt(`users/${userId}`, () => setDoc(doc(db, 'users', userId), { userId, authorizedCoachUid: '', updatedAt: nowIso }, { merge: true }));
  }
  return failed === 0 ? { success: true } : { success: false, error: firstError };
}

/** Revokes EVERY authorized coach: deletes the summary, then each coachAccess doc, then clears the profile field. */
export async function revokeAllCoachAccessInCloud(): Promise<SyncResult> {
  let user;
  try {
    user = await requireUser('Sign-in required to revoke coach access.');
  } catch (err: any) {
    return { success: false, error: err.message };
  }
  try {
    const uids = await fetchAuthorizedCoachUids(user.uid);
    const r = await revokeCoaches(user.uid, uids);
    return { ...r, userId: user.uid, count: uids.length, timestamp: r.success ? new Date().toISOString() : undefined };
  } catch (error: any) {
    return { success: false, userId: user.uid, error: friendlyError(error, 'Failed to revoke coach access in cloud database.') };
  }
}

/**
 * Revokes one coach (summary, then that coachAccess doc, then the profile UI field).
 * A blank coachUid falls back to revoking every authorized coach.
 */
export async function revokeCoachAccessInCloud(coachUid: string): Promise<{ success: boolean; error?: string }> {
  const uid = (coachUid || '').trim();
  if (!uid) return revokeAllCoachAccessInCloud();
  let user;
  try {
    user = await requireUser('Sign-in required to revoke coach access.');
  } catch (err: any) {
    return { success: false, error: err.message };
  }
  try {
    return await revokeCoaches(user.uid, [uid]);
  } catch (error: any) {
    return { success: false, error: friendlyError(error, 'Failed to revoke coach access in cloud database.') };
  }
}

/**
 * Grants a coach read-only access: writes users/{owner}/coachAccess/{coach} (the consent record)
 * and publishes users/{owner}/coachSummary/current (the small allowlisted summary, built from the
 * owner's own cloud profile). The coach can never read the profile document itself.
 * authorizedCoachUid on the profile is kept only as UI state; rules do not use it.
 */
export async function grantCoachAccessInCloud(coachUid: string): Promise<{ success: boolean; error?: string }> {
  let currentUser = auth.currentUser;
  if (!currentUser) {
    try {
      currentUser = await ensureGoogleSignIn();
    } catch (err: any) {
      return { success: false, error: err?.message || 'Sign-in required to grant coach access.' };
    }
  }

  if (!(coachUid || '').trim()) return { success: false, error: 'Coach UID is required.' };
  const userId = currentUser.uid;
  const coachAccessPath = `users/${userId}/coachAccess/${coachUid}`;
  const nowIso = new Date().toISOString();

  try {
    // 1. Consent record
    await setDoc(doc(db, 'users', userId, 'coachAccess', coachUid), {
      coachUid,
      ownerUid: userId,
      status: 'authorized',
      grantedAt: nowIso
    });

    // 2. UI state on the profile (not used for access)
    await setDoc(
      doc(db, 'users', userId),
      { userId, authorizedCoachUid: coachUid, updatedAt: nowIso },
      { merge: true }
    );

    // 3. Shared summary from the owner's cloud profile (allowlist only)
    const profileSnap = await getDocFromServer(doc(db, 'users', userId));
    const p: Record<string, any> = profileSnap.exists() ? profileSnap.data() : {};
    await setDoc(
      doc(db, 'users', userId, 'coachSummary', COACH_SUMMARY_ID),
      buildCoachSummary(
        {
          displayName: p.displayName,
          startDate: p.programmeStartDate,
          confirmedProgrammeStart: Boolean(p.programmeStartDate),
          activePhase: p.currentPhase,
          timezone: p.timezone,
          bodyweightKg: p.bodyweightKg,
          startingWeightKg: p.startingWeightKg
        },
        nowIso
      )
    );

    return { success: true };
  } catch (error: any) {
    try {
      handleFirestoreError(error, OperationType.WRITE, coachAccessPath);
    } catch {
      // Error logged by handler
    }
    return {
      success: false,
      error: error?.message || 'Failed to grant coach access in cloud database.'
    };
  }
}

function pickDefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as any)[k] = v;
  }
  return out;
}

/**
 * Loads Owner state from Cloud Firestore (only fields actually present in the cloud profile)
 */
export async function loadOwnerStateFromCloud(
  targetUserId?: string
): Promise<{ success: boolean; reason?: 'absent' | 'error'; appState?: Partial<AppState>; error?: string }> {
  const userId = targetUserId || auth.currentUser?.uid;
  if (!userId) {
    return { success: false, error: 'No user ID provided and no signed in Google user found.' };
  }

  const userPath = `users/${userId}`;
  try {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDocFromServer(userDocRef);

    if (!snap.exists()) {
      return { success: false, reason: 'absent', error: ABSENT_CLOUD_ERROR };
    }

    const userData = snap.data();

    // Fetch daily logs subcollection
    const dailyLogsRef = collection(db, 'users', userId, 'dailyLogs');
    const logsSnap = await getDocsFromServer(dailyLogsRef);
    const remoteLogs: { [day: number]: DailyLog } = {};

    logsSnap.forEach((docItem) => {
      const raw = docItem.data() as DailyLog;
      const n = dayNumberOfCloudDoc(docItem.id, raw);
      if (n !== undefined && !remoteLogs[n]) {
        remoteLogs[n] = normalizeDailyLog(raw, n);
      }
    });

    // Fetch workout logs subcollection
    const workoutLogsRef = collection(db, 'users', userId, 'workoutLogs');
    const workoutsSnap = await getDocsFromServer(workoutLogsRef);
    const remoteWorkouts: WorkoutHistory = {};

    workoutsSnap.forEach((docItem) => {
      const data = docItem.data();
      const key = typeof data.dayKey === 'string' && data.dayKey ? data.dayKey : docItem.id;
      remoteWorkouts[key] = normalizeWorkout(data);
    });

    return {
      success: true,
      appState: {
        settings: pickDefined({
          startDate: userData.programmeStartDate,
          activePhase: userData.currentPhase,
          bodyweightKg: userData.bodyweightKg,
          startingWeightKg: userData.startingWeightKg,
          proposedGoalWeightKg: userData.proposedGoalWeightKg,
          heightCm: userData.heightCm,
          age: userData.age,
          gender: userData.gender,
          trainingExperience: userData.trainingExperience,
          equipment: userData.equipment,
          injuriesAndConstraints: userData.injuriesAndConstraints,
          dietaryExclusions: userData.dietaryExclusions,
          wakeTime: userData.wakeTime,
          workTime: userData.workTime,
          gymTime: userData.gymTime,
          timezone: userData.timezone,
          authorizedCoachUid: userData.authorizedCoachUid
        }) as any,
        dailyLogs: remoteLogs,
        workoutLogs: remoteWorkouts,
        weighIns: userData.weighIns || [],
        measurementHistory: userData.measurementHistory || []
      }
    };
  } catch (error: any) {
    try {
      handleFirestoreError(error, OperationType.GET, userPath);
    } catch {
      // Error logged by handler
    }
    return {
      success: false,
      reason: 'error',
      error: friendlyError(error, 'Could not load records from cloud.')
    };
  }
}

/**
 * Downloads cloud records and decides, per document, what to adopt (three-way, see planPull).
 * Pure with respect to local state: the caller applies `merged` and then commits `baseEntries`
 * (commitBaseEntries(userId, baseEntries)); until then the stored base is untouched.
 */
export async function pullCloudIntoLocal(local: AppState): Promise<PullOutcome> {
  let user;
  try {
    user = auth.currentUser;
    if (!user) user = await ensureGoogleSignIn();
  } catch (error: any) {
    return { success: false, reason: 'error', error: friendlyError(error, 'Could not load records from cloud.') };
  }
  return runPull(local, user.uid, () => fetchCloud(user.uid), getSyncBase);
}

/** Read-only: does the signed-in account already have cloud data? Never writes, never prompts to sign in. */
export async function probeCloudData(uid: string): Promise<CloudProbeResult> {
  return runCloudProbe(() => fetchCloud(uid));
}

/**
 * Coach Read-Only Data Fetcher
 */
export async function loadCoachDashboardData(
  ownerUid: string
): Promise<{ success: boolean; data?: CoachDashboardData; error?: string }> {
  if (!auth.currentUser) {
    return {
      success: false,
      error: 'Coach must be signed in with Google to review athlete records.'
    };
  }

  const userPath = `users/${ownerUid}`;
  try {
    // Coaches read ONLY the shared summary, never users/{uid}.
    const summarySnap = await getDoc(doc(db, 'users', ownerUid, 'coachSummary', COACH_SUMMARY_ID));

    if (!summarySnap.exists()) {
      return { success: false, error: 'No shared summary found. Ask the athlete to authorize you and tap Sync Now.' };
    }

    // Same field names CoachView reads; anything not shared stays undefined.
    const ownerProfile: Record<string, any> = summarySnap.data();

    // Fetch daily logs
    const dailyLogsRef = collection(db, 'users', ownerUid, 'dailyLogs');
    const logsSnap = await getDocs(dailyLogsRef);
    const dailyLogs: DailyLog[] = [];

    logsSnap.forEach((docItem) => {
      dailyLogs.push(docItem.data() as DailyLog);
    });

    dailyLogs.sort((a, b) => (a.date > b.date ? 1 : -1));

    // Fetch workout logs
    const workoutLogsRef = collection(db, 'users', ownerUid, 'workoutLogs');
    const workoutsSnap = await getDocs(workoutLogsRef);
    const workoutLogs: WorkoutHistory = {};

    workoutsSnap.forEach((docItem) => {
      const w = docItem.data();
      if (w.dayKey) workoutLogs[w.dayKey] = w as any;
    });

    return {
      success: true,
      data: {
        ownerProfile,
        dailyLogs,
        workoutLogs,
        lastUpdated: ownerProfile.updatedAt || new Date().toISOString()
      }
    };
  } catch (error: any) {
    try {
      handleFirestoreError(error, OperationType.GET, userPath);
    } catch {
      // Error logged by handler
    }

    const isPermissionError =
      error?.code === 'permission-denied' ||
      String(error?.message).includes('insufficient permissions') ||
      String(error?.message).includes('PERMISSION_DENIED');

    return {
      success: false,
      error: isPermissionError
        ? 'Permission denied: Please ensure the athlete has entered your Coach UID in their app settings and tapped Sync Now.'
        : error?.message || 'Failed to fetch athlete records.'
    };
  }
}

// -------------------------------------------------------------
// EXPORT UTILITIES (JSON & CSVs with dates and units)
// -------------------------------------------------------------

function downloadBlob(content: string, filename: string, mimeType: string) {
  // UTF-8 BOM on CSVs so Excel reads non-ASCII text correctly.
  const body = mimeType.startsWith('text/csv') ? '\uFEFF' + content : content;
  const blob = new Blob([body], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportStateToJson(appState: AppState, filename: string = 'transform_yourself_100_days_backup.json') {
  downloadBlob(serializeBackup(appState), filename, 'application/json');
}

const CSV_MIME = 'text/csv;charset=utf-8;';

export function exportDailyLogsToCsv(dailyLogs: { [day: number]: DailyLog }, filename: string = 'daily_logs.csv') {
  downloadBlob(dailyLogsToCsv(dailyLogs), filename, CSV_MIME);
}

export function exportWorkoutSetsToCsv(workoutLogs: WorkoutHistory, filename: string = 'workout_sets.csv') {
  downloadBlob(workoutSetsToCsv(workoutLogs), filename, CSV_MIME);
}

export function exportWeighInsToCsv(weighIns: WeighInRecord[], filename: string = 'weigh_ins.csv') {
  downloadBlob(weighInsToCsv(weighIns), filename, CSV_MIME);
}

export function exportMeasurementsToCsv(measurementHistory: MeasurementRecord[], filename: string = 'measurements.csv') {
  downloadBlob(measurementsToCsv(measurementHistory), filename, CSV_MIME);
}


/**
 * Realtime change notifications for the signed-in owner's own records (READ ONLY).
 * Listens to users/{uid}, users/{uid}/dailyLogs and users/{uid}/workoutLogs. Ignores each listener's first (attach)
 * snapshot and any snapshot that still has pending local writes (our own echo). Attaches only when signed in and
 * detaches itself on sign-out / account change. Errors go to onError (or the console), never thrown.
 */
export function subscribeToCloudChanges(onChange: () => void, onError?: (message: string) => void): () => void {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};
  const unsubs: Array<() => void> = [];
  let closed = false;
  const report = (e: any) => {
    const msg = String(e?.message || e || 'Live update listener failed');
    try { if (onError) onError(msg); else console.warn('[cloud listener]', msg); } catch { /* ignore */ }
  };
  const listen = (ref: any) => {
    let first = true;
    try {
      unsubs.push(onSnapshot(
        ref,
        (snap: any) => {
          if (closed) return;
          if (first) { first = false; return; }
          if (snap?.metadata?.hasPendingWrites) return;
          try { onChange(); } catch (e) { report(e); }
        },
        (e: any) => report(e)
      ));
    } catch (e) { report(e); }
  };
  listen(doc(db, 'users', uid));
  listen(collection(db, 'users', uid, 'dailyLogs'));
  listen(collection(db, 'users', uid, 'workoutLogs'));
  const teardown = () => {
    if (closed) return;
    closed = true;
    for (const u of unsubs) { try { u(); } catch { /* ignore */ } }
    try { stopAuth(); } catch { /* ignore */ }
  };
  const stopAuth = onAuthStateChanged(auth, (u) => { if (!u || u.uid !== uid) teardown(); });
  return teardown;
}
