import React, { useEffect, useRef, useState } from 'react';
import { CloudRain, Droplets, RotateCcw, Sparkles, Sun } from 'lucide-react';
import { ChildProfile, cmToInches, formatFeetInches } from '../../types';
import {
  playSproutGrowSound,
  playVictoryFanfare,
} from '../../services/kidGameAudioService';

type GamePhase = 'TITLE_MENU' | 'PLAYING' | 'VICTORY';
type HelperKind = 'water' | 'sun' | 'cloud';

interface BurstParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
}

interface SunflowerSproutGameProps {
  childProfile: ChildProfile;
  childHeightCm: number;
}

const TOTAL_GROW_STEPS = 8;
const MAX_GARDEN_INCHES = 60; // 5' 0" giant sunflower!

const STEP_MESSAGES: string[] = [
  'Tap the Water, Sun, or Cloud to help the seed wake up!',
  'Ooh! A tiny green sprout popped out!',
  'Growing taller! Give it more sunshine or water!',
  'Look at those leafy arms stretching up!',
  'Halfway there! What a happy garden!',
  'A little golden flower bud is peeking out!',
  'Almost as tall as a giant sunflower!',
  'One more big tap to make it BLOOM!',
  'HOORAY! You grew a giant smiling sunflower!',
];

export const SunflowerSproutGame: React.FC<SunflowerSproutGameProps> = ({
  childProfile,
  childHeightCm,
}) => {
  const [phase, setPhase] = useState<GamePhase>('TITLE_MENU');
  const [growthStep, setGrowthStep] = useState<number>(0);
  const [displayProgress, setDisplayProgress] = useState<number>(0);
  const [activeHelperFlash, setActiveHelperFlash] = useState<HelperKind | null>(null);
  const [bobPhase, setBobPhase] = useState<number>(0);
  const [particles, setParticles] = useState<BurstParticle[]>([]);

  const targetProgressRef = useRef<number>(0);
  const particlesRef = useRef<BurstParticle[]>([]);
  const nextParticleIdRef = useRef<number>(1);
  const flashTimeoutRef = useRef<number | null>(null);

  const childHeightInches = Math.min(
    MAX_GARDEN_INCHES - 3,
    Math.max(12, cmToInches(childHeightCm || 96)),
  );
  const childHeightFormatted = formatFeetInches(childHeightCm || 96);

  // Smooth animation loop for bobbing sky helpers, stretching stem, and sparkle bursts
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      setBobPhase((prev) => (prev + dt * 2.1) % (Math.PI * 2));

      setDisplayProgress((prev) => {
        const target = targetProgressRef.current;
        const diff = target - prev;
        if (Math.abs(diff) < 0.002) return target;
        return prev + diff * Math.min(1, dt * 6.5);
      });

      if (particlesRef.current.length > 0) {
        const updated = particlesRef.current
          .map((p) => ({
            ...p,
            x: p.x + p.vx * dt,
            y: p.y + p.vy * dt,
            vy: p.vy + 210 * dt,
            life: p.life - dt * 1.35,
          }))
          .filter((p) => p.life > 0);
        particlesRef.current = updated;
        setParticles(updated);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      if (flashTimeoutRef.current !== null) {
        window.clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  const spawnBurst = (cx: number, cy: number, colors: string[], count = 14) => {
    const created: BurstParticle[] = [];
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 75 + Math.random() * 130;
      created.push({
        id: nextParticleIdRef.current++,
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 65,
        color: colors[i % colors.length],
        size: 6 + Math.random() * 6,
        life: 1,
      });
    }
    particlesRef.current = [...particlesRef.current, ...created];
    setParticles(particlesRef.current);
  };

  const handleStartGame = () => {
    setGrowthStep(0);
    targetProgressRef.current = 0;
    setDisplayProgress(0);
    particlesRef.current = [];
    setParticles([]);
    setActiveHelperFlash(null);
    setPhase('PLAYING');
    playSproutGrowSound(0);
  };

  const handleHelperTap = (kind: HelperKind, originX: number, originY: number) => {
    if (phase !== 'PLAYING') return;

    setActiveHelperFlash(kind);
    if (flashTimeoutRef.current !== null) {
      window.clearTimeout(flashTimeoutRef.current);
    }
    flashTimeoutRef.current = window.setTimeout(() => {
      setActiveHelperFlash(null);
    }, 520);

    const nextStep = Math.min(TOTAL_GROW_STEPS, growthStep + 1);
    setGrowthStep(nextStep);
    targetProgressRef.current = nextStep / TOTAL_GROW_STEPS;

    const palette =
      kind === 'water'
        ? ['#38bdf8', '#0ea5e9', '#bae6fd', '#fde047']
        : kind === 'sun'
          ? ['#facc15', '#fb923c', '#fde047', '#ffffff']
          : ['#60a5fa', '#a78bfa', '#34d399', '#fde047'];

    spawnBurst(originX, originY, palette, 14);
    spawnBurst(440, 425 - (nextStep / TOTAL_GROW_STEPS) * 285, ['#4ade80', '#facc15', '#38bdf8'], 10);

    if (nextStep >= TOTAL_GROW_STEPS) {
      playVictoryFanfare();
      spawnBurst(440, 145, ['#facc15', '#f43f5e', '#38bdf8', '#4ade80', '#a855f7'], 28);
      setPhase('VICTORY');
    } else {
      playSproutGrowSound(nextStep);
    }
  };

  // Garden Ruler geometry inside viewBox="0 0 800 500"
  const groundY = 435;
  const topRulerY = 85; // 60 inches (5' 0")
  const rulerSpanPx = groundY - topRulerY; // 350px
  const inchesToY = (inches: number) => groundY - (inches / MAX_GARDEN_INCHES) * rulerSpanPx;

  const currentFlowerInches = Math.round(6 + displayProgress * (MAX_GARDEN_INCHES - 6));
  const currentFlowerFeet = Math.floor(currentFlowerInches / 12);
  const currentFlowerRemIn = currentFlowerInches % 12;
  const stemTopY = inchesToY(6 + displayProgress * (MAX_GARDEN_INCHES - 6));
  const childMarkerY = inchesToY(childHeightInches);
  const passedChildHeight = currentFlowerInches >= Math.round(childHeightInches);

  const sunBobY = Math.sin(bobPhase) * 8;
  const cloudBobY = Math.sin(bobPhase + 2.1) * 7;
  const canBobY = Math.sin(bobPhase + 4.1) * 8;

  const flowerCenterX = 445;
  const isBloomed = growthStep >= TOTAL_GROW_STEPS;
  const showBud = displayProgress >= 0.48;

  return (
    <div className="bg-white rounded-3xl border-2 border-emerald-200 shadow-sm overflow-hidden">
      {/* Compact Game Header */}
      <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-emerald-50 via-amber-50/70 to-sky-50 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900">
            Grow a Giant Sunflower
          </h2>
          <p className="text-sm font-medium text-slate-600 mt-0.5">
            {phase === 'TITLE_MENU'
              ? `Help ${childProfile.name}’s seed grow taller than ${childHeightFormatted}!`
              : STEP_MESSAGES[growthStep]}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm font-bold text-emerald-800">
          <span className="tabular-nums">
            Height: {currentFlowerFeet}&apos; {currentFlowerRemIn}&quot; ({currentFlowerInches} in)
          </span>
          <span className="text-slate-300">·</span>
          <span className="tabular-nums">
            {growthStep} / {TOTAL_GROW_STEPS} Taps
          </span>
        </div>
      </div>

      {/* Interactive SVG Garden Stage */}
      <div className="relative bg-sky-100 select-none touch-manipulation">
        <svg
          viewBox="0 0 800 500"
          className="w-full h-auto block max-h-[540px]"
          role="img"
          aria-label="Interactive sunflower garden game"
        >
          <defs>
            <linearGradient id="gardenSkyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bae6fd" />
              <stop offset="68%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#fef9c3" />
            </linearGradient>
            <linearGradient id="meadowHillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
            <linearGradient id="woodRulerGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="45%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>

          {/* Sunny Sky */}
          <rect x="0" y="0" width="800" height="500" fill="url(#gardenSkyGrad)" />

          {/* Soft Decorative Background Clouds */}
          <g opacity="0.72" fill="#ffffff">
            <ellipse cx="145" cy="78" rx="46" ry="22" />
            <ellipse cx="176" cy="72" rx="36" ry="24" />
            <ellipse cx="675" cy="96" rx="52" ry="22" />
            <ellipse cx="712" cy="90" rx="34" ry="22" />
          </g>

          {/* Rolling Sunny Hills */}
          <path
            d="M 0 395 Q 200 340 420 385 T 800 375 L 800 500 L 0 500 Z"
            fill="#bbf7d0"
          />
          <path
            d="M 0 430 Q 260 402 520 425 T 800 415 L 800 500 L 0 500 Z"
            fill="url(#meadowHillGrad)"
          />

          {/* Wooden Imperial Height Ruler on the Left */}
          <g>
            <rect
              x="54"
              y="66"
              width="66"
              height="384"
              rx="14"
              fill="url(#woodRulerGrad)"
              stroke="#78350f"
              strokeWidth="4"
            />
            {[12, 24, 36, 48, 60].map((inchMark) => {
              const y = inchesToY(inchMark);
              const ft = inchMark / 12;
              return (
                <g key={inchMark}>
                  <line
                    x1="58"
                    y1={y}
                    x2="86"
                    y2={y}
                    stroke="#78350f"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <text
                    x="94"
                    y={y + 6}
                    fontSize="17"
                    fontWeight="800"
                    fill="#451a03"
                  >
                    {ft}&apos;
                  </text>
                </g>
              );
            })}
            {[6, 18, 30, 42, 54].map((halfFt) => {
              const y = inchesToY(halfFt);
              return (
                <line
                  key={halfFt}
                  x1="58"
                  y1={y}
                  x2="74"
                  y2={y}
                  stroke="#92400e"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              );
            })}

            {/* Child's Own Height Star Marker on the Garden Ruler */}
            <g>
              <line
                x1="120"
                y1={childMarkerY}
                x2="385"
                y2={childMarkerY}
                stroke={passedChildHeight ? '#16a34a' : '#f97316'}
                strokeWidth="3"
                strokeDasharray="8 7"
                opacity="0.7"
              />
              <rect
                x="126"
                y={childMarkerY - 17}
                width="142"
                height="34"
                rx="17"
                fill={passedChildHeight ? '#16a34a' : '#f97316'}
                stroke="#ffffff"
                strokeWidth="3"
              />
              <text
                x="197"
                y={childMarkerY + 5}
                textAnchor="middle"
                fontSize="13.5"
                fontWeight="800"
                fill="#ffffff"
              >
                {childProfile.name}: {childHeightFormatted}
              </text>
            </g>
          </g>

          {/* Cozy Soil Mound */}
          <ellipse cx={flowerCenterX} cy={groundY + 12} rx="84" ry="26" fill="#78350f" />
          <ellipse cx={flowerCenterX} cy={groundY + 8} rx="70" ry="18" fill="#92400e" />

          {/* Growing Sunflower Stem & Leaves */}
          <g>
            {/* Main Green Stem */}
            <path
              d={`M ${flowerCenterX} ${groundY + 4} Q ${flowerCenterX - 10} ${(groundY + stemTopY) / 2} ${flowerCenterX} ${stemTopY}`}
              fill="none"
              stroke="#15803d"
              strokeWidth={12 + displayProgress * 8}
              strokeLinecap="round"
            />
            <path
              d={`M ${flowerCenterX - 2} ${groundY + 4} Q ${flowerCenterX - 12} ${(groundY + stemTopY) / 2} ${flowerCenterX - 2} ${stemTopY}`}
              fill="none"
              stroke="#4ade80"
              strokeWidth={4 + displayProgress * 3}
              strokeLinecap="round"
            />

            {/* Lower Pair of Leaves (visible after tap 1) */}
            {displayProgress > 0.08 && (
              <g>
                <path
                  d={`M ${flowerCenterX - 4} ${groundY - 45 * Math.min(1, displayProgress * 3)} Q ${flowerCenterX - 66} ${groundY - 78 * Math.min(1, displayProgress * 3)} ${flowerCenterX - 88} ${groundY - 38 * Math.min(1, displayProgress * 3)} Q ${flowerCenterX - 48} ${groundY - 12 * Math.min(1, displayProgress * 3)} ${flowerCenterX - 4} ${groundY - 40 * Math.min(1, displayProgress * 3)} Z`}
                  fill="#22c55e"
                  stroke="#15803d"
                  strokeWidth="3"
                />
                <path
                  d={`M ${flowerCenterX + 4} ${groundY - 58 * Math.min(1, displayProgress * 3)} Q ${flowerCenterX + 68} ${groundY - 94 * Math.min(1, displayProgress * 3)} ${flowerCenterX + 92} ${groundY - 50 * Math.min(1, displayProgress * 3)} Q ${flowerCenterX + 48} ${groundY - 22 * Math.min(1, displayProgress * 3)} ${flowerCenterX + 4} ${groundY - 52 * Math.min(1, displayProgress * 3)} Z`}
                  fill="#4ade80"
                  stroke="#15803d"
                  strokeWidth="3"
                />
              </g>
            )}

            {/* Upper Pair of Leaves (visible halfway) */}
            {displayProgress > 0.36 && (
              <g>
                <path
                  d={`M ${flowerCenterX - 5} ${stemTopY + 95} Q ${flowerCenterX - 74} ${stemTopY + 62} ${flowerCenterX - 96} ${stemTopY + 102} Q ${flowerCenterX - 52} ${stemTopY + 125} ${flowerCenterX - 5} ${stemTopY + 102} Z`}
                  fill="#4ade80"
                  stroke="#15803d"
                  strokeWidth="3"
                />
                <path
                  d={`M ${flowerCenterX + 5} ${stemTopY + 70} Q ${flowerCenterX + 76} ${stemTopY + 34} ${flowerCenterX + 96} ${stemTopY + 74} Q ${flowerCenterX + 50} ${stemTopY + 100} ${flowerCenterX + 5} ${stemTopY + 76} Z`}
                  fill="#22c55e"
                  stroke="#15803d"
                  strokeWidth="3"
                />
                {/* Cute Friendly Ladybug resting on leaf */}
                <g transform={`translate(${flowerCenterX - 56}, ${stemTopY + 90})`}>
                  <ellipse cx="0" cy="0" rx="13" ry="10" fill="#ef4444" stroke="#7f1d1d" strokeWidth="2.5" />
                  <circle cx="11" cy="-2" r="5.5" fill="#1e293b" />
                  <circle cx="-4" cy="-3" r="2.2" fill="#1e293b" />
                  <circle cx="3" cy="2" r="2.2" fill="#1e293b" />
                  <circle cx="-5" cy="4" r="2" fill="#1e293b" />
                </g>
              </g>
            )}

            {/* Seed Sprout Tip -> Bud -> Giant Smiling Sunflower Bloom! */}
            {!showBud && (
              <g transform={`translate(${flowerCenterX}, ${stemTopY})`}>
                <ellipse cx="-14" cy="-8" rx="16" ry="9" transform="rotate(-28 -14 -8)" fill="#4ade80" stroke="#15803d" strokeWidth="3" />
                <ellipse cx="14" cy="-8" rx="16" ry="9" transform="rotate(28 14 -8)" fill="#22c55e" stroke="#15803d" strokeWidth="3" />
              </g>
            )}

            {showBud && !isBloomed && (
              <g transform={`translate(${flowerCenterX}, ${stemTopY})`}>
                <circle cx="0" cy="-6" r={22 + displayProgress * 14} fill="#facc15" stroke="#ca8a04" strokeWidth="3.5" />
                <circle cx="0" cy="-6" r={15 + displayProgress * 8} fill="#78350f" />
                <circle cx="-6" cy="-8" r="2.6" fill="#fef9c3" />
                <circle cx="6" cy="-8" r="2.6" fill="#fef9c3" />
                <path d="M -6 0 Q 0 6 6 0" fill="none" stroke="#fef9c3" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            )}

            {isBloomed && (
              <g transform={`translate(${flowerCenterX}, ${stemTopY + 12})`}>
                {/* 16 Radiant Golden Petals */}
                {Array.from({ length: 16 }).map((_, i) => {
                  const angle = i * 22.5;
                  return (
                    <ellipse
                      key={i}
                      cx="0"
                      cy="-68"
                      rx="16"
                      ry="34"
                      fill={i % 2 === 0 ? '#facc15' : '#fbbf24'}
                      stroke="#d97706"
                      strokeWidth="2.5"
                      transform={`rotate(${angle})`}
                    />
                  );
                })}
                {/* Warm Smiling Center Face */}
                <circle cx="0" cy="0" r="46" fill="#78350f" stroke="#451a03" strokeWidth="4" />
                <circle cx="-15" cy="-8" r="5.5" fill="#ffffff" />
                <circle cx="-14" cy="-8" r="3" fill="#1e293b" />
                <circle cx="15" cy="-8" r="5.5" fill="#ffffff" />
                <circle cx="16" cy="-8" r="3" fill="#1e293b" />
                <circle cx="-24" cy="5" r="7" fill="#fb7185" opacity="0.6" />
                <circle cx="24" cy="5" r="7" fill="#fb7185" opacity="0.6" />
                <path
                  d="M -16 7 Q 0 24 16 7"
                  fill="none"
                  stroke="#fef08a"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
              </g>
            )}
          </g>

          {/* Interactive Sky & Garden Helpers (Oversized Touch Hitboxes) */}
          {phase === 'PLAYING' && (
            <>
              {/* 1. Giant Smiling Sunbeam (Top Right) */}
              <g
                transform={`translate(665, ${120 + sunBobY}) scale(${activeHelperFlash === 'sun' ? 1.16 : 1})`}
                onClick={() => handleHelperTap('sun', 665, 120)}
                className="cursor-pointer"
                role="button"
                aria-label="Tap the Sun to shine on the sunflower"
              >
                <circle cx="0" cy="0" r="68" fill="transparent" />
                {Array.from({ length: 10 }).map((_, idx) => (
                  <line
                    key={idx}
                    x1="0"
                    y1="-48"
                    x2="0"
                    y2="-63"
                    stroke="#f59e0b"
                    strokeWidth="6"
                    strokeLinecap="round"
                    transform={`rotate(${idx * 36})`}
                  />
                ))}
                <circle cx="0" cy="0" r="41" fill="#fde047" stroke="#f59e0b" strokeWidth="4" />
                <circle cx="-12" cy="-5" r="4" fill="#78350f" />
                <circle cx="12" cy="-5" r="4" fill="#78350f" />
                <path d="M -11 8 Q 0 18 11 8" fill="none" stroke="#78350f" strokeWidth="3.5" strokeLinecap="round" />
                <text x="0" y="66" textAnchor="middle" fontSize="14" fontWeight="800" fill="#92400e">
                  SUNSHINE!
                </text>
              </g>

              {/* 2. Giant Blue Watering Can (Left-Center) */}
              <g
                transform={`translate(245, ${185 + canBobY}) scale(${activeHelperFlash === 'water' ? 1.15 : 1})`}
                onClick={() => handleHelperTap('water', 245, 185)}
                className="cursor-pointer"
                role="button"
                aria-label="Tap the Watering Can to water the sunflower"
              >
                <circle cx="0" cy="0" r="70" fill="transparent" />
                {/* Handle */}
                <path
                  d="M -32 -14 C -56 -22 -56 24 -28 24"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Spout */}
                <path
                  d="M 24 8 L 58 -16 L 64 -4 L 26 24 Z"
                  fill="#38bdf8"
                  stroke="#0369a1"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                />
                <ellipse cx="62" cy="-10" rx="8" ry="12" transform="rotate(-35 62 -10)" fill="#bae6fd" stroke="#0369a1" strokeWidth="3" />
                {/* Body */}
                <rect x="-32" y="-26" width="60" height="54" rx="14" fill="#38bdf8" stroke="#0369a1" strokeWidth="4" />
                <circle cx="-12" cy="-2" r="3.8" fill="#0c4a6e" />
                <circle cx="10" cy="-2" r="3.8" fill="#0c4a6e" />
                <path d="M -9 10 Q -1 18 7 10" fill="none" stroke="#0c4a6e" strokeWidth="3" strokeLinecap="round" />
                <text x="0" y="54" textAnchor="middle" fontSize="14" fontWeight="800" fill="#0369a1">
                  WATER!
                </text>
              </g>

              {/* 3. Happy Rain Cloud (Right-Center) */}
              <g
                transform={`translate(665, ${295 + cloudBobY}) scale(${activeHelperFlash === 'cloud' ? 1.15 : 1})`}
                onClick={() => handleHelperTap('cloud', 665, 295)}
                className="cursor-pointer"
                role="button"
                aria-label="Tap the Happy Rain Cloud to sprinkle raindrops"
              >
                <circle cx="0" cy="0" r="68" fill="transparent" />
                <path
                  d="M -42 14 C -58 14 -60 -12 -38 -16 C -34 -38 2 -42 16 -22 C 36 -30 58 -12 52 10 C 52 20 42 22 30 22 L -34 22 C -40 22 -42 18 -42 14 Z"
                  fill="#ffffff"
                  stroke="#60a5fa"
                  strokeWidth="4"
                />
                <circle cx="-14" cy="-2" r="3.8" fill="#1e3a8a" />
                <circle cx="12" cy="-2" r="3.8" fill="#1e3a8a" />
                <path d="M -10 8 Q -1 16 8 8" fill="none" stroke="#1e3a8a" strokeWidth="3" strokeLinecap="round" />
                {/* Three Little Raindrops */}
                <path d="M -22 30 Q -26 42 -22 44 Q -18 42 -22 30 Z" fill="#38bdf8" />
                <path d="M 0 34 Q -4 46 0 48 Q 4 46 0 34 Z" fill="#0ea5e9" />
                <path d="M 22 30 Q 18 42 22 44 Q 26 42 22 30 Z" fill="#38bdf8" />
                <text x="0" y="66" textAnchor="middle" fontSize="14" fontWeight="800" fill="#1d4ed8">
                  RAIN CLOUD!
                </text>
              </g>
            </>
          )}

          {/* Sparkle & Droplet Burst Particles */}
          {particles.map((p) => (
            <circle
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={p.size * p.life}
              fill={p.color}
              opacity={Math.max(0, p.life)}
            />
          ))}
        </svg>

        {/* Title Menu Overlay */}
        {phase === 'TITLE_MENU' && (
          <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border-4 border-amber-300 shadow-xl max-w-md w-full p-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
                <Sun className="w-9 h-9" />
              </div>
              <h3 className="text-2xl font-display font-extrabold text-slate-900">
                Grow a Giant Sunflower!
              </h3>
              <p className="text-sm text-slate-600 mt-2">
                Tap the Watering Can, Sunshine, or Rain Cloud to help the flower grow taller than{' '}
                <span className="font-bold text-emerald-700">
                  {childProfile.name} ({childHeightFormatted})
                </span>
                !
              </p>
              <button
                type="button"
                onClick={handleStartGame}
                className="mt-5 w-full min-h-[60px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-display font-extrabold text-lg shadow-md transition-all cursor-pointer whitespace-nowrap"
              >
                Start Growing!
              </button>
            </div>
          </div>
        )}

        {/* Victory Overlay */}
        {phase === 'VICTORY' && (
          <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-4">
            <div className="bg-white/95 rounded-3xl border-4 border-amber-300 shadow-xl max-w-md w-full p-6 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-500 flex items-center justify-center mb-2">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-display font-extrabold text-slate-900">
                Yay, {childProfile.name}!
              </h3>
              <p className="text-sm font-medium text-slate-600 mt-1.5">
                Your smiling sunflower grew all the way to <span className="font-bold text-emerald-700">5&apos; 0&quot; (60 in)</span> — even taller than {childHeightFormatted}!
              </p>
              <button
                type="button"
                onClick={handleStartGame}
                className="mt-4 w-full min-h-[58px] rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-display font-extrabold text-lg shadow-md transition-all inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-5 h-5" />
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Big Toddler-Friendly Tactile Bottom Controls (Easy for Ages 2–4 on Phone/Tablet) */}
      <div className="p-4 sm:p-5 bg-emerald-50/70 border-t border-emerald-100">
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            disabled={phase !== 'PLAYING'}
            onClick={() => handleHelperTap('water', 245, 185)}
            className="min-h-[68px] rounded-2xl bg-sky-500 hover:bg-sky-600 active:scale-95 disabled:opacity-50 text-white font-display font-extrabold text-base sm:text-lg shadow-sm transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
          >
            <Droplets className="w-6 h-6 shrink-0" />
            <span>Water!</span>
          </button>
          <button
            type="button"
            disabled={phase !== 'PLAYING'}
            onClick={() => handleHelperTap('sun', 665, 120)}
            className="min-h-[68px] rounded-2xl bg-amber-400 hover:bg-amber-500 active:scale-95 disabled:opacity-50 text-amber-950 font-display font-extrabold text-base sm:text-lg shadow-sm transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
          >
            <Sun className="w-6 h-6 shrink-0" />
            <span>Sun!</span>
          </button>
          <button
            type="button"
            disabled={phase !== 'PLAYING'}
            onClick={() => handleHelperTap('cloud', 665, 295)}
            className="min-h-[68px] rounded-2xl bg-indigo-500 hover:bg-indigo-600 active:scale-95 disabled:opacity-50 text-white font-display font-extrabold text-base sm:text-lg shadow-sm transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
          >
            <CloudRain className="w-6 h-6 shrink-0" />
            <span>Cloud!</span>
          </button>
        </div>
      </div>
    </div>
  );
};
