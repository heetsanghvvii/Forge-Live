import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLink } from './accountLink';

const blank: any = { settings: {}, dailyLogs: {}, workoutLogs: {}, weighIns: [], measurementHistory: [] };
const withData: any = { ...blank, weighIns: [{ date: '2026-01-01', dayNumber: 1, weight: 80 }] };

test('signed out', () => assert.equal(evaluateLink(blank, null).kind, 'signed-out'));
test('empty device, no link', () => assert.equal(evaluateLink(blank, 'u1').kind, 'empty-device'));
test('local data never linked needs confirmation', () => assert.equal(evaluateLink(withData, 'u1').kind, 'first-link'));
test('same account is linked', () => {
  const s = { ...withData, settings: { linkedFirebaseUid: 'u1' } };
  assert.equal(evaluateLink(s, 'u1').kind, 'linked');
});
test('different account is a mismatch even if local is blank', () => {
  const s = { ...blank, settings: { linkedFirebaseUid: 'u1' } };
  const r = evaluateLink(s, 'u2');
  assert.equal(r.kind, 'mismatch');
});
