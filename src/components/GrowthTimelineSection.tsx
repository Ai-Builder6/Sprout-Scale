import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Camera,
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  Pencil,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  ChildPhotoRecord,
  ChildProfile,
  cmToInches,
  formatAgeLabel,
  formatFeetInches,
  formatHeightDelta,
  formatMetricHeight,
  formatMetricWeight,
  formatPounds,
  formatTotalInches,
  formatWeightDelta,
  GrowthMeasurement,
  inchesToCm,
  kgToLbs,
  lbsToKg,
  MilestoneEventRecord,
  splitCmToFeetAndInches,
  VALIDATION_BOUNDS,
} from '../types';
import {
  computeGrowthProgressSummary,
  downloadPrintableGrowthPdfReport,
} from '../services/growthPdfReportService';
import { GrowthReportModal } from './GrowthReportModal';
import { GrowthMusicKeepsakeCard } from './GrowthMusicKeepsakeCard';

export interface MeasurementEditPayload {
  ageMonths: number;
  heightCm: number;
  weightKg: number;
  recordedDate: string;
  note: string;
}

interface VelocityInterval {
  id: string;
  fromAgeMonths: number;
  toAgeMonths: number;
  spanMonths: number;
  shortLabel: string;
  rangeLabel: string;
  heightInPerYear: number;
  heightCmPerYear: number;
  weightLbPerYear: number;
  weightKgPerYear: number;
  toMeasurement: GrowthMeasurement;
}

interface GrowthTimelineSectionProps {
  childProfile: ChildProfile;
  measurements: GrowthMeasurement[];
  photos?: ChildPhotoRecord[];
  events?: MilestoneEventRecord[];
  avatarPhotoUrl?: string | null;
  onInspectMilestone: (measurement: GrowthMeasurement) => void;
  onUpdateMeasurement: (
    measurementId: string,
    updates: MeasurementEditPayload,
  ) => Promise<void>;
  onDeleteMeasurement: (measurementId: string) => Promise<void>;
  onAddPhotoForMilestone?: (measurement: GrowthMeasurement) => void;
  onEditAgeTwoBaseline?: () => void;
  onOpenAgeOneSpurtEstimator?: () => void;
}

