import {
  BiologicalSex,
  ChildPhotoKind,
  ChildProfile,
  formatAgeLabel,
  formatFeetInches,
  formatHeightDelta,
  formatMetricHeight,
  formatMetricWeight,
  formatPounds,
  formatTotalInches,
  formatWeightDelta,
  GrowthMeasurement,
  UnitSystem,
} from '../types';

export interface DriveFileSummary {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
}

export interface PickedDriveItem {
  id: string;
  name: string;
  mimeType: string;
  url?: string;
  lastEditedUtc?: number;
}

export interface GrowthBackupPayload {
  app: 'SproutScale';
  exportedAt: string;
  child: {
    name: string;
    birthDate?: string;
    sex?: BiologicalSex;
    ageTwoHeightCm: number;
    ageTwoWeightKg: number;
    paletteId: string;
    accessoryId: string;
    hairStyle: string;
    skinTone?: string;
    hairColor?: string;
  };
  measurements: {
    ageMonths: number;
    heightCm: number;
    weightKg: number;
    recordedDate: string;
    note: string;
  }[];
}

// Minimal TypeScript declarations for Google Picker global script
interface GooglePickerDocument {
  id: string;
  name: string;
  mimeType: string;
  url?: string;
  lastEditedUtc?: number;
}

interface GooglePickerCallbackData {
  action: string;
  docs?: GooglePickerDocument[];
}

interface GooglePickerBuilderInstance {
  addView: (view: unknown) => GooglePickerBuilderInstance;
  setOAuthToken: (token: string) => GooglePickerBuilderInstance;
  setCallback: (cb: (data: GooglePickerCallbackData) => void) => GooglePickerBuilderInstance;
  setOrigin: (origin: string) => GooglePickerBuilderInstance;
  setTitle: (title: string) => GooglePickerBuilderInstance;
  build: () => { setVisible: (visible: boolean) => void };
}

interface WindowWithGooglePicker extends Window {
  gapi?: {
    load: (apiName: string, callback: () => void) => void;
  };
  google?: {
    picker?: {
      PickerBuilder: new () => GooglePickerBuilderInstance;
      DocsUploadView: new () => unknown;
      ViewId: {
        DOCS: unknown;
        DOCS_IMAGES: unknown;
      };
      Action: {
        PICKED: string;
        CANCEL: string;
      };
    };
  };
}

let pickerReadyPromise: Promise<void> | null = null;

