import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, RotateCcw, Sparkles, Star } from 'lucide-react';
import { ChildProfile } from '../../types';
import {
  playGentleBoopSound,
  playHappyMatchSound,
  playVictoryFanfare,
} from '../../services/kidGameAudioService';

type GamePhase = 'TITLE_MENU' | 'PLAYING' | 'VICTORY';
type CompareGoal = 'taller' | 'shorter';
type FriendSpecies =
  | 'giraffe'
  | 'bunny'
  | 'elephant'
  | 'duck'
  | 'bear'
  | 'kitten'
  | 'flamingo'
  | 'turtle'
  | 'dino'
  | 'chick';

interface FriendAnimal {
  species: FriendSpecies;
  name: string;
  heightLabel: string;
  heightInches: number;
  isTall: boolean;
}

interface ComparisonRound {
  id: number;
  goal: CompareGoal;
  left: FriendAnimal;
  right: FriendAnimal;
}

interface TallShortFriendsGameProps {
  childProfile: ChildProfile;
}

const BASE_ROUNDS: { goal: CompareGoal; tall: FriendAnimal; short: FriendAnimal }[] = [
  {
    goal: 'taller',
    tall: { species: 'giraffe', name: 'Giraffe', heightLabel: '5\' 6"', heightInches: 66, isTall: true },
    short: { species: 'bunny', name: 'Baby Bunny', heightLabel: '1\' 2"', heightInches: 14, isTall: false },
  },
  {
    goal: 'shorter',
    tall: { species: 'elephant', name: 'Elephant', heightLabel: '4\' 10"', heightInches: 58, isTall: true },
    short: { species: 'duck', name: 'Little Duck', heightLabel: '1\' 0"', heightInches: 12, isTall: false },
  },
  {
    goal: 'taller',
    tall: { species: 'bear', name: 'Big Bear', heightLabel: '4\' 6"', heightInches: 54, isTall: true },
    short: { species: 'kitten', name: 'Kitten', heightLabel: '1\' 1"', heightInches: 13, isTall: false },
  },
  {
    goal: 'shorter',
    tall: { species: 'flamingo', name: 'Flamingo', heightLabel: '4\' 2"', heightInches: 50, isTall: true },
    short: { species: 'turtle', name: 'Baby Turtle', heightLabel: '0\' 10"', heightInches: 10, isTall: false },
  },
  {
    goal: 'taller',
    tall: { species: 'dino', name: 'Friendly Dino', heightLabel: '5\' 2"', heightInches: 62, isTall: true },
    short: { species: 'chick', name: 'Baby Chick', heightLabel: '0\' 9"', heightInches: 9, isTall: false },
  },
];

function buildShuffledRounds(): ComparisonRound[] {
  return BASE_ROUNDS.map((r, idx) => {
    const tallOnLeft = Math.random() > 0.5;
    return {
      id: idx + 1,
      goal: r.goal,
      left: tallOnLeft ? r.tall : r.short,
      right: tallOnLeft ? r.short : r.tall,
    };
  });
}

/**
 * Full-body storybook vector animals anchored cleanly on baseline y = 260 inside viewBox="0 0 260 280"
 */
