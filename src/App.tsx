import React, { useState, useEffect } from 'react';
import { HabitReminderRunner } from './components/HabitReminderRunner';
import {
  TabType,
  PhaseType,
  AppState,
  AppSettings,
  Macros,
  BodyMeasurements,
  ToastMessage,
  DailyChecklist,
  DailyLog,
  UserAccount
} from './types';
import {
  loadAppState,
  saveAppState,
  setSaveFailureHandler,
  STORAGE_KEY,
  calculateStreak,
  calculateDateForDayNumber,
  getInitialState,
  getActiveAccount,
  logoutActiveUser
} from './utils/storage';
import { guardedSync } from './utils/accountLink';
import { commitState } from './utils/restoreGuard';
import { completeRedirectSignIn } from './utils/googleAuth';
import { TopBar, BottomTabBar } from './components/Navbar';
import { ToastContainer } from './components/Toast';
import { OnboardingModal } from './components/OnboardingModal';
import { SettingsModal } from './components/SettingsModal';
import { markEntered } from './utils/entered';
import { changedMacroMetrics } from './utils/settingsLogic';
import { padDailyLogs } from './utils/backup';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { TodayView } from './views/TodayView';
import { HomeView } from './views/HomeView';
import { HomePath, HomeVessel } from './views/HomeVariants';
import { TrainView } from './views/TrainView';
import { EatView } from './views/EatView';
import { ProgressView } from './views/ProgressView';
import { LearnView } from './views/LearnView';
import { CoachView } from './views/CoachView';
import { SignInModal } from './components/SignInPanel';
import { useAutoSync, initialViewerMode } from './hooks/useAutoSync';
import { auth } from './lib/firebase';
import { useFirebaseUser } from './hooks/useFirebaseUser';
import { deriveHeaderIdentity, profileTarget } from './utils/headerIdentity';
import { localYmd, upsertByDate } from './utils/localDate';
import { displayState, switchPlan, phaseStartDay, phaseNumber, switchPlanQuestion, previewChipText, PREVIEW_BLOCKED_MESSAGE } from './utils/phasePreview';
import type { PhasePreview } from './utils/phasePreview';
import { VIEWER_BLOCKED_MESSAGE, VIEWER_BANNER_TEXT } from './utils/autoSyncController';
import { Cloud, CheckCircle2, ArrowRight, Eye } from 'lucide-react';

