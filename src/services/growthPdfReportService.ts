import { jsPDF } from 'jspdf';
import {
  BiologicalSex,
  calculateExactAgeFromDob,
  ChildProfile,
  cmToInches,
  formatAgeLabel,
  formatFeetInches,
  formatHeightDelta,
  formatHumanDate,
  formatMetricHeight,
  formatMetricWeight,
  formatPounds,
  formatTotalInches,
  formatWeightDelta,
  getFunComparison,
  getGrowthStageInfo,
  getLocalTodayIso,
  GrowthMeasurement,
  inchesToCm,
  kgToLbs,
} from '../types';

interface LmsAnchor {
  ageMonths: number;
  L: number;
  M: number;
  S: number;
}

// WHO Child Growth Standards (24–60m) + WHO Reference (61–216m) Height-for-Age LMS anchors (cm)
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

// WHO Weight-for-Age (12–120m) + pediatric reference extension (121–216m) LMS anchors (kg)
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

function lmsZScore(val: number, lms: LmsAnchor): number {
  const safeVal = Math.max(0.1, val);
  if (Math.abs(lms.L) < 1e-5) {
    return Math.log(safeVal / lms.M) / lms.S;
  }
  return (Math.pow(safeVal / lms.M, lms.L) - 1) / (lms.L * lms.S);
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

export function formatOrdinalPercentile(percentile: number): string {
  const p = Math.max(1, Math.min(99, Math.round(percentile)));
  const mod100 = p % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${p}th`;
  switch (p % 10) {
    case 1:
      return `${p}st`;
    case 2:
      return `${p}nd`;
    case 3:
      return `${p}rd`;
    default:
      return `${p}th`;
  }
}

export function computeWhoPercentiles(
  ageMonths: number,
  heightCm: number,
  weightKg: number,
  sex: BiologicalSex,
): {
  heightPercentile: number;
  weightPercentile: number;
  heightOrdinal: string;
  weightOrdinal: string;
  curveLabel: string;
} {
  const safeAge = Math.max(12, Math.min(216, ageMonths));

  const zHeightBoy = lmsZScore(heightCm, interpolateLms(WHO_HEIGHT_LMS_BOYS, safeAge));
  const zHeightGirl = lmsZScore(heightCm, interpolateLms(WHO_HEIGHT_LMS_GIRLS, safeAge));
  const zHeight =
    sex === 'boy'
      ? zHeightBoy
      : sex === 'girl'
        ? zHeightGirl
        : (zHeightBoy + zHeightGirl) / 2;

  const zWeightBoy = lmsZScore(weightKg, interpolateLms(WHO_WEIGHT_LMS_BOYS, safeAge));
  const zWeightGirl = lmsZScore(weightKg, interpolateLms(WHO_WEIGHT_LMS_GIRLS, safeAge));
  const zWeight =
    sex === 'boy'
      ? zWeightBoy
      : sex === 'girl'
        ? zWeightGirl
        : (zWeightBoy + zWeightGirl) / 2;

  const heightPercentile = Math.max(1, Math.min(99, Math.round(standardNormalCdf(zHeight) * 100)));
  const weightPercentile = Math.max(1, Math.min(99, Math.round(standardNormalCdf(zWeight) * 100)));

  const curveLabel =
    sex === 'boy'
      ? 'WHO Boys Curve'
      : sex === 'girl'
        ? 'WHO Girls Curve'
        : 'WHO Combined Curve';

  return {
    heightPercentile,
    weightPercentile,
    heightOrdinal: formatOrdinalPercentile(heightPercentile),
    weightOrdinal: formatOrdinalPercentile(weightPercentile),
    curveLabel,
  };
}

export interface MilestoneReportRow {
  id: string;
  ageMonths: number;
  ageLabel: string;
  recordedDate: string;
  heightCm: number;
  weightKg: number;
  heightPrimary: string;
  heightSecondary: string;
  weightPrimary: string;
  weightSecondary: string;
  deltaImperial: string;
  deltaMetric: string;
  heightPercentileOrdinal: string;
  weightPercentileOrdinal: string;
  note: string;
}

export interface GrowthProgressSummary {
  generatedDateIso: string;
  generatedDateHuman: string;
  childName: string;
  birthDateHuman: string | null;
  exactAgeLabel: string;
  stageName: string;
  whoCurveLabel: string;
  milestoneCount: number;
  baselineHeightPrimary: string;
  baselineHeightSecondary: string;
  baselineWeightPrimary: string;
  baselineWeightSecondary: string;
  latestAgeLabel: string;
  latestDateLabel: string;
  latestHeightCm: number;
  latestWeightKg: number;
  latestHeightPrimary: string;
  latestHeightSecondary: string;
  latestWeightPrimary: string;
  latestWeightSecondary: string;
  totalHeightGainCm: number;
  totalHeightGainInches: number;
  totalHeightGainPrimary: string;
  totalHeightGainSecondary: string;
  heightPercentGain: number;
  totalWeightGainKg: number;
  totalWeightGainLbs: number;
  totalWeightGainPrimary: string;
  totalWeightGainSecondary: string;
  weightPercentGain: number;
  annualHeightVelocityPrimary: string | null;
  annualHeightVelocitySecondary: string | null;
  annualWeightVelocityPrimary: string | null;
  annualWeightVelocitySecondary: string | null;
  biggestSpurtLabel: string | null;
  latestHeightPercentileOrdinal: string;
  latestWeightPercentileOrdinal: string;
  narrativeSummary: string;
  funHeightFact: string;
  curvePoints: GrowthMeasurement[];
  rowsChronological: MilestoneReportRow[];
}

export function computeGrowthProgressSummary(
  childProfile: ChildProfile,
  measurements: GrowthMeasurement[],
): GrowthProgressSummary {
  const todayIso = getLocalTodayIso();
  const sortedAsc = [...measurements].sort((a, b) => a.ageMonths - b.ageMonths);
  const hasAge2Record = sortedAsc.some((m) => m.ageMonths === 24);

  const curvePoints: GrowthMeasurement[] = hasAge2Record
    ? sortedAsc
    : [
        {
          id: 'synthetic_age_2',
          ownerId: childProfile.ownerId,
          childId: childProfile.id,
          ageMonths: 24,
          heightCm: childProfile.ageTwoHeightCm,
          weightKg: childProfile.ageTwoWeightKg,
          recordedDate: 'Age 2 Baseline',
          note: 'Starting Age 2 height & weight baseline',
        },
        ...sortedAsc,
      ];

  const latestPoint = curvePoints[curvePoints.length - 1];
  const exactDob = childProfile.birthDate
    ? calculateExactAgeFromDob(childProfile.birthDate)
    : null;

  const displayAgeMonths = exactDob ? exactDob.totalMonths : latestPoint.ageMonths;
  const stageInfo = getGrowthStageInfo(displayAgeMonths);

  const latestWho = computeWhoPercentiles(
    latestPoint.ageMonths,
    latestPoint.heightCm,
    latestPoint.weightKg,
    childProfile.sex,
  );

  const totalHeightGainCm = latestPoint.heightCm - childProfile.ageTwoHeightCm;
  const totalHeightGainInches = cmToInches(totalHeightGainCm);
  const heightPercentGain =
    childProfile.ageTwoHeightCm > 0
      ? (totalHeightGainCm / childProfile.ageTwoHeightCm) * 100
      : 0;

  const totalWeightGainKg = latestPoint.weightKg - childProfile.ageTwoWeightKg;
  const totalWeightGainLbs = kgToLbs(totalWeightGainKg);
  const weightPercentGain =
    childProfile.ageTwoWeightKg > 0
      ? (totalWeightGainKg / childProfile.ageTwoWeightKg) * 100
      : 0;

  const spanMonths = Math.max(0, latestPoint.ageMonths - 24);
  const spanYears = spanMonths / 12;

  const annualHeightVelocityPrimary =
    spanMonths >= 3
      ? `+${(totalHeightGainInches / spanYears).toFixed(1)} in/yr`
      : null;
  const annualHeightVelocitySecondary =
    spanMonths >= 3 ? `+${(totalHeightGainCm / spanYears).toFixed(1)} cm/yr` : null;

  const annualWeightVelocityPrimary =
    spanMonths >= 3 ? `+${(totalWeightGainLbs / spanYears).toFixed(1)} lb/yr` : null;
  const annualWeightVelocitySecondary =
    spanMonths >= 3 ? `+${(totalWeightGainKg / spanYears).toFixed(1)} kg/yr` : null;

  let biggestSpurtLabel: string | null = null;
  if (curvePoints.length >= 2) {
    let maxGainIn = -Infinity;
    let bestFrom = curvePoints[0];
    let bestTo = curvePoints[1];
    for (let i = 0; i < curvePoints.length - 1; i += 1) {
      const diffIn = cmToInches(curvePoints[i + 1].heightCm - curvePoints[i].heightCm);
      if (diffIn > maxGainIn) {
        maxGainIn = diffIn;
        bestFrom = curvePoints[i];
        bestTo = curvePoints[i + 1];
      }
    }
    if (maxGainIn > 0.2) {
      biggestSpurtLabel = `+${maxGainIn.toFixed(1)} in between ${formatAgeLabel(bestFrom.ageMonths)} and ${formatAgeLabel(bestTo.ageMonths)}`;
    }
  }

  const funFacts = getFunComparison(
    latestPoint.heightCm,
    latestPoint.weightKg,
    childProfile.ageTwoHeightCm,
  );

  const rowsChronological: MilestoneReportRow[] = curvePoints.map((pt) => {
    const hDeltaCm = pt.heightCm - childProfile.ageTwoHeightCm;
    const wDeltaKg = pt.weightKg - childProfile.ageTwoWeightKg;
    const who = computeWhoPercentiles(
      pt.ageMonths,
      pt.heightCm,
      pt.weightKg,
      childProfile.sex,
    );

    return {
      id: pt.id,
      ageMonths: pt.ageMonths,
      ageLabel: formatAgeLabel(pt.ageMonths),
      recordedDate:
        pt.recordedDate === 'Age 2 Baseline'
          ? 'Age 2 Baseline'
          : formatHumanDate(pt.recordedDate),
      heightCm: pt.heightCm,
      weightKg: pt.weightKg,
      heightPrimary: `${formatFeetInches(pt.heightCm)} (${formatTotalInches(pt.heightCm)})`,
      heightSecondary: formatMetricHeight(pt.heightCm),
      weightPrimary: formatPounds(pt.weightKg),
      weightSecondary: formatMetricWeight(pt.weightKg),
      deltaImperial: `${formatHeightDelta(hDeltaCm, 'imperial')} · ${formatWeightDelta(wDeltaKg, 'imperial')}`,
      deltaMetric: `${formatHeightDelta(hDeltaCm, 'metric')} · ${formatWeightDelta(wDeltaKg, 'metric')}`,
      heightPercentileOrdinal: who.heightOrdinal,
      weightPercentileOrdinal: who.weightOrdinal,
      note: pt.note || '—',
    };
  });

  const baselineHeightPrimary = `${formatFeetInches(childProfile.ageTwoHeightCm)} (${formatTotalInches(childProfile.ageTwoHeightCm)})`;
  const latestHeightPrimary = `${formatFeetInches(latestPoint.heightCm)} (${formatTotalInches(latestPoint.heightCm)})`;

  const narrativeParts: string[] = [];
  if (totalHeightGainInches >= 0.3) {
    narrativeParts.push(
      `Since turning Age 2 (${baselineHeightPrimary}, ${formatPounds(childProfile.ageTwoWeightKg)}), ${childProfile.name} has grown ${formatHeightDelta(totalHeightGainCm, 'imperial')} (${heightPercentGain.toFixed(1)}% taller) and ${formatWeightDelta(totalWeightGainKg, 'imperial')} across ${curvePoints.length} recorded growth check-ins.`,
    );
  } else {
    narrativeParts.push(
      `${childProfile.name} is currently at their Age 2 starting baseline of ${latestHeightPrimary} and ${formatPounds(latestPoint.weightKg)}, ready to record upcoming growth milestones.`,
    );
  }

  narrativeParts.push(
    `At ${formatAgeLabel(latestPoint.ageMonths)}, ${childProfile.name} stands ${latestHeightPrimary} (${formatMetricHeight(latestPoint.heightCm)}) and weighs ${formatPounds(latestPoint.weightKg)} (${formatMetricWeight(latestPoint.weightKg)}), placing around the ${latestWho.heightOrdinal} percentile for height and ${latestWho.weightOrdinal} percentile for weight on the ${latestWho.curveLabel}.`,
  );

  if (annualHeightVelocityPrimary && annualWeightVelocityPrimary) {
    narrativeParts.push(
      `Average steady growth pace since Age 2 is ${annualHeightVelocityPrimary} (${annualHeightVelocitySecondary}) and ${annualWeightVelocityPrimary} (${annualWeightVelocitySecondary}).`,
    );
  }

  return {
    generatedDateIso: todayIso,
    generatedDateHuman: formatHumanDate(todayIso),
    childName: childProfile.name,
    birthDateHuman: childProfile.birthDate ? formatHumanDate(childProfile.birthDate) : null,
    exactAgeLabel: exactDob
      ? exactDob.formattedExactAge
      : formatAgeLabel(latestPoint.ageMonths),
    stageName: stageInfo.stageName,
    whoCurveLabel: latestWho.curveLabel,
    milestoneCount: curvePoints.length,
    baselineHeightPrimary,
    baselineHeightSecondary: formatMetricHeight(childProfile.ageTwoHeightCm),
    baselineWeightPrimary: formatPounds(childProfile.ageTwoWeightKg),
    baselineWeightSecondary: formatMetricWeight(childProfile.ageTwoWeightKg),
    latestAgeLabel: formatAgeLabel(latestPoint.ageMonths),
    latestDateLabel:
      latestPoint.recordedDate === 'Age 2 Baseline'
        ? 'Age 2 Baseline'
        : formatHumanDate(latestPoint.recordedDate),
    latestHeightCm: latestPoint.heightCm,
    latestWeightKg: latestPoint.weightKg,
    latestHeightPrimary,
    latestHeightSecondary: formatMetricHeight(latestPoint.heightCm),
    latestWeightPrimary: formatPounds(latestPoint.weightKg),
    latestWeightSecondary: formatMetricWeight(latestPoint.weightKg),
    totalHeightGainCm,
    totalHeightGainInches,
    totalHeightGainPrimary: formatHeightDelta(totalHeightGainCm, 'imperial'),
    totalHeightGainSecondary: formatHeightDelta(totalHeightGainCm, 'metric'),
    heightPercentGain,
    totalWeightGainKg,
    totalWeightGainLbs,
    totalWeightGainPrimary: formatWeightDelta(totalWeightGainKg, 'imperial'),
    totalWeightGainSecondary: formatWeightDelta(totalWeightGainKg, 'metric'),
    weightPercentGain,
    annualHeightVelocityPrimary,
    annualHeightVelocitySecondary,
    annualWeightVelocityPrimary,
    annualWeightVelocitySecondary,
    biggestSpurtLabel,
    latestHeightPercentileOrdinal: latestWho.heightOrdinal,
    latestWeightPercentileOrdinal: latestWho.weightOrdinal,
    narrativeSummary: narrativeParts.join(' '),
    funHeightFact: funFacts.heightFact,
    curvePoints,
    rowsChronological,
  };
}

function drawVectorChartInPdf(
  doc: jsPDF,
  box: { x: number; y: number; w: number; h: number },
  title: string,
  metric: 'height' | 'weight',
  curvePoints: GrowthMeasurement[],
  baselineCmOrKg: number,
  accentRgb: [number, number, number],
): void {
  // Card container
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(186, 230, 253);
  doc.setLineWidth(1);
  doc.roundedRect(box.x, box.y, box.w, box.h, 6, 6, 'FD');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 27, 75);
  doc.text(title, box.x + 10, box.y + 16);

  const plotLeft = box.x + 42;
  const plotRight = box.x + box.w - 14;
  const plotTop = box.y + 28;
  const plotBottom = box.y + box.h - 20;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  const minAge = Math.min(24, ...curvePoints.map((p) => p.ageMonths));
  const maxAge = Math.max(72, ...curvePoints.map((p) => p.ageMonths + 4));

  const values = curvePoints.map((p) =>
    metric === 'height' ? cmToInches(p.heightCm) : kgToLbs(p.weightKg),
  );
  const baseVal =
    metric === 'height' ? cmToInches(baselineCmOrKg) : kgToLbs(baselineCmOrKg);

  const minYVal = Math.floor(Math.min(baseVal, ...values) * 0.93);
  const maxYVal = Math.ceil(Math.max(baseVal + 5, ...values) * 1.05);

  const ageToX = (m: number) =>
    plotLeft + ((m - minAge) / Math.max(12, maxAge - minAge)) * plotW;
  const valToY = (v: number) =>
    plotBottom - ((v - minYVal) / Math.max(4, maxYVal - minYVal)) * plotH;

  // Horizontal grid lines & Y labels
  const tickRatios = [0, 0.33, 0.66, 1];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  for (const r of tickRatios) {
    const tv = minYVal + r * (maxYVal - minYVal);
    const ty = valToY(tv);
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.7);
    doc.line(plotLeft, ty, plotRight, ty);

    const yLabel =
      metric === 'height'
        ? formatFeetInches(inchesToCm(tv)).replace(' ', '')
        : `${tv.toFixed(0)} lb`;
    doc.setTextColor(100, 116, 139);
    doc.text(yLabel, plotLeft - 4, ty + 2.5, { align: 'right' });
  }

  // Trajectory segments
  if (curvePoints.length >= 2) {
    doc.setDrawColor(accentRgb[0], accentRgb[1], accentRgb[2]);
    doc.setLineWidth(2);
    for (let i = 0; i < curvePoints.length - 1; i += 1) {
      const p1 = curvePoints[i];
      const p2 = curvePoints[i + 1];
      const v1 = metric === 'height' ? cmToInches(p1.heightCm) : kgToLbs(p1.weightKg);
      const v2 = metric === 'height' ? cmToInches(p2.heightCm) : kgToLbs(p2.weightKg);
      doc.line(ageToX(p1.ageMonths), valToY(v1), ageToX(p2.ageMonths), valToY(v2));
    }
  }

  // Milestone nodes & X labels
  curvePoints.forEach((pt, idx) => {
    const val = metric === 'height' ? cmToInches(pt.heightCm) : kgToLbs(pt.weightKg);
    const cx = ageToX(pt.ageMonths);
    const cy = valToY(val);

    doc.setFillColor(250, 204, 21);
    doc.setDrawColor(accentRgb[0], accentRgb[1], accentRgb[2]);
    doc.setLineWidth(1.4);
    doc.circle(cx, cy, 3.2, 'FD');

    // Label first, last, and alternating points so text never collides
    const shouldShowLabel =
      curvePoints.length <= 6 || idx === 0 || idx === curvePoints.length - 1 || idx % 2 === 0;
    if (shouldShowLabel) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(15, 23, 42);
      const valText =
        metric === 'height' ? `${val.toFixed(1)}"` : `${val.toFixed(1)}lb`;
      doc.text(valText, cx, cy - 5.5, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      const ageShort = `${Math.floor(pt.ageMonths / 12)}y${pt.ageMonths % 12 ? `${pt.ageMonths % 12}m` : ''}`;
      doc.text(ageShort, cx, plotBottom + 11, { align: 'center' });
    }
  });
}

