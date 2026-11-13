// Executes firestore.rules against the local Firestore emulator.
// Run via: npm run test:rules   (RULES_PATH env var can point at another rules file)
import { test, describe, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs,
} from 'firebase/firestore';

const here = dirname(fileURLToPath(import.meta.url));
const rulesPath = process.env.RULES_PATH || resolve(here, '..', 'firestore.rules');

const OWNER = 'ownerA';
const OWNER_B = 'ownerB';
const OWNER_C = 'ownerC';
const COACH = 'coachA';
const COACH_B = 'coachB';
const STRANGER = 'stranger';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rules-test',
    firestore: { rules: readFileSync(rulesPath, 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

// ---- Payload shapes copied from src/utils/cloudSync.ts ----
const now = new Date().toISOString();
const profilePayload = (uid, extra = {}) => ({
  userId: uid,
  displayName: 'Heet',
  role: 'owner',
  programmeStartDate: '2026-01-05',
  currentPhase: 'phase1',
  timezone: 'Asia/Kolkata',
  authorizedCoachUid: '',
  updatedAt: now,
  weighIns: [{ date: '2026-01-05', dayNumber: 1, weight: 90 }],
  measurementHistory: [{ date: '2026-01-05', dayNumber: 1, measurements: { waist: 95 } }],
  startingWeightKg: 90, proposedGoalWeightKg: 80, bodyweightKg: 89, heightCm: 178,
  age: 30, gender: 'male', trainingExperience: 'intermediate', equipment: 'full gym',
  injuriesAndConstraints: 'left knee', dietaryExclusions: 'none',
  wakeTime: '06:00', workTime: '09:00-18:00', gymTime: '19:00',
  ...extra,
});
const dailyLogPayload = () => ({
  date: '2026-01-05', dayNumber: 1, phase: 'phase1',
  checklist: { workout: true, cardio: false, water: true, photo: false, community: false },
  macrosConsumed: { calories: 2000, protein: 150, fat: 60, carbs: 200 },
  waterMl: 3000, steps: 9000, sleepHours: 7,
  entered: { sleep: true }, addedCarbs: ['rice'],
  plannedMacros: { calories: 2100, protein: 160, fat: 60, carbs: 210 },
  plannedWaterMl: 3000, plannedSteps: 10000, plannedSleepHours: 8,
  energyRating: 7, hungerRating: 3, sorenessRating: 2,
  painOrIllnessNotes: '', generalNotes: 'ok', isRestDay: false, isSkipped: false, isModified: false,
  mealEstimates: [{ id: 'm1', name: 'Eggs', estimateCalories: 300, estimateProtein: 20, isEstimateOnly: true }],
  supplements: { whey: true, creatine: true, multivitamin: false, vitaminD3: false, carnitine: false, acv: false },
  notes: 'n', updatedAt: now,
});
const workoutPayload = (dayKey = 'p1-d1') => ({
  phase: 'phase1', workoutCompleted: true, warmupCompleted: true, cooldownCompleted: true,
  absCompleted: false, cardioCompleted: true, cardioMinutes: 20, cardioType: 'LISS',
  exercises: [{ name: 'Squat', sets: [{ reps: 8, weightKg: 60 }] }],
  totalVolumeKg: 480, completedAt: now, sessionNotes: 'good', rpeEffort: 7, workoutType: 'lower',
  dayKey, updatedAt: now,
});
// Mirrors buildCoachSummary() in src/utils/cloudMerge.ts
const summaryPayload = (extra = {}) => ({
  displayName: 'Heet', programmeStartDate: '2026-01-05', currentPhase: 'phase1',
  timezone: 'Asia/Kolkata', bodyweightKg: 89, startingWeightKg: 90, updatedAt: now,
  ...extra,
});
const grantDoc = (owner, coach) => ({ coachUid: coach, ownerUid: owner, status: 'authorized', grantedAt: now });

// Seed helpers (rules disabled)
async function seedOwner(uid, extra = {}) {
  await seed(async (db) => {
    await setDoc(doc(db, 'users', uid), profilePayload(uid, extra));
    await setDoc(doc(db, 'users', uid, 'dailyLogs', '2026-01-05'), dailyLogPayload());
    await setDoc(doc(db, 'users', uid, 'workoutLogs', 'p1-d1'), workoutPayload());
    await setDoc(doc(db, 'users', uid, 'coachSummary', 'current'), summaryPayload());
  });
}
const grant = (owner, coach) => seed((db) =>
  setDoc(doc(db, 'users', owner, 'coachAccess', coach), grantDoc(owner, coach)));

describe('owner access', () => {
  beforeEach(() => seedOwner(OWNER));
  test('owner reads own profile, dailyLogs, workoutLogs', async () => {
    const db = as(OWNER);
    await assertSucceeds(getDoc(doc(db, 'users', OWNER)));
    await assertSucceeds(getDoc(doc(db, 'users', OWNER, 'dailyLogs', '2026-01-05')));
    await assertSucceeds(getDocs(collection(db, 'users', OWNER, 'dailyLogs')));
    await assertSucceeds(getDoc(doc(db, 'users', OWNER, 'workoutLogs', 'p1-d1')));
    await assertSucceeds(getDocs(collection(db, 'users', OWNER, 'workoutLogs')));
    await assertSucceeds(getDoc(doc(db, 'users', OWNER, 'coachSummary', 'current')));
  });
  test('owner writes own profile, dailyLogs, workoutLogs', async () => {
    const db = as(OWNER);
    await assertSucceeds(setDoc(doc(db, 'users', OWNER), profilePayload(OWNER, { age: 31 })));
    await assertSucceeds(updateDoc(doc(db, 'users', OWNER), { age: 32 }));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'dailyLogs', '2026-01-06'), dailyLogPayload()));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'workoutLogs', 'p1-d2'), workoutPayload('p1-d2')));
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER, 'dailyLogs', '2026-01-06')));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'coachSummary', 'current'), summaryPayload({ bodyweightKg: 88.5 })));
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER, 'coachSummary', 'current')));
  });
});

