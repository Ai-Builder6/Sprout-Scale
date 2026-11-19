import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, Sparkles, Star } from 'lucide-react';
import { ChildProfile } from '../../types';
import {
  playCardFlipSound,
  playGentleBoopSound,
  playHappyMatchSound,
  playVictoryFanfare,
} from '../../services/kidGameAudioService';

type GamePhase = 'TITLE_MENU' | 'PLAYING' | 'VICTORY';
type MemoryPairCount = 4 | 6;
type CardAnimalId = 'lion' | 'dino' | 'whale' | 'panda' | 'unicorn' | 'owl';

interface MemoryCardDef {
  animalId: CardAnimalId;
  label: string;
  cardBgClass: string;
}

const MEMORY_ANIMALS: MemoryCardDef[] = [
  { animalId: 'lion', label: 'Lion', cardBgClass: 'bg-amber-50 border-amber-300' },
  { animalId: 'dino', label: 'Dino', cardBgClass: 'bg-emerald-50 border-emerald-300' },
  { animalId: 'whale', label: 'Whale', cardBgClass: 'bg-sky-50 border-sky-300' },
  { animalId: 'panda', label: 'Panda', cardBgClass: 'bg-slate-50 border-slate-300' },
  { animalId: 'unicorn', label: 'Unicorn', cardBgClass: 'bg-pink-50 border-pink-300' },
  { animalId: 'owl', label: 'Owl', cardBgClass: 'bg-purple-50 border-purple-300' },
];

interface DeckCard {
  uid: string;
  animalId: CardAnimalId;
  matched: boolean;
}

function createShuffledDeck(pairCount: MemoryPairCount): DeckCard[] {
  const subset = MEMORY_ANIMALS.slice(0, pairCount);
  const doubled: DeckCard[] = [];
  subset.forEach((item) => {
    doubled.push({ uid: `${item.animalId}_a`, animalId: item.animalId, matched: false });
    doubled.push({ uid: `${item.animalId}_b`, animalId: item.animalId, matched: false });
  });
  for (let i = doubled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = doubled[i];
    doubled[i] = doubled[j];
    doubled[j] = tmp;
  }
  return doubled;
}

