export interface PreparedWallPhoto {
  dataUrl: string;
  width: number;
  height: number;
}

export interface WallHeightAiEstimate {
  fullBodyVisible: boolean;
  estimatedInches: number;
  estimatedCm: number;
  marginInches: number;
  confidence: 'high' | 'medium' | 'low';
  detectedReferenceLabel: string;
  detectedReferenceInches: number;
  childCrownRatioY: number;
  childHeelRatioY: number;
  refTopRatioY: number;
  refBottomRatioY: number;
  explanation: string;
}

export interface WallReferencePreset {
  id: string;
  label: string;
  inches: number;
  hint: string;
}

export const WALL_REFERENCE_PRESETS: WallReferencePreset[] = [
  {
    id: 'paper_tall',
    label: 'Sheet of Paper (11 in)',
    inches: 11.0,
    hint: 'Tape a standard 8.5 × 11" sheet vertically against the wall beside your child.',
  },
  {
    id: 'ruler_12',
    label: '12-Inch Ruler (12 in)',
    inches: 12.0,
    hint: 'Hold or tape a standard 1-foot school ruler flat on the wall.',
  },
  {
    id: 'dollar_bill',
    label: 'US Dollar Bill (6.14 in)',
    inches: 6.14,
    hint: 'Tape a dollar bill vertically flat against the wall at shoulder height.',
  },
  {
    id: 'doorknob_floor',
    label: 'Doorknob to Floor (36 in)',
    inches: 36.0,
    hint: 'Align the Amber lines from the center of a standard doorknob to the floor.',
  },
  {
    id: 'switch_floor',
    label: 'Light Switch to Floor (48 in)',
    inches: 48.0,
    hint: 'Align the Amber lines from the center of a standard wall light switch to the floor.',
  },
  {
    id: 'door_frame',
    label: 'Interior Door (80 in)',
    inches: 80.0,
    hint: 'Align the Amber lines from the top inside edge of a standard 6\'8" door frame to the floor.',
  },
];

export function formatInchesDetailed(inches: number): {
  totalInchesLabel: string;
  feetInchesLabel: string;
  cmLabel: string;
} {
  const safeIn = Math.max(0, inches);
  const feet = Math.floor(safeIn / 12);
  const remIn = safeIn - feet * 12;
  const feetInchesLabel =
    remIn >= 11.95 ? `${feet + 1}' 0.0"` : `${feet}' ${remIn.toFixed(1)}"`;
  const cm = safeIn * 2.54;
  return {
    totalInchesLabel: `${safeIn.toFixed(1)} in`,
    feetInchesLabel,
    cmLabel: `${cm.toFixed(1)} cm`,
  };
}

/**
 * Resizes an uploaded or captured wall photo to <= 1080px on its longest side
 * while preserving full uncropped aspect ratio (head to floor).
 */
export function prepareWallPhotoForAnalysis(sourceDataUrl: string): Promise<PreparedWallPhoto> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const natW = img.naturalWidth || img.width;
      const natH = img.naturalHeight || img.height;
      if (!natW || !natH) {
        reject(new Error('Invalid image dimensions.'));
        return;
      }

      const maxDim = 1080;
      const scale = Math.min(1, maxDim / Math.max(natW, natH));
      const outW = Math.max(1, Math.round(natW * scale));
      const outH = Math.max(1, Math.round(natH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable.'));
        return;
      }

      ctx.drawImage(img, 0, 0, outW, outH);
      const compressedUrl = canvas.toDataURL('image/jpeg', 0.86);
      resolve({
        dataUrl: compressedUrl,
        width: outW,
        height: outH,
      });
    };
    img.onerror = () => reject(new Error('Could not load wall photo.'));
    img.src = sourceDataUrl;
  });
}

export async function requestAiWallHeightEstimate(params: {
  imageDataUrl: string;
  ageMonths: number;
  childName: string;
}): Promise<WallHeightAiEstimate> {
  const res = await fetch('/api/estimate-wall-height', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<WallHeightAiEstimate> & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      data.error || `Wall photo analysis failed with status ${res.status}.`,
    );
  }

  return data as WallHeightAiEstimate;
}
