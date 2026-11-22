import React, { useMemo, useState } from 'react';
import { RotateCcw, Star, Volume2 } from 'lucide-react';
import {
  playGentleBoopSound,
  playHappyMatchSound,
  playSproutGrowSound,
  playVictoryFanfare,
} from '../../services/kidGameAudioService';

interface LetterPhonicsGardenGameProps {
  childName: string;
}

type PhonicsMode = 'first_letter' | 'spell_word';

interface WordPuzzle {
  word: string;
  clue: string;
  phonicsHint: string;
  colorClass: string;
  illustrationId: 'sun' | 'cat' | 'dog' | 'bus' | 'bee' | 'hat' | 'cup' | 'car';
}

const WORD_PUZZLES: WordPuzzle[] = [
  {
    word: 'SUN',
    clue: 'Bright and warm in the daytime sky!',
    phonicsHint: 'Sss - uh - nnn',
    colorClass: 'from-amber-100 to-yellow-50 dark:from-amber-950/60 dark:to-slate-900',
    illustrationId: 'sun',
  },
  {
    word: 'CAT',
    clue: 'A cozy furry pet that says meow!',
    phonicsHint: 'Cuh - ah - tuh',
    colorClass: 'from-orange-100 to-amber-50 dark:from-orange-950/60 dark:to-slate-900',
    illustrationId: 'cat',
  },
  {
    word: 'DOG',
    clue: 'A happy puppy that wags its tail!',
    phonicsHint: 'Duh - aw - guh',
    colorClass: 'from-sky-100 to-cyan-50 dark:from-sky-950/60 dark:to-slate-900',
    illustrationId: 'dog',
  },
  {
    word: 'BUS',
    clue: 'A big yellow ride to school!',
    phonicsHint: 'Buh - uh - sss',
    colorClass: 'from-yellow-100 to-emerald-50 dark:from-yellow-950/50 dark:to-slate-900',
    illustrationId: 'bus',
  },
  {
    word: 'BEE',
    clue: 'A fuzzy striped bug that makes honey!',
    phonicsHint: 'Buh - eee',
    colorClass: 'from-lime-100 to-amber-50 dark:from-lime-950/50 dark:to-slate-900',
    illustrationId: 'bee',
  },
  {
    word: 'HAT',
    clue: 'You wear this on your head on sunny days!',
    phonicsHint: 'Huh - ah - tuh',
    colorClass: 'from-rose-100 to-pink-50 dark:from-rose-950/50 dark:to-slate-900',
    illustrationId: 'hat',
  },
  {
    word: 'CUP',
    clue: 'Great for sipping warm milk or water!',
    phonicsHint: 'Cuh - uh - puh',
    colorClass: 'from-indigo-100 to-sky-50 dark:from-indigo-950/60 dark:to-slate-900',
    illustrationId: 'cup',
  },
  {
    word: 'CAR',
    clue: 'Zooms along the road on four wheels!',
    phonicsHint: 'Cuh - ar',
    colorClass: 'from-emerald-100 to-teal-50 dark:from-emerald-950/50 dark:to-slate-900',
    illustrationId: 'car',
  },
];

const EXTRA_LETTERS = ['M', 'P', 'R', 'L', 'T', 'F', 'K', 'O', 'E', 'A'];
const TARGET_STARS = 5;

function speakWordOutLoud(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.88;
    utter.pitch = 1.15;
    window.speechSynthesis.speak(utter);
  } catch {
    // Ignore speech synthesis errors on restricted devices
  }
}

