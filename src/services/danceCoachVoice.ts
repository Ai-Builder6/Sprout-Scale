import { danceAudioEngine } from './dancePlayhouseAudio';

/**
 * Upbeat Dance Coach voice announcer powered by the app's configured ElevenLabs voice
 * via `/api/storybook/read-aloud` with in-memory clip caching and smooth music ducking.
 */
const clipCache = new Map<string, string>();
let activeCoachAudio: HTMLAudioElement | null = null;
let coachSpeakGeneration = 0;

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType || 'audio/mpeg' });
  return URL.createObjectURL(blob);
}

export function stopDanceCoachVoice(): void {
  coachSpeakGeneration += 1;
  if (activeCoachAudio) {
    try {
      activeCoachAudio.pause();
      activeCoachAudio.currentTime = 0;
    } catch {
      // Ignore audio stop errors
    }
    activeCoachAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
  danceAudioEngine.setDucked(false);
}

function speakWithBrowserFallback(text: string, generation: number): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    danceAudioEngine.setDucked(false);
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.06;
    utter.pitch = 1.12;
    utter.onend = () => {
      if (generation === coachSpeakGeneration) {
        danceAudioEngine.setDucked(false);
      }
    };
    utter.onerror = () => {
      if (generation === coachSpeakGeneration) {
        danceAudioEngine.setDucked(false);
      }
    };
    window.speechSynthesis.speak(utter);
  } catch {
    danceAudioEngine.setDucked(false);
  }
}

export async function speakDanceCoachLine(
  line: string,
  options?: { enabled?: boolean; preferredVoiceId?: string },
): Promise<void> {
  if (options?.enabled === false) return;
  const trimmed = line.trim();
  if (!trimmed) return;

  stopDanceCoachVoice();
  const myGen = coachSpeakGeneration;
  danceAudioEngine.setDucked(true);

  const cacheKey = `${options?.preferredVoiceId ?? 'default'}::${trimmed.toLowerCase()}`;
  const cachedUrl = clipCache.get(cacheKey);

  const playUrl = (url: string) => {
    if (myGen !== coachSpeakGeneration) return;
    const audio = new Audio(url) as HTMLAudioElement & {
      setSinkId?: (sinkId: string) => Promise<void>;
    };
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('x-webkit-airplay', 'allow');
    activeCoachAudio = audio;
    audio.onended = () => {
      if (myGen === coachSpeakGeneration) {
        activeCoachAudio = null;
        danceAudioEngine.setDucked(false);
      }
    };
    audio.onerror = () => {
      if (myGen === coachSpeakGeneration) {
        activeCoachAudio = null;
        danceAudioEngine.setDucked(false);
      }
    };

    const selected = danceAudioEngine.getSelectedSpeaker();
    const startPlayback = () => {
      if (myGen !== coachSpeakGeneration) return;
      void audio.play().catch(() => {
        if (myGen === coachSpeakGeneration) {
          danceAudioEngine.setDucked(false);
        }
      });
    };

    if (selected.deviceId && selected.deviceId !== 'default' && typeof audio.setSinkId === 'function') {
      void audio.setSinkId(selected.deviceId).then(startPlayback).catch(startPlayback);
    } else {
      startPlayback();
    }
  };

  if (cachedUrl) {
    playUrl(cachedUrl);
    return;
  }

  try {
    const res = await fetch('/api/storybook/read-aloud', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: trimmed,
        mode: 'daytime',
        voiceId: options?.preferredVoiceId,
      }),
    });

    if (myGen !== coachSpeakGeneration) return;

    if (!res.ok) {
      speakWithBrowserFallback(trimmed, myGen);
      return;
    }

    const payload = (await res.json()) as { audioBase64?: string; mimeType?: string };
    if (myGen !== coachSpeakGeneration) return;

    if (payload.audioBase64) {
      const url = base64ToBlobUrl(payload.audioBase64, payload.mimeType || 'audio/mpeg');
      // Keep cache bounded
      if (clipCache.size > 40) {
        const firstKey = clipCache.keys().next().value;
        if (firstKey) {
          const oldUrl = clipCache.get(firstKey);
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          clipCache.delete(firstKey);
        }
      }
      clipCache.set(cacheKey, url);
      playUrl(url);
      return;
    }

    speakWithBrowserFallback(trimmed, myGen);
  } catch {
    if (myGen === coachSpeakGeneration) {
      speakWithBrowserFallback(trimmed, myGen);
    }
  }
}
