// Studio-quality client-side Web Audio Offline Synthesizer & WAV Encoder
// Renders crisp 12–16 second celebratory milestone jingles in 4 musical styles,
// optionally layering a real vocal performance WAV (Gemini 3.8 TTS) right over the instruments.

import type { MusicStylePreset } from './growthMusicService';

const NOTE_FREQ: Record<string, number> = {
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
};

interface StyleArrangement {
  bpm: number;
  chords: string[][];
  bassLine: string[];
  melody: { note: string; beatOffset: number; durationBeats: number }[];
  leadWave: OscillatorType;
  chordWave: OscillatorType;
  hasHandclap: boolean;
  hasKick: boolean;
  isArpeggio: boolean;
}

const ARRANGEMENTS: Record<MusicStylePreset, StyleArrangement> = {
  'sunny-folk': {
    bpm: 114,
    chords: [
      ['C4', 'E4', 'G4'],
      ['G3', 'B3', 'D4'],
      ['A3', 'C4', 'E4'],
      ['F3', 'A3', 'C4'],
      ['C4', 'E4', 'G4'],
      ['F3', 'A3', 'C4'],
      ['G3', 'B3', 'D4'],
      ['C4', 'E4', 'G4'],
    ],
    bassLine: ['C3', 'G3', 'A3', 'F3', 'C3', 'F3', 'G3', 'C3'],
    melody: [
      { note: 'E5', beatOffset: 0, durationBeats: 0.75 },
      { note: 'G5', beatOffset: 1, durationBeats: 0.75 },
      { note: 'E5', beatOffset: 2, durationBeats: 1.0 },
      { note: 'D5', beatOffset: 3.5, durationBeats: 0.5 },
      { note: 'D5', beatOffset: 4, durationBeats: 1.0 },
      { note: 'B4', beatOffset: 5.5, durationBeats: 0.5 },
      { note: 'D5', beatOffset: 6, durationBeats: 1.5 },
      { note: 'C5', beatOffset: 8, durationBeats: 0.75 },
      { note: 'E5', beatOffset: 9, durationBeats: 0.75 },
      { note: 'A5', beatOffset: 10, durationBeats: 1.25 },
      { note: 'G5', beatOffset: 12, durationBeats: 0.75 },
      { note: 'F5', beatOffset: 13, durationBeats: 0.75 },
      { note: 'E5', beatOffset: 14, durationBeats: 1.5 },
      { note: 'E5', beatOffset: 16, durationBeats: 0.75 },
      { note: 'G5', beatOffset: 17, durationBeats: 0.75 },
      { note: 'C6', beatOffset: 18, durationBeats: 1.25 },
      { note: 'A5', beatOffset: 20, durationBeats: 0.75 },
      { note: 'F5', beatOffset: 21, durationBeats: 0.75 },
      { note: 'A5', beatOffset: 22, durationBeats: 1.25 },
      { note: 'G5', beatOffset: 24, durationBeats: 1.0 },
      { note: 'F5', beatOffset: 25.5, durationBeats: 0.5 },
      { note: 'D5', beatOffset: 26, durationBeats: 1.5 },
      { note: 'E5', beatOffset: 28, durationBeats: 1.0 },
      { note: 'G5', beatOffset: 29, durationBeats: 1.0 },
      { note: 'C6', beatOffset: 30, durationBeats: 2.0 },
    ],
    leadWave: 'triangle',
    chordWave: 'triangle',
    hasHandclap: true,
    hasKick: true,
    isArpeggio: false,
  },
  'playful-ukulele': {
    bpm: 124,
    chords: [
      ['C4', 'E4', 'G4'],
      ['F4', 'A4', 'C5'],
      ['G4', 'B4', 'D5'],
      ['C4', 'E4', 'G4'],
      ['A3', 'C4', 'E4'],
      ['F4', 'A4', 'C5'],
      ['G4', 'B4', 'D5'],
      ['C4', 'E4', 'G4'],
    ],
    bassLine: ['C3', 'F3', 'G3', 'C3', 'A3', 'F3', 'G3', 'C3'],
    melody: [
      { note: 'G5', beatOffset: 0, durationBeats: 0.5 },
      { note: 'E5', beatOffset: 0.5, durationBeats: 0.5 },
      { note: 'G5', beatOffset: 1, durationBeats: 1.0 },
      { note: 'A5', beatOffset: 2, durationBeats: 0.5 },
      { note: 'G5', beatOffset: 2.5, durationBeats: 0.5 },
      { note: 'E5', beatOffset: 3, durationBeats: 0.75 },
      { note: 'F5', beatOffset: 4, durationBeats: 0.75 },
      { note: 'A5', beatOffset: 5, durationBeats: 0.75 },
      { note: 'C6', beatOffset: 6, durationBeats: 1.25 },
      { note: 'B4', beatOffset: 8, durationBeats: 0.5 },
      { note: 'D5', beatOffset: 8.5, durationBeats: 0.5 },
      { note: 'G5', beatOffset: 9, durationBeats: 1.0 },
      { note: 'F5', beatOffset: 10, durationBeats: 0.5 },
      { note: 'D5', beatOffset: 10.5, durationBeats: 0.5 },
      { note: 'E5', beatOffset: 12, durationBeats: 1.0 },
      { note: 'G5', beatOffset: 13.5, durationBeats: 0.5 },
      { note: 'C5', beatOffset: 14, durationBeats: 1.5 },
      { note: 'C5', beatOffset: 16, durationBeats: 0.5 },
      { note: 'E5', beatOffset: 16.5, durationBeats: 0.5 },
      { note: 'A5', beatOffset: 17, durationBeats: 1.0 },
      { note: 'G5', beatOffset: 18.5, durationBeats: 0.5 },
      { note: 'E5', beatOffset: 19, durationBeats: 0.75 },
      { note: 'F5', beatOffset: 20, durationBeats: 0.75 },
      { note: 'A5', beatOffset: 21, durationBeats: 0.75 },
      { note: 'G5', beatOffset: 22, durationBeats: 1.25 },
      { note: 'G5', beatOffset: 24, durationBeats: 0.75 },
      { note: 'A5', beatOffset: 25, durationBeats: 0.75 },
      { note: 'G5', beatOffset: 26, durationBeats: 1.25 },
      { note: 'C6', beatOffset: 28, durationBeats: 0.75 },
      { note: 'G5', beatOffset: 29, durationBeats: 0.75 },
      { note: 'C6', beatOffset: 30, durationBeats: 2.0 },
    ],
    leadWave: 'sine',
    chordWave: 'triangle',
    hasHandclap: true,
    hasKick: false,
    isArpeggio: true,
  },
  'indie-pop': {
    bpm: 128,
    chords: [
      ['F3', 'A3', 'C4'],
      ['G3', 'B3', 'D4'],
      ['C4', 'E4', 'G4'],
      ['A3', 'C4', 'E4'],
      ['F3', 'A3', 'C4'],
      ['G3', 'B3', 'D4'],
      ['C4', 'E4', 'G4'],
      ['C4', 'E4', 'G4'],
    ],
    bassLine: ['F3', 'G3', 'C3', 'A3', 'F3', 'G3', 'C3', 'C3'],
    melody: [
      { note: 'A5', beatOffset: 0, durationBeats: 0.75 },
      { note: 'G5', beatOffset: 1, durationBeats: 0.75 },
      { note: 'F5', beatOffset: 2, durationBeats: 1.25 },
      { note: 'G5', beatOffset: 4, durationBeats: 0.75 },
      { note: 'A5', beatOffset: 5, durationBeats: 0.75 },
      { note: 'G5', beatOffset: 6, durationBeats: 1.5 },
      { note: 'E5', beatOffset: 8, durationBeats: 0.75 },
      { note: 'G5', beatOffset: 9, durationBeats: 0.75 },
      { note: 'C6', beatOffset: 10, durationBeats: 1.5 },
      { note: 'A5', beatOffset: 12, durationBeats: 1.0 },
      { note: 'G5', beatOffset: 13.5, durationBeats: 0.5 },
      { note: 'E5', beatOffset: 14, durationBeats: 1.5 },
      { note: 'F5', beatOffset: 16, durationBeats: 0.75 },
      { note: 'A5', beatOffset: 17, durationBeats: 0.75 },
      { note: 'C6', beatOffset: 18, durationBeats: 1.25 },
      { note: 'G5', beatOffset: 20, durationBeats: 0.75 },
      { note: 'B4', beatOffset: 21, durationBeats: 0.75 },
      { note: 'D5', beatOffset: 22, durationBeats: 1.25 },
      { note: 'E5', beatOffset: 24, durationBeats: 0.75 },
      { note: 'G5', beatOffset: 25, durationBeats: 0.75 },
      { note: 'C6', beatOffset: 26, durationBeats: 2.0 },
      { note: 'G5', beatOffset: 28.5, durationBeats: 0.75 },
      { note: 'C6', beatOffset: 29.5, durationBeats: 2.5 },
    ],
    leadWave: 'triangle',
    chordWave: 'sine',
    hasHandclap: true,
    hasKick: true,
    isArpeggio: false,
  },
  'lullaby-piano': {
    bpm: 88,
    chords: [
      ['C4', 'E4', 'G4'],
      ['A3', 'C4', 'E4'],
      ['F3', 'A3', 'C4'],
      ['G3', 'B3', 'D4'],
      ['C4', 'E4', 'G4'],
      ['F3', 'A3', 'C4'],
      ['G3', 'B3', 'D4'],
      ['C4', 'E4', 'G4'],
    ],
    bassLine: ['C3', 'A3', 'F3', 'G3', 'C3', 'F3', 'G3', 'C3'],
    melody: [
      { note: 'E5', beatOffset: 0, durationBeats: 1.5 },
      { note: 'G5', beatOffset: 1.5, durationBeats: 1.0 },
      { note: 'C5', beatOffset: 2.5, durationBeats: 1.5 },
      { note: 'E5', beatOffset: 4, durationBeats: 1.5 },
      { note: 'D5', beatOffset: 5.5, durationBeats: 1.0 },
      { note: 'C5', beatOffset: 6.5, durationBeats: 1.5 },
      { note: 'A4', beatOffset: 8, durationBeats: 1.5 },
      { note: 'C5', beatOffset: 9.5, durationBeats: 1.0 },
      { note: 'F5', beatOffset: 10.5, durationBeats: 1.5 },
      { note: 'E5', beatOffset: 12, durationBeats: 1.5 },
      { note: 'D5', beatOffset: 13.5, durationBeats: 2.5 },
      { note: 'G5', beatOffset: 16, durationBeats: 1.5 },
      { note: 'E5', beatOffset: 17.5, durationBeats: 1.0 },
      { note: 'C5', beatOffset: 18.5, durationBeats: 1.5 },
      { note: 'A5', beatOffset: 20, durationBeats: 1.5 },
      { note: 'F5', beatOffset: 21.5, durationBeats: 2.0 },
      { note: 'G5', beatOffset: 24, durationBeats: 1.5 },
      { note: 'E5', beatOffset: 25.5, durationBeats: 1.0 },
      { note: 'D5', beatOffset: 26.5, durationBeats: 1.5 },
      { note: 'C5', beatOffset: 28, durationBeats: 3.5 },
    ],
    leadWave: 'sine',
    chordWave: 'sine',
    hasHandclap: false,
    hasKick: false,
    isArpeggio: true,
  },
};

