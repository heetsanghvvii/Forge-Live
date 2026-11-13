import React, { useState, useRef } from 'react';
import { AppState, WeighInRecord, BodyMeasurements, PhotoRecord, TabType } from '../types';
import { MISTAKES_LIST, DAY_36_TASKS } from '../data/learnData';
import { getTodayDateString } from '../utils/storage';
import { parseNumberInput, fmtNum } from '../utils/inputs';
import { fmtDelta, deltaDirection } from '../utils/deltaFormat';
import { LabMarkers } from '../components/LabMarkers';
import {
  Scale,
  Lock,
  Unlock,
  TrendingDown,
  TrendingUp,
  Camera,
  CheckCircle2,
  Circle,
  Plus,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Zap
} from 'lucide-react';

interface ProgressViewProps {
  appState: AppState;
  onAddWeighIn: (weight: number) => void;
  onAddMeasurements: (measurements: BodyMeasurements) => void;
  onAddPhoto: (dataUrl: string, note?: string) => void;
  onToggleMistake: (mistakeId: string) => void;
  onNavigateTab?: (tab: TabType) => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning', undo?: () => void) => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  appState,
  onAddWeighIn,
  onAddMeasurements,
  onAddPhoto,
  onToggleMistake,
  onShowToast,
  onNavigateTab
}) => {
  const { weighIns, measurementHistory, photos, avoidedMistakes, settings, selectedDayNumber } = appState;
  const isPhase1 = selectedDayNumber >= 1 && selectedDayNumber <= 7;
  const isPhase3 = selectedDayNumber >= 36;
  const initialPhase: 'phase1' | 'phase2' | 'phase3' = isPhase1 ? 'phase1' : isPhase3 ? 'phase3' : 'phase2';
  const [mistakePhase, setMistakePhase] = useState<'phase1' | 'phase2' | 'phase3'>(initialPhase);
  const currentMistakes = MISTAKES_LIST.filter((m) => m.phase === mistakePhase);

  // Weekly Weigh-in Lock Logic (allowed once every 7 days)
  const lastWeighIn = weighIns[weighIns.length - 1];
  const [unlockOverride, setUnlockOverride] = useState(false);

  const getDaysSinceLastWeighIn = () => {
    if (!lastWeighIn) return 999;
    const lastDate = new Date(lastWeighIn.date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysSince = getDaysSinceLastWeighIn();
  const isWeighInLocked = daysSince < 7 && !unlockOverride && weighIns.length > 0;

  // Weigh-in input state (text, so the user can clear it; nothing is invented)
  const [newWeightText, setNewWeightText] = useState<string>(
    lastWeighIn && Number.isFinite(lastWeighIn.weight) ? String(lastWeighIn.weight) : settings.bodyweightKg ? String(settings.bodyweightKg) : ''
  );
  const [weightError, setWeightError] = useState<string | null>(null);
  const [showWeighInModal, setShowWeighInModal] = useState(false);

  // Measurements input state: empty until the user types real values
  const lastMeasurements: BodyMeasurements | undefined = measurementHistory[measurementHistory.length - 1]?.measurements;
  const firstMeasurements: BodyMeasurements | undefined = measurementHistory[0]?.measurements;
  const initM = (k: keyof BodyMeasurements) => (lastMeasurements && Number.isFinite(lastMeasurements[k]) && lastMeasurements[k] > 0 ? String(lastMeasurements[k]) : '');
  const [mText, setMText] = useState<Record<keyof BodyMeasurements, string>>({
    chest: initM('chest'), waist: initM('waist'), hips: initM('hips'), arms: initM('arms')
  });
  const [mErrors, setMErrors] = useState<Partial<Record<keyof BodyMeasurements, string>>>({});
  const [showMeasureModal, setShowMeasureModal] = useState(false);

  // Photo Slider state
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const handleWeighInSubmit = () => {
    const r = parseNumberInput(newWeightText, { min: 20, max: 400, decimals: 1, label: 'Weight' });
    if (!r.ok) {
      setWeightError(r.error);
      return;
    }
    setWeightError(null);
    onAddWeighIn(r.value);
    setShowWeighInModal(false);
    onShowToast(`Weighed in at ${r.value} kg!`, 'success');
  };

  const handleMeasureSubmit = () => {
    const keys: (keyof BodyMeasurements)[] = ['chest', 'waist', 'hips', 'arms'];
    const errors: Partial<Record<keyof BodyMeasurements, string>> = {};
    const values = {} as BodyMeasurements;
    for (const k of keys) {
      const r = parseNumberInput(mText[k], { min: 10, max: 300, decimals: 1, label: k[0].toUpperCase() + k.slice(1) });
      if (r.ok) values[k] = r.value;
      else errors[k] = r.error;
    }
    setMErrors(errors);
    if (Object.keys(errors).length > 0) return;
    onAddMeasurements(values);
    setShowMeasureModal(false);
    onShowToast('Updated tape measurements saved!', 'success');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        onAddPhoto(dataUrl, `Day ${selectedDayNumber}`);
        onShowToast('Progress photo saved!', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  // SVG Line Chart for Weekly Weight
  const renderWeightChart = () => {
    if (weighIns.length === 0) return null;

    const weights = weighIns.map((w) => w.weight);
    const minW = Math.min(...weights) - 1.5;
    const maxW = Math.max(...weights) + 1.5;
    const rangeW = maxW - minW || 1;

    const chartWidth = 320;
    const chartHeight = 160;
    const padding = 28;

    const points = weighIns.map((item, idx) => {
      const x = padding + (idx / Math.max(1, weighIns.length - 1)) * (chartWidth - padding * 2);
      const y = chartHeight - padding - ((item.weight - minW) / rangeW) * (chartHeight - padding * 2);
      return { x, y, weight: item.weight, date: item.date, day: item.dayNumber };
    });

    const pathData = points.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, '');

    const firstWeight = weighIns[0]?.weight || settings.bodyweightKg || 0;
    const currentWeight = weighIns[weighIns.length - 1]?.weight || firstWeight;
    const diff = firstWeight > 0 ? Math.round((currentWeight - firstWeight) * 10) / 10 : 0;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Weight History
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-white font-mono tabular-nums">
                {currentWeight > 0 ? `${fmtNum(currentWeight)} kg` : '-'}
              </span>
              <span
                className={`text-xs font-bold flex items-center gap-0.5 ${
                  diff <= 0 ? 'text-[#B6FF3B]' : 'text-[#FF8C3B]'
                }`}
              >
                {deltaDirection(diff) === 'down' ? <TrendingDown className="w-3.5 h-3.5" /> : deltaDirection(diff) === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : null}
                <span>{fmtDelta(diff)} kg total</span>
              </span>
            </div>
          </div>

        </div>

        {/* Lock gentle warning if weighed within 7 days */}
        {isWeighInLocked && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
            <span className="font-bold text-amber-400">Weekly Weigh-in Protocol:</span>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Weigh-in locked: Next weigh-in due in {7 - daysSince} days. Daily scale checks trigger false anxiety from water and food retention. Stick to once every 7 days!
            </p>
            <button
              type="button"
              onClick={() => {
                setUnlockOverride(true);
                setShowWeighInModal(true);
              }}
              className="text-[10px] font-semibold text-slate-400 underline hover:text-white"
            >
              Manual override (log anyway)
            </button>
          </div>
        )}

        {/* Responsive SVG Chart */}
        <div className="w-full overflow-hidden p-2 rounded-2xl bg-[#0B0D10] border border-[#222933]">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-40">
            {/* Horizontal Grid lines */}
            <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="#1F252E" strokeDasharray="3 3" />
            <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="#1F252E" strokeDasharray="3 3" />
            <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#1F252E" />

            {/* Area gradient */}
            <path
              d={`${pathData} L ${points[points.length - 1].x} ${chartHeight - padding} L ${points[0].x} ${chartHeight - padding} Z`}
              fill="rgba(182, 255, 59, 0.08)"
            />

            {/* Line */}
            <path d={pathData} fill="none" stroke="#B6FF3B" strokeWidth="2.5" strokeLinecap="round" />

            {/* Data Dots */}
            {points.map((pt, idx) => (
              <g key={idx}>
                <circle cx={pt.x} cy={pt.y} r="4.5" fill="#0B0D10" stroke="#B6FF3B" strokeWidth="2" />
                <text x={pt.x} y={pt.y - 8} fill="#E2E8F0" fontSize="9" textAnchor="middle" fontFamily="monospace">
                  {pt.weight}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  // Measurement deltas ('-' when there is nothing to compare)
  const delta = (k: keyof BodyMeasurements): number | null => {
    if (!lastMeasurements || !firstMeasurements) return null;
    const d = lastMeasurements[k] - firstMeasurements[k];
    return Number.isFinite(d) ? Math.round(d * 10) / 10 : null;
  };
  const chestDelta = delta('chest');
  const waistDelta = delta('waist');
  const hipsDelta = delta('hips');
  const armsDelta = delta('arms');

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="space-y-1 pt-1">
        <span className="text-xs font-bold text-[#B6FF3B] uppercase tracking-wider">
          Physical Recomposition Tracker
        </span>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">
          Progress & Measurements
        </h2>
      </div>

      {onNavigateTab && (
        <button type="button" onClick={() => onNavigateTab('learn')}
          className="w-full min-h-[44px] flex items-center justify-between px-4 rounded-2xl border border-[#222933] bg-[#14181D] text-slate-200 text-sm font-semibold hover:border-[#2e3947] active:scale-[0.98]">
          <span>Course lessons</span>
          <span className="text-[#B6FF3B] text-xs font-bold">Open Learn</span>
        </button>
      )}

      {/* Weekly Weight SVG Chart */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#14181D] border border-[#222933] shadow-xl">
        <div className="flex items-center justify-between gap-3 mb-3">
          {weighIns.length === 0 ? (
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Weight History</span>
              <p className="text-sm text-slate-300">No weigh-ins yet</p>
            </div>
          ) : (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Log</span>
          )}
          <button
            type="button"
            onClick={() => {
              if (isWeighInLocked) {
                setUnlockOverride(true);
              } else {
                setShowWeighInModal(true);
              }
            }}
            className="min-h-[44px] shrink-0 px-3.5 rounded-xl bg-[#0B0D10] border border-slate-700 hover:border-[#B6FF3B] text-slate-200 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
          >
            {isWeighInLocked ? (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Locked</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 text-[#B6FF3B]" />
                <span>Log Weight</span>
              </>
            )}
          </button>
        </div>
        {renderWeightChart()}
      </div>

      {/* Body Tape Measurements Grid */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#14181D] border border-[#222933] shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Tape Measurements (Inches / CM)
            </h3>
            <p className="text-[11px] text-slate-400">Change compared to Day 1 baseline</p>
          </div>
          <button
            type="button"
            onClick={() => setShowMeasureModal(true)}
            className="min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-slate-700 hover:border-[#B6FF3B] text-slate-200 text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-[#B6FF3B]" />
            <span>Update</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Chest */}
          <div className="p-3.5 rounded-2xl bg-[#0B0D10] border border-[#222933] text-center">
            <span className="block text-[10px] font-semibold text-slate-400 uppercase">Chest</span>
            <span className="text-lg font-extrabold text-white font-mono">{lastMeasurements ? fmtNum(lastMeasurements.chest) : '-'} cm</span>
            <span className={`block text-[10px] font-bold mt-0.5 ${(chestDelta ?? 0) >= 0 ? 'text-[#B6FF3B]' : 'text-slate-400'}`}>
              {fmtDelta(chestDelta)} cm
            </span>
          </div>

          {/* Waist */}
          <div className="p-3.5 rounded-2xl bg-[#0B0D10] border border-[#222933] text-center">
            <span className="block text-[10px] font-semibold text-slate-400 uppercase">Waist</span>
            <span className="text-lg font-extrabold text-white font-mono">{lastMeasurements ? fmtNum(lastMeasurements.waist) : '-'} cm</span>
            <span className={`block text-[10px] font-bold mt-0.5 ${(waistDelta ?? 0) <= 0 ? 'text-[#B6FF3B]' : 'text-[#FF8C3B]'}`}>
              {fmtDelta(waistDelta)} cm
            </span>
          </div>

          {/* Hips */}
          <div className="p-3.5 rounded-2xl bg-[#0B0D10] border border-[#222933] text-center">
            <span className="block text-[10px] font-semibold text-slate-400 uppercase">Hips</span>
            <span className="text-lg font-extrabold text-white font-mono">{lastMeasurements ? fmtNum(lastMeasurements.hips) : '-'} cm</span>
            <span className={`block text-[10px] font-bold mt-0.5 ${(hipsDelta ?? 0) <= 0 ? 'text-[#B6FF3B]' : 'text-slate-400'}`}>
              {fmtDelta(hipsDelta)} cm
            </span>
          </div>

          {/* Arms */}
          <div className="p-3.5 rounded-2xl bg-[#0B0D10] border border-[#222933] text-center">
            <span className="block text-[10px] font-semibold text-slate-400 uppercase">Arms</span>
            <span className="text-lg font-extrabold text-white font-mono">{lastMeasurements ? fmtNum(lastMeasurements.arms) : '-'} cm</span>
            <span className={`block text-[10px] font-bold mt-0.5 ${(armsDelta ?? 0) >= 0 ? 'text-[#B6FF3B]' : 'text-slate-400'}`}>
              {fmtDelta(armsDelta)} cm
            </span>
          </div>
        </div>
      </div>

      {/* Before / After Photo Comparison Slider */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#14181D] border border-[#222933] shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Physique Comparison Slider
            </h3>
            <p className="text-[11px] text-slate-400">Drag handle to compare Day 1 vs Latest photo</p>
          </div>

          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="min-h-[44px] px-3.5 rounded-xl bg-[#0B0D10] border border-slate-700 hover:border-[#B6FF3B] text-slate-200 text-xs font-bold flex items-center gap-1.5 active:scale-95"
          >
            <Camera className="w-3.5 h-3.5 text-[#B6FF3B]" />
            <span>Add Photo</span>
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>

        {/* Interactive Comparison Slider */}
        <div className="relative w-full h-64 sm:h-80 rounded-2xl overflow-hidden bg-[#0B0D10] border border-[#222933] select-none touch-none">
          {photos.length >= 2 ? (
            <>
              {/* Image 2 (After / Latest) */}
              <img
                src={photos[photos.length - 1].dataUrl}
                alt="Latest progress"
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Image 1 (Before / Day 1) clipped */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${sliderPosition}%` }}
              >
                <img
                  src={photos[0].dataUrl}
                  alt="Baseline progress"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>

              {/* Slider Divider Bar */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-[#B6FF3B] cursor-ew-resize flex items-center justify-center pointer-events-none"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="w-6 h-6 rounded-full bg-[#B6FF3B] text-black flex items-center justify-center shadow-lg text-[10px] font-extrabold">
                  ↔
                </div>
              </div>

              {/* Labels */}
              <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/70 text-[10px] font-bold text-white uppercase pointer-events-none">
                Before (Day 1)
              </div>
              <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/70 text-[10px] font-bold text-[#B6FF3B] uppercase pointer-events-none">
                Latest Check-in
              </div>

              {/* Transparent Range Input Overlay */}
              <input
                type="range"
                min="0"
                max="100"
                value={sliderPosition}
                onChange={(e) => setSliderPosition(Number(e.target.value))}
                className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full"
              />
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 space-y-2">
              <Camera className="w-10 h-10 text-slate-600" />
              <span className="text-xs font-bold text-slate-300">
                Add 2 photos to activate the comparison slider
              </span>
              <p className="text-[11px] text-slate-500 max-w-xs">
                Take shirtless morning photos in consistent lighting to visually verify waist reduction and muscle fullness.
              </p>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="mt-2 min-h-[44px] px-4 rounded-xl bg-[#B6FF3B] text-black text-xs font-bold active:scale-95"
              >
                Upload First Photo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lab markers: doctor-ordered results, stored on this device only */}
      <LabMarkers onShowToast={onShowToast} />

      {/* Weekly Mistakes Review Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#14181D] border border-[#222933] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#FF8C3B]">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Weekly Mistakes Audit ({mistakePhase === 'phase1' ? 'Phase 1' : mistakePhase === 'phase3' ? 'Phase 3' : 'Phase 2'})
            </h3>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0B0D10] border border-[#222933] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMistakePhase('phase1')}
              className={`px-3 min-h-[36px] text-[11px] font-bold rounded-lg transition-colors ${
                mistakePhase === 'phase1'
                  ? 'bg-[#B6FF3B] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Phase 1
            </button>
            <button
              type="button"
              onClick={() => setMistakePhase('phase2')}
              className={`px-3 min-h-[36px] text-[11px] font-bold rounded-lg transition-colors ${
                mistakePhase === 'phase2'
                  ? 'bg-[#B6FF3B] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Phase 2
            </button>
            <button
              type="button"
              onClick={() => setMistakePhase('phase3')}
              className={`px-3 min-h-[36px] text-[11px] font-bold rounded-lg transition-colors ${
                mistakePhase === 'phase3'
                  ? 'bg-[#B6FF3B] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Phase 3
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Avoiding these pitfalls ensures 100% of your energy translates directly into body transformation. Tick to confirm you avoided each mistake:
        </p>

        <div className="space-y-2.5">
          {currentMistakes.map((m) => {
            const isAvoided = !!avoidedMistakes[m.id];

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onToggleMistake(m.id)}
                className={`w-full p-3.5 rounded-2xl border flex items-center justify-between text-left transition-all active:scale-98 ${
                  isAvoided
                    ? 'bg-[#14181D]/60 border-[#222933] opacity-75'
                    : 'bg-[#0B0D10] border-[#222933] hover:border-slate-600'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                      isAvoided
                        ? 'bg-[#B6FF3B] text-black'
                        : 'bg-[#14181D] border border-[#222933] text-slate-600'
                    }`}
                  >
                    {isAvoided ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0">
                    <span className={`block text-xs sm:text-sm font-bold ${isAvoided ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                      {m.title}
                    </span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">
                      {m.detail}
                    </span>
                  </div>
                </div>

                <span className={`text-[10px] font-mono shrink-0 uppercase ml-3 ${isAvoided ? 'text-[#B6FF3B]' : 'text-slate-500'}`}>
                  {isAvoided ? 'Avoided' : 'Check'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Weigh-In Modal */}
      {showWeighInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#14181D] border border-[#222933] rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Record Weekly Weigh-in</h3>
            <p className="text-xs text-slate-400">
              Step on scale immediately upon waking, fasted, after using the washroom.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Bodyweight (kg):
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 72.5"
                  maxLength={7}
                  value={newWeightText}
                  onChange={(e) => { setNewWeightText(e.target.value); setWeightError(null); }}
                  className="w-full h-12 px-4 pr-12 rounded-xl bg-[#0B0D10] border border-[#222933] text-white font-mono font-bold text-lg focus:outline-none focus:border-[#B6FF3B]"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                  KG
                </span>
              </div>
              {weightError && <p className="mt-1 text-[11px] text-amber-400" role="alert">{weightError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222933]">
              <button
                type="button"
                onClick={() => setShowWeighInModal(false)}
                className="h-10 px-4 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWeighInSubmit}
                className="h-10 px-5 rounded-xl bg-[#B6FF3B] text-black text-xs font-bold uppercase tracking-wider"
              >
                Save Weigh-in
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Measurements Modal */}
      {showMeasureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#14181D] border border-[#222933] rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Update Body Measurements</h3>
            <p className="text-xs text-slate-400">
              Measure with tape around the widest point (cm or inches).
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Chest (cm)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="cm"
                  maxLength={6}
                  value={mText.chest}
                  onChange={(e) => setMText((s) => ({ ...s, chest: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-white font-mono text-xs focus:outline-none focus:border-[#B6FF3B]"
                />
                {mErrors.chest && <p className="mt-1 text-[10px] text-amber-400" role="alert">{mErrors.chest}</p>}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Waist (cm)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="cm"
                  maxLength={6}
                  value={mText.waist}
                  onChange={(e) => setMText((s) => ({ ...s, waist: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-white font-mono text-xs focus:outline-none focus:border-[#B6FF3B]"
                />
                {mErrors.waist && <p className="mt-1 text-[10px] text-amber-400" role="alert">{mErrors.waist}</p>}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Hips (cm)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="cm"
                  maxLength={6}
                  value={mText.hips}
                  onChange={(e) => setMText((s) => ({ ...s, hips: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-white font-mono text-xs focus:outline-none focus:border-[#B6FF3B]"
                />
                {mErrors.hips && <p className="mt-1 text-[10px] text-amber-400" role="alert">{mErrors.hips}</p>}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Arms (cm)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="cm"
                  maxLength={6}
                  value={mText.arms}
                  onChange={(e) => setMText((s) => ({ ...s, arms: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-white font-mono text-xs focus:outline-none focus:border-[#B6FF3B]"
                />
                {mErrors.arms && <p className="mt-1 text-[10px] text-amber-400" role="alert">{mErrors.arms}</p>}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222933]">
              <button
                type="button"
                onClick={() => setShowMeasureModal(false)}
                className="h-10 px-4 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMeasureSubmit}
                className="h-10 px-5 rounded-xl bg-[#B6FF3B] text-black text-xs font-bold uppercase tracking-wider"
              >
                Save Measurements
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
