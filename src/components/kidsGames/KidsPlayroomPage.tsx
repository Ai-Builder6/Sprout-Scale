import React, { useState } from 'react';
import {
  ArrowLeft,
  Gamepad2,
  LayoutGrid,
  Moon,
  Play,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ChildProfile,
  formatFeetInches,
} from '../../types';
import {
  isKidGamesMuted,
  setKidGamesMuted,
  unlockKidGameAudio,
} from '../../services/kidGameAudioService';
import { useDefaultAppAvatar } from '../../services/defaultAvatarService';
import { SunflowerSproutGame } from './SunflowerSproutGame';
import { BubblePopAnimalGame } from './BubblePopAnimalGame';
import { TallShortFriendsGame } from './TallShortFriendsGame';
import { RainbowMusicGame } from './RainbowMusicGame';
import { CountingFruitBasketGame } from './CountingFruitBasketGame';
import { AnimalMemoryMatchGame } from './AnimalMemoryMatchGame';
import { LetterPhonicsGardenGame } from './LetterPhonicsGardenGame';
import { ShapeRocketBuilderGame } from './ShapeRocketBuilderGame';
import { DinoSnackMathGame } from './DinoSnackMathGame';
import { ClockRoutineQuestGame } from './ClockRoutineQuestGame';
import { WordBridgeQuestGame } from './WordBridgeQuestGame';
import { PlanetMathMissionGame } from './PlanetMathMissionGame';

import sunflowerCardImg from '../../assets/images/game_sunflower_garden_1795060511785.jpg';
import bubbleCardImg from '../../assets/images/game_bubble_meadow_1795060511345.jpg';
import tallShortCardImg from '../../assets/images/game_tall_short_friends_1795060511989.jpg';
import rainbowMusicCardImg from '../../assets/images/game_rainbow_music_1795078485188.jpg';
import fruitCountingCardImg from '../../assets/images/game_fruit_counting_1795078484557.jpg';
import animalMemoryCardImg from '../../assets/images/game_animal_memory_1795078484282.jpg';
import letterGardenCardImg from '../../assets/images/game_letter_phonics_garden_1795320213382.jpg';
import shapeRocketCardImg from '../../assets/images/game_shape_rocket_builder_1795320212849.jpg';
import dinoMathCardImg from '../../assets/images/game_dino_snack_math_1795320212169.jpg';
import clockRoutineCardImg from '../../assets/images/game_clock_routine_quest_1795323640283.jpg';
import wordBridgeCardImg from '../../assets/images/game_word_bridge_quest_1795323640865.jpg';
import planetMathCardImg from '../../assets/images/game_planet_math_mission_1795323639986.jpg';

export type PlayroomGameId =
  | 'hub'
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

type AgeGroupFilter = 'all' | '2_4' | '3_5' | '3_6' | '4_7' | '5_8';

