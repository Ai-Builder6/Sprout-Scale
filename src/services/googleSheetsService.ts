// Brightly Color-Coded Google Sheets & Google Drive Folder Organizer for SproutScale
// Uses Google Sheets API v4 + Google Drive API v3 with vibrant tab colors, headers,
// zebra banding, status color-coding, live summary formulas, and a bright emerald Drive folder.

import {
  ChildPhotoRecord,
  ChildProfile,
  cmToInches,
  EVENT_CATEGORY_LABELS,
  formatAgeLabel,
  formatFeetInches,
  formatHeightDelta,
  formatMetricHeight,
  formatMetricWeight,
  formatPounds,
  formatTotalInches,
  formatWeightDelta,
  GrowthMeasurement,
  kgToLbs,
  MilestoneEventRecord,
  PHOTO_KIND_LABELS,
} from '../types';

export interface ColorCodedSheetResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  folderName: string;
  folderId: string | null;
  tabCount: number;
}

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return {
    red: Number(r.toFixed(4)),
    green: Number(g.toFixed(4)),
    blue: Number(b.toFixed(4)),
  };
}

// Bright, joyful, high-contrast color palette for Google Sheets & Drive
const COLORS = {
  // Tab Colors (vibrant bright accents visible along bottom of Google Sheets)
  tabMilestones: hexToRgb('#0284c7'), // Bright Sky Blue
  tabVelocity: hexToRgb('#f59e0b'), // Bright Marigold Amber
  tabMemories: hexToRgb('#f43f5e'), // Bright Coral Rose
  tabProfile: hexToRgb('#10b981'), // Bright Emerald Green

  // Header Backgrounds (saturated rich colors with crisp white bold text)
  headerSky: hexToRgb('#0369a1'),
  headerAmber: hexToRgb('#d97706'),
  headerRose: hexToRgb('#e11d48'),
  headerEmerald: hexToRgb('#059669'),

  // Soft Pastel Zebra & Column Highlights (high legibility dark text)
  skyLight: hexToRgb('#e0f2fe'),
  skyRowAlt: hexToRgb('#f0f9ff'),
  amberLight: hexToRgb('#fef3c7'),
  amberRowAlt: hexToRgb('#fffbeb'),
  roseLight: hexToRgb('#ffe4e6'),
  roseRowAlt: hexToRgb('#fff1f2'),
  emeraldLight: hexToRgb('#d1fae5'),
  emeraldRowAlt: hexToRgb('#ecfdf5'),
  violetLight: hexToRgb('#ede9fe'),
  summaryGold: hexToRgb('#fde68a'),
  white: hexToRgb('#ffffff'),
  inkDark: hexToRgb('#0f172a'),
  inkIndigo: hexToRgb('#1e1b4b'),
  inkEmerald: hexToRgb('#065f46'),
  inkRose: hexToRgb('#9f1239'),
  inkSky: hexToRgb('#075985'),
  inkAmber: hexToRgb('#92400e'),
  borderSoft: hexToRgb('#cbd5e1'),
};

async function assertWorkspaceOk(res: Response, label: string): Promise<void> {
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `AUTH_REQUIRED: ${label} needs Google Sheets & Drive permission. Click "Sign in with Google" to refresh access.`,
    );
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google ${label} failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

/**
 * Finds or creates a bright emerald-green folder in Google Drive:
 * "SproutScale — <ChildName> Family Vault"
 */
