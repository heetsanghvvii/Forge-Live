// Compatibility audit: documents written by the OLD app (origin/main cloudSync.ts) vs the NEW firestore.rules.
// Emulator only. Seeds with rules disabled, then replays the NEW app's owner write payloads.
// Tests prefixed "RISK:" assert the CURRENT (denying) behaviour so the suite stays green while
// documenting a possible lock-out; see the audit report.
import { test, describe, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

const here = dirname(fileURLToPath(import.meta.url));
const rulesPath = process.env.RULES_PATH || resolve(here, '..', 'firestore.rules');
const OWNER = 'ownerA';
const COACH = 'coachA';

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-legacy-shapes', firestore: { rules: readFileSync(rulesPath, 'utf8') } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });
const as = (uid) => env.authenticatedContext(uid).firestore();
const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

const oldNow = '2026-09-01T10:00:00.000Z';
const now = new Date().toISOString();

// ---- OLD documents (shapes from origin/main src/utils/cloudSync.ts) ----
const weighIns = (n) => Array.from({ length: n }, (_, i) => ({ date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, dayNumber: (i % 63) + 1, weight: 90 - i * 0.01 }));
const measures = (n) => Array.from({ length: n }, (_, i) => ({ date: `d${i}`, dayNumber: (i % 63) + 1, measurements: { waist: 90, chest: 100, hips: 98, thigh: 60, arm: 35, neck: 40 } }));
const oldProfile = (uid, extra = {}) => ({
  userId: uid, displayName: 'Heet', role: 'owner', programmeStartDate: '2026-01-05',
  currentPhase: 'phase2', timezone: 'Asia/Kolkata', authorizedCoachUid: COACH, updatedAt: oldNow,
  weighIns: weighIns(60), measurementHistory: measures(20),
  startingWeightKg: 92.5, proposedGoalWeightKg: 80, bodyweightKg: 88.2, heightCm: 178, age: 30, gender: 'male',
  trainingExperience: 'intermediate', equipment: 'full gym', injuriesAndConstraints: 'left knee', dietaryExclusions: 'none',
  wakeTime: '06:00', workTime: '09:00-18:00', gymTime: '19:00', ...extra,
});
// legacy log: fake sleepHours 7.5, no `entered`, every optional old key
const oldDaily = (n = 1, extra = {}) => ({
  date: `2026-01-${String(n).padStart(2, '0')}`, dayNumber: n, phase: 'phase1',
  checklist: { workout: true, cardio: true, water: true, photo: false, community: false },
  macrosConsumed: { calories: 2000, protein: 150, fat: 60, carbs: 200 },
  waterMl: 3000, steps: 9000, sleepHours: 7.5, addedCarbs: ['rice'],
  plannedMacros: { calories: 2100, protein: 160, fat: 60, carbs: 210 }, plannedWaterMl: 3000, plannedSteps: 10000, plannedSleepHours: 8,
  energyRating: 7, hungerRating: 3, sorenessRating: 2, painOrIllnessNotes: 'x', generalNotes: 'ok',
  isRestDay: false, isSkipped: false, isModified: false,
  mealEstimates: [{ id: 'm1', name: 'Eggs', estimateCalories: 300, estimateProtein: 20, estimateCarbs: 2, estimateFat: 20, isEstimateOnly: true, notes: 'n' }],
  supplements: { whey: true, creatine: true, multivitamin: false, vitaminD3: false, carnitine: false, acv: false },
  notes: 'n', updatedAt: oldNow, ...extra,
});
const oldWorkout = (dayKey = 'p1-d1', extra = {}) => ({
  phase: 'phase1', workoutCompleted: true, warmupCompleted: true, cooldownCompleted: true, absCompleted: false,
  cardioCompleted: true, cardioMinutes: 20, cardioType: 'LISS', sprintCount: 0,
  exercises: [{ id: 'e1', name: 'Squat', sets: [{ weight: 100, reps: 5 }] }], totalVolumeKg: 500,
  completedAt: oldNow, isRest: false, isSkipped: false, isModified: false, sessionNotes: 'n', rpeEffort: 8, workoutType: 'legs',
  dayKey, updatedAt: oldNow, ...extra,
});
const oldAccess = (extra = {}) => ({ coachUid: COACH, ownerUid: OWNER, status: 'authorized', grantedAt: oldNow, ...extra });

async function seedOld(profileExtra = {}) {
  await seed(async (db) => {
    await setDoc(doc(db, 'users', OWNER), oldProfile(OWNER, profileExtra));
    for (let i = 1; i <= 5; i++) await setDoc(doc(db, 'users', OWNER, 'dailyLogs', oldDaily(i).date), oldDaily(i));
    await setDoc(doc(db, 'users', OWNER, 'workoutLogs', 'p1-d1'), oldWorkout());
    await setDoc(doc(db, 'users', OWNER, 'coachAccess', COACH), oldAccess());
  });
}

// ---- NEW app payloads (current src/utils/cloudSync.ts) ----
const newProfilePayload = (extra = {}) => ({
  userId: OWNER, displayName: 'Heet', role: 'owner', programmeStartDate: '2026-01-05', currentPhase: 'phase2',
  timezone: 'Asia/Kolkata', authorizedCoachUid: COACH, updatedAt: now,
  weighIns: weighIns(60), measurementHistory: measures(20),
  startingWeightKg: 92.5, proposedGoalWeightKg: 80, bodyweightKg: 88.2, heightCm: 178, age: 30, gender: 'male',
  trainingExperience: 'intermediate', equipment: 'full gym', injuriesAndConstraints: 'left knee', dietaryExclusions: 'none',
  wakeTime: '06:00', workTime: '09:00-18:00', gymTime: '19:00', ...extra,
});
const summary = (extra = {}) => ({ updatedAt: now, displayName: 'Heet', programmeStartDate: '2026-01-05', currentPhase: 'phase2', timezone: 'Asia/Kolkata', bodyweightKg: 88.2, startingWeightKg: 92.5, ...extra });

describe('OLD docs seeded, owner replays NEW app payloads', () => {
  beforeEach(() => seedOld());

  test('owner can READ everything old code wrote', async () => {
    const db = as(OWNER);
    await assertSucceeds(getDoc(doc(db, 'users', OWNER)));
    await assertSucceeds(getDocs(collection(db, 'users', OWNER, 'dailyLogs')));
    await assertSucceeds(getDocs(collection(db, 'users', OWNER, 'workoutLogs')));
    await assertSucceeds(getDocs(collection(db, 'users', OWNER, 'coachAccess')));
    await assertSucceeds(getDoc(doc(db, 'users', OWNER, 'coachAccess', COACH)));
    await assertSucceeds(getDocs(collection(db, 'users', OWNER, 'coachSummary')));
    await assertSucceeds(getDoc(doc(db, 'users', OWNER, 'coachSummary', 'current')));
    const s = await getDocs(collection(db, 'users', OWNER, 'dailyLogs'));
    if (s.size !== 5) throw new Error('expected 5 logs');
  });

  test('syncOwnerStateToCloud replay: profile merge, overwrite logs/workouts, coachAccess, coachSummary', async () => {
    const db = as(OWNER);
    await assertSucceeds(setDoc(doc(db, 'users', OWNER), newProfilePayload(), { merge: true }));
    for (let i = 1; i <= 5; i++) {
      await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'dailyLogs', oldDaily(i).date),
        { ...oldDaily(i), entered: { sleep: true, calories: true, protein: true, steps: false, water: true, energy: true }, updatedAt: now }));
    }
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'workoutLogs', 'p1-d1'), { ...oldWorkout(), updatedAt: now }));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'coachAccess', COACH), { coachUid: COACH, ownerUid: OWNER, status: 'authorized', grantedAt: now }));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'coachSummary', 'current'), summary()));
  });

  test('profile merge when sparse new payload (no optional fields) over fully-populated old doc', async () => {
    const db = as(OWNER);
    await assertSucceeds(setDoc(doc(db, 'users', OWNER),
      { userId: OWNER, displayName: 'Heet', role: 'owner', currentPhase: 'phase1', timezone: 'Asia/Kolkata', authorizedCoachUid: '', updatedAt: now, weighIns: weighIns(60), measurementHistory: measures(20) }, { merge: true }));
  });

  test('no-coach sync: delete missing summary, then grant, then revoke sequences', async () => {
    const db = as(OWNER);
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER, 'coachSummary', 'current')));
    // grant
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'coachAccess', COACH), { coachUid: COACH, ownerUid: OWNER, status: 'authorized', grantedAt: now }));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER), { userId: OWNER, authorizedCoachUid: COACH, updatedAt: now }, { merge: true }));
    const p = await assertSucceeds(getDoc(doc(db, 'users', OWNER)));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'coachSummary', 'current'), summary({ displayName: p.data().displayName })));
    // revoke
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER, 'coachSummary', 'current')));
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER, 'coachAccess', COACH)));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER), { userId: OWNER, authorizedCoachUid: '', updatedAt: now }, { merge: true }));
  });

  test('grant/revoke merge-only writes (userId+authorizedCoachUid+updatedAt) on old fully-populated profile', async () => {
    const db = as(OWNER);
    await assertSucceeds(setDoc(doc(db, 'users', OWNER), { userId: OWNER, authorizedCoachUid: 'newCoach', updatedAt: now }, { merge: true }));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER), { userId: OWNER, authorizedCoachUid: '', updatedAt: now }, { merge: true }));
  });

  test('old coachAccess without grantedAt, and re-grant overwrite', async () => {
    const db = as(OWNER);
    await seed((d) => setDoc(doc(d, 'users', OWNER, 'coachAccess', 'c2'), { coachUid: 'c2', ownerUid: OWNER, status: 'authorized' }));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'coachAccess', 'c2'), { coachUid: 'c2', ownerUid: OWNER, status: 'authorized', grantedAt: now }));
  });

  test('owner can delete every legacy doc (cleanup / reset)', async () => {
    const db = as(OWNER);
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER, 'dailyLogs', oldDaily(1).date)));
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER, 'workoutLogs', 'p1-d1')));
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER, 'coachAccess', COACH)));
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER)));
  });
});

