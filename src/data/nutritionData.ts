import { PhaseType } from '../types';

export interface MealItem {
  id: string;
  name: string;
  portion: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  timing: string;
  notes: string;
}

export interface MealOption {
  id: string;
  title: string;
  totalCalories: number;
  totalProtein: number;
  description: string;
  meals: {
    mealTime: string;
    items: MealItem[];
  }[];
}

export interface CarbAddon {
  id: string;
  name: string;
  portion: string;
  calories: number;
  carbsGrams: number;
  timingHint: string;
}

export const PHASE_3_CARB_ADDONS: CarbAddon[] = [
  { id: 'c-1', name: '1 Extra Whole Wheat Roti', portion: '1 roti', calories: 100, carbsGrams: 20, timingHint: 'Add to 12 PM lunch or 7:30 PM dinner' },
  { id: 'c-2', name: '1/2 Cup Extra Cooked Rice', portion: '1/2 cup', calories: 100, carbsGrams: 22, timingHint: 'Add to post-workout dal rice meal' },
  { id: 'c-3', name: '1 Medium Banana', portion: '1 banana (118g)', calories: 100, carbsGrams: 25, timingHint: 'Eat 30-45 min pre-workout for fast glycogen' },
  { id: 'c-4', name: '2 Slices Whole Wheat Bread', portion: '2 slices', calories: 150, carbsGrams: 28, timingHint: 'Pre or post workout with peanut butter' },
  { id: 'c-5', name: '1 Bowl Poha or Upma', portion: '1 medium bowl', calories: 200, carbsGrams: 42, timingHint: 'Pre-workout energy fuel' }
];

export const JAIN_OPTION_A: MealOption = {
  id: 'option-a',
  title: 'Option A: Classic High-Protein Jain',
  totalCalories: 1930,
  totalProtein: 159,
  description: 'Balanced with paneer bhurji, chole, double whey, roasted peanuts, and soy/tofu moong dal dinner.',
  meals: [
    {
      mealTime: '12:00 PM (Meal 1: Break Fast)',
      items: [
        {
          id: 'a-1',
          name: 'Paneer Bhurji (No Onion)',
          portion: '200g',
          calories: 400,
          protein: 36,
          fat: 26,
          carbs: 6,
          timing: '12:00 PM',
          notes: 'Cooked in 1 tsp oil or ghee with green chilies, turmeric and jeera.'
        },
        {
          id: 'a-2',
          name: 'Chole or Rajma Curry',
          portion: '1 big bowl (250g)',
          calories: 250,
          protein: 15,
          fat: 4,
          carbs: 38,
          timing: '12:00 PM',
          notes: 'Prepared without onion or garlic using tomato, cumin, and hing gravy.'
        },
        {
          id: 'a-3',
          name: 'Whole Wheat Rotis (No Ghee/Oil)',
          portion: '2 rotis',
          calories: 200,
          protein: 6,
          fat: 1,
          carbs: 42,
          timing: '12:00 PM',
          notes: 'Freshly roasted whole wheat phulkas.'
        },
        {
          id: 'a-4',
          name: 'Jain Salad (Cucumber & Tomato)',
          portion: '1 bowl',
          calories: 30,
          protein: 1,
          fat: 0,
          carbs: 6,
          timing: '12:00 PM',
          notes: 'Cucumber, tomato with lemon and rock salt.'
        }
      ]
    },
    {
      mealTime: '3:30 PM (Afternoon Protein Fuel)',
      items: [
        {
          id: 'a-5',
          name: 'Whey Protein (2 Scoops in Chilled Water)',
          portion: '2 scoops (60g powder)',
          calories: 240,
          protein: 50,
          fat: 2,
          carbs: 4,
          timing: '3:30 PM',
          notes: 'Non-negotiable anabolic trigger for sustained protein synthesis.'
        },
        {
          id: 'a-6',
          name: 'Roasted Peanuts',
          portion: '30g',
          calories: 170,
          protein: 8,
          fat: 14,
          carbs: 5,
          timing: '3:30 PM',
          notes: 'Dry roasted without oil. Provides essential healthy fats.'
        }
      ]
    },
    {
      mealTime: '7:30 PM (Meal 2: Window Closing Dinner)',
      items: [
        {
          id: 'a-7',
          name: 'Tofu or Dry Soy Chunks Curry',
          portion: '150g tofu or 50g dry soy chunks',
          calories: 200,
          protein: 25,
          fat: 7,
          carbs: 8,
          timing: '7:30 PM',
          notes: 'Cooked with tomato, turmeric, coriander powder, minimal oil.'
        },
        {
          id: 'a-8',
          name: 'Moong Dal',
          portion: '1 big bowl',
          calories: 180,
          protein: 12,
          fat: 2,
          carbs: 28,
          timing: '7:30 PM',
          notes: 'Yellow moong dal tempered with cumin seeds and hing.'
        },
        {
          id: 'a-9',
          name: 'Steamed Rice',
          portion: '1 small cup cooked',
          calories: 180,
          protein: 3,
          fat: 0.5,
          carbs: 40,
          timing: '7:30 PM',
          notes: 'Pairing dal with rice forms a complete amino acid profile.'
        },
        {
          id: 'a-10',
          name: 'Green Sabzi (Lauki / Tori / Capsicum / Cabbage)',
          portion: '1 bowl',
          calories: 80,
          protein: 3,
          fat: 2,
          carbs: 12,
          timing: '7:30 PM',
          notes: 'Cooked with 1 tsp oil max. Rich in dietary fiber.'
        }
      ]
    }
  ]
};

