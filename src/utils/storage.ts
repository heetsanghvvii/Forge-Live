import { AppState, DailyChecklist, DailyLog, PhaseType, UserAccount } from '../types';
import { normalizeLoadedStateDetailed, backupCorruptRaw } from './storageNormalize';
import { noteSaveOk, noteSaveFailed } from './storageNotices';

export const STORAGE_KEY = 'bollywood_body_p2_v1';

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createDefaultChecklist(phase: PhaseType = 'phase1'): DailyChecklist {
  if (phase === 'phase1') {
    return {
      workout: false,
      cleanEating: false,
      water: false,
      cardio: false,
      photo: false,
      community: false
    };
  } else if (phase === 'phase3') {
    return {
      workout: false,
      cardio: false,
      protein: false,
      water: false,
      fasting: false,
      sleep: false,
      prePostCarbs: false,
      photo: false,
      community: false
    };
  }
  return {
    workout: false,
    abs: false,
    cardio: false,
    fasting: false,
    protein: false,
    water: false,
    steps: false,
    photo: false,
    community: false
  };
}

export function createDefaultDailyLog(dayNumber: number, dateStr: string): DailyLog {
  let phase: PhaseType = 'phase1';
  if (dayNumber >= 36) {
    phase = 'phase3';
  } else if (dayNumber >= 8) {
    phase = 'phase2';
  }

  return {
    date: dateStr,
    dayNumber,
    phase,
    checklist: createDefaultChecklist(phase),
    macrosConsumed: {
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0
    },
    waterMl: 0,
    steps: 0,
    addedCarbs: [],
    supplements: {
      whey: false,
      creatine: false,
      multivitamin: false,
      vitaminD3: false,
      carnitine: false,
      acv: false
    }
  };
}

/**
 * Date of programme day N as YYYY-MM-DD. Pure calendar arithmetic on Y/M/D (UTC fields only as a calendar
 * calculator), so it is identical in every timezone and across DST changes. Invalid start date -> '' (never 'NaN-NaN-NaN').
 */