interface KidsPlayroomPageProps {
  activeChild: ChildProfile;
  childrenList: ChildProfile[];
  avatarPhotoMap: Record<string, string>;
  activeChildHeightCm: number;
  onSelectChild: (childId: string) => void;
  onBackToGrowthWall: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

interface GameCatalogItem {
  id: Exclude<PlayroomGameId, 'hub'>;
  title: string;
  shortLabel: string;
  ageGroup: '2_4' | '3_5' | '3_6' | '4_7' | '5_8';
  metaLine: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  imageClassName?: string;
  fallbackBgClass: string;
  ctaClass: string;
  borderClass: string;
}

const PLAYROOM_GAMES: GameCatalogItem[] = [
  {
    id: 'clock_routine',
    title: 'Sunny Clock & Daily Routines',
    shortLabel: 'Clock Quest',
    ageGroup: '3_6',
    metaLine: 'Ages 3–6 · Telling Time & Routines · 2 Modes',
    description:
      'Move and read a cheerful sunflower clock to match breakfast, playtime, storytime, and bedtime — starting with O’Clock (3–5) and stepping up to Half-Past (4–6).',
    imageSrc: clockRoutineCardImg,
    imageAlt: 'Cheerful sunny wooden clock with friendly smiling hands beside breakfast pancakes and a bedtime moon',
    fallbackBgClass: 'from-amber-100 via-sky-50 to-orange-100 dark:from-amber-950 dark:via-slate-900 dark:to-orange-950',
    ctaClass: 'bg-orange-500 hover:bg-orange-600 text-white',
    borderClass: 'border-orange-200 hover:border-orange-400 dark:border-orange-800/80 dark:hover:border-orange-500',
  },
  {
    id: 'word_bridge',
    title: 'Sight-Word Treasure Bridge',
    shortLabel: 'Word Bridge',
    ageGroup: '4_7',
    metaLine: 'Ages 4–7 · Phonics & 5-Letter Spelling · 2 Modes',
    description:
      'Snap wooden letter planks across a sparkling river to guide Pip the explorer to the treasure chest — from missing-letter clues (4–5) to full 5-letter spelling (5–7).',
    imageSrc: wordBridgeCardImg,
    imageAlt: 'Wooden alphabet planks forming a colorful stepping bridge across a sparkling river toward a golden treasure chest',
    fallbackBgClass: 'from-cyan-100 via-emerald-50 to-amber-100 dark:from-cyan-950 dark:via-slate-900 dark:to-amber-950',
    ctaClass: 'bg-cyan-600 hover:bg-cyan-700 text-white',
    borderClass: 'border-cyan-200 hover:border-cyan-400 dark:border-cyan-800/80 dark:hover:border-cyan-500',
  },
  {
    id: 'planet_math',
    title: 'Planet Orbit Math & Logic',
    shortLabel: 'Planet Math',
    ageGroup: '5_8',
    metaLine: 'Ages 5–8 · Skip-Counting, 2-Digit Sums & Arrays · 2 Modes',
    description:
      'Power up your starship across vibrant planets by solving skip-counting patterns and 2-digit sums (5–6), or step up to visual star-grid multiplication arrays (6–8).',
    imageSrc: planetMathCardImg,
    imageAlt: 'Colorful ringed planets, glowing constellations, and a friendly cartoon rocket soaring through a starry indigo galaxy',
    fallbackBgClass: 'from-violet-100 via-indigo-50 to-sky-100 dark:from-violet-950 dark:via-slate-900 dark:to-sky-950',
    ctaClass: 'bg-violet-600 hover:bg-violet-700 text-white',
    borderClass: 'border-violet-200 hover:border-violet-400 dark:border-violet-800/80 dark:hover:border-violet-500',
  },
  {
    id: 'letter_garden',
    title: 'Letter & Phonics Garden',
    shortLabel: 'ABCs',
    ageGroup: '3_6',
    metaLine: 'Ages 3–6 · Phonics & Early Spelling · 2 Modes',
    description:
      'Listen to friendly garden words like Cat, Sun, Frog, and Star, then pick the starting letter or spell the whole word in flower tiles.',
    imageSrc: letterGardenCardImg,
    imageAlt: 'Smiling butterfly fluttering over wooden alphabet letter blocks in a sunny flower garden',
    fallbackBgClass: 'from-emerald-100 via-sky-50 to-amber-100 dark:from-emerald-950 dark:via-slate-900 dark:to-amber-950',
    ctaClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    borderClass: 'border-emerald-200 hover:border-emerald-400 dark:border-emerald-800/80 dark:hover:border-emerald-500',
  },
  {
    id: 'shape_rocket',
    title: 'Shape Rocket Builder',
    shortLabel: 'Rocket',
    ageGroup: '3_6',
    metaLine: 'Ages 3–6 · Geometry & Patterns · Launch!',
    description:
      'Match triangles, circles, stars, and rectangles—or finish colorful shape patterns—to assemble a rocket ship and blast off into space!',
    imageSrc: shapeRocketCardImg,
    imageAlt: 'Cheerful colorful rocket ship made of geometric shapes lifting off into a starry sky',
    fallbackBgClass: 'from-indigo-100 via-sky-50 to-purple-100 dark:from-indigo-950 dark:via-slate-900 dark:to-purple-950',
    ctaClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    borderClass: 'border-indigo-200 hover:border-indigo-400 dark:border-indigo-800/80 dark:hover:border-indigo-500',
  },
  {
    id: 'dino_math',
    title: 'Dino Snack Math',
    shortLabel: 'Dino Math',
    ageGroup: '3_6',
    metaLine: 'Ages 3–6 · Addition & Subtraction (1–10) · 2 Modes',
    description:
      'Count juicy berries, crunch leaves, and mangoes with Pip the green baby dinosaur to solve playful adding and take-away math puzzles.',
    imageSrc: dinoMathCardImg,
    imageAlt: 'Cute green baby dinosaur smiling beside colorful berries and leaves in a prehistoric meadow',
    fallbackBgClass: 'from-amber-100 via-emerald-50 to-rose-100 dark:from-amber-950 dark:via-slate-900 dark:to-rose-950',
    ctaClass: 'bg-amber-500 hover:bg-amber-600 text-slate-950',
    borderClass: 'border-amber-200 hover:border-amber-400 dark:border-amber-800/80 dark:hover:border-amber-500',
  },
  {
    id: 'rainbow_music',
    title: 'Rainbow Xylophone & Song',
    shortLabel: 'Xylophone',
    ageGroup: '3_5',
    metaLine: 'Ages 3–5 · Music & Color Patterns · 2 Modes',
    description:
      'Tap glowing rainbow xylophone keys to play guided nursery tunes or follow colorful musical patterns to earn 4 stars.',
    imageSrc: rainbowMusicCardImg,
    imageAlt: 'Colorful rainbow wooden xylophone in a sunny meadow with singing bluebirds and musical notes',
    fallbackBgClass: 'from-purple-100 via-amber-50 to-sky-100 dark:from-purple-950 dark:via-slate-900 dark:to-sky-950',
    ctaClass: 'bg-purple-600 hover:bg-purple-700 text-white',
    borderClass: 'border-purple-200 hover:border-purple-400 dark:border-purple-800/80 dark:hover:border-purple-500',
  },
  {
    id: 'fruit_counting',
    title: 'Counting Fruit Basket',
    shortLabel: 'Count Fruit',
    ageGroup: '3_5',
    metaLine: 'Ages 3–5 · Counting 1 to 5 · Orchard Picnic',
    description:
      'Pick shiny red apples, yellow bananas, strawberries, oranges, and purple plums from the sunny tree into your picnic basket.',
    imageSrc: fruitCountingCardImg,
    imageAlt: 'Sunny orchard tree bursting with apples, bananas, and strawberries above a woven picnic basket',
    imageClassName: 'scale-[1.16] hover:scale-[1.2]',
    fallbackBgClass: 'from-rose-100 via-amber-50 to-emerald-100 dark:from-rose-950 dark:via-slate-900 dark:to-emerald-950',
    ctaClass: 'bg-rose-500 hover:bg-rose-600 text-white',
    borderClass: 'border-rose-200 hover:border-rose-400 dark:border-rose-800/80 dark:hover:border-rose-500',
  },
  {
    id: 'animal_memory',
    title: 'Animal Memory Match',
    shortLabel: 'Memory',
    ageGroup: '3_5',
    metaLine: 'Ages 3–5 · Flip & Match · 4 or 6 Pairs',
    description:
      'Flip oversized star cards on a sunny picnic blanket to match smiling lions, dinosaurs, whales, pandas, unicorns, and owls.',
    imageSrc: animalMemoryCardImg,
    imageAlt: 'Colorful animal picture cards spread on a sunny meadow picnic blanket with a lion, dino, whale, and panda',
    fallbackBgClass: 'from-teal-100 via-amber-50 to-pink-100 dark:from-teal-950 dark:via-slate-900 dark:to-pink-950',
    ctaClass: 'bg-teal-600 hover:bg-teal-700 text-white',
    borderClass: 'border-teal-200 hover:border-teal-400 dark:border-teal-800/80 dark:hover:border-teal-500',
  },
  {
    id: 'sunflower',
    title: 'Grow a Giant Sunflower',
    shortLabel: 'Sunflower',
    ageGroup: '2_4',
    metaLine: 'Ages 2–4 · Tap & Grow · Height Ruler',
    description:
      'Tap the smiling sun, watering can, and rain cloud to sprout a sunflower taller than your own height mark!',
    imageSrc: sunflowerCardImg,
    imageAlt: 'Smiling golden sunflower growing next to a wooden ruler and blue watering can',
    fallbackBgClass: 'from-emerald-100 via-amber-50 to-sky-100 dark:from-emerald-950 dark:via-slate-900 dark:to-sky-950',
    ctaClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    borderClass: 'border-emerald-200 hover:border-emerald-400 dark:border-emerald-800/80 dark:hover:border-emerald-500',
  },
  {
    id: 'bubbles',
    title: 'Peek-a-Boo Animal Bubbles',
    shortLabel: 'Bubbles',
    ageGroup: '2_4',
    metaLine: 'Ages 2–4 · Colors & Animals · 2 Modes',
    description:
      'Pop giant floating soap bubbles filled with cute ducks, bunnies, penguins, and frogs with gentle musical pops.',
    imageSrc: bubbleCardImg,
    imageAlt: 'Giant pastel soap bubbles carrying a yellow duckling, pink bunny, and blue penguin',
    fallbackBgClass: 'from-sky-100 via-pink-50 to-emerald-100 dark:from-sky-950 dark:via-slate-900 dark:to-emerald-950',
    ctaClass: 'bg-sky-500 hover:bg-sky-600 text-white',
    borderClass: 'border-sky-200 hover:border-sky-400 dark:border-sky-800/80 dark:hover:border-sky-500',
  },
  {
    id: 'tall_short',
    title: 'Tall & Short Animal Friends',
    shortLabel: 'Tall & Short',
    ageGroup: '2_4',
    metaLine: 'Ages 2–4 · Early Measuring · 5 Stars',
    description:
      'Compare friendly giraffes, elephants, bunnies, and baby turtles standing side-by-side to spot who is taller or shorter.',
    imageSrc: tallShortCardImg,
    imageAlt: 'Tall spotted giraffe and tiny smiling baby bunny standing together on a sunny daisy meadow',
    fallbackBgClass: 'from-amber-100 via-emerald-50 to-sky-100 dark:from-amber-950 dark:via-slate-900 dark:to-sky-950',
    ctaClass: 'bg-amber-500 hover:bg-amber-600 text-slate-950',
    borderClass: 'border-amber-200 hover:border-amber-400 dark:border-amber-800/80 dark:hover:border-amber-500',
  },
];

export const KidsPlayroomPage: React.FC<KidsPlayroomPageProps> = ({
  activeChild,
  childrenList,
  avatarPhotoMap,
  activeChildHeightCm,
  onSelectChild,
  onBackToGrowthWall,
  isDark = false,
  onToggleTheme,
}) => {
  const defaultAppAvatar = useDefaultAppAvatar();
  const [selectedGame, setSelectedGame] = useState<PlayroomGameId>('hub');
  const [ageFilter, setAgeFilter] = useState<AgeGroupFilter>('all');
  const [isMuted, setIsMuted] = useState<boolean>(() => isKidGamesMuted());
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const handleToggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    setKidGamesMuted(nextMuted);
    if (!nextMuted) {
      unlockKidGameAudio();
    }
  };

