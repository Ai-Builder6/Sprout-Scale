export type UnitSystem = 'metric' | 'imperial';
export type PaletteId = 'meadow' | 'sunny' | 'ocean' | 'berry';
export type AccessoryId = 'sprout' | 'cap' | 'crown' | 'dino';
export type HairStyle = 'curls' | 'bob' | 'spiky' | 'puffs';

// Validation constants synchronized verbatim with firebase-blueprint.json & firestore.rules
export const VALIDATION_BOUNDS = {
  ID_MAX_LEN: 128,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  NAME_MIN_LEN: 1,
  NAME_MAX_LEN: 50,
  NOTE_MAX_LEN: 120,
  DATE_PATTERN: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  AGE_TWO_HEIGHT_MIN: 70,
  AGE_TWO_HEIGHT_MAX: 115,
  AGE_TWO_WEIGHT_MIN: 8,
  AGE_TWO_WEIGHT_MAX: 25,
  AGE_MONTHS_MIN: 24,
  AGE_MONTHS_MAX: 216,
  HEIGHT_CM_MIN: 65,
  HEIGHT_CM_MAX: 210,
  WEIGHT_KG_MIN: 7,
  WEIGHT_KG_MAX: 120,
} as const;

export interface ChildProfile {
  id: string;
  ownerId: string;
  name: string;
  ageTwoHeightCm: number;
  ageTwoWeightKg: number;
  paletteId: PaletteId;
  accessoryId: AccessoryId;
  hairStyle: HairStyle;
}

export interface GrowthMeasurement {
  id: string;
  ownerId: string;
  childId: string;
  ageMonths: number;
  heightCm: number;
  weightKg: number;
  recordedDate: string;
  note: string;
}

export interface PaletteTheme {
  id: PaletteId;
  label: string;
  shirtPrimary: string;
  shirtSecondary: string;
  overalls: string;
  shoes: string;
  skin: string;
  cheeks: string;
  hair: string;
  accentHex: string;
}

export const CHARACTER_PALETTES: Record<PaletteId, PaletteTheme> = {
  meadow: {
    id: 'meadow',
    label: 'Lime & Cobalt',
    shirtPrimary: '#22c55e',
    shirtSecondary: '#fef08a',
    overalls: '#1d4ed8',
    shoes: '#f97316',
    skin: '#f6cba3',
    cheeks: '#fb7185',
    hair: '#4a2e1b',
    accentHex: '#16a34a',
  },
  sunny: {
    id: 'sunny',
    label: 'Sunshine & Coral',
    shirtPrimary: '#facc15',
    shirtSecondary: '#ffffff',
    overalls: '#0284c7',
    shoes: '#f43f5e',
    skin: '#e0a97b',
    cheeks: '#fb7185',
    hair: '#291d16',
    accentHex: '#eab308',
  },
  ocean: {
    id: 'ocean',
    label: 'Sky Splash',
    shirtPrimary: '#06b6d4',
    shirtSecondary: '#fef08a',
    overalls: '#4338ca',
    shoes: '#84cc16',
    skin: '#f9dcc4',
    cheeks: '#f43f5e',
    hair: '#7c4a27',
    accentHex: '#0891b2',
  },
  berry: {
    id: 'berry',
    label: 'Berry Pop',
    shirtPrimary: '#f43f5e',
    shirtSecondary: '#fde047',
    overalls: '#6d28d9',
    shoes: '#facc15',
    skin: '#8d5b3e',
    cheeks: '#fb7185',
    hair: '#1c1512',
    accentHex: '#e11d48',
  },
};

export const DEMO_CHILD: ChildProfile = {
  id: 'demo_leo',
  ownerId: 'demo_family',
  name: 'Leo',
  ageTwoHeightCm: 86.5,
  ageTwoWeightKg: 12.5,
  paletteId: 'meadow',
  accessoryId: 'sprout',
  hairStyle: 'curls',
};

export const DEMO_MEASUREMENTS: GrowthMeasurement[] = [
  {
    id: 'demo_m_24',
    ownerId: 'demo_family',
    childId: 'demo_leo',
    ageMonths: 24,
    heightCm: 86.5,
    weightKg: 12.5,
    recordedDate: '2022-11-18',
    note: '2nd Birthday baseline — loved stacking wooden blocks',
  },
  {
    id: 'demo_m_36',
    ownerId: 'demo_family',
    childId: 'demo_leo',
    ageMonths: 36,
    heightCm: 95.5,
    weightKg: 14.6,
    recordedDate: '2023-11-18',
    note: '3rd Birthday — riding balance scooter without help',
  },
  {
    id: 'demo_m_48',
    ownerId: 'demo_family',
    childId: 'demo_leo',
    ageMonths: 48,
    heightCm: 103.0,
    weightKg: 16.5,
    recordedDate: '2024-11-18',
    note: 'Preschool star — can reach the kitchen sink tap',
  },
  {
    id: 'demo_m_60',
    ownerId: 'demo_family',
    childId: 'demo_leo',
    ageMonths: 60,
    heightCm: 110.2,
    weightKg: 18.7,
    recordedDate: '2025-11-18',
    note: 'First year of Kindergarten — outgrew rainboots twice',
  },
  {
    id: 'demo_m_72',
    ownerId: 'demo_family',
    childId: 'demo_leo',
    ageMonths: 72,
    heightCm: 116.5,
    weightKg: 21.0,
    recordedDate: '2026-11-18',
    note: 'Age 6 check-in — lost first front tooth!',
  },
];

