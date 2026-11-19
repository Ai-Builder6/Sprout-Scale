import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, Sparkles, Star } from 'lucide-react';
import { ChildProfile } from '../../types';
import {
  playGentleBoopSound,
  playHappyMatchSound,
  playSproutGrowSound,
  playVictoryFanfare,
} from '../../services/kidGameAudioService';

type GamePhase = 'TITLE_MENU' | 'PLAYING' | 'VICTORY';
type FruitKind = 'apple' | 'banana' | 'strawberry' | 'orange' | 'plum';

interface FruitMeta {
  kind: FruitKind;
  singular: string;
  plural: string;
  sparkleHex: string;
}

const FRUITS_META: Record<FruitKind, FruitMeta> = {
  apple: { kind: 'apple', singular: 'Red Apple', plural: 'Red Apples', sparkleHex: '#ef4444' },
  banana: { kind: 'banana', singular: 'Yellow Banana', plural: 'Yellow Bananas', sparkleHex: '#facc15' },
  strawberry: { kind: 'strawberry', singular: 'Sweet Strawberry', plural: 'Sweet Strawberries', sparkleHex: '#f43f5e' },
  orange: { kind: 'orange', singular: 'Juicy Orange', plural: 'Juicy Oranges', sparkleHex: '#fb923c' },
  plum: { kind: 'plum', singular: 'Purple Plum', plural: 'Purple Plums', sparkleHex: '#a855f7' },
};

interface TreeFruitItem {
  id: string;
  kind: FruitKind;
  x: number;
  y: number;
  picked: boolean;
}

interface CountingRoundConfig {
  id: number;
  targetKind: FruitKind;
  targetCount: number;
  extraKind: FruitKind;
  extraCount: number;
}

const COUNTING_ROUNDS: CountingRoundConfig[] = [
  { id: 1, targetKind: 'apple', targetCount: 2, extraKind: 'banana', extraCount: 2 },
  { id: 2, targetKind: 'banana', targetCount: 3, extraKind: 'apple', extraCount: 2 },
  { id: 3, targetKind: 'strawberry', targetCount: 4, extraKind: 'orange', extraCount: 3 },
  { id: 4, targetKind: 'orange', targetCount: 4, extraKind: 'plum', extraCount: 3 },
  { id: 5, targetKind: 'plum', targetCount: 5, extraKind: 'apple', extraCount: 3 },
];

const TREE_CANOPY_SLOTS: { x: number; y: number }[] = [
  { x: 250, y: 150 },
  { x: 355, y: 118 },
  { x: 465, y: 122 },
  { x: 560, y: 155 },
  { x: 225, y: 235 },
  { x: 335, y: 205 },
  { x: 445, y: 208 },
  { x: 565, y: 235 },
  { x: 395, y: 155 },
];

function buildRoundFruits(round: CountingRoundConfig): TreeFruitItem[] {
  const kinds: FruitKind[] = [
    ...Array.from({ length: round.targetCount + 1 }, () => round.targetKind),
    ...Array.from({ length: round.extraCount }, () => round.extraKind),
  ];
  // Shuffle slots cleanly
  const shuffledSlots = [...TREE_CANOPY_SLOTS].sort(() => Math.random() - 0.5);
  return kinds.slice(0, shuffledSlots.length).map((kind, idx) => ({
    id: `r${round.id}_f${idx}`,
    kind,
    x: shuffledSlots[idx].x,
    y: shuffledSlots[idx].y,
    picked: false,
  }));
}

