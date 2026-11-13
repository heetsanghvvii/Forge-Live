import type { AppState } from '../types';
import { calculateDateForDayNumber } from './storage';

export interface DateProblem {
  code: 'invalid-start' | 'phase2-start' | 'phase3-start' | 'day-date-mismatch' | 'weighin-before-start';
  message: string;
  /** Day numbers involved (capped), when relevant. */
  days?: number[];
}

/**
 * READ-ONLY detector for legacy profiles whose dates do not line up with the programme start.
 * It never changes the state; any cleanup needs the owner's consent and is done elsewhere.
 * Rule recorded for day records: they stay editable, edits mark the entered flags, history is never re-dated.
 */
export function findDateIncoherence(state: AppState | null | undefined): DateProblem[] {
  const out: DateProblem[] = [];
  const s = state?.settings;
  const start = s?.startDate;
  if (!start) return out;
  if (!calculateDateForDayNumber(start, 1)) {
    out.push({ code: 'invalid-start', message: `The programme start date "${String(start)}" is not a valid date.` });
    return out;
  }
  if (s?.phase2StartDate && s.phase2StartDate !== calculateDateForDayNumber(start, 8)) {
    out.push({ code: 'phase2-start', message: 'Phase 2 start date does not match Day 8 of your programme.' });
  }
  if (s?.phase3StartDate && s.phase3StartDate !== calculateDateForDayNumber(start, 36)) {
    out.push({ code: 'phase3-start', message: 'Phase 3 start date does not match Day 36 of your programme.' });
  }
  const bad: number[] = [];
  const logs = state?.dailyLogs && typeof state.dailyLogs === 'object' ? state.dailyLogs : {};
  for (const [k, log] of Object.entries(logs)) {
    const n = Number(k);
    if (!log || typeof log !== 'object' || !Number.isFinite(n)) continue;
    if (log.date && log.date !== calculateDateForDayNumber(start, n)) bad.push(n);
  }
  if (bad.length) {
    out.push({
      code: 'day-date-mismatch',
      message: `${bad.length} day record(s) have a date that does not match the programme start.`,
      days: bad.sort((a, b) => a - b).slice(0, 20),
    });
  }
  const early = (Array.isArray(state?.weighIns) ? state!.weighIns : []).filter((w) => w && typeof w.date === 'string' && w.date && w.date < start);
  if (early.length) out.push({ code: 'weighin-before-start', message: `${early.length} weigh-in(s) are dated before your start date.` });
  return out;
}
