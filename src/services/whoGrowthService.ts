import { BiologicalSex, clampNumber } from '../types';

export interface LmsKnot {
  ageMonths: number;
  L: number;
  M: number;
  S: number;
}

export interface WhoPercentileResult {
  percentile: number; // 0.1 .. 99.9
  roundedPercentile: number; // 1 .. 99
  ordinalLabel: string; // e.g. "64th", "<1st", ">99th"
  zScore: number;
  medianValue: number; // 50th percentile peer median (cm or kg)
  p3Value: number;
  p15Value: number;
  p85Value: number;
  p97Value: number;
  deltaFromMedian: number;
  bandSummary: string; // Plain-English clinical/peer interpretation
  peerRoomComparison: string; // e.g. "Taller than about 64 out of 100 peers the same age"
  standardSourceLabel: string; // e.g. "WHO Child Growth Standards (0–5 yrs)" or "WHO Growth Reference (5–19 yrs)"
}

export interface WhoChildPeerEvaluation {
  height: WhoPercentileResult;
  weight: WhoPercentileResult;
  sexUsed: BiologicalSex;
  effectiveAgeMonths: number;
}

/**
 * WHO Child Growth Standards (2006, 0–60 mos; standing height from 24m+)
 * and WHO Growth Reference (2007, 61–216 mos) — Boys Length/Height-for-Age (cm)
 */
const BOYS_HEIGHT_LMS: LmsKnot[] = [
  { ageMonths: 0, L: 1, M: 49.88, S: 0.03795 },
  { ageMonths: 3, L: 1, M: 61.43, S: 0.03328 },
  { ageMonths: 6, L: 1, M: 67.62, S: 0.03165 },
  { ageMonths: 9, L: 1, M: 71.97, S: 0.03093 },
  { ageMonths: 12, L: 1, M: 75.75, S: 0.03152 },
  { ageMonths: 18, L: 1, M: 82.26, S: 0.03295 },
  { ageMonths: 24, L: 1, M: 87.12, S: 0.03516 },
  { ageMonths: 30, L: 1, M: 91.91, S: 0.03695 },
  { ageMonths: 36, L: 1, M: 96.08, S: 0.03858 },
  { ageMonths: 42, L: 1, M: 99.85, S: 0.03982 },
  { ageMonths: 48, L: 1, M: 103.33, S: 0.04084 },
  { ageMonths: 54, L: 1, M: 106.69, S: 0.04178 },
  { ageMonths: 60, L: 1, M: 109.96, S: 0.04263 },
  { ageMonths: 66, L: 1, M: 112.92, S: 0.04320 },
  { ageMonths: 72, L: 1, M: 116.00, S: 0.04386 },
  { ageMonths: 78, L: 1, M: 118.93, S: 0.04453 },
  { ageMonths: 84, L: 1, M: 121.74, S: 0.04519 },
  { ageMonths: 90, L: 1, M: 124.49, S: 0.04582 },
  { ageMonths: 96, L: 1, M: 127.27, S: 0.04642 },
  { ageMonths: 102, L: 1, M: 129.92, S: 0.04700 },
  { ageMonths: 108, L: 1, M: 132.56, S: 0.04756 },
  { ageMonths: 114, L: 1, M: 135.16, S: 0.04809 },
  { ageMonths: 120, L: 1, M: 137.78, S: 0.04861 },
  { ageMonths: 132, L: 1, M: 143.12, S: 0.04964 },
  { ageMonths: 144, L: 1, M: 149.08, S: 0.05070 },
  { ageMonths: 156, L: 1, M: 156.04, S: 0.05121 },
  { ageMonths: 168, L: 1, M: 163.18, S: 0.04972 },
  { ageMonths: 180, L: 1, M: 168.96, S: 0.04691 },
  { ageMonths: 192, L: 1, M: 172.90, S: 0.04425 },
  { ageMonths: 204, L: 1, M: 175.16, S: 0.04248 },
  { ageMonths: 216, L: 1, M: 176.14, S: 0.04155 },
];

/**
 * WHO Child Growth Standards (2006) & WHO Growth Reference (2007) — Girls Length/Height-for-Age (cm)
 */
