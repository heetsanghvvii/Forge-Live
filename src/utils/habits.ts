/**
 * Habit reminders: built-in habits for the programme plus custom ones, each with a time and
 * days of the week, tracked as done or not done per day.
 *
 * Product rules enforced here:
 * - Missing a day is never punished. A streak counts consecutive scheduled days that were done;
 *   today not yet done does not break it, and an unscheduled day is skipped.
 * - Reminder wording is neutral. Forge never gives medical advice in a reminder.
 * - Habits live in their own localStorage key on this device. They are not part of AppState and
 *   are not synced to the cloud.
 */

export const HABITS_STORAGE_KEY = 'forge_habits_v1';
export const NOTIFIED_STORAGE_KEY = 'forge_habits_notified_v1';
export const MAX_HABITS = 20;
export const MAX_NAME_LEN = 40;

export interface Habit {
  id: string;
  name: string;
  /** Local time of day, 'HH:MM' (24 hour). */
  time: string;
  /** Days of the week the habit applies to. 0 = Sunday ... 6 = Saturday. */
  days: number[];
  /** Whether to remind at `time`. A habit can be tracked without reminders. */
  remind: boolean;
  builtin: boolean;
  createdAt: string;
}

export interface HabitStore {
  habits: Habit[];
  /** date (YYYY-MM-DD) -> habit ids marked done that day. */
  done: Record<string, string[]>;
}

export interface LocalNow {
  date: string; // YYYY-MM-DD, local
  minutes: number; // minutes since local midnight
  weekday: number; // 0 = Sunday
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const BUILTIN: Array<Pick<Habit, 'id' | 'name' | 'time'>> = [
  { id: 'b_water', name: 'Drink water', time: '10:00' },
  { id: 'b_protein', name: 'Hit your protein target', time: '19:00' },
  { id: 'b_steps', name: 'Walk your daily steps', time: '17:30' },
  { id: 'b_workout', name: 'Do today’s workout', time: '18:00' },
  { id: 'b_sleep', name: 'Start your wind-down', time: '22:00' },
  { id: 'b_weighin', name: 'Weigh-in day check', time: '07:00' },
];

/** Built-in habits start tracked but with reminders off. The user turns reminders on. */
export function defaultHabits(nowIso: string): Habit[] {
  return BUILTIN.map((b) => ({
    ...b,
    days: b.id === 'b_weighin' ? [1] : [...ALL_DAYS],
    remind: false,
    builtin: true,
    createdAt: nowIso,
  }));
}

export function emptyStore(nowIso: string): HabitStore {
  return { habits: defaultHabits(nowIso), done: {} };
}

export function toLocalNow(d: Date): LocalNow {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { date: `${y}-${m}-${day}`, minutes: d.getHours() * 60 + d.getMinutes(), weekday: d.getDay() };
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export interface HabitInput {
  name: string;
  time: string;
  days: number[];
  remind: boolean;
}

/** Problems with a habit input; empty means it can be saved. `others` are the other habits. */
export function validateHabitInput(input: HabitInput, others: Habit[]): string[] {
  const errors: string[] = [];
  const name = input.name.trim();
  if (!name) errors.push('Enter a name for the habit.');
  if (name.length > MAX_NAME_LEN) errors.push(`Keep the name to ${MAX_NAME_LEN} characters.`);
  if (name && others.some((h) => h.name.trim().toLowerCase() === name.toLowerCase())) {
    errors.push('You already have a habit with that name.');
  }
  if (!TIME_RE.test(input.time)) errors.push('Enter a time of day.');
  if (input.days.length === 0) errors.push('Choose at least one day.');
  if (input.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) errors.push('A day is not valid.');
  return errors;
}

export function addHabit(store: HabitStore, input: HabitInput, opts: { id: string; now: string }): HabitStore {
  if (store.habits.length >= MAX_HABITS) throw new Error(`You can keep up to ${MAX_HABITS} habits.`);
  const errors = validateHabitInput(input, store.habits);
  if (errors.length > 0) throw new Error(errors[0]);
  const habit: Habit = {
    id: opts.id,
    name: input.name.trim(),
    time: input.time,
    days: [...new Set(input.days)].sort((a, b) => a - b),
    remind: input.remind,
    builtin: false,
    createdAt: opts.now,
  };
  return { ...store, habits: [...store.habits, habit] };
}

export function updateHabit(
  store: HabitStore,
  id: string,
  patch: Partial<Pick<Habit, 'name' | 'time' | 'days' | 'remind'>>
): HabitStore {
  const current = store.habits.find((h) => h.id === id);
  if (!current) throw new Error('Habit not found.');
  const merged: HabitInput = {
    name: patch.name ?? current.name,
    time: patch.time ?? current.time,
    days: patch.days ?? current.days,
    remind: patch.remind ?? current.remind,
  };
  const errors = validateHabitInput(merged, store.habits.filter((h) => h.id !== id));
  if (errors.length > 0) throw new Error(errors[0]);
  return {
    ...store,
    habits: store.habits.map((h) =>
      h.id === id
        ? { ...h, name: merged.name.trim(), time: merged.time, days: [...new Set(merged.days)].sort((a, b) => a - b), remind: merged.remind }
        : h
    ),
  };
}

/** Removes a habit and its history. Built-in habits cannot be removed, only switched off. */
export function removeHabit(store: HabitStore, id: string): HabitStore {
  const h = store.habits.find((x) => x.id === id);
  if (!h) return store;
  if (h.builtin) throw new Error('Built-in habits cannot be removed. Turn the reminder off instead.');
  const done: Record<string, string[]> = {};
  for (const [date, ids] of Object.entries(store.done)) {
    const kept = ids.filter((x) => x !== id);
    if (kept.length > 0) done[date] = kept;
  }
  return { habits: store.habits.filter((x) => x.id !== id), done };
}

export function isDoneOn(store: HabitStore, id: string, date: string): boolean {
  return (store.done[date] ?? []).includes(id);
}

/** Marks a habit done or not done for a date. Future dates are refused. */
export function setDone(store: HabitStore, id: string, date: string, done: boolean, today: string): HabitStore {
  if (!DATE_RE.test(date)) throw new Error('Not a valid date.');
  if (date > today) throw new Error('You cannot mark a future day.');
  if (!store.habits.some((h) => h.id === id)) throw new Error('Habit not found.');
  const current = store.done[date] ?? [];
  const next = done ? [...new Set([...current, id])] : current.filter((x) => x !== id);
  const doneMap = { ...store.done };
  if (next.length > 0) doneMap[date] = next;
  else delete doneMap[date];
  return { ...store, done: doneMap };
}

function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(date: string, delta: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  return parseDate(date).getUTCDay();
}

export function isScheduledOn(habit: Habit, date: string): boolean {
  return habit.days.includes(weekdayOf(date));
}

/**
 * Consecutive scheduled days done, ending today. Today not done yet does not break the streak.
 * Days the habit is not scheduled are skipped. Looks back at most 400 days.
 */
export function streakFor(store: HabitStore, habit: Habit, today: string): number {
  let streak = 0;
  let date = today;
  for (let i = 0; i < 400; i++) {
    if (isScheduledOn(habit, date)) {
      if (isDoneOn(store, habit.id, date)) streak++;
      else if (date !== today) break;
    }
    date = addDays(date, -1);
  }
  return streak;
}

/** Done count over the last 7 days (including today) against the scheduled days in that window. */
export function weekProgress(store: HabitStore, habit: Habit, today: string): { done: number; scheduled: number } {
  let done = 0;
  let scheduled = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, -i);
    if (!isScheduledOn(habit, date)) continue;
    scheduled++;
    if (isDoneOn(store, habit.id, date)) done++;
  }
  return { done, scheduled };
}

