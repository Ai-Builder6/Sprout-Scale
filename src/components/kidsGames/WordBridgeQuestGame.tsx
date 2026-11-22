import React, { useMemo, useState } from 'react';
import { Compass, RotateCcw, Star, Volume2 } from 'lucide-react';
import {
  playGentleBoopSound,
  playHappyMatchSound,
  playPlankPlaceSound,
  playVictoryFanfare,
  unlockKidGameAudio,
} from '../../services/kidGameAudioService';

interface WordBridgeQuestGameProps {
  childName: string;
}

type BridgeMode = 'missing_letter' | 'build_word';

interface BridgePuzzle {
  word: string;
  missingIndex: number;
  sentence: string;
  hint: string;
  extraLetters: string[];
}

const BRIDGE_PUZZLES_EASY: BridgePuzzle[] = [
  {
    word: 'FROG',
    missingIndex: 1,
    sentence: 'The green ___ jumped onto a shiny lily pad!',
    hint: 'Starts with F and says ribbit!',
    extraLetters: ['A', 'L', 'T'],
  },
  {
    word: 'STAR',
    missingIndex: 2,
    sentence: 'A bright gold ___ twinkles high in the night sky.',
    hint: 'Rhymes with car!',
    extraLetters: ['O', 'E', 'U'],
  },
  {
    word: 'TREE',
    missingIndex: 1,
    sentence: 'Squirrels climb up the tall green ___.',
    hint: 'Has leaves and branches!',
    extraLetters: ['L', 'N', 'P'],
  },
  {
    word: 'SHIP',
    missingIndex: 2,
    sentence: 'The big wooden ___ sails across the ocean waves.',
    hint: 'Starts with SH and floats on water!',
    extraLetters: ['A', 'O', 'U'],
  },
  {
    word: 'DRUM',
    missingIndex: 2,
    sentence: 'Tap the ___ to play a happy marching beat!',
    hint: 'Boom, boom, boom!',
    extraLetters: ['A', 'I', 'O'],
  },
];

const BRIDGE_PUZZLES_ADV: BridgePuzzle[] = [
  {
    word: 'CLOUD',
    missingIndex: 2,
    sentence: 'A fluffy white ___ floated right over the mountains.',
    hint: '5 letters: C-L-O-U-D',
    extraLetters: ['A', 'T'],
  },
  {
    word: 'SMILE',
    missingIndex: 2,
    sentence: 'When you feel happy, share a giant ___!',
    hint: '5 letters: S-M-I-L-E',
    extraLetters: ['A', 'R'],
  },
  {
    word: 'PLANT',
    missingIndex: 2,
    sentence: 'Water the little green ___ so it can sprout tall.',
    hint: '5 letters: P-L-A-N-T',
    extraLetters: ['O', 'S'],
  },
  {
    word: 'TRAIN',
    missingIndex: 2,
    sentence: 'Choo-choo! The speedy ___ zooms along the tracks.',
    hint: '5 letters: T-R-A-I-N',
    extraLetters: ['E', 'M'],
  },
  {
    word: 'LIGHT',
    missingIndex: 2,
    sentence: 'Turn on the bright ___ to find the hidden treasure!',
    hint: '5 letters: L-I-G-H-T',
    extraLetters: ['A', 'S'],
  },
];

const PLANK_COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#0284c7', '#8b5cf6'];

function speakSentenceAloud(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.pitch = 1.05;
    window.speechSynthesis.speak(u);
  } catch {
    // Ignore unsupported browser TTS
  }
}

