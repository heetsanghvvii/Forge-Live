import type { EnteredMetric } from './entered';
import { hashDoc } from './syncBase';
import { calculateDateForDayNumber } from './storage';
import type { SyncBase, BaseEntry } from './syncBase';
import type { AppState, DailyLog, WorkoutHistory, WeighInRecord, MeasurementRecord, AppSettings } from '../types';

/** Pure helpers (no firebase imports) for deciding what is worth syncing and merging cloud data into local. */

export function dailyLogHasData(log: DailyLog | undefined): boolean {
  if (!log) return false;
  const l: any = log;
  const hasChecks = Object.values(l.checklist || {}).some(Boolean);
  const hasSupps = Object.values(l.supplements || {}).some(Boolean);
  const m = l.macrosConsumed || {};
  const hasFood = [m.calories, m.protein, m.fat, m.carbs].some((v) => typeof v === 'number' && v > 0);
  const hasWater = (l.waterMl || 0) > 0;
  const hasSteps = (l.steps || 0) > 0;
  const hasNotes = Boolean(l.notes || l.generalNotes || l.painOrIllnessNotes);
  const hasEntered = Object.values(l.entered || {}).some((v) => v !== undefined);
  const hasFlags = Boolean(l.isRestDay || l.isSkipped || l.isModified);
  const hasRatings = l.hungerRating !== undefined || l.sorenessRating !== undefined || l.energyRating !== undefined;
  const hasSleep = l.sleepHours !== undefined && l.sleepHours !== null && l.sleepHours !== 0;
  const hasLists = (Array.isArray(l.addedCarbs) && l.addedCarbs.length > 0) || (Array.isArray(l.mealEstimates) && l.mealEstimates.length > 0);
  return hasChecks || hasSupps || hasFood || hasWater || hasSteps || hasNotes || hasEntered || hasFlags || hasRatings || hasSleep || hasLists;
}

export function workoutHasData(w: WorkoutHistory[string] | undefined): boolean {
  if (!w) return false;
  return Boolean(w.workoutCompleted || w.isRest || w.isSkipped || w.isModified);
}

/**
 * Does this device hold REAL user entries (as opposed to a fresh install or a programme setup)?
 * Decides first-link vs empty-device (evaluateLink), whether Load from cloud may run, whether an empty device may
 * overwrite the cloud, and whether a pull lets the cloud's programme settings win.
 *
 * COUNTS (any one is enough):
 *  - a weigh-in record, or a measurement record
 *  - a daily log with any user content: a ticked checklist/supplement, food macros > 0, waterMl > 0, steps > 0, notes,
 *    rest/skipped/modified flag, hunger/soreness/energy rating, sleep > 0, added carbs or meal estimates
 *  - an EXPLICIT ZERO: any `entered` flag that is set (true or false) on a daily log, i.e. the person typed 0 ml, 0 steps,
 *    sleep 0 or a zero meal and the input handler marked it entered (see entered.ts markEntered)
 *  - a workout record that is completed, rest, skipped or modified
 * DOES NOT COUNT (setup and placeholders):
 *  - the programme setup: start date (confirmed or not), confirmedProgrammeStart, activePhase, timezone, goals, profile
 *    text, body weight / starting weight typed in onboarding (those are settings; onboarding creates NO weigh-in)
 *  - untouched default logs: 0 steps / 0 water / 0 macros / false ticks / empty arrays / undefined ratings / no entered flags
 * A legacy 0 with no `entered` flag cannot be told apart from a default, so it does not count.
 */
export function hasMeaningfulLocalData(appState: Partial<AppState> | null | undefined): boolean {
  if (!appState) return false;
  if ((appState.weighIns || []).length > 0) return true;
  if ((appState.measurementHistory || []).length > 0) return true;
  if (Object.values(appState.dailyLogs || {}).some(dailyLogHasData)) return true;
  if (Object.values(appState.workoutLogs || {}).some(workoutHasData)) return true;
  return false;
}

/**
 * A device with no real entries and never linked to an account: its settings are only a setup. On a pull the cloud's
 * programme settings replace it (nothing the person recorded can be lost). Linked devices use the normal three-way rules.
 */
export function isSetupOnlyDevice(appState: Partial<AppState> | null | undefined): boolean {
  return !hasMeaningfulLocalData(appState) && !appState?.settings?.linkedFirebaseUid;
}

/** Union by date; `winner` entries replace `other` entries on the same date. Never shrinks. */
export function unionByDate<T extends { date: string }>(winner: T[] | undefined, other: T[] | undefined): T[] {
  const map = new Map<string, T>();
  for (const item of other || []) if (item?.date) map.set(item.date, item);
  for (const item of winner || []) if (item?.date) map.set(item.date, item);
  return Array.from(map.values()).sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
}


// ---------------------------------------------------------------------------
// Day-level merge, normalisation, sanitising and doc ids
// ---------------------------------------------------------------------------

/** A value that is an untouched default: absent, 0, false, '' or an empty array. */
export function isDefaultValue(v: unknown): boolean {
  if (v === undefined || v === null || v === false || v === 0 || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map((x) => (x === undefined ? 'null' : stableStringify(x))).join(',') + ']';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return '{' + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}

const sameValue = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

/** Firestore rejects `undefined`. Drops undefined object keys recursively, turns undefined array items into null, keeps null. */
export function sanitizeForFirestore<T>(value: T): T {
  if (Array.isArray(value)) return value.map((x) => (x === undefined ? null : sanitizeForFirestore(x))) as any;
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = sanitizeForFirestore(v);
    }
    return out as any;
  }
  return value;
}

const BASE_CHECKLIST = { workout: false, cardio: false, water: false, photo: false, community: false };
const BASE_SUPPLEMENTS = { whey: false, creatine: false, multivitamin: false, vitaminD3: false, carnitine: false, acv: false };
const BASE_MACROS = { calories: 0, protein: 0, fat: 0, carbs: 0 };

/** Fills ONLY absent keys so a minimal cloud doc cannot crash the UI. Existing values are never altered. */
export function normalizeDailyLog(raw: Partial<DailyLog> | undefined, dayNumber?: number): DailyLog {
  const r: any = { ...(raw || {}) };
  if (r.date === undefined || r.date === null) r.date = '';
  if (r.dayNumber === undefined && dayNumber !== undefined) r.dayNumber = dayNumber;
  if (r.phase === undefined) r.phase = 'phase1';
  r.checklist = { ...BASE_CHECKLIST, ...(isPlainObject(r.checklist) ? r.checklist : {}) };
  r.macrosConsumed = { ...BASE_MACROS, ...(isPlainObject(r.macrosConsumed) ? r.macrosConsumed : {}) };
  r.supplements = { ...BASE_SUPPLEMENTS, ...(isPlainObject(r.supplements) ? r.supplements : {}) };
  if (r.waterMl === undefined || r.waterMl === null) r.waterMl = 0;
  if (r.steps === undefined || r.steps === null) r.steps = 0;
  return r as DailyLog;
}

