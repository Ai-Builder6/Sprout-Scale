export type MusicStylePreset =
  | 'sunny-folk'
  | 'playful-ukulele'
  | 'indie-pop'
  | 'lullaby-piano';

export type MusicDurationMode = 'clip' | 'full';

export interface GenerateGrowthMusicRequest {
  childName: string;
  ageLabel: string;
  heightSummary: string;
  gainedSummary: string;
  latestNote: string;
  stylePreset: MusicStylePreset;
  durationMode: MusicDurationMode;
  customPrompt?: string;
  avatarDataUrl?: string | null;
}

export interface GenerateGrowthMusicResult {
  audioDataUrl: string;
  lyrics: string;
  mimeType: string;
  modelUsed: 'lyria-3-clip-preview' | 'lyria-3-pro-preview';
}

export async function generateGrowthMilestoneMusic(
  payload: GenerateGrowthMusicRequest,
): Promise<GenerateGrowthMusicResult> {
  const response = await fetch('/api/generate-growth-music', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as {
    audioDataUrl?: string;
    lyrics?: string;
    mimeType?: string;
    modelUsed?: 'lyria-3-clip-preview' | 'lyria-3-pro-preview';
    error?: string;
  };

  if (!response.ok || !data.audioDataUrl) {
    throw new Error(
      data.error || 'Could not generate milestone song right now. Please try again.',
    );
  }

  return {
    audioDataUrl: data.audioDataUrl,
    lyrics: data.lyrics ?? '',
    mimeType: data.mimeType ?? 'audio/mpeg',
    modelUsed: data.modelUsed ?? 'lyria-3-clip-preview',
  };
}
