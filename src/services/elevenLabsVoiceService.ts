export interface ElevenLabsVoiceOption {
  id: string;
  name: string;
  category: string;
  accent: string;
  previewUrl: string;
}

export interface ElevenLabsStatusResponse {
  configured: boolean;
  defaultVoiceId: string;
  sttModel: string;
}

export interface ElevenLabsVoicesResponse {
  configured: boolean;
  defaultVoiceId: string;
  voices: ElevenLabsVoiceOption[];
  error?: string;
}

export interface ElevenLabsTranscriptionResult {
  ok: boolean;
  text: string;
  audioEvents: string[];
  speakers: string[];
  modelUsed: string;
}

const VOICE_PREF_STORAGE_KEY = 'sproutscale_elevenlabs_voice_id_v1';
const ttsBlobCache = new Map<string, string>();
let activeAudioEl: HTMLAudioElement | null = null;

export function getSavedElevenLabsVoiceId(): string {
  try {
    return window.localStorage.getItem(VOICE_PREF_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveElevenLabsVoiceId(voiceId: string): void {
  try {
    if (voiceId) {
      window.localStorage.setItem(VOICE_PREF_STORAGE_KEY, voiceId);
    } else {
      window.localStorage.removeItem(VOICE_PREF_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchElevenLabsStatus(): Promise<ElevenLabsStatusResponse> {
  const res = await fetch('/api/elevenlabs/status');
  if (!res.ok) {
    return { configured: false, defaultVoiceId: '', sttModel: 'scribe_v3' };
  }
  return (await res.json()) as ElevenLabsStatusResponse;
}

export async function fetchElevenLabsVoices(): Promise<ElevenLabsVoicesResponse> {
  const res = await fetch('/api/elevenlabs/voices');
  const data = (await res.json().catch(() => ({}))) as Partial<ElevenLabsVoicesResponse>;
  return {
    configured: Boolean(data.configured),
    defaultVoiceId: data.defaultVoiceId || '',
    voices: Array.isArray(data.voices) ? data.voices : [],
    error: data.error,
  };
}

export function stopAvatarSpeech(): void {
  if (activeAudioEl) {
    try {
      activeAudioEl.pause();
      activeAudioEl.currentTime = 0;
    } catch {
      // Ignore cleanup errors
    }
    activeAudioEl = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore browser speech cancel error
    }
  }
}

/**
 * Speaks a warm milestone line using ElevenLabs Text-to-Speech via our secure
 * `/api/elevenlabs/tts` backend route, with graceful browser SpeechSynthesis
 * fallback if `ELEVENLABS_API_KEY` is not yet configured.
 */
export async function speakWithElevenLabsAvatar(
  text: string,
  options?: {
    voiceId?: string;
    onStart?: () => void;
    onEnd?: () => void;
  },
): Promise<{ engine: 'elevenlabs' | 'browser'; error?: string }> {
  stopAvatarSpeech();

  const cleanText = text.trim();
  if (!cleanText) {
    options?.onEnd?.();
    return { engine: 'browser' };
  }

  const chosenVoiceId = (options?.voiceId || getSavedElevenLabsVoiceId() || '').trim();
  const cacheKey = `${chosenVoiceId || 'default'}::${cleanText}`;

  const playBlobUrl = (blobUrl: string) =>
    new Promise<void>((resolve, reject) => {
      const audio = new Audio(blobUrl);
      activeAudioEl = audio;
      audio.onplay = () => options?.onStart?.();
      audio.onended = () => {
        if (activeAudioEl === audio) activeAudioEl = null;
        options?.onEnd?.();
        resolve();
      };
      audio.onerror = () => {
        if (activeAudioEl === audio) activeAudioEl = null;
        options?.onEnd?.();
        reject(new Error('Audio playback failed'));
      };
      audio.play().catch((err) => {
        if (activeAudioEl === audio) activeAudioEl = null;
        options?.onEnd?.();
        reject(err);
      });
    });

  const cachedUrl = ttsBlobCache.get(cacheKey);
  if (cachedUrl) {
    await playBlobUrl(cachedUrl);
    return { engine: 'elevenlabs' };
  }

  try {
    const res = await fetch('/api/elevenlabs/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cleanText,
        voiceId: chosenVoiceId || undefined,
      }),
    });

    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      // Bound cache size cleanly
      if (ttsBlobCache.size > 24) {
        const firstKey = ttsBlobCache.keys().next().value;
        if (firstKey) {
          const oldUrl = ttsBlobCache.get(firstKey);
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          ttsBlobCache.delete(firstKey);
        }
      }
      ttsBlobCache.set(cacheKey, blobUrl);
      await playBlobUrl(blobUrl);
      return { engine: 'elevenlabs' };
    }

    // If ElevenLabs isn't configured yet (503), fall back smoothly to browser speech
    if (res.status !== 503) {
      const errJson = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        engine: 'elevenlabs',
        error: errJson.error || `ElevenLabs speech failed (${res.status})`,
      };
    }
  } catch {
    // Fall through to browser speech fallback
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    return new Promise((resolve) => {
      const utter = new SpeechSynthesisUtterance(cleanText);
      utter.rate = 0.98;
      utter.pitch = 1.1;
      utter.onstart = () => options?.onStart?.();
      utter.onend = () => {
        options?.onEnd?.();
        resolve({ engine: 'browser' });
      };
      utter.onerror = () => {
        options?.onEnd?.();
        resolve({ engine: 'browser' });
      };
      window.speechSynthesis.speak(utter);
    });
  }

  options?.onEnd?.();
  return { engine: 'browser', error: 'Speech playback is unavailable in this browser.' };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Could not read recorded audio.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Sends a recorded audio Blob to `/api/elevenlabs/stt` (ElevenLabs Scribe v3)
 * with audio-event tagging and speaker diarization enabled.
 */
export async function transcribeAudioWithElevenLabs(
  audioBlob: Blob,
  options?: {
    languageCode?: string;
    tagAudioEvents?: boolean;
    diarize?: boolean;
  },
): Promise<ElevenLabsTranscriptionResult> {
  const audioBase64 = await blobToBase64(audioBlob);
  const res = await fetch('/api/elevenlabs/stt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64,
      mimeType: audioBlob.type || 'audio/webm',
      languageCode: options?.languageCode || 'eng',
      tagAudioEvents: options?.tagAudioEvents ?? true,
      diarize: options?.diarize ?? true,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<ElevenLabsTranscriptionResult> & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      data.error ||
        (res.status === 503
          ? 'Add ELEVENLABS_API_KEY in Secrets to enable ElevenLabs Scribe voice notes.'
          : 'Could not transcribe voice note.'),
    );
  }

  return {
    ok: true,
    text: String(data.text || '').trim(),
    audioEvents: Array.isArray(data.audioEvents) ? data.audioEvents : [],
    speakers: Array.isArray(data.speakers) ? data.speakers : [],
    modelUsed: String(data.modelUsed || 'scribe_v3'),
  };
}

export interface ParsedSpokenMeasurement {
  heightInches: number | null;
  weightLbs: number | null;
}

const WORD_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function normalizeSpokenNumbers(raw: string): string {
  let text = raw.toLowerCase();
  // Convert "and a half" / "and half" -> ".5"
  text = text.replace(/(\d+)\s+and\s+a?\s*half/gi, '$1.5');
  // Convert single small spoken numbers before unit words (e.g. "three feet four inches")
  text = text.replace(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b(?=\s*(?:feet|foot|ft|inches|inch|in|pounds|pound|lbs|lb|kilos|kilograms|kg|cm|centimeters))/gi,
    (match) => String(WORD_NUMBERS[match.toLowerCase()] ?? match),
  );
  return text;
}

/**
 * Parses natural parent speech such as:
 * - "He is 36 inches and 33 pounds"
 * - "She is 3 feet 4 inches and 38.5 lbs"
 * - "3 foot 6, 40 pounds"
 * - "102 cm and 17 kg"
 */
export function parseSpokenMeasurement(transcript: string): ParsedSpokenMeasurement {
  const normalized = normalizeSpokenNumbers(transcript);
  let heightInches: number | null = null;
  let weightLbs: number | null = null;

  const ftMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:feet|foot|ft|')\s*(?:and\s*)?(\d+(?:\.\d+)?)?\s*(?:inches|inch|in|")?/i,
  );
  const inMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:inches|inch|in|")/i);
  const cmMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:centimeters|centimetres|cm)\b/i);

  if (ftMatch) {
    const feet = parseFloat(ftMatch[1]);
    const extraIn = ftMatch[2] ? parseFloat(ftMatch[2]) : 0;
    if (Number.isFinite(feet) && feet >= 1 && feet <= 6) {
      heightInches = feet * 12 + (Number.isFinite(extraIn) ? extraIn : 0);
    }
  } else if (inMatch) {
    const inches = parseFloat(inMatch[1]);
    if (Number.isFinite(inches)) {
      heightInches = inches;
    }
  } else if (cmMatch) {
    const cm = parseFloat(cmMatch[1]);
    if (Number.isFinite(cm)) {
      heightInches = cm / 2.54;
    }
  }

  const lbsMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:pounds|pound|lbs|lb)\b/i);
  const kgMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:kilograms|kilogram|kilos|kilo|kg)\b/i);

  if (lbsMatch) {
    const lbs = parseFloat(lbsMatch[1]);
    if (Number.isFinite(lbs)) {
      weightLbs = lbs;
    }
  } else if (kgMatch) {
    const kg = parseFloat(kgMatch[1]);
    if (Number.isFinite(kg)) {
      weightLbs = kg * 2.2046226218;
    }
  }

  return { heightInches, weightLbs };
}