export function normalizeWorkout(raw: any): WorkoutHistory[string] {
  const r: any = { ...(raw || {}) };
  if (r.phase === undefined) r.phase = 'phase1';
  for (const k of ['workoutCompleted', 'warmupCompleted', 'cooldownCompleted', 'absCompleted', 'cardioCompleted']) {
    if (r[k] === undefined || r[k] === null) r[k] = false;
  }
  if (r.cardioMinutes === undefined || r.cardioMinutes === null) r.cardioMinutes = 0;
  if (!Array.isArray(r.exercises)) r.exercises = [];
  if (r.totalVolumeKg === undefined || r.totalVolumeKg === null) r.totalVolumeKg = 0;
  return r;
}

/** Stable cloud doc id for a daily log: its date, or day-N when the date is missing/unusable. */
export function dailyLogDocId(log: Pick<DailyLog, 'date'>, dayNumber: number): string {
  const d = typeof log?.date === 'string' ? log.date.trim() : '';
  return d && !d.includes('/') && d !== '.' && d !== '..' ? d : `day-${dayNumber}`;
}

/** Reads the day number from a cloud daily log doc (field, else a `day-N` id). */
export function dayNumberOfCloudDoc(id: string, data: { dayNumber?: unknown } | undefined): number | undefined {
  const n = Number(data?.dayNumber);
  if (Number.isFinite(n) && n > 0) return n;
  const m = /^day-(\d+)$/.exec(id);
  return m ? Number(m[1]) : undefined;
}

/**
 * Fields in `expected` (ignoring updatedAt and default-valued ones) that are missing or different in `actual`.
 * Used to verify a write by reading it back.
 */
export function contentMismatches(expected: Record<string, any>, actual: Record<string, any> | undefined, prefix = ''): string[] {
  const out: string[] = [];
  if (!actual) return [prefix || '(document missing)'];
  for (const [k, v] of Object.entries(expected)) {
    if (k === 'updatedAt' || v === undefined) continue;
    if (isDefaultValue(v) && (actual[k] === undefined || isDefaultValue(actual[k]))) continue;
    if (isPlainObject(v) && isPlainObject(actual[k])) {
      out.push(...contentMismatches(v, actual[k] as any, `${prefix}${k}.`));
    } else if (!sameValue(v, actual[k])) {
      out.push(`${prefix}${k}`);
    }
  }
  return out;
}

const METRIC_FIELDS: Array<{ metric: EnteredMetric; get: (l: any) => any; set: (l: any, v: any) => void }> = [
  { metric: 'sleep', get: (l) => l.sleepHours, set: (l, v) => { l.sleepHours = v; } },
  { metric: 'calories', get: (l) => l.macrosConsumed?.calories, set: (l, v) => { l.macrosConsumed = { ...(l.macrosConsumed || {}), calories: v }; } },
  { metric: 'protein', get: (l) => l.macrosConsumed?.protein, set: (l, v) => { l.macrosConsumed = { ...(l.macrosConsumed || {}), protein: v }; } },
  { metric: 'steps', get: (l) => l.steps, set: (l, v) => { l.steps = v; } },
  { metric: 'water', get: (l) => l.waterMl, set: (l, v) => { l.waterMl = v; } },
  { metric: 'energy', get: (l) => l.energyRating, set: (l, v) => { l.energyRating = v; } }
];
const HANDLED_KEYS = new Set(['date', 'dayNumber', 'phase', 'updatedAt', 'entered', 'checklist', 'supplements', 'macrosConsumed', 'sleepHours', 'steps', 'waterMl', 'energyRating']);

/**
 * Merges two versions of the SAME day. Never reduces data.
 * A local value is ABSENT (fillable from cloud) when undefined, or default (0/false/''/[]) with its entered flag not true.
 * Booleans in checklist/supplements OR together. Both sides non-default and different -> LOCAL wins and the field is listed in `conflicts`.
 */
export function mergeDayLogs(local: DailyLog, cloud: DailyLog, day: number): { merged: DailyLog; conflicts: string[] } {
  const conflicts: string[] = [];
  const out: any = { ...local };
  const L: any = local;
  const C: any = cloud;

  // Metrics with entered flags
  const entered: Record<string, boolean | undefined> = { ...(local.entered || {}) };
  for (const { metric, get, set } of METRIC_FIELDS) {
    const lv = get(L), rv = get(C);
    const lFlag = local.entered?.[metric], rFlag = cloud.entered?.[metric];
    const lAbsent = lv === undefined || lv === null || (isDefaultValue(lv) && lFlag !== true);
    const rAbsent = rv === undefined || rv === null || (isDefaultValue(rv) && rFlag !== true);
    if (lFlag === false) {
      // This device reviewed and rejected the metric: keep that. A cloud CONFIRMATION is a conflict; other cloud values just fill.
      if (rFlag === true) conflicts.push(`day ${day} ${metric}`);
      else if (!rAbsent && (lv === undefined || lv === null || isDefaultValue(lv))) set(out, rv);
      continue;
    }
    if (lAbsent && !rAbsent) {
      set(out, rv);
      if (rFlag !== undefined) entered[metric] = rFlag;
    } else if (lAbsent && rAbsent) {
      if (lFlag === undefined && rFlag !== undefined) entered[metric] = rFlag;
    } else if (!lAbsent && !rAbsent) {
      if (sameValue(lv, rv)) {
        if (lFlag === undefined && rFlag !== undefined) entered[metric] = rFlag;
      } else {
        conflicts.push(`day ${day} ${metric}`);
      }
    }
  }
  const cleaned = Object.fromEntries(Object.entries(entered).filter(([, v]) => v !== undefined));
  if (Object.keys(cleaned).length) out.entered = cleaned; else delete out.entered;
  // Remaining cloud-only flags for keys outside the six metrics
  for (const [k, v] of Object.entries(cloud.entered || {})) {
    if (!METRIC_FIELDS.some((m) => m.metric === k) && v !== undefined && out.entered?.[k] === undefined) {
      out.entered = { ...(out.entered || {}), [k]: v };
    }
  }

  // Booleans OR together
  out.checklist = { ...(C.checklist || {}), ...(L.checklist || {}) };
  for (const k of new Set([...Object.keys(C.checklist || {}), ...Object.keys(L.checklist || {})])) {
    out.checklist[k] = Boolean(L.checklist?.[k]) || Boolean(C.checklist?.[k]);
  }
  out.supplements = { ...(C.supplements || {}), ...(L.supplements || {}) };
  for (const k of new Set([...Object.keys(C.supplements || {}), ...Object.keys(L.supplements || {})])) {
    out.supplements[k] = Boolean(L.supplements?.[k]) || Boolean(C.supplements?.[k]);
  }

  // Macros without a flag (fat, carbs) and any other macro keys
  const lm = L.macrosConsumed || {}, cm = C.macrosConsumed || {};
  const mac: Record<string, any> = { ...cm, ...lm };
  for (const k of new Set([...Object.keys(lm), ...Object.keys(cm)])) {
    if (k === 'calories' || k === 'protein') { mac[k] = out.macrosConsumed?.[k] ?? lm[k] ?? cm[k]; continue; }
    if (isDefaultValue(lm[k]) && !isDefaultValue(cm[k])) mac[k] = cm[k];
    else if (!isDefaultValue(lm[k]) && !isDefaultValue(cm[k]) && !sameValue(lm[k], cm[k])) conflicts.push(`day ${day} ${k}`);
  }
  out.macrosConsumed = mac;

  // Everything else: fill when local is default, conflict when both real and different
  for (const k of new Set([...Object.keys(L), ...Object.keys(C)])) {
    if (HANDLED_KEYS.has(k)) continue;
    const lv = L[k], rv = C[k];
    if (isDefaultValue(lv) && !isDefaultValue(rv)) out[k] = rv;
    else if (lv === undefined && rv !== undefined) out[k] = rv;
    else if (!isDefaultValue(lv) && !isDefaultValue(rv) && !sameValue(lv, rv)) conflicts.push(`day ${day} ${k}`);
  }
  if (!out.date && C.date) out.date = C.date;
  return { merged: out as DailyLog, conflicts };
}

