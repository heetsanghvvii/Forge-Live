import React, { useMemo, useState } from 'react';
import { X, ClipboardCheck } from 'lucide-react';
import { AppState, DailyLog } from '../types';
import { ENTERED_METRICS, EnteredMetric, metricStatus, rawMetricValue } from '../utils/entered';

export interface UnconfirmedEntry {
  dayNumber: number;
  date: string;
  metric: EnteredMetric;
  value: number;
}

const LABELS: Record<EnteredMetric, string> = {
  sleep: 'Sleep',
  calories: 'Calories',
  protein: 'Protein',
  steps: 'Steps',
  water: 'Water',
  energy: 'Energy'
};

export function formatEntryValue(metric: EnteredMetric, v: number): string {
  switch (metric) {
    case 'sleep': return `${v} h`;
    case 'calories': return `${v} kcal`;
    case 'protein': return `${v} g`;
    case 'steps': return v.toLocaleString();
    case 'water': return `${v} ml`;
    case 'energy': return `${v} / 10`;
  }
}

/** All stored-but-unconfirmed values, oldest day first. Read-only. */
export function listUnconfirmed(dailyLogs: { [day: number]: DailyLog }): UnconfirmedEntry[] {
  const out: UnconfirmedEntry[] = [];
  Object.keys(dailyLogs || {})
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((day) => {
      const log = dailyLogs[day];
      if (!log) return;
      for (const metric of ENTERED_METRICS) {
        if (metricStatus(log, metric) !== 'unconfirmed') continue;
        const value = rawMetricValue(log, metric);
        if (value === undefined) continue;
        out.push({ dayNumber: day, date: log.date, metric, value });
      }
    });
  return out;
}

interface Props {
  appState: AppState;
  onClose: () => void;
  onUpdateAppState: (updater: (prev: AppState) => AppState) => void;
}

export const ReviewEntriesModal: React.FC<Props> = ({ appState, onClose, onUpdateAppState }) => {
  const entries = useMemo(() => listUnconfirmed(appState.dailyLogs), [appState.dailyLogs]);
  const [confirmAll, setConfirmAll] = useState(false);

  // Only flips the flag; the raw stored value is never changed or removed.
  const setFlags = (targets: UnconfirmedEntry[], flag: boolean) => {
    onUpdateAppState((prev) => {
      const logs = { ...prev.dailyLogs };
      for (const t of targets) {
        const log = logs[t.dayNumber];
        if (!log) continue;
        logs[t.dayNumber] = { ...log, entered: { ...(log.entered || {}), [t.metric]: flag } };
      }
      return { ...prev, dailyLogs: logs };
    });
  };

  const btn = 'min-h-[40px] px-3 rounded-xl text-xs font-bold active:scale-95 transition-all';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-3xl bg-[#14181D] border border-[#222933] shadow-2xl">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-[#222933]">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
              <ClipboardCheck className="w-4 h-4 text-[#B6FF3B]" />
              Review old entries
            </h2>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Tell us which of these numbers you typed yourself; the rest will not be counted or shared as your entries (the stored value is kept).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {entries.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Nothing to review. All entries are confirmed.</p>
          ) : (
            entries.map((e) => (
              <div
                key={`${e.dayNumber}-${e.metric}`}
                className="p-3 rounded-2xl bg-[#0B0D10] border border-[#222933] space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">
                    {e.date} <span className="text-slate-500">(Day {e.dayNumber})</span>
                  </span>
                  <span className="font-mono font-bold text-[#B6FF3B]">
                    {LABELS[e.metric]}: {formatEntryValue(e.metric, e.value)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFlags([e], true)}
                    className={`${btn} bg-[#B6FF3B] text-black`}
                  >
                    Yes, I entered this
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlags([e], false)}
                    className={`${btn} bg-[#14181D] border border-[#222933] text-slate-200 hover:text-white`}
                  >
                    Not mine - treat as missing
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {entries.length > 0 && (
          <div className="p-4 border-t border-[#222933] space-y-2">
            {!confirmAll ? (
              <button
                type="button"
                onClick={() => setConfirmAll(true)}
                className={`${btn} w-full bg-[#14181D] border border-[#B6FF3B]/40 text-[#B6FF3B]`}
              >
                Confirm all shown ({entries.length})
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-amber-300 leading-relaxed">
                  This says you entered all {entries.length} values yourself. Only do this if you are sure.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFlags(entries, true);
                      setConfirmAll(false);
                    }}
                    className={`${btn} bg-[#B6FF3B] text-black`}
                  >
                    Yes, confirm all
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAll(false)}
                    className={`${btn} bg-[#14181D] border border-[#222933] text-slate-200`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
