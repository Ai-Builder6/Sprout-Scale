export type PlayableGameId =
  | 'clock_routine'
  | 'word_bridge'
  | 'planet_math'
  | 'letter_garden'
  | 'shape_rocket'
  | 'dino_math'
  | 'rainbow_music'
  | 'fruit_counting'
  | 'animal_memory'
  | 'sunflower'
  | 'bubbles'
  | 'tall_short';

export interface ChildPlayroomProgress {
  gamesOpened: Partial<Record<PlayableGameId, number>>;
  gamesCompleted: Partial<Record<PlayableGameId, number>>;
  totalSessions: number;
  totalVictories: number;
  unlockedAt: Record<string, string>;
}

export type BadgeIconKind =
  | 'sprout'
  | 'compass'
  | 'backpack'
  | 'crown'
  | 'star'
  | 'trophy'
  | 'medal'
  | 'book'
  | 'planet'
  | 'rocket'
  | 'music'
  | 'flame';

export type BadgeColorTheme =
  | 'emerald'
  | 'sky'
  | 'amber'
  | 'violet'
  | 'rose'
  | 'orange'
  | 'cyan'
  | 'indigo';

export interface PlayroomBadgeDefinition {
  id: string;
  title: string;
  category: string;
  description: string;
  icon: BadgeIconKind;
  theme: BadgeColorTheme;
  targetCount: number;
  unitLabel: string;
  suggestedGameId: PlayableGameId;
  suggestedGameLabel: string;
  evaluateProgress: (progress: ChildPlayroomProgress) => number;
}

export interface EvaluatedPlayroomBadge extends PlayroomBadgeDefinition {
  currentCount: number;
  isUnlocked: boolean;
  progressPercent: number;
  unlockedDateLabel: string | null;
}

const STORAGE_KEY = 'sproutscale_playroom_badges_v1';

function uniquePlayedCount(progress: ChildPlayroomProgress): number {
  return Object.values(progress.gamesOpened).filter((n) => (n ?? 0) > 0).length;
}

function countPlayedFromList(
  progress: ChildPlayroomProgress,
  ids: PlayableGameId[],
): number {
  return ids.filter((id) => (progress.gamesOpened[id] ?? 0) > 0).length;
}

