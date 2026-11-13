import { DailyLog } from '../types';

export type EnteredMetric = 'sleep' | 'calories' | 'protein' | 'steps' | 'water' | 'energy';

/** entered: user confirmed. unconfirmed: a value is stored but nobody confirmed it (legacy/ambiguous). missing: nothing usable. */
export type MetricStatus = 'entered' | 'unconfirmed' | 'missing';

export const ENTERED_METRICS: EnteredMetric[] = ['sleep', 'calories', 'protein', 'steps', 'water', 'energy'];

/** Raw stored value for a metric, or undefined if the field is absent. Never invents a value. */
export function rawMetricValue(log: DailyLog, metric: EnteredMetric): number | undefined {
  switch (metric) {
    case 'sleep': return log.sleepHours;
    case 'calories': return log.macrosConsumed?.calories;
    case 'protein': return log.macrosConsumed?.protein;
    case 'steps': return log.steps;
    case 'water': return log.waterMl;
    case 'energy': return log.energyRating;
  }
}

/** Whether a stored value looks like something rather than an untouched default (0 / absent). */
function hasStoredValue(log: DailyLog, metric: EnteredMetric): boolean {
  const v = rawMetricValue(log, metric);
  if (v === undefined || v === null) return false;
  return metric === 'sleep' || metric === 'energy' ? true : v > 0;
}

export function metricStatus(log: DailyLog, metric: EnteredMetric): MetricStatus {
  const flag = log.entered?.[metric];
  if (flag === true) return 'entered';
  if (flag === false) return 'missing';
  return hasStoredValue(log, metric) ? 'unconfirmed' : 'missing';
}

/** Returns a copy of the log with the metric flagged as user-entered. Call from every input handler. */
export function markEntered(log: DailyLog, metric: EnteredMetric): DailyLog {
  return { ...log, entered: { ...(log.entered || {}), [metric]: true } };
}

/** Value for display/export: only when the user confirmed it; otherwise undefined (never 0). */
export function confirmedValue(log: DailyLog, metric: EnteredMetric): number | undefined {
  return metricStatus(log, metric) === 'entered' ? rawMetricValue(log, metric) : undefined;
}
