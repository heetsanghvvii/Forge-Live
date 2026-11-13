import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLabel, mergePeople, PERSON_LABEL_LIMITS } from './peopleDirectory';

test('validateLabel requires a non-empty label within limits', () => {
  assert.ok(validateLabel(''));
  assert.ok(validateLabel('   '));
  assert.strictEqual(validateLabel('Rohan'), null);
  assert.strictEqual(validateLabel('x'.repeat(PERSON_LABEL_LIMITS.labelMax)), null);
  assert.ok(validateLabel('x'.repeat(PERSON_LABEL_LIMITS.labelMax + 1)));
  assert.ok(validateLabel('ok', 'n'.repeat(PERSON_LABEL_LIMITS.noteMax + 1)));
  assert.strictEqual(validateLabel('ok', 'n'.repeat(10)), null);
});

test('mergePeople pairs grants with labels, newest first, and reports orphan labels', () => {
  const grants = [
    { coachUid: 'a', ownerUid: 'o', status: 'authorized', grantedAt: '2026-10-20T00:00:00Z' },
    { coachUid: 'b', ownerUid: 'o', status: 'authorized', grantedAt: '2026-10-24T00:00:00Z' },
    { coachUid: 'c', ownerUid: 'o', status: 'revoked', grantedAt: '2026-10-01T00:00:00Z', revokedAt: '2026-10-22T00:00:00Z' }
  ] as const;
  const labels = [
    { coachUid: 'a', label: 'Rohan', updatedAt: '2026-10-25T00:00:00Z' },
    { coachUid: 'ghost', label: 'Old entry', updatedAt: '2026-10-01T00:00:00Z' }
  ];
  const { people, orphanLabels } = mergePeople([...grants], labels);
  assert.strictEqual(people.length, 2); // revoked excluded
  assert.strictEqual(people[0].grant.coachUid, 'b'); // newest grant first
  assert.strictEqual(people[1].label?.label, 'Rohan');
  assert.strictEqual(people[0].label, undefined);
  assert.strictEqual(orphanLabels.length, 1);
  assert.strictEqual(orphanLabels[0].coachUid, 'ghost');
});
