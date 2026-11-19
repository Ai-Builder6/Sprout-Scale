import {
  formatAgeLabel,
  formatFeetInches,
  formatHeightDelta,
  formatHumanDate,
  formatPounds,
  formatTotalInches,
} from '../types';

export type ShareCardFormat = 'story_9_16' | 'post_4_5';
export type ShareCardTheme = 'sunny' | 'editorial' | 'midnight';

export interface ShareCardRenderOptions {
  format: ShareCardFormat;
  theme: ShareCardTheme;
  childName: string;
  showChildName: boolean;
  headline: string;
  caption: string;
  dateIso: string;
  ageMonths: number;
  heightCm: number;
  weightKg: number;
  ageTwoHeightCm: number;
  includeMeasurements: boolean;
  includeDateAndAge: boolean;
  includeGrowthGain: boolean;
  photoDataUrl: string | null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load photo for share card.'));
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length >= maxLines - 1) {
        break;
      }
    }
  }
  if (lines.length < maxLines) {
    lines.push(current);
  }
  return lines.slice(0, maxLines);
}

/**
 * Renders a crisp high-resolution JPEG (1080x1920 for Instagram/Facebook Stories
 * or 1080x1350 for Feed Posts) combining the child's photo, date/age, and imperial measurements.
 */
export async function renderSocialShareCardJpeg(
  opts: ShareCardRenderOptions,
): Promise<string> {
  const width = 1080;
  const height = opts.format === 'story_9_16' ? 1920 : 1350;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable.');
  }

  const palettes: Record<
    ShareCardTheme,
    {
      bgTop: string;
      bgBottom: string;
      cardBg: string;
      border: string;
      title: string;
      body: string;
      muted: string;
      accent: string;
      accentText: string;
      photoFallbackBg: string;
    }
  > = {
    sunny: {
      bgTop: '#e0f2fe',
      bgBottom: '#fef3c7',
      cardBg: '#ffffff',
      border: '#fcd34d',
      title: '#1e1b4b',
      body: '#334155',
      muted: '#64748b',
      accent: '#facc15',
      accentText: '#0f172a',
      photoFallbackBg: '#0f172a',
    },
    editorial: {
      bgTop: '#f8fafc',
      bgBottom: '#f1f5f9',
      cardBg: '#ffffff',
      border: '#cbd5e1',
      title: '#0f172a',
      body: '#334155',
      muted: '#64748b',
      accent: '#0284c7',
      accentText: '#ffffff',
      photoFallbackBg: '#1e293b',
    },
    midnight: {
      bgTop: '#0f172a',
      bgBottom: '#1e1b4b',
      cardBg: '#1e293b',
      border: '#38bdf8',
      title: '#f8fafc',
      body: '#e2e8f0',
      muted: '#94a3b8',
      accent: '#facc15',
      accentText: '#0f172a',
      photoFallbackBg: '#020617',
    },
  };

  const p = palettes[opts.theme];

  // 1. Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, p.bgTop);
  bgGrad.addColorStop(1, p.bgBottom);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Outer layout padding
  const padX = 68;
  const padTop = opts.format === 'story_9_16' ? 118 : 68;
  const innerW = width - padX * 2;

  // 2. Top editorial header line
  ctx.fillStyle = p.title;
  ctx.font = '700 34px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'top';
  const brandHeader = opts.showChildName
    ? `${opts.childName}’s Growth Milestone`
    : 'Growing Up Milestone';
  ctx.fillText(brandHeader, padX, padTop);

  ctx.fillStyle = p.muted;
  ctx.font = '600 24px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  const subParts: string[] = [];
  if (opts.includeDateAndAge) {
    subParts.push(formatHumanDate(opts.dateIso));
    subParts.push(formatAgeLabel(opts.ageMonths));
  }
  subParts.push('SproutScale');
  ctx.fillText(subParts.join('  ·  '), padX, padTop + 46);

  // 3. Main Photo Showcase Frame
  const frameY = padTop + 104;
  const frameH = opts.format === 'story_9_16' ? 1120 : 760;

  ctx.save();
  drawRoundedRect(ctx, padX, frameY, innerW, frameH, 34);
  ctx.fillStyle = p.photoFallbackBg;
  ctx.fill();
  ctx.clip();

  if (opts.photoDataUrl) {
    try {
      const img = await loadImage(opts.photoDataUrl);
      const imgRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
      const boxRatio = innerW / frameH;
      let drawW = innerW;
      let drawH = frameH;
      let offsetX = padX;
      let offsetY = frameY;

      if (imgRatio > boxRatio) {
        drawH = frameH;
        drawW = frameH * imgRatio;
        offsetX = padX - (drawW - innerW) / 2;
      } else {
        drawW = innerW;
        drawH = innerW / imgRatio;
        offsetY = frameY - (drawH - frameH) / 2;
      }
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

      // Subtle bottom scrim for legibility if measurement strip overlays bottom
      const scrim = ctx.createLinearGradient(0, frameY + frameH - 280, 0, frameY + frameH);
      scrim.addColorStop(0, 'rgba(15, 23, 42, 0)');
      scrim.addColorStop(1, 'rgba(15, 23, 42, 0.72)');
      ctx.fillStyle = scrim;
      ctx.fillRect(padX, frameY + frameH - 280, innerW, 280);
    } catch {
      // Fallback solid editorial surface handled below
    }
  } else {
    // Text-only milestone keepsake card graphic
    const fallbackGrad = ctx.createLinearGradient(padX, frameY, padX + innerW, frameY + frameH);
    fallbackGrad.addColorStop(0, '#0284c7');
    fallbackGrad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = fallbackGrad;
    ctx.fillRect(padX, frameY, innerW, frameH);

    ctx.fillStyle = '#fef08a';
    ctx.font = '700 44px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(
      opts.showChildName ? `${opts.childName}` : 'Milestone Moment',
      padX + 56,
      frameY + 120,
    );
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 66px "Plus Jakarta Sans", system-ui, sans-serif';
    const bigLines = wrapTextLines(ctx, opts.headline || 'Growing Taller Every Day!', innerW - 112, 4);
    bigLines.forEach((line, idx) => {
      ctx.fillText(line, padX + 56, frameY + 210 + idx * 82);
    });
  }

  // Height & Weight Bar tucked inside bottom of photo frame
  if (opts.includeMeasurements && opts.heightCm > 0) {
    const metricLineParts: string[] = [
      `${formatFeetInches(opts.heightCm)} (${formatTotalInches(opts.heightCm)})`,
    ];
    if (opts.weightKg > 0) {
      metricLineParts.push(formatPounds(opts.weightKg));
    }
    const deltaCm = opts.heightCm - opts.ageTwoHeightCm;
    if (opts.includeGrowthGain && deltaCm >= 0.4) {
      metricLineParts.push(`${formatHeightDelta(deltaCm, 'imperial')} since Age 2`);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 34px "JetBrains Mono", ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(metricLineParts.join('  ·  '), padX + 42, frameY + frameH - 72);
  }

  ctx.restore();

  // Crisp subtle border around frame
  drawRoundedRect(ctx, padX, frameY, innerW, frameH, 34);
  ctx.lineWidth = 4;
  ctx.strokeStyle = p.border;
  ctx.stroke();

  // 4. Story / Event Headline & Caption Card below photo
  const storyY = frameY + frameH + 34;
  const storyH = height - storyY - (opts.format === 'story_9_16' ? 92 : 58);

  drawRoundedRect(ctx, padX, storyY, innerW, storyH, 28);
  ctx.fillStyle = p.cardBg;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = p.border;
  ctx.stroke();

  let textCursorY = storyY + 42;
  const textX = padX + 44;
  const textMaxW = innerW - 88;

  const displayHeadline =
    opts.headline.trim() ||
    (opts.showChildName
      ? `${opts.childName} — ${formatAgeLabel(opts.ageMonths)}`
      : `Milestone — ${formatAgeLabel(opts.ageMonths)}`);

  ctx.fillStyle = p.title;
  ctx.font = '700 42px "Plus Jakarta Sans", system-ui, sans-serif';
  const headlineLines = wrapTextLines(ctx, displayHeadline, textMaxW, 2);
  for (const line of headlineLines) {
    ctx.fillText(line, textX, textCursorY);
    textCursorY += 54;
  }

  if (opts.caption.trim()) {
    textCursorY += 12;
    ctx.fillStyle = p.body;
    ctx.font = '500 30px "Plus Jakarta Sans", system-ui, sans-serif';
    const captionLines = wrapTextLines(
      ctx,
      opts.caption.trim(),
      textMaxW,
      opts.format === 'story_9_16' ? 5 : 3,
    );
    for (const line of captionLines) {
      ctx.fillText(line, textX, textCursorY);
      textCursorY += 42;
    }
  }

  // Quiet bottom footer line inside card
  ctx.fillStyle = p.muted;
  ctx.font = '600 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    'Tracked with SproutScale Family Growth Wall',
    textX,
    storyY + storyH - 52,
  );

  return canvas.toDataURL('image/jpeg', 0.92);
}

export function dataUrlToJpegFile(dataUrl: string, fileName: string): File {
  const [header, base64] = dataUrl.split(',');
  const mime = header?.match(/data:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(base64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mime });
}