function scheduleTone(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  freq: number,
  startSec: number,
  durationSec: number,
  peakGain: number,
  wave: OscillatorType,
  withOvertone = false,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, startSec);

  const attack = Math.min(0.025, durationSec * 0.15);
  gain.gain.setValueAtTime(0.0001, startSec);
  gain.gain.linearRampToValueAtTime(peakGain, startSec + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startSec + durationSec);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(startSec);
  osc.stop(startSec + durationSec + 0.03);

  if (withOvertone) {
    const ov = ctx.createOscillator();
    const ovGain = ctx.createGain();
    ov.type = 'sine';
    ov.frequency.setValueAtTime(freq * 2, startSec);
    ovGain.gain.setValueAtTime(0.0001, startSec);
    ovGain.gain.linearRampToValueAtTime(peakGain * 0.25, startSec + 0.01);
    ovGain.gain.exponentialRampToValueAtTime(0.0001, startSec + Math.min(0.22, durationSec));
    ov.connect(ovGain);
    ovGain.connect(dest);
    ov.start(startSec);
    ov.stop(startSec + Math.min(0.24, durationSec) + 0.02);
  }
}

function scheduleSoftKick(ctx: OfflineAudioContext, dest: AudioNode, startSec: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(125, startSec);
  osc.frequency.exponentialRampToValueAtTime(46, startSec + 0.11);

  gain.gain.setValueAtTime(0.0001, startSec);
  gain.gain.linearRampToValueAtTime(0.26, startSec + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startSec + 0.16);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(startSec);
  osc.stop(startSec + 0.18);
}

