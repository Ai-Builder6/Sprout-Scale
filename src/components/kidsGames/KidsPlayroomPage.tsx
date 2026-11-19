import React, { useState } from 'react';
import {
  ArrowLeft,
  Gamepad2,
  LayoutGrid,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  CHARACTER_PALETTES,
  ChildProfile,
  formatFeetInches,
} from '../../types';
import {
  isKidGamesMuted,
  setKidGamesMuted,
} from '../../services/kidGameAudioService';
import { useDefaultAppAvatar } from '../../services/defaultAvatarService';
import { SunflowerSproutGame } from './SunflowerSproutGame';
import { BubblePopAnimalGame } from './BubblePopAnimalGame';
import { TallShortFriendsGame } from './TallShortFriendsGame';
import { RainbowMusicGame } from './RainbowMusicGame';
import { CountingFruitBasketGame } from './CountingFruitBasketGame';
import { AnimalMemoryMatchGame } from './AnimalMemoryMatchGame';

import sunflowerCardImg from '../../assets/images/game_sunflower_garden_1795060511785.jpg';
import bubbleCardImg from '../../assets/images/game_bubble_meadow_1795060511345.jpg';
import tallShortCardImg from '../../assets/images/game_tall_short_friends_1795060511989.jpg';
import rainbowMusicCardImg from '../../assets/images/game_rainbow_music_1795078485188.jpg';
import fruitCountingCardImg from '../../assets/images/game_fruit_counting_1795078484557.jpg';
import animalMemoryCardImg from '../../assets/images/game_animal_memory_1795078484282.jpg';

export type PlayroomGameId =
  | 'hub'
  | 'sunflower'
  | 'bubbles'
  | 'tall_short'
  | 'rainbow_music'
  | 'fruit_counting'
  | 'animal_memory';

type AgeGroupFilter = 'all' | '2_4' | '3_5';

interface KidsPlayroomPageProps {
  activeChild: ChildProfile;
  childrenList: ChildProfile[];
  avatarPhotoMap: Record<string, string>;
  activeChildHeightCm: number;
  onSelectChild: (childId: string) => void;
  onBackToGrowthWall: () => void;
}

interface GameCatalogItem {
  id: Exclude<PlayroomGameId, 'hub'>;
  title: string;
  shortLabel: string;
  ageGroup: '2_4' | '3_5';
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
    id: 'rainbow_music',
    title: 'Rainbow Xylophone & Song',
    shortLabel: 'Xylophone',
    ageGroup: '3_5',
    metaLine: 'Ages 3–5 · Music & Color Patterns · 2 Modes',
    description:
      'Tap glowing rainbow xylophone keys to play guided nursery tunes or follow colorful musical patterns to earn 4 stars.',
    imageSrc: rainbowMusicCardImg,
    imageAlt: 'Colorful rainbow wooden xylophone in a sunny meadow with singing bluebirds and musical notes',
    fallbackBgClass: 'from-purple-100 via-amber-50 to-sky-100',
    ctaClass: 'bg-purple-600 hover:bg-purple-700 text-white',
    borderClass: 'border-purple-200 hover:border-purple-400',
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
    fallbackBgClass: 'from-rose-100 via-amber-50 to-emerald-100',
    ctaClass: 'bg-rose-500 hover:bg-rose-600 text-white',
    borderClass: 'border-rose-200 hover:border-rose-400',
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
    fallbackBgClass: 'from-teal-100 via-amber-50 to-pink-100',
    ctaClass: 'bg-teal-600 hover:bg-teal-700 text-white',
    borderClass: 'border-teal-200 hover:border-teal-400',
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
    fallbackBgClass: 'from-emerald-100 via-amber-50 to-sky-100',
    ctaClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    borderClass: 'border-emerald-200 hover:border-emerald-400',
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
    fallbackBgClass: 'from-sky-100 via-pink-50 to-emerald-100',
    ctaClass: 'bg-sky-500 hover:bg-sky-600 text-white',
    borderClass: 'border-sky-200 hover:border-sky-400',
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
    fallbackBgClass: 'from-amber-100 via-emerald-50 to-sky-100',
    ctaClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    borderClass: 'border-amber-200 hover:border-amber-400',
  },
];

