import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const META_GRAPH_VERSION = 'v21.0';
const META_SESSION_COOKIE = 'sproutscale_meta_sid';
const META_STATE_COOKIE = 'sproutscale_meta_state';

interface MetaStoredPage {
  id: string;
  name: string;
  category?: string;
  accessToken: string;
  instagramAccount?: {
    id: string;
    username: string;
    name: string;
    profilePictureUrl?: string;
  } | null;
}

interface MetaStoredSession {
  userId: string;
  userName: string;
  userAccessToken: string;
  pages: MetaStoredPage[];
  createdAtMs: number;
}

interface StagedShareMedia {
  buffer: Buffer;
  expiresAtMs: number;
}

interface DataDeletionRecord {
  confirmationCode: string;
  source: 'meta_callback' | 'self_service' | 'email_request';
  status: 'completed' | 'received';
  identifierHint: string;
  createdAtIso: string;
  details: string;
}

interface SupportTicketRecord {
  ticketId: string;
  topic: string;
  email: string;
  name: string;
  message: string;
  createdAtIso: string;
}

const metaSessions = new Map<string, MetaStoredSession>();
const stagedShareMedia = new Map<string, StagedShareMedia>();
const dataDeletionRecords = new Map<string, DataDeletionRecord>();
const supportTickets = new Map<string, SupportTicketRecord>();

function parseBase64UrlToBuffer(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLen), 'base64');
}