export const JAIN_OPTION_B: MealOption = {
  id: 'option-b',
  title: 'Option B: Soy Chunks & Paneer Paratha Plan',
  totalCalories: 1760,
  totalProtein: 162,
  description: 'Heavy hitting with dry soy chunks, stuffed paneer parathas, curd, soy milk shake, and Jain dal makhani.',
  meals: [
    {
      mealTime: '12:00 PM (Meal 1: Break Fast)',
      items: [
        {
          id: 'b-1',
          name: 'Dry Soy Chunk Sabzi',
          portion: '50g dry soy chunks boiled & sauteed',
          calories: 170,
          protein: 25,
          fat: 1,
          carbs: 16,
          timing: '12:00 PM',
          notes: 'Extremely high protein source, seasoned with jeera, haldi and tomatoes.'
        },
        {
          id: 'b-2',
          name: 'Paneer Parathas (Stuffed with 150g Paneer)',
          portion: '2 parathas',
          calories: 450,
          protein: 30,
          fat: 22,
          carbs: 34,
          timing: '12:00 PM',
          notes: 'Whole wheat dough stuffed with crumbled low-fat paneer, minimal oil roast.'
        },
        {
          id: 'b-3',
          name: 'Fresh Curd or Cucumber Raita',
          portion: '200g',
          calories: 100,
          protein: 8,
          fat: 4,
          carbs: 8,
          timing: '12:00 PM',
          notes: 'Homemade set curd with roasted cumin powder and rock salt.'
        }
      ]
    },
    {
      mealTime: '3:30 PM (Afternoon Shake & Spread)',
      items: [
        {
          id: 'b-4',
          name: 'Whey Protein (2 Scoops in Water)',
          portion: '2 scoops (60g powder)',
          calories: 240,
          protein: 50,
          fat: 2,
          carbs: 4,
          timing: '3:30 PM',
          notes: 'Rapidly absorbed whey isolate or concentrate.'
        },
        {
          id: 'b-5',
          name: 'Unsweetened Soy Milk',
          portion: '200ml',
          calories: 80,
          protein: 7,
          fat: 3.5,
          carbs: 4,
          timing: '3:30 PM',
          notes: 'Pure plant protein boost without added sugars.'
        },
        {
          id: 'b-6',
          name: 'Natural Peanut Butter (No Added Sugar)',
          portion: '1 tbsp (16g)',
          calories: 100,
          protein: 4,
          fat: 8,
          carbs: 3,
          timing: '3:30 PM',
          notes: '100% roasted peanuts only.'
        }
      ]
    },
    {
      mealTime: '7:30 PM (Meal 2: Window Closing Dinner)',
      items: [
        {
          id: 'b-7',
          name: 'Tofu Tikka (Air-Fried or Pan Grilled)',
          portion: '200g firm tofu',
          calories: 200,
          protein: 20,
          fat: 10,
          carbs: 4,
          timing: '7:30 PM',
          notes: 'Marinated in hung curd, lemon, kasuri methi, and chili powder.'
        },
        {
          id: 'b-8',
          name: 'Jain Dal Makhani (Rajma & Black Dal)',
          portion: '1 big bowl',
          calories: 200,
          protein: 12,
          fat: 3,
          carbs: 30,
          timing: '7:30 PM',
          notes: 'Slow simmered rajma and urad dal without butter or cream, zero onion and garlic.'
        },
        {
          id: 'b-9',
          name: 'Steamed Rice',
          portion: '1 small cup cooked',
          calories: 180,
          protein: 3,
          fat: 0.5,
          carbs: 40,
          timing: '7:30 PM',
          notes: 'Combines with dal to ensure all 9 essential amino acids.'
        },
        {
          id: 'b-10',
          name: 'Spiced Buttermilk (Chaas)',
          portion: '1 tall glass (250ml)',
          calories: 40,
          protein: 3,
          fat: 1,
          carbs: 4,
          timing: '7:30 PM',
          notes: 'Diluted curd with fresh mint leaves, roasted jeera, and black salt.'
        }
      ]
    }
  ]
};

