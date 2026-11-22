import React, { useMemo, useState } from 'react';
import { RotateCcw, Star } from 'lucide-react';
import {
  playBubblePopSound,
  playGentleBoopSound,
  playHappyMatchSound,
  playVictoryFanfare,
} from '../../services/kidGameAudioService';

interface DinoSnackMathGameProps {
  childName: string;
}

type MathMode = 'add' | 'subtract';

interface MathPuzzle {
  a: number;
  b: number;
  op: '+' | '-';
  snack: 'strawberry' | 'apple' | 'star_cracker';
  snackPlural: string;
  dinoName: string;
}

const ADD_PUZZLES: MathPuzzle[] = [
  { a: 2, b: 1, op: '+', snack: 'strawberry', snackPlural: 'strawberries', dinoName: 'Rex' },
  { a: 2, b: 3, op: '+', snack: 'apple', snackPlural: 'apples', dinoName: 'Trixie' },
  { a: 3, b: 3, op: '+', snack: 'star_cracker', snackPlural: 'star crackers', dinoName: 'Rex' },
  { a: 4, b: 2, op: '+', snack: 'strawberry', snackPlural: 'strawberries', dinoName: 'Trixie' },
  { a: 5, b: 3, op: '+', snack: 'apple', snackPlural: 'apples', dinoName: 'Rex' },
];

const SUB_PUZZLES: MathPuzzle[] = [
  { a: 4, b: 1, op: '-', snack: 'strawberry', snackPlural: 'strawberries', dinoName: 'Rex' },
  { a: 5, b: 2, op: '-', snack: 'apple', snackPlural: 'apples', dinoName: 'Trixie' },
  { a: 6, b: 2, op: '-', snack: 'star_cracker', snackPlural: 'star crackers', dinoName: 'Rex' },
  { a: 7, b: 3, op: '-', snack: 'strawberry', snackPlural: 'strawberries', dinoName: 'Trixie' },
  { a: 8, b: 3, op: '-', snack: 'apple', snackPlural: 'apples', dinoName: 'Rex' },
];

