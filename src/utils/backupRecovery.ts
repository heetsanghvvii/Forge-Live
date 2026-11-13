/**
 * Importer recovery for older-format backups.
 *
 * The strict importer (parseBackup in backup.ts) rejects any backup whose dailyLogs
 * contain invalid or duplicate dates. Those are exactly the legacy states the
 * legacy-repair review flow exists for, so a backup made on a legacy device could
 * never be restored. This module classifies a rejected backup WITHOUT weakening
 * validation:
 *
 *  - valid:        parseBackup accepts it unchanged (existing path).
 *  - recoverable:  the ONLY problems are dailyLogs date validity/duplication.
 *                  Proven by re-validating a PROBE copy whose dates are replaced
 *                  with unique sentinel dates; the imported data keeps the
 *                  ORIGINAL date strings byte-for-byte (nothing is rewritten,
 *                  fixed or reinterpreted). The legacy-repair review gate then
 *                  drives the same explicit owner review as any legacy state.
 *  - unrecoverable: anything else is wrong too; the original errors are shown
 *                  and nothing is imported.
 */
import { AppState } from '../types';
import { parseBackup, ParseResult, isValidDateString } from './backup';
import { calculateDateForDayNumber } from './storage';
import { preflightSaveReview, LegacyRepairPreview } from './legacyRepair';

export type BackupAnalysis =
  | { kind: 'valid'; result: ParseResult & { state: AppState } }
  | { kind: 'recoverable'; state: AppState; issues: string[]; migrated: string[]; review: LegacyRepairPreview | null }
  | { kind: 'unrecoverable'; reasons: string[] };

/** Sentinel base for the probe: far-future unique valid dates that cannot collide with real data. */
const PROBE_BASE = '2099-01-01';

function rawStateOf(data: Record<string, unknown>): unknown {
  return 'version' in data || 'state' in data ? data.state : data;
}

export function analyzeBackup(text: string): BackupAnalysis {
  const res = parseBackup(text);
  if (res.ok && res.state) {
    return { kind: 'valid', result: res as ParseResult & { state: AppState } };
  }

  // The file was rejected. Re-parse the raw JSON for the classification probe.
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: 'unrecoverable', reasons: res.errors };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { kind: 'unrecoverable', reasons: res.errors };
  }
  const rawState = rawStateOf(raw as Record<string, unknown>);
  if (typeof rawState !== 'object' || rawState === null || Array.isArray(rawState)) {
    return { kind: 'unrecoverable', reasons: res.errors };
  }
  const logs = (rawState as Record<string, unknown>).dailyLogs;
  if (typeof logs !== 'object' || logs === null || Array.isArray(logs)) {
    return { kind: 'unrecoverable', reasons: res.errors };
  }

  // Probe: deep copy of the WHOLE file with every dailyLogs date replaced by a
  // unique valid sentinel. If the probe validates, date fields were the only problem.
  const probe = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  const probeState = rawStateOf(probe) as Record<string, unknown>;
  const probeLogs = probeState.dailyLogs as Record<string, Record<string, unknown>>;
  const originalDates = new Map<string, unknown>();
  for (const [k, log] of Object.entries(logs as Record<string, unknown>)) {
    if (typeof log !== 'object' || log === null) continue;
    originalDates.set(k, (log as Record<string, unknown>).date);
    if (probeLogs[k]) probeLogs[k].date = calculateDateForDayNumber(PROBE_BASE, Number(k) || 1);
  }
  const probeRes = parseBackup(JSON.stringify(probe));
  if (!probeRes.ok || !probeRes.state) {
    return { kind: 'unrecoverable', reasons: res.errors };
  }

  // Imported state: the probe's validated state (with its documented numeric
  // migrations) but with the ORIGINAL date strings restored byte-for-byte,
  // including invalid or duplicated ones. Nothing is rewritten or reinterpreted.
  const imported = probeRes.state;
  for (const [k, date] of originalDates) {
    const log = (imported.dailyLogs as Record<string, { date?: unknown }>)[k];
    if (log) log.date = date as string;
  }

  const issues = res.errors.filter((e) => /\.date\b/.test(e));
  return {
    kind: 'recoverable',
    state: imported,
    issues: issues.length ? issues : res.errors,
    migrated: (probeRes.migrated ?? []).filter((m) => !/\.date$/.test(m)),
    review: preflightSaveReview(imported)
  };
}

/** True when every issue is a dailyLogs date problem (used by tests and the UI copy). */
export function issuesAreDateOnly(issues: string[]): boolean {
  return issues.length > 0 && issues.every((e) => /^dailyLogs\[\d+\]\.date:/.test(e) || e.startsWith('...and '));
}

export { isValidDateString };