function fillUndefined<T extends object>(primary: T, fallback: Partial<T> | undefined): T {
  const out: any = { ...primary };
  if (!fallback) return out;
  for (const [k, v] of Object.entries(fallback)) {
    if (out[k] === undefined && v !== undefined) out[k] = v;
  }
  return out;
}

export interface MergeResult {
  merged: AppState;
  added: number;
  /** Items where both devices had different real data; LOCAL won and the cloud value was NOT applied. */
  conflicts: number;
  /** Human-readable ids of those items, e.g. "day 3 steps", "workout d1", "weigh-in 2026-01-01". */
  conflictList: string[];
}

const stripVolatile = (w: any) => JSON.stringify({ ...w, updatedAt: undefined, dayKey: undefined });

/**
 * Merge cloud data into local. LOCAL wins whenever both sides have data;
 * cloud only fills days/fields that are absent locally. Result never has fewer records than local.
 */
export function mergeCloudIntoLocal(local: AppState, remote: Partial<AppState>): MergeResult {
  let added = 0;
  const conflictList: string[] = [];

  const dailyLogs: { [day: number]: DailyLog } = { ...local.dailyLogs };
  for (const [k, rlog] of Object.entries(remote.dailyLogs || {})) {
    const day = Number(k);
    const llog = dailyLogs[day];
    const rnorm = normalizeDailyLog(rlog as DailyLog, day);
    if (!llog) {
      dailyLogs[day] = rnorm;
      if (dailyLogHasData(rnorm)) added++;
    } else {
      if (!dailyLogHasData(llog) && dailyLogHasData(rnorm)) added++;
      const r = mergeDayLogs(normalizeDailyLog(llog, day), rnorm, day);
      dailyLogs[day] = r.merged;
      conflictList.push(...r.conflicts);
    }
  }

  const workoutLogs: WorkoutHistory = { ...local.workoutLogs };
  for (const [key, rw] of Object.entries(remote.workoutLogs || {})) {
    const lw = workoutLogs[key];
    if (!lw) {
      workoutLogs[key] = normalizeWorkout(rw);
      if (workoutHasData(rw)) added++;
    } else if (!workoutHasData(lw) && workoutHasData(rw)) {
      workoutLogs[key] = normalizeWorkout(rw);
      added++;
    } else if (workoutHasData(lw) && workoutHasData(rw) && stripVolatile(lw) !== stripVolatile(rw)) {
      conflictList.push(`workout ${key}`);
    }
  }

  for (const rw of remote.weighIns || []) {
    const lw = (local.weighIns || []).find((w) => w.date === rw.date);
    if (lw && lw.weight !== rw.weight) conflictList.push(`weigh-in ${rw.date}`);
  }
  for (const rm of remote.measurementHistory || []) {
    const lm = (local.measurementHistory || []).find((m) => m.date === rm.date);
    if (lm && JSON.stringify(lm.measurements) !== JSON.stringify(rm.measurements)) conflictList.push(`measurements ${rm.date}`);
  }

  const localWeighDates = new Set((local.weighIns || []).map((w) => w.date));
  const weighIns: WeighInRecord[] = unionByDate(local.weighIns, remote.weighIns);
  added += weighIns.filter((w) => !localWeighDates.has(w.date)).length;

  const localMeasDates = new Set((local.measurementHistory || []).map((m) => m.date));
  const measurementHistory: MeasurementRecord[] = unionByDate(local.measurementHistory, remote.measurementHistory);
  added += measurementHistory.filter((m) => !localMeasDates.has(m.date)).length;

  // Settings: cloud fills only undefined local fields.
  const settings = fillUndefined<AppSettings>(local.settings, remote.settings as Partial<AppSettings> | undefined);
  // An unconfirmed pre-filled start date must not block the real one stored in the cloud.
  // A setup-only device (no real entries, never linked) also yields its programme setup to the cloud's.
  if ((!local.settings?.confirmedProgrammeStart || isSetupOnlyDevice(local)) && remote.settings?.startDate) {
    settings.startDate = remote.settings.startDate;
    settings.confirmedProgrammeStart = true;
    if (isSetupOnlyDevice(local) && remote.settings.activePhase) settings.activePhase = remote.settings.activePhase;
  }

  return {
    merged: { ...local, settings, dailyLogs, workoutLogs, weighIns, measurementHistory },
    added,
    conflicts: conflictList.length,
    conflictList
  };
}

/**
 * Coach-summary allowlist (what the owner consents to share with an authorized coach):
 * displayName, programmeStartDate, currentPhase, timezone, bodyweightKg, startingWeightKg, updatedAt.
 * Nothing about injuries, diet, age, gender, height, goal weight, schedule or history.
 * Must stay in sync with validCoachSummary() in firestore.rules.
 */
export const COACH_SUMMARY_FIELDS = [
  'displayName', 'programmeStartDate', 'currentPhase', 'timezone', 'bodyweightKg', 'startingWeightKg', 'updatedAt'
] as const;

const PHASES = ['phase1', 'phase2', 'phase3'];
const okNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 100000;

export function buildCoachSummary(
  s: Partial<Pick<AppSettings, 'displayName' | 'startDate' | 'confirmedProgrammeStart' | 'activePhase' | 'timezone' | 'bodyweightKg' | 'startingWeightKg'>>,
  nowIso: string
): Record<string, string | number> {
  const out: Record<string, string | number> = { updatedAt: nowIso };
  if (typeof s.displayName === 'string' && s.displayName) out.displayName = s.displayName.slice(0, 200);
  if (s.confirmedProgrammeStart && typeof s.startDate === 'string' && s.startDate) out.programmeStartDate = s.startDate.slice(0, 40);
  out.currentPhase = PHASES.includes(s.activePhase as string) ? (s.activePhase as string) : 'phase1';
  if (typeof s.timezone === 'string' && s.timezone) out.timezone = s.timezone.slice(0, 100);
  if (okNum(s.bodyweightKg)) out.bodyweightKg = s.bodyweightKg;
  if (okNum(s.startingWeightKg)) out.startingWeightKg = s.startingWeightKg;
  return out;
}

