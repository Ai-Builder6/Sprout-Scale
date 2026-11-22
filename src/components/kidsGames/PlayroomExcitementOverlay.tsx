import React, { useEffect, useRef, useState } from 'react';
import {
  KidGameExcitementEvent,
  onKidGameExcitement,
} from '../../services/kidGameAudioService';

interface PlayroomExcitementOverlayProps {
  childName: string;
  enabled: boolean;
}

interface BurstParticle {
  id: number;
  xPercent: number;
  yPercent: number;
  dx: number;
  dy: number;
  rot: number;
  scale: number;
  delayMs: number;
  color: string;
  shape: 'star' | 'heart' | 'diamond' | 'circle';
}

interface ActiveBurst {
  id: number;
  kind: KidGameExcitementEvent;
  cheerText: string;
  particles: BurstParticle[];
}

const BRIGHT_COLORS = [
  '#facc15', // sunny gold
  '#f43f5e', // coral rose
  '#38bdf8', // sky blue
  '#34d399', // meadow emerald
  '#a78bfa', // lilac violet
  '#fb923c', // warm tangerine
];

const CORRECT_CHEERS = [
  'Super Star!',
  'Yay!!',
  'Awesome!',
  'Way to Go!',
  'Woohoo!',
  'Great Job!',
  'You Did It!',
];

const VICTORY_CHEERS = [
  'SUPERSTAR',
  'HOORAY',
  'AMAZING JOB',
  'CHAMPION',
];

const SHAPES: BurstParticle['shape'][] = ['star', 'star', 'star', 'heart', 'diamond', 'circle'];

export const PlayroomExcitementOverlay: React.FC<PlayroomExcitementOverlayProps> = ({
  childName,
  enabled,
}) => {
  const [bursts, setBursts] = useState<ActiveBurst[]>([]);
  const nextIdRef = useRef(1);
  const lastCorrectAtRef = useRef(0);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    return onKidGameExcitement((kind) => {
      const now = Date.now();
      // Gentle throttle on rapid bubble taps so stars stay sparkling & smooth
      if (kind === 'correct' && now - lastCorrectAtRef.current < 240) {
        return;
      }
      if (kind === 'correct') {
        lastCorrectAtRef.current = now;
      }

      const burstId = nextIdRef.current++;
      const count = kind === 'victory' ? 32 : 14;
      const particles: BurstParticle[] = Array.from({ length: count }, (_, idx) => {
        const angle = (Math.PI * 2 * idx) / count + (Math.random() - 0.5) * 0.4;
        const spread = kind === 'victory' ? 140 + Math.random() * 170 : 75 + Math.random() * 115;
        return {
          id: idx,
          xPercent: kind === 'victory' ? 15 + Math.random() * 70 : 25 + Math.random() * 50,
          yPercent: kind === 'victory' ? 22 + Math.random() * 40 : 32 + Math.random() * 32,
          dx: Math.round(Math.cos(angle) * spread),
          dy: Math.round(Math.sin(angle) * spread - (kind === 'victory' ? 50 : 30)),
          rot: Math.round((Math.random() - 0.5) * 520),
          scale: kind === 'victory' ? 0.9 + Math.random() * 0.8 : 0.75 + Math.random() * 0.55,
          delayMs: Math.round(Math.random() * (kind === 'victory' ? 260 : 90)),
          color: BRIGHT_COLORS[idx % BRIGHT_COLORS.length],
          shape: SHAPES[idx % SHAPES.length],
        };
      });

      const firstName = childName.trim().split(' ')[0] || 'Sprout';
      const cheerText =
        kind === 'victory'
          ? `${VICTORY_CHEERS[burstId % VICTORY_CHEERS.length]}, ${firstName.toUpperCase()}!`
          : CORRECT_CHEERS[burstId % CORRECT_CHEERS.length];

      setBursts((prev) => [...prev.slice(-2), { id: burstId, kind, cheerText, particles }]);

      const ttl = kind === 'victory' ? 2100 : 1200;
      const timeoutId = window.setTimeout(() => {
        setBursts((prev) => prev.filter((b) => b.id !== burstId));
      }, ttl);
      timeoutsRef.current.push(timeoutId);
    });
  }, [childName, enabled]);

  if (!enabled || bursts.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-40 pointer-events-none overflow-hidden select-none"
    >
      {bursts.map((burst) => (
        <div key={burst.id} className="absolute inset-0">
          {/* Sparkling Star & Confetti Particles */}
          {burst.particles.map((p) => (
            <div
              key={`${burst.id}-${p.id}`}
              className="sprout-star-particle absolute"
              style={
                {
                  left: `${p.xPercent}%`,
                  top: `${p.yPercent}%`,
                  animationDelay: `${p.delayMs}ms`,
                  animationDuration: burst.kind === 'victory' ? '1.75s' : '1.05s',
                  '--dx': `${p.dx}px`,
                  '--dy': `${p.dy}px`,
                  '--rot': `${p.rot}deg`,
                  '--sc': String(p.scale),
                } as React.CSSProperties
              }
            >
              {p.shape === 'star' && (
                <svg width="28" height="28" viewBox="0 0 24 24" fill={p.color}>
                  <path d="M12 1.8l3.09 6.26 6.91 1-5 4.87 1.18 6.88L12 17.56l-6.18 3.25L7 13.93 2 9.06l6.91-1L12 1.8z" />
                </svg>
              )}
              {p.shape === 'heart' && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill={p.color}>
                  <path d="M12 21s-7-4.6-9.5-8.5C.6 9.4 2.2 5.2 6 4.5c2.2-.4 4.4.7 6 2.6 1.6-1.9 3.8-3 6-2.6 3.8.7 5.4 4.9 3.5 8C19 16.4 12 21 12 21z" />
                </svg>
              )}
              {p.shape === 'diamond' && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill={p.color}>
                  <path d="M12 2l8 10-8 10-8-10L12 2z" />
                </svg>
              )}
              {p.shape === 'circle' && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill={p.color}>
                  <circle cx="12" cy="12" r="9" />
                </svg>
              )}
            </div>
          ))}

          {/* Joyful Floating Cheer Word */}
          <div
            className="sprout-cheer-pop absolute left-1/2 -translate-x-1/2"
            style={{
              top: burst.kind === 'victory' ? '18%' : '22%',
              animationDuration: burst.kind === 'victory' ? '1.9s' : '1.05s',
            }}
          >
            <div
              className={`rounded-3xl border-4 shadow-lg font-display font-extrabold tracking-tight text-center whitespace-nowrap ${
                burst.kind === 'victory'
                  ? 'px-7 py-3.5 text-2xl sm:text-4xl bg-amber-400 border-white text-indigo-950'
                  : 'px-5 py-2 text-lg sm:text-2xl bg-emerald-500 border-white text-white'
              }`}
            >
              {burst.cheerText}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