export const PLAYROOM_BADGE_DEFINITIONS: PlayroomBadgeDefinition[] = [
  {
    id: 'first_sprout_explorer',
    title: 'First Sprout Explorer',
    category: 'Starter',
    description: 'Jump into your very first game in the Kids Playroom.',
    icon: 'sprout',
    theme: 'emerald',
    targetCount: 1,
    unitLabel: 'game played',
    suggestedGameId: 'sunflower',
    suggestedGameLabel: 'Sunflower',
    evaluateProgress: (p) => uniquePlayedCount(p),
  },
  {
    id: 'curious_wanderer',
    title: 'Curious Wanderer',
    category: 'Discovery',
    description: 'Try 3 different colorful games across the Playroom.',
    icon: 'compass',
    theme: 'sky',
    targetCount: 3,
    unitLabel: 'unique games',
    suggestedGameId: 'bubbles',
    suggestedGameLabel: 'Bubbles',
    evaluateProgress: (p) => uniquePlayedCount(p),
  },
  {
    id: 'playroom_adventurer',
    title: 'Playroom Adventurer',
    category: 'Discovery',
    description: 'Explore half the Playroom by trying 6 different games.',
    icon: 'backpack',
    theme: 'orange',
    targetCount: 6,
    unitLabel: 'unique games',
    suggestedGameId: 'clock_routine',
    suggestedGameLabel: 'Clock Quest',
    evaluateProgress: (p) => uniquePlayedCount(p),
  },
  {
    id: 'all_star_explorer',
    title: 'All-Star Explorer',
    category: 'Mastery',
    description: 'Play every single one of the 12 interactive Playroom games!',
    icon: 'crown',
    theme: 'amber',
    targetCount: 12,
    unitLabel: 'unique games',
    suggestedGameId: 'planet_math',
    suggestedGameLabel: 'Planet Math',
    evaluateProgress: (p) => uniquePlayedCount(p),
  },
  {
    id: 'first_gold_star',
    title: 'First Gold Star',
    category: 'Victory',
    description: 'Complete your very first full game round from start to cheer!',
    icon: 'star',
    theme: 'amber',
    targetCount: 1,
    unitLabel: 'round finished',
    suggestedGameId: 'tall_short',
    suggestedGameLabel: 'Tall & Short',
    evaluateProgress: (p) => p.totalVictories,
  },
  {
    id: 'star_collector',
    title: 'Star Collector',
    category: 'Victory',
    description: 'Finish 5 joyful game rounds in any Playroom games.',
    icon: 'medal',
    theme: 'rose',
    targetCount: 5,
    unitLabel: 'rounds finished',
    suggestedGameId: 'animal_memory',
    suggestedGameLabel: 'Memory',
    evaluateProgress: (p) => p.totalVictories,
  },
  {
    id: 'super_champion',
    title: 'Super Playroom Champion',
    category: 'Victory',
    description: 'Celebrate 10 finished game rounds — true superstar status!',
    icon: 'trophy',
    theme: 'violet',
    targetCount: 10,
    unitLabel: 'rounds finished',
    suggestedGameId: 'word_bridge',
    suggestedGameLabel: 'Word Bridge',
    evaluateProgress: (p) => p.totalVictories,
  },
  {
    id: 'word_phonics_wizard',
    title: 'Word & Phonics Wizard',
    category: 'Reading',
    description: 'Play both Letter & Phonics Garden and Sight-Word Treasure Bridge.',
    icon: 'book',
    theme: 'cyan',
    targetCount: 2,
    unitLabel: 'reading games',
    suggestedGameId: 'word_bridge',
    suggestedGameLabel: 'Word Bridge',
    evaluateProgress: (p) => countPlayedFromList(p, ['letter_garden', 'word_bridge']),
  },
  {
    id: 'math_galaxy_brain',
    title: 'Math & Galaxy Brain',
    category: 'Math',
    description: 'Play Counting Fruit, Dino Snack Math, and Planet Orbit Math.',
    icon: 'planet',
    theme: 'violet',
    targetCount: 3,
    unitLabel: 'math games',
    suggestedGameId: 'planet_math',
    suggestedGameLabel: 'Planet Math',
    evaluateProgress: (p) =>
      countPlayedFromList(p, ['fruit_counting', 'dino_math', 'planet_math']),
  },
  {
    id: 'sprout_builder',
    title: 'Little Sprout Builder',
    category: 'Shapes & Size',
    description: 'Play Giant Sunflower, Tall & Short Friends, and Shape Rocket.',
    icon: 'rocket',
    theme: 'indigo',
    targetCount: 3,
    unitLabel: 'builder games',
    suggestedGameId: 'shape_rocket',
    suggestedGameLabel: 'Rocket',
    evaluateProgress: (p) =>
      countPlayedFromList(p, ['sunflower', 'tall_short', 'shape_rocket']),
  },
  {
    id: 'rhythm_time_keeper',
    title: 'Rhythm & Time Keeper',
    category: 'Music & Time',
    description: 'Play Rainbow Xylophone and Sunny Clock & Daily Routines.',
    icon: 'music',
    theme: 'rose',
    targetCount: 2,
    unitLabel: 'rhythm & clock games',
    suggestedGameId: 'clock_routine',
    suggestedGameLabel: 'Clock Quest',
    evaluateProgress: (p) => countPlayedFromList(p, ['rainbow_music', 'clock_routine']),
  },
  {
    id: 'playroom_regular',
    title: 'Playroom Regular',
    category: 'Streak',
    description: 'Launch 10 total play sessions in the SproutScale Playroom.',
    icon: 'flame',
    theme: 'emerald',
    targetCount: 10,
    unitLabel: 'play sessions',
    suggestedGameId: 'dino_math',
    suggestedGameLabel: 'Dino Math',
    evaluateProgress: (p) => p.totalSessions,
  },
];

export function createEmptyPlayroomProgress(): ChildPlayroomProgress {
  return {
    gamesOpened: {},
    gamesCompleted: {},
    totalSessions: 0,
    totalVictories: 0,
    unlockedAt: {},
  };
}

function readAllStoredProgress(): Record<string, ChildPlayroomProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ChildPlayroomProgress>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAllStoredProgress(map: Record<string, ChildPlayroomProgress>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors in restricted sandboxes
  }
}