/** Same guard syncOwnerStateToCloud uses: an empty device must not overwrite a cloud that has records. */
export function shouldBlockEmptyOverwrite(cloudHasRecords: boolean, local: Partial<AppState> | null | undefined): boolean {
  return cloudHasRecords && !hasMeaningfulLocalData(local);
}

/** Defaults a fresh install gets from storage.ts getInitialState(); kept in sync by a unit test. */
export const PROFILE_DEFAULTS = {
  timezone: 'Asia/Kolkata',
  currentPhase: 'phase1',
  dietaryExclusions: 'Vegetarian, no eggs, no onion, no garlic (strict Jain/sattvic)',
  wakeTime: '06:30 AM',
  workTime: '09:30 AM to 06:30 PM',
  gymTime: '07:00 PM to 08:30 PM'
} as const;

/**
 * Profile fields to merge-write. Values that merely equal the app's defaults are NEVER sent (a default is a
 * placeholder, and onboarding does not collect these fields, so it cannot make one a user choice).
 * authorizedCoachUid is never included.
 */
export function buildProfilePayload(settings: Partial<AppSettings>, userId: string, nowIso: string): Record<string, any> {
  const s: any = settings || {};
  const out: Record<string, any> = { userId, role: 'owner', updatedAt: nowIso };
  // A value equal to the app's built-in default is a placeholder, not a choice: onboarding does not collect
  // these fields, so completing onboarding must not publish default diet/times text as facts. Custom edits sync.
  const userChose = (v: unknown, def?: string) => typeof v === 'string' && v !== '' && v !== def;
  if (userChose(s.displayName)) out.displayName = s.displayName;
  if (s.startDate && s.confirmedProgrammeStart) out.programmeStartDate = s.startDate;
  if (userChose(s.activePhase, PROFILE_DEFAULTS.currentPhase)) out.currentPhase = s.activePhase;
  if (userChose(s.timezone, PROFILE_DEFAULTS.timezone)) out.timezone = s.timezone;
  if (userChose(s.dietaryExclusions, PROFILE_DEFAULTS.dietaryExclusions)) out.dietaryExclusions = s.dietaryExclusions;
  if (userChose(s.wakeTime, PROFILE_DEFAULTS.wakeTime)) out.wakeTime = s.wakeTime;
  if (userChose(s.workTime, PROFILE_DEFAULTS.workTime)) out.workTime = s.workTime;
  if (userChose(s.gymTime, PROFILE_DEFAULTS.gymTime)) out.gymTime = s.gymTime;
  for (const k of ['startingWeightKg', 'proposedGoalWeightKg', 'bodyweightKg', 'heightCm', 'age', 'gender'] as const) {
    if (s[k] !== undefined && s[k] !== null) out[k] = s[k];
  }
  for (const k of ['trainingExperience', 'equipment', 'injuriesAndConstraints'] as const) {
    if (s[k]) out[k] = s[k];
  }
  return sanitizeForFirestore(out);
}

// ---------------------------------------------------------------------------
// Three-way sync planning (pure, so it can be unit tested without Firebase)
//
// For every document there are three versions: LOCAL, CLOUD and BASE (the hash of the version this
// device last synced). No timestamps are involved.
//   SAVE: cloud absent -> write | cloud === local -> nothing | cloud === base -> write local | else CONFLICT (not written)
//   LOAD: local === cloud -> in sync | local === base -> adopt cloud | cloud === base -> keep local | else CONFLICT (keep local)
// ---------------------------------------------------------------------------

export interface CloudDocLike { id: string; data: Record<string, any> }
export interface PlannedWrite { id: string; label: string; payload: Record<string, any> }

export type ConflictKind = 'daily' | 'workout' | 'weighIn' | 'measurement' | 'profile';
export interface ConflictDoc { kind: ConflictKind; id: string; label: string }
export type ConflictRef = Pick<ConflictDoc, 'kind' | 'id'>;
export const conflictKey = (r: ConflictRef) => `${r.kind}:${r.id}`;
/** One entry per (kind, id): resolution works per document, and the same item can be reported by both a save and a pull. */
export function dedupeConflicts<T extends ConflictRef>(list: T[] | undefined | null): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const c of list || []) {
    const k = conflictKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}
const keySet = (only?: ConflictRef[]) => (only ? new Set(only.map(conflictKey)) : undefined);

/** Everything read from the cloud for one account. */
export interface CloudSnapshot {
  profile: Record<string, any>;
  logDocs: CloudDocLike[];
  workoutDocs: CloudDocLike[];
}

export interface WritePlan {
  writes: PlannedWrite[];
  conflicts: ConflictDoc[];
  collisions: string[];
  /** Docs whose cloud and local versions are identical: the base can be set to the cloud hash. */
  inSync: BaseEntry[];
}

/** Dotted names of the fields that differ between two docs (updatedAt ignored). */
export function docDiffFields(a: Record<string, any> | undefined, b: Record<string, any> | undefined, prefix = ''): string[] {
  const out: string[] = [];
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    if (!prefix && k === 'updatedAt') continue;
    const x = a?.[k], y = b?.[k];
    if (isPlainObject(x) && isPlainObject(y)) out.push(...docDiffFields(x, y, `${prefix}${k}.`));
    else if (!sameValue(x, y)) out.push(prefix + k);
  }
  return out;
}

const fieldSummary = (f: string[]) =>
  f.length ? f.slice(0, 4).join(', ') + (f.length > 4 ? `, +${f.length - 4} more` : '') : 'changed on both';

const dailyView = (data: any, day: number) => sanitizeForFirestore({ ...normalizeDailyLog(data, day), dayNumber: day }) as Record<string, any>;
const workoutView = (data: any, key: string) => sanitizeForFirestore({ ...normalizeWorkout(data), dayKey: key }) as Record<string, any>;

/** Hash of a daily log as it is (or would be) stored in the cloud: normalised, dayNumber set, updatedAt ignored. */
export const hashDailyDoc = (data: Record<string, any>, day: number): string => hashDoc(dailyView(data, day));
export const hashWorkoutDoc = (data: Record<string, any>, key: string): string => hashDoc(workoutView(data, key));
export const hashEntry = (v: unknown): string => hashDoc(sanitizeForFirestore(v));

/**
 * Decides which daily logs to write. A day whose cloud version changed since this device's base (and differs from
 * local) is a CONFLICT and is not written. Doc ids: the cloud's existing id for that day number, else the log's date,
 * else day-N. Id collisions are reported, not overwritten. `only` restricts to (and force-writes) the listed docs.
 */