export const PROTEIN_REFERENCE_TABLE = [
  { item: 'Dry Soy Chunks', portion: '50g', protein: '25g', highlight: 'Cheapest highest-yield vegetarian protein' },
  { item: 'Whey Protein', portion: '1 scoop (30g)', protein: '25g', highlight: 'Fast absorption, perfect post-workout' },
  { item: 'Paneer (Cottage Cheese)', portion: '100g', protein: '18g', highlight: 'Rich in casein protein for overnight recovery' },
  { item: 'Chenna (Fresh Paneer Curd)', portion: '100g', protein: '14g', highlight: 'Low sodium, fresh home-made dairy protein' },
  { item: 'Rajma or Chole (Cooked)', portion: '1 big bowl', protein: '12-15g', highlight: 'High soluble fiber and micronutrients' },
  { item: 'Tofu (Firm)', portion: '100g', protein: '10g', highlight: 'Lean, low saturated fat plant protein' },
  { item: 'Hung Curd (Greek Style)', portion: '150g', protein: '10-12g', highlight: 'Probiotic dense, smooth texture' },
  { item: 'Moong Dal (Cooked)', portion: '1 bowl', protein: '8-10g', highlight: 'Very easy to digest, low bloating' },
  { item: 'Roasted Peanuts', portion: '30g', protein: '8g', highlight: 'Healthy monounsaturated fats and crunch' },
  { item: 'Curd (Dahi)', portion: '200g', protein: '8g', highlight: 'Gut microbiome support' },
  { item: 'Soy Milk (Unsweetened)', portion: '200ml', protein: '7g', highlight: 'Isolate plant liquid protein' },
  { item: 'Natural Peanut Butter', portion: '1 tbsp (16g)', protein: '4g', highlight: 'Dense healthy energy' }
];

export const SUPPLEMENTS_LIST = [
  {
    id: 'whey',
    name: 'Whey Protein',
    dosage: '1 scoop (25g protein)',
    timing: 'Post-workout in water',
    importance: 'Essential',
    notes: 'Non-negotiable for muscle protein synthesis and hitting 2g/kg bodyweight.'
  },
  {
    id: 'creatine',
    name: 'Creatine Monohydrate',
    dosage: '5g daily',
    timing: 'Post-workout (or with any meal)',
    importance: 'High',
    notes: 'Replenishes cellular ATP, boosts strength output and muscle hydration.'
  },
  {
    id: 'multivitamin',
    name: 'Multivitamin & Minerals',
    dosage: '1 tablet',
    timing: 'With breakfast / first meal',
    importance: 'Recommended',
    notes: 'Fills micronutrient gaps while eating in a caloric deficit.'
  },
  {
    id: 'vitaminD3',
    name: 'Vitamin D3 + K2',
    dosage: '5,000 IU D3 + 100mcg K2',
    timing: 'With a fat-containing meal',
    importance: 'Recommended',
    notes: 'Crucial for bone density, hormonal balance, and muscle strength.'
  },
  {
    id: 'carnitine',
    name: 'L-Carnitine L-Tartrate',
    dosage: '2,000 mg',
    timing: '30 min before workout',
    importance: 'Optional',
    notes: 'Assists fatty acid transportation into mitochondria during cardio.'
  },
  {
    id: 'acv',
    name: 'Apple Cider Vinegar',
    dosage: '1 tbsp in lukewarm water',
    timing: 'Morning upon waking',
    importance: 'Optional',
    notes: 'Supports insulin sensitivity and digestion during fasting hours.'
  }
];

export function calculateMacros(
  bodyweightKg?: number,
  phase: PhaseType = 'phase2'
): {
  maintenance: number;
  targetCalories: number;
  deficitCalories: number;
  proteinGrams: number;
  fatGrams: number;
  carbGrams: number;
  portionNote: string;
} {
  const bw = Math.max(45, Math.min(160, bodyweightKg || 70));
  const maintenance = Math.round(bw * 29);
  // Phase 2 deficit is 500 kcal; Phase 3 deficit is 300 kcal (+200 kcal more food in Phase 3!)
  const deficitCalories = phase === 'phase3' ? 300 : 500;
  const targetCalories = maintenance - deficitCalories;

  const proteinGrams = Math.round(bw * 2);
  const fatGrams = Math.round(bw * 0.9);
  const proteinCals = proteinGrams * 4;
  const fatCals = fatGrams * 9;
  const carbGrams = Math.max(40, Math.round((targetCalories - proteinCals - fatCals) / 4));

  let portionNote = '70 to 80 kg: Follow standard portions in meal plans without adjustments.';
  if (phase === 'phase1') {
    portionNote = 'Phase 1 Habit Detox: No macro counting needed. Eat clean home-cooked Jain meals, cut sugar/junk, drink 3+ L water.';
  } else if (phase === 'phase3') {
    portionNote = 'Phase 3 Muscle Building: Extra 200 calories are all CARBS. Add 1 extra roti, 1/2 cup rice, or banana around workout.';
  } else {
    if (bw < 70) {
      portionNote = 'Under 70 kg: Remove 1 roti or reduce rice by half a cup to keep calories on target.';
    } else if (bw > 80 && bw <= 90) {
      portionNote = '80 to 90 kg: Add 1 extra whole wheat roti or slightly larger rice serving.';
    } else if (bw > 90) {
      portionNote = 'Above 90 kg: Add 50g paneer and 1 whole wheat roti to cover higher lean mass needs.';
    }
  }

  return {
    maintenance,
    targetCalories,
    deficitCalories,
    proteinGrams,
    fatGrams,
    carbGrams,
    portionNote
  };
}