function renderCardAnimalSvg(animalId: CardAnimalId): React.ReactNode {
  switch (animalId) {
    case 'lion':
      return (
        <g>
          {/* Sunny Mane */}
          {Array.from({ length: 10 }).map((_, idx) => (
            <circle
              key={idx}
              cx={Math.cos((idx * Math.PI * 2) / 10) * 32}
              cy={Math.sin((idx * Math.PI * 2) / 10) * 32}
              r="14"
              fill="#ea580c"
            />
          ))}
          <circle cx="-18" cy="-22" r="10" fill="#fbbf24" stroke="#b45309" strokeWidth="3" />
          <circle cx="18" cy="-22" r="10" fill="#fbbf24" stroke="#b45309" strokeWidth="3" />
          <circle cx="0" cy="2" r="28" fill="#fcd34d" stroke="#b45309" strokeWidth="3" />
          <circle cx="-10" cy="-3" r="4" fill="#1e293b" />
          <circle cx="10" cy="-3" r="4" fill="#1e293b" />
          <polygon points="-6,6 6,6 0,13" fill="#9a3412" />
          <path d="M -8 16 Q 0 22 8 16" fill="none" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'dino':
      return (
        <g>
          <polygon points="-24,-12 -32,-26 -14,-22" fill="#facc15" stroke="#ca8a04" strokeWidth="2.5" />
          <polygon points="-10,-28 -14,-42 2,-30" fill="#facc15" stroke="#ca8a04" strokeWidth="2.5" />
          <ellipse cx="4" cy="4" rx="30" ry="26" fill="#4ade80" stroke="#15803d" strokeWidth="3.5" />
          <circle cx="-6" cy="-4" r="4.2" fill="#1e293b" />
          <circle cx="14" cy="-4" r="4.2" fill="#1e293b" />
          <circle cx="-14" cy="6" r="5" fill="#fb7185" opacity="0.5" />
          <circle cx="22" cy="6" r="5" fill="#fb7185" opacity="0.5" />
          <path d="M -6 10 Q 6 22 18 10" fill="none" stroke="#14532d" strokeWidth="3.5" strokeLinecap="round" />
        </g>
      );
    case 'whale':
      return (
        <g>
          {/* Little Water Spout */}
          <path d="M 0 -24 Q -10 -40 -18 -34" fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
          <path d="M 0 -24 Q 10 -40 18 -34" fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="0" cy="6" rx="34" ry="24" fill="#0284c7" stroke="#075985" strokeWidth="3.5" />
          <path d="M -26 12 Q 0 28 26 12 L 22 24 Q 0 32 -22 24 Z" fill="#e0f2fe" />
          <circle cx="-12" cy="0" r="4" fill="#ffffff" />
          <circle cx="-12" cy="0" r="2.2" fill="#0f172a" />
          <circle cx="12" cy="0" r="4" fill="#ffffff" />
          <circle cx="12" cy="0" r="2.2" fill="#0f172a" />
          <path d="M -10 11 Q 0 18 10 11" fill="none" stroke="#0c4a6e" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'panda':
      return (
        <g>
          <circle cx="-22" cy="-22" r="12" fill="#1e293b" />
          <circle cx="22" cy="-22" r="12" fill="#1e293b" />
          <circle cx="0" cy="4" r="30" fill="#ffffff" stroke="#334155" strokeWidth="3.5" />
          <ellipse cx="-12" cy="0" rx="9" ry="11" transform="rotate(-16 -12 0)" fill="#1e293b" />
          <ellipse cx="12" cy="0" rx="9" ry="11" transform="rotate(16 12 0)" fill="#1e293b" />
          <circle cx="-11" cy="-2" r="3" fill="#ffffff" />
          <circle cx="11" cy="-2" r="3" fill="#ffffff" />
          <ellipse cx="0" cy="10" rx="5.5" ry="4" fill="#1e293b" />
          <path d="M -7 17 Q 0 23 7 17" fill="none" stroke="#1e293b" strokeWidth="2.8" strokeLinecap="round" />
        </g>
      );
    case 'unicorn':
      return (
        <g>
          {/* Golden Sparkle Horn */}
          <polygon points="-8,-18 8,-18 0,-44" fill="#facc15" stroke="#ca8a04" strokeWidth="2.8" />
          {/* Pink & Purple Mane */}
          <circle cx="-20" cy="-14" r="11" fill="#f472b6" />
          <circle cx="20" cy="-14" r="11" fill="#a78bfa" />
          <ellipse cx="0" cy="6" rx="28" ry="26" fill="#ffffff" stroke="#db2777" strokeWidth="3" />
          <ellipse cx="0" cy="18" rx="18" ry="12" fill="#fbcfe8" />
          <circle cx="-11" cy="0" r="3.8" fill="#1e293b" />
          <circle cx="11" cy="0" r="3.8" fill="#1e293b" />
          <path d="M -8 18 Q 0 25 8 18" fill="none" stroke="#be185d" strokeWidth="2.8" strokeLinecap="round" />
        </g>
      );
    case 'owl':
      return (
        <g>
          <polygon points="-24,-12 -18,-34 -4,-18" fill="#8b5cf6" stroke="#5b21b6" strokeWidth="3" />
          <polygon points="24,-12 18,-34 4,-18" fill="#8b5cf6" stroke="#5b21b6" strokeWidth="3" />
          <circle cx="0" cy="4" r="30" fill="#a78bfa" stroke="#5b21b6" strokeWidth="3.5" />
          <circle cx="-12" cy="0" r="11" fill="#ffffff" stroke="#5b21b6" strokeWidth="2.5" />
          <circle cx="12" cy="0" r="11" fill="#ffffff" stroke="#5b21b6" strokeWidth="2.5" />
          <circle cx="-12" cy="0" r="4.5" fill="#1e293b" />
          <circle cx="12" cy="0" r="4.5" fill="#1e293b" />
          <polygon points="-6,10 6,10 0,20" fill="#facc15" stroke="#ca8a04" strokeWidth="2.5" />
        </g>
      );
  }
}

interface AnimalMemoryMatchGameProps {
  childProfile: ChildProfile;
}

export const AnimalMemoryMatchGame: React.FC<AnimalMemoryMatchGameProps> = ({
  childProfile,
}) => {
  const [phase, setPhase] = useState<GamePhase>('TITLE_MENU');
  const [pairCount, setPairCount] = useState<MemoryPairCount>(4);
  const [deck, setDeck] = useState<DeckCard[]>(() => createShuffledDeck(4));
  const [flippedUids, setFlippedUids] = useState<string[]>([]);
  const [isCheckingPair, setIsCheckingPair] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>(
    'Tap two star cards to find matching animal friends!',
  );

  const flipBackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (flipBackTimerRef.current !== null) {
        window.clearTimeout(flipBackTimerRef.current);
      }
    };
  }, []);

  const matchedPairsCount = deck.filter((c) => c.matched).length / 2;

  const startNewGame = (pairs: MemoryPairCount) => {
    if (flipBackTimerRef.current !== null) {
      window.clearTimeout(flipBackTimerRef.current);
      flipBackTimerRef.current = null;
    }
    setPairCount(pairs);
    setDeck(createShuffledDeck(pairs));
    setFlippedUids([]);
    setIsCheckingPair(false);
    setFeedback(`Tap any two cards to find matching animal friends, ${childProfile.name}!`);
    setPhase('PLAYING');
    playCardFlipSound();
  };

  const handleCardTap = (card: DeckCard) => {
    if (
      phase !== 'PLAYING' ||
      isCheckingPair ||
      card.matched ||
      flippedUids.includes(card.uid)
    ) {
      return;
    }

    playCardFlipSound();
    const nextFlipped = [...flippedUids, card.uid];
    setFlippedUids(nextFlipped);

    if (nextFlipped.length < 2) {
      const def = MEMORY_ANIMALS.find((a) => a.animalId === card.animalId);
      setFeedback(`Ooh, a ${def?.label ?? 'friend'}! Can you find its twin?`);
      return;
    }

    const firstCard = deck.find((c) => c.uid === nextFlipped[0]);
    const secondCard = card;
    if (!firstCard) return;

    setIsCheckingPair(true);

    if (firstCard.animalId === secondCard.animalId) {
      const def = MEMORY_ANIMALS.find((a) => a.animalId === firstCard.animalId);
      const updatedDeck = deck.map((c) =>
        c.animalId === firstCard.animalId ? { ...c, matched: true } : c,
      );
      setDeck(updatedDeck);
      setFlippedUids([]);
      setIsCheckingPair(false);

      const allMatched = updatedDeck.every((c) => c.matched);
      if (allMatched) {
        playVictoryFanfare();
        setFeedback(`Hooray, ${childProfile.name}! You matched every animal pair!`);
        flipBackTimerRef.current = window.setTimeout(() => {
          setPhase('VICTORY');
        }, 650);
      } else {
        playHappyMatchSound();
        setFeedback(`Yay! You matched the ${def?.label ?? 'Animal'} pair!`);
      }
    } else {
      flipBackTimerRef.current = window.setTimeout(() => {
        playGentleBoopSound();
        setFlippedUids([]);
        setIsCheckingPair(false);
        setFeedback('Good peek! Try two more cards to find a match!');
      }, 950);
    }
  };

  return (
    <div className="bg-white rounded-3xl border-2 border-teal-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-teal-50 via-amber-50/70 to-pink-50 border-b border-teal-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900">
            Animal Memory Match
          </h2>
          <p className="text-sm font-medium text-slate-600 mt-0.5">{feedback}</p>
        </div>

        {/* Matched Pairs Star Row */}
        <div className="flex items-center gap-1.5" aria-label={`Matched ${matchedPairsCount} of ${pairCount} pairs`}>
          {Array.from({ length: pairCount }).map((_, idx) => (
            <Star
              key={idx}
              className={`w-6 h-6 transition-transform ${
                idx < matchedPairsCount
                  ? 'text-amber-400 fill-amber-400 scale-110'
                  : 'text-slate-300 fill-slate-100'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Picnic Blanket Card Grid Stage */}
      <div className="relative p-4 sm:p-6 bg-gradient-to-b from-teal-50/80 via-amber-50/60 to-emerald-50 min-h-[430px] flex flex-col justify-center select-none touch-manipulation">
        <div
          className={`grid gap-3 sm:gap-4 max-w-3xl mx-auto w-full ${
            pairCount === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-4'
          }`}
        >
          {deck.map((card) => {
            const isFaceUp = card.matched || flippedUids.includes(card.uid);
            const def =
              MEMORY_ANIMALS.find((a) => a.animalId === card.animalId) ?? MEMORY_ANIMALS[0];

            return (
              <button
                key={card.uid}
                type="button"
                disabled={phase !== 'PLAYING' || isFaceUp}
                onClick={() => handleCardTap(card)}
                aria-label={isFaceUp ? `${def.label} card` : 'Hidden animal card'}
                className={`aspect-square rounded-3xl border-4 p-2.5 sm:p-3 transition-all flex flex-col items-center justify-center cursor-pointer active:scale-95 ${
                  isFaceUp
                    ? `${def.cardBgClass} ${
                        card.matched ? 'ring-4 ring-emerald-300 shadow-md' : 'shadow-sm'
                      }`
                    : 'bg-gradient-to-br from-sky-400 to-indigo-500 border-white shadow-md hover:brightness-105'
                }`}
              >
                {isFaceUp ? (
                  <>
                    <svg
                      viewBox="-48 -48 96 96"
                      className="w-full h-full max-h-[96px]"
                      aria-hidden="true"
                    >
                      {renderCardAnimalSvg(card.animalId)}
                    </svg>
                    <span className="mt-1 text-xs sm:text-sm font-display font-extrabold text-slate-800">
                      {def.label}
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1 text-white">
                    <Star className="w-10 h-10 sm:w-12 sm:h-12 text-amber-300 fill-amber-300 drop-shadow-xs" />
                    <span className="text-[11px] font-bold tracking-wide opacity-90">
                      PEEK!
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Title Menu Overlay */}
        {phase === 'TITLE_MENU' && (
          <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border-4 border-teal-300 shadow-xl max-w-md w-full p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <svg viewBox="-48 -48 96 96" className="w-12 h-12" aria-hidden="true">
                  {renderCardAnimalSvg('lion')}
                </svg>
                <svg viewBox="-48 -48 96 96" className="w-12 h-12" aria-hidden="true">
                  {renderCardAnimalSvg('dino')}
                </svg>
                <svg viewBox="-48 -48 96 96" className="w-12 h-12" aria-hidden="true">
                  {renderCardAnimalSvg('unicorn')}
                </svg>
              </div>
              <h3 className="text-2xl font-display font-extrabold text-slate-900">
                Animal Memory Match!
              </h3>
              <p className="text-sm text-slate-600 mt-1.5">
                Choose a card board size for {childProfile.name}:
              </p>
              <div className="mt-5 grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => startNewGame(4)}
                  className="w-full min-h-[58px] rounded-2xl bg-teal-500 hover:bg-teal-600 text-white font-display font-extrabold text-base shadow-md cursor-pointer"
                >
                  Sunny Board · 4 Pairs (Ages 3–4)
                </button>
                <button
                  type="button"
                  onClick={() => startNewGame(6)}
                  className="w-full min-h-[58px] rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-display font-extrabold text-base shadow-md cursor-pointer"
                >
                  Super Board · 6 Pairs (Ages 4–5)
                </button>
              </div>
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
                Memory Master, {childProfile.name}!
              </h3>
              <p className="text-sm font-medium text-slate-600 mt-1.5">
                You matched all {pairCount} animal pairs with zero stress!
              </p>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => startNewGame(pairCount)}
                  className="min-h-[54px] rounded-2xl bg-teal-500 hover:bg-teal-600 text-white font-display font-extrabold text-base inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play Again
                </button>
                <button
                  type="button"
                  onClick={() => startNewGame(pairCount === 4 ? 6 : 4)}
                  className="min-h-[54px] rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-display font-extrabold text-base cursor-pointer"
                >
                  {pairCount === 4 ? 'Try 6 Pairs' : 'Try 4 Pairs'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
