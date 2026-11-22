export type UnitSystem = 'metric' | 'imperial';
export type BiologicalSex = 'boy' | 'girl' | 'unspecified';
export type PaletteId = 'meadow' | 'sunny' | 'ocean' | 'berry';
export type AccessoryId = 'none' | 'sprout' | 'cap' | 'crown' | 'dino';
export type HairStyle = 'curls' | 'bob' | 'spiky' | 'puffs';
export type ChildPhotoKind =
  | 'avatar'
  | 'wall'
  | 'milestone'
  | 'event'
  | 'school'
  | 'family';

export type MilestoneEventCategory =
  | 'birthday'
  | 'firsts'
  | 'school'
  | 'health'
  | 'adventure'
  | 'celebration';

// Validation constants synchronized verbatim with firebase-blueprint.json & firestore.rules
export const VALIDATION_BOUNDS = {
  ID_MAX_LEN: 128,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  NAME_MIN_LEN: 1,
  NAME_MAX_LEN: 50,
  NOTE_MAX_LEN: 120,
  CAPTION_MAX_LEN: 240,
  EVENT_TITLE_MIN_LEN: 1,
  EVENT_TITLE_MAX_LEN: 80,
  EVENT_STORY_MAX_LEN: 400,
  DATE_PATTERN: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  HEX_COLOR_PATTERN: /^#[0-9a-fA-F]{6}$/,
  AGE_TWO_HEIGHT_MIN: 70,
  AGE_TWO_HEIGHT_MAX: 115,
  AGE_TWO_WEIGHT_MIN: 8,
  AGE_TWO_WEIGHT_MAX: 25,
  AGE_MONTHS_MIN: 0,
  AGE_MONTHS_MAX: 216,
  HEIGHT_CM_MIN: 45,
  HEIGHT_CM_MAX: 210,
  WEIGHT_KG_MIN: 2.5,
  WEIGHT_KG_MAX: 120,
} as const;

