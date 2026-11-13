export type TabType = 'home' | 'today' | 'train' | 'eat' | 'progress' | 'learn';
export type PhaseType = 'phase1' | 'phase2' | 'phase3';

export interface ExerciseSet {
  setNumber: number;
  weight: number;
  reps: number;
  completed: boolean;
  isDropSet?: boolean;
  dropWeight?: number;
  dropReps?: number;
  dropCompleted?: boolean;
  rpeEffort?: number; // 1-10 scale
  setNotes?: string;
}

export interface ExerciseLog {
  exerciseId: string;
  name: string;
  sets: ExerciseSet[];
  notes?: string;
  tag?: '[SS]' | '[DS]' | '[GS]';
  roundNumber?: number;
}

export interface WorkoutHistory {
  [dayKey: string]: {
    phase: PhaseType;
    workoutCompleted: boolean;
    warmupCompleted: boolean;
    cooldownCompleted: boolean;
    absCompleted: boolean;
    cardioCompleted: boolean;
    cardioMinutes: number;
    cardioType?: 'LISS' | 'Sprints' | 'Walk' | 'Conditioning';
    sprintCount?: number;
    exercises: ExerciseLog[];
    totalVolumeKg: number;
    completedAt?: string;
    isRest?: boolean;
    isSkipped?: boolean;
    isModified?: boolean;
    sessionNotes?: string;
    rpeEffort?: number;
    workoutType?: string;
  };
}

export interface DailyChecklist {
  workout: boolean;
  cardio: boolean;
  water: boolean;
  photo: boolean;
  community: boolean;
  cleanEating?: boolean;
  protein?: boolean;
  fasting?: boolean;
  abs?: boolean;
  steps?: boolean;
  sleep?: boolean;
  prePostCarbs?: boolean;
}

export interface Macros {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface BodyMeasurements {
  chest: number;
  waist: number;
  hips: number;
  arms: number;
}

export interface WeighInRecord {
  date: string; // YYYY-MM-DD
  dayNumber: number; // 1 to 63
  weight: number; // kg
}

export interface MeasurementRecord {
  date: string;
  dayNumber: number;
  measurements: BodyMeasurements;
}

export interface PhotoRecord {
  date: string;
  dayNumber: number;
  dataUrl: string;
  note?: string;
}

export interface AppSettings {
  startDate?: string; // YYYY-MM-DD for Day 1
  phase2StartDate?: string; // YYYY-MM-DD for Day 8
  phase3StartDate?: string; // YYYY-MM-DD for Day 36
  activePhase: PhaseType;
  phase2Unlocked: boolean;
  phase3Unlocked: boolean;
  bodyweightKg?: number; // current / calibrated weight
  startingWeightKg?: number; // editable starting weight
  proposedGoalWeightKg?: number; // proposed goal (not medically approved)
  gender?: 'male' | 'female' | 'other';
  heightCm?: number;
  age?: number;
  trainingExperience?: string;
  equipment?: string;
  injuriesAndConstraints?: string;
  dietaryExclusions?: string;
  wakeTime?: string;
  workTime?: string;
  gymTime?: string;
  timezone?: string; // default Asia/Kolkata
  confirmedProgrammeStart?: boolean;
  username?: string;
  displayName?: string;
  avatarEmoji?: string;
  userRole?: 'owner' | 'coach';
  authorizedCoachUid?: string;
  /** Firebase UID this device's records were linked to on first cloud save; guards against attaching them to another account. */
  linkedFirebaseUid?: string;
  authorizedCoachEmail?: string;
  cloudSyncEnabled?: boolean;
  lastSyncTimestamp?: string;
  fastingStartHour: number; // 20 = 8 PM
  fastingEndHour: number; // 12 = 12 PM (16h fast)
  waterGoalMl: number; // 3000 for P1, 3500 for P2, 4000 for P3
  stepGoal: number; // default 10000
  onboardingCompleted: boolean;
}

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  gender?: 'male' | 'female' | 'other';
  heightCm?: number;
  bodyweightKg?: number;
  avatarEmoji: string;
  createdAt: string;
  appState: AppState;
  role?: 'owner' | 'coach';
  firebaseUid?: string;
  email?: string;
}

export interface DailyLog {
  date: string;
  dayNumber: number; // 1 to 63
  phase: PhaseType;
  checklist: DailyChecklist;
  macrosConsumed: Macros;
  waterMl: number;
  steps: number;
  sleepHours?: number;
  /** Per-metric flags: true = user confirmed they entered it, false = user reviewed and rejected it, undefined = never recorded/legacy. */
  entered?: Partial<Record<'sleep' | 'calories' | 'protein' | 'steps' | 'water' | 'energy', boolean>>;
  /** Provenance from a consented legacy repair: the date this record held before it was re-derived (see utils/legacyRepair). */
  legacyDate?: string;
  /** Provenance from a consented legacy repair: the unconfirmed sleep value cleared from this record. */
  legacySleepHours?: number;
  addedCarbs?: string[];
  plannedMacros?: Macros;
  plannedWaterMl?: number;
  plannedSteps?: number;
  plannedSleepHours?: number;
  energyRating?: number; // 1-10 subjective scale
  hungerRating?: number; // 1-5 scale
  sorenessRating?: number; // 1-5 scale
  painOrIllnessNotes?: string;
  generalNotes?: string;
  isRestDay?: boolean;
  isSkipped?: boolean;
  isModified?: boolean;
  mealEstimates?: Array<{
    id: string;
    name: string;
    estimateCalories: number;
    estimateProtein: number;
    estimateCarbs?: number;
    estimateFat?: number;
    isEstimateOnly: boolean;
    notes?: string;
  }>;
  supplements: {
    whey: boolean;
    creatine: boolean;
    multivitamin: boolean;
    vitaminD3: boolean;
    carnitine: boolean;
    acv: boolean;
  };
  notes?: string;
}

export interface AppState {
  /** Stored-data schema version; absent on legacy data. Migrations only fill missing structure. */
  schemaVersion?: number;
  settings: AppSettings;
  currentDayNumber: number; // 1 to 63
  selectedDayNumber: number; // 1 to 63
  dailyLogs: { [dayNumber: number]: DailyLog };
  workoutLogs: WorkoutHistory;
  weighIns: WeighInRecord[];
  measurementHistory: MeasurementRecord[];
  photos: PhotoRecord[];
  learnedLessonIds: string[];
  quizAnswers: { [lessonId: string]: number };
  avoidedMistakes: { [mistakeId: string]: boolean };
  day1Tasks?: {
    photoTaken: boolean;
    weightRecorded: boolean;
    measurementsRecorded: boolean;
    communityIntroPosted: boolean;
  };
  day36Tasks?: {
    photoTaken: boolean;
    weightRecorded: boolean;
    measurementsRecorded: boolean;
    maintenanceRecalculated: boolean;
    mealPlanEdited: boolean;
    sprintTrackFound: boolean;
  };
}

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'success' | 'info' | 'warning';
  undoAction?: () => void;
}
