import { renderMilestoneKeepsakeWav } from './milestoneSongSynthService';

export type MusicStylePreset =
  | 'sunny-folk'
  | 'playful-ukulele'
  | 'indie-pop'
  | 'lullaby-piano';

export type MusicVoiceMode = 'with-vocals' | 'instrumental';

export interface GenerateGrowthMusicRequest {
  childName: string;
  ageLabel: string;
  heightSummary: string;
  gainedSummary: string;
  latestNote: string;
  stylePreset: MusicStylePreset;
  voiceMode: MusicVoiceMode;
  customPrompt?: string;
}

export interface GenerateGrowthMusicResult {
  songTitle: string;
  audioDataUrl: string;
  lyrics: string;
  mimeType: string;
  durationSec: number;
  hasVocals: boolean;
  engineLabel: string;
}

function buildFallbackLyrics(req: GenerateGrowthMusicRequest): {
  songTitle: string;
  lyrics: string;
} {
  const safeName = req.childName || 'Little Sprout';
  const noteLine = req.customPrompt?.trim()
    ? `Always loving ${req.customPrompt.trim()} along the way!`
    : req.latestNote
      ? `Remembering: ${req.latestNote}!`
      : 'Every new inch brings a brand-new day!';

  return {
    songTitle: `Look How Tall ${safeName} Grows!`,
    lyrics: [
      `Hooray for ${safeName}, standing ${req.heightSummary || 'so tall'} today!`,
      `${req.ageLabel} and sprouting bright in every single way.`,
      req.gainedSummary ? `Up ${req.gainedSummary} since turning two,` : 'Growing taller and stronger every season through,',
      noteLine,
    ].join('\n'),
  };
}

export async function generateGrowthMilestoneMusic(
  payload: GenerateGrowthMusicRequest,
): Promise<GenerateGrowthMusicResult> {
  let songTitle = '';
  let lyrics = '';
  let voiceAudioBase64: string | null = null;
  let serverEngineLabel = 'SproutScale Studio Synth';

  try {
    const response = await fetch('/api/generate-growth-music', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        songTitle?: string;
        lyrics?: string;
        voiceAudioBase64?: string | null;
        engineLabel?: string;
      };
      songTitle = data.songTitle ?? '';
      lyrics = data.lyrics ?? '';
      voiceAudioBase64 = data.voiceAudioBase64 ?? null;
      if (data.engineLabel) {
        serverEngineLabel = data.engineLabel;
      }
    }
  } catch {
    // Gracefully continue with client-side studio synthesis + personalized fallback lyrics
  }

  if (!lyrics) {
    const fb = buildFallbackLyrics(payload);
    songTitle = songTitle || fb.songTitle;
    lyrics = fb.lyrics;
  }

  const rendered = await renderMilestoneKeepsakeWav({
    stylePreset: payload.stylePreset,
    voiceAudioBase64: payload.voiceMode === 'with-vocals' ? voiceAudioBase64 : null,
    includeVocals: payload.voiceMode === 'with-vocals',
  });

  return {
    songTitle: songTitle || `Look How Tall ${payload.childName} Grows!`,
    audioDataUrl: rendered.audioDataUrl,
    lyrics,
    mimeType: 'audio/wav',
    durationSec: rendered.durationSec,
    hasVocals: rendered.hasVocals,
    engineLabel: rendered.hasVocals
      ? serverEngineLabel
      : 'SproutScale Studio Synth (Instrumental)',
  };
}