export function calculateDateForDayNumber(startDateStr: string, dayNumber: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof startDateStr === 'string' ? startDateStr : '');
  if (!m || !Number.isFinite(dayNumber)) return '';
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return '';
  const t = new Date(Date.UTC(y, mo - 1, d + Math.trunc(dayNumber) - 1));
  return `${String(t.getUTCFullYear()).padStart(4, '0')}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

export function getInitialState(): AppState {
  const todayStr = getTodayDateString();
  const currentDay = 1;

  const defaultLogs: { [day: number]: DailyLog } = {};
  for (let d = 1; d <= 63; d++) {
    defaultLogs[d] = createDefaultDailyLog(d, calculateDateForDayNumber(todayStr, d));
  }

  return {
    schemaVersion: 2,
    settings: {
      startDate: todayStr,
      phase2StartDate: calculateDateForDayNumber(todayStr, 8),
      phase3StartDate: calculateDateForDayNumber(todayStr, 36),
      activePhase: 'phase1',
      phase2Unlocked: true,
      phase3Unlocked: true,
      bodyweightKg: undefined,
      startingWeightKg: undefined,
      proposedGoalWeightKg: undefined,
      gender: undefined,
      heightCm: undefined,
      age: undefined,
      timezone: 'Asia/Kolkata',
      dietaryExclusions: 'Vegetarian, no eggs, no onion, no garlic (strict Jain/sattvic)',
      trainingExperience: undefined,
      equipment: undefined,
      injuriesAndConstraints: '',
      wakeTime: '06:30 AM',
      workTime: '09:30 AM to 06:30 PM',
      gymTime: '07:00 PM to 08:30 PM',
      confirmedProgrammeStart: false,
      userRole: 'owner',
      fastingStartHour: 20, // 8 PM
      fastingEndHour: 12, // 12 PM
      waterGoalMl: 3000,
      stepGoal: 10000,
      onboardingCompleted: false
    },
    currentDayNumber: currentDay,
    selectedDayNumber: currentDay,
    dailyLogs: defaultLogs,
    workoutLogs: {},
    weighIns: [],
    measurementHistory: [],
    photos: [],
    learnedLessonIds: [],
    quizAnswers: {},
    avoidedMistakes: {},
    day1Tasks: {
      photoTaken: false,
      weightRecorded: false,
      measurementsRecorded: false,
      communityIntroPosted: false
    },
    day36Tasks: {
      photoTaken: false,
      weightRecorded: false,
      measurementsRecorded: false,
      maintenanceRecalculated: false,
      mealPlanEdited: false,
      sprintTrackFound: false
    }
  };
}

/**
 * Fills ONLY absent structural keys on stored daily logs (checklist, supplements, macros, water, steps) so older or
 * partly-synced logs cannot crash the UI (e.g. calculateStreak reads log.checklist). Existing values are never changed.
 * The filled keys match the sync hash normalisation, so this does not make a synced day look "edited".
 */
export function normalizeStoredDailyLogs(dailyLogs: { [day: number]: DailyLog } | undefined): { [day: number]: DailyLog } {
  const out: { [day: number]: DailyLog } = {};
  const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
  for (const [k, raw] of Object.entries(dailyLogs || {})) {
    if (!isObj(raw)) { out[Number(k)] = raw as any; continue; }
    const r: any = { ...raw };
    const n = Number(k);
    if (r.dayNumber === undefined && Number.isFinite(n)) r.dayNumber = n;
    if (r.phase === undefined) r.phase = 'phase1';
    if (!isObj(r.checklist)) r.checklist = createDefaultChecklist(r.phase);
    r.macrosConsumed = { calories: 0, protein: 0, fat: 0, carbs: 0, ...(isObj(r.macrosConsumed) ? r.macrosConsumed : {}) };
    r.supplements = { whey: false, creatine: false, multivitamin: false, vitaminD3: false, carnitine: false, acv: false, ...(isObj(r.supplements) ? r.supplements : {}) };
    if (r.waterMl === undefined || r.waterMl === null) r.waterMl = 0;
    if (r.steps === undefined || r.steps === null) r.steps = 0;
    out[n] = r as DailyLog;
  }
  return out;
}

export function loadAppState(): AppState {
  if (typeof window === 'undefined') return getInitialState();
  let rawForBackup: string | null = null;
  try {
    const activeUsername = getActiveUsername();
    if (activeUsername) {
      const accounts = getAllAccounts();
      if (accounts[activeUsername]?.appState) {
        const norm = normalizeLoadedStateDetailed(accounts[activeUsername].appState);
        if (norm.lossy) { try { backupCorruptRaw(JSON.stringify(accounts[activeUsername].appState)); } catch { /* ignore */ } }
        const userState = norm.state;
        userState.dailyLogs = normalizeStoredDailyLogs(userState.dailyLogs);
        for (let d = 1; d <= 63; d++) {
          if (!userState.dailyLogs[d]) {
            userState.dailyLogs[d] = createDefaultDailyLog(
              d,
              calculateDateForDayNumber(userState.settings.startDate || getTodayDateString(), d)
            );
          }
        }
        return userState;
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialState();
    rawForBackup = raw;
    const parsedJson: unknown = JSON.parse(raw);
    const normalized = normalizeLoadedStateDetailed(parsedJson);
    if (normalized.lossy) backupCorruptRaw(raw);
    const parsed = normalized.state;

    if (!parsed.settings) parsed.settings = getInitialState().settings;

    // Preserve existing settings without backfilling fake personal weights or defaults
    if (!parsed.settings.timezone) parsed.settings.timezone = 'Asia/Kolkata';
    if (!parsed.settings.dietaryExclusions) {
      parsed.settings.dietaryExclusions = 'Vegetarian, no eggs, no onion, no garlic (strict Jain/sattvic)';
    }
    if (parsed.settings.injuriesAndConstraints === undefined) parsed.settings.injuriesAndConstraints = '';
    if (parsed.settings.wakeTime === undefined) parsed.settings.wakeTime = '06:30 AM';
    if (parsed.settings.workTime === undefined) parsed.settings.workTime = '09:30 AM to 06:30 PM';
    if (parsed.settings.gymTime === undefined) parsed.settings.gymTime = '07:00 PM to 08:30 PM';
    if (parsed.settings.userRole === undefined) parsed.settings.userRole = 'owner';

    // Ensure all 63 days (Days 1 to 63) exist in dailyLogs
    parsed.dailyLogs = normalizeStoredDailyLogs(parsed.dailyLogs);
    for (let d = 1; d <= 63; d++) {
      if (!parsed.dailyLogs[d]) {
        parsed.dailyLogs[d] = createDefaultDailyLog(
          d,
          calculateDateForDayNumber(parsed.settings.startDate || getTodayDateString(), d)
        );
      }
    }

    if (!parsed.day1Tasks) {
      parsed.day1Tasks = {
        photoTaken: false,
        weightRecorded: false,
        measurementsRecorded: false,
        communityIntroPosted: false
      };
    }

    if (!parsed.day36Tasks) {
      parsed.day36Tasks = {
        photoTaken: false,
        weightRecorded: false,
        measurementsRecorded: false,
        maintenanceRecalculated: false,
        mealPlanEdited: false,
        sprintTrackFound: false
      };
    }

    return parsed;
  } catch {
    // Unparseable stored text: keep a copy before the fresh state can overwrite it.
    backupCorruptRaw(rawForBackup);
    return getInitialState();
  }
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

type SaveFailureHandler = (error: string) => void;
let saveFailureHandler: SaveFailureHandler | null = null;
let saveFailureReported = false;

/** The App registers a callback to show a visible warning. It fires once per failure streak (reset by the next good save). */
export function setSaveFailureHandler(handler: SaveFailureHandler | null): void {
  saveFailureHandler = handler;
}

function saveFailureMessage(err: unknown): string {
  const e = err as { name?: string; code?: number } | undefined;
  if (e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014)) {
    return 'Your latest changes could not be saved: browser storage is full. Export a backup and free some space.';
  }
  if (err instanceof RangeError) return 'Your latest changes could not be saved: the data is too deeply nested.';
  return 'Your latest changes could not be saved on this device.';
}

export function saveAppState(state: AppState): SaveResult {
  if (typeof window === 'undefined') return { ok: true };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const activeUsername = getActiveUsername();
    if (activeUsername) {
      const accounts = getAllAccounts();
      if (accounts[activeUsername]) {
        accounts[activeUsername].appState = state;
        accounts[activeUsername].bodyweightKg = state.settings.bodyweightKg;
        if (state.settings.heightCm) accounts[activeUsername].heightCm = state.settings.heightCm;
        if (state.settings.gender) accounts[activeUsername].gender = state.settings.gender;
        if (state.settings.displayName) accounts[activeUsername].displayName = state.settings.displayName;
        saveAllAccounts(accounts);
      }
    }
    saveFailureReported = false;
    noteSaveOk();
    return { ok: true };
  } catch (err) {
    console.error('Failed to save state:', err);
    const error = saveFailureMessage(err);
    // Keep the unsaved state in memory so the user can download it; the next change retries the write.
    let serialized: string | null = null;
    try { serialized = JSON.stringify(state); } catch { /* too deep to serialise */ }
    noteSaveFailed(serialized, error);
    if (!saveFailureReported) {
      saveFailureReported = true;
      try { saveFailureHandler?.(error); } catch { /* ignore */ }
    }
    return { ok: false, error };
  }
}

export function calculateStreak(dailyLogs: { [day: number]: DailyLog }, currentDay: number): number {
  let streak = 0;
  for (let d = currentDay; d >= 1; d--) {
    const log = dailyLogs[d];
    if (!log) break;
    const items = Object.values(log.checklist);
    const completedCount = items.filter(Boolean).length;
    if (completedCount >= 4) {
      streak++;
    } else if (d === currentDay) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

// -------------------------------------------------------------
// USER ACCOUNTS & AUTHENTICATION STORAGE
// -------------------------------------------------------------

export const ACCOUNTS_KEY = 'bollywood_body_accounts_v1';
export const ACTIVE_USER_KEY = 'bollywood_body_active_user_v1';

export function hashPassword(password: string): string {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash) + password.charCodeAt(i);
    hash = hash & hash;
  }
  return 'bb_hash_' + Math.abs(hash).toString(36);
}

export function getAllAccounts(): { [username: string]: UserAccount } {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveAllAccounts(accounts: { [username: string]: UserAccount }): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error('Failed to save accounts:', e);
  }
}

export function getActiveUsername(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_USER_KEY);
}

export function setActiveUsername(username: string | null): void {
  if (typeof window === 'undefined') return;
  if (username) {
    localStorage.setItem(ACTIVE_USER_KEY, username.toLowerCase().trim());
  } else {
    localStorage.removeItem(ACTIVE_USER_KEY);
  }
}

export function getActiveAccount(): UserAccount | null {
  const activeUsername = getActiveUsername();
  if (!activeUsername) return null;
  const accounts = getAllAccounts();
  return accounts[activeUsername] || null;
}

export function registerAccount(params: {
  username: string;
  displayName: string;
  password: string;
  gender?: 'male' | 'female' | 'other';
  heightCm?: number;
  bodyweightKg?: number;
  avatarEmoji?: string;
  role?: 'owner' | 'coach';
}): { success: boolean; error?: string; account?: UserAccount } {
  const usernameClean = params.username.toLowerCase().trim();
  if (!usernameClean || usernameClean.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters long.' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(usernameClean)) {
    return { success: false, error: 'Username can only contain letters, numbers, and underscores.' };
  }
  if (!params.password || params.password.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters.' };
  }

  const userRole = params.role || 'owner';
  if (userRole === 'owner') {
    if (params.heightCm !== undefined && (params.heightCm < 100 || params.heightCm > 250)) {
      return { success: false, error: 'Please enter a valid height between 100 cm and 250 cm.' };
    }
    if (params.bodyweightKg !== undefined && (params.bodyweightKg < 40 || params.bodyweightKg > 200)) {
      return { success: false, error: 'Please enter a valid weight between 40 kg and 200 kg.' };
    }
  }

  const accounts = getAllAccounts();
  if (accounts[usernameClean]) {
    return { success: false, error: 'An account with this username already exists.' };
  }

  const initialAppState = getInitialState();
  initialAppState.settings.bodyweightKg = params.bodyweightKg;
  initialAppState.settings.startingWeightKg = params.bodyweightKg;
  initialAppState.settings.gender = params.gender;
  initialAppState.settings.heightCm = params.heightCm;
  initialAppState.settings.username = usernameClean;
  initialAppState.settings.displayName = params.displayName.trim() || usernameClean;
  initialAppState.settings.avatarEmoji = params.avatarEmoji || (userRole === 'coach' ? '🛡️' : '💪');
  initialAppState.settings.userRole = userRole;
  initialAppState.settings.onboardingCompleted = true;
  initialAppState.weighIns = params.bodyweightKg
    ? [{ date: getTodayDateString(), dayNumber: 1, weight: params.bodyweightKg }]
    : [];

  const newAccount: UserAccount = {
    id: 'user_' + Date.now().toString(36),
    username: usernameClean,
    displayName: params.displayName.trim() || usernameClean,
    passwordHash: hashPassword(params.password),
    gender: params.gender,
    heightCm: params.heightCm,
    bodyweightKg: params.bodyweightKg,
    avatarEmoji: params.avatarEmoji || (userRole === 'coach' ? '🛡️' : '💪'),
    createdAt: new Date().toISOString(),
    role: userRole,
    appState: initialAppState
  };

  accounts[usernameClean] = newAccount;
  saveAllAccounts(accounts);
  setActiveUsername(usernameClean);
  saveAppState(initialAppState);

  return { success: true, account: newAccount };
}

export function loginAccount(username: string, password: string): { success: boolean; error?: string; account?: UserAccount } {
  const usernameClean = username.toLowerCase().trim();
  const accounts = getAllAccounts();
  const account = accounts[usernameClean];

  if (!account) {
    return { success: false, error: 'Username not found. Check spelling or create an account.' };
  }

  const inputHash = hashPassword(password);
  if (account.passwordHash !== inputHash) {
    return { success: false, error: 'Incorrect password. Please try again.' };
  }

  setActiveUsername(usernameClean);
  saveAppState(account.appState);
  return { success: true, account };
}

export function logoutActiveUser(): void {
  setActiveUsername(null);
}

export function updateAccountProfile(username: string, updates: {
  displayName?: string;
  gender?: 'male' | 'female' | 'other';
  heightCm?: number;
  bodyweightKg?: number;
  avatarEmoji?: string;
}): UserAccount | null {
  const accounts = getAllAccounts();
  const target = accounts[username.toLowerCase().trim()];
  if (!target) return null;

  if (updates.displayName !== undefined) target.displayName = updates.displayName;
  if (updates.gender !== undefined) target.gender = updates.gender;
  if (updates.heightCm !== undefined) target.heightCm = updates.heightCm;
  if (updates.bodyweightKg !== undefined) target.bodyweightKg = updates.bodyweightKg;
  if (updates.avatarEmoji !== undefined) target.avatarEmoji = updates.avatarEmoji;

  // Also sync to target's appState settings
  if (updates.displayName !== undefined) target.appState.settings.displayName = updates.displayName;
  if (updates.gender !== undefined) target.appState.settings.gender = updates.gender;
  if (updates.heightCm !== undefined) target.appState.settings.heightCm = updates.heightCm;
  if (updates.bodyweightKg !== undefined) target.appState.settings.bodyweightKg = updates.bodyweightKg;
  if (updates.avatarEmoji !== undefined) target.appState.settings.avatarEmoji = updates.avatarEmoji;

  accounts[username.toLowerCase().trim()] = target;
  saveAllAccounts(accounts);
  return target;
}
