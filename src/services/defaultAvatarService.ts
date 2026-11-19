import { useEffect, useState } from 'react';

export const DEFAULT_APP_AVATAR_URL =
  '/assets/aistudio/ElevenLabs_image_gpt-image-2-5-sunburst_Full-body_chara_2026-11-19T19_12_44_dd256237.png';

export interface ProcessedDefaultAvatar {
  /** Tightly cropped, transparent-background full-body character PNG data URL */
  fullBodyUrl: string;
  /** Square portrait PNG data URL framed tightly on the smiling face & hair */
  portraitUrl: string;
  /** Exact width / height ratio of the tightly cropped full-body character */
  aspectRatio: number;
  /** True once canvas background removal & tight cropping finished */
  isReady: boolean;
}

const FALLBACK_RESULT: ProcessedDefaultAvatar = {
  fullBodyUrl: DEFAULT_APP_AVATAR_URL,
  portraitUrl: DEFAULT_APP_AVATAR_URL,
  aspectRatio: 0.52,
  isReady: false,
};

let cachedResult: ProcessedDefaultAvatar | null = null;
let inflightPromise: Promise<ProcessedDefaultAvatar> | null = null;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Loads the app's illustrated boy avatar once, removes only the exterior off-white
 * paper background using a border-seeded flood fill (preserving pure white inside
 * eyes and the shirt sprout emblem), feathers edge pixels to eliminate white halos,
 * crops tightly from top of hair to bottom of bare feet for millimeter-accurate
 * growth-wall ruler alignment, and generates a matching face portrait thumbnail.
 */
