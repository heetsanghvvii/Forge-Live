import type { AppState, DailyLog } from '../types';
import {
  getInitialState,
  normalizeStoredDailyLogs,
  createDefaultDailyLog,
  calculateDateForDayNumber,
  getTodayDateString,
} from './storage';

import { noteCorruptCopy } from './storageNotices';

export const CORRUPT_BACKUP_KEY = 'forge_corrupt_backup_v1';
export const CURRENT_SCHEMA_VERSION = 2;

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const num = (v: unknown, fallback = 0): number => (isNum(v) ? v : fallback);

export interface NormalizeResult {
  state: AppState;
  /** True when something structurally unusable was dropped or replaced, so the caller should keep a raw backup. */
  lossy: boolean;
}

/** Keep only usable list entries (objects passing `ok`); reports whether anything was dropped. */
function cleanList<T>(value: unknown, ok: (e: Record<string, unknown>) => boolean, onLoss: () => void): T[] {
  if (!Array.isArray(value)) {
    if (value !== undefined) onLoss();
    return [];
  }
  const out: T[] = [];
  for (const e of value) {
    if (isObj(e) && ok(e)) out.push(e as unknown as T);
    else onLoss();
  }
  return out;
}

/**
 * Turns ANY parsed JSON value into a structurally valid AppState. Never throws.
 * Values that are merely odd are repaired in place; entries that cannot be used at all are dropped and flagged `lossy`
 * so the caller can keep the raw text as a backup.
 */
