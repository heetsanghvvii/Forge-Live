import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveNextSteps,
  isFreshOrEmptyState,
  isWeeklyWeighInDay,
  hasMeaningfulUserData,
  NextStepItem
} from './nextSteps';
import { getInitialState } from './storage';
import type { AppState, DailyLog } from '../types';

function deepClone<T>(obj: T): T {
  return structuredClone(obj);
}

test('nextSteps: handles null or undefined appState gracefully without throwing', () => {
  const stepsNull = deriveNextSteps(null);
  assert.equal(Array.isArray(stepsNull), true);
  assert.equal(stepsNull.length, 4);
  assert.equal(stepsNull[0].id, 'starter-schedule');

  const stepsUndef = deriveNextSteps(undefined);
  assert.equal(Array.isArray(stepsUndef), true);
  assert.equal(stepsUndef.length, 4);

  assert.equal(isFreshOrEmptyState(null), true);
  assert.equal(isFreshOrEmptyState(undefined), true);
  assert.equal(hasMeaningfulUserData(null), false);
});

test('nextSteps: derivation is strictly read-only and never mutates appState', () => {
  const state = getInitialState();
  const snapshotBefore = deepClone(state);

  const steps = deriveNextSteps(state);
  assert.equal(Array.isArray(steps), true);

  // Stored state must remain completely unchanged
  assert.deepEqual(state, snapshotBefore);
});

test('nextSteps: fresh or empty state proposes Foundation week (Phase 1) starter steps', () => {
  const state = getInitialState();
  assert.equal(isFreshOrEmptyState(state), true);

  const steps = deriveNextSteps(state);
  assert.equal(steps.length, 4);

  const ids = steps.map((s) => s.id);
  assert.deepEqual(ids, [
    'starter-schedule',
    'starter-checkin',
    'starter-training',
    'starter-nutrition'
  ]);

  // Initially none are completed except when criteria met
  const scheduleStep = steps.find((s) => s.id === 'starter-schedule');
  assert.equal(scheduleStep?.completed, false);
  assert.equal(scheduleStep?.actionTab, 'today');

  const checkinStep = steps.find((s) => s.id === 'starter-checkin');
  assert.equal(checkinStep?.completed, false);
  assert.equal(checkinStep?.actionTab, 'progress');

  const trainingStep = steps.find((s) => s.id === 'starter-training');
  assert.equal(trainingStep?.completed, false);
  assert.equal(trainingStep?.actionTab, 'train');

  const nutritionStep = steps.find((s) => s.id === 'starter-nutrition');
  assert.equal(nutritionStep?.completed, false);
  assert.equal(nutritionStep?.actionTab, 'eat');
});

test('nextSteps: starter steps reflect partial completion while still in setup/starter phase', () => {
  const state = getInitialState();
  state.settings.confirmedProgrammeStart = true;
  state.settings.startDate = '2026-10-26';
  // Still empty data, so fresh/starter steps apply
  assert.equal(isFreshOrEmptyState(state), true);

  const steps = deriveNextSteps(state);
  const scheduleStep = steps.find((s) => s.id === 'starter-schedule');
  assert.equal(scheduleStep?.completed, true);
  assert.equal(scheduleStep?.title, 'Programme Schedule Confirmed');

  // Add initial weigh-in
  state.weighIns.push({ date: '2026-10-26', dayNumber: 1, weight: 75 });
  const checkinStep = deriveNextSteps(state).find((s) => s.id === 'starter-checkin');
  assert.equal(checkinStep?.completed, true);
  assert.equal(checkinStep?.title, 'Starting Check-in Recorded');
});

