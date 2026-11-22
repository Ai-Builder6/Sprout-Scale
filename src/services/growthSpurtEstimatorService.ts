import {
  BiologicalSex,
  clampNumber,
  cmToInches,
  formatAgeLabel,
  VALIDATION_BOUNDS,
} from '../types';

interface LmsAnchor {
  ageMonths: number;
  L: number;
  M: number;
  S: number;
}

// WHO Child Growth Standards (12–60m) + WHO Reference (61–216m) Height-for-Age LMS anchors (cm)
const WHO_HEIGHT_LMS_BOYS: LmsAnchor[] = [
  { ageMonths: 12, L: 1, M: 75.7, S: 0.0329 },
  { ageMonths: 24, L: 1, M: 87.1, S: 0.0355 },
  { ageMonths: 36, L: 1, M: 96.1, S: 0.0386 },
  { ageMonths: 48, L: 1, M: 103.3, S: 0.0406 },
  { ageMonths: 60, L: 1, M: 110.0, S: 0.042 },
  { ageMonths: 72, L: 1, M: 116.0, S: 0.0429 },
  { ageMonths: 84, L: 1, M: 121.7, S: 0.0439 },
  { ageMonths: 96, L: 1, M: 127.3, S: 0.0449 },
  { ageMonths: 108, L: 1, M: 132.6, S: 0.0459 },
  { ageMonths: 120, L: 1, M: 137.8, S: 0.0469 },
  { ageMonths: 144, L: 1, M: 149.1, S: 0.0488 },
  { ageMonths: 168, L: 1, M: 163.2, S: 0.0472 },
  { ageMonths: 192, L: 1, M: 173.4, S: 0.0428 },
  { ageMonths: 216, L: 1, M: 176.1, S: 0.0412 },
];

const WHO_HEIGHT_LMS_GIRLS: LmsAnchor[] = [
  { ageMonths: 12, L: 1, M: 74.0, S: 0.0348 },
  { ageMonths: 24, L: 1, M: 85.7, S: 0.0376 },
  { ageMonths: 36, L: 1, M: 95.1, S: 0.0398 },
  { ageMonths: 48, L: 1, M: 102.7, S: 0.0416 },
  { ageMonths: 60, L: 1, M: 109.4, S: 0.0431 },
  { ageMonths: 72, L: 1, M: 115.1, S: 0.0442 },
  { ageMonths: 84, L: 1, M: 120.8, S: 0.0452 },
  { ageMonths: 96, L: 1, M: 126.6, S: 0.0461 },
  { ageMonths: 108, L: 1, M: 132.5, S: 0.0469 },
  { ageMonths: 120, L: 1, M: 138.6, S: 0.0472 },
  { ageMonths: 144, L: 1, M: 151.2, S: 0.0447 },
  { ageMonths: 168, L: 1, M: 159.8, S: 0.0418 },
  { ageMonths: 192, L: 1, M: 162.5, S: 0.0408 },
  { ageMonths: 216, L: 1, M: 163.2, S: 0.0405 },
];

const WHO_WEIGHT_LMS_BOYS: LmsAnchor[] = [
  { ageMonths: 12, L: -0.0738, M: 9.6, S: 0.1128 },
  { ageMonths: 24, L: -0.202, M: 12.2, S: 0.1142 },
  { ageMonths: 36, L: -0.1813, M: 14.3, S: 0.1186 },
  { ageMonths: 48, L: -0.2188, M: 16.3, S: 0.125 },
  { ageMonths: 60, L: -0.2768, M: 18.3, S: 0.1333 },
  { ageMonths: 72, L: -0.4508, M: 20.5, S: 0.1411 },
  { ageMonths: 84, L: -0.6305, M: 22.9, S: 0.1492 },
  { ageMonths: 96, L: -0.785, M: 25.4, S: 0.1588 },
  { ageMonths: 108, L: -0.902, M: 28.1, S: 0.1695 },
  { ageMonths: 120, L: -0.978, M: 31.2, S: 0.1802 },
  { ageMonths: 144, L: -0.92, M: 39.9, S: 0.192 },
  { ageMonths: 168, L: -0.78, M: 50.8, S: 0.186 },
  { ageMonths: 192, L: -0.68, M: 60.8, S: 0.168 },
  { ageMonths: 216, L: -0.62, M: 67.2, S: 0.158 },
];