export function clampNumber(val: number, min: number, max: number): number {
  if (Number.isNaN(val)) return min;
  return Math.min(max, Math.max(min, val));
}

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, VALIDATION_BOUNDS.ID_MAX_LEN);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

export function formatHeight(heightCm: number, units: UnitSystem): string {
  if (units === 'metric') {
    return `${heightCm.toFixed(1)} cm`;
  }
  const totalInches = heightCm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches - feet * 12;
  if (inches >= 11.95) {
    return `${feet + 1}' 0.0"`;
  }
  return `${feet}' ${inches.toFixed(1)}"`;
}

export function formatHeightDelta(deltaCm: number, units: UnitSystem): string {
  const sign = deltaCm >= 0 ? '+' : '-';
  const absCm = Math.abs(deltaCm);
  if (units === 'metric') {
    return `${sign}${absCm.toFixed(1)} cm`;
  }
  const inches = absCm / 2.54;
  return `${sign}${inches.toFixed(1)} in`;
}

export function formatWeight(weightKg: number, units: UnitSystem): string {
  if (units === 'metric') {
    return `${weightKg.toFixed(1)} kg`;
  }
  const lbs = weightKg * 2.20462;
  return `${lbs.toFixed(1)} lb`;
}

export function formatWeightDelta(deltaKg: number, units: UnitSystem): string {
  const sign = deltaKg >= 0 ? '+' : '-';
  const absKg = Math.abs(deltaKg);
  if (units === 'metric') {
    return `${sign}${absKg.toFixed(1)} kg`;
  }
  const lbs = absKg * 2.20462;
  return `${sign}${lbs.toFixed(1)} lb`;
}

export function formatAgeLabel(ageMonths: number): string {
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  if (months === 0) {
    return `Age ${years} yrs`;
  }
  return `Age ${years}y ${months}m`;
}

export function getGrowthStageInfo(ageMonths: number): {
  stageName: string;
  description: string;
} {
  if (ageMonths < 36) {
    return {
      stageName: 'Little Sprout (Age 2)',
      description: 'Toddler proportions, button overalls, and busy footsteps.',
    };
  }
  if (ageMonths < 60) {
    return {
      stageName: 'Preschool Explorer',
      description: 'Stretching taller with striped tee and curious stride.',
    };
  }
  if (ageMonths < 96) {
    return {
      stageName: 'Big Kid Adventurer',
      description: 'Longer legs, adventure vest, and big confident reach.',
    };
  }
  return {
    stageName: 'Junior Trailblazer',
    description: 'Tall athletic posture ready for big-kid rollercoasters.',
  };
}

export function getFunComparison(
  heightCm: number,
  weightKg: number,
  ageTwoHeightCm: number,
): {
  heightFact: string;
  growthFact: string;
  weightFact: string;
} {
  let heightFact = 'About as tall as an acoustic ukulele stood upright!';
  if (heightCm < 90) {
    heightFact = 'About as tall as a friendly Golden Retriever sitting proud!';
  } else if (heightCm < 102) {
    heightFact = 'Tall enough to peek right over a standard kitchen chair!';
  } else if (heightCm < 114) {
    heightFact = 'Nearly eye-to-eye with an Emperor Penguin (115 cm)!';
  } else if (heightCm < 126) {
    heightFact = 'About as tall as 5 regulation soccer balls stacked high!';
  } else if (heightCm < 140) {
    heightFact = 'Tall enough for many big-kid theme park adventure rides (137 cm)!';
  } else {
    heightFact = 'Standing as tall as a baby giraffe’s shoulder!';
  }

  const gainedCm = Math.max(0, heightCm - ageTwoHeightCm);
  const apples = Math.max(1, Math.round(gainedCm / 7.5));
  const growthFact =
    gainedCm < 1
      ? 'Right at the Age 2 starting mark — ready to sprout upward!'
      : `Sprouted ${apples} stacked apples taller since turning 2!`;

  let weightFact = 'About the weight of a big basket of picnic apples!';
  if (weightKg < 14) {
    weightFact = 'Weighs about the same as 3 fluffy house cats!';
  } else if (weightKg < 18) {
    weightFact = 'Weighs about as much as 2 large summer watermelons!';
  } else if (weightKg < 24) {
    weightFact = 'Weighs about the same as a friendly Corgi pup + backpack!';
  } else if (weightKg < 34) {
    weightFact = 'Weighs about as much as a Golden Retriever puppy!';
  } else {
    weightFact = 'Strong and steady — about the weight of 4 bowling balls!';
  }

  return { heightFact, growthFact, weightFact };
}