export interface Notified {
  /** date -> habit ids already reminded that day. */
  [date: string]: string[];
}

/** Habits to remind about right now: reminder on, scheduled today, time reached, not done, not already reminded. */
export function dueNow(store: HabitStore, now: LocalNow, notified: Notified): Habit[] {
  return store.habits.filter(
    (h) =>
      h.remind &&
      h.days.includes(now.weekday) &&
      timeToMinutes(h.time) <= now.minutes &&
      !isDoneOn(store, h.id, now.date) &&
      !(notified[now.date] ?? []).includes(h.id)
  );
}

/** Records reminders as sent and drops entries older than today so storage stays small. */
export function markNotified(notified: Notified, ids: string[], date: string): Notified {
  const todays = [...new Set([...(notified[date] ?? []), ...ids])];
  return { [date]: todays };
}

/** Neutral reminder wording. No advice, no guilt. */
export function reminderText(habit: Habit): { title: string; body: string } {
  return { title: 'Forge reminder', body: `${habit.name}. Tap to open Forge and tick it off.` };
}

function isHabit(x: unknown): x is Habit {
  if (!x || typeof x !== 'object') return false;
  const h = x as Record<string, unknown>;
  return (
    typeof h.id === 'string' &&
    typeof h.name === 'string' &&
    typeof h.time === 'string' &&
    TIME_RE.test(h.time) &&
    Array.isArray(h.days) &&
    h.days.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6) &&
    typeof h.remind === 'boolean' &&
    typeof h.builtin === 'boolean' &&
    typeof h.createdAt === 'string'
  );
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Reads the store. Anything malformed is dropped, never thrown; built-ins are restored if missing. */
export function loadStore(storage: StorageLike, nowIso: string): HabitStore {
  const base = emptyStore(nowIso);
  try {
    const raw = storage.getItem(HABITS_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<HabitStore> | null;
    if (!parsed || typeof parsed !== 'object') return base;
    const habits = Array.isArray(parsed.habits) ? parsed.habits.filter(isHabit) : [];
    const ids = new Set(habits.map((h) => h.id));
    const restored = base.habits.filter((b) => !ids.has(b.id));
    const done: Record<string, string[]> = {};
    if (parsed.done && typeof parsed.done === 'object') {
      for (const [date, list] of Object.entries(parsed.done)) {
        if (DATE_RE.test(date) && Array.isArray(list)) {
          const clean = list.filter((x): x is string => typeof x === 'string');
          if (clean.length > 0) done[date] = clean;
        }
      }
    }
    return { habits: [...habits, ...restored], done };
  } catch {
    return base;
  }
}

/** Returns false when the device refused the write. */
export function saveStore(storage: StorageLike, store: HabitStore): boolean {
  try {
    storage.setItem(HABITS_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function loadNotified(storage: StorageLike): Notified {
  try {
    const raw = storage.getItem(NOTIFIED_STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === 'object' && !Array.isArray(p) ? (p as Notified) : {};
  } catch {
    return {};
  }
}

export function saveNotified(storage: StorageLike, n: Notified): void {
  try {
    storage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify(n));
  } catch {
    /* ignore */
  }
}