const GIRLS_HEIGHT_LMS: LmsKnot[] = [
  { ageMonths: 0, L: 1, M: 49.15, S: 0.03790 },
  { ageMonths: 3, L: 1, M: 59.80, S: 0.03486 },
  { ageMonths: 6, L: 1, M: 65.73, S: 0.03408 },
  { ageMonths: 9, L: 1, M: 70.14, S: 0.03376 },
  { ageMonths: 12, L: 1, M: 74.02, S: 0.03434 },
  { ageMonths: 18, L: 1, M: 80.71, S: 0.03556 },
  { ageMonths: 24, L: 1, M: 85.72, S: 0.03728 },
  { ageMonths: 30, L: 1, M: 90.69, S: 0.03866 },
  { ageMonths: 36, L: 1, M: 95.05, S: 0.03981 },
  { ageMonths: 42, L: 1, M: 99.04, S: 0.04088 },
  { ageMonths: 48, L: 1, M: 102.73, S: 0.04182 },
  { ageMonths: 54, L: 1, M: 106.19, S: 0.04269 },
  { ageMonths: 60, L: 1, M: 109.43, S: 0.04347 },
  { ageMonths: 66, L: 1, M: 112.28, S: 0.04416 },
  { ageMonths: 72, L: 1, M: 115.12, S: 0.04488 },
  { ageMonths: 78, L: 1, M: 117.98, S: 0.04560 },
  { ageMonths: 84, L: 1, M: 120.82, S: 0.04628 },
  { ageMonths: 90, L: 1, M: 123.70, S: 0.04692 },
  { ageMonths: 96, L: 1, M: 126.58, S: 0.04751 },
  { ageMonths: 102, L: 1, M: 129.47, S: 0.04804 },
  { ageMonths: 108, L: 1, M: 132.49, S: 0.04850 },
  { ageMonths: 114, L: 1, M: 135.63, S: 0.04885 },
  { ageMonths: 120, L: 1, M: 138.64, S: 0.04894 },
  { ageMonths: 132, L: 1, M: 145.00, S: 0.04799 },
  { ageMonths: 144, L: 1, M: 151.23, S: 0.04566 },
  { ageMonths: 156, L: 1, M: 156.39, S: 0.04321 },
  { ageMonths: 168, L: 1, M: 159.79, S: 0.04141 },
  { ageMonths: 180, L: 1, M: 161.67, S: 0.04037 },
  { ageMonths: 192, L: 1, M: 162.52, S: 0.03988 },
  { ageMonths: 204, L: 1, M: 162.86, S: 0.03970 },
  { ageMonths: 216, L: 1, M: 163.06, S: 0.03963 },
];

/**
 * WHO Weight-for-Age (0–120 mos) + Extended Pediatric LMS Reference (121–216 mos) — Boys (kg)
 */
