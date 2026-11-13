export type ParseResult = { ok: true; value: number } | { ok: false; error: string };

export interface NumberRules {
  min?: number;
  max?: number;
  /** Max decimal places kept (rounded). Default 2. */
  decimals?: number;
  label?: string;
}

/**
 * Strict number parsing for text inputs. Accepts '72,5' and '72.5'. Rejects blank, NaN/Infinity,
 * scientific notation ('1e5'), hex ('0x10'), thousands separators and anything with stray characters.
 */
export function parseNumberInput(text: string | null | undefined, rules: NumberRules = {}): ParseResult {
  const { min, max, decimals = 2, label = 'Value' } = rules;
  const t = (text ?? '').trim();
  if (t === '') return { ok: false, error: `${label} is required.` };
  if (/[eE]/.test(t) && !/^0[xX]/.test(t)) return { ok: false, error: `${label}: scientific notation (like 1e5) is not allowed.` };
  if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/.test(t)) return { ok: false, error: `${label} must be a plain number.` };
  const value = Number(t.replace(',', '.'));
  if (!Number.isFinite(value)) return { ok: false, error: `${label} must be a plain number.` };
  if (value < 0 && (min === undefined || min >= 0)) return { ok: false, error: `${label} cannot be negative.` };
  if (min !== undefined && value < min) return { ok: false, error: `${label} must be at least ${min}.` };
  if (max !== undefined && value > max) return { ok: false, error: `${label} must be at most ${max}.` };
  const f = Math.pow(10, Math.max(0, decimals));
  return { ok: true, value: Math.round(value * f) / f };
}

/** Display helper: '-' for anything that is not a finite number. */
export function fmtNum(v: unknown, digits?: number): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '-';
  return digits === undefined ? String(v) : String(Math.round(v * 10 ** digits) / 10 ** digits);
}

// ---- Daily counters ----
export const MAX_WATER_ML = 20000;
export const MAX_STEPS = 100000;
export const MAX_NAME_LEN = 80;
export const MAX_NOTE_LEN = 2000;

/** Adds `delta` to a counter, clamped to [0, cap]. */
export interface CounterChange {
  /** The counter value after the change. */
  next: number;
  /** The delta really applied (may be smaller than requested because of the cap). */
  applied: number;
  /** Set when the cap limited or blocked the change. */
  message?: string;
}

export function addToCounter(current: number, delta: number, cap: number, noun: string): CounterChange {
  const cur = Number.isFinite(current) ? current : 0;
  const target = Math.min(cap, Math.max(0, cur + delta));
  const applied = target - cur;
  let message: string | undefined;
  if (delta > 0 && cur + delta > cap) {
    message = applied > 0
      ? `Daily ${noun} limit is ${cap.toLocaleString()}; added only ${applied.toLocaleString()}.`
      : `Daily ${noun} limit of ${cap.toLocaleString()} reached.`;
  }
  return { next: target, applied, message };
}

/** Undo of an applied delta: subtracts only that action's amount (never below 0), leaving other taps intact. */
export function undoCounterDelta(current: number, applied: number): number {
  const cur = Number.isFinite(current) ? current : 0;
  return Math.max(0, cur - applied);
}

/** 'Hit goal' raises the counter to the goal but never lowers a higher value. Returns the delta to apply (>= 0). */
export function deltaToReachGoal(current: number, goal: number): number {
  const cur = Number.isFinite(current) ? current : 0;
  return Math.max(0, goal - cur);
}

/** Removes only the meal with this id; other meals stay. */
export function removeMealById<T extends { id: string }>(meals: T[] | undefined, id: string): T[] {
  return (Array.isArray(meals) ? meals : []).filter((m) => m.id !== id);
}

export interface MacroTotals { calories: number; protein: number; fat: number; carbs: number }
const f0 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** current + delta, field by field (non-finite values count as 0). */
export function addMacros(current: MacroTotals, delta: Partial<MacroTotals>): MacroTotals {
  return {
    calories: f0(current.calories) + f0(delta.calories),
    protein: f0(current.protein) + f0(delta.protein),
    fat: f0(current.fat) + f0(delta.fat),
    carbs: f0(current.carbs) + f0(delta.carbs),
  };
}

/** current - delta, field by field, never below 0. This is the inverse of addMacros for one action only. */
export function subtractMacros(current: MacroTotals, delta: Partial<MacroTotals>): MacroTotals {
  const s = (a: unknown, b: unknown) => Math.max(0, f0(a) - f0(b));
  return {
    calories: s(current.calories, delta.calories),
    protein: s(current.protein, delta.protein),
    fat: s(current.fat, delta.fat),
    carbs: s(current.carbs, delta.carbs),
  };
}