export const WordBridgeQuestGame: React.FC<WordBridgeQuestGameProps> = ({
  childName,
}) => {
  const [mode, setMode] = useState<BridgeMode>('missing_letter');
  const [plankCount, setPlankCount] = useState<number>(0);
  const [builtLetters, setBuiltLetters] = useState<string[]>([]);
  const [usedTileIndexes, setUsedTileIndexes] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<string>(
    'Solve each word clue to lay a rainbow plank across the river bridge!',
  );
  const [isPlankAnimating, setIsPlankAnimating] = useState<boolean>(false);

  const puzzles = mode === 'missing_letter' ? BRIDGE_PUZZLES_EASY : BRIDGE_PUZZLES_ADV;
  const isVictory = plankCount >= puzzles.length;
  const current = puzzles[plankCount % puzzles.length];

  // Deterministic letter bank
  const letterBank = useMemo(() => {
    if (mode === 'missing_letter') {
      const targetChar = current.word[current.missingIndex];
      const opts = [targetChar, ...current.extraLetters];
      const shift = (plankCount * 3 + 1) % opts.length;
      return [...opts.slice(shift), ...opts.slice(0, shift)];
    }
    const chars = [...current.word.split(''), ...current.extraLetters];
    // Deterministic scramble so letters aren't already in order
    return chars
      .map((ch, idx) => ({ ch, sortKey: ((idx + 1) * 7 + plankCount * 5) % 13 }))
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((item) => item.ch);
  }, [current, mode, plankCount]);

  const handleRestart = (nextMode: BridgeMode = mode) => {
    unlockKidGameAudio();
    setMode(nextMode);
    setPlankCount(0);
    setBuiltLetters([]);
    setUsedTileIndexes([]);
    setIsPlankAnimating(false);
    setFeedback(
      nextMode === 'missing_letter'
        ? 'Pick the missing letter to snap a rainbow plank onto the bridge!'
        : 'Tap the letter tiles in order to spell the full treasure word!',
    );
  };

  const advancePlank = () => {
    const nextPlanks = plankCount + 1;
    playPlankPlaceSound(plankCount);
    setIsPlankAnimating(true);

    if (nextPlanks >= puzzles.length) {
      setFeedback(`Treasure unlocked! ${childName} crossed the whole Rainbow Word Bridge!`);
      window.setTimeout(() => {
        setPlankCount(nextPlanks);
        setBuiltLetters([]);
        setUsedTileIndexes([]);
        setIsPlankAnimating(false);
        playVictoryFanfare();
      }, 650);
    } else {
      playHappyMatchSound();
      setFeedback(`Awesome! "${current.word}" snapped plank #${nextPlanks} into place!`);
      window.setTimeout(() => {
        setPlankCount(nextPlanks);
        setBuiltLetters([]);
        setUsedTileIndexes([]);
        setIsPlankAnimating(false);
      }, 900);
    }
  };

  const handleTapTile = (letter: string, tileIdx: number) => {
    unlockKidGameAudio();
    if (isPlankAnimating || isVictory) return;

    if (mode === 'missing_letter') {
      const expected = current.word[current.missingIndex];
      if (letter === expected) {
        setBuiltLetters([letter]);
        advancePlank();
      } else {
        playGentleBoopSound();
        setFeedback(`Try another letter! Clue: ${current.hint}`);
      }
      return;
    }

    // Build full word mode (Ages 5-7)
    if (usedTileIndexes.includes(tileIdx)) return;
    const expectedChar = current.word[builtLetters.length];
    if (letter === expectedChar) {
      playPlankPlaceSound(builtLetters.length);
      const nextBuilt = [...builtLetters, letter];
      setBuiltLetters(nextBuilt);
      setUsedTileIndexes((prev) => [...prev, tileIdx]);

      if (nextBuilt.join('') === current.word) {
        advancePlank();
      } else {
        setFeedback(
          `Great start! ${nextBuilt.join('')}... keep spelling the word!`,
        );
      }
    } else {
      playGentleBoopSound();
      setFeedback(
        `Close! The next letter makes the "${expectedChar}" sound. Clue: ${current.hint}`,
      );
    }
  };

  const explorerX = 36 + Math.min(plankCount, 5) * 66;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-emerald-300 dark:border-emerald-700/80 p-5 sm:p-7 space-y-6 shadow-xs">
      {/* Header HUD */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-100 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
            Ages 4–7 · Sight Words, Blends &amp; Sentences
          </p>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-indigo-950 dark:text-white">
            Sight-Word Treasure Bridge
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-emerald-100/80 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => handleRestart('missing_letter')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'missing_letter'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-950 dark:text-slate-300'
              }`}
            >
              Missing Letter (4–5)
            </button>
            <button
              type="button"
              onClick={() => handleRestart('build_word')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'build_word'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-emerald-950 dark:text-slate-300'
              }`}
            >
              Spell 5-Letter Words (5–7)
            </button>
          </div>

          <div
            aria-label={`${plankCount} of ${puzzles.length} bridge planks built`}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700"
          >
            {puzzles.map((p, idx) => (
              <Star
                key={p.word}
                className={`w-4 h-4 ${
                  idx < plankCount
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-slate-300 dark:text-slate-600'
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Animated Jungle River Bridge Stage */}
      <div className="rounded-2xl bg-gradient-to-b from-sky-100 via-sky-50 to-cyan-100 dark:from-slate-800 dark:via-slate-900 dark:to-cyan-950/60 border-2 border-sky-200 dark:border-slate-700 p-4 overflow-hidden">
        <svg
          viewBox="0 0 460 140"
          className="w-full h-36 sm:h-40"
          role="img"
          aria-label={`Bridge progress: ${plankCount} of 5 rainbow planks laid across the river`}
        >
          {/* River water */}
          <rect x="65" y="92" width="330" height="48" fill="#0ea5e9" opacity="0.55" rx="6" />
          <path
            d="M 80 114 Q 120 106 160 114 T 240 114 T 320 114 T 380 114"
            fill="none"
            stroke="#e0f2fe"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Left & Right Grassy Jungle Banks */}
          <rect x="0" y="76" width="76" height="64" rx="10" fill="#16a34a" />
          <rect x="384" y="76" width="76" height="64" rx="10" fill="#16a34a" />

          {/* Bridge Ropes */}
          <path d="M 70 86 Q 230 100 390 86" fill="none" stroke="#92400e" strokeWidth="4" />

          {/* 5 Rainbow Plank Slots */}
          {[0, 1, 2, 3, 4].map((slotIdx) => {
            const x = 84 + slotIdx * 60;
            const built = slotIdx < plankCount;
            return (
              <g key={slotIdx}>
                <rect
                  x={x}
                  y={built ? 82 : 86}
                  width="50"
                  height="16"
                  rx="5"
                  fill={built ? PLANK_COLORS[slotIdx] : '#cbd5e1'}
                  stroke={built ? '#1e293b' : '#94a3b8'}
                  strokeWidth={built ? '2' : '1.5'}
                  strokeDasharray={built ? undefined : '4 3'}
                  opacity={built ? 1 : 0.65}
                />
                <text
                  x={x + 25}
                  y={94}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="800"
                  fill={built ? '#ffffff' : '#475569'}
                >
                  {slotIdx + 1}
                </text>
              </g>
            );
          })}

          {/* Golden Treasure Chest on Right Bank */}
          <g transform="translate(402, 42)">
            <rect x="0" y="14" width="40" height="24" rx="5" fill="#d97706" stroke="#78350f" strokeWidth="2.5" />
            <rect x="0" y="8" width="40" height="10" rx="4" fill="#f59e0b" stroke="#78350f" strokeWidth="2.5" />
            <rect x="16" y="16" width="8" height="9" rx="2" fill="#fef08a" stroke="#78350f" strokeWidth="1.5" />
            {isVictory && (
              <circle cx="20" cy="0" r="7" fill="#facc15" opacity="0.9" />
            )}
          </g>

          {/* Cheerful Explorer Character Advancing Across the Bridge */}
          <g transform={`translate(${explorerX}, 38)`}>
            <circle cx="14" cy="14" r="12" fill="#fde68a" stroke="#78350f" strokeWidth="2.5" />
            <circle cx="10" cy="12" r="2" fill="#1e293b" />
            <circle cx="18" cy="12" r="2" fill="#1e293b" />
            <path d="M 10 18 Q 14 22 18 18" fill="none" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
            <rect x="5" y="26" width="18" height="16" rx="5" fill="#2563eb" />
          </g>
        </svg>
      </div>

      {isVictory ? (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-amber-50 to-sky-50 dark:from-emerald-950/40 dark:via-slate-800 dark:to-sky-950/40 border-2 border-emerald-300 dark:border-emerald-600 p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <Compass className="w-9 h-9" aria-hidden="true" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-display font-extrabold text-indigo-950 dark:text-white">
            Treasure Found, {childName}!
          </h3>
          <p className="text-sm text-slate-700 dark:text-slate-300 max-w-md mx-auto">
            You built all 5 rainbow word planks and reached the golden treasure chest!
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleRestart(mode)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-extrabold text-sm cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Play Again
            </button>
            {mode === 'missing_letter' && (
              <button
                type="button"
                onClick={() => handleRestart('build_word')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-display font-extrabold text-sm cursor-pointer"
              >
                Level Up: Spell 5-Letter Words
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Sentence Clue & Audio Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/80 dark:bg-slate-800 border border-amber-200 dark:border-slate-700 rounded-2xl p-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                Sentence Clue · Plank {plankCount + 1} of {puzzles.length}
              </p>
              <p className="text-base sm:text-lg font-bold text-indigo-950 dark:text-white">
                “{current.sentence}”
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Hint: {current.hint}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                speakSentenceAloud(
                  `${current.sentence.replace('___', current.word)}. Spell ${current.word}.`,
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 text-indigo-950 dark:text-sky-200 border border-amber-300 dark:border-slate-600 hover:bg-amber-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              Read Word Aloud
            </button>
          </div>

          {/* Word Letter Slots */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            {current.word.split('').map((char, idx) => {
              const isRevealed =
                mode === 'missing_letter'
                  ? idx !== current.missingIndex || builtLetters.length > 0
                  : idx < builtLetters.length;

              return (
                <div
                  key={`${current.word}-${idx}`}
                  className={`w-14 h-16 sm:w-16 sm:h-18 rounded-2xl border-2 flex items-center justify-center font-display text-2xl sm:text-3xl font-extrabold transition-all ${
                    isRevealed
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-500 text-emerald-900 dark:text-emerald-200'
                      : 'bg-slate-50 dark:bg-slate-800 border-dashed border-sky-400 dark:border-sky-500 text-sky-400'
                  }`}
                >
                  {isRevealed ? char : '?'}
                </div>
              );
            })}
          </div>

          {/* Interactive Letter Tiles */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {letterBank.map((letter, idx) => {
              const isUsed = mode === 'build_word' && usedTileIndexes.includes(idx);
              return (
                <button
                  key={`${letter}-${idx}`}
                  type="button"
                  disabled={isUsed}
                  onClick={() => handleTapTile(letter, idx)}
                  className={`min-w-[60px] min-h-[60px] px-4 rounded-2xl border-2 font-display text-2xl font-extrabold transition-all active:scale-95 cursor-pointer ${
                    isUsed
                      ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-default'
                      : 'bg-sky-500 hover:bg-sky-400 border-sky-700 text-white shadow-xs'
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>

          <p className="text-center text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
            {feedback}
          </p>
        </div>
      )}
    </div>
  );
};