const BOYS_WEIGHT_LMS: LmsKnot[] = [
  { ageMonths: 0, L: 0.3487, M: 3.346, S: 0.14602 },
  { ageMonths: 3, L: 0.1738, M: 6.376, S: 0.11727 },
  { ageMonths: 6, L: 0.1395, M: 7.934, S: 0.11316 },
  { ageMonths: 9, L: 0.1102, M: 8.901, S: 0.11126 },
  { ageMonths: 12, L: 0.0788, M: 9.648, S: 0.11159 },
  { ageMonths: 18, L: 0.0156, M: 10.938, S: 0.11456 },
  { ageMonths: 24, L: -0.0462, M: 12.152, S: 0.11805 },
  { ageMonths: 30, L: -0.1066, M: 13.308, S: 0.12136 },
  { ageMonths: 36, L: -0.1656, M: 14.343, S: 0.12437 },
  { ageMonths: 42, L: -0.2232, M: 15.335, S: 0.12731 },
  { ageMonths: 48, L: -0.2793, M: 16.339, S: 0.13039 },
  { ageMonths: 54, L: -0.3340, M: 17.345, S: 0.13367 },
  { ageMonths: 60, L: -0.3874, M: 18.337, S: 0.13709 },
  { ageMonths: 66, L: -0.4220, M: 19.44, S: 0.1408 },
  { ageMonths: 72, L: -0.4564, M: 20.51, S: 0.1449 },
  { ageMonths: 78, L: -0.4910, M: 21.69, S: 0.1494 },
  { ageMonths: 84, L: -0.5256, M: 22.89, S: 0.1544 },
  { ageMonths: 90, L: -0.5600, M: 24.16, S: 0.1598 },
  { ageMonths: 96, L: -0.5941, M: 25.42, S: 0.1657 },
  { ageMonths: 102, L: -0.6275, M: 26.74, S: 0.1720 },
  { ageMonths: 108, L: -0.6600, M: 28.11, S: 0.1786 },
  { ageMonths: 114, L: -0.6913, M: 29.60, S: 0.1854 },
  { ageMonths: 120, L: -0.7210, M: 31.16, S: 0.1924 },
  { ageMonths: 132, L: -0.7600, M: 35.30, S: 0.2010 },
  { ageMonths: 144, L: -0.7700, M: 40.30, S: 0.2060 },
  { ageMonths: 156, L: -0.7600, M: 45.60, S: 0.2040 },
  { ageMonths: 168, L: -0.7400, M: 51.20, S: 0.1970 },
  { ageMonths: 180, L: -0.7200, M: 56.50, S: 0.1880 },
  { ageMonths: 192, L: -0.7000, M: 61.10, S: 0.1800 },
  { ageMonths: 204, L: -0.6800, M: 64.80, S: 0.1750 },
  { ageMonths: 216, L: -0.6700, M: 67.30, S: 0.1720 },
];

/**
 * WHO Weight-for-Age (0–120 mos) + Extended Pediatric LMS Reference (121–216 mos) — Girls (kg)
 */
const GIRLS_WEIGHT_LMS: LmsKnot[] = [
  { ageMonths: 0, L: 0.3809, M: 3.232, S: 0.14171 },
  { ageMonths: 3, L: 0.1648, M: 5.846, S: 0.12619 },
  { ageMonths: 6, L: 0.0954, M: 7.297, S: 0.12204 },
  { ageMonths: 9, L: 0.0402, M: 8.225, S: 0.12056 },
  { ageMonths: 12, L: -0.0110, M: 8.948, S: 0.12172 },
  { ageMonths: 18, L: -0.0972, M: 10.231, S: 0.12553 },
  { ageMonths: 24, L: -0.1714, M: 11.478, S: 0.12926 },
  { ageMonths: 30, L: -0.2366, M: 12.690, S: 0.13283 },
  { ageMonths: 36, L: -0.2949, M: 13.850, S: 0.13634 },
  { ageMonths: 42, L: -0.3478, M: 14.970, S: 0.13998 },
  { ageMonths: 48, L: -0.3964, M: 16.070, S: 0.14385 },
  { ageMonths: 54, L: -0.4414, M: 17.160, S: 0.14802 },
  { ageMonths: 60, L: -0.4832, M: 18.219, S: 0.15251 },
  { ageMonths: 66, L: -0.5180, M: 19.22, S: 0.1572 },
  { ageMonths: 72, L: -0.5515, M: 20.23, S: 0.1623 },
  { ageMonths: 78, L: -0.5835, M: 21.30, S: 0.1678 },
  { ageMonths: 84, L: -0.6140, M: 22.43, S: 0.1736 },
  { ageMonths: 90, L: -0.6425, M: 23.68, S: 0.1798 },
  { ageMonths: 96, L: -0.6685, M: 25.04, S: 0.1862 },
  { ageMonths: 102, L: -0.6915, M: 26.55, S: 0.1928 },
  { ageMonths: 108, L: -0.7110, M: 28.20, S: 0.1993 },
  { ageMonths: 114, L: -0.7260, M: 30.01, S: 0.2055 },
  { ageMonths: 120, L: -0.7360, M: 31.86, S: 0.2112 },
  { ageMonths: 132, L: -0.7400, M: 36.90, S: 0.2140 },
  { ageMonths: 144, L: -0.7300, M: 41.80, S: 0.2100 },
  { ageMonths: 156, L: -0.7100, M: 46.10, S: 0.2010 },
  { ageMonths: 168, L: -0.6900, M: 49.60, S: 0.1920 },
  { ageMonths: 180, L: -0.6700, M: 52.10, S: 0.1840 },
  { ageMonths: 192, L: -0.6600, M: 53.90, S: 0.1790 },
  { ageMonths: 204, L: -0.6500, M: 55.10, S: 0.1760 },
  { ageMonths: 216, L: -0.6500, M: 56.20, S: 0.1750 },
];

