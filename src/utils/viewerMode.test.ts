import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isViewerMode, setViewerMode, guardEdit, VIEWER_MODE_NOTICE, VIEWER_MODE_KEY } from './viewerMode';

const mem = () => { const m = new Map<string, string>(); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };

test('defaults to off and persists the flag', () => {
  const s = mem();
  assert.equal(isViewerMode(s), false);
  setViewerMode(s, true);
  assert.equal(s.m.get(VIEWER_MODE_KEY), '1');
  assert.equal(isViewerMode(s), true);
  setViewerMode(s, false);
  assert.equal(isViewerMode(s), false);
});

test('works in memory when storage throws', () => {
  setViewerMode(throwing, true);
  assert.equal(isViewerMode(throwing), true);
  setViewerMode(throwing, false);
  assert.equal(isViewerMode(throwing), false);
  setViewerMode(null, true);
  assert.equal(isViewerMode(null), true);
  setViewerMode(null, false);
});

test('guardEdit blocks and skips fn in viewer mode, runs fn otherwise', () => {
  const s = mem(); let ran = 0;
  assert.deepEqual(guardEdit(s, () => { ran++; }), { allowed: true });
  setViewerMode(s, true);
  assert.deepEqual(guardEdit(s, () => { ran++; }), { allowed: false });
  assert.equal(ran, 1);
  setViewerMode(s, false);
});

test('notice says plainly it does not restrict real permissions', () => {
  assert.equal(VIEWER_MODE_NOTICE, 'Viewer mode stops accidental edits in this browser only. It does not limit what anyone signed in to this account can do on any device.');
});
