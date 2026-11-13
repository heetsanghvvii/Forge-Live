export type SleepParse = { ok: true; value: number } | { ok: false; error: string };

export const SLEEP_ERROR = 'Enter hours between 0 and 24, e.g. 7.5';

/** Parse a sleep-hours text box. Accepts "7.5" and "7,5". Range 0-24 inclusive. */
export function parseSleepInput(text: string): SleepParse {
  const t = (text ?? '').trim();
  if (t === '') return { ok: false, error: 'Enter your sleep hours' };
  if (!/^\d+([.,]\d+)?$/.test(t)) return { ok: false, error: SLEEP_ERROR };
  const value = Number(t.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0 || value > 24) return { ok: false, error: SLEEP_ERROR };
  return { ok: true, value };
}
