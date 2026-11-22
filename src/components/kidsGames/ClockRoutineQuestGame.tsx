import React, { useState } from 'react';
import { Clock, RotateCcw, Star, Volume2 } from 'lucide-react';
import {
  playClockChimeSound,
  playGentleBoopSound,
  playHappyMatchSound,
  playVictoryFanfare,
  unlockKidGameAudio,
} from '../../services/kidGameAudioService';

interface ClockRoutineQuestGameProps {
  childName: string;
}

type ClockDifficulty = 'oclock' | 'half_past';

interface RoutineChallenge {
  id: string;
  hour: number;
  minute: 0 | 30;
  timeLabel: string;
  routineTitle: string;
  clue: string;
  sceneTheme: 'morning' | 'breakfast' | 'lunch' | 'park' | 'dinner' | 'bedtime';
  distractors: string[];
}

const OCLOCK_CHALLENGES: RoutineChallenge[] = [
  {
    id: 'wake_7',
    hour: 7,
    minute: 0,
    timeLabel: '7:00',
    routineTitle: 'Wake Up & Stretch!',
    clue: 'The golden sun is rising! Look at the short coral hour hand pointing right at 7.',
    sceneTheme: 'morning',
    distractors: ['9:00', '3:00', '11:00'],
  },
  {
    id: 'breakfast_8',
    hour: 8,
    minute: 0,
    timeLabel: '8:00',
    routineTitle: 'Blueberry Pancake Breakfast',
    clue: 'Time for yummy pancakes! The long blue hand points straight up to 12.',
    sceneTheme: 'breakfast',
    distractors: ['6:00', '10:00', '2:00'],
  },
  {
    id: 'lunch_12',
    hour: 12,
    minute: 0,
    timeLabel: '12:00',
    routineTitle: 'Sunny Noon Lunch',
    clue: 'Both clock hands are pointing straight up together at the top!',
    sceneTheme: 'lunch',
    distractors: ['4:00', '8:00', '6:00'],
  },
  {
    id: 'park_3',
    hour: 3,
    minute: 0,
    timeLabel: '3:00',
    routineTitle: 'Afternoon Park & Slides',
    clue: 'Time to swing and climb! Check which number the short coral hand points to.',
    sceneTheme: 'park',
    distractors: ['1:00', '5:00', '9:00'],
  },
  {
    id: 'bed_8',
    hour: 8,
    minute: 0,
    timeLabel: '8:00',
    routineTitle: 'Cozy Bedtime Story',
    clue: 'Stars are twinkling! Put on pajamas and read a bedtime story.',
    sceneTheme: 'bedtime',
    distractors: ['5:00', '10:00', '12:00'],
  },
];

const HALF_PAST_CHALLENGES: RoutineChallenge[] = [
  {
    id: 'wake_730',
    hour: 7,
    minute: 30,
    timeLabel: '7:30',
    routineTitle: 'Brush Teeth & Get Dressed',
    clue: 'The long blue minute hand points straight down to 6 — that means half past (:30)!',
    sceneTheme: 'morning',
    distractors: ['7:00', '8:30', '6:30'],
  },
  {
    id: 'snack_1030',
    hour: 10,
    minute: 30,
    timeLabel: '10:30',
    routineTitle: 'Apple & Cheese Snack Time',
    clue: 'The short coral hand is halfway between 10 and 11, and the minute hand points to 6.',
    sceneTheme: 'breakfast',
    distractors: ['10:00', '11:30', '9:30'],
  },
  {
    id: 'lunch_1230',
    hour: 12,
    minute: 30,
    timeLabel: '12:30',
    routineTitle: 'Picnic Sandwich Lunch',
    clue: 'Half past twelve! Short hand just past 12, long hand down at 6.',
    sceneTheme: 'lunch',
    distractors: ['12:00', '1:30', '6:00'],
  },
  {
    id: 'park_330',
    hour: 3,
    minute: 30,
    timeLabel: '3:30',
    routineTitle: 'Scooter & Playground Fun',
    clue: 'Half past three! Short coral hand sits right between 3 and 4.',
    sceneTheme: 'park',
    distractors: ['3:00', '4:30', '6:30'],
  },
  {
    id: 'dinner_630',
    hour: 6,
    minute: 30,
    timeLabel: '6:30',
    routineTitle: 'Family Dinner & Bath Time',
    clue: 'Half past six! Both hands point near the bottom of the clock.',
    sceneTheme: 'dinner',
    distractors: ['6:00', '7:30', '5:30'],
  },
];

function speakClockClue(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92;
    u.pitch = 1.08;
    window.speechSynthesis.speak(u);
  } catch {
    // Ignore unsupported speech synthesis
  }
}

