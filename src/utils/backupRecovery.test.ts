import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBackup, issuesAreDateOnly } from './backupRecovery';
import { parseBackup, serializeBackup } from './backup';
import { preflightSaveReview } from './legacyRepair';
import { AppState } from '../types';
import { createDefaultDailyLog, calculateDateForDayNumber } from './storage';

const START = '2026-10-25';

function makeState(mut?: (s: AppState) => void): AppState {
  const dailyLogs: AppState['dailyLogs'] = {};
  for (let d = 1; d <= 63; d++) dailyLogs[d] = createDefaultDailyLog(d, calculateDateForDayNumber(START, d));
  const s = {
    settings: { startDate: START, timezone: 'Asia/Kolkata' },
    currentDayNumber: 1,
    selectedDayNumber: 1,
    dailyLogs,
    workoutLogs: {},
    weighIns: [],
    measurementHistory: [],
    photos: [],
    learnedLessonIds: []
  } as unknown as AppState;
  mut?.(s);
  return s;
}

/** Legacy shape: day 9 duplicates day 1's date; day 8 has a wrong date. */
function makeLegacyFile(): string {
  const s = makeState((st) => {
    st.dailyLogs[8].date = '2026-10-24';
    st.dailyLogs[9].date = '2026-10-25'; // duplicate of day 1
    st.dailyLogs[9].sleepHours = 7.5;    // phantom-looking value, unconfirmed
  });
  return serializeBackup(s);
}


  test('classifies a clean backup as valid and identical to parseBackup', () => {
    const text = serializeBackup(makeState());
    const a = analyzeBackup(text);
    assert.strictEqual(a.kind, 'valid');
    if (a.kind === 'valid') {
      assert.strictEqual(a.result.state.dailyLogs[9].date, calculateDateForDayNumber(START, 9));
    }
  });

  test('classifies a duplicate-date legacy backup as recoverable, preserving original bytes', () => {
    const text = makeLegacyFile();
    assert.strictEqual(parseBackup(text).ok, false); // strict importer still rejects it
    const a = analyzeBackup(text);
    assert.strictEqual(a.kind, 'recoverable');
    if (a.kind !== 'recoverable') return;
    // original date strings preserved byte-for-byte, including the duplicate
    assert.strictEqual(a.state.dailyLogs[1].date, '2026-10-25');
    assert.strictEqual(a.state.dailyLogs[9].date, '2026-10-25');
    assert.strictEqual(a.state.dailyLogs[8].date, '2026-10-24');
    assert.strictEqual(a.state.dailyLogs[9].sleepHours, 7.5);
    assert.ok(a.issues.length > 0);
    assert.strictEqual(issuesAreDateOnly(a.issues), true);
    // the legacy review gate catches the imported state
    assert.notStrictEqual(a.review, null);
    assert.notStrictEqual(preflightSaveReview(a.state), null);
  });

  test('rejects files with date problems AND other structural problems', () => {
    const s = makeState((st) => {
      st.dailyLogs[9].date = '2026-10-25';
      (st.dailyLogs[9] as any).steps = 'abc'; // not a canonical number: structural
    });
    const a = analyzeBackup(serializeBackup(s));
    assert.strictEqual(a.kind, 'unrecoverable');
    if (a.kind === 'unrecoverable') assert.ok(String(a.reasons.join('\n')).includes('steps'));
  });

  test('rejects files with date problems AND out-of-range values', () => {
    const s = makeState((st) => {
      st.dailyLogs[9].date = '2026-10-25';
      st.dailyLogs[9].sleepHours = 99;
    });
    const a = analyzeBackup(serializeBackup(s));
    assert.strictEqual(a.kind, 'unrecoverable');
  });

  test('rejects non-JSON and non-backup shapes', () => {
    assert.strictEqual(analyzeBackup('not json').kind, 'unrecoverable');
    assert.strictEqual(analyzeBackup('42').kind, 'unrecoverable');
    assert.strictEqual(analyzeBackup('{"state": 5}').kind, 'unrecoverable');
  });

  test('keeps documented numeric migrations while preserving original dates', () => {
    const s = makeState((st) => {
      st.dailyLogs[9].date = '2026-10-25';
      (st.dailyLogs[9] as any).steps = '9000'; // canonical numeric text: documented migration
    });
    const a = analyzeBackup(serializeBackup(s));
    assert.strictEqual(a.kind, 'recoverable');
    if (a.kind !== 'recoverable') return;
    assert.strictEqual(a.state.dailyLogs[9].steps, 9000);
    assert.ok(String(a.migrated).includes('dailyLogs[9].steps'));
    assert.strictEqual(a.state.dailyLogs[9].date, '2026-10-25'); // untouched
  });

  test('recoverable review matches the live-state repair preview (same day list)', () => {
    const a = analyzeBackup(makeLegacyFile());
    if (a.kind !== 'recoverable' || !a.review) throw new Error('expected recoverable with review');
    const liveReview = preflightSaveReview(makeState((st) => {
      st.dailyLogs[8].date = '2026-10-24';
      st.dailyLogs[9].date = '2026-10-25';
      st.dailyLogs[9].sleepHours = 7.5;
    }));
    assert.notStrictEqual(a.review, null);
    assert.strictEqual(JSON.stringify(a.review?.dateMismatches), JSON.stringify(liveReview?.dateMismatches));
  });