export function loadChildPlayroomProgress(childId: string): ChildPlayroomProgress {
  const all = readAllStoredProgress();
  const existing = all[childId];
  if (!existing) return createEmptyPlayroomProgress();
  return {
    gamesOpened: existing.gamesOpened ?? {},
    gamesCompleted: existing.gamesCompleted ?? {},
    totalSessions: Number(existing.totalSessions) || 0,
    totalVictories: Number(existing.totalVictories) || 0,
    unlockedAt: existing.unlockedAt ?? {},
  };
}

export function saveChildPlayroomProgress(
  childId: string,
  progress: ChildPlayroomProgress,
): void {
  const all = readAllStoredProgress();
  all[childId] = progress;
  writeAllStoredProgress(all);
}

export function resetChildPlayroomProgress(childId: string): ChildPlayroomProgress {
  const empty = createEmptyPlayroomProgress();
  saveChildPlayroomProgress(childId, empty);
  return empty;
}

function syncUnlockedTimestamps(
  progress: ChildPlayroomProgress,
): { nextProgress: ChildPlayroomProgress; newlyUnlockedIds: string[] } {
  const nowIso = new Date().toISOString();
  const nextUnlockedAt = { ...progress.unlockedAt };
  const newlyUnlockedIds: string[] = [];

  for (const badge of PLAYROOM_BADGE_DEFINITIONS) {
    const current = badge.evaluateProgress(progress);
    if (current >= badge.targetCount && !nextUnlockedAt[badge.id]) {
      nextUnlockedAt[badge.id] = nowIso;
      newlyUnlockedIds.push(badge.id);
    }
  }

  return {
    nextProgress: {
      ...progress,
      unlockedAt: nextUnlockedAt,
    },
    newlyUnlockedIds,
  };
}

export function recordGamePlayed(
  childId: string,
  gameId: PlayableGameId,
): { progress: ChildPlayroomProgress; newlyUnlocked: PlayroomBadgeDefinition[] } {
  const prev = loadChildPlayroomProgress(childId);
  const updated: ChildPlayroomProgress = {
    ...prev,
    gamesOpened: {
      ...prev.gamesOpened,
      [gameId]: (prev.gamesOpened[gameId] ?? 0) + 1,
    },
    totalSessions: prev.totalSessions + 1,
  };
  const { nextProgress, newlyUnlockedIds } = syncUnlockedTimestamps(updated);
  saveChildPlayroomProgress(childId, nextProgress);

  const newlyUnlocked = PLAYROOM_BADGE_DEFINITIONS.filter((b) =>
    newlyUnlockedIds.includes(b.id),
  );
  return { progress: nextProgress, newlyUnlocked };
}

export function recordGameCompleted(
  childId: string,
  gameId: PlayableGameId,
): { progress: ChildPlayroomProgress; newlyUnlocked: PlayroomBadgeDefinition[] } {
  const prev = loadChildPlayroomProgress(childId);
  const updated: ChildPlayroomProgress = {
    ...prev,
    gamesOpened: {
      ...prev.gamesOpened,
      [gameId]: Math.max(1, prev.gamesOpened[gameId] ?? 0),
    },
    gamesCompleted: {
      ...prev.gamesCompleted,
      [gameId]: (prev.gamesCompleted[gameId] ?? 0) + 1,
    },
    totalVictories: prev.totalVictories + 1,
  };
  const { nextProgress, newlyUnlockedIds } = syncUnlockedTimestamps(updated);
  saveChildPlayroomProgress(childId, nextProgress);

  const newlyUnlocked = PLAYROOM_BADGE_DEFINITIONS.filter((b) =>
    newlyUnlockedIds.includes(b.id),
  );
  return { progress: nextProgress, newlyUnlocked };
}

function formatUnlockedShortDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function evaluatePlayroomBadges(
  progress: ChildPlayroomProgress,
): EvaluatedPlayroomBadge[] {
  return PLAYROOM_BADGE_DEFINITIONS.map((def) => {
    const rawCount = def.evaluateProgress(progress);
    const currentCount = Math.min(def.targetCount, Math.max(0, rawCount));
    const isUnlocked =
      rawCount >= def.targetCount || Boolean(progress.unlockedAt[def.id]);
    const progressPercent = isUnlocked
      ? 100
      : Math.round((currentCount / def.targetCount) * 100);
    return {
      ...def,
      currentCount: isUnlocked ? def.targetCount : currentCount,
      isUnlocked,
      progressPercent,
      unlockedDateLabel: formatUnlockedShortDate(progress.unlockedAt[def.id]),
    };
  });
}