const AnalogStoryClock: React.FC<{ hour: number; minute: 0 | 30; pulse?: boolean }> = ({
  hour,
  minute,
  pulse = false,
}) => {
  const minuteAngle = minute * 6; // 0 or 180
  const hourAngle = ((hour % 12) + minute / 60) * 30;
  const numerals = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  return (
    <svg
      viewBox="0 0 240 240"
      className={`w-52 h-52 sm:w-60 sm:h-60 mx-auto drop-shadow-sm transition-transform duration-200 ${
        pulse ? 'scale-105' : ''
      }`}
      role="img"
      aria-label={`Analog clock showing ${hour}:${minute === 0 ? '00' : '30'}`}
    >
      {/* Warm wooden frame */}
      <circle cx="120" cy="120" r="112" fill="#d97706" stroke="#92400e" strokeWidth="6" />
      <circle cx="120" cy="120" r="98" fill="#fffbeb" stroke="#fbbf24" strokeWidth="4" />

      {/* Subtle minute guide ticks */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const x1 = 120 + Math.cos(angle) * 86;
        const y1 = 120 + Math.sin(angle) * 86;
        const x2 = 120 + Math.cos(angle) * 93;
        const y2 = 120 + Math.sin(angle) * 93;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={i === 0 || i === 6 ? '#0284c7' : '#d97706'}
            strokeWidth={i % 3 === 0 ? '4' : '2'}
            strokeLinecap="round"
          />
        );
      })}

      {/* Clock numbers 1-12 */}
      {numerals.map((num, idx) => {
        const angle = (idx * 30 - 90) * (Math.PI / 180);
        const x = 120 + Math.cos(angle) * 73;
        const y = 120 + Math.sin(angle) * 73 + 6;
        return (
          <text
            key={num}
            x={x}
            y={y}
            textAnchor="middle"
            fontSize="18"
            fontWeight="800"
            fill="#1e1b4b"
            fontFamily="JetBrains Mono, monospace"
          >
            {num}
          </text>
        );
      })}

      {/* Smiling clock face */}
      <circle cx="102" cy="108" r="3.5" fill="#78350f" />
      <circle cx="138" cy="108" r="3.5" fill="#78350f" />
      <path
        d="M 108 134 Q 120 144 132 134"
        fill="none"
        stroke="#78350f"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Long Sky-Blue Minute Hand */}
      <g transform={`rotate(${minuteAngle} 120 120)`}>
        <line
          x1="120"
          y1="120"
          x2="120"
          y2="46"
          stroke="#0284c7"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <circle cx="120" cy="48" r="4" fill="#38bdf8" />
      </g>

      {/* Short Coral-Red Hour Hand */}
      <g transform={`rotate(${hourAngle} 120 120)`}>
        <line
          x1="120"
          y1="120"
          x2="120"
          y2="68"
          stroke="#e11d48"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <circle cx="120" cy="70" r="4.5" fill="#fb7185" />
      </g>

      {/* Center pin */}
      <circle cx="120" cy="120" r="9" fill="#f59e0b" stroke="#78350f" strokeWidth="3" />
    </svg>
  );
};

