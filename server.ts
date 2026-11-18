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

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.post('/api/estimate-wall-height', async (req, res) => {
    try {
      const { imageDataUrl, ageMonths, childName } = req.body as {
        imageDataUrl?: string;
        ageMonths?: number;
        childName?: string;
      };

      if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
        res.status(400).json({
          error: 'Please provide a valid wall photo (JPEG, PNG, or WebP) showing your child standing against a wall.',
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

      const ai = getGenAIClient();

      const ageHint =
        typeof ageMonths === 'number' && ageMonths > 0
          ? `Optional context: ${childName || 'The child'} is approximately ${Math.floor(ageMonths / 12)} years and ${ageMonths % 12} months old (${ageMonths} months), though prioritize visual scale cues in the photo first.`
          : 'No age hint provided; rely on visual scale cues and body proportions.';

      const promptText = [
        'Analyze this photo to guesstimate how tall the standing person/child is in INCHES.',
        ageHint,
        'Instructions:',
        '1. Check if the full standing body from the crown of the head to the heels/feet on the floor is visible (`fullBodyVisible`).',
        '2. Look carefully for real-world scale reference objects on or near the wall:',
        '   - Standard interior door height (~80 inches)',
        '   - Standard doorknob center from floor (~36 inches)',
        '   - Standard wall light switch center from floor (~48 inches)',
        '   - Standard electrical wall outlet center from floor (~14 inches)',
        '   - Standard US letter/printer paper sheet (~11.0 inches tall or 8.5 inches wide) taped to the wall',
        '   - 12-inch ruler (~12.0 inches), US dollar bill (~6.14 inches), standard chair seat (~18 inches), or baseboard trim (~4.5 inches).',
        '3. Estimate normalized vertical image coordinates from 0.0 (top edge of image) to 1.0 (bottom edge of image):',
        '   - `childCrownRatioY`: top of the child/person’s head (not hair bow/hat)',
        '   - `childHeelRatioY`: bottom of their heels/feet where they touch the floor',
        '   - `refTopRatioY` and `refBottomRatioY`: top and bottom of the best reference object (or floor-to-switch / floor-to-doorknob span) if one is visible; otherwise return 0.25 and 0.85.',
        '4. Compute `estimatedInches` (standing height in inches, e.g. 44.5) and `marginInches` (expected +/- error in inches: ~1.0 to 2.0 inches when a clear reference object and full body are visible, ~3.0 to 4.5 inches if estimating from bare wall / proportions alone).',
        '5. Set `confidence` to "high", "medium", or "low", and write a friendly 1-2 sentence `explanation` telling the parent how you guesstimated the inches and any tip to make it more exact.',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: promptText,
            },
          ],
        },
        config: {
          systemInstruction:
            'You are a careful pediatric photogrammetry assistant helping parents guesstimate a child’s standing height in inches from a wall photo. Always be honest about margin of error and return clean JSON matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fullBodyVisible: {
                type: Type.BOOLEAN,
                description: 'True if both the top of the head and feet/floor are visible in the frame.',
              },
              estimatedInches: {
                type: Type.NUMBER,
                description: 'Best guesstimated standing height in inches.',
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
                description: 'Short label of the wall reference cue used (e.g. "Wall light switch (~48 in)" or "Body proportions only (bare wall)").',
              },
              detectedReferenceInches: {
                type: Type.NUMBER,
                description: 'Known height in inches of the detected reference span, or 0 if no wall reference object was found.',
              },
              childCrownRatioY: {
                type: Type.NUMBER,
                description: 'Normalized Y coordinate (0.0 top to 1.0 bottom) of the crown of the child’s head.',
              },
              childHeelRatioY: {
                type: Type.NUMBER,
                description: 'Normalized Y coordinate (0.0 top to 1.0 bottom) of the bottom of the child’s heels on the floor.',
              },
              refTopRatioY: {
                type: Type.NUMBER,
                description: 'Normalized Y coordinate (0.0 top to 1.0 bottom) of the top of the reference object/span.',
              },
              refBottomRatioY: {
                type: Type.NUMBER,
                description: 'Normalized Y coordinate (0.0 top to 1.0 bottom) of the bottom of the reference object/span.',
              },
              explanation: {
                type: Type.STRING,
                description: '1-2 concise sentences explaining how the height in inches was estimated.',
              },
            },
            required: [
              'fullBodyVisible',
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
      const safeMarginInches = Number(clamp(Number(parsed.marginInches ?? 2.5), 0.5, 8).toFixed(1));
      const rawConf = String(parsed.confidence ?? 'medium').toLowerCase();
      const safeConfidence: 'high' | 'medium' | 'low' =
        rawConf === 'high' || rawConf === 'low' ? rawConf : 'medium';

      const crownY = clamp(Number(parsed.childCrownRatioY ?? 0.18), 0.02, 0.9);
      const heelY = clamp(Number(parsed.childHeelRatioY ?? 0.92), Math.min(0.98, crownY + 0.1), 0.99);
      const refTopY = clamp(Number(parsed.refTopRatioY ?? 0.35), 0.02, 0.92);
      const refBotY = clamp(Number(parsed.refBottomRatioY ?? 0.92), Math.min(0.98, refTopY + 0.05), 0.99);

      res.json({
        fullBodyVisible: Boolean(parsed.fullBodyVisible ?? true),
        estimatedInches: safeEstimatedInches,
        estimatedCm: Number((safeEstimatedInches * 2.54).toFixed(1)),
        marginInches: safeMarginInches,
        confidence: safeConfidence,
        detectedReferenceLabel: String(
          parsed.detectedReferenceLabel || 'Visual wall & body proportions',
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
            'Estimated standing height from visible wall cues and head-to-heel proportions.',
        ).slice(0, 360),
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