function formatCompactAge(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y}y${m}m` : `${y}y`;
}

export const GrowthTimelineSection: React.FC<GrowthTimelineSectionProps> = ({
  childProfile,
  measurements,
  photos = [],
  events = [],
  avatarPhotoUrl = null,
  onInspectMilestone,
  onUpdateMeasurement,
  onDeleteMeasurement,
  onAddPhotoForMilestone,
  onEditAgeTwoBaseline,
  onOpenAgeOneSpurtEstimator,
}) => {
  const [chartMetric, setChartMetric] = useState<'height' | 'weight'>('height');
  const [velocityMetric, setVelocityMetric] = useState<'height' | 'weight'>('height');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [quickPdfSaved, setQuickPdfSaved] = useState<boolean>(false);

  // Edit Previous Measurement & Statement modal state
  const [editingMeasurement, setEditingMeasurement] = useState<GrowthMeasurement | null>(null);
  const [editFeet, setEditFeet] = useState<number>(3);
  const [editInches, setEditInches] = useState<number>(0);
  const [editWeightLb, setEditWeightLb] = useState<number>(30);
  const [editAgeYears, setEditAgeYears] = useState<number>(3);
  const [editAgeExtraMonths, setEditAgeExtraMonths] = useState<number>(0);
  const [editDate, setEditDate] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const openEditModal = (m: GrowthMeasurement) => {
    const { feet, inches } = splitCmToFeetAndInches(m.heightCm);
    setEditingMeasurement(m);
    setEditFeet(feet);
    setEditInches(Number(inches.toFixed(1)));
    setEditWeightLb(Number(kgToLbs(m.weightKg).toFixed(1)));
    setEditAgeYears(Math.floor(m.ageMonths / 12));
    setEditAgeExtraMonths(m.ageMonths % 12);
    setEditDate(m.recordedDate);
    setEditNote(m.note || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeasurement) return;
    setIsSavingEdit(true);
    try {
      const nextHeightCm = inchesToCm(editFeet * 12 + editInches);
      const nextWeightKg = lbsToKg(editWeightLb);
      const nextAgeMonths = Math.max(
        VALIDATION_BOUNDS.AGE_MONTHS_MIN,
        Math.min(VALIDATION_BOUNDS.AGE_MONTHS_MAX, editAgeYears * 12 + editAgeExtraMonths),
      );
      await onUpdateMeasurement(editingMeasurement.id, {
        ageMonths: nextAgeMonths,
        heightCm: nextHeightCm,
        weightKg: nextWeightKg,
        recordedDate: editDate,
        note: editNote,
      });
      setEditingMeasurement(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const progressSummary = useMemo(
    () => computeGrowthProgressSummary(childProfile, measurements),
    [childProfile, measurements],
  );

  // Combine Age 2 baseline point (if no explicit 24-month entry exists) for curve continuity
  const sortedAsc = useMemo(
    () => [...measurements].sort((a, b) => a.ageMonths - b.ageMonths),
    [measurements],
  );
  const hasAge2Record = sortedAsc.some((m) => m.ageMonths === 24);

  const curvePoints: GrowthMeasurement[] = useMemo(
    () =>
      hasAge2Record
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
              note: 'Starting Age 2 baseline',
            },
            ...sortedAsc,
          ],
    [hasAge2Record, sortedAsc, childProfile],
  );

  // Compute annualized Growth Velocity between consecutive timepoints
  const velocityIntervals: VelocityInterval[] = useMemo(() => {
    const intervals: VelocityInterval[] = [];
    for (let i = 1; i < curvePoints.length; i += 1) {
      const prev = curvePoints[i - 1];
      const curr = curvePoints[i];
      const deltaMonths = curr.ageMonths - prev.ageMonths;
      if (deltaMonths < 1) continue; // Avoid noisy spikes when 2 check-ins share the same age month
      const years = deltaMonths / 12;
      const heightCmPerYear = (curr.heightCm - prev.heightCm) / years;
      const heightInPerYear = (cmToInches(curr.heightCm) - cmToInches(prev.heightCm)) / years;
      const weightKgPerYear = (curr.weightKg - prev.weightKg) / years;
      const weightLbPerYear = (kgToLbs(curr.weightKg) - kgToLbs(prev.weightKg)) / years;
      intervals.push({
        id: `${prev.id}_${curr.id}`,
        fromAgeMonths: prev.ageMonths,
        toAgeMonths: curr.ageMonths,
        spanMonths: deltaMonths,
        shortLabel: `${formatCompactAge(prev.ageMonths)}→${formatCompactAge(curr.ageMonths)}`,
        rangeLabel: `${formatAgeLabel(prev.ageMonths)} to ${formatAgeLabel(curr.ageMonths)}`,
        heightInPerYear,
        heightCmPerYear,
        weightLbPerYear,
        weightKgPerYear,
        toMeasurement: curr,
      });
    }
    return intervals;
  }, [curvePoints]);

  const velocityStats = useMemo(() => {
    if (velocityIntervals.length === 0) return null;
    const isH = velocityMetric === 'height';
    const rates = velocityIntervals.map((iv) =>
      isH ? iv.heightInPerYear : iv.weightLbPerYear,
    );
    const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
    let peakInterval = velocityIntervals[0];
    for (const iv of velocityIntervals) {
      const val = isH ? iv.heightInPerYear : iv.weightLbPerYear;
      const best = isH ? peakInterval.heightInPerYear : peakInterval.weightLbPerYear;
      if (val > best) peakInterval = iv;
    }
    const latestInterval = velocityIntervals[velocityIntervals.length - 1];
    return {
      avgRate,
      peakInterval,
      latestInterval,
    };
  }, [velocityIntervals, velocityMetric]);

  // Chart coordinate calculation in native INCHES (height) and POUNDS (weight)
  const svgW = 760;
  const svgH = 286;
  const padLeft = 82;
  const padRight = 38;
  const padTop = 30;
  const padBottom = 42;

  const minAge = Math.min(24, ...curvePoints.map((p) => p.ageMonths));
  const maxAge = Math.max(84, ...curvePoints.map((p) => p.ageMonths + 6));

  const values = curvePoints.map((p) =>
    chartMetric === 'height' ? cmToInches(p.heightCm) : kgToLbs(p.weightKg),
  );
  const baselineVal =
    chartMetric === 'height'
      ? cmToInches(childProfile.ageTwoHeightCm)
      : kgToLbs(childProfile.ageTwoWeightKg);

  const minYVal = Math.floor(Math.min(baselineVal, ...values) * 0.93);
  const maxYVal = Math.ceil(Math.max(baselineVal + 6, ...values) * 1.05);

  const ageToX = (months: number) =>
    padLeft +
    ((months - minAge) / Math.max(12, maxAge - minAge)) * (svgW - padLeft - padRight);

  const valToY = (val: number) =>
    svgH -
    padBottom -
    ((val - minYVal) / Math.max(4, maxYVal - minYVal)) * (svgH - padTop - padBottom);

  const polylineCoords = curvePoints
    .map((p) => {
      const val =
        chartMetric === 'height' ? cmToInches(p.heightCm) : kgToLbs(p.weightKg);
      return `${ageToX(p.ageMonths)},${valToY(val)}`;
    })
    .join(' ');

  const yTicks = [0, 0.33, 0.66, 1].map(
    (ratio) => minYVal + ratio * (maxYVal - minYVal),
  );

  // Velocity Chart SVG Geometry
  const velSvgW = 760;
  const velSvgH = 250;
  const velPadLeft = 72;
  const velPadRight = 28;
  const velPadTop = 28;
  const velPadBottom = 44;

  const typicalBandMin = velocityMetric === 'height' ? 2.0 : 4.0;
  const typicalBandMax = velocityMetric === 'height' ? 3.2 : 7.0;

  const maxVelVal = useMemo(() => {
    const rawMax = Math.max(
      typicalBandMax + 1.2,
      ...velocityIntervals.map((iv) =>
        Math.max(0, velocityMetric === 'height' ? iv.heightInPerYear : iv.weightLbPerYear),
      ),
    );
    return Math.ceil(rawMax * 1.15);
  }, [velocityIntervals, velocityMetric, typicalBandMax]);

  const velToY = (v: number) => {
    const clamped = Math.max(0, Math.min(maxVelVal, v));
    return (
      velSvgH -
      velPadBottom -
      (clamped / Math.max(1, maxVelVal)) * (velSvgH - velPadTop - velPadBottom)
    );
  };

  const velTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => r * maxVelVal);

  // Descending order for table so newest milestones appear first
  const sortedDesc = [...measurements].sort((a, b) => b.ageMonths - a.ageMonths);

  const handleQuickPdfDownload = () => {
    downloadPrintableGrowthPdfReport({
      childProfile,
      measurements,
      avatarPhotoUrl,
    });
    setQuickPdfSaved(true);
    window.setTimeout(() => {
      setQuickPdfSaved(false);
    }, 3500);
  };

  const previewEditHeightCm = inchesToCm(editFeet * 12 + editInches);
  const previewEditWeightKg = lbsToKg(editWeightLb);

  return (
    <section id="timeline" className="space-y-8 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-indigo-950 dark:text-white">
            Growth Milestones, Trajectory &amp; Velocity
          </h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 max-w-2xl">
            Every height (ft &amp; in) and weight (lb) mark recorded for {childProfile.name}{' '}
            since Age 2 — click any milestone point to inspect it, edit any previous statement, or review their growth velocity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-950" aria-hidden="true" />
            Printable PDF Report
          </button>

          <button
            type="button"
            onClick={handleQuickPdfDownload}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-950 dark:text-slate-100 bg-white dark:bg-slate-900 hover:bg-sky-50 dark:hover:bg-slate-800 border border-sky-300 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {quickPdfSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                PDF Saved
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
                Quick PDF
              </>
            )}
          </button>

          <div
            role="group"
            aria-label="Growth curve metric"
            className="flex items-center gap-1 p-1 bg-sky-200/80 dark:bg-slate-800 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setChartMetric('height')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartMetric === 'height'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-sky-950 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white'
              }`}
            >
              Height (ft &amp; in)
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('weight')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartMetric === 'weight'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-sky-950 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white'
              }`}
            >
              Weight (lb)
            </button>
          </div>
        </div>
      </div>

      {/* Inline Growth Progress Summary Card */}
      <div className="bg-white dark:bg-slate-900 border-2 border-sky-200 dark:border-slate-700 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 border-b border-sky-100 dark:border-slate-800 pb-3.5">
          <div className="space-y-1 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-wide text-sky-800 dark:text-sky-300">
              {childProfile.name}’s Progress Summary Since Age 2
            </p>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {progressSummary.narrativeSummary}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="text-xs font-bold text-sky-800 dark:text-sky-300 hover:text-indigo-950 dark:hover:text-white hover:underline whitespace-nowrap shrink-0 self-start cursor-pointer"
          >
            Preview &amp; Print Full Report
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:divide-x sm:divide-sky-100 dark:sm:divide-slate-800">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Height Gained Since Age 2
            </p>
            <p className="text-base font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
              {progressSummary.totalHeightGainPrimary}{' '}
              <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                (+{Math.max(0, progressSummary.heightPercentGain).toFixed(1)}%)
              </span>
            </p>
            <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {progressSummary.totalHeightGainSecondary} · Now {progressSummary.latestHeightPrimary}
            </p>
          </div>

          <div className="space-y-0.5 sm:pl-4">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Weight Gained Since Age 2
            </p>
            <p className="text-base font-bold font-mono tabular-nums text-indigo-950 dark:text-white">
              {progressSummary.totalWeightGainPrimary}
            </p>
            <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {progressSummary.totalWeightGainSecondary} · Now {progressSummary.latestWeightPrimary}
            </p>
          </div>

          <div className="space-y-0.5 lg:pl-4">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Average Annual Pace
            </p>
            <p className="text-base font-bold font-mono tabular-nums text-sky-900 dark:text-sky-300">
              {progressSummary.annualHeightVelocityPrimary &&
              progressSummary.annualWeightVelocityPrimary
                ? `${progressSummary.annualHeightVelocityPrimary} · ${progressSummary.annualWeightVelocityPrimary}`
                : 'Baseline Recorded'}
            </p>
            <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {progressSummary.annualHeightVelocitySecondary &&
              progressSummary.annualWeightVelocitySecondary
                ? `${progressSummary.annualHeightVelocitySecondary} · ${progressSummary.annualWeightVelocitySecondary}`
                : 'Add future check-ins for annual rate'}
            </p>
          </div>

          <div className="space-y-0.5 sm:pl-4">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              WHO Peer Percentile
            </p>
            <p className="text-base font-bold font-mono tabular-nums text-indigo-950 dark:text-white">
              H: {progressSummary.latestHeightPercentileOrdinal} · W:{' '}
              {progressSummary.latestWeightPercentileOrdinal}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {progressSummary.whoCurveLabel} ({progressSummary.latestAgeLabel})
            </p>
          </div>
        </div>
      </div>

      {/* Interactive SVG Trajectory Curve (Imperial Primary, Metric Secondary) */}
      <div className="bg-white dark:bg-slate-900 border-2 border-sky-200 dark:border-slate-700 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Age 2 Baseline:{' '}
              <strong className="font-mono tabular-nums text-indigo-950 dark:text-white">
                {chartMetric === 'height'
                  ? `${formatFeetInches(childProfile.ageTwoHeightCm)} (${formatTotalInches(childProfile.ageTwoHeightCm)})`
                  : formatPounds(childProfile.ageTwoWeightKg)}
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {chartMetric === 'height'
                ? formatMetricHeight(childProfile.ageTwoHeightCm)
                : formatMetricWeight(childProfile.ageTwoWeightKg)}
            </span>
            {onEditAgeTwoBaseline && (
              <button
                type="button"
                onClick={onEditAgeTwoBaseline}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/70 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-200 font-bold text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Pencil className="w-3 h-3 shrink-0" aria-hidden="true" />
                Edit Age 2
              </button>
            )}
            {onOpenAgeOneSpurtEstimator && (
              <button
                type="button"
                onClick={onOpenAgeOneSpurtEstimator}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/70 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-bold text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <TrendingUp className="w-3 h-3 shrink-0" aria-hidden="true" />
                Estimate from Age 1 + Photo
              </button>
            )}
          </div>
          <span className="font-medium text-sky-800 dark:text-sky-300">
            Click any milestone point to view on Growth Wall
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full min-w-[560px] h-auto"
            role="img"
            aria-label={`${childProfile.name} ${chartMetric} growth chart in feet, inches, and pounds`}
          >
            {/* Horizontal Y-Axis Gridlines */}
            {yTicks.map((tickVal, idx) => {
              const y = valToY(tickVal);
              const label =
                chartMetric === 'height'
                  ? formatFeetInches(inchesToCm(tickVal))
                  : `${tickVal.toFixed(1)} lb`;
              return (
                <g key={`ytick_${idx}`}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={svgW - padRight}
                    y2={y}
                    className="stroke-slate-200 dark:stroke-slate-800"
                    strokeWidth={1.2}
                  />
                  <text
                    x={padLeft - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-500 dark:fill-slate-400"
                    fontSize={11}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Main Child Growth Trajectory Line */}
            {curvePoints.length >= 2 && (
              <polyline
                fill="none"
                stroke={chartMetric === 'height' ? '#0284c7' : '#e11d48'}
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polylineCoords}
              />
            )}

            {/* Plotted Milestone Nodes */}
            {curvePoints.map((pt) => {
              const val =
                chartMetric === 'height' ? cmToInches(pt.heightCm) : kgToLbs(pt.weightKg);
              const cx = ageToX(pt.ageMonths);
              const cy = valToY(val);
              const formattedVal =
                chartMetric === 'height'
                  ? `${formatFeetInches(pt.heightCm)} (${cmToInches(pt.heightCm).toFixed(1)}")`
                  : formatPounds(pt.weightKg);

              return (
                <g
                  key={pt.id}
                  onClick={() => onInspectMilestone(pt)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={7}
                    fill="#facc15"
                    stroke={chartMetric === 'height' ? '#0284c7' : '#e11d48'}
                    strokeWidth={3}
                  />
                  <text
                    x={cx}
                    y={cy - 12}
                    textAnchor="middle"
                    className="fill-slate-900 dark:fill-slate-100"
                    fontSize={10.5}
                    fontWeight={700}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {formattedVal}
                  </text>
                  <text
                    x={cx}
                    y={svgH - 14}
                    textAnchor="middle"
                    className="fill-slate-600 dark:fill-slate-400"
                    fontSize={11}
                    fontWeight={600}
                    fontFamily="Plus Jakarta Sans, sans-serif"
                  >
                    {`${Math.floor(pt.ageMonths / 12)}y${pt.ageMonths % 12 ? ` ${pt.ageMonths % 12}m` : ''}`}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Interactive Growth Velocity Chart (Annualized Growth Rate Between Milestones) */}
      <div className="bg-white dark:bg-slate-900 border-2 border-emerald-200 dark:border-slate-700 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              <h3 className="text-lg font-bold text-indigo-950 dark:text-white">
                Growth Velocity Chart (Annualized Pace)
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
              Shows how fast {childProfile.name} grew between each recorded check-in, converted to an annual rate (
              {velocityMetric === 'height' ? 'inches/year & cm/year' : 'pounds/year & kg/year'}).
              Shaded green band marks the typical childhood steady pace (
              {velocityMetric === 'height' ? '2.0–3.2 in/yr' : '4.0–7.0 lb/yr'}).
            </p>
          </div>

          <div
            role="group"
            aria-label="Growth velocity metric"
            className="flex items-center gap-1 p-1 bg-emerald-100/80 dark:bg-slate-800 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setVelocityMetric('height')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                velocityMetric === 'height'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-950 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white'
              }`}
            >
              Height Speed (in/yr)
            </button>
            <button
              type="button"
              onClick={() => setVelocityMetric('weight')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                velocityMetric === 'weight'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-emerald-950 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white'
              }`}
            >
              Weight Speed (lb/yr)
            </button>
          </div>
        </div>

        {velocityIntervals.length === 0 || !velocityStats ? (
          <div className="rounded-xl border border-dashed border-emerald-200 dark:border-slate-700 bg-emerald-50/40 dark:bg-slate-800/40 p-6 text-center space-y-1.5">
            <p className="text-sm font-semibold text-indigo-950 dark:text-slate-200">
              Record at least two milestones at different ages to see {childProfile.name}’s Growth Velocity Chart
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Once a second check-in is saved (at least 1 month apart), SproutScale automatically calculates growth spurts and annualized speed.
            </p>
          </div>
        ) : (
          <>
            {/* Key Velocity Metrics Summary Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-y border-emerald-100 dark:border-slate-800 py-3.5 sm:divide-x sm:divide-emerald-100 dark:sm:divide-slate-800">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Latest Interval Pace ({velocityStats.latestInterval.shortLabel})
                </p>
                <p className="text-base font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  {velocityMetric === 'height'
                    ? `${velocityStats.latestInterval.heightInPerYear.toFixed(1)} in/yr`
                    : `${velocityStats.latestInterval.weightLbPerYear.toFixed(1)} lb/yr`}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {velocityMetric === 'height'
                    ? `${velocityStats.latestInterval.heightCmPerYear.toFixed(1)} cm/yr`
                    : `${velocityStats.latestInterval.weightKgPerYear.toFixed(1)} kg/yr`}
                </p>
              </div>

              <div className="space-y-0.5 sm:pl-4">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Peak Growth Spurt ({velocityStats.peakInterval.shortLabel})
                </p>
                <p className="text-base font-bold font-mono tabular-nums text-indigo-950 dark:text-white">
                  {velocityMetric === 'height'
                    ? `${velocityStats.peakInterval.heightInPerYear.toFixed(1)} in/yr`
                    : `${velocityStats.peakInterval.weightLbPerYear.toFixed(1)} lb/yr`}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {velocityStats.peakInterval.rangeLabel}
                </p>
              </div>

              <div className="space-y-0.5 sm:pl-4">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Average Velocity Across {velocityIntervals.length}{' '}
                  {velocityIntervals.length === 1 ? 'Span' : 'Spans'}
                </p>
                <p className="text-base font-bold font-mono tabular-nums text-sky-900 dark:text-sky-300">
                  {velocityMetric === 'height'
                    ? `${velocityStats.avgRate.toFixed(1)} in/yr`
                    : `${velocityStats.avgRate.toFixed(1)} lb/yr`}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Typical childhood pace:{' '}
                  {velocityMetric === 'height' ? '2.0–3.2 in/yr' : '4.0–7.0 lb/yr'}
                </p>
              </div>
            </div>

            {/* Velocity Bar Chart SVG */}
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${velSvgW} ${velSvgH}`}
                className="w-full min-w-[540px] h-auto"
                role="img"
                aria-label={`${childProfile.name} ${velocityMetric} growth velocity chart`}
              >
                {/* Typical Childhood Growth Band */}
                <rect
                  x={velPadLeft}
                  y={velToY(typicalBandMax)}
                  width={velSvgW - velPadLeft - velPadRight}
                  height={Math.max(4, velToY(typicalBandMin) - velToY(typicalBandMax))}
                  className="fill-emerald-100/70 dark:fill-emerald-900/35"
                />
                <text
                  x={velSvgW - velPadRight - 6}
                  y={velToY(typicalBandMax) + 13}
                  textAnchor="end"
                  className="fill-emerald-800 dark:fill-emerald-300"
                  fontSize={10}
                  fontWeight={700}
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  Typical pace ({typicalBandMin}–{typicalBandMax}{' '}
                  {velocityMetric === 'height' ? 'in/yr' : 'lb/yr'})
                </text>

                {/* Horizontal Gridlines */}
                {velTicks.map((tickVal, idx) => {
                  const y = velToY(tickVal);
                  return (
                    <g key={`veltick_${idx}`}>
                      <line
                        x1={velPadLeft}
                        y1={y}
                        x2={velSvgW - velPadRight}
                        y2={y}
                        className="stroke-slate-200 dark:stroke-slate-800"
                        strokeWidth={1.1}
                      />
                      <text
                        x={velPadLeft - 10}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-slate-500 dark:fill-slate-400"
                        fontSize={10.5}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {tickVal.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                {/* Velocity Bars */}
                {velocityIntervals.map((iv, idx) => {
                  const plotW = velSvgW - velPadLeft - velPadRight;
                  const slotW = plotW / Math.max(1, velocityIntervals.length);
                  const barW = Math.min(64, Math.max(28, slotW * 0.56));
                  const cx = velPadLeft + slotW * idx + slotW / 2;
                  const val =
                    velocityMetric === 'height' ? iv.heightInPerYear : iv.weightLbPerYear;
                  const clampedVal = Math.max(0, val);
                  const barTop = velToY(clampedVal);
                  const barBottom = velToY(0);
                  const barHeight = Math.max(4, barBottom - barTop);
                  const isPeak = iv.id === velocityStats.peakInterval.id;

                  return (
                    <g
                      key={iv.id}
                      onClick={() => onInspectMilestone(iv.toMeasurement)}
                      className="cursor-pointer"
                    >
                      <rect
                        x={cx - barW / 2}
                        y={barTop}
                        width={barW}
                        height={barHeight}
                        rx={8}
                        fill={
                          velocityMetric === 'height'
                            ? isPeak
                              ? '#059669'
                              : '#0ea5e9'
                            : isPeak
                              ? '#d97706'
                              : '#f43f5e'
                        }
                      />
                      <text
                        x={cx}
                        y={Math.max(14, barTop - 8)}
                        textAnchor="middle"
                        className="fill-slate-900 dark:fill-slate-100"
                        fontSize={11}
                        fontWeight={700}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {val.toFixed(1)} {velocityMetric === 'height' ? 'in/yr' : 'lb/yr'}
                      </text>
                      <text
                        x={cx}
                        y={velSvgH - 18}
                        textAnchor="middle"
                        className="fill-slate-700 dark:fill-slate-300"
                        fontSize={11}
                        fontWeight={600}
                        fontFamily="Plus Jakarta Sans, sans-serif"
                      >
                        {iv.shortLabel}
                      </text>
                      <text
                        x={cx}
                        y={velSvgH - 5}
                        textAnchor="middle"
                        className="fill-slate-400 dark:fill-slate-500"
                        fontSize={9.5}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {iv.spanMonths} mo
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </>
        )}
      </div>

      {/* Tabular Milestone History Table (Feet/Inches & Pounds Primary, cm/kg Secondary) */}
      <div className="bg-white dark:bg-slate-900 border-2 border-sky-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xs">
        {sortedDesc.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No extra wall marks saved yet for {childProfile.name}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Use the Mark Height &amp; Weight panel above to pencil their first milestone onto the wall.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-sky-200 dark:border-slate-700 bg-sky-50 dark:bg-slate-800/80 text-xs font-bold text-indigo-950 dark:text-slate-200">
                  <th className="py-3.5 px-5">Age &amp; Date</th>
                  <th className="py-3.5 px-4">Height (ft &amp; in)</th>
                  <th className="py-3.5 px-4">Weight (lb)</th>
                  <th className="py-3.5 px-4">Grown Since Age 2</th>
                  <th className="py-3.5 px-4">Statement / Memory Note</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {sortedDesc.map((m) => {
                  const hDelta = m.heightCm - childProfile.ageTwoHeightCm;
                  const wDelta = m.weightKg - childProfile.ageTwoWeightKg;
                  const isConfirming = confirmDeleteId === m.id;
                  const syncedPhotos = photos.filter(
                    (p) =>
                      p.linkedMeasurementId === m.id || p.capturedDate === m.recordedDate,
                  );
                  const syncedEvents = events.filter(
                    (ev) =>
                      ev.linkedMeasurementId === m.id || ev.eventDate === m.recordedDate,
                  );

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {formatAgeLabel(m.ageMonths)}
                        </div>
                        <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {m.recordedDate}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                          {formatFeetInches(m.heightCm)}{' '}
                          <span className="text-xs font-semibold text-sky-800 dark:text-sky-300">
                            ({formatTotalInches(m.heightCm)})
                          </span>
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {formatMetricHeight(m.heightCm)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                          {formatPounds(m.weightKg)}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {formatMetricWeight(m.weightKg)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono tabular-nums text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          <span>{formatHeightDelta(hDelta, 'imperial')}</span>
                          <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
                          <span>{formatWeightDelta(wDelta, 'imperial')}</span>
                        </div>
                        <div className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                          <span>{formatHeightDelta(hDelta, 'metric')}</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>{formatWeightDelta(wDelta, 'metric')}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs">
                        <div className="truncate">
                          {m.note || syncedEvents[0]?.title || '—'}
                        </div>
                        {(syncedPhotos.length > 0 || syncedEvents.length > 0) && (
                          <a
                            href="#photo-album"
                            className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-semibold text-sky-800 dark:text-sky-300 hover:text-indigo-950 dark:hover:text-white hover:underline whitespace-nowrap"
                          >
                            <ImageIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span>
                              {syncedPhotos.length > 0
                                ? `${syncedPhotos.length} ${syncedPhotos.length === 1 ? 'photo' : 'photos'}`
                                : ''}
                              {syncedPhotos.length > 0 && syncedEvents.length > 0 ? ' · ' : ''}
                              {syncedEvents.length > 0
                                ? `${syncedEvents.length} ${syncedEvents.length === 1 ? 'event' : 'events'}`
                                : ''}{' '}
                              in portfolio
                            </span>
                          </a>
                        )}
                      </td>

                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEditModal(m)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:text-indigo-950 dark:hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            Edit
                          </button>

                          {onAddPhotoForMilestone && (
                            <button
                              type="button"
                              onClick={() => onAddPhotoForMilestone(m)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-800 dark:text-sky-300 hover:text-indigo-950 dark:hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                              Add Photo
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onInspectMilestone(m)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Show on Wall
                            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>

                          {!isConfirming ? (
                            <button
                              type="button"
                              aria-label={`Remove ${formatAgeLabel(m.ageMonths)} measurement`}
                              onClick={() => setConfirmDeleteId(m.id)}
                              className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  await onDeleteMeasurement(m.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Previous Measurement & Statement Modal */}
      {editingMeasurement && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-measurement-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border-2 border-sky-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-sky-100 dark:border-slate-800 bg-sky-50/70 dark:bg-slate-800/70">
              <div>
                <h3
                  id="edit-measurement-title"
                  className="text-base font-bold text-indigo-950 dark:text-white"
                >
                  Edit {childProfile.name}’s Previous Measurement &amp; Statement
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Update height, weight, age, date, or the memory note for this wall mark.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMeasurement(null)}
                aria-label="Close edit modal"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              {/* Height ft & in */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="edit-feet"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Height (Feet)
                  </label>
                  <input
                    id="edit-feet"
                    type="number"
                    min={1}
                    max={6}
                    step={1}
                    value={editFeet}
                    onChange={(e) => setEditFeet(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-inches"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Height (Inches)
                  </label>
                  <input
                    id="edit-inches"
                    type="number"
                    min={0}
                    max={11.9}
                    step={0.1}
                    value={editInches}
                    onChange={(e) => setEditInches(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <p className="text-[11px] font-mono tabular-nums text-sky-800 dark:text-sky-300 -mt-2">
                Preview: {formatFeetInches(previewEditHeightCm)} ({formatTotalInches(previewEditHeightCm)} ·{' '}
                {formatMetricHeight(previewEditHeightCm)})
              </p>

              {/* Weight & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="edit-weight-lb"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Weight (lb)
                  </label>
                  <input
                    id="edit-weight-lb"
                    type="number"
                    min={6}
                    max={260}
                    step={0.1}
                    value={editWeightLb}
                    onChange={(e) => setEditWeightLb(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                    {formatMetricWeight(previewEditWeightKg)}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="edit-recorded-date"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Recorded Date
                  </label>
                  <input
                    id="edit-recorded-date"
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Age Years & Months */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="edit-age-years"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Age (Years)
                  </label>
                  <input
                    id="edit-age-years"
                    type="number"
                    min={0}
                    max={18}
                    step={1}
                    value={editAgeYears}
                    onChange={(e) => setEditAgeYears(Math.max(0, Math.min(18, Number(e.target.value) || 0)))}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-age-months"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Extra Months (0–11)
                  </label>
                  <input
                    id="edit-age-months"
                    type="number"
                    min={0}
                    max={11}
                    step={1}
                    value={editAgeExtraMonths}
                    onChange={(e) =>
                      setEditAgeExtraMonths(Math.max(0, Math.min(11, Number(e.target.value) || 0)))
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Statement / Memory Note */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="edit-statement-note"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Statement / Memory Note
                  </label>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {editNote.length}/{VALIDATION_BOUNDS.NOTE_MAX_LEN}
                  </span>
                </div>
                <textarea
                  id="edit-statement-note"
                  rows={3}
                  maxLength={VALIDATION_BOUNDS.NOTE_MAX_LEN}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="e.g., First day of preschool — grew a full inch over summer!"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-sky-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingMeasurement(null)}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Milestone Keepsake Song Studio (Lyria 3 30s Clip & Full Track Generator) */}
      <GrowthMusicKeepsakeCard
        childProfile={childProfile}
        measurements={measurements}
        progressSummary={progressSummary}
        avatarPhotoUrl={avatarPhotoUrl}
      />

      {/* Printable PDF Growth Report Preview & Export Modal */}
      <GrowthReportModal
        isOpen={isReportModalOpen}
        childProfile={childProfile}
        measurements={measurements}
        avatarPhotoUrl={avatarPhotoUrl}
        onClose={() => setIsReportModalOpen(false)}
      />
    </section>
  );
};
