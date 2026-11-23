export type DanceTrackId =
  | 'sunny_pop'
  | 'funky_robot'
  | 'jungle_safari'
  | 'disco_rainbow'
  | 'rocket_shuffle'
  | 'freeze_party';

export type DjFxId = 'clap' | 'boing' | 'sparkle' | 'bongo' | 'horn' | 'cheer';

export interface DanceTrackDefinition {
  id: DanceTrackId;
  title: string;
  vibe: string;
  bpm: number;
  accentHex: string;
  leadWave: OscillatorType;
  bassWave: OscillatorType;
  /** 32-step (2-bar 16th-note) melody in MIDI notes (0 = rest) */
  melody: number[];
  /** 32-step bassline in MIDI notes (0 = rest) */
  bass: number[];
  /** 4-bar chord roots/triads played on beats (every 4 steps) */
  chords: number[][];
  /** 16-step drum pattern (repeats each bar): 1 = hit */
  kick: number[];
  snare: number[];
  hat: number[];
  bongo?: number[];
}

export const DANCE_TRACKS: DanceTrackDefinition[] = [
  {
    id: 'sunny_pop',
    title: 'Sunny Pop Bounce',
    vibe: 'Happy Kids Pop · Bouncy Claps',
    bpm: 118,
    accentHex: '#f59e0b',
    leadWave: 'triangle',
    bassWave: 'triangle',
    // C major joyful bouncy pop hook (C5=72, D5=74, E5=76, G5=79, A5=81, C6=84)
    melody: [
      72, 0, 76, 0, 79, 0, 76, 79, 81, 0, 79, 0, 76, 0, 74, 0,
      72, 0, 74, 76, 79, 0, 84, 0, 81, 0, 79, 76, 74, 0, 72, 0,
    ],
    bass: [
      48, 0, 0, 48, 55, 0, 48, 0, 53, 0, 0, 53, 55, 0, 50, 0,
      48, 0, 0, 48, 55, 0, 52, 0, 53, 0, 55, 0, 48, 0, 55, 0,
    ],
    chords: [
      [60, 64, 67],
      [60, 64, 67],
      [65, 69, 72],
      [67, 71, 74],
      [60, 64, 67],
      [64, 67, 72],
      [65, 69, 72],
      [67, 71, 74],
    ],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1],
  },
  {
    id: 'funky_robot',
    title: 'Funky Robot Groove',
    vibe: 'Playful Electro-Funk · Beep Boop',
    bpm: 112,
    accentHex: '#0ea5e9',
    leadWave: 'square',
    bassWave: 'sawtooth',
    // A minor / C major funky robot melody (A4=69, C5=72, D5=74, E5=76, G5=79, A5=81)
    melody: [
      69, 0, 72, 0, 76, 0, 72, 0, 79, 0, 76, 74, 72, 0, 69, 0,
      72, 0, 74, 0, 76, 0, 81, 0, 79, 76, 74, 72, 76, 0, 69, 0,
    ],
    bass: [
      45, 0, 45, 0, 48, 0, 50, 0, 52, 0, 0, 50, 48, 0, 45, 0,
      45, 0, 48, 0, 50, 0, 52, 0, 55, 0, 52, 0, 48, 0, 45, 0,
    ],
    chords: [
      [57, 60, 64],
      [60, 64, 67],
      [62, 65, 69],
      [64, 67, 71],
      [57, 60, 64],
      [60, 64, 67],
      [65, 69, 72],
      [64, 67, 71],
    ],
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hat: [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1],
  },
  {
    id: 'jungle_safari',
    title: 'Jungle Safari Hop',
    vibe: 'Sunny Marimba · Bongo Drums',
    bpm: 124,
    accentHex: '#10b981',
    leadWave: 'sine',
    bassWave: 'triangle',
    // G major bouncy jungle marimba (G4=67, A4=69, B4=71, D5=74, E5=76, G5=79)
    melody: [
      67, 71, 74, 0, 76, 0, 74, 71, 79, 0, 76, 74, 71, 0, 69, 0,
      67, 0, 71, 74, 79, 0, 81, 0, 79, 76, 74, 71, 69, 71, 67, 0,
    ],
    bass: [
      43, 0, 0, 43, 50, 0, 43, 0, 48, 0, 0, 48, 50, 0, 47, 0,
      43, 0, 47, 0, 50, 0, 48, 0, 50, 0, 45, 0, 43, 0, 50, 0,
    ],
    chords: [
      [55, 59, 62],
      [55, 59, 62],
      [60, 64, 67],
      [62, 66, 69],
      [55, 59, 62],
      [60, 64, 67],
      [62, 66, 69],
      [55, 59, 62],
    ],
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0],
    bongo: [0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0],
  },
  {
    id: 'disco_rainbow',
    title: 'Disco Rainbow Boogie',
    vibe: 'Sparkly Four-on-the-Floor Disco',
    bpm: 122,
    accentHex: '#ec4899',
    leadWave: 'triangle',
    bassWave: 'sawtooth',
    // D major glittery disco (D5=74, E5=76, F#5=78, A5=81, B5=83, D6=86)
    melody: [
      74, 0, 78, 0, 81, 0, 83, 81, 78, 0, 76, 0, 74, 0, 78, 0,
      81, 0, 83, 0, 86, 0, 83, 81, 78, 76, 74, 0, 76, 78, 74, 0,
    ],
    bass: [
      50, 62, 50, 62, 55, 67, 55, 67, 57, 69, 57, 69, 50, 62, 57, 69,
      50, 62, 50, 62, 55, 67, 55, 67, 57, 69, 52, 64, 50, 62, 50, 0,
    ],
    chords: [
      [62, 66, 69],
      [67, 71, 74],
      [69, 73, 76],
      [62, 66, 69],
      [62, 66, 69],
      [67, 71, 74],
      [69, 73, 76],
      [62, 66, 69],
    ],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
  },
  {
    id: 'rocket_shuffle',
    title: 'Rocket Space Shuffle',
    vibe: 'Turbo Synth-Pop · Blast-Off Beat',
    bpm: 128,
    accentHex: '#6366f1',
    leadWave: 'sawtooth',
    bassWave: 'triangle',
    // F major uplifting synth-pop (F5=77, G5=79, A5=81, C6=84, D6=86)
    melody: [
      77, 0, 81, 0, 84, 0, 81, 79, 77, 79, 81, 0, 84, 0, 86, 0,
      84, 0, 81, 0, 79, 0, 77, 79, 81, 84, 86, 0, 84, 0, 77, 0,
    ],
    bass: [
      53, 0, 53, 0, 53, 0, 57, 0, 58, 0, 58, 0, 60, 0, 55, 0,
      53, 0, 53, 0, 58, 0, 58, 0, 60, 0, 60, 0, 53, 0, 60, 0,
    ],
    chords: [
      [65, 69, 72],
      [65, 69, 72],
      [70, 74, 77],
      [60, 64, 67],
      [65, 69, 72],
      [70, 74, 77],
      [60, 64, 67],
      [65, 69, 72],
    ],
    kick: [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1],
  },
  {
    id: 'freeze_party',
    title: 'Silly Freeze Dance Party',
    vibe: 'High-Energy Party Jam · Jump & Freeze',
    bpm: 120,
    accentHex: '#f97316',
    leadWave: 'triangle',
    bassWave: 'triangle',
    // Bb major cheerful brassy bounce (Bb4=70, C5=72, D5=74, F5=77, G5=79, Bb5=82)
    melody: [
      70, 0, 74, 77, 79, 0, 77, 0, 82, 0, 79, 77, 74, 0, 72, 0,
      70, 72, 74, 0, 77, 0, 82, 0, 79, 77, 74, 72, 70, 0, 77, 0,
    ],
    bass: [
      46, 0, 0, 46, 53, 0, 46, 0, 51, 0, 0, 51, 53, 0, 48, 0,
      46, 0, 50, 0, 53, 0, 51, 0, 53, 0, 48, 0, 46, 0, 53, 0,
    ],
    chords: [
      [58, 62, 65],
      [58, 62, 65],
      [63, 67, 70],
      [65, 69, 72],
      [58, 62, 65],
      [63, 67, 70],
      [65, 69, 72],
      [58, 62, 65],
    ],
    kick: [1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1],
    bongo: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1],
  },
];