export function planDailyWrites(
  localLogs: { [day: number]: DailyLog },
  cloudDocs: CloudDocLike[],
  baseDaily: Record<string, string>,
  nowIso: string,
  only?: ConflictRef[]
): WritePlan {
  const onlyKeys = keySet(only);
  const byDay = new Map<number, CloudDocLike>();
  const idOwner = new Map<string, number | undefined>();
  for (const d of cloudDocs) {
    const n = dayNumberOfCloudDoc(d.id, d.data);
    idOwner.set(d.id, n);
    if (n !== undefined && !byDay.has(n)) byDay.set(n, d);
  }
  const plan: WritePlan = { writes: [], conflicts: [], collisions: [], inSync: [] };
  const claimed = new Map<string, number>();
  const days = Object.entries(localLogs)
    .map(([k, log]) => ({ day: Number(log?.dayNumber ?? k), log }))
    // A previously synced day that is now blank still has to be written so a clear/untick propagates.
    .filter((x) => dailyLogHasData(x.log) || (byDay.has(x.day) && baseDaily[byDay.get(x.day)!.id] !== undefined))
    .sort((a, b) => a.day - b.day);

  for (const { day, log } of days) {
    const cloud = byDay.get(day);
    const id = cloud ? cloud.id : dailyLogDocId(log, day);
    const ownerInCloud = idOwner.get(id);
    const ownerLocal = claimed.get(id);
    if ((!cloud && idOwner.has(id) && ownerInCloud !== day) || (ownerLocal !== undefined && ownerLocal !== day)) {
      if (!onlyKeys || onlyKeys.has(conflictKey({ kind: 'daily', id }))) {
        plan.collisions.push(
          `day ${day} would overwrite doc "${id}" that belongs to day ${ownerLocal ?? ownerInCloud ?? 'unknown'}`
        );
      }
      continue;
    }
    claimed.set(id, day);
    if (onlyKeys && !onlyKeys.has(conflictKey({ kind: 'daily', id }))) continue;
    const payload = sanitizeForFirestore({ ...normalizeDailyLog(log, day), dayNumber: day, updatedAt: nowIso }) as Record<string, any>;
    const write = { id, label: `daily log ${id}`, payload };
    if (!cloud) {
      plan.writes.push(write);
      continue;
    }
    const cH = hashDailyDoc(cloud.data, day);
    const lH = hashDailyDoc(log, day);
    if (cH === lH) {
      plan.inSync.push({ section: 'daily', id, hash: cH });
    } else if (onlyKeys || cH === baseDaily[id]) {
      plan.writes.push(write);
    } else {
      const fields = docDiffFields(dailyView(log, day), dailyView(cloud.data, day));
      plan.conflicts.push({ kind: 'daily', id, label: `day ${day} (${fieldSummary(fields)})` });
    }
  }
  return plan;
}

export function planWorkoutWrites(
  localWorkouts: WorkoutHistory,
  cloudDocs: CloudDocLike[],
  baseWorkouts: Record<string, string>,
  nowIso: string,
  only?: ConflictRef[]
): WritePlan {
  const onlyKeys = keySet(only);
  const cloudByKey = new Map<string, CloudDocLike>();
  for (const d of cloudDocs) cloudByKey.set(typeof d.data?.dayKey === 'string' && d.data.dayKey ? d.data.dayKey : d.id, d);
  const plan: WritePlan = { writes: [], conflicts: [], collisions: [], inSync: [] };
  for (const [key, w] of Object.entries(localWorkouts)) {
    const cloud = cloudByKey.get(key);
    if (!workoutHasData(w) && !(cloud && baseWorkouts[cloud.id] !== undefined)) continue;
    const id = cloud ? cloud.id : key;
    if (onlyKeys && !onlyKeys.has(conflictKey({ kind: 'workout', id }))) continue;
    const write = { id, label: `workout ${key}`, payload: sanitizeForFirestore({ ...w, dayKey: key, updatedAt: nowIso }) as Record<string, any> };
    if (!cloud) {
      plan.writes.push(write);
      continue;
    }
    const cH = hashWorkoutDoc(cloud.data, key);
    const lH = hashWorkoutDoc(w as any, key);
    if (cH === lH) {
      plan.inSync.push({ section: 'workouts', id, hash: cH });
    } else if (onlyKeys || cH === baseWorkouts[id]) {
      plan.writes.push(write);
    } else {
      const fields = docDiffFields(workoutView(w, key), workoutView(cloud.data, key));
      plan.conflicts.push({ kind: 'workout', id, label: `workout ${key} (${fieldSummary(fields)})` });
    }
  }
  return plan;
}

const DATED = {
  weighIn: { section: 'weighIns' as const, noun: 'weigh-in' },
  measurement: { section: 'measurements' as const, noun: 'measurements' }
};

interface DatedPlan<T> { merged?: T[]; written: string[]; deleted: string[]; conflicts: ConflictDoc[]; inSync: BaseEntry[] }

/** Save-side plan for a per-date array stored inside the profile doc (weigh-ins, measurements). Compares per entry. */
function planDatedArray<T extends { date: string }>(
  kind: 'weighIn' | 'measurement',
  local: T[] | undefined,
  cloud: T[] | undefined,
  baseMap: Record<string, string>,
  onlyKeys?: Set<string>
): DatedPlan<T> {
  const { section, noun } = DATED[kind];
  const cloudMap = new Map<string, T>();
  for (const c of cloud || []) if (c?.date) cloudMap.set(c.date, c);
  const result = new Map(cloudMap);
  const out: DatedPlan<T> = { written: [], deleted: [], conflicts: [], inSync: [] };
  for (const L of [...(local || [])].filter((x) => x?.date).sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0))) {
    const id = L.date;
    const C = cloudMap.get(id);
    if (!C) {
      if (onlyKeys) continue;
      // Known to this device, unchanged since, and now absent from the cloud: it was deleted on another device.
      // Do not re-upload it (a stale device must never resurrect a deletion). An edited copy is still written.
      const b0 = baseMap[id];
      if (b0 !== undefined && hashEntry(L) === b0) continue;
      result.set(id, L);
      out.written.push(id);
      continue;
    }
    const lH = hashEntry(L), cH = hashEntry(C);
    if (lH === cH) {
      out.inSync.push({ section, id, hash: cH });
    } else if (onlyKeys) {
      if (onlyKeys.has(conflictKey({ kind, id }))) {
        result.set(id, L);
        out.written.push(id);
      }
    } else if (cH === baseMap[id]) {
      result.set(id, L);
      out.written.push(id);
    } else {
      out.conflicts.push({ kind, id, label: `${noun} ${id}` });
    }
  }
  // Deletions: a date this device synced before (it has a base entry) that is now absent locally was deleted
  // here. Honor the deletion only when the cloud copy is unchanged since base; a cloud copy that changed since
  // base is a conflict (deleted here, changed there), never a silent delete. No base entry means the entry
  // arrived from another device and stays.
  const localDates = new Set((local || []).filter((x) => x?.date).map((x) => x.date));
  for (const [id, C] of cloudMap) {
    if (localDates.has(id)) continue;
    const b = baseMap[id];
    if (b === undefined) continue;
    if (onlyKeys && !onlyKeys.has(conflictKey({ kind, id }))) continue;
    if (!onlyKeys && hashEntry(C) !== b) {
      out.conflicts.push({ kind, id, label: `${noun} ${id} (deleted on this device, changed in the cloud)` });
      continue;
    }
    result.delete(id);
    out.deleted.push(id);
  }
  if (out.written.length || out.deleted.length) out.merged = Array.from(result.values()).sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
  return out;
}

