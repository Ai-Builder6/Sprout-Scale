import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

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