export default function App() {
  const [currentAccount, setCurrentAccount] = useState<UserAccount | null>(() => getActiveAccount());
  const firebaseUser = useFirebaseUser();
  const [appState, setAppState] = useState<AppState>(() => loadAppState());
  const [activeTab, setActiveTab] = useState<TabType>('home');
  // Design exploration switch (?home=ring|path|vessel); defaults to ring.
  // User picked the Vessel design (26 Oct); ?home=ring|path still available for comparison.
  const [homeVariant] = useState(() => new URLSearchParams(window.location.search).get('home') || 'vessel');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showCloudSyncBanner, setShowCloudSyncBanner] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showSignIn, setShowSignIn] = useState<boolean>(false);
  const [focusSync, setFocusSync] = useState<boolean>(false);
  // View-only phase preview: never saved, never synced.
  const [preview, setPreview] = useState<PhasePreview | null>(null);
  // ?viewer=1 turns Viewer mode on for this browser (read once, before the first render uses it)
  useState(() => initialViewerMode());

  // Synchronize state changes to localStorage
  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  // One-time visible warning when normal autosaves start failing (for example storage full).
  useEffect(() => {
    setSaveFailureHandler((error) => showToast(error, 'warning'));
    return () => setSaveFailureHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Automatic cloud saving + live refresh + Viewer mode. Must stay AFTER the persistence effect above.
  const sync = useAutoSync(appState, setAppState);
  const viewer = sync.viewer;

  // Check if owner is logged in and could sync local data
  useEffect(() => {
    if (currentAccount && currentAccount.role !== 'coach' && !appState.settings.lastSyncTimestamp) {
      setShowCloudSyncBanner(true);
    }
  }, [currentAccount, appState.settings.lastSyncTimestamp]);

  // Toast notification helper
  const showToast = (
    text: string,
    type: 'success' | 'info' | 'warning' = 'success',
    undoAction?: () => void
  ) => {
    // While edits are blocked (Viewer mode or phase preview) a view may still announce 'logged'. That would be a
    // false success, so only warnings and the blocked-edit messages are allowed through.
    if ((viewer || preview) && type !== 'warning' && text !== VIEWER_BLOCKED_MESSAGE && text !== PREVIEW_BLOCKED_MESSAGE) return;
    const id = Date.now().toString() + Math.random().toString();
    const newToast: ToastMessage = { id, text, type, undoAction };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Every USER edit goes through editState: ignored in Viewer mode or while previewing a phase.
  const lastBlockedToast = React.useRef(0);
  const guardViewer = (): boolean => {
    if (!viewer) return false;
    const now = Date.now();
    if (now - lastBlockedToast.current > 2500) { lastBlockedToast.current = now; showToast(VIEWER_BLOCKED_MESSAGE, 'info'); }
    return true;
  };
  const editBlocked = (): boolean => {
    if (guardViewer()) return true;
    if (preview) { editState(() => appState); return true; }
    return false;
  };
  const editState = (updater: (prev: AppState) => AppState) => {
    if (guardViewer()) return;
    if (preview) {
      const now = Date.now();
      if (now - lastBlockedToast.current > 2500) { lastBlockedToast.current = now; showToast(PREVIEW_BLOCKED_MESSAGE, 'info'); }
      return;
    }
    setAppState(updater);
  };

  // Finish a Google sign-in that used the redirect fallback
  useEffect(() => {
    completeRedirectSignIn().then(({ user, error }) => {
      if (user) showToast(`Signed in as ${user.email ?? user.displayName ?? 'Google user'}`, 'success');
      else if (error) showToast(error, 'warning');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Day Selection
  const handleSelectDay = (dayNumber: number) => {
    if (preview) { setPreview({ ...preview, day: dayNumber }); return; }
    editState((prev) => ({
      ...prev,
      selectedDayNumber: dayNumber
    }));
  };

  // Phase pills only PREVIEW (view only, never saved or synced). Changing the plan needs an explicit confirm.
  const handlePreviewPhase = (phase: PhaseType) => {
    if (phase === appState.settings.activePhase && !preview) return;
    setPreview({ phase, day: phaseStartDay(phase) });
  };
  const handleBackToPlan = () => setPreview(null);
  const handleSwitchPlan = () => {
    if (!preview || guardViewer()) return;
    if (!window.confirm(switchPlanQuestion(preview.phase))) return;
    const target = preview.phase;
    setPreview(null);
    setAppState((prev) => switchPlan(prev, target));
    showToast(`Your plan is now Phase ${phaseNumber(target)}`, 'success');
  };

  // Programme Start Confirmation
  const handleConfirmProgramme = (phase: PhaseType, startDate: string, timezone: string) => {
    if (editBlocked()) return;
    const targetDay = phase === 'phase1' ? 1 : phase === 'phase3' ? 36 : 8;
    editState((prev) => ({
      ...prev,
      selectedDayNumber: targetDay,
      currentDayNumber: targetDay,
      settings: {
        ...prev.settings,
        activePhase: phase,
        startDate,
        timezone,
        confirmedProgrammeStart: true
      }
    }));
    showToast(`Programme confirmed! Starting with ${phase} on ${startDate} (${timezone}).`, 'success');
  };

  // Update specific daily log attributes (biofeedback, notes, status, meal estimates)
  const handleUpdateDailyLog = (dayNumber: number, partialLog: Partial<DailyLog>) => {
    editState((prev) => {
      const cur = prev.dailyLogs[dayNumber] || {
        // Never 'today': derive from the confirmed start date, else a day-N id.
        date:
          prev.settings.confirmedProgrammeStart && prev.settings.startDate
            ? calculateDateForDayNumber(prev.settings.startDate, dayNumber)
            : `day-${dayNumber}`,
        dayNumber,
        phase: dayNumber <= 7 ? 'phase1' : dayNumber >= 36 ? 'phase3' : 'phase2',
        checklist: { workout: false, cardio: false, water: false, photo: false, community: false },
        macrosConsumed: { calories: 0, protein: 0, fat: 0, carbs: 0 },
        waterMl: 0,
        steps: 0,
        supplements: { whey: false, creatine: false, multivitamin: false, vitaminD3: false, carnitine: false, acv: false }
      };

      return {
        ...prev,
        dailyLogs: {
          ...prev.dailyLogs,
          [dayNumber]: {
            ...cur,
            ...partialLog
          }
        }
      };
    });
  };

  // Daily Checklist Toggling
  const handleToggleChecklist = (key: keyof DailyChecklist) => {
    if (editBlocked()) return;
    const day = appState.selectedDayNumber;
    const currentLog = appState.dailyLogs[day];
    if (!currentLog) return;

    const previousCheck = currentLog.checklist[key];
    const updatedChecklist = {
      ...currentLog.checklist,
      [key]: !previousCheck
    };

    editState((prev) => ({
      ...prev,
      dailyLogs: {
        ...prev.dailyLogs,
        [day]: {
          ...currentLog,
          checklist: updatedChecklist
        }
      }
    }));

    showToast(
      !previousCheck ? 'Habit marked completed' : 'Habit unchecked',
      'success',
      () => {
        editState((prev) => ({
          ...prev,
          dailyLogs: {
            ...prev.dailyLogs,
            [day]: {
              ...currentLog,
              checklist: {
                ...currentLog.checklist,
                [key]: previousCheck
              }
            }
          }
        }));
      }
    );
  };

  // Save Workout from Train Tab
  const handleSaveWorkout = (dayNumber: number, log: any) => {
    editState((prev) => {
      const currentLog = prev.dailyLogs[dayNumber];
      return {
        ...prev,
        workoutLogs: {
          ...prev.workoutLogs,
          [String(dayNumber)]: log
        },
        dailyLogs: {
          ...prev.dailyLogs,
          [dayNumber]: {
            ...currentLog,
            checklist: {
              ...currentLog.checklist,
              workout: !log.isSkipped,
              abs: log.absCompleted,
              cardio: log.cardioCompleted
            },
            isRestDay: log.isRest,
            isSkipped: log.isSkipped,
            isModified: log.isModified
          }
        }
      };
    });
  };

  // Update Daily Macros
  const handleUpdateMacros = (macros: Macros) => {
    const day = appState.selectedDayNumber;
    const currentLog = appState.dailyLogs[day];
    if (!currentLog) return;

    editState((prev) => ({
      ...prev,
      dailyLogs: {
        ...prev.dailyLogs,
        [day]: {
          ...currentLog,
          entered: (() => {
            const ch = changedMacroMetrics(currentLog.macrosConsumed, macros);
            let l = currentLog;
            if (ch.calories) l = markEntered(l, 'calories');
            if (ch.protein) l = markEntered(l, 'protein');
            return l.entered;
          })(),
          macrosConsumed: macros,
          checklist: {
            ...currentLog.checklist,
            protein: prev.settings.bodyweightKg ? macros.protein >= prev.settings.bodyweightKg * 2 : false
          }
        }
      }
    }));
  };

  // Update Daily Water
  const handleUpdateWater = (waterMl: number) => {
    const day = appState.selectedDayNumber;
    const currentLog = appState.dailyLogs[day];
    if (!currentLog) return;

    const waterTarget = day >= 36 ? 4000 : appState.settings.waterGoalMl;

    editState((prev) => ({
      ...prev,
      dailyLogs: {
        ...prev.dailyLogs,
        [day]: {
          ...currentLog,
          entered: markEntered(currentLog, 'water').entered,
          waterMl,
          checklist: {
            ...currentLog.checklist,
            water: waterMl >= waterTarget
          }
        }
      }
    }));
  };

  // Update Daily Steps
  const handleUpdateSteps = (steps: number) => {
    const day = appState.selectedDayNumber;
    const currentLog = appState.dailyLogs[day];
    if (!currentLog) return;

    editState((prev) => ({
      ...prev,
      dailyLogs: {
        ...prev.dailyLogs,
        [day]: {
          ...currentLog,
          entered: markEntered(currentLog, 'steps').entered,
          steps,
          checklist: {
            ...currentLog.checklist,
            steps: steps >= prev.settings.stepGoal
          }
        }
      }
    }));
  };

  // Toggle Supplement
  const handleToggleSupplement = (supId: string) => {
    if (editBlocked()) return;
    const day = appState.selectedDayNumber;
    const currentLog = appState.dailyLogs[day];
    if (!currentLog) return;

    const cur = currentLog.supplements[supId as keyof typeof currentLog.supplements];
    editState((prev) => ({
      ...prev,
      dailyLogs: {
        ...prev.dailyLogs,
        [day]: {
          ...currentLog,
          supplements: {
            ...currentLog.supplements,
            [supId]: !cur
          }
        }
      }
    }));
    showToast(!cur ? 'Supplement logged' : 'Supplement unlogged', 'info');
  };

  // Add Weigh-in
  const handleAddWeighIn = (weight: number) => {
    const dateStr = localYmd();
    const day = appState.selectedDayNumber;

    editState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        bodyweightKg: weight
      },
      // same calendar day replaces the earlier weigh-in
      weighIns: upsertByDate(prev.weighIns, { date: dateStr, dayNumber: day, weight })
    }));
  };

  // Add Tape Measurements
  const handleAddMeasurements = (measurements: BodyMeasurements) => {
    const dateStr = localYmd();
    const day = appState.selectedDayNumber;

    editState((prev) => ({
      ...prev,
      measurementHistory: upsertByDate(prev.measurementHistory, { date: dateStr, dayNumber: day, measurements })
    }));
  };

  // Add Progress Photo
  const handleAddPhoto = (dataUrl: string, note?: string) => {
    const dateStr = localYmd();
    const day = appState.selectedDayNumber;

    editState((prev) => {
      const currentLog = prev.dailyLogs[day];
      return {
        ...prev,
        photos: [...prev.photos, { date: dateStr, dayNumber: day, dataUrl, note }],
        dailyLogs: {
          ...prev.dailyLogs,
          [day]: {
            ...currentLog,
            checklist: {
              ...currentLog.checklist,
              photo: true
            }
          }
        }
      };
    });
  };

  // Toggle Avoided Mistake
  const handleToggleMistake = (mistakeId: string) => {
    editState((prev) => ({
      ...prev,
      avoidedMistakes: {
        ...prev.avoidedMistakes,
        [mistakeId]: !prev.avoidedMistakes[mistakeId]
      }
    }));
  };

  // Learn Lessons
  const handleToggleLessonLearned = (lessonId: string) => {
    editState((prev) => {
      const isAlready = prev.learnedLessonIds.includes(lessonId);
      return {
        ...prev,
        learnedLessonIds: isAlready
          ? prev.learnedLessonIds.filter((id) => id !== lessonId)
          : [...prev.learnedLessonIds, lessonId]
      };
    });
  };

  const handleAnswerQuiz = (lessonId: string, optionIndex: number) => {
    editState((prev) => ({
      ...prev,
      quizAnswers: {
        ...prev.quizAnswers,
        [lessonId]: optionIndex
      }
    }));
  };

  // Settings & Reset
  const handleSaveSettings = (newSettings: AppSettings) => {
    if (editBlocked()) return;
    editState((prev) => ({
      ...prev,
      settings: newSettings
    }));
    showToast('Settings saved successfully', 'success');
  };

  /** Atomic: writes to storage first; app state changes only if the write was verified. Returns whether it worked. */
  const handleImportState = (newState: AppState): boolean => {
    if (guardViewer()) return false;
    const next = padDailyLogs(newState);
    const res = commitState(localStorage, STORAGE_KEY, next);
    if (!res.ok) {
      showToast(`Restore failed, nothing was changed. ${res.error}`, 'warning');
      return false;
    }
    setAppState(next);
    showToast('Backup restored successfully!', 'success');
    return true;
  };

  const handleResetAllData = () => {
    if (guardViewer()) return;
    const fresh = getInitialState();
    setAppState(fresh);
    showToast('All app data has been reset to defaults.', 'warning');
  };

  const streak = calculateStreak(appState.dailyLogs, appState.currentDayNumber);
  const view = displayState(appState, preview);
  const openSyncSettings = () => { setFocusSync(true); setShowSettings(true); };

  // If active user is a Coach, display Coach Dashboard
  if (currentAccount?.role === 'coach') {
    return (
      <CoachView
        coachUid={currentAccount.id}
        coachEmail={currentAccount.username}
        initialOwnerUid={appState.settings.username}
        onLogout={() => {
          logoutActiveUser();
          setCurrentAccount(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0D10] text-slate-100 flex flex-col antialiased selection:bg-[#B6FF3B] selection:text-black font-sans">
      {/* Top Application Bar */}
      <TopBar
        currentDayNumber={view.selectedDayNumber}
        activePhase={
          view.selectedDayNumber <= 7
            ? 'phase1'
            : view.selectedDayNumber >= 36
            ? 'phase3'
            : 'phase2'
        }
        phase3Unlocked={appState.settings.phase3Unlocked}
        currentUser={deriveHeaderIdentity(currentAccount, firebaseUser)}
        onSwitchPhase={handlePreviewPhase}
        onOpenSettings={() => { setFocusSync(false); setShowSettings(true); }}
        onOpenSyncSettings={openSyncSettings}
        onOpenProfile={() => (profileTarget(currentAccount) === 'profile' ? setShowProfileModal(true) : openSyncSettings())}
        onOpenAuth={() => setShowSignIn(true)}
        syncStatus={sync.status}
        onSyncRetry={sync.retry}
      />

      {viewer && (
        <div className="max-w-md sm:max-w-lg md:max-w-xl mx-auto px-4 pt-2 w-full">
          <div role="status" className="px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-200 text-[11px] font-semibold flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span>{VIEWER_BANNER_TEXT}</span>
          </div>
        </div>
      )}

      {preview && (
        <div className="max-w-md sm:max-w-lg md:max-w-xl mx-auto px-4 pt-2 w-full">
          <div role="status" className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-100 text-[11px] flex flex-wrap items-center gap-2">
            <span className="font-bold">{previewChipText(preview.phase)}</span>
            <span className="text-sky-200/80">View only. Your plan is Phase {phaseNumber(appState.settings.activePhase)}.</span>
            <span className="flex gap-1.5 ml-auto">
              <button type="button" onClick={handleBackToPlan} className="min-h-[36px] px-3 rounded-lg bg-[#B6FF3B] text-black font-extrabold active:scale-95">Back to my plan</button>
              <button type="button" onClick={handleSwitchPlan} disabled={viewer} className="min-h-[36px] px-3 rounded-lg bg-[#14181D] border border-sky-500/40 text-sky-100 font-semibold active:scale-95 disabled:opacity-40">Make this my plan</button>
            </span>
          </div>
        </div>
      )}

      {/* Cloud Sync Prompt Banner if logged in */}
      {showCloudSyncBanner && !viewer && (
        <div className="max-w-md sm:max-w-lg md:max-w-xl mx-auto px-4 pt-2 w-full">
          <div className="p-3 rounded-2xl bg-[#14181D] border border-sky-500/30 flex items-center justify-between gap-3 text-xs shadow-md">
            <div className="flex items-center gap-2 text-sky-400">
              <Cloud className="w-4 h-4 shrink-0" />
              <span className="text-slate-200 text-[11px]">
                Back up this device's records to your cloud account? (You link the device once; after that saving is automatic.)
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={viewer}
                onClick={async () => {
                  if (guardViewer()) return;
                  if (!auth.currentUser) { setShowSignIn(true); return; }
                  const res = await guardedSync(appState, (label) =>
                    window.confirm(`Link the records on this device to ${label}? They will be saved to that cloud account.`)
                  );
                  if (res.success) {
                    if (res.conflicts && res.conflicts.length > 0) {
                      showToast(`${res.conflicts.length} item(s) differ from the cloud and were not overwritten. Open Settings to choose which version to keep.`, 'warning');
                    } else {
                      showToast('Records saved and verified in the cloud', 'success');
                    }
                    if (res.timestamp) {
                      setAppState((prev) => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          lastSyncTimestamp: res.timestamp,
                          linkedFirebaseUid: res.linkedUid ?? prev.settings.linkedFirebaseUid
                        }
                      }));
                    }
                    setShowCloudSyncBanner(false);
                  } else {
                    showToast(res.error || 'Cloud sync notice: working locally', 'warning');
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-[#B6FF3B] text-black font-extrabold text-[11px] active:scale-95"
              >
                Sync Now
              </button>
              <button
                type="button"
                onClick={() => setShowCloudSyncBanner(false)}
                className="px-2 py-1 text-slate-400 hover:text-white text-[11px]"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      <HabitReminderRunner />

      {/* Main Content View with Smooth Transition */}
      <main className="flex-1 w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto px-4 pt-4">
        {activeTab === 'home' && (
          (homeVariant === 'path'
            ? <HomePath appState={view} onToggleChecklist={handleToggleChecklist} onNavigateTab={setActiveTab} streak={streak} />
            : homeVariant === 'vessel'
            ? <HomeVessel appState={view} onToggleChecklist={handleToggleChecklist} onNavigateTab={setActiveTab} streak={streak} />
            : <HomeView appState={view} onToggleChecklist={handleToggleChecklist} onNavigateTab={setActiveTab} streak={streak} />)
        )}

        {activeTab === 'today' && (
          <TodayView
            appState={view}
            onSelectDay={handleSelectDay}
            onToggleChecklist={handleToggleChecklist}
            onNavigateTab={setActiveTab}
            streak={streak}
            onUpdateDailyLog={handleUpdateDailyLog}
            onConfirmProgramme={handleConfirmProgramme}
          />
        )}

        {activeTab === 'train' && (
          <TrainView
            appState={view}
            onSaveWorkout={handleSaveWorkout}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'eat' && (
          <EatView
            appState={view}
            onUpdateMacros={handleUpdateMacros}
            onUpdateWater={handleUpdateWater}
            onUpdateSteps={handleUpdateSteps}
            onToggleSupplement={handleToggleSupplement}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'progress' && (
          <ProgressView
            appState={view}
            onAddWeighIn={handleAddWeighIn}
            onAddMeasurements={handleAddMeasurements}
            onAddPhoto={handleAddPhoto}
            onToggleMistake={handleToggleMistake}
            onNavigateTab={setActiveTab}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'learn' && (
          <LearnView
            appState={view}
            onToggleLessonLearned={handleToggleLessonLearned}
            onAnswerQuiz={handleAnswerQuiz}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Fixed Bottom Tab Bar */}
      <BottomTabBar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
      />

      {/* Toast Notification Container */}
      <ToastContainer
        toasts={toasts}
        onDismiss={handleDismissToast}
      />

      {/* First-time Onboarding Modal */}
      {!viewer && !appState.settings.onboardingCompleted && (
        <OnboardingModal
          initialSettings={appState.settings}
          onComplete={(updated) => {
            handleSaveSettings(updated);
          }}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          appState={appState}
          onClose={() => setShowSettings(false)}
          onSaveSettings={handleSaveSettings}
          onImportState={handleImportState}
          onUpdateAppState={setAppState}
          onResetAllData={handleResetAllData}
          viewerMode={viewer}
          onToggleViewer={sync.setViewer}
          autoSyncConflicts={sync.getConflicts()}
          onConflictsHandled={sync.conflictsResolved}
          onAppliedFromCloud={sync.noteAppliedFromCloud}
          focusSync={focusSync}
          onCloudSyncSuccess={() => showToast('Synced to Firestore database', 'success')}
        />
      )}

      {/* Profile & Account Switcher Modal */}
      {showProfileModal && (
        <UserProfileModal
          currentAccount={currentAccount}
          appState={appState}
          onClose={() => setShowProfileModal(false)}
          onSwitchUser={(acc) => {
            setCurrentAccount(acc);
            setAppState(acc.appState || appState);
            showToast(`Switched account to @${acc.username}`, 'info');
          }}
          onLogout={() => {
            setCurrentAccount(null);
            showToast('Logged out', 'info');
          }}
          onProfileUpdated={(updated) => {
            setCurrentAccount(updated);
            showToast('Profile updated', 'success');
          }}
        />
      )}

      {/* Cloud sign-in (Google + email): the one sign-in flow */}
      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          onSignedIn={(label) => showToast(`Signed in as ${label}. Nothing was saved yet.`, 'success')}
          onUseOnDeviceProfile={() => { setShowSignIn(false); setShowAuthModal(true); }}
        />
      )}

      {/* On-device profile (not a cloud login) */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={(acc) => {
            setCurrentAccount(acc);
            setShowAuthModal(false);
            if (acc.appState) {
              setAppState(acc.appState);
            }
            showToast(`Welcome, ${acc.displayName}!`, 'success');
          }}
        />
      )}
    </div>
  );
}
