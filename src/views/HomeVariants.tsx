import React, { useRef, useEffect } from 'react';
import { AppState, DailyChecklist, TabType } from '../types';
import { dailyChecklistItems, dailyProgress } from '../utils/dailyProgress';
import { launchConfetti } from '../utils/confetti';
import { Flame, Check, Dumbbell, Activity, Droplets, Camera, Users, Utensils, Beef, Hourglass, Target, Footprints, Moon, Wheat } from 'lucide-react';

export interface HomeVariantProps {
  appState: AppState;
  onToggleChecklist: (key: keyof DailyChecklist) => void;
  onNavigateTab: (tab: TabType) => void;
  streak: number;
}

/** Same neutral Home wording as the ring candidate. */
const HOME_COPY: Partial<Record<keyof DailyChecklist, { label: string }>> = {
  workout: { label: 'Workout' }, cardio: { label: 'Cardio' }, water: { label: 'Water' },
  photo: { label: 'Progress photo' }, community: { label: 'Community check-in' },
  cleanEating: { label: 'Eating on plan' }, protein: { label: 'Protein' }, fasting: { label: 'Fasting' },
  abs: { label: 'Abs routine' }, steps: { label: 'Steps' }, sleep: { label: 'Sleep' }, prePostCarbs: { label: 'Workout carbs' }
};

const ITEM_ICONS: Partial<Record<keyof DailyChecklist, React.ComponentType<{ className?: string }>>> = {
  workout: Dumbbell, cardio: Activity, water: Droplets, photo: Camera, community: Users,
  cleanEating: Utensils, protein: Beef, fasting: Hourglass, abs: Target, steps: Footprints,
  sleep: Moon, prePostCarbs: Wheat
};

function useShared(appState: AppState) {
  const { currentDayNumber, dailyLogs } = appState;
  const checklist = dailyLogs[currentDayNumber]?.checklist || { workout: false, cardio: false, water: false, photo: false, community: false };
  const items = dailyChecklistItems(currentDayNumber);
  const progress = dailyProgress(checklist, currentDayNumber);
  const prevRef = useRef(progress.completedCount);
  useEffect(() => {
    if (progress.completedCount === progress.totalItems && progress.totalItems > 0 && prevRef.current < progress.totalItems) {
      if (typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) launchConfetti();
    }
    prevRef.current = progress.completedCount;
  }, [progress.completedCount, progress.totalItems]);
  return { checklist, items, progress };
}

const Header: React.FC<{ streak: number; progress: ReturnType<typeof dailyProgress> }> = ({ streak, progress }) => (
  <div className="pt-2 px-1 flex items-end justify-between">
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
      <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1">
        {progress.isDayComplete ? 'Day complete' : `${progress.completedCount} of ${progress.totalItems} done today`}
      </h2>
    </div>
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#14181D] border border-[#222933]">
      <Flame className="w-3.5 h-3.5 text-[#FF8C3B]" />
      <span className="text-xs font-bold text-slate-200 tabular-nums">{streak}</span>
    </div>
  </div>
);

/**
 * Candidate B: The Path. Today's habits as stepping stones on a trail;
 * each tick lights a stone and extends the trail. Complete = the whole
 * path glows end to end.
 */
