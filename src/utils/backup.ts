/**
 * Backup file format and validation.
 *
 * The WHOLE file is validated before anything is changed (see parseBackup). Limits are listed in BACKUP_LIMITS.
 *
 * DOCUMENTED MIGRATION (numeric text): a canonical numeric string in a numeric field, such as "9000" or "71.5",
 * is converted to a number and its path is returned in ParseResult.migrated so the UI can say so before restoring.
 * A string that is not a canonical number (for example "abc" or "1e3") in a numeric field is a rejection.
 * Nothing else is converted, dropped or replaced. Unknown extra keys are kept (depth, size and node limited).
 */
import { AppState, DailyLog } from '../types';
import { dailyLogHasData, workoutHasData } from './cloudMerge';
import { createDefaultChecklist, createDefaultDailyLog, calculateDateForDayNumber, getTodayDateString } from './storage';

/** Backup file format version. Legacy backups are the bare AppState with no version field. */
export const BACKUP_VERSION = 2;

export interface BackupFile {
  version: number;
  exportedAt: string;
  state: AppState;
}


/** Hard limits applied before a backup is accepted. */
export const BACKUP_LIMITS = {
  maxTextChars: 4_000_000,
  maxDepth: 40,
  maxNodes: 200_000,
  maxListLength: 3000,
  maxErrorsShown: 20
} as const;

export interface ParseResult {
  ok: boolean;
  state?: AppState;
  version?: number;
  errors: string[];
  /** Paths of values that were converted from canonical numeric text to numbers. */
  migrated?: string[];
}

