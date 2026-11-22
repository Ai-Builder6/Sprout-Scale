import React, { useMemo, useState } from 'react';
import { Lightbulb, Orbit, RotateCcw, Star } from 'lucide-react';
import {
  playGentleBoopSound,
  playHappyMatchSound,
  playSpaceChimeSound,
  playVictoryFanfare,
  unlockKidGameAudio,
} from '../../services/kidGameAudioService';

interface PlanetMathMissionGameProps {
  childName: string;
}

type SpaceMathMode = 'patterns_sums' | 'arrays_multiply';

interface SpacePuzzle {
  id: string;
  planetName: string;
  planetColor: string;
  prompt: string;
  equationDisplay: string;
  answer: number;
  choices: number[];
  hintText: string;
  arrayRows?: number;
  arrayCols?: number;
}

const PATTERNS_AND_SUMS: SpacePuzzle[] = [
  {
    id: 'mercury',
    planetName: 'Mercury',
    planetColor: '#f59e0b',
    prompt: 'Skip-count by 5s to charge Mercury’s boosters!',
    equationDisplay: '5,  10,  15,  ?',
    answer: 20,
    choices: [18, 20, 25, 16],
    hintText: 'Add 5 to 15: 16, 17, 18, 19, 20!',
  },
  {
    id: 'venus',
    planetName: 'Venus',
    planetColor: '#fb7185',
    prompt: 'Two-digit rocket fuel addition for Venus!',
    equationDisplay: '14 + 8 = ?',
    answer: 22,
    choices: [21, 22, 24, 19],
    hintText: 'Make a 10 first: 14 + 6 = 20, then add 2 more = 22!',
  },
  {
    id: 'earth',
    planetName: 'Earth',
    planetColor: '#0ea5e9',
    prompt: 'Skip-count by 10s around planet Earth!',
    equationDisplay: '20,  30,  40,  ?',
    answer: 50,
    choices: [45, 50, 60, 42],
    hintText: 'Each jump adds one full 10: 40 + 10 = 50!',
  },
  {
    id: 'mars',
    planetName: 'Mars',
    planetColor: '#ef4444',
    prompt: 'Countdown subtraction to land safely on Mars!',
    equationDisplay: '25 − 7 = ?',
    answer: 18,
    choices: [17, 18, 19, 16],
    hintText: 'Take away 5 to reach 20, then take away 2 more = 18!',
  },
  {
    id: 'saturn',
    planetName: 'Saturn',
    planetColor: '#a855f7',
    prompt: 'Find the missing mystery number in Saturn’s rings!',
    equationDisplay: '? + 9 = 21',
    answer: 12,
    choices: [11, 12, 13, 14],
    hintText: 'Count up from 9 to 21 — that is 12!',
  },
];

const ARRAYS_AND_MULTIPLY: SpacePuzzle[] = [
  {
    id: 'mercury_m',
    planetName: 'Mercury',
    planetColor: '#f59e0b',
    prompt: 'Count 2 rows of 4 glowing stars!',
    equationDisplay: '2 × 4 = ?',
    answer: 8,
    choices: [6, 8, 10, 9],
    hintText: '4 + 4 = 8 stars in total!',
    arrayRows: 2,
    arrayCols: 4,
  },
  {
    id: 'venus_m',
    planetName: 'Venus',
    planetColor: '#fb7185',
    prompt: 'Count 3 rows of 4 glowing stars!',
    equationDisplay: '3 × 4 = ?',
    answer: 12,
    choices: [10, 12, 14, 15],
    hintText: 'Skip-count by 4s three times: 4, 8, 12!',
    arrayRows: 3,
    arrayCols: 4,
  },
  {
    id: 'earth_m',
    planetName: 'Earth',
    planetColor: '#0ea5e9',
    prompt: 'Count 3 rows of 5 solar panels!',
    equationDisplay: '3 × 5 = ?',
    answer: 15,
    choices: [12, 15, 18, 20],
    hintText: 'Skip-count by 5s three times: 5, 10, 15!',
    arrayRows: 3,
    arrayCols: 5,
  },
  {
    id: 'mars_m',
    planetName: 'Mars',
    planetColor: '#ef4444',
    prompt: 'Count 4 rows of 4 Mars rovers!',
    equationDisplay: '4 × 4 = ?',
    answer: 16,
    choices: [12, 14, 16, 20],
    hintText: '4 + 4 + 4 + 4 = 16!',
    arrayRows: 4,
    arrayCols: 4,
  },
  {
    id: 'saturn_m',
    planetName: 'Saturn',
    planetColor: '#a855f7',
    prompt: 'Count 4 rows of 5 sparkling ring moons!',
    equationDisplay: '4 × 5 = ?',
    answer: 20,
    choices: [15, 18, 20, 25],
    hintText: 'Skip-count by 5s four times: 5, 10, 15, 20!',
    arrayRows: 4,
    arrayCols: 5,
  },
];

