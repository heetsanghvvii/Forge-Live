import React, { useState } from 'react';
import { AppSettings } from '../types';
import { parseNumberInput } from '../utils/inputs';
import { Dumbbell, Calendar, Clock, ArrowRight, Flame } from 'lucide-react';

interface OnboardingModalProps {
  initialSettings: AppSettings;
  onComplete: (updatedSettings: AppSettings) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  initialSettings,
  onComplete
}) => {
  const [step, setStep] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>(initialSettings.startDate || '');
  const [bodyweight, setBodyweight] = useState<string | number>(
    initialSettings.bodyweightKg !== undefined ? initialSettings.bodyweightKg : ''
  );
  const [fastingStartHour, setFastingStartHour] = useState<number>(initialSettings.fastingStartHour);
  const [fastingEndHour, setFastingEndHour] = useState<number>(initialSettings.fastingEndHour);

  const PHASES = {
    phase1: { label: 'Phase 1', name: 'Foundation', days: 'Days 1-7' },
    phase2: { label: 'Phase 2', name: 'Base Building', days: 'Days 8-35' },
    phase3: { label: 'Phase 3', name: 'Muscle Building', days: 'Days 36-63' }
  } as const;
  const chosen = PHASES[initialSettings.activePhase] || PHASES.phase1;
  const [weightError, setWeightError] = useState<string>('');

  const handleNext = () => {
    if (step === 2 && String(bodyweight).trim() !== '') {
      const r = parseNumberInput(String(bodyweight), { min: 20, max: 400, decimals: 1, label: 'Bodyweight' });
      if (!r.ok) { setWeightError(r.error); return; }
    }
    setWeightError('');
    if (step < 3) {
      setStep(step + 1);
    } else {
      const pw = String(bodyweight).trim() !== '' ? parseNumberInput(String(bodyweight), { min: 20, max: 400, decimals: 1 }) : null;
      const parsedWeight = pw && pw.ok ? pw.value : undefined;
      onComplete({
        ...initialSettings,
        startDate,
        bodyweightKg: parsedWeight,
        startingWeightKg: parsedWeight ?? initialSettings.startingWeightKg,
        fastingStartHour: Number(fastingStartHour),
        fastingEndHour: Number(fastingEndHour),
        onboardingCompleted: true
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#14181D] border border-[#222933] rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between min-h-[460px]">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-8 bg-[#B6FF3B]'
                    : s < step
                    ? 'w-4 bg-[#B6FF3B]/50'
                    : 'w-3 bg-slate-700'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-mono text-slate-400">Step {step} of 3</span>
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="flex-1 flex flex-col items-center text-center justify-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-[#B6FF3B]/10 border border-[#B6FF3B]/30 flex items-center justify-center text-[#B6FF3B] mb-5 shadow-lg shadow-[#B6FF3B]/5">
              <Flame className="w-8 h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              Forge
            </h1>
            <p className="text-sm font-semibold text-[#B6FF3B] uppercase tracking-wider mb-3">
              {chosen.label} · {chosen.name}
            </p>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xs">
              You are starting {chosen.label} ({chosen.name}, {chosen.days}). The programme runs through Phase 1 Foundation (Days 1-7), Phase 2 Base Building (Days 8-35) and Phase 3 Muscle Building (Days 36-63), with strict Jain nutrition.
            </p>
          </div>
        )}

        {/* Step 2: Start Date and Bodyweight */}
        {step === 2 && (
          <div className="flex-1 flex flex-col justify-center py-2">
            <div className="flex items-center gap-2 mb-2 text-[#B6FF3B]">
              <Calendar className="w-5 h-5" />
              <h2 className="text-lg font-bold text-white">Your Starting Baseline</h2>
            </div>
            <p className="text-xs text-slate-400 mb-6">
              Pick the date you begin ({chosen.label}, {chosen.days}). Later phases start automatically on their days. Set your current morning scale weight to calibrate your exact caloric deficit and macros.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Programme Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-[#0B0D10] border border-[#222933] text-white text-sm focus:outline-none focus:border-[#B6FF3B] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Current Bodyweight (kg)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    maxLength={6}
                    placeholder="e.g. 70"
                    value={bodyweight}
                    aria-invalid={!!weightError}
                    onChange={(e) => { setBodyweight(e.target.value); setWeightError(''); }}
                    className="w-full h-12 px-4 pr-12 rounded-xl bg-[#0B0D10] border border-[#222933] text-white text-base font-semibold focus:outline-none focus:border-[#B6FF3B] transition-colors"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                    KG
                  </span>
                </div>
                {weightError && <p className="text-[11px] text-amber-400 mt-1" role="alert">{weightError}</p>}
                <p className="text-[11px] text-slate-500 mt-1">
                  {bodyweight !== '' && Number.isFinite(Number(bodyweight))
                    ? `Macro targets: ${Math.round(Number(bodyweight) * 2)}g protein, ${Math.round(Number(bodyweight) * 0.9)}g fat daily.`
                    : 'Enter your weight to calibrate your exact macro targets.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Fasting Window */}
        {step === 3 && (
          <div className="flex-1 flex flex-col justify-center py-2">
            <div className="flex items-center gap-2 mb-2 text-[#B6FF3B]">
              <Clock className="w-5 h-5" />
              <h2 className="text-lg font-bold text-white">16:8 Fasting Window</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              16 hours fasting keeps insulin low to oxidize fat. Eating window: 8 hours (2 full Jain meals plus 1 afternoon protein snack).
            </p>

            <div className="p-4 rounded-2xl bg-[#0B0D10] border border-[#222933] space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">Fast Starts (Dinner done)</span>
                <span className="text-xs font-bold text-[#FF8C3B]">8:00 PM</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">Fast Ends (Break fast)</span>
                <span className="text-xs font-bold text-[#B6FF3B]">12:00 PM Noon</span>
              </div>
              <div className="h-px bg-[#222933]" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Allowed during fast:</span>
                <span className="text-slate-200 font-medium">Water, black coffee, green tea only</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              You can fine-tune hours anytime inside Settings.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 pt-4 border-t border-[#222933] flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="h-12 px-5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors active:scale-95"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={handleNext}
            className="flex-1 h-12 px-6 rounded-xl bg-[#B6FF3B] text-black font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#a6ec31] shadow-lg shadow-[#B6FF3B]/10 active:scale-98 transition-all"
          >
            <span>{step === 3 ? `Start ${chosen.label}` : 'Continue'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