export async function ensureBrightColorDriveFolder(
  accessToken: string,
  childName: string,
): Promise<{ id: string; name: string }> {
  const safeName = childName.trim().slice(0, 40) || 'Child';
  const folderName = `SproutScale — ${safeName} Family Vault`;

  const q = encodeURIComponent(
    `mimeType = 'application/vnd.google-apps.folder' and trashed = false and name = '${folderName.replace(/'/g, "\\'")}'`,
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,folderColorRgb)&pageSize=5`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  await assertWorkspaceOk(searchRes, 'Drive folder lookup');
  const searchData = (await searchRes.json()) as {
    files?: { id: string; name: string; folderColorRgb?: string }[];
  };

  if (searchData.files && searchData.files.length > 0) {
    return { id: searchData.files[0].id, name: searchData.files[0].name };
  }

  // Create new folder with Google Drive's official bright emerald green folderColorRgb (#16a765)
  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        folderColorRgb: '#16a765',
        appProperties: {
          app: 'SproutScale',
          kind: 'family-folder',
          childName: safeName,
        },
      }),
    },
  );
  await assertWorkspaceOk(createRes, 'Drive folder creation');
  const created = (await createRes.json()) as { id: string; name: string };
  return created;
}

/**
 * Moves a file into the bright green SproutScale folder in Google Drive and tags it.
 */
async function moveFileIntoSproutFolder(
  accessToken: string,
  fileId: string,
  folderId: string,
  childName: string,
): Promise<void> {
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=parents`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!metaRes.ok) return;
  const meta = (await metaRes.json()) as { parents?: string[] };
  const previousParents = (meta.parents ?? []).join(',');

  const params = new URLSearchParams({
    addParents: folderId,
    fields: 'id,parents',
  });
  if (previousParents) {
    params.set('removeParents', previousParents);
  }

  await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appProperties: {
          app: 'SproutScale',
          kind: 'growth-sheet',
          childName,
        },
      }),
    },
  );
}

interface SheetCellSpec {
  value: string | number;
  isFormula?: boolean;
  bgColor?: RgbColor;
  textColor?: RgbColor;
  bold?: boolean;
  fontSize?: number;
  align?: 'LEFT' | 'CENTER' | 'RIGHT';
}

function buildRowData(cells: SheetCellSpec[]) {
  return {
    values: cells.map((cell) => {
      const userEnteredValue = cell.isFormula
        ? { formulaValue: String(cell.value) }
        : typeof cell.value === 'number'
          ? { numberValue: cell.value }
          : { stringValue: String(cell.value) };

      return {
        userEnteredValue,
        userEnteredFormat: {
          backgroundColor: cell.bgColor ?? COLORS.white,
          horizontalAlignment: cell.align ?? (typeof cell.value === 'number' ? 'RIGHT' : 'LEFT'),
          verticalAlignment: 'MIDDLE',
          wrapStrategy: 'WRAP',
          textFormat: {
            foregroundColor: cell.textColor ?? COLORS.inkDark,
            bold: Boolean(cell.bold),
            fontSize: cell.fontSize ?? 10,
            fontFamily: 'Plus Jakarta Sans',
          },
          borders: {
            bottom: { style: 'SOLID', width: 1, color: COLORS.borderSoft },
          },
        },
      };
    }),
  };
}

