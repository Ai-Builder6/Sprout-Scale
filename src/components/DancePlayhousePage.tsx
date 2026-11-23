import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bluetooth,
  Cast,
  Check,
  Flame,
  Mic,
  MicOff,
  Moon,
  Music,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  RotateCcw,
  Snowflake,
  Sparkles,
  Speaker,
  Star,
  Sun,
  Trophy,
  Tv,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { calculateExactAgeFromDob, ChildProfile } from '../types';
import { useAgeAwareAppAvatar, useDefaultAppAvatar } from '../services/defaultAvatarService';
import {
  AudioOutputSpeaker,
  DANCE_TRACKS,
  danceAudioEngine,
  DanceTrackId,
  DjFxId,
  getDanceTrackById,
  LoudnessBoostLevel,
} from '../services/dancePlayhouseAudio';
import {
  ChildDanceProgress,
  DANCE_MOVES,
  DANCE_ROUTINES,
  DanceMoveId,
  DanceRoutineDefinition,
  FREESTYLE_PARTY_MOVES,
  loadChildDanceProgress,
  saveChildDanceProgress,
} from '../services/danceRoutinesCatalog';
import { speakDanceCoachLine, stopDanceCoachVoice } from '../services/danceCoachVoice';
import { PlayhouseVideoTheater } from './PlayhouseVideoTheater';
import playhouseStageImg from '../assets/images/playhouse_dance_stage_1795413823595.jpg';

type PlayhouseMode = 'learn' | 'party' | 'freeze' | 'videos';
type TempoPreset = 0.85 | 1.0 | 1.15;
type FreezePhase = 'idle' | 'dancing' | 'frozen_prompt' | 'frozen_caught' | 'missed';

interface BurstPop {
  id: number;
  label: string;
  xPercent: number;
  yPercent: number;
  colorClass: string;
}

interface DancePlayhousePageProps {
  activeChild: ChildProfile;
  childrenList: ChildProfile[];
  currentAgeMonths: number;
  onSelectChild: (childId: string) => void;
  onBackToGrowthWall: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

const DJ_FX_PADS: {
  id: DjFxId;
  label: string;
  sublabel: string;
  btnClass: string;
}[] = [
  {
    id: 'clap',
    label: 'Hand Clap',
    sublabel: 'Clap on beat',
    btnClass: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
  },
  {
    id: 'boing',
    label: 'Boing Jump',
    sublabel: 'Springy hop',
    btnClass: 'bg-emerald-500 hover:bg-emerald-400 text-white',
  },
  {
    id: 'sparkle',
    label: 'Star Chime',
    sublabel: 'Magic shimmer',
    btnClass: 'bg-sky-500 hover:bg-sky-400 text-white',
  },
  {
    id: 'bongo',
    label: 'Bongo Roll',
    sublabel: 'Jungle drums',
    btnClass: 'bg-orange-500 hover:bg-orange-400 text-white',
  },
  {
    id: 'horn',
    label: 'Party Horn',
    sublabel: 'Hype blast',
    btnClass: 'bg-pink-500 hover:bg-pink-400 text-white',
  },
  {
    id: 'cheer',
    label: 'Crowd Cheer',
    sublabel: 'Superstar fanfare',
    btnClass: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  },
];

const STAGE_TILE_COLORS = [
  'bg-amber-400 shadow-amber-400/50',
  'bg-sky-400 shadow-sky-400/50',
  'bg-pink-400 shadow-pink-400/50',
  'bg-emerald-400 shadow-emerald-400/50',
];

const BEAT_PRAISE_WORDS = ['AWESOME!', 'SUPERSTAR!', 'ON THE BEAT!', 'WOO-HOO!', 'GREAT MOVE!'];

export const DancePlayhousePage: React.FC<DancePlayhousePageProps> = ({
  activeChild,
  childrenList,
  currentAgeMonths,
  onSelectChild,
  onBackToGrowthWall,
  isDark = false,
  onToggleTheme,
}) => {
  const defaultAvatar = useDefaultAppAvatar();
  const dancerAvatar = useAgeAwareAppAvatar(currentAgeMonths);

  const [mode, setMode] = useState<PlayhouseMode>('learn');
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>(DANCE_ROUTINES[0].id);
  const [selectedTrackId, setSelectedTrackId] = useState<DanceTrackId>(DANCE_ROUTINES[0].trackId);
  const [tempo, setTempo] = useState<TempoPreset>(1.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => danceAudioEngine.getMuted());
  const [coachVoiceOn, setCoachVoiceOn] = useState<boolean>(true);
  const [practiceSingleMove, setPracticeSingleMove] = useState<boolean>(false);

  // Bluetooth Speaker Casting & Loud Party Boost state
  const [loudnessBoost, setLoudnessBoost] = useState<LoudnessBoostLevel>(() =>
    danceAudioEngine.getLoudnessBoost(),
  );
  const [isSpeakerModalOpen, setIsSpeakerModalOpen] = useState<boolean>(false);
  const [availableSpeakers, setAvailableSpeakers] = useState<AudioOutputSpeaker[]>([
    { deviceId: 'default', label: 'Device Speaker (Default)', isDefault: true },
  ]);
  const [selectedSpeaker, setSelectedSpeaker] = useState<{ deviceId: string; label: string }>(() =>
    danceAudioEngine.getSelectedSpeaker(),
  );
  const [isScanningSpeakers, setIsScanningSpeakers] = useState<boolean>(false);
  const [speakerStatusNote, setSpeakerStatusNote] = useState<string | null>(null);
  const castCaps = useMemo(() => danceAudioEngine.getCastCapabilities(), []);

  // Beat & choreography state
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [beatsInCurrentStep, setBeatsInCurrentStep] = useState<number>(0);
  const [beatInBar, setBeatInBar] = useState<number>(0);
  const [beatPulse, setBeatPulse] = useState<boolean>(false);
  const [partyMoveId, setPartyMoveId] = useState<DanceMoveId>('bounce');
  const [comboCount, setComboCount] = useState<number>(0);
  const [routineCelebration, setRoutineCelebration] = useState<string | null>(null);
  const [stageImgError, setStageImgError] = useState<boolean>(false);

  // Freeze Dance Game state
  const [freezePhase, setFreezePhase] = useState<FreezePhase>('idle');
  const [freezeStreak, setFreezeStreak] = useState<number>(0);
  const [freezeCountdownMs, setFreezeCountdownMs] = useState<number>(0);
  const [freezeDanceMove, setFreezeDanceMove] = useState<DanceMoveId>('bounce');

  // Visual bursts on stage
  const [bursts, setBursts] = useState<BurstPop[]>([]);
  const burstCounterRef = useRef<number>(1);
  const lastBeatTimeMsRef = useRef<number>(0);
  const freezeTimerRef = useRef<number | null>(null);
  const freezeTickRef = useRef<number | null>(null);

  // Per-child dance progress
  const [progress, setProgress] = useState<ChildDanceProgress>(() =>
    loadChildDanceProgress(activeChild.id),
  );

  // Refs to keep beat callback always fresh without tearing down audio listener
  const modeRef = useRef(mode);
  const practiceRef = useRef(practiceSingleMove);
  const routineRef = useRef<DanceRoutineDefinition>(DANCE_ROUTINES[0]);
  const stepIdxRef = useRef(currentStepIndex);
  const beatsInStepRef = useRef(beatsInCurrentStep);
  const coachOnRef = useRef(coachVoiceOn);
  const childNameRef = useRef(activeChild.name);
  const childIdRef = useRef(activeChild.id);
  const freezePhaseRef = useRef(freezePhase);

  const selectedRoutine = useMemo(
    () => DANCE_ROUTINES.find((r) => r.id === selectedRoutineId) ?? DANCE_ROUTINES[0],
    [selectedRoutineId],
  );
  const currentTrack = useMemo(() => getDanceTrackById(selectedTrackId), [selectedTrackId]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    practiceRef.current = practiceSingleMove;
  }, [practiceSingleMove]);
  useEffect(() => {
    routineRef.current = selectedRoutine;
  }, [selectedRoutine]);
  useEffect(() => {
    stepIdxRef.current = currentStepIndex;
  }, [currentStepIndex]);
  useEffect(() => {
    beatsInStepRef.current = beatsInCurrentStep;
  }, [beatsInCurrentStep]);
  useEffect(() => {
    coachOnRef.current = coachVoiceOn;
  }, [coachVoiceOn]);
  useEffect(() => {
    childNameRef.current = activeChild.name;
    childIdRef.current = activeChild.id;
  }, [activeChild.id, activeChild.name]);
  useEffect(() => {
    freezePhaseRef.current = freezePhase;
  }, [freezePhase]);

