import React, { useState } from 'react';
import { Bell, BellOff, Check, Plus, Trash2 } from 'lucide-react';
import { useHabitStore } from '../hooks/useHabitStore';
import {
  addHabit,
  isDoneOn,
  removeHabit,
  setDone,
  streakFor,
  toLocalNow,
  updateHabit,
  weekProgress,
  type Habit,
} from '../utils/habits';
import { notifyMessage, notifyState, readEnv, type NotifyState } from '../utils/pushSupport';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const inputCls =
  'h-11 px-3 rounded-xl bg-[#0B0D10] border border-[#222933] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#B6FF3B]';

export const HabitReminders: React.FC = () => {
  const [store, updateStore] = useHabitStore();
  const [permission, setPermission] = useState<NotifyState>(() => notifyState(readEnv()));
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [time, setTime] = useState('08:00');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [remind, setRemind] = useState(true);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const today = toLocalNow(new Date()).date;

  const save = (next: ReturnType<typeof setDone>) => {
    if (!updateStore(next)) setMessage('Could not save on this device. Nothing was changed.');
    else setMessage('');
  };

  const guarded = (fn: () => ReturnType<typeof setDone>) => {
    try {
      save(fn());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const result = await Notification.requestPermission();
      setPermission(notifyState({ ...readEnv(), permission: result }));
    } catch {
      setPermission(notifyState(readEnv()));
    }
  };

  const toggleDay = (d: number) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b)));

  const handleAdd = () => {
    try {
      const next = addHabit(store, { name, time, days, remind }, { id: `h_${Date.now().toString(36)}`, now: new Date().toISOString() });
      if (!updateStore(next)) {
        setMessage('Could not save on this device. Nothing was changed.');
        return;
      }
      setName('');
      setTime('08:00');
      setDays([0, 1, 2, 3, 4, 5, 6]);
      setRemind(true);
      setShowForm(false);
      setMessage('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not add the habit.');
    }
  };

  const anyReminders = store.habits.some((h) => h.remind);
  const doneToday = store.habits.filter((h) => h.days.includes(toLocalNow(new Date()).weekday) && isDoneOn(store, h.id, today)).length;
  const scheduledToday = store.habits.filter((h) => h.days.includes(toLocalNow(new Date()).weekday)).length;

  const row = (h: Habit) => {
    const done = isDoneOn(store, h.id, today);
    const streak = streakFor(store, h, today);
    const wk = weekProgress(store, h, today);
    const scheduledToday = h.days.includes(toLocalNow(new Date()).weekday);
    return (
      <div key={h.id} className="p-3 rounded-2xl bg-[#0B0D10] border border-[#222933] space-y-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={`${h.name}, ${done ? 'done today' : 'not done today'}`}
            disabled={!scheduledToday && !done}
            onClick={() => guarded(() => setDone(store, h.id, today, !done, today))}
            className={`h-11 w-11 shrink-0 rounded-xl border flex items-center justify-center ${
              done ? 'bg-[#B6FF3B] border-[#B6FF3B] text-black' : 'border-slate-600 text-transparent'
            } disabled:opacity-40`}
          >
            <Check className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white break-words">{h.name}</p>
            <p className="text-[11px] text-slate-400">
              {h.time} · {h.days.length === 7 ? 'Every day' : h.days.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ')} ·{' '}
              {streak > 0 ? `${streak} in a row` : 'No streak yet'} · {wk.done} of {wk.scheduled} this week
            </p>
          </div>
          <button
            type="button"
            aria-label={`${h.remind ? 'Turn off' : 'Turn on'} reminder for ${h.name}`}
            aria-pressed={h.remind}
            onClick={() => guarded(() => updateHabit(store, h.id, { remind: !h.remind }))}
            className={`h-11 w-11 shrink-0 rounded-xl border flex items-center justify-center ${
              h.remind ? 'border-[#B6FF3B] text-[#B6FF3B]' : 'border-slate-700 text-slate-500'
            }`}
          >
            {h.remind ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>
        </div>

        {editing === h.id ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="time"
              aria-label={`Reminder time for ${h.name}`}
              value={h.time}
              onChange={(e) => e.target.value && guarded(() => updateHabit(store, h.id, { time: e.target.value }))}
              className={inputCls}
            />
            <div className="flex gap-1" role="group" aria-label={`Days for ${h.name}`}>
              {DAY_LABELS.map((l, d) => (
                <button
                  key={d}
                  type="button"
                  aria-label={DAY_NAMES[d]}
                  aria-pressed={h.days.includes(d)}
                  onClick={() =>
                    guarded(() =>
                      updateHabit(store, h.id, {
                        days: h.days.includes(d) ? h.days.filter((x) => x !== d) : [...h.days, d],
                      })
                    )
                  }
                  className={`h-11 w-9 rounded-lg text-xs font-bold border ${
                    h.days.includes(d) ? 'bg-[#B6FF3B] border-[#B6FF3B] text-black' : 'border-slate-700 text-slate-400'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            {!h.builtin && (
              <button
                type="button"
                aria-label={`Delete ${h.name}`}
                onClick={() => {
                  guarded(() => removeHabit(store, h.id));
                  setEditing(null);
                }}
                className="h-11 w-11 rounded-xl border border-slate-700 text-slate-400 flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="h-11 px-3 text-xs font-semibold text-slate-300 underline"
            >
              Close
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(h.id)}
            className="text-[11px] font-semibold text-slate-400 underline min-h-[36px]"
          >
            Change time, days{h.builtin ? '' : ' or delete'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-[#14181D] border border-[#222933] shadow-xl space-y-4" data-testid="habit-reminders">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[#B6FF3B]">
          <Bell className="w-5 h-5" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Habits and reminders</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {doneToday} of {scheduledToday} today
        </span>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Tick a habit off each day. Turn the bell on to be reminded at the time you set. Missing a day never loses your
        progress. Habits stay on this device and are not synced.
      </p>

      <div className="p-3 rounded-2xl bg-[#0B0D10] border border-[#222933] space-y-2">
        <p className="text-xs text-slate-300">{notifyMessage(permission)}</p>
        {permission === 'default' && anyReminders && (
          <button
            type="button"
            onClick={enableNotifications}
            className="h-11 px-4 rounded-xl bg-[#B6FF3B] text-black text-xs font-bold uppercase tracking-wider"
          >
            Turn on notifications
          </button>
        )}
        {permission === 'default' && !anyReminders && (
          <p className="text-[11px] text-slate-500">Turn on a bell below first, then allow notifications here.</p>
        )}
      </div>

      <div className="space-y-2">{store.habits.map(row)}</div>

      {showForm ? (
        <div className="p-4 rounded-2xl bg-[#0B0D10] border border-[#222933] space-y-3">
          <label className="block text-xs font-semibold text-slate-300">
            Habit name
            <input
              type="text"
              value={name}
              maxLength={40}
              placeholder="e.g. 10 minutes of stretching"
              onChange={(e) => setName(e.target.value)}
              className={`${inputCls} w-full mt-1`}
            />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-xs font-semibold text-slate-300">
              Time
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${inputCls} block mt-1`} />
            </label>
            <div role="group" aria-label="Days" className="flex gap-1">
              {DAY_LABELS.map((l, d) => (
                <button
                  key={d}
                  type="button"
                  aria-label={DAY_NAMES[d]}
                  aria-pressed={days.includes(d)}
                  onClick={() => toggleDay(d)}
                  className={`h-11 w-9 rounded-lg text-xs font-bold border ${
                    days.includes(d) ? 'bg-[#B6FF3B] border-[#B6FF3B] text-black' : 'border-slate-700 text-slate-400'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 min-h-[44px]">
            <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} className="w-5 h-5" />
            Remind me at this time
          </label>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222933]">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setMessage('');
              }}
              className="h-11 px-4 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="h-11 px-5 rounded-xl bg-[#B6FF3B] text-black text-xs font-bold uppercase tracking-wider"
            >
              Add habit
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="h-11 px-4 rounded-xl border border-[#B6FF3B] text-[#B6FF3B] text-xs font-bold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add your own habit
        </button>
      )}

      {message && (
        <p role="alert" className="text-xs text-[#FF8C3B]">
          {message}
        </p>
      )}
    </div>
  );
};
