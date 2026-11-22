import React, { useState } from 'react';
import { Rocket, RotateCcw, Star } from 'lucide-react';
import {
  playGentleBoopSound,
  playHappyMatchSound,
  playVictoryFanfare,
} from '../../services/kidGameAudioService';

interface ShapeRocketBuilderGameProps {
  childName: string;
}

type ShapeKind = 'circle' | 'triangle' | 'square' | 'star' | 'diamond';
type RocketMode = 'match_shape' | 'finish_pattern';

interface ShapeDef {
  id: ShapeKind;
  label: string;
  fill: string;
  stroke: string;
}

const SHAPES: Record<ShapeKind, ShapeDef> = {
  circle: { id: 'circle', label: 'Circle', fill: '#38bdf8', stroke: '#0369a1' },
  triangle: { id: 'triangle', label: 'Triangle', fill: '#fb7185', stroke: '#be123c' },
  square: { id: 'square', label: 'Square', fill: '#34d399', stroke: '#047857' },
  star: { id: 'star', label: 'Star', fill: '#facc15', stroke: '#b45309' },
  diamond: { id: 'diamond', label: 'Diamond', fill: '#a78bfa', stroke: '#5b21b6' },
};

const ALL_SHAPE_KEYS: ShapeKind[] = ['circle', 'triangle', 'square', 'star', 'diamond'];

const PATTERN_ROUNDS: { sequence: ShapeKind[]; answer: ShapeKind; partName: string }[] = [
  { sequence: ['circle', 'star', 'circle'], answer: 'star', partName: 'Rocket Nose Cone' },
  { sequence: ['triangle', 'square', 'triangle'], answer: 'square', partName: 'Rocket Window' },
  { sequence: ['diamond', 'circle', 'diamond'], answer: 'circle', partName: 'Left Rocket Fin' },
  { sequence: ['star', 'triangle', 'star'], answer: 'triangle', partName: 'Right Rocket Fin' },
  { sequence: ['square', 'diamond', 'square'], answer: 'diamond', partName: 'Turbo Booster' },
];

const ShapeGlyphSvg: React.FC<{ shape: ShapeKind; sizeClass?: string }> = ({
  shape,
  sizeClass = 'w-12 h-12',
}) => {
  const def = SHAPES[shape];
  return (
    <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
      {shape === 'circle' && (
        <circle cx="32" cy="32" r="22" fill={def.fill} stroke={def.stroke} strokeWidth="4" />
      )}
      {shape === 'triangle' && (
        <polygon points="32,8 56,54 8,54" fill={def.fill} stroke={def.stroke} strokeWidth="4" strokeLinejoin="round" />
      )}
      {shape === 'square' && (
        <rect x="12" y="12" width="40" height="40" rx="6" fill={def.fill} stroke={def.stroke} strokeWidth="4" />
      )}
      {shape === 'star' && (
        <polygon
          points="32,6 39,23 58,24 43,36 48,55 32,44 16,55 21,36 6,24 25,23"
          fill={def.fill}
          stroke={def.stroke}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
      )}
      {shape === 'diamond' && (
        <polygon points="32,6 56,32 32,58 8,32" fill={def.fill} stroke={def.stroke} strokeWidth="4" strokeLinejoin="round" />
      )}
    </svg>
  );
};