export function serializeBackup(state: AppState, now: Date = new Date()): string {
  const file: BackupFile = { version: BACKUP_VERSION, exportedAt: now.toISOString(), state };
  return JSON.stringify(file, null, 2);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const CANONICAL_NUMBER = /^(0|[1-9]\d{0,14})(\.\d{1,15})?$/;

/** True for a real calendar date written exactly as YYYY-MM-DD. */
export function isValidDateString(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  if (y < 1900 || y > 2200) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Text-only pre-scan (no JSON.parse) so deep nesting is rejected before it can overflow the parser or the stack. */
function maxTextDepth(text: string): number {
  let depth = 0;
  let max = 0;
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (inStr) {
      if (c === 92) i++;
      else if (c === 34) inStr = false;
    } else if (c === 34) inStr = true;
    else if (c === 123 || c === 91) { if (++depth > max) { max = depth; if (max > BACKUP_LIMITS.maxDepth) return max; } }
    else if (c === 125 || c === 93) depth--;
  }
  return max;
}

/** Iterative walk of parsed data: returns an error message if too deep or too many nodes. */
function checkShape(root: unknown): string | null {
  const stack: Array<[unknown, number]> = [[root, 1]];
  let nodes = 0;
  while (stack.length) {
    const [v, depth] = stack.pop()!;
    if (typeof v !== 'object' || v === null) { nodes++; continue; }
    if (depth > BACKUP_LIMITS.maxDepth) return `The file is nested more than ${BACKUP_LIMITS.maxDepth} levels deep.`;
    const kids = Array.isArray(v) ? v : Object.values(v);
    nodes += 1 + kids.length;
    if (nodes > BACKUP_LIMITS.maxNodes) return `The file has more than ${BACKUP_LIMITS.maxNodes.toLocaleString('en-US')} values.`;
    for (const k of kids) if (typeof k === 'object' && k !== null) stack.push([k, depth + 1]);
  }
  return null;
}

class Problems {
  list: string[] = [];
  total = 0;
  migrated: string[] = [];
  add(path: string, reason: string) {
    this.total++;
    if (this.list.length < BACKUP_LIMITS.maxErrorsShown) this.list.push(`${path}: ${reason}`);
  }
  result(): string[] {
    const out = [...this.list];
    if (this.total > this.list.length) out.push(`...and ${this.total - this.list.length} more problem(s).`);
    return out;
  }
}

/** Checks (and migrates canonical numeric text in) obj[key] when present. Absent is fine. */
function num(p: Problems, obj: Record<string, unknown>, key: string, path: string, min: number, max: number, integer = false): void {
  if (!(key in obj) || obj[key] === undefined) return;
  let v = obj[key];
  if (typeof v === 'string') {
    if (!CANONICAL_NUMBER.test(v)) { p.add(path, `must be a number, got text "${v.slice(0, 20)}".`); return; }
    v = Number(v);
    obj[key] = v;
    p.migrated.push(path);
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) { p.add(path, 'must be a finite number.'); return; }
  if (integer && !Number.isInteger(v)) { p.add(path, 'must be a whole number.'); return; }
  if (v < min || v > max) p.add(path, `must be between ${min} and ${max}.`);
}

function dateField(p: Problems, obj: Record<string, unknown>, key: string, path: string, optional = false): void {
  const v = obj[key];
  if (optional && (v === undefined || v === '')) return;
  if (!isValidDateString(v)) p.add(path, 'must be a valid date written YYYY-MM-DD.');
}

function list(p: Problems, s: Record<string, unknown>, key: string, required: boolean): unknown[] | null {
  if (!(key in s) || s[key] === undefined) {
    if (required) p.add(key, 'must be an array.');
    return null;
  }
  const v = s[key];
  if (!Array.isArray(v)) { p.add(key, 'must be an array.'); return null; }
  if (v.length > BACKUP_LIMITS.maxListLength) { p.add(key, `has ${v.length} entries; the limit is ${BACKUP_LIMITS.maxListLength}.`); return null; }
  return v;
}

const MACRO_MAX: Record<string, number> = { calories: 100000, protein: 10000, fat: 10000, carbs: 10000 };

function checkMacros(p: Problems, obj: Record<string, unknown>, key: string, path: string): void {
  if (!(key in obj) || obj[key] === undefined) return;
  const m = obj[key];
  if (!isObj(m)) { p.add(path, 'must be an object.'); return; }
  for (const f of Object.keys(MACRO_MAX)) num(p, m, f, `${path}.${f}`, 0, MACRO_MAX[f]);
}

function validateState(s: unknown, p: Problems): void {
  if (!isObj(s)) { p.add('state', 'Backup does not contain a state object.'); return; }

  if (!isObj(s.settings)) p.add('settings', 'must be an object.');
  else {
    for (const k of ['startDate', 'phase2StartDate', 'phase3StartDate']) dateField(p, s.settings, k, `settings.${k}`, true);
  }

  num(p, s, 'currentDayNumber', 'currentDayNumber', 1, 63, true);
  num(p, s, 'selectedDayNumber', 'selectedDayNumber', 1, 63, true);

  if (!isObj(s.dailyLogs)) p.add('dailyLogs', 'must be an object keyed by day.');
  else {
    const seen = new Map<string, string>();
    for (const [k, log] of Object.entries(s.dailyLogs)) {
      const path = `dailyLogs[${k}]`;
      if (!/^[1-9]\d*$/.test(k) || Number(k) > 63) { p.add(path, 'day key must be a whole number from 1 to 63.'); continue; }
      if (!isObj(log)) { p.add(path, 'must be an object.'); continue; }
      num(p, log, 'dayNumber', `${path}.dayNumber`, 1, 63, true);
      if (typeof log.dayNumber !== 'number') p.add(`${path}.dayNumber`, 'is required.');
      else if (log.dayNumber !== Number(k)) p.add(`${path}.dayNumber`, `is ${log.dayNumber} but the key is ${k}.`);
      if (!isValidDateString(log.date)) p.add(`${path}.date`, 'must be a valid date written YYYY-MM-DD.');
      else if (seen.has(log.date)) p.add(`${path}.date`, `${log.date} is already used by day ${seen.get(log.date)}.`);
      else seen.set(log.date, k);
      num(p, log, 'steps', `${path}.steps`, 0, 1_000_000);
      num(p, log, 'waterMl', `${path}.waterMl`, 0, 100_000);
      num(p, log, 'sleepHours', `${path}.sleepHours`, 0, 24);
      num(p, log, 'plannedSteps', `${path}.plannedSteps`, 0, 1_000_000);
      num(p, log, 'plannedWaterMl', `${path}.plannedWaterMl`, 0, 100_000);
      num(p, log, 'plannedSleepHours', `${path}.plannedSleepHours`, 0, 24);
      num(p, log, 'energyRating', `${path}.energyRating`, 0, 10);
      num(p, log, 'hungerRating', `${path}.hungerRating`, 0, 10);
      num(p, log, 'sorenessRating', `${path}.sorenessRating`, 0, 10);
      checkMacros(p, log, 'macrosConsumed', `${path}.macrosConsumed`);
      checkMacros(p, log, 'plannedMacros', `${path}.plannedMacros`);
      for (const k2 of ['checklist', 'entered', 'supplements']) {
        if (k2 in log && log[k2] !== undefined && !isObj(log[k2])) p.add(`${path}.${k2}`, 'must be an object.');
      }
      if (p.total > 200) break;
    }
  }

  if (!isObj(s.workoutLogs)) p.add('workoutLogs', 'must be an object.');
  else {
    const keys = Object.keys(s.workoutLogs);
    if (keys.length > BACKUP_LIMITS.maxListLength) p.add('workoutLogs', `has ${keys.length} entries; the limit is ${BACKUP_LIMITS.maxListLength}.`);
    else for (const k of keys) {
      const w = s.workoutLogs[k];
      if (!isObj(w)) { p.add(`workoutLogs[${k}]`, 'must be an object.'); continue; }
      if ('exercises' in w && w.exercises !== undefined && !Array.isArray(w.exercises)) p.add(`workoutLogs[${k}].exercises`, 'must be an array.');
    }
  }

  const weighIns = list(p, s, 'weighIns', true);
  weighIns?.forEach((w, i) => {
    const path = `weighIns[${i}]`;
    if (!isObj(w)) { p.add(path, 'must be an object, not ' + (w === null ? 'null' : typeof w) + '.'); return; }
    dateField(p, w, 'date', `${path}.date`);
    num(p, w, 'weight', `${path}.weight`, 0, 1000);
    if (typeof w.weight !== 'number' && !(typeof w.weight === 'string')) p.add(`${path}.weight`, 'is required.');
    num(p, w, 'dayNumber', `${path}.dayNumber`, 0, 1000);
  });

  const meas = list(p, s, 'measurementHistory', false);
  meas?.forEach((m, i) => {
    const path = `measurementHistory[${i}]`;
    if (!isObj(m)) { p.add(path, 'must be an object, not ' + (m === null ? 'null' : typeof m) + '.'); return; }
    dateField(p, m, 'date', `${path}.date`);
    num(p, m, 'dayNumber', `${path}.dayNumber`, 0, 1000);
    if (!isObj(m.measurements)) p.add(`${path}.measurements`, 'must be an object.');
    else for (const f of ['chest', 'waist', 'hips', 'arms']) num(p, m.measurements, f, `${path}.measurements.${f}`, 0, 1000);
  });

  const photos = list(p, s, 'photos', false);
  photos?.forEach((ph, i) => {
    if (!isObj(ph)) p.add(`photos[${i}]`, 'must be an object, not ' + (ph === null ? 'null' : typeof ph) + '.');
  });

  const lessons = list(p, s, 'learnedLessonIds', false);
  lessons?.forEach((id, i) => {
    if (typeof id !== 'string') p.add(`learnedLessonIds[${i}]`, 'must be text.');
  });

  for (const k of ['quizAnswers', 'avoidedMistakes']) {
    if (k in s && s[k] !== undefined && !isObj(s[k])) p.add(k, 'must be an object.');
  }
}

/** Fills missing structural fields on every log (checklist, supplements, macros) without altering existing values. */
export function normalizeRestoredLogs(state: AppState): AppState {
  const dailyLogs: { [day: number]: DailyLog } = {};
  for (const [k, raw] of Object.entries(state.dailyLogs || {})) {
    const log = raw as DailyLog;
    const phase = log.phase || (log.dayNumber >= 36 ? 'phase3' : log.dayNumber >= 8 ? 'phase2' : 'phase1');
    dailyLogs[Number(k)] = {
      ...log,
      phase,
      checklist: { ...createDefaultChecklist(phase), ...(log.checklist || {}) },
      macrosConsumed: Object.assign({ calories: 0, protein: 0, fat: 0, carbs: 0 }, log.macrosConsumed || {}),
      waterMl: log.waterMl ?? 0,
      steps: log.steps ?? 0,
      supplements: Object.assign({ whey: false, creatine: false, multivitamin: false, vitaminD3: false, carnitine: false, acv: false }, log.supplements || {})
    };
  }
  return { ...state, dailyLogs };
}

/** Adds default logs for any missing day 1..63 (dated from the start date) so later edits never invent a 'today' day. */
export function padDailyLogs(state: AppState): AppState {
  const dailyLogs = { ...(state.dailyLogs || {}) };
  const base = state.settings?.startDate || getTodayDateString();
  for (let d = 1; d <= 63; d++) {
    if (!dailyLogs[d]) dailyLogs[d] = createDefaultDailyLog(d, calculateDateForDayNumber(base, d));
  }
  return { ...state, dailyLogs };
}

/** Never throws. Validates the whole file first. Accepts versioned ({version, exportedAt, state}) and legacy (bare state) shapes. */
export function parseBackup(text: string): ParseResult {
  if (typeof text !== 'string') return { ok: false, errors: ['Backup could not be read.'] };
  if (text.length > BACKUP_LIMITS.maxTextChars) {
    return { ok: false, errors: [`File is too large (${(text.length / 1_000_000).toFixed(1)} MB). Backups over ${BACKUP_LIMITS.maxTextChars / 1_000_000} MB are rejected.`] };
  }
  if (maxTextDepth(text) > BACKUP_LIMITS.maxDepth) {
    return { ok: false, errors: [`File is nested more than ${BACKUP_LIMITS.maxDepth} levels deep, which a real backup never is.`] };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['File is not valid JSON.'] };
  }
  try {
    const shapeError = checkShape(data);
    if (shapeError) return { ok: false, errors: [shapeError] };
    if (!isObj(data)) return { ok: false, errors: ['Backup must be a JSON object.'] };
    let state: unknown = data;
    let version: number | undefined;
    if ('version' in data || 'state' in data) {
      if (typeof data.version !== 'number' || !Number.isInteger(data.version) || data.version < 1) {
        return { ok: false, errors: ['Backup version is missing or invalid.'] };
      }
      if (data.version > BACKUP_VERSION) {
        return { ok: false, errors: [`Backup version ${data.version} is newer than this app supports (${BACKUP_VERSION}).`] };
      }
      version = data.version;
      state = data.state;
    }
    const problems = new Problems();
    validateState(state, problems);
    if (problems.total) return { ok: false, version, errors: problems.result() };
    return { ok: true, state: normalizeRestoredLogs(state as AppState), version, errors: [], migrated: problems.migrated };
  } catch {
    return { ok: false, errors: ['Backup could not be read.'] };
  }
}