const SnackSvg: React.FC<{ kind: MathPuzzle['snack']; crossed?: boolean }> = ({
  kind,
  crossed = false,
}) => (
  <div className={`relative inline-flex items-center justify-center ${crossed ? 'opacity-40' : ''}`}>
    <svg viewBox="0 0 48 48" className="w-10 h-10 sm:w-11 sm:h-11" aria-hidden="true">
      {kind === 'strawberry' && (
        <g>
          <path d="M 24 42 C 12 36 10 22 14 16 C 18 12 30 12 34 16 C 38 22 36 36 24 42 Z" fill="#f43f5e" stroke="#9f1239" strokeWidth="2.5" />
          <path d="M 16 15 Q 24 9 32 15 Q 24 19 16 15 Z" fill="#22c55e" stroke="#15803d" strokeWidth="2" />
          <circle cx="20" cy="24" r="1.5" fill="#fef08a" />
          <circle cx="28" cy="24" r="1.5" fill="#fef08a" />
          <circle cx="24" cy="32" r="1.5" fill="#fef08a" />
        </g>
      )}
      {kind === 'apple' && (
        <g>
          <circle cx="24" cy="27" r="14" fill="#22c55e" stroke="#15803d" strokeWidth="2.5" />
          <path d="M 24 13 Q 26 7 31 8" fill="none" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="30" cy="12" rx="5" ry="3" fill="#4ade80" stroke="#15803d" strokeWidth="1.5" />
        </g>
      )}
      {kind === 'star_cracker' && (
        <polygon
          points="24,5 29,18 43,19 32,28 36,42 24,34 12,42 16,28 5,19 19,18"
          fill="#facc15"
          stroke="#b45309"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}
    </svg>
    {crossed && (
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center text-rose-600 dark:text-rose-400 font-extrabold text-2xl"
      >
        ×
      </span>
    )}
  </div>
);

export const DinoSnackMathGame: React.FC<DinoSnackMathGameProps> = ({ childName }) => {
  const [mode, setMode] = useState<MathMode>('add');
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const [stars, setStars] = useState<number>(0);
  const [countedIdx, setCountedIdx] = useState<number[]>([]);
  const [wrongAns, setWrongAns] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>(
    'Tap the snacks to count them, then pick the total!',
  );

  const puzzles = mode === 'add' ? ADD_PUZZLES : SUB_PUZZLES;
  const isVictory = stars >= puzzles.length;
  const puzzle = puzzles[Math.min(roundIdx, puzzles.length - 1)];
  const correctAnswer = puzzle.op === '+' ? puzzle.a + puzzle.b : puzzle.a - puzzle.b;

  const answerChoices = useMemo(() => {
    const set = new Set<number>([correctAnswer]);
    const offsets = [-2, -1, 1, 2, 3];
    for (const off of offsets) {
      if (set.size >= 4) break;
      const val = correctAnswer + off;
      if (val >= 1 && val <= 10) set.add(val);
    }
    return Array.from(set).sort((x, y) => x - y);
  }, [correctAnswer]);

  const handleRestart = (nextMode: MathMode = mode) => {
    setMode(nextMode);
    setRoundIdx(0);
    setStars(0);
    setCountedIdx([]);
    setWrongAns(null);
    setFeedback(
      nextMode === 'add'
        ? 'Count both bowls together to feed the happy dino!'
        : 'See how many snacks are left after the dino takes a bite!',
    );
  };

  const handleTapSnackToCount = (idx: number) => {
    playBubblePopSound(idx);
    setCountedIdx((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
  };

  const handleChooseAnswer = (val: number) => {
    if (isVictory) return;
    if (val === correctAnswer) {
      const nextStars = stars + 1;
      setStars(nextStars);
      setWrongAns(null);
      if (nextStars >= puzzles.length) {
        playVictoryFanfare();
        setFeedback(`Yummy! ${childName}, you fed Rex & Trixie all 5 snack rounds!`);
      } else {
        playHappyMatchSound();
        setFeedback(`Yes! ${puzzle.a} ${puzzle.op} ${puzzle.b} = ${correctAnswer}!`);
        window.setTimeout(() => {
          setRoundIdx((prev) => prev + 1);
          setCountedIdx([]);
          setFeedback('Tap the snacks to count, then choose the right number!');
        }, 850);
      }
    } else {
      playGentleBoopSound();
      setWrongAns(val);
      setFeedback(`Good try! Tap each snack to count carefully and try again.`);
      window.setTimeout(() => setWrongAns(null), 450);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-orange-200 dark:border-orange-800/70 p-5 sm:p-7 space-y-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-indigo-950 dark:text-slate-100">
            Dino Snack Math
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Ages 3–6 · Visual addition &amp; subtraction (1 to 10)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-orange-50 dark:bg-slate-800 rounded-xl border border-orange-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => handleRestart('add')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'add'
                  ? 'bg-orange-500 text-white'
                  : 'text-orange-950 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700'
              }`}
            >
              Add Snacks (+)
            </button>
            <button
              type="button"
              onClick={() => handleRestart('subtract')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'subtract'
                  ? 'bg-orange-500 text-white'
                  : 'text-orange-950 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700'
              }`}
            >
              Take Away (-)
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleRestart(mode)}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Restart
          </button>
        </div>
      </div>

      {/* Stars Strip */}
      <div className="flex items-center justify-between gap-4 bg-amber-50/90 dark:bg-slate-800/80 border border-amber-200 dark:border-slate-700 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-1.5" aria-label={`${stars} of ${puzzles.length} stars`}>
          {Array.from({ length: puzzles.length }).map((_, i) => (
            <Star
              key={i}
              className={`w-6 h-6 ${
                i < stars ? 'text-amber-400 fill-amber-400 scale-110' : 'text-amber-200 dark:text-slate-600'
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
        <div className="rounded-3xl bg-gradient-to-b from-orange-50 to-emerald-50 dark:from-slate-800 dark:to-emerald-950/40 border-2 border-orange-300 dark:border-emerald-700 p-8 text-center space-y-4">
          <h3 className="text-2xl sm:text-3xl font-display font-extrabold text-indigo-950 dark:text-slate-100">
            Dino Math Champion, {childName}!
          </h3>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Rex &amp; Trixie have full, happy tummies thanks to your counting!
          </p>
          <button
            type="button"
            onClick={() => handleRestart(mode)}
            className="min-h-[48px] px-7 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-base font-extrabold cursor-pointer"
          >
            Play Again
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Equation & Visual Countable Snack Table */}
          <div className="rounded-3xl bg-gradient-to-b from-emerald-50 via-amber-50/70 to-orange-50 dark:from-slate-800 dark:to-slate-900 border-2 border-emerald-200 dark:border-slate-700 p-6 space-y-5 text-center">
            <p className="text-base sm:text-lg font-extrabold text-indigo-950 dark:text-slate-100">
              {puzzle.op === '+'
                ? `${puzzle.dinoName} has ${puzzle.a} ${puzzle.snackPlural} and gets ${puzzle.b} more. How many altogether?`
                : `${puzzle.dinoName} had ${puzzle.a} ${puzzle.snackPlural} and ate ${puzzle.b}. How many are left?`}
            </p>

            {/* Large Equation Readout */}
            <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border-2 border-amber-300 dark:border-slate-600 font-mono tabular-nums text-3xl sm:text-4xl font-extrabold text-indigo-950 dark:text-slate-100">
              <span>{puzzle.a}</span>
              <span className="text-orange-500">{puzzle.op}</span>
              <span>{puzzle.b}</span>
              <span className="text-slate-400">=</span>
              <span className="text-emerald-600 dark:text-emerald-400">?</span>
            </div>

            {/* Interactive Countable Snack Items */}
            {puzzle.op === '+' ? (
              <div className="flex flex-wrap items-center justify-center gap-4 pt-1">
                <div className="flex flex-wrap items-center justify-center gap-2 p-3 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-emerald-200 dark:border-slate-700">
                  {Array.from({ length: puzzle.a }).map((_, i) => (
                    <button
                      key={`a_${i}`}
                      type="button"
                      onClick={() => handleTapSnackToCount(i)}
                      className={`p-1 rounded-xl transition-transform cursor-pointer ${
                        countedIdx.includes(i)
                          ? 'ring-2 ring-amber-400 scale-110 bg-amber-50 dark:bg-amber-950/40'
                          : 'hover:scale-105'
                      }`}
                    >
                      <SnackSvg kind={puzzle.snack} />
                    </button>
                  ))}
                </div>
                <span className="text-2xl font-extrabold text-orange-500">+</span>
                <div className="flex flex-wrap items-center justify-center gap-2 p-3 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-emerald-200 dark:border-slate-700">
                  {Array.from({ length: puzzle.b }).map((_, i) => {
                    const idx = puzzle.a + i;
                    return (
                      <button
                        key={`b_${i}`}
                        type="button"
                        onClick={() => handleTapSnackToCount(idx)}
                        className={`p-1 rounded-xl transition-transform cursor-pointer ${
                          countedIdx.includes(idx)
                            ? 'ring-2 ring-amber-400 scale-110 bg-amber-50 dark:bg-amber-950/40'
                            : 'hover:scale-105'
                        }`}
                      >
                        <SnackSvg kind={puzzle.snack} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-2 p-4 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-emerald-200 dark:border-slate-700 max-w-xl mx-auto">
                {Array.from({ length: puzzle.a }).map((_, i) => {
                  const isEaten = i >= puzzle.a - puzzle.b;
                  return (
                    <button
                      key={`s_${i}`}
                      type="button"
                      disabled={isEaten}
                      onClick={() => handleTapSnackToCount(i)}
                      className={`p-1 rounded-xl transition-transform ${
                        isEaten
                          ? 'cursor-default'
                          : countedIdx.includes(i)
                            ? 'ring-2 ring-amber-400 scale-110 bg-amber-50 dark:bg-amber-950/40 cursor-pointer'
                            : 'hover:scale-105 cursor-pointer'
                      }`}
                    >
                      <SnackSvg kind={puzzle.snack} crossed={isEaten} />
                    </button>
                  );
                })}
              </div>
            )}

            {countedIdx.length > 0 && (
              <p className="text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300">
                You tapped {countedIdx.length} {countedIdx.length === 1 ? 'snack' : 'snacks'}!
              </p>
            )}
          </div>

          {/* 4 Big Answer Number Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {answerChoices.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleChooseAnswer(num)}
                className={`min-h-[76px] rounded-2xl border-2 font-mono tabular-nums text-3xl font-extrabold transition-transform active:scale-95 cursor-pointer shadow-xs ${
                  wrongAns === num
                    ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-400 text-rose-800 dark:text-rose-200'
                    : 'bg-gradient-to-b from-amber-300 to-amber-400 dark:from-amber-500 dark:to-amber-600 hover:from-amber-200 hover:to-amber-300 text-slate-950 border-amber-500'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