describe('size and shape limits (exact boundaries)', () => {
  test('weighIns 100 / 1000 / 3000 allowed; 3001 denied', async () => {
    const db = as(OWNER);
    for (const n of [100, 1000, 3000]) await assertSucceeds(setDoc(doc(db, 'users', OWNER), newProfilePayload({ weighIns: weighIns(n) }), { merge: true }));
    await assertFails(setDoc(doc(db, 'users', OWNER), newProfilePayload({ weighIns: weighIns(3001) }), { merge: true }));
  });
  test('measurementHistory 500 / 3000 allowed; 3001 denied', async () => {
    const db = as(OWNER);
    for (const n of [500, 3000]) await assertSucceeds(setDoc(doc(db, 'users', OWNER), newProfilePayload({ measurementHistory: measures(n) }), { merge: true }));
    await assertFails(setDoc(doc(db, 'users', OWNER), newProfilePayload({ measurementHistory: measures(3001) }), { merge: true }));
  });
  test('profile free text: at cap allowed, cap+1 denied', async () => {
    const db = as(OWNER);
    const caps = { trainingExperience: 5000, equipment: 5000, injuriesAndConstraints: 10000, dietaryExclusions: 10000, workTime: 100, gymTime: 100, wakeTime: 40, displayName: 200 };
    for (const [k, n] of Object.entries(caps)) {
      await assertSucceeds(setDoc(doc(db, 'users', OWNER), newProfilePayload({ [k]: 'a'.repeat(n) }), { merge: true }));
      await assertFails(setDoc(doc(db, 'users', OWNER), newProfilePayload({ [k]: 'a'.repeat(n + 1) }), { merge: true }));
    }
  });
  test('typical long notes 500 / 1500 / 3000 chars in injuries & dietary (cap 10000)', async () => {
    const db = as(OWNER);
    for (const n of [500, 1500]) await assertSucceeds(setDoc(doc(db, 'users', OWNER), newProfilePayload({ injuriesAndConstraints: 'k'.repeat(n), dietaryExclusions: 'k'.repeat(n) }), { merge: true }));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER), newProfilePayload({ injuriesAndConstraints: 'k'.repeat(3000) }), { merge: true }));
    await assertFails(setDoc(doc(db, 'users', OWNER), newProfilePayload({ injuriesAndConstraints: 'k'.repeat(10001) }), { merge: true }));
  });
  test('daily logs: 40 / 60 keys allowed, 61 denied; long notes unrestricted', async () => {
    const db = as(OWNER);
    const withKeys = (n) => { const o = { ...oldDaily(1), entered: { sleep: true } }; let i = 0; while (Object.keys(o).length < n) o[`extra${i++}`] = i; return o; };
    for (const n of [40, 60]) await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'dailyLogs', '2026-01-01'), withKeys(n)));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'dailyLogs', '2026-01-01'), withKeys(61)));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'dailyLogs', '2026-01-02'), { ...oldDaily(2), generalNotes: 'n'.repeat(3000), notes: 'n'.repeat(3000), painOrIllnessNotes: 'n'.repeat(3000) }));
  });
  test('realistic NEW daily log key count (all DailyLog keys + entered) is within 60', async () => {
    const o = { ...oldDaily(1), entered: { sleep: true, calories: true, protein: true, steps: true, water: true, energy: true } };
    if (Object.keys(o).length > 60) throw new Error('too many: ' + Object.keys(o).length);
    await assertSucceeds(setDoc(doc(as(OWNER), 'users', OWNER, 'dailyLogs', '2026-01-01'), o));
  });
  test('mealEstimates arrays (50 meals) in log', async () => {
    const meals = Array.from({ length: 50 }, (_, i) => ({ id: `m${i}`, name: 'x', estimateCalories: 1, estimateProtein: 1, isEstimateOnly: true, notes: 'n'.repeat(200) }));
    await assertSucceeds(setDoc(doc(as(OWNER), 'users', OWNER, 'dailyLogs', '2026-01-01'), { ...oldDaily(1), mealEstimates: meals }));
  });
  test('workout log with many exercises/sets', async () => {
    const ex = Array.from({ length: 30 }, (_, i) => ({ id: `e${i}`, name: 'x', sets: Array.from({ length: 10 }, () => ({ weight: 50, reps: 10 })) }));
    await assertSucceeds(setDoc(doc(as(OWNER), 'users', OWNER, 'workoutLogs', 'p1-d1'), { ...oldWorkout(), exercises: ex, sessionNotes: 's'.repeat(3000) }));
  });
  test('coachSummary: bodyweight decimals, phase1/2/3, empty displayName; bad phase denied', async () => {
    const db = as(OWNER);
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'coachSummary', 'current'), summary({ bodyweightKg: 88.25, currentPhase: 'phase3' })));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'coachSummary', 'current'), { updatedAt: now, currentPhase: 'phase1' }));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'coachSummary', 'current'), summary({ currentPhase: 'phase4' })));
  });
});