function buildSheetPayloads(
  child: ChildProfile,
  measurements: GrowthMeasurement[],
  events: MilestoneEventRecord[],
  photos: ChildPhotoRecord[],
) {
  const sortedAsc = [...measurements].sort((a, b) => a.ageMonths - b.ageMonths);
  const latest = sortedAsc[sortedAsc.length - 1];
  const latestH = latest ? latest.heightCm : child.ageTwoHeightCm;
  const latestW = latest ? latest.weightKg : child.ageTwoWeightKg;
  const latestAge = latest ? latest.ageMonths : 24;

  // -------------------------------------------------------------------------
  // TAB 1: Growth Milestones (Sky Blue Header, Color-Coded Height / Weight / Gain)
  // -------------------------------------------------------------------------
  const milestoneRows = [
    // Title Banner Row
    buildRowData([
      {
        value: `SproutScale Growth Milestones — ${child.name}`,
        bgColor: COLORS.tabMilestones,
        textColor: COLORS.white,
        bold: true,
        fontSize: 13,
      },
      { value: `DOB: ${child.birthDate || 'Not set'}`, bgColor: COLORS.tabMilestones, textColor: COLORS.white, bold: true },
      { value: `Age 2 Baseline: ${formatFeetInches(child.ageTwoHeightCm)}`, bgColor: COLORS.tabMilestones, textColor: COLORS.white, bold: true },
      { value: `${formatPounds(child.ageTwoWeightKg)}`, bgColor: COLORS.tabMilestones, textColor: COLORS.white, bold: true },
      { value: 'Bright Color-Coded Tracker', bgColor: COLORS.tabMilestones, textColor: COLORS.summaryGold, bold: true },
      { value: '', bgColor: COLORS.tabMilestones },
      { value: '', bgColor: COLORS.tabMilestones },
      { value: '', bgColor: COLORS.tabMilestones },
      { value: '', bgColor: COLORS.tabMilestones },
    ]),
    // Column Headers
    buildRowData(
      [
        'Recorded Date',
        'Age',
        'Height (ft & in)',
        'Height (in)',
        'Height (cm)',
        'Weight (lb)',
        'Weight (kg)',
        'Gain Since Age 2',
        'Memory Statement / Note',
      ].map((label) => ({
        value: label,
        bgColor: COLORS.headerSky,
        textColor: COLORS.white,
        bold: true,
        fontSize: 10,
        align: 'CENTER' as const,
      })),
    ),
    // Data Rows
    ...sortedAsc.map((m, idx) => {
      const rowTint = idx % 2 === 0 ? COLORS.white : COLORS.skyRowAlt;
      const heightIn = Number(cmToInches(m.heightCm).toFixed(1));
      const weightLb = Number(kgToLbs(m.weightKg).toFixed(1));
      const gainStr = `${formatHeightDelta(m.heightCm - child.ageTwoHeightCm, 'imperial')} · ${formatWeightDelta(m.weightKg - child.ageTwoWeightKg, 'imperial')}`;
      return buildRowData([
        { value: m.recordedDate, bgColor: rowTint, align: 'CENTER' },
        { value: formatAgeLabel(m.ageMonths), bgColor: rowTint, bold: true, textColor: COLORS.inkIndigo },
        { value: formatFeetInches(m.heightCm), bgColor: COLORS.skyLight, bold: true, textColor: COLORS.inkSky, align: 'CENTER' },
        { value: heightIn, bgColor: COLORS.skyLight, textColor: COLORS.inkSky, align: 'RIGHT' },
        { value: Number(m.heightCm.toFixed(1)), bgColor: rowTint, align: 'RIGHT' },
        { value: weightLb, bgColor: COLORS.roseLight, bold: true, textColor: COLORS.inkRose, align: 'RIGHT' },
        { value: Number(m.weightKg.toFixed(1)), bgColor: rowTint, align: 'RIGHT' },
        { value: gainStr, bgColor: COLORS.emeraldLight, bold: true, textColor: COLORS.inkEmerald, align: 'CENTER' },
        { value: m.note || '—', bgColor: rowTint },
      ]);
    }),
  ];

  // Add Golden Live Formula Summary Row if there are measurements
  if (sortedAsc.length > 0) {
    const startRow = 3;
    const endRow = 2 + sortedAsc.length;
    milestoneRows.push(
      buildRowData([
        { value: 'SUMMARY', bgColor: COLORS.summaryGold, textColor: COLORS.inkAmber, bold: true, align: 'CENTER' },
        { value: `${sortedAsc.length} Marks`, bgColor: COLORS.summaryGold, textColor: COLORS.inkAmber, bold: true },
        { value: 'Tallest (in) →', bgColor: COLORS.summaryGold, textColor: COLORS.inkAmber, bold: true, align: 'RIGHT' },
        { value: `=MAX(D${startRow}:D${endRow})`, isFormula: true, bgColor: COLORS.summaryGold, textColor: COLORS.inkIndigo, bold: true, align: 'RIGHT' },
        { value: `=MAX(E${startRow}:E${endRow})`, isFormula: true, bgColor: COLORS.summaryGold, textColor: COLORS.inkIndigo, bold: true, align: 'RIGHT' },
        { value: `=MAX(F${startRow}:F${endRow})`, isFormula: true, bgColor: COLORS.summaryGold, textColor: COLORS.inkRose, bold: true, align: 'RIGHT' },
        { value: `=MAX(G${startRow}:G${endRow})`, isFormula: true, bgColor: COLORS.summaryGold, textColor: COLORS.inkRose, bold: true, align: 'RIGHT' },
        { value: formatHeightDelta(latestH - child.ageTwoHeightCm, 'imperial'), bgColor: COLORS.emeraldLight, textColor: COLORS.inkEmerald, bold: true, align: 'CENTER' },
        { value: 'Auto-calculated live Google Sheets formulas', bgColor: COLORS.summaryGold, textColor: COLORS.inkAmber },
      ]),
    );
  }

  // -------------------------------------------------------------------------
  // TAB 2: Growth Velocity (Marigold Amber Header + Pace Color Coding)
  // -------------------------------------------------------------------------
  const curvePoints: GrowthMeasurement[] = sortedAsc.some((m) => m.ageMonths === 24)
    ? sortedAsc
    : [
        {
          id: 'base_24',
          ownerId: child.ownerId,
          childId: child.id,
          ageMonths: 24,
          heightCm: child.ageTwoHeightCm,
          weightKg: child.ageTwoWeightKg,
          recordedDate: 'Age 2 Baseline',
          note: 'Age 2 Baseline',
        },
        ...sortedAsc,
      ];

  const velocityRows = [
    buildRowData([
      {
        value: `Growth Velocity & Spurt Pace — ${child.name}`,
        bgColor: COLORS.tabVelocity,
        textColor: COLORS.inkDark,
        bold: true,
        fontSize: 13,
      },
      { value: 'Typical Childhood Band: 2.0–3.2 in/yr', bgColor: COLORS.tabVelocity, textColor: COLORS.inkDark, bold: true },
      { value: '4.0–7.0 lb/yr', bgColor: COLORS.tabVelocity, textColor: COLORS.inkDark, bold: true },
      { value: '', bgColor: COLORS.tabVelocity },
      { value: '', bgColor: COLORS.tabVelocity },
      { value: '', bgColor: COLORS.tabVelocity },
      { value: '', bgColor: COLORS.tabVelocity },
    ]),
    buildRowData(
      [
        'Age Interval',
        'Span (Months)',
        'Height Speed (in/yr)',
        'Height Speed (cm/yr)',
        'Weight Speed (lb/yr)',
        'Weight Speed (kg/yr)',
        'Growth Pace Tag',
      ].map((label) => ({
        value: label,
        bgColor: COLORS.headerAmber,
        textColor: COLORS.white,
        bold: true,
        align: 'CENTER' as const,
      })),
    ),
  ];

  for (let i = 1; i < curvePoints.length; i += 1) {
    const prev = curvePoints[i - 1];
    const curr = curvePoints[i];
    const deltaMonths = curr.ageMonths - prev.ageMonths;
    if (deltaMonths < 1) continue;
    const years = deltaMonths / 12;
    const hInYr = Number(((cmToInches(curr.heightCm) - cmToInches(prev.heightCm)) / years).toFixed(2));
    const hCmYr = Number(((curr.heightCm - prev.heightCm) / years).toFixed(2));
    const wLbYr = Number(((kgToLbs(curr.weightKg) - kgToLbs(prev.weightKg)) / years).toFixed(2));
    const wKgYr = Number(((curr.weightKg - prev.weightKg) / years).toFixed(2));

    const isSpurt = hInYr >= 3.2;
    const isSteady = hInYr >= 2.0 && hInYr < 3.2;
    const paceLabel = isSpurt
      ? 'Growth Spurt!'
      : isSteady
        ? 'Steady Pediatric Band'
        : 'Gentle Cruise';
    const paceBg = isSpurt
      ? COLORS.emeraldLight
      : isSteady
        ? COLORS.amberLight
        : COLORS.skyLight;
    const paceText = isSpurt
      ? COLORS.inkEmerald
      : isSteady
        ? COLORS.inkAmber
        : COLORS.inkSky;

    const rowBg = i % 2 === 0 ? COLORS.white : COLORS.amberRowAlt;
    velocityRows.push(
      buildRowData([
        { value: `${formatAgeLabel(prev.ageMonths)} → ${formatAgeLabel(curr.ageMonths)}`, bgColor: rowBg, bold: true },
        { value: deltaMonths, bgColor: rowBg, align: 'CENTER' },
        { value: hInYr, bgColor: COLORS.skyLight, bold: true, textColor: COLORS.inkSky, align: 'RIGHT' },
        { value: hCmYr, bgColor: rowBg, align: 'RIGHT' },
        { value: wLbYr, bgColor: COLORS.roseLight, bold: true, textColor: COLORS.inkRose, align: 'RIGHT' },
        { value: wKgYr, bgColor: rowBg, align: 'RIGHT' },
        { value: paceLabel, bgColor: paceBg, bold: true, textColor: paceText, align: 'CENTER' },
      ]),
    );
  }

  // -------------------------------------------------------------------------
  // TAB 3: Memories & Events (Coral Rose Header + Color-Coded Category Badges)
  // -------------------------------------------------------------------------
  const categoryColorMap: Record<string, { bg: RgbColor; text: RgbColor }> = {
    birthday: { bg: COLORS.summaryGold, text: COLORS.inkAmber },
    firsts: { bg: COLORS.roseLight, text: COLORS.inkRose },
    school: { bg: COLORS.skyLight, text: COLORS.inkSky },
    health: { bg: COLORS.emeraldLight, text: COLORS.inkEmerald },
    adventure: { bg: COLORS.violetLight, text: COLORS.inkIndigo },
    celebration: { bg: COLORS.amberLight, text: COLORS.inkAmber },
  };

  const memoryRows = [
    buildRowData([
      {
        value: `Special Memories, Milestones & Photo Journal — ${child.name}`,
        bgColor: COLORS.tabMemories,
        textColor: COLORS.white,
        bold: true,
        fontSize: 13,
      },
      { value: `${events.length} Events`, bgColor: COLORS.tabMemories, textColor: COLORS.white, bold: true },
      { value: `${photos.length} Photos`, bgColor: COLORS.tabMemories, textColor: COLORS.white, bold: true },
      { value: '', bgColor: COLORS.tabMemories },
      { value: '', bgColor: COLORS.tabMemories },
      { value: '', bgColor: COLORS.tabMemories },
    ]),
    buildRowData(
      ['Date', 'Type', 'Category', 'Age', 'Title / Caption', 'Story & Height Snapshot'].map(
        (label) => ({
          value: label,
          bgColor: COLORS.headerRose,
          textColor: COLORS.white,
          bold: true,
          align: 'CENTER' as const,
        }),
      ),
    ),
    ...events.map((ev, idx) => {
      const tint = idx % 2 === 0 ? COLORS.white : COLORS.roseRowAlt;
      const catStyle = categoryColorMap[ev.category] ?? { bg: COLORS.amberLight, text: COLORS.inkAmber };
      return buildRowData([
        { value: ev.eventDate, bgColor: tint, align: 'CENTER' },
        { value: 'Milestone Event', bgColor: tint, bold: true, textColor: COLORS.inkRose },
        { value: EVENT_CATEGORY_LABELS[ev.category] || ev.category, bgColor: catStyle.bg, bold: true, textColor: catStyle.text, align: 'CENTER' },
        { value: formatAgeLabel(ev.ageMonths), bgColor: tint, align: 'CENTER' },
        { value: ev.title, bgColor: tint, bold: true },
        {
          value: `${ev.story}${ev.heightCm > 0 ? ` (${formatFeetInches(ev.heightCm)})` : ''}`,
          bgColor: tint,
        },
      ]);
    }),
    ...photos.map((ph, idx) => {
      const tint = idx % 2 === 0 ? COLORS.skyRowAlt : COLORS.white;
      return buildRowData([
        { value: ph.capturedDate, bgColor: tint, align: 'CENTER' },
        { value: 'Album Photo', bgColor: COLORS.skyLight, bold: true, textColor: COLORS.inkSky },
        { value: PHOTO_KIND_LABELS[ph.kind] || ph.kind, bgColor: COLORS.violetLight, bold: true, textColor: COLORS.inkIndigo, align: 'CENTER' },
        { value: formatAgeLabel(ph.ageMonths), bgColor: tint, align: 'CENTER' },
        { value: ph.eventTitle || `${child.name} Photo`, bgColor: tint, bold: true },
        {
          value: `${ph.caption || 'Keepsake portrait'}${ph.heightCm > 0 ? ` · ${formatFeetInches(ph.heightCm)}` : ''}${ph.driveFileId ? ' · Backed up in Drive' : ''}`,
          bgColor: tint,
        },
      ]);
    }),
  ];

  // -------------------------------------------------------------------------
  // TAB 4: Family Profile Summary Card (Emerald Green Header)
  // -------------------------------------------------------------------------
  const profileRows = [
    buildRowData([
      {
        value: `SproutScale Family Profile Card — ${child.name}`,
        bgColor: COLORS.tabProfile,
        textColor: COLORS.white,
        bold: true,
        fontSize: 13,
      },
      { value: 'Synced with Firestore & Google Drive', bgColor: COLORS.tabProfile, textColor: COLORS.white, bold: true },
    ]),
    buildRowData([
      { value: 'Profile Field', bgColor: COLORS.headerEmerald, textColor: COLORS.white, bold: true },
      { value: 'Current Value', bgColor: COLORS.headerEmerald, textColor: COLORS.white, bold: true },
    ]),
    ...[
      ['Child Name', child.name, COLORS.emeraldRowAlt],
      ['Date of Birth', child.birthDate || 'Not entered', COLORS.white],
      ['Age 2 Starting Height', `${formatFeetInches(child.ageTwoHeightCm)} (${formatTotalInches(child.ageTwoHeightCm)} · ${formatMetricHeight(child.ageTwoHeightCm)})`, COLORS.skyLight],
      ['Age 2 Starting Weight', `${formatPounds(child.ageTwoWeightKg)} (${formatMetricWeight(child.ageTwoWeightKg)})`, COLORS.roseLight],
      ['Latest Measured Age', formatAgeLabel(latestAge), COLORS.amberRowAlt],
      ['Latest Recorded Height', `${formatFeetInches(latestH)} (${formatTotalInches(latestH)} · ${formatMetricHeight(latestH)})`, COLORS.skyLight],
      ['Latest Recorded Weight', `${formatPounds(latestW)} (${formatMetricWeight(latestW)})`, COLORS.roseLight],
      ['Total Sprout Gain Since Age 2', `${formatHeightDelta(latestH - child.ageTwoHeightCm, 'imperial')} · ${formatWeightDelta(latestW - child.ageTwoWeightKg, 'imperial')}`, COLORS.emeraldLight],
      ['Recorded Wall Measurements', `${sortedAsc.length}`, COLORS.white],
      ['Recorded Events & Photos', `${events.length} Events · ${photos.length} Photos`, COLORS.violetLight],
      ['Last Synced to Google Sheets', new Date().toLocaleString(), COLORS.summaryGold],
    ].map(([k, v, bg]) =>
      buildRowData([
        { value: k as string, bgColor: COLORS.emeraldRowAlt, bold: true, textColor: COLORS.inkEmerald },
        { value: v as string, bgColor: bg as RgbColor, bold: true, textColor: COLORS.inkDark },
      ]),
    ),
  ];

  return { milestoneRows, velocityRows, memoryRows, profileRows };
}

