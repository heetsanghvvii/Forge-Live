/**
 * Content-hash BASE VERSION for three-way cloud sync (optimistic concurrency).
 *
 * For every cloud document this device keeps the hash of the version it last synced (saved or loaded).
 * Comparing three things (local, cloud, base) tells us who changed what, with no clocks involved.
 * Only hashes are stored here, never health values. Pure apart from the small get/set/clear storage helpers.
 */

export type BaseSection = 'daily' | 'workouts' | 'weighIns' | 'measurements' | 'profile';

export interface SyncBase {
  daily: Record<string, string>;
  workouts: Record<string, string>;
  weighIns: Record<string, string>;
  measurements: Record<string, string>;
  /** Scalar profile fields (bodyweightKg, programmeStartDate, ...) keyed by cloud field name. */
  profile: Record<string, string>;
}

/** One base change. hash === null removes the entry. */
export interface BaseEntry {
  section: BaseSection;
  id: string;
  hash: string | null;
}

export const SECTIONS: BaseSection[] = ['daily', 'workouts', 'weighIns', 'measurements', 'profile'];

export const emptyBase = (): SyncBase => ({ daily: {}, workouts: {}, weighIns: {}, measurements: {}, profile: {} });

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/**
 * Canonical JSON: object keys sorted, undefined dropped (array holes become null).
 * The TOP-LEVEL `updatedAt` is ignored so rewriting a doc without changing content keeps its hash.
 */
export function canonicalJson(value: unknown, top = true): string {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return '[' + value.map((x) => canonicalJson(x, false)).join(',') + ']';
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return (
      '{' +
      Object.keys(o)
        .filter((k) => o[k] !== undefined && !(top && k === 'updatedAt'))
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonicalJson(o[k], false))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value) ?? 'null';
}

/** cyrb53: small, fast, deterministic 53-bit string hash (not cryptographic). */
export function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(16).padStart(14, '0');
}

/** Stable hash of any JSON-like value (see canonicalJson). */
export function hashDoc(value: unknown): string {
  const s = canonicalJson(value);
  return s.length.toString(36) + '-' + cyrb53(s);
}

// ---------------------------------------------------------------------------
// Pure base arithmetic
// ---------------------------------------------------------------------------

const asRecord = (v: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, h] of Object.entries(v as Record<string, unknown>)) if (typeof h === 'string') out[k] = h;
  }
  return out;
};

/** Validates parsed JSON into a SyncBase (anything unexpected is dropped). */
export function coerceBase(raw: unknown): SyncBase {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    daily: asRecord(r.daily),
    workouts: asRecord(r.workouts),
    weighIns: asRecord(r.weighIns),
    measurements: asRecord(r.measurements),
    profile: asRecord(r.profile)
  };
}

/** Returns a NEW base with the entries applied (does not mutate). */
export function applyBaseEntries(base: SyncBase, entries: BaseEntry[]): SyncBase {
  const next: SyncBase = {
    daily: { ...base.daily },
    workouts: { ...base.workouts },
    weighIns: { ...base.weighIns },
    measurements: { ...base.measurements },
    profile: { ...base.profile }
  };
  for (const e of entries) {
    if (e.hash === null) delete next[e.section][e.id];
    else next[e.section][e.id] = e.hash;
  }
  return next;
}

// ---------------------------------------------------------------------------
// Persistence: localStorage per Firebase uid, with an in-memory fallback
// ---------------------------------------------------------------------------

export const syncBaseKey = (uid: string) => `bb_sync_base_v1_${uid}`;

const memory = new Map<string, SyncBase>();

function storage(): Storage | undefined {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined;
  } catch {
    return undefined;
  }
}

export function getSyncBase(uid: string): SyncBase {
  try {
    const raw = storage()?.getItem(syncBaseKey(uid));
    if (raw) return coerceBase(JSON.parse(raw));
  } catch {
    // fall through to memory
  }
  const m = memory.get(uid);
  return m ? coerceBase(m) : emptyBase();
}

export function setSyncBase(uid: string, base: SyncBase): void {
  const clean = coerceBase(base);
  memory.set(uid, clean);
  try {
    storage()?.setItem(syncBaseKey(uid), JSON.stringify(clean));
  } catch {
    // Private mode / quota: the in-memory copy still serves this session.
  }
}

export function clearSyncBase(uid: string): void {
  memory.delete(uid);
  try {
    storage()?.removeItem(syncBaseKey(uid));
  } catch {
    // ignore
  }
}

/** Reads the stored base, applies the entries, stores it. No-op for an empty list. */
export function commitBaseEntries(uid: string, entries: BaseEntry[]): void {
  if (!entries.length) return;
  setSyncBase(uid, applyBaseEntries(getSyncBase(uid), entries));
}
