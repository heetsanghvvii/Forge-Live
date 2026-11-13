import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalJson, hashDoc, emptyBase, applyBaseEntries, coerceBase,
  getSyncBase, setSyncBase, clearSyncBase, commitBaseEntries, syncBaseKey
} from './syncBase';

test('hash: key order, undefined and top-level updatedAt do not matter', () => {
  const a = { b: 1, a: { y: [1, 2, { q: 1, p: 2 }], x: 'k' }, u: undefined, updatedAt: '2026-01-01' };
  const b = { a: { x: 'k', y: [1, 2, { p: 2, q: 1 }] }, b: 1, updatedAt: '2030-05-05' };
  assert.equal(canonicalJson(a), canonicalJson(b));
  assert.equal(hashDoc(a), hashDoc(b));
});

test('hash: any real content change changes it (values, array order, nested updatedAt kept)', () => {
  const base = { steps: 100, checklist: { workout: true, cardio: false }, list: ['a', 'b'] };
  const h = hashDoc(base);
  assert.notEqual(h, hashDoc({ ...base, steps: 101 }));
  assert.notEqual(h, hashDoc({ ...base, checklist: { workout: false, cardio: false } }));
  assert.notEqual(h, hashDoc({ ...base, list: ['b', 'a'] }));
  assert.notEqual(h, hashDoc({ ...base, extra: 0 }));
  assert.notEqual(hashDoc({ n: { updatedAt: 'a' } }), hashDoc({ n: { updatedAt: 'b' } }));
  assert.notEqual(hashDoc('1'), hashDoc(1));
});

test('hash: deterministic known value (stable across runs and platforms)', () => {
  assert.equal(hashDoc({ a: 1 }), hashDoc({ a: 1 }));
  assert.match(hashDoc({ a: 1 }), /^[0-9a-z]+-[0-9a-f]{14}$/);
});

test('applyBaseEntries returns a new base, sets and removes', () => {
  const b0 = emptyBase();
  const b1 = applyBaseEntries(b0, [{ section: 'daily', id: 'd1', hash: 'h1' }, { section: 'profile', id: 'bodyweightKg', hash: 'p' }]);
  assert.deepEqual(b0.daily, {});
  assert.equal(b1.daily.d1, 'h1');
  assert.equal(applyBaseEntries(b1, [{ section: 'daily', id: 'd1', hash: null }]).daily.d1, undefined);
});

test('coerceBase drops junk', () => {
  const b = coerceBase({ daily: { a: 'x', b: 5 }, workouts: 'nope', extra: 1 });
  assert.deepEqual(b.daily, { a: 'x' });
  assert.deepEqual(b.workouts, {});
});

test('storage: in-memory fallback when localStorage is missing, per-uid isolation, clear', () => {
  clearSyncBase('u1'); clearSyncBase('u2');
  assert.deepEqual(getSyncBase('u1'), emptyBase());
  commitBaseEntries('u1', [{ section: 'daily', id: 'd', hash: 'H' }]);
  assert.equal(getSyncBase('u1').daily.d, 'H');
  assert.equal(getSyncBase('u2').daily.d, undefined);
  clearSyncBase('u1');
  assert.equal(getSyncBase('u1').daily.d, undefined);
});

test('storage: uses localStorage key bb_sync_base_v1_<uid>; throwing storage falls back to memory', () => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
  try {
    setSyncBase('uX', applyBaseEntries(emptyBase(), [{ section: 'weighIns', id: '2026-01-01', hash: 'W' }]));
    assert.ok(store.has('bb_sync_base_v1_uX'));
    assert.equal(syncBaseKey('uX'), 'bb_sync_base_v1_uX');
    // only hashes are persisted
    assert.equal(store.get('bb_sync_base_v1_uX')!.includes('weight'), false);
    assert.equal(getSyncBase('uX').weighIns['2026-01-01'], 'W');
    // corrupt JSON -> memory copy
    store.set('bb_sync_base_v1_uX', '{not json');
    assert.equal(getSyncBase('uX').weighIns['2026-01-01'], 'W');
    // storage that throws on every call
    (globalThis as any).localStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
    commitBaseEntries('uY', [{ section: 'daily', id: 'z', hash: 'Z' }]);
    assert.equal(getSyncBase('uY').daily.z, 'Z');
    clearSyncBase('uY');
    assert.equal(getSyncBase('uY').daily.z, undefined);
  } finally {
    delete (globalThis as any).localStorage;
  }
});