describe('app payload replay (must stay accepted)', () => {
  test('first-time sync: profile merge-create, daily log, workout log, coach access', async () => {
    const db = as(OWNER);
    await assertSucceeds(setDoc(doc(db, 'users', OWNER), profilePayload(OWNER), { merge: true }));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'dailyLogs', '2026-01-05'), dailyLogPayload()));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'workoutLogs', 'p1-d1'), workoutPayload()));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'coachAccess', COACH), grantDoc(OWNER, COACH)));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'coachSummary', 'current'), summaryPayload()));
  });
  test('summary replay: minimal (phase only + updatedAt), full, and decimals', async () => {
    const db = as(OWNER);
    const ref = doc(db, 'users', OWNER, 'coachSummary', 'current');
    await assertSucceeds(setDoc(ref, { currentPhase: 'phase1', updatedAt: now }));
    await assertSucceeds(setDoc(ref, summaryPayload({ currentPhase: 'phase3', bodyweightKg: 72.35 })));
  });
  test('sync without coach: deleting a non-existent summary is allowed', async () => {
    await assertSucceeds(deleteDoc(doc(as(OWNER), 'users', OWNER, 'coachSummary', 'current')));
  });
  test('minimal profile (no optional fields), as built when settings are sparse', async () => {
    const db = as(OWNER);
    await assertSucceeds(setDoc(doc(db, 'users', OWNER), {
      userId: OWNER, displayName: 'Owner', role: 'owner', currentPhase: 'phase1',
      timezone: 'Asia/Kolkata', authorizedCoachUid: '', updatedAt: now, weighIns: [], measurementHistory: [],
    }, { merge: true }));
  });
  test('grantCoachAccessInCloud: coachAccess doc, profile merge, owner reads profile, writes summary', async () => {
    const db = as(OWNER);
    await seedOwner(OWNER);
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'coachAccess', COACH), grantDoc(OWNER, COACH)));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER),
      { userId: OWNER, authorizedCoachUid: COACH, updatedAt: now }, { merge: true }));
    await assertSucceeds(getDoc(doc(db, 'users', OWNER)));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'coachSummary', 'current'), summaryPayload()));
  });
  test('revokeCoachAccessInCloud: delete summary, delete doc, clear field', async () => {
    const db = as(OWNER);
    await seedOwner(OWNER, { authorizedCoachUid: COACH });
    await grant(OWNER, COACH);
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER, 'coachSummary', 'current')));
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER, 'coachAccess', COACH)));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER),
      { userId: OWNER, authorizedCoachUid: '', updatedAt: now }, { merge: true }));
  });
});

