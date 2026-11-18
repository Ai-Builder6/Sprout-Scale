import { ChildPhotoKind, clampNumber, SKIN_TONE_PRESETS } from '../types';

export interface PortraitCropParams {
  zoom: number; // 1.0 to 2.8
  offsetX: number; // -100 to 100 (% shift)
  offsetY: number; // -100 to 100 (% shift)
}

export interface ProcessedAvatarResult {
  croppedDataUrl: string;
  sampledSkinHex: string;
}

export interface SavedLocalPhotoRecord {
  id: string;
  childId: string;
  kind: ChildPhotoKind;
  dataUrl: string;
  capturedDate: string;
  ageMonths: number;
  heightCm: number;
  weightKg: number;
  caption: string;
  driveFileId: string;
  createdAtMs: number;
}

const DB_NAME = 'sproutscale_avatar_cache_v1';
const DB_VERSION = 2;
const STORE_NAME = 'child_portraits';
const PHOTOS_STORE_NAME = 'saved_photos';

function openAvatarCacheDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains(PHOTOS_STORE_NAME)) {
          const photosStore = db.createObjectStore(PHOTOS_STORE_NAME, { keyPath: 'id' });
          photosStore.createIndex('by_childId', 'childId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveLocalAvatarDataUrl(
  childId: string,
  dataUrl: string,
): Promise<void> {
  const db = await openAvatarCacheDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(dataUrl, childId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function getLocalAvatarDataUrl(childId: string): Promise<string | null> {
  const db = await openAvatarCacheDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(childId);
      req.onsuccess = () => {
        db.close();
        resolve(typeof req.result === 'string' ? req.result : null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function removeLocalAvatarDataUrl(childId: string): Promise<void> {
  const db = await openAvatarCacheDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(childId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

/**
 * Compresses any captured or uploaded photo into a crisp storage-ready JPEG (max 1200px)
 * so every picture taken saves cleanly into IndexedDB and Google Drive.
 */
export function compressPhotoToStorageJpeg(
  sourceDataUrl: string,
  maxDim = 1200,
  quality = 0.85,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || img.width;
        const naturalH = img.naturalHeight || img.height;
        if (!naturalW || !naturalH) {
          resolve(sourceDataUrl);
          return;
        }
        const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
        const outW = Math.max(1, Math.round(naturalW * scale));
        const outH = Math.max(1, Math.round(naturalH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(sourceDataUrl);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(img, 0, 0, outW, outH);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(sourceDataUrl);
      }
    };
    img.onerror = () => resolve(sourceDataUrl);
    img.src = sourceDataUrl;
  });
}

export async function savePhotoToLocalAlbum(record: SavedLocalPhotoRecord): Promise<void> {
  const db = await openAvatarCacheDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PHOTOS_STORE_NAME, 'readwrite');
      tx.objectStore(PHOTOS_STORE_NAME).put(record);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function listLocalPhotosForChild(
  childId: string,
): Promise<SavedLocalPhotoRecord[]> {
  const db = await openAvatarCacheDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PHOTOS_STORE_NAME, 'readonly');
      const store = tx.objectStore(PHOTOS_STORE_NAME);
      const index = store.index('by_childId');
      const req = index.getAll(IDBKeyRange.only(childId));
      req.onsuccess = () => {
        db.close();
        const items = Array.isArray(req.result)
          ? (req.result as SavedLocalPhotoRecord[])
          : [];
        items.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
        resolve(items);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    } catch {
      db.close();
      resolve([]);
    }
  });
}

export async function updateLocalPhotoRecord(
  photoId: string,
  patch: Partial<
    Pick<
      SavedLocalPhotoRecord,
      'driveFileId' | 'caption' | 'heightCm' | 'weightKg' | 'ageMonths'
    >
  >,
): Promise<void> {
  const db = await openAvatarCacheDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PHOTOS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PHOTOS_STORE_NAME);
      const getReq = store.get(photoId);
      getReq.onsuccess = () => {
        const existing = getReq.result as SavedLocalPhotoRecord | undefined;
        if (existing) {
          store.put({ ...existing, ...patch });
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function deleteLocalPhoto(photoId: string): Promise<void> {
  const db = await openAvatarCacheDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PHOTOS_STORE_NAME, 'readwrite');
      tx.objectStore(PHOTOS_STORE_NAME).delete(photoId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function deleteAllLocalPhotosForChild(childId: string): Promise<void> {
  const existing = await listLocalPhotosForChild(childId);
  if (existing.length === 0) return;
  const db = await openAvatarCacheDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PHOTOS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PHOTOS_STORE_NAME);
      for (const item of existing) {
        store.delete(item.id);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  const toByte = (v: number) =>
    clampNumber(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16) || 240,
    g: parseInt(clean.slice(2, 4), 16) || 200,
    b: parseInt(clean.slice(4, 6), 16) || 168,
  };
}

/**
 * Samples the center cheek/forehead region of the cropped portrait and blends toward the closest
 * warm natural complexion preset so shadows or bright backgrounds never produce unnatural hues.
 */
function estimateSkinToneHex(ctx: CanvasRenderingContext2D, size: number): string {
  try {
    const sampleBox = Math.floor(size * 0.34);
    const startX = Math.floor((size - sampleBox) / 2);
    const startY = Math.floor(size * 0.34);
    const { data } = ctx.getImageData(startX, startY, sampleBox, sampleBox);

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      // Filter out near-black hair/pupils, pure white highlights, and non-warm background pixels
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (a > 200 && luma > 42 && luma < 244 && r >= b * 0.95) {
        rSum += r;
        gSum += g;
        bSum += b;
        count += 1;
      }
    }

    if (count < 12) {
      return SKIN_TONE_PRESETS[1].hex;
    }

    const avgR = rSum / count;
    const avgG = gSum / count;
    const avgB = bSum / count;

    // Find closest natural skin tone preset and blend 60% preset + 40% sampled for realistic warmth
    let closestPreset = SKIN_TONE_PRESETS[1].hex;
    let bestDist = Infinity;
    for (const preset of SKIN_TONE_PRESETS) {
      const pr = hexToRgb(preset.hex);
      const dist =
        (pr.r - avgR) * (pr.r - avgR) +
        (pr.g - avgG) * (pr.g - avgG) +
        (pr.b - avgB) * (pr.b - avgB);
      if (dist < bestDist) {
        bestDist = dist;
        closestPreset = preset.hex;
      }
    }

    const base = hexToRgb(closestPreset);
    return rgbToHex(
      base.r * 0.55 + avgR * 0.45,
      base.g * 0.55 + avgG * 0.45,
      base.b * 0.55 + avgB * 0.45,
    );
  } catch {
    return SKIN_TONE_PRESETS[1].hex;
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read selected image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Crops and scales an image URL into a high-clarity 320x320 square portrait JPEG
 * ready for realistic head framing on the growing SVG character and Google Drive storage.
 */
export function cropPortraitToDataUrl(
  sourceDataUrl: string,
  crop: PortraitCropParams,
): Promise<ProcessedAvatarResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const targetSize = 320;
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable.'));
        return;
      }

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, targetSize, targetSize);

      const minDim = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
      const safeZoom = clampNumber(crop.zoom, 1, 3);
      const cropSpan = minDim / safeZoom;

      const maxPanX = Math.max(0, (img.naturalWidth - cropSpan) / 2 + cropSpan * 0.28);
      const maxPanY = Math.max(0, (img.naturalHeight - cropSpan) / 2 + cropSpan * 0.28);

      const centerX =
        img.naturalWidth / 2 - (clampNumber(crop.offsetX, -100, 100) / 100) * maxPanX;
      const centerY =
        img.naturalHeight / 2 - (clampNumber(crop.offsetY, -100, 100) / 100) * maxPanY;

      const sx = centerX - cropSpan / 2;
      const sy = centerY - cropSpan / 2;

      ctx.drawImage(img, sx, sy, cropSpan, cropSpan, 0, 0, targetSize, targetSize);

      const sampledSkinHex = estimateSkinToneHex(ctx, targetSize);
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
      resolve({ croppedDataUrl, sampledSkinHex });
    };
    img.onerror = () => reject(new Error('Could not load image for portrait framing.'));
    img.src = sourceDataUrl;
  });
}
