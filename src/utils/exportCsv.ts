import { DailyLog, WorkoutHistory, WeighInRecord, MeasurementRecord } from '../types';
import { ENTERED_METRICS, EnteredMetric, MetricStatus, metricStatus, rawMetricValue } from './entered';

/**
 * Pure CSV builders. No DOM, no downloads.
 *
 * Conventions:
 * - A blank cell means "no value". Zero is only written when a real 0 was recorded/confirmed.
 * - Text cells are always escaped by csvText(); numeric cells go through csvNumber().
 * - Rows are joined with \r\n (RFC 4180). Header order is fixed and exported below.
 */

const LEADING_INVISIBLE = /^[\s\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]+/;

/** Escape one text cell: neutralise formula starters, double quotes, quote when needed. */
export function csvText(value: unknown): string {
  if (value === undefined || value === null) return '';
  let s = String(value);
  if (s === '') return '';
  // Formula injection: = + - @ and tab / CR are formulas to spreadsheets, also after invisible/bidi characters
  // (U+200B-200F, U+202A-202E, U+2060, U+2066-2069, U+FEFF) or whitespace. The ORIGINAL cell gets the apostrophe.
  if (/^[=+\-@\t\r]/.test(s) || /^[=+\-@\t\r]/.test(s.replace(LEADING_INVISIBLE, ''))) s = "'" + s;
  if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Numeric cell: blank for undefined/null/NaN/Infinity, otherwise the number (0 stays 0). */
export function csvNumber(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return String(value);
}

const yesNo = (v: boolean | undefined) => (v ? 'Yes' : 'No');

function buildCsv(headers: readonly string[], rows: string[][]): string {
  for (const r of rows) {
    if (r.length !== headers.length) throw new Error(`CSV row has ${r.length} cells, expected ${headers.length}`);
  }
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------- daily

/** Per-metric column names: [value column, unit]. Status and raw columns are added after each value. */
const METRIC_VALUE_HEADER: Record<EnteredMetric, string> = {
  sleep: 'Sleep_hours',
  calories: 'Calories_Consumed_kcal',
  protein: 'Protein_Consumed_g',
  steps: 'Steps_count',
  water: 'Water_ml',
  energy: 'Energy_Rating_1_to_10'
};

/**
 * Header order (stable, documented):
 *  Date, DayNumber, Phase,
 *  then for each of calories, protein, steps, water, sleep, energy (in that order):
 *    <Value column>, <metric>_status, <metric>_unconfirmed_raw
 *  with Fat_Consumed_g and Carbs_Consumed_g after calories' triple (blank unless calories status is entered),
 *  then Hunger_Rating_1_to_5, Soreness_Rating_1_to_5, Rest_Day, Skipped, Modified,
 *  Pain_Or_Illness_Notes, General_Notes.
 *
 * <metric>_status = entered | unconfirmed | missing.
 * Value column is filled ONLY when status is entered. For unconfirmed, the stored value is in <metric>_unconfirmed_raw.
 */
const METRIC_ORDER: EnteredMetric[] = ['calories', 'protein', 'steps', 'water', 'sleep', 'energy'];

export const DAILY_CSV_HEADERS: readonly string[] = [
  'Date',
  'DayNumber',
  'Phase',
  ...METRIC_ORDER.flatMap((m) => {
    const cols = [METRIC_VALUE_HEADER[m], `${m}_status`, `${m}_unconfirmed_raw`];
    if (m === 'calories') cols.push('Fat_Consumed_g', 'Carbs_Consumed_g');
    return cols;
  }),
  'Hunger_Rating_1_to_5',
  'Soreness_Rating_1_to_5',
  'Rest_Day',
  'Skipped',
  'Modified',
  'Pain_Or_Illness_Notes',
  'General_Notes'
];

// Sanity: every entered metric is covered.
void ENTERED_METRICS;

function metricCells(log: DailyLog, m: EnteredMetric): { value: string; status: MetricStatus; raw: string } {
  const status = metricStatus(log, m);
  const stored = rawMetricValue(log, m);
  return {
    value: status === 'entered' ? csvNumber(stored) : '',
    status,
    raw: status === 'unconfirmed' ? csvNumber(stored) : ''
  };
}

export function dailyLogsToCsv(logs: { [day: number]: DailyLog } | DailyLog[]): string {
  const list = Array.isArray(logs) ? logs : Object.values(logs || {});
  const rows = list.map((l) => {
    const cells: string[] = [csvText(l.date), csvNumber(l.dayNumber), csvText(l.phase)];
    const calStatus = metricStatus(l, 'calories');
    for (const m of METRIC_ORDER) {
      const c = metricCells(l, m);
      cells.push(c.value, c.status, c.raw);
      if (m === 'calories') {
        // Fat and carbs have no flag of their own; they follow the calories confirmation.
        cells.push(
          calStatus === 'entered' ? csvNumber(l.macrosConsumed?.fat) : '',
          calStatus === 'entered' ? csvNumber(l.macrosConsumed?.carbs) : ''
        );
      }
    }
    cells.push(
      csvNumber(l.hungerRating),
      csvNumber(l.sorenessRating),
      yesNo(l.isRestDay),
      yesNo(l.isSkipped),
      yesNo(l.isModified),
      csvText(l.painOrIllnessNotes),
      csvText(l.generalNotes || l.notes)
    );
    return cells;
  });
  return buildCsv(DAILY_CSV_HEADERS, rows);
}

// ---------------------------------------------------------------- workouts

export const WORKOUT_CSV_HEADERS: readonly string[] = [
  'Date',
  'Phase',
  'DayKey',
  'WorkoutType',
  'ExerciseName',
  'SetNumber',
  'Weight_kg',
  'Reps_count',
  'Completed',
  'IsDropSet',
  'DropWeight_kg',
  'DropReps',
  'RPE_Effort_1_to_10',
  'SetNotes',
  'SessionNotes'
];

/**
 * Weight/reps: an uncompleted set with 0 is an untouched default, so it is blank.
 * A completed set keeps its 0 (bodyweight work is real).
 */
export function workoutSetsToCsv(workoutLogs: WorkoutHistory): string {
  const rows: string[][] = [];
  Object.entries(workoutLogs || {}).forEach(([dayKey, session]) => {
    (session.exercises || []).forEach((ex) => {
      (ex.sets || []).forEach((s) => {
        const keep = (n: number | undefined) => (s.completed || (typeof n === 'number' && n !== 0) ? csvNumber(n) : '');
        rows.push([
          csvText(session.completedAt),
          csvText(session.phase),
          csvText(dayKey),
          csvText(session.workoutType),
          csvText(ex.name),
          csvNumber(s.setNumber),
          keep(s.weight),
          keep(s.reps),
          yesNo(s.completed),
          yesNo(s.isDropSet),
          s.dropWeight ? csvNumber(s.dropWeight) : '',
          s.dropReps ? csvNumber(s.dropReps) : '',
          s.rpeEffort ? csvNumber(s.rpeEffort) : '',
          csvText(s.setNotes),
          csvText(session.sessionNotes)
        ]);
      });
    });
  });
  return buildCsv(WORKOUT_CSV_HEADERS, rows);
}

// ---------------------------------------------------------------- weigh-ins / measurements

export const WEIGH_IN_CSV_HEADERS: readonly string[] = ['Date', 'DayNumber', 'Weight_kg'];

/** A weight of 0 or non-finite is not a real weigh-in: blank. */
const positive = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? String(n) : '');

export function weighInsToCsv(weighIns: WeighInRecord[]): string {
  const rows = (weighIns || []).map((w) => [csvText(w.date), csvNumber(w.dayNumber), positive(w.weight)]);
  return buildCsv(WEIGH_IN_CSV_HEADERS, rows);
}

export const MEASUREMENT_CSV_HEADERS: readonly string[] = ['Date', 'DayNumber', 'Chest_cm', 'Waist_cm', 'Hips_cm', 'Arms_cm'];

/** A body measurement of 0 is an unfilled field: blank. */
export function measurementsToCsv(history: MeasurementRecord[]): string {
  const rows = (history || []).map((m) => [
    csvText(m.date),
    csvNumber(m.dayNumber),
    positive(m.measurements?.chest),
    positive(m.measurements?.waist),
    positive(m.measurements?.hips),
    positive(m.measurements?.arms)
  ]);
  return buildCsv(MEASUREMENT_CSV_HEADERS, rows);
}