describe('strangers and unauthenticated', () => {
  beforeEach(() => seedOwner(OWNER));
  test('signed-in stranger cannot read or write owner data', async () => {
    const db = as(STRANGER);
    await assertFails(getDoc(doc(db, 'users', OWNER)));
    await assertFails(getDoc(doc(db, 'users', OWNER, 'dailyLogs', '2026-01-05')));
    await assertFails(getDocs(collection(db, 'users', OWNER, 'dailyLogs')));
    await assertFails(getDoc(doc(db, 'users', OWNER, 'workoutLogs', 'p1-d1')));
    await assertFails(getDoc(doc(db, 'users', OWNER, 'coachSummary', 'current')));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'coachSummary', 'current'), summaryPayload()));
    await assertFails(setDoc(doc(db, 'users', OWNER), profilePayload(OWNER)));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'dailyLogs', 'x'), dailyLogPayload()));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'workoutLogs', 'x'), workoutPayload('x')));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'coachAccess', STRANGER), grantDoc(OWNER, STRANGER)));
  });
  test('unauthenticated cannot read or write', async () => {
    const db = anon();
    await assertFails(getDoc(doc(db, 'users', OWNER)));
    await assertFails(getDocs(collection(db, 'users', OWNER, 'dailyLogs')));
    await assertFails(getDoc(doc(db, 'users', OWNER, 'coachAccess', COACH)));
    await assertFails(getDoc(doc(db, 'users', OWNER, 'coachSummary', 'current')));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'coachSummary', 'current'), summaryPayload()));
    await assertFails(setDoc(doc(db, 'users', OWNER), profilePayload(OWNER)));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'dailyLogs', 'x'), dailyLogPayload()));
    await assertFails(deleteDoc(doc(db, 'users', OWNER)));
  });
  test('unauthenticated cannot read a doc whose authorizedCoachUid is empty string', async () => {
    // authorizedCoachUid defaults to '' in the app; unauth has no uid so must never match.
    await assertFails(getDoc(doc(anon(), 'users', OWNER)));
  });
});

