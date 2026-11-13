/** Separates PREVIEWING a phase (view only, never saved or synced) from SWITCHING the plan (persistent). Pure. */
import type { AppState, PhaseType } from '../types';

export const phaseNumber = (p: PhaseType): number => (p === 'phase1' ? 1 : p === 'phase3' ? 3 : 2);
export const phaseStartDay = (p: PhaseType): number => (p === 'phase1' ? 1 : p === 'phase3' ? 36 : 8);
export const switchPlanQuestion = (p: PhaseType): string => `Switch your plan to Phase ${phaseNumber(p)}?`;
export const previewChipText = (p: PhaseType): string => `Previewing Phase ${phaseNumber(p)}`;
export const PREVIEW_BLOCKED_MESSAGE = 'Previewing a phase: tap "Back to my plan" to log or edit';

export interface PhasePreview { phase: PhaseType; day: number }

/** The state the screens should DISPLAY. Returns the same object when not previewing; never touches settings.activePhase. */
export function displayState(real: AppState, preview: PhasePreview | null): AppState {
  if (!preview) return real;
  return { ...real, selectedDayNumber: preview.day };
}

/** The ONLY transformation that changes the persistent plan phase (used after an explicit confirm / Settings action). */
export function switchPlan(prev: AppState, phase: PhaseType): AppState {
  return { ...prev, settings: { ...prev.settings, activePhase: phase }, selectedDayNumber: phaseStartDay(phase) };
}
