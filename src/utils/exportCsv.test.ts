import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyLogsToCsv, workoutSetsToCsv, weighInsToCsv, measurementsToCsv, csvText, DAILY_CSV_HEADERS } from './exportCsv';
import type { DailyLog, WorkoutHistory } from '../types';

const log = (day: number, over: Partial<DailyLog> = {}): DailyLog => ({
  date: `2026-01-${String(day).padStart(2, '0')}`,
  dayNumber: day,
  phase: 'phase1',
  checklist: { workout: false, cardio: false, water: false, photo: false, community: false },
  macrosConsumed: { calories: 0, protein: 0, fat: 0, carbs: 0 },
  waterMl: 0,
  steps: 0,
  supplements: { whey: false, creatine: false, multivitamin: false, vitaminD3: false, carnitine: false, acv: false },
  ...over
});

/** Minimal RFC 4180 parser so tests check real cell structure. */
function parse(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (q) {
      if (c === '"' && csv[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\r' && csv[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += c;
  }
  return rows;
}
const col = (rows: string[][], name: string, r = 1) => rows[r][rows[0].indexOf(name)];

test('missing day exports blank, not zero', () => {
  const rows = parse(dailyLogsToCsv({ 1: log(1) }));
  for (const [v, s] of [['Sleep_hours', 'sleep_status'], ['Calories_Consumed_kcal', 'calories_status'], ['Steps_count', 'steps_status'], ['Water_ml', 'water_status'], ['Protein_Consumed_g', 'protein_status'], ['Energy_Rating_1_to_10', 'energy_status']]) {
    assert.equal(col(rows, v), '', v);
    assert.equal(col(rows, s), 'missing', s);
  }
});

test('entered zero is written as 0', () => {
  const rows = parse(dailyLogsToCsv({ 1: log(1, { sleepHours: 0, steps: 0, entered: { sleep: true, steps: true } }) }));
  assert.equal(col(rows, 'Sleep_hours'), '0');
  assert.equal(col(rows, 'sleep_status'), 'entered');
  assert.equal(col(rows, 'Steps_count'), '0');
});

test('unconfirmed 7.5 goes only to raw column', () => {
  const rows = parse(dailyLogsToCsv({ 1: log(1, { sleepHours: 7.5 }) }));
  assert.equal(col(rows, 'Sleep_hours'), '');
  assert.equal(col(rows, 'sleep_status'), 'unconfirmed');
  assert.equal(col(rows, 'sleep_unconfirmed_raw'), '7.5');
});

test('entered value fills value column and not the raw column', () => {
  const rows = parse(dailyLogsToCsv({ 1: log(1, { sleepHours: 7.5, entered: { sleep: true } }) }));
  assert.equal(col(rows, 'Sleep_hours'), '7.5');
  assert.equal(col(rows, 'sleep_unconfirmed_raw'), '');
});

test('escaping: comma, quote, newline, formula', () => {
  assert.equal(csvText('a,b'), '"a,b"');
  assert.equal(csvText('say "hi"'), '"say ""hi"""');
  assert.equal(csvText('l1\nl2'), '"l1\nl2"');
  assert.equal(csvText('=cmd|x'), "'=cmd|x");
  assert.equal(csvText('+1'), "'+1");
  assert.equal(csvText('-1'), "'-1");
  assert.equal(csvText('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(csvText('=a,"b"'), `"'=a,""b"""`);
  const rows = parse(dailyLogsToCsv({ 1: log(1, { generalNotes: 'ok, "fine"\nline2', painOrIllnessNotes: '=HYPERLINK("x")' }) }));
  assert.equal(col(rows, 'General_Notes'), 'ok, "fine"\nline2');
  assert.equal(col(rows, 'Pain_Or_Illness_Notes'), `'=HYPERLINK("x")`);
});

test('header and every row have the same column count', () => {
  const nasty = log(2, { generalNotes: 'a,b\n"c"', painOrIllnessNotes: '=x' });
  const rows = parse(dailyLogsToCsv({ 1: log(1), 2: nasty }));
  assert.equal(rows.length, 3);
  assert.equal(rows[0].length, DAILY_CSV_HEADERS.length);
  rows.forEach((r) => assert.equal(r.length, rows[0].length));
});

test('workout CSV: escaping, blank untouched sets, column counts', () => {
  const w: WorkoutHistory = {
    d1: {
      phase: 'phase1', workoutCompleted: true, warmupCompleted: false, cooldownCompleted: false, absCompleted: false, cardioCompleted: false, cardioMinutes: 0,
      exercises: [{ exerciseId: 'x', name: '=Bench, "flat"', sets: [
        { setNumber: 1, weight: 0, reps: 0, completed: false },
        { setNumber: 2, weight: 0, reps: 12, completed: true, setNotes: 'felt\ngood' }
      ] }],
      totalVolumeKg: 0, sessionNotes: '@boss'
    }
  };
  const rows = parse(workoutSetsToCsv(w));
  assert.equal(rows.length, 3);
  rows.forEach((r) => assert.equal(r.length, rows[0].length));
  assert.equal(col(rows, 'ExerciseName'), `'=Bench, "flat"`);
  assert.equal(col(rows, 'Weight_kg', 1), '');
  assert.equal(col(rows, 'Reps_count', 1), '');
  assert.equal(col(rows, 'Weight_kg', 2), '0');
  assert.equal(col(rows, 'SetNotes', 2), 'felt\ngood');
  assert.equal(col(rows, 'SessionNotes', 2), "'@boss");
});

test('weigh-in and measurement CSV: zero/NaN are blank', () => {
  const w = parse(weighInsToCsv([{ date: '2026-01-01', dayNumber: 1, weight: 82.4 }, { date: '2026-01-02', dayNumber: 2, weight: 0 }, { date: '2026-01-03', dayNumber: 3, weight: NaN }]));
  assert.deepEqual(w.map((r) => r[2]), ['Weight_kg', '82.4', '', '']);
  const m = parse(measurementsToCsv([{ date: '2026-01-01', dayNumber: 1, measurements: { chest: 100, waist: 0, hips: 95, arms: NaN } }]));
  assert.deepEqual(m[1], ['2026-01-01', '1', '100', '', '95', '']);
});

test('P4: right-to-left override before = is neutralised, original cell kept after the apostrophe', () => {
  assert.equal(csvText('‮=1+1'), "'‮=1+1");
  assert.equal(csvText('​@x'), "'​@x");
  assert.equal(csvText('safe'), 'safe');
});
