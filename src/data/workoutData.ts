import { PhaseType } from '../types';

export interface ExerciseDef {
  id: string;
  name: string;
  targetSets: number;
  targetReps: string;
  repCount: number;
  isCompound: boolean;
  restSeconds: number;
  tempo: string;
  defaultWeight: number;
  targetMuscle: string;
  instructions: string;
  tag?: '[SS]' | '[DS]' | '[GS]';
  isDropSet?: boolean;
  supersetPairId?: string;
  giantSetGroup?: 'A' | 'B';
  giantSetOrder?: number;
}

export interface AbExerciseDef {
  id: string;
  name: string;
  targetSets: number;
  targetReps: string;
  isTimed: boolean;
  timerSeconds?: number;
  cue: string;
}

export interface WarmupItem {
  id: string;
  name: string;
  detail: string;
  duration?: string;
}

export interface CooldownStretch {
  id: string;
  name: string;
  holdSeconds: number;
  cue: string;
}

// -------------------------------------------------------------
// PHASE 1 EXERCISES (Days 1 to 7 - Full Body Foundation)
// -------------------------------------------------------------

export const PHASE_1_FULL_BODY_EXERCISES: ExerciseDef[] = [
  {
    id: 'p1-1',
    name: 'Incline Dumbbell Press',
    targetSets: 3,
    targetReps: '12-15 reps',
    repCount: 15,
    isCompound: true,
    restSeconds: 75,
    tempo: 'Controlled form, feel chest squeeze',
    defaultWeight: 14,
    targetMuscle: 'Upper Chest',
    instructions: 'Set bench to 30 degrees. Focus on learning form and feeling the muscle work without swinging.'
  },
  {
    id: 'p1-2',
    name: 'Pec Deck Fly',
    targetSets: 3,
    targetReps: '12-15 reps',
    repCount: 15,
    isCompound: false,
    restSeconds: 60,
    tempo: '2s stretch, 1s peak squeeze',
    defaultWeight: 25,
    targetMuscle: 'Mid & Inner Chest',
    instructions: 'Keep slight bend in elbows. Bring pads/handles together smoothly, squeeze chest at center.'
  },
  {
    id: 'p1-3',
    name: 'Lat Pulldown',
    targetSets: 3,
    targetReps: '12-15 reps',
    repCount: 15,
    isCompound: true,
    restSeconds: 75,
    tempo: 'Controlled pull, slow return',
    defaultWeight: 35,
    targetMuscle: 'Back & Lats',
    instructions: 'Grip slightly wider than shoulders. Pull bar down to upper chest, drive elbows down.'
  },
  {
    id: 'p1-4',
    name: 'Face Pulls',
    targetSets: 3,
    targetReps: '15-20 reps',
    repCount: 15,
    isCompound: false,
    restSeconds: 60,
    tempo: 'Smooth squeeze to ears',
    defaultWeight: 15,
    targetMuscle: 'Rear Delts & Upper Back',
    instructions: 'Set pulley to eye level. Pull rope attachment toward forehead, rotate thumbs backward.'
  },
  {
    id: 'p1-5',
    name: 'Leg Extension',
    targetSets: 3,
    targetReps: '12-15 reps',
    repCount: 15,
    isCompound: false,
    restSeconds: 60,
    tempo: 'Pause at top, 2s lower',
    defaultWeight: 30,
    targetMuscle: 'Quadriceps',
    instructions: 'Extend legs until parallel to floor, pause for 1 second, lower with full control.'
  },
  {
    id: 'p1-6',
    name: 'Leg Curl',
    targetSets: 3,
    targetReps: '12-15 reps',
    repCount: 15,
    isCompound: false,
    restSeconds: 60,
    tempo: 'Controlled curl to glutes',
    defaultWeight: 25,
    targetMuscle: 'Hamstrings',
    instructions: 'Curl pad smoothly toward glutes, squeeze hamstrings, resist weight on the way down.'
  },
  {
    id: 'p1-7',
    name: 'Calf Raises',
    targetSets: 3,
    targetReps: '15-20 reps',
    repCount: 20,
    isCompound: false,
    restSeconds: 60,
    tempo: 'Full stretch, 1s peak hold',
    defaultWeight: 30,
    targetMuscle: 'Calves',
    instructions: 'Lower heels below step for deep stretch, rise high on balls of feet, squeeze calves.'
  },
  {
    id: 'p1-8',
    name: 'Lateral Delt Raises',
    targetSets: 3,
    targetReps: '12-15 reps',
    repCount: 15,
    isCompound: false,
    restSeconds: 60,
    tempo: 'No swinging, light weight',
    defaultWeight: 6,
    targetMuscle: 'Shoulders (Side Delts)',
    instructions: 'Use light weight. Lead with elbows, raise dumbbells to shoulder height, lower slowly.'
  },
  {
    id: 'p1-9',
    name: 'Plank',
    targetSets: 3,
    targetReps: '30-60 sec',
    repCount: 45,
    isCompound: false,
    restSeconds: 60,
    tempo: 'Static hold',
    defaultWeight: 0,
    targetMuscle: 'Core & Abdominal Wall',
    instructions: 'Forearms and toes on floor. Straight line from head to heels. Squeeze glutes and brace core.'
  },
  {
    id: 'p1-10',
    name: 'Cardio (Conditioning)',
    targetSets: 1,
    targetReps: '10-15 min',
    repCount: 15,
    isCompound: false,
    restSeconds: 0,
    tempo: 'Moderate conversation pace',
    defaultWeight: 0,
    targetMuscle: 'Cardiovascular Conditioning',
    instructions: 'Treadmill walk or jog, stationary cycling, cross trainer, or brisk walking. Keep intensity conversational.'
  }
];

// -------------------------------------------------------------
// PHASE 2 EXERCISES (Days 8 to 35)
// -------------------------------------------------------------

