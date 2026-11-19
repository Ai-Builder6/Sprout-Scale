import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, Sparkles, Star } from 'lucide-react';
import { ChildProfile } from '../../types';
import {
  playBubblePopSound,
  playGentleBoopSound,
  playHappyMatchSound,
  playVictoryFanfare,
} from '../../services/kidGameAudioService';

type GamePhase = 'TITLE_MENU' | 'PLAYING' | 'VICTORY';
type BubbleMode = 'free_pop' | 'find_friend';
type AnimalFriendId = 'duck' | 'bunny' | 'penguin' | 'frog' | 'fox' | 'owl';

interface AnimalDef {
  id: AnimalFriendId;
  label: string;
  colorName: string;
  bubbleStroke: string;
  bubbleFill: string;
  sparkleHex: string;
}

const ANIMAL_FRIENDS: AnimalDef[] = [
  {
    id: 'duck',
    label: 'Yellow Duck',
    colorName: 'Yellow',
    bubbleStroke: '#eab308',
    bubbleFill: 'rgba(254, 240, 138, 0.45)',
    sparkleHex: '#facc15',
  },
  {
    id: 'bunny',
    label: 'Pink Bunny',
    colorName: 'Pink',
    bubbleStroke: '#ec4899',
    bubbleFill: 'rgba(251, 207, 232, 0.48)',
    sparkleHex: '#f472b6',
  },
  {
    id: 'penguin',
    label: 'Blue Penguin',
    colorName: 'Blue',
    bubbleStroke: '#0ea5e9',
    bubbleFill: 'rgba(186, 230, 253, 0.48)',
    sparkleHex: '#38bdf8',
  },
  {
    id: 'frog',
    label: 'Green Frog',
    colorName: 'Green',
    bubbleStroke: '#22c55e',
    bubbleFill: 'rgba(187, 247, 208, 0.48)',
    sparkleHex: '#4ade80',
  },
  {
    id: 'fox',
    label: 'Orange Fox',
    colorName: 'Orange',
    bubbleStroke: '#f97316',
    bubbleFill: 'rgba(254, 215, 170, 0.5)',
    sparkleHex: '#fb923c',
  },
  {
    id: 'owl',
    label: 'Purple Owl',
    colorName: 'Purple',
    bubbleStroke: '#8b5cf6',
    bubbleFill: 'rgba(221, 214, 254, 0.5)',
    sparkleHex: '#a78bfa',
  },
];

interface FloatingBubble {
  id: number;
  animalId: AnimalFriendId;
  x: number;
  y: number;
  r: number;
  speedY: number;
  swayPhase: number;
  swayAmp: number;
}

