import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyViewerParam } from './viewerUrl';
import { isViewerMode } from './viewerMode';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; };

test('?viewer=1 turns Viewer on and it persists across reloads (no param) until switched off', () => {
  const st = mem();
  assert.equal(applyViewerParam('', st), false);
  assert.equal(applyViewerParam('?viewer=1', st), true);
  assert.equal(applyViewerParam('', st), true);
  assert.equal(applyViewerParam('?other=1', st), true);
  assert.equal(applyViewerParam('?viewer=0', st), false);
  assert.equal(isViewerMode(st), false);
});