export function normalizeLoadedStateDetailed(rawValue: unknown): NormalizeResult {
  let lossy = false;
  const loss = () => { lossy = true; };
  const base = getInitialState();

  if (!isObj(rawValue)) {
    if (rawValue !== null && rawValue !== undefined) lossy = true;
    (base as any).schemaVersion = CURRENT_SCHEMA_VERSION;
    return { state: base, lossy };
  }
  const raw = rawValue;
  const state: AppState = { ...(raw as unknown as AppState) };

  // Settings
  if (isObj(raw.settings)) {
    state.settings = { ...base.settings, ...(raw.settings as object) } as AppState['settings'];
    const st = state.settings;
    const rs = raw.settings as Record<string, unknown>;
    if (typeof rs.phase2StartDate !== 'string') st.phase2StartDate = undefined;
    if (typeof rs.phase3StartDate !== 'string') st.phase3StartDate = undefined;
    if (typeof st.startDate !== 'string' || !st.startDate) st.startDate = base.settings.startDate;
    // Derive missing phase dates from the stored start so a custom start never gets today-based phase dates.
    if (typeof st.phase2StartDate !== 'string') st.phase2StartDate = calculateDateForDayNumber(st.startDate!, 8) || base.settings.phase2StartDate;
    if (typeof st.phase3StartDate !== 'string') st.phase3StartDate = calculateDateForDayNumber(st.startDate!, 36) || base.settings.phase3StartDate;
  } else {
    state.settings = base.settings;
    if (raw.settings !== undefined) loss();
  }
  const s = state.settings;
  if (!s.timezone) s.timezone = 'Asia/Kolkata';
  if (!s.dietaryExclusions) s.dietaryExclusions = 'Vegetarian, no eggs, no onion, no garlic (strict Jain/sattvic)';
  if (s.injuriesAndConstraints === undefined) s.injuriesAndConstraints = '';
  if (s.wakeTime === undefined) s.wakeTime = '06:30 AM';
  if (s.workTime === undefined) s.workTime = '09:30 AM to 06:30 PM';
  if (s.gymTime === undefined) s.gymTime = '07:00 PM to 08:30 PM';
  if (s.userRole === undefined) s.userRole = 'owner';
  if (!isNum(s.waterGoalMl)) s.waterGoalMl = base.settings.waterGoalMl;
  if (!isNum(s.stepGoal)) s.stepGoal = base.settings.stepGoal;

  // Day pointers
  const day = (v: unknown, fb: number) => (isNum(v) ? Math.min(63, Math.max(1, Math.round(v))) : fb);
  state.currentDayNumber = day(raw.currentDayNumber, 1);
  state.selectedDayNumber = day(raw.selectedDayNumber, state.currentDayNumber);

  // Daily logs
  let logsIn: Record<string, unknown> = {};
  if (isObj(raw.dailyLogs)) logsIn = raw.dailyLogs;
  else if (raw.dailyLogs !== undefined) loss();
  const usable: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(logsIn)) {
    if (isObj(v) && Number.isFinite(Number(k))) usable[k] = v;
    else loss();
  }
  const logs = normalizeStoredDailyLogs(usable as unknown as { [day: number]: DailyLog }) as Record<number, DailyLog>;
  const start = typeof s.startDate === 'string' && s.startDate ? s.startDate : getTodayDateString();
  for (const [k, log] of Object.entries(logs)) {
    const n = Number(k);
    const l = log as any;
    l.dayNumber = isNum(l.dayNumber) ? l.dayNumber : n;
    if (typeof l.date !== 'string' || !l.date) l.date = calculateDateForDayNumber(start, n);
    l.waterMl = num(l.waterMl);
    l.steps = num(l.steps);
    for (const m of ['calories', 'protein', 'fat', 'carbs'] as const) l.macrosConsumed[m] = num(l.macrosConsumed[m]);
    if (l.mealEstimates !== undefined) {
      l.mealEstimates = cleanList(l.mealEstimates, () => true, loss).map((m: any, i) => ({
        ...m,
        id: typeof m.id === 'string' && m.id ? m.id : `meal-repaired-${n}-${i}`,
        name: typeof m.name === 'string' ? m.name : '',
        estimateCalories: num(m.estimateCalories),
        estimateProtein: num(m.estimateProtein),
        isEstimateOnly: m.isEstimateOnly !== false,
      }));
    }
    if (l.addedCarbs !== undefined && !Array.isArray(l.addedCarbs)) { l.addedCarbs = []; loss(); }
    for (const f of ['painOrIllnessNotes', 'generalNotes', 'notes'] as const) {
      if (l[f] !== undefined && typeof l[f] !== 'string') { l[f] = ''; loss(); }
    }
  }
  for (let d = 1; d <= 63; d++) {
    if (!logs[d]) logs[d] = createDefaultDailyLog(d, calculateDateForDayNumber(start, d));
  }
  state.dailyLogs = logs;

  // Workout logs
  const wl: Record<string, any> = {};
  if (isObj(raw.workoutLogs)) {
    for (const [k, v] of Object.entries(raw.workoutLogs)) {
      if (!isObj(v)) { loss(); continue; }
      const e: any = { ...v };
      if (!Array.isArray(e.exercises)) { if (e.exercises !== undefined) loss(); e.exercises = []; }
      else {
        const before = e.exercises.length;
        e.exercises = e.exercises
          .filter((x: unknown) => isObj(x))
          .map((x: any) => ({ ...x, sets: Array.isArray(x.sets) ? x.sets.filter((q: unknown) => isObj(q)) : [] }));
        if (e.exercises.length !== before) loss();
      }
      e.totalVolumeKg = num(e.totalVolumeKg);
      wl[k] = e;
    }
  } else if (raw.workoutLogs !== undefined) loss();
  state.workoutLogs = wl;

  // Lists
  state.weighIns = cleanList(raw.weighIns, (e) => isNum(e.weight), loss).map((w: any) => ({
    ...w,
    date: typeof w.date === 'string' ? w.date : '',
    dayNumber: isNum(w.dayNumber) ? w.dayNumber : 1,
  }));
  state.measurementHistory = cleanList(raw.measurementHistory, (e) => isObj(e.measurements), loss).map((m: any) => ({
    ...m,
    date: typeof m.date === 'string' ? m.date : '',
    dayNumber: isNum(m.dayNumber) ? m.dayNumber : 1,
    measurements: {
      chest: num(m.measurements.chest),
      waist: num(m.measurements.waist),
      hips: num(m.measurements.hips),
      arms: num(m.measurements.arms),
    },
  }));
  state.photos = cleanList(raw.photos, (e) => typeof e.dataUrl === 'string', loss);

  // learnedLessonIds
  if (Array.isArray(raw.learnedLessonIds)) {
    state.learnedLessonIds = raw.learnedLessonIds.filter((x): x is string => typeof x === 'string');
    if (state.learnedLessonIds.length !== raw.learnedLessonIds.length) loss();
  } else {
    state.learnedLessonIds = [];
    if (raw.learnedLessonIds !== undefined) loss();
  }

  // quizAnswers / avoidedMistakes
  const qa: Record<string, number> = {};
  if (isObj(raw.quizAnswers)) {
    for (const [k, v] of Object.entries(raw.quizAnswers)) { if (isNum(v)) qa[k] = v; else loss(); }
  } else if (raw.quizAnswers !== undefined) loss();
  state.quizAnswers = qa;
  const am: Record<string, boolean> = {};
  if (isObj(raw.avoidedMistakes)) {
    for (const [k, v] of Object.entries(raw.avoidedMistakes)) am[k] = !!v;
  } else if (raw.avoidedMistakes !== undefined) loss();
  state.avoidedMistakes = am;

  state.day1Tasks = isObj(raw.day1Tasks)
    ? ({ ...base.day1Tasks, ...raw.day1Tasks } as AppState['day1Tasks'])
    : base.day1Tasks;
  state.day36Tasks = isObj(raw.day36Tasks)
    ? ({ ...base.day36Tasks, ...raw.day36Tasks } as AppState['day36Tasks'])
    : base.day36Tasks;

  (state as any).schemaVersion = CURRENT_SCHEMA_VERSION;
  return { state, lossy };
}

export function normalizeLoadedState(raw: unknown): AppState {
  return normalizeLoadedStateDetailed(raw).state;
}

/**
 * Keeps the original raw text so a repair never silently destroys data. Never throws.
 * An existing backup is never overwritten: a later one gets a timestamped key. Returns the key used (or null).
 */
export function backupCorruptRaw(rawText: string | null | undefined, now: number = Date.now()): string | null {
  if (!rawText) return null;
  try {
    if (typeof localStorage === 'undefined') return null;
    let key = CORRUPT_BACKUP_KEY;
    if (localStorage.getItem(key) !== null) {
      if (localStorage.getItem(key) === rawText) { noteCorruptCopy(key); return key; }
      key = `${CORRUPT_BACKUP_KEY}_${now}`;
    }
    localStorage.setItem(key, rawText);
    noteCorruptCopy(key);
    return key;
  } catch { return null; }
}
