import React, { useEffect, useRef, useState } from 'react';
import { Music, Play, RotateCcw, Sparkles, Star } from 'lucide-react';
import { ChildProfile } from '../../types';
import {
  playGentleBoopSound,
  playHappyMatchSound,
  playVictoryFanfare,
  playXylophoneNote,
} from '../../services/kidGameAudioService';

type GamePhase = 'TITLE_MENU' | 'PLAYING' | 'VICTORY';
type MusicMode = 'song_studio' | 'rainbow_pattern';

interface RainbowBar {
  index: number;
  noteName: string;
  colorName: string;
  fillHex: string;
  bgClass: string;
  activeRingClass: string;
  heightClass: string;
}

const RAINBOW_BARS: RainbowBar[] = [
  {
    index: 0,
    noteName: 'C',
    colorName: 'Red',
    fillHex: '#ef4444',
    bgClass: 'bg-red-500 hover:bg-red-400 border-red-700 text-white',
    activeRingClass: 'ring-4 ring-red-300 -translate-y-2 brightness-110',
    heightClass: 'min-h-[156px]',
  },
  {
    index: 1,
    noteName: 'D',
    colorName: 'Orange',
    fillHex: '#f97316',
    bgClass: 'bg-orange-500 hover:bg-orange-400 border-orange-700 text-white',
    activeRingClass: 'ring-4 ring-orange-300 -translate-y-2 brightness-110',
    heightClass: 'min-h-[148px]',
  },
  {
    index: 2,
    noteName: 'E',
    colorName: 'Yellow',
    fillHex: '#eab308',
    bgClass: 'bg-amber-400 hover:bg-amber-300 border-amber-600 text-amber-950',
    activeRingClass: 'ring-4 ring-amber-200 -translate-y-2 brightness-110',
    heightClass: 'min-h-[140px]',
  },
  {
    index: 3,
    noteName: 'F',
    colorName: 'Green',
    fillHex: '#22c55e',
    bgClass: 'bg-emerald-500 hover:bg-emerald-400 border-emerald-700 text-white',
    activeRingClass: 'ring-4 ring-emerald-300 -translate-y-2 brightness-110',
    heightClass: 'min-h-[132px]',
  },
  {
    index: 4,
    noteName: 'G',
    colorName: 'Sky',
    fillHex: '#06b6d4',
    bgClass: 'bg-cyan-500 hover:bg-cyan-400 border-cyan-700 text-white',
    activeRingClass: 'ring-4 ring-cyan-300 -translate-y-2 brightness-110',
    heightClass: 'min-h-[124px]',
  },
  {
    index: 5,
    noteName: 'A',
    colorName: 'Blue',
    fillHex: '#3b82f6',
    bgClass: 'bg-blue-500 hover:bg-blue-400 border-blue-700 text-white',
    activeRingClass: 'ring-4 ring-blue-300 -translate-y-2 brightness-110',
    heightClass: 'min-h-[116px]',
  },
  {
    index: 6,
    noteName: 'C5',
    colorName: 'Purple',
    fillHex: '#a855f7',
    bgClass: 'bg-purple-500 hover:bg-purple-400 border-purple-700 text-white',
    activeRingClass: 'ring-4 ring-purple-300 -translate-y-2 brightness-110',
    heightClass: 'min-h-[108px]',
  },
];

interface GuidedSong {
  id: string;
  title: string;
  notes: number[];
}

const GUIDED_SONGS: GuidedSong[] = [
  { id: 'twinkle', title: 'Twinkle Star', notes: [0, 0, 4, 4, 5, 5, 4] },
  { id: 'mary', title: 'Little Lamb', notes: [2, 1, 0, 1, 2, 2, 2] },
  { id: 'rainbow', title: 'Rainbow Climb', notes: [0, 1, 2, 3, 4, 5, 6] },
];

const PATTERN_ROUNDS: number[][] = [
  [0, 2],
  [2, 4, 0],
  [1, 3, 4, 6],
  [0, 2, 4, 5, 6],
];

interface FloatingNote {
  id: number;
  x: number;
  y: number;
  vy: number;
  color: string;
  life: number;
}

interface RainbowMusicGameProps {
  childProfile: ChildProfile;
}