function interpolateLms(knots: LmsKnot[], ageMonths: number): { L: number; M: number; S: number } {
  const safeAge = clampNumber(ageMonths, 0, 216);
  if (safeAge <= knots[0].ageMonths) {
    return { L: knots[0].L, M: knots[0].M, S: knots[0].S };
  }
  const last = knots[knots.length - 1];
  if (safeAge >= last.ageMonths) {
    return { L: last.L, M: last.M, S: last.S };
  }

  for (let i = 0; i < knots.length - 1; i += 1) {
    const a = knots[i];
    const b = knots[i + 1];
    if (safeAge >= a.ageMonths && safeAge <= b.ageMonths) {
      const span = b.ageMonths - a.ageMonths;
      const t = span > 0 ? (safeAge - a.ageMonths) / span : 0;
      return {
        L: a.L + (b.L - a.L) * t,
        M: a.M + (b.M - a.M) * t,
        S: a.S + (b.S - a.S) * t,
      };
    }
  }
  return { L: last.L, M: last.M, S: last.S };
}

function getBlendedLms(
  metric: 'height' | 'weight',
  sex: BiologicalSex,
  ageMonths: number,
): { L: number; M: number; S: number } {
  if (metric === 'height') {
    if (sex === 'boy') return interpolateLms(BOYS_HEIGHT_LMS, ageMonths);
    if (sex === 'girl') return interpolateLms(GIRLS_HEIGHT_LMS, ageMonths);
    const b = interpolateLms(BOYS_HEIGHT_LMS, ageMonths);
    const g = interpolateLms(GIRLS_HEIGHT_LMS, ageMonths);
    return {
      L: (b.L + g.L) / 2,
      M: (b.M + g.M) / 2,
      S: (b.S + g.S) / 2,
    };
  }

  if (sex === 'boy') return interpolateLms(BOYS_WEIGHT_LMS, ageMonths);
  if (sex === 'girl') return interpolateLms(GIRLS_WEIGHT_LMS, ageMonths);
  const b = interpolateLms(BOYS_WEIGHT_LMS, ageMonths);
  const g = interpolateLms(GIRLS_WEIGHT_LMS, ageMonths);
  return {
    L: (b.L + g.L) / 2,
    M: (b.M + g.M) / 2,
    S: (b.S + g.S) / 2,
  };
}

/**
 * Inverse LMS: computes measurement X corresponding to a given Z-score.
 */
export function lmsZScoreToValue(
  lms: { L: number; M: number; S: number },
  z: number,
): number {
  const { L, M, S } = lms;
  if (Math.abs(L) < 1e-6) {
    return M * Math.exp(S * z);
  }
  const base = 1 + L * S * z;
  if (base <= 0.01) {
    return M * Math.pow(0.01, 1 / L);
  }
  return M * Math.pow(base, 1 / L);
}

/**
 * Official WHO Cole LMS Z-score with WHO outer-tail (>3 SD / <-3 SD) linearization
 * so extreme weight measurements never distort due to Box-Cox skewness.
 */
function valueToWhoZScore(
  value: number,
  lms: { L: number; M: number; S: number },
  applyTailRestriction: boolean,
): number {
  const safeVal = Math.max(0.5, value);
  const { L, M, S } = lms;

  let zInd: number;
  if (Math.abs(L) < 1e-6) {
    zInd = Math.log(safeVal / M) / S;
  } else {
    zInd = (Math.pow(safeVal / M, L) - 1) / (L * S);
  }

  if (!applyTailRestriction || Math.abs(zInd) <= 3) {
    return clampNumber(zInd, -4.5, 4.5);
  }

  if (zInd > 3) {
    const sd3pos = lmsZScoreToValue(lms, 3);
    const sd2pos = lmsZScoreToValue(lms, 2);
    const sd23pos = Math.max(0.01, sd3pos - sd2pos);
    return clampNumber(3 + (safeVal - sd3pos) / sd23pos, -4.5, 4.5);
  }

  const sd3neg = lmsZScoreToValue(lms, -3);
  const sd2neg = lmsZScoreToValue(lms, -2);
  const sd23neg = Math.max(0.01, sd2neg - sd3neg);
  return clampNumber(-3 - (sd3neg - safeVal) / sd23neg, -4.5, 4.5);
}

