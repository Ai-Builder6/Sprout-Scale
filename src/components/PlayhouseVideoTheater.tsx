import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  Link2,
  Play,
  Plus,
  Repeat,
  Sparkles,
  Trash2,
  Tv,
} from 'lucide-react';
import {
  buildSafeYouTubeEmbedUrl,
  loadChildPlayhouseVideos,
  PlayhouseVideoCategory,
  resolveYouTubeVideoFromUrl,
  saveChildPlayhouseVideos,
  SavedPlayhouseVideo,
} from '../services/playhouseVideoService';
import { danceAudioEngine } from '../services/dancePlayhouseAudio';
import playhouseStageImg from '../assets/images/playhouse_dance_stage_1795413823595.jpg';

interface PlayhouseVideoTheaterProps {
  childId: string;
  childName: string;
  dancerFullBodyUrl: string;
  onEarnStar: (count: number) => void;
  onSwitchToDance: () => void;
}

const CATEGORY_LABELS: Record<PlayhouseVideoCategory, string> = {
  shorts: 'YouTube Short',
  dance: 'Dance & Music',
  cartoons: 'Cartoons & Games',
  songs: 'Kids Songs',
};

const TIMER_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 0, label: 'Timer Off' },
  { minutes: 10, label: '10 min' },
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
];

