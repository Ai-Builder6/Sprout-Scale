import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Moon,
  Search,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import {
  calculateExactAgeFromDob,
  ChildPhotoRecord,
  ChildProfile,
  formatAgeLabel,
  formatFeetInches,
  formatHeightDelta,
  formatHumanDate,
  formatPounds,
  getLocalTodayIso,
  GrowthMeasurement,
  MilestoneEventRecord,
} from '../types';
import { useAgeAwareAppAvatar, useDefaultAppAvatar } from '../services/defaultAvatarService';
import {
  buildEstimatedWordTimings,
  buildStarterReadAlongBooks,
  deleteChildStorybook,
  fetchStorybookReadAloudAudio,
  generatePersonalizedStorybook,
  loadChildStorybooks,
  saveChildStorybook,
  SavedStorybook,
  searchAndFetchReadAlongBook,
  StorybookAudioResult,
  StorybookMode,
  StorybookWordTiming,
} from '../services/storybookService';
import {
  ClassicStoryTemplate,
  instantiateClassicStoryForChild,
  searchClassicCatalog,
} from '../services/classicStoriesCatalog';
import {
  ElevenLabsVoiceOption,
  fetchElevenLabsVoices,
  getSavedElevenLabsVoiceId,
  saveElevenLabsVoiceId,
} from '../services/elevenLabsVoiceService';
import daytimeMeadowImg from '../assets/images/storybook_daytime_meadow_1795383306501.jpg';
import bedtimeStarlightImg from '../assets/images/storybook_bedtime_starlight_1795383305955.jpg';

interface StorybookTimePageProps {
  activeChild: ChildProfile;
  childrenList: ChildProfile[];
  activePhotos: ChildPhotoRecord[];
  activeEvents: MilestoneEventRecord[];
  activeMeasurements: GrowthMeasurement[];
  currentHeightCm: number;
  currentWeightKg: number;
  currentAgeMonths: number;
  onSelectChild: (childId: string) => void;
  onBackToGrowthWall: () => void;
  onQuickUploadDayPhoto: (files: FileList) => Promise<void>;
  isDark: boolean;
  onToggleTheme: () => void;
}

const DAYTIME_QUICK_IDEAS = [
  'Exploring the park and spotting cool bugs',
  'Building a giant block tower and laughing',
  'Helping in the kitchen and tasting yummy fruit',
  'Standing tall on the growth wall like a superhero',
];

const BEDTIME_QUICK_IDEAS = [
  'Counting twinkling stars after a busy happy day',
  'Cuddling with a favorite stuffed animal under cozy blankets',
  'Dreaming about floating on soft golden clouds',
  'Saying goodnight to toys, the moon, and tomorrow’s adventures',
];

interface ReadAlongSegmentProps {
  text: string;
  baseCharOffset: number;
  activeRange: { startChar: number; endChar: number } | null;
  isReadingActive: boolean;
  isBedtimeTheme: boolean;
  onWordTap?: (globalCharStart: number) => void;
}

const ReadAlongSegment: React.FC<ReadAlongSegmentProps> = ({
  text,
  baseCharOffset,
  activeRange,
  isReadingActive,
  isBedtimeTheme,
  onWordTap,
}) => {
  const tokens = useMemo(() => {
    const list: Array<{ chunk: string; isWord: boolean; start: number; end: number }> = [];
    const regex = /(\S+|\s+)/g;
    let match: RegExpExecArray | null = regex.exec(text);
    while (match !== null) {
      const chunk = match[0];
      list.push({
        chunk,
        isWord: !/^\s+$/.test(chunk),
        start: baseCharOffset + match.index,
        end: baseCharOffset + match.index + chunk.length,
      });
      match = regex.exec(text);
    }
    return list;
  }, [text, baseCharOffset]);

  return (
    <>
      {tokens.map((tok, idx) => {
        if (!tok.isWord) {
          return <React.Fragment key={idx}>{tok.chunk}</React.Fragment>;
        }

        const isLit = Boolean(
          activeRange && activeRange.startChar < tok.end && activeRange.endChar > tok.start,
        );
        const isPast = Boolean(activeRange && tok.end <= activeRange.startChar);

        let stateClass = '';
        if (isLit) {
          stateClass = isBedtimeTheme
            ? 'bg-amber-300 text-indigo-950 font-bold shadow-[0_0_16px_rgba(252,211,77,0.75)] ring-2 ring-amber-200/80'
            : 'bg-amber-300 text-slate-950 font-bold shadow-xs ring-2 ring-amber-400/75';
        } else if (isReadingActive && !isPast) {
          stateClass = isBedtimeTheme
            ? 'text-indigo-100/70'
            : 'text-slate-700/70 dark:text-slate-200/70';
        } else if (isReadingActive && isPast) {
          stateClass = isBedtimeTheme
            ? 'text-amber-100'
            : 'text-indigo-950 dark:text-white';
        }

        return (
          <span
            key={idx}
            onClick={onWordTap ? () => onWordTap(tok.start) : undefined}
            title={onWordTap ? 'Tap word to hear from here' : undefined}
            className={`inline rounded-md px-0.5 -mx-0.5 transition-colors duration-100 ${
              onWordTap ? 'cursor-pointer hover:underline decoration-amber-400/70' : ''
            } ${stateClass}`}
          >
            {tok.chunk}
          </span>
        );
      })}
    </>
  );
};