const WHO_WEIGHT_LMS_GIRLS: LmsAnchor[] = [
  { ageMonths: 12, L: -0.1891, M: 8.9, S: 0.1213 },
  { ageMonths: 24, L: -0.3186, M: 11.5, S: 0.1235 },
  { ageMonths: 36, L: -0.3833, M: 13.9, S: 0.1286 },
  { ageMonths: 48, L: -0.4404, M: 16.1, S: 0.1363 },
  { ageMonths: 60, L: -0.4981, M: 18.2, S: 0.1458 },
  { ageMonths: 72, L: -0.614, M: 20.2, S: 0.1545 },
  { ageMonths: 84, L: -0.735, M: 22.4, S: 0.1648 },
  { ageMonths: 96, L: -0.836, M: 25.0, S: 0.1764 },
  { ageMonths: 108, L: -0.892, M: 28.2, S: 0.1875 },
  { ageMonths: 120, L: -0.898, M: 31.9, S: 0.1956 },
  { ageMonths: 144, L: -0.82, M: 41.5, S: 0.194 },
  { ageMonths: 168, L: -0.74, M: 49.4, S: 0.175 },
  { ageMonths: 192, L: -0.69, M: 53.8, S: 0.162 },
  { ageMonths: 216, L: -0.66, M: 56.2, S: 0.156 },
];

export type SpurtTimingPreset =
  | 'auto'
  | 'early_toddler'
  | 'mid_childhood'
  | 'recent_leap'
  | 'steady';

export interface EstimatedTrajectoryPoint {
  ageMonths: number;
  label: string;
  estimatedHeightCm: number;
  estimatedWeightKg: number;
  steadyWhoHeightCm: number;
  isAgeOneAnchor: boolean;
  isAgeTwoEstimate: boolean;
  isLaterPhotoAnchor: boolean;
}

export interface EstimatedGrowthInterval {
  fromAgeMonths: number;
  toAgeMonths: number;
  label: string;
  heightGainCm: number;
  heightVelocityInPerYr: number;
  heightVelocityCmPerYr: number;
  whoExpectedVelocityCmPerYr: number;
  surplusOverWhoCmPerYr: number;
  weightGainKg: number;
  isPeakSpurt: boolean;
}

export interface GrowthSpurtEstimateResult {
  estimatedAgeTwoHeightCm: number;
  estimatedAgeTwoWeightKg: number;
  totalHeightGainCm: number;
  totalWeightGainKg: number;
  spanYears: number;
  zScoreAtAgeOne: number;
  zScoreAtLater: number;
  zScoreShift: number;
  percentileAtAgeOne: number;
  percentileAtLater: number;
  points: EstimatedTrajectoryPoint[];
  intervals: EstimatedGrowthInterval[];
  peakSpurt: EstimatedGrowthInterval | null;
  spurtHeadline: string;
  spurtExplanation: string;
}

function interpolateLms(anchors: LmsAnchor[], ageMonths: number): LmsAnchor {
  if (ageMonths <= anchors[0].ageMonths) return anchors[0];
  const last = anchors[anchors.length - 1];
  if (ageMonths >= last.ageMonths) return last;

  for (let i = 0; i < anchors.length - 1; i += 1) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (ageMonths >= a.ageMonths && ageMonths <= b.ageMonths) {
      const ratio = (ageMonths - a.ageMonths) / Math.max(1, b.ageMonths - a.ageMonths);
      return {
        ageMonths,
        L: a.L + (b.L - a.L) * ratio,
        M: a.M + (b.M - a.M) * ratio,
        S: a.S + (b.S - a.S) * ratio,
      };
    }
  }
  return last;
}

function getCombinedLms(
  sex: BiologicalSex,
  ageMonths: number,
  metric: 'height' | 'weight',
): LmsAnchor {
  const boys = metric === 'height' ? WHO_HEIGHT_LMS_BOYS : WHO_WEIGHT_LMS_BOYS;
  const girls = metric === 'height' ? WHO_HEIGHT_LMS_GIRLS : WHO_WEIGHT_LMS_GIRLS;
  if (sex === 'boy') return interpolateLms(boys, ageMonths);
  if (sex === 'girl') return interpolateLms(girls, ageMonths);
  const b = interpolateLms(boys, ageMonths);
  const g = interpolateLms(girls, ageMonths);
  return {
    ageMonths,
    L: (b.L + g.L) / 2,
    M: (b.M + g.M) / 2,
    S: (b.S + g.S) / 2,
  };
}

function lmsToZScore(value: number, lms: LmsAnchor): number {
  const safeVal = Math.max(0.1, value);
  if (Math.abs(lms.L) < 1e-5) {
    return Math.log(safeVal / lms.M) / lms.S;
  }
  return (Math.pow(safeVal / lms.M, lms.L) - 1) / (lms.L * lms.S);
}

