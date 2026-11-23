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

export async function searchAndFetchReadAlongBook(params: {
  query: string;
  childId: string;
  childName: string;
  ageMonths: number;
  mode: StorybookMode;
  storyDate: string;
}): Promise<SavedStorybook> {
  const response = await fetch('/api/storybook/search-story', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: params.query.trim(),
      childName: params.childName,
      ageMonths: params.ageMonths,
      mode: params.mode,
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
      payload.error || 'Could not download that story right now. Please try again.',
    );
  }

  return {
    id: `search_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    childId: params.childId,
    childName: params.childName,
    ageMonths: params.ageMonths,
    mode: params.mode,
    storyDate: params.storyDate,
    title: payload.title || params.query.trim(),
    subtitle: payload.subtitle || 'Downloaded Read-Along Book',
    dedication:
      payload.dedication || `Downloaded for ${params.childName} — follow the glowing words!`,
    pages: payload.pages,
    conversationPrompt:
      payload.conversationPrompt || `What was your favorite part, ${params.childName}?`,
    closingLine:
      payload.closingLine ||
      (params.mode === 'bedtime'
        ? `Goodnight, ${params.childName}!`
        : `Great job reading along, ${params.childName}!`),
    photoIds: [],
    todayPrompt: `Searched Story: ${params.query.trim()}`,
    createdAtMs: Date.now(),
  };
}

export interface StorybookWordTiming {
  word: string;
  startSec: number;
  endSec: number;
  startChar: number;
  endChar: number;
}

export interface StorybookAudioResult {
  audioDataUrl: string;
  engine?: string;
  wordTimings: StorybookWordTiming[];
}

export async function fetchStorybookReadAloudAudio(
  text: string,
  mode: StorybookMode,
  voiceId?: string,
): Promise<StorybookAudioResult | null> {
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
    wordTimings?: StorybookWordTiming[];
  };
  if (!data.audioBase64) return null;
  return {
    audioDataUrl: `data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`,
    engine: data.engine,
    wordTimings: Array.isArray(data.wordTimings) ? data.wordTimings : [],
  };
}

/**
 * Fallback proportional word timing estimator when a TTS engine returns audio without alignment.
 */
export function buildEstimatedWordTimings(
  text: string,
  totalDurationSec: number,
): StorybookWordTiming[] {
  if (!text || !Number.isFinite(totalDurationSec) || totalDurationSec <= 0) return [];
  const regex = /\S+/g;
  const rawWords: Array<{ word: string; startChar: number; endChar: number; weight: number }> = [];
  let match: RegExpExecArray | null = regex.exec(text);
  while (match !== null) {
    const word = match[0];
    const pauseBonus = /[.!?]$/.test(word) ? 3.5 : /[,;:]$/.test(word) ? 1.8 : 0;
    rawWords.push({
      word,
      startChar: match.index,
      endChar: match.index + word.length,
      weight: Math.max(2, word.length) + pauseBonus,
    });
    match = regex.exec(text);
  }
  const totalWeight = rawWords.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return [];

  let cursorSec = 0;
  return rawWords.map((item) => {
    const slice = (item.weight / totalWeight) * totalDurationSec;
    const startSec = cursorSec;
    const endSec = Math.min(totalDurationSec, cursorSec + slice);
    cursorSec = endSec;
    return {
      word: item.word,
      startSec: Number(startSec.toFixed(3)),
      endSec: Number(endSec.toFixed(3)),
      startChar: item.startChar,
      endChar: item.endChar,
    };
  });
}

/**
 * Ready-to-read rhythmic Read-Along Stories personalized live to whichever child is active
 * (Tommy, Joey, Sandra, etc.), crafted with short clear words so kids can follow along as each word lights up!
 */
export function buildStarterReadAlongBooks(params: {
  childId: string;
  childName: string;
  ageMonths: number;
  heightSummary: string;
  storyDate: string;
}): SavedStorybook[] {
  const { childId, childName, ageMonths, heightSummary, storyDate } = params;
  const safeName = childName.trim() || 'Sprout';

  return [
    {
      id: `starter_day_morning_${childId}`,
      childId,
      childName: safeName,
      ageMonths,
      mode: 'daytime',
      storyDate,
      title: `Good Morning, ${safeName}!`,
      subtitle: 'A Sunny Read-Along Adventure',
      dedication: `For ${safeName} — follow the glowing words as we read together!`,
      pages: [
        {
          pageNumber: 1,
          heading: 'Wake Up, Sunshine!',
          text: `The bright yellow sun peeks into the room. Good morning, ${safeName}! Stretch your arms up high to the sky and wiggle your happy toes.`,
          sceneMood: 'sunny',
          usePhotoIndex: -1,
        },
        {
          pageNumber: 2,
          heading: 'Standing So Tall',
          text: `${safeName} walks over to the growth wall and stands up straight and proud. Look how big you are growing! Already ${heightSummary}, and getting stronger every single day.`,
          sceneMood: 'wonder',
          usePhotoIndex: -1,
        },
        {
          pageNumber: 3,
          heading: 'The Garden Butterfly',
          text: `Outside in the soft green grass, a little butterfly flutters past a daisy. Tap, tap, hop! ${safeName} laughs and waves hello to the friendly blue sky.`,
          sceneMood: 'playful',
          usePhotoIndex: -1,
        },
        {
          pageNumber: 4,
          heading: 'Tower of Blocks',
          text: `One, two, three, four, five! ${safeName} stacks bright wooden blocks higher and higher. Crash, giggle, clap! Building together is so much fun.`,
          sceneMood: 'playful',
          usePhotoIndex: -1,
        },
        {
          pageNumber: 5,
          heading: 'Ready for a Great Day',
          text: `With a big bright smile and curious eyes, ${safeName} is ready for every new adventure waiting today. Way to read along, superstar!`,
          sceneMood: 'sunny',
          usePhotoIndex: -1,
        },
      ],
      conversationPrompt: `Which word was your favorite to watch light up, ${safeName}?`,
      closingLine: `Hooray for ${safeName} — what a wonderful sunny day!`,
      photoIds: [],
      todayPrompt: 'Instant Daytime Read-Along',
      createdAtMs: 0,
    },
    {
      id: `starter_day_colors_${childId}`,
      childId,
      childName: safeName,
      ageMonths,
      mode: 'daytime',
      storyDate,
      title: `${safeName}’s Rainbow Treasure Hunt`,
      subtitle: 'A Colors & Counting Read-Along',
      dedication: `For ${safeName} — let’s spot every bright color together!`,
      pages: [
        {
          pageNumber: 1,
          heading: 'Red Like an Apple',
          text: `Put on your explorer shoes, ${safeName}! First we look for something bright red. Crunch, crunch! A sweet red apple is waiting on the table.`,
          sceneMood: 'sunny',
          usePhotoIndex: -1,
        },
        {
          pageNumber: 2,
          heading: 'Yellow Like a Duck',
          text: `Next, ${safeName} spies something sunny yellow. Quack, quack! A cheerful yellow duck waddles beside a warm golden flower.`,
          sceneMood: 'playful',
          usePhotoIndex: -1,
        },
        {
          pageNumber: 3,
          heading: 'Green Like a Frog',
          text: `Boing, boing! What is hopping on the green leaf? A tiny green frog jumps high into the air, and ${safeName} gives a big happy hop too!`,
          sceneMood: 'playful',
          usePhotoIndex: -1,
        },
        {
          pageNumber: 4,
          heading: 'Blue Like the Sky',
          text: `Look up, ${safeName}! Big fluffy white clouds drift slowly across the wide blue sky. Can you point to a cloud shaped like a teddy bear?`,
          sceneMood: 'wonder',
          usePhotoIndex: -1,
        },
        {
          pageNumber: 5,
          heading: 'A Rainbow High-Five',
          text: `Red, yellow, green, and blue — ${safeName} found every single treasure on the hunt! Give yourself a giant rainbow high-five!`,
          sceneMood: 'sunny',
          usePhotoIndex: -1,
        },
      ],
      conversationPrompt: `Can you find something red or blue in the room right now, ${safeName}?`,
      closingLine: `Bravo, ${safeName} — you found the whole rainbow!`,
      photoIds: [],
      todayPrompt: 'Instant Colors Read-Along',
      createdAtMs: 0,
    },
    {
      id: `starter_bed_twinkle_${childId}`,
      childId,
      childName: safeName,
      ageMonths,
      mode: 'bedtime',
      storyDate,
      title: `Twinkle, Twinkle, Goodnight ${safeName}`,
      subtitle: 'A Gentle Starlight Read-Along',
      dedication: `For sweet ${safeName} — watch the sleepy golden words glow softly.`,
      pages: [
        {
          pageNumber: 1,
          heading: 'The Quiet Evening Sky',
          text: `The busy daytime sun waves a gentle goodbye. Soft purple shadows tiptoe across the yard as ${safeName} gets cozy in soft pajamas.`,
          sceneMood: 'cozy',
          usePhotoIndex: -1,
        },
        {
          pageNumber: 2,
          heading: 'One, Two, Three Stars',
          text: `Outside the window, tiny silver stars begin to twinkle. One star, two stars, three stars shine softly just for ${safeName}.`,
          sceneMood: 'wonder',
          usePhotoIndex: -1,
        },
        {
          pageNumber: 3,
          heading: 'Cozy Blanket Hug',
          text: `Pull the warm blanket up to your chin, ${safeName}. Your pillow is fluffy like a cloud, and your toys are resting quietly for the night.`,
          sceneMood: 'cozy',
          usePhotoIndex: -1,
        },
        {
          pageNumber: 4,
          heading: 'The Smiling Moon',
          text: `High above the treetops, the glowing crescent moon whispers a slow, peaceful lullaby. Take a deep breath in, and let a soft yawn out.`,
          sceneMood: 'sleepy',
          usePhotoIndex: -1,
        },
        {
          pageNumber: 5,
          heading: 'Sweet Dreams Tonight',
          text: `Close your sleepy eyes, ${safeName}. You grew, you played, and you are loved so very much. Rest safely until morning light.`,
          sceneMood: 'sleepy',
          usePhotoIndex: -1,
        },
      ],
      conversationPrompt: `What happy moment from today do you want to dream about, ${safeName}?`,
      closingLine: `Goodnight, sweet ${safeName}. Sleep tight under the stars.`,
      photoIds: [],
      todayPrompt: 'Instant Bedtime Read-Along',
      createdAtMs: 0,
    },
    {
      id: `starter_bed_clouds_${childId}`,
      childId,
      childName: safeName,
      ageMonths,
      mode: 'bedtime',
      storyDate,
      title: `The Sleepy Cloud Train for ${safeName}`,
      subtitle: 'A Dreamy Nighttime Read-Along',
      dedication: `All aboard for ${safeName}’s peaceful trip to dreamland!`,
      pages: [
        {
          pageNumber: 1,
          heading: 'Soft Whistle in the Night',
          text: `Shhh, shhh, goes the gentle Cloud Train as it floats beside the moon. Tonight it has a special cozy seat waiting just for ${safeName}.`,
          sceneMood: 'cozy',
          usePhotoIndex: -1,
        },
        {
          pageNumber: 2,
          heading: 'Past the Sleepy Owls',
          text: `The train glides smoothly past tall quiet trees. Two little owls blink their big round eyes and whisper, goodnight, ${safeName}!`,
          sceneMood: 'wonder',
          usePhotoIndex: -1,
        },
        {
          pageNumber: 3,
          heading: 'Floating Over Silver Hills',
          text: `Slowly, slowly, the soft white clouds rock back and forth like a cradle. Every star twinkles a tiny golden light along the track.`,
          sceneMood: 'sleepy',
          usePhotoIndex: -1,
        },
        {
          pageNumber: 4,
          heading: 'Arriving at Dreamland',
          text: `The Cloud Train slows to a peaceful stop at Dreamland Station, where warm blankets and happy dreams wait for ${safeName}.`,
          sceneMood: 'sleepy',
          usePhotoIndex: -1,
        },
        {
          pageNumber: 5,
          heading: 'Time to Rest',
          text: `Snuggle in close, ${safeName}. Tomorrow brings another wonderful day to grow, laugh, and read together.`,
          sceneMood: 'sleepy',
          usePhotoIndex: -1,
        },
      ],
      conversationPrompt: `Where would you like the Cloud Train to visit in your dreams tonight, ${safeName}?`,
      closingLine: `Sweet dreams, ${safeName} — goodnight, little explorer.`,
      photoIds: [],
      todayPrompt: 'Instant Cloud Train Bedtime Read-Along',
      createdAtMs: 0,
    },
  ];
}