function scheduleHandclap(ctx: OfflineAudioContext, dest: AudioNode, startSec: number): void {
  const length = Math.floor(ctx.sampleRate * 0.09);
  const noiseBuf = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.028));
  }

  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1450, startSec);
  filter.Q.setValueAtTime(1.4, startSec);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.11, startSec);
  gain.gain.exponentialRampToValueAtTime(0.0001, startSec + 0.085);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start(startSec);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function encodeAudioBufferToWavBase64(buffer: AudioBuffer): string {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const arrayBuf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuf);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch += 1) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numFrames; i += 1) {
    for (let ch = 0; ch < numChannels; ch += 1) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  const bytes = new Uint8Array(arrayBuf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return window.btoa(binary);
}

/**
 * Synthesizes a crisp, joyful ~12–16 second celebratory milestone song as a real WAV data URL.
 * If optional vocalAudioBase64 (from Gemini 3.8 TTS) is supplied, it mixes the warm spoken/sung
 * milestone lyrics right on top of the multi-instrument backing track with smooth musical ducking.
 */
export async function renderMilestoneKeepsakeWav(params: {
  stylePreset: MusicStylePreset;
  voiceAudioBase64?: string | null;
  includeVocals?: boolean;
}): Promise<{ audioDataUrl: string; durationSec: number; hasVocals: boolean }> {
  const arr = ARRANGEMENTS[params.stylePreset] || ARRANGEMENTS['sunny-folk'];
  const sampleRate = 44100;
  const beatSec = 60 / arr.bpm;

  // Decode optional voice track first so we know exact duration
  let decodedVoice: AudioBuffer | null = null;
  if (params.includeVocals !== false && params.voiceAudioBase64) {
    try {
      const tempCtx = new OfflineAudioContext(1, sampleRate, sampleRate);
      const rawBuf = base64ToArrayBuffer(params.voiceAudioBase64);
      decodedVoice = await tempCtx.decodeAudioData(rawBuf);
    } catch {
      decodedVoice = null;
    }
  }

  // Keep clips snappy & joyful: ~12-16 seconds (or just enough to wrap the short vocal + 1.5s intro & 1.8s outro)
  const baseBarsDuration = 32 * beatSec; // 8 bars (~14–16s depending on BPM)
  const voiceIntroSec = 1.25;
  const totalSec = decodedVoice
    ? Math.max(12.5, Math.min(22, voiceIntroSec + decodedVoice.duration + 2.0))
    : Math.min(16, baseBarsDuration + 1.2);

  const totalSamples = Math.ceil(totalSec * sampleRate);
  const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(0.92, 0);
  // Gentle fade-out on final 0.8s
  masterGain.gain.setValueAtTime(0.92, Math.max(0.5, totalSec - 0.8));
  masterGain.gain.linearRampToValueAtTime(0.001, totalSec);
  masterGain.connect(offlineCtx.destination);

  // Music bus ducks slightly while vocals are playing so the child's name & milestone lyrics shine
  const musicBus = offlineCtx.createGain();
  if (decodedVoice) {
    musicBus.gain.setValueAtTime(0.85, 0);
    musicBus.gain.linearRampToValueAtTime(0.46, voiceIntroSec);
    musicBus.gain.setValueAtTime(0.46, voiceIntroSec + decodedVoice.duration);
    musicBus.gain.linearRampToValueAtTime(0.88, Math.min(totalSec - 0.4, voiceIntroSec + decodedVoice.duration + 0.5));
  } else {
    musicBus.gain.setValueAtTime(0.9, 0);
  }
  musicBus.connect(masterGain);

  // Schedule looping chords, bass, percussion, and melody to fill totalSec
  const totalBeats = Math.floor((totalSec - 0.5) / beatSec);
  const totalBars = Math.ceil(totalBeats / 4);

  for (let bar = 0; bar < totalBars; bar += 1) {
    const chord = arr.chords[bar % arr.chords.length];
    const bassNote = arr.bassLine[bar % arr.bassLine.length];
    const barStart = bar * 4 * beatSec;

    // Warm Bass on beat 1 & 3
    const bassHz = NOTE_FREQ[bassNote] ?? 130.81;
    scheduleTone(offlineCtx, musicBus, bassHz, barStart, beatSec * 1.8, 0.16, 'sine', false);
    if (barStart + 2 * beatSec < totalSec - 0.6) {
      scheduleTone(
        offlineCtx,
        musicBus,
        bassHz * 1.5,
        barStart + 2 * beatSec,
        beatSec * 1.4,
        0.11,
        'sine',
        false,
      );
    }

    // Chords (strummed or gentle arpeggio)
    if (arr.isArpeggio) {
      for (let step = 0; step < 4; step += 1) {
        const noteName = chord[step % chord.length];
        const t = barStart + step * beatSec;
        if (t < totalSec - 0.4) {
          scheduleTone(
            offlineCtx,
            musicBus,
            NOTE_FREQ[noteName] ?? 261.63,
            t,
            beatSec * 1.35,
            0.095,
            arr.chordWave,
            true,
          );
        }
      }
    } else {
      for (let beat = 0; beat < 4; beat += 1) {
        const t = barStart + beat * beatSec;
        if (t >= totalSec - 0.4) break;
        const accent = beat === 0 ? 0.085 : 0.055;
        chord.forEach((n, idx) => {
          scheduleTone(
            offlineCtx,
            musicBus,
            NOTE_FREQ[n] ?? 261.63,
            t + idx * 0.015,
            beatSec * 0.9,
            accent,
            arr.chordWave,
            false,
          );
        });
      }
    }

    // Soft rhythmic groove
    if (arr.hasKick) {
      if (barStart < totalSec - 0.5) scheduleSoftKick(offlineCtx, musicBus, barStart);
      if (barStart + 2 * beatSec < totalSec - 0.5) {
        scheduleSoftKick(offlineCtx, musicBus, barStart + 2 * beatSec);
      }
    }
    if (arr.hasHandclap) {
      if (barStart + beatSec < totalSec - 0.5) {
        scheduleHandclap(offlineCtx, musicBus, barStart + beatSec);
      }
      if (barStart + 3 * beatSec < totalSec - 0.5) {
        scheduleHandclap(offlineCtx, musicBus, barStart + 3 * beatSec);
      }
    }
  }

  // Schedule lead melody (looping cleanly if vocals extend past 32 beats)
  const melodyLoops = Math.ceil(totalBeats / 32);
  for (let loop = 0; loop < melodyLoops; loop += 1) {
    const loopOffsetBeats = loop * 32;
    for (const m of arr.melody) {
      const startSec = (loopOffsetBeats + m.beatOffset) * beatSec;
      if (startSec >= totalSec - 0.5) break;
      const freq = NOTE_FREQ[m.note] ?? 523.25;
      const durSec = Math.min(m.durationBeats * beatSec, totalSec - startSec - 0.15);
      if (durSec > 0.08) {
        scheduleTone(
          offlineCtx,
          musicBus,
          freq,
          startSec,
          durSec,
          decodedVoice ? 0.11 : 0.17,
          arr.leadWave,
          true,
        );
      }
    }
  }

  // Layer optional Gemini 3.8 TTS celebratory voice track right on top
  if (decodedVoice) {
    const voiceSource = offlineCtx.createBufferSource();
    voiceSource.buffer = decodedVoice;
    const voiceGain = offlineCtx.createGain();
    voiceGain.gain.setValueAtTime(1.05, voiceIntroSec);
    voiceSource.connect(voiceGain);
    voiceGain.connect(masterGain);
    voiceSource.start(voiceIntroSec);
  }

  const rendered = await offlineCtx.startRendering();
  const wavBase64 = encodeAudioBufferToWavBase64(rendered);

  return {
    audioDataUrl: `data:audio/wav;base64,${wavBase64}`,
    durationSec: Number(totalSec.toFixed(1)),
    hasVocals: Boolean(decodedVoice),
  };
}