export const PUSH_EXERCISES_P2: ExerciseDef[] = [
  {
    id: 'p2-push-1',
    name: 'Incline Bench Press',
    targetSets: 3,
    targetReps: '10 reps',
    repCount: 10,
    isCompound: true,
    restSeconds: 90,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 50,
    targetMuscle: 'Upper Chest & Front Delts',
    instructions: 'Set bench to 30 degrees. Retract shoulder blades, lower bar with control to upper chest.'
  },
  {
    id: 'p2-push-2',
    name: 'Incline DB Press',
    targetSets: 3,
    targetReps: '12 reps',
    repCount: 12,
    isCompound: true,
    restSeconds: 90,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 20,
    targetMuscle: 'Upper Chest',
    instructions: 'Keep elbows at a 45 degree angle. Squeeze chest at the top without clinking dumbbells.'
  },
  {
    id: 'p2-push-3',
    name: 'Flat DB Fly',
    targetSets: 3,
    targetReps: '15 reps',
    repCount: 15,
    isCompound: false,
    restSeconds: 60,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 12,
    targetMuscle: 'Chest Stretch & Squeeze',
    instructions: 'Slight bend in elbows. Feel a deep stretch across the chest, then bring hands together.'
  },
  {
    id: 'p2-push-4',
    name: 'Machine Incline Press',
    targetSets: 3,
    targetReps: '12 reps',
    repCount: 12,
    isCompound: false,
    restSeconds: 60,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 45,
    targetMuscle: 'Upper Chest Isolation',
    instructions: 'Adjust seat so handles align with upper chest. Press smoothly to near lock.'
  },
  {
    id: 'p2-push-5',
    name: 'DB Shoulder Press',
    targetSets: 3,
    targetReps: '10 reps',
    repCount: 10,
    isCompound: true,
    restSeconds: 90,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 16,
    targetMuscle: 'Anterior & Lateral Delts',
    instructions: 'Seated upright. Press dumbbells directly overhead, lower to ear level with control.'
  },
  {
    id: 'p2-push-6',
    name: 'Side Lateral Raises',
    targetSets: 3,
    targetReps: '15 reps',
    repCount: 15,
    isCompound: false,
    restSeconds: 60,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 7.5,
    targetMuscle: 'Lateral Deltoids',
    instructions: 'Lead with elbows, slight forward tilt, pause for 1 second at parallel.'
  },
  {
    id: 'p2-push-7',
    name: 'Tricep Pushdown',
    targetSets: 3,
    targetReps: '12 reps',
    repCount: 12,
    isCompound: false,
    restSeconds: 60,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 25,
    targetMuscle: 'Triceps Lateral Head',
    instructions: 'Pin elbows to ribs. Extend arms fully and flare slightly outward.'
  },
  {
    id: 'p2-push-8',
    name: 'Skull Crushers',
    targetSets: 3,
    targetReps: '12 reps',
    repCount: 12,
    isCompound: false,
    restSeconds: 60,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 20,
    targetMuscle: 'Triceps Long Head',
    instructions: 'Lower EZ bar or dumbbells toward forehead or crown of head, hinge strictly at elbows.'
  }
];

export const PULL_EXERCISES_P2: ExerciseDef[] = [
  {
    id: 'p2-pull-1',
    name: 'Lat Pulldown',
    targetSets: 3,
    targetReps: '12 reps',
    repCount: 12,
    isCompound: true,
    restSeconds: 90,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 45,
    targetMuscle: 'Latissimus Dorsi',
    instructions: 'Grip outside shoulder width. Pull bar down to upper clavicle, drive elbows downward.'
  },
  {
    id: 'p2-pull-2',
    name: 'T-Bar Row',
    targetSets: 3,
    targetReps: '12 reps',
    repCount: 12,
    isCompound: true,
    restSeconds: 90,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 35,
    targetMuscle: 'Mid-Back & Rhomboids',
    instructions: 'Hinge hips back at 45 degrees. Pull handle into belly button, squeeze shoulder blades.'
  },
  {
    id: 'p2-pull-3',
    name: 'Seated Cable Row',
    targetSets: 3,
    targetReps: '12 reps',
    repCount: 12,
    isCompound: true,
    restSeconds: 90,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 45,
    targetMuscle: 'Mid & Lower Lats',
    instructions: 'Keep spine neutral. Pull close grip handle to lower ribcage, avoid rocking torso.'
  },
  {
    id: 'p2-pull-4',
    name: 'Face Pulls',
    targetSets: 3,
    targetReps: '12 reps',
    repCount: 12,
    isCompound: false,
    restSeconds: 60,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 17.5,
    targetMuscle: 'Rear Delts & Rotator Cuff',
    instructions: 'Set pulley to eye level. Pull rope toward forehead while externally rotating thumbs back.'
  },
  {
    id: 'p2-pull-5',
    name: 'DB Shrugs',
    targetSets: 3,
    targetReps: '15 reps',
    repCount: 15,
    isCompound: false,
    restSeconds: 60,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 22,
    targetMuscle: 'Upper Trapezius',
    instructions: 'Elevate shoulders directly toward ears. Hold top squeeze for 1 second. No rolling.'
  },
  {
    id: 'p2-pull-6',
    name: 'DB Bicep Curls',
    targetSets: 3,
    targetReps: '12 reps',
    repCount: 12,
    isCompound: false,
    restSeconds: 60,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 12,
    targetMuscle: 'Biceps Brachii',
    instructions: 'Supinate wrist as you curl upward. Keep elbows tucked stationary by ribs.'
  },
  {
    id: 'p2-pull-7',
    name: 'Preacher Curls',
    targetSets: 3,
    targetReps: '12 reps',
    repCount: 12,
    isCompound: false,
    restSeconds: 60,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 20,
    targetMuscle: 'Biceps Short Head',
    instructions: 'Lock armpits into preacher pad. Full controlled extension down to full stretch.'
  }
];

