import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveHeaderIdentity, profileTarget } from './headerIdentity';

test('signed out -> null (Login)', () => assert.equal(deriveHeaderIdentity(null, null), null));
test('firebase user -> identity with email', () => {
  const r = deriveHeaderIdentity(null, { email: 'a@b.com', displayName: 'Ann' });
  assert.equal(r?.username, 'a@b.com');
  assert.equal(r?.displayName, 'Ann');
});
test('firebase user without email/name -> fallback label', () =>
  assert.equal(deriveHeaderIdentity(null, {})?.username, 'Account'));
test('legacy account wins over firebase', () => {
  const legacy = { username: 'bob', avatarEmoji: '🔥' };
  assert.equal(deriveHeaderIdentity(legacy, { email: 'x@y.z' }), legacy);
});
test('profileTarget', () => {
  assert.equal(profileTarget(null), 'syncSettings');
  assert.equal(profileTarget({}), 'profile');
});
