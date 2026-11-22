export type StorybookMode = 'daytime' | 'bedtime';

export type StorybookSceneMood = 'sunny' | 'playful' | 'wonder' | 'cozy' | 'sleepy';

export interface StorybookPage {
  pageNumber: number;
  heading: string;
  text: string;
  sceneMood: StorybookSceneMood;
  usePhotoIndex: number;
}

export interface SavedStorybook {
  id: string;
  childId: string;
  childName: string;
  ageMonths: number;
  mode: StorybookMode;
  storyDate: string;
  title: string;
  subtitle: string;
  dedication: string;
  pages: StorybookPage[];
  conversationPrompt: string;
  closingLine: string;
  photoIds: string[];
  todayPrompt: string;
  createdAtMs: number;
}

export interface GenerateStorybookRequest {
  childId: string;
  childName: string;
  ageMonths: number;
  sex?: string;
  mode: StorybookMode;
  storyDate: string;
  heightSummary: string;
  gainedSummary: string;
  todayPrompt: string;
  dayEvents: string[];
  photoCaptions: string[];
  photoDataUrls: string[];
  photoIds: string[];
}

const STORYBOOK_STORAGE_PREFIX = 'sproutscale_storybooks_v1_';
const MAX_STORIES_PER_CHILD = 24;

function getStorageKey(childId: string): string {
  return `${STORYBOOK_STORAGE_PREFIX}${childId}`;
}

export function loadChildStorybooks(childId: string): SavedStorybook[] {
  if (typeof window === 'undefined' || !childId) return [];
  try {
    const raw = window.localStorage.getItem(getStorageKey(childId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as SavedStorybook[])
      .filter(
        (b) =>
          b &&
          typeof b.id === 'string' &&
          b.childId === childId &&
          typeof b.title === 'string' &&
          Array.isArray(b.pages) &&
          b.pages.length > 0,
      )
      .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
  } catch {
    return [];
  }
}

export function saveChildStorybook(book: SavedStorybook): SavedStorybook[] {
  const existing = loadChildStorybooks(book.childId).filter((b) => b.id !== book.id);
  const next = [book, ...existing].slice(0, MAX_STORIES_PER_CHILD);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(getStorageKey(book.childId), JSON.stringify(next));
    } catch {
      // If quota is tight, keep the 8 most recent stories
      try {
        window.localStorage.setItem(
          getStorageKey(book.childId),
          JSON.stringify(next.slice(0, 8)),
        );
      } catch {
        // Ignore storage errors cleanly
      }
    }
  }
  return next;
}

export function deleteChildStorybook(childId: string, storyId: string): SavedStorybook[] {
  const next = loadChildStorybooks(childId).filter((b) => b.id !== storyId);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(getStorageKey(childId), JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
  return next;
}

/**
 * Downscales a local photo data URL to a lightweight JPEG (~640px max)
 * so multimodal storybook generation stays fast on mobile connections.
 */
export async function compressPhotoForStorybook(dataUrl: string): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 640;
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const w = Math.max(1, Math.round((img.naturalWidth || 640) * scale));
        const h = Math.max(1, Math.round((img.naturalHeight || 480) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function generatePersonalizedStorybook(
  req: GenerateStorybookRequest,
): Promise<SavedStorybook> {
  const compressedPhotos = await Promise.all(
    req.photoDataUrls.slice(0, 2).map((url) => compressPhotoForStorybook(url)),
  );

  const response = await fetch('/api/storybook/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      childName: req.childName,
      ageMonths: req.ageMonths,
      sex: req.sex,
      mode: req.mode,
      storyDate: req.storyDate,
      heightSummary: req.heightSummary,
      gainedSummary: req.gainedSummary,
      todayPrompt: req.todayPrompt,
      dayEvents: req.dayEvents,
      photoCaptions: req.photoCaptions,
      photoDataUrls: compressedPhotos,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    title?: string;
    subtitle?: string;
    dedication?: string;
    pages?: StorybookPage[];
    conversationPrompt?: string;
    closingLine?: string;
  };

  if (!response.ok || !Array.isArray(payload.pages) || payload.pages.length === 0) {
    throw new Error(
      payload.error || 'Could not generate storybook right now. Please try again.',
    );
  }

  return {
    id: `story_${req.mode}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    childId: req.childId,
    childName: req.childName,
    ageMonths: req.ageMonths,
    mode: req.mode,
    storyDate: req.storyDate,
    title: payload.title || `${req.childName}'s Story`,
    subtitle: payload.subtitle || `A special story for ${req.childName}`,
    dedication: payload.dedication || `For ${req.childName}`,
    pages: payload.pages,
    conversationPrompt:
      payload.conversationPrompt || `What was your favorite part of today, ${req.childName}?`,
    closingLine:
      payload.closingLine ||
      (req.mode === 'bedtime'
        ? `Goodnight, ${req.childName}. Sweet dreams!`
        : `Hooray for ${req.childName}!`),
    photoIds: req.photoIds.slice(0, 2),
    todayPrompt: req.todayPrompt,
    createdAtMs: Date.now(),
  };
}

export async function fetchStorybookReadAloudAudio(
  text: string,
  mode: StorybookMode,
  voiceId?: string,
): Promise<{ audioDataUrl: string; engine?: string } | null> {
  const response = await fetch('/api/storybook/read-aloud', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      mode,
      voiceId: voiceId?.trim() || undefined,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json().catch(() => ({}))) as {
    audioBase64?: string;
    mimeType?: string;
    engine?: string;
  };
  if (!data.audioBase64) return null;
  return {
    audioDataUrl: `data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`,
    engine: data.engine,
  };
}