export const LEGS_EXERCISES_P2: ExerciseDef[] = [
  {
    id: 'p2-legs-1',
    name: 'Barbell Squats',
    targetSets: 4,
    targetReps: '10 reps',
    repCount: 10,
    isCompound: true,
    restSeconds: 90,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 60,
    targetMuscle: 'Quadriceps & Glutes',
    instructions: 'Brace core, break at hips and knees simultaneously. Depth to parallel or below.'
  },
  {
    id: 'p2-legs-2',
    name: 'Leg Extension',
    targetSets: 3,
    targetReps: '15 reps',
    repCount: 15,
    isCompound: false,
    restSeconds: 60,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 40,
    targetMuscle: 'Quadriceps Isolation',
    instructions: 'Extend legs fully, squeeze quads hard at the apex, resist weight downward for 3s.'
  },
  {
    id: 'p2-legs-3',
    name: 'Leg Press',
    targetSets: 3,
    targetReps: '12 reps',
    repCount: 12,
    isCompound: true,
    restSeconds: 90,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 120,
    targetMuscle: 'Quads & Glutes Volume',
    instructions: 'Feet shoulder-width on carriage. Lower until knees reach 90 degrees. Never lock knees.'
  },
  {
    id: 'p2-legs-4',
    name: 'Leg Curls',
    targetSets: 3,
    targetReps: '12 reps',
    repCount: 12,
    isCompound: false,
    restSeconds: 60,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 35,
    targetMuscle: 'Hamstrings',
    instructions: 'Lie prone or seated. Curl heel smoothly to glute, hold 1s peak contraction.'
  },
  {
    id: 'p2-legs-5',
    name: 'Walking Lunges',
    targetSets: 3,
    targetReps: '20 steps total',
    repCount: 20,
    isCompound: true,
    restSeconds: 90,
    tempo: 'Controlled steps',
    defaultWeight: 14,
    targetMuscle: 'Glutes, Hamstrings & Balance',
    instructions: 'Step forward into deep lunge. Back knee just touches the floor. Drive through front heel.'
  },
  {
    id: 'p2-legs-6',
    name: 'Calf Raises',
    targetSets: 3,
    targetReps: '15 reps',
    repCount: 15,
    isCompound: false,
    restSeconds: 60,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 40,
    targetMuscle: 'Calves',
    instructions: 'Full stretch at bottom, press up onto balls of feet, hold 2s at the top.'
  },
  {
    id: 'p2-legs-7',
    name: 'Back Extension',
    targetSets: 3,
    targetReps: '15 reps',
    repCount: 15,
    isCompound: false,
    restSeconds: 60,
    tempo: '3s down, 1s pause, 2s up',
    defaultWeight: 0,
    targetMuscle: 'Lower Back & Glutes',
    instructions: 'On 45-degree hyperextension bench. Bend at hips, raise torso in line with legs.'
  }
];

// -------------------------------------------------------------
// PHASE 3 EXERCISES (Days 36 to 63)
// -------------------------------------------------------------

