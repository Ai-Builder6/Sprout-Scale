export interface PreparedWallPhoto {
  dataUrl: string;
  width: number;
  height: number;
}

export type WallCalibrationMode = 'kitchen_fridge' | 'general_wall';

export interface CalibratedLandmark {
  id: string;
  label: string;
  shortLabel: string;
  inchesFromFloor: number;
}

export interface CalibratedReferenceSpot {
  id: string;
  name: string;
  totalInches: number;
  totalLabel: string;
  notes: string;
  cleanPhotoUrl: string;
  tapeFullPhotoUrl: string;
  tapeCloseUpPhotoUrl: string;
  tapeStraightPhotoUrl: string;
  landmarks: CalibratedLandmark[];
}

export const CALIBRATED_FRIDGE_SPOT: CalibratedReferenceSpot = {
  id: 'kitchen_fridge_whirlpool_69',
  name: 'Our Kitchen Fridge (Whirlpool Stainless)',
  totalInches: 69.0,
  totalLabel: '5\' 9.0" (69.0 in)',
  notes:
    'Measured directly from your yellow measuring tape photos: 0.0" flat on the wood floor to 69.0" at the top lip of the stainless steel French-door fridge.',
  cleanPhotoUrl: '/assets/aistudio/IMG_9221_0b841dd9.jpeg',
  tapeFullPhotoUrl: '/assets/aistudio/IMG_9222_c34d3feb.jpeg',
  tapeCloseUpPhotoUrl: '/assets/aistudio/IMG_9223_5eee03ff.jpeg',
  tapeStraightPhotoUrl: '/assets/aistudio/IMG_9224_a1dba88f.jpeg',
  landmarks: [
    {
      id: 'top_door',
      label: 'Top lip of stainless fridge door',
      shortLabel: 'Fridge Top',
      inchesFromFloor: 69.0,
    },
    {
      id: 'yellow_chart_top',
      label: 'Top edge of Air Fryer Cooking Times chart',
      shortLabel: 'Top Chart Edge',
      inchesFromFloor: 68.5,
    },
    {
      id: 'yellow_chart_bottom',
      label: 'Bottom edge of top Air Fryer chart',
      shortLabel: 'Chart Bottom',
      inchesFromFloor: 62.5,
    },
    {
      id: 'vertical_handles_top',
      label: 'Top tips of vertical French door handles',
      shortLabel: 'Handles Top',
      inchesFromFloor: 61.5,
    },
    {
      id: 'red_magnet_top',
      label: 'Top red border of Measuring Lane magnet',
      shortLabel: 'Red Magnet Top',
      inchesFromFloor: 60.75,
    },
    {
      id: 'red_magnet_bottom',
      label: 'Bottom red border of Measuring Lane magnet',
      shortLabel: 'Red Magnet Bottom',
      inchesFromFloor: 54.5,
    },
    {
      id: 'vertical_handles_bottom',
      label: 'Bottom tips of vertical French door handles',
      shortLabel: 'Handles Bottom',
      inchesFromFloor: 30.5,
    },
    {
      id: 'freezer_seam',
      label: 'Horizontal seam above bottom freezer drawer',
      shortLabel: 'Freezer Seam',
      inchesFromFloor: 27.5,
    },
    {
      id: 'freezer_handle_top',
      label: 'Top edge of horizontal freezer handle',
      shortLabel: 'Freezer Handle Top',
      inchesFromFloor: 25.5,
    },
    {
      id: 'freezer_handle_bottom',
      label: 'Bottom edge of horizontal freezer handle (2F mark)',
      shortLabel: 'Freezer Handle',
      inchesFromFloor: 24.0,
    },
    {
      id: 'freezer_door_bottom',
      label: 'Bottom edge of stainless freezer door',
      shortLabel: 'Door Bottom',
      inchesFromFloor: 3.0,
    },
  ],
};

export interface WallHeightAiEstimate {
  fullBodyVisible: boolean;
  estimatedInches: number;
  estimatedCm: number;
  marginInches: number;
  confidence: 'high' | 'medium' | 'low';
  detectedReferenceLabel: string;
  detectedReferenceInches: number;
  usedCalibratedSpot?: boolean;
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
  category: 'fridge' | 'general';
  startsAtFloor?: boolean;
}

export const WALL_REFERENCE_PRESETS: WallReferencePreset[] = [
  {
    id: 'fridge_full',
    label: 'Fridge Door to Floor (69.0 in)',
    inches: 69.0,
    hint: 'Align REF TOP to the top edge of the stainless fridge door and REF BOTTOM to the wood floor (0").',
    category: 'fridge',
    startsAtFloor: true,
  },
  {
    id: 'fridge_upper_door',
    label: 'Upper Fridge Door (41.5 in)',
    inches: 41.5,
    hint: 'Align REF TOP to the top edge of the fridge door (69.0") and REF BOTTOM to the freezer seam (27.5").',
    category: 'fridge',
    startsAtFloor: false,
  },
  {
    id: 'fridge_vertical_handle',
    label: 'Vertical Handle Span (31.0 in)',
    inches: 31.0,
    hint: 'Align Amber bars to the top (61.5") and bottom (30.5") tips of the stainless French door handles.',
    category: 'fridge',
    startsAtFloor: false,
  },
  {
    id: 'fridge_freezer_seam',
    label: 'Freezer Seam to Floor (27.5 in)',
    inches: 27.5,
    hint: 'Align REF TOP to the dark gap between the freezer drawer and upper doors, and REF BOTTOM to the floor.',
    category: 'fridge',
    startsAtFloor: true,
  },
  {
    id: 'fridge_freezer_handle',
    label: 'Freezer Handle to Floor (24.0 in)',
    inches: 24.0,
    hint: 'Align REF TOP to the bottom edge of the horizontal freezer handle (2 ft mark) and REF BOTTOM to the floor.',
    category: 'fridge',
    startsAtFloor: true,
  },
  {
    id: 'paper_tall',
    label: 'Sheet of Paper (11.0 in)',
    inches: 11.0,
    hint: 'Tape a standard 8.5 × 11" sheet vertically against the wall beside your child.',
    category: 'general',
  },
  {
    id: 'ruler_12',
    label: '12-Inch Ruler (12.0 in)',
    inches: 12.0,
    hint: 'Hold or tape a standard 1-foot school ruler flat on the wall.',
    category: 'general',
  },
  {
    id: 'doorknob_floor',
    label: 'Doorknob to Floor (36.0 in)',
    inches: 36.0,
    hint: 'Align the Amber lines from the center of a standard doorknob to the floor.',
    category: 'general',
    startsAtFloor: true,
  },
  {
    id: 'switch_floor',
    label: 'Light Switch to Floor (48.0 in)',
    inches: 48.0,
    hint: 'Align the Amber lines from the center of a standard wall light switch to the floor.',
    category: 'general',
    startsAtFloor: true,
  },
  {
    id: 'door_frame',
    label: 'Interior Door (80.0 in)',
    inches: 80.0,
    hint: 'Align the Amber lines from the top inside edge of a standard 6\'8" door frame to the floor.',
    category: 'general',
    startsAtFloor: true,
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
  calibrationMode?: WallCalibrationMode;
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