export interface ProfilePlan {
  /** Scalar fields to merge-write (cloud field names). */
  fields: Record<string, any>;
  weighIns?: WeighInRecord[];
  measurementHistory?: MeasurementRecord[];
  writtenWeighInDates: string[];
  writtenMeasurementDates: string[];
  deletedWeighInDates: string[];
  deletedMeasurementDates: string[];
  conflicts: ConflictDoc[];
  inSync: BaseEntry[];
}

const PROFILE_NON_SCALAR = new Set(['userId', 'role', 'updatedAt']);

/** Profile scalars compare per field, arrays per date entry. authorizedCoachUid never appears here. */
export function planProfileWrites(
  local: Pick<AppState, 'settings' | 'weighIns' | 'measurementHistory'>,
  cloudProfile: Record<string, any>,
  base: SyncBase,
  userId: string,
  nowIso: string,
  only?: ConflictRef[]
): ProfilePlan {
  const onlyKeys = keySet(only);
  const payload = buildProfilePayload(local.settings, userId, nowIso);
  const plan: ProfilePlan = { fields: {}, writtenWeighInDates: [], writtenMeasurementDates: [], deletedWeighInDates: [], deletedMeasurementDates: [], conflicts: [], inSync: [] };
  for (const [f, lv] of Object.entries(payload)) {
    if (PROFILE_NON_SCALAR.has(f)) continue;
    const cv = cloudProfile?.[f];
    const key = conflictKey({ kind: 'profile', id: f });
    if (onlyKeys && !onlyKeys.has(key)) continue;
    if (cv === undefined) {
      plan.fields[f] = lv;
      continue;
    }
    const lH = hashEntry(lv), cH = hashEntry(cv);
    if (lH === cH) plan.inSync.push({ section: 'profile', id: f, hash: cH });
    else if (onlyKeys || cH === base.profile[f]) plan.fields[f] = lv;
    else plan.conflicts.push({ kind: 'profile', id: f, label: `setting ${f}` });
  }
  const w = planDatedArray<WeighInRecord>('weighIn', local.weighIns, cloudProfile?.weighIns, base.weighIns, onlyKeys);
  const m = planDatedArray<MeasurementRecord>('measurement', local.measurementHistory, cloudProfile?.measurementHistory, base.measurements, onlyKeys);
  plan.weighIns = w.merged;
  plan.writtenWeighInDates = w.written;
  plan.deletedWeighInDates = w.deleted;
  plan.measurementHistory = m.merged;
  plan.writtenMeasurementDates = m.written;
  plan.deletedMeasurementDates = m.deleted;
  plan.conflicts.push(...w.conflicts, ...m.conflicts);
  plan.inSync.push(...w.inSync, ...m.inSync);
  return plan;
}

/**
 * The users/{uid} merge-write payload, or null when nothing real changed (only the timestamp would move).
 * A document that does not exist yet is still created.
 */
export function buildProfileWrite(plan: ProfilePlan, userId: string, nowIso: string, profileExists: boolean): Record<string, any> | null {
  const hasReal = Object.keys(plan.fields).length > 0 || !!plan.weighIns || !!plan.measurementHistory;
  if (!hasReal && profileExists) return null;
  return {
    userId,
    role: 'owner',
    updatedAt: nowIso,
    ...plan.fields,
    ...(plan.weighIns ? { weighIns: plan.weighIns } : {}),
    ...(plan.measurementHistory ? { measurementHistory: plan.measurementHistory } : {})
  };
}

export interface SavePlan {
  daily: WritePlan;
  workouts: WritePlan;
  profile: ProfilePlan;
  conflicts: ConflictDoc[];
  collisions: string[];
  inSync: BaseEntry[];
}

/** The whole Save decision. Pass `only` to write exactly the listed (conflicting) docs from this device. */
export function planSave(
  local: AppState,
  cloud: CloudSnapshot,
  base: SyncBase,
  userId: string,
  nowIso: string,
  only?: ConflictRef[]
): SavePlan {
  const daily = planDailyWrites(local.dailyLogs, cloud.logDocs, base.daily, nowIso, only);
  const workouts = planWorkoutWrites(local.workoutLogs, cloud.workoutDocs, base.workouts, nowIso, only);
  const profile = planProfileWrites(local, cloud.profile, base, userId, nowIso, only);
  return {
    daily,
    workouts,
    profile,
    conflicts: dedupeConflicts([...daily.conflicts, ...workouts.conflicts, ...profile.conflicts]),
    collisions: daily.collisions,
    inSync: [...daily.inSync, ...workouts.inSync, ...profile.inSync]
  };
}

// ---- Load (pull) ----

/** [cloud profile field, local settings key] */
export const PROFILE_FIELD_MAP: Array<[string, keyof AppSettings]> = [
  ['programmeStartDate', 'startDate'],
  ['currentPhase', 'activePhase'],
  ['displayName', 'displayName'],
  ['bodyweightKg', 'bodyweightKg'],
  ['startingWeightKg', 'startingWeightKg'],
  ['proposedGoalWeightKg', 'proposedGoalWeightKg'],
  ['heightCm', 'heightCm'],
  ['age', 'age'],
  ['gender', 'gender'],
  ['trainingExperience', 'trainingExperience'],
  ['equipment', 'equipment'],
  ['injuriesAndConstraints', 'injuriesAndConstraints'],
  ['dietaryExclusions', 'dietaryExclusions'],
  ['wakeTime', 'wakeTime'],
  ['workTime', 'workTime'],
  ['gymTime', 'gymTime'],
  ['timezone', 'timezone']
];

const DEFAULT_OF: Partial<Record<keyof AppSettings, unknown>> = {
  activePhase: PROFILE_DEFAULTS.currentPhase,
  timezone: PROFILE_DEFAULTS.timezone,
  dietaryExclusions: PROFILE_DEFAULTS.dietaryExclusions,
  wakeTime: PROFILE_DEFAULTS.wakeTime,
  workTime: PROFILE_DEFAULTS.workTime,
  gymTime: PROFILE_DEFAULTS.gymTime
};

/** A local setting nobody typed: empty, or still the app's pre-filled default before onboarding. */
function isUnsetOrDefault(key: keyof AppSettings, v: unknown, settings: Partial<AppSettings>): boolean {
  if (v === undefined || v === null || v === '') return true;
  return key in DEFAULT_OF && v === DEFAULT_OF[key] && !settings.onboardingCompleted;
}

export interface PullPlan {
  merged: AppState;
  /** Records that arrived from, or were updated from, the cloud. */
  added: number;
  conflicts: number;
  conflictList: string[];
  conflictDocs: ConflictDoc[];
  baseEntries: BaseEntry[];
}

function sortByDate<T extends { date: string }>(a: T[]): T[] {
  return a.sort((x, y) => (x.date > y.date ? 1 : x.date < y.date ? -1 : 0));
}