function renderFullBodyAnimal(species: FriendSpecies): React.ReactNode {
  switch (species) {
    case 'giraffe':
      return (
        <g>
          {/* Legs */}
          <rect x="98" y="176" width="12" height="84" rx="5" fill="#fbbf24" stroke="#b45309" strokeWidth="3" />
          <rect x="148" y="176" width="12" height="84" rx="5" fill="#fbbf24" stroke="#b45309" strokeWidth="3" />
          {/* Body */}
          <ellipse cx="130" cy="172" rx="44" ry="28" fill="#fcd34d" stroke="#b45309" strokeWidth="3.5" />
          {/* Long Tall Neck */}
          <rect x="116" y="42" width="26" height="122" rx="12" fill="#fcd34d" stroke="#b45309" strokeWidth="3.5" />
          {/* Spots */}
          <circle cx="128" cy="86" r="7" fill="#d97706" />
          <circle cx="130" cy="120" r="8" fill="#d97706" />
          <circle cx="116" cy="168" r="9" fill="#d97706" />
          <circle cx="144" cy="176" r="7" fill="#d97706" />
          {/* Head & Ossicones */}
          <line x1="120" y1="30" x2="114" y2="12" stroke="#b45309" strokeWidth="4" strokeLinecap="round" />
          <circle cx="114" cy="12" r="5" fill="#92400e" />
          <line x1="138" y1="30" x2="144" y2="12" stroke="#b45309" strokeWidth="4" strokeLinecap="round" />
          <circle cx="144" cy="12" r="5" fill="#92400e" />
          <ellipse cx="134" cy="40" rx="26" ry="20" fill="#fde047" stroke="#b45309" strokeWidth="3.5" />
          <circle cx="126" cy="36" r="3.8" fill="#1e293b" />
          <circle cx="144" cy="36" r="3.8" fill="#1e293b" />
          <path d="M 128 48 Q 136 54 144 48" fill="none" stroke="#78350f" strokeWidth="2.8" strokeLinecap="round" />
        </g>
      );
    case 'bunny':
      return (
        <g>
          {/* Tiny Fluffy Bunny seated low near baseline */}
          <ellipse cx="119" cy="184" rx="7" ry="18" fill="#ffffff" stroke="#ec4899" strokeWidth="3" />
          <ellipse cx="141" cy="184" rx="7" ry="18" fill="#ffffff" stroke="#ec4899" strokeWidth="3" />
          <ellipse cx="119" cy="184" rx="3" ry="11" fill="#fbcfe8" />
          <ellipse cx="141" cy="184" rx="3" ry="11" fill="#fbcfe8" />
          <ellipse cx="130" cy="238" rx="26" ry="22" fill="#ffffff" stroke="#ec4899" strokeWidth="3" />
          <circle cx="130" cy="210" r="20" fill="#ffffff" stroke="#ec4899" strokeWidth="3" />
          <circle cx="123" cy="208" r="3" fill="#1e293b" />
          <circle cx="137" cy="208" r="3" fill="#1e293b" />
          <circle cx="130" cy="214" r="3" fill="#f472b6" />
          <circle cx="156" cy="246" r="9" fill="#fdf2f8" stroke="#ec4899" strokeWidth="2.5" />
        </g>
      );
    case 'elephant':
      return (
        <g>
          {/* Legs */}
          <rect x="82" y="182" width="28" height="78" rx="10" fill="#94a3b8" stroke="#475569" strokeWidth="3.5" />
          <rect x="150" y="182" width="28" height="78" rx="10" fill="#94a3b8" stroke="#475569" strokeWidth="3.5" />
          {/* Big Round Ears */}
          <ellipse cx="76" cy="108" rx="34" ry="42" fill="#cbd5e1" stroke="#475569" strokeWidth="3.5" />
          <ellipse cx="184" cy="108" rx="34" ry="42" fill="#cbd5e1" stroke="#475569" strokeWidth="3.5" />
          <ellipse cx="76" cy="110" rx="20" ry="26" fill="#fbcfe8" />
          <ellipse cx="184" cy="110" rx="20" ry="26" fill="#fbcfe8" />
          {/* Body & Head */}
          <ellipse cx="130" cy="166" rx="56" ry="48" fill="#94a3b8" stroke="#475569" strokeWidth="3.5" />
          <circle cx="130" cy="104" r="44" fill="#cbd5e1" stroke="#475569" strokeWidth="3.5" />
          {/* Happy Trunk */}
          <path d="M 130 116 Q 130 156 154 152" fill="none" stroke="#94a3b8" strokeWidth="18" strokeLinecap="round" />
          <path d="M 130 116 Q 130 156 154 152" fill="none" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
          <circle cx="114" cy="96" r="4.5" fill="#1e293b" />
          <circle cx="146" cy="96" r="4.5" fill="#1e293b" />
        </g>
      );
    case 'duck':
      return (
        <g>
          {/* Tiny Yellow Duckling */}
          <line x1="120" y1="246" x2="116" y2="260" stroke="#ea580c" strokeWidth="4" strokeLinecap="round" />
          <line x1="140" y1="246" x2="144" y2="260" stroke="#ea580c" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="130" cy="236" rx="25" ry="18" fill="#facc15" stroke="#ca8a04" strokeWidth="3" />
          <circle cx="130" cy="210" r="18" fill="#fde047" stroke="#ca8a04" strokeWidth="3" />
          <circle cx="123" cy="207" r="3" fill="#1e293b" />
          <circle cx="137" cy="207" r="3" fill="#1e293b" />
          <ellipse cx="130" cy="215" rx="9" ry="4.5" fill="#f97316" />
        </g>
      );
    case 'bear':
      return (
        <g>
          {/* Tall Standing Teddy Bear */}
          <circle cx="96" cy="64" r="16" fill="#b45309" stroke="#78350f" strokeWidth="3.5" />
          <circle cx="164" cy="64" r="16" fill="#b45309" stroke="#78350f" strokeWidth="3.5" />
          <rect x="92" y="196" width="28" height="64" rx="12" fill="#b45309" stroke="#78350f" strokeWidth="3.5" />
          <rect x="140" y="196" width="28" height="64" rx="12" fill="#b45309" stroke="#78350f" strokeWidth="3.5" />
          <ellipse cx="130" cy="166" rx="52" ry="58" fill="#b45309" stroke="#78350f" strokeWidth="3.5" />
          <ellipse cx="130" cy="172" rx="30" ry="36" fill="#fde68a" />
          <circle cx="130" cy="92" r="40" fill="#b45309" stroke="#78350f" strokeWidth="3.5" />
          <ellipse cx="130" cy="104" rx="18" ry="13" fill="#fde68a" />
          <circle cx="116" cy="86" r="4.2" fill="#1e293b" />
          <circle cx="144" cy="86" r="4.2" fill="#1e293b" />
          <ellipse cx="130" cy="99" rx="6" ry="4" fill="#451a03" />
        </g>
      );
    case 'kitten':
      return (
        <g>
          {/* Small Sitting Kitten */}
          <path d="M 152 246 Q 178 232 170 212" fill="none" stroke="#fb923c" strokeWidth="7" strokeLinecap="round" />
          <ellipse cx="130" cy="240" rx="22" ry="20" fill="#fdba74" stroke="#c2410c" strokeWidth="3" />
          <polygon points="112,202 114,182 126,196" fill="#fb923c" stroke="#c2410c" strokeWidth="2.8" />
          <polygon points="148,202 146,182 134,196" fill="#fb923c" stroke="#c2410c" strokeWidth="2.8" />
          <circle cx="130" cy="210" r="19" fill="#fdba74" stroke="#c2410c" strokeWidth="3" />
          <circle cx="123" cy="208" r="3" fill="#1e293b" />
          <circle cx="137" cy="208" r="3" fill="#1e293b" />
          <polygon points="127,213 133,213 130,217" fill="#ec4899" />
        </g>
      );
    case 'flamingo':
      return (
        <g>
          {/* Tall Pink Flamingo */}
          <line x1="122" y1="162" x2="122" y2="260" stroke="#f472b6" strokeWidth="6" strokeLinecap="round" />
          <line x1="142" y1="162" x2="142" y2="260" stroke="#f472b6" strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="132" cy="154" rx="40" ry="26" fill="#f472b6" stroke="#be185d" strokeWidth="3.5" />
          <path d="M 148 138 C 166 95 110 76 128 50" fill="none" stroke="#f472b6" strokeWidth="14" strokeLinecap="round" />
          <circle cx="132" cy="48" r="18" fill="#f9a8d4" stroke="#be185d" strokeWidth="3" />
          <circle cx="137" cy="44" r="3.2" fill="#1e293b" />
          <path d="M 148 48 Q 164 52 158 64 L 144 56 Z" fill="#1e293b" />
        </g>
      );
    case 'turtle':
      return (
        <g>
          {/* Low Happy Baby Turtle */}
          <ellipse cx="104" cy="254" rx="10" ry="6" fill="#4ade80" stroke="#15803d" strokeWidth="2.5" />
          <ellipse cx="150" cy="254" rx="10" ry="6" fill="#4ade80" stroke="#15803d" strokeWidth="2.5" />
          <path d="M 96 250 A 32 28 0 0 1 160 250 Z" fill="#16a34a" stroke="#14532d" strokeWidth="3" />
          <circle cx="168" cy="236" r="13" fill="#86efac" stroke="#15803d" strokeWidth="3" />
          <circle cx="172" cy="234" r="2.8" fill="#1e293b" />
        </g>
      );
    case 'dino':
      return (
        <g>
          {/* Friendly Tall Green Brontosaurus */}
          <path d="M 88 188 Q 52 198 48 228" fill="none" stroke="#22c55e" strokeWidth="18" strokeLinecap="round" />
          <rect x="96" y="190" width="20" height="70" rx="8" fill="#22c55e" stroke="#15803d" strokeWidth="3.5" />
          <rect x="142" y="190" width="20" height="70" rx="8" fill="#22c55e" stroke="#15803d" strokeWidth="3.5" />
          <ellipse cx="126" cy="176" rx="46" ry="34" fill="#4ade80" stroke="#15803d" strokeWidth="3.5" />
          <path d="M 150 156 Q 160 96 146 50" fill="none" stroke="#4ade80" strokeWidth="26" strokeLinecap="round" />
          <ellipse cx="152" cy="46" rx="26" ry="20" fill="#4ade80" stroke="#15803d" strokeWidth="3.5" />
          <circle cx="158" cy="42" r="4" fill="#1e293b" />
          <path d="M 148 52 Q 160 58 170 50" fill="none" stroke="#14532d" strokeWidth="3" strokeLinecap="round" />
          <circle cx="116" cy="168" r="7" fill="#16a34a" />
          <circle cx="136" cy="178" r="6" fill="#16a34a" />
        </g>
      );
    case 'chick':
      return (
        <g>
          {/* Tiny Baby Chick */}
          <line x1="124" y1="250" x2="122" y2="260" stroke="#ea580c" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="136" y1="250" x2="138" y2="260" stroke="#ea580c" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="130" cy="234" r="20" fill="#fde047" stroke="#eab308" strokeWidth="3" />
          <circle cx="124" cy="230" r="2.8" fill="#1e293b" />
          <circle cx="136" cy="230" r="2.8" fill="#1e293b" />
          <polygon points="126,236 134,236 130,242" fill="#f97316" />
        </g>
      );
  }
}

