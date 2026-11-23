export type PlayhouseVideoCategory = 'shorts' | 'dance' | 'cartoons' | 'songs';

export interface SavedPlayhouseVideo {
  id: string;
  videoId: string;
  title: string;
  authorName: string;
  isShort: boolean;
  category: PlayhouseVideoCategory;
  isFavorite?: boolean;
  addedAtMs: number;
}

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

const ALLOWED_YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export function parseYouTubeInput(rawInput: string): {
  videoId: string;
  isShort: boolean;
} | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // Allow direct 11-char video ID paste
  if (YOUTUBE_ID_REGEX.test(trimmed)) {
    return { videoId: trimmed, isShort: false };
  }

  let normalizedUrl = trimmed;
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  try {
    const parsed = new URL(normalizedUrl);
    const host = parsed.hostname.toLowerCase();
    if (!ALLOWED_YT_HOSTS.has(host)) return null;

    if (host === 'youtu.be' || host === 'www.youtu.be') {
      const seg = parsed.pathname.split('/').filter(Boolean)[0] ?? '';
      if (YOUTUBE_ID_REGEX.test(seg)) {
        return { videoId: seg, isShort: false };
      }
      return null;
    }

    const segments = parsed.pathname.split('/').filter(Boolean);

    // https://www.youtube.com/shorts/qooltM-B88I
    if (segments[0] === 'shorts' && segments[1] && YOUTUBE_ID_REGEX.test(segments[1])) {
      return { videoId: segments[1], isShort: true };
    }

    // https://www.youtube.com/embed/VIDEO_ID or /live/VIDEO_ID
    if (
      (segments[0] === 'embed' || segments[0] === 'live') &&
      segments[1] &&
      YOUTUBE_ID_REGEX.test(segments[1])
    ) {
      return { videoId: segments[1], isShort: false };
    }

    // https://www.youtube.com/watch?v=VIDEO_ID
    const vParam = parsed.searchParams.get('v') ?? '';
    if (YOUTUBE_ID_REGEX.test(vParam)) {
      return { videoId: vParam, isShort: false };
    }

    return null;
  } catch {
    return null;
  }
}

export function buildSafeYouTubeEmbedUrl(
  videoId: string,
  options?: { autoplay?: boolean; loop?: boolean },
): string {
  if (!YOUTUBE_ID_REGEX.test(videoId)) return '';
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    iv_load_policy: '3',
  });
  if (options?.autoplay) {
    params.set('autoplay', '1');
  }
  if (options?.loop) {
    params.set('loop', '1');
    params.set('playlist', videoId);
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

export function getStarterPlayhouseVideos(): SavedPlayhouseVideo[] {
  return [
    {
      id: 'starter_qooltM-B88I',
      videoId: 'qooltM-B88I',
      title: 'JJ and Mikey Vs. Verity Mod! | MAIZEN Animation in Minecraft',
      authorName: 'Feen Animation',
      isShort: true,
      category: 'shorts',
      isFavorite: true,
      addedAtMs: 1795400000000,
    },
  ];
}

const VIDEO_STORAGE_PREFIX = 'sproutscale_playhouse_videos_v1_';

export function loadChildPlayhouseVideos(childId: string): SavedPlayhouseVideo[] {
  const starter = getStarterPlayhouseVideos();
  if (typeof window === 'undefined' || !childId) return starter;
  try {
    const raw = window.localStorage.getItem(`${VIDEO_STORAGE_PREFIX}${childId}`);
    if (!raw) return starter;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return starter;
    const valid = (parsed as SavedPlayhouseVideo[]).filter(
      (v) => v && typeof v.videoId === 'string' && YOUTUBE_ID_REGEX.test(v.videoId),
    );
    return valid.length > 0 ? valid : starter;
  } catch {
    return starter;
  }
}

export function saveChildPlayhouseVideos(
  childId: string,
  videos: SavedPlayhouseVideo[],
): SavedPlayhouseVideo[] {
  if (typeof window !== 'undefined' && childId) {
    try {
      window.localStorage.setItem(`${VIDEO_STORAGE_PREFIX}${childId}`, JSON.stringify(videos));
    } catch {
      // Ignore storage quota errors
    }
  }
  return videos;
}

export async function resolveYouTubeVideoFromUrl(
  rawUrl: string,
  customTitle?: string,
  category?: PlayhouseVideoCategory,
): Promise<SavedPlayhouseVideo> {
  const parsed = parseYouTubeInput(rawUrl);
  if (!parsed) {
    throw new Error(
      'Please paste a valid YouTube or YouTube Shorts link (for example: youtube.com/shorts/... or youtu.be/...).',
    );
  }

  let title = customTitle?.trim() || '';
  let authorName = 'YouTube';
  let isShort = parsed.isShort;

  try {
    const res = await fetch('/api/playhouse/youtube-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: rawUrl.trim() }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        title?: string;
        authorName?: string;
        isShort?: boolean;
      };
      if (!title && data.title) title = data.title;
      if (data.authorName) authorName = data.authorName;
      if (typeof data.isShort === 'boolean') isShort = data.isShort;
    }
  } catch {
    // Fall back to parsed videoId cleanly if metadata fetch is offline
  }

  const finalCategory: PlayhouseVideoCategory =
    category ?? (isShort ? 'shorts' : 'cartoons');

  return {
    id: `yt_${parsed.videoId}_${Date.now()}`,
    videoId: parsed.videoId,
    title: title || (isShort ? 'Saved YouTube Short' : 'Saved YouTube Video'),
    authorName,
    isShort,
    category: finalCategory,
    isFavorite: false,
    addedAtMs: Date.now(),
  };
}