function pullDated<T extends { date: string }>(
  kind: 'weighIn' | 'measurement',
  local: T[] | undefined,
  cloud: T[] | undefined,
  baseMap: Record<string, string>,
  plan: { added: number; conflictDocs: ConflictDoc[]; baseEntries: BaseEntry[] }
): T[] {
  const { section, noun } = DATED[kind];
  const result = new Map<string, T>();
  for (const l of local || []) if (l?.date) result.set(l.date, l);
  for (const C of cloud || []) {
    if (!C?.date) continue;
    const id = C.date;
    const L = result.get(id);
    const cH = hashEntry(C);
    if (!L) {
      const b = baseMap[id];
      if (b !== undefined) {
        // Known to this device and now absent locally: it was deleted here. Keep it deleted while the cloud
        // copy is unchanged; if the cloud copy changed since base, that is a conflict, not a resurrection.
        if (cH === b) continue;
        plan.conflictDocs.push({ kind, id, label: `${noun} ${id} (deleted on this device, changed in the cloud)` });
        continue;
      }
      result.set(id, C);
      plan.added++;
      plan.baseEntries.push({ section, id, hash: cH });
      continue;
    }
    const lH = hashEntry(L);
    if (lH === cH) {
      plan.baseEntries.push({ section, id, hash: cH });
      continue;
    }
    const b = baseMap[id];
    if (b !== undefined && lH === b) {
      result.set(id, C);
      plan.added++;
      plan.baseEntries.push({ section, id, hash: cH });
    } else if (b !== undefined && cH === b) {
      // local edited, cloud untouched: keep local
    } else {
      plan.conflictDocs.push({ kind, id, label: `${noun} ${id}` });
    }
  }
  // Deleted on another device: known here (base entry), unchanged here, absent in the cloud -> drop it here too.
  const cloudDates = new Set((cloud || []).filter((c) => c?.date).map((c) => c.date));
  for (const [id, L] of Array.from(result)) {
    if (cloudDates.has(id)) continue;
    const b = baseMap[id];
    if (b !== undefined && hashEntry(L) === b) {
      result.delete(id);
      plan.baseEntries.push({ section, id, hash: null });
    }
  }
  return sortByDate(Array.from(result.values()));
}

/**
 * The whole Load decision. Per doc: identical -> set base; this device unedited since base -> adopt the cloud version
 * (unticks and corrections arrive); this device edited and cloud untouched -> keep local; both changed (or no base and
 * they differ) -> keep LOCAL, list a conflict, never update base. A local day with no data at all adopts the cloud.
 */
export function planPull(local: AppState, cloud: CloudSnapshot, base: SyncBase): PullPlan {
  const out = { added: 0, conflictDocs: [] as ConflictDoc[], baseEntries: [] as BaseEntry[] };

  const dailyLogs: { [day: number]: DailyLog } = { ...local.dailyLogs };
  const seenDays = new Set<number>();
  for (const d of cloud.logDocs) {
    const n = dayNumberOfCloudDoc(d.id, d.data);
    if (n === undefined || seenDays.has(n)) continue;
    seenDays.add(n);
    const rnorm = normalizeDailyLog(d.data as any, n);
    const cH = hashDailyDoc(d.data, n);
    const llog = dailyLogs[n];
    if (!llog) {
      dailyLogs[n] = rnorm;
      if (dailyLogHasData(rnorm)) out.added++;
      out.baseEntries.push({ section: 'daily', id: d.id, hash: cH });
      continue;
    }
    const lH = hashDailyDoc(llog, n);
    if (lH === cH) {
      out.baseEntries.push({ section: 'daily', id: d.id, hash: cH });
      continue;
    }
    const b = base.daily[d.id];
    const decision = b !== undefined ? (lH === b ? 'adopt' : cH === b ? 'keep' : 'conflict') : dailyLogHasData(llog) ? 'conflict' : 'adopt';
    if (decision === 'adopt') {
      dailyLogs[n] = rnorm;
      if (dailyLogHasData(rnorm)) out.added++;
      out.baseEntries.push({ section: 'daily', id: d.id, hash: cH });
    } else if (decision === 'conflict') {
      const lnorm = normalizeDailyLog(llog, n);
      const fields = docDiffFields(dailyView(llog, n), dailyView(d.data, n));
      // Fill absent/default fields from the cloud, but never OR-in checklist/supplement ticks the other side may have cleared.
      const r = mergeDayLogs(lnorm, rnorm, n);
      dailyLogs[n] = { ...r.merged, checklist: lnorm.checklist, supplements: lnorm.supplements };
      out.conflictDocs.push({ kind: 'daily', id: d.id, label: `day ${n} (${fieldSummary(fields)})` });
    }
  }

  const workoutLogs: WorkoutHistory = { ...local.workoutLogs };
  for (const d of cloud.workoutDocs) {
    const key = typeof d.data?.dayKey === 'string' && d.data.dayKey ? d.data.dayKey : d.id;
    const cH = hashWorkoutDoc(d.data, key);
    const lw = workoutLogs[key];
    if (!lw) {
      workoutLogs[key] = normalizeWorkout(d.data);
      if (workoutHasData(d.data as any)) out.added++;
      out.baseEntries.push({ section: 'workouts', id: d.id, hash: cH });
      continue;
    }
    const lH = hashWorkoutDoc(lw as any, key);
    if (lH === cH) {
      out.baseEntries.push({ section: 'workouts', id: d.id, hash: cH });
      continue;
    }
    const b = base.workouts[d.id];
    const decision = b !== undefined ? (lH === b ? 'adopt' : cH === b ? 'keep' : 'conflict') : workoutHasData(lw) ? 'conflict' : 'adopt';
    if (decision === 'adopt') {
      workoutLogs[key] = normalizeWorkout(d.data);
      if (workoutHasData(d.data as any)) out.added++;
      out.baseEntries.push({ section: 'workouts', id: d.id, hash: cH });
    } else if (decision === 'conflict') {
      const fields = docDiffFields(workoutView(lw, key), workoutView(d.data, key));
      out.conflictDocs.push({ kind: 'workout', id: d.id, label: `workout ${key} (${fieldSummary(fields)})` });
    }
  }

  const weighIns = pullDated<WeighInRecord>('weighIn', local.weighIns, cloud.profile?.weighIns, base.weighIns, out);
  const measurementHistory = pullDated<MeasurementRecord>('measurement', local.measurementHistory, cloud.profile?.measurementHistory, base.measurements, out);

  // Profile scalars
  const settings: any = { ...local.settings };
  const setupOnly = isSetupOnlyDevice(local);
  const cloudConfirmedStart = Boolean(cloud.profile?.programmeStartDate);
  for (const [pf, sk] of PROFILE_FIELD_MAP) {
    const cv = cloud.profile?.[pf];
    if (cv === undefined || cv === null) {
      // The cloud omits values equal to the app defaults (buildProfilePayload). For a setup-only device a programme
      // is confirmed in the cloud, so a setting it does not carry means "default", not the setup chosen here.
      if (setupOnly && cloudConfirmedStart && sk in DEFAULT_OF) settings[sk] = DEFAULT_OF[sk];
      continue;
    }
    const cH = hashEntry(cv);
    const lv = (local.settings as any)?.[sk];
    // An unconfirmed, pre-filled start date never blocks the real one stored in the cloud; a setup-only device
    // (confirmed start but no entries) yields all of its setup to the cloud's value.
    const prefilledStart = sk === 'startDate' && !local.settings?.confirmedProgrammeStart;
    if (prefilledStart || setupOnly) {
      settings[sk] = cv;
      if (sk === 'startDate') settings.confirmedProgrammeStart = true;
      out.baseEntries.push({ section: 'profile', id: pf, hash: cH });
      continue;
    }
    const lH = hashEntry(lv);
    if (lv !== undefined && lH === cH) {
      out.baseEntries.push({ section: 'profile', id: pf, hash: cH });
      continue;
    }
    const b = base.profile[pf];
    const decision = b !== undefined ? (lH === b ? 'adopt' : cH === b ? 'keep' : 'conflict') : isUnsetOrDefault(sk, lv, local.settings) ? 'adopt' : 'conflict';
    if (decision === 'adopt') {
      settings[sk] = cv;
      out.baseEntries.push({ section: 'profile', id: pf, hash: cH });
    } else if (decision === 'conflict') {
      out.conflictDocs.push({ kind: 'profile', id: pf, label: `setting ${pf}` });
    }
  }
  // Setup-only device whose start date came from the cloud: keep the derived dates coherent with it.
  let dayState: { currentDayNumber?: number; selectedDayNumber?: number } = {};
  if (setupOnly && settings.startDate && settings.startDate !== local.settings?.startDate) {
    const p2 = calculateDateForDayNumber(settings.startDate, 8);
    const p3 = calculateDateForDayNumber(settings.startDate, 36);
    if (p2) settings.phase2StartDate = p2;
    if (p3) settings.phase3StartDate = p3;
    // Default (data-less) days that the cloud has no record of: re-date to the cloud's start date.
    for (const [k, log] of Object.entries(dailyLogs)) {
      const n = Number(k);
      if (!seenDays.has(n) && log && !dailyLogHasData(log)) {
        const dt = calculateDateForDayNumber(settings.startDate, n);
        if (dt) dailyLogs[n] = { ...log, date: dt };
      }
    }
  }
  if (setupOnly && cloudConfirmedStart && settings.activePhase !== local.settings?.activePhase) {
    const day = settings.activePhase === 'phase3' ? 36 : settings.activePhase === 'phase2' ? 8 : 1;
    dayState = { currentDayNumber: day, selectedDayNumber: day };
  }
  // UI-only state that is not a synced preference: fill only when absent.
  if (settings.authorizedCoachUid === undefined && cloud.profile?.authorizedCoachUid !== undefined) {
    settings.authorizedCoachUid = cloud.profile.authorizedCoachUid;
  }

  const conflictDocs = dedupeConflicts(out.conflictDocs);
  return {
    merged: { ...local, ...dayState, settings, dailyLogs, workoutLogs, weighIns, measurementHistory },
    added: out.added,
    conflicts: conflictDocs.length,
    conflictList: conflictDocs.map((c) => c.label),
    conflictDocs,
    baseEntries: out.baseEntries
  };
}

