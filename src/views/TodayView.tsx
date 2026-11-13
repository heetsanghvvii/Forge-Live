import React, { useRef, useEffect, useState } from 'react';
import { HabitReminders } from '../components/HabitReminders';
import { AppState, DailyChecklist, TabType, DailyLog, PhaseType } from '../types';
import { getSlotInfo } from '../data/workoutData';
import { DAY_1_TASKS, DAY_36_TASKS } from '../data/learnData';
import { launchConfetti } from '../utils/confetti';
import { markEntered } from '../utils/entered';
import { dailyChecklistItems, dailyProgress } from '../utils/dailyProgress';
import { mealEnteredMetrics } from '../utils/settingsLogic';
import { SleepEntry } from '../components/SleepEntry';
import { NextStepsSection } from '../components/NextStepsSection';
import { parseNumberInput, fmtNum, removeMealById, subtractMacros, MAX_NAME_LEN, MAX_NOTE_LEN } from '../utils/inputs';
import {
  Flame,
  CheckCircle2,
  Circle,
  Dumbbell,
  Play,
  ArrowRight,
  Sparkles,
  Scale,
  Moon,
  Wheat,
  Footprints,
  ShieldCheck,
  Utensils,
  BatteryCharging,
  Apple,
  Activity,
  AlertCircle,
  HelpCircle,
  Plus,
  Calendar,
  Clock,
  Globe
} from 'lucide-react';