export const StorybookTimePage: React.FC<StorybookTimePageProps> = ({
  activeChild,
  childrenList,
  activePhotos,
  activeEvents,
  activeMeasurements,
  currentHeightCm,
  currentWeightKg,
  currentAgeMonths,
  onSelectChild,
  onBackToGrowthWall,
  onQuickUploadDayPhoto,
  isDark,
  onToggleTheme,
}) => {
  const defaultAppAvatar = useDefaultAppAvatar();
  const childAgeAvatar = useAgeAwareAppAvatar(currentAgeMonths);
  const todayIso = getLocalTodayIso();

  // Default to Bedtime after 6 PM local time, otherwise Daytime Adventure
  const [mode, setMode] = useState<StorybookMode>(() => {
    const hour = new Date().getHours();
    return hour >= 18 || hour < 6 ? 'bedtime' : 'daytime';
  });

  // ElevenLabs Storybook Announcer voice selection (synced with app-wide ElevenLabs announcer)
  const [narratorVoices, setNarratorVoices] = useState<ElevenLabsVoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(() => getSavedElevenLabsVoiceId());

  useEffect(() => {
    let active = true;
    void fetchElevenLabsVoices().then((res) => {
      if (!active || !res.configured) return;
      setNarratorVoices(res.voices);
      const saved = getSavedElevenLabsVoiceId();
      if (!saved && res.defaultVoiceId) {
        setSelectedVoiceId(res.defaultVoiceId);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Collect distinct dates that have photos or events for THIS active child, always including Today
  const availableStoryDates = useMemo(() => {
    const dateSet = new Set<string>([todayIso]);
    for (const p of activePhotos) {
      if (p.capturedDate) dateSet.add(p.capturedDate);
    }
    for (const ev of activeEvents) {
      if (ev.eventDate) dateSet.add(ev.eventDate);
    }
    return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  }, [activePhotos, activeEvents, todayIso]);

  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [todayPrompt, setTodayPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Classic & On-Demand Read-Along Story Search state
  const [storySearchQuery, setStorySearchQuery] = useState<string>('');
  const [isSearchingStory, setIsSearchingStory] = useState<boolean>(false);
  const [searchStoryError, setSearchStoryError] = useState<string | null>(null);

  // Per-child bookshelf + active open storybook state
  const [savedBooks, setSavedBooks] = useState<SavedStorybook[]>(() =>
    loadChildStorybooks(activeChild.id),
  );
  const [openBook, setOpenBook] = useState<SavedStorybook | null>(null);
  const [currentPageIdx, setCurrentPageIdx] = useState<number>(0);

  // Read-aloud narration & synchronized word-lighting state
  const [isReadingAloud, setIsReadingAloud] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [isAutoReadingWholeBook, setIsAutoReadingWholeBook] = useState<boolean>(false);
  const [readAlongSpeed, setReadAlongSpeed] = useState<'normal' | 'slow'>('normal');
  const [activeWordRange, setActiveWordRange] = useState<{
    startChar: number;
    endChar: number;
  } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, StorybookAudioResult>>(new Map());
  const activeTimingsRef = useRef<StorybookWordTiming[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const readAlongSpeedRef = useRef<'normal' | 'slow'>(readAlongSpeed);
  const wholeBookActiveRef = useRef<boolean>(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    readAlongSpeedRef.current = readAlongSpeed;
    if (audioRef.current) {
      audioRef.current.playbackRate = readAlongSpeed === 'slow' ? 0.84 : 1.0;
    }
  }, [readAlongSpeed]);

  const stopHighlightLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const stopReadAloud = useCallback(() => {
    wholeBookActiveRef.current = false;
    stopHighlightLoop();
    setIsAutoReadingWholeBook(false);
    setIsReadingAloud(false);
    setIsLoadingAudio(false);
    setActiveWordRange(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore speech cancel issues
      }
    }
  }, [stopHighlightLoop]);

  // Whenever the signed-in / selected child switches (e.g. Tommy -> Joey -> Sandra),
  // immediately switch the bookshelf, open book, date & selected photos to THAT child!
  useEffect(() => {
    stopReadAloud();
    const childBooks = loadChildStorybooks(activeChild.id);
    setSavedBooks(childBooks);
    setOpenBook(null);
    setCurrentPageIdx(0);
    setErrorMsg(null);
    setTodayPrompt('');
    setSelectedDate(todayIso);
  }, [activeChild.id, stopReadAloud, todayIso]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      stopReadAloud();
    };
  }, [stopReadAloud]);

  // Photos belonging strictly to the active child, prioritizing the selected story date
  const photosForSelectedDay = useMemo(() => {
    return activePhotos.filter(
      (p) => p.childId === activeChild.id && p.capturedDate === selectedDate && p.localDataUrl,
    );
  }, [activePhotos, activeChild.id, selectedDate]);

  const recentLibraryPhotos = useMemo(() => {
    return activePhotos.filter(
      (p) => p.childId === activeChild.id && p.localDataUrl && p.capturedDate !== selectedDate,
    );
  }, [activePhotos, activeChild.id, selectedDate]);

  const eventsForSelectedDay = useMemo(() => {
    return activeEvents.filter(
      (ev) => ev.childId === activeChild.id && ev.eventDate === selectedDate,
    );
  }, [activeEvents, activeChild.id, selectedDate]);

  // Auto-select up to 2 photos taken on the chosen day so the story mirrors that day's pictures!
  useEffect(() => {
    if (photosForSelectedDay.length > 0) {
      setSelectedPhotoIds(photosForSelectedDay.slice(0, 2).map((p) => p.id));
    } else {
      setSelectedPhotoIds([]);
    }
  }, [photosForSelectedDay]);

  const photoMapById = useMemo(() => {
    const map = new Map<string, ChildPhotoRecord>();
    for (const p of activePhotos) {
      if (p.childId === activeChild.id) {
        map.set(p.id, p);
      }
    }
    return map;
  }, [activePhotos, activeChild.id]);

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds((prev) => {
      if (prev.includes(photoId)) {
        return prev.filter((id) => id !== photoId);
      }
      if (prev.length >= 2) {
        return [prev[1], photoId];
      }
      return [...prev, photoId];
    });
  };

  const handleUploadPhotosForToday = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingPhoto(true);
    setErrorMsg(null);
    try {
      await onQuickUploadDayPhoto(files);
      setSelectedDate(todayIso);
    } catch {
      setErrorMsg('Could not add photo to the library. Please try another image.');
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  // Growth summary strictly for the active child
  const heightGainCm = Math.max(0, currentHeightCm - activeChild.ageTwoHeightCm);
  const heightSummary = `${formatFeetInches(currentHeightCm)} tall and ${formatPounds(currentWeightKg)}`;
  const gainedSummary =
    heightGainCm >= 0.5
      ? `grew ${formatHeightDelta(heightGainCm)} since turning Age 2`
      : `celebrating ${formatAgeLabel(currentAgeMonths)} of growing strong`;

  const latestMeasurementNote = useMemo(() => {
    const sorted = [...activeMeasurements].sort((a, b) => b.ageMonths - a.ageMonths);
    return sorted[0]?.note || '';
  }, [activeMeasurements]);

  const handleGenerateStory = async () => {
    stopReadAloud();
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const chosenPhotos = selectedPhotoIds
        .map((id) => photoMapById.get(id))
        .filter((p): p is ChildPhotoRecord => Boolean(p && p.localDataUrl));

      const dayEventDescriptions = [
        ...eventsForSelectedDay.map((ev) =>
          ev.story ? `${ev.title}: ${ev.story}` : ev.title,
        ),
        ...(latestMeasurementNote ? [`Recent growth note: ${latestMeasurementNote}`] : []),
      ];

      const photoCaptions = chosenPhotos.map((p) => {
        const parts = [p.eventTitle, p.caption].filter(Boolean);
        return parts.length > 0
          ? `${parts.join(' — ')} (${formatHumanDate(p.capturedDate)})`
          : `Photo taken on ${formatHumanDate(p.capturedDate)}`;
      });

      const generated = await generatePersonalizedStorybook({
        childId: activeChild.id,
        childName: activeChild.name,
        ageMonths: currentAgeMonths,
        sex: activeChild.sex,
        mode,
        storyDate: selectedDate,
        heightSummary,
        gainedSummary,
        todayPrompt: todayPrompt.trim(),
        dayEvents: dayEventDescriptions,
        photoCaptions,
        photoDataUrls: chosenPhotos.map((p) => p.localDataUrl!),
        photoIds: chosenPhotos.map((p) => p.id),
      });

      const nextBooks = saveChildStorybook(generated);
      setSavedBooks(nextBooks);
      setOpenBook(generated);
      setCurrentPageIdx(0);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not create the story right now. Please try again.';
      setErrorMsg(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // Speak one page using ElevenLabs announcer with exact word-by-word read-along lighting
  const speakPage = useCallback(
    async (
      book: SavedStorybook,
      pageIndex: number,
      continueAfter: boolean,
      startAtChar?: number,
    ) => {
      const page = book.pages[pageIndex];
      if (!page) {
        stopReadAloud();
        return;
      }

      const isFinalPage = pageIndex === book.pages.length - 1;
      const narrationText = isFinalPage
        ? `${page.heading}. ${page.text} ${book.closingLine}`
        : `${page.heading}. ${page.text}`;

      const voiceKey = selectedVoiceId || 'default';
      const cacheKey = `${book.id}_${pageIndex}_${book.mode}_${voiceKey}`;
      setIsLoadingAudio(true);

      const handleFinished = () => {
        stopHighlightLoop();
        setActiveWordRange(null);
        if (continueAfter && wholeBookActiveRef.current && pageIndex + 1 < book.pages.length) {
          const nextIdx = pageIndex + 1;
          setCurrentPageIdx(nextIdx);
          void speakPage(book, nextIdx, true);
        } else {
          wholeBookActiveRef.current = false;
          setIsAutoReadingWholeBook(false);
          setIsReadingAloud(false);
          setIsLoadingAudio(false);
        }
      };

      const startSyncLoop = (audioEl: HTMLAudioElement, initialTimings: StorybookWordTiming[]) => {
        stopHighlightLoop();
        activeTimingsRef.current = initialTimings;

        const tick = () => {
          if (audioRef.current !== audioEl || audioEl.ended) {
            return;
          }
          let timings = activeTimingsRef.current;
          if (
            timings.length === 0 &&
            Number.isFinite(audioEl.duration) &&
            audioEl.duration > 0
          ) {
            timings = buildEstimatedWordTimings(narrationText, audioEl.duration);
            activeTimingsRef.current = timings;
          }

          if (timings.length > 0) {
            // Slight 45ms lookahead makes the glowing word feel snappy & synced to the voice
            const t = audioEl.currentTime + 0.045;
            let matched: StorybookWordTiming | null = null;
            for (let i = 0; i < timings.length; i += 1) {
              const item = timings[i];
              if (t >= item.startSec && t <= item.endSec + 0.14) {
                matched = item;
                break;
              }
              if (t >= item.startSec) {
                matched = item;
              }
            }
            if (matched) {
              setActiveWordRange((prev) =>
                prev &&
                prev.startChar === matched!.startChar &&
                prev.endChar === matched!.endChar
                  ? prev
                  : { startChar: matched!.startChar, endChar: matched!.endChar },
              );
            }
          }
          rafIdRef.current = window.requestAnimationFrame(tick);
        };
        rafIdRef.current = window.requestAnimationFrame(tick);
      };

      const fallbackBrowserSpeech = () => {
        stopHighlightLoop();
        setIsLoadingAudio(false);
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
          handleFinished();
          return;
        }
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(narrationText);
          const baseRate = book.mode === 'bedtime' ? 0.84 : 0.96;
          utter.rate = readAlongSpeedRef.current === 'slow' ? baseRate * 0.86 : baseRate;
          utter.pitch = book.mode === 'bedtime' ? 0.94 : 1.06;
          utter.onstart = () => setIsReadingAloud(true);
          utter.onboundary = (event) => {
            if (typeof event.charIndex === 'number') {
              const idx = event.charIndex;
              const rest = narrationText.slice(idx);
              const wordMatch = rest.match(/^\S+/);
              const wordLen = wordMatch ? wordMatch[0].length : Math.max(1, event.charLength || 1);
              setActiveWordRange({ startChar: idx, endChar: idx + wordLen });
            }
          };
          utter.onend = handleFinished;
          utter.onerror = handleFinished;
          setIsReadingAloud(true);
          window.speechSynthesis.speak(utter);
        } catch {
          handleFinished();
        }
      };

      try {
        let cached = audioCacheRef.current.get(cacheKey);
        if (!cached) {
          const fetched = await fetchStorybookReadAloudAudio(
            narrationText,
            book.mode,
            selectedVoiceId || undefined,
          );
          if (fetched?.audioDataUrl) {
            cached = fetched;
            audioCacheRef.current.set(cacheKey, fetched);
          }
        }

        if (continueAfter && !wholeBookActiveRef.current) {
          setIsLoadingAudio(false);
          return;
        }

        if (!cached?.audioDataUrl) {
          fallbackBrowserSpeech();
          return;
        }

        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.onended = null;
          audioRef.current.onerror = null;
        }

        const audio = new Audio(cached.audioDataUrl);
        audio.playbackRate = readAlongSpeedRef.current === 'slow' ? 0.84 : 1.0;
        audioRef.current = audio;

        if (typeof startAtChar === 'number' && cached.wordTimings.length > 0) {
          const targetTiming = cached.wordTimings.find(
            (w) => startAtChar >= w.startChar && startAtChar <= w.endChar,
          );
          if (targetTiming) {
            audio.currentTime = Math.max(0, targetTiming.startSec - 0.02);
          }
        }

        setIsLoadingAudio(false);
        setIsReadingAloud(true);
        audio.onended = handleFinished;
        audio.onerror = fallbackBrowserSpeech;
        await audio.play();
        startSyncLoop(audio, cached.wordTimings);
      } catch {
        fallbackBrowserSpeech();
      }
    },
    [stopReadAloud, stopHighlightLoop, selectedVoiceId],
  );

  const handleTapWordToHear = useCallback(
    (globalCharStart: number) => {
      if (!openBook) return;
      // If current audio is already playing with timings, seek instantaneously!
      if (audioRef.current && !audioRef.current.ended && activeTimingsRef.current.length > 0) {
        const hit = activeTimingsRef.current.find(
          (w) => globalCharStart >= w.startChar && globalCharStart <= w.endChar,
        );
        if (hit) {
          audioRef.current.currentTime = Math.max(0, hit.startSec - 0.02);
          setActiveWordRange({ startChar: hit.startChar, endChar: hit.endChar });
          if (audioRef.current.paused) {
            void audioRef.current.play();
            setIsReadingAloud(true);
          }
          return;
        }
      }
      // Otherwise launch narration starting right at the tapped word!
      wholeBookActiveRef.current = false;
      setIsAutoReadingWholeBook(false);
      void speakPage(openBook, currentPageIdx, false, globalCharStart);
    },
    [openBook, currentPageIdx, speakPage],
  );

  // Ready-to-read personalized Read-Along Starter Stories for the active child
  const starterReadAlongBooks = useMemo(
    () =>
      buildStarterReadAlongBooks({
        childId: activeChild.id,
        childName: activeChild.name,
        ageMonths: currentAgeMonths,
        heightSummary,
        storyDate: todayIso,
      }),
    [activeChild.id, activeChild.name, currentAgeMonths, heightSummary, todayIso],
  );

  const handleOpenAndReadAlong = (book: SavedStorybook) => {
    stopReadAloud();
    setMode(book.mode);
    setOpenBook(book);
    setCurrentPageIdx(0);
    wholeBookActiveRef.current = true;
    setIsAutoReadingWholeBook(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    void speakPage(book, 0, true);
  };

  // Live filtered classic catalog (Three Little Pigs, Itsy Bitsy Spider, etc.)
  const matchingClassicStories = useMemo(
    () => searchClassicCatalog(storySearchQuery),
    [storySearchQuery],
  );

  const handleDownloadClassicBook = (template: ClassicStoryTemplate) => {
    const book = instantiateClassicStoryForChild(template, {
      childId: activeChild.id,
      childName: activeChild.name,
      ageMonths: currentAgeMonths,
      storyDate: todayIso,
    });
    const updatedBookshelf = saveChildStorybook(book);
    setSavedBooks(updatedBookshelf);
    handleOpenAndReadAlong(book);
  };

  const handleSearchAndDownloadStory = async (
    queryOverride?: string,
    forceFetchCustom = false,
  ) => {
    const q = (queryOverride ?? storySearchQuery).trim();
    if (!q || isSearchingStory) return;
    setSearchStoryError(null);

    // If user didn't force custom fetch and an exact instant classic matches, download & launch immediately!
    if (!forceFetchCustom) {
      const instantMatches = searchClassicCatalog(q);
      const qLower = q.toLowerCase();
      const exactMatch =
        instantMatches.length === 1
          ? instantMatches[0]
          : instantMatches.find(
              (c) =>
                c.title.toLowerCase() === qLower ||
                c.title.toLowerCase().replace(/^the\s+/, '') === qLower.replace(/^the\s+/, ''),
            );
      if (exactMatch) {
        handleDownloadClassicBook(exactMatch);
        return;
      }
    }

    stopReadAloud();
    setIsSearchingStory(true);
    try {
      const downloaded = await searchAndFetchReadAlongBook({
        query: q,
        childId: activeChild.id,
        childName: activeChild.name,
        ageMonths: currentAgeMonths,
        mode,
        storyDate: todayIso,
      });
      const updatedBookshelf = saveChildStorybook(downloaded);
      setSavedBooks(updatedBookshelf);
      setStorySearchQuery('');
      handleOpenAndReadAlong(downloaded);
    } catch (err: unknown) {
      setSearchStoryError(
        err instanceof Error
          ? err.message
          : 'Could not download that story right now. Please try again.',
      );
    } finally {
      setIsSearchingStory(false);
    }
  };

  const handleToggleReadCurrentPage = () => {
    if (!openBook) return;
    if (isReadingAloud || isLoadingAudio) {
      stopReadAloud();
      return;
    }
    wholeBookActiveRef.current = false;
    setIsAutoReadingWholeBook(false);
    void speakPage(openBook, currentPageIdx, false);
  };

  const handleReadWholeStory = () => {
    if (!openBook) return;
    if (isAutoReadingWholeBook) {
      stopReadAloud();
      return;
    }
    stopReadAloud();
    wholeBookActiveRef.current = true;
    setIsAutoReadingWholeBook(true);
    void speakPage(openBook, currentPageIdx, true);
  };

  // Keyboard page turning when a book is open
  useEffect(() => {
    if (!openBook) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentPageIdx < openBook.pages.length - 1) {
        stopReadAloud();
        setCurrentPageIdx((i) => Math.min(openBook.pages.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft' && currentPageIdx > 0) {
        stopReadAloud();
        setCurrentPageIdx((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openBook, currentPageIdx, stopReadAloud]);

  const activeBookMode: StorybookMode = openBook ? openBook.mode : mode;
  const isBedtimeTheme = activeBookMode === 'bedtime';
  const activeBookPage = openBook ? openBook.pages[currentPageIdx] ?? openBook.pages[0] : null;

  // Resolve the featured real photo for the current book page if assigned
  const featuredPagePhoto = useMemo(() => {
    if (!openBook || !activeBookPage) return null;
    if (activeBookPage.usePhotoIndex < 0) return null;
    const pid = openBook.photoIds[activeBookPage.usePhotoIndex];
    if (!pid) return null;
    return photoMapById.get(pid) ?? null;
  }, [openBook, activeBookPage, photoMapById]);

  const quickIdeas = mode === 'bedtime' ? BEDTIME_QUICK_IDEAS : DAYTIME_QUICK_IDEAS;
  const childAgeDisplay = activeChild.birthDate
    ? calculateExactAgeFromDob(activeChild.birthDate)?.formattedShortAge ??
      formatAgeLabel(currentAgeMonths)
    : formatAgeLabel(currentAgeMonths);

  return (
    <section
      aria-label="Storybook Time"
      className={`rounded-3xl border-2 p-4 sm:p-6 lg:p-8 space-y-6 transition-colors duration-300 ${
        isBedtimeTheme
          ? 'bg-gradient-to-b from-indigo-950 via-slate-900 to-indigo-950 border-indigo-700/80 text-indigo-50'
          : 'bg-gradient-to-b from-amber-50/95 via-white to-sky-50/90 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/90 border-amber-300 dark:border-slate-700 text-slate-900 dark:text-slate-100'
      }`}
    >
      {/* Top Storybook Header & Child Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-current/10">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                stopReadAloud();
                onBackToGrowthWall();
              }}
              className={`min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isBedtimeTheme
                  ? 'border-indigo-700 bg-indigo-900/70 text-indigo-100 hover:bg-indigo-800'
                  : 'border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-950 dark:text-slate-100 hover:bg-sky-50 dark:hover:bg-slate-700'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Back to Growth Wall
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              className={`min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isBedtimeTheme
                  ? 'border-indigo-700 bg-indigo-900/70 text-amber-200 hover:bg-indigo-800'
                  : 'border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-950 dark:text-amber-300 hover:bg-sky-50 dark:hover:bg-slate-700'
              }`}
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>

          <h1
            className={`text-2xl sm:text-3xl font-display font-bold tracking-tight [text-wrap:balance] ${
              isBedtimeTheme ? 'text-white' : 'text-indigo-950 dark:text-white'
            }`}
          >
            {activeChild.name}’s Storybook Time
          </h1>
          <p
            className={`text-xs sm:text-sm max-w-2xl leading-relaxed ${
              isBedtimeTheme ? 'text-indigo-200' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Personal daytime adventures and cozy bedtime stories starring{' '}
            <strong>{activeChild.name}</strong> ({childAgeDisplay}), woven from their own photos and
            memories of the day.
          </p>
        </div>

        {/* Multi-Child Selector — Switch between Tommy, Joey, Sandra, etc. */}
        <div className="space-y-1.5">
          <span
            className={`block text-[11px] font-semibold ${
              isBedtimeTheme ? 'text-indigo-300' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Starring Child
          </span>
          <div
            role="group"
            aria-label="Choose which child stars in the story"
            className={`flex flex-wrap items-center gap-1.5 p-1 rounded-xl border ${
              isBedtimeTheme
                ? 'bg-indigo-900/70 border-indigo-700'
                : 'bg-sky-100/80 dark:bg-slate-800 border-sky-200 dark:border-slate-700'
            }`}
          >
            {childrenList.map((kid) => {
              const selected = kid.id === activeChild.id;
              return (
                <button
                  key={kid.id}
                  type="button"
                  onClick={() => onSelectChild(kid.id)}
                  className={`min-h-[40px] inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selected
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : isBedtimeTheme
                        ? 'text-indigo-100 hover:bg-indigo-800/80'
                        : 'text-indigo-950 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-700'
                  }`}
                >
                  <img
                    src={defaultAppAvatar.portraitUrl}
                    alt=""
                    aria-hidden="true"
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover object-top bg-sky-50 border border-white/80 shrink-0"
                  />
                  <span>{kid.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mode Switcher: Daytime Adventure vs. Bedtime Story */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            stopReadAloud();
            setMode('daytime');
            if (openBook && openBook.mode !== 'daytime') {
              setOpenBook(null);
            }
          }}
          className={`min-h-[64px] p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3.5 cursor-pointer ${
            mode === 'daytime'
              ? 'bg-amber-100/90 dark:bg-amber-500/20 border-amber-400 text-indigo-950 dark:text-amber-100 shadow-xs'
              : isBedtimeTheme
                ? 'bg-indigo-900/40 border-indigo-800 text-indigo-200 hover:border-indigo-600'
                : 'bg-white/80 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-300'
          }`}
        >
          <div className="w-11 h-11 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
            <Sun className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-snug">Daytime Adventure</p>
            <p className="text-xs opacity-80 leading-snug">
              Sunny, playful story celebrating {activeChild.name}’s energy &amp; discoveries
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            stopReadAloud();
            setMode('bedtime');
            if (openBook && openBook.mode !== 'bedtime') {
              setOpenBook(null);
            }
          }}
          className={`min-h-[64px] p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3.5 cursor-pointer ${
            mode === 'bedtime'
              ? 'bg-indigo-900 border-amber-300 text-white shadow-xs'
              : 'bg-white/80 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
          }`}
        >
          <div className="w-11 h-11 rounded-xl bg-indigo-700 text-amber-300 flex items-center justify-center shrink-0">
            <Moon className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-snug">Bedtime Story</p>
            <p className="text-xs opacity-80 leading-snug">
              Gentle, starlight wind-down tale tucking {activeChild.name} into sweet dreams
            </p>
          </div>
        </button>
      </div>

      {/* Main Split: Interactive Picture Book Reader OR Story Composer + Child's Bookshelf */}
      {openBook && activeBookPage ? (
        <div className="space-y-5">
          {/* Open Book Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div
                className={`text-xs font-medium ${
                  isBedtimeTheme ? 'text-amber-300' : 'text-sky-800 dark:text-sky-300'
                }`}
              >
                <span>{openBook.mode === 'bedtime' ? 'Bedtime Story' : 'Daytime Adventure'}</span>
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                <span>Starring {openBook.childName}</span>
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                <span>{formatHumanDate(openBook.storyDate)}</span>
              </div>
              <h2
                className={`text-xl sm:text-2xl font-display font-bold ${
                  isBedtimeTheme ? 'text-white' : 'text-indigo-950 dark:text-white'
                }`}
              >
                {openBook.title}
              </h2>
              <p
                className={`text-xs ${
                  isBedtimeTheme ? 'text-indigo-200' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {openBook.dedication}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {narratorVoices.length > 0 && (
                <label className="inline-flex items-center gap-1.5">
                  <span className="sr-only">Story Announcer Voice</span>
                  <select
                    aria-label="Story Announcer Voice"
                    value={selectedVoiceId}
                    onChange={(e) => {
                      stopReadAloud();
                      const nextId = e.target.value;
                      setSelectedVoiceId(nextId);
                      saveElevenLabsVoiceId(nextId);
                    }}
                    className={`min-h-[44px] max-w-[180px] px-3 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                      isBedtimeTheme
                        ? 'border-indigo-700 bg-indigo-900/80 text-indigo-100'
                        : 'border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-950 dark:text-slate-100'
                    }`}
                  >
                    {narratorVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}{v.accent ? ` (${v.accent})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button
                type="button"
                onClick={() => setReadAlongSpeed((s) => (s === 'normal' ? 'slow' : 'normal'))}
                title="Switch between normal speed and slower early-reader speed"
                className={`min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  readAlongSpeed === 'slow'
                    ? 'border-emerald-500 bg-emerald-600 text-white'
                    : isBedtimeTheme
                      ? 'border-indigo-700 bg-indigo-900/80 text-indigo-100 hover:bg-indigo-800'
                      : 'border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-950 dark:text-slate-100 hover:bg-sky-50 dark:hover:bg-slate-700'
                }`}
              >
                {readAlongSpeed === 'slow' ? 'Early Reader 0.85×' : 'Normal 1×'}
              </button>

              <button
                type="button"
                onClick={handleToggleReadCurrentPage}
                className={`min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isReadingAloud && !isAutoReadingWholeBook
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                }`}
              >
                {isLoadingAudio && !isAutoReadingWholeBook ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : isReadingAloud && !isAutoReadingWholeBook ? (
                  <Square className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                )}
                {isReadingAloud && !isAutoReadingWholeBook ? 'Stop Voice' : 'Read Along Page'}
              </button>

              <button
                type="button"
                onClick={handleReadWholeStory}
                className={`min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isAutoReadingWholeBook
                    ? 'bg-rose-600 border-rose-500 text-white'
                    : isBedtimeTheme
                      ? 'bg-indigo-800 border-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-sky-600 border-sky-600 text-white hover:bg-sky-700'
                }`}
              >
                {isLoadingAudio && isAutoReadingWholeBook ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : isAutoReadingWholeBook ? (
                  <Square className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <BookOpen className="w-4 h-4" aria-hidden="true" />
                )}
                {isAutoReadingWholeBook ? 'Stop Story' : 'Read Whole Book'}
              </button>

              <button
                type="button"
                onClick={() => {
                  stopReadAloud();
                  setOpenBook(null);
                }}
                className={`min-h-[44px] px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isBedtimeTheme
                    ? 'border-indigo-700 bg-indigo-900/80 text-indigo-100 hover:bg-indigo-800'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                Make Another Story
              </button>
            </div>
          </div>

          {/* Open Two-Column Illustrated Picture Book Spread */}
          <article
            className={`grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden border-2 shadow-sm items-stretch ${
              isBedtimeTheme
                ? 'bg-indigo-950/90 border-indigo-700'
                : 'bg-white dark:bg-slate-900 border-amber-200 dark:border-slate-700'
            }`}
          >
            {/* Left Spread: Illustrated Scene + Child Character + Day's Real Photo */}
            <div className="lg:col-span-6 relative min-h-[280px] sm:min-h-[360px] flex items-center justify-center overflow-hidden bg-slate-900">
              <img
                src={openBook.mode === 'bedtime' ? bedtimeStarlightImg : daytimeMeadowImg}
                alt={
                  openBook.mode === 'bedtime'
                    ? 'Starry bedtime watercolor illustration'
                    : 'Sunlit meadow daytime watercolor illustration'
                }
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div
                aria-hidden="true"
                className={`absolute inset-0 ${
                  openBook.mode === 'bedtime'
                    ? 'bg-gradient-to-t from-indigo-950/85 via-indigo-950/25 to-transparent'
                    : 'bg-gradient-to-t from-slate-950/65 via-transparent to-transparent'
                }`}
              />

              {/* Featured Photo of the Day OR SproutScale Kid Character */}
              {featuredPagePhoto && featuredPagePhoto.localDataUrl ? (
                <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 p-5 sm:p-6 w-full justify-center">
                  <figure className="bg-white p-2.5 pb-3 rounded-2xl shadow-lg max-w-[230px] sm:max-w-[260px] -rotate-1 border border-amber-200">
                    <img
                      src={featuredPagePhoto.localDataUrl}
                      alt={featuredPagePhoto.caption || `${openBook.childName}'s photo from today`}
                      referrerPolicy="no-referrer"
                      className="w-full h-44 sm:h-52 object-cover rounded-xl"
                    />
                    <figcaption className="mt-2 text-[11px] font-semibold text-slate-700 text-center truncate">
                      {featuredPagePhoto.eventTitle ||
                        featuredPagePhoto.caption ||
                        `${openBook.childName} · ${formatHumanDate(featuredPagePhoto.capturedDate)}`}
                    </figcaption>
                  </figure>
                  <img
                    src={childAgeAvatar.fullBodyUrl}
                    alt={`${openBook.childName} SproutScale character`}
                    referrerPolicy="no-referrer"
                    className="h-36 sm:h-44 w-auto object-contain drop-shadow-md shrink-0"
                  />
                </div>
              ) : (
                <div className="relative z-10 flex flex-col items-center justify-end pt-8 pb-6 px-6">
                  <img
                    src={childAgeAvatar.fullBodyUrl}
                    alt={`${openBook.childName} SproutScale character`}
                    referrerPolicy="no-referrer"
                    className="h-48 sm:h-60 w-auto object-contain drop-shadow-xl"
                  />
                </div>
              )}

              {/* Bottom Left Page Caption */}
              <div className="absolute bottom-3 left-4 right-4 z-10 flex items-center justify-between text-xs font-semibold text-white">
                <span>
                  Page {activeBookPage.pageNumber} of {openBook.pages.length}
                </span>
                <span>{openBook.childName}’s Story</span>
              </div>
            </div>

            {/* Right Spread: Synchronized Read-Along Typography & Page Controls */}
            <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div
                    className={`text-xs sm:text-sm font-mono tabular-nums font-semibold ${
                      isBedtimeTheme ? 'text-amber-300' : 'text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    <span>Page 0{activeBookPage.pageNumber} · </span>
                    <ReadAlongSegment
                      text={activeBookPage.heading}
                      baseCharOffset={0}
                      activeRange={activeWordRange}
                      isReadingActive={isReadingAloud}
                      isBedtimeTheme={isBedtimeTheme}
                      onWordTap={handleTapWordToHear}
                    />
                  </div>
                  <span
                    className={`text-[11px] font-semibold ${
                      isBedtimeTheme ? 'text-indigo-300' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {isReadingAloud
                      ? 'Follow the glowing words · Tap any word to repeat'
                      : 'Tap Read Along or tap any word to follow along'}
                  </span>
                </div>

                <p
                  className={`text-xl sm:text-2xl leading-[1.75] font-medium tracking-[0.01em] ${
                    isBedtimeTheme ? 'text-indigo-50' : 'text-slate-800 dark:text-slate-100'
                  }`}
                >
                  <ReadAlongSegment
                    text={activeBookPage.text}
                    baseCharOffset={activeBookPage.heading.length + 2}
                    activeRange={activeWordRange}
                    isReadingActive={isReadingAloud}
                    isBedtimeTheme={isBedtimeTheme}
                    onWordTap={handleTapWordToHear}
                  />
                </p>

                {/* Final Page Keepsake Closing Line + Parent-Child Question */}
                {currentPageIdx === openBook.pages.length - 1 && (
                  <div
                    className={`mt-4 pt-4 border-t space-y-2.5 ${
                      isBedtimeTheme
                        ? 'border-indigo-800 text-amber-200'
                        : 'border-amber-200 dark:border-slate-700 text-indigo-950 dark:text-amber-200'
                    }`}
                  >
                    <p className="text-base sm:text-lg font-display font-bold leading-relaxed">
                      <ReadAlongSegment
                        text={openBook.closingLine}
                        baseCharOffset={
                          activeBookPage.heading.length + 2 + activeBookPage.text.length + 1
                        }
                        activeRange={activeWordRange}
                        isReadingActive={isReadingAloud}
                        isBedtimeTheme={isBedtimeTheme}
                        onWordTap={handleTapWordToHear}
                      />
                    </p>
                    <p
                      className={`text-xs sm:text-sm ${
                        isBedtimeTheme ? 'text-indigo-200' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <strong>Ask {openBook.childName}:</strong> {openBook.conversationPrompt}
                    </p>
                  </div>
                )}
              </div>

              {/* Touch-Friendly Page Navigation (48px targets) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={currentPageIdx === 0}
                    onClick={() => {
                      stopReadAloud();
                      setCurrentPageIdx((i) => Math.max(0, i - 1));
                    }}
                    className={`min-h-[48px] px-4 py-2 text-xs sm:text-sm font-bold rounded-xl border inline-flex items-center gap-1.5 transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer ${
                      isBedtimeTheme
                        ? 'border-indigo-700 bg-indigo-900 text-white hover:bg-indigo-800'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                    Previous
                  </button>

                  {/* Page Dots */}
                  <div className="flex items-center gap-1.5" role="tablist" aria-label="Story pages">
                    {openBook.pages.map((p, idx) => (
                      <button
                        key={p.pageNumber}
                        type="button"
                        role="tab"
                        aria-selected={idx === currentPageIdx}
                        aria-label={`Go to page ${idx + 1}`}
                        onClick={() => {
                          stopReadAloud();
                          setCurrentPageIdx(idx);
                        }}
                        className={`min-w-[28px] min-h-[28px] flex items-center justify-center rounded-full text-xs font-mono font-bold transition-colors cursor-pointer ${
                          idx === currentPageIdx
                            ? 'bg-amber-400 text-slate-950'
                            : isBedtimeTheme
                              ? 'bg-indigo-900 text-indigo-300 hover:bg-indigo-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={currentPageIdx >= openBook.pages.length - 1}
                    onClick={() => {
                      stopReadAloud();
                      setCurrentPageIdx((i) => Math.min(openBook.pages.length - 1, i + 1));
                    }}
                    className="min-h-[48px] px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 inline-flex items-center gap-1.5 transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Next Page
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      ) : (
        /* Story Creator Panel */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Day & Photos Picker + Story Prompt */}
          <div
            className={`lg:col-span-7 rounded-2xl border p-5 sm:p-6 space-y-5 ${
              isBedtimeTheme
                ? 'bg-indigo-900/45 border-indigo-700/80'
                : 'bg-white dark:bg-slate-900 border-sky-200 dark:border-slate-700'
            }`}
          >
            {/* 1. Pick the Day */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="storybook-day-select"
                  className="text-sm font-bold inline-flex items-center gap-1.5"
                >
                  <Calendar className="w-4 h-4 text-amber-500" aria-hidden="true" />
                  1. Choose {activeChild.name}’s Story Day
                </label>
                <span className="text-xs opacity-75">
                  {photosForSelectedDay.length}{' '}
                  {photosForSelectedDay.length === 1 ? 'photo' : 'photos'} on this day
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  id="storybook-day-select"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={`min-h-[44px] flex-1 min-w-[200px] px-3.5 py-2 text-sm font-semibold rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                    isBedtimeTheme
                      ? 'bg-indigo-950 border-indigo-700 text-white'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white'
                  }`}
                >
                  {availableStoryDates.map((d) => {
                    const photoCount = activePhotos.filter(
                      (p) => p.childId === activeChild.id && p.capturedDate === d && p.localDataUrl,
                    ).length;
                    return (
                      <option key={d} value={d}>
                        {d === todayIso ? `Today (${formatHumanDate(d)})` : formatHumanDate(d)}
                        {photoCount > 0
                          ? ` — ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`
                          : ''}
                      </option>
                    );
                  })}
                </select>

                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => void handleUploadPhotosForToday(e)}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploadingPhoto}
                  onClick={() => uploadInputRef.current?.click()}
                  className={`min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isBedtimeTheme
                      ? 'border-indigo-600 bg-indigo-800 text-white hover:bg-indigo-700'
                      : 'border-sky-300 dark:border-slate-600 bg-sky-50 dark:bg-slate-800 text-sky-900 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Camera className="w-4 h-4" aria-hidden="true" />
                  {isUploadingPhoto ? 'Adding Photo...' : 'Snap / Add Today’s Photo'}
                </button>
              </div>
            </div>

            {/* 2. Photos to Weave into the Story */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">
                  2. Photos to Include in {activeChild.name}’s Book (up to 2)
                </span>
                <span className="text-xs font-mono tabular-nums opacity-75">
                  {selectedPhotoIds.length}/2 selected
                </span>
              </div>

              {photosForSelectedDay.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {photosForSelectedDay.map((photo) => {
                    const isPicked = selectedPhotoIds.includes(photo.id);
                    return (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => togglePhotoSelection(photo.id)}
                        className={`relative rounded-xl overflow-hidden border-2 text-left transition-all cursor-pointer ${
                          isPicked
                            ? 'border-amber-400 ring-2 ring-amber-400/50'
                            : isBedtimeTheme
                              ? 'border-indigo-700 opacity-75 hover:opacity-100'
                              : 'border-slate-200 dark:border-slate-700 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={photo.localDataUrl}
                          alt={photo.caption || `${activeChild.name}'s photo`}
                          referrerPolicy="no-referrer"
                          className="w-full h-24 object-cover"
                        />
                        {isPicked && (
                          <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-sm">
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div
                  className={`rounded-xl border border-dashed p-4 text-xs space-y-2 ${
                    isBedtimeTheme
                      ? 'border-indigo-700 bg-indigo-950/50 text-indigo-200'
                      : 'border-sky-300 dark:border-slate-700 bg-sky-50/50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <p>
                    No photos taken for <strong>{activeChild.name}</strong> on{' '}
                    {formatHumanDate(selectedDate)} yet. Tap <strong>Snap / Add Today’s Photo</strong>{' '}
                    above, pick a recent library photo below, or create a story from today’s note!
                  </p>
                  {recentLibraryPhotos.length > 0 && (
                    <div className="pt-1.5 space-y-1.5">
                      <span className="block font-semibold">
                        Or include a favorite photo from {activeChild.name}’s Library:
                      </span>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {recentLibraryPhotos.slice(0, 6).map((photo) => {
                          const isPicked = selectedPhotoIds.includes(photo.id);
                          return (
                            <button
                              key={photo.id}
                              type="button"
                              onClick={() => togglePhotoSelection(photo.id)}
                              className={`relative rounded-lg overflow-hidden border-2 cursor-pointer ${
                                isPicked
                                  ? 'border-amber-400'
                                  : isBedtimeTheme
                                    ? 'border-indigo-700 opacity-75 hover:opacity-100'
                                    : 'border-slate-200 dark:border-slate-700 opacity-80 hover:opacity-100'
                              }`}
                            >
                              <img
                                src={photo.localDataUrl}
                                alt={photo.caption || `${activeChild.name}'s library photo`}
                                referrerPolicy="no-referrer"
                                className="w-full h-16 object-cover"
                              />
                              {isPicked && (
                                <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center">
                                  <Check className="w-3 h-3" aria-hidden="true" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Optional Note About What Happened Today */}
            <div className="space-y-2">
              <label htmlFor="storybook-today-note" className="block text-sm font-bold">
                3. What happened in {activeChild.name}’s day? (Optional)
              </label>
              <textarea
                id="storybook-today-note"
                rows={2}
                maxLength={240}
                value={todayPrompt}
                onChange={(e) => setTodayPrompt(e.target.value)}
                placeholder={
                  mode === 'bedtime'
                    ? `e.g., ${activeChild.name} splashed in the bath, hugged their teddy bear, and counted stars...`
                    : `e.g., ${activeChild.name} went down the big yellow slide and ate strawberries...`
                }
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none ${
                  isBedtimeTheme
                    ? 'bg-indigo-950 border-indigo-700 text-white placeholder:text-indigo-400'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400'
                }`}
              />
              <div className="flex flex-wrap gap-1.5">
                {quickIdeas.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => setTodayPrompt(idea)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
                      isBedtimeTheme
                        ? 'border-indigo-700 bg-indigo-950/70 text-indigo-200 hover:bg-indigo-800'
                        : 'border-sky-200 dark:border-slate-700 bg-sky-50/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-sky-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-200"
              >
                {errorMsg}
              </div>
            )}

            {/* Primary Generate CTA */}
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => void handleGenerateStory()}
              className="w-full min-h-[52px] px-5 py-3 text-sm sm:text-base font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 rounded-2xl shadow-sm transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  Writing {activeChild.name}’s {mode === 'bedtime' ? 'Bedtime' : 'Daytime'}{' '}
                  Storybook...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" aria-hidden="true" />
                  Create {activeChild.name}’s {mode === 'bedtime' ? 'Bedtime Story' : 'Daytime Adventure'}
                </>
              )}
            </button>
          </div>

          {/* Right Column: Live Preview Cover Card */}
          <div className="lg:col-span-5">
            <div className="relative rounded-3xl overflow-hidden border-2 border-amber-300/80 shadow-sm min-h-[340px] flex flex-col justify-between p-6 text-white">
              <img
                src={mode === 'bedtime' ? bedtimeStarlightImg : daytimeMeadowImg}
                alt={
                  mode === 'bedtime'
                    ? 'Starry bedtime storybook cover art'
                    : 'Sunny meadow daytime storybook cover art'
                }
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div
                aria-hidden="true"
                className={`absolute inset-0 ${
                  mode === 'bedtime'
                    ? 'bg-gradient-to-t from-indigo-950/90 via-indigo-950/45 to-indigo-950/40'
                    : 'bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-slate-950/30'
                }`}
              />

              <div className="relative z-10 space-y-1">
                <p className="text-xs font-semibold text-amber-300">
                  {mode === 'bedtime' ? 'Bedtime Edition' : 'Daytime Edition'} ·{' '}
                  {formatHumanDate(selectedDate)}
                </p>
                <h2 className="text-2xl font-display font-bold leading-tight">
                  {mode === 'bedtime'
                    ? `Goodnight, ${activeChild.name}`
                    : `${activeChild.name}’s Big Day Adventure`}
                </h2>
              </div>

              <div className="relative z-10 flex items-end justify-center py-3">
                <img
                  src={childAgeAvatar.fullBodyUrl}
                  alt={`${activeChild.name} SproutScale character`}
                  referrerPolicy="no-referrer"
                  className="h-44 w-auto object-contain drop-shadow-xl"
                />
              </div>

              <div className="relative z-10 text-xs text-white/90 space-y-0.5">
                <p className="font-semibold">
                  Starring {activeChild.name} · {heightSummary}
                </p>
                <p className="opacity-85">
                  Includes 5 illustrated pages, Read-Aloud narration &amp;{' '}
                  {selectedPhotoIds.length > 0
                    ? `${selectedPhotoIds.length} real photo${selectedPhotoIds.length === 1 ? '' : 's'} from this day`
                    : 'your SproutScale character'}
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search & Download Classic Read-Along Stories (Three Little Pigs, Itsy Bitsy Spider & Any Story!) */}
      <div
        className={`pt-5 border-t border-current/10 space-y-4`}
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div className="space-y-0.5">
            <h3 className="text-base sm:text-lg font-display font-bold inline-flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
              Search &amp; Download Read-Along Stories for {activeChild.name}
            </h3>
            <p className="text-xs opacity-75">
              Search classic fairy tales, nursery rhymes, or any story — download straight to{' '}
              {activeChild.name}’s bookshelf and read along as every word lights up.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums opacity-75">
            {matchingClassicStories.length} classic{matchingClassicStories.length === 1 ? '' : 's'}{' '}
            + search any title
          </span>
        </div>

        {/* Search Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSearchAndDownloadStory();
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-55 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={storySearchQuery}
              onChange={(e) => {
                setStorySearchQuery(e.target.value);
                setSearchStoryError(null);
              }}
              placeholder="Search Three Little Pigs, Itsy Bitsy Spider, Little Red Riding Hood, Humpty Dumpty..."
              aria-label="Search for a read-along story"
              maxLength={120}
              className={`w-full min-h-[46px] pl-10 pr-9 py-2.5 text-sm font-medium rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                isBedtimeTheme
                  ? 'bg-indigo-950 border-indigo-700 text-white placeholder:text-indigo-400'
                  : 'bg-white dark:bg-slate-800 border-sky-300 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400'
              }`}
            />
            {storySearchQuery && (
              <button
                type="button"
                aria-label="Clear story search"
                onClick={() => {
                  setStorySearchQuery('');
                  setSearchStoryError(null);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-65 hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isSearchingStory || !storySearchQuery.trim()}
            className="min-h-[46px] px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-xl shadow-xs transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isSearchingStory ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Downloading Book...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" aria-hidden="true" />
                Find &amp; Download Book
              </>
            )}
          </button>
        </form>

        {/* Quick Popular Story Searches */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            'Three Little Pigs',
            'Itsy Bitsy Spider',
            'Goldilocks',
            'Tortoise and the Hare',
            'Little Red Riding Hood',
            'Humpty Dumpty',
            'Old MacDonald',
            'Twinkle Little Star',
          ].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setStorySearchQuery(suggestion);
                setSearchStoryError(null);
              }}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
                isBedtimeTheme
                  ? 'border-indigo-700 bg-indigo-950/70 text-indigo-200 hover:bg-indigo-800'
                  : 'border-sky-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-700'
              }`}
            >
              {suggestion}
            </button>
          ))}
        </div>

        {searchStoryError && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-200"
          >
            {searchStoryError}
          </div>
        )}

        {/* On-Demand Fetch Card when user searches a title not in the instant 8 (or wants a custom version) */}
        {storySearchQuery.trim().length >= 2 && (
          <div
            className={`rounded-2xl border-2 border-dashed p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isBedtimeTheme
                ? 'border-amber-400/60 bg-indigo-900/60'
                : 'border-amber-400 bg-amber-50/80 dark:bg-slate-800/90'
            }`}
          >
            <div className="space-y-0.5">
              <p className="text-sm font-display font-bold">
                Download “{storySearchQuery.trim()}” as a Read-Along Book
              </p>
              <p className="text-xs opacity-80">
                Builds a complete 5-page read-along edition for {activeChild.name}, saves it to{' '}
                {activeChild.name}’s bookshelf, and starts glowing word-by-word narration!
              </p>
            </div>
            <button
              type="button"
              disabled={isSearchingStory}
              onClick={() => void handleSearchAndDownloadStory(storySearchQuery.trim(), true)}
              className="min-h-[44px] px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-xl inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isSearchingStory ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" aria-hidden="true" />
                  Download &amp; Read Along
                </>
              )}
            </button>
          </div>
        )}

        {/* Instant Classic Read-Along Catalog Grid */}
        {matchingClassicStories.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {matchingClassicStories.map((classic) => {
              const classicId = `classic_${classic.slug}_${activeChild.id}`;
              const isDownloaded = savedBooks.some((b) => b.id === classicId);
              const isClassicBedtime = classic.mode === 'bedtime';
              return (
                <div
                  key={classic.slug}
                  className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                    isDownloaded
                      ? 'border-emerald-400/80 bg-emerald-500/10'
                      : isBedtimeTheme
                        ? 'border-indigo-700/80 bg-indigo-900/50 hover:bg-indigo-900/80'
                        : 'border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-amber-300'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                      <span
                        className={
                          isClassicBedtime
                            ? isBedtimeTheme
                              ? 'text-indigo-200'
                              : 'text-indigo-700 dark:text-indigo-300'
                            : isBedtimeTheme
                              ? 'text-amber-300'
                              : 'text-sky-800 dark:text-sky-300'
                        }
                      >
                        {classic.category}
                      </span>
                      {isDownloaded && (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          Saved
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-display font-bold leading-snug">{classic.title}</h4>
                    <p className="text-xs opacity-75 leading-relaxed">{classic.subtitle}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownloadClassicBook(classic)}
                    className={`w-full min-h-[42px] px-3 py-2 text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                      isDownloaded
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : isClassicBedtime
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          : 'bg-sky-600 hover:bg-sky-700 text-white'
                    }`}
                  >
                    {isDownloaded ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Read Along Now
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        Download &amp; Read Along
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ready-to-Read Follow-Along Stories (Instant Light-Up Word Books for activeChild) */}
      <div className="pt-4 border-t border-current/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h3 className="text-base sm:text-lg font-display font-bold">
              Instant Read-Along Stories for {activeChild.name}
            </h3>
            <p className="text-xs opacity-75">
              Tap any book to hear your ElevenLabs announcer read while every word lights up in real
              time.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums opacity-75">
            {starterReadAlongBooks.length} ready now
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {starterReadAlongBooks.map((book) => {
            const isBookBedtime = book.mode === 'bedtime';
            const isOpen = openBook?.id === book.id;
            return (
              <div
                key={book.id}
                className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                  isOpen
                    ? 'border-amber-400 bg-amber-400/15'
                    : isBedtimeTheme
                      ? 'border-indigo-700/80 bg-indigo-900/50 hover:bg-indigo-900/80'
                      : 'border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-amber-300'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold">
                    {isBookBedtime ? (
                      <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-hidden="true" />
                    ) : (
                      <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
                    )}
                    <span
                      className={
                        isBookBedtime
                          ? isBedtimeTheme
                            ? 'text-indigo-200'
                            : 'text-indigo-700 dark:text-indigo-300'
                          : isBedtimeTheme
                            ? 'text-amber-300'
                            : 'text-amber-700 dark:text-amber-300'
                      }
                    >
                      {isBookBedtime ? 'Bedtime Read-Along' : 'Daytime Read-Along'}
                    </span>
                  </div>
                  <h4 className="text-sm font-display font-bold leading-snug">{book.title}</h4>
                  <p className="text-xs opacity-75 leading-relaxed">{book.subtitle}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenAndReadAlong(book)}
                  className={`w-full min-h-[42px] px-3 py-2 text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                    isBookBedtime
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Read Along Now
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-Child Saved Bookshelf (Strictly Filtered to activeChild) */}
      <div className="pt-4 border-t border-current/10 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base sm:text-lg font-display font-bold">
            {activeChild.name}’s Saved Bookshelf
          </h3>
          <span className="text-xs font-mono tabular-nums opacity-75">
            {savedBooks.length} {savedBooks.length === 1 ? 'story' : 'stories'}
          </span>
        </div>

        {savedBooks.length === 0 ? (
          <p className="text-xs sm:text-sm opacity-75">
            No custom photo stories saved for {activeChild.name} yet. Create a Daytime Adventure or
            Bedtime Story above to save it to {activeChild.name}’s bookshelf!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {savedBooks.map((book) => {
              const isOpen = openBook?.id === book.id;
              return (
                <div
                  key={book.id}
                  className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                    isOpen
                      ? 'border-amber-400 bg-amber-400/10'
                      : isBedtimeTheme
                        ? 'border-indigo-800 bg-indigo-900/40'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold opacity-75">
                      <span>
                        {book.mode === 'bedtime' ? 'Bedtime Story' : 'Daytime Adventure'} ·{' '}
                        {formatHumanDate(book.storyDate)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Delete ${book.title}`}
                        onClick={() => {
                          if (openBook?.id === book.id) {
                            stopReadAloud();
                            setOpenBook(null);
                          }
                          setSavedBooks(deleteChildStorybook(activeChild.id, book.id));
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-500/15 hover:text-rose-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    <h4 className="text-sm font-bold leading-snug">{book.title}</h4>
                    <p className="text-xs opacity-75 line-clamp-2">{book.subtitle}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      stopReadAloud();
                      setMode(book.mode);
                      setOpenBook(book);
                      setCurrentPageIdx(0);
                    }}
                    className={`min-h-[40px] w-full px-3 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                      isOpen
                        ? 'bg-amber-400 text-slate-950'
                        : isBedtimeTheme
                          ? 'bg-indigo-800 hover:bg-indigo-700 text-white'
                          : 'bg-sky-50 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 text-sky-900 dark:text-sky-200'
                    }`}
                  >
                    {isOpen ? 'Reading Now' : 'Open & Read Story'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