export const PHASE_3_WORKOUTS: { [key: string]: { title: string; cardio: string; cardioType: 'LISS' | 'Sprints' | 'Walk'; exercises: ExerciseDef[] } } = {
  Push: {
    title: 'Phase 3: Push (Chest, Shoulders, Triceps)',
    cardio: 'LISS 15 min (treadmill incline walk, cycling, or cross trainer)',
    cardioType: 'LISS',
    exercises: [
      {
        id: 'p3-push-1',
        name: 'Incline Barbell Press',
        targetSets: 4,
        targetReps: '8-10 reps',
        repCount: 10,
        isCompound: true,
        restSeconds: 90,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 55,
        targetMuscle: 'Upper Chest',
        instructions: '30-45 degree incline, control down, arch back slightly, touch upper chest.'
      },
      {
        id: 'p3-push-2',
        name: 'Flat DB Press',
        targetSets: 3,
        targetReps: '10-12 reps',
        repCount: 12,
        isCompound: true,
        restSeconds: 90,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 24,
        targetMuscle: 'Mid Chest',
        instructions: 'Full stretch at bottom, press dumbbells up in arc without clinking at top.'
      },
      {
        id: 'p3-push-3',
        name: 'Cable Fly (Low to High)',
        targetSets: 3,
        targetReps: '12-15 reps',
        repCount: 15,
        isCompound: false,
        restSeconds: 0,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 12.5,
        targetMuscle: 'Upper Chest Squeeze',
        instructions: 'Squeeze chest at top, keep slight elbow bend. Superset with Push-Ups immediately.',
        tag: '[SS]',
        supersetPairId: 'p3-push-4'
      },
      {
        id: 'p3-push-4',
        name: 'Push-Ups [SS]',
        targetSets: 3,
        targetReps: 'To Failure',
        repCount: 15,
        isCompound: false,
        restSeconds: 90,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 0,
        targetMuscle: 'Chest, Triceps & Core Burnout',
        instructions: 'Immediately after Cable Fly. Full lockout to chest touching floor. Rest 90s after both.',
        tag: '[SS]',
        supersetPairId: 'p3-push-3'
      },
      {
        id: 'p3-push-5',
        name: 'Seated DB Shoulder Press',
        targetSets: 3,
        targetReps: '10-12 reps',
        repCount: 12,
        isCompound: true,
        restSeconds: 90,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 18,
        targetMuscle: 'Front & Side Delts',
        instructions: 'Don’t lock elbows at top, keep tension continuously on delts.'
      },
      {
        id: 'p3-push-6',
        name: 'Lateral Raises [DS]',
        targetSets: 3,
        targetReps: '15 reps',
        repCount: 15,
        isCompound: false,
        restSeconds: 60,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 9,
        targetMuscle: 'Side Delts',
        instructions: 'Lead with elbows. Drop set on last set only: drop weight 30-40% and push to failure.',
        tag: '[DS]',
        isDropSet: true
      },
      {
        id: 'p3-push-7',
        name: 'Tricep Rope Pushdown [DS]',
        targetSets: 3,
        targetReps: '12 reps',
        repCount: 12,
        isCompound: false,
        restSeconds: 60,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 25,
        targetMuscle: 'Triceps Horseshoe',
        instructions: 'Elbows pinned to sides, spread rope at bottom. Drop set on last set only (drop 30-40%).',
        tag: '[DS]',
        isDropSet: true
      }
    ]
  },

  Pull: {
    title: 'Phase 3: Pull (Back, Biceps, Rear Delts)',
    cardio: 'Sprints: 4-6 x 100-150m full effort with 60-90s walk back',
    cardioType: 'Sprints',
    exercises: [
      {
        id: 'p3-pull-1',
        name: 'Deadlift / Rack Pulls',
        targetSets: 4,
        targetReps: '6-8 reps',
        repCount: 8,
        isCompound: true,
        restSeconds: 90,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 90,
        targetMuscle: 'Posterior Chain & Traps',
        instructions: 'Hinge at hips first, keep bar close to body, flat back, drive through heels.'
      },
      {
        id: 'p3-pull-2',
        name: 'Weighted Pull-Ups / Lat Pulldown',
        targetSets: 3,
        targetReps: '8-10 reps',
        repCount: 10,
        isCompound: true,
        restSeconds: 90,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 50,
        targetMuscle: 'Lats Width',
        instructions: 'Full stretch at top, pull to upper clavicle, drive elbows downward.'
      },
      {
        id: 'p3-pull-3',
        name: 'T-Bar Row',
        targetSets: 3,
        targetReps: '10-12 reps',
        repCount: 12,
        isCompound: true,
        restSeconds: 90,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 40,
        targetMuscle: 'Mid Back Thickness',
        instructions: 'Chest firmly on pad, squeeze shoulder blades at the top.'
      },
      {
        id: 'p3-pull-4',
        name: 'Seated Cable Row [SS]',
        targetSets: 3,
        targetReps: '12 reps',
        repCount: 12,
        isCompound: true,
        restSeconds: 0,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 45,
        targetMuscle: 'Lats & Rhomboids',
        instructions: 'Pull to belly button. Superset immediately into Face Pulls.',
        tag: '[SS]',
        supersetPairId: 'p3-pull-5'
      },
      {
        id: 'p3-pull-5',
        name: 'Face Pulls [SS]',
        targetSets: 3,
        targetReps: '15 reps',
        repCount: 15,
        isCompound: false,
        restSeconds: 90,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 20,
        targetMuscle: 'Rear Delts & Rotator Cuff',
        instructions: 'Pull to face and externally rotate hands back. Rest 90s after completing both.',
        tag: '[SS]',
        supersetPairId: 'p3-pull-4'
      },
      {
        id: 'p3-pull-6',
        name: 'Barbell Curls',
        targetSets: 3,
        targetReps: '10-12 reps',
        repCount: 12,
        isCompound: false,
        restSeconds: 60,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 25,
        targetMuscle: 'Biceps Peak',
        instructions: 'Elbows pinned to sides, zero body swinging, slow 2s negative.'
      },
      {
        id: 'p3-pull-7',
        name: 'Hammer Curls [DS]',
        targetSets: 3,
        targetReps: '12 reps',
        repCount: 12,
        isCompound: false,
        restSeconds: 60,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 14,
        targetMuscle: 'Brachialis & Forearms',
        instructions: 'Neutral grip. Drop set on last set only: drop weight 30-40% and curl to failure.',
        tag: '[DS]',
        isDropSet: true
      }
    ]
  },

  Legs: {
    title: 'Phase 3: Legs (Quads, Hamstrings, Glutes, Calves)',
    cardio: 'LISS 15 min (treadmill incline walk, cycling, or cross trainer)',
    cardioType: 'LISS',
    exercises: [
      {
        id: 'p3-legs-1',
        name: 'Barbell Squats',
        targetSets: 4,
        targetReps: '8-10 reps',
        repCount: 10,
        isCompound: true,
        restSeconds: 90,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 70,
        targetMuscle: 'Quads & Glutes',
        instructions: 'Below parallel depth, chest tall, drive forcefully through heels.'
      },
      {
        id: 'p3-legs-2',
        name: 'Romanian Deadlifts (RDL)',
        targetSets: 3,
        targetReps: '10-12 reps',
        repCount: 12,
        isCompound: true,
        restSeconds: 90,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 60,
        targetMuscle: 'Hamstrings & Glutes',
        instructions: 'Slight knee bend, push hips far back, feel deep stretch in hamstrings.'
      },
      {
        id: 'p3-legs-3',
        name: 'Leg Press [DS]',
        targetSets: 3,
        targetReps: '12 reps',
        repCount: 12,
        isCompound: true,
        restSeconds: 90,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 140,
        targetMuscle: 'Quads & Glutes Volume',
        instructions: 'Don’t lock knees at top. Drop set on last set only: strip 30-40% and rep out.',
        tag: '[DS]',
        isDropSet: true
      },
      {
        id: 'p3-legs-4',
        name: 'Walking Lunges',
        targetSets: 3,
        targetReps: '12 each leg',
        repCount: 24,
        isCompound: true,
        restSeconds: 90,
        tempo: 'Controlled steps',
        defaultWeight: 16,
        targetMuscle: 'Quads & Glutes',
        instructions: 'Long stride, back knee touches floor softly, drive with front heel.'
      },
      {
        id: 'p3-legs-5',
        name: 'Leg Extension [SS]',
        targetSets: 3,
        targetReps: '15 reps',
        repCount: 15,
        isCompound: false,
        restSeconds: 0,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 45,
        targetMuscle: 'Quads Isolation',
        instructions: 'Squeeze hard at top. Superset immediately into Leg Curls.',
        tag: '[SS]',
        supersetPairId: 'p3-legs-6'
      },
      {
        id: 'p3-legs-6',
        name: 'Leg Curls [SS]',
        targetSets: 3,
        targetReps: '15 reps',
        repCount: 15,
        isCompound: false,
        restSeconds: 60,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 40,
        targetMuscle: 'Hamstrings',
        instructions: 'Full contraction, slow 2s negative. Rest 60s after superset pair.',
        tag: '[SS]',
        supersetPairId: 'p3-legs-5'
      },
      {
        id: 'p3-legs-7',
        name: 'Calf Raises [DS]',
        targetSets: 4,
        targetReps: '15-20 reps',
        repCount: 20,
        isCompound: false,
        restSeconds: 60,
        tempo: '3s down, 1s pause, 1s up',
        defaultWeight: 50,
        targetMuscle: 'Calves',
        instructions: 'Full stretch at bottom for 3s, hold top for 1s. Drop set on last set.',
        tag: '[DS]',
        isDropSet: true
      },
      {
        id: 'p3-legs-8',
        name: 'Plank',
        targetSets: 3,
        targetReps: '60 sec',
        repCount: 60,
        isCompound: false,
        restSeconds: 60,
        tempo: 'Static hold',
        defaultWeight: 0,
        targetMuscle: 'Core Stability',
        instructions: 'Core tight, do not sag hips. Brace firmly.'
      }
    ]
  },

  ChestBack: {
    title: 'Phase 3: Chest + Back (Giant Sets for Maximum Pump)',
    cardio: 'Sprints: 4-6 x 100-150m full effort with 60-90s walk back',
    cardioType: 'Sprints',
    exercises: [
      {
        id: 'p3-cb-a1',
        name: 'Incline DB Press [GS]',
        targetSets: 3,
        targetReps: '10-12 reps',
        repCount: 12,
        isCompound: true,
        restSeconds: 0,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 22,
        targetMuscle: 'Upper Chest',
        instructions: 'Giant Set A1: Incline DB Press. Squeeze at top, immediately proceed to Lat Pulldown.',
        tag: '[GS]',
        giantSetGroup: 'A',
        giantSetOrder: 1
      },
      {
        id: 'p3-cb-a2',
        name: 'Lat Pulldown [GS]',
        targetSets: 3,
        targetReps: '10-12 reps',
        repCount: 12,
        isCompound: true,
        restSeconds: 0,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 45,
        targetMuscle: 'Back Width',
        instructions: 'Giant Set A2: Lat Pulldown. Pull to upper chest, immediately proceed to Pullovers.',
        tag: '[GS]',
        giantSetGroup: 'A',
        giantSetOrder: 2
      },
      {
        id: 'p3-cb-a3',
        name: 'Dumbbell Pullovers [GS]',
        targetSets: 3,
        targetReps: '12-15 reps',
        repCount: 15,
        isCompound: false,
        restSeconds: 90,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 18,
        targetMuscle: 'Chest & Lat Tie-In',
        instructions: 'Giant Set A3: DB Pullovers. Feel deep stretch. Rest 90 seconds after all three.',
        tag: '[GS]',
        giantSetGroup: 'A',
        giantSetOrder: 3
      },
      {
        id: 'p3-cb-b1',
        name: 'Pec Deck / Cable Fly [GS]',
        targetSets: 3,
        targetReps: '12-15 reps',
        repCount: 15,
        isCompound: false,
        restSeconds: 0,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 35,
        targetMuscle: 'Chest Peak Contraction',
        instructions: 'Giant Set B1: Cable Fly / Pec Deck. Squeeze at peak, move immediately to Cable Row.',
        tag: '[GS]',
        giantSetGroup: 'B',
        giantSetOrder: 1
      },
      {
        id: 'p3-cb-b2',
        name: 'Seated Cable Row [GS]',
        targetSets: 3,
        targetReps: '10-12 reps',
        repCount: 12,
        isCompound: true,
        restSeconds: 0,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 45,
        targetMuscle: 'Mid Back',
        instructions: 'Giant Set B2: Seated Cable Row. Pull to belly, immediately drop down to Push-Ups.',
        tag: '[GS]',
        giantSetGroup: 'B',
        giantSetOrder: 2
      },
      {
        id: 'p3-cb-b3',
        name: 'Push-Ups [GS]',
        targetSets: 3,
        targetReps: 'To Failure',
        repCount: 15,
        isCompound: false,
        restSeconds: 90,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 0,
        targetMuscle: 'Chest & Triceps Burnout',
        instructions: 'Giant Set B3: Push-Ups to failure. Finish strong. Rest 90s after all three.',
        tag: '[GS]',
        giantSetGroup: 'B',
        giantSetOrder: 3
      }
    ]
  },

  ArmsDelts: {
    title: 'Phase 3: Arms & Delts (Biceps, Triceps, Shoulders)',
    cardio: 'LISS 15 min (treadmill walk, cycling, or cross trainer)',
    cardioType: 'LISS',
    exercises: [
      {
        id: 'p3-ad-a1',
        name: 'Barbell Curl [SS]',
        targetSets: 3,
        targetReps: '10-12 reps',
        repCount: 12,
        isCompound: false,
        restSeconds: 0,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 25,
        targetMuscle: 'Biceps',
        instructions: 'Superset A1: Barbell Curl. Immediately switch to Skull Crushers.',
        tag: '[SS]',
        supersetPairId: 'p3-ad-a2'
      },
      {
        id: 'p3-ad-a2',
        name: 'Skull Crushers [SS]',
        targetSets: 3,
        targetReps: '10-12 reps',
        repCount: 12,
        isCompound: false,
        restSeconds: 60,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 22,
        targetMuscle: 'Triceps',
        instructions: 'Superset A2: Skull Crushers. Keep elbows pointed to ceiling. Rest 60s after both.',
        tag: '[SS]',
        supersetPairId: 'p3-ad-a1'
      },
      {
        id: 'p3-ad-b1',
        name: 'Preacher Curls [SS]',
        targetSets: 3,
        targetReps: '12 reps',
        repCount: 12,
        isCompound: false,
        restSeconds: 0,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 20,
        targetMuscle: 'Biceps Peak',
        instructions: 'Superset B1: Preacher Curls. Immediately switch to Tricep Rope Pushdown.',
        tag: '[SS]',
        supersetPairId: 'p3-ad-b2'
      },
      {
        id: 'p3-ad-b2',
        name: 'Tricep Rope Pushdown [SS]',
        targetSets: 3,
        targetReps: '12 reps',
        repCount: 12,
        isCompound: false,
        restSeconds: 60,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 25,
        targetMuscle: 'Triceps',
        instructions: 'Superset B2: Tricep Rope Pushdown. Spread rope at bottom. Rest 60s after both.',
        tag: '[SS]',
        supersetPairId: 'p3-ad-b1'
      },
      {
        id: 'p3-ad-c1',
        name: 'Hammer Curls [SS/DS]',
        targetSets: 3,
        targetReps: '12 reps',
        repCount: 12,
        isCompound: false,
        restSeconds: 0,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 14,
        targetMuscle: 'Biceps & Brachialis',
        instructions: 'Superset C1: Hammer Curls. On round 3, drop set 30-40%. Then do Overhead Tricep Extension.',
        tag: '[DS]',
        isDropSet: true,
        supersetPairId: 'p3-ad-c2'
      },
      {
        id: 'p3-ad-c2',
        name: 'Overhead Tricep Extension [SS/DS]',
        targetSets: 3,
        targetReps: '12 reps',
        repCount: 12,
        isCompound: false,
        restSeconds: 60,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 20,
        targetMuscle: 'Triceps Long Head',
        instructions: 'Superset C2: Overhead Extension. On round 3, drop set 30-40%. Rest 60s after both.',
        tag: '[DS]',
        isDropSet: true,
        supersetPairId: 'p3-ad-c1'
      },
      {
        id: 'p3-ad-s1',
        name: 'Seated DB Shoulder Press',
        targetSets: 3,
        targetReps: '10-12 reps',
        repCount: 12,
        isCompound: true,
        restSeconds: 90,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 18,
        targetMuscle: 'Front/Side Delts',
        instructions: 'Press dumbbells overhead, do not lock out elbows, keep constant tension on delts.'
      },
      {
        id: 'p3-ad-s2',
        name: 'Lateral Raises [DS]',
        targetSets: 3,
        targetReps: '15 reps',
        repCount: 15,
        isCompound: false,
        restSeconds: 60,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 8,
        targetMuscle: 'Side Delts',
        instructions: 'Lead with elbows. Drop set on last set only: drop weight 30-40% and rep to failure.',
        tag: '[DS]',
        isDropSet: true
      },
      {
        id: 'p3-ad-s3',
        name: 'Rear Delt Fly / Face Pulls',
        targetSets: 3,
        targetReps: '15 reps',
        repCount: 15,
        isCompound: false,
        restSeconds: 60,
        tempo: '2s down, 1s pause, 1s up',
        defaultWeight: 15,
        targetMuscle: 'Rear Delts',
        instructions: 'Isolate posterior deltoids, squeeze at contraction, do not use torso momentum.'
      }
    ]
  }
};

