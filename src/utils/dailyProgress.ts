import React from 'react';
import { Utensils, Moon, Wheat, Footprints } from 'lucide-react';
import { DailyChecklist } from '../types';

export interface ChecklistItem {
  key: keyof DailyChecklist;
  label: string;
  desc: string;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * The single source of truth for "today's non-negotiables" per phase.
 * Used by BOTH TodayView and HomeView so the homepage ring and the
 * Today checklist always show the same items and the same counts.
 */
export function dailyChecklistItems(dayNumber: number): ChecklistItem[] {
  const isPhase1 = dayNumber >= 1 && dayNumber <= 7;
  const isPhase3 = dayNumber >= 36;

  if (isPhase1) {
    return [
      { key: 'workout', label: 'Full body workout completed', desc: '10 fundamental movements with strict form and light/moderate weights' },
      { key: 'cardio', label: '10-15 min cardio completed', desc: 'Treadmill, cycling, or cross trainer at conversational pace' },
      { key: 'cleanEating', label: 'Clean eating strictly maintained', desc: 'Zero sugar, zero junk food, zero maida, zero alcohol, home-cooked food', icon: Utensils },
      { key: 'water', label: '3+ Litres clean water goal', desc: 'Hydrate continuously to flush toxins and support recovery' },
      { key: 'photo', label: 'Daily progress photo taken', desc: 'Same lighting, fasted morning check-in for Day 1 to 7 comparison' },
      { key: 'community', label: 'Community check-in posted', desc: 'Share your daily wins and keep your commitment rock solid' }
    ];
  }
  if (isPhase3) {
    return [
      { key: 'workout', label: 'Workout completed', desc: 'Push, Pull, Legs, Chest+Back, or Arms+Delts with supersets & drop sets' },
      { key: 'cardio', label: 'Cardio completed', desc: '15 min LISS (Days 1, 3, 6), 100-150m Sprints (Days 2, 5), or Walk' },
      { key: 'protein', label: 'Protein target hit', desc: '2g per kg bodyweight consumed from clean Jain sources' },
      { key: 'water', label: '4 Litres water goal', desc: '500ml upon waking, steady hydration throughout day' },
      { key: 'sleep', label: '7-8 hours sleep achieved', desc: 'Primary nocturnal window for growth hormone and recovery', icon: Moon },
      { key: 'fasting', label: '16:8 fasting maintained', desc: '8 PM to 12 PM fast, zero calories during fasting hours' },
      { key: 'prePostCarbs', label: 'Pre/post workout carbs taken', desc: '+200 kcal clean carbs placed around training window', icon: Wheat },
      { key: 'photo', label: 'Progress photo taken', desc: 'Fasted physique check in consistent morning lighting' },
      { key: 'community', label: 'Community post shared', desc: 'Log your workout weights and maintain tribe accountability' }
    ];
  }
  return [
    { key: 'workout', label: 'Workout completed', desc: 'Push, Pull, or Legs heavy lifting with strict tempo' },
    { key: 'abs', label: 'Abs routine completed', desc: '5-8 min high-tension slot abs before cardio' },
    { key: 'cardio', label: 'LISS cardio completed', desc: '15-20 min brisk walking / incline / cycle' },
    { key: 'fasting', label: '16-hour fast maintained', desc: 'Zero calories during fast, water/black coffee only' },
    { key: 'protein', label: 'Protein target hit', desc: '2g per kg bodyweight consumed from Jain sources' },
    { key: 'water', label: 'Water goal reached', desc: '3.5 litres of clean water consumed' },
    { key: 'steps', label: '10,000 steps completed', desc: 'Daily non-exercise physical activity quota', icon: Footprints },
    { key: 'photo', label: 'Progress photo taken', desc: 'Morning fasted physique check in consistent lighting' },
    { key: 'community', label: 'Community post shared', desc: 'Log accountability check-in with your tribe' }
  ];
}

export interface DailyProgress {
  completedCount: number;
  totalItems: number;
  progressPercent: number;
  isDayComplete: boolean;
}

export function dailyProgress(checklist: DailyChecklist, dayNumber: number): DailyProgress {
  const items = dailyChecklistItems(dayNumber);
  const completedCount = items.filter((item) => !!checklist[item.key]).length;
  const totalItems = items.length;
  return {
    completedCount,
    totalItems,
    progressPercent: totalItems === 0 ? 0 : Math.round((completedCount / totalItems) * 100),
    isDayComplete: totalItems > 0 && completedCount === totalItems
  };
}