function renderFruitSvg(kind: FruitKind, scale = 1): React.ReactNode {
  switch (kind) {
    case 'apple':
      return (
        <g transform={`scale(${scale})`}>
          <path d="M 0 -22 Q 4 -34 12 -32" fill="none" stroke="#78350f" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="11" cy="-28" rx="9" ry="5" transform="rotate(-24 11 -28)" fill="#22c55e" stroke="#15803d" strokeWidth="2" />
          <path
            d="M 0 -20 C -18 -26 -30 -8 -24 12 C -19 26 -7 28 0 23 C 7 28 19 26 24 12 C 30 -8 18 -26 0 -20 Z"
            fill="#ef4444"
            stroke="#991b1b"
            strokeWidth="3"
          />
          <ellipse cx="-10" cy="-6" rx="4.5" ry="9" transform="rotate(-18 -10 -6)" fill="#fca5a5" opacity="0.7" />
        </g>
      );
    case 'banana':
      return (
        <g transform={`scale(${scale})`}>
          <path
            d="M -22 -14 C -18 16 8 28 28 12 C 18 12 2 4 -8 -18 Z"
            fill="#facc15"
            stroke="#b45309"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <rect x="-24" y="-20" width="8" height="8" rx="2" fill="#78350f" />
          <path d="M -8 -2 Q 4 12 18 12" fill="none" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'strawberry':
      return (
        <g transform={`scale(${scale})`}>
          <path
            d="M 0 -20 C -22 -20 -26 2 -12 20 C -5 28 5 28 12 20 C 26 2 22 -20 0 -20 Z"
            fill="#f43f5e"
            stroke="#9f1239"
            strokeWidth="3"
          />
          <polygon points="-16,-18 -6,-28 0,-18 6,-28 16,-18 0,-12" fill="#22c55e" stroke="#15803d" strokeWidth="2" />
          <circle cx="-8" cy="-4" r="2" fill="#fef08a" />
          <circle cx="8" cy="-4" r="2" fill="#fef08a" />
          <circle cx="0" cy="4" r="2" fill="#fef08a" />
          <circle cx="-6" cy="12" r="2" fill="#fef08a" />
          <circle cx="6" cy="12" r="2" fill="#fef08a" />
        </g>
      );
    case 'orange':
      return (
        <g transform={`scale(${scale})`}>
          <ellipse cx="9" cy="-25" rx="9" ry="5" transform="rotate(-20 9 -25)" fill="#22c55e" stroke="#15803d" strokeWidth="2" />
          <circle cx="0" cy="0" r="24" fill="#fb923c" stroke="#c2410c" strokeWidth="3" />
          <circle cx="-9" cy="-8" r="5" fill="#fed7aa" opacity="0.7" />
          <circle cx="8" cy="8" r="1.8" fill="#ea580c" />
          <circle cx="12" cy="2" r="1.8" fill="#ea580c" />
          <circle cx="3" cy="13" r="1.8" fill="#ea580c" />
        </g>
      );
    case 'plum':
      return (
        <g transform={`scale(${scale})`}>
          <path d="M 0 -22 L 2 -32" stroke="#78350f" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="10" cy="-26" rx="8" ry="4.5" transform="rotate(-22 10 -26)" fill="#4ade80" stroke="#15803d" strokeWidth="2" />
          <ellipse cx="0" cy="2" rx="22" ry="25" fill="#9333ea" stroke="#581c87" strokeWidth="3" />
          <ellipse cx="-8" cy="-6" rx="4.5" ry="10" transform="rotate(-14 -8 -6)" fill="#d8b4fe" opacity="0.7" />
        </g>
      );
  }
}

interface CountingFruitBasketGameProps {
  childProfile: ChildProfile;
}

export const CountingFruitBasketGame: React.FC<CountingFruitBasketGameProps> = ({
  childProfile,
}) => {
  const [phase, setPhase] = useState<GamePhase>('TITLE_MENU');
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const [fruits, setFruits] = useState<TreeFruitItem[]>(() =>
    buildRoundFruits(COUNTING_ROUNDS[0]),
  );
  const [pickedCount, setPickedCount] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>(
    'Tap the yummy fruit on the tree to put it in the basket!',
  );
  const [basketBounce, setBasketBounce] = useState<boolean>(false);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const currentRound = COUNTING_ROUNDS[roundIdx] ?? COUNTING_ROUNDS[0];
  const targetMeta = FRUITS_META[currentRound.targetKind];

  const startNewGame = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const firstRound = COUNTING_ROUNDS[0];
    setRoundIdx(0);
    setPickedCount(0);
    setFruits(buildRoundFruits(firstRound));
    setBasketBounce(false);
    setFeedback(
      `Let's count! Pick ${firstRound.targetCount} ${FRUITS_META[firstRound.targetKind].plural} into the basket!`,
    );
    setPhase('PLAYING');
    playSproutGrowSound(0);
  };

  const handleTapFruit = (item: TreeFruitItem) => {
    if (phase !== 'PLAYING' || item.picked || pickedCount >= currentRound.targetCount) {
      return;
    }

    if (item.kind !== currentRound.targetKind) {
      playGentleBoopSound();
      setFeedback(
        `Ooh, a yummy ${FRUITS_META[item.kind].singular}! Look for ${targetMeta.plural}!`,
      );
      return;
    }

    const nextCount = pickedCount + 1;
    setFruits((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, picked: true } : f)),
    );
    setPickedCount(nextCount);
    setBasketBounce(true);
    window.setTimeout(() => setBasketBounce(false), 320);

    if (nextCount >= currentRound.targetCount) {
      if (roundIdx + 1 >= COUNTING_ROUNDS.length) {
        playVictoryFanfare();
        setFeedback(`Picnic Champion, ${childProfile.name}! You counted all 5 baskets!`);
        timerRef.current = window.setTimeout(() => {
          setPhase('VICTORY');
        }, 900);
      } else {
        playHappyMatchSound();
        setFeedback(`Yay! ${nextCount} ${targetMeta.plural} in the basket!`);
        timerRef.current = window.setTimeout(() => {
          const nextRoundIdx = roundIdx + 1;
          const nextRound = COUNTING_ROUNDS[nextRoundIdx];
          setRoundIdx(nextRoundIdx);
          setPickedCount(0);
          setFruits(buildRoundFruits(nextRound));
          setFeedback(
            `Now pick ${nextRound.targetCount} ${FRUITS_META[nextRound.targetKind].plural}!`,
          );
        }, 1050);
      }
    } else {
      playSproutGrowSound(nextCount);
      setFeedback(
        `Count with me: ${nextCount}! Pick ${currentRound.targetCount - nextCount} more!`,
      );
    }
  };

  return (
    <div className="bg-white rounded-3xl border-2 border-rose-200 shadow-sm overflow-hidden">
      {/* Counting Prompt & Visual 1-to-1 Counter Header */}
      <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-rose-50 via-amber-50 to-emerald-50 border-b border-rose-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {phase === 'PLAYING' && (
            <div className="w-14 h-14 rounded-2xl bg-white border-2 border-rose-200 shadow-xs flex items-center justify-center shrink-0">
              <svg viewBox="-34 -36 68 68" className="w-11 h-11" aria-hidden="true">
                {renderFruitSvg(currentRound.targetKind, 0.92)}
              </svg>
            </div>
          )}
          <div>
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900">
              {phase === 'PLAYING'
                ? `Pick ${currentRound.targetCount} ${targetMeta.plural}!`
                : 'Counting Fruit Basket'}
            </h2>
            <p className="text-sm font-medium text-slate-600 mt-0.5">{feedback}</p>
          </div>
        </div>

        {/* Visual Basket Count + Round Stars */}
        <div className="flex items-center gap-3">
          {phase === 'PLAYING' && (
            <div className="px-3.5 py-1.5 rounded-2xl bg-white border-2 border-amber-300 text-base font-display font-extrabold text-indigo-950 tabular-nums">
              {pickedCount} / {currentRound.targetCount}
            </div>
          )}
          <div className="flex items-center gap-1" aria-label={`Round ${roundIdx + 1} of 5`}>
            {COUNTING_ROUNDS.map((r, idx) => {
              const earned =
                phase === 'VICTORY' ||
                idx < roundIdx ||
                (idx === roundIdx && pickedCount >= currentRound.targetCount);
              return (
                <Star
                  key={r.id}
                  className={`w-6 h-6 ${
                    earned
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-slate-300 fill-slate-100'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Interactive Orchard Tree & Picnic Basket Stage */}
      <div className="relative bg-sky-100 select-none touch-manipulation">
        <svg
          viewBox="0 0 800 500"
          className="w-full h-auto block max-h-[540px]"
          role="img"
          aria-label="Interactive sunny fruit tree and picnic basket counting game"
        >
          <defs>
            <linearGradient id="orchardSkyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#93c5fd" />
              <stop offset="68%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#fef9c3" />
            </linearGradient>
            <linearGradient id="orchardGrassGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
          </defs>

          {/* Sky, Sun & Rolling Meadow */}
          <rect x="0" y="0" width="800" height="500" fill="url(#orchardSkyGrad)" />
          <circle cx="705" cy="76" r="40" fill="#fde047" />
          <g fill="#ffffff" opacity="0.78">
            <ellipse cx="130" cy="84" rx="54" ry="22" />
            <ellipse cx="170" cy="76" rx="38" ry="24" />
          </g>
          <path
            d="M 0 400 Q 220 356 440 392 T 800 378 L 800 500 L 0 500 Z"
            fill="url(#orchardGrassGrad)"
          />

          {/* Cozy Tree Trunk & Lush Green Canopy */}
          <path
            d="M 358 415 Q 372 340 368 250 L 432 250 Q 428 340 448 415 Z"
            fill="#92400e"
            stroke="#451a03"
            strokeWidth="4"
          />
          <g fill="#22c55e" stroke="#15803d" strokeWidth="4">
            <circle cx="245" cy="215" r="88" />
            <circle cx="555" cy="215" r="88" />
            <circle cx="320" cy="140" r="96" />
            <circle cx="480" cy="140" r="96" />
            <circle cx="400" cy="185" r="110" stroke="none" />
          </g>

          {/* Hanging Interactive Fruits */}
          {fruits.map((item) => {
            if (item.picked) return null;
            return (
              <g
                key={item.id}
                transform={`translate(${item.x}, ${item.y})`}
                onClick={() => handleTapFruit(item)}
                className="cursor-pointer"
                role="button"
                aria-label={`Pick ${FRUITS_META[item.kind].singular}`}
              >
                {/* Extra-wide toddler hitbox */}
                <circle cx="0" cy="0" r="44" fill="transparent" />
                {renderFruitSvg(item.kind, 1.15)}
              </g>
            );
          })}

          {/* Woven Picnic Basket showing Collected Fruits */}
          <g transform={`translate(400, ${basketBounce ? 412 : 420})`}>
            {/* Basket Handle */}
            <path
              d="M -78 -10 C -72 -88 72 -88 78 -10"
              fill="none"
              stroke="#92400e"
              strokeWidth="11"
              strokeLinecap="round"
            />
            {/* Collected Fruits peeking out of the Basket! */}
            {Array.from({ length: pickedCount }).map((_, idx) => {
              const offsetX = -58 + idx * 29;
              return (
                <g key={idx} transform={`translate(${offsetX}, -22)`}>
                  {renderFruitSvg(currentRound.targetKind, 0.72)}
                </g>
              );
            })}
            {/* Basket Rim & Woven Body */}
            <path
              d="M -92 -12 L 92 -12 L 74 52 Q 0 64 -74 52 Z"
              fill="#d97706"
              stroke="#78350f"
              strokeWidth="4"
            />
            <rect
              x="-98"
              y="-18"
              width="196"
              height="18"
              rx="9"
              fill="#f59e0b"
              stroke="#78350f"
              strokeWidth="3.5"
            />
            {/* Big Clear Count Number right on Basket */}
            <circle cx="0" cy="24" r="22" fill="#ffffff" stroke="#78350f" strokeWidth="3" />
            <text
              x="0"
              y="32"
              textAnchor="middle"
              fontSize="24"
              fontWeight="900"
              fill="#78350f"
            >
              {pickedCount}
            </text>
          </g>
        </svg>

        {/* Title Menu Overlay */}
        {phase === 'TITLE_MENU' && (
          <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border-4 border-rose-300 shadow-xl max-w-md w-full p-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <svg viewBox="-34 -36 68 68" className="w-12 h-12" aria-hidden="true">
                  {renderFruitSvg('apple', 0.9)}
                </svg>
                <svg viewBox="-34 -36 68 68" className="w-12 h-12" aria-hidden="true">
                  {renderFruitSvg('banana', 0.9)}
                </svg>
                <svg viewBox="-34 -36 68 68" className="w-12 h-12" aria-hidden="true">
                  {renderFruitSvg('strawberry', 0.9)}
                </svg>
              </div>
              <h3 className="text-2xl font-display font-extrabold text-slate-900">
                Counting Fruit Basket!
              </h3>
              <p className="text-sm text-slate-600 mt-1.5">
                Help {childProfile.name} pick and count juicy apples, bananas, strawberries, oranges, and plums from the sunny orchard tree!
              </p>
              <button
                type="button"
                onClick={startNewGame}
                className="mt-5 w-full min-h-[60px] rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-[0.98] text-white font-display font-extrabold text-lg shadow-md transition-all cursor-pointer"
              >
                Start Counting!
              </button>
            </div>
          </div>
        )}

        {/* Victory Overlay */}
        {phase === 'VICTORY' && (
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border-4 border-amber-300 shadow-xl max-w-md w-full p-6 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-500 flex items-center justify-center mb-2">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-display font-extrabold text-slate-900">
                Picnic Superstar, {childProfile.name}!
              </h3>
              <p className="text-sm font-medium text-slate-600 mt-1.5">
                You counted every single fruit basket and earned all 5 Golden Stars!
              </p>
              <div className="flex items-center justify-center gap-1.5 my-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-8 h-8 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <button
                type="button"
                onClick={startNewGame}
                className="w-full min-h-[58px] rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-display font-extrabold text-lg shadow-md inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" />
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