  // Reload per-child stars when switching child profiles
  useEffect(() => {
    setProgress(loadChildDanceProgress(activeChild.id));
    setRoutineCelebration(null);
    setComboCount(0);
    setFreezeStreak(0);
  }, [activeChild.id]);

  const updateChildProgress = useCallback(
    (updater: (prev: ChildDanceProgress) => ChildDanceProgress) => {
      setProgress((prev) => {
        const next = updater(prev);
        return saveChildDanceProgress(childIdRef.current, next);
      });
    },
    [],
  );

  const spawnBurst = useCallback((label: string, colorClass = 'text-amber-300') => {
    const id = burstCounterRef.current++;
    const xPercent = 24 + Math.round(Math.random() * 52);
    const yPercent = 18 + Math.round(Math.random() * 34);
    setBursts((prev) => [...prev.slice(-6), { id, label, xPercent, yPercent, colorClass }]);
    window.setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== id));
    }, 950);
  }, []);

  const clearFreezeTimers = useCallback(() => {
    if (freezeTimerRef.current !== null) {
      window.clearTimeout(freezeTimerRef.current);
      freezeTimerRef.current = null;
    }
    if (freezeTickRef.current !== null) {
      window.clearInterval(freezeTickRef.current);
      freezeTickRef.current = null;
    }
  }, []);

  const stopAllPlayback = useCallback(() => {
    clearFreezeTimers();
    danceAudioEngine.stop();
    stopDanceCoachVoice();
    setIsPlaying(false);
    setBeatPulse(false);
  }, [clearFreezeTimers]);

  // Clean up audio and timers on unmount
  useEffect(() => {
    return () => {
      stopAllPlayback();
    };
  }, [stopAllPlayback]);

  // Sync track & tempo with audio engine
  useEffect(() => {
    danceAudioEngine.setTrack(selectedTrackId);
  }, [selectedTrackId]);

  useEffect(() => {
    danceAudioEngine.setTempoMultiplier(tempo);
  }, [tempo]);

  // Subscribe to beat clock for beat-locked lights & Learn-a-Dance progression
  useEffect(() => {
    const unsubscribe = danceAudioEngine.onBeat(({ beatInBar: bBar }) => {
      lastBeatTimeMsRef.current = performance.now();
      setBeatInBar(bBar);
      setBeatPulse(true);
      window.setTimeout(() => setBeatPulse(false), 140);

      if (modeRef.current === 'learn') {
        const routine = routineRef.current;
        const stepIdx = stepIdxRef.current;
        const currentMoveId = routine.steps[stepIdx] ?? routine.steps[0];
        const moveDef = DANCE_MOVES[currentMoveId];
        const nextBeatCount = beatsInStepRef.current + 1;

        if (nextBeatCount >= moveDef.beats) {
          setBeatsInCurrentStep(0);
          beatsInStepRef.current = 0;

          if (!practiceRef.current) {
            const nextStep = stepIdx + 1;
            if (nextStep < routine.steps.length) {
              setCurrentStepIndex(nextStep);
              stepIdxRef.current = nextStep;
              const nextMove = DANCE_MOVES[routine.steps[nextStep]];
              if (nextMove && coachOnRef.current) {
                void speakDanceCoachLine(nextMove.coachCallout, { enabled: true });
              }
            } else {
              // Completed the whole dance routine!
              danceAudioEngine.playDjFx('cheer');
              const completedRoutineId = routine.id;
              const cheerMsg = `Way to go, ${childNameRef.current}! You mastered ${routine.title}!`;
              setRoutineCelebration(cheerMsg);
              spawnBurst('+5 STARS!', 'text-amber-300');
              updateChildProgress((prev) => ({
                ...prev,
                starsEarned: prev.starsEarned + 5,
                movesPracticed: prev.movesPracticed + routine.steps.length,
                totalSessions: prev.totalSessions + 1,
                routinesCompleted: {
                  ...prev.routinesCompleted,
                  [completedRoutineId]: (prev.routinesCompleted[completedRoutineId] ?? 0) + 1,
                },
              }));
              if (coachOnRef.current) {
                void speakDanceCoachLine(
                  `Awesome dancing, ${childNameRef.current}! You finished ${routine.title}! Take a big bow!`,
                  { enabled: true },
                );
              }
              setCurrentStepIndex(0);
              stepIdxRef.current = 0;
            }
          }
        } else {
          setBeatsInCurrentStep(nextBeatCount);
          beatsInStepRef.current = nextBeatCount;
        }
      } else if (modeRef.current === 'freeze' && freezePhaseRef.current === 'dancing') {
        // Rotate fun moves every 4 beats while dancing in Freeze mode
        if (bBar === 0) {
          const randomMove =
            FREESTYLE_PARTY_MOVES[Math.floor(Math.random() * FREESTYLE_PARTY_MOVES.length)];
          setFreezeDanceMove(randomMove);
        }
      }
    });
    return unsubscribe;
  }, [spawnBurst, updateChildProgress]);

  // Schedule next Freeze Dance drop
  const startFreezeDancingRound = useCallback(() => {
    clearFreezeTimers();
    setFreezePhase('dancing');
    freezePhaseRef.current = 'dancing';
    setFreezeCountdownMs(0);

    const startMove =
      FREESTYLE_PARTY_MOVES[Math.floor(Math.random() * FREESTYLE_PARTY_MOVES.length)];
    setFreezeDanceMove(startMove);

    danceAudioEngine.setTrack('freeze_party');
    setSelectedTrackId('freeze_party');
    danceAudioEngine.start('freeze_party');
    setIsPlaying(true);

    const danceDurationMs = 4200 + Math.floor(Math.random() * 2900);
    freezeTimerRef.current = window.setTimeout(() => {
      if (modeRef.current !== 'freeze') return;
      danceAudioEngine.stop();
      danceAudioEngine.playFreezeScratch();
      setIsPlaying(false);
      setFreezePhase('frozen_prompt');
      freezePhaseRef.current = 'frozen_prompt';

      const windowMs = 3600;
      const startedAt = Date.now();
      setFreezeCountdownMs(windowMs);

      if (coachOnRef.current) {
        void speakDanceCoachLine(`Freeze, ${childNameRef.current}! Hold still like a statue!`, {
          enabled: true,
        });
      }

      freezeTickRef.current = window.setInterval(() => {
        const remaining = Math.max(0, windowMs - (Date.now() - startedAt));
        setFreezeCountdownMs(remaining);
        if (remaining <= 0) {
          clearFreezeTimers();
          if (freezePhaseRef.current === 'frozen_prompt') {
            setFreezePhase('missed');
            freezePhaseRef.current = 'missed';
            setFreezeStreak(0);
            if (coachOnRef.current) {
              void speakDanceCoachLine(
                `Ooh, you wiggled! Shake it out and let's dance again, ${childNameRef.current}!`,
                { enabled: true },
              );
            }
          }
        }
      }, 60);
    }, danceDurationMs);
  }, [clearFreezeTimers]);

  const handleTapFreezeButton = useCallback(() => {
    if (freezePhase === 'frozen_prompt') {
      clearFreezeTimers();
      danceAudioEngine.playDjFx('sparkle');
      setFreezePhase('frozen_caught');
      freezePhaseRef.current = 'frozen_caught';
      setFreezeCountdownMs(0);

      const nextStreak = freezeStreak + 1;
      setFreezeStreak(nextStreak);
      spawnBurst(`FROZEN! +2 STARS`, 'text-sky-200');
      updateChildProgress((prev) => ({
        ...prev,
        starsEarned: prev.starsEarned + 2,
        bestFreezeStreak: Math.max(prev.bestFreezeStreak, nextStreak),
      }));

      if (coachOnRef.current) {
        void speakDanceCoachLine(
          `Great freeze, ${childNameRef.current}! Streak ${nextStreak}! Ready to dance again?`,
          { enabled: true },
        );
      }

      freezeTimerRef.current = window.setTimeout(() => {
        if (modeRef.current === 'freeze') {
          startFreezeDancingRound();
        }
      }, 2100);
    } else if (freezePhase === 'idle' || freezePhase === 'missed') {
      if (coachOnRef.current) {
        void speakDanceCoachLine(`Let's play Freeze Dance, ${activeChild.name}! Dance to the beat!`, {
          enabled: true,
        });
      }
      startFreezeDancingRound();
    } else if (freezePhase === 'dancing') {
      // Fun playful feedback if they tap while dancing
      danceAudioEngine.playDjFx('boing');
      spawnBurst('KEEP DANCING!', 'text-amber-300');
    }
  }, [
    activeChild.name,
    clearFreezeTimers,
    freezePhase,
    freezeStreak,
    spawnBurst,
    startFreezeDancingRound,
    updateChildProgress,
  ]);

  const handleTogglePlay = useCallback(() => {
    if (mode === 'freeze') {
      if (isPlaying || freezePhase === 'frozen_prompt' || freezePhase === 'frozen_caught') {
        stopAllPlayback();
        setFreezePhase('idle');
        freezePhaseRef.current = 'idle';
      } else {
        handleTapFreezeButton();
      }
      return;
    }

    if (isPlaying) {
      danceAudioEngine.stop();
      stopDanceCoachVoice();
      setIsPlaying(false);
      return;
    }

    setRoutineCelebration(null);
    danceAudioEngine.setTrack(selectedTrackId);
    danceAudioEngine.setTempoMultiplier(tempo);
    danceAudioEngine.start(selectedTrackId);
    setIsPlaying(true);

    if (mode === 'learn') {
      const firstMoveId = selectedRoutine.steps[currentStepIndex] ?? selectedRoutine.steps[0];
      const firstMove = DANCE_MOVES[firstMoveId];
      if (coachVoiceOn && firstMove) {
        void speakDanceCoachLine(
          `Five, six, seven, eight, ${activeChild.name}! ${firstMove.coachCallout}`,
          { enabled: true },
        );
      }
    } else if (mode === 'party' && coachVoiceOn) {
      void speakDanceCoachLine(
        `Let's dance, ${activeChild.name}! Tap the moves and make some noise!`,
        { enabled: true },
      );
    }
  }, [
    activeChild.name,
    coachVoiceOn,
    currentStepIndex,
    freezePhase,
    handleTapFreezeButton,
    isPlaying,
    mode,
    selectedRoutine.steps,
    selectedTrackId,
    stopAllPlayback,
    tempo,
  ]);

  const handleSelectMode = (nextMode: PlayhouseMode) => {
    if (nextMode === mode) return;
    stopAllPlayback();
    setRoutineCelebration(null);
    setFreezePhase('idle');
    freezePhaseRef.current = 'idle';
    setMode(nextMode);
    if (nextMode === 'learn') {
      setSelectedTrackId(selectedRoutine.trackId);
      setCurrentStepIndex(0);
      setBeatsInCurrentStep(0);
    } else if (nextMode === 'freeze') {
      setSelectedTrackId('freeze_party');
    }
  };

  const handleSelectRoutine = (routine: DanceRoutineDefinition, autoStart = false) => {
    setSelectedRoutineId(routine.id);
    setSelectedTrackId(routine.trackId);
    setCurrentStepIndex(0);
    stepIdxRef.current = 0;
    setBeatsInCurrentStep(0);
    beatsInStepRef.current = 0;
    setRoutineCelebration(null);
    setMode('learn');
    danceAudioEngine.setTrack(routine.trackId);

    if (autoStart) {
      danceAudioEngine.setTempoMultiplier(tempo);
      danceAudioEngine.start(routine.trackId);
      setIsPlaying(true);
      const firstMove = DANCE_MOVES[routine.steps[0]];
      if (coachVoiceOn && firstMove) {
        void speakDanceCoachLine(
          `Let's learn ${routine.title}, ${activeChild.name}! ${firstMove.coachCallout}`,
          { enabled: true },
        );
      }
    }
  };

  const handleSelectStep = (idx: number) => {
    setCurrentStepIndex(idx);
    stepIdxRef.current = idx;
    setBeatsInCurrentStep(0);
    beatsInStepRef.current = 0;
    const moveId = selectedRoutine.steps[idx];
    const moveDef = DANCE_MOVES[moveId];
    if (moveDef && coachVoiceOn) {
      void speakDanceCoachLine(moveDef.coachCallout, { enabled: true });
    }
  };

  const handleTapOnTheBeat = useCallback(() => {
    const now = performance.now();
    const effectiveBpm = currentTrack.bpm * tempo;
    const beatMs = 60000 / effectiveBpm;
    const delta = Math.abs(now - lastBeatTimeMsRef.current);
    const isClose = isPlaying && (delta < beatMs * 0.34 || Math.abs(delta - beatMs) < beatMs * 0.34);

    danceAudioEngine.playDjFx(isClose ? 'sparkle' : 'clap');
    const nextCombo = comboCount + 1;
    setComboCount(nextCombo);

    const praise = isClose
      ? 'PERFECT BEAT! +1 STAR'
      : BEAT_PRAISE_WORDS[nextCombo % BEAT_PRAISE_WORDS.length];
    spawnBurst(praise, isClose ? 'text-amber-300' : 'text-emerald-300');

    updateChildProgress((prev) => ({
      ...prev,
      starsEarned: prev.starsEarned + 1,
      movesPracticed: prev.movesPracticed + 1,
    }));
  }, [comboCount, currentTrack.bpm, isPlaying, spawnBurst, tempo, updateChildProgress]);

  const handleTriggerPartyMove = (moveId: DanceMoveId) => {
    setPartyMoveId(moveId);
    danceAudioEngine.playDjFx('boing');
    const moveDef = DANCE_MOVES[moveId];
    spawnBurst(`${moveDef.shortLabel.toUpperCase()}!`, 'text-amber-200');
    if (!isPlaying) {
      danceAudioEngine.setTrack(selectedTrackId);
      danceAudioEngine.start(selectedTrackId);
      setIsPlaying(true);
    }
    if (coachVoiceOn) {
      void speakDanceCoachLine(moveDef.coachCallout, { enabled: true });
    }
    updateChildProgress((prev) => ({
      ...prev,
      starsEarned: prev.starsEarned + 1,
      movesPracticed: prev.movesPracticed + 1,
    }));
  };

  const handleTriggerDjPad = (fx: DjFxId, label: string) => {
    danceAudioEngine.playDjFx(fx);
    spawnBurst(label.toUpperCase() + '!', 'text-pink-200');
    if (fx === 'cheer' && coachVoiceOn) {
      void speakDanceCoachLine(`Go ${activeChild.name}! You rock the dance floor!`, {
        enabled: true,
      });
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    danceAudioEngine.setMuted(next);
  };

  // Spacebar shortcut: tap on the beat or freeze instantly!
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (modeRef.current === 'videos') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      if (modeRef.current === 'freeze') {
        handleTapFreezeButton();
      } else if (isPlaying) {
        handleTapOnTheBeat();
      } else {
        handleTogglePlay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTapFreezeButton, handleTapOnTheBeat, handleTogglePlay, isPlaying]);

  // Active move currently demonstrated by the SproutScale Kid Character on stage
  const activeMoveId: DanceMoveId = useMemo(() => {
    if (mode === 'freeze') {
      if (freezePhase === 'frozen_prompt' || freezePhase === 'frozen_caught') return 'freeze';
      return freezeDanceMove;
    }
    if (mode === 'party') return partyMoveId;
    return selectedRoutine.steps[currentStepIndex] ?? selectedRoutine.steps[0];
  }, [currentStepIndex, freezeDanceMove, freezePhase, mode, partyMoveId, selectedRoutine.steps]);

  const activeMove = DANCE_MOVES[activeMoveId];
  const effectiveBpm = Math.round(currentTrack.bpm * tempo);
  const beatDurationSec = (60 / Math.max(60, effectiveBpm)).toFixed(3);
  const characterAnimClass =
    isPlaying || mode === 'party' || freezePhase === 'frozen_prompt' || freezePhase === 'frozen_caught'
      ? `dance-move-${activeMoveId}`
      : '';

  const liveAge = activeChild.birthDate ? calculateExactAgeFromDob(activeChild.birthDate) : null;
  const totalRoutinesCompleted = Object.values(progress.routinesCompleted).reduce(
    (sum, n) => sum + n,
    0,
  );

  return (
    <div className="space-y-8">
      {/* Compact Workspace Top Bar: Back, Child Switcher, Star Tally, Sound/Coach Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-amber-200/80 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              stopAllPlayback();
              onBackToGrowthWall();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Growth Wall
          </button>

          {/* Child Switcher (always illustrated character portrait, never photo avatars) */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {childrenList.map((kid) => {
              const isSelected = kid.id === activeChild.id;
              return (
                <button
                  key={kid.id}
                  type="button"
                  onClick={() => onSelectChild(kid.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-950 text-white dark:bg-amber-400 dark:text-slate-950'
                      : 'bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-amber-300'
                  }`}
                >
                  <img
                    src={defaultAvatar.portraitUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover bg-sky-100 shrink-0"
                  />
                  <span>{kid.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Clean Unboxed Progress Stats + Real Audio/Coach/Theme Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
            <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" aria-hidden="true" />
            <span>{progress.starsEarned} Dance Stars</span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span>{totalRoutinesCompleted} Routines</span>
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !coachVoiceOn;
              setCoachVoiceOn(next);
              if (!next) stopDanceCoachVoice();
            }}
            aria-label={coachVoiceOn ? 'Mute dance coach voice' : 'Enable dance coach voice'}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              coachVoiceOn
                ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}
          >
            {coachVoiceOn ? (
              <Mic className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <MicOff className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{coachVoiceOn ? 'Coach Voice On' : 'Coach Muted'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSpeakerModalOpen(true);
              setSpeakerStatusNote(null);
              void danceAudioEngine.listOutputSpeakers(false).then((list) => {
                setAvailableSpeakers(list);
              });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Bluetooth className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="max-w-[150px] truncate">
              {selectedSpeaker.deviceId !== 'default'
                ? selectedSpeaker.label
                : 'Cast to Speaker'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={isMuted ? 'Unmute music' : 'Mute music'}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            )}
            <span>{isMuted ? 'Music Off' : `Loud ${Math.round(loudnessBoost * 100)}%`}</span>
          </button>

          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Playhouse Header + Interactive Mode Switcher */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-indigo-950 dark:text-white">
            {activeChild.name}’s Dance Playhouse
          </h1>
          <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
            Turn up the upbeat music, learn fun step-by-step dance moves, remix party sound effects,
            or jump into Freeze Dance right on stage.
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            Dancing as {activeChild.name}
            {liveAge ? ` · ${liveAge.formattedShortAge}` : ''} · {currentTrack.title} ·{' '}
            {effectiveBpm} BPM
          </p>
        </div>

        {/* Clean Segmented Mode Control */}
        <div
          role="tablist"
          aria-label="Playhouse activity modes"
          className="inline-flex flex-wrap items-center gap-1 p-1.5 bg-white/90 dark:bg-slate-900 border border-amber-200 dark:border-slate-800 rounded-xl shadow-xs self-start lg:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'learn'}
            onClick={() => handleSelectMode('learn')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'learn'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            Learn a Dance
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'party'}
            onClick={() => handleSelectMode('party')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'party'
                ? 'bg-pink-500 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-pink-50 dark:hover:bg-slate-800'
            }`}
          >
            <Music className="w-4 h-4" aria-hidden="true" />
            DJ Dance Party
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'freeze'}
            onClick={() => handleSelectMode('freeze')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'freeze'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800'
            }`}
          >
            <Snowflake className="w-4 h-4" aria-hidden="true" />
            Freeze Dance
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'videos'}
            onClick={() => handleSelectMode('videos')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'videos'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-slate-800'
            }`}
          >
            <Tv className="w-4 h-4" aria-hidden="true" />
            Watch Videos
          </button>
        </div>
      </section>

      {mode === 'videos' ? (
        <PlayhouseVideoTheater
          childId={activeChild.id}
          childName={activeChild.name}
          dancerFullBodyUrl={dancerAvatar.fullBodyUrl}
          onEarnStar={(count) =>
            updateChildProgress((prev) => ({
              ...prev,
              starsEarned: prev.starsEarned + count,
            }))
          }
          onSwitchToDance={() => handleSelectMode('party')}
        />
      ) : (
      /* Dominant Focal Anchor: The Live Animated Dance Playhouse Stage + Interactive Deck */
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left / Center: Animated Illustrated Playhouse Stage (7 cols on desktop) */}
        <div className="lg:col-span-7 flex flex-col bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {/* Interactive Stage Viewport */}
          <div
            className="relative aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden bg-gradient-to-b from-amber-100 via-orange-50 to-amber-200 dark:from-indigo-950 dark:via-slate-900 dark:to-amber-950 select-none"
            style={{ ['--beat-dur' as string]: `${beatDurationSec}s` }}
          >
            {!stageImgError ? (
              <img
                src={playhouseStageImg}
                alt="Sunny wooden children's playhouse dance stage with bunting flags and warm spotlights"
                referrerPolicy="no-referrer"
                onError={() => setStageImgError(true)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-sky-200 via-amber-100 to-orange-200 dark:from-indigo-950 dark:via-slate-900 dark:to-slate-950" />
            )}

            {/* Beat-reactive warm stage spotlight glow & Freeze icy tint */}
            <div
              aria-hidden="true"
              className={`absolute inset-0 pointer-events-none transition-opacity duration-150 ${
                freezePhase === 'frozen_prompt' || freezePhase === 'frozen_caught'
                  ? 'bg-sky-500/35 opacity-100'
                  : beatPulse && isPlaying
                    ? 'bg-amber-300/20 opacity-100'
                    : 'bg-slate-950/10 opacity-40'
              }`}
            />

            {/* Top HUD strip on stage with measured contrast scrim */}
            <div className="absolute top-0 inset-x-0 px-4 py-3 bg-gradient-to-b from-slate-950/75 via-slate-950/40 to-transparent flex items-center justify-between gap-3 text-white">
              <div className="min-w-0">
                <p className="text-xs font-medium text-amber-200 truncate">
                  {mode === 'learn'
                    ? selectedRoutine.title
                    : mode === 'party'
                      ? `${currentTrack.title} · Freestyle DJ Stage`
                      : 'Musical Freeze Dance Challenge'}
                </p>
                <p className="text-base sm:text-lg font-bold tracking-tight truncate">
                  {freezePhase === 'frozen_prompt'
                    ? 'FREEZE LIKE A STATUE!'
                    : freezePhase === 'frozen_caught'
                      ? 'AWESOME FREEZE!'
                      : activeMove.name}
                </p>
              </div>

              {/* Live 1-2-3-4 Musical Beat Counter */}
              <div
                aria-label={`Musical beat ${beatInBar + 1} of 4`}
                className="flex items-center gap-1.5 shrink-0"
              >
                {[0, 1, 2, 3].map((b) => {
                  const activeBeat = isPlaying && beatInBar === b;
                  return (
                    <span
                      key={b}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold tabular-nums transition-transform duration-100 ${
                        activeBeat
                          ? `${STAGE_TILE_COLORS[b]} text-slate-950 scale-110 shadow-md`
                          : 'bg-slate-950/60 text-white/80'
                      }`}
                    >
                      {b + 1}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Animated SproutScale Kid Character Performing the Live Dance Move */}
            <div className="absolute inset-x-0 bottom-[13%] flex flex-col items-center justify-end pointer-events-none">
              {/* Soft grounded shadow that pulses with jumps */}
              <div
                className={`w-28 sm:w-36 h-4 rounded-full bg-slate-950/30 blur-[2px] mb-[-10px] transition-transform duration-150 ${
                  beatPulse && isPlaying ? 'scale-90 opacity-60' : 'scale-100 opacity-80'
                }`}
              />
              <div
                className={`relative h-[185px] sm:h-[235px] md:h-[255px] flex items-end justify-center will-change-transform ${characterAnimClass}`}
              >
                <img
                  src={dancerAvatar.fullBodyUrl}
                  alt={`${activeChild.name} performing ${activeMove.name}`}
                  referrerPolicy="no-referrer"
                  className="h-full w-auto object-contain drop-shadow-[0_10px_14px_rgba(15,23,42,0.32)]"
                />
              </div>
            </div>

            {/* Glowing Interactive Floor Tiles Synced to the Beat */}
            <div
              aria-hidden="true"
              className="absolute bottom-2 inset-x-6 grid grid-cols-4 gap-2 pointer-events-none"
            >
              {[0, 1, 2, 3].map((tileIdx) => {
                const lit = isPlaying && beatInBar === tileIdx;
                return (
                  <div
                    key={tileIdx}
                    className={`h-2.5 rounded-full transition-all duration-100 ${
                      lit
                        ? `${STAGE_TILE_COLORS[tileIdx]} opacity-95 scale-y-125`
                        : 'bg-white/35 opacity-55'
                    }`}
                  />
                );
              })}
            </div>

            {/* Floating Confetti / Praise Pops */}
            {bursts.map((b) => (
              <div
                key={b.id}
                style={{ left: `${b.xPercent}%`, top: `${b.yPercent}%` }}
                className={`absolute -translate-x-1/2 pointer-events-none dance-note-float font-display text-sm sm:text-base font-extrabold tracking-tight drop-shadow-[0_2px_6px_rgba(15,23,42,0.85)] ${b.colorClass}`}
              >
                {b.label}
              </div>
            ))}

            {/* Routine Complete Celebration Overlay */}
            {routineCelebration && (
              <div className="absolute inset-x-4 bottom-12 bg-slate-950/88 backdrop-blur-xs text-white rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <Trophy className="w-7 h-7 text-amber-400 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-bold text-amber-300">Routine Mastered! +5 Stars</p>
                    <p className="text-xs sm:text-sm text-white/95">{routineCelebration}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRoutineCelebration(null)}
                  className="px-3.5 py-2 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Keep Dancing
                </button>
              </div>
            )}
          </div>

          {/* Primary Stage Action Deck Directly Below the Stage */}
          <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-t border-amber-100 dark:border-slate-800 space-y-4">
            {/* Move Cue Instruction Line */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm sm:text-base font-bold text-indigo-950 dark:text-white">
                  {mode === 'freeze' && freezePhase === 'frozen_prompt'
                    ? `STOP! Don't move a muscle, ${activeChild.name}! Tap FREEZE NOW!`
                    : activeMove.cuePhrase}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Tip: {activeMove.kidTip}
                </p>
              </div>

              {/* Tempo Selector (Slow Practice / Normal / Turbo) */}
              {mode !== 'freeze' && (
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start shrink-0">
                  {(
                    [
                      { value: 0.85 as TempoPreset, label: 'Slow' },
                      { value: 1.0 as TempoPreset, label: 'Normal' },
                      { value: 1.15 as TempoPreset, label: 'Turbo' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTempo(opt.value)}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        tempo === opt.value
                          ? 'bg-white dark:bg-slate-700 text-indigo-950 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Big Tactile Play / Interactive Rhythm / Freeze Controls */}
            {mode === 'freeze' ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleTapFreezeButton}
                  className={`flex-1 min-w-[220px] min-h-[54px] px-6 py-3 rounded-xl text-base font-extrabold shadow-sm transition-transform active:scale-[0.98] flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                    freezePhase === 'frozen_prompt'
                      ? 'bg-sky-500 hover:bg-sky-400 text-white'
                      : freezePhase === 'dancing'
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {freezePhase === 'frozen_prompt' ? (
                    <>
                      <Snowflake className="w-5 h-5" aria-hidden="true" />
                      FREEZE NOW! ({(freezeCountdownMs / 1000).toFixed(1)}s)
                    </>
                  ) : freezePhase === 'dancing' ? (
                    <>
                      <Music className="w-5 h-5" aria-hidden="true" />
                      Dance Wildly — Wait for Freeze!
                    </>
                  ) : freezePhase === 'frozen_caught' ? (
                    <>
                      <Star className="w-5 h-5" aria-hidden="true" />
                      Awesome Freeze! Next Round Coming...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" aria-hidden="true" />
                      {freezePhase === 'missed' ? 'Play Again' : 'Start Freeze Dance'}
                    </>
                  )}
                </button>

                {freezePhase !== 'idle' && (
                  <button
                    type="button"
                    onClick={() => {
                      stopAllPlayback();
                      setFreezePhase('idle');
                      freezePhaseRef.current = 'idle';
                    }}
                    className="min-h-[54px] px-4 py-3 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Stop
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className={`min-h-[52px] px-6 py-3 rounded-xl text-sm sm:text-base font-extrabold shadow-xs transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                    isPlaying
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-5 h-5" aria-hidden="true" />
                      Pause Music
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" aria-hidden="true" />
                      {mode === 'learn' ? 'Start Dance Lesson' : 'Play Party Music'}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleTapOnTheBeat}
                  className="flex-1 min-w-[190px] min-h-[52px] px-5 py-3 rounded-xl text-sm sm:text-base font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-xs transition-transform active:scale-[0.98] inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Zap className="w-5 h-5" aria-hidden="true" />
                  Tap on the Beat (+Star)
                  {comboCount > 1 && (
                    <span className="text-xs font-bold tabular-nums opacity-80">
                      · {comboCount}x
                    </span>
                  )}
                </button>

                {mode === 'learn' && (
                  <button
                    type="button"
                    onClick={() => setPracticeSingleMove((p) => !p)}
                    className={`min-h-[52px] px-4 py-3 rounded-xl text-xs sm:text-sm font-bold border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                      practiceSingleMove
                        ? 'bg-indigo-950 text-white border-indigo-950 dark:bg-sky-500 dark:text-slate-950 dark:border-sky-400'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                    }`}
                  >
                    <Repeat className="w-4 h-4" aria-hidden="true" />
                    {practiceSingleMove ? 'Looping Step' : 'Practice Step'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Mode-Specific Interactive Controls (5 cols on desktop) */}
        <div className="lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm justify-between gap-5">
          {mode === 'learn' && (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-indigo-950 dark:text-white">
                      Step-by-Step Choreography
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Tap any move below to practice it, or press Start to dance the full routine.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectStep(0)}
                    aria-label="Restart routine from step 1"
                    className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {/* Routine Steps List */}
                <div className="space-y-2.5">
                  {selectedRoutine.steps.map((stepMoveId, idx) => {
                    const move = DANCE_MOVES[stepMoveId];
                    const isActiveStep = idx === currentStepIndex;
                    const progressPct = isActiveStep
                      ? Math.min(100, Math.round((beatsInCurrentStep / move.beats) * 100))
                      : idx < currentStepIndex
                        ? 100
                        : 0;
                    return (
                      <button
                        key={`${stepMoveId}_${idx}`}
                        type="button"
                        onClick={() => handleSelectStep(idx)}
                        className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                          isActiveStep
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-500 shadow-xs'
                            : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800 hover:border-amber-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 tabular-nums ${
                                isActiveStep
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-indigo-950 dark:text-white truncate">
                                {move.name}
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                {move.kidTip}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                            {move.beats} beats
                          </span>
                        </div>

                        {/* Beat Progress Bar for Current Step */}
                        {isActiveStep && (
                          <div className="mt-2.5 h-1.5 w-full rounded-full bg-amber-200/80 dark:bg-slate-700 overflow-hidden">
                            <div
                              className="h-full bg-amber-500 transition-all duration-150"
                              style={{ width: `${Math.max(12, progressPct)}%` }}
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Upbeat Track Switcher for this Lesson */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-indigo-950 dark:text-white">Music:</span>{' '}
                  {currentTrack.title} · {effectiveBpm} BPM
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const currentIdx = DANCE_TRACKS.findIndex((t) => t.id === selectedTrackId);
                    const nextTrack = DANCE_TRACKS[(currentIdx + 1) % DANCE_TRACKS.length];
                    setSelectedTrackId(nextTrack.id);
                    danceAudioEngine.setTrack(nextTrack.id);
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-indigo-950 dark:text-white hover:bg-amber-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Switch Song
                </button>
              </div>
            </>
          )}

          {mode === 'party' && (
            <div className="space-y-5">
              {/* Song Picker */}
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-indigo-950 dark:text-white">
                  Pick an Upbeat Party Track
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {DANCE_TRACKS.map((track) => {
                    const isCurr = track.id === selectedTrackId;
                    return (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => {
                          setSelectedTrackId(track.id);
                          danceAudioEngine.setTrack(track.id);
                          if (!isPlaying) {
                            danceAudioEngine.start(track.id);
                            setIsPlaying(true);
                          }
                        }}
                        className={`text-left px-3 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                          isCurr
                            ? 'bg-pink-50 dark:bg-pink-950/40 border-pink-400 dark:border-pink-600'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-pink-300'
                        }`}
                      >
                        <p className="text-xs font-bold text-indigo-950 dark:text-white truncate">
                          {track.title}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
                          {track.bpm} BPM
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tap-to-Dance Freestyle Move Buttons */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-indigo-950 dark:text-white">
                  Tap a Dance Move for {activeChild.name}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
                  {FREESTYLE_PARTY_MOVES.map((mId) => {
                    const move = DANCE_MOVES[mId];
                    const active = partyMoveId === mId;
                    return (
                      <button
                        key={mId}
                        type="button"
                        onClick={() => handleTriggerPartyMove(mId)}
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-transform active:scale-95 whitespace-nowrap cursor-pointer ${
                          active
                            ? `${move.badgeColorClass} ring-2 ring-offset-1 ring-indigo-950 dark:ring-white dark:ring-offset-slate-900`
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-amber-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {move.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interactive DJ Soundboard FX Pads */}
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-indigo-950 dark:text-white">
                  DJ Sound Effects Pad
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {DJ_FX_PADS.map((pad) => (
                    <button
                      key={pad.id}
                      type="button"
                      onClick={() => handleTriggerDjPad(pad.id, pad.label)}
                      className={`min-h-[52px] px-2.5 py-2 rounded-xl text-center shadow-xs transition-transform active:scale-95 cursor-pointer ${pad.btnClass}`}
                    >
                      <span className="block text-xs font-extrabold leading-tight whitespace-nowrap">
                        {pad.label}
                      </span>
                      <span className="block text-[10px] opacity-90 leading-tight mt-0.5 truncate">
                        {pad.sublabel}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {mode === 'freeze' && (
            <div className="flex flex-col justify-between h-full space-y-5">
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-indigo-950 dark:text-white">
                  How to Play Freeze Dance
                </h2>
                <ol className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-md bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      Press <strong>Start Freeze Dance</strong> and dance your heart out while the
                      upbeat music plays.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-md bg-sky-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      When the music scratches to a stop and the stage turns icy blue,{' '}
                      <strong>freeze your body like a statue!</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-md bg-emerald-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      Tap <strong>FREEZE NOW!</strong> (or press the Spacebar) before the timer runs
                      out to earn <strong>+2 Dance Stars</strong> and grow your streak.
                    </span>
                  </li>
                </ol>
              </div>

              {/* Clean Freeze Streak Score Readout */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300">
                    <Flame className="w-4 h-4" aria-hidden="true" />
                    Current Streak
                  </div>
                  <p className="text-2xl font-extrabold text-indigo-950 dark:text-white tabular-nums mt-1">
                    {freezeStreak}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <Trophy className="w-4 h-4" aria-hidden="true" />
                    Best Streak
                  </div>
                  <p className="text-2xl font-extrabold text-indigo-950 dark:text-white tabular-nums mt-1">
                    {progress.bestFreezeStreak}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
      )}

      {/* Dance Class Library: 6 Guided Upbeat Dances */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-indigo-950 dark:text-white">
              Guided Dance Classes
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Choose a dance style for {activeChild.name} to learn step by step with upbeat music.
            </p>
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
            {DANCE_ROUTINES.length} interactive routines · {progress.movesPracticed} moves practiced
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {DANCE_ROUTINES.map((routine) => {
            const track = getDanceTrackById(routine.trackId);
            const completedCount = progress.routinesCompleted[routine.id] ?? 0;
            const isSelected = mode === 'learn' && selectedRoutineId === routine.id;

            return (
              <article
                key={routine.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all ${
                  isSelected
                    ? `${routine.borderAccent} ring-2 ring-amber-400/70 shadow-sm`
                    : 'border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${routine.accentGradient} text-white flex items-center justify-center shrink-0`}
                    >
                      <Music className="w-5 h-5" aria-hidden="true" />
                    </div>
                    {completedCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                        <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                        Done {completedCount}×
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-indigo-950 dark:text-white">
                      {routine.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      {routine.ageRange} · {routine.difficulty} · {routine.steps.length} moves ·{' '}
                      {track.bpm} BPM
                    </p>
                  </div>

                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {routine.subtitle}
                  </p>

                  {/* Unboxed Move Sequence Preview */}
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Moves:{' '}
                    {routine.steps.map((s) => DANCE_MOVES[s].shortLabel).join(' → ')}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleSelectRoutine(routine, true)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-950 hover:bg-indigo-900 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-4 h-4" aria-hidden="true" />
                    Dance Now
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectRoutine(routine, false)}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Preview
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Bluetooth / Wireless Speaker Cast & Loud Party Boost Modal */}
      {isSpeakerModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cast-speaker-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setIsSpeakerModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
                  <Bluetooth className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="cast-speaker-title"
                    className="text-lg font-bold text-indigo-950 dark:text-white"
                  >
                    Cast to Bluetooth Speaker
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Route both Dance Music &amp; Dance Coach to a loud external speaker
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSpeakerModalOpen(false)}
                aria-label="Close speaker settings"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[78vh] overflow-y-auto">
              {/* 1. Loud Party Boost (Mastering Limiter Gain for quiet iPads & laptops) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-indigo-950 dark:text-white">
                    Loud Party Volume Boost
                  </h3>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {Math.round(loudnessBoost * 100)}% Output · Built-in Anti-Clip Limiter
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { level: 1.0 as LoudnessBoostLevel, title: 'Normal', sub: '100%' },
                      { level: 1.5 as LoudnessBoostLevel, title: 'Loud Room', sub: '150%' },
                      { level: 2.0 as LoudnessBoostLevel, title: 'Max Party', sub: '200%' },
                    ] as const
                  ).map((opt) => {
                    const active = loudnessBoost === opt.level;
                    return (
                      <button
                        key={opt.level}
                        type="button"
                        onClick={() => {
                          setLoudnessBoost(opt.level);
                          danceAudioEngine.setLoudnessBoost(opt.level);
                          if (isMuted) {
                            setIsMuted(false);
                            danceAudioEngine.setMuted(false);
                          }
                          danceAudioEngine.playSpeakerTestSound();
                        }}
                        className={`p-3 rounded-xl border text-center transition-colors cursor-pointer ${
                          active
                            ? 'bg-amber-400 border-amber-500 text-slate-950 font-extrabold shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-amber-400'
                        }`}
                      >
                        <span className="block text-sm font-bold">{opt.title}</span>
                        <span className="block text-xs opacity-80 tabular-nums">{opt.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Native Wireless / AirPlay Cast Button (iPad, iPhone, Mac, Chrome/Android) */}
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await danceAudioEngine.openNativeSpeakerCastPicker();
                      setSpeakerStatusNote(result.message);
                    }}
                    className="flex-1 min-w-[200px] px-4 py-3 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <Cast className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {castCaps.canAirPlay
                      ? 'Open AirPlay / Bluetooth Picker'
                      : 'Cast to Wireless Speaker'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isMuted) {
                        setIsMuted(false);
                        danceAudioEngine.setMuted(false);
                      }
                      danceAudioEngine.playSpeakerTestSound();
                      setSpeakerStatusNote(
                        `Playing test sound on ${selectedSpeaker.label} at ${Math.round(loudnessBoost * 100)}% volume.`,
                      );
                    }}
                    className="px-4 py-3 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" aria-hidden="true" />
                    Test Speaker
                  </button>
                </div>
              </div>

              {/* 3. Direct Paired Bluetooth / External Speaker Output List (Chrome, Edge, Laptop, Android) */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-indigo-950 dark:text-white">
                    Paired Bluetooth &amp; Audio Speakers
                  </h3>
                  <button
                    type="button"
                    disabled={isScanningSpeakers}
                    onClick={async () => {
                      setIsScanningSpeakers(true);
                      setSpeakerStatusNote(null);
                      const list = await danceAudioEngine.listOutputSpeakers(true);
                      setAvailableSpeakers(list);
                      setIsScanningSpeakers(false);
                      setSpeakerStatusNote(
                        list.length > 1
                          ? `Found ${list.length} audio outputs — tap your Bluetooth speaker below.`
                          : 'Pair your Bluetooth speaker in device Bluetooth Settings, then tap Scan Again.',
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-sky-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isScanningSpeakers ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    {isScanningSpeakers ? 'Scanning...' : 'Scan Bluetooth Speakers'}
                  </button>
                </div>

                <div className="space-y-2">
                  {availableSpeakers.map((spk) => {
                    const isCurrent = selectedSpeaker.deviceId === spk.deviceId;
                    return (
                      <button
                        key={spk.deviceId}
                        type="button"
                        onClick={async () => {
                          const res = await danceAudioEngine.selectOutputSpeaker(
                            spk.deviceId,
                            spk.label,
                          );
                          setSelectedSpeaker({ deviceId: spk.deviceId, label: spk.label });
                          if (res.ok) {
                            danceAudioEngine.playSpeakerTestSound();
                            setSpeakerStatusNote(
                              `Connected! Dance music and coach voice now play on ${spk.label}.`,
                            );
                          } else if (res.error) {
                            setSpeakerStatusNote(res.error);
                          }
                        }}
                        className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border text-left transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400 dark:border-sky-600'
                            : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-sky-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Speaker
                            className={`w-4 h-4 shrink-0 ${
                              isCurrent ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500'
                            }`}
                            aria-hidden="true"
                          />
                          <span className="text-sm font-semibold text-indigo-950 dark:text-white truncate">
                            {spk.label}
                          </span>
                        </div>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 dark:text-sky-300 shrink-0">
                            <Check className="w-4 h-4" aria-hidden="true" />
                            Active
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {speakerStatusNote && (
                <p className="text-xs font-medium text-sky-900 dark:text-sky-200 bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 rounded-xl px-3.5 py-2.5">
                  {speakerStatusNote}
                </p>
              )}

              {/* Quick iPad / Laptop Bluetooth Helper */}
              <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  Using an iPad, iPhone, or Laptop Bluetooth Speaker?
                </p>
                <p>
                  Pair your speaker (JBL, Bose, Echo, Sonos, HomePod) once in{' '}
                  <strong>Settings → Bluetooth</strong> or swipe down for{' '}
                  <strong>Control Center → Audio Output</strong>. Turn on{' '}
                  <strong>Max Party (200%)</strong> above for extra-loud, clean bass without
                  clipping.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
