export interface Lesson {
  id: string;
  title: string;
  phase: 'phase1' | 'phase2' | 'phase3';
  category: 'Nutrition' | 'Training' | 'Habits';
  shortSummary: string;
  explanation: string; // strictly under 60 words
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

export interface MistakeItem {
  id: string;
  title: string;
  detail: string;
  phase: 'phase1' | 'phase2' | 'phase3';
}

export const DAY_1_TASKS = [
  { id: 't1-1', task: 'Take Day 1 baseline photo', detail: 'Shirtless front, side, and back in clean morning lighting.' },
  { id: 't1-2', task: 'Record Day 1 weight & measurements', detail: 'Log chest, waist, hips, and arms on the scale and with tape.' },
  { id: 't1-3', task: 'Post intro in the community', detail: 'State your name, goal, and current situation for accountability.' },
  { id: 't1-4', task: 'Clean up nutrition (zero garbage)', detail: 'Cut sugar, sugary drinks, junk food, maida, and alcohol.' },
  { id: 't1-5', task: 'Complete 6 days full-body workout', detail: 'Learn the exact movement patterns with light/moderate weights.' }
];

export const PHASE_1_RECAP = {
  title: 'Phase 1 Recap (Days 1 to 7)',
  summary: 'The Foundation Week',
  details: [
    'Full body workout routine to wake up neuromuscular pathways and prepare tendons.',
    'Clean eating baseline established: zero sugar, zero junk food, zero maida, zero alcohol.',
    'Eliminated all liquid calories including sweetened tea, coffee, and fruit juices.',
    'Metabolic reset and habit groove locked in for progressive overload.'
  ]
};

export const WEEKLY_ACTION_PLAN = [
  { step: 1, action: 'Calculate calories and macros', detail: 'Multiply bodyweight by 29, subtract 500 kcal, set protein to 2g per kg.' },
  { step: 2, action: 'Pick the meal option and edit it', detail: 'Choose Option A or Option B and adhere to Jain preparation principles.' },
  { step: 3, action: 'Save all PDFs and guides', detail: 'Keep workout schedules and measurement sheets handy offline.' },
  { step: 4, action: 'Start intermittent fasting', detail: 'Fast 16 hours strictly (8 PM to 12 PM), consume zero calorie liquids only.' },
  { step: 5, action: 'Follow workout and meal plan daily', detail: 'Execute Push, Pull, Legs split with strict tempo and rest timers.' },
  { step: 6, action: 'Hit 10,000 steps every single day', detail: 'Non-exercise physical activity burns steady body fat without fatigue.' },
  { step: 7, action: 'Take progress pictures daily', detail: 'Consistent morning lighting, same posture, front and side angles.' },
  { step: 8, action: 'Weigh in once a week only', detail: 'Every 7 days upon waking after bathroom. Ignore daily water shifts.' },
  { step: 9, action: 'Post in the community', detail: 'Accountability locks in discipline and drives mutual encouragement.' }
];

export const DAY_36_TASKS = [
  { id: 't36-1', task: 'Take Day 36 progress photo', detail: 'Compare side by side with your Day 1 baseline photo to see recomposition.' },
  { id: 't36-2', task: 'Record Day 36 morning scale weight', detail: 'Fasted, after bathroom. Use this updated weight for Phase 3 maintenance.' },
  { id: 't36-3', task: 'Record tape measurements', detail: 'Log chest, waist, hips, and arms to measure muscle gained and waist trimmed.' },
  { id: 't36-4', task: 'Recalculate maintenance calories', detail: 'Multiply updated weight by 29, then subtract 300 kcal (300 kcal deficit).' },
  { id: 't36-5', task: 'Edit meal plan with +200 kcal carbs', detail: 'Add 1 extra roti, 1/2 cup rice, or banana around workout windows.' },
  { id: 't36-6', task: 'Find a place to sprint', detail: 'Locate a 100-150m flat track, grass field, or park for Day 2 and 5 sprints.' }
];

export const PHASE_3_WEEKLY_CHECKLIST = [
  { id: 'p3w-1', label: 'Completed all 5 training sessions', detail: 'Push, Pull, Legs, Chest+Back, and Arms+Delts executed fully.' },
  { id: 'p3w-2', label: 'Hit 2 sprint sessions', detail: 'Day 2 and Day 5 sprints (4-6 x 100-150m at 100% effort).' },
  { id: 'p3w-3', label: 'Hit 3 LISS sessions', detail: 'Day 1, 3, and 6 post-weights 15 min steady state cardio.' },
  { id: 'p3w-4', label: 'Hit protein target every single day', detail: '2g per kg bodyweight consumed daily without exception.' },
  { id: 'p3w-5', label: 'Drank 4+ litres of clean water daily', detail: 'Crucial for muscle cellular hydration and sprint recovery.' },
  { id: 'p3w-6', label: 'Got 7-8 hours of sleep nightly', detail: 'Primary window for growth hormone release and muscle tissue repair.' },
  { id: 'p3w-7', label: 'Tracked weights and reps in every session', detail: 'Logged every working set to ensure progressive overload.' },
  { id: 'p3w-8', label: 'Increased weight or reps on 2+ exercises', detail: 'Added 2.5 kg or 1-2 extra reps to drive adaptation.' },
  { id: 'p3w-9', label: 'Took rest days seriously', detail: 'Zero gym sessions on Day 4 and Day 7 to let muscles grow.' }
];

export const MISTAKES_LIST: MistakeItem[] = [
  // Phase 1 Mistakes
  { id: 'p1m-1', phase: 'phase1', title: 'Going too hard, too fast', detail: 'This is Week 1, not the finale. Start light, focus on form, build up gradually.' },
  { id: 'p1m-2', phase: 'phase1', title: 'Skipping workout because you are sore', detail: 'Soreness is normal for beginners. It goes away when you move. Show up anyway.' },
  { id: 'p1m-3', phase: 'phase1', title: 'Overcomplicating nutrition', detail: 'No macro counting needed yet. Just cut the junk. Eat clean home-cooked Indian food.' },
  { id: 'p1m-4', phase: 'phase1', title: 'Weighing yourself every day', detail: 'Weight fluctuates daily due to water, food, and stress. Weigh on Day 1 and Day 7 only.' },
  { id: 'p1m-5', phase: 'phase1', title: 'Not posting in the community', detail: 'The guys who engage are the guys who transform. Post Day 1, ask questions, share struggles.' },
  { id: 'p1m-6', phase: 'phase1', title: 'Waiting for motivation', detail: 'Motivation comes AFTER you start, not before. Discipline first. Just start.' },
  { id: 'p1m-7', phase: 'phase1', title: 'Thinking 1 week does not matter', detail: 'This week builds the foundation for the next 93 days. How you do this week is how you do the program.' },

  // Phase 2 Mistakes
  { id: 'm-1', phase: 'phase2', title: 'Skipping meals in the eating window', detail: 'Undereating slows metabolism and causes muscle loss. Eat all prescribed food.' },
  { id: 'm-2', phase: 'phase2', title: 'Not fasting 16 hours', detail: 'Shortening the fast limits fat oxidation and reduces insulin sensitivity.' },
  { id: 'm-3', phase: 'phase2', title: 'Not completing 10k steps', detail: 'Lifting alone is not enough; daily step count drives total energy expenditure.' },
  { id: 'm-4', phase: 'phase2', title: 'Not tracking calories and protein', detail: 'Eyeballing portions leads to underestimating calories and missing protein goals.' },
  { id: 'm-5', phase: 'phase2', title: 'Drinking calories (chai, juice)', detail: 'Sweetened chai, packaged juice, and sodas add hidden sugars that stall fat loss.' },
  { id: 'm-6', phase: 'phase2', title: 'Skipping cardio', detail: '15-20 min post-weight LISS burns fatty acids liberated during lifting.' },
  { id: 'm-7', phase: 'phase2', title: 'Weekend bingeing', detail: 'One uncontrolled cheat meal can erase the entire 3,500 kcal weekly deficit.' },
  { id: 'm-8', phase: 'phase2', title: 'Ego lifting', detail: 'Lifting too heavy sacrifices form, reduces tension on muscle, and risks injury.' },
  { id: 'm-9', phase: 'phase2', title: 'Not tracking weights', detail: 'Without logging weights and reps, progressive overload cannot be measured.' },
  { id: 'm-10', phase: 'phase2', title: 'Inconsistent rest', detail: 'Shortening rest on heavy compounds ruins next set intensity and strength output.' },
  { id: 'm-11', phase: 'phase2', title: 'Skipping warm-up', detail: 'Cold muscles and stiff joints reduce power output and invite tendon strains.' },
  { id: 'm-12', phase: 'phase2', title: 'Training through pain', detail: 'Sharp joint pain is a warning signal. Deload or modify movement immediately.' },

  // Phase 3 Mistakes
  { id: 'p3m-1', phase: 'phase3', title: 'Ego lifting on advanced techniques', detail: 'Using momentum on drop sets, supersets, or giant sets ruins pump and increases injury.' },
  { id: 'p3m-2', phase: 'phase3', title: 'Not resting enough between sets', detail: 'Giant sets need a full 90 seconds rest after completing all three exercises.' },
  { id: 'p3m-3', phase: 'phase3', title: 'Half-effort sprints', detail: 'Sprints must be 100% full effort like someone is chasing you to spike growth hormone.' },
  { id: 'p3m-4', phase: 'phase3', title: 'Not sleeping enough', detail: 'Sleeping under 7 hours crushes testosterone and halts muscle hypertrophy.' },
  { id: 'p3m-5', phase: 'phase3', title: 'Working out on rest days', detail: 'Muscles grow on rest days. Doing extra workouts stops muscle growth.' },
  { id: 'p3m-6', phase: 'phase3', title: 'Not eating enough food', detail: 'Phase 3 gives you 200 extra carb calories to fuel muscle building. Eat them.' },
  { id: 'p3m-7', phase: 'phase3', title: 'Not posting in the community', detail: 'Accountability keeps your intensity high during demanding giant set weeks.' }
];

export const LESSONS: Lesson[] = [
  // Phase 1 Lessons
  {
    id: 'p1-lesson-1',
    phase: 'phase1',
    title: 'Why the Same Full Body Workout Daily',
    category: 'Training',
    shortSummary: 'Repetition builds motor pathways and movement fluency.',
    explanation: 'Training the whole body 6 days in Week 1 provides rapid neural repetition. By Day 6, movement mechanics feel natural and safe. This prepares connective tissues and joints before advancing into heavy split routines.',
    quiz: {
      question: 'Why repeat the same full body workout daily in Phase 1?',
      options: [
        'To burn maximum calories quickly',
        'To build movement familiarity and neural motor patterns',
        'To exhaust every muscle to failure'
      ],
      correctIndex: 1,
      explanation: 'Repeating movements grooves motor patterns so you can lift safely with progressive overload later.'
    }
  },
  {
    id: 'p1-lesson-2',
    phase: 'phase1',
    title: 'Clean Up the Garbage (The Detox Rule)',
    category: 'Nutrition',
    shortSummary: 'Eliminate sugar, sugary drinks, junk food, maida, and alcohol.',
    explanation: 'Phase 1 requires zero calorie counting or macro tracking. The single mandate is eliminating the 5 metabolic toxins: sugar, sugary chai/juices, junk food, maida, and alcohol. Eating simple home-cooked food resets gut flora and appetite signals.',
    quiz: {
      question: 'What is the primary nutrition rule of Phase 1?',
      options: [
        'Weigh every single gram of rice',
        'Cut sugar, junk food, maida, sugary drinks, and alcohol completely',
        'Eat only one meal a day'
      ],
      correctIndex: 1,
      explanation: 'Cutting out processed junk and sugary liquids allows your tastebuds and insulin sensitivity to reset.'
    }
  },
  {
    id: 'p1-lesson-3',
    phase: 'phase1',
    title: 'Form Beats Everything Else',
    category: 'Training',
    shortSummary: 'Light to moderate weights only; ego lifting is forbidden.',
    explanation: 'Chasing heavy weights in Week 1 produces tendon strains and poor motor habits. Use weights where every repetition is strictly controlled with a 2-second negative and zero body swinging. Form creates long-term muscle gains.',
    quiz: {
      question: 'What happens if your form breaks down during an exercise?',
      options: [
        'Keep going to hit the target reps',
        'The weight is too heavy; reduce it immediately',
        'Swing your torso to complete the set'
      ],
      correctIndex: 1,
      explanation: 'If form breaks down, the weight is too heavy. Drop the load and prioritize pure muscular tension.'
    }
  },

  // Phase 2 Lessons
  {
    id: 'lesson-1',
    phase: 'phase2',
    title: 'Why a 500 kcal Deficit',
    category: 'Nutrition',
    shortSummary: 'The sweet spot for fat loss and muscle preservation.',
    explanation: 'A 500 kcal deficit creates a weekly 3,500 kcal shortfall, melting approximately 0.5 kg of pure fat weekly. Larger deficits trigger muscle catabolism and metabolic slowdown, whereas 500 kcal preserves lean tissue while steadily stripping stubborn body fat.',
    quiz: {
      question: 'What is the primary benefit of a moderate 500 kcal deficit?',
      options: [
        'Losing water weight as fast as possible',
        'Burning fat steadily while preserving lean muscle',
        'Allowing unlimited cheat meals on weekends'
      ],
      correctIndex: 1,
      explanation: 'A 500 kcal deficit preserves hard-earned muscle tissue while steadily burning approximately 0.5 kg of body fat each week.'
    }
  },
  {
    id: 'lesson-2',
    phase: 'phase2',
    title: 'Why Protein is Non-Negotiable',
    category: 'Nutrition',
    shortSummary: 'Building blocks to spare muscle during a deficit.',
    explanation: 'When in a caloric deficit, your body seeks amino acids. Eating 2g protein per kg bodyweight protects your muscle from being converted into glucose. Protein also has the highest thermic effect of food and keeps you satiated between meals.',
    quiz: {
      question: 'What is the daily target protein ratio?',
      options: [
        '1g per kg bodyweight',
        '2g per kg bodyweight',
        '4g per kg bodyweight'
      ],
      correctIndex: 1,
      explanation: '2g of protein per kg bodyweight is the established target to prevent muscle loss.'
    }
  },
  {
    id: 'lesson-3',
    phase: 'phase2',
    title: 'Why Fat is Not Cut Too Low',
    category: 'Nutrition',
    shortSummary: 'Hormones and joint health require essential lipids.',
    explanation: 'Dietary fat is set at 0.9g per kg. Slashing fat below this crashes testosterone, disrupts hormonal production, dries out joint lubrication, and prevents absorption of fat-soluble vitamins like D3 and K2. When adjusting calories, always reduce carbs before touching healthy fats.',
    quiz: {
      question: 'Why should fat intake never be eliminated?',
      options: [
        'It maintains hormone production and joint health',
        'It converts directly into fast glycogen',
        'It speeds up digestion excessively'
      ],
      correctIndex: 0,
      explanation: 'Essential fats at 0.9g/kg are required to sustain testosterone, endocrine function, and joint cushioning.'
    }
  },
  {
    id: 'lesson-4',
    phase: 'phase2',
    title: 'How Intermittent Fasting Limits Eating Hours',
    category: 'Habits',
    shortSummary: '16 hours of cellular repair and appetite control.',
    explanation: 'Fasting 16 hours compresses your feeding into an 8-hour window (12 PM to 8 PM). This naturally curbs mindless late-night snacking, reduces daytime insulin levels to maximize fat oxidation, and simplifies caloric compliance with two hearty satisfying meals.',
    quiz: {
      question: 'Which drinks are allowed during the 16-hour fasting window?',
      options: [
        'Fruit juices and coconut water',
        'Water, black coffee, and green tea only',
        'Chai with milk and artificial sweetener'
      ],
      correctIndex: 1,
      explanation: 'Only zero-calorie unsweetened beverages (water, black coffee, plain green tea) keep insulin at baseline.'
    }
  },
  {
    id: 'lesson-5',
    phase: 'phase2',
    title: 'What Progressive Overload Is',
    category: 'Training',
    shortSummary: 'The fundamental law of hypertrophy and strength.',
    explanation: 'Muscles adapt only when subjected to greater demand than before. In Phase 2, progressive overload means adding 1-2 reps or increasing weight by 1 to 2.5 kg once you reach the top of the target rep range with immaculate form.',
    quiz: {
      question: 'When should you add 1 to 2.5 kg to an exercise?',
      options: [
        'Whenever you feel energetic regardless of reps',
        'Once you hit the top of the rep range with good form',
        'Every single set without exception'
      ],
      correctIndex: 1,
      explanation: 'Progressive overload works best when earned by completing all target reps with pristine technique first.'
    }
  },
  {
    id: 'lesson-6',
    phase: 'phase2',
    title: 'Why Tempo Adds Time Under Tension',
    category: 'Training',
    shortSummary: 'Time under tension creates maximal micro-tears.',
    explanation: 'Lifting fast relies on momentum and joint bouncing. Controlling the eccentric lowering phase for 2-3 seconds and pausing eliminates inertia, forcing target muscle fibers to generate pure mechanical tension.',
    quiz: {
      question: 'What does the eccentric phase in tempo represent?',
      options: [
        'The resting pause between sets',
        'The slow controlled lowering phase',
        'The explosive upward press'
      ],
      correctIndex: 1,
      explanation: 'The slow eccentric phase produces the highest mechanical tension and triggers muscle growth.'
    }
  },
  {
    id: 'lesson-7',
    phase: 'phase2',
    title: 'Why Cardio Comes After Weights',
    category: 'Training',
    shortSummary: 'Prioritize glycogen for heavy lifting before fat burning.',
    explanation: 'Lifting heavy requires immediate intramuscular glycogen. If you do cardio first, central nervous system fatigue degrades your strength and increases injury risk. Doing cardio after weights preserves lifting intensity and burns liberated fatty acids faster.',
    quiz: {
      question: 'Why perform cardio after lifting instead of before?',
      options: [
        'To save peak muscular energy for heavy compound lifts',
        'Because cardio warms up muscles too much',
        'To reduce heart rate before heavy squats'
      ],
      correctIndex: 0,
      explanation: 'Weights require maximum explosive glycogen; post-workout cardio utilizes liberated fats after glycogen is depleted.'
    }
  },
  {
    id: 'lesson-8',
    phase: 'phase2',
    title: 'What LISS Is',
    category: 'Training',
    shortSummary: 'Low Intensity Steady State for recovery and fat loss.',
    explanation: 'LISS is low intensity steady state cardio: 15-20 minutes of brisk walking, incline treadmill, or easy cycling at a conversational pace. Unlike exhausting HIIT, LISS burns pure fat without spiking cortisol, fatiguing your legs, or compromising muscle recovery.',
    quiz: {
      question: 'What is the ideal intensity for LISS cardio?',
      options: [
        'All-out sprinting intervals until breathless',
        'Steady conversational pace without gasping for breath',
        'High impact plyometric jumping'
      ],
      correctIndex: 1,
      explanation: 'LISS stays in Zone 2 aerobic intensity where speech is easily maintained and fat oxidation is optimal.'
    }
  },
  {
    id: 'lesson-9',
    phase: 'phase2',
    title: 'Why Abs Are Revealed by Diet',
    category: 'Habits',
    shortSummary: 'Crunches strengthen muscle; caloric deficit uncovers them.',
    explanation: 'Direct ab exercises build abdominal wall thickness and spinal stability, but you cannot spot-reduce belly fat. Abs become visible only when your overall body fat percentage drops through a sustained caloric deficit and strict 10k daily steps.',
    quiz: {
      question: 'How are defined six-pack abdominals actually revealed?',
      options: [
        'By doing 500 crunches every morning',
        'By reducing overall body fat through a caloric deficit',
        'By wearing sweat belts during workouts'
      ],
      correctIndex: 1,
      explanation: 'Subcutaneous abdominal fat is burned systematically as total body fat drops through consistent nutrition.'
    }
  },
  {
    id: 'lesson-10',
    phase: 'phase2',
    title: 'Why Warm-Up Prevents Injury',
    category: 'Training',
    shortSummary: 'Synovial fluid lubrication and core temperature elevation.',
    explanation: 'A 5-10 minute dynamic warm-up increases core body temperature, lubricates joint capsules with synovial fluid, and rehearses neuromuscular motor patterns. Cold tendons are brittle; warming up ensures heavy loads are handled safely without tears.',
    quiz: {
      question: 'What is the purpose of the first 50% warm-up set?',
      options: [
        'To exhaust the muscle before the real sets',
        'To groove the movement path and prepare tendons safely',
        'To substitute for doing cardio'
      ],
      correctIndex: 1,
      explanation: 'A 50% warm-up set prepares joints and neuromuscular pathways without inducing premature fatigue.'
    }
  },
  {
    id: 'lesson-11',
    phase: 'phase2',
    title: 'Why Weigh Weekly',
    category: 'Habits',
    shortSummary: 'Avoid anxiety from daily water and sodium fluctuations.',
    explanation: 'Daily bodyweight fluctuates up to 1.5 kg due to water retention, bowel movements, and sodium. Checking the scale daily creates false panic. Weighing once weekly under identical conditions (morning, post-bathroom, fasted) provides an accurate true trend.',
    quiz: {
      question: 'How often should you weigh in?',
      options: [
        'Twice daily (morning and evening)',
        'Once a week only under consistent morning conditions',
        'Only after high intensity cardio sessions'
      ],
      correctIndex: 1,
      explanation: 'Weekly weigh-ins filter out transient water swings and show genuine fat loss progress.'
    }
  },
  {
    id: 'lesson-12',
    phase: 'phase2',
    title: 'How Jain Protein Sources Replace Eggs and Meat',
    category: 'Nutrition',
    shortSummary: 'Paneer, soy chunks, whey, and lentils provide complete amino acids.',
    explanation: 'A pure Jain diet easily delivers 160g+ high biological value protein. Soy chunks provide 50% protein by weight, paneer supplies slow-digesting casein, double whey triggers rapid muscle synthesis, and pairing dal with rice delivers a complete amino acid profile.',
    quiz: {
      question: 'Which Jain food provides the highest protein yield per dry gram?',
      options: [
        'Dry soy chunks',
        'Cucumber tomato salad',
        'Whole wheat rotis'
      ],
      correctIndex: 0,
      explanation: 'Dry soy chunks contain approximately 50g of pure protein per 100g, making them exceptionally potent.'
    }
  },

  // Phase 3 Lessons
  {
    id: 'p3-lesson-1',
    phase: 'phase3',
    title: 'Why a Smaller Deficit Helps Muscle Gain',
    category: 'Nutrition',
    shortSummary: '300 kcal deficit provides the extra energy required for hypertrophy.',
    explanation: 'In Phase 3, the deficit is reduced from 500 to 300 kcal. These extra 200 daily calories supply glycogen to fuel explosive drop sets and supersets, while still keeping you in a gentle fat loss deficit for lean body recomposition.',
    quiz: {
      question: 'What is the calorie deficit in Phase 3?',
      options: [
        '500 kcal deficit',
        '300 kcal deficit (+200 calories compared to Phase 2)',
        'Zero deficit (eating at maintenance)'
      ],
      correctIndex: 1,
      explanation: 'A 300 kcal deficit provides 200 extra calories to build muscle while continuing steady fat loss.'
    }
  },
  {
    id: 'p3-lesson-2',
    phase: 'phase3',
    title: 'Why the Extra Calories Are Carbs',
    category: 'Nutrition',
    shortSummary: 'Carbs replenish intramuscular glycogen around intense training sessions.',
    explanation: 'Protein (2g/kg) and fat (0.9g/kg) are already optimized. The extra 200 calories must come strictly from carbohydrates eaten pre and post workout to maximize training pump, drive cellular hydration, and accelerate intra-workout recovery.',
    quiz: {
      question: 'Where should the extra 200 calories come from in Phase 3?',
      options: [
        'Extra dietary fat',
        'Carbohydrates placed around your workout',
        'Unlimited fried snacks'
      ],
      correctIndex: 1,
      explanation: 'Carbs taken before and after weights refuel glycogen stores depleted during high intensity lifting.'
    }
  },
  {
    id: 'p3-lesson-3',
    phase: 'phase3',
    title: 'Why Chest and Back Are Hit Twice a Week',
    category: 'Training',
    shortSummary: 'Higher frequency on torso creates the classic Bollywood V-taper.',
    explanation: 'In Phase 3, you train Push and Pull early in the week, then Chest and Back together on Day 5 using Giant Sets. Hitting these large upper body muscle groups twice weekly stimulates maximal growth signals for wide shoulders and a thick V-taper back.',
    quiz: {
      question: 'What aesthetic outcome does hitting Chest and Back twice weekly create?',
      options: [
        'The coveted broad-shouldered V-taper physique',
        'Reduced chest width',
        'Excessive abdominal thickness'
      ],
      correctIndex: 0,
      explanation: 'Frequent chest and upper back stimulation sculpts the iconic broad shoulders and taper down to a narrow waist.'
    }
  },
  {
    id: 'p3-lesson-4',
    phase: 'phase3',
    title: 'How Supersets, Drop Sets and Giant Sets Work',
    category: 'Training',
    shortSummary: 'Advanced intensity multipliers that recruit stubborn deep muscle fibers.',
    explanation: 'Supersets pair two exercises with no rest. Drop sets take a set to failure, strip 30-40% weight, and continue to failure. Giant sets link three exercises consecutively before resting 90s. This produces extreme metabolic stress and sarcoplasmic hypertrophy.',
    quiz: {
      question: 'How much weight should you reduce during a Drop Set?',
      options: [
        'Drop weight by 10%',
        'Drop weight by 30 to 40% and continue to failure',
        'Double the working weight'
      ],
      correctIndex: 1,
      explanation: 'Dropping 30-40% weight allows fatigued motor units to keep contracting past the point of initial failure.'
    }
  },
  {
    id: 'p3-lesson-5',
    phase: 'phase3',
    title: 'Why Sprints Beat Long Cardio for Muscle',
    category: 'Training',
    shortSummary: 'Maximum effort sprints boost growth hormone and protect lean tissue.',
    explanation: 'Long slow cardio can break down muscle tissue. In contrast, 100% effort 100-150m sprints recruit fast-twitch muscle fibers, spike natural testosterone and growth hormone, burn visceral fat, and build athletic explosive power in just 15 minutes.',
    quiz: {
      question: 'Why are sprint sessions superior for muscle retention?',
      options: [
        'They spike muscle-building hormones without causing muscle wasting',
        'They replace the need for lifting heavy squats',
        'They can be done at a leisurely casual pace'
      ],
      correctIndex: 0,
      explanation: 'Sprints stimulate fast-twitch motor units and anabolic hormones, protecting hard-earned muscle mass.'
    }
  },
  {
    id: 'p3-lesson-6',
    phase: 'phase3',
    title: 'Why Rest Days Build Muscle',
    category: 'Training',
    shortSummary: 'Lifting causes micro-tears; rest and nutrition repair them stronger.',
    explanation: 'Workouts do not build muscle; they tear it down. Phase 3 provides 2 full rest days per week (Day 4 and Day 7). On rest days, your body synthesizes new protein fibers, refills depleted glycogen, and lowers cortisol for peak muscle growth.',
    quiz: {
      question: 'When does actual muscle growth and protein synthesis occur?',
      options: [
        'While lifting weights in the gym',
        'During rest days and deep sleep with proper nutrition',
        'Only during intense cardio intervals'
      ],
      correctIndex: 1,
      explanation: 'Tissue repair, protein synthesis, and muscular hypertrophy take place entirely during rest and recovery.'
    }
  },
  {
    id: 'p3-lesson-7',
    phase: 'phase3',
    title: 'Why Sleep Matters',
    category: 'Habits',
    shortSummary: '7-8 hours of deep sleep is non-negotiable for anabolic repair.',
    explanation: 'Up to 70% of daily human growth hormone is secreted during slow-wave deep sleep. Sleeping fewer than 7 hours increases hunger hormone ghrelin, impairs insulin sensitivity, and stunts muscle recovery. Prioritize 7-8 hours nightly as a non-negotiable habit.',
    quiz: {
      question: 'How many hours of sleep are prescribed in Phase 3?',
      options: [
        '5 to 6 hours',
        '7 to 8 hours minimum',
        '10 to 12 hours'
      ],
      correctIndex: 1,
      explanation: '7-8 hours of uninterrupted nocturnal sleep provides the optimal window for hormonal regeneration.'
    }
  },
  {
    id: 'p3-lesson-8',
    phase: 'phase3',
    title: 'What V-Taper Means',
    category: 'Training',
    shortSummary: 'The golden ratio: broad clavicles and lats tapering to a tight waist.',
    explanation: 'The classic Bollywood hero silhouette is the V-Taper: wide lateral deltoids, flared upper lats, an expanded upper chest, and a trim flat waist. Phase 3’s high frequency chest, back, and delts training is specifically engineered to forge this aesthetic.',
    quiz: {
      question: 'What muscle groups create the V-Taper silhouette?',
      options: [
        'Large calves and forearms only',
        'Wide shoulders, upper chest, and broad lats tapering to a trim waist',
        'Only direct neck exercises'
      ],
      correctIndex: 1,
      explanation: 'Wide lateral delts, thick upper chest, and sweeping lats combined with a lean waist produce the V-taper.'
    }
  }
];
