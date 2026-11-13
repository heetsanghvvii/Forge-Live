import React, { useState, useEffect } from 'react';
import { AppState, ExerciseLog, ExerciseSet } from '../types';
import { getSlotInfo, ExerciseDef, AbExerciseDef } from '../data/workoutData';
import { soundController } from '../utils/audio';
import { launchConfetti } from '../utils/confetti';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minus,
  Sparkles,
  Award,
  Flame,
  Activity,
  Heart,
  Zap,
  Layers,
  ArrowDownCircle,
  Footprints,
  Compass
} from 'lucide-react';

interface TrainViewProps {
  appState: AppState;
  onSaveWorkout: (dayNumber: number, log: {
    phase: 'phase1' | 'phase2' | 'phase3';
    workoutCompleted: boolean;
    warmupCompleted: boolean;
    cooldownCompleted: boolean;
    absCompleted: boolean;
    cardioCompleted: boolean;
    cardioMinutes: number;
    cardioType?: 'LISS' | 'Sprints' | 'Walk' | 'Conditioning';
    sprintCount?: number;
    exercises: ExerciseLog[];
    totalVolumeKg: number;
    isRest?: boolean;
    isSkipped?: boolean;
    isModified?: boolean;
    sessionNotes?: string;
    rpeEffort?: number;
  }) => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning', undo?: () => void) => void;
}