/**
 * Creates a brand-new 4-tab brightly color-coded Google Sheet in the user's Google Drive
 * inside a bright green "SproutScale — <ChildName> Family Vault" folder.
 */
export async function createColorCodedGrowthSheet(
  accessToken: string,
  child: ChildProfile,
  measurements: GrowthMeasurement[],
  events: MilestoneEventRecord[] = [],
  photos: ChildPhotoRecord[] = [],
): Promise<ColorCodedSheetResult> {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const title = `SproutScale — ${child.name} Color Growth Tracker (${dateStamp})`;
  const { milestoneRows, velocityRows, memoryRows, profileRows } = buildSheetPayloads(
    child,
    measurements,
    events,
    photos,
  );

  // 1. Create spreadsheet with all 4 brightly color-coded tabs & rich styled cells in one call
  const createBody = {
    properties: {
      title,
      locale: 'en_US',
    },
    sheets: [
      {
        properties: {
          sheetId: 101,
          title: 'Growth Milestones',
          tabColor: COLORS.tabMilestones,
          gridProperties: { frozenRowCount: 2 },
        },
        data: [{ startRow: 0, startColumn: 0, rowData: milestoneRows }],
      },
      {
        properties: {
          sheetId: 102,
          title: 'Growth Velocity',
          tabColor: COLORS.tabVelocity,
          gridProperties: { frozenRowCount: 2 },
        },
        data: [{ startRow: 0, startColumn: 0, rowData: velocityRows }],
      },
      {
        properties: {
          sheetId: 103,
          title: 'Memories & Events',
          tabColor: COLORS.tabMemories,
          gridProperties: { frozenRowCount: 2 },
        },
        data: [{ startRow: 0, startColumn: 0, rowData: memoryRows }],
      },
      {
        properties: {
          sheetId: 104,
          title: 'Family Profile',
          tabColor: COLORS.tabProfile,
          gridProperties: { frozenRowCount: 2 },
        },
        data: [{ startRow: 0, startColumn: 0, rowData: profileRows }],
      },
    ],
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createBody),
  });
  await assertWorkspaceOk(res, 'Sheets creation');

  const created = (await res.json()) as {
    spreadsheetId: string;
    spreadsheetUrl: string;
  };

  // 2. Auto-resize columns & set tall crisp title rows across all 4 tabs
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(created.spreadsheetId)}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          ...[101, 102, 103, 104].map((sheetId) => ({
            autoResizeDimensions: {
              dimensions: {
                sheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 9,
              },
            },
          })),
          ...[101, 102, 103, 104].map((sheetId) => ({
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: 0,
                endIndex: 1,
              },
              properties: { pixelSize: 38 },
              fields: 'pixelSize',
            },
          })),
          ...[101, 102, 103, 104].map((sheetId) => ({
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: 1,
                endIndex: 2,
              },
              properties: { pixelSize: 30 },
              fields: 'pixelSize',
            },
          })),
        ],
      }),
    },
  );

  // 3. Place inside bright emerald Google Drive folder
  let folderId: string | null = null;
  let folderName = `SproutScale — ${child.name} Family Vault`;
  try {
    const folder = await ensureBrightColorDriveFolder(accessToken, child.name);
    folderId = folder.id;
    folderName = folder.name;
    await moveFileIntoSproutFolder(accessToken, created.spreadsheetId, folder.id, child.name);
  } catch {
    // Non-fatal: spreadsheet still exists at Drive root even if folder move fails
  }

  return {
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl: created.spreadsheetUrl,
    title,
    folderName,
    folderId,
    tabCount: 4,
  };
}