export const KidsPlayroomPage: React.FC<KidsPlayroomPageProps> = ({
  activeChild,
  childrenList,
  avatarPhotoMap,
  activeChildHeightCm,
  onSelectChild,
  onBackToGrowthWall,
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
  };

  const activeHeightFormatted = formatFeetInches(activeChildHeightCm);
  const visibleGames =
    ageFilter === 'all'
      ? PLAYROOM_GAMES
      : PLAYROOM_GAMES.filter((g) => g.ageGroup === ageFilter);

  return (
    <section aria-label="Kids Playroom" className="space-y-6">
      {/* Playroom Top Workspace Header */}
      <div className="bg-white/95 rounded-3xl border-2 border-amber-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <img
              src={avatarPhotoMap[activeChild.id] || defaultAppAvatar.portraitUrl}
              alt={`${activeChild.name} avatar`}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover object-top border-2 border-amber-300 bg-sky-50 shadow-xs shrink-0"
            />
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-amber-800">
                <Gamepad2 className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                <span>Kids Playroom</span>
                <span aria-hidden="true">·</span>
                <span>6 Interactive Games for Ages 2–5</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-emerald-700">
                  {activeChild.name}: {activeHeightFormatted}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-indigo-950">
                Hi {activeChild.name}! Pick a colorful game to play!
              </h1>
              <p className="text-sm text-slate-600 max-w-2xl">
                Rainbow xylophone songs, fruit counting, memory matching, bubble popping, and height games — big touch targets, cheerful sounds, and zero timers.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sound Toggle */}
            <button
              type="button"
              onClick={handleToggleSound}
              className={`min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                isMuted
                  ? 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                  : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
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
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-white text-sm font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              Back to Growth Wall
            </button>
          </div>
        </div>

        {/* Multi-Child Switcher Row (shown when family has 2+ kids) */}
        {childrenList.length > 1 && (
          <div className="mt-4 pt-4 border-t border-amber-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 mr-1">Who is playing?</span>
            {childrenList.map((kid) => {
              const isSelected = kid.id === activeChild.id;
              const thumb = avatarPhotoMap[kid.id] ?? null;
              const accentHex = CHARACTER_PALETTES[kid.paletteId]?.accentHex ?? '#0284c7';
              return (
                <button
                  key={kid.id}
                  type="button"
                  onClick={() => onSelectChild(kid.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'bg-sky-50 text-indigo-950 hover:bg-sky-100 border border-sky-200'
                  }`}
                >
                  <img
                    src={thumb || defaultAppAvatar.portraitUrl}
                    alt=""
                    aria-hidden="true"
                    className="w-5 h-5 rounded-full object-cover object-top border border-white bg-sky-50 shrink-0"
                  />
                  <span>{kid.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Game Switcher Tabs (Always 1-tap away so kids/parents can hop between all 6 games) */}
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
            onClick={() => setSelectedGame('hub')}
            className={`min-h-[46px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-display font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              selectedGame === 'hub'
                ? 'bg-indigo-950 text-white shadow-sm'
                : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-indigo-300'
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
                onClick={() => setSelectedGame(game.id)}
                className={`min-h-[46px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-display font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? `${game.ctaClass} shadow-sm`
                    : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-amber-300'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                {game.shortLabel}
              </button>
            );
          })}
        </div>

        {/* Age Filter Controls (shown on Hub view) */}
        {selectedGame === 'hub' && (
          <div className="flex items-center gap-1.5 bg-white/90 p-1 rounded-xl border border-amber-200">
            {[
              { id: 'all' as const, label: 'All Ages (6)' },
              { id: '3_5' as const, label: 'Ages 3–5 (3)' },
              { id: '2_4' as const, label: 'Ages 2–4 (3)' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAgeFilter(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  ageFilter === opt.id
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-indigo-950'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Playroom Hub View: 3-Column Illustrated Game Cards (6 Total Games) */}
      {selectedGame === 'hub' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleGames.map((game) => (
            <article
              key={game.id}
              className={`bg-white rounded-3xl border-2 ${game.borderClass} shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col`}
            >
              {/* Illustrated 4:3 Storybook Thumbnail */}
              <div
                onClick={() => setSelectedGame(game.id)}
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
                  <p className="text-xs font-bold text-slate-500">{game.metaLine}</p>
                  <h2 className="mt-1 text-xl font-display font-extrabold text-slate-900">
                    {game.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {game.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedGame(game.id)}
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
