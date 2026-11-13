import type { AppState, TabType, PhaseType, DailyLog } from '../types';
import { getSlotInfo } from '../data/workoutData';

export type NextStepCategory = 'onboarding' | 'training' | 'nutrition' | 'habits' | 'checkin' | 'milestone';

export interface NextStepItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  actionTab?: TabType;
  actionLabel: string;
  category: NextStepCategory;
}

/**
 * Checks if a specific day is a scheduled weekly weigh-in day.
 * Phase 1: Days 1, 7
 * Phase 2: Days 8, 15, 22, 29, 35
 * Phase 3: Days 36, 43, 50, 57, 63
 */
export function isWeeklyWeighInDay(dayNumber: number): boolean {
  if (dayNumber >= 1 && dayNumber <= 7) {
    return dayNumber === 1 || dayNumber === 7;
  }
  if (dayNumber >= 8 && dayNumber <= 35) {
    return [8, 15, 22, 29, 35].includes(dayNumber);
  }
  if (dayNumber >= 36) {
    return [36, 43, 50, 57, 63].includes(dayNumber);
  }
  return false;
}

/**
 * Determines whether a single daily log contains user-entered activity or content.
 */
function logHasUserContent(log: DailyLog | undefined): boolean {
  if (!log || typeof log !== 'object') return false;
  const hasChecks = Boolean(log.checklist && Object.values(log.checklist).some(Boolean));
  const hasSupps = Boolean(log.supplements && Object.values(log.supplements).some(Boolean));
  const m = log.macrosConsumed || { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const hasFood = [m.calories, m.protein, m.fat, m.carbs].some((v) => typeof v === 'number' && v > 0);
  const hasWater = typeof log.waterMl === 'number' && log.waterMl > 0;
  const hasSteps = typeof log.steps === 'number' && log.steps > 0;
  const hasNotes = Boolean(log.notes || log.generalNotes || log.painOrIllnessNotes);
  const hasEntered = Boolean(log.entered && Object.values(log.entered).some((v) => v !== undefined));
  const hasFlags = Boolean(log.isRestDay || log.isSkipped || log.isModified);
  const hasRatings = log.hungerRating !== undefined || log.sorenessRating !== undefined || log.energyRating !== undefined;
  const hasSleep = log.sleepHours !== undefined && log.sleepHours !== null && log.sleepHours > 0;
  const hasLists = (Array.isArray(log.addedCarbs) && log.addedCarbs.length > 0) ||
    (Array.isArray(log.mealEstimates) && log.mealEstimates.length > 0);
  return hasChecks || hasSupps || hasFood || hasWater || hasSteps || hasNotes || hasEntered || hasFlags || hasRatings || hasSleep || hasLists;
}

/**
 * Checks whether the stored state has any real user-recorded progress entries
 * (weigh-ins, photos, measurements, completed workouts, or active daily logs).
 */
export function hasMeaningfulUserData(appState: Partial<AppState> | null | undefined): boolean {
  if (!appState) return false;
  if (Array.isArray(appState.weighIns) && appState.weighIns.length > 0) return true;
  if (Array.isArray(appState.photos) && appState.photos.length > 0) return true;
  if (Array.isArray(appState.measurementHistory) && appState.measurementHistory.length > 0) return true;
  if (appState.workoutLogs && typeof appState.workoutLogs === 'object') {
    if (Object.values(appState.workoutLogs).some((w) => Boolean(w && (w.workoutCompleted || w.isRest || w.isSkipped || w.isModified)))) {
      return true;
    }
  }
  if (appState.dailyLogs && typeof appState.dailyLogs === 'object') {
    if (Object.values(appState.dailyLogs).some(logHasUserContent)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether the user is in a fresh install or empty state (no logs yet, unconfirmed setup).
 */
export function isFreshOrEmptyState(appState: Partial<AppState> | null | undefined): boolean {
  if (!appState) return true;
  const settings = appState.settings;
  if (!settings) return true;
  if (!settings.onboardingCompleted) return true;
  if (!settings.confirmedProgrammeStart) return true;
  if (!hasMeaningfulUserData(appState)) return true;
  return false;
}

/**
 * Builds the Foundation week (Phase 1) starter / re-entry steps for a fresh or empty state.
 */
function getFoundationStarterSteps(appState: Partial<AppState> | null | undefined): NextStepItem[] {
  const settings = appState?.settings;
  const todayLog = appState?.dailyLogs?.[appState?.currentDayNumber || 1];

  const hasSchedule = Boolean(settings?.confirmedProgrammeStart && settings?.startDate);
  const hasCheckin = Boolean(
    (Array.isArray(appState?.weighIns) && appState.weighIns.length > 0) ||
    (Array.isArray(appState?.photos) && appState.photos.length > 0)
  );
  const hasWorkout = Boolean(
    todayLog?.checklist?.workout ||
    (appState?.workoutLogs && Object.values(appState.workoutLogs).some((w) => w?.workoutCompleted))
  );
  const hasNutrition = Boolean(
    todayLog?.checklist?.cleanEating ||
    todayLog?.checklist?.water ||
    (typeof todayLog?.waterMl === 'number' && todayLog.waterMl > 0)
  );

  return [
    {
      id: 'starter-schedule',
      title: hasSchedule ? 'Programme Schedule Confirmed' : 'Confirm Programme Schedule',
      description: hasSchedule
        ? 'Programme start date and timezone are locked in'
        : 'Set your start date and local timezone to align daily tracking',
      completed: hasSchedule,
      actionTab: 'today',
      actionLabel: hasSchedule ? 'Confirmed' : 'Confirm Schedule',
      category: 'onboarding'
    },
    {
      id: 'starter-checkin',
      title: hasCheckin ? 'Starting Check-in Recorded' : 'Record Starting Check-in',
      description: hasCheckin
        ? 'Baseline bodyweight or progress photo is logged'
        : 'Log baseline bodyweight and initial progress photos',
      completed: hasCheckin,
      actionTab: 'progress',
      actionLabel: hasCheckin ? 'View Check-in' : 'Log Check-in',
      category: 'checkin'
    },
    {
      id: 'starter-training',
      title: hasWorkout ? 'Foundation Workout Completed' : 'Begin Foundation Training',
      description: hasWorkout
        ? 'Introductory full-body training session completed'
        : 'Review movement fundamentals and complete the introductory full-body workout',
      completed: hasWorkout,
      actionTab: 'train',
      actionLabel: hasWorkout ? 'View Workout' : 'Start Workout',
      category: 'training'
    },
    {
      id: 'starter-nutrition',
      title: hasNutrition ? 'Nutrition Baseline Established' : 'Establish Nutrition & Hydration Baseline',
      description: hasNutrition
        ? 'Clean eating and initial hydration logged'
        : 'Maintain clean eating habits and reach your daily water intake target',
      completed: hasNutrition,
      actionTab: 'eat',
      actionLabel: hasNutrition ? 'View Nutrition' : 'Log Nutrition',
      category: 'nutrition'
    }
  ];
}

/**
 * Pure, read-only derivation of next steps based strictly on stored state and progress.
 * Never mutates or writes to appState.
 */
export function deriveNextSteps(appState: AppState | null | undefined): NextStepItem[] {
  if (!appState || isFreshOrEmptyState(appState)) {
    return getFoundationStarterSteps(appState);
  }

  const dayNumber = Math.max(1, Math.min(63, appState.currentDayNumber || 1));
  const todayLog = appState.dailyLogs?.[dayNumber];
  const settings = appState.settings || {};
  const slot = getSlotInfo(dayNumber);

  const items: NextStepItem[] = [];

  // 1. Training session step
  const isRest = Boolean(todayLog?.isRestDay || slot.isRest);
  if (isRest) {
    const recoveryAcknowledged = Boolean(todayLog?.isRestDay || todayLog?.checklist?.workout);
    items.push({
      id: 'daily-training',
      title: 'Active Recovery & Mobility',
      description: 'Prioritize muscle recovery, light mobility, and hydration',
      completed: recoveryAcknowledged,
      actionTab: 'train',
      actionLabel: 'View Recovery',
      category: 'training'
    });
  } else {
    const workoutDone = Boolean(
      todayLog?.checklist?.workout ||
      appState.workoutLogs?.[String(dayNumber)]?.workoutCompleted
    );
    items.push({
      id: 'daily-training',
      title: workoutDone ? 'Scheduled Workout Completed' : 'Complete Scheduled Workout',
      description: workoutDone
        ? 'Training session logged and completed'
        : 'Execute today\'s training session with controlled tempo and strict form',
      completed: workoutDone,
      actionTab: 'train',
      actionLabel: workoutDone ? 'View Workout' : 'Start Workout',
      category: 'training'
    });
  }

  // 2. Nutrition and protein target step
  const isP1 = dayNumber >= 1 && dayNumber <= 7;
  const proteinDone = Boolean(
    todayLog?.checklist?.protein ||
    (isP1 && todayLog?.checklist?.cleanEating) ||
    (todayLog?.macrosConsumed?.protein && settings.bodyweightKg && todayLog.macrosConsumed.protein >= settings.bodyweightKg * 2)
  );
  items.push({
    id: 'daily-nutrition',
    title: proteinDone ? 'Daily Nutrition Target Met' : 'Hit Daily Nutrition & Protein Target',
    description: proteinDone
      ? 'Nutrition logged and daily target achieved'
      : 'Log meals and ensure daily protein requirement is met',
    completed: proteinDone,
    actionTab: 'eat',
    actionLabel: proteinDone ? 'View Meals' : 'Log Meals',
    category: 'nutrition'
  });

  // 3. Hydration step
  const waterTarget = dayNumber >= 36 ? 4000 : (settings.waterGoalMl || 3000);
  const waterDone = Boolean(todayLog?.checklist?.water || (todayLog?.waterMl || 0) >= waterTarget);
  items.push({
    id: 'daily-water',
    title: waterDone ? 'Hydration Target Reached' : 'Reach Daily Hydration Target',
    description: waterDone
      ? 'Daily clean water intake goal achieved'
      : 'Drink clean water steadily throughout the day',
    completed: waterDone,
    actionTab: 'eat',
    actionLabel: waterDone ? 'View Water' : 'Log Water',
    category: 'habits'
  });

  // 4. Daily steps & non-exercise activity step
  const stepTarget = settings.stepGoal || 10000;
  const stepsDone = Boolean(
    todayLog?.checklist?.steps ||
    todayLog?.checklist?.cardio ||
    (todayLog?.steps || 0) >= stepTarget
  );
  items.push({
    id: 'daily-steps',
    title: stepsDone ? 'Daily Steps & Activity Logged' : 'Complete Daily Steps & Activity',
    description: stepsDone
      ? 'Daily step target or cardio quota completed'
      : 'Reach your daily step count and cardio activity target',
    completed: stepsDone,
    actionTab: 'eat',
    actionLabel: stepsDone ? 'View Steps' : 'Log Steps',
    category: 'habits'
  });

  // 5. Weekly progress check-in step (if today is a scheduled weekly weigh-in day)
  if (isWeeklyWeighInDay(dayNumber)) {
    const hasTodayWeighIn = Array.isArray(appState.weighIns) && appState.weighIns.some(
      (w) => w.dayNumber === dayNumber || (todayLog?.date && w.date === todayLog.date)
    );
    const checkinDone = Boolean(hasTodayWeighIn || todayLog?.checklist?.photo);
    items.push({
      id: 'weekly-checkin',
      title: checkinDone ? 'Weekly Progress Check-in Logged' : 'Log Weekly Progress Check-in',
      description: checkinDone
        ? 'Morning scale weight and progress check-in recorded'
        : 'Record morning scale weight and physique check-in',
      completed: checkinDone,
      actionTab: 'progress',
      actionLabel: checkinDone ? 'View Progress' : 'Log Check-in',
      category: 'checkin'
    });
  }

  // 6. Phase transition milestone (end of phase 1 or phase 2)
  if (dayNumber === 7) {
    const transitioned = Boolean(settings.phase2Unlocked && settings.activePhase !== 'phase1');
    items.push({
      id: 'phase-transition',
      title: 'Prepare for Next Training Phase',
      description: 'Review Base Building schedule and progressive overload split',
      completed: transitioned,
      actionTab: 'learn',
      actionLabel: 'Explore Phase',
      category: 'milestone'
    });
  } else if (dayNumber === 35) {
    const transitioned = Boolean(settings.phase3Unlocked && settings.activePhase === 'phase3');
    items.push({
      id: 'phase-transition',
      title: 'Prepare for Muscle Building Phase',
      description: 'Review Phase 3 split, supersets, and calorie adjustments',
      completed: transitioned,
      actionTab: 'learn',
      actionLabel: 'Explore Phase',
      category: 'milestone'
    });
  }

  // 7. All core daily targets completed recognition
  const coreDailyItems = items.filter((i) => i.category !== 'milestone');
  const allCoreDone = coreDailyItems.length > 0 && coreDailyItems.every((i) => i.completed);
  if (allCoreDone) {
    items.push({
      id: 'daily-completed',
      title: 'Daily Execution Complete',
      description: 'All daily targets accomplished. Prioritize recovery and restful sleep.',
      completed: true,
      actionTab: 'today',
      actionLabel: 'Review Day',
      category: 'habits'
    });
  }

  return items;
}