export interface RestoreCounts {
  dailyLogs: number;
  weighIns: number;
  workoutLogs: number;
  measurements: number;
  confirmedEntries: number;
}

export interface RestoreCheck {
  safe: boolean;
  warnings: string[];
  current: RestoreCounts;
  incoming: RestoreCounts;
}

function counts(s: Partial<AppState> | undefined): RestoreCounts {
  let confirmed = 0;
  if (s && isObj(s.dailyLogs)) {
    for (const log of Object.values(s.dailyLogs)) {
      const e = isObj(log) && isObj((log as any).entered) ? ((log as any).entered as Record<string, unknown>) : {};
      for (const v of Object.values(e)) if (v === true) confirmed++;
    }
  }
  return {
    dailyLogs: s && isObj(s.dailyLogs) ? Object.values(s.dailyLogs).filter((l) => dailyLogHasData(l as DailyLog)).length : 0,
    weighIns: s && Array.isArray(s.weighIns) ? s.weighIns.length : 0,
    workoutLogs: s && isObj(s.workoutLogs) ? Object.values(s.workoutLogs).filter((w) => workoutHasData(w as any)).length : 0,
    measurements: s && Array.isArray(s.measurementHistory) ? s.measurementHistory.length : 0,
    confirmedEntries: confirmed
  };
}

