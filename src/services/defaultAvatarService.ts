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

const processedUrlCache = new Map<string, ProcessedDefaultAvatar>();
const inflightUrlPromises = new Map<string, Promise<ProcessedDefaultAvatar | null>>();

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function processAvatarImageUrl(imageUrl: string): Promise<ProcessedDefaultAvatar | null> {
  const existing = processedUrlCache.get(imageUrl);
  if (existing) {
    return Promise.resolve(existing);
  }
  const inflight = inflightUrlPromises.get(imageUrl);
  if (inflight) {
    return inflight;
  }

  const promise = new Promise<ProcessedDefaultAvatar | null>((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const targetH = 1024;
        const scale = Math.min(1, targetH / Math.max(1, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));

        const workCanvas = document.createElement('canvas');
        workCanvas.width = w;
        workCanvas.height = h;
        const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
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
          const alpha = data[p + 3];
          if (alpha < 20) return true;
          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const chroma = maxC - minC;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
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

        for (let i = 0; i < totalPx; i++) {
          if (bgMask[i]) {
            data[i * 4 + 3] = 0;
          }
        }

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
              if (t > 0.08 && t < 0.95) {
                data[p] = clamp(Math.round((r - 252 * (1 - t)) / t), 0, 255);
                data[p + 1] = clamp(Math.round((g - 251 * (1 - t)) / t), 0, 255);
                data[p + 2] = clamp(Math.round((b - 247 * (1 - t)) / t), 0, 255);
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);

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
          resolve(null);
          return;
        }

        const cropX = Math.max(0, minX - 2);
        const cropY = minY;
        const cropW = Math.min(w - cropX, maxX - minX + 5);
        const cropH = Math.max(1, maxY - minY + 1);

        const bodyCanvas = document.createElement('canvas');
        bodyCanvas.width = cropW;
        bodyCanvas.height = cropH;
        const bodyCtx = bodyCanvas.getContext('2d');
        if (!bodyCtx) {
          resolve(null);
          return;
        }
        bodyCtx.drawImage(workCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const fullBodyUrl = bodyCanvas.toDataURL('image/png');

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

        const result: ProcessedDefaultAvatar = {
          fullBodyUrl,
          portraitUrl,
          aspectRatio: cropW / cropH,
          isReady: true,
        };
        processedUrlCache.set(imageUrl, result);
        resolve(result);
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      resolve(null);
    };

    img.src = imageUrl;
  });

  inflightUrlPromises.set(imageUrl, promise);
  return promise;
}

export function getAgeAvatarCandidateUrl(ageMonths: number): string {
  const ageYears = clamp(Math.floor(ageMonths / 12), 2, 18);
  return `/avatars/avatar_age_${String(ageYears).padStart(2, '0')}.png`;
}

/**
 * Loads the app's illustrated boy avatar once, removes exterior paper background,
 * crops tightly from top of hair to bottom of feet, and caches portrait + full body.
 */
export async function loadProcessedDefaultAvatar(): Promise<ProcessedDefaultAvatar> {
  const res = await processAvatarImageUrl(DEFAULT_APP_AVATAR_URL);
  return res ?? FALLBACK_RESULT;
}

/**
 * React hook returning the transparent full-body avatar + cropped face portrait
 * derived from the user's app avatar artwork.
 */
export function useDefaultAppAvatar(): ProcessedDefaultAvatar {
  const [avatar, setAvatar] = useState<ProcessedDefaultAvatar>(
    () => processedUrlCache.get(DEFAULT_APP_AVATAR_URL) ?? FALLBACK_RESULT,
  );

  useEffect(() => {
    let active = true;
    const cached = processedUrlCache.get(DEFAULT_APP_AVATAR_URL);
    if (cached) {
      setAvatar(cached);
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

/**
 * Checks if an age-specific avatar file exists at `/avatars/avatar_age_XX.png`
 * (for ages 02–18). If present, returns that age's transparently cropped character;
 * otherwise seamlessly returns the default illustrated SproutScale boy avatar.
 */
export function useAgeAwareAppAvatar(ageMonths: number): ProcessedDefaultAvatar {
  const defaultAvatar = useDefaultAppAvatar();
  const candidateUrl = getAgeAvatarCandidateUrl(ageMonths);
  const [ageAvatar, setAgeAvatar] = useState<ProcessedDefaultAvatar | null>(
    () => processedUrlCache.get(candidateUrl) ?? null,
  );

  useEffect(() => {
    let active = true;
    const cached = processedUrlCache.get(candidateUrl);
    if (cached) {
      setAgeAvatar(cached);
      return;
    }

    // Check quietly with HEAD first so missing optional age files don't spam image decode errors
    fetch(candidateUrl, { method: 'HEAD' })
      .then((res) => {
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.startsWith('image/')) {
          if (active) setAgeAvatar(null);
          return;
        }
        return processAvatarImageUrl(candidateUrl).then((processed) => {
          if (active) setAgeAvatar(processed);
        });
      })
      .catch(() => {
        if (active) setAgeAvatar(null);
      });

    return () => {
      active = false;
    };
  }, [candidateUrl]);

  return ageAvatar ?? defaultAvatar;
}

