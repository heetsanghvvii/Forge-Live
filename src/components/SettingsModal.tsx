import React, { useState, useRef, useEffect } from 'react';
import { AppState, AppSettings, PhaseType } from '../types';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  exportStateToJson,
  exportDailyLogsToCsv,
  exportWorkoutSetsToCsv,
  exportWeighInsToCsv,
  exportMeasurementsToCsv,
  syncOwnerStateToCloud,
  pullCloudIntoLocal,
  probeCloudData,
  resolveConflictsUseLocal,
  resolveConflictsUseCloud,
  commitBaseEntries,
  grantCoachAccessInCloud,
  listAuthorizedCoachUids,
  revokeAllCoachAccessInCloud,
  ensureGoogleSignIn
} from '../utils/cloudSync';
import { ReviewEntriesModal, listUnconfirmed } from './ReviewEntriesModal';
import { LegacyRepairModal } from './LegacyRepairModal';
import { preflightSaveReview, LegacyRepairPreview } from '../utils/legacyRepair';
import { guardedSync, guardedPull, evaluateLink, MISMATCH_MESSAGE } from '../utils/accountLink';
import { ABSENT_CLOUD_MESSAGE, readFailureMessage } from '../utils/cloudRead';
import { SignInPanel } from './SignInPanel';
import { PeopleDirectoryPanel } from './PeopleDirectoryPanel';
import { VIEWER_MODE_NOTICE } from '../utils/viewerMode';
import { VIEWER_BLOCKED_MESSAGE, CLOUD_FOUND_DETAIL } from '../utils/autoSyncController';
import { RestoreSession } from '../utils/restoreGuard';
import { restoreIsSafe, stateForRestore, BACKUP_LIMITS } from '../utils/backup';
import { analyzeBackup } from '../utils/backupRecovery';
import { pullMessage, summariseConflicts, dedupeConflicts } from '../utils/cloudMerge';
import type { ConflictDoc } from '../utils/cloudMerge';
import { nextConfirmedProgrammeStart, COACH_CONSENT_TEXT } from '../utils/settingsLogic';
import { REDIRECTING_MESSAGE } from '../utils/googleAuth';
import {
  X,
  Calendar,
  Download,
  Upload,
  AlertTriangle,
  Lock,
  Unlock,
  Shield,
  Cloud,
  CheckCircle2,
  RefreshCw,
  Heart,
  Copy,
  Check,
  LogIn,
  Zap
} from 'lucide-react';

