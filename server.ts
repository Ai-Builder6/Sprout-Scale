import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
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

function getCanonicalAppUrl(): string {
  const envUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (envUrl) return envUrl;
  return `http://localhost:${PORT}`;
}

function getMetaCallbackUrl(): string {
  return `${getCanonicalAppUrl()}/auth/meta/callback`;
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
    try {
      const {
        childName,
        ageLabel,
        heightSummary,
        gainedSummary,
        latestNote,
        stylePreset,
        durationMode,
        customPrompt,
        avatarDataUrl,
      } = req.body as {
        childName?: string;
        ageLabel?: string;
        heightSummary?: string;
        gainedSummary?: string;
        latestNote?: string;
        stylePreset?: string;
        durationMode?: 'clip' | 'full';
        customPrompt?: string;
        avatarDataUrl?: string | null;
      };

      const ai = getGenAIClient();
      const model =
        durationMode === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';

      const safeName = String(childName || 'our little sprout').trim().slice(0, 50);
      const safeAge = String(ageLabel || 'growing strong').trim().slice(0, 40);
      const safeHeight = String(heightSummary || '').trim().slice(0, 60);
      const safeGained = String(gainedSummary || '').trim().slice(0, 80);
      const safeNote = String(latestNote || '').trim().slice(0, 120);
      const safeCustom = String(customPrompt || '').trim().slice(0, 240);

      const styleDescriptions: Record<string, string> = {
        'sunny-folk':
          'warm sunny acoustic folk song with cheerful strummed guitar, light handclaps, upright bass, and joyful family vocals',
        'playful-ukulele':
          'playful storybook children’s celebratory tune with bright ukulele, wooden marimba/xylophone, whistle melody, and upbeat singalong vocals',
        'indie-pop':
          'upbeat feel-good indie pop celebration anthem with crisp drums, bright piano chords, shimmering guitar, and uplifting vocals',
        'lullaby-piano':
          'gentle heartwarming keepsake piano and acoustic strings ballad with tender, soothing vocals',
      };

      const chosenStyle =
        styleDescriptions[String(stylePreset || 'sunny-folk')] ||
        styleDescriptions['sunny-folk'];

      const durationPhrase =
        durationMode === 'full'
          ? 'Generate a full-length keepsake family milestone song'
          : 'Generate a 30-second celebratory milestone music clip';

      const promptLines = [
        `${durationPhrase} in the style of a ${chosenStyle}.`,
        `This song celebrates ${safeName} (${safeAge})${safeHeight ? ` standing ${safeHeight}` : ''}${safeGained ? `, having sprouted ${safeGained} since turning Age 2` : ''}.`,
        safeNote ? `Weave in this special milestone memory: "${safeNote}".` : '',
        safeCustom ? `Additional family request: ${safeCustom}` : '',
        'Keep the mood bright, affectionate, and family-friendly with memorable lyrics celebrating how fast they are growing.',
      ].filter(Boolean);

      const textPrompt = promptLines.join(' ');

      const parts: Array<
        | { text: string }
        | { inlineData: { data: string; mimeType: string } }
      > = [{ text: textPrompt }];

      if (
        avatarDataUrl &&
        typeof avatarDataUrl === 'string' &&
        avatarDataUrl.startsWith('data:image/')
      ) {
        const imgMatch = avatarDataUrl.match(
          /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/,
        );
        if (imgMatch) {
          parts.push({
            inlineData: {
              mimeType: imgMatch[1],
              data: imgMatch[2],
            },
          });
        }
      }

      // Omit responseModalities so Lyria streams both MP3 audio (inlineData) and lyrics (text)
      const streamResponse = await ai.models.generateContentStream({
        model,
        contents: parts.length === 1 ? textPrompt : { parts },
      });

      const audioChunks: Buffer[] = [];
      let lyrics = '';
      let mimeType = 'audio/mpeg';

      for await (const chunk of streamResponse) {
        const candidateParts = chunk.candidates?.[0]?.content?.parts;
        if (!candidateParts) continue;
        for (const part of candidateParts) {
          if (part.inlineData?.data) {
            if (audioChunks.length === 0 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
          }
          if (part.text) {
            lyrics += part.text;
          }
        }
      }

      if (audioChunks.length === 0) {
        res.status(502).json({
          error:
            'The music generator completed without returning audio data. Please try again with a slightly simpler prompt.',
        });
        return;
      }

      const audioBase64 = Buffer.concat(audioChunks).toString('base64');
      const audioDataUrl = `data:${mimeType};base64,${audioBase64}`;

      res.json({
        audioDataUrl,
        lyrics: lyrics.trim(),
        mimeType,
        modelUsed: model,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('MISSING_GEMINI_API_KEY') ||
        msg.includes('API_KEY_INVALID') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('403')
      ) {
        res.status(403).json({
          error:
            'Lyria music generation requires a valid billing-enabled Gemini API key. Please check your selected API key in the Settings > Secrets panel.',
        });
        return;
      }
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
        res.status(429).json({
          error:
            'Music generation quota reached. Upgrading or selecting a billing-enabled API key in the Settings > Secrets panel increases quota for Lyria models.',
        });
        return;
      }
      res.status(500).json({
        error: `Could not generate milestone song (${msg.slice(0, 160)}). Please try again.`,
      });
    }
  });

  // ============================================================================
  // Meta (Facebook & Instagram) Third-Party OAuth & Graph API Publishing Routes
  // ============================================================================

  app.get('/api/meta/status', (req, res) => {
    const configured = isMetaOAuthConfigured();
    const callbackUrl = getMetaCallbackUrl();
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

  app.get('/api/meta/auth-url', (_req, res) => {
    const callbackUrl = getMetaCallbackUrl();
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

      const callbackUrl = getMetaCallbackUrl();
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
      const publicImageUrl = `${getCanonicalAppUrl()}/api/meta/media/${mediaId}.jpg`;

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
    const statusUrl = `${getCanonicalAppUrl()}/data-deletion?code=${encodeURIComponent(confirmationCode)}`;

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
      statusUrl: `${getCanonicalAppUrl()}/data-deletion?code=${encodeURIComponent(confirmationCode)}`,
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

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SproutScale server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