// -------------------------------------------------------------
// ABS ROTATION (Days 1 to 6)
// -------------------------------------------------------------

export const ABS_BY_SLOT: { [slot: number]: AbExerciseDef[] } = {
  0: [
    { id: 'abs-0-1', name: 'Crunches', targetSets: 3, targetReps: '20 reps', isTimed: false, cue: 'Slow controlled reps, breathe out on contraction.' },
    { id: 'abs-0-2', name: 'Toe Touches', targetSets: 3, targetReps: '15 reps', isTimed: false, cue: 'Legs perpendicular to floor, reach fingertips toward toes.' }
  ],
  1: [
    { id: 'abs-1-1', name: 'Reverse Crunches', targetSets: 3, targetReps: '15 reps', isTimed: false, cue: 'Tilt pelvis back, lift hips off floor using lower abs.' },
    { id: 'abs-1-2', name: 'Leg Raises', targetSets: 3, targetReps: '12 reps', isTimed: false, cue: 'Keep lower back firmly pressed into mat.' }
  ],
  2: [
    { id: 'abs-2-1', name: 'Bicycle Crunches', targetSets: 3, targetReps: '20 each side', isTimed: false, cue: 'Rotate shoulder toward opposite knee, do not yank neck.' },
    { id: 'abs-2-2', name: 'Side Plank', targetSets: 3, targetReps: '30 sec each side', isTimed: true, timerSeconds: 30, cue: 'Keep straight line from head to heels.' }
  ],
  3: [
    { id: 'abs-3-1', name: 'Plank', targetSets: 3, targetReps: '45-60 sec', isTimed: true, timerSeconds: 60, cue: 'Squeeze glutes and core, hold neutral spine.' },
    { id: 'abs-3-2', name: 'Dead Bug', targetSets: 3, targetReps: '12 each side', isTimed: false, cue: 'Opposite arm and leg lower slowly, keep back flat.' }
  ],
  4: [
    { id: 'abs-4-1', name: 'V-Ups', targetSets: 3, targetReps: '12 reps', isTimed: false, cue: 'Simultaneously lift torso and legs into V shape.' },
    { id: 'abs-4-2', name: 'Mountain Climbers', targetSets: 3, targetReps: '30 sec', isTimed: true, timerSeconds: 30, cue: 'Drive knees toward chest with steady controlled cadence.' }
  ],
  5: [
    { id: 'abs-5-1', name: 'Crunches', targetSets: 3, targetReps: '20 reps', isTimed: false, cue: 'Slow controlled reps, breathe out on contraction.' },
    { id: 'abs-5-2', name: 'Plank', targetSets: 3, targetReps: '45-60 sec', isTimed: true, timerSeconds: 60, cue: 'Brace core firmly like taking a punch.' }
  ],
  6: []
};