export const ShapeRocketBuilderGame: React.FC<ShapeRocketBuilderGameProps> = ({
  childName,
}) => {
  const [mode, setMode] = useState<RocketMode>('finish_pattern');
  const [partsBuilt, setPartsBuilt] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>(
    'Snap 5 shapes onto your rocket to blast off!',
  );
  const [wiggleShape, setWiggleShape] = useState<ShapeKind | null>(null);

  const isLaunched = partsBuilt >= PATTERN_ROUNDS.length;
  const currentRound = PATTERN_ROUNDS[Math.min(partsBuilt, PATTERN_ROUNDS.length - 1)];

  const handleRestart = (nextMode: RocketMode = mode) => {
    setMode(nextMode);
    setPartsBuilt(0);
    setWiggleShape(null);
    setFeedback(
      nextMode === 'match_shape'
        ? 'Tap the matching shape to snap on each rocket part!'
        : 'Look at the pattern and pick which shape comes next!',
    );
  };

  const handleChooseShape = (picked: ShapeKind) => {
    if (isLaunched) return;
    if (picked === currentRound.answer) {
      const nextBuilt = partsBuilt + 1;
      setPartsBuilt(nextBuilt);
      setWiggleShape(null);
      if (nextBuilt >= PATTERN_ROUNDS.length) {
        playVictoryFanfare();
        setFeedback(`3... 2... 1... BLAST OFF, Captain ${childName}!`);
      } else {
        playHappyMatchSound();
        setFeedback(`Snapped on the ${SHAPES[picked].label} ${currentRound.partName}!`);
      }
    } else {
      playGentleBoopSound();
      setWiggleShape(picked);
      setFeedback(
        `That's a ${SHAPES[picked].label}! Look closely — can you find the ${SHAPES[currentRound.answer].label}?`,
      );
      window.setTimeout(() => setWiggleShape(null), 450);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-indigo-200 dark:border-indigo-800/70 p-5 sm:p-7 space-y-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-indigo-950 dark:text-slate-100">
            Shape Rocket Builder
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Ages 3–6 · Shapes, colors &amp; pattern sequencing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-indigo-50 dark:bg-slate-800 rounded-xl border border-indigo-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => handleRestart('match_shape')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'match_shape'
                  ? 'bg-indigo-600 text-white'
                  : 'text-indigo-950 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700'
              }`}
            >
              Match Shape (3–4)
            </button>
            <button
              type="button"
              onClick={() => handleRestart('finish_pattern')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'finish_pattern'
                  ? 'bg-indigo-600 text-white'
                  : 'text-indigo-950 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700'
              }`}
            >
              Patterns (4–6)
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleRestart(mode)}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Rebuild
          </button>
        </div>
      </div>

      {/* Main Split: Animated Rocket Launchpad + Pattern / Shape Picker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Rocket Stage */}
        <div className="lg:col-span-5 rounded-3xl bg-gradient-to-b from-indigo-950 via-sky-950 to-indigo-900 border-2 border-indigo-700 p-5 flex flex-col items-center justify-between min-h-[300px]">
          <div className="w-full flex items-center justify-between text-xs font-bold text-amber-300">
            <span className="inline-flex items-center gap-1">
              <Rocket className="w-4 h-4" aria-hidden="true" />
              Rocket Parts: {partsBuilt} / {PATTERN_ROUNDS.length}
            </span>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: PATTERN_ROUNDS.length }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${
                    i < partsBuilt ? 'text-amber-400 fill-amber-400' : 'text-indigo-700'
                  }`}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>

          <svg viewBox="0 0 220 240" className="w-full max-w-[220px] h-auto" aria-label="Space rocket under construction">
            {/* Twinkling Stars */}
            <circle cx="30" cy="34" r="3" fill="#fde047" />
            <circle cx="186" cy="48" r="3.5" fill="#7dd3fc" />
            <circle cx="48" cy="110" r="2.5" fill="#f9a8d4" />
            <circle cx="176" cy="135" r="3" fill="#fde047" />

            {/* Launchpad */}
            <rect x="24" y="214" width="172" height="12" rx="6" fill="#64748b" />

            {/* Rocket Group lifts off on completion */}
            <g
              className="transition-transform duration-700"
              transform={isLaunched ? 'translate(0, -24)' : 'translate(0, 0)'}
            >
              {/* Rocket Main Body */}
              <rect
                x="78"
                y="84"
                width="64"
                height="98"
                rx="14"
                fill="#f8fafc"
                stroke="#38bdf8"
                strokeWidth="3.5"
              />

              {/* Part 1: Nose Cone */}
              <polygon
                points="110,28 76,86 144,86"
                fill={partsBuilt >= 1 ? '#f43f5e' : '#334155'}
                stroke={partsBuilt >= 1 ? '#fb7185' : '#64748b'}
                strokeWidth="3"
                strokeDasharray={partsBuilt >= 1 ? undefined : '5 4'}
              />

              {/* Part 2: Porthole Window */}
              <circle
                cx="110"
                cy="118"
                r="18"
                fill={partsBuilt >= 2 ? '#38bdf8' : '#334155'}
                stroke={partsBuilt >= 2 ? '#facc15' : '#64748b'}
                strokeWidth="4"
                strokeDasharray={partsBuilt >= 2 ? undefined : '4 3'}
              />

              {/* Part 3: Left Fin */}
              <polygon
                points="78,144 46,184 78,180"
                fill={partsBuilt >= 3 ? '#f59e0b' : '#334155'}
                stroke={partsBuilt >= 3 ? '#fde047' : '#64748b'}
                strokeWidth="3"
              />

              {/* Part 4: Right Fin */}
              <polygon
                points="142,144 174,184 142,180"
                fill={partsBuilt >= 4 ? '#10b981' : '#334155'}
                stroke={partsBuilt >= 4 ? '#6ee7b7' : '#64748b'}
                strokeWidth="3"
              />

              {/* Part 5: Turbo Booster + Flame */}
              <rect
                x="92"
                y="182"
                width="36"
                height="14"
                rx="4"
                fill={partsBuilt >= 5 ? '#a78bfa' : '#334155'}
                stroke="#e2e8f0"
                strokeWidth="2"
              />
              {isLaunched && (
                <g>
                  <polygon points="94,196 110,236 126,196" fill="#f97316" />
                  <polygon points="101,196 110,224 119,196" fill="#facc15" />
                </g>
              )}
            </g>
          </svg>

          <p className="text-xs font-bold text-sky-100 text-center">{feedback}</p>
        </div>

        {/* Right Interactive Puzzle Area */}
        <div className="lg:col-span-7 space-y-5">
          {isLaunched ? (
            <div className="rounded-3xl bg-gradient-to-b from-amber-50 to-indigo-50 dark:from-slate-800 dark:to-indigo-950/50 border-2 border-amber-300 dark:border-indigo-700 p-8 text-center space-y-4">
              <h3 className="text-2xl sm:text-3xl font-display font-extrabold text-indigo-950 dark:text-slate-100">
                Blast Off, Captain {childName}!
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Your geometric shape rocket zoomed straight to the stars!
              </p>
              <button
                type="button"
                onClick={() => handleRestart(mode)}
                className="min-h-[48px] px-7 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-base font-extrabold cursor-pointer"
              >
                Build Another Rocket
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-sky-50 dark:bg-slate-800/80 border-2 border-sky-200 dark:border-slate-700 p-5 space-y-4 text-center">
                <p className="text-sm sm:text-base font-extrabold text-indigo-950 dark:text-slate-100">
                  {mode === 'match_shape'
                    ? `Find the ${SHAPES[currentRound.answer].label} for the ${currentRound.partName}!`
                    : `Finish the pattern for the ${currentRound.partName}:`}
                </p>

                {mode === 'match_shape' ? (
                  <div className="flex items-center justify-center py-2">
                    <div className="w-24 h-24 rounded-2xl bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-slate-600 flex flex-col items-center justify-center gap-1 shadow-xs">
                      <ShapeGlyphSvg shape={currentRound.answer} sizeClass="w-14 h-14" />
                      <span className="text-xs font-bold text-indigo-950 dark:text-slate-200">
                        {SHAPES[currentRound.answer].label}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {currentRound.sequence.map((sh, i) => (
                      <div
                        key={`seq_${i}`}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white dark:bg-slate-900 border-2 border-sky-200 dark:border-slate-600 flex items-center justify-center"
                      >
                        <ShapeGlyphSvg shape={sh} sizeClass="w-11 h-11" />
                      </div>
                    ))}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-dashed border-amber-400 flex items-center justify-center text-2xl font-display font-extrabold text-amber-600 dark:text-amber-300">
                      ?
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {ALL_SHAPE_KEYS.map((shapeKey) => (
                  <button
                    key={shapeKey}
                    type="button"
                    onClick={() => handleChooseShape(shapeKey)}
                    className={`min-h-[96px] p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer ${
                      wiggleShape === shapeKey
                        ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-400'
                        : 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    <ShapeGlyphSvg shape={shapeKey} sizeClass="w-12 h-12" />
                    <span className="text-xs font-extrabold text-indigo-950 dark:text-slate-100">
                      {SHAPES[shapeKey].label}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