export const TallShortFriendsGame: React.FC<TallShortFriendsGameProps> = ({
  childProfile,
}) => {
  const [phase, setPhase] = useState<GamePhase>('TITLE_MENU');
  const [rounds, setRounds] = useState<ComparisonRound[]>(() => buildShuffledRounds());
  const [roundIdx, setRoundIdx] = useState<number>(0);
  const [celebratingSide, setCelebratingSide] = useState<'left' | 'right' | null>(null);
  const [nudgedSide, setNudgedSide] = useState<'left' | 'right' | null>(null);
  const [promptFeedback, setPromptFeedback] = useState<string>('');

  const advanceTimerRef = useRef<number | null>(null);
  const nudgeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current);
      }
      if (nudgeTimerRef.current !== null) {
        window.clearTimeout(nudgeTimerRef.current);
      }
    };
  }, []);

  const currentRound = rounds[roundIdx] ?? rounds[0];

  const handleStartGame = () => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setRounds(buildShuffledRounds());
    setRoundIdx(0);
    setCelebratingSide(null);
    setNudgedSide(null);
    setPromptFeedback('');
    setPhase('PLAYING');
    playHappyMatchSound();
  };

  const handleChooseFriend = (side: 'left' | 'right', friend: FriendAnimal) => {
    if (phase !== 'PLAYING' || celebratingSide !== null) return;

    const isMatch =
      (currentRound.goal === 'taller' && friend.isTall) ||
      (currentRound.goal === 'shorter' && !friend.isTall);

    if (isMatch) {
      setCelebratingSide(side);
      setNudgedSide(null);
      setPromptFeedback(
        `Yay, ${childProfile.name}! The ${friend.name} (${friend.heightLabel}) is ${currentRound.goal}!`,
      );

      if (roundIdx + 1 >= rounds.length) {
        playVictoryFanfare();
        advanceTimerRef.current = window.setTimeout(() => {
          setCelebratingSide(null);
          setPhase('VICTORY');
        }, 1050);
      } else {
        playHappyMatchSound();
        advanceTimerRef.current = window.setTimeout(() => {
          setCelebratingSide(null);
          setPromptFeedback('');
          setRoundIdx((prev) => prev + 1);
        }, 1150);
      }
    } else {
      // Gentle encouraging hint — zero harsh feedback!
      playGentleBoopSound();
      setNudgedSide(side);
      setPromptFeedback(
        currentRound.goal === 'taller'
          ? `Aw, that's the cozy ${friend.name}! Look up high for the TALLER friend!`
          : `Haha, the ${friend.name} is super big! Look down low for the SHORTER friend!`,
      );
      if (nudgeTimerRef.current !== null) {
        window.clearTimeout(nudgeTimerRef.current);
      }
      nudgeTimerRef.current = window.setTimeout(() => {
        setNudgedSide(null);
      }, 650);
    }
  };

  const isTallerGoal = currentRound.goal === 'taller';

  return (
    <div className="bg-white rounded-3xl border-2 border-amber-200 shadow-sm overflow-hidden">
      {/* Header with Visual Height Cue */}
      <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-amber-50 via-emerald-50/60 to-sky-50 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900">
            Tall &amp; Short Animal Friends
          </h2>
          <p className="text-sm font-medium text-slate-600 mt-0.5">
            {phase === 'PLAYING'
              ? promptFeedback || `Look at both friends on the meadow ruler!`
              : 'Spot who is taller and who is shorter!'}
          </p>
        </div>

        {/* 5-Star Round Progress */}
        <div className="flex items-center gap-1.5" aria-label={`Round ${roundIdx + 1} of ${rounds.length}`}>
          {rounds.map((r, idx) => {
            const completed =
              phase === 'VICTORY' ||
              idx < roundIdx ||
              (idx === roundIdx && celebratingSide !== null);
            return (
              <Star
                key={r.id}
                className={`w-6 h-6 transition-transform ${
                  completed
                    ? 'text-amber-400 fill-amber-400 scale-110'
                    : 'text-slate-300 fill-slate-100'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Main Comparison Meadow Stage */}
      <div className="relative p-4 sm:p-6 bg-gradient-to-b from-sky-50 via-amber-50/40 to-emerald-50 min-h-[420px] flex flex-col justify-center">
        {/* Big Clear Question Banner */}
        {phase === 'PLAYING' && (
          <div className="mb-5 flex justify-center">
            <div
              className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl border-2 shadow-xs ${
                isTallerGoal
                  ? 'bg-emerald-600 border-emerald-700 text-white'
                  : 'bg-indigo-600 border-indigo-700 text-white'
              }`}
            >
              {isTallerGoal ? (
                <ArrowUp className="w-7 h-7 shrink-0 animate-bounce" />
              ) : (
                <ArrowDown className="w-7 h-7 shrink-0 animate-bounce" />
              )}
              <span className="text-xl sm:text-2xl font-display font-extrabold">
                Tap the {isTallerGoal ? 'TALLER' : 'SHORTER'} friend!
              </span>
            </div>
          </div>
        )}

        {/* Two Oversized Side-by-Side Animal Friend Cards */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto w-full">
          {(['left', 'right'] as const).map((side) => {
            const friend = side === 'left' ? currentRound.left : currentRound.right;
            const isCelebrating = celebratingSide === side;
            const isNudged = nudgedSide === side;

            return (
              <button
                key={`${currentRound.id}_${side}`}
                type="button"
                disabled={phase !== 'PLAYING'}
                onClick={() => handleChooseFriend(side, friend)}
                className={`group relative rounded-3xl border-4 p-3 sm:p-4 bg-white shadow-sm transition-all cursor-pointer flex flex-col items-center focus:outline-none ${
                  isCelebrating
                    ? 'border-emerald-500 ring-4 ring-emerald-200 -translate-y-2 shadow-lg'
                    : isNudged
                      ? 'border-amber-400 scale-[0.97]'
                      : 'border-amber-200 hover:border-emerald-400 hover:shadow-md active:scale-[0.98]'
                }`}
              >
                {/* Celebratory Star Badge */}
                {isCelebrating && (
                  <div className="absolute -top-3 -right-3 w-11 h-11 rounded-full bg-amber-400 text-white shadow-md flex items-center justify-center animate-bounce">
                    <Star className="w-6 h-6 fill-white" />
                  </div>
                )}

                {/* Shared Meadow Ruler Backdrop so Toddler Sees True Relative Height */}
                <svg
                  viewBox="0 0 260 280"
                  className="w-full h-auto max-h-[260px]"
                  aria-hidden="true"
                >
                  <rect x="0" y="0" width="260" height="260" rx="18" fill="#f0f9ff" />
                  {/* Subtle Height Guide Lines */}
                  {[50, 100, 150, 200].map((ly) => (
                    <line
                      key={ly}
                      x1="14"
                      y1={ly}
                      x2="246"
                      y2={ly}
                      stroke="#bae6fd"
                      strokeWidth="2"
                      strokeDasharray="6 6"
                    />
                  ))}
                  {/* Grass Baseline */}
                  <rect x="0" y="254" width="260" height="26" rx="12" fill="#4ade80" />
                  {/* Animal Illustration */}
                  {renderFullBodyAnimal(friend.species)}
                </svg>

                <div className="mt-3 text-center">
                  <div className="text-lg sm:text-xl font-display font-extrabold text-slate-900">
                    {friend.name}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-slate-500 tabular-nums">
                    {friend.heightLabel} tall
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Title Menu Overlay */}
        {phase === 'TITLE_MENU' && (
          <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border-4 border-amber-300 shadow-xl max-w-md w-full p-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                <ArrowUp className="w-9 h-9" />
              </div>
              <h3 className="text-2xl font-display font-extrabold text-slate-900">
                Tall &amp; Short Friends!
              </h3>
              <p className="text-sm text-slate-600 mt-2">
                Help {childProfile.name} compare friendly animals standing on the sunny meadow ruler — who is taller and who is shorter?
              </p>
              <button
                type="button"
                onClick={handleStartGame}
                className="mt-5 w-full min-h-[60px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-display font-extrabold text-lg shadow-md transition-all cursor-pointer whitespace-nowrap"
              >
                Let&apos;s Play!
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
                5 Golden Stars, {childProfile.name}!
              </h3>
              <p className="text-sm font-medium text-slate-600 mt-1.5">
                You are a Tall &amp; Short measuring superstar!
              </p>
              <div className="flex items-center justify-center gap-2 my-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="w-8 h-8 text-amber-400 fill-amber-400"
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={handleStartGame}
                className="w-full min-h-[58px] rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-display font-extrabold text-lg shadow-md transition-all inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
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