describe('coach access', () => {
  beforeEach(() => seedOwner(OWNER));

  test('BEFORE grant: coach denied everywhere (profile, summary, logs)', async () => {
    const db = as(COACH);
    await assertFails(getDoc(doc(db, 'users', OWNER)));
    await assertFails(getDoc(doc(db, 'users', OWNER, 'coachSummary', 'current')));
    await assertFails(getDoc(doc(db, 'users', OWNER, 'dailyLogs', '2026-01-05')));
    await assertFails(getDocs(collection(db, 'users', OWNER, 'dailyLogs')));
    await assertFails(getDocs(collection(db, 'users', OWNER, 'workoutLogs')));
  });

  test('AFTER grant (status authorized): summary + logs readable, PROFILE DENIED', async () => {
    await grant(OWNER, COACH);
    const db = as(COACH);
    await assertSucceeds(getDoc(doc(db, 'users', OWNER, 'coachSummary', 'current')));
    await assertSucceeds(getDoc(doc(db, 'users', OWNER, 'dailyLogs', '2026-01-05')));
    await assertSucceeds(getDocs(collection(db, 'users', OWNER, 'dailyLogs')));
    await assertSucceeds(getDoc(doc(db, 'users', OWNER, 'workoutLogs', 'p1-d1')));
    await assertSucceeds(getDocs(collection(db, 'users', OWNER, 'workoutLogs')));
    await assertFails(getDoc(doc(db, 'users', OWNER)));
  });

  test('summary doc id other than "current" is not readable by coach; coach cannot list summaries', async () => {
    await grant(OWNER, COACH);
    await seed((db) => setDoc(doc(db, 'users', OWNER, 'coachSummary', 'other'), summaryPayload()));
    await assertFails(getDoc(doc(as(COACH), 'users', OWNER, 'coachSummary', 'other')));
    await assertFails(getDocs(collection(as(COACH), 'users', OWNER, 'coachSummary')));
  });

  test('profile authorizedCoachUid ALONE (no coachAccess doc) grants nothing', async () => {
    await seed((db) => setDoc(doc(db, 'users', OWNER), profilePayload(OWNER, { authorizedCoachUid: COACH })));
    const db = as(COACH);
    await assertFails(getDoc(doc(db, 'users', OWNER)));
    await assertFails(getDoc(doc(db, 'users', OWNER, 'coachSummary', 'current')));
    await assertFails(getDocs(collection(db, 'users', OWNER, 'dailyLogs')));
    await assertFails(getDocs(collection(db, 'users', OWNER, 'workoutLogs')));
  });

  test('coach cannot LIST the users collection (even when authorized)', async () => {
    await grant(OWNER, COACH);
    await assertFails(getDocs(collection(as(COACH), 'users')));
  });

  test('coach cannot WRITE anything (profile, logs, coachAccess), even when authorized', async () => {
    await grant(OWNER, COACH);
    const db = as(COACH);
    await assertFails(updateDoc(doc(db, 'users', OWNER), { age: 99 }));
    await assertFails(setDoc(doc(db, 'users', OWNER), profilePayload(OWNER)));
    await assertFails(deleteDoc(doc(db, 'users', OWNER)));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'dailyLogs', '2026-01-05'), dailyLogPayload()));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'dailyLogs', 'new'), dailyLogPayload()));
    await assertFails(deleteDoc(doc(db, 'users', OWNER, 'dailyLogs', '2026-01-05')));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'workoutLogs', 'new'), workoutPayload('new')));
    await assertFails(deleteDoc(doc(db, 'users', OWNER, 'workoutLogs', 'p1-d1')));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'coachAccess', COACH), { ...grantDoc(OWNER, COACH), status: 'authorized' }));
    await assertFails(deleteDoc(doc(db, 'users', OWNER, 'coachAccess', COACH)));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'coachSummary', 'current'), summaryPayload({ bodyweightKg: 1 })));
    await assertFails(updateDoc(doc(db, 'users', OWNER, 'coachSummary', 'current'), { bodyweightKg: 1 }));
    await assertFails(deleteDoc(doc(db, 'users', OWNER, 'coachSummary', 'current')));
  });

  test('after REVOKE (summary + access doc deleted, field cleared): coach denied', async () => {
    await seed((db) => setDoc(doc(db, 'users', OWNER), profilePayload(OWNER, { authorizedCoachUid: COACH })));
    await grant(OWNER, COACH);
    await assertSucceeds(getDoc(doc(as(COACH), 'users', OWNER, 'coachSummary', 'current')));
    const o = as(OWNER);
    await deleteDoc(doc(o, 'users', OWNER, 'coachSummary', 'current'));
    await deleteDoc(doc(o, 'users', OWNER, 'coachAccess', COACH));
    await setDoc(doc(o, 'users', OWNER), { userId: OWNER, authorizedCoachUid: '', updatedAt: now }, { merge: true });
    const db = as(COACH);
    await assertFails(getDoc(doc(db, 'users', OWNER)));
    await assertFails(getDoc(doc(db, 'users', OWNER, 'coachSummary', 'current')));
    await assertFails(getDocs(collection(db, 'users', OWNER, 'dailyLogs')));
    await assertFails(getDocs(collection(db, 'users', OWNER, 'workoutLogs')));
  });

  test("status 'revoked' (summary still present): coach denied summary and logs", async () => {
    await seed((db) => setDoc(doc(db, 'users', OWNER, 'coachAccess', COACH), { ...grantDoc(OWNER, COACH), status: 'revoked' }));
    const db = as(COACH);
    await assertFails(getDoc(doc(db, 'users', OWNER, 'coachSummary', 'current')));
    await assertFails(getDoc(doc(db, 'users', OWNER)));
    await assertFails(getDocs(collection(db, 'users', OWNER, 'dailyLogs')));
  });

  test("owner flips status to 'revoked' via update: coach immediately denied", async () => {
    await grant(OWNER, COACH);
    await assertSucceeds(getDoc(doc(as(COACH), 'users', OWNER, 'coachSummary', 'current')));
    await assertSucceeds(setDoc(doc(as(OWNER), 'users', OWNER, 'coachAccess', COACH), { ...grantDoc(OWNER, COACH), status: 'revoked', revokedAt: now }));
    await assertFails(getDoc(doc(as(COACH), 'users', OWNER, 'coachSummary', 'current')));
    await assertFails(getDocs(collection(as(COACH), 'users', OWNER, 'dailyLogs')));
  });

  test("WEAKNESS W1: status 'revoked' but authorizedCoachUid still set -> coach must be denied", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', OWNER), profilePayload(OWNER, { authorizedCoachUid: COACH }));
      await setDoc(doc(db, 'users', OWNER, 'coachAccess', COACH), { ...grantDoc(OWNER, COACH), status: 'revoked' });
    });
    await assertFails(getDoc(doc(as(COACH), 'users', OWNER)));
    await assertFails(getDoc(doc(as(COACH), 'users', OWNER, 'coachSummary', 'current')));
    await assertFails(getDocs(collection(as(COACH), 'users', OWNER, 'dailyLogs')));
  });

  test('isolation: coach authorized for owner C cannot read owner B (or A)', async () => {
    await seedOwner(OWNER_B);
    await seedOwner(OWNER_C);
    await grant(OWNER_C, COACH);
    const db = as(COACH);
    await assertSucceeds(getDoc(doc(db, 'users', OWNER_C, 'coachSummary', 'current')));
    await assertFails(getDoc(doc(db, 'users', OWNER_B, 'coachSummary', 'current')));
    await assertFails(getDoc(doc(db, 'users', OWNER_B)));
    await assertFails(getDocs(collection(db, 'users', OWNER_B, 'dailyLogs')));
    await assertFails(getDocs(collection(db, 'users', OWNER, 'workoutLogs')));
  });

  test('a different coach (not granted) cannot piggyback on coachA grant', async () => {
    await grant(OWNER, COACH);
    await assertFails(getDoc(doc(as(COACH_B), 'users', OWNER)));
    await assertFails(getDoc(doc(as(COACH_B), 'users', OWNER, 'coachSummary', 'current')));
    await assertFails(getDocs(collection(as(COACH_B), 'users', OWNER, 'dailyLogs')));
  });

  test('coach can read own grant doc only; not other coaches grants; cannot list coachAccess', async () => {
    await grant(OWNER, COACH);
    await grant(OWNER, COACH_B);
    const db = as(COACH);
    await assertSucceeds(getDoc(doc(db, 'users', OWNER, 'coachAccess', COACH)));
    await assertFails(getDoc(doc(db, 'users', OWNER, 'coachAccess', COACH_B)));
    await assertFails(getDocs(collection(db, 'users', OWNER, 'coachAccess')));
  });

  test('W2 FIXED: authorized coach cannot read injuries/health fields (profile doc is owner-only); summary has no private fields', async () => {
    await grant(OWNER, COACH);
    await assertFails(getDoc(doc(as(COACH), 'users', OWNER)));
    const snap = await assertSucceeds(getDoc(doc(as(COACH), 'users', OWNER, 'coachSummary', 'current')));
    const keys = Object.keys(snap.data());
    for (const banned of ['injuriesAndConstraints', 'dietaryExclusions', 'age', 'gender', 'heightCm', 'weighIns', 'email', 'authorizedCoachUid']) {
      assert(!keys.includes(banned));
    }
  });
});

