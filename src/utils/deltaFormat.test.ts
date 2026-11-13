import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtDelta, deltaDirection } from './deltaFormat';

test('U1: fmtDelta never prints null/NaN', () => {
  assert.equal(fmtDelta(null), '-');
  assert.equal(fmtDelta(undefined), '-');
  assert.equal(fmtDelta(NaN), '-');
  assert.equal(fmtDelta(1.5), '+1.5');
  assert.equal(fmtDelta(-2), '-2');
  assert.equal(fmtDelta(0), '0');
});

test('U1: no arrow when the change is exactly 0', () => {
  assert.equal(deltaDirection(0), 'none');
  assert.equal(deltaDirection(null), 'none');
  assert.equal(deltaDirection(-1), 'down');
  assert.equal(deltaDirection(2), 'up');
});
