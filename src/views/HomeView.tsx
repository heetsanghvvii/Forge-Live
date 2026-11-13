import React, { useRef, useEffect } from 'react';
import { AppState, DailyChecklist, TabType } from '../types';
import { dailyChecklistItems, dailyProgress } from '../utils/dailyProgress';
import { launchConfetti } from '../utils/confetti';
import { Flame, Check, ArrowRight } from 'lucide-react';
import { DailyChecklist as ChecklistKeys } from '../types';

/**
 * Home-only neutral wording. The shared util keeps the original course
 * descriptions for the Today tab; Home shows short neutral labels so the
 * app does not present course health claims as its own advice. Targets and
 * item keys are untouched.
 */
const HOME_COPY: Partial<Record<keyof ChecklistKeys, { label: string; desc: string }>> = {
  workout: { label: 'Workout', desc: "Today's training session" },
  cardio: { label: 'Cardio', desc: "Today's cardio session" },
  water: { label: 'Water', desc: "Today's hydration goal" },
  photo: { label: 'Progress photo', desc: "Today's check-in photo" },
  community: { label: 'Community check-in', desc: "Share today's check-in" },
  cleanEating: { label: 'Eating on plan', desc: "Stick to today's food plan" },
  protein: { label: 'Protein', desc: "Today's protein target" },
  fasting: { label: 'Fasting', desc: "Today's fasting window" },
  abs: { label: 'Abs routine', desc: "Today's abs session" },
  steps: { label: 'Steps', desc: "Today's step goal" },
  sleep: { label: 'Sleep', desc: "Last night's sleep goal" },
  prePostCarbs: { label: 'Workout carbs', desc: 'Carbs around your training' }
};

interface HomeViewProps {
  appState: AppState;
  onToggleChecklist: (key: keyof DailyChecklist) => void;
  onNavigateTab: (tab: TabType) => void;
  streak: number;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Rest well';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Home: a calm landing page whose centerpiece is today's progress ring.
 * The ring and rows are the SAME checklist as the Today tab (shared
 * dailyProgress util) - ticking here ticks it everywhere, and vice versa.
 */
export const HomeView: React.FC<HomeViewProps> = ({ appState, onToggleChecklist, onNavigateTab, streak }) => {
  const { currentDayNumber, dailyLogs, settings } = appState;
  const log = dailyLogs[currentDayNumber];
  const checklist = log?.checklist || { workout: false, cardio: false, water: false, photo: false, community: false };
  const items = dailyChecklistItems(currentDayNumber);
  const { completedCount, totalItems, progressPercent, isDayComplete } = dailyProgress(checklist, currentDayNumber);

  // Same completion moment as Today: celebrate the transition into a full ring.
  const prevCompletedRef = useRef(completedCount);
  useEffect(() => {
    if (completedCount === totalItems && totalItems > 0 && prevCompletedRef.current < totalItems) {
      if (typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        launchConfetti();
      }
    }
    prevCompletedRef.current = completedCount;
  }, [completedCount, totalItems]);

  const size = 220;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;
  const name = (settings.displayName || '').trim().split(' ')[0];

  return (
    <div className="space-y-6 pb-4">
      {/* Calm greeting */}
      <div className="pt-2 px-1 flex items-end justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1">
            {greeting()}{name ? `, ${name}` : ''}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#14181D] border border-[#222933]">
          <Flame className="w-3.5 h-3.5 text-[#FF8C3B]" />
          <span className="text-xs font-bold text-slate-200 tabular-nums">{streak}</span>
        </div>
      </div>

      {/* The ring: number of things done today */}
      <div className="p-6 rounded-3xl bg-[#14181D] border border-[#222933] shadow-lg flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center">
          <svg width={size} height={size} className="transform -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius} stroke="#222933" strokeWidth={strokeWidth} fill="transparent" />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#B6FF3B"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-safe:ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-4xl font-extrabold text-white tabular-nums leading-none">{completedCount}</span>
            <span className="text-xs font-semibold text-slate-400 mt-1.5">of {totalItems} done today</span>
          </div>
        </div>
        <p className="text-sm text-slate-400 text-center leading-relaxed">
          {isDayComplete
            ? 'Day complete. Everything is ticked - soak it in.'
            : completedCount === 0
            ? 'A fresh day. Tick one thing below and watch the ring fill.'
            : 'Nice. Keep the ring filling, one tick at a time.'}
        </p>
      </div>

      {/* The fillable list: the same non-negotiables as Today */}
      <div className="space-y-2.5">
        {items.map((item) => {
          const done = !!checklist[item.key];
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onToggleChecklist(item.key)}
              className={`w-full min-h-[56px] flex items-center gap-4 p-4 rounded-2xl border text-left motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out active:scale-[0.98] ${
                done
                  ? 'bg-[#B6FF3B]/10 border-[#B6FF3B]/40'
                  : 'bg-[#14181D] border-[#222933] hover:border-[#2e3947]'
              }`}
            >
              <span
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center motion-safe:transition-all motion-safe:duration-300 ${
                  done ? 'bg-[#B6FF3B] scale-105' : 'border-2 border-[#2e3947]'
                }`}
              >
                {done && <Check className="w-4 h-4 text-black" strokeWidth={3.5} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-semibold motion-safe:transition-colors motion-safe:duration-300 ${done ? 'text-[#B6FF3B]' : 'text-white'}`}>
                  {(HOME_COPY[item.key] || item).label}
                </span>
                <span className="block text-xs text-slate-500 truncate mt-0.5">{(HOME_COPY[item.key] || item).desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onNavigateTab('today')}
        className="w-full min-h-[48px] rounded-2xl bg-[#14181D] border border-[#222933] text-slate-300 text-sm font-semibold flex items-center justify-center gap-2 hover:border-[#2e3947] transition-colors"
      >
        <span>Open full Today view</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};