test('nextSteps: active user derives today workout, nutrition, hydration, and steps', () => {
  const state = getInitialState();
  state.settings.onboardingCompleted = true;
  state.settings.confirmedProgrammeStart = true;
  state.settings.startDate = '2026-10-20';
  state.settings.bodyweightKg = 75;
  state.currentDayNumber = 10; // Phase 2 workout day

  // Mark meaningful data so it is active state
  state.dailyLogs[10].checklist.workout = false;
  state.dailyLogs[10].waterMl = 1500; // Under 3500ml target
  state.dailyLogs[10].steps = 4000;    // Under 10000 target
  state.weighIns.push({ date: '2026-10-20', dayNumber: 1, weight: 75 });

  assert.equal(isFreshOrEmptyState(state), false);

  const steps = deriveNextSteps(state);
  const training = steps.find((s) => s.id === 'daily-training');
  assert.equal(training?.completed, false);
  assert.equal(training?.title, 'Complete Scheduled Workout');
  assert.equal(training?.actionTab, 'train');

  const nutrition = steps.find((s) => s.id === 'daily-nutrition');
  assert.equal(nutrition?.completed, false);
  assert.equal(nutrition?.title, 'Hit Daily Nutrition & Protein Target');
  assert.equal(nutrition?.actionTab, 'eat');

  const water = steps.find((s) => s.id === 'daily-water');
  assert.equal(water?.completed, false);
  assert.equal(water?.title, 'Reach Daily Hydration Target');
  assert.equal(water?.actionTab, 'eat');

  const stepsItem = steps.find((s) => s.id === 'daily-steps');
  assert.equal(stepsItem?.completed, false);
  assert.equal(stepsItem?.title, 'Complete Daily Steps & Activity');
  assert.equal(stepsItem?.actionTab, 'eat');
});

test('nextSteps: active user completion updates items dynamically', () => {
  const state = getInitialState();
  state.settings.onboardingCompleted = true;
  state.settings.confirmedProgrammeStart = true;
  state.settings.bodyweightKg = 70;
  state.currentDayNumber = 10;
  state.weighIns.push({ date: '2026-10-20', dayNumber: 1, weight: 70 });

  // Mark all tasks completed for Day 10
  state.dailyLogs[10].checklist.workout = true;
  state.dailyLogs[10].checklist.protein = true;
  state.dailyLogs[10].waterMl = 3500;
  state.dailyLogs[10].steps = 11000;

  const steps = deriveNextSteps(state);
  const training = steps.find((s) => s.id === 'daily-training');
  assert.equal(training?.completed, true);
  assert.equal(training?.title, 'Scheduled Workout Completed');

  const nutrition = steps.find((s) => s.id === 'daily-nutrition');
  assert.equal(nutrition?.completed, true);
  assert.equal(nutrition?.title, 'Daily Nutrition Target Met');

  const water = steps.find((s) => s.id === 'daily-water');
  assert.equal(water?.completed, true);
  assert.equal(water?.title, 'Hydration Target Reached');

  const stepsItem = steps.find((s) => s.id === 'daily-steps');
  assert.equal(stepsItem?.completed, true);
  assert.equal(stepsItem?.title, 'Daily Steps & Activity Logged');

  // Day 10 is not a weekly weigh-in day
  assert.equal(steps.some((s) => s.id === 'weekly-checkin'), false);

  // All core items are completed, so celebration step is added
  const completedNotice = steps.find((s) => s.id === 'daily-completed');
  assert.notEqual(completedNotice, undefined);
  assert.equal(completedNotice?.title, 'Daily Execution Complete');
});

