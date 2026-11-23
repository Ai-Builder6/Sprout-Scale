export type DanceTrackId =
  | 'sunny_pop'
  | 'funky_robot'
  | 'jungle_safari'
  | 'disco_rainbow'
  | 'rocket_shuffle'
  | 'freeze_party';

export type DjFxId = 'clap' | 'boing' | 'sparkle' | 'bongo' | 'horn' | 'cheer';

export type LoudnessBoostLevel = 1.0 | 1.5 | 2.0;

export interface AudioOutputSpeaker {
  deviceId: string;
  label: string;
  isDefault: boolean;
}

export interface SpeakerCastCapabilities {
  canSelectOutputDevice: boolean;
  canAirPlay: boolean;
  canRemoteCast: boolean;
}

interface ExtendedAudioElement extends HTMLAudioElement {
  webkitShowPlaybackTargetPicker?: () => void;
}

interface ExtendedAudioContext extends AudioContext {
  setSinkId?: (sinkId: string) => Promise<void>;
}

export interface DanceTrackDefinition {
  id: DanceTrackId;
  title: string;
  vibe: string;
  bpm: number;
  accentHex: string;
  leadWave: OscillatorType;
  bassWave: OscillatorType;
  melody: number[];
  bass: number[];
  chords: number[][];
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
  private ctx: ExtendedAudioContext | null = null;
  private instrumentBus: GainNode | null = null;
  private bassWarmthFilter: BiquadFilterNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private streamDest: MediaStreamAudioDestinationNode | null = null;
  private castAudioEl: ExtendedAudioElement | null = null;
  private isRoutingViaMediaElement = false;
  private noiseBuffer: AudioBuffer | null = null;
  private schedulerTimer: number | null = null;

  private isPlaying = false;
  private isMuted = false;
  private isDucked = false;
  private baseVolume = 0.92;
  private loudnessBoost: LoudnessBoostLevel = 1.5;
  private selectedSinkId = 'default';
  private selectedSpeakerLabel = 'Device Speaker (Default)';
  private tempoMultiplier = 1.0;
  private currentTrack: DanceTrackDefinition = DANCE_TRACKS[0];
  private currentStep = 0;
  private totalBeats = 0;
  private nextNoteTime = 0;
  private beatListeners = new Set<BeatListener>();
  private pendingUiTimers: number[] = [];

  private ensureContext(): ExtendedAudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx() as ExtendedAudioContext;
      this.ctx = ctx;

      // Mastering chain: Instruments -> Warm Punch EQ -> Limiter -> Master Volume/Boost -> Output
      const bus = ctx.createGain();
      bus.gain.value = 1.15;

      const bassShelf = ctx.createBiquadFilter();
      bassShelf.type = 'lowshelf';
      bassShelf.frequency.value = 135;
      bassShelf.gain.value = 3.5;

      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -9;
      limiter.knee.value = 10;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.14;

      const master = ctx.createGain();
      master.gain.value = this.computeTargetGain();

      bus.connect(bassShelf);
      bassShelf.connect(limiter);
      limiter.connect(master);
      master.connect(ctx.destination);

      this.instrumentBus = bus;
      this.bassWarmthFilter = bassShelf;
      this.limiter = limiter;
      this.masterGain = master;
      this.noiseBuffer = this.createNoiseBuffer(ctx);