interface SettingsModalProps {
  appState: AppState;
  onClose: () => void;
  onSaveSettings: (settings: AppSettings) => void;
  onImportState: (newState: AppState) => boolean | void;
  onUpdateAppState: (updater: (prev: AppState) => AppState) => void;
  onResetAllData: () => void;
  onCloudSyncSuccess?: () => void;
  /** Viewer mode (per browser). */
  viewerMode?: boolean;
  onToggleViewer?: (on: boolean) => void;
  /** Differences found by automatic saving / live refresh, to resolve here. */
  autoSyncConflicts?: ConflictDoc[];
  onConflictsHandled?: (opts?: { save?: boolean }) => void;
  /** Called BEFORE a state built from cloud data is applied, so it is not mistaken for a user edit (no auto-save). */
  onAppliedFromCloud?: (state: AppState) => void;
  /** Scroll to the cloud sync area on open. */
  focusSync?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  appState,
  onClose,
  onSaveSettings,
  onImportState,
  onUpdateAppState,
  onResetAllData,
  onCloudSyncSuccess,
  viewerMode = false,
  onToggleViewer,
  autoSyncConflicts = [],
  onConflictsHandled,
  onAppliedFromCloud,
  focusSync = false
}) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(auth.currentUser);
  const [authReady, setAuthReady] = useState<boolean>(Boolean(auth.currentUser));
  const [copiedUid, setCopiedUid] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const [activePhase, setActivePhase] = useState<PhaseType>(appState.settings.activePhase || 'phase1');
  const [phase3Unlocked, setPhase3Unlocked] = useState<boolean>(!!appState.settings.phase3Unlocked);
  const [startDate, setStartDate] = useState(appState.settings.startDate || '');
  const [timezone, setTimezone] = useState(appState.settings.timezone || 'Asia/Kolkata');

  // Health Profile Fields (empty string if undefined, no fake defaults)
  const [startingWeight, setStartingWeight] = useState<string | number>(
    appState.settings.startingWeightKg !== undefined ? appState.settings.startingWeightKg : ''
  );
  const [proposedGoal, setProposedGoal] = useState<string | number>(
    appState.settings.proposedGoalWeightKg !== undefined ? appState.settings.proposedGoalWeightKg : ''
  );
  const [currentWeight, setCurrentWeight] = useState<string | number>(
    appState.settings.bodyweightKg !== undefined ? appState.settings.bodyweightKg : ''
  );
  const [heightCm, setHeightCm] = useState<string | number>(
    appState.settings.heightCm !== undefined ? appState.settings.heightCm : ''
  );
  const [age, setAge] = useState<string | number>(
    appState.settings.age !== undefined ? appState.settings.age : ''
  );
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>(appState.settings.gender || '');
  const [trainingExperience, setTrainingExperience] = useState(appState.settings.trainingExperience || '');
  const [equipment, setEquipment] = useState(appState.settings.equipment || '');
  const [injuries, setInjuries] = useState(appState.settings.injuriesAndConstraints || '');
  const [dietaryExclusions, setDietaryExclusions] = useState(appState.settings.dietaryExclusions || '');

  // Daily Schedule
  const [wakeTime, setWakeTime] = useState(appState.settings.wakeTime || '');
  const [workTime, setWorkTime] = useState(appState.settings.workTime || '');
  const [gymTime, setGymTime] = useState(appState.settings.gymTime || '');

  // Fasting and Targets
  const [fastingStartHour, setFastingStartHour] = useState(appState.settings.fastingStartHour || 20);
  const [fastingEndHour, setFastingEndHour] = useState(appState.settings.fastingEndHour || 12);
  const [waterGoal, setWaterGoal] = useState(appState.settings.waterGoalMl || 3500);
  const [stepGoal, setStepGoal] = useState(appState.settings.stepGoal || 10000);

  // Coach Authorization
  // Source of truth is the cloud (listAuthorizedCoachUids); the stored setting is only a fallback when signed out.
  const [coachUidInput, setCoachUidInput] = useState('');
  const [cloudCoachUids, setCloudCoachUids] = useState<string[] | null>(null);
  const [coachListLoading, setCoachListLoading] = useState(false);
  const [dateTouched, setDateTouched] = useState(false);
  const isCoachAuthorized = cloudCoachUids ? cloudCoachUids.length > 0 : Boolean(appState.settings.authorizedCoachUid);
  const authorizedUidShown = (cloudCoachUids && cloudCoachUids[0]) || appState.settings.authorizedCoachUid || '';
  const [coachGrantLoading, setCoachGrantLoading] = useState(false);
  const [coachGrantError, setCoachGrantError] = useState<string | null>(null);

  // Cloud Sync
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  // Items that changed both on this device and in the cloud (from the last Save or Load). Never auto-resolved.
  const [conflictDocs, setConflictDocs] = useState<ConflictDoc[]>([]);
  useEffect(() => {
    if (autoSyncConflicts.length > 0) setConflictDocs((cur) => (cur.length ? cur : dedupeConflicts(autoSyncConflicts)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSyncConflicts.length]);
  useEffect(() => {
    if (focusSync) document.getElementById('sync-area')?.scrollIntoView({ block: 'start' });
  }, [focusSync]);
  // Read-only check (never writes, never loads): does the account already have cloud data while this device is setup-only?
  const [cloudHasData, setCloudHasData] = useState(false);
  const probeUid = !viewerMode && firebaseUser && evaluateLink(appState, firebaseUser.uid).kind === 'empty-device' ? firebaseUser.uid : null;
  useEffect(() => {
    setCloudHasData(false);
    if (!probeUid) return;
    let live = true;
    void probeCloudData(probeUid).then((r) => { if (live) setCloudHasData(r.status === 'has-data'); });
    return () => { live = false; };
  }, [probeUid]);
  const viewerBlock = (): boolean => {
    if (!viewerMode) return false;
    setSyncStatusMsg({ text: VIEWER_BLOCKED_MESSAGE, isError: true });
    return true;
  };
  const appStateRef = useRef(appState);
  appStateRef.current = appState;

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const resetBoxRef = useRef<HTMLDivElement | null>(null);
  // When the confirmation appears it must be fully visible (it opens below the fold on short phones).
  useEffect(() => {
    if (showResetConfirm) resetBoxRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [showResetConfirm]);
  const [showReview, setShowReview] = useState(false);
  const [repairPreview, setRepairPreview] = useState<LegacyRepairPreview | null>(null);
  const unconfirmedCount = listUnconfirmed(appState.dailyLogs).length;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const setStoredCoachUid = (uid: string | undefined) =>
    onUpdateAppState((prev) => ({ ...prev, settings: { ...prev.settings, authorizedCoachUid: uid } }));

  const refreshCoachList = async () => {
    setCoachListLoading(true);
    setCoachGrantError(null);
    try {
      const uids = await listAuthorizedCoachUids();
      setCloudCoachUids(uids);
      setStoredCoachUid(uids[0]);
    } catch (e: any) {
      setCloudCoachUids(null);
      setCoachGrantError(`Could not check coach access in the cloud: ${e?.message || 'unknown error'}`);
    } finally {
      setCoachListLoading(false);
    }
  };

  useEffect(() => {
    if (firebaseUser) void refreshCoachList();
    else setCloudCoachUids(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser?.uid]);

  const handleCopyOwnerUid = () => {
    if (firebaseUser?.uid) {
      navigator.clipboard.writeText(firebaseUser.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setSyncStatusMsg(null);
      const user = await ensureGoogleSignIn();
      setFirebaseUser(user);
      setSyncStatusMsg({ text: `Signed in as ${user.email || user.displayName || 'Google user'}` });
    } catch (err: any) {
      const redirecting = err?.message === REDIRECTING_MESSAGE;
      setSyncStatusMsg({ text: err.message || 'Google sign-in cancelled or failed.', isError: !redirecting });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setSyncStatusMsg({ text: 'Signed out. The records on this device were kept and are still linked to your account.' });
    } catch (e: any) {
      setSyncStatusMsg({ text: e?.message || 'Could not sign out. Try again.', isError: true });
    }
  };

  const handleLoadFromCloud = async () => {
    setSyncingCloud(true);
    setSyncStatusMsg(null);
    setConflictDocs([]);
    try {
      const snapshot = appState;
      const res = await guardedPull(snapshot);
      if (res.success && res.merged) {
        // Decisions were made against `snapshot`; if the user edited meanwhile, apply nothing rather than risk losing that edit.
        if (appStateRef.current !== snapshot) {
          setSyncStatusMsg({ text: 'Your data changed while loading from the cloud, so nothing was applied. Please try again.', isError: true });
          return;
        }
        const pulled = res.merged;
        const build = (prev: AppState): AppState => ({
          ...pulled,
          settings: { ...pulled.settings, linkedFirebaseUid: pulled.settings.linkedFirebaseUid ?? prev.settings.linkedFirebaseUid, lastSyncTimestamp: new Date().toISOString() }
        });
        onAppliedFromCloud?.(build(snapshot)); // already in sync with the cloud: a baseline, not an edit
        onUpdateAppState(build);
        if (res.userId && res.baseEntries) commitBaseEntries(res.userId, res.baseEntries);
        setConflictDocs(dedupeConflicts(res.conflictDocs ?? []));
        setSyncStatusMsg({ text: pullMessage(res), isError: (res.conflictDocs ?? []).length > 0 });
      } else if (res.reason === 'absent') {
        // The read worked and the account simply has no cloud record: keep the local setup, nothing is written.
        setSyncStatusMsg({ text: ABSENT_CLOUD_MESSAGE });
      } else if (res.reason === 'error') {
        // The read FAILED (permission, network, unavailable): never treated as an empty account.
        setSyncStatusMsg({ text: readFailureMessage(res.error), isError: true });
      } else {
        setSyncStatusMsg({ text: res.error || 'Could not load from cloud. Nothing was changed.', isError: true });
      }
    } catch (e: any) {
      setSyncStatusMsg({ text: readFailureMessage(e?.message), isError: true });
    } finally {
      setSyncingCloud(false);
    }
  };

  const resolveGuard = (): string | null => {
    const link = evaluateLink(appState, auth.currentUser?.uid);
    if (link.kind === 'signed-out') return 'Sign in first.';
    if (link.kind === 'mismatch') return MISMATCH_MESSAGE;
    return null;
  };

  const handleUseDeviceValues = async () => {
    if (viewerBlock()) return;
    const docs = conflictDocs;
    if (!docs.length) return;
    const bad = resolveGuard();
    if (bad) { setSyncStatusMsg({ text: bad, isError: true }); return; }
    if (!window.confirm(`Overwrite the cloud with this device's values for ${docs.length} item(s)? The cloud versions of those ${docs.length} item(s) will be replaced. Everything else stays as it is.`)) return;
    setSyncingCloud(true);
    try {
      const res = await resolveConflictsUseLocal(appState, docs);
      if (res.success) {
        setConflictDocs([]);
        onConflictsHandled?.();
        if (res.timestamp) onUpdateAppState((prev) => ({ ...prev, settings: { ...prev.settings, lastSyncTimestamp: res.timestamp } }));
        setSyncStatusMsg({ text: `Saved this device's values for ${docs.length} item(s) to the cloud and verified them.` });
      } else {
        setSyncStatusMsg({ text: `Not fully saved: ${res.error || 'unknown problem'}. Nothing else was changed.`, isError: true });
      }
    } catch (e: any) {
      setSyncStatusMsg({ text: e?.message || 'Could not save to the cloud.', isError: true });
    } finally {
      setSyncingCloud(false);
    }
  };

  const handleUseCloudValues = async () => {
    if (viewerBlock()) return;
    const docs = conflictDocs;
    if (!docs.length) return;
    const bad = resolveGuard();
    if (bad) { setSyncStatusMsg({ text: bad, isError: true }); return; }
    if (!window.confirm(`Replace this device's values with the cloud versions for ${docs.length} item(s)? Your values for those ${docs.length} item(s) will be lost on this device.`)) return;
    if (window.confirm('Download a backup file of this device first? (OK = download a backup, Cancel = skip)')) {
      exportStateToJson(appState);
    }
    setSyncingCloud(true);
    try {
      const snapshot = appState;
      const res = await resolveConflictsUseCloud(snapshot, docs);
      if (res.success && res.merged) {
        if (appStateRef.current !== snapshot) {
          setSyncStatusMsg({ text: 'Your data changed meanwhile, so nothing was applied. Please try again.', isError: true });
          return;
        }
        const merged = res.merged;
        const applied: AppState = { ...merged, settings: { ...merged.settings, lastSyncTimestamp: new Date().toISOString() } };
        onAppliedFromCloud?.(applied);
        onUpdateAppState(() => applied);
        if (res.userId && res.baseEntries) commitBaseEntries(res.userId, res.baseEntries);
        setConflictDocs([]);
        onConflictsHandled?.({ save: false }); // cloud values were just applied here: nothing to re-save
        setSyncStatusMsg({ text: `Replaced ${docs.length} item(s) on this device with the cloud versions.` });
      } else {
        setSyncStatusMsg({ text: res.error || 'Could not load the cloud versions. Nothing was changed.', isError: true });
      }
    } catch (e: any) {
      setSyncStatusMsg({ text: e?.message || 'Could not load the cloud versions. Nothing was changed.', isError: true });
    } finally {
      setSyncingCloud(false);
    }
  };

  const handleSave = () => {
    if (viewerBlock()) return;
    onSaveSettings({
      ...appState.settings,
      activePhase,
      phase3Unlocked,
      startDate: startDate || undefined,
      timezone,
      startingWeightKg: startingWeight !== '' ? Number(startingWeight) : undefined,
      proposedGoalWeightKg: proposedGoal !== '' ? Number(proposedGoal) : undefined,
      bodyweightKg: currentWeight !== '' ? Number(currentWeight) : (startingWeight !== '' ? Number(startingWeight) : undefined),
      heightCm: heightCm !== '' ? Number(heightCm) : undefined,
      age: age !== '' ? Number(age) : undefined,
      gender: gender || undefined,
      trainingExperience: trainingExperience || undefined,
      equipment: equipment || undefined,
      injuriesAndConstraints: injuries.trim(),
      dietaryExclusions: dietaryExclusions.trim(),
      wakeTime,
      workTime,
      gymTime,
      fastingStartHour: Number(fastingStartHour),
      fastingEndHour: Number(fastingEndHour),
      waterGoalMl: Number(waterGoal) || (activePhase === 'phase3' ? 4000 : 3500),
      stepGoal: Number(stepGoal) || 10000,
      // authorizedCoachUid is deliberately left as stored: grants change only via Authorize / Revoke.
      authorizedCoachUid: appState.settings.authorizedCoachUid,
      confirmedProgrammeStart: nextConfirmedProgrammeStart(appState.settings.confirmedProgrammeStart, dateTouched, startDate)
    });
    onClose();
  };

  const handleAuthorizeCoach = async () => {
    if (viewerMode) { setCoachGrantError(VIEWER_BLOCKED_MESSAGE); return; }
    const coachUid = coachUidInput.trim();
    if (isCoachAuthorized) {
      setCoachGrantError('A coach is already authorized. Revoke access first to authorize someone else.');
      return;
    }
    if (!coachUid) {
      setCoachGrantError('Please enter your coach Firebase UID.');
      return;
    }
    setCoachGrantLoading(true);
    setCoachGrantError(null);
    try {
      const res = await grantCoachAccessInCloud(coachUid);
      if (res.success) {
        setCoachUidInput('');
        setCloudCoachUids([coachUid]);
        setStoredCoachUid(coachUid);
        setSyncStatusMsg({ text: `Coach ${coachUid.slice(0, 8)}... authorized with read-only access in Firestore.` });
      } else {
        setCoachGrantError(res.error || 'Failed to grant coach access.');
      }
    } catch (e: any) {
      setCoachGrantError(e?.message || 'Error communicating with Firestore.');
    } finally {
      setCoachGrantLoading(false);
    }
  };

  const handleRevokeCoach = async () => {
    if (viewerMode) { setCoachGrantError(VIEWER_BLOCKED_MESSAGE); return; }
    setCoachGrantLoading(true);
    setCoachGrantError(null);
    try {
      const res = await revokeAllCoachAccessInCloud();
      if (res.success) {
        setCloudCoachUids([]);
        setStoredCoachUid(undefined);
        setSyncStatusMsg({ text: 'Coach access has been revoked from Firestore.' });
      } else {
        setCoachGrantError(res.error || 'Failed to revoke coach access. Access may still be active.');
      }
    } catch (e: any) {
      setCoachGrantError(e?.message || 'Error revoking coach access in Firestore. Access may still be active.');
    } finally {
      setCoachGrantLoading(false);
    }
  };

  const handleManualCloudSync = async () => {
    if (viewerBlock()) return;
    // Older local records (legacy states) are reviewed with the owner BEFORE any save:
    // nothing is repaired silently, ambiguous values are never auto-discarded, and the
    // collision guard in planDailyWrites stays the final backstop.
    const review = preflightSaveReview(appState);
    if (review) {
      setRepairPreview(review);
      return;
    }
    setSyncingCloud(true);
    setSyncStatusMsg(null);
    try {
      const res = await guardedSync(appState, (label) =>
        window.confirm(`Link the records on this device to ${label}? They will be saved to that cloud account.`)
      );
      if (res.success && (res.linkedUid || res.timestamp)) {
        onUpdateAppState((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            linkedFirebaseUid: res.linkedUid ?? prev.settings.linkedFirebaseUid,
            lastSyncTimestamp: res.timestamp ?? prev.settings.lastSyncTimestamp
          }
        }));
      }
      setConflictDocs(dedupeConflicts(res.conflictDocs ?? []));
      if (res.cancelled) {
        setSyncStatusMsg({ text: res.error || 'Cancelled.' });
      } else if (res.success) {
        if (res.conflictDocs && res.conflictDocs.length > 0) {
          setSyncStatusMsg({ text: res.message || `${res.conflictDocs.length} item(s) differ between this device and the cloud; nothing was overwritten.`, isError: true });
        } else {
          setSyncStatusMsg({ text: `Cloud sync successful and verified (${res.count ?? 0} records read back from the cloud).` });
          if (onCloudSyncSuccess) onCloudSyncSuccess();
        }
      } else {
        setSyncStatusMsg({ text: `Sync note: ${res.error || 'Check network connection or sign in.'}`, isError: true });
      }
    } catch (e: any) {
      setSyncStatusMsg({ text: e?.message || 'Could not complete sync. Working locally.', isError: true });
    } finally {
      setSyncingCloud(false);
    }
  };

  // Closing Settings must cancel a restore that is still being read: abort the reader and ignore its callback.
  const restoreSessionRef = useRef<RestoreSession>(new RestoreSession());
  useEffect(() => {
    const session = restoreSessionRef.current;
    return () => session.cancel();
  }, []);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    if (viewerMode) { input.value = ''; setSyncStatusMsg({ text: VIEWER_BLOCKED_MESSAGE, isError: true }); return; }
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > BACKUP_LIMITS.maxTextChars) {
      input.value = '';
      alert(`Invalid backup file:\nFile is too large (${(file.size / 1_000_000).toFixed(1)} MB). Backups over ${BACKUP_LIMITS.maxTextChars / 1_000_000} MB are rejected.`);
      return;
    }
    const session = restoreSessionRef.current;
    const reader = new FileReader();
    session.begin(reader);
    // Allow picking the same file again after an error or a cancelled warning.
    reader.onloadend = () => { input.value = ''; session.finish(reader); };
    reader.onload = (event) => {
      if (!session.isCurrent(reader)) return; // closed or replaced: do nothing
      const analysis = analyzeBackup(String(event.target?.result ?? ''));
      if (analysis.kind === 'unrecoverable') {
        alert('Invalid backup file:\n' + analysis.reasons.join('\n'));
        return;
      }
      const incoming = analysis.kind === 'valid' ? analysis.result.state : analysis.state;
      const migratedCount = analysis.kind === 'valid' ? (analysis.result.migrated?.length ?? 0) : analysis.migrated.length;
      const check = restoreIsSafe(appState, incoming);
      const notes = [...check.warnings];
      if (migratedCount > 0) notes.push(`${migratedCount} value(s) were converted from text to numbers.`);
      if (analysis.kind === 'recoverable') {
        // Older-format backup: the ONLY problems are record dates. Nothing is rewritten during
        // import - the original values are kept exactly, and the owner reviews them before any
        // cloud save through the same repair review as a legacy device state.
        const shown = analysis.issues.slice(0, 5);
        const more = analysis.issues.length > shown.length ? `\n...and ${analysis.issues.length - shown.length} more` : '';
        notes.unshift(
          `This backup has ${analysis.issues.length} older-format record date problem(s):\n${shown.join('\n')}${more}\n\nNothing is fixed or changed during the import. Your records are kept exactly as they are, and you will review them before your next cloud save.`
        );
      }
      if (notes.length > 0 && !window.confirm(notes.join('\n') + '\n\nRestore anyway?')) return;
      if (!session.isCurrent(reader)) return;
      const restored = stateForRestore(appState, incoming);
      if (onImportState(restored) === false) return; // failed: keep Settings open, nothing changed
      if (analysis.kind === 'recoverable') {
        // Open the owner review immediately; "Decide later" keeps the save gate in force.
        // Keep Settings open underneath: the review modal renders inside this dialog.
        const review = analysis.review ?? preflightSaveReview(restored);
        if (review) { setRepairPreview(review); return; }
      }
      onClose();
    };
    reader.onerror = () => { if (session.isCurrent(reader)) alert('Could not read that file.'); };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-xl bg-[#14181D] border border-[#222933] rounded-3xl p-4 sm:p-7 shadow-2xl flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#222933] mb-4 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white tracking-tight">App Settings & Cloud Sharing</h2>
            <p className="text-xs text-slate-400">Manage private profile, programme dates, Firebase sync, and coach access</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="shrink-0 w-10 h-10 rounded-xl bg-[#0B0D10] border border-[#222933] flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1 no-scrollbar text-xs">
          {/* Viewer mode (this browser only) */}
          <div className="p-4 rounded-2xl bg-[#0B0D10] border border-purple-500/30 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold text-white">Viewer mode (this browser only)</span>
              <button
                type="button"
                role="switch"
                aria-checked={viewerMode}
                aria-label="Viewer mode"
                onClick={() => onToggleViewer?.(!viewerMode)}
                className={`min-h-[36px] min-w-[56px] px-3 rounded-full border text-[11px] font-extrabold active:scale-95 ${viewerMode ? 'bg-purple-500 text-black border-purple-300' : 'bg-[#14181D] text-slate-300 border-[#222933]'}`}
              >
                {viewerMode ? 'ON' : 'OFF'}
              </button>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">{VIEWER_MODE_NOTICE}</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Sharing a login does not technically restrict permissions: anyone signed in to this account can still change data from any device. Viewer mode only helps avoid accidents here. Bookmark this app with <span className="font-mono">?viewer=1</span> at the end of the address to start a browser in Viewer mode.
            </p>
            {viewerMode && <p className="text-[11px] text-purple-200">Auto-save, saving to the cloud, coach access changes, reset and restore are off in Viewer mode. This screen still refreshes from the cloud.</p>}
          </div>

          {/* Firebase Authentication & Cloud Sync */}
          <div id="sync-area" className="p-4 rounded-2xl bg-[#0B0D10] border border-sky-500/30 space-y-3">
            {cloudHasData && (
              <p className="text-[11px] text-sky-200 p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30">{CLOUD_FOUND_DETAIL}</p>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sky-400">
                <Cloud className="w-4 h-4" />
                <span className="font-bold text-white">Firebase Cloud Account</span>
              </div>
              <button
                type="button"
                onClick={handleManualCloudSync}
                disabled={syncingCloud || viewerMode}
                className="min-h-[36px] px-3 rounded-lg bg-[#14181D] border border-[#222933] text-slate-300 hover:text-white flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingCloud ? 'animate-spin text-[#B6FF3B]' : ''}`} />
                <span>Save to cloud</span>
              </button>
              <button
                type="button"
                onClick={handleLoadFromCloud}
                disabled={syncingCloud}
                className={`${cloudHasData ? 'min-h-[36px] px-3 rounded-lg bg-[#B6FF3B] border border-[#B6FF3B] text-black font-extrabold flex items-center gap-1.5 active:scale-95 disabled:opacity-40' : 'min-h-[36px] px-3 rounded-lg bg-[#14181D] border border-[#222933] text-slate-300 hover:text-white flex items-center gap-1.5 active:scale-95 disabled:opacity-40'}`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Load from cloud</span>
              </button>
            </div>

            {firebaseUser ? (
              <div className="space-y-2 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-[#14181D] border border-[#222933]">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Your Firebase Owner UID</span>
                    <span className="font-mono text-xs text-[#B6FF3B] break-all select-all font-semibold">
                      {firebaseUser.uid}
                    </span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      Signed in as: {firebaseUser.email || firebaseUser.displayName || 'Google Account'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyOwnerUid}
                    className="min-h-[36px] px-3 rounded-lg bg-[#0B0D10] border border-[#222933] text-slate-200 hover:text-white flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center active:scale-95 transition-colors"
                  >
                    {copiedUid ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#B6FF3B]" />
                        <span className="text-[11px] text-[#B6FF3B] font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] font-semibold">Copy UID</span>
                      </>
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="h-9 px-4 rounded-xl bg-[#14181D] border border-[#222933] text-slate-200 hover:text-white font-semibold text-xs active:scale-95 transition-colors"
                >
                  Sign out
                </button>
                <p className="text-[10px] text-slate-400">
                  Share this Owner UID with your coach so they can inspect your records once you authorize their Coach UID below.
                </p>
              </div>
            ) : !authReady ? (
              <p className="text-[11px] text-slate-400 pt-1" role="status">Checking sign-in…</p>
            ) : (
              <div className="space-y-2 pt-1">
                <SignInPanel
                  onSignedIn={(label) => setSyncStatusMsg({ text: `Signed in as ${label}` })}
                  onError={(m) => setSyncStatusMsg({ text: m, isError: m !== REDIRECTING_MESSAGE })}
                />
              </div>
            )}

            {syncStatusMsg && (
              <p
                className={`text-[11px] p-2 rounded-lg ${
                  syncStatusMsg.isError
                    ? 'text-rose-300 bg-rose-500/10 border border-rose-500/20'
                    : 'text-[#B6FF3B] bg-[#B6FF3B]/10 border border-[#B6FF3B]/20'
                }`}
              >
                {syncStatusMsg.text}
              </p>
            )}

            {conflictDocs.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2" role="group" aria-label="Differences between this device and the cloud">
                <p className="text-[11px] text-amber-200 font-semibold">
                  {conflictDocs.length} item(s) were changed both on this device and in the cloud. Nothing is overwritten until you choose.
                </p>
                <ul className="text-[11px] text-slate-300 list-disc pl-4 space-y-0.5">
                  {conflictDocs.slice(0, 5).map((c) => (
                    <li key={`${c.kind}:${c.id}`}>{c.label}</li>
                  ))}
                  {conflictDocs.length > 5 && <li>+{conflictDocs.length - 5} more</li>}
                </ul>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    disabled={syncingCloud || viewerMode}
                    onClick={handleUseDeviceValues}
                    className="h-9 px-3 rounded-xl bg-[#14181D] border border-amber-500/40 text-amber-100 font-semibold text-xs active:scale-95 disabled:opacity-50"
                  >
                    Use this device's values for these days
                  </button>
                  <button
                    type="button"
                    disabled={syncingCloud || viewerMode}
                    onClick={handleUseCloudValues}
                    className="h-9 px-3 rounded-xl bg-[#14181D] border border-amber-500/40 text-amber-100 font-semibold text-xs active:scale-95 disabled:opacity-50"
                  >
                    Use cloud values for these days
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Coach Authorization Section */}
          <div className="p-4 rounded-2xl bg-[#0B0D10] border border-purple-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-400">
                <Shield className="w-4 h-4" />
                <span className="font-bold text-white">Read-Only Coach Access</span>
              </div>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                  isCoachAuthorized ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isCoachAuthorized ? 'Coach Authorized' : 'Private Only'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              {COACH_CONSENT_TEXT} Permissions are enforced by Firestore security rules.
            </p>

            <div className="space-y-2">
              {isCoachAuthorized ? (
                <>
                  <label className="block text-[11px] font-semibold text-slate-300">Authorized coach UID</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={authorizedUidShown || '(coach UID not available)'}
                      className="flex-1 min-w-0 basis-40 h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-slate-300 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleRevokeCoach}
                      disabled={coachGrantLoading || viewerMode}
                      className="shrink-0 min-h-[40px] px-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-extrabold text-xs uppercase tracking-wider hover:bg-rose-500/20 active:scale-95 disabled:opacity-40"
                    >
                      {coachGrantLoading ? 'Revoking...' : 'Revoke access'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">To authorize a different coach, revoke access first.</p>
                </>
              ) : (
                <>
                  <label className="block text-[11px] font-semibold text-slate-300">Coach Firebase UID</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      placeholder="Paste Coach UID provided by your coach..."
                      value={coachUidInput}
                      onChange={(e) => setCoachUidInput(e.target.value)}
                      className="flex-1 min-w-0 basis-40 h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-white font-mono text-xs focus:outline-none focus:border-purple-400"
                    />
                    <button
                      type="button"
                      onClick={handleAuthorizeCoach}
                      disabled={coachGrantLoading || coachListLoading || viewerMode}
                      className="shrink-0 min-h-[40px] px-3.5 rounded-xl bg-purple-500 text-black font-extrabold text-xs uppercase tracking-wider hover:bg-purple-400 active:scale-95 disabled:opacity-40"
                    >
                      {coachGrantLoading ? 'Saving...' : 'Authorize'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Authorizing lets this coach read: your coach summary, your daily logs including notes, and your workout logs.
                  </p>
                </>
              )}
              {coachListLoading && <p className="text-[10px] text-slate-500">Checking coach access in the cloud...</p>}

              {coachGrantError && (
                <p className="text-[11px] text-rose-300 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                  {coachGrantError}
                </p>
              )}
            </div>
          </div>

          {import.meta.env?.VITE_USE_EMULATOR === 'true' && (
            <PeopleDirectoryPanel viewerMode={viewerMode} />
          )}

          {/* Phase Selection & Unlock */}
          <div className="p-4 rounded-2xl bg-[#0B0D10] border border-[#222933] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#B6FF3B]">
                <Zap className="w-4 h-4" />
                <span className="font-bold text-slate-200">Active Programme Phase</span>
              </div>
              <button
                type="button"
                onClick={() => setPhase3Unlocked(!phase3Unlocked)}
                className="min-h-[36px] text-[11px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                {phase3Unlocked ? (
                  <>
                    <Unlock className="w-3 h-3 text-[#B6FF3B]" />
                    <span>Phase 3 Unlocked</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3" />
                    <span>Unlock Phase 3 Manually</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setActivePhase('phase1')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  activePhase === 'phase1'
                    ? 'bg-[#14181D] border-[#B6FF3B] text-white'
                    : 'bg-[#14181D]/40 border-[#222933] text-slate-400'
                }`}
              >
                <span className="block text-xs font-extrabold text-white">Phase 1</span>
                <span className="block text-[10px] text-slate-400">Foundation (Days 1 to 7)</span>
                <span className="block text-[10px] text-[#B6FF3B] font-mono mt-1">Clean detox</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePhase('phase2')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  activePhase === 'phase2'
                    ? 'bg-[#14181D] border-[#B6FF3B] text-white'
                    : 'bg-[#14181D]/40 border-[#222933] text-slate-400'
                }`}
              >
                <span className="block text-xs font-extrabold text-white">Phase 2</span>
                <span className="block text-[10px] text-slate-400">Base (Days 8 to 35)</span>
                <span className="block text-[10px] text-[#B6FF3B] font-mono mt-1">-500 kcal</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPhase3Unlocked(true);
                  setActivePhase('phase3');
                }}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  activePhase === 'phase3'
                    ? 'bg-[#14181D] border-[#B6FF3B] text-white'
                    : 'bg-[#14181D]/40 border-[#222933] text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-white">Phase 3</span>
                  {!phase3Unlocked && <Lock className="w-3 h-3 text-slate-500" />}
                </div>
                <span className="block text-[10px] text-slate-400">Muscle (Days 36 to 63)</span>
                <span className="block text-[10px] text-amber-400 font-mono mt-1">-300 kcal</span>
              </button>
            </div>
          </div>

          {/* Programme Dates & Timezone */}
          <div className="p-4 rounded-2xl bg-[#0B0D10] border border-[#222933] space-y-3">
            <div className="flex items-center gap-2 text-[#B6FF3B]">
              <Calendar className="w-4 h-4" />
              <span className="font-bold text-slate-200">Programme Calendar & Timezone</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Programme Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setDateTouched(true); }}
                  className="w-full h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-white font-mono focus:outline-none focus:border-[#B6FF3B]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Timezone (Default Asia/Kolkata)
                </label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="Asia/Kolkata"
                  className="w-full h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-white font-mono focus:outline-none focus:border-[#B6FF3B]"
                />
              </div>
            </div>
          </div>

          {/* Private Health Profile & Weight Targets */}
          <div className="p-4 rounded-2xl bg-[#0B0D10] border border-[#222933] space-y-3">
            <div className="flex items-center gap-2 text-[#B6FF3B]">
              <Heart className="w-4 h-4" />
              <span className="font-bold text-slate-200">Private Health & Physique Parameters</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Starting Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="Optional"
                  value={startingWeight}
                  onChange={(e) => setStartingWeight(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-white font-mono focus:outline-none focus:border-[#B6FF3B]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Proposed Goal (kg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="Optional"
                  value={proposedGoal}
                  onChange={(e) => setProposedGoal(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-[#B6FF3B] font-mono focus:outline-none focus:border-[#B6FF3B]"
                />
                <span className="text-[9px] text-slate-400 block mt-0.5">Proposed target, not medical</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Current Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="Optional"
                  value={currentWeight}
                  onChange={(e) => setCurrentWeight(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-white font-mono focus:outline-none focus:border-[#B6FF3B]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-white font-mono focus:outline-none focus:border-[#B6FF3B]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Age (Optional)
                </label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-white font-mono focus:outline-none focus:border-[#B6FF3B]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Training Experience
                </label>
                <input
                  type="text"
                  value={trainingExperience}
                  onChange={(e) => setTrainingExperience(e.target.value)}
                  placeholder="e.g. Beginner, Intermediate"
                  className="w-full h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-white focus:outline-none focus:border-[#B6FF3B]"
                />
              </div>
            </div>

            {/* Equipment & Constraints */}
            <div className="space-y-2 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Equipment Access</label>
                <input
                  type="text"
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  placeholder="e.g. Gym, Dumbbells only, Bodyweight"
                  className="w-full h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-white focus:outline-none focus:border-[#B6FF3B]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Dietary Exclusions
                </label>
                <input
                  type="text"
                  value={dietaryExclusions}
                  onChange={(e) => setDietaryExclusions(e.target.value)}
                  placeholder="e.g. Vegetarian, no eggs, no onion, no garlic"
                  className="w-full h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-white focus:outline-none focus:border-[#B6FF3B]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Injuries & Constraints (Private)
                </label>
                <input
                  type="text"
                  value={injuries}
                  onChange={(e) => setInjuries(e.target.value)}
                  placeholder="Optional physical constraints"
                  className="w-full h-10 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-white focus:outline-none focus:border-[#B6FF3B]"
                />
              </div>
            </div>

            {/* Daily Schedule Times */}
            <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 pt-1">
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Wake Time</label>
                <input
                  type="text"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  placeholder="e.g. 06:30"
                  className="w-full h-9 px-2 rounded-lg bg-[#14181D] border border-[#222933] text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Work Hours</label>
                <input
                  type="text"
                  value={workTime}
                  onChange={(e) => setWorkTime(e.target.value)}
                  placeholder="e.g. 09:30 to 18:30"
                  className="w-full h-9 px-2 rounded-lg bg-[#14181D] border border-[#222933] text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Gym Time</label>
                <input
                  type="text"
                  value={gymTime}
                  onChange={(e) => setGymTime(e.target.value)}
                  placeholder="e.g. 19:00"
                  className="w-full h-9 px-2 rounded-lg bg-[#14181D] border border-[#222933] text-white font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Review unconfirmed entries */}
          <div className="p-4 rounded-2xl bg-[#0B0D10] border border-[#222933] space-y-2">
            <span className="block font-semibold text-slate-200">Review old entries</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Confirm which saved numbers you really entered.
            </p>
            <button
              type="button"
              onClick={() => setShowReview(true)}
              className="w-full min-h-[40px] px-3 rounded-xl bg-[#14181D] border border-[#B6FF3B]/40 text-[#B6FF3B] font-bold text-xs active:scale-95"
            >
              Review entries ({unconfirmedCount} to check)
            </button>
          </div>
          {showReview && (
            <ReviewEntriesModal
              appState={appState}
              onClose={() => setShowReview(false)}
              onUpdateAppState={onUpdateAppState}
            />
          )}

          {repairPreview && (
            <LegacyRepairModal
              appState={appState}
              preview={repairPreview}
              onClose={() => setRepairPreview(null)}
              onUpdateAppState={onUpdateAppState}
              onRepaired={() => {
                setRepairPreview(null);
                // Records reviewed/repaired by the owner: attempt the save again.
                void handleManualCloudSync();
              }}
            />
          )}

          {/* Backup & CSV Exports */}
          <div className="p-4 rounded-2xl bg-[#0B0D10] border border-[#222933] space-y-3">
            <span className="block font-semibold text-slate-200">Export & Backup Records</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => exportStateToJson(appState)}
                className="h-9 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-slate-200 hover:text-white flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-[#B6FF3B]" />
                <span>JSON Backup</span>
              </button>

              <button
                type="button"
                onClick={() => exportDailyLogsToCsv(appState.dailyLogs)}
                className="h-9 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-slate-200 hover:text-white flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Daily Logs CSV</span>
              </button>

              <button
                type="button"
                onClick={() => exportWorkoutSetsToCsv(appState.workoutLogs)}
                className="h-9 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-slate-200 hover:text-white flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-purple-400" />
                <span>Workouts CSV</span>
              </button>

              <button
                type="button"
                onClick={() => exportWeighInsToCsv(appState.weighIns)}
                className="h-9 px-3 rounded-xl bg-[#14181D] border border-[#222933] text-slate-200 hover:text-white flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Weigh-ins CSV</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => exportMeasurementsToCsv(appState.measurementHistory)}
                className="min-h-[36px] px-3 rounded-lg bg-[#14181D] border border-[#222933] text-slate-300 hover:text-white text-[11px] flex items-center gap-1.5 active:scale-95"
              >
                <Download className="w-3 h-3 text-emerald-400" />
                <span>Measurements CSV</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={viewerMode}
                className="disabled:opacity-40 min-h-[36px] px-3 rounded-lg bg-[#14181D] border border-[#222933] text-slate-300 hover:text-white text-[11px] flex items-center gap-1.5 active:scale-95"
              >
                <Upload className="w-3 h-3 text-sky-400" />
                <span>Restore JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportFile}
              />
            </div>
          </div>

          {/* Reset All Data */}
          <div ref={resetBoxRef} className="p-4 rounded-2xl bg-red-950/20 border border-red-900/30">
            {!showResetConfirm ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="block font-semibold text-red-400">Reset Local Data</span>
                  <p className="text-[11px] text-red-300/70">Wipes local records back to clean initial state.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={viewerMode}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg border border-red-500/30 disabled:opacity-40 text-xs font-semibold text-red-400 hover:bg-red-500/10 active:scale-95 transition-colors"
                >
                  Reset
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="font-bold">Are you sure? This resets local records.</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onResetAllData();
                      setShowResetConfirm(false);
                      onClose();
                    }}
                    className="flex-1 min-h-[36px] rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 active:scale-95 transition-colors"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="px-3 min-h-[36px] rounded-lg border border-slate-700 text-slate-300 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-3 sm:mt-5 pt-3 sm:pt-4 border-t border-[#222933] flex flex-wrap items-center justify-between gap-x-3 gap-y-2 shrink-0">
          <span className="text-[10px] text-slate-500 font-mono" data-testid="build-label">
            Version {typeof __BUILD_LABEL__ === 'string' ? __BUILD_LABEL__ : 'dev'}
          </span>
          <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={viewerMode}
            title={viewerMode ? VIEWER_BLOCKED_MESSAGE : undefined}
            className="disabled:opacity-40 h-10 px-6 rounded-xl bg-[#B6FF3B] text-black font-extrabold text-xs uppercase tracking-wider hover:bg-[#a6ec31] shadow-lg shadow-[#B6FF3B]/10 active:scale-95 transition-all"
          >
            Save Settings
          </button>
          </div>
        </div>
      </div>
    </div>
  );
};