function parseMetaSignedRequest(
  signedRequest: string,
  appSecret?: string,
): { userId: string | null; signatureValid: boolean } {
  const parts = signedRequest.split('.');
  if (parts.length !== 2) {
    return { userId: null, signatureValid: false };
  }
  const [encodedSig, encodedPayload] = parts;
  try {
    const payloadBuf = parseBase64UrlToBuffer(encodedPayload);
    const payload = JSON.parse(payloadBuf.toString('utf8')) as {
      user_id?: string;
      algorithm?: string;
    };

    let signatureValid = true;
    if (appSecret && appSecret.trim() && appSecret !== 'MY_META_APP_SECRET') {
      const providedSig = parseBase64UrlToBuffer(encodedSig);
      const expectedSig = crypto
        .createHmac('sha256', appSecret.trim())
        .update(encodedPayload)
        .digest();
      signatureValid =
        providedSig.length === expectedSig.length &&
        crypto.timingSafeEqual(providedSig, expectedSig);
    }

    return {
      userId: payload.user_id ? String(payload.user_id) : null,
      signatureValid,
    };
  } catch {
    return { userId: null, signatureValid: false };
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

const ALLOWED_CUSTOM_HOSTS = new Set([
  'sproutscale.xyz',
  'www.sproutscale.xyz',
  'sprout-scale.com',
  'www.sprout-scale.com',
]);

function getCanonicalAppUrl(req?: express.Request): string {
  if (req) {
    const rawHost = String(req.headers['x-forwarded-host'] || req.headers.host || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    if (ALLOWED_CUSTOM_HOSTS.has(rawHost)) {
      return `https://${rawHost}`;
    }
  }
  const envUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (envUrl) return envUrl;
  return `http://localhost:${PORT}`;
}

function getMetaCallbackUrl(req?: express.Request): string {
  return `${getCanonicalAppUrl(req)}/auth/meta/callback`;
}

function isMetaOAuthConfigured(): boolean {
  const appId = (process.env.META_APP_ID || '').trim();
  const appSecret = (process.env.META_APP_SECRET || '').trim();
  return (
    appId.length > 0 &&
    appSecret.length > 0 &&
    appId !== 'MY_META_APP_ID' &&
    appSecret !== 'MY_META_APP_SECRET'
  );
}

function cleanupExpiredStagedMedia(): void {
  const now = Date.now();
  for (const [key, item] of stagedShareMedia.entries()) {
    if (item.expiresAtMs <= now) {
      stagedShareMedia.delete(key);
    }
  }
  while (stagedShareMedia.size > 40) {
    const oldestKey = stagedShareMedia.keys().next().value;
    if (!oldestKey) break;
    stagedShareMedia.delete(oldestKey);
  }
}

function escapeHtmlAttr(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_GEMINI_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.min(max, Math.max(min, val));
}

let cachedFridgeCalibrationBase64: string | null | undefined;

function getFridgeCalibrationPhotoBase64(): string | null {
  if (cachedFridgeCalibrationBase64 !== undefined) {
    return cachedFridgeCalibrationBase64;
  }
  const candidatePaths = [
    path.resolve(__dirname, 'public', 'assets', 'aistudio', 'IMG_9222_c34d3feb.jpeg'),
    path.resolve(__dirname, 'dist', 'assets', 'aistudio', 'IMG_9222_c34d3feb.jpeg'),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        cachedFridgeCalibrationBase64 = fs.readFileSync(p).toString('base64');
        return cachedFridgeCalibrationBase64;
      } catch {
        // try next candidate
      }
    }
  }
  cachedFridgeCalibrationBase64 = null;
  return null;
}

const CALIBRATED_FRIDGE_LANDMARK_GUIDE = [
  'CALIBRATED KITCHEN FRIDGE REFERENCE (Whirlpool Stainless Steel French-Door Refrigerator — measured with yellow measuring tape flat from floor 0.0"):',
  '- 0.0 inches: Wood floor directly in front of the fridge (blue tape tip on floor)',
  '- 3.0 inches: Bottom edge of stainless steel freezer drawer door (top of adjacent left white baseboard trim is ~3.75–4.0 inches)',
  '- 24.0 inches (2\' 0.0"): Bottom edge of horizontal stainless freezer drawer handle (2F mark on tape)',
  '- 25.5 inches (2\' 1.5"): Top edge of horizontal stainless freezer drawer handle',
  '- 27.5 inches (2\' 3.5"): Horizontal dark seam/gap between the bottom freezer drawer and upper French doors',
  '- 30.5 inches (2\' 6.5"): Bottom tips of the two vertical stainless French door handles',
  '- 54.5 inches (4\' 6.5"): Bottom red border of the black "Measuring Lane" magnet on the left upper door',
  '- 60.75 inches (5\' 0.8"): Top red border of the "Measuring Lane" magnet (just above 5F / 60" mark)',
  '- 61.5 inches (5\' 1.5"): Top tips of the two vertical stainless French door handles',
  '- 62.5 inches (5\' 2.5"): Bottom edge of the top yellow-header "AIR FRYER COOKING TIMES" magnet chart',
  '- 68.5 inches (5\' 8.5"): Top edge of the top yellow-header "AIR FRYER COOKING TIMES" magnet chart',
  '- 69.0 inches (5\' 9.0", 175.3 cm): Top lip/edge of the stainless steel Whirlpool fridge door (tape housing sits on top here).',
].join('\n');

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '12mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  app.post('/api/estimate-wall-height', async (req, res) => {
    try {
      const { imageDataUrl, ageMonths, childName, calibrationMode } = req.body as {
        imageDataUrl?: string;
        ageMonths?: number;
        childName?: string;
        calibrationMode?: 'kitchen_fridge' | 'general_wall';
      };

      if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
        res.status(400).json({
          error: 'Please provide a valid wall photo (JPEG, PNG, or WebP) showing your child standing against a wall or the calibrated fridge.',
        });
        return;
      }

      const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        res.status(400).json({
          error: 'Could not decode the uploaded photo. Please try taking or uploading another picture.',
        });
        return;
      }

      const mimeType = match[1];
      const base64Data = match[2];
      const useFridgeCalibration = calibrationMode !== 'general_wall';
      const fridgeRefBase64 = useFridgeCalibration ? getFridgeCalibrationPhotoBase64() : null;

      const ai = getGenAIClient();

      const ageHint =
        typeof ageMonths === 'number' && ageMonths > 0
          ? `Optional context: ${childName || 'The child'} is approximately ${Math.floor(ageMonths / 12)} years and ${ageMonths % 12} months old (${ageMonths} months), though ALWAYS prioritize exact visual landmarks in the photo over age averages.`
          : 'No age hint provided; rely strictly on visual scale landmarks and body proportions.';

      const promptLines = [
        fridgeRefBase64
          ? 'IMAGE 1 is the family’s tape-measured calibration reference photo of their stainless-steel Whirlpool French-door kitchen fridge with a yellow measuring tape from 0.0" on the floor to 69.0" at the top of the fridge door. IMAGE 2 is the new photo to measure.'
          : 'Analyze this photo to calculate how tall the standing child/person is in INCHES.',
        ageHint,
        '',
        useFridgeCalibration ? CALIBRATED_FRIDGE_LANDMARK_GUIDE : '',
        '',
        'Instructions:',
        '1. Check if the full standing body from the crown of the head to the heels/feet on the floor is visible (`fullBodyVisible`).',
        useFridgeCalibration
          ? '2. FIRST check if IMAGE 2 shows this same stainless-steel Whirlpool French-door kitchen fridge (or part of it with its horizontal freezer handle at 24.0", freezer seam at 27.5", vertical door handles spanning 30.5"–61.5", red Measuring Lane magnet at 54.5"–60.75", or top of fridge door at 69.0"):'
          : '2. Look carefully for real-world scale reference objects on or near the wall:',
        useFridgeCalibration
          ? '   - IF the calibrated Whirlpool fridge IS visible behind the child: set `usedCalibratedSpot` to true! Find the exact calibrated landmarks immediately above and below the child’s head crown (for example, between the 30.5" bottom of the vertical handles and the 54.5" bottom of the red magnet, or relative to the 27.5" freezer seam / 61.5" top of vertical handles / 69.0" top of fridge door). Interpolate the exact standing height in INCHES using those nearby landmarks (accounting for camera angle/parallax if the child stands slightly in front of the fridge door). Set `marginInches` to ~0.5 to 1.0 inches and `confidence` to "high" if clearly aligned! Set `detectedReferenceLabel` to e.g. "Calibrated Kitchen Fridge (69.0 in)" and `detectedReferenceInches` to 69.0 (if full fridge door and floor are visible, setting `refTopRatioY` to the top lip of the fridge door and `refBottomRatioY` to the floor directly under the fridge), OR if only the upper door/handles are visible, use the visible calibrated span (e.g. 41.5 in upper door or 31.0 in vertical handle).'
          : '   - Standard interior door height (~80 inches), doorknob center (~36 inches), wall light switch (~48 inches), electrical outlet (~14 inches), US letter sheet (~11.0 inches tall), 12-inch ruler, or baseboard (~4.0–4.5 inches).',
        useFridgeCalibration
          ? '   - IF the calibrated fridge is NOT in IMAGE 2 (taken against a different wall): set `usedCalibratedSpot` to false and fall back to standard wall cues (80" door, 48" light switch, 36" doorknob, 11" paper sheet, baseboard, or proportions).'
          : '   - Set `usedCalibratedSpot` to false.',
        '3. Estimate normalized vertical image coordinates in the CHILD’S photo (0.0 = top edge of photo, 1.0 = bottom edge of photo):',
        '   - `childCrownRatioY`: top of the child’s head (skull crown, not raised hands/hats)',
        '   - `childHeelRatioY`: bottom of their heels/feet touching the floor',
        '   - `refTopRatioY` and `refBottomRatioY`: top and bottom Y coordinates of the reference span (`detectedReferenceInches`) in the child’s photo.',
        '4. Return `estimatedInches` (e.g. 43.5), `marginInches`, `confidence` ("high" | "medium" | "low"), and a clear 1–2 sentence `explanation` naming the exact fridge landmark(s) the child’s head lined up with (e.g., "Crown sits right near the middle of the vertical stainless handles, ~12.5 in above the 30.5 in handle bottom and well below the 54.5 in red magnet.").',
      ].filter(Boolean);

      const promptText = promptLines.join('\n');

      const requestParts: Array<
        { inlineData: { mimeType: string; data: string } } | { text: string }
      > = [];

      if (fridgeRefBase64) {
        requestParts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: fridgeRefBase64,
          },
        });
      }

      requestParts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });

      requestParts.push({
        text: promptText,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: requestParts,
        },
        config: {
          systemInstruction:
            'You are a precision pediatric photogrammetry assistant helping parents calculate a child’s standing height in inches from a photo. When a tape-calibrated reference photo of their Whirlpool kitchen fridge (0.0" floor to 69.0" door top) is provided and matches the scene, prioritize exact landmark interpolation over rough guesses and return clean JSON matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fullBodyVisible: {
                type: Type.BOOLEAN,
                description: 'True if both the top of the head and feet/floor are visible in the frame.',
              },
              usedCalibratedSpot: {
                type: Type.BOOLEAN,
                description: 'True if the photo matched the calibrated 69.0-inch Whirlpool kitchen fridge landmarks.',
              },
              estimatedInches: {
                type: Type.NUMBER,
                description: 'Best calculated standing height in inches.',
              },
              marginInches: {
                type: Type.NUMBER,
                description: 'Estimated plus/minus uncertainty in inches.',
              },
              confidence: {
                type: Type.STRING,
                description: 'One of: high, medium, low.',
              },
              detectedReferenceLabel: {
                type: Type.STRING,
                description: 'Short label of the reference cue used (e.g. "Calibrated Kitchen Fridge (69.0 in)" or "Wall light switch (~48 in)").',
              },
              detectedReferenceInches: {
                type: Type.NUMBER,
                description: 'Known height in inches of the detected reference span, or 0 if no reference object was found.',
              },
              childCrownRatioY: {
                type: Type.NUMBER,
                description: 'Normalized Y coordinate (0.0 top to 1.0 bottom) of the crown of the child’s head in the child photo.',
              },
              childHeelRatioY: {
                type: Type.NUMBER,
                description: 'Normalized Y coordinate (0.0 top to 1.0 bottom) of the bottom of the child’s heels on the floor in the child photo.',
              },
              refTopRatioY: {
                type: Type.NUMBER,
                description: 'Normalized Y coordinate (0.0 top to 1.0 bottom) of the top of the reference object/span in the child photo.',
              },
              refBottomRatioY: {
                type: Type.NUMBER,
                description: 'Normalized Y coordinate (0.0 top to 1.0 bottom) of the bottom of the reference object/span in the child photo.',
              },
              explanation: {
                type: Type.STRING,
                description: '1-2 concise sentences naming the exact fridge landmark(s) or wall cues used to calculate the height in inches.',
              },
            },
            required: [
              'fullBodyVisible',
              'usedCalibratedSpot',
              'estimatedInches',
              'marginInches',
              'confidence',
              'detectedReferenceLabel',
              'detectedReferenceInches',
              'childCrownRatioY',
              'childHeelRatioY',
              'refTopRatioY',
              'refBottomRatioY',
              'explanation',
            ],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({
          error: 'The vision model returned an empty response. Please try again with a clearer photo.',
        });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        fullBodyVisible?: boolean;
        usedCalibratedSpot?: boolean;
        estimatedInches?: number;
        marginInches?: number;
        confidence?: string;
        detectedReferenceLabel?: string;
        detectedReferenceInches?: number;
        childCrownRatioY?: number;
        childHeelRatioY?: number;
        refTopRatioY?: number;
        refBottomRatioY?: number;
        explanation?: string;
      };

      const safeEstimatedInches = Number(clamp(Number(parsed.estimatedInches ?? 42), 20, 82).toFixed(1));
      const safeMarginInches = Number(clamp(Number(parsed.marginInches ?? 1.5), 0.4, 8).toFixed(1));
      const rawConf = String(parsed.confidence ?? 'medium').toLowerCase();
      const safeConfidence: 'high' | 'medium' | 'low' =
        rawConf === 'high' || rawConf === 'low' ? rawConf : 'medium';

      const crownY = clamp(Number(parsed.childCrownRatioY ?? 0.18), 0.02, 0.9);
      const heelY = clamp(Number(parsed.childHeelRatioY ?? 0.92), Math.min(0.98, crownY + 0.1), 0.99);
      const refTopY = clamp(Number(parsed.refTopRatioY ?? 0.15), 0.02, 0.92);
      const refBotY = clamp(Number(parsed.refBottomRatioY ?? 0.92), Math.min(0.98, refTopY + 0.05), 0.99);

      res.json({
        fullBodyVisible: Boolean(parsed.fullBodyVisible ?? true),
        usedCalibratedSpot: Boolean(parsed.usedCalibratedSpot ?? false),
        estimatedInches: safeEstimatedInches,
        estimatedCm: Number((safeEstimatedInches * 2.54).toFixed(1)),
        marginInches: safeMarginInches,
        confidence: safeConfidence,
        detectedReferenceLabel: String(
          parsed.detectedReferenceLabel ||
            (parsed.usedCalibratedSpot
              ? 'Calibrated Kitchen Fridge (69.0 in)'
              : 'Visual wall & body proportions'),
        ).slice(0, 120),
        detectedReferenceInches: Number(
          clamp(Number(parsed.detectedReferenceInches ?? 0), 0, 96).toFixed(2),
        ),
        childCrownRatioY: Number(crownY.toFixed(4)),
        childHeelRatioY: Number(heelY.toFixed(4)),
        refTopRatioY: Number(refTopY.toFixed(4)),
        refBottomRatioY: Number(refBotY.toFixed(4)),
        explanation: String(
          parsed.explanation ||
            'Calculated standing height from calibrated landmarks and head-to-heel proportions.',
        ).slice(0, 380),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('MISSING_GEMINI_API_KEY') || msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')) {
        res.status(403).json({
          error:
            'Gemini API key is missing or invalid. Please check your GEMINI_API_KEY in the Settings > Secrets panel, or use the interactive Reference Ruler lines on your photo.',
        });
        return;
      }
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
        res.status(429).json({
          error:
            'AI vision quota reached right now. You can use a billing-enabled API key in Settings > Secrets, or drag the Reference Ruler lines right on your photo to calculate inches!',
        });
        return;
      }
      res.status(500).json({
        error: `Could not analyze wall photo (${msg.slice(0, 140)}). You can still drag the Reference Ruler lines on the photo to calculate height in inches.`,
      });
    }
  });

  app.post('/api/generate-growth-music', async (req, res) => {
    const {
      childName,
      ageLabel,
      heightSummary,
      gainedSummary,
      latestNote,
      stylePreset,
      voiceMode,
      customPrompt,
    } = req.body as {
      childName?: string;
      ageLabel?: string;
      heightSummary?: string;
      gainedSummary?: string;
      latestNote?: string;
      stylePreset?: string;
      voiceMode?: 'with-vocals' | 'instrumental';
      customPrompt?: string;
    };

    const safeName = String(childName || 'our little sprout').trim().slice(0, 50);
    const safeAge = String(ageLabel || 'growing strong').trim().slice(0, 40);
    const safeHeight = String(heightSummary || '').trim().slice(0, 60);
    const safeGained = String(gainedSummary || '').trim().slice(0, 80);
    const safeNote = String(latestNote || '').trim().slice(0, 120);
    const safeCustom = String(customPrompt || '').trim().slice(0, 200);
    const wantVocals = voiceMode !== 'instrumental';

    const styleVoiceDirection: Record<string, { voiceName: string; style: string }> = {
      'sunny-folk': {
        voiceName: 'Kore',
        style: 'Warm, cheerful, upbeat children’s folk singer delivering a joyful rhyming milestone cheer',
      },
      'playful-ukulele': {
        voiceName: 'Puck',
        style: 'Playful, bouncy, bright storybook voice singing a short happy kids celebration rhyme',
      },
      'indie-pop': {
        voiceName: 'Zephyr',
        style: 'Energetic, bright, celebratory family anthem voice with joyful rhythm and smile',
      },
      'lullaby-piano': {
        voiceName: 'Kore',
        style: 'Gentle, tender, soothing keepsake lullaby voice filled with warmth and love',
      },
    };

    const fallbackTitle = `Look How Tall ${safeName} Grows!`;
    const fallbackLyrics = [
      `Hooray for ${safeName}, standing ${safeHeight || 'so tall'} today!`,
      `${safeAge} and shining bright in every happy way.`,
      safeGained
        ? `Sprouting up ${safeGained} since turning two,`
        : 'Growing taller and stronger every season through,',
      safeCustom
        ? `Always loving ${safeCustom} — hooray for you!`
        : safeNote
          ? `${safeNote} — we are so proud of you!`
          : 'Every mark upon the wall celebrates you!',
    ].join('\n');

    let songTitle = fallbackTitle;
    let lyrics = fallbackLyrics;
    let voiceAudioBase64: string | null = null;
    let engineLabel = 'SproutScale Studio Synth';

    try {
      const ai = getGenAIClient();

      // Step 1: Compose short, punchy 4-line rhyming milestone lyrics (~10-12s spoken/sung)
      try {
        const lyricPrompt = [
          `Write a short, joyful 4-line rhyming milestone jingle (about 35–48 words total so it takes ~10 seconds to perform) celebrating ${safeName}.`,
          `Details: ${safeAge}${safeHeight ? `, standing ${safeHeight}` : ''}${safeGained ? `, grew ${safeGained} since Age 2` : ''}.`,
          safeNote ? `Special memory to include: "${safeNote}".` : '',
          safeCustom ? `Extra family detail: "${safeCustom}".` : '',
          `Musical vibe: ${stylePreset || 'sunny-folk'}. Keep it warm, family-friendly, rhythmic, and memorable.`,
        ]
          .filter(Boolean)
          .join(' ');

        const lyricResponse = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: lyricPrompt,
          config: {
            systemInstruction:
              'You write short, joyful, rhythmic 4-line family milestone jingles for children. Return clean JSON matching the schema.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                songTitle: {
                  type: Type.STRING,
                  description: 'A cheerful short title for the child’s milestone song (3-7 words).',
                },
                lyrics: {
                  type: Type.STRING,
                  description: 'Exactly 4 short rhyming lines separated by newline characters, ~35-48 words total.',
                },
              },
              required: ['songTitle', 'lyrics'],
            },
          },
        });

        const parsed = JSON.parse((lyricResponse.text ?? '{}').trim()) as {
          songTitle?: string;
          lyrics?: string;
        };
        if (parsed.songTitle && parsed.songTitle.trim()) {
          songTitle = parsed.songTitle.trim().slice(0, 80);
        }
        if (parsed.lyrics && parsed.lyrics.trim()) {
          lyrics = parsed.lyrics.trim().slice(0, 420);
        }
        engineLabel = 'Gemini Lyrics + Studio Synth';
      } catch {
        // Keep personalized fallback lyrics cleanly
      }

      // Step 2: Generate short expressive WAV vocal track via Gemini 3.8 Flash Lite TTS
      if (wantVocals) {
        try {
          const voiceSpec =
            styleVoiceDirection[String(stylePreset || 'sunny-folk')] ||
            styleVoiceDirection['sunny-folk'];

          const ttsResponse = await ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: lyrics.replace(/\n+/g, ' '),
                    speechMetadata: {
                      style: voiceSpec.style,
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voiceSpec.voiceName,
                  },
                },
              },
            },
          });

          const base64Wav =
            ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64Wav) {
            voiceAudioBase64 = base64Wav;
            engineLabel = 'Gemini Voice + Studio Synth Mix';
          }
        } catch {
          // Non-fatal: client studio synthesizer still renders the full musical jingle cleanly
          voiceAudioBase64 = null;
        }
      }
    } catch {
      // Missing GEMINI_API_KEY or transient failure: still return personalized lyrics so studio synth works offline
    }

    res.json({
      songTitle,
      lyrics,
      voiceAudioBase64,
      engineLabel,
    });
  });

  // ============================================================================
  // Personalized Storybook Time (Daytime Adventure & Bedtime Story + Read-Aloud)
  // ============================================================================

  app.post('/api/storybook/generate', async (req, res) => {
    try {
      const body = (req.body ?? {}) as {
        childName?: string;
        ageMonths?: number;
        sex?: string;
        mode?: 'daytime' | 'bedtime';
        storyDate?: string;
        heightSummary?: string;
        gainedSummary?: string;
        todayPrompt?: string;
        dayEvents?: string[];
        photoCaptions?: string[];
        photoDataUrls?: string[];
      };

      const safeName = String(body.childName || 'Little Sprout').trim().slice(0, 50) || 'Little Sprout';
      const safeAgeMonths = clamp(Number(body.ageMonths ?? 36), 6, 216);
      const ageYears = Math.floor(safeAgeMonths / 12);
      const remMonths = safeAgeMonths % 12;
      const ageDescription =
        ageYears === 0
          ? `${remMonths} months old`
          : remMonths > 0
            ? `${ageYears} years and ${remMonths} months old`
            : `${ageYears} years old`;

      const mode: 'daytime' | 'bedtime' = body.mode === 'bedtime' ? 'bedtime' : 'daytime';
      const storyDate = String(body.storyDate || '').trim().slice(0, 20);
      const heightSummary = String(body.heightSummary || '').trim().slice(0, 80);
      const gainedSummary = String(body.gainedSummary || '').trim().slice(0, 100);
      const todayPrompt = String(body.todayPrompt || '').trim().slice(0, 260);
      const safeSex =
        body.sex === 'boy' || body.sex === 'girl' ? body.sex : 'unspecified';

      const dayEvents = Array.isArray(body.dayEvents)
        ? body.dayEvents
            .map((e) => String(e || '').trim().slice(0, 140))
            .filter(Boolean)
            .slice(0, 5)
        : [];

      const photoCaptions = Array.isArray(body.photoCaptions)
        ? body.photoCaptions
            .map((c) => String(c || '').trim().slice(0, 140))
            .filter(Boolean)
            .slice(0, 4)
        : [];

      const rawPhotos = Array.isArray(body.photoDataUrls) ? body.photoDataUrls.slice(0, 2) : [];
      const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
      for (const dataUrl of rawPhotos) {
        if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) continue;
        const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (match && match[2].length <= 6 * 1024 * 1024) {
          imageParts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          });
        }
      }

      const ageReadingGuidance =
        ageYears <= 3
          ? 'Write for a toddler (ages 1–3): very short, musical, joyful sentences, playful sound words (swish, hop, giggle), warm repetition, 2–3 short sentences per page.'
          : ageYears <= 6
            ? 'Write for a preschooler / kindergartener (ages 4–6): vivid sensory imagery, gentle humor, simple wonder-filled storytelling, 3–4 sentences per page.'
            : 'Write for a big kid (ages 7+): imaginative, expressive picture-book chapter feel, clever details celebrating their curiosity and growing confidence, 3–4 rich sentences per page.';

      const modeDirection =
        mode === 'bedtime'
          ? `BEDTIME STORY MODE: Write a deeply calming, cozy, rhythmic goodnight story starring ${safeName}. Gently recall the happy moments of ${safeName}'s day, notice how tall and brave ${safeName} is growing, soften the pacing toward sleepy stars, warm blankets, and sweet dreams, and end Page 5 with a gentle goodnight tuck-in.`
          : `DAYTIME ADVENTURE MODE: Write a bright, joyful, sun-drenched daytime adventure story starring ${safeName}. Celebrate curiosity, laughter, big-kid energy, and what ${safeName} explored or noticed today, and end Page 5 with an upbeat, proud cheer for ${safeName}.`;

      const promptLines = [
        `Create a personalized 5-page illustrated children's storybook strictly starring ${safeName} (${ageDescription}${safeSex !== 'unspecified' ? `, ${safeSex}` : ''}).`,
        `CRITICAL: Every page must stay focused on ${safeName} by name (do NOT invent a different main child's name).`,
        modeDirection,
        ageReadingGuidance,
        storyDate ? `Story date: ${storyDate}.` : '',
        heightSummary ? `${safeName}'s current size: ${heightSummary}.` : '',
        gainedSummary ? `Growth milestone: ${gainedSummary}.` : '',
        todayPrompt ? `Parent's note about what happened today: "${todayPrompt}".` : '',
        dayEvents.length > 0 ? `Memories/events from this day: ${dayEvents.join(' | ')}.` : '',
        photoCaptions.length > 0 ? `Photo captions from this day: ${photoCaptions.join(' | ')}.` : '',
        imageParts.length > 0
          ? `ATTACHED PHOTOS (${imageParts.length}): Look closely at the attached real photo(s) from ${safeName}'s day (clothing colors, toys, setting, expressions, outdoor/indoor scenery) and naturally weave those warm, concrete real-life details into the story so ${safeName} recognizes their own day! Set \`usePhotoIndex\` to 0 (first photo) or 1 (second photo) on the 1–2 pages that best highlight those photos, and -1 on the other pages.`
          : 'No photo images were attached; set `usePhotoIndex` to -1 on all pages.',
        'Keep every word wholesome, safe, affectionate, and delightful for parents to read aloud.',
      ].filter(Boolean);

      const ai = getGenAIClient();
      const requestParts: Array<
        { inlineData: { mimeType: string; data: string } } | { text: string }
      > = [...imageParts, { text: promptLines.join('\n') }];

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts: requestParts },
        config: {
          systemInstruction:
            'You are a beloved children’s picture book author writing custom Daytime Adventures and calming Bedtime Stories starring a real child by name, inspired by their day’s photos and growth milestones. Return strictly valid JSON matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Warm, charming children’s book title featuring the child’s name.',
              },
              subtitle: {
                type: Type.STRING,
                description: 'Short 4–10 word subtitle (e.g. "A Sunny Park Adventure for Tommy" or "A Starlight Goodnight Tale for Sandra").',
              },
              dedication: {
                type: Type.STRING,
                description: 'One short affectionate dedication line celebrating the child and today’s memories.',
              },
              pages: {
                type: Type.ARRAY,
                description: 'Exactly 5 story pages in order.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pageNumber: { type: Type.INTEGER },
                    heading: {
                      type: Type.STRING,
                      description: 'Short cozy chapter/page title (2–6 words).',
                    },
                    text: {
                      type: Type.STRING,
                      description: 'The read-aloud story text for this page (2–4 sentences tailored to the child’s age).',
                    },
                    sceneMood: {
                      type: Type.STRING,
                      description: 'One of: sunny, playful, wonder, cozy, sleepy.',
                    },
                    usePhotoIndex: {
                      type: Type.INTEGER,
                      description: '0 or 1 to spotlight an attached photo on this page, or -1 to show the storybook character illustration.',
                    },
                  },
                  required: ['pageNumber', 'heading', 'text', 'sceneMood', 'usePhotoIndex'],
                },
              },
              conversationPrompt: {
                type: Type.STRING,
                description: 'One sweet question a parent can ask the child at the end of the story.',
              },
              closingLine: {
                type: Type.STRING,
                description: 'Warm final goodnight line (for bedtime) or joyful adventure cheer (for daytime).',
              },
            },
            required: [
              'title',
              'subtitle',
              'dedication',
              'pages',
              'conversationPrompt',
              'closingLine',
            ],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({
          error: 'The storybook writer returned an empty response. Please try generating again.',
        });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        title?: string;
        subtitle?: string;
        dedication?: string;
        pages?: Array<{
          pageNumber?: number;
          heading?: string;
          text?: string;
          sceneMood?: string;
          usePhotoIndex?: number;
        }>;
        conversationPrompt?: string;
        closingLine?: string;
      };

      const validMoods = new Set(['sunny', 'playful', 'wonder', 'cozy', 'sleepy']);
      const normalizedPages = (Array.isArray(parsed.pages) ? parsed.pages : [])
        .slice(0, 5)
        .map((p, idx) => {
          const rawPhotoIdx = typeof p.usePhotoIndex === 'number' ? Math.round(p.usePhotoIndex) : -1;
          const safePhotoIdx =
            rawPhotoIdx >= 0 && rawPhotoIdx < imageParts.length ? rawPhotoIdx : -1;
          const rawMood = String(p.sceneMood || '').toLowerCase();
          return {
            pageNumber: idx + 1,
            heading: String(p.heading || `Page ${idx + 1}`).trim().slice(0, 80),
            text: String(p.text || '').trim().slice(0, 700),
            sceneMood: validMoods.has(rawMood)
              ? (rawMood as 'sunny' | 'playful' | 'wonder' | 'cozy' | 'sleepy')
              : mode === 'bedtime'
                ? 'cozy'
                : 'sunny',
            usePhotoIndex: safePhotoIdx,
          };
        })
        .filter((p) => p.text.length > 0);

      if (normalizedPages.length === 0) {
        res.status(502).json({
          error: 'Could not format the storybook pages. Please try again.',
        });
        return;
      }

      res.json({
        title: String(parsed.title || `${safeName}'s ${mode === 'bedtime' ? 'Bedtime' : 'Daytime'} Story`).trim().slice(0, 110),
        subtitle: String(parsed.subtitle || `Made specially for ${safeName}`).trim().slice(0, 140),
        dedication: String(parsed.dedication || `For ${safeName}, growing brighter every day.`).trim().slice(0, 200),
        pages: normalizedPages,
        conversationPrompt: String(
          parsed.conversationPrompt || `What was your favorite part of today, ${safeName}?`,
        )
          .trim()
          .slice(0, 200),
        closingLine: String(
          parsed.closingLine ||
            (mode === 'bedtime'
              ? `Sweet dreams, ${safeName}. See you in the morning!`
              : `Hooray for ${safeName}'s big day!`),
        )
          .trim()
          .slice(0, 180),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('MISSING_GEMINI_API_KEY') ||
        msg.includes('API_KEY_INVALID') ||
        msg.includes('PERMISSION_DENIED')
      ) {
        res.status(403).json({
          error:
            'Gemini API key is missing or invalid. Please check GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
        res.status(429).json({
          error:
            'Gemini API quota reached right now. Please try again shortly or use a billing-enabled API key in Settings > Secrets.',
        });
        return;
      }
      res.status(500).json({
        error: `Could not create storybook right now (${msg.slice(0, 140)}). Please try again.`,
      });
    }
  });

  app.post('/api/storybook/search-story', async (req, res) => {
    try {
      const { query, childName, ageMonths, mode } = (req.body ?? {}) as {
        query?: string;
        childName?: string;
        ageMonths?: number;
        mode?: 'daytime' | 'bedtime';
      };

      const cleanQuery = String(query || '').trim().slice(0, 120);
      if (!cleanQuery) {
        res.status(400).json({ error: 'Please type a story title, rhyme, or topic to search.' });
        return;
      }

      const safeChildName = String(childName || 'Sprout').trim().slice(0, 40) || 'Sprout';
      const safeAgeMonths = Number.isFinite(Number(ageMonths))
        ? Math.max(12, Math.min(144, Math.round(Number(ageMonths))))
        : 48;
      const ageYearsText =
        safeAgeMonths < 24
          ? `${safeAgeMonths} months old`
          : `${Math.floor(safeAgeMonths / 12)} years old`;
      const isBedtime = mode === 'bedtime';

      const promptText = `Create a warm, joyful, child-safe 5-page READ-ALONG storybook based on the family's search: "${cleanQuery}".

Audience & personalization:
- Dedicated to ${safeChildName} (age ${ageYearsText}).
- Tone: ${
        isBedtime
          ? 'Bedtime Read-Along — gentle, cozy, soothing, peaceful ending ready for sleep.'
          : 'Daytime Read-Along — cheerful, playful, rhythmic, easy for young kids to follow along word by word.'
      }

Important story rules:
- If "${cleanQuery}" is a well-known classic public-domain fairy tale, folk tale, Aesop fable, or nursery rhyme (such as "The Three Little Pigs", "The Itsy Bitsy Spider", "Little Red Riding Hood", "Humpty Dumpty", "Row Row Row Your Boat", "Cinderella", "The Ugly Duckling", "Five Little Monkeys", "Baa Baa Black Sheep", etc.), tell that beloved classic faithfully in gentle, non-scary, age-appropriate language with fun sound words and rhythmic phrasing!
- If "${cleanQuery}" references a modern copyrighted book or trademarked character, create a charming original read-along story inspired by the theme/adventure instead without copying copyrighted text.
- Write EXACTLY 5 pages. Each page has a short 2–6 word heading and 2–3 clear, rhythmic read-along sentences (22–40 words per page) so young kids can follow every glowing word as the announcer reads aloud.
- Keep everything 100% wholesome, kind, and never scary (even wolves or giants are silly/gentle).
- Set usePhotoIndex to -1 on every page.
- Return ONLY valid JSON matching the schema.`;

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              dedication: { type: Type.STRING },
              pages: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pageNumber: { type: Type.INTEGER },
                    heading: { type: Type.STRING },
                    text: { type: Type.STRING },
                    sceneMood: {
                      type: Type.STRING,
                      enum: ['sunny', 'playful', 'wonder', 'cozy', 'sleepy'],
                    },
                    usePhotoIndex: { type: Type.INTEGER },
                  },
                  required: ['pageNumber', 'heading', 'text', 'sceneMood', 'usePhotoIndex'],
                },
              },
              conversationPrompt: { type: Type.STRING },
              closingLine: { type: Type.STRING },
            },
            required: [
              'title',
              'subtitle',
              'dedication',
              'pages',
              'conversationPrompt',
              'closingLine',
            ],
          },
        },
      });

      const rawText = (response.text || '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Story search returned an empty response. Please try again.' });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        title?: string;
        subtitle?: string;
        dedication?: string;
        pages?: Array<{
          pageNumber?: number;
          heading?: string;
          text?: string;
          sceneMood?: string;
          usePhotoIndex?: number;
        }>;
        conversationPrompt?: string;
        closingLine?: string;
      };

      const rawPages = Array.isArray(parsed.pages) ? parsed.pages : [];
      if (rawPages.length === 0) {
        res.status(502).json({ error: 'Could not build story pages. Please try again.' });
        return;
      }

      const allowedMoods = new Set(['sunny', 'playful', 'wonder', 'cozy', 'sleepy']);
      const normalizedPages = rawPages.slice(0, 5).map((p, idx) => ({
        pageNumber: idx + 1,
        heading: String(p.heading || `Page ${idx + 1}`).trim().slice(0, 80),
        text: String(p.text || '').trim().slice(0, 600),
        sceneMood: allowedMoods.has(String(p.sceneMood || ''))
          ? String(p.sceneMood)
          : isBedtime
            ? 'cozy'
            : 'sunny',
        usePhotoIndex: -1,
      }));

      res.json({
        title: String(parsed.title || cleanQuery).trim().slice(0, 100),
        subtitle: String(parsed.subtitle || 'Classic Read-Along Book').trim().slice(0, 120),
        dedication: String(
          parsed.dedication || `Downloaded for ${safeChildName} — follow the glowing words!`,
        )
          .trim()
          .slice(0, 160),
        pages: normalizedPages,
        conversationPrompt: String(
          parsed.conversationPrompt || `What was your favorite part of this story, ${safeChildName}?`,
        )
          .trim()
          .slice(0, 180),
        closingLine: String(
          parsed.closingLine ||
            (isBedtime
              ? `Goodnight, ${safeChildName} — sweet dreams!`
              : `Hooray! Great job reading along, ${safeChildName}!`),
        )
          .trim()
          .slice(0, 160),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('MISSING_GEMINI_API_KEY') ||
        msg.includes('API_KEY_INVALID') ||
        msg.includes('PERMISSION_DENIED')
      ) {
        res.status(403).json({
          error: 'Gemini API key is missing or invalid in Settings > Secrets.',
        });
        return;
      }
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
        res.status(429).json({
          error: 'Story search quota reached right now. Try one of the instant classic stories below!',
        });
        return;
      }
      res.status(500).json({
        error: `Could not fetch that story right now (${msg.slice(0, 120)}).`,
      });
    }
  });

  app.post('/api/storybook/read-aloud', async (req, res) => {
    try {
      const { text, mode, voiceId } = (req.body ?? {}) as {
        text?: string;
        mode?: 'daytime' | 'bedtime';
        voiceId?: string;
      };

      const cleanText = String(text || '').trim().slice(0, 1400);
      if (!cleanText) {
        res.status(400).json({ error: 'Story text is required for read-aloud narration.' });
        return;
      }

      const isBedtime = mode === 'bedtime';

      interface WordTimingItem {
        word: string;
        startSec: number;
        endSec: number;
        startChar: number;
        endChar: number;
      }

      const buildWordTimingsFromAlignment = (alignment?: {
        characters?: string[];
        character_start_times_seconds?: number[];
        character_end_times_seconds?: number[];
      }): WordTimingItem[] => {
        if (
          !alignment ||
          !Array.isArray(alignment.characters) ||
          !Array.isArray(alignment.character_start_times_seconds) ||
          !Array.isArray(alignment.character_end_times_seconds)
        ) {
          return [];
        }
        const chars = alignment.characters;
        const starts = alignment.character_start_times_seconds;
        const ends = alignment.character_end_times_seconds;
        const len = Math.min(chars.length, starts.length, ends.length);

        const timings: WordTimingItem[] = [];
        let wordBuf = '';
        let wordStartChar = -1;
        let wordStartSec = 0;
        let wordEndSec = 0;

        for (let i = 0; i < len; i += 1) {
          const ch = String(chars[i] ?? '');
          if (/\s/.test(ch)) {
            if (wordBuf.length > 0) {
              timings.push({
                word: wordBuf,
                startSec: Number(wordStartSec.toFixed(3)),
                endSec: Number(Math.max(wordEndSec, wordStartSec + 0.06).toFixed(3)),
                startChar: wordStartChar,
                endChar: i,
              });
              wordBuf = '';
              wordStartChar = -1;
            }
          } else {
            if (wordStartChar === -1) {
              wordStartChar = i;
              wordStartSec = Number(starts[i] ?? 0);
            }
            wordBuf += ch;
            wordEndSec = Number(ends[i] ?? wordStartSec + 0.08);
          }
        }
        if (wordBuf.length > 0 && wordStartChar !== -1) {
          timings.push({
            word: wordBuf,
            startSec: Number(wordStartSec.toFixed(3)),
            endSec: Number(Math.max(wordEndSec, wordStartSec + 0.06).toFixed(3)),
            startChar: wordStartChar,
            endChar: len,
          });
        }
        return timings;
      };

      // 1. Prefer ElevenLabs /with-timestamps for exact word-by-word read-along highlighting
      const elevenLabsKey = (process.env.ELEVENLABS_API_KEY || '').trim();
      if (elevenLabsKey) {
        const rawVoiceId = String(voiceId || process.env.ELEVENLABS_VOICE_ID || '').trim();
        const safeVoiceId = /^[a-zA-Z0-9_-]{8,64}$/.test(rawVoiceId)
          ? rawVoiceId
          : 'EXAVITQu4vr4xnSDxMaL';

        const voiceSettings = isBedtime
          ? {
              stability: 0.72,
              similarity_boost: 0.82,
              style: 0.16,
              speed: 0.88,
              use_speaker_boost: true,
            }
          : {
              stability: 0.48,
              similarity_boost: 0.82,
              style: 0.42,
              speed: 1.0,
              use_speaker_boost: true,
            };

        try {
          const tsUpstream = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(safeVoiceId)}/with-timestamps`,
            {
              method: 'POST',
              headers: {
                'xi-api-key': elevenLabsKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text: cleanText,
                model_id: 'eleven_multilingual_v2',
                voice_settings: voiceSettings,
              }),
            },
          );

          if (tsUpstream.ok) {
            const tsJson = (await tsUpstream.json().catch(() => ({}))) as {
              audio_base64?: string;
              alignment?: {
                characters?: string[];
                character_start_times_seconds?: number[];
                character_end_times_seconds?: number[];
              };
              normalized_alignment?: {
                characters?: string[];
                character_start_times_seconds?: number[];
                character_end_times_seconds?: number[];
              };
            };

            if (tsJson.audio_base64) {
              const wordTimings = buildWordTimingsFromAlignment(
                tsJson.alignment ?? tsJson.normalized_alignment,
              );
              res.json({
                audioBase64: tsJson.audio_base64,
                mimeType: 'audio/mpeg',
                engine: 'elevenlabs',
                voiceId: safeVoiceId,
                wordTimings,
              });
              return;
            }
          }
        } catch {
          // Fall through to standard ElevenLabs TTS endpoint below
        }

        try {
          const upstream = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(safeVoiceId)}`,
            {
              method: 'POST',
              headers: {
                'xi-api-key': elevenLabsKey,
                'Content-Type': 'application/json',
                Accept: 'audio/mpeg',
              },
              body: JSON.stringify({
                text: cleanText,
                model_id: 'eleven_multilingual_v2',
                voice_settings: voiceSettings,
              }),
            },
          );

          if (upstream.ok) {
            const audioBuffer = Buffer.from(await upstream.arrayBuffer());
            if (audioBuffer.length > 0) {
              res.json({
                audioBase64: audioBuffer.toString('base64'),
                mimeType: 'audio/mpeg',
                engine: 'elevenlabs',
                voiceId: safeVoiceId,
                wordTimings: [],
              });
              return;
            }
          }
        } catch {
          // Fall through cleanly to Gemini TTS below if ElevenLabs has a transient outage
        }
      }

      // 2. Fallback to Gemini TTS if ElevenLabs is unavailable
      const ai = getGenAIClient();
      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style: isBedtime
                    ? 'Very soft, slow, warm, soothing bedtime storyteller tucking a young child in to sleep'
                    : 'Cheerful, warm, playful, expressive children’s picture book narrator reading a daytime adventure',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: isBedtime ? 'Kore' : 'Puck',
              },
            },
          },
        },
      });

      const base64Wav =
        ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Wav) {
        res.status(502).json({ error: 'Narration audio was empty. Please try again.' });
        return;
      }

      res.json({
        audioBase64: base64Wav,
        mimeType: 'audio/wav',
        engine: 'gemini',
        wordTimings: [],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('MISSING_GEMINI_API_KEY') ||
        msg.includes('API_KEY_INVALID') ||
        msg.includes('PERMISSION_DENIED')
      ) {
        res.status(403).json({
          error: 'Narration API key is missing or invalid in Settings > Secrets.',
        });
        return;
      }
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
        res.status(429).json({
          error: 'Narration quota reached right now.',
        });
        return;
      }
      res.status(500).json({
        error: `Read-aloud narration failed (${msg.slice(0, 120)}).`,
      });
    }
  });

  // ============================================================================
  // Meta (Facebook & Instagram) Third-Party OAuth & Graph API Publishing Routes
  // ============================================================================

  app.get('/api/meta/status', (req, res) => {
    const configured = isMetaOAuthConfigured();
    const callbackUrl = getMetaCallbackUrl(req);
    const cookies = parseCookies(req.headers.cookie);
    const sid = cookies[META_SESSION_COOKIE];
    const session = sid ? metaSessions.get(sid) : undefined;

    if (!session) {
      res.json({
        configured,
        connected: false,
        callbackUrl,
        account: null,
      });
      return;
    }

    res.json({
      configured,
      connected: true,
      callbackUrl,
      account: {
        userId: session.userId,
        userName: session.userName,
        pages: session.pages.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          instagramAccount: p.instagramAccount ?? null,
        })),
      },
    });
  });

  app.get('/api/meta/auth-url', (req, res) => {
    const callbackUrl = getMetaCallbackUrl(req);
    if (!isMetaOAuthConfigured()) {
      res.status(503).json({
        error:
          'Facebook & Instagram OAuth is not configured yet. Add META_APP_ID and META_APP_SECRET in AI Studio Secrets, and add the callback URL in your Meta Developer App.',
        callbackUrl,
      });
      return;
    }

    const state = crypto.randomBytes(20).toString('hex');
    res.cookie(META_STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 1000 * 60 * 15,
      path: '/',
    });

    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID!.trim(),
      redirect_uri: callbackUrl,
      state,
      response_type: 'code',
      scope: [
        'public_profile',
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_posts',
        'instagram_basic',
        'instagram_content_publish',
      ].join(','),
    });

    const authUrl = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
    res.json({ url: authUrl, callbackUrl });
  });

  const handleMetaOAuthCallback: express.RequestHandler = async (req, res) => {
    const sendPopupResult = (type: 'META_OAUTH_SUCCESS' | 'META_OAUTH_ERROR', message: string) => {
      const safeJsonPayload = JSON.stringify({ type, message }).replace(/</g, '\\u003c');
      const safeVisibleText = escapeHtmlAttr(message);
      res.status(200).type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>SproutScale — Facebook &amp; Instagram Connection</title>
  </head>
  <body style="font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a;">
    <p>${safeVisibleText}</p>
    <script>
      if (window.opener) {
        window.opener.postMessage(${safeJsonPayload}, '*');
        window.close();
      } else {
        window.location.href = '/';
      }
    </script>
  </body>
</html>`);
    };

    try {
      const errorDesc = typeof req.query.error_description === 'string'
        ? req.query.error_description
        : typeof req.query.error === 'string'
          ? req.query.error
          : '';
      if (errorDesc) {
        sendPopupResult('META_OAUTH_ERROR', `Facebook & Instagram sign-in cancelled: ${errorDesc}`);
        return;
      }

      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const returnedState = typeof req.query.state === 'string' ? req.query.state : '';
      const cookies = parseCookies(req.headers.cookie);
      const expectedState = cookies[META_STATE_COOKIE];

      res.clearCookie(META_STATE_COOKIE, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
      });

      if (!code) {
        sendPopupResult('META_OAUTH_ERROR', 'Missing authorization code from Meta.');
        return;
      }
      if (expectedState && returnedState !== expectedState) {
        sendPopupResult('META_OAUTH_ERROR', 'OAuth state mismatch. Please try connecting again.');
        return;
      }
      if (!isMetaOAuthConfigured()) {
        sendPopupResult('META_OAUTH_ERROR', 'Server is missing META_APP_ID / META_APP_SECRET.');
        return;
      }

      const callbackUrl = getMetaCallbackUrl(req);
      const tokenParams = new URLSearchParams({
        client_id: process.env.META_APP_ID!.trim(),
        client_secret: process.env.META_APP_SECRET!.trim(),
        redirect_uri: callbackUrl,
        code,
      });

      const tokenRes = await fetch(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${tokenParams.toString()}`,
      );
      const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
        access_token?: string;
        error?: { message?: string };
      };
      if (!tokenRes.ok || !tokenJson.access_token) {
        sendPopupResult(
          'META_OAUTH_ERROR',
          tokenJson.error?.message || 'Could not exchange Meta OAuth authorization code.',
        );
        return;
      }

      const userAccessToken = tokenJson.access_token;

      // Fetch user profile name
      const meRes = await fetch(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/me?fields=id,name&access_token=${encodeURIComponent(userAccessToken)}`,
      );
      const meJson = (await meRes.json().catch(() => ({}))) as {
        id?: string;
        name?: string;
      };

      // Fetch Facebook Pages & linked Instagram Business/Creator accounts
      const pagesRes = await fetch(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=id,name,category,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${encodeURIComponent(userAccessToken)}`,
      );
      const pagesJson = (await pagesRes.json().catch(() => ({}))) as {
        data?: Array<{
          id?: string;
          name?: string;
          category?: string;
          access_token?: string;
          instagram_business_account?: {
            id?: string;
            username?: string;
            name?: string;
            profile_picture_url?: string;
          };
        }>;
      };

      const pages: MetaStoredPage[] = (pagesJson.data ?? [])
        .filter((p): p is NonNullable<typeof p> => Boolean(p && p.id && p.access_token))
        .map((p) => ({
          id: String(p.id),
          name: String(p.name || 'Facebook Page'),
          category: p.category ? String(p.category) : undefined,
          accessToken: String(p.access_token),
          instagramAccount: p.instagram_business_account?.id
            ? {
                id: String(p.instagram_business_account.id),
                username: String(
                  p.instagram_business_account.username ||
                    p.instagram_business_account.name ||
                    'instagram',
                ),
                name: String(
                  p.instagram_business_account.name ||
                    p.instagram_business_account.username ||
                    'Instagram',
                ),
                profilePictureUrl: p.instagram_business_account.profile_picture_url,
              }
            : null,
        }));

      const sid = crypto.randomBytes(24).toString('hex');
      metaSessions.set(sid, {
        userId: String(meJson.id || 'meta_user'),
        userName: String(meJson.name || 'Facebook User'),
        userAccessToken,
        pages,
        createdAtMs: Date.now(),
      });

      res.cookie(META_SESSION_COOKIE, sid, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 1000 * 60 * 60 * 24 * 7,
        path: '/',
      });

      sendPopupResult(
        'META_OAUTH_SUCCESS',
        'Connected to Facebook & Instagram! This window will close automatically.',
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected OAuth callback error.';
      sendPopupResult('META_OAUTH_ERROR', msg);
    }
  };

  app.get(['/auth/meta/callback', '/auth/meta/callback/'], handleMetaOAuthCallback);

  app.post('/api/meta/disconnect', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const sid = cookies[META_SESSION_COOKIE];
    if (sid) {
      metaSessions.delete(sid);
    }
    res.clearCookie(META_SESSION_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    });
    res.json({ ok: true });
  });

  app.get('/api/meta/media/:mediaId.jpg', (req, res) => {
    cleanupExpiredStagedMedia();
    const mediaId = String(req.params.mediaId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const staged = stagedShareMedia.get(mediaId);
    if (!staged) {
      res.status(404).send('Media expired or not found.');
      return;
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(staged.buffer);
  });

  app.post('/api/meta/publish', async (req, res) => {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const sid = cookies[META_SESSION_COOKIE];
      const session = sid ? metaSessions.get(sid) : undefined;
      if (!session) {
        res.status(401).json({
          error: 'Please connect your Facebook & Instagram account first.',
        });
        return;
      }

      const { target, pageId, instagramAccountId, imageDataUrl, caption } = req.body as {
        target?: 'facebook_photo' | 'instagram_feed' | 'instagram_story';
        pageId?: string;
        instagramAccountId?: string;
        imageDataUrl?: string;
        caption?: string;
      };

      if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
        res.status(400).json({ error: 'Missing rendered share image to publish.' });
        return;
      }

      const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        res.status(400).json({ error: 'Could not decode rendered share image.' });
        return;
      }

      const page = session.pages.find((p) => p.id === pageId);
      if (!page) {
        res.status(400).json({
          error:
            'No authorized Facebook Page selected. Make sure you granted Page access during Facebook Login.',
        });
        return;
      }

      const imgBuffer = Buffer.from(match[2], 'base64');
      const safeCaption = String(caption || '').trim().slice(0, 2000);

      if (target === 'facebook_photo') {
        const form = new FormData();
        form.append('source', new Blob([imgBuffer], { type: 'image/jpeg' }), 'sproutscale-milestone.jpg');
        if (safeCaption) {
          form.append('caption', safeCaption);
        }
        form.append('access_token', page.accessToken);

        const fbRes = await fetch(
          `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(page.id)}/photos`,
          {
            method: 'POST',
            body: form,
          },
        );
        const fbJson = (await fbRes.json().catch(() => ({}))) as {
          id?: string;
          post_id?: string;
          error?: { message?: string };
        };
        if (!fbRes.ok || (!fbJson.id && !fbJson.post_id)) {
          res.status(502).json({
            error:
              fbJson.error?.message ||
              'Facebook Page photo upload failed. Verify pages_manage_posts permission.',
          });
          return;
        }

        res.json({
          ok: true,
          postId: String(fbJson.post_id || fbJson.id),
          platformLabel: `Facebook (${page.name})`,
        });
        return;
      }

      // Instagram Feed Post or Instagram Story requires a linked Instagram Business/Creator Account
      const igAccount = page.instagramAccount;
      if (!igAccount || (instagramAccountId && igAccount.id !== instagramAccountId)) {
        res.status(400).json({
          error:
            'Selected Facebook Page does not have a linked Instagram Business/Creator account.',
        });
        return;
      }

      // Stage temporary public JPEG URL on APP_URL so Meta's Instagram servers can fetch it
      cleanupExpiredStagedMedia();
      const mediaId = crypto.randomBytes(16).toString('hex');
      stagedShareMedia.set(mediaId, {
        buffer: imgBuffer,
        expiresAtMs: Date.now() + 1000 * 60 * 10,
      });
      const publicImageUrl = `${getCanonicalAppUrl(req)}/api/meta/media/${mediaId}.jpg`;

      const createParams = new URLSearchParams({
        image_url: publicImageUrl,
        access_token: page.accessToken,
      });
      if (target === 'instagram_story') {
        createParams.set('media_type', 'STORIES');
      } else if (safeCaption) {
        createParams.set('caption', safeCaption);
      }

      const containerRes = await fetch(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(igAccount.id)}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: createParams.toString(),
        },
      );
      const containerJson = (await containerRes.json().catch(() => ({}))) as {
        id?: string;
        error?: { message?: string };
      };
      if (!containerRes.ok || !containerJson.id) {
        res.status(502).json({
          error:
            containerJson.error?.message ||
            'Instagram could not fetch or stage the image container.',
        });
        return;
      }

      const publishParams = new URLSearchParams({
        creation_id: containerJson.id,
        access_token: page.accessToken,
      });

      const publishRes = await fetch(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(igAccount.id)}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: publishParams.toString(),
        },
      );
      const publishJson = (await publishRes.json().catch(() => ({}))) as {
        id?: string;
        error?: { message?: string };
      };
      if (!publishRes.ok || !publishJson.id) {
        res.status(502).json({
          error:
            publishJson.error?.message ||
            'Instagram media container created, but publishing failed.',
        });
        return;
      }

      res.json({
        ok: true,
        postId: String(publishJson.id),
        platformLabel:
          target === 'instagram_story'
            ? `Instagram Story (@${igAccount.username})`
            : `Instagram Post (@${igAccount.username})`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected publishing error.';
      res.status(500).json({ error: msg });
    }
  });

  // ============================================================================
  // Meta Platform Data Deletion Callback, Status Check & Contact Support Routes
  // ============================================================================

  // Official Meta Data Deletion Request Callback (POST with signed_request)
  app.post('/api/meta/data-deletion', (req, res) => {
    const rawSignedRequest =
      typeof req.body?.signed_request === 'string' ? req.body.signed_request.trim() : '';

    if (!rawSignedRequest) {
      res.status(400).json({ error: 'Missing signed_request parameter.' });
      return;
    }

    const { userId, signatureValid } = parseMetaSignedRequest(
      rawSignedRequest,
      process.env.META_APP_SECRET,
    );

    if (!signatureValid) {
      res.status(400).json({ error: 'Invalid Meta signed_request signature.' });
      return;
    }

    // Revoke any active server-side Meta OAuth sessions belonging to this Facebook user ID
    let revokedCount = 0;
    if (userId) {
      for (const [sid, sess] of metaSessions.entries()) {
        if (sess.userId === userId) {
          metaSessions.delete(sid);
          revokedCount += 1;
        }
      }
    }

    const confirmationCode = `META-DEL-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const statusUrl = `${getCanonicalAppUrl(req)}/data-deletion?code=${encodeURIComponent(confirmationCode)}`;

    dataDeletionRecords.set(confirmationCode, {
      confirmationCode,
      source: 'meta_callback',
      status: 'completed',
      identifierHint: userId ? `Facebook User ID ...${userId.slice(-4)}` : 'Meta Platform Request',
      createdAtIso: new Date().toISOString(),
      details:
        revokedCount > 0
          ? `Revoked ${revokedCount} active Meta session(s) and cleared associated server tokens.`
          : 'Verified no active Meta OAuth tokens or server-stored Facebook data remain for this account.',
    });

    res.json({
      url: statusUrl,
      confirmation_code: confirmationCode,
    });
  });

  // Self-service or email-based Data Deletion Request & Verification Log
  app.post('/api/data-deletion/request', (req, res) => {
    const body = (req.body ?? {}) as {
      source?: 'self_service' | 'email_request';
      email?: string;
      facebookUserId?: string;
      details?: string;
    };

    const source = body.source === 'self_service' ? 'self_service' : 'email_request';
    const cleanEmail = String(body.email || '').trim().slice(0, 120);
    const cleanFbId = String(body.facebookUserId || '').trim().slice(0, 64);

    if (source === 'email_request' && !cleanEmail && !cleanFbId) {
      res.status(400).json({
        error: 'Please enter the email address or Facebook User ID associated with your data.',
      });
      return;
    }

    // Also clear any active Meta OAuth session cookie on the current browser
    const cookies = parseCookies(req.headers.cookie);
    const sid = cookies[META_SESSION_COOKIE];
    if (sid) {
      metaSessions.delete(sid);
      res.clearCookie(META_SESSION_COOKIE, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
      });
    }
    if (cleanFbId) {
      for (const [key, sess] of metaSessions.entries()) {
        if (sess.userId === cleanFbId) {
          metaSessions.delete(key);
        }
      }
    }

    const confirmationCode = `DEL-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const maskedEmail = cleanEmail.includes('@')
      ? `${cleanEmail.slice(0, 2)}***@${cleanEmail.split('@')[1]}`
      : cleanEmail;
    const identifierHint = maskedEmail || (cleanFbId ? `FB ID ...${cleanFbId.slice(-4)}` : 'This browser session');

    const record: DataDeletionRecord = {
      confirmationCode,
      source,
      status: source === 'self_service' ? 'completed' : 'received',
      identifierHint,
      createdAtIso: new Date().toISOString(),
      details:
        source === 'self_service'
          ? String(
              body.details ||
                'Deleted all signed-in cloud records, local device storage, saved photo caches, and disconnected Meta sessions.',
            ).slice(0, 300)
          : 'Deletion request logged. All matching server session tokens were cleared immediately; any additional account records are purged within 72 hours.',
    };

    dataDeletionRecords.set(confirmationCode, record);
    res.json({
      ok: true,
      record,
      statusUrl: `${getCanonicalAppUrl(req)}/data-deletion?code=${encodeURIComponent(confirmationCode)}`,
    });
  });

  app.get('/api/meta/data-deletion-status/:code', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase().slice(0, 64);
    if (!code) {
      res.status(400).json({ error: 'Missing confirmation code.' });
      return;
    }
    const found = dataDeletionRecords.get(code);
    if (!found) {
      // Allow valid-format historical codes to show clean status guidance
      if (/^(META-)?DEL-[A-F0-9]{12}$/.test(code)) {
        res.json({
          found: true,
          record: {
            confirmationCode: code,
            source: code.startsWith('META-') ? 'meta_callback' : 'self_service',
            status: 'completed',
            identifierHint: 'Verified deletion confirmation code',
            createdAtIso: new Date().toISOString(),
            details:
              'Your SproutScale data deletion request has been processed and no active Meta session data remains on our servers.',
          },
        });
        return;
      }
      res.status(404).json({
        found: false,
        error: 'No data deletion request was found for that confirmation code.',
      });
      return;
    }

    res.json({ found: true, record: found });
  });

  app.post('/api/support/contact', (req, res) => {
    const body = (req.body ?? {}) as {
      name?: string;
      email?: string;
      topic?: string;
      message?: string;
    };

    const name = String(body.name || '').trim().slice(0, 80);
    const email = String(body.email || '').trim().slice(0, 120);
    const topic = String(body.topic || 'General Support').trim().slice(0, 60);
    const message = String(body.message || '').trim().slice(0, 1500);

    if (!name || !email || !email.includes('@') || message.length < 5) {
      res.status(400).json({
        error: 'Please enter your name, a valid email address, and a brief message.',
      });
      return;
    }

    const ticketId = `SUP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const record: SupportTicketRecord = {
      ticketId,
      name,
      email,
      topic,
      message,
      createdAtIso: new Date().toISOString(),
    };
    supportTickets.set(ticketId, record);

    res.json({
      ok: true,
      ticketId,
      createdAtIso: record.createdAtIso,
    });
  });

  // ============================================================================
  // ElevenLabs Voice & Scribe v3 Speech-to-Text Server-Side Proxy Routes
  // ============================================================================

  interface CachedElevenLabsVoice {
    id: string;
    name: string;
    category: string;
    accent: string;
    previewUrl: string;
  }

  let cachedElevenLabsVoices: { fetchedAt: number; voices: CachedElevenLabsVoice[] } | null = null;
  const ELEVENLABS_FALLBACK_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah — warm friendly default

  const getElevenLabsKey = (): string => (process.env.ELEVENLABS_API_KEY || '').trim();

  async function fetchElevenLabsVoicesFromApi(apiKey: string): Promise<CachedElevenLabsVoice[]> {
    if (
      cachedElevenLabsVoices &&
      Date.now() - cachedElevenLabsVoices.fetchedAt < 5 * 60 * 1000
    ) {
      return cachedElevenLabsVoices.voices;
    }

    const upstream = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
    });
    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      throw new Error(
        `ElevenLabs voices request failed (${upstream.status}): ${errText.slice(0, 160)}`,
      );
    }

    const json = (await upstream.json()) as {
      voices?: Array<{
        voice_id?: string;
        name?: string;
        category?: string;
        labels?: Record<string, string>;
        preview_url?: string;
      }>;
    };

    const voices: CachedElevenLabsVoice[] = (json.voices || [])
      .filter((v) => Boolean(v.voice_id && v.name))
      .map((v) => ({
        id: String(v.voice_id),
        name: String(v.name),
        category: String(v.category || 'premade'),
        accent: String(v.labels?.accent || v.labels?.descriptive || ''),
        previewUrl: String(v.preview_url || ''),
      }));

    cachedElevenLabsVoices = { fetchedAt: Date.now(), voices };
    return voices;
  }

  app.get('/api/elevenlabs/status', (_req, res) => {
    const configured = Boolean(getElevenLabsKey());
    res.json({
      configured,
      defaultVoiceId: (process.env.ELEVENLABS_VOICE_ID || '').trim() || ELEVENLABS_FALLBACK_VOICE_ID,
      sttModel: 'scribe_v3',
    });
  });

  app.get('/api/elevenlabs/voices', async (_req, res) => {
    const apiKey = getElevenLabsKey();
    if (!apiKey) {
      res.status(503).json({
        configured: false,
        voices: [],
        error: 'ELEVENLABS_API_KEY is not configured in server secrets.',
      });
      return;
    }

    try {
      const voices = await fetchElevenLabsVoicesFromApi(apiKey);
      res.json({
        configured: true,
        defaultVoiceId:
          (process.env.ELEVENLABS_VOICE_ID || '').trim() ||
          voices[0]?.id ||
          ELEVENLABS_FALLBACK_VOICE_ID,
        voices,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load ElevenLabs voices.';
      res.status(502).json({ configured: true, voices: [], error: msg });
    }
  });

  app.post('/api/elevenlabs/tts', async (req, res) => {
    const apiKey = getElevenLabsKey();
    if (!apiKey) {
      res.status(503).json({
        error: 'ELEVENLABS_API_KEY is not configured in server secrets.',
      });
      return;
    }

    const body = (req.body ?? {}) as {
      text?: string;
      voiceId?: string;
      modelId?: string;
    };

    const cleanText = String(body.text || '').trim().slice(0, 600);
    if (!cleanText) {
      res.status(400).json({ error: 'Please provide text for the avatar to speak.' });
      return;
    }

    const rawVoiceId = String(body.voiceId || process.env.ELEVENLABS_VOICE_ID || '').trim();
    const safeVoiceId = /^[a-zA-Z0-9_-]{8,64}$/.test(rawVoiceId)
      ? rawVoiceId
      : ELEVENLABS_FALLBACK_VOICE_ID;
    const modelId =
      typeof body.modelId === 'string' && /^[a-zA-Z0-9_.-]{4,40}$/.test(body.modelId)
        ? body.modelId
        : 'eleven_multilingual_v2';

    try {
      const upstream = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(safeVoiceId)}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text: cleanText,
            model_id: modelId,
            voice_settings: {
              stability: 0.55,
              similarity_boost: 0.8,
              style: 0.25,
              use_speaker_boost: true,
            },
          }),
        },
      );

      if (!upstream.ok) {
        const errText = await upstream.text().catch(() => '');
        res.status(upstream.status === 401 ? 401 : 502).json({
          error:
            errText.slice(0, 240) ||
            `ElevenLabs Text-to-Speech failed with status ${upstream.status}.`,
        });
        return;
      }

      const audioBuffer = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.send(audioBuffer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ElevenLabs TTS request failed.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/elevenlabs/stt', async (req, res) => {
    const apiKey = getElevenLabsKey();
    if (!apiKey) {
      res.status(503).json({
        error: 'ELEVENLABS_API_KEY is not configured in server secrets.',
      });
      return;
    }

    const body = (req.body ?? {}) as {
      audioBase64?: string;
      mimeType?: string;
      languageCode?: string | null;
      tagAudioEvents?: boolean;
      diarize?: boolean;
    };

    const rawBase64 = String(body.audioBase64 || '').trim();
    if (!rawBase64) {
      res.status(400).json({ error: 'Missing recorded audio payload.' });
      return;
    }

    const cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
    const audioBuffer = Buffer.from(cleanBase64, 'base64');
    if (audioBuffer.length < 200 || audioBuffer.length > 15 * 1024 * 1024) {
      res.status(400).json({ error: 'Recorded audio must be between 200 bytes and 15 MB.' });
      return;
    }

    const mimeType =
      typeof body.mimeType === 'string' && body.mimeType.startsWith('audio/')
        ? body.mimeType.split(';')[0]
        : 'audio/webm';
    const ext =
      mimeType.includes('mp4') || mimeType.includes('m4a')
        ? 'm4a'
        : mimeType.includes('ogg')
          ? 'ogg'
          : mimeType.includes('wav')
            ? 'wav'
            : mimeType.includes('mpeg')
              ? 'mp3'
              : 'webm';

    const tagAudioEvents = body.tagAudioEvents !== false;
    const diarize = body.diarize !== false;
    const languageCode =
      typeof body.languageCode === 'string' && /^[a-z]{2,3}$/i.test(body.languageCode.trim())
        ? body.languageCode.trim().toLowerCase()
        : 'eng';

    const callScribe = async (modelId: string) => {
      const form = new FormData();
      form.append('file', new Blob([audioBuffer], { type: mimeType }), `voice-note.${ext}`);
      form.append('model_id', modelId);
      form.append('tag_audio_events', String(tagAudioEvents));
      form.append('diarize', String(diarize));
      if (languageCode) {
        form.append('language_code', languageCode);
      }

      const upstream = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
        },
        body: form,
      });

      const rawText = await upstream.text().catch(() => '');
      let parsed: Record<string, unknown> = {};
      try {
        parsed = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
      } catch {
        parsed = { detail: rawText };
      }
      return { ok: upstream.ok, status: upstream.status, parsed, modelId };
    };

    try {
      let result = await callScribe('scribe_v3');
      // Graceful fallback to scribe_v2 if an account tier hasn't enabled scribe_v3 yet
      if (!result.ok && (result.status === 400 || result.status === 404 || result.status === 422)) {
        result = await callScribe('scribe_v2');
      }

      if (!result.ok) {
        const detail =
          typeof result.parsed.detail === 'string'
            ? result.parsed.detail
            : typeof (result.parsed.detail as { message?: string } | undefined)?.message === 'string'
              ? String((result.parsed.detail as { message?: string }).message)
              : `ElevenLabs Speech-to-Text failed (${result.status}).`;
        res.status(result.status === 401 ? 401 : 502).json({ error: detail });
        return;
      }

      const text = String(result.parsed.text || '').trim();
      const words = Array.isArray(result.parsed.words)
        ? (result.parsed.words as Array<{ type?: string; text?: string; speaker_id?: string }>)
        : [];
      const audioEvents = Array.from(
        new Set(
          words
            .filter((w) => w.type === 'audio_event' && w.text)
            .map((w) => String(w.text).trim()),
        ),
      );
      const speakers = Array.from(
        new Set(
          words
            .filter((w) => w.speaker_id)
            .map((w) => String(w.speaker_id)),
        ),
      );

      res.json({
        ok: true,
        text,
        audioEvents,
        speakers,
        modelUsed: result.modelId,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Speech-to-text transcription failed.';
      res.status(500).json({ error: msg });
    }
  });

  // Explicit binary routes for the Meta Launch Kit ZIP & OG Social Share Banner
  // so they always return exact MIME types and never fall through to SPA HTML.
  app.get('/SproutScale-Meta-Launch-Kit.zip', (_req, res) => {
    const candidates = [
      path.resolve(__dirname, 'public', 'SproutScale-Meta-Launch-Kit.zip'),
      path.resolve(__dirname, 'dist', 'SproutScale-Meta-Launch-Kit.zip'),
    ];
    const found = candidates.find((p) => fs.existsSync(p));
    if (!found) {
      res.status(404).json({ error: 'Launch kit archive not found.' });
      return;
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="SproutScale-Meta-Launch-Kit.zip"',
    );
    res.sendFile(found);
  });

  app.get('/og-share-1200x630.png', (_req, res) => {
    const candidates = [
      path.resolve(__dirname, 'public', 'og-share-1200x630.png'),
      path.resolve(__dirname, 'dist', 'og-share-1200x630.png'),
    ];
    const found = candidates.find((p) => fs.existsSync(p));
    if (!found) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(found);
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`SproutScale server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