export function downloadPrintableGrowthPdfReport({
  childProfile,
  measurements,
  avatarPhotoUrl,
  parentVisitNote,
}: {
  childProfile: ChildProfile;
  measurements: GrowthMeasurement[];
  avatarPhotoUrl?: string | null;
  parentVisitNote?: string;
}): string {
  const summary = computeGrowthProgressSummary(childProfile, measurements);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter', // 612 x 792 pt
  });

  const pageW = 612;
  const pageH = 792;
  const marginX = 38;
  const contentW = pageW - marginX * 2; // 536 pt

  // 1. Top Header Banner
  doc.setFillColor(224, 242, 254); // sky-100
  doc.setDrawColor(125, 211, 252); // sky-300
  doc.setLineWidth(1.2);
  doc.roundedRect(marginX, 32, contentW, 82, 8, 8, 'FD');

  let textStartX = marginX + 16;
  if (avatarPhotoUrl && avatarPhotoUrl.startsWith('data:image/')) {
    try {
      const format = avatarPhotoUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(2, 132, 199);
      doc.roundedRect(marginX + 14, 44, 58, 58, 8, 8, 'FD');
      doc.addImage(avatarPhotoUrl, format, marginX + 16, 46, 54, 54);
      textStartX = marginX + 84;
    } catch {
      // Fallback gracefully if image cannot be decoded by jsPDF
      textStartX = marginX + 16;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(3, 105, 161);
  doc.text('SPROUTSCALE · PEDIATRIC & FAMILY GROWTH WALL REPORT', textStartX, 51);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 27, 75);
  doc.text(`${summary.childName}'s Growth Progress Report`, textStartX, 72);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const subMetaParts = [
    `Current Age: ${summary.exactAgeLabel}`,
    summary.birthDateHuman ? `DOB: ${summary.birthDateHuman}` : null,
    summary.stageName,
    summary.whoCurveLabel,
  ].filter(Boolean);
  doc.text(subMetaParts.join('  ·  '), textStartX, 88);

  doc.setFontSize(8.2);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Report Generated: ${summary.generatedDateHuman}  ·  Recorded Milestones: ${summary.milestoneCount}`,
    textStartX,
    102,
  );

  let cursorY = 128;

  // 2. Progress Summary Narrative Callout Box
  const trimmedVisitNote = (parentVisitNote ?? '').trim();
  const narrativeLines = doc.splitTextToSize(summary.narrativeSummary, contentW - 28) as string[];
  const visitNoteLines = trimmedVisitNote
    ? (doc.splitTextToSize(`Parent / Check-Up Note: ${trimmedVisitNote}`, contentW - 28) as string[])
    : [];

  const summaryBoxH =
    34 +
    narrativeLines.length * 12 +
    (visitNoteLines.length > 0 ? 10 + visitNoteLines.length * 11.5 : 0);

  doc.setFillColor(254, 252, 232); // warm amber-50
  doc.setDrawColor(253, 224, 71); // amber-300
  doc.setLineWidth(1);
  doc.roundedRect(marginX, cursorY, contentW, summaryBoxH, 7, 7, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 27, 75);
  doc.text('Executive Growth Progress Summary', marginX + 14, cursorY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(narrativeLines, marginX + 14, cursorY + 33);

  if (visitNoteLines.length > 0) {
    const noteY = cursorY + 33 + narrativeLines.length * 12 + 6;
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(8.5);
    doc.setTextColor(3, 105, 161);
    doc.text(visitNoteLines, marginX + 14, noteY);
  }

  cursorY += summaryBoxH + 12;

  // 3. Four-Card Key Metrics Row (Feet/Inches & Pounds Primary, cm/kg Secondary)
  const cardGap = 8;
  const cardW = (contentW - cardGap * 3) / 4;
  const cardH = 68;

  const metricCards = [
    {
      label: 'AGE 2 BASELINE',
      primary: summary.baselineHeightPrimary,
      secondary: `${summary.baselineWeightPrimary}  ·  ${summary.baselineHeightSecondary} / ${summary.baselineWeightSecondary}`,
      tertiary: 'Starting Wall Mark (24 mos)',
      accent: [2, 132, 199] as [number, number, number],
    },
    {
      label: `LATEST (${summary.latestAgeLabel.toUpperCase()})`,
      primary: summary.latestHeightPrimary,
      secondary: `${summary.latestWeightPrimary}  ·  ${summary.latestHeightSecondary} / ${summary.latestWeightSecondary}`,
      tertiary: summary.latestDateLabel,
      accent: [22, 163, 74] as [number, number, number],
    },
    {
      label: 'TOTAL GAINED SINCE AGE 2',
      primary: `${summary.totalHeightGainPrimary} · ${summary.totalWeightGainPrimary}`,
      secondary: `${summary.totalHeightGainSecondary} · ${summary.totalWeightGainSecondary}`,
      tertiary: `+${Math.max(0, summary.heightPercentGain).toFixed(1)}% taller since Age 2`,
      accent: [225, 29, 72] as [number, number, number],
    },
    {
      label: 'GROWTH PACE & WHO RANK',
      primary: `H: ${summary.latestHeightPercentileOrdinal} · W: ${summary.latestWeightPercentileOrdinal}`,
      secondary:
        summary.annualHeightVelocityPrimary && summary.annualWeightVelocityPrimary
          ? `${summary.annualHeightVelocityPrimary} · ${summary.annualWeightVelocityPrimary}`
          : 'Add future check-ins for annual velocity',
      tertiary: summary.whoCurveLabel,
      accent: [124, 58, 237] as [number, number, number],
    },
  ];

  metricCards.forEach((card, idx) => {
    const cx = marginX + idx * (cardW + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.9);
    doc.roundedRect(cx, cursorY, cardW, cardH, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(card.accent[0], card.accent[1], card.accent[2]);
    doc.text(card.label, cx + 8, cursorY + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(15, 23, 42);
    const pLines = doc.splitTextToSize(card.primary, cardW - 14) as string[];
    doc.text(pLines[0] ?? '', cx + 8, cursorY + 29);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.3);
    doc.setTextColor(71, 85, 105);
    const sLines = doc.splitTextToSize(card.secondary, cardW - 14) as string[];
    doc.text(sLines[0] ?? '', cx + 8, cursorY + 43);

    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    const tLines = doc.splitTextToSize(card.tertiary, cardW - 14) as string[];
    doc.text(tLines[0] ?? '', cx + 8, cursorY + 57);
  });

  cursorY += cardH + 14;

  // 4. Side-by-Side Vector Trajectory Charts (Height in ft/in & Weight in lb)
  const chartGap = 12;
  const chartW = (contentW - chartGap) / 2;
  const chartH = 148;

  drawVectorChartInPdf(
    doc,
    { x: marginX, y: cursorY, w: chartW, h: chartH },
    'Height Trajectory (Feet & Inches)',
    'height',
    summary.curvePoints,
    childProfile.ageTwoHeightCm,
    [2, 132, 199],
  );

  drawVectorChartInPdf(
    doc,
    { x: marginX + chartW + chartGap, y: cursorY, w: chartW, h: chartH },
    'Weight Trajectory (Pounds)',
    'weight',
    summary.curvePoints,
    childProfile.ageTwoWeightKg,
    [225, 29, 72],
  );

  cursorY += chartH + 18;

  // 5. Complete Chronological Growth Milestones Table (Auto-Paginating)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 27, 75);
  doc.text('Recorded Growth Wall Milestones (Imperial Primary · Metric Secondary)', marginX, cursorY);
  cursorY += 8;

  const colX = {
    ageDate: marginX + 6,
    height: marginX + 94,
    weight: marginX + 196,
    delta: marginX + 264,
    who: marginX + 356,
    note: marginX + 412,
  };

  const drawTableHeader = (y: number): number => {
    doc.setFillColor(224, 242, 254);
    doc.setDrawColor(186, 230, 253);
    doc.setLineWidth(0.8);
    doc.rect(marginX, y, contentW, 22, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 27, 75);
    doc.text('Age & Date', colX.ageDate, y + 14);
    doc.text('Height (ft & in)', colX.height, y + 14);
    doc.text('Weight (lb)', colX.weight, y + 14);
    doc.text('Since Age 2', colX.delta, y + 14);
    doc.text('WHO %ile', colX.who, y + 14);
    doc.text('Memory Note', colX.note, y + 14);
    return y + 22;
  };

  cursorY = drawTableHeader(cursorY);

  summary.rowsChronological.forEach((row, idx) => {
    const noteWrapped = doc.splitTextToSize(row.note, 118) as string[];
    const rowH = Math.max(30, 14 + noteWrapped.length * 9.5);

    if (cursorY + rowH > pageH - 48) {
      doc.addPage();
      cursorY = 42;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 27, 75);
      doc.text(
        `${summary.childName}'s Growth Milestones (Continued)`,
        marginX,
        cursorY,
      );
      cursorY = drawTableHeader(cursorY + 8);
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, cursorY, contentW, rowH, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(marginX, cursorY + rowH, marginX + contentW, cursorY + rowH);

    const topTextY = cursorY + 12;
    const subTextY = cursorY + 22.5;

    // Age & Date
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(row.ageLabel, colX.ageDate, topTextY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(row.recordedDate, colX.ageDate, subTextY);

    // Height
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(row.heightPrimary, colX.height, topTextY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(row.heightSecondary, colX.height, subTextY);

    // Weight
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(row.weightPrimary, colX.weight, topTextY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(row.weightSecondary, colX.weight, subTextY);

    // Delta since Age 2
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(4, 120, 87);
    doc.text(row.deltaImperial, colX.delta, topTextY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(row.deltaMetric, colX.delta, subTextY);

    // WHO Percentiles
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(3, 105, 161);
    doc.text(`H: ${row.heightPercentileOrdinal}`, colX.who, topTextY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    doc.text(`W: ${row.weightPercentileOrdinal}`, colX.who, subTextY);

    // Memory Note
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(51, 65, 85);
    doc.text(noteWrapped, colX.note, topTextY);

    cursorY += rowH;
  });

  // 6. Add Page Footers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.7);
    doc.line(marginX, pageH - 32, marginX + contentW, pageH - 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `SproutScale Family Growth Wall  ·  ${summary.childName}  ·  ${summary.funHeightFact}`,
      marginX,
      pageH - 19,
    );
    doc.text(`Page ${p} of ${totalPages}`, marginX + contentW, pageH - 19, {
      align: 'right',
    });
  }

  const safeSlug =
    childProfile.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32) || 'Child';
  const fileName = `SproutScale_${safeSlug}_Growth_Report_${summary.generatedDateIso}.pdf`;
  doc.save(fileName);
  return fileName;
}