      if (this.selectedSinkId && this.selectedSinkId !== 'default') {
        void this.applySinkToActivePipeline(this.selectedSinkId);
      }
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {
        // Browser will resume on next user gesture
      });
    }
    return this.ctx;
  }

  /**
   * Routes the mastered Web Audio stream through a real HTMLAudioElement so
   * AirPlay (iPad/iPhone/Mac), Remote Playback / Cast (Chrome/Android), and
   * Bluetooth output selection via `setSinkId` all work reliably.
   */
  private ensureCastMediaElement(): ExtendedAudioElement | null {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return null;

    if (!this.castAudioEl) {
      const audioEl = document.createElement('audio') as ExtendedAudioElement;
      audioEl.autoplay = true;
      audioEl.setAttribute('playsinline', 'true');
      audioEl.setAttribute('x-webkit-airplay', 'allow');
      audioEl.volume = 1.0;
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
      this.castAudioEl = audioEl;
    }

    if (!this.streamDest && typeof ctx.createMediaStreamDestination === 'function') {
      try {
        this.streamDest = ctx.createMediaStreamDestination();
        this.castAudioEl.srcObject = this.streamDest.stream;
      } catch {
        return this.castAudioEl;
      }
    }

    if (!this.isRoutingViaMediaElement && this.streamDest) {
      try {
        // Disconnect direct ctx.destination so audio plays once cleanly via the castable media element
        this.masterGain.disconnect();
        this.masterGain.connect(this.streamDest);
        this.isRoutingViaMediaElement = true;
      } catch {
        // Keep fallback connection intact
      }
    }

    if (this.castAudioEl.paused) {
      void this.castAudioEl.play().catch(() => {
        // If autoplay is blocked, safely restore direct destination so music never goes silent
        this.restoreDirectDestination();
      });
    }

    return this.castAudioEl;
  }

  private restoreDirectDestination(): void {
    if (!this.ctx || !this.masterGain) return;
    try {
      this.masterGain.disconnect();
      this.masterGain.connect(this.ctx.destination);
      this.isRoutingViaMediaElement = false;
    } catch {
      // Ignore disconnect errors
    }
  }

  private computeTargetGain(): number {
    if (this.isMuted) return 0;
    const duckFactor = this.isDucked ? 0.44 : 1.0;
    return this.baseVolume * this.loudnessBoost * duckFactor;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.max(1, Math.floor(ctx.sampleRate * 0.4));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private updateMasterGain(): void {
    if (!this.ctx || !this.masterGain) return;
    const target = this.computeTargetGain();
    try {
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.035);
    } catch {
      this.masterGain.gain.value = target;
    }
  }

  private updateMediaSession(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.currentTrack.title,
        artist: 'SproutScale Dance Playhouse',
        album: this.currentTrack.vibe,
      });
      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
    } catch {
      // MediaSession optional
    }
  }

  public getCastCapabilities(): SpeakerCastCapabilities {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { canSelectOutputDevice: false, canAirPlay: false, canRemoteCast: false };
    }
    const probe = document.createElement('audio') as ExtendedAudioElement;
    const canSelectViaAudio = typeof probe.setSinkId === 'function';
    const canSelectViaMediaDevices =
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.enumerateDevices === 'function';
    const canAirPlay = typeof probe.webkitShowPlaybackTargetPicker === 'function';
    const canRemoteCast = !!probe.remote && typeof probe.remote.prompt === 'function';

    return {
      canSelectOutputDevice: canSelectViaAudio && canSelectViaMediaDevices,
      canAirPlay,
      canRemoteCast,
    };
  }

  public async listOutputSpeakers(requestLabels = false): Promise<AudioOutputSpeaker[]> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.enumerateDevices !== 'function'
    ) {
      return [{ deviceId: 'default', label: 'Device Speaker (Default)', isDefault: true }];
    }

    try {
      // Optional one-time permission grant reveals real Bluetooth speaker names (e.g. "JBL Flip 6")
      if (requestLabels && typeof navigator.mediaDevices.getUserMedia === 'function') {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          tempStream.getTracks().forEach((t) => t.stop());
        } catch {
          // User declined mic permission — still list available output devices gracefully
        }
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter((d) => d.kind === 'audiooutput');
      if (outputs.length === 0) {
        return [{ deviceId: 'default', label: 'Device Speaker (Default)', isDefault: true }];
      }

      return outputs.map((d, idx) => {
        const isDefault = d.deviceId === 'default' || d.deviceId === '';
        const cleanLabel =
          d.label && d.label.trim().length > 0
            ? d.label.trim()
            : isDefault
              ? 'Device Speaker (Default)'
              : `External / Bluetooth Speaker ${idx}`;
        return {
          deviceId: d.deviceId || 'default',
          label: cleanLabel,
          isDefault,
        };
      });
    } catch {
      return [{ deviceId: 'default', label: 'Device Speaker (Default)', isDefault: true }];
    }
  }

  private async applySinkToActivePipeline(sinkId: string): Promise<boolean> {
    let routed = false;
    const ctx = this.ensureContext();

    // 1. Try modern AudioContext.setSinkId directly (Chrome 110+)
    if (ctx && typeof ctx.setSinkId === 'function' && !this.isRoutingViaMediaElement) {
      try {
        await ctx.setSinkId(sinkId === 'default' ? '' : sinkId);
        routed = true;
      } catch {
        // Fall through to HTMLAudioElement.setSinkId
      }
    }

    // 2. Also route through HTMLAudioElement.setSinkId if AudioContext.setSinkId wasn't available
    if (!routed) {
      const el = this.ensureCastMediaElement();
      if (el && typeof el.setSinkId === 'function') {
        try {
          await el.setSinkId(sinkId);
          routed = true;
        } catch {
          this.restoreDirectDestination();
        }
      }
    }

    return routed;
  }

  public async selectOutputSpeaker(
    deviceId: string,
    label?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    this.selectedSinkId = deviceId || 'default';
    this.selectedSpeakerLabel = label || 'Device Speaker (Default)';

    try {
      const ok = await this.applySinkToActivePipeline(this.selectedSinkId);
      if (!ok && this.selectedSinkId !== 'default') {
        return {
          ok: false,
          error:
            'Your browser manages Bluetooth output at the device level — connect your Bluetooth speaker in device Settings or Control Center, and SproutScale will play straight through it!',
        };
      }
      return { ok: true };
    } catch {
      return {
        ok: false,
        error:
          'Could not switch speaker automatically. Connect your Bluetooth speaker in your device settings and tap Test Speaker.',
      };
    }
  }

  public getSelectedSpeaker(): { deviceId: string; label: string } {
    return {
      deviceId: this.selectedSinkId,
      label: this.selectedSpeakerLabel,
    };
  }

  /**
   * Opens the native wireless speaker cast picker:
   * - iPad / iPhone / Mac Safari: AirPlay & Bluetooth Audio Route Picker
   * - Chrome / Android / Edge: Remote Playback / Cast Speaker Picker
   */
  public async openNativeSpeakerCastPicker(): Promise<{
    opened: boolean;
    method: 'airplay' | 'remote' | 'unsupported';
    message: string;
  }> {
    const el = this.ensureCastMediaElement();
    if (!el) {
      return {
        opened: false,
        method: 'unsupported',
        message: 'Connect your Bluetooth speaker in your device Bluetooth settings.',
      };
    }

    // Play a gentle sparkle tone so iOS/Safari recognizes an active media stream for AirPlay
    this.playDjFx('sparkle');

    if (typeof el.webkitShowPlaybackTargetPicker === 'function') {
      try {
        el.webkitShowPlaybackTargetPicker();
        return {
          opened: true,
          method: 'airplay',
          message: 'Choose your Bluetooth or AirPlay speaker from the picker.',
        };
      } catch {
        // Fall through
      }
    }

    if (el.remote && typeof el.remote.prompt === 'function') {
      try {
        await el.remote.prompt();
        return {
          opened: true,
          method: 'remote',
          message: 'Wireless speaker picker opened!',
        };
      } catch (err) {
        const errName = err instanceof Error ? err.name : '';
        if (errName === 'NotFoundError') {
          return {
            opened: false,
            method: 'remote',
            message:
              'No Cast speakers found on Wi-Fi yet. For Bluetooth speakers, pair in Bluetooth settings or select from the speaker list below.',
          };
        }
        if (errName === 'NotAllowedError' || errName === 'AbortError') {
          return {
            opened: false,
            method: 'remote',
            message: 'Speaker picker closed.',
          };
        }
      }
    }

    return {
      opened: false,
      method: 'unsupported',
      message:
        'Pick your paired Bluetooth speaker from the list below, or connect in your device Bluetooth settings.',
    };
  }

  public setLoudnessBoost(level: LoudnessBoostLevel): void {
    this.loudnessBoost = level;
    if (this.bassWarmthFilter && this.ctx) {
      const bassGain = level >= 2.0 ? 5.0 : level >= 1.5 ? 4.0 : 2.5;
      try {
        this.bassWarmthFilter.gain.setTargetAtTime(bassGain, this.ctx.currentTime, 0.05);
      } catch {
        this.bassWarmthFilter.gain.value = bassGain;
      }
    }
    this.updateMasterGain();
  }

  public getLoudnessBoost(): LoudnessBoostLevel {
    return this.loudnessBoost;
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
    this.updateMediaSession();
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

    if (this.isRoutingViaMediaElement && this.castAudioEl && this.castAudioEl.paused) {
      void this.castAudioEl.play().catch(() => {
        this.restoreDirectDestination();
      });
    }

    if (this.isPlaying) {
      this.updateMediaSession();
      return;
    }

    this.isPlaying = true;
    this.currentStep = 0;
    this.totalBeats = 0;
    this.updateMediaSession();

    const beginScheduler = () => {
      if (!this.isPlaying || !this.ctx) return;
      this.nextNoteTime = this.ctx.currentTime + 0.05;
      if (this.schedulerTimer !== null) {
        window.clearInterval(this.schedulerTimer);
      }
      this.schedulerTimer = window.setInterval(() => {
        this.scheduler();
      }, 25);
    };

    if (ctx.state === 'suspended') {
      void ctx
        .resume()
        .then(beginScheduler)
        .catch(() => {
          beginScheduler();
        });
    } else {
      beginScheduler();
    }
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
    this.updateMediaSession();
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private scheduler(): void {
    if (!this.isPlaying || !this.ctx) return;
    if (this.ctx.state !== 'running') return;

    // Guard against tab-background catch-up flood
    if (this.nextNoteTime < this.ctx.currentTime - 0.25) {
      this.nextNoteTime = this.ctx.currentTime + 0.04;
    }

    const scheduleAheadTime = 0.12;
    let guard = 0;
    while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime && guard < 8) {
      guard += 1;
      this.scheduleStep(this.currentStep, Math.max(this.nextNoteTime, this.ctx.currentTime));
      const effectiveBpm = this.currentTrack.bpm * this.tempoMultiplier;
      const secondsPer16th = 60.0 / effectiveBpm / 4.0;
      this.nextNoteTime += secondsPer16th;
      this.currentStep = (this.currentStep + 1) % 32;
    }
  }

  private scheduleStep(step: number, time: number): void {
    const ctx = this.ctx;
    const bus = this.instrumentBus;
    if (!ctx || !bus) return;

    const track = this.currentTrack;
    const drumStep = step % 16;

    if (track.kick[drumStep]) {
      this.playKick(ctx, bus, time);
    }

    if (track.snare[drumStep]) {
      this.playSnareClap(ctx, bus, time);
    }

    if (track.hat[drumStep]) {
      this.playHiHat(ctx, bus, time, drumStep % 4 === 2 ? 0.06 : 0.032);
    }

    if (track.bongo && track.bongo[drumStep]) {
      this.playBongo(ctx, bus, time, drumStep % 2 === 0 ? 290 : 410);
    }

    const bassMidi = track.bass[step];
    if (bassMidi > 0) {
      this.playSynthNote(ctx, bus, time, midiToFreq(bassMidi), 0.16, track.bassWave, 0.24, 720);
    }

    if (step % 4 === 0) {
      const chordIdx = Math.floor(step / 4) % track.chords.length;
      const chord = track.chords[chordIdx];
      if (chord) {
        for (const midi of chord) {
          this.playSynthNote(ctx, bus, time, midiToFreq(midi), 0.26, 'triangle', 0.06, 2400);
        }
      }

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

    const leadMidi = track.melody[step];
    if (leadMidi > 0) {
      const leadVol = track.leadWave === 'square' || track.leadWave === 'sawtooth' ? 0.105 : 0.21;
      this.playSynthNote(
        ctx,
        bus,
        time,
        midiToFreq(leadMidi),
        0.19,
        track.leadWave,
        leadVol,
        3100,
      );
    }
  }

  private playKick(ctx: AudioContext, dest: AudioNode, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(148, time);
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.11);
    gain.gain.setValueAtTime(0.5, time);
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
      filter.frequency.value = 1600;
      filter.Q.value = 1.1;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.24, time);
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
    osc.frequency.setValueAtTime(215, time);
    osc.frequency.exponentialRampToValueAtTime(95, time + 0.07);
    gain.gain.setValueAtTime(0.18, time);
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
    gain.gain.setValueAtTime(0.09, time);
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
    gain.gain.setValueAtTime(0.2, time);
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

    gain.gain.setValueAtTime(0.0005, time);
    gain.gain.linearRampToValueAtTime(Math.max(0.001, peakGain), time + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0008, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  public playSpeakerTestSound(): void {
    const ctx = this.ensureContext();
    const bus = this.instrumentBus;
    if (!ctx || !bus || this.isMuted) return;
    const now = ctx.currentTime + 0.02;
    this.playKick(ctx, bus, now);
    this.playSnareClap(ctx, bus, now + 0.22);
    const notes = [60, 64, 67, 72, 76, 79];
    notes.forEach((m, i) => {
      this.playSynthNote(ctx, bus, now + i * 0.075, midiToFreq(m), 0.28, 'triangle', 0.25, 3800);
    });
  }

  public playFreezeScratch(): void {
    const ctx = this.ensureContext();
    const bus = this.instrumentBus;
    if (!ctx || !bus || this.isMuted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.24);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  public playDjFx(fx: DjFxId): void {
    const ctx = this.ensureContext();
    const bus = this.instrumentBus;
    if (!ctx || !bus || this.isMuted) return;
    const now = ctx.currentTime;

    if (fx === 'clap') {
      this.playSnareClap(ctx, bus, now);
      this.playSnareClap(ctx, bus, now + 0.045);
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
      gain.gain.setValueAtTime(0.34, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(now);
      osc.stop(now + 0.39);
      return;
    }

    if (fx === 'sparkle') {
      const notes = [72, 76, 79, 84, 88];
      notes.forEach((m, i) => {
        this.playSynthNote(ctx, bus, now + i * 0.055, midiToFreq(m), 0.22, 'triangle', 0.24, 4200);
      });
      return;
    }

    if (fx === 'bongo') {
      this.playBongo(ctx, bus, now, 310);
      this.playBongo(ctx, bus, now + 0.09, 430);
      this.playBongo(ctx, bus, now + 0.18, 360);
      this.playBongo(ctx, bus, now + 0.26, 480);
      return;
    }

    if (fx === 'horn') {
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((f) => {
        this.playSynthNote(ctx, bus, now, f, 0.13, 'sawtooth', 0.1, 2600);
        this.playSynthNote(ctx, bus, now + 0.16, f * 1.12, 0.28, 'sawtooth', 0.11, 2800);
      });
      return;
    }

    if (fx === 'cheer') {
      const fanfare = [60, 64, 67, 72, 76, 79, 84];
      fanfare.forEach((m, i) => {
        this.playSynthNote(ctx, bus, now + i * 0.055, midiToFreq(m), 0.28, 'triangle', 0.22, 3600);
      });
    }
  }
}

export const danceAudioEngine = new DancePlayhouseAudioEngine();