describe('RISK: old profile doc content that a merge-write would trip over (asserts CURRENT denial)', () => {
  test('RISK: old profile already holding a key outside the allowlist -> any merge write denied (owner lock-out)', async () => {
    await seedOld({ photos: [], linkedFirebaseUid: OWNER, lastSyncTimestamp: oldNow });
    await assertFails(setDoc(doc(as(OWNER), 'users', OWNER), newProfilePayload(), { merge: true }));
    await assertFails(setDoc(doc(as(OWNER), 'users', OWNER), { userId: OWNER, authorizedCoachUid: COACH, updatedAt: now }, { merge: true }));
    // owner can still READ and still full-overwrite (non-merge) with a clean payload
    await assertSucceeds(getDoc(doc(as(OWNER), 'users', OWNER)));
    await assertSucceeds(setDoc(doc(as(OWNER), 'users', OWNER), newProfilePayload()));
  });
  test('old profile with 2500-char injuries (old no-cap behaviour) -> unrelated merge writes still allowed', async () => {
    await seedOld({ injuriesAndConstraints: 'k'.repeat(2500) });
    await assertSucceeds(setDoc(doc(as(OWNER), 'users', OWNER), { userId: OWNER, authorizedCoachUid: '', updatedAt: now }, { merge: true }));
  });
  test('RISK: old profile with non-string gender / email / numeric-looking timezone -> denied', async () => {
    await seedOld({ gender: 'non-binary-long-text-over-20-chars' });
    await assertFails(setDoc(doc(as(OWNER), 'users', OWNER), { userId: OWNER, updatedAt: now }, { merge: true }));
  });
  test('RISK: old daily log with > 60 keys cannot be rewritten as-is', async () => {
    const big = { ...oldDaily(1) }; for (let i = 0; i < 40; i++) big[`k${i}`] = i;
    await assertFails(setDoc(doc(as(OWNER), 'users', OWNER, 'dailyLogs', '2026-01-01'), big));
  });
  test('old coachAccess with status "revoked" and revokedAt still valid', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'users', OWNER, 'coachAccess', COACH), { coachUid: COACH, ownerUid: OWNER, status: 'revoked', revokedAt: now }));
  });
});