export const ClockRoutineQuestGame: React.FC<ClockRoutineQuestGameProps> = ({
  childName,
}) => {
  const [difficulty, setDifficulty] = useState<ClockDifficulty>('oclock');
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const [stars, setStars] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Look at the short coral hour hand and long blue minute hand to pick the matching time!',
  );
  const [isCelebratingRound, setIsCelebratingRound] = useState<boolean>(false);
  const [wrongChoice, setWrongChoice] = useState<string | null>(null);

  const deck = difficulty === 'oclock' ? OCLOCK_CHALLENGES : HALF_PAST_CHALLENGES;
  const isVictory = stars >= deck.length;
  const current = deck[roundIdx % deck.length];

  // Deterministic shuffled choice list per round
  const choices = React.useMemo(() => {
    const raw = [current.timeLabel, ...current.distractors];
    const shift = (roundIdx * 2 + (difficulty === 'half_past' ? 1 : 0)) % raw.length;
    return [...raw.slice(shift), ...raw.slice(0, shift)];
  }, [current, roundIdx, difficulty]);

  const handleReset = (nextDiff: ClockDifficulty = difficulty) => {
    unlockKidGameAudio();
    setDifficulty(nextDiff);
    setRoundIdx(0);
    setStars(0);
    setWrongChoice(null);
    setIsCelebratingRound(false);
    setStatusMessage(
      nextDiff === 'oclock'
        ? 'Read the short coral hand to tell each o’clock time!'
        : 'When the long blue hand points down to 6, it is half past (:30)!',
    );
  };

  const handlePickTime = (picked: string) => {
    unlockKidGameAudio();
    if (isCelebratingRound || isVictory) return;

    if (picked === current.timeLabel) {
      playClockChimeSound(current.minute === 0);
      setWrongChoice(null);
      setIsCelebratingRound(true);
      const nextStars = stars + 1;
      setStars(nextStars);

      if (nextStars >= deck.length) {
        setStatusMessage(`Hooray ${childName}! You mastered the whole daily clock!`);
        window.setTimeout(() => playVictoryFanfare(), 240);
      } else {
        playHappyMatchSound();
        setStatusMessage(
          `Spot on, ${childName}! ${current.timeLabel} is ${current.routineTitle}!`,
        );
        window.setTimeout(() => {
          setRoundIdx((r) => r + 1);
          setIsCelebratingRound(false);
        }, 1050);
      }
    } else {
      playGentleBoopSound();
      setWrongChoice(picked);
      setStatusMessage(
        `Good try! Check where the short coral hour hand is pointing — ${current.clue}`,
      );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-amber-300 dark:border-amber-600/70 p-5 sm:p-7 space-y-6 shadow-xs">
      {/* Header HUD */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-amber-100 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
            Ages 3–6 · Clock &amp; Daily Routines
          </p>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-indigo-950 dark:text-white">
            Sunny Clock &amp; Daily Routines
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-amber-100/80 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => handleReset('oclock')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                difficulty === 'oclock'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-amber-950 dark:text-slate-300'
              }`}
            >
              O’Clock (3–5)
            </button>
            <button
              type="button"
              onClick={() => handleReset('half_past')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                difficulty === 'half_past'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-amber-950 dark:text-slate-300'
              }`}
            >
              Half-Past (4–6)
            </button>
          </div>

          <div
            aria-label={`${stars} of ${deck.length} stars earned`}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-slate-800 border border-amber-200 dark:border-slate-700"
          >
            {deck.map((item, idx) => (
              <Star
                key={item.id}
                className={`w-4 h-4 ${
                  idx < stars
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-slate-300 dark:text-slate-600'
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </div>

      {isVictory ? (
        <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-sky-50 to-emerald-50 dark:from-amber-950/40 dark:via-slate-800 dark:to-emerald-950/40 border-2 border-amber-300 dark:border-amber-600 p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-sm">
            <Clock className="w-9 h-9" aria-hidden="true" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-display font-extrabold text-indigo-950 dark:text-white">
            Super Time-Teller, {childName}!
          </h3>
          <p className="text-sm text-slate-700 dark:text-slate-300 max-w-md mx-auto">
            You earned all {deck.length} golden clock stars! Ready to try{' '}
            {difficulty === 'oclock' ? 'Half-Past (:30) times next?' : 'another sunny day?'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleReset(difficulty)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Play Again
            </button>
            {difficulty === 'oclock' && (
              <button
                type="button"
                onClick={() => handleReset('half_past')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-display font-extrabold text-sm cursor-pointer"
              >
                Try Half-Past (:30)
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Interactive Clock Stage */}
          <div className="lg:col-span-6 rounded-2xl bg-gradient-to-b from-sky-50 to-amber-50/70 dark:from-slate-800 dark:to-slate-900 border-2 border-amber-200 dark:border-slate-700 p-6 text-center space-y-4">
            <div className="flex items-center justify-center gap-4 text-xs font-bold">
              <span className="text-rose-700 dark:text-rose-300">
                Short Coral Hand = Hour
              </span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span className="text-sky-700 dark:text-sky-300">
                Long Blue Hand = Minutes
              </span>
            </div>

            <AnalogStoryClock
              hour={current.hour}
              minute={current.minute}
              pulse={isCelebratingRound}
            />

            <button
              type="button"
              onClick={() =>
                speakClockClue(
                  `${current.routineTitle}. ${current.clue}`,
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 text-indigo-950 dark:text-sky-200 border border-sky-200 dark:border-slate-600 hover:bg-sky-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              Hear Time Clue Aloud
            </button>
          </div>

          {/* Daily Routine Prompt & Big Digital Time Choices */}
          <div className="lg:col-span-6 space-y-5">
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-sky-700 dark:text-sky-300">
                Routine {roundIdx + 1} of {deck.length}
              </p>
              <h3 className="text-xl sm:text-2xl font-display font-extrabold text-indigo-950 dark:text-white">
                {current.routineTitle}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {current.clue}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {choices.map((timeOpt) => {
                const isWrong = wrongChoice === timeOpt;
                const isCorrectHighlight =
                  isCelebratingRound && timeOpt === current.timeLabel;

                return (
                  <button
                    key={timeOpt}
                    type="button"
                    onClick={() => handlePickTime(timeOpt)}
                    className={`min-h-[72px] rounded-2xl border-2 font-mono tabular-nums text-2xl sm:text-3xl font-extrabold transition-all active:scale-[0.97] cursor-pointer ${
                      isCorrectHighlight
                        ? 'bg-emerald-500 border-emerald-700 text-white scale-[1.03]'
                        : isWrong
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300'
                          : 'bg-amber-50/70 dark:bg-slate-800 border-amber-300 dark:border-slate-600 hover:bg-amber-100 dark:hover:bg-slate-700 text-indigo-950 dark:text-white'
                    }`}
                  >
                    {timeOpt}
                  </button>
                );
              })}
            </div>

            <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 bg-sky-50/80 dark:bg-slate-800/80 border border-sky-200 dark:border-slate-700 rounded-xl px-4 py-3">
              {statusMessage}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