/**
 * Standard Normal Cumulative Distribution Function Phi(z) (Abramowitz & Stegun 26.2.17)
 */
function normalCdf(z: number): number {
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.39894228;

  if (z >= 0) {
    const t = 1.0 / (1.0 + p * z);
    return (
      1.0 -
      c *
        Math.exp((-z * z) / 2.0) *
        t *
        (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1)
    );
  }
  const t = 1.0 / (1.0 - p * z);
  return (
    c *
    Math.exp((-z * z) / 2.0) *
    t *
    (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1)
  );
}

export function formatOrdinal(n: number): string {
  const rounded = clampNumber(Math.round(n), 1, 99);
  const mod100 = rounded % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${rounded}th`;
  }
  switch (rounded % 10) {
    case 1:
      return `${rounded}st`;
    case 2:
      return `${rounded}nd`;
    case 3:
      return `${rounded}rd`;
    default:
      return `${rounded}th`;
  }
}

function buildBandSummary(percentile: number, metric: 'height' | 'weight'): string {
  const word = metric === 'height' ? 'height' : 'weight';
  if (percentile < 3) {
    return `Petite frame — below the 3rd WHO peer ${word} band`;
  }
  if (percentile < 15) {
    return `Leaner / shorter side of typical WHO peer range (3rd–15th)`;
  }
  if (percentile <= 85) {
    return `Right inside the central WHO peer band (15th–85th)`;
  }
  if (percentile <= 97) {
    return `Above-average WHO peer range (85th–97th)`;
  }
  return `Top tier — above the 97th WHO peer ${word} band`;
}

export function calculateWhoMetricPercentile(
  metric: 'height' | 'weight',
  value: number,
  ageMonths: number,
  sex: BiologicalSex,
): WhoPercentileResult {
  const safeAge = clampNumber(ageMonths, 0, 216);
  const lms = getBlendedLms(metric, sex, safeAge);
  const zScore = valueToWhoZScore(value, lms, metric === 'weight');
  const rawPct = normalCdf(zScore) * 100;
  const percentile = Number(clampNumber(rawPct, 0.1, 99.9).toFixed(1));
  const roundedPercentile = clampNumber(Math.round(rawPct), 1, 99);

  let ordinalLabel = formatOrdinal(roundedPercentile);
  if (rawPct < 0.8) {
    ordinalLabel = '<1st';
  } else if (rawPct > 99.2) {
    ordinalLabel = '>99th';
  }

  // Standard WHO Z-score cutoffs: P3=-1.88079, P15=-1.03643, P50=0, P85=+1.03643, P97=+1.88079
  const p3Value = Number(lmsZScoreToValue(lms, -1.88079).toFixed(1));
  const p15Value = Number(lmsZScoreToValue(lms, -1.03643).toFixed(1));
  const medianValue = Number(lms.M.toFixed(1));
  const p85Value = Number(lmsZScoreToValue(lms, 1.03643).toFixed(1));
  const p97Value = Number(lmsZScoreToValue(lms, 1.88079).toFixed(1));
  const deltaFromMedian = Number((value - lms.M).toFixed(1));

  const peerRoomComparison =
    metric === 'height'
      ? `Taller than about ${roundedPercentile} out of 100 same-age peers`
      : `Heavier than about ${roundedPercentile} out of 100 same-age peers`;

  let standardSourceLabel = 'WHO Child Growth Standards (0–5 yrs)';
  if (safeAge > 60) {
    if (metric === 'weight' && safeAge > 120) {
      standardSourceLabel = 'WHO / Harmonized Pediatric Reference (10–18 yrs)';
    } else {
      standardSourceLabel = 'WHO Growth Reference (5–19 yrs)';
    }
  }

  return {
    percentile,
    roundedPercentile,
    ordinalLabel,
    zScore: Number(zScore.toFixed(2)),
    medianValue,
    p3Value,
    p15Value,
    p85Value,
    p97Value,
    deltaFromMedian,
    bandSummary: buildBandSummary(percentile, metric),
    peerRoomComparison,
    standardSourceLabel,
  };
}

export function evaluateChildWhoPercentiles(params: {
  heightCm: number;
  weightKg: number;
  ageMonths: number;
  sex: BiologicalSex;
}): WhoChildPeerEvaluation {
  const { heightCm, weightKg, ageMonths, sex } = params;
  return {
    height: calculateWhoMetricPercentile('height', heightCm, ageMonths, sex),
    weight: calculateWhoMetricPercentile('weight', weightKg, ageMonths, sex),
    sexUsed: sex,
    effectiveAgeMonths: clampNumber(ageMonths, 0, 216),
  };
}

/**
 * Generates reference curve points (P3, P15, P50, P85, P97) across an age range [minAge..maxAge]
 * for plotting WHO percentile reference bands on the Growth Timeline SVG chart.
 */
export function getWhoReferenceCurveSeries(
  metric: 'height' | 'weight',
  sex: BiologicalSex,
  minAgeMonths: number,
  maxAgeMonths: number,
  stepMonths = 6,
): {
  ageMonths: number;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
}[] {
  const start = clampNumber(Math.floor(minAgeMonths), 0, 210);
  const end = clampNumber(Math.ceil(maxAgeMonths), start + 6, 216);
  const series: {
    ageMonths: number;
    p3: number;
    p15: number;
    p50: number;
    p85: number;
    p97: number;
  }[] = [];

  for (let age = start; age <= end; age += stepMonths) {
    const lms = getBlendedLms(metric, sex, age);
    series.push({
      ageMonths: age,
      p3: Number(lmsZScoreToValue(lms, -1.88079).toFixed(1)),
      p15: Number(lmsZScoreToValue(lms, -1.03643).toFixed(1)),
      p50: Number(lms.M.toFixed(1)),
      p85: Number(lmsZScoreToValue(lms, 1.03643).toFixed(1)),
      p97: Number(lmsZScoreToValue(lms, 1.88079).toFixed(1)),
    });
  }

  if (series.length > 0 && series[series.length - 1].ageMonths < end) {
    const lms = getBlendedLms(metric, sex, end);
    series.push({
      ageMonths: end,
      p3: Number(lmsZScoreToValue(lms, -1.88079).toFixed(1)),
      p15: Number(lmsZScoreToValue(lms, -1.03643).toFixed(1)),
      p50: Number(lms.M.toFixed(1)),
      p85: Number(lmsZScoreToValue(lms, 1.03643).toFixed(1)),
      p97: Number(lmsZScoreToValue(lms, 1.88079).toFixed(1)),
    });
  }

  return series;
}

/**
 * Generates 10 peer sample heights (5th, 15th, 25th, 35th, 45th, 55th, 65th, 75th, 85th, 95th WHO percentiles)
 * so the UI can draw a visual 10-peer classroom lineup showing where the child stands!
 */
export function getWhoPeerClassroomLineupHeights(
  ageMonths: number,
  sex: BiologicalSex,
): { slotPercentile: number; heightCm: number }[] {
  const zTable: { slotPercentile: number; z: number }[] = [
    { slotPercentile: 5, z: -1.64485 },
    { slotPercentile: 15, z: -1.03643 },
    { slotPercentile: 25, z: -0.67449 },
    { slotPercentile: 35, z: -0.38532 },
    { slotPercentile: 45, z: -0.12566 },
    { slotPercentile: 55, z: 0.12566 },
    { slotPercentile: 65, z: 0.38532 },
    { slotPercentile: 75, z: 0.67449 },
    { slotPercentile: 85, z: 1.03643 },
    { slotPercentile: 95, z: 1.64485 },
  ];
  const lms = getBlendedLms('height', sex, clampNumber(ageMonths, 0, 216));
  return zTable.map((item) => ({
    slotPercentile: item.slotPercentile,
    heightCm: Number(lmsZScoreToValue(lms, item.z).toFixed(1)),
  }));
}