  const handleOpenGame = (gameId: PlayroomGameId) => {
    if (gameId !== 'hub') {
      unlockKidGameAudio();
    }
    setSelectedGame(gameId);
  };

  const activeHeightFormatted = formatFeetInches(activeChildHeightCm);
  const visibleGames =
    ageFilter === 'all'
      ? PLAYROOM_GAMES
      : PLAYROOM_GAMES.filter((g) => g.ageGroup === ageFilter);

  const countByAge = (group: Exclude<AgeGroupFilter, 'all'>) =>
    PLAYROOM_GAMES.filter((g) => g.ageGroup === group).length;

  return (
    <section aria-label="Kids Playroom" className="space-y-6">
      {/* Playroom Top Workspace Header */}
      <div className="bg-white/95 dark:bg-slate-900/95 rounded-3xl border-2 border-amber-200 dark:border-slate-700 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <img
              src={avatarPhotoMap[activeChild.id] || defaultAppAvatar.portraitUrl}
              alt={`${activeChild.name} avatar`}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover object-top border-2 border-amber-300 dark:border-amber-500 bg-sky-50 dark:bg-slate-800 shadow-xs shrink-0"
            />
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                <Gamepad2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                <span>Kids Playroom</span>
                <span aria-hidden="true">·</span>
                <span>{PLAYROOM_GAMES.length} Progressive Games for Ages 2–8</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  {activeChild.name}: {activeHeightFormatted}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-indigo-950 dark:text-white">
                Hi {activeChild.name}! Pick a colorful game to play!
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
                Stepping up from toddler bubbles and counting (2–5) to clocks &amp; phonics (3–6), sight-word bridges (4–7), and planet skip-counting &amp; multiplication arrays (5–8) — cheerful sounds and zero stress timers.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Light / Dark Mode Toggle */}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 border-sky-200 dark:border-slate-700 bg-sky-50 dark:bg-slate-800 text-indigo-950 dark:text-amber-300 hover:bg-sky-100 dark:hover:bg-slate-700 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap"
              >
                {isDark ? (
                  <>
                    <Sun className="w-4 h-4 shrink-0" aria-hidden="true" />
                    Light
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    Dark
                  </>
                )}
              </button>
            )}

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={handleToggleSound}
              className={`min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                isMuted
                  ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60'
              }`}
              aria-pressed={!isMuted}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 shrink-0" aria-hidden="true" />
                  Sound Off
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  Sound On
                </>
              )}
            </button>

            {/* Back to Growth Wall */}
            <button
              type="button"
              onClick={onBackToGrowthWall}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-950 dark:bg-amber-400 hover:bg-indigo-900 dark:hover:bg-amber-300 text-white dark:text-slate-950 text-sm font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              Back to Growth Wall
            </button>
          </div>
        </div>

        {/* Multi-Child Switcher Row (shown when family has 2+ kids) */}
        {childrenList.length > 1 && (
          <div className="mt-4 pt-4 border-t border-amber-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">
              Who is playing?
            </span>
            {childrenList.map((kid) => {
              const isSelected = kid.id === activeChild.id;
              const thumb = avatarPhotoMap[kid.id] ?? null;
              return (
                <button
                  key={kid.id}
                  type="button"
                  onClick={() => onSelectChild(kid.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'bg-sky-50 dark:bg-slate-800 text-indigo-950 dark:text-slate-200 hover:bg-sky-100 dark:hover:bg-slate-700 border border-sky-200 dark:border-slate-700'
                  }`}
                >
                  <img
                    src={thumb || defaultAppAvatar.portraitUrl}
                    alt=""
                    aria-hidden="true"
                    className="w-5 h-5 rounded-full object-cover object-top border border-white dark:border-slate-700 bg-sky-50 shrink-0"
                  />
                  <span>{kid.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Game Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Choose a kids game"
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedGame === 'hub'}
            onClick={() => handleOpenGame('hub')}
            className={`min-h-[46px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-display font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              selectedGame === 'hub'
                ? 'bg-indigo-950 dark:bg-amber-400 text-white dark:text-slate-950 shadow-sm'
                : 'bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-amber-500'
            }`}
          >
            <LayoutGrid className="w-4 h-4 shrink-0" aria-hidden="true" />
            All Games ({PLAYROOM_GAMES.length})
          </button>

          {PLAYROOM_GAMES.map((game) => {
            const isActive = selectedGame === game.id;
            return (
              <button
                key={game.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleOpenGame(game.id)}
                className={`min-h-[46px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-display font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? `${game.ctaClass} shadow-sm`
                    : 'bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-amber-300 dark:hover:border-amber-500'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                {game.shortLabel}
              </button>
            );
          })}
        </div>

        {/* Progressive Age Filter Controls (shown on Hub view) */}
        {selectedGame === 'hub' && (
          <div className="flex flex-wrap items-center gap-1.5 bg-white/90 dark:bg-slate-900/90 p-1 rounded-xl border border-amber-200 dark:border-slate-700">
            {[
              { id: 'all' as const, label: `All Ages (${PLAYROOM_GAMES.length})` },
              { id: '2_4' as const, label: `Ages 2–4 (${countByAge('2_4')})` },
              { id: '3_5' as const, label: `Ages 3–5 (${countByAge('3_5')})` },
              { id: '3_6' as const, label: `Ages 3–6 (${countByAge('3_6')})` },
              { id: '4_7' as const, label: `Ages 4–7 (${countByAge('4_7')})` },
              { id: '5_8' as const, label: `Ages 5–8 (${countByAge('5_8')})` },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAgeFilter(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  ageFilter === opt.id
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Playroom Hub View: 3-Column Illustrated Game Cards (12 Total Games) */}
      {selectedGame === 'hub' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleGames.map((game) => (
            <article
              key={game.id}
              className={`bg-white dark:bg-slate-900 rounded-3xl border-2 ${game.borderClass} shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col`}
            >
              {/* Illustrated 4:3 Storybook Thumbnail */}
              <div
                onClick={() => handleOpenGame(game.id)}
                className={`relative aspect-[4/3] w-full bg-gradient-to-br ${game.fallbackBgClass} overflow-hidden cursor-pointer`}
              >
                {!brokenImages[game.id] ? (
                  <img
                    src={game.imageSrc}
                    alt={game.imageAlt}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setBrokenImages((prev) => ({ ...prev, [game.id]: true }))
                    }
                    className={`w-full h-full object-cover transition-transform duration-300 ${
                      game.imageClassName ?? 'hover:scale-[1.03]'
                    }`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-6 text-center">
                    <Gamepad2 className="w-12 h-12 text-amber-500" aria-hidden="true" />
                  </div>
                )}
              </div>

              {/* Card Body & Single Big Kid-Friendly Play CTA */}
              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {game.metaLine}
                  </p>
                  <h2 className="mt-1 text-xl font-display font-extrabold text-slate-900 dark:text-white">
                    {game.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {game.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenGame(game.id)}
                  className={`w-full min-h-[54px] rounded-2xl ${game.ctaClass} font-display font-extrabold text-base shadow-xs active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap`}
                >
                  <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                  Play Now
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Active Mini-Game Stage */}
      {selectedGame === 'clock_routine' && (
        <ClockRoutineQuestGame childName={activeChild.name} />
      )}

      {selectedGame === 'word_bridge' && (
        <WordBridgeQuestGame childName={activeChild.name} />
      )}

      {selectedGame === 'planet_math' && (
        <PlanetMathMissionGame childName={activeChild.name} />
      )}

      {selectedGame === 'letter_garden' && (
        <LetterPhonicsGardenGame childName={activeChild.name} />
      )}

      {selectedGame === 'shape_rocket' && (
        <ShapeRocketBuilderGame childName={activeChild.name} />
      )}

      {selectedGame === 'dino_math' && (
        <DinoSnackMathGame childName={activeChild.name} />
      )}

      {selectedGame === 'rainbow_music' && (
        <RainbowMusicGame childProfile={activeChild} />
      )}

      {selectedGame === 'fruit_counting' && (
        <CountingFruitBasketGame childProfile={activeChild} />
      )}

      {selectedGame === 'animal_memory' && (
        <AnimalMemoryMatchGame childProfile={activeChild} />
      )}

      {selectedGame === 'sunflower' && (
        <SunflowerSproutGame
          childProfile={activeChild}
          childHeightCm={activeChildHeightCm}
        />
      )}

      {selectedGame === 'bubbles' && (
        <BubblePopAnimalGame childProfile={activeChild} />
      )}

      {selectedGame === 'tall_short' && (
        <TallShortFriendsGame childProfile={activeChild} />
      )}
    </section>
  );
};