function ensurePickerLoaded(): Promise<void> {
  if (pickerReadyPromise) {
    return pickerReadyPromise;
  }

  pickerReadyPromise = new Promise<void>((resolve, reject) => {
    const win = window as unknown as WindowWithGooglePicker;

    const loadViaGapi = () => {
      if (win.google?.picker) {
        resolve();
        return;
      }
      if (win.gapi?.load) {
        win.gapi.load('picker', () => {
          resolve();
        });
        return;
      }
      reject(new Error('Google Picker script is not yet loaded. Please try again in a moment.'));
    };

    if (win.gapi?.load || win.google?.picker) {
      loadViaGapi();
      return;
    }

    const existing = document.querySelector('script[src="https://apis.google.com/js/api.js"]');
    if (existing) {
      existing.addEventListener('load', loadViaGapi, { once: true });
      existing.addEventListener(
        'error',
        () => {
          pickerReadyPromise = null;
          reject(new Error('Failed to load Google Picker script.'));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = loadViaGapi;
    script.onerror = () => {
      pickerReadyPromise = null;
      reject(new Error('Failed to load Google Picker script.'));
    };
    document.head.appendChild(script);
  });

  return pickerReadyPromise;
}

/**
 * Opens the client-side Google Picker widget using the exact ancestorOrigins pattern.
 */
export async function openGoogleDrivePicker(
  accessToken: string,
  options?: {
    includeUploadView?: boolean;
    title?: string;
    viewMode?: 'docs' | 'images';
  },
): Promise<PickedDriveItem | null> {
  await ensurePickerLoaded();

  const win = window as unknown as WindowWithGooglePicker;
  const pickerApi = win.google?.picker;
  if (!pickerApi) {
    throw new Error('Google Picker API unavailable.');
  }

  const pickerOrigin =
    window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
      ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
      : window.location.origin;

  return new Promise<PickedDriveItem | null>((resolve) => {
    const pickerCallback = (data: GooglePickerCallbackData) => {
      if (data.action === pickerApi.Action.PICKED && data.docs && data.docs.length > 0) {
        const file = data.docs[0];
        resolve({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          url: file.url,
          lastEditedUtc: file.lastEditedUtc,
        });
      } else if (data.action === pickerApi.Action.CANCEL) {
        resolve(null);
      }
    };

    const primaryView =
      options?.viewMode === 'images' ? pickerApi.ViewId.DOCS_IMAGES : pickerApi.ViewId.DOCS;

    let builder = new pickerApi.PickerBuilder()
      .addView(primaryView)
      .setOAuthToken(accessToken)
      .setCallback(pickerCallback)
      .setOrigin(pickerOrigin);

    if (options?.includeUploadView) {
      builder = builder.addView(new pickerApi.DocsUploadView());
    }
    if (options?.title) {
      builder = builder.setTitle(options.title);
    }

    const picker = builder.build();
    picker.setVisible(true);
  });
}

async function assertDriveOk(res: Response, actionLabel: string): Promise<void> {
  if (res.status === 401 || res.status === 403) {
    const err = new Error(`AUTH_REQUIRED: ${actionLabel} requires Google Drive authorization.`);
    throw err;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive ${actionLabel} failed (${res.status}): ${text.slice(0, 180)}`);
  }
}

/**
 * Uploads a cropped JPEG child portrait to Google Drive so Firestore stores only the lightweight file ID.
 */
export async function uploadChildAvatarToDrive(
  accessToken: string,
  childId: string,
  childName: string,
  jpegDataUrl: string,
): Promise<string> {
  const base64Part = jpegDataUrl.split(',')[1] ?? '';
  const safeName = childName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Child';
  const metadata = {
    name: `SproutScale_Avatar_${safeName}_${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
    appProperties: {
      app: 'SproutScale',
      kind: 'child-avatar',
      childId,
    },
  };

  const boundary = 'sproutscale_avatar_boundary_651928';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: image/jpeg\r\nContent-Transfer-Encoding: base64\r\n\r\n' +
    base64Part +
    closeDelimiter;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  await assertDriveOk(res, 'avatar upload');
  const created = (await res.json()) as { id: string };
  return created.id;
}

/**
 * Uploads any captured child portrait or wall height photo JPEG to Google Drive
 * so Firestore only stores the lightweight Google Drive file ID.
 */
export async function uploadChildPhotoToDrive(
  accessToken: string,
  params: {
    childId: string;
    childName: string;
    kind: ChildPhotoKind;
    capturedDate: string;
    jpegDataUrl: string;
  },
): Promise<string> {
  const base64Part = params.jpegDataUrl.split(',')[1] ?? '';
  const safeName = params.childName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Child';
  const kindTag = params.kind === 'wall' ? 'WallCheckIn' : 'Portrait';
  const metadata = {
    name: `SproutScale_${safeName}_${kindTag}_${params.capturedDate}_${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
    appProperties: {
      app: 'SproutScale',
      kind: 'child-photo',
      photoKind: params.kind,
      childId: params.childId,
    },
  };

  const boundary = 'sproutscale_photo_boundary_839104';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: image/jpeg\r\nContent-Transfer-Encoding: base64\r\n\r\n' +
    base64Part +
    closeDelimiter;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  await assertDriveOk(res, 'photo backup upload');
  const created = (await res.json()) as { id: string };
  return created.id;
}

/**
 * Downloads an image file from Google Drive as a browser data URL.
 */
export async function downloadDriveImageAsDataUrl(
  accessToken: string,
  fileId: string,
): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  await assertDriveOk(res, 'image download');
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to decode Drive image.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to decode Drive image.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Lists SproutScale growth files saved in the user's Google Drive.
 */
export async function listSproutScaleDriveFiles(
  accessToken: string,
): Promise<DriveFileSummary[]> {
  const q = encodeURIComponent(
    "trashed = false and (name contains 'SproutScale' or appProperties has { key='app' and value='SproutScale' })",
  );
  const fields = encodeURIComponent(
    'files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink)',
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=modifiedTime desc&pageSize=15`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await assertDriveOk(res, 'file listing');

  const data = (await res.json()) as { files?: DriveFileSummary[] };
  return data.files ?? [];
}

function buildBackupPayload(
  child: ChildProfile,
  measurements: GrowthMeasurement[],
): GrowthBackupPayload {
  const sorted = [...measurements].sort((a, b) => a.ageMonths - b.ageMonths);
  return {
    app: 'SproutScale',
    exportedAt: new Date().toISOString(),
    child: {
      name: child.name,
      birthDate: child.birthDate,
      sex: child.sex,
      ageTwoHeightCm: child.ageTwoHeightCm,
      ageTwoWeightKg: child.ageTwoWeightKg,
      paletteId: child.paletteId,
      accessoryId: child.accessoryId,
      hairStyle: child.hairStyle,
      skinTone: child.skinTone,
      hairColor: child.hairColor,
    },
    measurements: sorted.map((m) => ({
      ageMonths: m.ageMonths,
      heightCm: m.heightCm,
      weightKg: m.weightKg,
      recordedDate: m.recordedDate,
      note: m.note,
    })),
  };
}

function buildKeepsakePosterSvg(
  child: ChildProfile,
  measurements: GrowthMeasurement[],
): string {
  const sorted = [...measurements].sort((a, b) => a.ageMonths - b.ageMonths);
  const latest = sorted[sorted.length - 1];
  const latestH = latest ? latest.heightCm : child.ageTwoHeightCm;
  const latestW = latest ? latest.weightKg : child.ageTwoWeightKg;
  const latestAge = latest ? latest.ageMonths : 24;
  const hDelta = latestH - child.ageTwoHeightCm;
  const wDelta = latestW - child.ageTwoWeightKg;
  const dobLine = child.birthDate ? ` · Born ${child.birthDate.replace(/[<>&"]/g, '')}` : '';

  const rowsSvg = sorted
    .slice(-8)
    .map((m, idx) => {
      const y = 272 + idx * 32;
      return `<text x="60" y="${y}" font-family="sans-serif" font-size="13" fill="#1e293b">${formatAgeLabel(m.ageMonths)} (${m.recordedDate}) — ${formatFeetInches(m.heightCm)} (${formatTotalInches(m.heightCm)}) · ${formatPounds(m.weightKg)} [${formatMetricHeight(m.heightCm)}, ${formatMetricWeight(m.weightKg)}]${m.note ? ` · ${m.note.replace(/[<>&"]/g, '')}` : ''}</text>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560" width="800" height="560">
  <rect width="800" height="560" fill="#f8fafc" rx="20" />
  <rect x="28" y="28" width="744" height="504" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" rx="16" />
  <text x="60" y="80" font-family="sans-serif" font-size="28" font-weight="bold" fill="#0f172a">SproutScale Growth Keepsake — ${child.name.replace(/[<>&"]/g, '')}</text>
  <text x="60" y="112" font-family="sans-serif" font-size="14.5" fill="#059669" font-weight="bold">Started at Age 2: ${formatFeetInches(child.ageTwoHeightCm)} (${formatTotalInches(child.ageTwoHeightCm)}) · ${formatPounds(child.ageTwoWeightKg)} (${formatMetricHeight(child.ageTwoHeightCm)}, ${formatMetricWeight(child.ageTwoWeightKg)})${dobLine}</text>
  <text x="60" y="140" font-family="sans-serif" font-size="14.5" fill="#0f172a">Latest (${formatAgeLabel(latestAge)}): ${formatFeetInches(latestH)} (${formatTotalInches(latestH)}) · ${formatPounds(latestW)} (${formatHeightDelta(hDelta, 'imperial')} / ${formatWeightDelta(wDelta, 'imperial')} · ${formatMetricHeight(latestH)}, ${formatMetricWeight(latestW)})</text>
  <line x1="60" y1="168" x2="740" y2="168" stroke="#e2e8f0" stroke-width="1.5" />
  <text x="60" y="218" font-family="sans-serif" font-size="16" font-weight="bold" fill="#334155">Recorded Wall Milestones (Feet &amp; Inches, Pounds · Metric Secondary)</text>
  ${rowsSvg || '<text x="60" y="272" font-family="sans-serif" font-size="14" fill="#64748b">Age 2 baseline recorded.</text>'}
</svg>`;
}

async function createMultipartDriveFile(
  accessToken: string,
  metadata: Record<string, unknown>,
  content: string,
  mimeType: string,
): Promise<DriveFileSummary> {
  const boundary = 'sproutscale_multipart_boundary_928374';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}; charset=UTF-8\r\n\r\n` +
    content +
    closeDelimiter;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  await assertDriveOk(res, 'upload');
  return (await res.json()) as DriveFileSummary;
}

/**
 * Creates a new JSON growth backup file in Google Drive.
 */
export async function saveGrowthBackupToDrive(
  accessToken: string,
  child: ChildProfile,
  measurements: GrowthMeasurement[],
): Promise<DriveFileSummary> {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const safeChildName = child.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const metadata = {
    name: `SproutScale_${safeChildName}_Growth_${dateStamp}.json`,
    mimeType: 'application/json',
    appProperties: {
      app: 'SproutScale',
      childName: child.name,
      kind: 'growth-backup',
    },
  };
  const jsonContent = JSON.stringify(buildBackupPayload(child, measurements), null, 2);
  return createMultipartDriveFile(accessToken, metadata, jsonContent, 'application/json');
}

/**
 * Creates a printable SVG Growth Chart Keepsake file in Google Drive.
 */
export async function saveKeepsakeChartToDrive(
  accessToken: string,
  child: ChildProfile,
  measurements: GrowthMeasurement[],
  _units: UnitSystem = 'imperial',
): Promise<DriveFileSummary> {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const safeChildName = child.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const metadata = {
    name: `SproutScale_${safeChildName}_Keepsake_Poster_${dateStamp}.svg`,
    mimeType: 'image/svg+xml',
    appProperties: {
      app: 'SproutScale',
      childName: child.name,
      kind: 'keepsake-poster',
    },
  };
  const svgContent = buildKeepsakePosterSvg(child, measurements);
  return createMultipartDriveFile(accessToken, metadata, svgContent, 'image/svg+xml');
}

/**
 * Overwrites an existing JSON backup file in Google Drive.
 * Caller MUST obtain explicit user confirmation before invoking this mutating operation.
 */
export async function overwriteDriveBackupFile(
  accessToken: string,
  fileId: string,
  child: ChildProfile,
  measurements: GrowthMeasurement[],
): Promise<DriveFileSummary> {
  const jsonContent = JSON.stringify(buildBackupPayload(child, measurements), null, 2);
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,mimeType,modifiedTime,size,webViewLink`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: jsonContent,
    },
  );
  await assertDriveOk(res, 'file update');
  return (await res.json()) as DriveFileSummary;
}

/**
 * Deletes a file from Google Drive.
 * Caller MUST obtain explicit user confirmation before invoking this destructive operation.
 */
export async function deleteDriveFile(
  accessToken: string,
  fileId: string,
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  await assertDriveOk(res, 'file deletion');
}

/**
 * Downloads and parses a SproutScale JSON backup file from Google Drive.
 */
export async function downloadDriveGrowthBackup(
  accessToken: string,
  fileId: string,
): Promise<GrowthBackupPayload> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  await assertDriveOk(res, 'file download');
  const parsed = (await res.json()) as Partial<GrowthBackupPayload>;
  if (!parsed || !Array.isArray(parsed.measurements)) {
    throw new Error(
      'Selected Drive file is not a SproutScale JSON growth backup. Pick a SproutScale .json backup file to import milestones.',
    );
  }
  return parsed as GrowthBackupPayload;
}