export const RainbowMusicGame: React.FC<RainbowMusicGameProps> = ({ childProfile }) => {
  const [phase, setPhase] = useState<GamePhase>('TITLE_MENU');
  const [mode, setMode] = useState<MusicMode>('song_studio');
  const [activeBarIdx, setActiveBarIdx] = useState<number | null>(null);
  const [floatingNotes, setFloatingNotes] = useState<FloatingNote[]>([]);

  // Song Studio guided melody state
  const [selectedSongId, setSelectedSongId] = useState<string>('twinkle');
  const [songStepIdx, setSongStepIdx] = useState<number>(0);

  // Rainbow Pattern Challenge state (Ages 3-5)
  const [patternRoundIdx, setPatternRoundIdx] = useState<number>(0);
  const [playerStepIdx, setPlayerStepIdx] = useState<number>(0);
  const [isShowingPattern, setIsShowingPattern] = useState<boolean>(false);
  const [feedbackText, setFeedbackText] = useState<string>(
    'Tap any colorful rainbow bar to play music!',
  );

  const notesRef = useRef<FloatingNote[]>([]);
  const nextNoteIdRef = useRef<number>(1);
  const timersRef = useRef<number[]>([]);

  const clearAllTimers = () => {
    for (const t of timersRef.current) {
      window.clearTimeout(t);
    }
    timersRef.current = [];
  };

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (notesRef.current.length > 0) {
        const updated = notesRef.current
          .map((n) => ({
            ...n,
            y: n.y - n.vy * dt,
            life: n.life - dt * 0.95,
          }))
          .filter((n) => n.life > 0);
        notesRef.current = updated;
        setFloatingNotes(updated);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      clearAllTimers();
    };
  }, []);

  const spawnFloatingNote = (barIndex: number) => {
    const bar = RAINBOW_BARS[barIndex] ?? RAINBOW_BARS[0];
    const x = 90 + barIndex * 103 + (Math.random() - 0.5) * 18;
    const spawned: FloatingNote = {
      id: nextNoteIdRef.current++,
      x,
      y: 195,
      vy: 68 + Math.random() * 28,
      color: bar.fillHex,
      life: 1,
    };
    notesRef.current = [...notesRef.current, spawned];
    setFloatingNotes(notesRef.current);
  };

  const flashBar = (barIndex: number, durationMs = 340) => {
    setActiveBarIdx(barIndex);
    playXylophoneNote(barIndex);
    spawnFloatingNote(barIndex);
    const tid = window.setTimeout(() => {
      setActiveBarIdx((prev) => (prev === barIndex ? null : prev));
    }, durationMs);
    timersRef.current.push(tid);
  };

  const playPatternDemo = (roundIndex: number) => {
    clearAllTimers();
    const sequence = PATTERN_ROUNDS[roundIndex] ?? PATTERN_ROUNDS[0];
    setIsShowingPattern(true);
    setPlayerStepIdx(0);
    setFeedbackText(`Watch & listen to the ${sequence.length} rainbow colors...`);

    sequence.forEach((barIdx, step) => {
      const tid = window.setTimeout(() => {
        flashBar(barIdx, 420);
      }, 450 + step * 620);
      timersRef.current.push(tid);
    });

    const doneTid = window.setTimeout(() => {
      setIsShowingPattern(false);
      setFeedbackText(`Your turn, ${childProfile.name}! Tap the rainbow colors back!`);
    }, 550 + sequence.length * 620);
    timersRef.current.push(doneTid);
  };

  const handleStartMode = (chosenMode: MusicMode) => {
    clearAllTimers();
    setMode(chosenMode);
    setSongStepIdx(0);
    setPatternRoundIdx(0);
    setPlayerStepIdx(0);
    setActiveBarIdx(null);
    notesRef.current = [];
    setFloatingNotes([]);
    setPhase('PLAYING');

    if (chosenMode === 'song_studio') {
      const song = GUIDED_SONGS.find((s) => s.id === selectedSongId) ?? GUIDED_SONGS[0];
      setFeedbackText(
        `Follow the glowing star to play "${song.title}", or tap any color freely!`,
      );
      playXylophoneNote(0);
    } else {
      playPatternDemo(0);
    }
  };

  const handleSelectSong = (songId: string) => {
    setSelectedSongId(songId);
    setSongStepIdx(0);
    const song = GUIDED_SONGS.find((s) => s.id === songId) ?? GUIDED_SONGS[0];
    setFeedbackText(`Tap the glowing star bar to play "${song.title}"!`);
  };

  const handleBarTap = (barIndex: number) => {
    if (phase !== 'PLAYING' || isShowingPattern) return;

    flashBar(barIndex, 320);

    if (mode === 'song_studio') {
      const song = GUIDED_SONGS.find((s) => s.id === selectedSongId) ?? GUIDED_SONGS[0];
      const expectedBar = song.notes[songStepIdx];
      if (barIndex === expectedBar) {
        const nextStep = songStepIdx + 1;
        if (nextStep >= song.notes.length) {
          setSongStepIdx(0);
          setFeedbackText(`Bravo, ${childProfile.name}! You played "${song.title}"!`);
          const cheerId = window.setTimeout(() => playVictoryFanfare(), 260);
          timersRef.current.push(cheerId);
        } else {
          setSongStepIdx(nextStep);
          const nextBar = RAINBOW_BARS[song.notes[nextStep]];
          setFeedbackText(`Nice note! Next glowing star: ${nextBar.colorName}!`);
        }
      } else {
        const tappedBar = RAINBOW_BARS[barIndex];
        setFeedbackText(`Pretty ${tappedBar.colorName} note! Keep making music!`);
      }
      return;
    }

    // Rainbow Pattern Challenge mode
    const sequence = PATTERN_ROUNDS[patternRoundIdx] ?? PATTERN_ROUNDS[0];
    const expected = sequence[playerStepIdx];
    if (barIndex === expected) {
      const nextStep = playerStepIdx + 1;
      if (nextStep >= sequence.length) {
        if (patternRoundIdx + 1 >= PATTERN_ROUNDS.length) {
          setFeedbackText(`Superstar musician, ${childProfile.name}! You finished all 4 songs!`);
          const winTid = window.setTimeout(() => {
            playVictoryFanfare();
            setPhase('VICTORY');
          }, 420);
          timersRef.current.push(winTid);
        } else {
          const nextRound = patternRoundIdx + 1;
          setPatternRoundIdx(nextRound);
          setPlayerStepIdx(0);
          setFeedbackText(`Awesome melody! Get ready for Star ${nextRound + 1}!`);
          const nextTid = window.setTimeout(() => {
            playHappyMatchSound();
            playPatternDemo(nextRound);
          }, 700);
          timersRef.current.push(nextTid);
        }
      } else {
        setPlayerStepIdx(nextStep);
        setFeedbackText(`Great! ${sequence.length - nextStep} more color(s) to tap!`);
      }
    } else {
      // Gentle encouraging hint — never harsh!
      const boopTid = window.setTimeout(() => playGentleBoopSound(), 140);
      timersRef.current.push(boopTid);
      const hintColor = RAINBOW_BARS[expected]?.colorName ?? 'Red';
      setFeedbackText(`Ooh, lovely sound! Try tapping the ${hintColor} bar next — or tap Replay!`);
    }
  };

  const currentSong = GUIDED_SONGS.find((s) => s.id === selectedSongId) ?? GUIDED_SONGS[0];
  const guidedHighlightBar =
    phase === 'PLAYING' && mode === 'song_studio' ? currentSong.notes[songStepIdx] : null;

  return (
    <div className="bg-white rounded-3xl border-2 border-purple-200 shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-rose-50 via-amber-50/70 to-purple-50 border-b border-purple-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900">
            Rainbow Xylophone &amp; Color Song
          </h2>
          <p className="text-sm font-medium text-slate-600 mt-0.5">{feedbackText}</p>
        </div>

        {mode === 'rainbow_pattern' ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1" aria-label="Pattern Stars">
              {PATTERN_ROUNDS.map((_, idx) => {
                const earned = phase === 'VICTORY' || idx < patternRoundIdx;
                return (
                  <Star
                    key={idx}
                    className={`w-6 h-6 ${
                      earned
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-300 fill-slate-100'
                    }`}
                  />
                );
              })}
            </div>
            {phase === 'PLAYING' && (
              <button
                type="button"
                disabled={isShowingPattern}
                onClick={() => playPatternDemo(patternRoundIdx)}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                Replay Clues
              </button>
            )}
          </div>
        ) : (
          phase === 'PLAYING' && (
            <div className="flex flex-wrap items-center gap-1.5">
              {GUIDED_SONGS.map((song) => (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => handleSelectSong(song.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    selectedSongId === song.id
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white border border-purple-200 text-purple-900 hover:bg-purple-50'
                  }`}
                >
                  {song.title}
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {/* Musical Sky Stage + Rainbow Xylophone Keys */}
      <div className="relative bg-gradient-to-b from-sky-100 via-amber-50/40 to-emerald-50 p-4 sm:p-6 select-none touch-manipulation">
        {/* Animated Musical Sky Banner */}
        <svg
          viewBox="0 0 800 210"
          className="w-full h-auto block max-h-[210px] rounded-2xl border border-sky-200/70 bg-sky-100 mb-5"
          role="img"
          aria-label="Singing bluebirds and floating musical notes sky"
        >
          <defs>
            <linearGradient id="musicSkyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#93c5fd" />
              <stop offset="70%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#fef9c3" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="800" height="210" fill="url(#musicSkyGrad)" />
          {/* Happy Rainbow Arc */}
          <path d="M 110 210 A 290 185 0 0 1 690 210" fill="none" stroke="#fca5a5" strokeWidth="12" opacity="0.55" />
          <path d="M 124 210 A 276 172 0 0 1 676 210" fill="none" stroke="#fdba74" strokeWidth="12" opacity="0.55" />
          <path d="M 138 210 A 262 159 0 0 1 662 210" fill="none" stroke="#fde047" strokeWidth="12" opacity="0.55" />
          <path d="M 152 210 A 248 146 0 0 1 648 210" fill="none" stroke="#86efac" strokeWidth="12" opacity="0.55" />
          <path d="M 166 210 A 234 133 0 0 1 634 210" fill="none" stroke="#93c5fd" strokeWidth="12" opacity="0.55" />
          <path d="M 180 210 A 220 120 0 0 1 620 210" fill="none" stroke="#d8b4fe" strokeWidth="12" opacity="0.55" />

          {/* Two Cute Singing Songbirds */}
          <g transform={`translate(285, ${activeBarIdx !== null ? 132 : 142})`}>
            <ellipse cx="0" cy="14" rx="26" ry="20" fill="#38bdf8" stroke="#0369a1" strokeWidth="3" />
            <circle cx="14" cy="-6" r="16" fill="#38bdf8" stroke="#0369a1" strokeWidth="3" />
            <circle cx="20" cy="-10" r="3" fill="#0f172a" />
            <polygon points="28,-8 40,-4 28,2" fill="#f59e0b" stroke="#b45309" strokeWidth="2" />
            <ellipse cx="-10" cy="14" rx="14" ry="8" transform="rotate(-18 -10 14)" fill="#0284c7" />
          </g>
          <g transform={`translate(515, ${activeBarIdx !== null ? 132 : 142}) scale(-1, 1)`}>
            <ellipse cx="0" cy="14" rx="26" ry="20" fill="#f472b6" stroke="#be185d" strokeWidth="3" />
            <circle cx="14" cy="-6" r="16" fill="#f472b6" stroke="#be185d" strokeWidth="3" />
            <circle cx="20" cy="-10" r="3" fill="#0f172a" />
            <polygon points="28,-8 40,-4 28,2" fill="#f59e0b" stroke="#b45309" strokeWidth="2" />
            <ellipse cx="-10" cy="14" rx="14" ry="8" transform="rotate(-18 -10 14)" fill="#db2777" />
          </g>

          {/* Rising Colorful Musical Notes */}
          {floatingNotes.map((n) => (
            <g
              key={n.id}
              transform={`translate(${n.x}, ${n.y})`}
              opacity={Math.max(0, n.life)}
            >
              <circle cx="0" cy="0" r="10" fill={n.color} stroke="#ffffff" strokeWidth="2.5" />
              <line x1="8" y1="0" x2="8" y2="-28" stroke={n.color} strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 8 -28 Q 22 -24 20 -12" fill="none" stroke={n.color} strokeWidth="4.5" strokeLinecap="round" />
            </g>
          ))}
        </svg>

        {/* Giant Colorful Tactile Rainbow Xylophone Keys */}
        <div className="bg-amber-800/90 p-3 sm:p-4 rounded-3xl border-4 border-amber-950/30 shadow-inner">
          <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end">
            {RAINBOW_BARS.map((bar) => {
              const isFlashing = activeBarIdx === bar.index;
              const isGuidedNext = guidedHighlightBar === bar.index;

              return (
                <button
                  key={bar.index}
                  type="button"
                  disabled={phase !== 'PLAYING' || isShowingPattern}
                  onClick={() => handleBarTap(bar.index)}
                  className={`relative rounded-2xl border-b-4 shadow-md transition-all flex flex-col items-center justify-between py-3 px-1 cursor-pointer active:scale-95 disabled:cursor-default ${bar.bgClass} ${bar.heightClass} ${
                    isFlashing ? bar.activeRingClass : ''
                  } ${isGuidedNext ? 'ring-4 ring-amber-300 shadow-lg' : ''}`}
                  aria-label={`${bar.colorName} xylophone bar ${bar.noteName}`}
                >
                  {/* Top Wooden Peg Dot */}
                  <span className="w-3.5 h-3.5 rounded-full bg-white/85 border border-black/15 shadow-xs" />

                  {/* Guided Star Indicator */}
                  {isGuidedNext && (
                    <Star className="w-6 h-6 sm:w-7 sm:h-7 text-amber-200 fill-amber-200 animate-bounce" />
                  )}

                  {/* Color & Note Label */}
                  <div className="text-center">
                    <div className="text-base sm:text-xl font-display font-extrabold leading-none">
                      {bar.noteName}
                    </div>
                    <div className="text-[10px] sm:text-xs font-bold opacity-90 mt-1">
                      {bar.colorName}
                    </div>
                  </div>

                  {/* Bottom Wooden Peg Dot */}
                  <span className="w-3.5 h-3.5 rounded-full bg-white/85 border border-black/15 shadow-xs" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode Switcher Strip at Bottom */}
        {phase === 'PLAYING' && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => handleStartMode('song_studio')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                mode === 'song_studio'
                  ? 'bg-indigo-950 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Guided Songs &amp; Free Play
            </button>
            <button
              type="button"
              onClick={() => handleStartMode('rainbow_pattern')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                mode === 'rainbow_pattern'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Rainbow Pattern Challenge (4 Stars)
            </button>
          </div>
        )}

        {/* Title Menu Overlay */}
        {phase === 'TITLE_MENU' && (
          <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border-4 border-purple-300 shadow-xl max-w-md w-full p-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-3">
                <Music className="w-9 h-9" />
              </div>
              <h3 className="text-2xl font-display font-extrabold text-slate-900">
                Rainbow Xylophone!
              </h3>
              <p className="text-sm text-slate-600 mt-1.5">
                Pick how {childProfile.name} wants to make music today:
              </p>
              <div className="mt-5 grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => handleStartMode('song_studio')}
                  className="w-full min-h-[58px] rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-display font-extrabold text-base shadow-md inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Play Guided Songs &amp; Free Band
                </button>
                <button
                  type="button"
                  onClick={() => handleStartMode('rainbow_pattern')}
                  className="w-full min-h-[58px] rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-display font-extrabold text-base shadow-md inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Star className="w-4 h-4 fill-current" />
                  Follow the Rainbow Pattern (Ages 3–5)
                </button>
              </div>
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
                Bravo, {childProfile.name}!
              </h3>
              <p className="text-sm font-medium text-slate-600 mt-1.5">
                You remembered every rainbow color melody and earned 4 Musical Stars!
              </p>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleStartMode('rainbow_pattern')}
                  className="min-h-[54px] rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-display font-extrabold text-base inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play Again
                </button>
                <button
                  type="button"
                  onClick={() => handleStartMode('song_studio')}
                  className="min-h-[54px] rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-display font-extrabold text-base cursor-pointer"
                >
                  Free Play Band
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