interface PopStar {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

interface BubblePopAnimalGameProps {
  childProfile: ChildProfile;
}

/**
 * Crisp, joyful vector animal face rendered cleanly inside each soap bubble or prompt badge
 */
function renderAnimalFace(animalId: AnimalFriendId, scale = 1): React.ReactNode {
  switch (animalId) {
    case 'duck':
      return (
        <g transform={`scale(${scale})`}>
          <circle cx="0" cy="4" r="26" fill="#facc15" stroke="#ca8a04" strokeWidth="3" />
          <path d="M -5 -22 Q 0 -33 6 -21" fill="#facc15" stroke="#ca8a04" strokeWidth="3" strokeLinecap="round" />
          <circle cx="-9" cy="-2" r="3.8" fill="#1e293b" />
          <circle cx="9" cy="-2" r="3.8" fill="#1e293b" />
          <circle cx="-15" cy="7" r="4.5" fill="#fb7185" opacity="0.55" />
          <circle cx="15" cy="7" r="4.5" fill="#fb7185" opacity="0.55" />
          <ellipse cx="0" cy="9" rx="11" ry="6.5" fill="#f97316" stroke="#c2410c" strokeWidth="2" />
        </g>
      );
    case 'bunny':
      return (
        <g transform={`scale(${scale})`}>
          <ellipse cx="-12" cy="-26" rx="7" ry="18" fill="#f9a8d4" stroke="#db2777" strokeWidth="2.8" />
          <ellipse cx="12" cy="-26" rx="7" ry="18" fill="#f9a8d4" stroke="#db2777" strokeWidth="2.8" />
          <ellipse cx="-12" cy="-26" rx="3.2" ry="11" fill="#fdf2f8" />
          <ellipse cx="12" cy="-26" rx="3.2" ry="11" fill="#fdf2f8" />
          <circle cx="0" cy="6" r="24" fill="#fbcfe8" stroke="#db2777" strokeWidth="3" />
          <circle cx="-9" cy="2" r="3.5" fill="#1e293b" />
          <circle cx="9" cy="2" r="3.5" fill="#1e293b" />
          <ellipse cx="0" cy="10" rx="4.5" ry="3.2" fill="#ec4899" />
          <path d="M -6 15 Q 0 20 6 15" fill="none" stroke="#831843" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    case 'penguin':
      return (
        <g transform={`scale(${scale})`}>
          <circle cx="0" cy="4" r="26" fill="#0284c7" stroke="#075985" strokeWidth="3" />
          <path d="M -17 4 C -17 -12 -4 -12 0 -2 C 4 -12 17 -12 17 4 C 17 20 10 26 0 26 C -10 26 -17 20 -17 4 Z" fill="#ffffff" />
          <circle cx="-9" cy="0" r="3.5" fill="#0f172a" />
          <circle cx="9" cy="0" r="3.5" fill="#0f172a" />
          <polygon points="-7,7 7,7 0,16" fill="#f59e0b" stroke="#b45309" strokeWidth="2" />
        </g>
      );
    case 'frog':
      return (
        <g transform={`scale(${scale})`}>
          <circle cx="-14" cy="-16" r="10" fill="#4ade80" stroke="#15803d" strokeWidth="2.8" />
          <circle cx="14" cy="-16" r="10" fill="#4ade80" stroke="#15803d" strokeWidth="2.8" />
          <circle cx="-14" cy="-16" r="5" fill="#ffffff" />
          <circle cx="14" cy="-16" r="5" fill="#ffffff" />
          <circle cx="-14" cy="-16" r="2.7" fill="#0f172a" />
          <circle cx="14" cy="-16" r="2.7" fill="#0f172a" />
          <ellipse cx="0" cy="8" rx="26" ry="21" fill="#4ade80" stroke="#15803d" strokeWidth="3" />
          <circle cx="-14" cy="10" r="4.5" fill="#fb7185" opacity="0.55" />
          <circle cx="14" cy="10" r="4.5" fill="#fb7185" opacity="0.55" />
          <path d="M -12 11 Q 0 22 12 11" fill="none" stroke="#14532d" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'fox':
      return (
        <g transform={`scale(${scale})`}>
          <polygon points="-22,-6 -16,-30 -2,-14" fill="#f97316" stroke="#c2410c" strokeWidth="2.8" strokeLinejoin="round" />
          <polygon points="22,-6 16,-30 2,-14" fill="#f97316" stroke="#c2410c" strokeWidth="2.8" strokeLinejoin="round" />
          <ellipse cx="0" cy="6" rx="25" ry="22" fill="#fb923c" stroke="#c2410c" strokeWidth="3" />
          <path d="M -22 8 Q -10 26 0 24 Q 10 26 22 8 Q 10 14 0 8 Q -10 14 -22 8 Z" fill="#fff7ed" />
          <circle cx="-9" cy="1" r="3.6" fill="#1e293b" />
          <circle cx="9" cy="1" r="3.6" fill="#1e293b" />
          <circle cx="0" cy="10" r="4" fill="#1e293b" />
        </g>
      );
    case 'owl':
      return (
        <g transform={`scale(${scale})`}>
          <polygon points="-20,-14 -14,-28 -6,-18" fill="#8b5cf6" stroke="#5b21b6" strokeWidth="2.6" />
          <polygon points="20,-14 14,-28 6,-18" fill="#8b5cf6" stroke="#5b21b6" strokeWidth="2.6" />
          <circle cx="0" cy="4" r="25" fill="#a78bfa" stroke="#5b21b6" strokeWidth="3" />
          <circle cx="-10" cy="0" r="9.5" fill="#ffffff" stroke="#5b21b6" strokeWidth="2.2" />
          <circle cx="10" cy="0" r="9.5" fill="#ffffff" stroke="#5b21b6" strokeWidth="2.2" />
          <circle cx="-10" cy="0" r="4" fill="#1e293b" />
          <circle cx="10" cy="0" r="4" fill="#1e293b" />
          <polygon points="-5,8 5,8 0,16" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
        </g>
      );
  }
}

export const BubblePopAnimalGame: React.FC<BubblePopAnimalGameProps> = ({
  childProfile,
}) => {
  const [phase, setPhase] = useState<GamePhase>('TITLE_MENU');
  const [mode, setMode] = useState<BubbleMode>('free_pop');
  const [score, setScore] = useState<number>(0);
  const [targetAnimalId, setTargetAnimalId] = useState<AnimalFriendId>('duck');
  const [feedbackBanner, setFeedbackBanner] = useState<string>(
    'Tap any floating bubble to pop it!',
  );
  const [bubbles, setBubbles] = useState<FloatingBubble[]>([]);
  const [popStars, setPopStars] = useState<PopStar[]>([]);

  const bubblesRef = useRef<FloatingBubble[]>([]);
  const popStarsRef = useRef<PopStar[]>([]);
  const nextIdRef = useRef<number>(1);
  const targetAnimalRef = useRef<AnimalFriendId>('duck');
  const modeRef = useRef<BubbleMode>('free_pop');

  const goalCount = mode === 'free_pop' ? 8 : 5;

  const createBubble = (
    yOverride?: number,
    forcedAnimalId?: AnimalFriendId,
  ): FloatingBubble => {
    const chosenAnimal =
      forcedAnimalId ??
      ANIMAL_FRIENDS[Math.floor(Math.random() * ANIMAL_FRIENDS.length)].id;
    return {
      id: nextIdRef.current++,
      animalId: chosenAnimal,
      x: 95 + Math.random() * 610,
      y: yOverride ?? 520 + Math.random() * 90,
      r: 56 + Math.random() * 9,
      speedY: 36 + Math.random() * 24,
      swayPhase: Math.random() * Math.PI * 2,
      swayAmp: 16 + Math.random() * 14,
    };
  };

  const pickNextTarget = (exclude?: AnimalFriendId): AnimalFriendId => {
    const candidates = ANIMAL_FRIENDS.filter((a) => a.id !== exclude);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)].id;
    targetAnimalRef.current = chosen;
    setTargetAnimalId(chosen);
    return chosen;
  };

  const startNewGame = (selectedMode: BubbleMode) => {
    modeRef.current = selectedMode;
    setMode(selectedMode);
    setScore(0);
    popStarsRef.current = [];
    setPopStars([]);

    const firstTarget = pickNextTarget();
    // Spawn 6 well-spaced giant bubbles immediately so play starts right away!
    const initialBubbles: FloatingBubble[] = [
      createBubble(150, firstTarget),
      createBubble(250),
      createBubble(340),
      createBubble(430),
      createBubble(210),
      createBubble(390),
    ];
    // Spread X positions nicely so they don't overlap on start
    const lanes = [130, 260, 390, 520, 650, 200];
    initialBubbles.forEach((b, idx) => {
      b.x = lanes[idx];
    });

    bubblesRef.current = initialBubbles;
    setBubbles(initialBubbles);

    if (selectedMode === 'free_pop') {
      setFeedbackBanner(`Pop 8 happy animal bubbles, ${childProfile.name}!`);
    } else {
      const def = ANIMAL_FRIENDS.find((a) => a.id === firstTarget);
      setFeedbackBanner(`Can you pop the ${def?.label ?? 'Yellow Duck'}?`);
    }

    setPhase('PLAYING');
    playBubblePopSound(0);
  };

  // Smooth 60fps floating bubble loop (strictly active during PLAYING)
  useEffect(() => {
    if (phase !== 'PLAYING') return;

    let rafId = 0;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const updatedBubbles = bubblesRef.current.map((b) => {
        const nextY = b.y - b.speedY * dt;
        const nextPhase = b.swayPhase + dt * 1.4;
        if (nextY < -75) {
          // Respawn smoothly at the bottom; ensure target animal is always present in find_friend mode
          const hasTarget =
            modeRef.current !== 'find_friend' ||
            bubblesRef.current.some(
              (other) => other.id !== b.id && other.animalId === targetAnimalRef.current,
            );
          return createBubble(
            525 + Math.random() * 40,
            hasTarget ? undefined : targetAnimalRef.current,
          );
        }
        return {
          ...b,
          y: nextY,
          swayPhase: nextPhase,
        };
      });

      bubblesRef.current = updatedBubbles;
      setBubbles(updatedBubbles);

      if (popStarsRef.current.length > 0) {
        const updatedStars = popStarsRef.current
          .map((s) => ({
            ...s,
            x: s.x + s.vx * dt,
            y: s.y + s.vy * dt,
            vy: s.vy + 140 * dt,
            life: s.life - dt * 1.6,
          }))
          .filter((s) => s.life > 0);
        popStarsRef.current = updatedStars;
        setPopStars(updatedStars);
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [phase]);

  const spawnPopSparkles = (cx: number, cy: number, mainColor: string) => {
    const colors = [mainColor, '#fde047', '#ffffff', '#38bdf8', '#f472b6'];
    const burst: PopStar[] = [];
    for (let i = 0; i < 14; i += 1) {
      const angle = (Math.PI * 2 * i) / 14;
      const speed = 70 + Math.random() * 110;
      burst.push({
        id: nextIdRef.current++,
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        color: colors[i % colors.length],
        life: 1,
      });
    }
    popStarsRef.current = [...popStarsRef.current, ...burst];
    setPopStars(popStarsRef.current);
  };

  const handlePopBubble = (bubble: FloatingBubble) => {
    if (phase !== 'PLAYING') return;

    const animalDef =
      ANIMAL_FRIENDS.find((a) => a.id === bubble.animalId) ?? ANIMAL_FRIENDS[0];
    const renderX = bubble.x + Math.sin(bubble.swayPhase) * bubble.swayAmp;

    spawnPopSparkles(renderX, bubble.y, animalDef.sparkleHex);

    // Replace popped bubble with a fresh one drifting up from below
    const remaining = bubblesRef.current.filter((b) => b.id !== bubble.id);

    if (mode === 'free_pop') {
      const nextScore = score + 1;
      setScore(nextScore);
      const nextBubble = createBubble(535);
      bubblesRef.current = [...remaining, nextBubble];
      setBubbles(bubblesRef.current);

      if (nextScore >= goalCount) {
        playVictoryFanfare();
        setFeedbackBanner(`Pop-tastic, ${childProfile.name}! You popped all 8 bubbles!`);
        setPhase('VICTORY');
      } else {
        playBubblePopSound(nextScore);
        setFeedbackBanner(`Pop! That was the ${animalDef.label}!`);
      }
      return;
    }

    // Find the Friend mode (Age 3–4): zero harsh buzzers, always encouraging!
    if (bubble.animalId === targetAnimalId) {
      const nextScore = score + 1;
      setScore(nextScore);

      if (nextScore >= goalCount) {
        bubblesRef.current = remaining;
        setBubbles(remaining);
        playVictoryFanfare();
        setFeedbackBanner(`Amazing job, ${childProfile.name}! You found every animal friend!`);
        setPhase('VICTORY');
      } else {
        playHappyMatchSound();
        const nextTarget = pickNextTarget(targetAnimalId);
        const nextDef = ANIMAL_FRIENDS.find((a) => a.id === nextTarget);
        const ensureNext = remaining.some((b) => b.animalId === nextTarget)
          ? createBubble(535)
          : createBubble(465, nextTarget);
        bubblesRef.current = [...remaining, ensureNext];
        setBubbles(bubblesRef.current);
        setFeedbackBanner(`Yay! You found the ${animalDef.label}! Now pop the ${nextDef?.label}!`);
      }
    } else {
      // Gentle encouraging pop — no penalty!
      playGentleBoopSound();
      const hasTargetOnScreen = remaining.some((b) => b.animalId === targetAnimalId);
      const replacement = createBubble(
        525,
        hasTargetOnScreen ? undefined : targetAnimalId,
      );
      bubblesRef.current = [...remaining, replacement];
      setBubbles(bubblesRef.current);
      const targetDef = ANIMAL_FRIENDS.find((a) => a.id === targetAnimalId);
      setFeedbackBanner(
        `Giggle pop! That was the ${animalDef.label}. Look for the ${targetDef?.label}!`,
      );
    }
  };

  const currentTargetDef =
    ANIMAL_FRIENDS.find((a) => a.id === targetAnimalId) ?? ANIMAL_FRIENDS[0];

  return (
    <div className="bg-white rounded-3xl border-2 border-sky-200 shadow-sm overflow-hidden">
      {/* Header & Visual Prompt Bar */}
      <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-sky-50 via-pink-50/60 to-amber-50/70 border-b border-sky-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {phase === 'PLAYING' && mode === 'find_friend' && (
            <div className="w-14 h-14 rounded-2xl bg-white border-2 border-sky-200 shadow-xs flex items-center justify-center shrink-0">
              <svg viewBox="-36 -38 72 74" className="w-12 h-12" aria-hidden="true">
                {renderAnimalFace(targetAnimalId, 0.92)}
              </svg>
            </div>
          )}
          <div>
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900">
              {phase === 'PLAYING' && mode === 'find_friend'
                ? `Pop the ${currentTargetDef.label}!`
                : 'Peek-a-Boo Animal Bubbles'}
            </h2>
            <p className="text-sm font-medium text-slate-600 mt-0.5">{feedbackBanner}</p>
          </div>
        </div>

        {/* Golden Star Counter */}
        <div className="flex items-center gap-1.5" aria-label={`Progress: ${score} of ${goalCount} stars`}>
          {Array.from({ length: goalCount }).map((_, idx) => (
            <Star
              key={idx}
              className={`w-6 h-6 transition-transform ${
                idx < score
                  ? 'text-amber-400 fill-amber-400 scale-110'
                  : 'text-slate-300 fill-slate-100'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Interactive Bubble Meadow Playfield */}
      <div className="relative bg-sky-100 select-none touch-manipulation">
        <svg
          viewBox="0 0 800 480"
          className="w-full h-auto block max-h-[520px]"
          role="img"
          aria-label="Floating animal bubbles playfield"
        >
          <defs>
            <linearGradient id="bubbleSkyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#93c5fd" />
              <stop offset="55%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#dcfce7" />
            </linearGradient>
            <linearGradient id="bubbleGrassGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
          </defs>

          {/* Sky & Sunny Meadow */}
          <rect x="0" y="0" width="800" height="480" fill="url(#bubbleSkyGrad)" />
          <circle cx="715" cy="70" r="42" fill="#fde047" opacity="0.9" />
          <g fill="#ffffff" opacity="0.72">
            <ellipse cx="145" cy="84" rx="54" ry="24" />
            <ellipse cx="185" cy="76" rx="40" ry="26" />
            <ellipse cx="485" cy="64" rx="48" ry="20" />
          </g>
          <path
            d="M 0 412 Q 210 370 430 406 T 800 392 L 800 480 L 0 480 Z"
            fill="url(#bubbleGrassGrad)"
          />
          {/* Little Meadow Daisies */}
          {[95, 235, 380, 560, 710].map((dx, idx) => (
            <g key={dx} transform={`translate(${dx}, ${438 + (idx % 2) * 14})`}>
              <circle cx="0" cy="0" r="7" fill="#ffffff" />
              <circle cx="0" cy="0" r="3.5" fill="#facc15" />
            </g>
          ))}

          {/* Floating Interactive Giant Bubbles */}
          {bubbles.map((b) => {
            const def = ANIMAL_FRIENDS.find((a) => a.id === b.animalId) ?? ANIMAL_FRIENDS[0];
            const drawX = b.x + Math.sin(b.swayPhase) * b.swayAmp;
            return (
              <g
                key={b.id}
                transform={`translate(${drawX}, ${b.y})`}
                onClick={() => handlePopBubble(b)}
                className="cursor-pointer"
                role="button"
                aria-label={`Pop ${def.label} bubble`}
              >
                {/* Extra-generous invisible touch ring for toddlers */}
                <circle cx="0" cy="0" r={b.r + 12} fill="transparent" />
                {/* Glossy Soap Bubble Shell */}
                <circle
                  cx="0"
                  cy="0"
                  r={b.r}
                  fill={def.bubbleFill}
                  stroke={def.bubbleStroke}
                  strokeWidth="4"
                />
                {/* Animal Face Inside */}
                {renderAnimalFace(b.animalId, 0.98)}
                {/* Glossy Specular Highlight Arc */}
                <ellipse
                  cx={-b.r * 0.36}
                  cy={-b.r * 0.38}
                  rx={b.r * 0.22}
                  ry={b.r * 0.12}
                  transform={`rotate(-35 ${-b.r * 0.36} ${-b.r * 0.38})`}
                  fill="#ffffff"
                  opacity="0.82"
                />
                <circle
                  cx={b.r * 0.38}
                  cy={b.r * 0.34}
                  r={b.r * 0.08}
                  fill="#ffffff"
                  opacity="0.65"
                />
              </g>
            );
          })}

          {/* Pop Sparkle Particles */}
          {popStars.map((s) => (
            <circle
              key={s.id}
              cx={s.x}
              cy={s.y}
              r={8 * s.life}
              fill={s.color}
              opacity={Math.max(0, s.life)}
            />
          ))}
        </svg>

        {/* Title Menu Overlay */}
        {phase === 'TITLE_MENU' && (
          <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border-4 border-sky-300 shadow-xl max-w-md w-full p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <svg viewBox="-36 -38 72 74" className="w-12 h-12" aria-hidden="true">
                  {renderAnimalFace('duck', 0.9)}
                </svg>
                <svg viewBox="-36 -38 72 74" className="w-12 h-12" aria-hidden="true">
                  {renderAnimalFace('bunny', 0.9)}
                </svg>
                <svg viewBox="-36 -38 72 74" className="w-12 h-12" aria-hidden="true">
                  {renderAnimalFace('penguin', 0.9)}
                </svg>
              </div>
              <h3 className="text-2xl font-display font-extrabold text-slate-900">
                Animal Bubble Pop!
              </h3>
              <p className="text-sm text-slate-600 mt-1.5">
                Choose a game style for {childProfile.name}:
              </p>
              <div className="mt-5 grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => startNewGame('free_pop')}
                  className="w-full min-h-[60px] rounded-2xl bg-sky-500 hover:bg-sky-600 active:scale-[0.98] text-white font-display font-extrabold text-base sm:text-lg shadow-md transition-all cursor-pointer"
                >
                  Free Bubble Pop (Age 2+)
                </button>
                <button
                  type="button"
                  onClick={() => startNewGame('find_friend')}
                  className="w-full min-h-[60px] rounded-2xl bg-pink-500 hover:bg-pink-600 active:scale-[0.98] text-white font-display font-extrabold text-base sm:text-lg shadow-md transition-all cursor-pointer"
                >
                  Find the Animal Friend (Age 3–4)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Victory Parade Overlay */}
        {phase === 'VICTORY' && (
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border-4 border-amber-300 shadow-xl max-w-md w-full p-6 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-500 flex items-center justify-center mb-2">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-display font-extrabold text-slate-900">
                Hooray, {childProfile.name}!
              </h3>
              <p className="text-sm font-medium text-slate-600 mt-1">
                All the animal friends cheered for your bubble-popping stars!
              </p>
              <div className="flex items-center justify-center gap-1.5 my-4">
                {ANIMAL_FRIENDS.map((a) => (
                  <svg
                    key={a.id}
                    viewBox="-36 -38 72 74"
                    className="w-11 h-11"
                    aria-label={a.label}
                  >
                    {renderAnimalFace(a.id, 0.85)}
                  </svg>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => startNewGame(mode)}
                  className="min-h-[54px] rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-display font-extrabold text-base shadow-sm transition-all inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play Again
                </button>
                <button
                  type="button"
                  onClick={() =>
                    startNewGame(mode === 'free_pop' ? 'find_friend' : 'free_pop')
                  }
                  className="min-h-[54px] rounded-2xl bg-pink-500 hover:bg-pink-600 text-white font-display font-extrabold text-base shadow-sm transition-all cursor-pointer whitespace-nowrap"
                >
                  {mode === 'free_pop' ? 'Try Find Friend' : 'Try Free Pop'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
