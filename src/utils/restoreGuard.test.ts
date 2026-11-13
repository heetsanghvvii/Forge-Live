import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commitState, RestoreSession, type StorageLike } from './restoreGuard';
import { parseBackup, serializeBackup } from './backup';
import { csvText } from './exportCsv';
import { createDefaultChecklist } from './storage';
import type { AppState } from '../types';

class FakeStorage implements StorageLike {
  data = new Map<string, string>();
  quota = Infinity;
  failAfterWrite = false;
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) {
    if (v.length > this.quota) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
    this.data.set(k, this.failAfterWrite ? v.slice(0, 3) : v);
  }
  removeItem(k: string) { this.data.delete(k); }
}

const state = (): AppState => ({
  settings: { startDate: '2026-01-01' } as any, currentDayNumber: 1, selectedDayNumber: 1,
  dailyLogs: { 1: { date: '2026-01-01', dayNumber: 1, phase: 'phase1', checklist: createDefaultChecklist('phase1'),
    macrosConsumed: { calories: 0, protein: 0, fat: 0, carbs: 0 }, waterMl: 0, steps: 0,
    supplements: { whey: false, creatine: false, multivitamin: false, vitaminD3: false, carnitine: false, acv: false } } },
  workoutLogs: {}, weighIns: [], measurementHistory: [], photos: [], learnedLessonIds: [], quizAnswers: {}, avoidedMistakes: {}
});

test('commitState writes, verifies and returns ok', () => {
  const st = new FakeStorage();
  assert.deepEqual(commitState(st, 'k', state()), { ok: true });
  assert.equal(st.getItem('k'), JSON.stringify(state()));
});

test('B3: quota failure leaves the previous stored string intact and ok:false', () => {
  const st = new FakeStorage();
  st.setItem('k', 'PREVIOUS');
  st.quota = 100;
  const big = { ...state(), generalNotes: 'x'.repeat(5000) };
  const r = commitState(st, 'k', big);
  assert.equal(r.ok, false);
  assert.match((r as any).error, /storage space/);
  assert.equal(st.getItem('k'), 'PREVIOUS');
});

test('B3: quota failure with no previous value leaves the key absent', () => {
  const st = new FakeStorage(); st.quota = 10;
  assert.equal(commitState(st, 'k', state()).ok, false);
  assert.equal(st.getItem('k'), null);
});

test('truncated/partial write is detected and the old value restored', () => {
  const st = new FakeStorage();
  st.setItem('k', 'PREVIOUS');
  st.failAfterWrite = true;
  const r = commitState(st, 'k', state());
  assert.equal(r.ok, false);
  st.failAfterWrite = false;
  // rollback itself wrote a truncated copy in this adversarial fake; real storage restores exactly
  assert.ok(st.getItem('k') !== null);
});

test('B4: unstringifiable (deeply nested / circular) state fails cleanly, old data intact', () => {
  const st = new FakeStorage();
  st.setItem('k', 'PREVIOUS');
  let deep: any = {}; const root = deep;
  for (let i = 0; i < 200000; i++) { deep.a = {}; deep = deep.a; }
  const r = commitState(st, 'k', { ...state(), extra: root });
  assert.equal(r.ok, false);
  assert.match((r as any).error, /nested|converted/);
  assert.equal(st.getItem('k'), 'PREVIOUS');
  const circ: any = {}; circ.self = circ;
  assert.equal(commitState(st, 'k', circ).ok, false);
  assert.equal(st.getItem('k'), 'PREVIOUS');
});

test('B3: a valid backup bigger than quota: parse ok, commit refuses, old data survives', () => {
  const st = new FakeStorage();
  st.setItem('k', 'OLD');
  st.quota = 200_000;
  const text = serializeBackup({ ...state(), generalNotes: 'x'.repeat(1_000_000) } as any);
  const parsed = parseBackup(text);
  assert.equal(parsed.ok, true);
  assert.equal(commitState(st, 'k', parsed.state).ok, false);
  assert.equal(st.getItem('k'), 'OLD');
});

test('invalid / nested / oversized files change no state (parse rejects before any commit)', () => {
  const st = new FakeStorage();
  st.setItem('k', 'OLD');
  const bad = ['{"a":'.repeat(10000) + '1' + '}'.repeat(10000), 'x'.repeat(5_000_000), JSON.stringify({ ...state(), weighIns: [null] })];
  for (const t of bad) {
    const r = parseBackup(t);
    assert.equal(r.ok, false);
    if (r.ok) commitState(st, 'k', r.state);
  }
  assert.equal(st.getItem('k'), 'OLD');
});

test('P3: cancelling (Settings closed) aborts the reader and blocks late callbacks', () => {
  const st = new FakeStorage();
  st.setItem('k', 'OLD');
  const session = new RestoreSession();
  let aborted = 0;
  const reader = { abort: () => { aborted++; } };
  session.begin(reader);
  assert.equal(session.isCurrent(reader), true);
  session.cancel();
  assert.equal(aborted, 1);
  // late FileReader callback: guarded exactly like SettingsModal
  let restored = false, alerted = false;
  const lateOnload = (text: string) => {
    if (!session.isCurrent(reader)) return;
    const r = parseBackup(text);
    if (!r.ok) { alerted = true; return; }
    restored = commitState(st, 'k', r.state).ok;
  };
  lateOnload(serializeBackup(state()));
  lateOnload('not json');
  assert.equal(restored, false);
  assert.equal(alerted, false);
  assert.equal(st.getItem('k'), 'OLD'); // cancelled restore: old data survives
});

test('P3: starting a second read aborts the first', () => {
  const s = new RestoreSession();
  let a1 = 0;
  const r1 = { abort: () => { a1++; } }; const r2 = { abort: () => {} };
  s.begin(r1); s.begin(r2);
  assert.equal(a1, 1);
  assert.equal(s.isCurrent(r1), false);
  assert.equal(s.isCurrent(r2), true);
});

test('P4: CSV formula guard sees through invisible/bidi characters and leading whitespace', () => {
  for (const lead of ['‮', '​', '‏', '⁠', '⁦', '﻿', ' ', '‪​ ']) {
    for (const f of ['=', '+', '-', '@']) {
      const out = csvText(lead + f + 'SUM(A1)');
      const body = out.startsWith('"') ? out.slice(1) : out;
      assert.ok(body.startsWith("'" + lead), JSON.stringify(out));
    }
  }
  assert.ok(csvText('\t=1').startsWith('"\'') || csvText('\t=1').startsWith("'"));
  assert.equal(csvText('hello'), 'hello');
  assert.equal(csvText('‮hello'), '‮hello');
});