export function getDanceTrackById(trackId: DanceTrackId): DanceTrackDefinition {
  return DANCE_TRACKS.find((t) => t.id === trackId) ?? DANCE_TRACKS[0];
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export type BeatListener = (info: {
  beatIndex: number;
  beatInBar: number;
  stepIndex: number;
  trackId: DanceTrackId;
}) => void;

class DancePlayhouseAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private schedulerTimer: number | null = null;

  private isPlaying = false;
  private isMuted = false;
  private isDucked = false;
  private volume = 0.78;
  private tempoMultiplier = 1.0;
  private currentTrack: DanceTrackDefinition = DANCE_TRACKS[0];
  private currentStep = 0;
  private totalBeats = 0;
  private nextNoteTime = 0;
  private beatListeners = new Set<BeatListener>();
  private pendingUiTimers: number[] = [];

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private updateMasterGain(): void {
    if (!this.ctx || !this.masterGain) return;
    const target = this.isMuted ? 0 : this.isDucked ? this.volume * 0.42 : this.volume;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.updateMasterGain();
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setDucked(ducked: boolean): void {
    this.isDucked = ducked;
    this.updateMasterGain();
  }

  public setTempoMultiplier(mult: number): void {
    this.tempoMultiplier = Math.max(0.75, Math.min(1.25, mult));
  }

  public getEffectiveBpm(): number {
    return Math.round(this.currentTrack.bpm * this.tempoMultiplier);
  }

  public setTrack(trackId: DanceTrackId): void {
    this.currentTrack = getDanceTrackById(trackId);
  }

  public onBeat(listener: BeatListener): () => void {
    this.beatListeners.add(listener);
    return () => {
      this.beatListeners.delete(listener);
    };
  }

  public start(trackId?: DanceTrackId): void {
    if (trackId) {
      this.currentTrack = getDanceTrackById(trackId);
    }
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;
    this.totalBeats = 0;
    this.nextNoteTime = ctx.currentTime + 0.05;

    this.schedulerTimer = window.setInterval(() => {
      this.scheduler();
    }, 25);
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    for (const id of this.pendingUiTimers) {
      window.clearTimeout(id);
    }
    this.pendingUiTimers = [];
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private scheduler(): void {
    if (!this.isPlaying || !this.ctx) return;
    const scheduleAheadTime = 0.12;
    while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
      this.scheduleStep(this.currentStep, this.nextNoteTime);
      const effectiveBpm = this.currentTrack.bpm * this.tempoMultiplier;
      const secondsPer16th = 60.0 / effectiveBpm / 4.0;
      this.nextNoteTime += secondsPer16th;
      this.currentStep = (this.currentStep + 1) % 32;
    }
  }

  private scheduleStep(step: number, time: number): void {
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master) return;

    const track = this.currentTrack;
    const drumStep = step % 16;

    // Kick drum
    if (track.kick[drumStep]) {
      this.playKick(ctx, master, time);
    }

    // Snare / Handclap
    if (track.snare[drumStep]) {
      this.playSnareClap(ctx, master, time);
    }

    // Crisp Hi-hat
    if (track.hat[drumStep]) {
      this.playHiHat(ctx, master, time, drumStep % 4 === 2 ? 0.06 : 0.032);
    }

    // Optional sunny bongo/conga bounce
    if (track.bongo && track.bongo[drumStep]) {
      this.playBongo(ctx, master, time, drumStep % 2 === 0 ? 290 : 410);
    }

    // Bouncy Bassline
    const bassMidi = track.bass[step];
    if (bassMidi > 0) {
      this.playSynthNote(ctx, master, time, midiToFreq(bassMidi), 0.16, track.bassWave, 0.22, 680);
    }

    // Warm Upbeat Chords on every beat (step % 4 === 0)
    if (step % 4 === 0) {
      const chordIdx = Math.floor(step / 4) % track.chords.length;
      const chord = track.chords[chordIdx];
      if (chord) {
        for (const midi of chord) {
          this.playSynthNote(ctx, master, time, midiToFreq(midi), 0.26, 'triangle', 0.055, 2200);
        }
      }

      // Emit exact beat callback synchronized to audio playback time
      const beatIndex = this.totalBeats++;
      const beatInBar = (step / 4) % 4;
      const delayMs = Math.max(0, Math.round((time - ctx.currentTime) * 1000));
      const timerId = window.setTimeout(() => {
        if (!this.isPlaying) return;
        this.beatListeners.forEach((fn) => {
          try {
            fn({ beatIndex, beatInBar, stepIndex: step, trackId: track.id });
          } catch {
            // Keep beat loop resilient
          }
        });
      }, delayMs);
      this.pendingUiTimers.push(timerId);
      if (this.pendingUiTimers.length > 40) {
        this.pendingUiTimers.splice(0, 20);
      }
    }

    // Catchy Lead Melody
    const leadMidi = track.melody[step];
    if (leadMidi > 0) {
      const leadVol = track.leadWave === 'square' || track.leadWave === 'sawtooth' ? 0.095 : 0.19;
      this.playSynthNote(
        ctx,
        master,
        time,
        midiToFreq(leadMidi),
        0.19,
        track.leadWave,
        leadVol,
        2900,
      );
    }
  }

  private playKick(ctx: AudioContext, dest: AudioNode, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);
    gain.gain.setValueAtTime(0.46, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.17);
  }

  private playSnareClap(ctx: AudioContext, dest: AudioNode, time: number): void {
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1550;
      filter.Q.value = 1.1;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      src.start(time);
      src.stop(time + 0.13);
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, time);
    osc.frequency.exponentialRampToValueAtTime(95, time + 0.07);
    gain.gain.setValueAtTime(0.16, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.09);
  }

  private playHiHat(ctx: AudioContext, dest: AudioNode, time: number, dur: number): void {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.085, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(time);
    src.stop(time + dur + 0.01);
  }

  private playBongo(ctx: AudioContext, dest: AudioNode, time: number, pitch: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch * 1.18, time);
    osc.frequency.exponentialRampToValueAtTime(pitch, time + 0.08);
    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.12);
  }

  private playSynthNote(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    freq: number,
    dur: number,
    wave: OscillatorType,
    peakGain: number,
    filterHz: number,
  ): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterHz, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0008, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  /** Play fun record-scratch / freeze halt sound when Freeze Dance triggers */
  public playFreezeScratch(): void {
    const ctx = this.ensureContext();
    const master = this.masterGain;
    if (!ctx || !master || this.isMuted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.24);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  /** Play joyful interactive DJ Soundboard FX pad on top of the beat */
  public playDjFx(fx: DjFxId): void {
    const ctx = this.ensureContext();
    const master = this.masterGain;
    if (!ctx || !master || this.isMuted) return;
    const now = ctx.currentTime;

    if (fx === 'clap') {
      this.playSnareClap(ctx, master, now);
      this.playSnareClap(ctx, master, now + 0.045);
      return;
    }

    if (fx === 'boing') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.14);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.24);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.34);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.39);
      return;
    }

    if (fx === 'sparkle') {
      const notes = [72, 76, 79, 84, 88];
      notes.forEach((m, i) => {
        this.playSynthNote(ctx, master, now + i * 0.055, midiToFreq(m), 0.22, 'triangle', 0.22, 4200);
      });
      return;
    }

    if (fx === 'bongo') {
      this.playBongo(ctx, master, now, 310);
      this.playBongo(ctx, master, now + 0.09, 430);
      this.playBongo(ctx, master, now + 0.18, 360);
      this.playBongo(ctx, master, now + 0.26, 480);
      return;
    }

    if (fx === 'horn') {
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((f) => {
        this.playSynthNote(ctx, master, now, f, 0.13, 'sawtooth', 0.09, 2600);
        this.playSynthNote(ctx, master, now + 0.16, f * 1.12, 0.28, 'sawtooth', 0.1, 2800);
      });
      return;
    }

    if (fx === 'cheer') {
      // Celebratory ascending fanfare + sparkle burst
      const fanfare = [60, 64, 67, 72, 76, 79, 84];
      fanfare.forEach((m, i) => {
        this.playSynthNote(ctx, master, now + i * 0.055, midiToFreq(m), 0.28, 'triangle', 0.2, 3600);
      });
    }
  }
}

export const danceAudioEngine = new DancePlayhouseAudioEngine();