export const PlayhouseVideoTheater: React.FC<PlayhouseVideoTheaterProps> = ({
  childId,
  childName,
  dancerFullBodyUrl,
  onEarnStar,
  onSwitchToDance,
}) => {
  const [videos, setVideos] = useState<SavedPlayhouseVideo[]>(() =>
    loadChildPlayhouseVideos(childId),
  );
  const [activeVideoId, setActiveVideoId] = useState<string>(() => {
    const initial = loadChildPlayhouseVideos(childId);
    return initial[0]?.id ?? '';
  });
  const [urlInput, setUrlInput] = useState<string>('');
  const [categoryInput, setCategoryInput] = useState<PlayhouseVideoCategory>('shorts');
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [loopCurrent, setLoopCurrent] = useState<boolean>(true);
  const [characterCheerAnim, setCharacterCheerAnim] = useState<boolean>(false);
  const [failedThumbIds, setFailedThumbIds] = useState<Record<string, boolean>>({});
  const [stageImgFailed, setStageImgFailed] = useState<boolean>(false);

  // Gentle parent watch timer (in seconds)
  const [timerMinutesSetting, setTimerMinutesSetting] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [isTimeUp, setIsTimeUp] = useState<boolean>(false);

  // Reload per-child playlist when switching child profiles
  useEffect(() => {
    const loaded = loadChildPlayhouseVideos(childId);
    setVideos(loaded);
    setActiveVideoId(loaded[0]?.id ?? '');
    setAddError(null);
    setIsTimeUp(false);
  }, [childId]);

  // Countdown tick for parent watch timer
  useEffect(() => {
    if (timerMinutesSetting <= 0 || isTimeUp) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsTimeUp(true);
          danceAudioEngine.playDjFx('sparkle');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [isTimeUp, timerMinutesSetting]);

  const activeIndex = useMemo(() => {
    const idx = videos.findIndex((v) => v.id === activeVideoId);
    return idx >= 0 ? idx : 0;
  }, [activeVideoId, videos]);

  const activeVideo = videos[activeIndex] ?? null;

  const embedUrl = useMemo(() => {
    if (!activeVideo || isTimeUp) return '';
    return buildSafeYouTubeEmbedUrl(activeVideo.videoId, {
      autoplay: false,
      loop: loopCurrent,
    });
  }, [activeVideo, isTimeUp, loopCurrent]);

  const handleSelectTimer = (minutes: number) => {
    setTimerMinutesSetting(minutes);
    setSecondsLeft(minutes * 60);
    setIsTimeUp(false);
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || isAdding) return;
    setAddError(null);
    setIsAdding(true);

    try {
      const added = await resolveYouTubeVideoFromUrl(urlInput, undefined, categoryInput);
      // Avoid duplicate videoId entries; bring existing or new item to the top
      const existing = videos.find((v) => v.videoId === added.videoId);
      let nextList: SavedPlayhouseVideo[];
      let nextActiveId: string;
      if (existing) {
        nextList = [existing, ...videos.filter((v) => v.id !== existing.id)];
        nextActiveId = existing.id;
      } else {
        nextList = [added, ...videos].slice(0, 30);
        nextActiveId = added.id;
      }
      setVideos(saveChildPlayhouseVideos(childId, nextList));
      setActiveVideoId(nextActiveId);
      setUrlInput('');
      setIsTimeUp(false);
      danceAudioEngine.playDjFx('sparkle');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not add that YouTube link.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleFavorite = (id: string) => {
    const next = videos.map((v) => (v.id === id ? { ...v, isFavorite: !v.isFavorite } : v));
    setVideos(saveChildPlayhouseVideos(childId, next));
  };

  const handleDeleteVideo = (id: string) => {
    const next = videos.filter((v) => v.id !== id);
    const saved = saveChildPlayhouseVideos(childId, next);
    setVideos(saved);
    if (activeVideoId === id) {
      setActiveVideoId(saved[0]?.id ?? '');
    }
  };

  const handleStepVideo = (delta: -1 | 1) => {
    if (videos.length <= 1) return;
    const nextIdx = (activeIndex + delta + videos.length) % videos.length;
    setActiveVideoId(videos[nextIdx].id);
    setIsTimeUp(false);
  };

  const handleCheerAlong = () => {
    danceAudioEngine.playDjFx('cheer');
    onEarnStar(1);
    setCharacterCheerAnim(true);
    window.setTimeout(() => setCharacterCheerAnim(false), 1100);
  };

  const formatTimerRemaining = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Left / Center: Playhouse YouTube & Shorts Theater Stage (7 cols) */}
      <div className="lg:col-span-7 flex flex-col bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Video Theater Viewport */}
        <div className="relative w-full min-h-[380px] sm:min-h-[450px] bg-slate-950 flex items-center justify-center overflow-hidden">
          {!stageImgFailed && (
            <img
              src={playhouseStageImg}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              onError={() => setStageImgFailed(true)}
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/70"
          />

          {isTimeUp ? (
            <div className="relative z-10 max-w-md mx-auto text-center px-6 py-10 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
                <Clock className="w-7 h-7" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-bold text-white">
                Great Watching, {childName}!
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Video time is complete. Ready to jump up and do a fun dance routine on stage, or add
                5 more minutes?
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onSwitchToDance}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors cursor-pointer"
                >
                  Let’s Dance Now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimerMinutesSetting(5);
                    setSecondsLeft(300);
                    setIsTimeUp(false);
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                >
                  Add 5 Minutes
                </button>
              </div>
            </div>
          ) : activeVideo ? (
            <div className="relative z-10 w-full h-full flex items-center justify-center p-3 sm:p-5 gap-4">
              {activeVideo.isShort ? (
                <>
                  {/* Vertical 9:16 YouTube Shorts Frame */}
                  <div className="w-[245px] sm:w-[275px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-300/60 bg-black shrink-0">
                    <iframe
                      key={`${activeVideo.videoId}_${loopCurrent ? 'loop' : 'once'}`}
                      src={embedUrl}
                      title={activeVideo.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>

                  {/* Cheerful SproutScale Kid Character watching & cheering beside the Short */}
                  <div className="hidden sm:flex flex-col items-center justify-end self-end pb-3 max-w-[175px] text-center">
                    <div
                      className={`h-[195px] flex items-end justify-center will-change-transform ${
                        characterCheerAnim ? 'dance-move-star_jump' : 'dance-move-bounce'
                      }`}
                      style={{ ['--beat-dur' as string]: '0.62s' }}
                    >
                      <img
                        src={dancerFullBodyUrl}
                        alt={`${childName} cheering beside the video`}
                        referrerPolicy="no-referrer"
                        className="h-full w-auto object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.45)]"
                      />
                    </div>
                    <p className="mt-2 text-xs font-semibold text-amber-200 leading-snug">
                      {childName}’s Short Theater
                    </p>
                  </div>
                </>
              ) : (
                /* Standard 16:9 Widescreen YouTube Video Frame */
                <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl border border-white/15 bg-black">
                  <iframe
                    key={`${activeVideo.videoId}_${loopCurrent ? 'loop' : 'once'}`}
                    src={embedUrl}
                    title={activeVideo.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="relative z-10 text-center px-6 py-12 space-y-2 text-slate-300">
              <Tv className="w-10 h-10 mx-auto text-amber-300" aria-hidden="true" />
              <p className="text-base font-bold text-white">No Videos in {childName}’s Theater Yet</p>
              <p className="text-xs max-w-sm mx-auto">
                Paste any YouTube or YouTube Shorts link on the right to start a parent-approved
                playlist.
              </p>
            </div>
          )}
        </div>

        {/* Clean Theater Control Bar Below the Video */}
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-t border-amber-100 dark:border-slate-800 space-y-4">
          {activeVideo && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-indigo-950 dark:text-white truncate">
                  {activeVideo.title}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {activeVideo.authorName} · {CATEGORY_LABELS[activeVideo.category]} · Safe
                  Privacy Embed
                </p>
              </div>

              {/* Watch Timer Quick Selector */}
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start shrink-0">
                {TIMER_OPTIONS.map((opt) => {
                  const selected = timerMinutesSetting === opt.minutes;
                  return (
                    <button
                      key={opt.minutes}
                      type="button"
                      onClick={() => handleSelectTimer(opt.minutes)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selected
                          ? 'bg-white dark:bg-slate-700 text-indigo-950 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {selected && opt.minutes > 0 && secondsLeft > 0
                        ? formatTimerRemaining(secondsLeft)
                        : opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={videos.length <= 1}
              onClick={() => handleStepVideo(-1)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-40 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              Prev
            </button>

            <button
              type="button"
              disabled={videos.length <= 1}
              onClick={() => handleStepVideo(1)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-40 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Next
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setLoopCurrent((l) => !l)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                loopCurrent
                  ? 'bg-indigo-950 text-white border-indigo-950 dark:bg-sky-500 dark:text-slate-950 dark:border-sky-400'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
              {loopCurrent ? 'Looping On' : 'Loop Off'}
            </button>

            <button
              type="button"
              onClick={handleCheerAlong}
              className="flex-1 min-w-[175px] min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-xs transition-transform active:scale-[0.98] inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              Cheer Along (+1 Star)
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel: Parent-Approved YouTube & Shorts Playlist Manager (5 cols) */}
      <div className="lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm justify-between gap-5">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-indigo-950 dark:text-white">
              {childName}’s Approved Videos &amp; Shorts
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Paste any YouTube or YouTube Shorts link he loves so he can watch safely inside
              SproutScale without random autoplay.
            </p>
          </div>

          {/* Paste YouTube / Shorts Link Form */}
          <form onSubmit={handleAddVideo} className="space-y-2.5">
            <div className="relative">
              <Link2
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (addError) setAddError(null);
                }}
                placeholder="Paste YouTube or Shorts link (youtube.com/shorts/...)"
                aria-label="Paste YouTube or YouTube Shorts URL"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value as PlayhouseVideoCategory)}
                aria-label="Video category"
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="shorts">YouTube Short</option>
                <option value="cartoons">Cartoons &amp; Games</option>
                <option value="dance">Dance &amp; Music</option>
                <option value="songs">Kids Songs</option>
              </select>

              <button
                type="submit"
                disabled={isAdding || !urlInput.trim()}
                className="flex-1 min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white shadow-xs transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                {isAdding ? 'Adding Video...' : `Add to ${childName}’s List`}
              </button>
            </div>

            {addError && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{addError}</p>
            )}
          </form>

          {/* Saved Playlist Items */}
          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {videos.map((vid) => {
              const isSelected = activeVideo?.id === vid.id;
              const thumbFailed = failedThumbIds[vid.videoId];
              return (
                <div
                  key={vid.id}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
                    isSelected
                      ? 'bg-rose-50 dark:bg-rose-950/35 border-rose-300 dark:border-rose-700'
                      : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800 hover:border-amber-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveVideoId(vid.id);
                      setIsTimeUp(false);
                    }}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-rose-500 to-amber-500 shrink-0 flex items-center justify-center">
                      {!thumbFailed ? (
                        <img
                          src={`https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`}
                          alt=""
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedThumbIds((prev) => ({ ...prev, [vid.videoId]: true }))
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Play className="w-5 h-5 text-white" aria-hidden="true" />
                      )}
                      {isSelected && (
                        <span className="absolute inset-0 bg-slate-950/35 flex items-center justify-center">
                          <Play className="w-5 h-5 text-white fill-white" aria-hidden="true" />
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-bold text-indigo-950 dark:text-white truncate">
                        {vid.title}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                        {vid.authorName} · {vid.isShort ? 'Short' : 'Video'}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(vid.id)}
                      aria-label={vid.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
                      className="p-2 rounded-lg text-slate-500 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          vid.isFavorite ? 'text-rose-500 fill-rose-500' : 'text-slate-400'
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteVideo(vid.id)}
                      aria-label={`Remove ${vid.title}`}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
          Saved privately for {childName}. Tip: Use <strong>Cast to Speaker</strong> above or your
          iPad AirPlay / Bluetooth speaker for loud living-room sound.
        </p>
      </div>
    </section>
  );
};