describe('cross-user isolation (user A vs user B)', () => {
  beforeEach(async () => { await seedOwner(OWNER); await seedOwner(OWNER_B); });
  test('A cannot create/modify/delete a coachAccess doc under users/B (for anyone, incl. self)', async () => {
    const db = as(OWNER);
    await assertFails(setDoc(doc(db, 'users', OWNER_B, 'coachAccess', OWNER), grantDoc(OWNER_B, OWNER)));
    await assertFails(setDoc(doc(db, 'users', OWNER_B, 'coachAccess', COACH), grantDoc(OWNER_B, COACH)));
    await assertFails(setDoc(doc(db, 'users', OWNER_B, 'coachAccess', OWNER), grantDoc(OWNER, OWNER)));
    await grant(OWNER_B, COACH);
    await assertFails(setDoc(doc(db, 'users', OWNER_B, 'coachAccess', COACH), { ...grantDoc(OWNER_B, COACH), status: 'revoked' }));
    await assertFails(deleteDoc(doc(db, 'users', OWNER_B, 'coachAccess', COACH)));
  });
  test("A cannot read or write any of B's data", async () => {
    const db = as(OWNER);
    await assertFails(getDoc(doc(db, 'users', OWNER_B)));
    await assertFails(getDoc(doc(db, 'users', OWNER_B, 'coachSummary', 'current')));
    await assertFails(getDocs(collection(db, 'users', OWNER_B, 'dailyLogs')));
    await assertFails(getDocs(collection(db, 'users', OWNER_B, 'workoutLogs')));
    await assertFails(getDocs(collection(db, 'users', OWNER_B, 'coachAccess')));
    await assertFails(setDoc(doc(db, 'users', OWNER_B, 'coachSummary', 'current'), summaryPayload()));
    await assertFails(setDoc(doc(db, 'users', OWNER_B, 'dailyLogs', 'x'), dailyLogPayload()));
    await assertFails(deleteDoc(doc(db, 'users', OWNER_B, 'coachSummary', 'current')));
  });
  test("A cannot grant themself access to B (own-tree grant gives nothing on B)", async () => {
    const db = as(OWNER);
    await assertFails(setDoc(doc(db, 'users', OWNER_B, 'coachAccess', OWNER), grantDoc(OWNER_B, OWNER)));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'coachAccess', OWNER), grantDoc(OWNER, OWNER)));
    await assertFails(getDoc(doc(db, 'users', OWNER_B)));
    await assertFails(getDoc(doc(db, 'users', OWNER_B, 'coachSummary', 'current')));
    await assertFails(getDocs(collection(db, 'users', OWNER_B, 'dailyLogs')));
  });
});