// -------------------------------------------------------------
// WARM-UP & COOL-DOWN ROUTINES
// -------------------------------------------------------------

export const WARMUPS: { [type: string]: WarmupItem[] } = {
  FullBody: [
    { id: 'w-fb-1', name: 'Light Cardio', detail: '3-5 min treadmill walk, light jog, or cycle' },
    { id: 'w-fb-2', name: 'Arm Circles', detail: '15 forward + 15 backward to mobilize shoulders' },
    { id: 'w-fb-3', name: 'Bodyweight Squats', detail: '15 slow squats to warm up knees and hips' },
    { id: 'w-fb-4', name: 'Cat-Cow Mobility', detail: '10 cycles on hands and knees to mobilize spine' }
  ],
  Push: [
    { id: 'w-p-1', name: 'Cardio Warm-up', detail: '3 min treadmill or cross trainer easy jog', duration: '3 min' },
    { id: 'w-p-2', name: 'Arm Circles', detail: '15 reps each way (forward and backward)' },
    { id: 'w-p-3', name: 'Band Pull-Aparts', detail: '15 controlled reps to activate rear delts and scaps' },
    { id: 'w-p-4', name: 'Push-ups', detail: '10 to 15 standard push-ups to prime chest and triceps' },
    { id: 'w-p-5', name: 'Light DB Lateral Raises', detail: '15 light reps (2-3 kg) to warm up shoulder joints' },
    { id: 'w-p-6', name: 'Warm-up Set: Incline Bench', detail: '1 set of Incline Bench Press at 50% working weight' }
  ],
  Pull: [
    { id: 'w-pl-1', name: 'Cardio Warm-up', detail: '3 min rowing machine or cross trainer at easy pace', duration: '3 min' },
    { id: 'w-pl-2', name: 'Arm Circles', detail: '15 reps each way' },
    { id: 'w-pl-3', name: 'Cat-Cow Stretch', detail: '10 cycles to mobilize thoracic spine' },
    { id: 'w-pl-4', name: 'Band Pull-Aparts', detail: '15 reps with shoulder blade retraction' },
    { id: 'w-pl-5', name: 'Straight Arm Pulldown', detail: '15 light reps on cable to engage lats' },
    { id: 'w-pl-6', name: 'Warm-up Set: Lat Pulldown', detail: '1 set of Lat Pulldown at 50% working weight' }
  ],
  Legs: [
    { id: 'w-l-1', name: 'Cardio Warm-up', detail: '3-5 min incline walk or stationary cycling', duration: '3-5 min' },
    { id: 'w-l-2', name: 'Hip Circles', detail: '10 circles each direction to loosen hip capsules' },
    { id: 'w-l-3', name: 'Leg Swings', detail: '10 forward/back and 10 side-to-side each leg' },
    { id: 'w-l-4', name: 'Glute Bridges', detail: '15 reps with 2s squeeze at top' },
    { id: 'w-l-5', name: 'Bodyweight Squats', detail: '15 reps focusing on full hip depth' },
    { id: 'w-l-6', name: 'Walking Lunges', detail: '10 reps each leg (bodyweight)' },
    { id: 'w-l-7', name: 'Warm-up Sets: Squats', detail: 'Bar only for 15 reps, then 50% working weight for 10 reps' }
  ],
  ChestBack: [
    { id: 'w-cb-1', name: 'Cardio Warm-up', detail: '3-5 min treadmill or cross trainer light pace' },
    { id: 'w-cb-2', name: 'Arm Circles & Band Pull-Aparts', detail: '15 arm circles each way + 15 band pull-aparts' },
    { id: 'w-cb-3', name: 'Push-Ups & Cat-Cow', detail: '10 slow push-ups + 10 cat-cow thoracic extensions' },
    { id: 'w-cb-4', name: 'Straight Arm Pulldown', detail: '15 light cable reps to activate lats' },
    { id: 'w-cb-5', name: 'Specific Warm-up Sets', detail: '1 light set Incline DB Press + 1 light set Lat Pulldown' }
  ],
  ArmsDelts: [
    { id: 'w-ad-1', name: 'Cardio Warm-up', detail: '3 min light cross trainer or treadmill' },
    { id: 'w-ad-2', name: 'Arm Circles & Shoulder Mobility', detail: '15 arm circles each way' },
    { id: 'w-ad-3', name: 'Band Pull-Aparts & Lateral Raises', detail: '15 reps band pull-aparts + 15 light DB lateral raises' },
    { id: 'w-ad-4', name: 'Light Bicep & Tricep Warm-up', detail: '15 light reps bicep curls + 15 light tricep pushdowns' }
  ],
  Rest: []
};