interface TodayViewProps {
  appState: AppState;
  onSelectDay: (dayNumber: number) => void;
  onToggleChecklist: (key: keyof DailyChecklist) => void;
  onNavigateTab: (tab: TabType) => void;
  streak: number;
  onUpdateDailyLog?: (dayNumber: number, partialLog: Partial<DailyLog>) => void;
  onConfirmProgramme?: (phase: PhaseType, startDate: string, timezone: string) => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  appState,
  onSelectDay,
  onToggleChecklist,
  onNavigateTab,
  streak,
  onUpdateDailyLog,
  onConfirmProgramme
}) => {
  const { currentDayNumber, selectedDayNumber, dailyLogs, settings } = appState;
  const isPhase1 = selectedDayNumber >= 1 && selectedDayNumber <= 7;
  const isPhase3 = selectedDayNumber >= 36;
  const isPhase2 = !isPhase1 && !isPhase3;

  const currentLog = dailyLogs[selectedDayNumber] || dailyLogs[currentDayNumber] || {
    date: new Date().toISOString().slice(0, 10),
    dayNumber: selectedDayNumber,
    phase: isPhase1 ? 'phase1' : isPhase3 ? 'phase3' : 'phase2',
    checklist: {
      workout: false,
      cardio: false,
      water: false,
      photo: false,
      community: false
    },
    macrosConsumed: { calories: 0, protein: 0, fat: 0, carbs: 0 },
    waterMl: 0,
    steps: 0,
    supplements: {
      whey: false,
      creatine: false,
      multivitamin: false,
      vitaminD3: false,
      carnitine: false,
      acv: false
    }
  };

  const mealList = (Array.isArray(currentLog?.mealEstimates) ? currentLog!.mealEstimates! : []).filter((m) => m && typeof m === 'object');
  const checklist = currentLog?.checklist || ({} as DailyChecklist);

  // Biofeedback local state synced with log
  const [energyRating, setEnergyRating] = useState<number | undefined>(currentLog?.energyRating);
  const [hungerRating, setHungerRating] = useState<number | undefined>(currentLog?.hungerRating);
  const [sorenessRating, setSorenessRating] = useState<number | undefined>(currentLog?.sorenessRating);
  const [painNotes, setPainNotes] = useState<string>(currentLog?.painOrIllnessNotes || '');
  const [generalNotes, setGeneralNotes] = useState<string>(currentLog?.generalNotes || '');

  // Programme confirmation state
  const [confirmPhase, setConfirmPhase] = useState<PhaseType>(settings.activePhase || 'phase1');
  const [confirmDate, setConfirmDate] = useState<string>(settings.startDate || new Date().toISOString().slice(0, 10));
  const [confirmTimezone, setConfirmTimezone] = useState<string>(settings.timezone || 'Asia/Kolkata');

  // Meal Estimate state
  const [showMealModal, setShowMealModal] = useState<boolean>(false);
  const [mealName, setMealName] = useState<string>('');
  const [mealCalories, setMealCalories] = useState<string>('350');
  const [mealProtein, setMealProtein] = useState<string>('20');
  const [mealErrors, setMealErrors] = useState<{ name?: string; calories?: string; protein?: string }>({});
  const [mealNotes, setMealNotes] = useState<string>('');
  // Prefilled 350 kcal / 20 g are only estimates until the user types a number.
  const [mealTouched, setMealTouched] = useState({ calories: false, protein: false });

  useEffect(() => {
    setEnergyRating(currentLog?.energyRating);
    setHungerRating(currentLog?.hungerRating);
    setSorenessRating(currentLog?.sorenessRating);
    setPainNotes(currentLog?.painOrIllnessNotes || '');
    setGeneralNotes(currentLog?.generalNotes || '');
  }, [selectedDayNumber, currentLog]);

  const handleSaveBiofeedback = () => {
    if (onUpdateDailyLog) {
      // Energy is saved only when the user taps a rating (no fake default), so it is not rewritten here.
      onUpdateDailyLog(selectedDayNumber, {
        ...(hungerRating !== undefined ? { hungerRating } : {}),
        ...(sorenessRating !== undefined ? { sorenessRating } : {}),
        painOrIllnessNotes: painNotes.trim(),
        generalNotes: generalNotes.trim()
      });
    }
  };

  const handleSetSessionStatus = (status: 'normal' | 'rest' | 'modified' | 'skipped') => {
    if (!onUpdateDailyLog) return;
    if (status === 'normal') {
      onUpdateDailyLog(selectedDayNumber, { isRestDay: false, isModified: false, isSkipped: false });
    } else if (status === 'rest') {
      onUpdateDailyLog(selectedDayNumber, { isRestDay: true, isModified: false, isSkipped: false });
    } else if (status === 'modified') {
      onUpdateDailyLog(selectedDayNumber, { isRestDay: false, isModified: true, isSkipped: false });
    } else if (status === 'skipped') {
      onUpdateDailyLog(selectedDayNumber, { isRestDay: false, isModified: false, isSkipped: true });
    }
  };

  const handleAddMealEstimate = () => {
    if (!onUpdateDailyLog) return;
    const name = mealName.trim().slice(0, MAX_NAME_LEN);
    const cal = parseNumberInput(mealCalories, { min: 0, max: 10000, decimals: 0, label: 'Calories' });
    const pro = parseNumberInput(mealProtein, { min: 0, max: 1000, decimals: 1, label: 'Protein' });
    const errors: { name?: string; calories?: string; protein?: string } = {};
    if (!name) errors.name = 'Enter a meal name.';
    if (!cal.ok) errors.calories = cal.error;
    if (!pro.ok) errors.protein = pro.error;
    setMealErrors(errors);
    if (!name || !cal.ok || !pro.ok) return;
    const calories = cal.value;
    const protein = pro.value;
    const newEstimate = {
      id: Date.now().toString(),
      name,
      estimateCalories: calories,
      estimateProtein: protein,
      isEstimateOnly: true,
      notes: mealNotes.trim().slice(0, MAX_NAME_LEN * 2)
    };
    const existingEstimates = Array.isArray(currentLog?.mealEstimates) ? currentLog!.mealEstimates! : [];
    const updatedEstimates = [...existingEstimates, newEstimate];
    const newCalories = (currentLog?.macrosConsumed?.calories || 0) + calories;
    const newProtein = (currentLog?.macrosConsumed?.protein || 0) + protein;

    // Only fields the user actually typed count as entered; untouched prefills stay estimates.
    let enteredLog = currentLog;
    if (enteredLog) for (const metric of mealEnteredMetrics(mealTouched)) enteredLog = markEntered(enteredLog, metric);
    const enteredPart: Partial<DailyLog> = enteredLog ? { entered: enteredLog.entered } : {};
    onUpdateDailyLog(selectedDayNumber, {
      ...enteredPart,
      mealEstimates: updatedEstimates,
      macrosConsumed: {
        ...(currentLog?.macrosConsumed || { fat: 0, carbs: 0 }),
        calories: newCalories,
        protein: newProtein
      }
    });

    setMealName('');
    setMealErrors({});
    setMealCalories('350');
    setMealProtein('20');
    setMealTouched({ calories: false, protein: false });
    setMealNotes('');
    setShowMealModal(false);
  };

  // Remove ONE meal and subtract only its own macros (never overwrites with a stale captured total).
  const handleRemoveMeal = (id: string) => {
    if (!onUpdateDailyLog || !currentLog) return;
    const meal = (Array.isArray(currentLog.mealEstimates) ? currentLog.mealEstimates : []).find((m) => m.id === id);
    if (!meal) return;
    const m = currentLog.macrosConsumed;
    onUpdateDailyLog(selectedDayNumber, {
      mealEstimates: removeMealById(currentLog.mealEstimates, id),
      macrosConsumed: {
        ...m,
        ...subtractMacros(m, { calories: meal.estimateCalories, protein: meal.estimateProtein })
      }
    });
  };

  // Dynamic checklist based on Phase (shared with Home view - one source of truth)
  const checklistItems = dailyChecklistItems(selectedDayNumber);
  const { completedCount, totalItems, progressPercent, isDayComplete } = dailyProgress(checklist, selectedDayNumber);

  const slotInfo = getSlotInfo(selectedDayNumber);

  const stripLength = isPhase1 ? 7 : 28;
  const stripStart = isPhase1 ? 1 : isPhase2 ? 8 : 36;

  const isWeeklyWeighInDay = isPhase1
    ? [1, 7].includes(selectedDayNumber)
    : isPhase2
    ? [8, 15, 22, 29, 35].includes(selectedDayNumber)
    : [36, 43, 50, 57, 63].includes(selectedDayNumber);

  const dayStripRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (dayStripRef.current) {
      const selectedEl = dayStripRef.current.querySelector(`[data-day="${selectedDayNumber}"]`) as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedDayNumber]);

  const prevCompletedRef = useRef(completedCount);
  useEffect(() => {
    if (completedCount === totalItems && prevCompletedRef.current < totalItems) {
      launchConfetti();
    }
    prevCompletedRef.current = completedCount;
  }, [completedCount, totalItems]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const programmeConfirmRef = useRef<HTMLDivElement | null>(null);

  const ringSize = 130;
  const strokeWidth = 10;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="space-y-6 pb-24">
      {/* Programme Confirmation Banner (Required: never silently start on Day 8) */}
      {!settings.confirmedProgrammeStart && (
        <div ref={programmeConfirmRef} className="p-5 rounded-3xl bg-[#14181D] border-2 border-[#B6FF3B]/50 shadow-xl space-y-4 animate-in fade-in">
          <div className="flex items-center gap-2.5 text-[#B6FF3B]">
            <Calendar className="w-5 h-5 shrink-0" />
            <h3 className="text-sm sm:text-base font-extrabold text-white">
              Confirm Programme Setup & Start Date
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Please confirm your preferred starting phase, calendar start date, and timezone. All dates will align with your chosen schedule.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Starting Phase</label>
              <select
                value={confirmPhase}
                onChange={(e) => setConfirmPhase(e.target.value as PhaseType)}
                className="w-full h-10 px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-white text-xs font-semibold focus:outline-none focus:border-[#B6FF3B]"
              >
                <option value="phase1">Phase 1: Foundation (Days 1 to 7)</option>
                <option value="phase2">Phase 2: Base Building (Days 8 to 35)</option>
                <option value="phase3">Phase 3: Muscle Building (Days 36 to 63)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Start Date</label>
              <input
                type="date"
                value={confirmDate}
                onChange={(e) => setConfirmDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-white text-xs font-mono focus:outline-none focus:border-[#B6FF3B]"
              >
              </input>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Timezone</label>
              <input
                type="text"
                value={confirmTimezone}
                onChange={(e) => setConfirmTimezone(e.target.value)}
                placeholder="Asia/Kolkata"
                className="w-full h-10 px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-white text-xs font-mono focus:outline-none focus:border-[#B6FF3B]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onConfirmProgramme) {
                onConfirmProgramme(confirmPhase, confirmDate, confirmTimezone);
              }
            }}
            className="w-full min-h-[44px] rounded-xl bg-[#B6FF3B] text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#a6ec31] shadow-lg shadow-[#B6FF3B]/10 active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-4 h-4 fill-black text-[#B6FF3B]" />
            <span>Confirm Programme Start</span>
          </button>
        </div>
      )}

      {/* Hero Greeting and Day Counters */}
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#B6FF3B]">
            {getGreeting()}, Champion
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-0.5">
            Day {selectedDayNumber} of 100
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isPhase1 ? 'Phase 1 (Foundation & Detox)' : isPhase2 ? 'Phase 2 (Building the Base)' : 'Phase 3 (Muscle Building)'}: Day {slotInfo.phaseDay} of {isPhase1 ? 7 : 28}
          </p>
        </div>

        {/* Streak Counter */}
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#14181D] border border-[#222933] shadow-md shrink-0">
          <Flame className="w-5 h-5 text-[#FF8C3B]" />
          <div className="text-right">
            <span className="block text-base font-extrabold text-white tabular-nums leading-none">
              {streak}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">
              Day Streak
            </span>
          </div>
        </div>
      </div>

      {selectedDayNumber !== currentDayNumber && (
        <button
          type="button"
          onClick={() => onSelectDay(currentDayNumber)}
          className="w-full min-h-[44px] rounded-xl border border-[#B6FF3B]/40 bg-[#B6FF3B]/10 text-[#B6FF3B] text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          <span>Back to today (Day {currentDayNumber})</span>
        </button>
      )}

      {/* Session Status Chips (Rest, Modified, Skipped without punishing streaks) */}
      <div className="p-3.5 rounded-2xl bg-[#14181D] border border-[#222933] flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-400 text-[11px] font-semibold uppercase">Session Status:</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSetSessionStatus('normal')}
            className={`px-3 min-h-[36px] rounded-lg font-bold text-[11px] transition-colors ${
              !currentLog?.isRestDay && !currentLog?.isModified && !currentLog?.isSkipped
                ? 'bg-[#B6FF3B] text-black'
                : 'bg-[#0B0D10] text-slate-400 hover:text-white'
            }`}
          >
            Normal
          </button>
          <button
            type="button"
            onClick={() => handleSetSessionStatus('rest')}
            className={`px-3 min-h-[36px] rounded-lg font-bold text-[11px] transition-colors ${
              currentLog?.isRestDay
                ? 'bg-sky-400 text-black'
                : 'bg-[#0B0D10] text-slate-400 hover:text-white'
            }`}
          >
            Rest Day
          </button>
          <button
            type="button"
            onClick={() => handleSetSessionStatus('modified')}
            className={`px-3 min-h-[36px] rounded-lg font-bold text-[11px] transition-colors ${
              currentLog?.isModified
                ? 'bg-amber-400 text-black'
                : 'bg-[#0B0D10] text-slate-400 hover:text-white'
            }`}
          >
            Modified
          </button>
          <button
            type="button"
            onClick={() => handleSetSessionStatus('skipped')}
            className={`px-3 min-h-[36px] rounded-lg font-bold text-[11px] transition-colors ${
              currentLog?.isSkipped
                ? 'bg-purple-400 text-black'
                : 'bg-[#0B0D10] text-slate-400 hover:text-white'
            }`}
          >
            Skipped
          </button>
        </div>
      </div>

      {/* Horizontal Swipeable Day Strip */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs px-1 text-slate-400">
          <span className="font-semibold text-slate-300">
            {isPhase1 ? 'Phase 1 Calendar (Days 1 to 7)' : isPhase2 ? 'Phase 2 Calendar (Days 8 to 35)' : 'Phase 3 Calendar (Days 36 to 63)'}
          </span>
          <span>Tap day to inspect</span>
        </div>

        <div
          ref={dayStripRef}
          className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 -mx-4 px-4 scroll-smooth"
        >
          {Array.from({ length: stripLength }).map((_, i) => {
            const dayNum = stripStart + i;
            const pDay = i + 1;
            const daySlot = getSlotInfo(dayNum);
            const isToday = dayNum === currentDayNumber;
            const isSelected = dayNum === selectedDayNumber;
            const dayLog = dailyLogs[dayNum];
            const isDone = dayLog && Object.values(dayLog.checklist).filter(Boolean).length >= (isPhase1 ? 4 : 6);

            return (
              <button
                key={dayNum}
                data-day={dayNum}
                type="button"
                onClick={() => onSelectDay(dayNum)}
                className={`min-w-[56px] h-20 rounded-2xl flex flex-col items-center justify-between p-2.5 transition-all shrink-0 active:scale-95 ${
                  isSelected
                    ? 'bg-[#B6FF3B] text-black shadow-lg shadow-[#B6FF3B]/20 font-bold scale-105'
                    : isToday
                    ? 'bg-[#14181D] border-2 border-[#B6FF3B] text-white'
                    : daySlot.isRest
                    ? 'bg-[#14181D]/40 border border-[#222933]/60 text-slate-500'
                    : 'bg-[#14181D] border border-[#222933] text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] uppercase font-bold tracking-tight ${isSelected ? 'text-black/80' : 'text-slate-400'}`}>
                    D{pDay}
                  </span>
                  {isDone && !isSelected && (
                    <CheckCircle2 className="w-3 h-3 text-[#B6FF3B]" />
                  )}
                </div>

                <span className={`text-base font-extrabold tabular-nums ${isSelected ? 'text-black' : 'text-white'}`}>
                  {dayNum}
                </span>

                <span className={`text-[9px] font-semibold truncate max-w-[48px] uppercase ${isSelected ? 'text-black/90' : daySlot.isRest ? 'text-slate-600' : 'text-slate-400'}`}>
                  {daySlot.workoutType.replace('Phase 1: ', '').replace('Phase 3: ', '')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress Ring & Daily Summary Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#14181D] border border-[#222933] shadow-lg flex flex-col sm:flex-row items-center gap-6">
        <div className="relative shrink-0 flex items-center justify-center">
          <svg width={ringSize} height={ringSize} className="transform -rotate-90">
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke="#222933"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke="#B6FF3B"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-500 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-extrabold text-white tabular-nums leading-none">
              {progressPercent}%
            </span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight mt-1">
              {completedCount} of {totalItems}
            </span>
          </div>
        </div>

        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <Sparkles className="w-4 h-4 text-[#B6FF3B]" />
            <h3 className="text-base font-bold text-white tracking-tight">
              {isDayComplete ? 'Day Complete! Outstanding Work' : "Today's Execution Target"}
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isDayComplete
              ? 'All daily non-negotiables completed. Recovery mode active!'
              : `Tick each requirement to maintain your ${streak}-day streak and groove in physical discipline.`}
          </p>

          {isWeeklyWeighInDay && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FF8C3B]/10 border border-[#FF8C3B]/30 text-[#FF8C3B] text-xs font-semibold">
              <Scale className="w-3.5 h-3.5" />
              <span>Weigh-in Day: Check morning scale weight</span>
            </div>
          )}
        </div>
      </div>

      {/* Next Steps Section */}
      <NextStepsSection
        appState={appState}
        onNavigateTab={onNavigateTab}
        onConfirmScheduleClick={() => {
          if (programmeConfirmRef.current) {
            programmeConfirmRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
      />

      {/* Today's Workout Session Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#14181D] border border-[#222933] shadow-lg space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-[#B6FF3B]" />
              <span className="text-xs font-bold text-[#B6FF3B] uppercase tracking-wider">
                {slotInfo.isRest ? 'Rest Day' : isPhase1 ? 'Foundation Full Body' : isPhase3 ? 'Muscle Building Session' : 'Scheduled Training'}
              </span>
            </div>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              {slotInfo.title}
            </h3>
          </div>

          <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#0B0D10] border border-[#222933] text-slate-300">
            Day {slotInfo.phaseDay}/{isPhase1 ? 7 : 28}
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {slotInfo.isRest
            ? 'Rest day. Muscles grow during recovery. Eat clean home-cooked Indian food and hydrate well.'
            : isPhase1
            ? '10 Fundamental Full Body Exercises. Focus on technique, controlled negatives, and no swinging.'
            : isPhase3
            ? `${slotInfo.exercises.length} Exercises with supersets, drop sets, and post-workout ${slotInfo.cardioType}.`
            : `${slotInfo.exercises.length} Heavy Lifts + Abs routine + 15-20 min post-weights LISS cardio.`}
        </p>

        <button
          type="button"
          onClick={() => onNavigateTab('train')}
          className="w-full min-h-[48px] rounded-xl bg-[#B6FF3B] text-black font-extrabold text-sm flex items-center justify-center gap-2 hover:bg-[#a6ec31] shadow-lg shadow-[#B6FF3B]/15 active:scale-98 transition-all"
        >
          <Play className="w-4 h-4 fill-black" />
          <span>{slotInfo.isRest ? 'View Rest Guidelines' : 'Start Workout Session'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <SleepEntry
        log={currentLog}
        onChange={(partial) => { if (onUpdateDailyLog) onUpdateDailyLog(selectedDayNumber, partial); }}
      />

      {/* Biofeedback & Recovery Tracker (Energy, Hunger, Soreness, Pain/Illness Notes) */}
      <div className="p-5 rounded-2xl bg-[#14181D] border border-[#222933] space-y-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-1 pb-2 border-b border-[#222933]">
          <div className="flex items-center gap-2">
            <BatteryCharging className="w-4 h-4 text-[#B6FF3B]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Subjective Biofeedback & Recovery
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 font-semibold uppercase">Private Notes</span>
        </div>

        {/* Energy Rating: 1 to 10 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">Energy Level (1 to 10)</span>
            <span className="font-mono font-bold text-[#B6FF3B]">{typeof energyRating === 'number' && Number.isFinite(energyRating) ? `${energyRating} / 10` : 'Not logged'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1 py-1">
            {Array.from({ length: 10 }).map((_, i) => {
              const val = i + 1;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setEnergyRating(val);
                    if (onUpdateDailyLog) {
                      onUpdateDailyLog(selectedDayNumber, {
                        energyRating: val,
                        ...(currentLog ? { entered: markEntered(currentLog, 'energy').entered } : {})
                      });
                    }
                  }}
                  className={`flex-1 min-w-[30px] min-h-[36px] rounded-lg text-xs font-mono font-bold transition-colors ${
                    energyRating === val
                      ? 'bg-[#B6FF3B] text-black'
                      : 'bg-[#0B0D10] border border-[#222933] text-slate-400 hover:text-white'
                  }`}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hunger & Soreness Ratings: 1 to 5 */}
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Hunger (1-5)</span>
              <span className="font-mono font-bold text-amber-400">{hungerRating === undefined ? '—' : `${fmtNum(hungerRating)}/5`}</span>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setHungerRating(val);
                    if (onUpdateDailyLog) onUpdateDailyLog(selectedDayNumber, { hungerRating: val });
                  }}
                  className={`flex-1 min-w-0 min-h-[36px] rounded-lg text-xs font-mono font-bold transition-colors ${
                    hungerRating === val
                      ? 'bg-amber-400 text-black'
                      : 'bg-[#0B0D10] border border-[#222933] text-slate-400 hover:text-white'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Soreness (1-5)</span>
              <span className="font-mono font-bold text-rose-400">{sorenessRating === undefined ? '—' : `${fmtNum(sorenessRating)}/5`}</span>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setSorenessRating(val);
                    if (onUpdateDailyLog) onUpdateDailyLog(selectedDayNumber, { sorenessRating: val });
                  }}
                  className={`flex-1 min-w-0 min-h-[36px] rounded-lg text-xs font-mono font-bold transition-colors ${
                    sorenessRating === val
                      ? 'bg-rose-400 text-black'
                      : 'bg-[#0B0D10] border border-[#222933] text-slate-400 hover:text-white'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pain / Illness Notes */}
        <div className="space-y-1.5 pt-1">
          <label className="block text-xs font-semibold text-slate-300">
            Pain or Illness Notes (Optional & Private)
          </label>
          <textarea
            rows={2}
            value={painNotes}
            maxLength={MAX_NOTE_LEN}
            onChange={(e) => setPainNotes(e.target.value)}
            onBlur={handleSaveBiofeedback}
            placeholder="e.g. Mild right knee tightness after squats, slight head cold..."
            className="w-full p-2.5 rounded-xl bg-[#0B0D10] border border-[#222933] text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-[#B6FF3B] transition-colors"
          />
          <p className="text-[10px] text-slate-500 text-right">{painNotes.length}/{MAX_NOTE_LEN}</p>
        </div>

        {/* General notes */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-300">General Notes (Optional)</label>
          <textarea
            rows={2}
            value={generalNotes}
            maxLength={MAX_NOTE_LEN}
            onChange={(e) => setGeneralNotes(e.target.value)}
            onBlur={handleSaveBiofeedback}
            className="w-full p-2.5 rounded-xl bg-[#0B0D10] border border-[#222933] text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-[#B6FF3B] transition-colors"
          />
          <p className="text-[10px] text-slate-500 text-right">{generalNotes.length}/{MAX_NOTE_LEN}</p>
        </div>

        {/* Meal Estimates Section (Labeled Estimates Only) */}
        <div className="pt-2 border-t border-[#222933] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Meal Estimates (Portion Estimates)</span>
            <button
              type="button"
              onClick={() => setShowMealModal(true)}
              className="min-h-[36px] text-[11px] font-bold text-[#B6FF3B] flex items-center gap-1 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Meal Estimate</span>
            </button>
          </div>

          {mealList.length > 0 && (
            <div className="space-y-1.5">
              {mealList.map((m) => (
                <div key={m.id} className="p-2.5 rounded-xl bg-[#0B0D10] border border-[#222933] flex items-center justify-between gap-2 text-xs min-w-0">
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white block break-words [overflow-wrap:anywhere] line-clamp-2">{m.name}</span>
                    <span className="text-[10px] text-amber-400 font-semibold uppercase">Portion Estimate</span>
                  </div>
                  <div className="text-right font-mono shrink-0">
                    <span className="text-white block font-bold">~{fmtNum(m.estimateCalories)} kcal</span>
                    <span className="text-[#B6FF3B] text-[11px]">~{fmtNum(m.estimateProtein)}g protein</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMeal(m.id)}
                    aria-label={`Remove ${m.name}`}
                    className="shrink-0 min-h-[36px] min-w-[36px] px-2 rounded-lg border border-slate-700 text-slate-300 text-[11px] font-bold hover:text-white"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Meal Estimate Modal */}
      {showMealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#14181D] border border-[#222933] rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#222933]">
              <h4 className="text-sm font-bold text-white">Log Meal Estimate</h4>
              <button
                type="button"
                onClick={() => setShowMealModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
            <p className="text-[11px] text-amber-300/80 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
              Note: Values are marked as estimates and can be modified at any time.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Meal / Food Item Name</label>
                <input
                  type="text"
                  placeholder="e.g. 2 Moong Dal Chillas + Curd"
                  value={mealName}
                  maxLength={MAX_NAME_LEN}
                  onChange={(e) => setMealName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-white focus:outline-none focus:border-[#B6FF3B]"
                />
                {mealErrors.name && <p className="mt-1 text-[10px] text-amber-400" role="alert">{mealErrors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Est Calories</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    maxLength={6}
                    value={mealCalories}
                    onChange={(e) => { setMealTouched((t) => ({ ...t, calories: true })); setMealCalories(e.target.value); }}
                    className="w-full h-10 px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-white font-mono focus:outline-none focus:border-[#B6FF3B]"
                  />
                  {mealErrors.calories && <p className="mt-1 text-[10px] text-amber-400" role="alert">{mealErrors.calories}</p>}
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Est Protein (g)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    maxLength={6}
                    value={mealProtein}
                    onChange={(e) => { setMealTouched((t) => ({ ...t, protein: true })); setMealProtein(e.target.value); }}
                    className="w-full h-10 px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-white font-mono focus:outline-none focus:border-[#B6FF3B]"
                  />
                  {mealErrors.protein && <p className="mt-1 text-[10px] text-amber-400" role="alert">{mealErrors.protein}</p>}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Notes / Ingredients</label>
                <input
                  type="text"
                  placeholder="e.g. Home cooked, no onion no garlic"
                  value={mealNotes}
                  maxLength={MAX_NAME_LEN * 2}
                  onChange={(e) => setMealNotes(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-white focus:outline-none focus:border-[#B6FF3B]"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddMealEstimate}
              className="w-full min-h-[42px] rounded-xl bg-[#B6FF3B] text-black font-extrabold text-xs uppercase tracking-wider hover:bg-[#a6ec31] active:scale-95"
            >
              Add Estimate to Day Log
            </button>
          </div>
        </div>
      )}

      {/* Daily Checklist */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-white tracking-tight uppercase tracking-wider">
            {isPhase1 ? 'Phase 1 Daily Habits' : isPhase3 ? 'Phase 3 Daily Checklist' : 'Daily Non-Negotiable Checklist'}
          </h3>
          <span className="text-xs font-mono text-slate-400">
            {completedCount}/{totalItems} Done
          </span>
        </div>

        <div className="space-y-2.5">
          {checklistItems.map((item) => {
            const isChecked = !!checklist[item.key];
            const Icon = item.icon;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onToggleChecklist(item.key)}
                className={`w-full min-h-[56px] p-3.5 rounded-2xl border flex items-center justify-between gap-3.5 text-left transition-all duration-200 active:scale-98 ${
                  isChecked
                    ? 'bg-[#14181D]/60 border-[#222933]/80 opacity-75'
                    : 'bg-[#14181D] border-[#222933] hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      isChecked
                        ? 'bg-[#B6FF3B] text-black scale-105'
                        : 'bg-[#0B0D10] border border-[#222933] text-slate-600'
                    }`}
                  >
                    {isChecked ? (
                      <CheckCircle2 className="w-5 h-5 fill-[#B6FF3B] text-black" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs sm:text-sm font-bold transition-all ${
                          isChecked ? 'line-through text-slate-500' : 'text-slate-100'
                        }`}
                      >
                        {item.label}
                      </span>
                      {Icon && <Icon className="w-3 h-3 text-[#B6FF3B]" />}
                    </div>
                    <span className="block text-[11px] text-slate-400 truncate">
                      {item.desc}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 ml-3 text-[10px] font-mono text-slate-500 uppercase">
                  {isChecked ? 'Done' : 'Pending'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Habits and reminders: tracked daily, stored on this device only */}
      <HabitReminders />
    </div>
  );
};