export const PlanetMathMissionGame: React.FC<PlanetMathMissionGameProps> = ({
  childName,
}) => {
  const [mode, setMode] = useState<SpaceMathMode>('patterns_sums');
  const [missionIdx, setMissionIdx] = useState<number>(0);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [wrongNum, setWrongNum] = useState<number | null>(null);
  const [isCelebrating, setIsCelebrating] = useState<boolean>(false);
  const [statusLine, setStatusLine] = useState<string>(
    'Solve each space math puzzle to light up all 5 planets in orbit!',
  );

  const missions = mode === 'patterns_sums' ? PATTERNS_AND_SUMS : ARRAYS_AND_MULTIPLY;
  const isVictory = missionIdx >= missions.length;
  const current = missions[missionIdx % missions.length];

  const shuffledChoices = useMemo(() => {
    const arr = [...current.choices];
    const rot = (missionIdx + (mode === 'arrays_multiply' ? 2 : 0)) % arr.length;
    return [...arr.slice(rot), ...arr.slice(0, rot)];
  }, [current, missionIdx, mode]);

  const handleRestart = (nextMode: SpaceMathMode = mode) => {
    unlockKidGameAudio();
    setMode(nextMode);
    setMissionIdx(0);
    setShowHint(false);
    setWrongNum(null);
    setIsCelebrating(false);
    setStatusLine(
      nextMode === 'patterns_sums'
        ? 'Crack number patterns & two-digit sums to power up all 5 planets!'
        : 'Use the glowing star grids to solve early multiplication missions!',
    );
  };

  const handleSelectAnswer = (val: number) => {
    unlockKidGameAudio();
    if (isCelebrating || isVictory) return;

    if (val === current.answer) {
      playSpaceChimeSound(missionIdx);
      setWrongNum(null);
      setIsCelebrating(true);
      const nextIdx = missionIdx + 1;

      if (nextIdx >= missions.length) {
        setStatusLine(`Solar system powered up! Incredible space math, ${childName}!`);
        window.setTimeout(() => {
          setMissionIdx(nextIdx);
          setIsCelebrating(false);
          playVictoryFanfare();
        }, 700);
      } else {
        playHappyMatchSound();
        setStatusLine(
          `${current.planetName} is glowing! ${current.equationDisplay.replace('?', String(current.answer))}!`,
        );
        window.setTimeout(() => {
          setMissionIdx(nextIdx);
          setShowHint(false);
          setIsCelebrating(false);
        }, 950);
      }
    } else {
      playGentleBoopSound();
      setWrongNum(val);
      setShowHint(true);
      setStatusLine(`Almost! ${current.hintText}`);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-indigo-300 dark:border-indigo-700/80 p-5 sm:p-7 space-y-6 shadow-xs">
      {/* Header HUD */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-100 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
            Ages 5–8 · Patterns, 2-Digit Sums &amp; Star Arrays
          </p>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-indigo-950 dark:text-white">
            Planet Orbit Math &amp; Logic
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-indigo-100/80 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => handleRestart('patterns_sums')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'patterns_sums'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-indigo-950 dark:text-slate-300'
              }`}
            >
              Patterns &amp; Sums (5–6)
            </button>
            <button
              type="button"
              onClick={() => handleRestart('arrays_multiply')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'arrays_multiply'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-indigo-950 dark:text-slate-300'
              }`}
            >
              Star Arrays × (6–8)
            </button>
          </div>

          <div
            aria-label={`${missionIdx} of ${missions.length} planets lit`}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-slate-800 border border-indigo-200 dark:border-slate-700"
          >
            {missions.map((m, idx) => (
              <Star
                key={m.id}
                className={`w-4 h-4 ${
                  idx < missionIdx
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-slate-300 dark:text-slate-600'
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Deep-Space Solar System Orbit Strip */}
      <div className="rounded-2xl bg-slate-950 border-2 border-indigo-800 p-4 overflow-hidden">
        <svg
          viewBox="0 0 500 108"
          className="w-full h-24 sm:h-28"
          role="img"
          aria-label={`${missionIdx} of 5 planets powered up in orbit`}
        >
          {/* Orbit track */}
          <line
            x1="46"
            y1="54"
            x2="454"
            y2="54"
            stroke="#334155"
            strokeWidth="3"
            strokeDasharray="6 6"
          />

          {/* Glowing Sun on Left */}
          <circle cx="38" cy="54" r="22" fill="#facc15" />
          <circle cx="38" cy="54" r="28" fill="#facc15" opacity="0.22" />

          {/* 5 Orbiting Planets */}
          {missions.map((m, idx) => {
            const cx = 112 + idx * 84;
            const lit = idx < missionIdx;
            const isActive = idx === missionIdx && !isVictory;
            return (
              <g key={m.id}>
                {isActive && (
                  <circle
                    cx={cx}
                    cy="54"
                    r="24"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                  />
                )}
                {m.planetName === 'Saturn' && (
                  <ellipse
                    cx={cx}
                    cy="54"
                    rx="27"
                    ry="8"
                    fill="none"
                    stroke={lit ? '#e9d5ff' : '#475569'}
                    strokeWidth="3.5"
                    transform={`rotate(-16 ${cx} 54)`}
                  />
                )}
                <circle
                  cx={cx}
                  cy="54"
                  r={m.planetName === 'Saturn' ? 16 : 14}
                  fill={lit ? m.planetColor : '#1e293b'}
                  stroke={lit ? '#ffffff' : '#64748b'}
                  strokeWidth="2.5"
                />
                <text
                  x={cx}
                  y="94"
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill={lit ? '#fef08a' : isActive ? '#7dd3fc' : '#94a3b8'}
                >
                  {m.planetName}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {isVictory ? (
        <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-sky-50 to-amber-50 dark:from-indigo-950/50 dark:via-slate-800 dark:to-amber-950/40 border-2 border-indigo-300 dark:border-indigo-600 p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Orbit className="w-9 h-9" aria-hidden="true" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-display font-extrabold text-indigo-950 dark:text-white">
            Galaxy Commander {childName}!
          </h3>
          <p className="text-sm text-slate-700 dark:text-slate-300 max-w-md mx-auto">
            All 5 planets are glowing brightly across the solar system!
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleRestart(mode)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-display font-extrabold text-sm cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Play Again
            </button>
            {mode === 'patterns_sums' && (
              <button
                type="button"
                onClick={() => handleRestart('arrays_multiply')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm cursor-pointer"
              >
                Level Up: Star Arrays (×)
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Mission Equation Card */}
          <div className="rounded-2xl bg-indigo-50/70 dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 p-5 text-center space-y-3">
            <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
              Mission {missionIdx + 1} · {current.planetName} Station
            </p>
            <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200">
              {current.prompt}
            </p>

            <div className="py-2 font-mono tabular-nums text-3xl sm:text-4xl font-extrabold tracking-wide text-indigo-950 dark:text-white">
              {current.equationDisplay}
            </div>

            {/* Visual Star Array Grid for Multiplication Mode */}
            {current.arrayRows && current.arrayCols && (
              <div
                aria-label={`${current.arrayRows} rows of ${current.arrayCols} stars`}
                className="inline-flex flex-col gap-2 bg-slate-900 px-5 py-3.5 rounded-2xl border border-indigo-500/60"
              >
                {Array.from({ length: current.arrayRows }).map((_, rIdx) => (
                  <div key={rIdx} className="flex items-center justify-center gap-2.5">
                    {Array.from({ length: current.arrayCols ?? 0 }).map((__, cIdx) => (
                      <Star
                        key={cIdx}
                        className="w-5 h-5 text-amber-400 fill-amber-400"
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowHint((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/50 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded-lg cursor-pointer"
              >
                <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" />
                {showHint ? 'Hide Strategy Tip' : 'Show Math Strategy Tip'}
              </button>
              {showHint && (
                <p className="mt-2 text-xs font-semibold text-indigo-900 dark:text-sky-300">
                  Strategy: {current.hintText}
                </p>
              )}
            </div>
          </div>

          {/* 4 Big Answer Thrusters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {shuffledChoices.map((choice) => {
              const isCorrectNow = isCelebrating && choice === current.answer;
              const isWrong = wrongNum === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => handleSelectAnswer(choice)}
                  className={`min-h-[68px] rounded-2xl border-2 font-mono tabular-nums text-2xl sm:text-3xl font-extrabold transition-all active:scale-95 cursor-pointer ${
                    isCorrectNow
                      ? 'bg-emerald-500 border-emerald-700 text-white scale-[1.03]'
                      : isWrong
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300'
                        : 'bg-white dark:bg-slate-800 border-indigo-300 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-700 text-indigo-950 dark:text-white'
                  }`}
                >
                  {choice}
                </button>
              );
            })}
          </div>

          <p className="text-center text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
            {statusLine}
          </p>
        </div>
      )}
    </div>
  );
};