export const COOLDOWNS: { [type: string]: CooldownStretch[] } = {
  FullBody: [
    { id: 'cd-fb-1', name: 'Chest Doorway Stretch', holdSeconds: 35, cue: 'Forearm on doorframe, lean through gently.' },
    { id: 'cd-fb-2', name: "Child's Pose", holdSeconds: 40, cue: 'Kneel, reach hands forward, sink chest into mat.' },
    { id: 'cd-fb-3', name: 'Standing Quad Stretch', holdSeconds: 35, cue: 'Pull ankle behind glute, keep knees aligned.' },
    { id: 'cd-fb-4', name: 'Hamstring Stretch', holdSeconds: 35, cue: 'Heel on step, hinge at hips with flat back.' }
  ],
  Push: [
    { id: 'cd-p-1', name: 'Chest Doorway Stretch', holdSeconds: 35, cue: 'Forearm on doorframe, lean forward to stretch pec.' },
    { id: 'cd-p-2', name: 'Overhead Tricep Stretch', holdSeconds: 35, cue: 'Gently pull elbow behind head, keep neck tall.' },
    { id: 'cd-p-3', name: 'Cross-Body Shoulder Stretch', holdSeconds: 35, cue: 'Pull arm across chest, drop shoulder away from ear.' },
    { id: 'cd-p-4', name: 'Chest Opener', holdSeconds: 35, cue: 'Clasp hands behind back, lift gently and expand ribcage.' },
    { id: 'cd-p-5', name: 'Neck Rolls', holdSeconds: 30, cue: 'Gentle slow circles clockwise and counter-clockwise.' }
  ],
  Pull: [
    { id: 'cd-pl-1', name: 'Lat Stretch', holdSeconds: 35, cue: 'Hold post or doorway, push hips back to lengthen lat.' },
    { id: 'cd-pl-2', name: "Child's Pose", holdSeconds: 40, cue: 'Kneel, reach arms far forward, sink chest to floor.' },
    { id: 'cd-pl-3', name: 'Bicep Wall Stretch', holdSeconds: 35, cue: 'Palm on wall at shoulder height, rotate torso away.' },
    { id: 'cd-pl-4', name: 'Upper Trap Stretch', holdSeconds: 35, cue: 'Gently tilt ear toward shoulder, other hand behind back.' },
    { id: 'cd-pl-5', name: 'Thread the Needle', holdSeconds: 35, cue: 'Slide arm under body to stretch posterior shoulder.' }
  ],
  Legs: [
    { id: 'cd-l-1', name: 'Standing Quad Stretch', holdSeconds: 35, cue: 'Hold ankle behind glute, keep knees touching.' },
    { id: 'cd-l-2', name: 'Standing Hamstring Stretch', holdSeconds: 35, cue: 'Heel forward on floor, hinge at hips with flat back.' },
    { id: 'cd-l-3', name: 'Pigeon Pose', holdSeconds: 40, cue: 'Front leg bent at 90 degrees, square hips to floor.' },
    { id: 'cd-l-4', name: 'Hip Flexor Lunge', holdSeconds: 35, cue: 'Kneeling lunge, tuck pelvis under and shift weight forward.' },
    { id: 'cd-l-5', name: 'Butterfly Stretch', holdSeconds: 35, cue: 'Soles together, gently press knees down with elbows.' },
    { id: 'cd-l-6', name: 'Calf Stretch on Wall', holdSeconds: 35, cue: 'Back heel pressed firmly down, back leg straight.' }
  ],
  ChestBack: [
    { id: 'cd-cb-1', name: 'Chest Doorway Stretch', holdSeconds: 35, cue: 'Forearm on doorframe, lean forward to stretch pec.' },
    { id: 'cd-cb-2', name: 'Lat Stretch on Pole', holdSeconds: 35, cue: 'Hold pole overhead, lean hips away to lengthen lats.' },
    { id: 'cd-cb-3', name: "Child's Pose", holdSeconds: 45, cue: 'Kneel, reach hands forward, sink chest into floor.' },
    { id: 'cd-cb-4', name: 'Chest Opener', holdSeconds: 35, cue: 'Hands clasped behind back, squeeze shoulder blades.' }
  ],
  ArmsDelts: [
    { id: 'cd-ad-1', name: 'Bicep Wall Stretch', holdSeconds: 35, cue: 'Palm on wall at shoulder height, rotate body away.' },
    { id: 'cd-ad-2', name: 'Overhead Tricep Stretch', holdSeconds: 35, cue: 'Gently pull elbow behind head.' },
    { id: 'cd-ad-3', name: 'Cross-Body Shoulder Stretch', holdSeconds: 35, cue: 'Pull arm across body, drop shoulder.' },
    { id: 'cd-ad-4', name: 'Forearm Extensor Stretch', holdSeconds: 30, cue: 'Extend arm, gently pull fingers downward.' }
  ],
  Rest: []
};

