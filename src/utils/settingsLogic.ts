import type { Macros } from '../types';

/** Which macro metrics actually changed between previous and new values. */
export function changedMacroMetrics(prev: Macros | undefined, next: Macros): { calories: boolean; protein: boolean } {
  return {
    calories: (prev?.calories ?? undefined) !== next.calories,
    protein: (prev?.protein ?? undefined) !== next.protein
  };
}

/** Meal-estimate form: only fields the user typed in count as entered. A typed 0 still counts. */
export function mealEnteredMetrics(touched: { calories: boolean; protein: boolean }): ('calories' | 'protein')[] {
  const out: ('calories' | 'protein')[] = [];
  if (touched.calories) out.push('calories');
  if (touched.protein) out.push('protein');
  return out;
}

/** Programme start is confirmed only if already confirmed, or the user changed the date. */
export function nextConfirmedProgrammeStart(existing: boolean | undefined, dateChanged: boolean, startDate: string): boolean | undefined {
  if (dateChanged && startDate) return true;
  return existing;
}

export interface PullResultLike {
  added?: number;
  conflicts?: number;
  conflictList?: string[];
}

/** Message shown after Load from cloud. Never says "nothing new" when conflicts exist. */
export function loadFromCloudMessage(res: PullResultLike): { text: string; isError?: boolean } {
  const conflicts = res.conflicts ?? 0;
  const parts: string[] = [];
  if (res.added) parts.push(`Loaded ${res.added} record(s) from the cloud. Your existing local entries were kept.`);
  if (conflicts > 0) {
    const list = (res.conflictList ?? []).slice(0, 5);
    const more = conflicts > list.length ? ` (+${conflicts - list.length} more)` : '';
    parts.push(
      `${conflicts} value(s) differ between this device and the cloud; your local values were kept; nothing was overwritten.` +
        (list.length ? ` Differences: ${list.join('; ')}${more}.` : '')
    );
  }
  if (parts.length === 0) parts.push('Cloud has nothing new. Your local data is unchanged.');
  return { text: parts.join(' ') };
}

export const COACH_CONSENT_TEXT =
  'The coach you authorize can read (read-only): your summary, your daily logs (including notes), and your workout logs. They cannot change anything.';
