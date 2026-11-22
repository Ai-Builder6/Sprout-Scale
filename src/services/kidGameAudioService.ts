// Toddler- and kid-safe Web Audio API sound synthesizer (guaranteed resume-before-play)

let audioCtx: AudioContext | null = null;
let globalMuted = false;
const victoryListeners = new Set<() => void>();

export function onKidGameVictory(listener: () => void): () => void {
  victoryListeners.add(listener);
  return () => {
    victoryListeners.delete(listener);
  };
}

function getOrCreateAudioContext(): AudioContext | null {
  if (globalMuted || typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

/**
 * Ensures AudioContext is resumed before scheduling oscillators so the very first tap
 * inside an iframe or Safari/Chrome never gets swallowed silently.
 */
function withReadyAudioContext(scheduleFn: (ctx: AudioContext) => void): void {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx
      .resume()
      .then(() => {
        if (!globalMuted && ctx.state === 'running') {
          scheduleFn(ctx);
        }
      })
      .catch(() => {
        // Ignore browser autoplay rejection until user gesture
      });
    return;
  }

  scheduleFn(ctx);
}

export function unlockKidGameAudio(): void {
  const ctx = getOrCreateAudioContext();
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
}

export function setKidGamesMuted(muted: boolean): void {
  globalMuted = muted;
}

export function isKidGamesMuted(): boolean {
  return globalMuted;
}

/**
 * Cheerful soap-bubble pop sound with gentle ascending musical tone
 */
export function playBubblePopSound(pitchIndex = 0): void {
  withReadyAudioContext((ctx) => {
    const now = ctx.currentTime;
    const pentatonicHz = [392.0, 440.0, 493.88, 523.25, 587.33, 659.25, 783.99];
    const baseFreq = pentatonicHz[Math.abs(pitchIndex) % pentatonicHz.length];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 0.72, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.45, now + 0.085);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  });
}

/**
 * Soft water-droplet plink + rising xylophone sprout note
 */
export function playSproutGrowSound(step: number): void {
  withReadyAudioContext((ctx) => {
    const now = ctx.currentTime;
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
    const freq = scale[Math.min(Math.max(step, 0), scale.length - 1)];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.03, now + 0.18);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  });
}

/**
 * Soft, friendly giggle-boop when a child taps another item (never punitive)
 */
export function playGentleBoopSound(): void {
  withReadyAudioContext((ctx) => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(310, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  });
}

/**
 * Happy double-chime for correct answers
 */
export function playHappyMatchSound(): void {
  withReadyAudioContext((ctx) => {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  });
}

/**
 * Joyful C-E-G-C celebratory xylophone arpeggio for finishing a game
 */
export function playVictoryFanfare(): void {
  victoryListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Never let a listener interrupt game audio
    }
  });
  withReadyAudioContext((ctx) => {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.48);
    });
  });
}

/**
 * Warm wooden xylophone/marimba bar note across C major scale (C4..C5)
 */
export function playXylophoneNote(noteIndex: number): void {
  withReadyAudioContext((ctx) => {
    const now = ctx.currentTime;
    const cMajorHz = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 523.25];
    const freq = cMajorHz[Math.abs(noteIndex) % cMajorHz.length];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.26, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.58);

    const overtone = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 2, now);

    overtoneGain.gain.setValueAtTime(0.001, now);
    overtoneGain.gain.linearRampToValueAtTime(0.08, now + 0.008);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    overtone.connect(overtoneGain);
    overtoneGain.connect(ctx.destination);
    overtone.start(now);
    overtone.stop(now + 0.18);
  });
}

/**
 * Soft playful swish-plink when flipping a memory card
 */
export function playCardFlipSound(): void {
  withReadyAudioContext((ctx) => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.07);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  });
}

/**
 * Warm cuckoo-clock wooden tick & chime for Clock & Daily Routines
 */
export function playClockChimeSound(isOClock = false): void {
  withReadyAudioContext((ctx) => {
    const now = ctx.currentTime;
    const freqs = isOClock ? [587.33, 440.0] : [493.88];
    freqs.forEach((f, i) => {
      const start = now + i * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  });
}

/**
 * Wooden bridge plank snap + bright climb tone for Sight-Word Treasure Bridge
 */
export function playPlankPlaceSound(step = 0): void {
  withReadyAudioContext((ctx) => {
    const now = ctx.currentTime;
    const scale = [329.63, 392.0, 440.0, 523.25, 659.25];
    const freq = scale[Math.abs(step) % scale.length];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.06, now + 0.1);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  });
}

/**
 * Shimmering space star-power chime for Planet Orbit Math & Logic
 */
export function playSpaceChimeSound(planetIdx = 0): void {
  withReadyAudioContext((ctx) => {
    const now = ctx.currentTime;
    const base = 392 + (planetIdx % 5) * 65;
    [base, base * 1.25, base * 1.5].forEach((freq, i) => {
      const start = now + i * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.35);
    });
  });
}
