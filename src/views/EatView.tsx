import React, { useState, useEffect, useRef } from 'react';
import { AppState, Macros, PhaseType } from '../types';
import {
  JAIN_OPTION_A,
  JAIN_OPTION_B,
  PHASE_3_CARB_ADDONS,
  PROTEIN_REFERENCE_TABLE,
  SUPPLEMENTS_LIST,
  calculateMacros,
  MealItem,
  CarbAddon
} from '../data/nutritionData';
import {
  addMacros,
  subtractMacros,
  addToCounter,
  undoCounterDelta,
  deltaToReachGoal,
  parseNumberInput,
  fmtNum,
  MAX_WATER_ML,
  MAX_STEPS
} from '../utils/inputs';
import {
  Clock,
  Flame,
  Droplets,
  Footprints,
  Plus,
  CheckCircle2,
  Circle,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  Calculator,
  Utensils,
  Wheat,
  Moon
} from 'lucide-react';

interface EatViewProps {
  appState: AppState;
  onUpdateMacros: (macros: Macros) => void;
  onUpdateWater: (waterMl: number) => void;
  onUpdateSteps: (steps: number) => void;
  onToggleSupplement: (supId: string) => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning', undo?: () => void) => void;
}

export const EatView: React.FC<EatViewProps> = ({
  appState,
  onUpdateMacros,
  onUpdateWater,
  onUpdateSteps,
  onToggleSupplement,
  onShowToast
}) => {
  const { selectedDayNumber, dailyLogs, settings } = appState;
  const isPhase1 = selectedDayNumber >= 1 && selectedDayNumber <= 7;
  const isPhase3 = selectedDayNumber >= 36;
  const activePhase: PhaseType = isPhase1 ? 'phase1' : isPhase3 ? 'phase3' : 'phase2';

  const currentLog = dailyLogs[selectedDayNumber];
  const consumed = currentLog?.macrosConsumed || { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const waterMl = Number.isFinite(currentLog?.waterMl) ? (currentLog!.waterMl as number) : 0;
  const steps = Number.isFinite(currentLog?.steps) ? (currentLog!.steps as number) : 0;
  const supplements = currentLog?.supplements || {
    whey: false,
    creatine: false,
    multivitamin: false,
    vitaminD3: false,
    carnitine: false,
    acv: false
  };

  // Undo must apply an inverse delta to the LATEST value, never restore a value captured at click time.
  const latest = useRef({ consumed, waterMl, steps });
  latest.current = { consumed, waterMl, steps };

  // Macro Target calculation based on user settings and phase
  const macroTargets = calculateMacros(settings.bodyweightKg, activePhase);

  // Calculator Interactive Form State
  const [calcBwText, setCalcBwText] = useState<string>(settings.bodyweightKg ? String(settings.bodyweightKg) : '');
  const [showCalculator, setShowCalculator] = useState<boolean>(false);
  const calcParsed = parseNumberInput(calcBwText, { min: 20, max: 400, decimals: 1, label: 'Bodyweight' });
  const calcBw = calcParsed.ok ? calcParsed.value : 0;
  const interactiveCalc = calculateMacros(calcBw, activePhase);

  // Fasting 16:8 countdown calculations
  const [nowDate, setNowDate] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNowDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getFastingStatus = () => {
    const currentHour = nowDate.getHours();
    const startH = settings.fastingStartHour; // 8 PM
    const endH = settings.fastingEndHour; // 12 PM

    const isEatingWindow = currentHour >= endH && currentHour < startH;

    let targetDate = new Date(nowDate);
    if (isEatingWindow) {
      targetDate.setHours(startH, 0, 0, 0);
    } else {
      if (currentHour >= startH) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      targetDate.setHours(endH, 0, 0, 0);
    }

    const diffMs = Math.max(0, targetDate.getTime() - nowDate.getTime());
    const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
    const minsLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const secsLeft = Math.floor((diffMs % (1000 * 60)) / 1000);

    return {
      isEatingWindow,
      countdownStr: `${String(hoursLeft).padStart(2, '0')}:${String(minsLeft).padStart(2, '0')}:${String(secsLeft).padStart(2, '0')}`,
      label: isEatingWindow ? 'Eating window open (Window closes in)' : 'Fasting actively (Window opens in)'
    };
  };

  const fasting = getFastingStatus();

  // Apply a macro delta; Undo subtracts only this action's delta from whatever the total is now.
  const applyMacroDelta = (delta: Partial<Macros>, text: string) => {
    onUpdateMacros(addMacros(latest.current.consumed, delta));
    onShowToast(text, 'success', () => {
      onUpdateMacros(subtractMacros(latest.current.consumed, delta));
    });
  };

  // Quick-Add Protein handlers
  const handleQuickAddProtein = (grams: number, calories: number, label: string) => {
    applyMacroDelta({ protein: grams, calories }, `Added +${grams}g protein (${label})`);
  };

  // Quick-Add Carbs (Phase 3 add-ons)
  const handleAddCarbOption = (addon: CarbAddon) => {
    applyMacroDelta({ calories: addon.calories, carbs: addon.carbsGrams }, `Logged +${addon.carbsGrams}g carbs (${addon.name})`);
  };

  // Add meal from Option A or B
  const handleLogMealItem = (meal: MealItem) => {
    applyMacroDelta(
      { calories: meal.calories, protein: meal.protein, fat: meal.fat, carbs: meal.carbs },
      `Logged ${meal.name} (+${meal.protein}g protein, +${meal.calories} kcal)`
    );
  };

  // Water handler
  const waterTargetMl = isPhase1 ? 3000 : isPhase3 ? 4000 : settings.waterGoalMl;
  const handleAddWater = (deltaMl: number) => {
    const change = addToCounter(latest.current.waterMl, deltaMl, MAX_WATER_ML, 'water');
    if (change.applied === 0) {
      onShowToast(change.message || 'No change.', 'warning');
      return;
    }
    onUpdateWater(change.next);
    onShowToast(change.message || `Hydration logged: ${(change.next / 1000).toFixed(2)} L`, change.message ? 'warning' : 'info', () => {
      onUpdateWater(undoCounterDelta(latest.current.waterMl, change.applied));
    });
  };

  const applyStepsDelta = (delta: number, text: (next: number) => string) => {
    const change = addToCounter(latest.current.steps, delta, MAX_STEPS, 'steps');
    if (change.applied === 0) {
      onShowToast(change.message || 'Steps already at or above the goal.', change.message ? 'warning' : 'info');
      return;
    }
    onUpdateSteps(change.next);
    onShowToast(change.message || text(change.next), change.message ? 'warning' : 'info', () => {
      onUpdateSteps(undoCounterDelta(latest.current.steps, change.applied));
    });
  };

  // Selected Option Tab
  const [selectedMealTab, setSelectedMealTab] = useState<'A' | 'B'>('A');
  const [showProteinReference, setShowProteinReference] = useState(false);

  // SVG Macro Ring Component
  const renderMacroRing = (
    label: string,
    current: number,
    target: number,
    unit: string,
    color: string
  ) => {
    const percent = Math.min(100, Math.round((current / (target || 1)) * 100));
    const size = 76;
    const stroke = 6;
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (percent / 100) * circ;

    return (
      <div className="flex flex-col items-center text-center p-2 rounded-xl bg-[#0B0D10] border border-[#222933]">
        <div className="relative w-[76px] h-[76px] flex items-center justify-center">
          <svg className="w-[76px] h-[76px] transform -rotate-90">
            <circle cx="38" cy="38" r={r} stroke="#1F252E" strokeWidth={stroke} fill="transparent" />
            <circle
              cx="38"
              cy="38"
              r={r}
              stroke={color}
              strokeWidth={stroke}
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs font-mono font-extrabold text-white tabular-nums leading-none">
              {current}
            </span>
            <span className="text-[9px] text-slate-500 font-semibold uppercase mt-0.5">
              /{target}
            </span>
          </div>
        </div>
        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight mt-1.5">
          {label} ({unit})
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header & Jain Banner */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#B6FF3B] uppercase tracking-wider">
              {isPhase1
                ? 'Phase 1: Habit Detox Nutrition'
                : isPhase3
                ? 'Phase 3: Muscle Building Nutrition'
                : 'Phase 2: Fat Loss Jain Nutrition'}
            </span>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {isPhase1
                ? 'Clean Eating & Habit Reset'
                : isPhase3
                ? 'Hypertrophy & Carb Fuel Protocol'
                : 'Fat Burning & Protein Protocol'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowCalculator(!showCalculator)}
            className="min-h-[44px] px-3 rounded-xl bg-[#14181D] border border-[#222933] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95"
          >
            <Calculator className="w-3.5 h-3.5 text-[#B6FF3B]" />
            <span>Macro Formula</span>
          </button>
        </div>

        {/* Phase 1 Detox Banner */}
        {isPhase1 && (
          <div className="p-4 rounded-2xl bg-[#14181D] border border-[#B6FF3B]/40 flex items-start gap-3 shadow-lg">
            <Sparkles className="w-5 h-5 text-[#B6FF3B] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="block text-xs font-bold text-[#B6FF3B] uppercase tracking-wider">
                Phase 1: Habit Detox (No Macro Counting Required)
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                Clean up the garbage: Zero sugar, zero sugary drinks/chai, zero maida, zero junk food, and zero alcohol. Drink 3+ Litres of clean water daily. Focus on simple home-cooked Jain meals. Macro rings below are provided for reference.
              </p>
            </div>
          </div>
        )}

        {/* Jain Philosophy Notice */}
        <div className="p-3.5 rounded-2xl bg-[#14181D] border border-amber-500/20 text-xs space-y-1">
          <span className="block font-bold text-amber-400">
            Strict Jain Compliance Guidelines:
          </span>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Zero eggs, meat, fish. Zero onion, garlic, potato, carrot, beetroot, radish, ginger, sweet potato, mushrooms. Salads strictly cucumber, tomato, cabbage, lettuce, capsicum. Minimal oil (1-2 tsp max). No sugar, maida, junk, or alcohol.
          </p>
        </div>
      </div>

      {/* Pre/Post Workout Carb Reminder for Phase 3 */}
      {isPhase3 && (
        <div className="p-4 rounded-2xl bg-[#14181D] border border-[#B6FF3B]/30 flex items-start gap-3 shadow-lg">
          <Wheat className="w-5 h-5 text-[#B6FF3B] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="block text-xs font-bold text-white uppercase tracking-wider">
              Phase 3 Carb Fuel Strategy (+200 kcal Carbs)
            </span>
            <p className="text-xs text-slate-400 leading-relaxed">
              Place your extra 200 kcal of carbs around workouts: eat 1 banana or whole wheat toast 30-45 min pre-workout, and add 1 extra roti or 1/2 cup rice post-workout with dal!
            </p>
          </div>
        </div>
      )}

      {/* 16:8 Fasting Ring Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#14181D] border border-[#222933] shadow-xl flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${
              fasting.isEatingWindow
                ? 'bg-[#B6FF3B]/10 border-[#B6FF3B]/40 text-[#B6FF3B]'
                : 'bg-[#FF8C3B]/10 border-[#FF8C3B]/40 text-[#FF8C3B]'
            }`}
          >
            <Clock className="w-7 h-7" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  fasting.isEatingWindow
                    ? 'bg-[#B6FF3B]/20 text-[#B6FF3B]'
                    : 'bg-[#FF8C3B]/20 text-[#FF8C3B]'
                }`}
              >
                {fasting.isEatingWindow ? 'Eating Window Active' : 'Fasting Window Active'}
              </span>
            </div>
            <span className="block text-xl sm:text-2xl font-mono font-extrabold text-white tracking-tight mt-1">
              {fasting.countdownStr}
            </span>
            <span className="block text-xs text-slate-400 mt-0.5">
              {fasting.label}
            </span>
          </div>
        </div>

        <div className="text-right sm:border-l sm:border-[#222933] sm:pl-5 text-xs text-slate-400">
          <span className="block font-bold text-white">16:8 Intermittent Fasting</span>
          <span>Fast: 8:00 PM to 12:00 PM</span>
          <span className="block text-[11px] text-slate-500 mt-0.5">
            During fast: Water, black coffee, green tea only
          </span>
        </div>
      </div>

      {/* Interactive Macro Calculator Stepper Form */}
      {showCalculator && (
        <div className="p-5 sm:p-6 rounded-3xl bg-[#14181D] border border-[#B6FF3B]/40 shadow-xl space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#B6FF3B]">
              <Calculator className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">
                Macro Calculator ({isPhase3 ? 'Phase 3 Muscle Building' : 'Phase 2 Fat Burning'})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowCalculator(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Enter Bodyweight (kg):
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 72.5"
                  maxLength={6}
                  value={calcBwText}
                  onChange={(e) => setCalcBwText(e.target.value)}
                  className="w-28 h-11 px-3.5 rounded-xl bg-[#0B0D10] border border-[#222933] text-white font-mono font-bold text-base focus:outline-none focus:border-[#B6FF3B]"
                />
                {!calcParsed.ok && (
                  <span className="text-xs text-amber-400" role="alert">{calcParsed.error}</span>
                )}
                <span className="text-xs text-slate-400">
                  {isPhase3
                    ? 'Phase 3 formula: Maintenance (kg x 29) minus 300 kcal (+200 kcal more food).'
                    : 'Phase 2 formula: Maintenance (kg x 29) minus 500 kcal.'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0B0D10] border border-[#222933] space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>Step 1: Maintenance Calories ({calcBw} kg × 29)</span>
                <span className="font-mono font-bold text-white">{interactiveCalc.maintenance} kcal</span>
              </div>
              <div className="flex justify-between items-center text-[#FF8C3B]">
                <span>
                  Step 2: {interactiveCalc.deficitCalories} kcal Deficit ({interactiveCalc.maintenance} − {interactiveCalc.deficitCalories})
                </span>
                <span className="font-mono font-bold">{interactiveCalc.targetCalories} kcal</span>
              </div>
              <div className="flex justify-between items-center text-[#B6FF3B]">
                <span>Step 3: Protein ({calcBw} kg × 2g)</span>
                <span className="font-mono font-bold">{interactiveCalc.proteinGrams}g ({interactiveCalc.proteinGrams * 4} kcal)</span>
              </div>
              <div className="flex justify-between items-center text-amber-400">
                <span>Step 4: Fat ({calcBw} kg × 0.9g)</span>
                <span className="font-mono font-bold">{interactiveCalc.fatGrams}g ({interactiveCalc.fatGrams * 9} kcal)</span>
              </div>
              <div className="flex justify-between items-center text-sky-400">
                <span>Step 5: Carbs (Remaining Calories ÷ 4)</span>
                <span className="font-mono font-bold">{interactiveCalc.carbGrams}g</span>
              </div>
              <div className="pt-2 border-t border-[#222933] text-[11px] text-slate-400">
                {interactiveCalc.portionNote}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Consumed vs Target Macro Rings */}
      <div className="p-5 rounded-3xl bg-[#14181D] border border-[#222933] shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Today's Macro Target ({isPhase3 ? 'Phase 3' : 'Phase 2'})
          </h3>
          <span className="text-xs font-mono text-slate-500">
            Target: {macroTargets.targetCalories} kcal
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {renderMacroRing('Calories', consumed.calories, macroTargets.targetCalories, 'kcal', '#B6FF3B')}
          {renderMacroRing('Protein', consumed.protein, macroTargets.proteinGrams, 'g', '#38BDF8')}
          {renderMacroRing('Fat', consumed.fat, macroTargets.fatGrams, 'g', '#F59E0B')}
          {renderMacroRing('Carbs', consumed.carbs, macroTargets.carbGrams, 'g', '#EC4899')}
        </div>

        {/* Quick Add Buttons: Protein & Phase 3 Carbs */}
        <div className="pt-2 border-t border-[#222933] space-y-3">
          <span className="block text-[11px] font-semibold text-slate-400">
            Quick-Add Protein Boosters:
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickAddProtein(10, 40, 'Clean Protein')}
              className="h-11 px-2 rounded-xl bg-[#0B0D10] border border-[#222933] text-slate-200 hover:border-[#B6FF3B] text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-[#B6FF3B]" />
              <span>+10g Protein</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickAddProtein(25, 120, '1 Whey Scoop')}
              className="h-11 px-2 rounded-xl bg-[#0B0D10] border border-[#222933] text-slate-200 hover:border-[#B6FF3B] text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-[#B6FF3B]" />
              <span>+25g (1 Scoop)</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickAddProtein(50, 240, '2 Whey Scoops')}
              className="h-11 px-2 rounded-xl bg-[#0B0D10] border border-[#222933] text-slate-200 hover:border-[#B6FF3B] text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-[#B6FF3B]" />
              <span>+50g (Double)</span>
            </button>
          </div>

          {/* Phase 3 Carb Add-on Picker */}
          {isPhase3 && (
            <div className="space-y-2 pt-2 border-t border-[#222933]">
              <span className="block text-[11px] font-semibold text-[#B6FF3B]">
                Phase 3 Extra Carb Add-ons (+200 kcal options):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PHASE_3_CARB_ADDONS.map((carb) => (
                  <button
                    key={carb.id}
                    type="button"
                    onClick={() => handleAddCarbOption(carb)}
                    className="p-2.5 rounded-xl bg-[#0B0D10] border border-[#222933] hover:border-[#B6FF3B] text-left transition-colors active:scale-95"
                  >
                    <span className="block text-xs font-bold text-white truncate">{carb.name}</span>
                    <span className="block text-[10px] text-slate-400">
                      +{carb.carbsGrams}g carbs <span className="text-slate-600">·</span> {carb.calories} kcal
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Water Tracker & Steps Tracker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Water Tracker */}
        <div className="p-5 rounded-3xl bg-[#14181D] border border-[#222933] shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sky-400">
              <Droplets className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Water Tracker {isPhase3 ? '(4L Minimum)' : ''}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-sky-400">
              {fmtNum(waterMl / 1000, 2)} / {fmtNum(waterTargetMl / 1000, 1)} L
            </span>
          </div>

          <div className="h-3 w-full bg-[#0B0D10] rounded-full overflow-hidden border border-[#222933]">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (waterMl / waterTargetMl) * 100)}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-500">
            {isPhase3 ? 'Drink 500ml upon waking. Extra hydration required on sprint days.' : 'Drink minimum 3.5 litres daily.'}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleAddWater(250)}
              className="flex-1 min-h-[44px] rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+250 ml Glass</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddWater(500)}
              className="flex-1 min-h-[44px] rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+500 ml Bottle</span>
            </button>
          </div>
        </div>

        {/* Steps Tracker */}
        <div className="p-5 rounded-3xl bg-[#14181D] border border-[#222933] shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#FF8C3B]">
              <Footprints className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Daily Steps
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-[#FF8C3B]">
              {steps.toLocaleString()} / {settings.stepGoal.toLocaleString()}
            </span>
          </div>

          <div className="h-3 w-full bg-[#0B0D10] rounded-full overflow-hidden border border-[#222933]">
            <div
              className="h-full bg-[#FF8C3B] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (steps / settings.stepGoal) * 100)}%` }}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => applyStepsDelta(1000, (next) => `Steps updated: ${next.toLocaleString()}`)}
              className="flex-1 min-h-[44px] rounded-xl bg-[#FF8C3B]/10 border border-[#FF8C3B]/30 text-[#FF8C3B] font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+1,000 Steps</span>
            </button>
            <button
              type="button"
              onClick={() => applyStepsDelta(deltaToReachGoal(steps, 10000), () => 'Hit 10,000 steps goal!')}
              className="flex-1 min-h-[44px] rounded-xl bg-[#FF8C3B]/10 border border-[#FF8C3B]/30 text-[#FF8C3B] font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Hit 10k Goal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Jain Option A and B Meal Picker */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#14181D] border border-[#222933] shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Utensils className="w-5 h-5 text-[#B6FF3B]" />
            <h3 className="text-base font-extrabold tracking-tight">Jain Meal Plans</h3>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0B0D10] border border-[#222933]">
            <button
              type="button"
              onClick={() => setSelectedMealTab('A')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                selectedMealTab === 'A'
                  ? 'bg-[#B6FF3B] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Option A (~1,930 kcal)
            </button>
            <button
              type="button"
              onClick={() => setSelectedMealTab('B')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                selectedMealTab === 'B'
                  ? 'bg-[#B6FF3B] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Option B (~1,760 kcal)
            </button>
          </div>
        </div>

        {(() => {
          const currentPlan = selectedMealTab === 'A' ? JAIN_OPTION_A : JAIN_OPTION_B;

          return (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                {currentPlan.description} <span className="text-[#B6FF3B] font-semibold">Tap Log to add macros instantly.</span>
              </p>

              <div className="space-y-3">
                {currentPlan.meals.map((mealGroup, gIdx) => (
                  <div key={gIdx} className="p-4 rounded-2xl bg-[#0B0D10] border border-[#222933] space-y-2.5">
                    <span className="block text-xs font-bold text-[#B6FF3B] uppercase tracking-wider">
                      {mealGroup.mealTime}
                    </span>

                    <div className="space-y-2">
                      {mealGroup.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-[#14181D] border border-[#222933] hover:border-slate-600 transition-colors gap-3"
                        >
                          <div className="min-w-0">
                            <span className="block text-xs sm:text-sm font-bold text-white truncate">
                              {item.name}
                            </span>
                            <span className="block text-[11px] text-slate-400">
                              Portion: {item.portion} <span className="text-slate-600">·</span> {item.calories} kcal <span className="text-slate-600">·</span> <strong className="text-white">{item.protein}g protein</strong>
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleLogMealItem(item)}
                            className="min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-slate-700 text-[#B6FF3B] hover:bg-[#B6FF3B] hover:text-black font-bold text-xs flex items-center gap-1 active:scale-95 transition-all shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Log</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Protein Reference Arsenal Expandable */}
      <div className="p-5 rounded-3xl bg-[#14181D] border border-[#222933] shadow-lg space-y-3">
        <button
          type="button"
          onClick={() => setShowProteinReference(!showProteinReference)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#B6FF3B]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Jain Protein Reference Guide
            </h3>
          </div>
          {showProteinReference ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showProteinReference && (
          <div className="space-y-2 pt-2 animate-in fade-in">
            <p className="text-xs text-slate-400 mb-2">
              Hitting 160g+ on pure vegetarian and Jain is 100% achievable when prioritizing high yield items.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {PROTEIN_REFERENCE_TABLE.map((row, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#0B0D10] border border-[#222933] flex items-center justify-between"
                >
                  <div>
                    <span className="block font-bold text-slate-200">{row.item}</span>
                    <span className="block text-[11px] text-slate-500">{row.portion}</span>
                  </div>
                  <div className="text-right">
                    <span className="block font-mono font-bold text-[#B6FF3B]">{row.protein}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Daily Supplement Checklist */}
      <div className="p-5 rounded-3xl bg-[#14181D] border border-[#222933] shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Daily Supplements Checklist
          </h3>
          <span className="text-[11px] text-slate-500">Unchanged in Phase 3</span>
        </div>

        <p className="text-xs text-slate-400">
          Whey protein post-workout, Creatine 5g, Multivitamin with breakfast, Vitamin D3+K2 with meals. Fish oil skipped (not Jain).
        </p>

        <div className="space-y-2 pt-1">
          {SUPPLEMENTS_LIST.map((sup) => {
            const isChecked = !!supplements[sup.id as keyof typeof supplements];

            return (
              <button
                key={sup.id}
                type="button"
                onClick={() => onToggleSupplement(sup.id)}
                className={`w-full p-3.5 rounded-2xl border flex items-center justify-between text-left transition-all active:scale-98 ${
                  isChecked
                    ? 'bg-[#14181D]/60 border-[#222933] opacity-75'
                    : 'bg-[#0B0D10] border-[#222933] hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                      isChecked
                        ? 'bg-[#B6FF3B] text-black'
                        : 'bg-[#14181D] border border-[#222933] text-slate-600'
                    }`}
                  >
                    {isChecked ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs sm:text-sm font-bold ${isChecked ? 'line-through text-slate-500' : 'text-white'}`}>
                        {sup.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">({sup.dosage})</span>
                    </div>
                    <span className="block text-[11px] text-slate-400">
                      Timing: {sup.timing} <span className="text-slate-600">·</span> {sup.notes}
                    </span>
                  </div>
                </div>

                <span className={`text-[10px] font-mono shrink-0 uppercase ml-3 ${isChecked ? 'text-[#B6FF3B]' : 'text-slate-500'}`}>
                  {isChecked ? 'Taken' : 'Due'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
