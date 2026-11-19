import React, { useEffect, useMemo, useState } from 'react';
import { Check, Download, FileText, Printer, X } from 'lucide-react';
import {
  ChildProfile,
  cmToInches,
  formatFeetInches,
  GrowthMeasurement,
  inchesToCm,
  kgToLbs,
} from '../types';
import {
  computeGrowthProgressSummary,
  downloadPrintableGrowthPdfReport,
} from '../services/growthPdfReportService';
import { useDefaultAppAvatar } from '../services/defaultAvatarService';

interface GrowthReportModalProps {
  isOpen: boolean;
  childProfile: ChildProfile;
  measurements: GrowthMeasurement[];
  avatarPhotoUrl: string | null;
  onClose: () => void;
}

interface MiniTrajectorySvgProps {
  title: string;
  metric: 'height' | 'weight';
  curvePoints: GrowthMeasurement[];
  baselineValMetric: number;
  strokeHex: string;
}

const MiniTrajectorySvg: React.FC<MiniTrajectorySvgProps> = ({
  title,
  metric,
  curvePoints,
  baselineValMetric,
  strokeHex,
}) => {
  const w = 360;
  const h = 168;
  const padL = 58;
  const padR = 20;
  const padT = 22;
  const padB = 28;

  const minAge = Math.min(24, ...curvePoints.map((p) => p.ageMonths));
  const maxAge = Math.max(72, ...curvePoints.map((p) => p.ageMonths + 4));

  const vals = curvePoints.map((p) =>
    metric === 'height' ? cmToInches(p.heightCm) : kgToLbs(p.weightKg),
  );
  const baseVal =
    metric === 'height' ? cmToInches(baselineValMetric) : kgToLbs(baselineValMetric);

  const minY = Math.floor(Math.min(baseVal, ...vals) * 0.93);
  const maxY = Math.ceil(Math.max(baseVal + 5, ...vals) * 1.05);

  const ageToX = (m: number) =>
    padL + ((m - minAge) / Math.max(12, maxAge - minAge)) * (w - padL - padR);
  const valToY = (v: number) =>
    h - padB - ((v - minY) / Math.max(4, maxY - minY)) * (h - padT - padB);

  const pointsAttr = curvePoints
    .map((p) => {
      const val = metric === 'height' ? cmToInches(p.heightCm) : kgToLbs(p.weightKg);
      return `${ageToX(p.ageMonths)},${valToY(val)}`;
    })
    .join(' ');

  const ticks = [0, 0.33, 0.66, 1].map((r) => minY + r * (maxY - minY));

  return (
    <div className="bg-white border border-sky-200 rounded-xl p-3.5 space-y-1.5">
      <p className="text-xs font-bold text-indigo-950">{title}</p>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        role="img"
        aria-label={title}
      >
        {ticks.map((tv, i) => {
          const y = valToY(tv);
          const lbl =
            metric === 'height'
              ? formatFeetInches(inchesToCm(tv))
              : `${tv.toFixed(0)} lb`;
          return (
            <g key={`mini_tick_${i}`}>
              <line
                x1={padL}
                y1={y}
                x2={w - padR}
                y2={y}
                stroke="#f1f5f9"
                strokeWidth={1}
              />
              <text
                x={padL - 6}
                y={y + 3.5}
                textAnchor="end"
                fill="#64748b"
                fontSize={9.5}
                fontFamily="JetBrains Mono, monospace"
              >
                {lbl}
              </text>
            </g>
          );
        })}

        {curvePoints.length >= 2 && (
          <polyline
            fill="none"
            stroke={strokeHex}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointsAttr}
          />
        )}

        {curvePoints.map((pt, idx) => {
          const val = metric === 'height' ? cmToInches(pt.heightCm) : kgToLbs(pt.weightKg);
          const cx = ageToX(pt.ageMonths);
          const cy = valToY(val);
          const showLabel =
            curvePoints.length <= 6 ||
            idx === 0 ||
            idx === curvePoints.length - 1 ||
            idx % 2 === 0;
          return (
            <g key={`mini_pt_${pt.id}`}>
              <circle
                cx={cx}
                cy={cy}
                r={4.5}
                fill="#facc15"
                stroke={strokeHex}
                strokeWidth={2}
              />
              {showLabel && (
                <>
                  <text
                    x={cx}
                    y={cy - 8}
                    textAnchor="middle"
                    fill="#0f172a"
                    fontSize={9}
                    fontWeight={700}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {metric === 'height' ? `${val.toFixed(1)}"` : `${val.toFixed(1)}lb`}
                  </text>
                  <text
                    x={cx}
                    y={h - 8}
                    textAnchor="middle"
                    fill="#475569"
                    fontSize={9}
                    fontWeight={600}
                    fontFamily="Plus Jakarta Sans, sans-serif"
                  >
                    {`${Math.floor(pt.ageMonths / 12)}y${pt.ageMonths % 12 ? `${pt.ageMonths % 12}m` : ''}`}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const GrowthReportModal: React.FC<GrowthReportModalProps> = ({
  isOpen,
  childProfile,
  measurements,
  avatarPhotoUrl,
  onClose,
}) => {
  const defaultAppAvatar = useDefaultAppAvatar();
  const effectiveAvatarUrl = avatarPhotoUrl || defaultAppAvatar.portraitUrl;
  const [parentVisitNote, setParentVisitNote] = useState<string>('');
  const [downloadedFileName, setDownloadedFileName] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  const summary = useMemo(
    () => computeGrowthProgressSummary(childProfile, measurements),
    [childProfile, measurements],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setDownloadedFileName(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);
    try {
      const savedName = downloadPrintableGrowthPdfReport({
        childProfile,
        measurements,
        avatarPhotoUrl: effectiveAvatarUrl,
        parentVisitNote,
      });
      setDownloadedFileName(savedName);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintSheet = () => {
    document.body.classList.add('printing-growth-report');
    const cleanup = () => {
      document.body.classList.remove('printing-growth-report');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    window.setTimeout(cleanup, 1200);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="growth-report-modal-title"
      className="growth-report-modal-backdrop fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="growth-report-modal-shell bg-white border-2 border-sky-200 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
        {/* Top Interactive Action Bar (Hidden when printing directly) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-sky-50 border-b border-sky-200">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-sky-700 shrink-0" aria-hidden="true" />
            <div>
              <h3
                id="growth-report-modal-title"
                className="text-base font-bold text-indigo-950"
              >
                Printable PDF Growth Report
              </h3>
              <p className="text-xs text-slate-600">
                Download a crisp multi-page PDF file or print directly for pediatric check-ups &amp; family keepsakes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrintSheet}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-950 bg-white hover:bg-sky-100 border border-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-sky-700" aria-hidden="true" />
              Print Sheet
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 disabled:opacity-60 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              {isGeneratingPdf ? 'Building PDF...' : 'Download Printable PDF'}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close growth report preview"
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-sky-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Optional Parent / Doctor Visit Note Input & Download Confirmation (Hidden on Print) */}
        <div className="no-print px-5 py-3 bg-slate-50 border-b border-slate-200 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label
              htmlFor="report-visit-note"
              className="text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0"
            >
              Optional Note for PDF:
            </label>
            <input
              id="report-visit-note"
              type="text"
              maxLength={180}
              value={parentVisitNote}
              onChange={(e) => setParentVisitNote(e.target.value)}
              placeholder="e.g. Annual 6-year wellness visit with Dr. Patel — active in soccer & swimming"
              className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>

          {downloadedFileName && (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <span>
                Downloaded <strong className="font-mono">{downloadedFileName}</strong> — ready to print or share!
              </span>
            </div>
          )}
        </div>

        {/* Printable Document Sheet Area */}
        <div className="growth-report-printable-sheet flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 bg-white">
          {/* Sheet Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-sky-50/90 border border-sky-200 rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-4">
              {effectiveAvatarUrl && (
                <img
                  src={effectiveAvatarUrl}
                  alt={`${summary.childName} portrait`}
                  className="w-16 h-16 rounded-xl object-cover object-top border-2 border-sky-400 bg-white shrink-0"
                />
              )}
              <div className="space-y-1">
                <p className="text-[11px] font-bold tracking-wider uppercase text-sky-800">
                  SproutScale · Pediatric &amp; Family Growth Wall Report
                </p>
                <h4 className="text-xl sm:text-2xl font-bold text-indigo-950">
                  {summary.childName}’s Growth Progress Report
                </h4>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-700">
                  <span className="font-semibold text-indigo-950">
                    Current Age: {summary.exactAgeLabel}
                  </span>
                  {summary.birthDateHuman && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        DOB: {summary.birthDateHuman}
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{summary.stageName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-sky-800">{summary.whoCurveLabel}</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-600 sm:text-right font-mono tabular-nums space-y-0.5 shrink-0">
              <p className="font-semibold text-slate-800">
                Generated {summary.generatedDateHuman}
              </p>
              <p>{summary.milestoneCount} Recorded Milestones</p>
            </div>
          </div>

          {/* Executive Growth Progress Summary Box */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 sm:p-5 space-y-2">
            <h5 className="text-sm font-bold text-indigo-950">
              Executive Growth Progress Summary
            </h5>
            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
              {summary.narrativeSummary}
            </p>
            {summary.biggestSpurtLabel && (
              <p className="text-xs font-medium text-emerald-800">
                Biggest recorded growth spurt:{' '}
                <strong className="font-mono tabular-nums">
                  {summary.biggestSpurtLabel}
                </strong>
                .
              </p>
            )}
            {parentVisitNote.trim() && (
              <p className="text-xs font-semibold text-sky-900 pt-1 border-t border-amber-200/80">
                Parent / Check-Up Note: {parentVisitNote.trim()}
              </p>
            )}
          </div>

          {/* 4-Card Summary Metric Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-sky-800">
                Age 2 Baseline
              </p>
              <p className="text-sm font-bold font-mono tabular-nums text-slate-900">
                {summary.baselineHeightPrimary}
              </p>
              <p className="text-xs font-mono tabular-nums text-slate-700">
                {summary.baselineWeightPrimary} · {summary.baselineHeightSecondary} /{' '}
                {summary.baselineWeightSecondary}
              </p>
              <p className="text-[11px] text-slate-500">Starting mark (24 mos)</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">
                Latest ({summary.latestAgeLabel})
              </p>
              <p className="text-sm font-bold font-mono tabular-nums text-slate-900">
                {summary.latestHeightPrimary}
              </p>
              <p className="text-xs font-mono tabular-nums text-slate-700">
                {summary.latestWeightPrimary} · {summary.latestHeightSecondary} /{' '}
                {summary.latestWeightSecondary}
              </p>
              <p className="text-[11px] text-slate-500">{summary.latestDateLabel}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-rose-700">
                Total Gained Since Age 2
              </p>
              <p className="text-sm font-bold font-mono tabular-nums text-slate-900">
                {summary.totalHeightGainPrimary} · {summary.totalWeightGainPrimary}
              </p>
              <p className="text-xs font-mono tabular-nums text-slate-700">
                {summary.totalHeightGainSecondary} · {summary.totalWeightGainSecondary}
              </p>
              <p className="text-[11px] font-mono tabular-nums text-emerald-700 font-semibold">
                +{Math.max(0, summary.heightPercentGain).toFixed(1)}% taller since Age 2
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-800">
                Pace &amp; WHO Percentile
              </p>
              <p className="text-sm font-bold font-mono tabular-nums text-slate-900">
                H: {summary.latestHeightPercentileOrdinal} · W:{' '}
                {summary.latestWeightPercentileOrdinal}
              </p>
              <p className="text-xs font-mono tabular-nums text-slate-700">
                {summary.annualHeightVelocityPrimary && summary.annualWeightVelocityPrimary
                  ? `${summary.annualHeightVelocityPrimary} · ${summary.annualWeightVelocityPrimary}`
                  : 'Log future marks for annual pace'}
              </p>
              <p className="text-[11px] text-slate-500">{summary.whoCurveLabel}</p>
            </div>
          </div>

          {/* Side-by-Side Trajectory Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MiniTrajectorySvg
              title="Height Trajectory (Feet & Inches)"
              metric="height"
              curvePoints={summary.curvePoints}
              baselineValMetric={childProfile.ageTwoHeightCm}
              strokeHex="#0284c7"
            />
            <MiniTrajectorySvg
              title="Weight Trajectory (Pounds)"
              metric="weight"
              curvePoints={summary.curvePoints}
              baselineValMetric={childProfile.ageTwoWeightKg}
              strokeHex="#e11d48"
            />
          </div>

          {/* Complete Chronological Milestones Table */}
          <div className="space-y-2">
            <h5 className="text-sm font-bold text-indigo-950">
              Chronological Growth Milestones Log
            </h5>
            <div className="border border-sky-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-sky-50 border-b border-sky-200 font-bold text-indigo-950">
                    <th className="py-2.5 px-3">Age &amp; Date</th>
                    <th className="py-2.5 px-3">Height (ft &amp; in)</th>
                    <th className="py-2.5 px-3">Weight (lb)</th>
                    <th className="py-2.5 px-3">Since Age 2</th>
                    <th className="py-2.5 px-3">WHO %ile</th>
                    <th className="py-2.5 px-3">Memory Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.rowsChronological.map((row) => (
                    <tr key={row.id} className="even:bg-slate-50/60">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{row.ageLabel}</div>
                        <div className="font-mono tabular-nums text-[11px] text-slate-500">
                          {row.recordedDate}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums">
                        <div className="font-bold text-slate-900">{row.heightPrimary}</div>
                        <div className="text-[11px] text-slate-500">
                          {row.heightSecondary}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums">
                        <div className="font-bold text-slate-900">{row.weightPrimary}</div>
                        <div className="text-[11px] text-slate-500">
                          {row.weightSecondary}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums">
                        <div className="font-bold text-emerald-700">
                          {row.deltaImperial}
                        </div>
                        <div className="text-[11px] text-slate-500">{row.deltaMetric}</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums">
                        <div className="font-bold text-sky-800">
                          H: {row.heightPercentileOrdinal}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          W: {row.weightPercentileOrdinal}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 max-w-[220px]">
                        {row.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Printable Footer */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              SproutScale Family Growth Wall · {summary.funHeightFact}
            </span>
            <span className="font-mono tabular-nums">
              Feet/Inches &amp; Pounds Primary · Metric Secondary
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