const WordIllustrationSvg: React.FC<{ id: WordPuzzle['illustrationId'] }> = ({ id }) => {
  switch (id) {
    case 'sun':
      return (
        <svg viewBox="0 0 120 120" className="w-28 h-28" aria-hidden="true">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="60"
              y1="14"
              x2="60"
              y2="28"
              stroke="#f59e0b"
              strokeWidth="6"
              strokeLinecap="round"
              transform={`rotate(${deg} 60 60)`}
            />
          ))}
          <circle cx="60" cy="60" r="28" fill="#facc15" stroke="#d97706" strokeWidth="3.5" />
          <circle cx="50" cy="56" r="3.5" fill="#1e293b" />
          <circle cx="70" cy="56" r="3.5" fill="#1e293b" />
          <path d="M 49 66 Q 60 76 71 66" fill="none" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'cat':
      return (
        <svg viewBox="0 0 120 120" className="w-28 h-28" aria-hidden="true">
          <polygon points="32,52 38,24 56,42" fill="#fb923c" stroke="#9a3412" strokeWidth="3" />
          <polygon points="88,52 82,24 64,42" fill="#fb923c" stroke="#9a3412" strokeWidth="3" />
          <circle cx="60" cy="66" r="32" fill="#fdba74" stroke="#9a3412" strokeWidth="3.5" />
          <circle cx="48" cy="62" r="4" fill="#1e293b" />
          <circle cx="72" cy="62" r="4" fill="#1e293b" />
          <polygon points="56,70 64,70 60,75" fill="#f43f5e" />
          <path d="M 52 78 Q 60 84 68 78" fill="none" stroke="#1e293b" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="22" y1="68" x2="39" y2="70" stroke="#9a3412" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="24" y1="76" x2="40" y2="75" stroke="#9a3412" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="98" y1="68" x2="81" y2="70" stroke="#9a3412" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="96" y1="76" x2="80" y2="75" stroke="#9a3412" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'dog':
      return (
        <svg viewBox="0 0 120 120" className="w-28 h-28" aria-hidden="true">
          <ellipse cx="29" cy="64" rx="13" ry="24" fill="#b45309" stroke="#78350f" strokeWidth="3" />
          <ellipse cx="91" cy="64" rx="13" ry="24" fill="#b45309" stroke="#78350f" strokeWidth="3" />
          <circle cx="60" cy="62" r="31" fill="#fde68a" stroke="#78350f" strokeWidth="3.5" />
          <circle cx="48" cy="56" r="4" fill="#1e293b" />
          <circle cx="72" cy="56" r="4" fill="#1e293b" />
          <ellipse cx="60" cy="66" rx="7" ry="5" fill="#1e293b" />
          <path d="M 52 76 Q 60 83 68 76" fill="none" stroke="#78350f" strokeWidth="2.8" strokeLinecap="round" />
          <ellipse cx="60" cy="83" rx="5" ry="6" fill="#fb7185" />
        </svg>
      );
    case 'bus':
      return (
        <svg viewBox="0 0 120 120" className="w-28 h-28" aria-hidden="true">
          <rect x="14" y="34" width="92" height="50" rx="12" fill="#facc15" stroke="#a16207" strokeWidth="3.5" />
          <rect x="24" y="44" width="20" height="18" rx="4" fill="#bae6fd" stroke="#0369a1" strokeWidth="2.5" />
          <rect x="50" y="44" width="20" height="18" rx="4" fill="#bae6fd" stroke="#0369a1" strokeWidth="2.5" />
          <rect x="76" y="44" width="20" height="18" rx="4" fill="#bae6fd" stroke="#0369a1" strokeWidth="2.5" />
          <circle cx="34" cy="86" r="11" fill="#334155" stroke="#0f172a" strokeWidth="3" />
          <circle cx="34" cy="86" r="4" fill="#e2e8f0" />
          <circle cx="86" cy="86" r="11" fill="#334155" stroke="#0f172a" strokeWidth="3" />
          <circle cx="86" cy="86" r="4" fill="#e2e8f0" />
        </svg>
      );
    case 'bee':
      return (
        <svg viewBox="0 0 120 120" className="w-28 h-28" aria-hidden="true">
          <ellipse cx="50" cy="38" rx="16" ry="12" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2.5" />
          <ellipse cx="72" cy="38" rx="16" ry="12" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2.5" />
          <ellipse cx="60" cy="66" rx="34" ry="24" fill="#facc15" stroke="#713f12" strokeWidth="3.5" />
          <rect x="46" y="44" width="9" height="44" fill="#1e293b" />
          <rect x="64" y="44" width="9" height="44" fill="#1e293b" />
          <circle cx="36" cy="62" r="3.5" fill="#1e293b" />
          <path d="M 32 71 Q 38 76 43 71" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'hat':
      return (
        <svg viewBox="0 0 120 120" className="w-28 h-28" aria-hidden="true">
          <ellipse cx="60" cy="82" rx="46" ry="13" fill="#f43f5e" stroke="#9f1239" strokeWidth="3.5" />
          <path d="M 32 80 Q 34 34 60 34 Q 86 34 88 80 Z" fill="#fb7185" stroke="#9f1239" strokeWidth="3.5" />
          <rect x="33" y="64" width="54" height="10" rx="4" fill="#facc15" stroke="#a16207" strokeWidth="2.5" />
        </svg>
      );
    case 'cup':
      return (
        <svg viewBox="0 0 120 120" className="w-28 h-28" aria-hidden="true">
          <path d="M 84 48 Q 104 48 104 66 Q 104 82 84 82" fill="none" stroke="#0284c7" strokeWidth="8" strokeLinecap="round" />
          <path d="M 28 38 L 86 38 L 80 92 Q 79 98 72 98 L 42 98 Q 35 98 34 92 Z" fill="#38bdf8" stroke="#0369a1" strokeWidth="3.5" />
          <circle cx="57" cy="68" r="10" fill="#fef08a" />
        </svg>
      );
    case 'car':
      return (
        <svg viewBox="0 0 120 120" className="w-28 h-28" aria-hidden="true">
          <path d="M 26 62 L 40 38 L 78 38 L 94 62 Z" fill="#34d399" stroke="#065f46" strokeWidth="3.5" />
          <rect x="14" y="58" width="92" height="28" rx="10" fill="#10b981" stroke="#065f46" strokeWidth="3.5" />
          <circle cx="34" cy="88" r="11" fill="#334155" stroke="#0f172a" strokeWidth="3" />
          <circle cx="86" cy="88" r="11" fill="#334155" stroke="#0f172a" strokeWidth="3" />
          <circle cx="34" cy="88" r="4" fill="#f8fafc" />
          <circle cx="86" cy="88" r="4" fill="#f8fafc" />
        </svg>
      );
  }
};