describe('coachSummary validation', () => {
  const ref = () => doc(as(OWNER), 'users', OWNER, 'coachSummary', 'current');
  test('private fields rejected (allowlist)', async () => {
    for (const bad of [{ injuriesAndConstraints: 'knee' }, { dietaryExclusions: 'x' }, { age: 30 }, { gender: 'male' },
      { heightCm: 178 }, { proposedGoalWeightKg: 80 }, { weighIns: [] }, { email: 'a@b.c' }, { authorizedCoachUid: 'c' }, { userId: OWNER }]) {
      await assertFails(setDoc(ref(), summaryPayload(bad)));
    }
  });
  test('types, enums and sizes enforced', async () => {
    await assertFails(setDoc(ref(), summaryPayload({ displayName: 'x'.repeat(201) })));
    await assertFails(setDoc(ref(), summaryPayload({ displayName: 5 })));
    await assertFails(setDoc(ref(), summaryPayload({ currentPhase: 'phase9' })));
    await assertFails(setDoc(ref(), summaryPayload({ timezone: 't'.repeat(101) })));
    await assertFails(setDoc(ref(), summaryPayload({ bodyweightKg: '89' })));
    await assertFails(setDoc(ref(), summaryPayload({ bodyweightKg: 1e9 })));
    await assertFails(setDoc(ref(), summaryPayload({ bodyweightKg: NaN })));
    await assertFails(setDoc(ref(), summaryPayload({ startingWeightKg: Infinity })));
    await assertFails(setDoc(ref(), summaryPayload({ updatedAt: 'u'.repeat(61) })));
    await assertSucceeds(setDoc(ref(), summaryPayload({ displayName: 'x'.repeat(200) })));
  });
  test('only doc id "current" can be created', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'users', OWNER, 'coachSummary', 'second'), summaryPayload()));
  });
});