export function loadProcessedDefaultAvatar(): Promise<ProcessedDefaultAvatar> {
  if (cachedResult) {
    return Promise.resolve(cachedResult);
  }
  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = new Promise<ProcessedDefaultAvatar>((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve(FALLBACK_RESULT);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Work at crisp high resolution while keeping processing ultra-fast (~15ms)
        const targetH = 1024;
        const scale = Math.min(1, targetH / Math.max(1, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));

        const workCanvas = document.createElement('canvas');
        workCanvas.width = w;
        workCanvas.height = h;
        const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(FALLBACK_RESULT);
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        const totalPx = w * h;
        const visited = new Uint8Array(totalPx);
        const bgMask = new Uint8Array(totalPx);
        const queue = new Int32Array(totalPx);
        let head = 0;
        let tail = 0;

        const isExteriorPaperPixel = (idx: number): boolean => {
          const p = idx * 4;
          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const chroma = maxC - minC;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          // Matches off-white textured paper + subtle neutral floor shadow under feet,
          // while stopping cleanly at warm-brown outlines, peach skin, blue shirt & khaki shorts.
          return lum >= 220 && chroma <= 24;
        };

        const enqueueIfPaper = (x: number, y: number) => {
          const idx = y * w + x;
          if (visited[idx]) return;
          visited[idx] = 1;
          if (isExteriorPaperPixel(idx)) {
            bgMask[idx] = 1;
            queue[tail++] = idx;
          }
        };

        // Seed flood fill from all four outer borders
        for (let x = 0; x < w; x++) {
          enqueueIfPaper(x, 0);
          enqueueIfPaper(x, h - 1);
        }
        for (let y = 0; y < h; y++) {
          enqueueIfPaper(0, y);
          enqueueIfPaper(w - 1, y);
        }

        while (head < tail) {
          const curr = queue[head++];
          const cx = curr % w;
          const cy = (curr - cx) / w;

          if (cx > 0) enqueueIfPaper(cx - 1, cy);
          if (cx + 1 < w) enqueueIfPaper(cx + 1, cy);
          if (cy > 0) enqueueIfPaper(cx, cy - 1);
          if (cy + 1 < h) enqueueIfPaper(cx, cy + 1);
        }

        // Clear confirmed exterior background pixels
        for (let i = 0; i < totalPx; i++) {
          if (bgMask[i]) {
            data[i * 4 + 3] = 0;
          }
        }

        // Soft anti-alias de-fringing on foreground pixels touching the removed background
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            if (bgMask[idx]) continue;

            const touchesBg =
              bgMask[idx - 1] ||
              bgMask[idx + 1] ||
              bgMask[idx - w] ||
              bgMask[idx + w] ||
              bgMask[idx - w - 1] ||
              bgMask[idx - w + 1] ||
              bgMask[idx + w - 1] ||
              bgMask[idx + w + 1];

            if (!touchesBg) continue;

            const p = idx * 4;
            const r = data[p];
            const g = data[p + 1];
            const b = data[p + 2];
            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);
            const chroma = maxC - minC;
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            if (lum > 198 && chroma < 34) {
              const t = clamp((242 - lum) / 44, 0, 1);
              data[p + 3] = Math.round(t * 255);
              // Gentle un-premultiply toward darker outline color to eliminate white halo
              if (t > 0.08 && t < 0.95) {
                data[p] = clamp(Math.round((r - 252 * (1 - t)) / t), 0, 255);
                data[p + 1] = clamp(Math.round((g - 251 * (1 - t)) / t), 0, 255);
                data[p + 2] = clamp(Math.round((b - 247 * (1 - t)) / t), 0, 255);
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);

        // Compute tight bounding box of the visible character so top of hair = crownY
        // and bottom of feet = floorY on the growth wall ruler!
        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const alpha = data[(y * w + x) * 4 + 3];
            if (alpha >= 48) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX <= minX || maxY <= minY) {
          resolve(FALLBACK_RESULT);
          return;
        }

        // Pad 2px horizontally so strokes aren't clipped, 0px vertically so height alignment is exact
        const cropX = Math.max(0, minX - 2);
        const cropY = minY;
        const cropW = Math.min(w - cropX, maxX - minX + 5);
        const cropH = Math.max(1, maxY - minY + 1);

        const bodyCanvas = document.createElement('canvas');
        bodyCanvas.width = cropW;
        bodyCanvas.height = cropH;
        const bodyCtx = bodyCanvas.getContext('2d');
        if (!bodyCtx) {
          resolve(FALLBACK_RESULT);
          return;
        }
        bodyCtx.drawImage(workCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const fullBodyUrl = bodyCanvas.toDataURL('image/png');

        // Generate a joyful 256x256 square face portrait framed cleanly around head & collar
        const portraitSize = 256;
        const portraitCanvas = document.createElement('canvas');
        portraitCanvas.width = portraitSize;
        portraitCanvas.height = portraitSize;
        const pCtx = portraitCanvas.getContext('2d');

        let portraitUrl = fullBodyUrl;
        if (pCtx) {
          const grad = pCtx.createLinearGradient(0, 0, 0, portraitSize);
          grad.addColorStop(0, '#e0f2fe');
          grad.addColorStop(1, '#fef9c3');
          pCtx.fillStyle = grad;
          pCtx.fillRect(0, 0, portraitSize, portraitSize);

          // The head & upper shoulders occupy the top ~40% of the tightly cropped full body
          const headCropSide = Math.round(cropH * 0.42);
          const headSrcX = Math.round(cropW / 2 - headCropSide / 2);
          const headSrcY = Math.round(-cropH * 0.015);
          pCtx.drawImage(
            bodyCanvas,
            headSrcX,
            headSrcY,
            headCropSide,
            headCropSide,
            0,
            0,
            portraitSize,
            portraitSize,
          );
          portraitUrl = portraitCanvas.toDataURL('image/png');
        }

        cachedResult = {
          fullBodyUrl,
          portraitUrl,
          aspectRatio: cropW / cropH,
          isReady: true,
        };
        resolve(cachedResult);
      } catch {
        resolve(FALLBACK_RESULT);
      }
    };

    img.onerror = () => {
      resolve(FALLBACK_RESULT);
    };

    img.src = DEFAULT_APP_AVATAR_URL;
  });

  return inflightPromise;
}

/**
 * React hook returning the transparent full-body avatar + cropped face portrait
 * derived from the user's app avatar artwork.
 */
export function useDefaultAppAvatar(): ProcessedDefaultAvatar {
  const [avatar, setAvatar] = useState<ProcessedDefaultAvatar>(
    () => cachedResult ?? FALLBACK_RESULT,
  );

  useEffect(() => {
    let active = true;
    if (cachedResult) {
      setAvatar(cachedResult);
      return;
    }
    void loadProcessedDefaultAvatar().then((res) => {
      if (active) {
        setAvatar(res);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return avatar;
}
