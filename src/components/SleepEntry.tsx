import React, { useEffect, useState } from 'react';
import { Moon } from 'lucide-react';
import { DailyLog } from '../types';
import { metricStatus } from '../utils/entered';
import { parseSleepInput } from '../utils/sleep';

interface SleepEntryProps {
  log: DailyLog;
  onChange: (partial: Partial<DailyLog>) => void;
}

const btn = 'min-h-[44px] px-4 rounded-xl text-xs font-bold transition-colors';

/**
 * Sleep hours card. Clear choice: sets sleepHours undefined AND entered.sleep=false, so status becomes
 * 'missing' while every other field (and the entered flags of other metrics) is untouched.
 */
export const SleepEntry: React.FC<SleepEntryProps> = ({ log, onChange }) => {
  const status = metricStatus(log, 'sleep');
  const raw = log.sleepHours;
  const [text, setText] = useState<string>(status === 'entered' && raw !== undefined ? String(raw) : '');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setText(status === 'entered' && raw !== undefined ? String(raw) : '');
    setError('');
  }, [log.dayNumber, status, raw]);

  const flags = log.entered || {};

  const save = () => {
    const r = parseSleepInput(text);
    if (!r.ok) { setError(r.error); return; }
    setError('');
    onChange({ sleepHours: r.value, entered: { ...flags, sleep: true } });
  };

  return (
    <div className="p-5 rounded-2xl bg-[#14181D] border border-[#222933] space-y-3 shadow-lg">
      <div className="flex items-center justify-between pb-2 border-b border-[#222933]">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-[#B6FF3B]" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Sleep</h3>
        </div>
        <span className="font-mono text-xs font-bold text-[#B6FF3B]">
          {status === 'entered' && raw !== undefined ? `${raw} h` : status === 'unconfirmed' ? 'Unconfirmed' : 'Not logged'}
        </span>
      </div>

      {status === 'unconfirmed' && raw !== undefined && (
        <div className="space-y-2">
          <p className="text-xs text-amber-300">Unconfirmed: {raw} h (old value)</p>
          <div className="flex gap-2">
            <button type="button" className={`${btn} bg-[#B6FF3B] text-black flex-1`}
              onClick={() => onChange({ entered: { ...flags, sleep: true } })}>That's right</button>
            <button type="button" className={`${btn} bg-[#0B0D10] border border-[#222933] text-slate-300 flex-1`}
              onClick={() => onChange({ entered: { ...flags, sleep: false } })}>Not mine</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          step={0.25}
          aria-label="Sleep hours"
          aria-invalid={!!error}
          value={text}
          placeholder="e.g. 7.5"
          onChange={(e) => { setText(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          className="flex-1 min-w-0 min-h-[44px] px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-white font-mono text-sm focus:outline-none focus:border-[#B6FF3B]"
        />
        <span className="text-xs text-slate-400 font-semibold">hours</span>
        <button type="button" onClick={save} className={`${btn} bg-[#B6FF3B] text-black`}>Save</button>
      </div>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}

      {status === 'entered' && (
        <button type="button" className={`${btn} bg-[#0B0D10] border border-[#222933] text-slate-400 hover:text-white`}
          onClick={() => { setText(''); setError(''); onChange({ sleepHours: undefined, entered: { ...flags, sleep: false } }); }}>
          Clear
        </button>
      )}
    </div>
  );
};
