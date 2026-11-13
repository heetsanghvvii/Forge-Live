/**
 * Pure helpers for automatic sync: a hash of the SYNCABLE parts of the app state (to tell a real user edit from a
 * remote merge) and a rebase that applies a pulled merge onto the LATEST state so edits made during the network
 * wait are never lost. No window / firebase access.
 */
import type { AppState } from '../types';
import { hashDoc } from './syncBase';
import type { BaseEntry, BaseSection } from './syncBase';
import { PROFILE_FIELD_MAP } from './cloudMerge';

const SETTING_KEYS: string[] = PROFILE_FIELD_MAP.map(([, k]) => k as string);
/** Settings that a pull may also touch but are not user facts. */
const PULL_EXTRA_SETTING_KEYS = ['confirmedProgrammeStart', 'authorizedCoachUid', 'phase2StartDate', 'phase3StartDate'];

const pickSettings = (s: any, keys: string[]) => {
  const o: Record<string, unknown> = {};
  for (const k of keys) if (s?.[k] !== undefined) o[k] = s[k];
  return o;
};

/** Hash of dailyLogs, workoutLogs, weighIns, measurementHistory and the syncable settings. Photos, lastSyncTimestamp, linkedFirebaseUid etc. are excluded. */
export function syncableHash(state: Partial<AppState>): string {
  return hashDoc({
    d: state.dailyLogs ?? {},
    w: state.workoutLogs ?? {},
    wi: state.weighIns ?? [],
    m: state.measurementHistory ?? [],
    s: pickSettings(state.settings, SETTING_KEYS)
  });
}

const h = (v: unknown) => (v === undefined ? 'u' : hashDoc(v));

export interface RebaseResult {
  state: AppState;
  /** Sections where this device edited something the pull also changed: their base entries must NOT be committed. */
  contested: Set<BaseSection>;
}

function mergeKeyed<T>(snap: Record<string, T> | undefined, merged: Record<string, T> | undefined, latest: Record<string, T> | undefined, contested: { hit: boolean }): Record<string, T> {
  const out: Record<string, T> = {};
  const keys = new Set([...Object.keys(snap ?? {}), ...Object.keys(merged ?? {}), ...Object.keys(latest ?? {})]);
  for (const k of keys) {
    const s = snap?.[k], m = merged?.[k], l = latest?.[k];
    const lChanged = h(l) !== h(s);
    const mChanged = h(m) !== h(s);
    let v: T | undefined;
    if (!lChanged) v = m;
    else { v = l; if (mChanged && h(m) !== h(l)) contested.hit = true; }
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function mergeDated<T extends { date: string }>(snap: T[] | undefined, merged: T[] | undefined, latest: T[] | undefined, contested: { hit: boolean }): T[] {
  const idx = (a: T[] | undefined) => Object.fromEntries((a ?? []).filter(x => x?.date).map(x => [x.date, x]));
  const r = mergeKeyed<T>(idx(snap), idx(merged), idx(latest), contested);
  return Object.values(r).sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
}

/**
 * snapshot = state the pull decided against; merged = pull result; latest = state now.
 * Per item: untouched since the snapshot -> take the pulled value; edited meanwhile -> keep the edit.
 */
export function rebasePulled(snapshot: AppState, merged: AppState, latest: AppState): RebaseResult {
  const c = { daily: { hit: false }, workouts: { hit: false }, weigh: { hit: false }, meas: { hit: false }, profile: { hit: false } };
  const dailyLogs = mergeKeyed(snapshot.dailyLogs as any, merged.dailyLogs as any, latest.dailyLogs as any, c.daily) as any;
  const workoutLogs = mergeKeyed(snapshot.workoutLogs as any, merged.workoutLogs as any, latest.workoutLogs as any, c.workouts) as any;
  const weighIns = mergeDated(snapshot.weighIns, merged.weighIns, latest.weighIns, c.weigh);
  const measurementHistory = mergeDated(snapshot.measurementHistory, merged.measurementHistory, latest.measurementHistory, c.meas);
  const settings: any = { ...latest.settings };
  const sMap = mergeKeyed(
    pickSettings(snapshot.settings, [...SETTING_KEYS, ...PULL_EXTRA_SETTING_KEYS]) as any,
    pickSettings(merged.settings, [...SETTING_KEYS, ...PULL_EXTRA_SETTING_KEYS]) as any,
    pickSettings(latest.settings, [...SETTING_KEYS, ...PULL_EXTRA_SETTING_KEYS]) as any,
    c.profile
  );
  for (const k of [...SETTING_KEYS, ...PULL_EXTRA_SETTING_KEYS]) {
    if (k in sMap) settings[k] = (sMap as any)[k];
    else delete settings[k];
  }
  // linkedFirebaseUid comes from the pull when the device had none; never drop an existing one.
  if (settings.linkedFirebaseUid === undefined && merged.settings?.linkedFirebaseUid) settings.linkedFirebaseUid = merged.settings.linkedFirebaseUid;
  const contested = new Set<BaseSection>();
  if (c.daily.hit) contested.add('daily');
  if (c.workouts.hit) contested.add('workouts');
  if (c.weigh.hit) contested.add('weighIns');
  if (c.meas.hit) contested.add('measurements');
  if (c.profile.hit) contested.add('profile');
  return { state: { ...latest, settings, dailyLogs, workoutLogs, weighIns, measurementHistory }, contested };
}

/** Drops base entries for sections where a local edit raced the pull (safe: the next save/pull then reports a conflict instead of overwriting). */
export function safeBaseEntries(entries: BaseEntry[] | undefined, contested: Set<BaseSection>): BaseEntry[] {
  return (entries ?? []).filter(e => !contested.has(e.section));
}
