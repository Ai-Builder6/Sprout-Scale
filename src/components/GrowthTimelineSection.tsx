import React, { useState } from 'react';
import { ArrowUpRight, Trash2 } from 'lucide-react';
import {
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
} from '../types';

interface GrowthTimelineSectionProps {
  childProfile: ChildProfile;
  measurements: GrowthMeasurement[];
  onInspectMilestone: (measurement: GrowthMeasurement) => void;
  onDeleteMeasurement: (measurementId: string) => Promise<void>;
}

export const GrowthTimelineSection: React.FC<GrowthTimelineSectionProps> = ({
  childProfile,
  measurements,
  onInspectMilestone,
  onDeleteMeasurement,
}) => {
  const [chartMetric, setChartMetric] = useState<'height' | 'weight'>('height');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Combine Age 2 baseline point (if no explicit 24-month entry exists) for curve continuity
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
          note: 'Starting Age 2 baseline',
        },
        ...sortedAsc,
      ];

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

  // Descending order for table so newest milestones appear first
  const sortedDesc = [...measurements].sort((a, b) => b.ageMonths - a.ageMonths);

  return (
    <section id="timeline" className="space-y-8 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-indigo-950">
            Growth Milestones &amp; Trajectory
          </h2>
          <p className="text-sm text-slate-700 max-w-2xl">
            Every height (ft &amp; in) and weight (lb) mark recorded for {childProfile.name}{' '}
            since Age 2 — click any milestone point to inspect it on the Growth Wall.
          </p>
        </div>

        <div
          role="group"
          aria-label="Growth curve metric"
          className="flex items-center gap-1 p-1 bg-sky-200/80 rounded-lg"
        >
          <button
            type="button"
            onClick={() => setChartMetric('height')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              chartMetric === 'height'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-sky-950 hover:text-indigo-950'
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
                : 'text-sky-950 hover:text-indigo-950'
            }`}
          >
            Weight (lb)
          </button>
        </div>
      </div>

      {/* Interactive SVG Trajectory Curve (Imperial Primary, Metric Secondary) */}
      <div className="bg-white border-2 border-sky-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Age 2 Baseline:{' '}
              <strong className="font-mono tabular-nums text-indigo-950">
                {chartMetric === 'height'
                  ? `${formatFeetInches(childProfile.ageTwoHeightCm)} (${formatTotalInches(childProfile.ageTwoHeightCm)})`
                  : formatPounds(childProfile.ageTwoWeightKg)}
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span className="font-mono tabular-nums text-slate-400">
              {chartMetric === 'height'
                ? formatMetricHeight(childProfile.ageTwoHeightCm)
                : formatMetricWeight(childProfile.ageTwoWeightKg)}
            </span>
          </div>
          <span className="font-medium text-sky-800">
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
                    stroke="#f1f5f9"
                    strokeWidth={1.2}
                  />
                  <text
                    x={padLeft - 10}
                    y={y + 4}
                    textAnchor="end"
                    fill="#64748b"
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
                    fill="#0f172a"
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
                    fill="#475569"
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

      {/* Tabular Milestone History Table (Feet/Inches & Pounds Primary, cm/kg Secondary) */}
      <div className="bg-white border-2 border-sky-200 rounded-2xl overflow-hidden shadow-xs">
        {sortedDesc.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-800">
              No extra wall marks saved yet for {childProfile.name}
            </p>
            <p className="text-xs text-slate-600">
              Use the Mark Height &amp; Weight panel above to pencil their first milestone onto the wall.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-sky-200 bg-sky-50 text-xs font-bold text-indigo-950">
                  <th className="py-3.5 px-5">Age &amp; Date</th>
                  <th className="py-3.5 px-4">Height (ft &amp; in)</th>
                  <th className="py-3.5 px-4">Weight (lb)</th>
                  <th className="py-3.5 px-4">Grown Since Age 2</th>
                  <th className="py-3.5 px-4">Memory Note</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sortedDesc.map((m) => {
                  const hDelta = m.heightCm - childProfile.ageTwoHeightCm;
                  const wDelta = m.weightKg - childProfile.ageTwoWeightKg;
                  const isConfirming = confirmDeleteId === m.id;

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {formatAgeLabel(m.ageMonths)}
                        </div>
                        <div className="text-xs font-mono tabular-nums text-slate-500">
                          {m.recordedDate}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono tabular-nums font-bold text-slate-900">
                          {formatFeetInches(m.heightCm)}{' '}
                          <span className="text-xs font-semibold text-sky-800">
                            ({formatTotalInches(m.heightCm)})
                          </span>
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-400">
                          {formatMetricHeight(m.heightCm)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono tabular-nums font-bold text-slate-900">
                          {formatPounds(m.weightKg)}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-400">
                          {formatMetricWeight(m.weightKg)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono tabular-nums text-xs font-bold text-emerald-700">
                          <span>{formatHeightDelta(hDelta, 'imperial')}</span>
                          <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
                          <span>{formatWeightDelta(wDelta, 'imperial')}</span>
                        </div>
                        <div className="font-mono tabular-nums text-[11px] text-slate-400">
                          <span>{formatHeightDelta(hDelta, 'metric')}</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>{formatWeightDelta(wDelta, 'metric')}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs truncate">
                        {m.note || '—'}
                      </td>

                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => onInspectMilestone(m)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Show on Wall
                            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>

                          {!isConfirming ? (
                            <button
                              type="button"
                              aria-label={`Remove ${formatAgeLabel(m.ageMonths)} measurement`}
                              onClick={() => setConfirmDeleteId(m.id)}
                              className="text-slate-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
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
                                className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
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
    </section>
  );
};