test('nextSteps: weekly weigh-in day is proposed only on scheduled weigh-in days', () => {
  assert.equal(isWeeklyWeighInDay(1), true);
  assert.equal(isWeeklyWeighInDay(7), true);
  assert.equal(isWeeklyWeighInDay(8), true);
  assert.equal(isWeeklyWeighInDay(15), true);
  assert.equal(isWeeklyWeighInDay(22), true);
  assert.equal(isWeeklyWeighInDay(29), true);
  assert.equal(isWeeklyWeighInDay(35), true);
  assert.equal(isWeeklyWeighInDay(36), true);
  assert.equal(isWeeklyWeighInDay(43), true);
  assert.equal(isWeeklyWeighInDay(63), true);

  assert.equal(isWeeklyWeighInDay(2), false);
  assert.equal(isWeeklyWeighInDay(9), false);
  assert.equal(isWeeklyWeighInDay(14), false);
  assert.equal(isWeeklyWeighInDay(20), false);

  const state = getInitialState();
  state.settings.onboardingCompleted = true;
  state.settings.confirmedProgrammeStart = true;
  state.weighIns.push({ date: '2026-10-20', dayNumber: 1, weight: 70 });

  // Day 15 is a weekly weigh-in day
  state.currentDayNumber = 15;
  const stepsDay15 = deriveNextSteps(state);
  const checkin15 = stepsDay15.find((s) => s.id === 'weekly-checkin');
  assert.notEqual(checkin15, undefined);
  assert.equal(checkin15?.completed, false);
  assert.equal(checkin15?.actionTab, 'progress');

  // Recording weigh-in for Day 15 completes it
  state.weighIns.push({ date: '2026-11-04', dayNumber: 15, weight: 69.2 });
  const stepsDay15Done = deriveNextSteps(state);
  const checkin15Done = stepsDay15Done.find((s) => s.id === 'weekly-checkin');
  assert.equal(checkin15Done?.completed, true);
  assert.equal(checkin15Done?.title, 'Weekly Progress Check-in Logged');
});

test('nextSteps: scheduled rest days suggest recovery and mobility', () => {
  const state = getInitialState();
  state.settings.onboardingCompleted = true;
  state.settings.confirmedProgrammeStart = true;
  state.weighIns.push({ date: '2026-10-20', dayNumber: 1, weight: 70 });

  // Day 7 in Phase 1 is a scheduled rest day
  state.currentDayNumber = 7;
  const steps = deriveNextSteps(state);
  const training = steps.find((s) => s.id === 'daily-training');
  assert.equal(training?.title, 'Active Recovery & Mobility');
  assert.equal(training?.actionLabel, 'View Recovery');
});

test('nextSteps: end of phase triggers milestone transition review', () => {
  const state = getInitialState();
  state.settings.onboardingCompleted = true;
  state.settings.confirmedProgrammeStart = true;
  state.settings.activePhase = 'phase1';
  state.settings.phase2Unlocked = false;
  state.weighIns.push({ date: '2026-10-20', dayNumber: 1, weight: 70 });

  // Day 7 is end of Phase 1
  state.currentDayNumber = 7;
  const steps = deriveNextSteps(state);
  const milestone = steps.find((s) => s.id === 'phase-transition');
  assert.notEqual(milestone, undefined);
  assert.equal(milestone?.title, 'Prepare for Next Training Phase');
  assert.equal(milestone?.completed, false);

  // Transitioning to Phase 2 marks it complete
  state.settings.activePhase = 'phase2';
  state.settings.phase2Unlocked = true;
  const stepsAfterTransition = deriveNextSteps(state);
  const milestoneAfter = stepsAfterTransition.find((s) => s.id === 'phase-transition');
  assert.equal(milestoneAfter?.completed, true);
});

test('nextSteps: never hardcodes specific day numbers (e.g. "Day 3") or medical precaution details', () => {
  const state = getInitialState();
  state.settings.onboardingCompleted = true;
  state.settings.confirmedProgrammeStart = true;
  state.weighIns.push({ date: '2026-10-20', dayNumber: 1, weight: 70 });

  // Check all days 1 to 63 to verify no hardcoded "Day <N>" strings appear in titles or descriptions
  for (let d = 1; d <= 63; d++) {
    state.currentDayNumber = d;
    const steps = deriveNextSteps(state);
    for (const step of steps) {
      // Must not match specific day numbers like "Day 3", "Day 12", etc.
      assert.doesNotMatch(step.title, /\bDay \d+\b/i, `Day pattern found in title: ${step.title}`);
      assert.doesNotMatch(step.description, /\bDay \d+\b/i, `Day pattern found in desc: ${step.description}`);

      // Must not contain clinical or medical precaution details
      assert.doesNotMatch(step.title, /\b(medical|doctor|physician|injury|contraindication|illness)\b/i);
      assert.doesNotMatch(step.description, /\b(medical|doctor|physician|injury|contraindication|illness)\b/i);
    }
  }
});
