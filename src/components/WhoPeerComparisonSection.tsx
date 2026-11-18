import React from 'react';
import {
  BiologicalSex,
  CHARACTER_PALETTES,
  ChildProfile,
  clampNumber,
  formatAgeLabel,
  formatHeight,
  formatHeightDelta,
  formatWeight,
  formatWeightDelta,
  UnitSystem,
} from '../types';
import {
  evaluateChildWhoPercentiles,
  getWhoPeerClassroomLineupHeights,
  WhoPercentileResult,
} from '../services/whoGrowthService';

interface WhoPeerComparisonSectionProps {
  childProfile: ChildProfile;
  activeHeightCm: number;
  activeWeightKg: number;
  activeAgeMonths: number;
  isPreviewDirty: boolean;
  units: UnitSystem;
  onSelectBiologicalSex: (sex: BiologicalSex) => void;
}

interface PercentileSpectrumBarProps {
  metric: 'height' | 'weight';
  result: WhoPercentileResult;
  units: UnitSystem;
}

const PercentileSpectrumBar: React.FC<PercentileSpectrumBarProps> = ({
  metric,
  result,
  units,
}) => {
  const barLeft = 18;
  const barRight = 442;
  const barWidth = barRight - barLeft;

  const pctToX = (pct: number) =>
    barLeft + (clampNumber(pct, 0, 100) / 100) * barWidth;

  const markerX = pctToX(result.percentile);
  const pinColor = metric === 'height' ? '#0284c7' : '#e11d48';

  const formatVal = (val: number) =>
    metric === 'height' ? formatHeight(val, units) : formatWeight(val, units);

  const ticks: { pct: number; label: string; val: number }[] = [
    { pct: 3, label: '3rd', val: result.p3Value },
    { pct: 15, label: '15th', val: result.p15Value },
    { pct: 50, label: '50th Avg', val: result.medianValue },
    { pct: 85, label: '85th', val: result.p85Value },
    { pct: 97, label: '97th', val: result.p97Value },
  ];

  return (
    <svg
      viewBox="0 0 460 66"
      className="w-full h-auto select-none"
      role="img"
      aria-label={`WHO ${metric} percentile gauge at the ${result.ordinalLabel} percentile`}
    >
      {/* Background 0-100% Track */}
      <rect
        x={barLeft}
        y={22}
        width={barWidth}
        height={12}
        rx={6}
        fill="#f1f5f9"
        stroke="#cbd5e1"
        strokeWidth={1}
      />

      {/* 3rd to 97th Outer Typical Band */}
      <rect
        x={pctToX(3)}
        y={22}
        width={pctToX(97) - pctToX(3)}
        height={12}
        fill="#e0f2fe"
      />

      {/* 15th to 85th Core Middle Peer Band */}
      <rect
        x={pctToX(15)}
        y={22}
        width={pctToX(85) - pctToX(15)}
        height={12}
        fill={metric === 'height' ? '#bae6fd' : '#fecdd3'}
      />

      {/* Reference Cutoff Tick Lines & Labels */}
      {ticks.map((t) => {
        const tx = pctToX(t.pct);
        const isMedian = t.pct === 50;
        return (
          <g key={`who_tick_${metric}_${t.pct}`}>
            <line
              x1={tx}
              y1={19}
              x2={tx}
              y2={37}
              stroke={isMedian ? '#0f172a' : '#64748b'}
              strokeWidth={isMedian ? 1.8 : 1.1}
              strokeDasharray={isMedian ? undefined : '2 2'}
            />
            <text
              x={tx}
              y={49}
              textAnchor="middle"
              fill={isMedian ? '#0f172a' : '#64748b'}
              fontSize={9.5}
              fontWeight={isMedian ? 700 : 600}
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              {t.label}
            </text>
            <text
              x={tx}
              y={61}
              textAnchor="middle"
              fill="#475569"
              fontSize={8.5}
              fontFamily="JetBrains Mono, monospace"
            >
              {formatVal(t.val)}
            </text>
          </g>
        );
      })}

      {/* Active Child Percentile Pin */}
      <g>
        <line
          x1={markerX}
          y1={10}
          x2={markerX}
          y2={36}
          stroke={pinColor}
          strokeWidth={2.8}
          strokeLinecap="round"
        />
        <circle
          cx={markerX}
          cy={28}
          r={7.5}
          fill="#facc15"
          stroke={pinColor}
          strokeWidth={3}
        />
      </g>
    </svg>
  );
};