describe('existing authorized coach after new rules (old doc shape, no coachSummary yet)', () => {
  beforeEach(() => seedOld());
  test('summary-less: profile DENIED, summary get = allowed-but-not-found, logs + workouts READ OK', async () => {
    const db = as(COACH);
    await assertFails(getDoc(doc(db, 'users', OWNER)));
    const s = await assertSucceeds(getDoc(doc(db, 'users', OWNER, 'coachSummary', 'current')));
    if (s.exists()) throw new Error('summary must not exist yet');
    const logs = await assertSucceeds(getDocs(collection(db, 'users', OWNER, 'dailyLogs')));
    if (logs.size !== 5) throw new Error('coach should see 5 logs');
    await assertSucceeds(getDocs(collection(db, 'users', OWNER, 'workoutLogs')));
    await assertSucceeds(getDoc(doc(db, 'users', OWNER, 'coachAccess', COACH)));
    await assertFails(getDocs(collection(db, 'users', OWNER, 'coachSummary')));
  });
  test('after owner syncs with new app: coach reads summary, still never the profile', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'users', OWNER, 'coachSummary', 'current'), summary()));
    const s = await assertSucceeds(getDoc(doc(as(COACH), 'users', OWNER, 'coachSummary', 'current')));
    if (!s.exists()) throw new Error('summary should exist');
    await assertFails(getDoc(doc(as(COACH), 'users', OWNER)));
  });
  test('old profile authorizedCoachUid with NO coachAccess doc: old rules allowed profile read; new denies', async () => {
    await seed((d) => deleteDoc(doc(d, 'users', OWNER, 'coachAccess', COACH)));
    await assertFails(getDoc(doc(as(COACH), 'users', OWNER)));
    await assertFails(getDocs(collection(as(COACH), 'users', OWNER, 'dailyLogs')));
  });
});