// -------------------------------------------------------------
// SLOT & WORKOUT ROUTING LOGIC
// Phase 1: Days 1 to 7 (Days 1-6 Full Body, Day 7 Rest)
// Phase 2: Days 8 to 35 (Push, Pull, Legs, Push, Pull, Legs, Rest)
// Phase 3: Days 36 to 63 (Push, Pull, Legs, Rest, Chest+Back, Arms+Delts, Rest)
// -------------------------------------------------------------

export function getSlotInfo(dayNumber: number): {
  phase: PhaseType;
  phaseDay: number;
  slotIndex: number;
  workoutType: string;
  title: string;
  exercises: ExerciseDef[];
  abs: AbExerciseDef[];
  warmup: WarmupItem[];
  cooldown: CooldownStretch[];
  isRest: boolean;
  cardioType: 'LISS' | 'Sprints' | 'Walk' | 'Conditioning';
  cardioDescription: string;
} {
  if (dayNumber >= 1 && dayNumber <= 7) {
    // Phase 1 Logic
    const phaseDay = dayNumber;
    const isRest = dayNumber === 7;
    return {
      phase: 'phase1',
      phaseDay,
      slotIndex: dayNumber - 1,
      workoutType: isRest ? 'Rest' : 'Full Body',
      title: isRest ? 'Phase 1: Foundation Rest Day' : `Phase 1: Full Body Workout (Day ${dayNumber})`,
      exercises: isRest ? [] : PHASE_1_FULL_BODY_EXERCISES,
      abs: [],
      warmup: isRest ? [] : WARMUPS.FullBody,
      cooldown: isRest ? [] : COOLDOWNS.FullBody,
      isRest,
      cardioType: isRest ? 'Walk' : 'Conditioning',
      cardioDescription: isRest ? 'Optional light recovery walk' : '10-15 min post-workout conditioning'
    };
  } else if (dayNumber >= 8 && dayNumber <= 35) {
    // Phase 2 Logic
    const phaseDay = Math.max(1, Math.min(28, dayNumber - 7));
    const slotIndex = (phaseDay - 1) % 7;

    let workoutType = 'Rest';
    let exercises: ExerciseDef[] = [];

    switch (slotIndex) {
      case 0:
      case 3:
        workoutType = 'Push';
        exercises = PUSH_EXERCISES_P2;
        break;
      case 1:
      case 4:
        workoutType = 'Pull';
        exercises = PULL_EXERCISES_P2;
        break;
      case 2:
      case 5:
        workoutType = 'Legs';
        exercises = LEGS_EXERCISES_P2;
        break;
      case 6:
        workoutType = 'Rest';
        exercises = [];
        break;
    }

    const isRest = workoutType === 'Rest';

    return {
      phase: 'phase2',
      phaseDay,
      slotIndex,
      workoutType,
      title: isRest ? 'Active Recovery & Rest Day' : `Phase 2: ${workoutType} Day`,
      exercises,
      abs: ABS_BY_SLOT[slotIndex] || [],
      warmup: WARMUPS[workoutType] || [],
      cooldown: COOLDOWNS[workoutType] || [],
      isRest,
      cardioType: isRest ? 'Walk' : 'LISS',
      cardioDescription: isRest ? 'Optional 20-30 min gentle walk' : '15-20 min post-weights LISS cardio'
    };
  } else {
    // Phase 3 Logic (Days 36 to 63)
    const phaseDay = Math.max(1, Math.min(28, dayNumber - 35));
    const slotIndex = (phaseDay - 1) % 7;

    let workoutKey = 'Rest';
    let workoutType = 'Rest';
    let exercises: ExerciseDef[] = [];
    let cardioType: 'LISS' | 'Sprints' | 'Walk' | 'Conditioning' = 'Walk';
    let cardioDescription = 'No training. Sleep 7-8h, 4+ L water, optional 20-30 min walk.';

    switch (slotIndex) {
      case 0:
        workoutKey = 'Push';
        workoutType = 'Push';
        exercises = PHASE_3_WORKOUTS.Push.exercises;
        cardioType = 'LISS';
        cardioDescription = PHASE_3_WORKOUTS.Push.cardio;
        break;
      case 1:
        workoutKey = 'Pull';
        workoutType = 'Pull';
        exercises = PHASE_3_WORKOUTS.Pull.exercises;
        cardioType = 'Sprints';
        cardioDescription = PHASE_3_WORKOUTS.Pull.cardio;
        break;
      case 2:
        workoutKey = 'Legs';
        workoutType = 'Legs';
        exercises = PHASE_3_WORKOUTS.Legs.exercises;
        cardioType = 'LISS';
        cardioDescription = PHASE_3_WORKOUTS.Legs.cardio;
        break;
      case 3:
        workoutKey = 'Rest';
        workoutType = 'Rest';
        exercises = [];
        cardioType = 'Walk';
        cardioDescription = 'No training. Complete rest day for muscle growth.';
        break;
      case 4:
        workoutKey = 'ChestBack';
        workoutType = 'Chest + Back';
        exercises = PHASE_3_WORKOUTS.ChestBack.exercises;
        cardioType = 'Sprints';
        cardioDescription = PHASE_3_WORKOUTS.ChestBack.cardio;
        break;
      case 5:
        workoutKey = 'ArmsDelts';
        workoutType = 'Arms + Delts';
        exercises = PHASE_3_WORKOUTS.ArmsDelts.exercises;
        cardioType = 'LISS';
        cardioDescription = PHASE_3_WORKOUTS.ArmsDelts.cardio;
        break;
      case 6:
        workoutKey = 'Rest';
        workoutType = 'Rest';
        exercises = [];
        cardioType = 'Walk';
        cardioDescription = 'No training. Complete rest day for muscle growth.';
        break;
    }

    const isRest = workoutType === 'Rest';

    return {
      phase: 'phase3',
      phaseDay,
      slotIndex,
      workoutType,
      title: isRest ? 'Scheduled Rest Day (Muscle Growth Mode)' : `Phase 3: ${workoutType}`,
      exercises,
      abs: ABS_BY_SLOT[slotIndex] || [],
      warmup: WARMUPS[workoutKey] || [],
      cooldown: COOLDOWNS[workoutKey] || [],
      isRest,
      cardioType,
      cardioDescription
    };
  }
}