/**
 * Updates an existing SproutScale Google Sheet with the latest color-coded data.
 * Caller MUST obtain explicit user confirmation before invoking this mutating operation.
 */
export async function syncExistingColorCodedGrowthSheet(
  accessToken: string,
  spreadsheetId: string,
  child: ChildProfile,
  measurements: GrowthMeasurement[],
  events: MilestoneEventRecord[] = [],
  photos: ChildPhotoRecord[] = [],
): Promise<void> {
  // Fetch actual sheet metadata first (never assume sheetIds or tab names!)
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets(properties(sheetId,title))`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  await assertWorkspaceOk(metaRes, 'Sheets metadata lookup');
  const meta = (await metaRes.json()) as {
    sheets?: { properties?: { sheetId?: number; title?: string } }[];
  };

  const existingSheets = meta.sheets ?? [];
  const findSheetId = (title: string): number | undefined =>
    existingSheets.find((s) => s.properties?.title === title)?.properties?.sheetId;

  const { milestoneRows, velocityRows, memoryRows, profileRows } = buildSheetPayloads(
    child,
    measurements,
    events,
    photos,
  );

  const tabSpecs = [
    { title: 'Growth Milestones', rows: milestoneRows, tabColor: COLORS.tabMilestones },
    { title: 'Growth Velocity', rows: velocityRows, tabColor: COLORS.tabVelocity },
    { title: 'Memories & Events', rows: memoryRows, tabColor: COLORS.tabMemories },
    { title: 'Family Profile', rows: profileRows, tabColor: COLORS.tabProfile },
  ];

  // If the first sheet is named something generic (e.g. "Sheet1"), map it to Growth Milestones
  const requests: Record<string, unknown>[] = [];
  for (let i = 0; i < tabSpecs.length; i += 1) {
    const spec = tabSpecs[i];
    const matchedId =
      findSheetId(spec.title) ??
      (i === 0 ? existingSheets[0]?.properties?.sheetId : undefined);

    if (matchedId !== undefined) {
      requests.push(
        {
          updateSheetProperties: {
            properties: {
              sheetId: matchedId,
              title: spec.title,
              tabColor: spec.tabColor,
              gridProperties: { frozenRowCount: 2 },
            },
            fields: 'title,tabColor,gridProperties.frozenRowCount',
          },
        },
        {
          updateCells: {
            range: { sheetId: matchedId },
            fields: 'userEnteredValue,userEnteredFormat',
          },
        },
        {
          updateCells: {
            start: { sheetId: matchedId, rowIndex: 0, columnIndex: 0 },
            rows: spec.rows,
            fields: 'userEnteredValue,userEnteredFormat',
          },
        },
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId: matchedId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 9,
            },
          },
        },
      );
    }
  }

  if (requests.length === 0) return;

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    },
  );
  await assertWorkspaceOk(updateRes, 'Sheets color-coded sync');
}