export const HomePath: React.FC<HomeVariantProps> = ({ appState, onToggleChecklist, streak }) => {
  const { checklist, items, progress } = useShared(appState);
  return (
    <div className="space-y-6 pb-4">
      <Header streak={streak} progress={progress} />
      <div className="p-6 rounded-3xl bg-[#14181D] border border-[#222933] shadow-lg">
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          {progress.isDayComplete ? 'Every stone lit. Walk it again tomorrow.' : 'Light each stone to finish today\'s path.'}
        </p>
        <div className="relative pl-2">
          {/* stones are independent: no connecting trail, so order implies no prerequisites */}
          <div className="space-y-4 relative">
            {items.map((item) => {
              const done = !!checklist[item.key];
              const Icon = ITEM_ICONS[item.key] || Target;
              return (
                <button key={item.key} type="button" onClick={() => onToggleChecklist(item.key)}
                  className="w-full flex items-center gap-4 text-left active:scale-[0.98] motion-safe:transition-transform motion-safe:duration-200">
                  <span className={`shrink-0 w-[52px] h-[52px] rounded-full flex items-center justify-center border-2 motion-safe:transition-all motion-safe:duration-500 ${
                    done ? 'bg-[#B6FF3B] border-[#B6FF3B] shadow-lg shadow-[#B6FF3B]/25' : 'bg-[#0B0D10] border-[#2e3947]'}`}>
                    {done ? <Check className="w-5 h-5 text-black" strokeWidth={3.5} /> : <Icon className="w-5 h-5 text-slate-500" />}
                  </span>
                  <span className={`text-sm font-semibold motion-safe:transition-colors motion-safe:duration-300 ${done ? 'text-[#B6FF3B]' : 'text-slate-300'}`}>
                    {(HOME_COPY[item.key]?.label) || item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Candidate C: The Vessel. A tall glass with one chamber per habit;
 * each tick pours its chamber full. Complete = the vessel brimms.
 */
export const HomeVessel: React.FC<HomeVariantProps> = ({ appState, onToggleChecklist, onNavigateTab, streak }) => {
  const { checklist, items, progress } = useShared(appState);
  const n = progress.totalItems;
  return (
    <div className="space-y-6 pb-4">
      <Header streak={streak} progress={progress} />
      <div className="p-6 rounded-3xl bg-[#14181D] border border-[#222933] shadow-lg flex gap-6">
        {/* vessel: aggregate fill - one chamber per habit, fills bottom-up with each tick (not habit-mapped) */}
        <div className="shrink-0 flex flex-col items-center gap-2">
          <div className="relative w-24 flex-1 rounded-2xl border-2 border-[#2e3947] bg-[#0B0D10] overflow-hidden flex flex-col-reverse">
            {items.map((item) => {
              const done = !!checklist[item.key];
              return (
                <div key={item.key}
                  className={`w-full border-t border-[#0B0D10] motion-safe:transition-all motion-safe:duration-700 ${done ? 'bg-[#B6FF3B]' : 'bg-transparent'}`}
                  style={{ height: `${100 / n}%`, minHeight: 34 }} />
              );
            })}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className={`text-sm font-extrabold tabular-nums px-2 py-0.5 rounded-md ${progress.completedCount > 0 ? 'text-black bg-[#B6FF3B]/90' : 'text-slate-300 bg-[#0B0D10]/80'}`}>
                {progress.completedCount}/{progress.totalItems}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-slate-500 text-center leading-tight w-24">Fills one step per tick</span>
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-sm text-slate-400 leading-relaxed mb-3">
            {progress.isDayComplete ? 'The vessel is full. Today is yours.' : 'Every tick fills the vessel a little more.'}
          </p>
          {items.map((item) => {
            const done = !!checklist[item.key];
            return (
              <button key={item.key} type="button" onClick={() => onToggleChecklist(item.key)}
                className={`w-full min-h-[44px] flex items-center gap-3 px-3 rounded-xl border text-left active:scale-[0.98] motion-safe:transition-all motion-safe:duration-300 ${
                  done ? 'bg-[#B6FF3B]/10 border-[#B6FF3B]/40' : 'bg-[#0B0D10] border-[#222933] hover:border-[#2e3947]'}`}>
                <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center motion-safe:transition-all motion-safe:duration-300 ${done ? 'bg-[#B6FF3B]' : 'border-2 border-[#2e3947]'}`}>
                  {done && <Check className="w-3 h-3 text-black" strokeWidth={4} />}
                </span>
                <span className={`text-xs font-semibold motion-safe:transition-colors motion-safe:duration-300 ${done ? 'text-[#B6FF3B]' : 'text-slate-300'}`}>
                  {(HOME_COPY[item.key]?.label) || item.label}
                </span>
              </button>
            );
          })}
          <button type="button" onClick={() => onNavigateTab('today')}
            className="w-full min-h-[44px] mt-2 flex items-center justify-center gap-2 px-3 rounded-xl border border-[#222933] text-slate-300 text-xs font-semibold hover:border-[#2e3947] active:scale-[0.98]">
            Open full Today view
          </button>
        </div>
      </div>
    </div>
  );
};
