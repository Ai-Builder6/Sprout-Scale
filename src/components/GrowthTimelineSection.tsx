import React, { useState } from 'react';
import { ArrowUpRight, Trash2 } from 'lucide-react';
import {
  ChildProfile,
  formatAgeLabel,
  formatHeight,
  formatHeightDelta,
  formatWeight,
  formatWeightDelta,
  GrowthMeasurement,
  UnitSystem,
} from '../types';

interface GrowthTimelineSectionProps {
  childProfile: ChildProfile;
  measurements: GrowthMeasurement[];
  units: UnitSystem;
  onInspectMilestone: (measurement: GrowthMeasurement) => void;
  onDeleteMeasurement: (measurementId: string) => Promise<void>;
}

export const GrowthTimelineSection: React.FC<GrowthTimelineSectionProps> = ({
  childProfile,
  measurements,
  units,
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

  // Chart coordinate calculation
  const svgW = 760;
  const svgH = 270;
  const padLeft = 64;
  const padRight = 32;
  const padTop = 28;
  const padBottom = 42;

  const minAge = 24;
  const maxAge = Math.max(84, ...curvePoints.map((p) => p.ageMonths + 6));

  const values = curvePoints.map((p) =>
    chartMetric === 'height' ? p.heightCm : p.weightKg,
  );
  const baselineVal =
    chartMetric === 'height'
      ? childProfile.ageTwoHeightCm
      : childProfile.ageTwoWeightKg;

  const minYVal = Math.floor(Math.min(baselineVal, ...values) * 0.92);
  const maxYVal = Math.ceil(Math.max(baselineVal + 10, ...values) * 1.06);

  const ageToX = (months: number) =>
    padLeft + ((months - minAge) / Math.max(12, maxAge - minAge)) * (svgW - padLeft - padRight);

  const valToY = (val: number) =>
    svgH -
    padBottom -
    ((val - minYVal) / Math.max(5, maxYVal - minYVal)) * (svgH - padTop - padBottom);

  const polylineCoords = curvePoints
    .map((p) => {
      const val = chartMetric === 'height' ? p.heightCm : p.weightKg;
      return `${ageToX(p.ageMonths)},${valToY(val)}`;
    })
    .join(' ');

  const areaPath =
    curvePoints.length >= 2
      ? `M ${ageToX(curvePoints[0].ageMonths)} ${valToY(baselineVal)} ` +
        curvePoints
          .map((p) => {
            const val = chartMetric === 'height' ? p.heightCm : p.weightKg;
            return `L ${ageToX(p.ageMonths)} ${valToY(val)}`;
          })
          .join(' ') +
        ` L ${ageToX(curvePoints[curvePoints.length - 1].ageMonths)} ${valToY(baselineVal)} Z`
      : '';

  const yTicks = [0, 0.33, 0.66, 1].map(
    (ratio) => minYVal + ratio * (maxYVal - minYVal),
  );

  // Descending order for table so newest milestones appear first
  const sortedDesc = [...measurements].sort((a, b) => b.ageMonths - a.ageMonths);

  return (
    <section id="timeline" className="space-y-8 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Growth Curve & Wall Marks
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl">
            Every height and weight mark recorded for {childProfile.name} from Age 2 onward.
            Select any milestone to watch their character jump to that exact age on the wall.
          </p>
        </div>

        <div
          role="group"
          aria-label="Growth curve metric"
          className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
        >
          <button
            type="button"
            onClick={() => setChartMetric('height')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              chartMetric === 'height'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Height Trajectory
          </button>
          <button
            type="button"
            onClick={() => setChartMetric('weight')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              chartMetric === 'weight'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Weight Trajectory
          </button>
        </div>
      </div>

      {/* Interactive SVG Trajectory Curve */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Age 2 Baseline:{' '}
            <strong className="font-mono tabular-nums text-slate-800">
              {chartMetric === 'height'
                ? formatHeight(childProfile.ageTwoHeightCm, units)
                : formatWeight(childProfile.ageTwoWeightKg, units)}
            </strong>
          </span>
          <span>Click any milestone point to view on Growth Wall</span>
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full min-w-[540px] h-auto"
            role="img"
            aria-label={`${childProfile.name} ${chartMetric} growth chart since Age 2`}
          >
            {/* Horizontal Y-Axis Gridlines */}
            {yTicks.map((tickVal, idx) => {
              const y = valToY(tickVal);
              const label =
                chartMetric === 'height'
                  ? formatHeight(tickVal, units)
                  : formatWeight(tickVal, units);
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

            {/* Age 2 Baseline Horizontal Reference Line */}
            <line
              x1={padLeft}
              y1={valToY(baselineVal)}
              x2={svgW - padRight}
              y2={valToY(baselineVal)}
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />

            {/* Shaded Growth Gain Area Above Age 2 */}
            {areaPath && <path d={areaPath} fill="#10b981" opacity={0.12} />}

            {/* Main Growth Trajectory Line */}
            {curvePoints.length >= 2 && (
              <polyline
                fill="none"
                stroke="#059669"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polylineCoords}
              />
            )}

            {/* Plotted Milestone Nodes */}
            {curvePoints.map((pt) => {
              const val = chartMetric === 'height' ? pt.heightCm : pt.weightKg;
              const cx = ageToX(pt.ageMonths);
              const cy = valToY(val);
              const formattedVal =
                chartMetric === 'height'
                  ? formatHeight(pt.heightCm, units)
                  : formatWeight(pt.weightKg, units);

              return (
                <g
                  key={pt.id}
                  onClick={() => onInspectMilestone(pt)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill="#ffffff"
                    stroke="#059669"
                    strokeWidth={2.8}
                  />
                  <text
                    x={cx}
                    y={cy - 11}
                    textAnchor="middle"
                    fill="#0f172a"
                    fontSize={10.5}
                    fontWeight={600}
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
                    fontWeight={500}
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

      {/* Tabular Milestone History Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {sortedDesc.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-800">
              No extra wall marks saved yet for {childProfile.name}
            </p>
            <p className="text-xs text-slate-500">
              Use the Mark Height & Weight panel above to pencil their first milestone onto the wall.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3.5 px-5">Age & Date</th>
                  <th className="py-3.5 px-4">Height</th>
                  <th className="py-3.5 px-4">Weight</th>
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

                      <td className="py-3.5 px-4 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatHeight(m.heightCm, units)}
                      </td>

                      <td className="py-3.5 px-4 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatWeight(m.weightKg, units)}
                      </td>

                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-emerald-700 whitespace-nowrap">
                        <span>{formatHeightDelta(hDelta, units)}</span>
                        <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
                        <span>{formatWeightDelta(wDelta, units)}</span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs truncate">
                        {m.note || '—'}
                      </td>

                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => onInspectMilestone(m)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
                          >
                            Show on Wall
                            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>

                          {!isConfirming ? (
                            <button
                              type="button"
                              aria-label={`Remove ${formatAgeLabel(m.ageMonths)} measurement`}
                              onClick={() => setConfirmDeleteId(m.id)}
                              className="text-slate-400 hover:text-red-600 transition-colors p-1"
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
                                className="px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md whitespace-nowrap shrink-0"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0"
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
