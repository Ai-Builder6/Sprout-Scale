import React, { useState } from 'react';
import { Download, Loader2, Music, Sparkles } from 'lucide-react';
import { ChildProfile, GrowthMeasurement } from '../types';
import {
  generateGrowthMilestoneMusic,
  GenerateGrowthMusicResult,
  MusicDurationMode,
  MusicStylePreset,
} from '../services/growthMusicService';
import { GrowthProgressSummary } from '../services/growthPdfReportService';

interface GrowthMusicKeepsakeCardProps {
  childProfile: ChildProfile;
  measurements: GrowthMeasurement[];
  progressSummary: GrowthProgressSummary;
  avatarPhotoUrl: string | null;
}

const STYLE_OPTIONS: { id: MusicStylePreset; label: string; subtitle: string }[] = [
  {
    id: 'sunny-folk',
    label: 'Sunny Acoustic Folk',
    subtitle: 'Strummed guitar, handclaps & joyful family vocals',
  },
  {
    id: 'playful-ukulele',
    label: 'Playful Ukulele & Marimba',
    subtitle: 'Bright storybook singalong melody',
  },
  {
    id: 'indie-pop',
    label: 'Upbeat Indie Pop Anthem',
    subtitle: 'Energetic piano, crisp drums & celebration chorus',
  },
  {
    id: 'lullaby-piano',
    label: 'Gentle Lullaby Piano',
    subtitle: 'Tender keepsake piano & warm strings',
  },
];

export const GrowthMusicKeepsakeCard: React.FC<GrowthMusicKeepsakeCardProps> = ({
  childProfile,
  measurements,
  progressSummary,
  avatarPhotoUrl,
}) => {
  const [stylePreset, setStylePreset] = useState<MusicStylePreset>('sunny-folk');
  const [durationMode, setDurationMode] = useState<MusicDurationMode>('clip');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [usePortraitInspiration, setUsePortraitInspiration] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedTrack, setGeneratedTrack] =
    useState<GenerateGrowthMusicResult | null>(null);

  const sortedDesc = [...measurements].sort((a, b) => b.ageMonths - a.ageMonths);
  const latestNote = sortedDesc[0]?.note ?? '';

  const handleGenerateSong = async () => {
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const result = await generateGrowthMilestoneMusic({
        childName: childProfile.name,
        ageLabel: progressSummary.exactAgeLabel,
        heightSummary: progressSummary.latestHeightPrimary,
        gainedSummary: `${progressSummary.totalHeightGainPrimary} and ${progressSummary.totalWeightGainPrimary}`,
        latestNote,
        stylePreset,
        durationMode,
        customPrompt: customPrompt.trim() || undefined,
        avatarDataUrl:
          usePortraitInspiration && avatarPhotoUrl ? avatarPhotoUrl : null,
      });
      setGeneratedTrack(result);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not compose milestone song right now.';
      setErrorMessage(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const safeChildSlug =
    childProfile.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 28) || 'Sprout';

  return (
    <div className="bg-white dark:bg-slate-900 border-2 border-amber-200 dark:border-slate-700 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-100 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
            <Music className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
            <span>Milestone Keepsake Song Studio</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
              Lyria 3 Audio &amp; Lyrics
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-indigo-950 dark:text-white">
            Compose {childProfile.name}’s Growth Celebration Song
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
            Turn {childProfile.name}’s wall milestones ({progressSummary.latestHeightPrimary},{' '}
            {progressSummary.totalHeightGainPrimary} since Age 2) into an original MP3
            soundtrack to play alongside their Growth Wall timelapse.
          </p>
        </div>

        {/* Duration Mode Selector: 30s Clip (lyria-3-clip-preview) vs Full Song (lyria-3-pro-preview) */}
        <div
          role="group"
          aria-label="Song length"
          className="flex items-center gap-1 p-1 bg-amber-100/80 dark:bg-slate-800 rounded-lg self-start sm:self-center shrink-0"
        >
          <button
            type="button"
            onClick={() => setDurationMode('clip')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              durationMode === 'clip'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-amber-950/80 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white'
            }`}
          >
            30s Clip
          </button>
          <button
            type="button"
            onClick={() => setDurationMode('full')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              durationMode === 'full'
                ? 'bg-indigo-900 dark:bg-sky-500 text-white dark:text-slate-950 shadow-xs'
                : 'text-amber-950/80 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white'
            }`}
          >
            Full Track
          </button>
        </div>
      </div>

      {/* Style Presets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {STYLE_OPTIONS.map((opt) => {
          const isSelected = stylePreset === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStylePreset(opt.id)}
              className={`text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                isSelected
                  ? 'border-amber-400 bg-amber-50/90 dark:bg-amber-950/40 text-indigo-950 dark:text-amber-200'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
              }`}
            >
              <div className="text-xs font-bold">{opt.label}</div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                {opt.subtitle}
              </div>
            </button>
          );
        })}
      </div>

      {/* Optional Family Detail & Portrait Inspiration Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div className="flex-1 space-y-1.5">
          <label
            htmlFor="growth-song-custom-detail"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Optional Favorite Memory or Lyric Detail
          </label>
          <input
            id="growth-song-custom-detail"
            type="text"
            maxLength={200}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={
              latestNote
                ? `Auto-includes "${latestNote}" — add favorite toys, pets, or hobbies!`
                : `e.g. Loves riding scooters, dinosaurs, and reaching the kitchen counter`
            }
            className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {avatarPhotoUrl && (
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={usePortraitInspiration}
                onChange={(e) => setUsePortraitInspiration(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-amber-500 focus:ring-amber-400"
              />
              <span>Inspire from {childProfile.name}’s photo</span>
            </label>
          )}

          <button
            type="button"
            onClick={() => void handleGenerateSong()}
            disabled={isGenerating}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 disabled:opacity-60 rounded-lg shadow-xs transition-colors whitespace-nowrap cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Composing {durationMode === 'full' ? 'Full Song' : '30s Clip'}...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-900" aria-hidden="true" />
                Compose Milestone Song
              </>
            )}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="px-4 py-3 text-xs font-medium text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl"
        >
          {errorMessage}
        </div>
      )}

      {generatedTrack && (
        <div className="bg-sky-50/80 dark:bg-slate-800/80 border border-sky-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <span className="font-bold text-indigo-950 dark:text-white">
                {childProfile.name}’s Keepsake Track Ready
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-sky-800 dark:text-sky-300">
                {generatedTrack.modelUsed === 'lyria-3-pro-preview'
                  ? 'Full Track (Lyria Pro)'
                  : '30s Clip (Lyria Clip)'}
              </span>
            </div>

            <a
              href={generatedTrack.audioDataUrl}
              download={`SproutScale_${safeChildSlug}_Milestone_Song.mp3`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-950 dark:text-white bg-white dark:bg-slate-900 hover:bg-sky-100 dark:hover:bg-slate-700 border border-sky-300 dark:border-slate-600 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
              Download MP3
            </a>
          </div>

          <audio
            controls
            src={generatedTrack.audioDataUrl}
            className="w-full h-10"
          >
            Your browser does not support HTML5 audio playback.
          </audio>

          {generatedTrack.lyrics && (
            <div className="bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-700 rounded-lg p-3.5 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-sky-800 dark:text-sky-300">
                Generated Keepsake Lyrics &amp; Notes
              </p>
              <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed max-h-44 overflow-y-auto">
                {generatedTrack.lyrics}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