// ---- Resolve: use the cloud version ----

export interface UseCloudPlan {
  merged: AppState;
  baseEntries: BaseEntry[];
  applied: number;
  /** Refs that no longer exist in the cloud (nothing was changed for them). */
  missing: string[];
}

/** Replaces exactly the listed local items with their cloud versions. Pure. */
export function planUseCloud(local: AppState, cloud: CloudSnapshot, refs: ConflictRef[]): UseCloudPlan {
  const dailyLogs: { [day: number]: DailyLog } = { ...local.dailyLogs };
  const workoutLogs: WorkoutHistory = { ...local.workoutLogs };
  let weighIns = [...(local.weighIns || [])];
  let measurementHistory = [...(local.measurementHistory || [])];
  const settings: any = { ...local.settings };
  const baseEntries: BaseEntry[] = [];
  const missing: string[] = [];
  let applied = 0;
  const upsert = <T extends { date: string }>(arr: T[], item: T) => sortByDate([...arr.filter((x) => x.date !== item.date), item]);

  for (const r of refs) {
    if (r.kind === 'daily') {
      const d = cloud.logDocs.find((x) => x.id === r.id);
      const n = d ? dayNumberOfCloudDoc(d.id, d.data) : undefined;
      if (!d || n === undefined) { missing.push(conflictKey(r)); continue; }
      dailyLogs[n] = normalizeDailyLog(d.data as any, n);
      baseEntries.push({ section: 'daily', id: d.id, hash: hashDailyDoc(d.data, n) });
    } else if (r.kind === 'workout') {
      const d = cloud.workoutDocs.find((x) => x.id === r.id);
      if (!d) { missing.push(conflictKey(r)); continue; }
      const key = typeof d.data?.dayKey === 'string' && d.data.dayKey ? d.data.dayKey : d.id;
      workoutLogs[key] = normalizeWorkout(d.data);
      baseEntries.push({ section: 'workouts', id: d.id, hash: hashWorkoutDoc(d.data, key) });
    } else if (r.kind === 'weighIn') {
      const c = (cloud.profile?.weighIns as WeighInRecord[] | undefined)?.find((x) => x?.date === r.id);
      if (!c) { missing.push(conflictKey(r)); continue; }
      weighIns = upsert(weighIns, c);
      baseEntries.push({ section: 'weighIns', id: r.id, hash: hashEntry(c) });
    } else if (r.kind === 'measurement') {
      const c = (cloud.profile?.measurementHistory as MeasurementRecord[] | undefined)?.find((x) => x?.date === r.id);
      if (!c) { missing.push(conflictKey(r)); continue; }
      measurementHistory = upsert(measurementHistory, c);
      baseEntries.push({ section: 'measurements', id: r.id, hash: hashEntry(c) });
    } else {
      const map = PROFILE_FIELD_MAP.find(([pf]) => pf === r.id);
      const cv = cloud.profile?.[r.id];
      if (!map || cv === undefined || cv === null) { missing.push(conflictKey(r)); continue; }
      settings[map[1]] = cv;
      if (map[1] === 'startDate') settings.confirmedProgrammeStart = true;
      baseEntries.push({ section: 'profile', id: r.id, hash: hashEntry(cv) });
    }
    applied++;
  }
  return { merged: { ...local, settings, dailyLogs, workoutLogs, weighIns, measurementHistory }, baseEntries, applied, missing };
}

// ---- Messages ----

/** "a; b; c (+N more)" for up to five labels. */
export function summariseConflicts(labels: string[], max = 5): string {
  const list = labels.slice(0, max);
  const more = labels.length > list.length ? ` (+${labels.length - list.length} more)` : '';
  return list.join('; ') + more;
}

/** Status text after Load from cloud (fast-forwards, additions and conflicts). */
export function pullMessage(res: { added?: number; conflictDocs?: ConflictDoc[] }): string {
  const parts: string[] = [];
  if (res.added) parts.push(`Loaded ${res.added} record(s) from the cloud.`);
  const c = res.conflictDocs || [];
  if (c.length > 0) {
    parts.push(
      `${c.length} item(s) were changed both here and in the cloud; your values on this device were kept and nothing was overwritten: ${summariseConflicts(c.map((x) => x.label))}. Choose which version to keep below.`
    );
  }
  if (parts.length === 0) parts.push('This device is already up to date with the cloud.');
  return parts.join(' ');
                }