function zScoreToValue(z: number, lms: LmsAnchor): number {
  const clampedZ = clampNumber(z, -4.5, 4.5);
  if (Math.abs(lms.L) < 1e-5) {
    return lms.M * Math.exp(lms.S * clampedZ);
  }
  const inner = Math.max(0.15, 1 + lms.L * lms.S * clampedZ);
  return lms.M * Math.pow(inner, 1 / lms.L);
}

function standardNormalCdf(z: number): number {
  const clampedZ = Math.max(-6, Math.min(6, z));
  const sign = clampedZ < 0 ? -1 : 1;
  const x = Math.abs(clampedZ) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t) *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

function zScoreToPercentile(z: number): number {
  return Math.max(1, Math.min(99, Math.round(standardNormalCdf(z) * 100)));
}

/**
 * Smooth normalized S-curve mapping u in [0, 1] -> [0, 1] with steepness k centered at c.
 * Guarantees exact endpoints S(0) = 0 and S(1) = 1.
 */
function normalizedLogisticProgress(u: number, center: number, steepness: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const sig = (x: number) => 1 / (1 + Math.exp(-steepness * (x - center)));
  const s0 = sig(0);
  const s1 = sig(1);
  return (sig(u) - s0) / Math.max(1e-6, s1 - s0);
}

function getProgressWeight(
  u: number,
  preset: SpurtTimingPreset,
  spanMonths: number,
  zShift: number,
): number {
  switch (preset) {
    case 'steady':
      return u;
    case 'early_toddler':
      return normalizedLogisticProgress(u, 0.22, 6.2);
    case 'mid_childhood':
      return normalizedLogisticProgress(u, 0.52, 6.2);
    case 'recent_leap':
      return normalizedLogisticProgress(u, 0.78, 6.4);
    case 'auto':
    default: {
      // If the child jumped noticeably across WHO percentiles over 2+ years,
      // center a realistic growth-spurt S-curve; otherwise follow steady WHO tracking.
      if (Math.abs(zShift) >= 0.32 && spanMonths >= 24) {
        const center = spanMonths >= 42 ? 0.56 : 0.48;
        return normalizedLogisticProgress(u, center, 5.4);
      }
      return u;
    }
  }
}

export function getWhoMedianAtAge(
  sex: BiologicalSex,
  ageMonths: number,
): { heightCm: number; weightKg: number } {
  const hLms = getCombinedLms(sex, ageMonths, 'height');
  const wLms = getCombinedLms(sex, ageMonths, 'weight');
  return {
    heightCm: Number(hLms.M.toFixed(1)),
    weightKg: Number(wLms.M.toFixed(1)),
  };
}

/**
 * Suggests a realistic pediatric weight for a given height & age using WHO z-score coupling.
 */
export function estimateWeightFromHeightAndAge(
  sex: BiologicalSex,
  ageMonths: number,
  heightCm: number,
): number {
  const hLms = getCombinedLms(sex, ageMonths, 'height');
  const wLms = getCombinedLms(sex, ageMonths, 'weight');
  const hZ = clampNumber(lmsToZScore(heightCm, hLms), -2.5, 2.5);
  // Pediatric weight correlates ~0.72 with height-for-age z-score on average
  const estimatedKg = zScoreToValue(hZ * 0.72, wLms);
  return Number(
    clampNumber(
      estimatedKg,
      VALIDATION_BOUNDS.WEIGHT_KG_MIN,
      VALIDATION_BOUNDS.WEIGHT_KG_MAX,
    ).toFixed(1),
  );
}

function formatShortAge(ageMonths: number): string {
  const yrs = Math.floor(ageMonths / 12);
  const mos = ageMonths % 12;
  if (mos === 0) return `Age ${yrs}`;
  return `${yrs}y ${mos}m`;
}