/** safe=false (with warnings) when the incoming backup has fewer of anything, or would unlink/relink the cloud account. */
export function restoreIsSafe(current: Partial<AppState>, incoming: Partial<AppState>): RestoreCheck {
  const c = counts(current);
  const i = counts(incoming);
  const warnings: string[] = [];
  const rows: [keyof RestoreCounts, string][] = [
    ['dailyLogs', 'daily logs'],
    ['weighIns', 'weigh-ins'],
    ['workoutLogs', 'workout logs'],
    ['measurements', 'measurement entries'],
    ['confirmedEntries', 'confirmed entries (values you marked as entered)']
  ];
  for (const [k, label] of rows) {
    if (i[k] < c[k]) warnings.push(`This backup has ${i[k]} ${label} but you currently have ${c[k]}. Restoring would lose ${c[k] - i[k]}.`);
  }
  const curUid = current.settings?.linkedFirebaseUid;
  const inUid = incoming.settings?.linkedFirebaseUid;
  if (curUid && !inUid) {
    warnings.push('This backup is not linked to any cloud account, but this device is. The current account link will be kept.');
  } else if (curUid && inUid && curUid !== inUid) {
    warnings.push('This backup is linked to a different cloud account than this device. Restoring would switch which account this device syncs with.');
  }
  return { safe: warnings.length === 0, warnings, current: c, incoming: i };
}

/** State to actually restore: if the backup has no linkedFirebaseUid, keep the device's current one. */
export function stateForRestore(current: Partial<AppState>, incoming: AppState): AppState {
  const curUid = current.settings?.linkedFirebaseUid;
  if (curUid && !incoming.settings?.linkedFirebaseUid) {
    return { ...incoming, settings: { ...incoming.settings, linkedFirebaseUid: curUid } };
  }
  return incoming;
}