export const WhoPeerComparisonSection: React.FC<WhoPeerComparisonSectionProps> = ({
  childProfile,
  activeHeightCm,
  activeWeightKg,
  activeAgeMonths,
  isPreviewDirty,
  units,
  onSelectBiologicalSex,
}) => {
  const evaluation = evaluateChildWhoPercentiles({
    heightCm: activeHeightCm,
    weightKg: activeWeightKg,
    ageMonths: activeAgeMonths,
    sex: childProfile.sex,
  });

  const peerSlots = getWhoPeerClassroomLineupHeights(activeAgeMonths, childProfile.sex);
  const palette = CHARACTER_PALETTES[childProfile.paletteId] ?? CHARACTER_PALETTES.meadow;

  // Build 11-person sorted lineup (10 WHO reference peers + active child)
  const lineupItems: {
    id: string;
    isChild: boolean;
    label: string;
    heightCm: number;
  }[] = [
    ...peerSlots.map((slot) => ({
      id: `peer_${slot.slotPercentile}`,
      isChild: false,
      label: `P${slot.slotPercentile}`,
      heightCm: slot.heightCm,
    })),
    {
      id: 'active_child',
      isChild: true,
      label: childProfile.name,
      heightCm: activeHeightCm,
    },
  ].sort((a, b) => {
    if (Math.abs(a.heightCm - b.heightCm) < 0.05) {
      return a.isChild ? 1 : -1;
    }
    return a.heightCm - b.heightCm;
  });

  const childRankIndex = lineupItems.findIndex((item) => item.isChild);
  const minLineupCm = Math.min(...lineupItems.map((i) => i.heightCm)) * 0.86;
  const maxLineupCm = Math.max(...lineupItems.map((i) => i.heightCm)) * 1.05;

  const floorY = 208;
  const maxTopY = 44;

  const cmToLineupY = (cm: number) => {
    const ratio = clampNumber(
      (cm - minLineupCm) / Math.max(8, maxLineupCm - minLineupCm),
      0.12,
      1,
    );
    return floorY - ratio * (floorY - maxTopY);
  };

  const medianLineY = cmToLineupY(evaluation.height.medianValue);
  const formatSignedZ = (z: number) => (z >= 0 ? `+${z.toFixed(2)}` : z.toFixed(2));

  return (
    <section
      id="who-percentiles"
      aria-labelledby="who-percentiles-heading"
      className="bg-white border-2 border-sky-200 rounded-2xl p-5 sm:p-6 space-y-6 shadow-xs"
    >
      {/* Top Header & Sex Reference Curve Switch */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-sky-100 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-sky-800">
              {evaluation.height.standardSourceLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span>Compared at {formatAgeLabel(activeAgeMonths)}</span>
            {isPreviewDirty && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-bold text-orange-600">Updating Live with Sliders</span>
              </>
            )}
          </div>
          <h2
            id="who-percentiles-heading"
            className="text-xl sm:text-2xl font-bold tracking-tight text-indigo-950"
          >
            How {childProfile.name} Stacks Up Against Same-Age Peers
          </h2>
        </div>

        {/* Interactive Biological Sex WHO Curve Selector */}
        <div className="space-y-1">
          <span className="block text-[11px] font-semibold text-slate-600 sm:text-right">
            WHO Peer Reference Curve
          </span>
          <div
            role="group"
            aria-label="Select WHO biological sex reference curve"
            className="inline-flex items-center gap-1 p-1 bg-sky-100 rounded-lg"
          >
            {(
              [
                { id: 'boy', label: 'Boys (WHO)' },
                { id: 'girl', label: 'Girls (WHO)' },
                { id: 'unspecified', label: 'Combined Avg' },
              ] as { id: BiologicalSex; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectBiologicalSex(opt.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  childProfile.sex === opt.id
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-sky-950 hover:text-indigo-950'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main 2-Zone Peer Comparison Grid (Separated by clean whitespace & hairline divider) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left 7 Columns: Height-for-Age & Weight-for-Age WHO Percentile Gauges */}
        <div className="lg:col-span-7 space-y-6">
          {/* Height-for-Age Percentile Block */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-indigo-950">
                  Height-for-Age WHO Percentile
                </h3>
                <p className="text-xs text-slate-600">
                  {evaluation.height.peerRoomComparison}
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold font-mono tabular-nums text-sky-700">
                  {evaluation.height.ordinalLabel}
                </span>
                <span className="ml-1.5 text-xs font-mono tabular-nums text-slate-500">
                  ({formatSignedZ(evaluation.height.zScore)} SD)
                </span>
              </div>
            </div>

            <PercentileSpectrumBar
              metric="height"
              result={evaluation.height}
              units={units}
            />

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
              <span>
                Measured:{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {formatHeight(activeHeightCm, units)}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                50th Peer Median:{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {formatHeight(evaluation.height.medianValue, units)}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums font-semibold text-sky-800">
                {formatHeightDelta(evaluation.height.deltaFromMedian, units)} vs. median
              </span>
            </div>
          </div>

          {/* Subtle Hairline Divider */}
          <div className="border-t border-slate-100" />

          {/* Weight-for-Age Percentile Block */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-indigo-950">
                  Weight-for-Age WHO Percentile
                </h3>
                <p className="text-xs text-slate-600">
                  {evaluation.weight.peerRoomComparison}
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold font-mono tabular-nums text-rose-700">
                  {evaluation.weight.ordinalLabel}
                </span>
                <span className="ml-1.5 text-xs font-mono tabular-nums text-slate-500">
                  ({formatSignedZ(evaluation.weight.zScore)} SD)
                </span>
              </div>
            </div>

            <PercentileSpectrumBar
              metric="weight"
              result={evaluation.weight}
              units={units}
            />

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
              <span>
                Measured:{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {formatWeight(activeWeightKg, units)}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                50th Peer Median:{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {formatWeight(evaluation.weight.medianValue, units)}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums font-semibold text-rose-700">
                {formatWeightDelta(evaluation.weight.deltaFromMedian, units)} vs. median
              </span>
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Visual 10-Peer Classroom Height Lineup */}
        <div className="lg:col-span-5 lg:border-l lg:border-sky-100 lg:pl-7 space-y-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-indigo-950">
              Classroom Lineup vs. 10 Same-Age Peers
            </h3>
            <p className="text-xs text-slate-600">
              Ordered shortest (5th) to tallest (95th) at {formatAgeLabel(activeAgeMonths)} —{' '}
              {childProfile.name} stands #{childRankIndex + 1} from left.
            </p>
          </div>

          <svg
            viewBox="0 0 420 242"
            className="w-full h-auto select-none"
            role="img"
            aria-label={`Peer height lineup showing ${childProfile.name} at the ${evaluation.height.ordinalLabel} percentile among 10 peers`}
          >
            {/* Soft Sky Playroom Backdrop */}
            <rect x={0} y={0} width={420} height={floorY} rx={12} fill="#f0f9ff" />
            <rect x={0} y={floorY} width={420} height={34} rx={6} fill="#fed7aa" />
            <line
              x1={8}
              y1={floorY}
              x2={412}
              y2={floorY}
              stroke="#f97316"
              strokeWidth={1.8}
            />

            {/* WHO 50th Percentile Peer Median Reference Line */}
            <line
              x1={12}
              y1={medianLineY}
              x2={408}
              y2={medianLineY}
              stroke="#0284c7"
              strokeWidth={1.3}
              strokeDasharray="4 4"
            />
            <text
              x={406}
              y={Math.max(14, medianLineY - 5)}
              textAnchor="end"
              fill="#0369a1"
              fontSize={9}
              fontWeight={700}
              fontFamily="JetBrains Mono, monospace"
            >
              50th Avg ({formatHeight(evaluation.height.medianValue, units)})
            </text>

            {/* 11 Figures Standing Shoulder-to-Shoulder */}
            {lineupItems.map((person, idx) => {
              const cx = 24 + idx * 37.2;
              const topY = cmToLineupY(person.heightCm);
              const totalH = Math.max(46, floorY - topY);
              const headR = clampNumber(totalH * 0.135, 6.5, 11.5);
              const headCy = topY + headR;
              const torsoTop = headCy + headR + 1.5;
              const torsoH = totalH * 0.38;
              const legTop = torsoTop + torsoH;
              const bodyW = person.isChild ? 15 : 12.5;

              return (
                <g key={person.id}>
                  {/* Ground Shadow */}
                  <ellipse
                    cx={cx}
                    cy={floorY + 2}
                    rx={bodyW * 0.65}
                    ry={2.4}
                    fill="#9a3412"
                    opacity={0.18}
                  />

                  {/* Legs */}
                  <line
                    x1={cx - bodyW * 0.24}
                    y1={legTop - 2}
                    x2={cx - bodyW * 0.24}
                    y2={floorY}
                    stroke={person.isChild ? palette.overalls : '#94a3b8'}
                    strokeWidth={person.isChild ? 4.2 : 3.4}
                    strokeLinecap="round"
                  />
                  <line
                    x1={cx + bodyW * 0.24}
                    y1={legTop - 2}
                    x2={cx + bodyW * 0.24}
                    y2={floorY}
                    stroke={person.isChild ? palette.overalls : '#94a3b8'}
                    strokeWidth={person.isChild ? 4.2 : 3.4}
                    strokeLinecap="round"
                  />

                  {/* Torso */}
                  <rect
                    x={cx - bodyW / 2}
                    y={torsoTop}
                    width={bodyW}
                    height={torsoH}
                    rx={5}
                    fill={person.isChild ? palette.shirtPrimary : '#cbd5e1'}
                    stroke={person.isChild ? '#0f172a' : 'none'}
                    strokeWidth={person.isChild ? 1.2 : 0}
                  />

                  {/* Head */}
                  <circle
                    cx={cx}
                    cy={headCy}
                    r={headR}
                    fill={person.isChild ? childProfile.skinTone || palette.skin : '#cbd5e1'}
                    stroke={person.isChild ? '#0f172a' : '#94a3b8'}
                    strokeWidth={person.isChild ? 1.4 : 0.9}
                  />

                  {/* Highlight Callout Above Active Child */}
                  {person.isChild ? (
                    <g>
                      <rect
                        x={clampNumber(cx - 34, 4, 348)}
                        y={Math.max(4, topY - 24)}
                        width={68}
                        height={18}
                        rx={5}
                        fill="#facc15"
                        stroke="#0f172a"
                        strokeWidth={1.1}
                      />
                      <text
                        x={clampNumber(cx, 38, 382)}
                        y={Math.max(4, topY - 24) + 12.5}
                        textAnchor="middle"
                        fill="#0f172a"
                        fontSize={9}
                        fontWeight={700}
                        fontFamily="Plus Jakarta Sans, sans-serif"
                      >
                        {`${evaluation.height.ordinalLabel}`}
                      </text>
                      <text
                        x={cx}
                        y={floorY + 15}
                        textAnchor="middle"
                        fill="#0f172a"
                        fontSize={9.5}
                        fontWeight={700}
                        fontFamily="Plus Jakarta Sans, sans-serif"
                      >
                        You
                      </text>
                    </g>
                  ) : (
                    <text
                      x={cx}
                      y={floorY + 14}
                      textAnchor="middle"
                      fill="#78350f"
                      fontSize={8}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {person.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Pediatric growth percentiles show how children compare with healthy peers of the same
            age and sex—healthy kids grow steadily along their own curve whether at the 15th, 50th,
            or 85th percentile.
          </p>
        </div>
      </div>
    </section>
  );
};