export function estimateGrowthTrajectoryFromAgeOne(params: {
  sex: BiologicalSex;
  ageOneHeightCm: number;
  ageOneWeightKg: number;
  laterAgeMonths: number;
  laterHeightCm: number;
  laterWeightKg: number;
  spurtTiming?: SpurtTimingPreset;
}): GrowthSpurtEstimateResult {
  const {
    sex,
    ageOneHeightCm,
    ageOneWeightKg,
    laterHeightCm,
    laterWeightKg,
    spurtTiming = 'auto',
  } = params;

  const startMonths = 12;
  const endMonths = Math.max(25, Math.min(VALIDATION_BOUNDS.AGE_MONTHS_MAX, Math.round(params.laterAgeMonths)));
  const spanMonths = endMonths - startMonths;
  const spanYears = Number((spanMonths / 12).toFixed(2));

  const hLmsStart = getCombinedLms(sex, startMonths, 'height');
  const hLmsEnd = getCombinedLms(sex, endMonths, 'height');
  const wLmsStart = getCombinedLms(sex, startMonths, 'weight');
  const wLmsEnd = getCombinedLms(sex, endMonths, 'weight');

  const zH1 = lmsToZScore(ageOneHeightCm, hLmsStart);
  const zH2 = lmsToZScore(laterHeightCm, hLmsEnd);
  const zW1 = lmsToZScore(ageOneWeightKg, wLmsStart);
  const zW2 = lmsToZScore(laterWeightKg, wLmsEnd);
  const zShift = Number((zH2 - zH1).toFixed(2));

  // Build age checkpoints: 12m, 24m, 36m, ..., and endMonths
  const ageMarks: number[] = [12];
  for (let m = 24; m < endMonths; m += 12) {
    // Avoid a tiny 1-3 month sliver right before endMonths (except always keep Age 2 = 24m)
    if (m === 24 || endMonths - m >= 4) {
      ageMarks.push(m);
    }
  }
  if (ageMarks[ageMarks.length - 1] !== endMonths) {
    ageMarks.push(endMonths);
  }

  const rawPoints: EstimatedTrajectoryPoint[] = ageMarks.map((m) => {
    const u = (m - startMonths) / spanMonths;
    const progress = getProgressWeight(u, spurtTiming, spanMonths, zShift);
    const hLms = getCombinedLms(sex, m, 'height');
    const wLms = getCombinedLms(sex, m, 'weight');

    let estH: number;
    let estW: number;
    if (m === startMonths) {
      estH = ageOneHeightCm;
      estW = ageOneWeightKg;
    } else if (m === endMonths) {
      estH = laterHeightCm;
      estW = laterWeightKg;
    } else {
      const zH = zH1 + (zH2 - zH1) * progress;
      const zW = zW1 + (zW2 - zW1) * progress;
      estH = zScoreToValue(zH, hLms);
      estW = zScoreToValue(zW, wLms);
    }

    const steadyWhoH = m === startMonths ? ageOneHeightCm : zScoreToValue(zH1, hLms);

    return {
      ageMonths: m,
      label: formatShortAge(m),
      estimatedHeightCm: Number(estH.toFixed(1)),
      estimatedWeightKg: Number(estW.toFixed(1)),
      steadyWhoHeightCm: Number(steadyWhoH.toFixed(1)),
      isAgeOneAnchor: m === 12,
      isAgeTwoEstimate: m === 24,
      isLaterPhotoAnchor: m === endMonths,
    };
  });

  // Ensure monotonic non-decreasing heights between Age 1 and Later Photo
  for (let i = 1; i < rawPoints.length - 1; i += 1) {
    const prevH = rawPoints[i - 1].estimatedHeightCm;
    const nextH = rawPoints[rawPoints.length - 1].estimatedHeightCm;
    if (laterHeightCm >= ageOneHeightCm) {
      rawPoints[i].estimatedHeightCm = Number(
        clampNumber(rawPoints[i].estimatedHeightCm, prevH + 0.5, Math.max(prevH + 0.5, nextH - 0.5)).toFixed(1),
      );
    }
  }

  const ageTwoPoint = rawPoints.find((p) => p.ageMonths === 24);
  const estimatedAgeTwoHeightCm = Number(
    clampNumber(
      ageTwoPoint?.estimatedHeightCm ?? getWhoMedianAtAge(sex, 24).heightCm,
      VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MIN,
      VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MAX,
    ).toFixed(1),
  );
  const estimatedAgeTwoWeightKg = Number(
    clampNumber(
      ageTwoPoint?.estimatedWeightKg ?? getWhoMedianAtAge(sex, 24).weightKg,
      VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MIN,
      VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MAX,
    ).toFixed(1),
  );

  // Reflect clamped Age 2 values back into the chart point so card and curve match 100%
  if (ageTwoPoint) {
    ageTwoPoint.estimatedHeightCm = estimatedAgeTwoHeightCm;
    ageTwoPoint.estimatedWeightKg = estimatedAgeTwoWeightKg;
  }

  // Compute interval velocities & detect the most likely Growth Spurt window
  const intervals: EstimatedGrowthInterval[] = [];
  for (let i = 1; i < rawPoints.length; i += 1) {
    const prev = rawPoints[i - 1];
    const curr = rawPoints[i];
    const dtMonths = Math.max(1, curr.ageMonths - prev.ageMonths);
    const dtYears = dtMonths / 12;

    const hGainCm = Number((curr.estimatedHeightCm - prev.estimatedHeightCm).toFixed(1));
    const wGainKg = Number((curr.estimatedWeightKg - prev.estimatedWeightKg).toFixed(1));
    const hVelCmPerYr = Number((hGainCm / dtYears).toFixed(1));
    const hVelInPerYr = Number((cmToInches(hGainCm) / dtYears).toFixed(1));

    const whoPrevM = getCombinedLms(sex, prev.ageMonths, 'height').M;
    const whoCurrM = getCombinedLms(sex, curr.ageMonths, 'height').M;
    const whoVelCmPerYr = Number(((whoCurrM - whoPrevM) / dtYears).toFixed(1));
    const surplusOverWhoCmPerYr = Number((hVelCmPerYr - whoVelCmPerYr).toFixed(1));

    intervals.push({
      fromAgeMonths: prev.ageMonths,
      toAgeMonths: curr.ageMonths,
      label: `${formatShortAge(prev.ageMonths)} – ${formatShortAge(curr.ageMonths)}`,
      heightGainCm: hGainCm,
      heightVelocityInPerYr: hVelInPerYr,
      heightVelocityCmPerYr: hVelCmPerYr,
      whoExpectedVelocityCmPerYr: whoVelCmPerYr,
      surplusOverWhoCmPerYr,
      weightGainKg: wGainKg,
      isPeakSpurt: false,
    });
  }

  // Pick the Peak Growth Spurt window:
  // If user chose a specific spurt timing OR child had a genuine upward percentile jump (zShift >= 0.30),
  // score by surplus over WHO expected velocity; otherwise highlight highest natural velocity window.
  let peakIndex = -1;
  if (intervals.length > 0) {
    const useSurplusScore = spurtTiming !== 'steady' && (zShift >= 0.25 || spurtTiming !== 'auto');
    let bestScore = -Infinity;
    intervals.forEach((iv, idx) => {
      const score = useSurplusScore ? iv.surplusOverWhoCmPerYr : iv.heightVelocityCmPerYr;
      if (score > bestScore) {
        bestScore = score;
        peakIndex = idx;
      }
    });
    if (peakIndex >= 0) {
      intervals[peakIndex].isPeakSpurt = true;
    }
  }

  const peakSpurt = peakIndex >= 0 ? intervals[peakIndex] : null;
  const p1 = zScoreToPercentile(zH1);
  const p2 = zScoreToPercentile(zH2);

  let spurtHeadline = 'Steady Pediatric Growth Curve';
  let spurtExplanation =
    'Height tracked smoothly along a consistent WHO percentile curve from Age 1 to your later photo.';

  if (peakSpurt) {
    if (zShift >= 0.45) {
      spurtHeadline = `Likely Growth Spurt: ${peakSpurt.label}`;
      spurtExplanation = `Jumped from the ${p1}th to ${p2}th percentile (+${cmToInches(laterHeightCm - ageOneHeightCm).toFixed(1)} in over ${spanYears.toFixed(1)} yrs), with peak estimated surge of ~+${peakSpurt.heightVelocityInPerYr.toFixed(1)} in/yr during ${peakSpurt.label}.`;
    } else if (zShift >= 0.15) {
      spurtHeadline = `Strongest Growth Window: ${peakSpurt.label}`;
      spurtExplanation = `Climbed gently from the ${p1}th to ${p2}th percentile, with fastest estimated growth around ${peakSpurt.label} (~+${peakSpurt.heightVelocityInPerYr.toFixed(1)} in/yr).`;
    } else {
      spurtHeadline = `Fastest Natural Growth: ${peakSpurt.label}`;
      spurtExplanation = `Followed a steady curve from Age 1 to ${formatAgeLabel(endMonths)} (${p1}th → ${p2}th percentile), with biggest toddler stretch around ${peakSpurt.label} (~+${peakSpurt.heightVelocityInPerYr.toFixed(1)} in/yr).`;
    }
  }

  return {
    estimatedAgeTwoHeightCm,
    estimatedAgeTwoWeightKg,
    totalHeightGainCm: Number((laterHeightCm - ageOneHeightCm).toFixed(1)),
    totalWeightGainKg: Number((laterWeightKg - ageOneWeightKg).toFixed(1)),
    spanYears,
    zScoreAtAgeOne: Number(zH1.toFixed(2)),
    zScoreAtLater: Number(zH2.toFixed(2)),
    zScoreShift: zShift,
    percentileAtAgeOne: p1,
    percentileAtLater: p2,
    points: rawPoints,
    intervals,
    peakSpurt,
    spurtHeadline,
    spurtExplanation,
  };
}
