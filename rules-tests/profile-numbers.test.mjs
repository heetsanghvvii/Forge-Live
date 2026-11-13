// Profile number and role validation (found by the stress test: numeric profile fields were unchecked).
// Emulator only. Own project id so it does not share data with the other test files.
import { test, describe, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

const here = dirname(fileURLToPath(import.meta.url));
const rulesPath = process.env.RULES_PATH || resolve(here, '..', 'firestore.rules');
const OWNER = 'ownerNum';
let env;
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-profile-numbers', firestore: { rules: readFileSync(rulesPath, 'utf8') } }); });
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });
const db = () => env.authenticatedContext(OWNER).firestore();
const put = (extra) => setDoc(doc(db(), 'users', OWNER), { userId: OWNER, updatedAt: new Date().toISOString(), ...extra }, { merge: true });

const NUMERIC = ['age', 'heightCm', 'startingWeightKg', 'proposedGoalWeightKg', 'bodyweightKg'];

describe('numeric profile fields', () => {
  for (const k of NUMERIC) {
    test(`${k}: ordinary numbers are allowed`, async () => {
      for (const v of [0, 1, 70, 72.5, 180, 99999]) await assertSucceeds(put({ [k]: v }));
    });
    test(`${k}: NaN, Infinity, huge, out of range are denied`, async () => {
      for (const v of [NaN, Infinity, -Infinity, 1e308, 100000, -100000, 1e9]) await assertFails(put({ [k]: v }));
    });
    test(`${k}: wrong types and null are denied`, async () => {
      for (const v of ['abc', '70', null, [1, 2], { a: 1 }, true]) await assertFails(put({ [k]: v }));
    });
  }
  test('a full legitimate profile payload is still allowed', async () => {
    await assertSucceeds(put({
      displayName: 'Test', role: 'owner', programmeStartDate: '2026-10-24', currentPhase: 'phase1', timezone: 'Asia/Kolkata',
      age: 30, gender: 'male', heightCm: 175, bodyweightKg: 70.5, startingWeightKg: 71, proposedGoalWeightKg: 68,
      weighIns: [{ date: '2026-10-24', dayNumber: 1, weight: 70.5 }], measurementHistory: [],
    }));
  });
});

describe('role', () => {
  test('owner and coach are allowed', async () => {
    await assertSucceeds(put({ role: 'owner' }));
    await assertSucceeds(put({ role: 'coach' }));
  });
  test('anything else is denied', async () => {
    for (const v of ['admin', 'Owner', ' owner', '', null, 1, ['owner']]) await assertFails(put({ role: v }));
  });
});