describe('path and identity checks', () => {
  test('user A cannot create users/B', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'users', OWNER_B), profilePayload(OWNER_B)));
    await assertFails(setDoc(doc(as(OWNER), 'users', OWNER_B), profilePayload(OWNER)));
  });
  test('create users/A with mismatched userId field is denied', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'users', OWNER), profilePayload(OWNER_B)));
  });
  test('update that changes userId to someone else is denied', async () => {
    await seedOwner(OWNER);
    await assertFails(updateDoc(doc(as(OWNER), 'users', OWNER), { userId: OWNER_B }));
  });
  test('owner cannot write to unrelated paths (/test/x, /users/A/other/x)', async () => {
    const db = as(OWNER);
    await assertFails(setDoc(doc(db, 'test', 'x'), { a: 1 }));
    await assertFails(getDoc(doc(db, 'test', 'x')));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'other', 'x'), { a: 1 }));
  });
  test('owner cannot list users collection', async () => {
    await seedOwner(OWNER);
    await assertFails(getDocs(collection(as(OWNER), 'users')));
  });
});

describe('weakness checks (tightened rules)', () => {
  beforeEach(() => seedOwner(OWNER));
  test('W3: owner cannot write arbitrary extra fields to profile', async () => {
    await assertFails(updateDoc(doc(as(OWNER), 'users', OWNER), { isAdmin: true }));
  });
  test('W3b: owner cannot store a huge string in a profile text field', async () => {
    await assertFails(updateDoc(doc(as(OWNER), 'users', OWNER), { injuriesAndConstraints: 'x'.repeat(10001) }));
  });
  test('W3c: authorizedCoachUid must be a short string', async () => {
    await assertFails(updateDoc(doc(as(OWNER), 'users', OWNER), { authorizedCoachUid: 'y'.repeat(500) }));
    await assertFails(updateDoc(doc(as(OWNER), 'users', OWNER), { authorizedCoachUid: { a: 1 } }));
  });
  test('W4: owner cannot write a daily log with an absurd number of fields', async () => {
    const big = {};
    for (let i = 0; i < 200; i++) big['f' + i] = i;
    await assertFails(setDoc(doc(as(OWNER), 'users', OWNER, 'dailyLogs', 'big'), { ...dailyLogPayload(), ...big }));
    await assertFails(setDoc(doc(as(OWNER), 'users', OWNER, 'workoutLogs', 'big'), { ...workoutPayload('big'), ...big }));
  });
  test('W5: coachAccess doc must be well-formed (status enum, ids match path)', async () => {
    const db = as(OWNER);
    await assertFails(setDoc(doc(db, 'users', OWNER, 'coachAccess', COACH), { ...grantDoc(OWNER, COACH), status: 'banana' }));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'coachAccess', COACH), { ...grantDoc(OWNER, COACH), coachUid: COACH_B }));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'coachAccess', COACH), { ...grantDoc(OWNER, COACH), ownerUid: OWNER_B }));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'coachAccess', COACH), { ...grantDoc(OWNER, COACH), extra: 'x' }));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'coachAccess', COACH), { ...grantDoc(OWNER, COACH), status: 'revoked' }));
  });
});

function assert(cond) { if (!cond) throw new Error('assertion failed'); }