export const TrainView: React.FC<TrainViewProps> = ({
  appState,
  onSaveWorkout,
  onShowToast
}) => {
  const { selectedDayNumber, workoutLogs } = appState;
  const isPhase1 = selectedDayNumber >= 1 && selectedDayNumber <= 7;
  const isPhase3 = selectedDayNumber >= 36;
  const slotInfo = getSlotInfo(selectedDayNumber);
  const phaseWeek = isPhase1
    ? 1
    : isPhase3
    ? Math.min(4, Math.ceil((selectedDayNumber - 35) / 7))
    : Math.min(4, Math.ceil((selectedDayNumber - 7) / 7));

  const existingLog = workoutLogs[String(selectedDayNumber)];

  // Exercise log states
  const [exerciseLogs, setExerciseLogs] = useState<{ [exId: string]: ExerciseLog }>(() => {
    const map: { [exId: string]: ExerciseLog } = {};
    slotInfo.exercises.forEach((ex) => {
      const existing = existingLog?.exercises?.find((e) => e.exerciseId === ex.id);
      if (existing) {
        map[ex.id] = existing;
      } else {
        const sets: ExerciseSet[] = [];
        for (let s = 1; s <= ex.targetSets; s++) {
          const isDrop = ex.isDropSet && s === ex.targetSets;
          const dropWeight = isDrop ? Math.round(ex.defaultWeight * 0.65) : undefined;
          sets.push({
            setNumber: s,
            weight: ex.defaultWeight,
            reps: ex.repCount,
            completed: false,
            isDropSet: isDrop,
            dropWeight,
            dropReps: ex.repCount,
            dropCompleted: false
          });
        }
        map[ex.id] = {
          exerciseId: ex.id,
          name: ex.name,
          tag: ex.tag,
          sets
        };
      }
    });
    return map;
  });

  // Steps navigation
  const totalExercises = slotInfo.exercises.length;
  // Steps: 0: Warm-up, 1..N: Exercises, N+1: Abs (optional in P3), N+2: Cool-down, N+3: Cardio/Sprints, N+4: Summary
  const totalSteps = totalExercises > 0 ? totalExercises + 5 : 1;
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Warm-up, cool-down, abs states
  const [warmupChecks, setWarmupChecks] = useState<{ [id: string]: boolean }>({});
  const [cooldownChecks, setCooldownChecks] = useState<{ [id: string]: boolean }>({});
  const [absChecks, setAbsChecks] = useState<{ [id: string]: boolean }>({});
  const [showOptionalAbs, setShowOptionalAbs] = useState<boolean>(!isPhase3);

  // Timers
  const [restTimerSeconds, setRestTimerSeconds] = useState<number>(0);
  const [restTimerTotal, setRestTimerTotal] = useState<number>(90);
  const [isRestTimerActive, setIsRestTimerActive] = useState<boolean>(false);

  // Cardio LISS stopwatch
  const [cardioSeconds, setCardioSeconds] = useState<number>(existingLog?.cardioMinutes ? existingLog.cardioMinutes * 60 : 0);
  const [isCardioRunning, setIsCardioRunning] = useState<boolean>(false);

  // Sprint session state
  const [sprintCount, setSprintCount] = useState<number>(existingLog?.sprintCount || 0);
  const [walkBackTimer, setWalkBackTimer] = useState<number>(0);
  const [isWalkBackActive, setIsWalkBackActive] = useState<boolean>(false);

  // Session status & subjective effort
  const [sessionNotes, setSessionNotes] = useState<string>(existingLog?.sessionNotes || '');
  const [sessionStatus, setSessionStatus] = useState<'normal' | 'modified' | 'rest' | 'skipped'>(
    existingLog?.isSkipped ? 'skipped' : existingLog?.isRest ? 'rest' : existingLog?.isModified ? 'modified' : 'normal'
  );
  const [sessionRpe, setSessionRpe] = useState<number>(existingLog?.rpeEffort || 7);

  // Helper to query the last logged session for a specific exercise
  const getLastSessionData = (exId: string, exName: string) => {
    const days = Object.keys(workoutLogs)
      .map(Number)
      .filter((d) => d < selectedDayNumber)
      .sort((a, b) => b - a);

    for (const d of days) {
      const log = workoutLogs[String(d)];
      if (log?.exercises) {
        const found = log.exercises.find((e) => e.exerciseId === exId || e.name.toLowerCase() === exName.toLowerCase());
        if (found) {
          const completedSet = [...found.sets].reverse().find((s) => s.completed);
          if (completedSet) {
            return {
              weight: completedSet.weight,
              reps: completedSet.reps,
              dayNumber: d
            };
          }
        }
      }
    }
    return null;
  };

  const handleUpdateSetRpe = (exId: string, setIndex: number, rpe: number) => {
    const currentLog = exerciseLogs[exId];
    if (!currentLog) return;
    const updatedSets = [...currentLog.sets];
    updatedSets[setIndex] = { ...updatedSets[setIndex], rpeEffort: rpe };
    setExerciseLogs((prev) => ({
      ...prev,
      [exId]: { ...currentLog, sets: updatedSets }
    }));
  };

  const handleUpdateSetNotes = (exId: string, setIndex: number, notes: string) => {
    const currentLog = exerciseLogs[exId];
    if (!currentLog) return;
    const updatedSets = [...currentLog.sets];
    updatedSets[setIndex] = { ...updatedSets[setIndex], setNotes: notes };
    setExerciseLogs((prev) => ({
      ...prev,
      [exId]: { ...currentLog, sets: updatedSets }
    }));
  };

  // Countdown Rest Timer Effect
  useEffect(() => {
    let interval: number;
    if (isRestTimerActive && restTimerSeconds > 0) {
      interval = window.setInterval(() => {
        setRestTimerSeconds((prev) => {
          if (prev <= 1) {
            setIsRestTimerActive(false);
            soundController.playTimerBeep();
            onShowToast('Rest interval finished! Next set ready', 'info');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRestTimerActive, restTimerSeconds, onShowToast]);

  // Sprint Walk Back Timer Effect
  useEffect(() => {
    let interval: number;
    if (isWalkBackActive && walkBackTimer > 0) {
      interval = window.setInterval(() => {
        setWalkBackTimer((prev) => {
          if (prev <= 1) {
            setIsWalkBackActive(false);
            soundController.playTimerBeep();
            onShowToast('Walk back complete! Ready for next 100% sprint', 'warning');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isWalkBackActive, walkBackTimer, onShowToast]);

  // Cardio stopwatch interval effect
  useEffect(() => {
    let interval: number;
    if (isCardioRunning) {
      interval = window.setInterval(() => {
        setCardioSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCardioRunning]);

  const handleStartRestTimer = (seconds: number) => {
    setRestTimerTotal(seconds);
    setRestTimerSeconds(seconds);
    setIsRestTimerActive(true);
  };

  const handleStartWalkBackTimer = (seconds: number = 75) => {
    setWalkBackTimer(seconds);
    setIsWalkBackActive(true);
  };

  const handleToggleSet = (exId: string, setIndex: number) => {
    const currentLog = exerciseLogs[exId];
    if (!currentLog) return;

    const updatedSets = [...currentLog.sets];
    const targetSet = updatedSets[setIndex];
    const willBeCompleted = !targetSet.completed;
    updatedSets[setIndex] = { ...targetSet, completed: willBeCompleted };

    setExerciseLogs((prev) => ({
      ...prev,
      [exId]: { ...currentLog, sets: updatedSets }
    }));

    if (willBeCompleted) {
      soundController.playSetSuccess();
      const currentEx = slotInfo.exercises.find((e) => e.id === exId);
      const restSecs = currentEx?.restSeconds || (currentEx?.isCompound ? 90 : 60);

      // In supersets and giant sets, rest is 0 until the final round exercise
      if (restSecs > 0) {
        handleStartRestTimer(restSecs);
      }
      onShowToast(`Set ${setIndex + 1} marked complete.`, 'success');
    }
  };

  const handleToggleDropSet = (exId: string, setIndex: number) => {
    const currentLog = exerciseLogs[exId];
    if (!currentLog) return;

    const updatedSets = [...currentLog.sets];
    const targetSet = updatedSets[setIndex];
    const nextDropCompleted = !targetSet.dropCompleted;
    updatedSets[setIndex] = { ...targetSet, dropCompleted: nextDropCompleted };

    setExerciseLogs((prev) => ({
      ...prev,
      [exId]: { ...currentLog, sets: updatedSets }
    }));

    if (nextDropCompleted) {
      soundController.playSetSuccess();
      handleStartRestTimer(60);
      onShowToast('Drop set completed! Muscles fully fatigued.', 'success');
    }
  };

  const handleAdjustWeight = (exId: string, setIndex: number, delta: number) => {
    const currentLog = exerciseLogs[exId];
    if (!currentLog) return;
    const updatedSets = [...currentLog.sets];
    const currentWeight = updatedSets[setIndex].weight;
    const newWeight = Math.max(0, Math.round((currentWeight + delta) * 10) / 10);
    const dropWeight = Math.round(newWeight * 0.65);
    updatedSets[setIndex] = {
      ...updatedSets[setIndex],
      weight: newWeight,
      dropWeight: updatedSets[setIndex].isDropSet ? dropWeight : undefined
    };

    setExerciseLogs((prev) => ({
      ...prev,
      [exId]: { ...currentLog, sets: updatedSets }
    }));
  };

  const handleAdjustReps = (exId: string, setIndex: number, delta: number) => {
    const currentLog = exerciseLogs[exId];
    if (!currentLog) return;
    const updatedSets = [...currentLog.sets];
    const currentReps = updatedSets[setIndex].reps;
    const newReps = Math.max(1, currentReps + delta);
    updatedSets[setIndex] = { ...updatedSets[setIndex], reps: newReps };

    setExerciseLogs((prev) => ({
      ...prev,
      [exId]: { ...currentLog, sets: updatedSets }
    }));
  };

  const calculateTotalVolume = () => {
    let volume = 0;
    Object.values(exerciseLogs).forEach((log) => {
      log.sets.forEach((set) => {
        if (set.completed) {
          volume += set.weight * set.reps;
          if (set.dropCompleted && set.dropWeight) {
            volume += set.dropWeight * (set.dropReps || set.reps);
          }
        }
      });
    });
    return Math.round(volume);
  };

  const calculateCompletedSets = () => {
    let count = 0;
    Object.values(exerciseLogs).forEach((log) => {
      log.sets.forEach((s) => {
        if (s.completed) count++;
      });
    });
    return count;
  };

  const handleFinishWorkout = () => {
    const totalVolume = calculateTotalVolume();
    const cardioMins = Math.round(cardioSeconds / 60);

    onSaveWorkout(selectedDayNumber, {
      phase: isPhase1 ? 'phase1' : isPhase3 ? 'phase3' : 'phase2',
      workoutCompleted: sessionStatus !== 'skipped',
      warmupCompleted: Object.values(warmupChecks).length >= 2,
      cooldownCompleted: Object.values(cooldownChecks).length >= 2,
      absCompleted: isPhase1 ? true : Object.values(absChecks).length >= 2,
      cardioCompleted: isPhase3 && slotInfo.cardioType === 'Sprints' ? sprintCount >= 4 : cardioMins >= 10,
      cardioMinutes: cardioMins,
      cardioType: slotInfo.cardioType,
      sprintCount: slotInfo.cardioType === 'Sprints' ? sprintCount : undefined,
      exercises: Object.values(exerciseLogs),
      totalVolumeKg: totalVolume,
      isRest: sessionStatus === 'rest',
      isSkipped: sessionStatus === 'skipped',
      isModified: sessionStatus === 'modified',
      sessionNotes: sessionNotes.trim(),
      rpeEffort: sessionRpe
    });

    launchConfetti();
    onShowToast(`Session complete! Volume: ${totalVolume} kg.`, 'success');
    setCurrentStep(totalSteps - 1);
  };

  // Rest Day View
  if (slotInfo.isRest) {
    return (
      <div className="space-y-6 pb-24">
        <div className="p-6 rounded-3xl bg-[#14181D] border border-[#222933] text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#B6FF3B]/10 border border-[#B6FF3B]/30 flex items-center justify-center text-[#B6FF3B] mx-auto">
            <Heart className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#B6FF3B] uppercase tracking-wider">
              {isPhase1
                ? 'Phase 1: Foundation Rest Day (Day 7)'
                : isPhase3
                ? 'Phase 3: Muscle Building Rest Day'
                : 'Phase 2: Scheduled Rest Day'}
            </span>
            <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1">
              Active Recovery & Tissue Hypertrophy
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
            Rest is when muscles synthesize new myofibrillar proteins. Strictly zero gym training today. Feed the muscle and hit your recovery targets.
          </p>

          <div className="text-left p-4 rounded-2xl bg-[#0B0D10] border border-[#222933] space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Rest Day Protocol
            </h3>
            <div className="flex items-start gap-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-[#B6FF3B] shrink-0 mt-0.5" />
              <span>Sleep 7-8 hours minimum for maximum nocturnal growth hormone.</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-[#B6FF3B] shrink-0 mt-0.5" />
              <span>Hit calories and protein (2g/kg). Rest day is NOT a diet day.</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-[#B6FF3B] shrink-0 mt-0.5" />
              <span>Drink 4+ litres of clean water to hydrate intracellular muscle tissue.</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-[#B6FF3B] shrink-0 mt-0.5" />
              <span>10-15 min light stretching. Optional 20-30 min gentle walk.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active Rest Timer Overlay
  const renderRestTimerBar = () => {
    if (!isRestTimerActive && restTimerSeconds === 0) return null;
    const progress = restTimerTotal > 0 ? (restTimerSeconds / restTimerTotal) * 100 : 0;

    return (
      <div className="sticky top-16 z-30 mb-4 p-3.5 rounded-2xl bg-[#14181D] border border-[#B6FF3B]/40 shadow-xl flex items-center justify-between gap-3 animate-in fade-in">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
            <svg className="w-11 h-11 transform -rotate-90">
              <circle cx="22" cy="22" r="18" stroke="#222933" strokeWidth="4" fill="transparent" />
              <circle
                cx="22"
                cy="22"
                r="18"
                stroke="#B6FF3B"
                strokeWidth="4"
                strokeDasharray={2 * Math.PI * 18}
                strokeDashoffset={2 * Math.PI * 18 * (1 - progress / 100)}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-300"
              />
            </svg>
            <span className="absolute text-xs font-mono font-bold text-white tabular-nums">
              {restTimerSeconds}s
            </span>
          </div>

          <div>
            <span className="block text-xs font-bold text-white leading-tight">Rest Interval</span>
            <span className="text-[11px] text-slate-400">
              {isRestTimerActive ? 'Deep breathing & recovery' : 'Timer paused'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setRestTimerSeconds((s) => s + 15)}
            className="px-2 py-1 text-[11px] font-mono rounded-lg bg-[#0B0D10] border border-[#222933] text-slate-300 hover:text-white"
          >
            +15s
          </button>
          <button
            type="button"
            onClick={() => setIsRestTimerActive(!isRestTimerActive)}
            className="p-2 rounded-lg bg-[#0B0D10] border border-[#222933] text-slate-300 hover:text-white"
          >
            {isRestTimerActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRestTimerActive(false);
              setRestTimerSeconds(0);
            }}
            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#B6FF3B] text-black"
          >
            Skip
          </button>
        </div>
      </div>
    );
  };

  // Step 0: Warm-up
  const renderWarmupStep = () => (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl bg-[#14181D] border border-[#222933] space-y-2">
        <div className="flex items-center gap-2 text-[#B6FF3B]">
          <Activity className="w-5 h-5" />
          <h3 className="text-base font-bold text-white">{slotInfo.workoutType} Dynamic Warm-up</h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          5 to 10 minutes non-negotiable. Increases core temperature, lubricates joint capsules with synovial fluid, and prevents tears during heavy overload.
        </p>
      </div>

      <div className="space-y-2">
        {slotInfo.warmup.map((item) => {
          const isChecked = !!warmupChecks[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setWarmupChecks((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
              }}
              className={`w-full p-4 rounded-2xl border text-left flex items-start gap-3.5 transition-all ${
                isChecked
                  ? 'bg-[#14181D]/60 border-[#222933] opacity-70'
                  : 'bg-[#14181D] border-[#222933] hover:border-slate-600'
              }`}
            >
              <div
                className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  isChecked
                    ? 'bg-[#B6FF3B] text-black'
                    : 'bg-[#0B0D10] border border-[#222933] text-slate-600'
                }`}
              >
                {isChecked ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <span className={`block text-xs sm:text-sm font-bold ${isChecked ? 'line-through text-slate-500' : 'text-white'}`}>
                  {item.name}
                </span>
                <span className="block text-xs text-slate-400 mt-0.5">{item.detail}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // Exercise Step (1 to N)
  const currentExIndex = currentStep - 1;
  const currentExDef = slotInfo.exercises[currentExIndex];
  const currentExLog = currentExDef ? exerciseLogs[currentExDef.id] : null;

  const renderExerciseStep = () => {
    if (!currentExDef || !currentExLog) return null;

    const estimatedLastWeekWeight = Math.max(0, currentExDef.defaultWeight - (phaseWeek === 1 ? 0 : 2.5));

    return (
      <div className="space-y-4">
        {/* Exercise Header Card */}
        <div className="p-5 sm:p-6 rounded-3xl bg-[#14181D] border border-[#222933] shadow-xl space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {currentExDef.tag && (
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                    currentExDef.tag === '[SS]'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : currentExDef.tag === '[DS]'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}>
                    {currentExDef.tag === '[SS]' ? 'Superset [SS]' : currentExDef.tag === '[DS]' ? 'Drop Set [DS]' : 'Giant Set [GS]'}
                  </span>
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#B6FF3B]/10 text-[#B6FF3B]">
                  {currentExDef.isCompound ? 'Compound (90s rest)' : 'Isolation (60s rest)'}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  {currentExIndex + 1} of {totalExercises}
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {currentExDef.name}
              </h3>
              <p className="text-xs text-slate-400">
                Target: {currentExDef.targetSets} sets × {currentExDef.targetReps}
              </p>
            </div>
          </div>

          {/* Tempo & Target Muscle */}
          <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-[#0B0D10] border border-[#222933] text-xs">
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-tight font-semibold">
                Tempo
              </span>
              <span className="font-mono text-slate-200 font-semibold">{currentExDef.tempo}</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-tight font-semibold">
                Primary Muscle
              </span>
              <span className="text-slate-200 font-medium truncate block">{currentExDef.targetMuscle}</span>
            </div>
          </div>

          {/* Overload Guidance & Last Session Reference */}
          {(() => {
            const lastSession = getLastSessionData(currentExDef.id, currentExDef.name);
            return (
              <div className="p-3.5 rounded-2xl bg-[#1A1F26] border border-sky-500/20 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-sky-400 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Overload Target</span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-300">
                    {lastSession
                      ? `Last session (Day ${lastSession.dayNumber}): ${lastSession.weight} kg × ${lastSession.reps}`
                      : `Wk ${phaseWeek > 1 ? phaseWeek - 1 : 1} Est: ${estimatedLastWeekWeight} kg`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Try +1 rep or +1 to 2.5 kg when previous targets are hit with perfect technique. Never force heavy load on fatigued joints.
                </p>
              </div>
            );
          })()}

          <p className="text-xs text-slate-400 italic">
            Form cue: {currentExDef.instructions}
          </p>
        </div>

        {/* Set Rows with Stepper & Drop Set Options */}
        <div className="space-y-3">
          {currentExLog.sets.map((set, setIdx) => {
            const isLastSet = setIdx === currentExLog.sets.length - 1;
            const hasDropSet = currentExDef.isDropSet && isLastSet;

            return (
              <div
                key={set.setNumber}
                className={`p-4 rounded-2xl border transition-all ${
                  set.completed
                    ? 'bg-[#14181D]/60 border-[#B6FF3B]/30'
                    : 'bg-[#14181D] border-[#222933]'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Set {set.setNumber}
                    </span>
                    {hasDropSet && (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                        Drop Set on this set
                      </span>
                    )}
                    {set.completed && (
                      <span className="text-[10px] font-semibold text-[#B6FF3B] bg-[#B6FF3B]/10 px-2 py-0.5 rounded">
                        Done
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleSet(currentExDef.id, setIdx)}
                    className={`min-h-[44px] px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 ${
                      set.completed
                        ? 'bg-[#B6FF3B] text-black shadow-md shadow-[#B6FF3B]/10'
                        : 'bg-[#0B0D10] border border-[#222933] text-slate-300 hover:border-[#B6FF3B]'
                    }`}
                  >
                    {set.completed ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 fill-black text-[#B6FF3B]" />
                        <span>Done</span>
                      </>
                    ) : (
                      <>
                        <Circle className="w-4 h-4" />
                        <span>Mark Set Done</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Main Set Weight and Rep Steppers */}
                <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 pt-2 border-t border-[#222933]">
                  {/* Weight Stepper */}
                  <div>
                    <span className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                      Weight (kg)
                    </span>
                    <div className="flex items-center justify-between bg-[#0B0D10] border border-[#222933] rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => handleAdjustWeight(currentExDef.id, setIdx, -1)}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-300 hover:text-white active:scale-90"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-extrabold font-mono text-white tabular-nums px-1 whitespace-nowrap">
                        {set.weight} kg
                      </span>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleAdjustWeight(currentExDef.id, setIdx, 1)}
                          className="min-w-[36px] min-h-[40px] flex items-center justify-center text-slate-300 hover:text-white active:scale-90"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustWeight(currentExDef.id, setIdx, 2.5)}
                          title="+2.5 kg bump"
                          className="px-2 min-h-[36px] min-w-[40px] text-[11px] font-bold rounded bg-slate-800 text-[#B6FF3B] hover:bg-slate-700"
                        >
                          +2.5
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Reps Stepper */}
                  <div>
                    <span className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                      Reps
                    </span>
                    <div className="flex items-center justify-between bg-[#0B0D10] border border-[#222933] rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => handleAdjustReps(currentExDef.id, setIdx, -1)}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-300 hover:text-white active:scale-90"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-extrabold font-mono text-white tabular-nums">
                        {set.reps}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAdjustReps(currentExDef.id, setIdx, 1)}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-300 hover:text-white active:scale-90"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Optional Effort (RPE) & Set Note */}
                <div className="mt-2.5 pt-2 border-t border-[#222933]/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">
                      Effort (RPE 1-10, Optional)
                    </span>
                    <div className="flex items-center gap-1">
                      {[6, 7, 8, 9, 10].map((rpe) => (
                        <button
                          key={rpe}
                          type="button"
                          onClick={() => handleUpdateSetRpe(currentExDef.id, setIdx, rpe)}
                          className={`flex-1 min-h-[36px] rounded text-[11px] font-mono font-bold transition-colors ${
                            set.rpeEffort === rpe
                              ? 'bg-[#B6FF3B] text-black'
                              : 'bg-[#0B0D10] border border-[#222933] text-slate-400 hover:text-white'
                          }`}
                        >
                          {rpe}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">
                      Set Note (Optional)
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. Pause at chest, smooth tempo"
                      value={set.setNotes || ''}
                      onChange={(e) => handleUpdateSetNotes(currentExDef.id, setIdx, e.target.value)}
                      className="w-full min-h-[36px] px-2.5 rounded bg-[#0B0D10] border border-[#222933] text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-[#B6FF3B]"
                    />
                  </div>
                </div>

                {/* Drop Set Prompt and Tracker */}
                {hasDropSet && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                        <ArrowDownCircle className="w-4 h-4" />
                        <span>Drop 30-40% to ~{set.dropWeight} kg and rep to failure!</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleDropSet(currentExDef.id, setIdx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                          set.dropCompleted
                            ? 'bg-amber-400 text-black'
                            : 'bg-[#0B0D10] border border-amber-500/40 text-amber-300 hover:bg-amber-400/20'
                        }`}
                      >
                        {set.dropCompleted ? 'Drop Set Done' : 'Complete Drop Set'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Step: Abs Routine (Phase 2 mandatory, Phase 3 optional)
  const renderAbsStep = () => (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl bg-[#14181D] border border-[#222933] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#B6FF3B]">
            <Flame className="w-5 h-5" />
            <h3 className="text-base font-bold text-white">
              {isPhase3 ? 'Optional Ab Routine' : `Slot ${slotInfo.slotIndex} Ab Routine`}
            </h3>
          </div>
          {isPhase3 && (
            <button
              type="button"
              onClick={() => setShowOptionalAbs(!showOptionalAbs)}
              className="text-xs text-sky-400 hover:text-sky-300 font-semibold"
            >
              {showOptionalAbs ? 'Hide Abs' : 'Show Abs (Add-on)'}
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {isPhase3
            ? 'Phase 3 abs are optional. Your core is heavily braced during heavy squats, deadlifts, and overhead presses.'
            : 'Executed after weights, before cardio. 5 to 8 minutes total. 30s rest between exercises, zero rest between sets.'}
        </p>
      </div>

      {showOptionalAbs && (
        <div className="space-y-3">
          {slotInfo.abs.map((ab) => {
            const isChecked = !!absChecks[ab.id];
            return (
              <div
                key={ab.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isChecked
                    ? 'bg-[#14181D]/60 border-[#222933] opacity-75'
                    : 'bg-[#14181D] border-[#222933]'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <span className={`block text-sm font-bold ${isChecked ? 'line-through text-slate-400' : 'text-white'}`}>
                      {ab.name}
                    </span>
                    <span className="block text-xs font-mono text-[#B6FF3B] mt-0.5">
                      {ab.targetSets} sets × {ab.targetReps}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAbsChecks((c) => ({ ...c, [ab.id]: !c[ab.id] }))}
                    className={`min-h-[44px] px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 active:scale-95 ${
                      isChecked
                        ? 'bg-[#B6FF3B] text-black'
                        : 'bg-[#0B0D10] border border-[#222933] text-slate-300 hover:border-[#B6FF3B]'
                    }`}
                  >
                    {isChecked ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    <span>{isChecked ? 'Done' : 'Check'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400">{ab.cue}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Step: Cool-down stretches
  const renderCooldownStep = () => (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl bg-[#14181D] border border-[#222933] space-y-2">
        <div className="flex items-center gap-2 text-sky-400">
          <Heart className="w-5 h-5" />
          <h3 className="text-base font-bold text-white">{slotInfo.workoutType} Static Cool-down</h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          5 minutes. Hold each stretch for 30 to 45 seconds to reset muscle tonus and speed recovery before cardio.
        </p>
      </div>

      <div className="space-y-3">
        {slotInfo.cooldown.map((stretch) => {
          const isChecked = !!cooldownChecks[stretch.id];
          return (
            <div
              key={stretch.id}
              className={`p-4 rounded-2xl border transition-all ${
                isChecked
                  ? 'bg-[#14181D]/60 border-[#222933] opacity-75'
                  : 'bg-[#14181D] border-[#222933]'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <span className={`block text-sm font-bold ${isChecked ? 'line-through text-slate-400' : 'text-white'}`}>
                    {stretch.name}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Hold: {stretch.holdSeconds} sec
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setCooldownChecks((c) => ({ ...c, [stretch.id]: !c[stretch.id] }))}
                  className={`min-h-[44px] px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 active:scale-95 ${
                    isChecked
                      ? 'bg-[#B6FF3B] text-black'
                      : 'bg-[#0B0D10] border border-[#222933] text-slate-300 hover:border-[#B6FF3B]'
                  }`}
                >
                  {isChecked ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  <span>{isChecked ? 'Done' : 'Mark'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-400">{stretch.cue}</p>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Step: Cardio (Sprints on P3 Days 2 & 5, LISS on other days)
  const renderCardioStep = () => {
    const isSprints = isPhase3 && slotInfo.cardioType === 'Sprints';

    if (isSprints) {
      return (
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-[#14181D] border border-amber-500/30 text-center space-y-4 shadow-xl">
            <div className="flex items-center justify-center gap-2 text-amber-400">
              <Zap className="w-6 h-6" />
              <span className="text-xs font-extrabold uppercase tracking-wider">
                Phase 3 Sprint Protocol
              </span>
            </div>

            <h3 className="text-xl font-extrabold text-white">
              4 to 6 Sprints × 100-150m Full Effort
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Run like someone is chasing you! 100% maximum intensity. Spikes growth hormone and burns stubborn fat without sacrificing muscle.
            </p>

            {/* Sprint Counter & Walk Back Timer */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-[#0B0D10] border border-[#222933]">
              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-semibold">
                  Sprints Done
                </span>
                <span className="text-3xl font-extrabold font-mono text-white tabular-nums">
                  {sprintCount} / 6
                </span>
                <span className="block text-[10px] text-[#B6FF3B] mt-0.5">
                  {sprintCount >= 4 ? 'Goal Met (4+ sprints)' : `${4 - sprintCount} more needed`}
                </span>
              </div>

              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-semibold">
                  Walk Back Timer
                </span>
                <span className="text-3xl font-extrabold font-mono text-amber-400 tabular-nums">
                  {walkBackTimer}s
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  {isWalkBackActive ? 'Walking back to start' : '60-90s walk'}
                </span>
              </div>
            </div>

            {/* Sprint Action Buttons */}
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  const nextCount = Math.min(6, sprintCount + 1);
                  setSprintCount(nextCount);
                  handleStartWalkBackTimer(75);
                  soundController.playSetSuccess();
                  onShowToast(`Sprint ${nextCount} finished! 75s walk back started`, 'success');
                }}
                className="flex-1 min-h-[48px] rounded-xl bg-[#B6FF3B] text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-[#B6FF3B]/10 hover:bg-[#a6ec31]"
              >
                <Zap className="w-4 h-4" />
                <span>Log Sprint & Walk Back</span>
              </button>

              <button
                type="button"
                onClick={() => setSprintCount(0)}
                className="min-h-[48px] px-3.5 rounded-xl bg-[#0B0D10] border border-[#222933] text-slate-400 hover:text-white"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Bad Weather Option */}
            <div className="p-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-left text-xs text-slate-400 space-y-1">
              <span className="font-bold text-slate-300">Bad Weather Option:</span>
              <p className="text-[11px] leading-relaxed">
                Stationary bike: 30 seconds all-out sprint at max resistance, followed by 60 seconds light spinning. Repeat 5-6 rounds.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Default LISS Stopwatch (15-20 min)
    const minutes = Math.floor(cardioSeconds / 60);
    const seconds = cardioSeconds % 60;
    const isTargetMet = minutes >= 15;

    return (
      <div className="space-y-4">
        <div className="p-6 rounded-3xl bg-[#14181D] border border-[#222933] text-center space-y-4 shadow-xl">
          <div className="flex items-center justify-center gap-2 text-[#FF8C3B]">
            <Timer className="w-6 h-6" />
            <span className="text-xs font-extrabold uppercase tracking-wider">
              Post-Workout LISS Cardio
            </span>
          </div>

          <h3 className="text-xl font-extrabold text-white">
            15 Minutes Zone 2 Steady State
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Treadmill incline walk, cycling, or cross trainer at a conversation pace. Burns free fatty acids released from heavy lifting.
          </p>

          <div className="py-6 px-4 rounded-2xl bg-[#0B0D10] border border-[#222933] inline-block w-full max-w-xs mx-auto">
            <span className="block text-4xl sm:text-5xl font-mono font-extrabold text-white tabular-nums tracking-tight">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
            <span className="block text-xs font-semibold uppercase tracking-wider mt-2 text-[#B6FF3B]">
              {isTargetMet ? 'Goal Achieved (15+ min)' : `${Math.max(0, 15 - minutes)} min left to target`}
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsCardioRunning(!isCardioRunning)}
              className={`min-h-[48px] px-6 rounded-xl font-extrabold text-sm flex items-center gap-2 shadow-lg active:scale-95 transition-all ${
                isCardioRunning
                  ? 'bg-amber-500 text-black shadow-amber-500/20'
                  : 'bg-[#B6FF3B] text-black shadow-[#B6FF3B]/20'
              }`}
            >
              {isCardioRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-black" />}
              <span>{isCardioRunning ? 'Pause Cardio' : 'Start Stopwatch'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsCardioRunning(false);
                setCardioSeconds(0);
              }}
              className="min-h-[48px] px-4 rounded-xl bg-[#0B0D10] border border-[#222933] text-slate-400 hover:text-white"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Step: Workout Summary
  const renderSummaryStep = () => {
    const totalVolume = calculateTotalVolume();
    const completedSets = calculateCompletedSets();
    const cardioMins = Math.round(cardioSeconds / 60);

    return (
      <div className="p-6 rounded-3xl bg-[#14181D] border border-[#222933] text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-[#B6FF3B]/10 border border-[#B6FF3B]/30 flex items-center justify-center text-[#B6FF3B] mx-auto shadow-lg shadow-[#B6FF3B]/10">
          <Award className="w-8 h-8" />
        </div>

        <div>
          <span className="text-xs font-bold text-[#B6FF3B] uppercase tracking-wider">
            {isPhase1
              ? 'Phase 1 Session Logged'
              : isPhase3
              ? 'Phase 3 Session Logged'
              : 'Phase 2 Session Logged'}
          </span>
          <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1">
            Sensational Performance!
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Workout recorded for Day {selectedDayNumber}.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 p-4 rounded-2xl bg-[#0B0D10] border border-[#222933] text-center">
          <div>
            <span className="block text-[10px] text-slate-500 uppercase font-semibold">Sets Done</span>
            <span className="text-lg font-extrabold text-white font-mono">{completedSets}</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 uppercase font-semibold">Volume</span>
            <span className="text-lg font-extrabold text-[#B6FF3B] font-mono">{totalVolume} kg</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 uppercase font-semibold">Cardio</span>
            <span className="text-lg font-extrabold text-sky-400 font-mono">
              {slotInfo.cardioType === 'Sprints' ? `${sprintCount} Sprints` : `${cardioMins}m Cardio`}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
          {isPhase1
            ? 'Great job mastering the foundational movements! Stay hydrated and eat clean home food today.'
            : isPhase3
            ? 'Reminder: Enjoy your post-workout carbs (extra whole wheat roti, rice, or banana) to fuel recovery!'
            : 'Next step: Head to the Eat screen to log your post-workout whey scoop and break fast at 12 PM!'}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-48">
      {/* Session Status Modifier Bar */}
      <div className="p-3 rounded-2xl bg-[#14181D] border border-[#222933] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="text-[11px] text-slate-400 font-semibold uppercase">Session Mode:</span>
          <button
            type="button"
            onClick={() => setSessionStatus('normal')}
            className={`px-2.5 min-h-[36px] rounded-lg text-[11px] font-bold ${sessionStatus === 'normal' ? 'bg-[#B6FF3B] text-black' : 'text-slate-400 hover:text-white'}`}
          >
            Normal
          </button>
          <button
            type="button"
            onClick={() => setSessionStatus('modified')}
            className={`px-2.5 min-h-[36px] rounded-lg text-[11px] font-bold ${sessionStatus === 'modified' ? 'bg-amber-400 text-black' : 'text-slate-400 hover:text-white'}`}
          >
            Modified
          </button>
          <button
            type="button"
            onClick={() => setSessionStatus('rest')}
            className={`px-2.5 min-h-[36px] rounded-lg text-[11px] font-bold ${sessionStatus === 'rest' ? 'bg-sky-400 text-black' : 'text-slate-400 hover:text-white'}`}
          >
            Rest Day
          </button>
          <button
            type="button"
            onClick={() => setSessionStatus('skipped')}
            className={`px-2.5 min-h-[36px] rounded-lg text-[11px] font-bold ${sessionStatus === 'skipped' ? 'bg-purple-400 text-black' : 'text-slate-400 hover:text-white'}`}
          >
            Skipped
          </button>
        </div>
        <span className="text-[10px] text-slate-500 font-medium">Streak not penalized</span>
      </div>

      {/* Top Header & Step Tracker */}
      <div className="flex items-center justify-between text-xs px-1 text-slate-400">
        <span className="font-bold text-white uppercase tracking-wider truncate max-w-[200px]">
          {slotInfo.title}
        </span>
        <span className="font-mono">
          Step {currentStep + 1} of {totalSteps}
        </span>
      </div>

      {/* Progress Dots across top */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        {Array.from({ length: totalSteps }).map((_, stepIdx) => (
          <button
            key={stepIdx}
            type="button"
            onClick={() => setCurrentStep(stepIdx)}
            aria-label={`Jump to step ${stepIdx + 1}`}
            className="h-9 min-w-[32px] px-0.5 flex items-center justify-center"
          >
            <span
              className={`block h-2 rounded-full transition-all duration-300 ${
                stepIdx === currentStep
                  ? 'w-7 bg-[#B6FF3B]'
                  : stepIdx < currentStep
                  ? 'w-3 bg-[#B6FF3B]/50'
                  : 'w-2 bg-[#222933]'
              }`}
            />
          </button>
        ))}
      </div>

      {/* Rest Timer Floating Banner */}
      {renderRestTimerBar()}

      {/* Dynamic Content based on currentStep */}
      {currentStep === 0 && renderWarmupStep()}
      {currentStep >= 1 && currentStep <= totalExercises && renderExerciseStep()}
      {currentStep === totalExercises + 1 && renderAbsStep()}
      {currentStep === totalExercises + 2 && renderCooldownStep()}
      {currentStep === totalExercises + 3 && renderCardioStep()}
      {currentStep === totalExercises + 4 && renderSummaryStep()}

      {/* Bottom Sticky Step Navigation */}
      <div className="fixed bottom-[calc(4rem+max(env(safe-area-inset-bottom,0px),16px))] left-0 right-0 z-30 p-3 bg-gradient-to-t from-[#0B0D10] via-[#0B0D10]/95 to-transparent">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="min-h-[44px] px-4 rounded-xl bg-[#14181D] border border-[#222933] text-slate-300 hover:text-white disabled:opacity-40 text-xs font-semibold flex items-center gap-1 active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Prev</span>
          </button>

          {currentStep === totalSteps - 2 ? (
            <button
              type="button"
              onClick={handleFinishWorkout}
              className="flex-1 min-h-[48px] px-6 rounded-xl bg-[#B6FF3B] text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#B6FF3B]/20 active:scale-95 hover:bg-[#a6ec31]"
            >
              <Award className="w-4 h-4" />
              <span>Finish Workout</span>
            </button>
          ) : currentStep < totalSteps - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
              className="flex-1 min-h-[48px] px-6 rounded-xl bg-[#14181D] border border-slate-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:border-[#B6FF3B] active:scale-95"
            >
              <span>Next Step</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="flex-1 min-h-[48px] px-6 rounded-xl bg-[#B6FF3B] text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <span>Review Exercises</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
