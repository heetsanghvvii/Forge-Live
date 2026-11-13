import { DailyLog } from '../types';
import { EnteredMetric, metricStatus, rawMetricValue } from './entered';

export interface LoggedDaySummary {
  entered: number;
  unconfirmed: number;
  missing: number;
  totalDays: number;
}

/** Per-metric counts of days by status. Each metric has its own denominator view. */
export function loggedDaySummary(logs: DailyLog[], metric: EnteredMetric): LoggedDaySummary {
  const summary: LoggedDaySummary = { entered: 0, unconfirmed: 0, missing: 0, totalDays: logs.length };
  for (const log of logs) summary[metricStatus(log, metric)] += 1;
  return summary;
}

/** Mean over days the athlete confirmed (zeros included). null when no confirmed days. Not rendered yet. */
export function confirmedAverage(logs: DailyLog[], metric: EnteredMetric): number | null {
  const values: number[] = [];
  for (const log of logs) {
    if (metricStatus(log, metric) !== 'entered') continue;
    const v = rawMetricValue(log, metric);
    if (typeof v === 'number' && Number.isFinite(v)) values.push(v);
  }
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
