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
import {
  evaluateChildWhoPercentiles,
  getWhoReferenceCurveSeries,
} from '../services/whoGrowthService';

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
  const [showWhoBands, setShowWhoBands] = useState<boolean>(true);
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
  const svgH = 295;
  const padLeft = 68;
  const padRight = 46;
  const padTop = 28;
  const padBottom = 42;

  const minAge = Math.min(24, ...curvePoints.map((p) => p.ageMonths));
  const maxAge = Math.max(84, ...curvePoints.map((p) => p.ageMonths + 6));

  // WHO Reference Percentile Series (P3, P15, P50, P85, P97)
  const whoSeries = getWhoReferenceCurveSeries(
    chartMetric,
    childProfile.sex,
    minAge,
    maxAge,
    6,
  );

  const values = curvePoints.map((p) =>
    chartMetric === 'height' ? p.heightCm : p.weightKg,
  );
  const baselineVal =
    chartMetric === 'height'
      ? childProfile.ageTwoHeightCm
      : childProfile.ageTwoWeightKg;

  const whoMinVal = showWhoBands ? Math.min(...whoSeries.map((s) => s.p3)) : baselineVal;
  const whoMaxVal = showWhoBands ? Math.max(...whoSeries.map((s) => s.p97)) : baselineVal;

  const minYVal = Math.floor(Math.min(baselineVal, whoMinVal, ...values) * 0.94);
  const maxYVal = Math.ceil(Math.max(baselineVal + 8, whoMaxVal, ...values) * 1.05);

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

  // Build WHO Shaded Band Polygons (P3..P97 outer band & P15..P85 central peer band)
  const buildBandPolygonPath = (
    upperSelector: (s: (typeof whoSeries)[number]) => number,
    lowerSelector: (s: (typeof whoSeries)[number]) => number,
  ): string => {
    if (whoSeries.length < 2) return '';
    const forward = whoSeries
      .map((s, idx) => `${idx === 0 ? 'M' : 'L'} ${ageToX(s.ageMonths)} ${valToY(upperSelector(s))}`)
      .join(' ');
    const backward = [...whoSeries]
      .reverse()
      .map((s) => `L ${ageToX(s.ageMonths)} ${valToY(lowerSelector(s))}`)
      .join(' ');
    return `${forward} ${backward} Z`;
  };

  const whoOuterBandPath = buildBandPolygonPath(
    (s) => s.p97,
    (s) => s.p3,
  );
  const whoCentralBandPath = buildBandPolygonPath(
    (s) => s.p85,
    (s) => s.p15,
  );
  const whoMedianLinePoints = whoSeries
    .map((s) => `${ageToX(s.ageMonths)},${valToY(s.p50)}`)
    .join(' ');

  const lastWhoKnot = whoSeries[whoSeries.length - 1];

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
            Growth Curve &amp; WHO Peer Bands
          </h2>
          <p className="text-sm text-slate-700 max-w-2xl">
            Every height and weight mark recorded for {childProfile.name} plotted directly over
            official WHO 3rd, 15th, 50th, 85th, and 97th peer percentile curves.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowWhoBands((prev) => !prev)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showWhoBands
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            {showWhoBands ? 'WHO Peer Bands: On' : 'WHO Peer Bands: Off'}
          </button>

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
              Height Trajectory
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
              Weight Trajectory
            </button>
          </div>
        </div>
      </div>

      {/* Interactive SVG Trajectory Curve with WHO Percentile Reference Bands */}
      <div className="bg-white border-2 border-sky-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              Age 2 Baseline:{' '}
              <strong className="font-mono tabular-nums text-indigo-950">
                {chartMetric === 'height'
                  ? formatHeight(childProfile.ageTwoHeightCm, units)
                  : formatWeight(childProfile.ageTwoWeightKg, units)}
              </strong>
            </span>
            {showWhoBands && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Shaded WHO Bands: <strong>15th–85th</strong> (inner) &amp; <strong>3rd–97th</strong> (outer)
                </span>
              </>
            )}
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
            aria-label={`${childProfile.name} ${chartMetric} growth chart with WHO percentile reference curves`}
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

            {/* WHO 3rd–97th & 15th–85th Shaded Reference Bands + 50th Median Curve */}
            {showWhoBands && whoOuterBandPath && (
              <g>
                <path
                  d={whoOuterBandPath}
                  fill={chartMetric === 'height' ? '#e0f2fe' : '#ffe4e6'}
                  opacity={0.7}
                />
                <path
                  d={whoCentralBandPath}
                  fill={chartMetric === 'height' ? '#bae6fd' : '#fecdd3'}
                  opacity={0.65}
                />
                <polyline
                  fill="none"
                  stroke={chartMetric === 'height' ? '#0369a1' : '#be123c'}
                  strokeWidth={1.6}
                  strokeDasharray="5 4"
                  opacity={0.75}
                  points={whoMedianLinePoints}
                />
                {lastWhoKnot && (
                  <>
                    <text
                      x={svgW - padRight + 5}
                      y={valToY(lastWhoKnot.p97) + 3}
                      fill="#64748b"
                      fontSize={9}
                      fontWeight={600}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      P97
                    </text>
                    <text
                      x={svgW - padRight + 5}
                      y={valToY(lastWhoKnot.p85) + 3}
                      fill="#475569"
                      fontSize={9}
                      fontWeight={600}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      P85
                    </text>
                    <text
                      x={svgW - padRight + 5}
                      y={valToY(lastWhoKnot.p50) + 3}
                      fill="#0f172a"
                      fontSize={9.5}
                      fontWeight={700}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      P50
                    </text>
                    <text
                      x={svgW - padRight + 5}
                      y={valToY(lastWhoKnot.p15) + 3}
                      fill="#475569"
                      fontSize={9}
                      fontWeight={600}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      P15
                    </text>
                    <text
                      x={svgW - padRight + 5}
                      y={valToY(lastWhoKnot.p3) + 3}
                      fill="#64748b"
                      fontSize={9}
                      fontWeight={600}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      P3
                    </text>
                  </>
                )}
              </g>
            )}

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
                    r={7}
                    fill="#facc15"
                    stroke={chartMetric === 'height' ? '#0284c7' : '#e11d48'}
                    strokeWidth={3}
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

      {/* Tabular Milestone History Table with WHO Percentiles */}
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
                  <th className="py-3.5 px-4">Height</th>
                  <th className="py-3.5 px-4">Weight</th>
                  <th className="py-3.5 px-4">WHO Peer Percentiles</th>
                  <th className="py-3.5 px-4">Grown Since Age 2</th>
                  <th className="py-3.5 px-4">Memory Note</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sortedDesc.map((m) => {
                  const hDelta = m.heightCm - childProfile.ageTwoHeightCm;
                  const wDelta = m.weightKg - childProfile.ageTwoWeightKg;
                  const whoRow = evaluateChildWhoPercentiles({
                    heightCm: m.heightCm,
                    weightKg: m.weightKg,
                    ageMonths: m.ageMonths,
                    sex: childProfile.sex,
                  });
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

                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                        <span className="font-semibold text-sky-800">
                          H: {whoRow.height.ordinalLabel}
                        </span>
                        <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
                        <span className="font-semibold text-rose-700">
                          W: {whoRow.weight.ordinalLabel}
                        </span>
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