export interface ChildProfile {
  id: string;
  ownerId: string;
  name: string;
  birthDate: string;
  sex: BiologicalSex;
  ageTwoHeightCm: number;
  ageTwoWeightKg: number;
  paletteId: PaletteId;
  accessoryId: AccessoryId;
  hairStyle: HairStyle;
  skinTone: string;
  hairColor: string;
  avatarDriveFileId: string;
  createdAtMs?: number;
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

export interface ChildPhotoRecord {
  id: string;
  ownerId: string;
  childId: string;
  kind: ChildPhotoKind;
  capturedDate: string;
  ageMonths: number;
  heightCm: number;
  weightKg: number;
  caption: string;
  eventTitle?: string;
  linkedMeasurementId?: string;
  isFavorite?: boolean;
  driveFileId: string;
  createdAtMs: number;
  localDataUrl?: string;
}

export interface MilestoneEventRecord {
  id: string;
  ownerId: string;
  childId: string;
  title: string;
  category: MilestoneEventCategory;
  eventDate: string;
  ageMonths: number;
  story: string;
  heightCm: number;
  weightKg: number;
  linkedMeasurementId?: string;
  linkedPhotoId?: string;
  createdAtMs: number;
}

export const PHOTO_KIND_LABELS: Record<ChildPhotoKind, string> = {
  wall: 'Wall Height Check-In',
  milestone: 'Growth Milestone',
  event: 'Birthday & Special Event',
  school: 'School & Activities',
  family: 'Family Memory',
  avatar: 'Portrait',
};

export const EVENT_CATEGORY_LABELS: Record<MilestoneEventCategory, string> = {
  birthday: 'Birthday',
  firsts: 'First Moment',
  school: 'School & Sports',
  health: 'Checkup & Wellness',
  adventure: 'Trip & Adventure',
  celebration: 'Celebration',
};

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

export const SKIN_TONE_PRESETS: { id: string; label: string; hex: string }[] = [
  { id: 'porcelain', label: 'Porcelain', hex: '#fbe3d3' },
  { id: 'peach', label: 'Warm Peach', hex: '#f4c9a8' },
  { id: 'honey', label: 'Golden Honey', hex: '#e2ab82' },
  { id: 'olive', label: 'Warm Olive', hex: '#c98e63' },
  { id: 'caramel', label: 'Caramel', hex: '#9f6541' },
  { id: 'espresso', label: 'Rich Cocoa', hex: '#6c3f28' },
];

export const HAIR_COLOR_PRESETS: { id: string; label: string; hex: string }[] = [
  { id: 'espresso', label: 'Dark Brown', hex: '#2a1d17' },
  { id: 'chestnut', label: 'Chestnut', hex: '#5c3822' },
  { id: 'golden', label: 'Honey Blonde', hex: '#d49b42' },
  { id: 'auburn', label: 'Copper Red', hex: '#a44225' },
  { id: 'jet', label: 'Jet Black', hex: '#17171c' },
  { id: 'sandy', label: 'Sandy Brown', hex: '#8b623f' },
];

export const CHARACTER_PALETTES: Record<PaletteId, PaletteTheme> = {
  meadow: {
    id: 'meadow',
    label: 'Lime & Cobalt',
    shirtPrimary: '#22c55e',
    shirtSecondary: '#fef08a',
    overalls: '#1d4ed8',
    shoes: '#f97316',
    skin: '#f4c9a8',
    cheeks: '#fb7185',
    hair: '#5c3822',
    accentHex: '#16a34a',
  },
  sunny: {
    id: 'sunny',
    label: 'Sunshine & Coral',
    shirtPrimary: '#facc15',
    shirtSecondary: '#ffffff',
    overalls: '#0284c7',
    shoes: '#f43f5e',
    skin: '#e2ab82',
    cheeks: '#fb7185',
    hair: '#2a1d17',
    accentHex: '#eab308',
  },
  ocean: {
    id: 'ocean',
    label: 'Sky Splash',
    shirtPrimary: '#06b6d4',
    shirtSecondary: '#fef08a',
    overalls: '#4338ca',
    shoes: '#84cc16',
    skin: '#fbe3d3',
    cheeks: '#f43f5e',
    hair: '#8b623f',
    accentHex: '#0891b2',
  },
  berry: {
    id: 'berry',
    label: 'Berry Pop',
    shirtPrimary: '#f43f5e',
    shirtSecondary: '#fde047',
    overalls: '#6d28d9',
    shoes: '#facc15',
    skin: '#9f6541',
    cheeks: '#fb7185',
    hair: '#17171c',
    accentHex: '#e11d48',
  },
};

export const DEMO_CHILD: ChildProfile = {
  id: 'demo_leo',
  ownerId: 'demo_family',
  name: 'Leo',
  birthDate: '2020-11-18',
  sex: 'boy',
  ageTwoHeightCm: 86.5,
  ageTwoWeightKg: 12.5,
  paletteId: 'meadow',
  accessoryId: 'sprout',
  hairStyle: 'curls',
  skinTone: '#f4c9a8',
  hairColor: '#5c3822',
  avatarDriveFileId: '',
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

export const DEMO_EVENTS: MilestoneEventRecord[] = [
  {
    id: 'demo_evt_kinder',
    ownerId: 'demo_family',
    childId: 'demo_leo',
    title: 'First Day of Kindergarten',
    category: 'school',
    eventDate: '2025-09-03',
    ageMonths: 58,
    story: 'Picked out his own green backpack and walked right into classroom 104 with a giant wave.',
    heightCm: 109.2,
    weightKg: 18.4,
    createdAtMs: 1756900000000,
  },
  {
    id: 'demo_evt_tooth',
    ownerId: 'demo_family',
    childId: 'demo_leo',
    title: 'Lost First Front Tooth & 6th Birthday',
    category: 'birthday',
    eventDate: '2026-11-18',
    ageMonths: 72,
    story: 'Wiggled loose right after eating an apple — measured against the kitchen fridge right before cake!',
    heightCm: 116.5,
    weightKg: 21.0,
    linkedMeasurementId: 'demo_m_72',
    createdAtMs: 1795000000000,
  },
];

export interface CalculatedAgeBreakdown {
  years: number;
  months: number;
  days: number;
  totalMonths: number;
  daysUntilNextBirthday: number;
  isBirthdayToday: boolean;
  formattedExactAge: string;
  formattedShortAge: string;
}

export function parseIsoLocalDate(isoDate: string): Date | null {
  if (!VALIDATION_BOUNDS.DATE_PATTERN.test(isoDate)) {
    return null;
  }
  const [yStr, mStr, dStr] = isoDate.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function getLocalTodayIso(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatHumanDate(isoDate: string): string {
  const parsed = parseIsoLocalDate(isoDate);
  if (!parsed) return isoDate;
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Calculates exact chronological age (years, months, days, total months, and next birthday countdown)
 * from a YYYY-MM-DD birthDate relative to an optional YYYY-MM-DD referenceDate (defaults to today).
 */
export function calculateExactAgeFromDob(
  birthDate: string,
  referenceDateIso?: string,
): CalculatedAgeBreakdown | null {
  const dob = parseIsoLocalDate(birthDate);
  if (!dob) return null;

  const ref = parseIsoLocalDate(referenceDateIso ?? getLocalTodayIso()) ?? new Date();
  const safeRef = ref.getTime() < dob.getTime() ? dob : ref;

  let years = safeRef.getFullYear() - dob.getFullYear();
  let months = safeRef.getMonth() - dob.getMonth();
  let days = safeRef.getDate() - dob.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(safeRef.getFullYear(), safeRef.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  years = Math.max(0, years);
  months = Math.max(0, months);
  days = Math.max(0, days);

  const totalMonths = clampNumber(
    years * 12 + months + (days >= 15 ? 1 : 0),
    VALIDATION_BOUNDS.AGE_MONTHS_MIN,
    VALIDATION_BOUNDS.AGE_MONTHS_MAX,
  );

  // Days until next birthday from today
  const today = parseIsoLocalDate(getLocalTodayIso()) ?? new Date();
  let nextBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  if (nextBday.getTime() < today.getTime()) {
    nextBday = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
  }
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilNextBirthday = Math.max(
    0,
    Math.round((nextBday.getTime() - today.getTime()) / msPerDay),
  );
  const isBirthdayToday =
    today.getMonth() === dob.getMonth() && today.getDate() === dob.getDate();

  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years} ${years === 1 ? 'yr' : 'yrs'}`);
  }
  if (months > 0 || years === 0) {
    parts.push(`${months} ${months === 1 ? 'mo' : 'mos'}`);
  }
  if (days > 0) {
    parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  }

  const formattedExactAge = parts.join(', ');
  const formattedShortAge =
    years === 0
      ? `${months}m`
      : months === 0
        ? `${years} yrs`
        : `${years}y ${months}m`;

  return {
    years,
    months,
    days,
    totalMonths,
    daysUntilNextBirthday,
    isBirthdayToday,
    formattedExactAge,
    formattedShortAge,
  };
}

export function clampNumber(val: number, min: number, max: number): number {
  if (Number.isNaN(val)) return min;
  return Math.min(max, Math.max(min, val));
}

export function sanitizeHexColor(raw: string | undefined, fallback: string): string {
  if (raw && VALIDATION_BOUNDS.HEX_COLOR_PATTERN.test(raw)) {
    return raw.toLowerCase();
  }
  return fallback;
}

export function sanitizeBiologicalSex(raw: unknown): BiologicalSex {
  if (raw === 'boy' || raw === 'girl' || raw === 'unspecified') {
    return raw;
  }
  return 'unspecified';
}

export function sanitizePhotoKind(raw: unknown): ChildPhotoKind {
  if (
    raw === 'avatar' ||
    raw === 'wall' ||
    raw === 'milestone' ||
    raw === 'event' ||
    raw === 'school' ||
    raw === 'family'
  ) {
    return raw;
  }
  return 'milestone';
}

export function sanitizeEventCategory(raw: unknown): MilestoneEventCategory {
  if (
    raw === 'birthday' ||
    raw === 'firsts' ||
    raw === 'school' ||
    raw === 'health' ||
    raw === 'adventure' ||
    raw === 'celebration'
  ) {
    return raw;
  }
  return 'celebration';
}

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, VALIDATION_BOUNDS.ID_MAX_LEN);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

export function cmToInches(cm: number): number {
  return cm / 2.54;
}

export function inchesToCm(inches: number): number {
  return inches * 2.54;
}

export function kgToLbs(kg: number): number {
  return kg * 2.20462262;
}

export function lbsToKg(lbs: number): number {
  return lbs / 2.20462262;
}

export function splitCmToFeetAndInches(heightCm: number): {
  feet: number;
  inches: number;
  totalInches: number;
} {
  const totalInches = Math.max(0, cmToInches(heightCm));
  let feet = Math.floor(totalInches / 12);
  let inches = Number((totalInches - feet * 12).toFixed(1));
  if (inches >= 12) {
    feet += 1;
    inches = 0;
  }
  return {
    feet,
    inches,
    totalInches: Number(totalInches.toFixed(1)),
  };
}

export function formatFeetInches(heightCm: number): string {
  const { feet, inches } = splitCmToFeetAndInches(heightCm);
  return `${feet}' ${inches.toFixed(1)}"`;
}

export function formatTotalInches(heightCm: number): string {
  return `${cmToInches(heightCm).toFixed(1)} in`;
}

export function formatPounds(weightKg: number): string {
  return `${kgToLbs(weightKg).toFixed(1)} lb`;
}

export function formatMetricHeight(heightCm: number): string {
  return `${heightCm.toFixed(1)} cm`;
}

export function formatMetricWeight(weightKg: number): string {
  return `${weightKg.toFixed(1)} kg`;
}

export function formatHeight(heightCm: number, units: UnitSystem = 'imperial'): string {
  if (units === 'metric') {
    return `${heightCm.toFixed(1)} cm`;
  }
  return formatFeetInches(heightCm);
}

export function formatHeightDelta(deltaCm: number, units: UnitSystem = 'imperial'): string {
  const sign = deltaCm >= 0 ? '+' : '-';
  const absCm = Math.abs(deltaCm);
  if (units === 'metric') {
    return `${sign}${absCm.toFixed(1)} cm`;
  }
  const inches = cmToInches(absCm);
  return `${sign}${inches.toFixed(1)} in`;
}

export function formatWeight(weightKg: number, units: UnitSystem = 'imperial'): string {
  if (units === 'metric') {
    return `${weightKg.toFixed(1)} kg`;
  }
  return formatPounds(weightKg);
}

export function formatWeightDelta(deltaKg: number, units: UnitSystem = 'imperial'): string {
  const sign = deltaKg >= 0 ? '+' : '-';
  const absKg = Math.abs(deltaKg);
  if (units === 'metric') {
    return `${sign}${absKg.toFixed(1)} kg`;
  }
  const lbs = kgToLbs(absKg);
  return `${sign}${lbs.toFixed(1)} lb`;
}

export function formatAgeLabel(ageMonths: number): string {
  if (ageMonths < 12) {
    return `Age ${ageMonths} mos`;
  }
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
      stageName: 'Little Sprout (Toddler)',
      description: 'Toddler proportions, denim bib overalls, and busy footsteps.',
    };
  }
  if (ageMonths < 60) {
    return {
      stageName: 'Preschool Explorer',
      description: 'Stretching taller with layered striped tee and curious stride.',
    };
  }
  if (ageMonths < 96) {
    return {
      stageName: 'Big Kid Adventurer',
      description: 'Longer legs, sporty varsity top, and confident reach.',
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
  const heightIn = cmToInches(heightCm);
  const soccerBalls = (heightIn / 8.7).toFixed(1);
  const stackedApples = Math.max(1, Math.round(heightIn / 3.5));
  const heightFact = `${heightIn.toFixed(1)}" is about ${soccerBalls} soccer balls or ${stackedApples} stacked apples tall!`;

  const gainedCm = Math.max(0, heightCm - ageTwoHeightCm);
  const gainedIn = cmToInches(gainedCm);
  const apples = Math.max(1, Math.round(gainedIn / 3));
  const growthFact =
    gainedIn < 0.4
      ? 'Right at the Age 2 starting mark — ready to sprout upward!'
      : `Sprouted +${gainedIn.toFixed(1)} in (${apples} stacked apples) taller since turning 2!`;

  let weightFact = 'About the weight of a big basket of picnic apples!';
  if (weightKg < 14) {
    weightFact = 'Weighs about the same as 3 fluffy house cats (~28 lb)!';
  } else if (weightKg < 18) {
    weightFact = 'Weighs about as much as 2 large summer watermelons (~36 lb)!';
  } else if (weightKg < 24) {
    weightFact = 'Weighs about the same as a friendly Corgi pup + backpack (~46 lb)!';
  } else if (weightKg < 34) {
    weightFact = 'Weighs about as much as a Golden Retriever puppy (~65 lb)!';
  } else {
    weightFact = 'Strong and steady — about the weight of 5 ten-pound bowling balls!';
  }

  return { heightFact, growthFact, weightFact };
}