export const LetterPhonicsGardenGame: React.FC<LetterPhonicsGardenGameProps> = ({
  childName,
}) => {
  const [mode, setMode] = useState<PhonicsMode>('spell_word');
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const [stars, setStars] = useState<number>(0);
  const [typedLetters, setTypedLetters] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string>(
    'Tap the glowing letter flowers to spell the word!',
  );
  const [wrongTileIdx, setWrongTileIdx] = useState<number | null>(null);

  const puzzle = WORD_PUZZLES[roundIdx % WORD_PUZZLES.length];
  const isVictory = stars >= TARGET_STARS;

  const letterChoices = useMemo(() => {
    const wordLetters = puzzle.word.split('');
    const needed =
      mode === 'first_letter'
        ? [wordLetters[0]]
        : wordLetters;

    const pool: string[] = [...needed];
    let offset = roundIdx * 3;
    while (pool.length < 6) {
      const candidate = EXTRA_LETTERS[offset % EXTRA_LETTERS.length];
      offset += 1;
      if (!pool.includes(candidate)) {
        pool.push(candidate);
      }
    }
    // Deterministic joyful shuffle per round
    return pool
      .map((letter, idx) => ({ letter, sortKey: ((idx * 7 + roundIdx * 5) % 13) }))
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((item) => item.letter);
  }, [puzzle.word, mode, roundIdx]);

  const handleResetGame = (nextMode: PhonicsMode = mode) => {
    setMode(nextMode);
    setRoundIdx(0);
    setStars(0);
    setTypedLetters([]);
    setWrongTileIdx(null);
    setFeedback(
      nextMode === 'first_letter'
        ? 'Tap the first letter that starts this word!'
        : 'Tap the glowing letter flowers in order to spell the word!',
    );
  };

  const handlePickLetter = (letter: string, tileIdx: number) => {
    if (isVictory) return;

    const expectedLetter =
      mode === 'first_letter'
        ? puzzle.word[0]
        : puzzle.word[typedLetters.length];

    if (letter === expectedLetter) {
      const nextTyped = [...typedLetters, letter];
      setTypedLetters(nextTyped);
      setWrongTileIdx(null);

      const completedWord =
        mode === 'first_letter' || nextTyped.length >= puzzle.word.length;

      if (completedWord) {
        const nextStars = stars + 1;
        setStars(nextStars);
        if (nextStars >= TARGET_STARS) {
          playVictoryFanfare();
          setFeedback(`Hooray ${childName}! You spelled ${puzzle.word} and earned 5 garden stars!`);
          speakWordOutLoud(`${puzzle.word}! Awesome reading, ${childName}!`);
        } else {
          playHappyMatchSound();
          setFeedback(`Awesome! ${puzzle.word}! Next flower word coming up!`);
          speakWordOutLoud(puzzle.word);
          window.setTimeout(() => {
            setRoundIdx((prev) => prev + 1);
            setTypedLetters([]);
            setFeedback(
              mode === 'first_letter'
                ? 'Tap the starting letter!'
                : 'Tap the letter flowers in order!',
            );
          }, 900);
        }
      } else {
        playSproutGrowSound(nextTyped.length + 1);
        setFeedback(`Great! "${letter}" — what letter comes next?`);
      }
    } else {
      playGentleBoopSound();
      setWrongTileIdx(tileIdx);
      setFeedback(`Oops! Listen closely: ${puzzle.phonicsHint}. Try "${expectedLetter}"!`);
      window.setTimeout(() => setWrongTileIdx(null), 450);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-emerald-200 dark:border-emerald-800/70 p-5 sm:p-7 space-y-6 shadow-xs">
      {/* Top Game HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-indigo-950 dark:text-slate-100">
            Letter &amp; Phonics Garden
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Ages 3–6 · Early phonics &amp; 3-letter word spelling
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-emerald-50 dark:bg-slate-800 rounded-xl border border-emerald-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => handleResetGame('first_letter')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'first_letter'
                  ? 'bg-emerald-600 text-white'
                  : 'text-emerald-900 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700'
              }`}
            >
              First Letter (3–4)
            </button>
            <button
              type="button"
              onClick={() => handleResetGame('spell_word')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'spell_word'
                  ? 'bg-emerald-600 text-white'
                  : 'text-emerald-900 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700'
              }`}
            >
              Spell Word (4–6)
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleResetGame(mode)}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Restart
          </button>
        </div>
      </div>

      {/* Star Progress Strip */}
      <div className="flex items-center justify-between gap-4 bg-amber-50/90 dark:bg-slate-800/80 border border-amber-200 dark:border-slate-700 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-1.5" aria-label={`${stars} of ${TARGET_STARS} stars earned`}>
          {Array.from({ length: TARGET_STARS }).map((_, idx) => (
            <Star
              key={idx}
              className={`w-6 h-6 transition-transform ${
                idx < stars
                  ? 'text-amber-400 fill-amber-400 scale-110'
                  : 'text-amber-200 dark:text-slate-600'
              }`}
              aria-hidden="true"
            />
          ))}
        </div>
        <p className="text-xs sm:text-sm font-bold text-indigo-950 dark:text-slate-100 text-right">
          {feedback}
        </p>
      </div>

      {isVictory ? (
        <div className="rounded-3xl bg-gradient-to-b from-amber-50 to-emerald-50 dark:from-slate-800 dark:to-emerald-950/40 border-2 border-amber-300 dark:border-emerald-700 p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-400 text-slate-950 shadow-sm">
            <Star className="w-10 h-10 fill-current" aria-hidden="true" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-display font-extrabold text-indigo-950 dark:text-slate-100">
            Super Reader, {childName}!
          </h3>
          <p className="text-sm text-slate-700 dark:text-slate-300 max-w-md mx-auto">
            You bloomed all 5 word flowers in the Phonics Garden!
          </p>
          <button
            type="button"
            onClick={() => handleResetGame(mode)}
            className="min-h-[48px] px-7 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-extrabold shadow-xs transition-colors cursor-pointer"
          >
            Play Again
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Illustrated Picture Clue Stage */}
          <div
            className={`rounded-3xl bg-gradient-to-br ${puzzle.colorClass} border-2 border-emerald-200 dark:border-slate-700 p-6 flex flex-col items-center gap-4 text-center`}
          >
            <WordIllustrationSvg id={puzzle.illustrationId} />

            <div className="space-y-1">
              <p className="text-base sm:text-lg font-bold text-indigo-950 dark:text-slate-100">
                {puzzle.clue}
              </p>
              <p className="text-xs font-mono font-semibold text-emerald-800 dark:text-emerald-300">
                Sound it out: {puzzle.phonicsHint}
              </p>
            </div>

            <button
              type="button"
              onClick={() => speakWordOutLoud(`${puzzle.word}. ${puzzle.clue}`)}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 border-2 border-sky-200 dark:border-slate-600 text-sm font-extrabold text-sky-900 dark:text-sky-200 cursor-pointer"
            >
              <Volume2 className="w-4 h-4" aria-hidden="true" />
              Hear Word Aloud
            </button>

            {/* Letter Slots */}
            <div className="flex items-center justify-center gap-3 pt-1">
              {puzzle.word.split('').map((ch, idx) => {
                const isRevealed =
                  mode === 'first_letter'
                    ? idx > 0 || typedLetters.length > 0
                    : idx < typedLetters.length;
                const isCurrentSlot =
                  mode === 'first_letter'
                    ? idx === 0 && typedLetters.length === 0
                    : idx === typedLetters.length;
                return (
                  <div
                    key={`${puzzle.word}_${idx}`}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-3 flex items-center justify-center text-3xl sm:text-4xl font-display font-extrabold transition-transform ${
                      isRevealed
                        ? 'bg-emerald-500 text-white border-emerald-600 scale-105'
                        : isCurrentSlot
                          ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-300 border-amber-400 border-dashed'
                          : 'bg-white/70 dark:bg-slate-800/60 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {isRevealed ? ch : '?'}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Oversized Letter Flower Buttons */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {letterChoices.map((letter, idx) => (
              <button
                key={`${roundIdx}_${letter}_${idx}`}
                type="button"
                onClick={() => handlePickLetter(letter, idx)}
                className={`min-h-[76px] rounded-2xl border-2 text-3xl font-display font-extrabold transition-transform active:scale-95 cursor-pointer shadow-xs ${
                  wrongTileIdx === idx
                    ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-400 text-rose-800 dark:text-rose-200'
                    : 'bg-gradient-to-b from-amber-100 to-amber-200/80 dark:from-slate-800 dark:to-slate-800 hover:from-emerald-100 hover:to-emerald-200 dark:hover:from-emerald-900/60 dark:hover:to-emerald-800/60 border-amber-300 dark:border-slate-600 text-indigo-950 dark:text-slate-100'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
