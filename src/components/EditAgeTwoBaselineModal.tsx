import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Camera,
  Check,
  Loader2,
  Ruler,
  Scale,
  Sparkles,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import {
  calculateExactAgeFromDob,
  ChildProfile,
  clampNumber,
  cmToInches,
  formatAgeLabel,
  formatFeetInches,
  formatMetricHeight,
  formatMetricWeight,
  formatPounds,
  getLocalTodayIso,
  inchesToCm,
  kgToLbs,
  lbsToKg,
  VALIDATION_BOUNDS,
} from '../types';
import {
  estimateGrowthTrajectoryFromAgeOne,
  estimateWeightFromHeightAndAge,
  getWhoMedianAtAge,
  SpurtTimingPreset,
} from '../services/growthSpurtEstimatorService';
import {
  prepareWallPhotoForAnalysis,
  requestAiWallHeightEstimate,
} from '../services/wallHeightEstimatorService';

export type BaselineModalMode = 'age2' | 'age1_spurt';

export interface SaveAgeOneSpurtPayload {
  ageTwoHeightCm: number;
  ageTwoWeightKg: number;
  ageOneMeasurement: {
    ageMonths: number;
    heightCm: number;
    weightKg: number;
    recordedDate: string;
    note: string;
  };
  laterMeasurement: {
    ageMonths: number;
    heightCm: number;
    weightKg: number;
    recordedDate: string;
    note: string;
  };
  photoPayload?: {
    dataUrl: string;
    capturedDate: string;
    ageMonths: number;
    heightCm: number;
    weightKg: number;
    caption: string;
  };
  spurtSummary: string;
}

interface EditAgeTwoBaselineModalProps {
  isOpen: boolean;
  initialMode?: BaselineModalMode;
  childProfile: ChildProfile;
  isSaving?: boolean;
  onClose: () => void;
  onSaveAgeTwoBaseline: (updates: {
    ageTwoHeightCm: number;
    ageTwoWeightKg: number;
  }) => Promise<void> | void;
  onSaveAgeOneAndPhotoSpurt?: (payload: SaveAgeOneSpurtPayload) => Promise<void> | void;
}

const MIN_AGE2_IN = Number(cmToInches(VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MIN).toFixed(1)); // 27.6 in
const MAX_AGE2_IN = Number(cmToInches(VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MAX).toFixed(1)); // 45.3 in
const MIN_AGE2_LBS = Number(kgToLbs(VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MIN).toFixed(1)); // 17.6 lbs
const MAX_AGE2_LBS = Number(kgToLbs(VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MAX).toFixed(1)); // 55.1 lbs

const MIN_AGE1_IN = 22.0;
const MAX_AGE1_IN = 36.0;
const MIN_AGE1_LBS = 13.0;
const MAX_AGE1_LBS = 34.0;

const MIN_LATER_IN = 28.0;
const MAX_LATER_IN = 76.0;
const MIN_LATER_LBS = 20.0;
const MAX_LATER_LBS = 180.0;

function addYearsToIsoDate(isoDate: string, years: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return getLocalTodayIso();
  const [y, m, d] = isoDate.split('-').map(Number);
  const next = new Date(y + years, m - 1, d);
  const yy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function getIsoDateFromTimestamp(ms: number): string {
  const dt = new Date(ms);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export const EditAgeTwoBaselineModal: React.FC<EditAgeTwoBaselineModalProps> = ({
  isOpen,
  initialMode = 'age2',
  childProfile,
  isSaving = false,
  onClose,
  onSaveAgeTwoBaseline,
  onSaveAgeOneAndPhotoSpurt,
}) => {
  const [mode, setMode] = useState<BaselineModalMode>(initialMode);
  const [submitting, setSubmitting] = useState(false);

  // Mode 1: Direct Age 2 height & weight state
  const [heightInches, setHeightInches] = useState<number>(() =>
    Number(cmToInches(childProfile.ageTwoHeightCm).toFixed(1)),
  );
  const [weightLbs, setWeightLbs] = useState<number>(() =>
    Number(kgToLbs(childProfile.ageTwoWeightKg).toFixed(1)),
  );

  // Mode 2: Age 1 + Later Photo Growth Spurt Guesstimator state
  const whoAge1 = useMemo(
    () => getWhoMedianAtAge(childProfile.sex ?? 'unspecified', 12),
    [childProfile.sex],
  );
  const [ageOneInches, setAgeOneInches] = useState<number>(() =>
    Number(cmToInches(whoAge1.heightCm).toFixed(1)),
  );
  const [ageOneLbs, setAgeOneLbs] = useState<number>(() =>
    Number(kgToLbs(whoAge1.weightKg).toFixed(1)),
  );
  const [ageOneDate, setAgeOneDate] = useState<string>(() =>
    childProfile.birthDate ? addYearsToIsoDate(childProfile.birthDate, 1) : getLocalTodayIso(),
  );

  // Later photo (defaults to ~3 years after Age 1 = Age 4, or today if younger)
  const [photoDate, setPhotoDate] = useState<string>(() => {
    if (childProfile.birthDate) {
      const target4Yr = addYearsToIsoDate(childProfile.birthDate, 4);
      const today = getLocalTodayIso();
      return target4Yr <= today ? target4Yr : today;
    }
    return getLocalTodayIso();
  });
  const [manualLaterAgeYears, setManualLaterAgeYears] = useState<number>(4);
  const [manualLaterAgeExtraMonths, setManualLaterAgeExtraMonths] = useState<number>(0);

  const [laterInches, setLaterInches] = useState<number>(41.5);
  const [laterLbs, setLaterLbs] = useState<number>(36.5);
  const [hasManuallyEditedLaterWeight, setHasManuallyEditedLaterWeight] = useState<boolean>(false);
  const [spurtTiming, setSpurtTiming] = useState<SpurtTimingPreset>('auto');

  // Uploaded photo & AI height estimate state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedPhotoDataUrl, setUploadedPhotoDataUrl] = useState<string | null>(null);
  const [savePhotoToAlbum, setSavePhotoToAlbum] = useState<boolean>(true);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState<boolean>(false);
  const [photoEstimateNote, setPhotoEstimateNote] = useState<string | null>(null);
  const [photoEstimateError, setPhotoEstimateError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setHeightInches(Number(cmToInches(childProfile.ageTwoHeightCm).toFixed(1)));
    setWeightLbs(Number(kgToLbs(childProfile.ageTwoWeightKg).toFixed(1)));

    const age1Defaults = getWhoMedianAtAge(childProfile.sex ?? 'unspecified', 12);
    setAgeOneInches(Number(cmToInches(age1Defaults.heightCm).toFixed(1)));
    setAgeOneLbs(Number(kgToLbs(age1Defaults.weightKg).toFixed(1)));

    const defaultAge1Date = childProfile.birthDate
      ? addYearsToIsoDate(childProfile.birthDate, 1)
      : addYearsToIsoDate(getLocalTodayIso(), -3);
    setAgeOneDate(defaultAge1Date);

    const today = getLocalTodayIso();
    let defaultLaterDate = today;
    let defaultAgeMos = 48;
    if (childProfile.birthDate) {
      const target4Yr = addYearsToIsoDate(childProfile.birthDate, 4);
      defaultLaterDate = target4Yr <= today ? target4Yr : today;
      const calc = calculateExactAgeFromDob(childProfile.birthDate, defaultLaterDate);
      defaultAgeMos = clampNumber(calc?.totalMonths ?? 48, 25, 192);
    }
    setPhotoDate(defaultLaterDate);
    setManualLaterAgeYears(Math.floor(defaultAgeMos / 12));
    setManualLaterAgeExtraMonths(defaultAgeMos % 12);

    const laterDefaults = getWhoMedianAtAge(childProfile.sex ?? 'unspecified', defaultAgeMos);
    setLaterInches(Number(cmToInches(laterDefaults.heightCm).toFixed(1)));
    setLaterLbs(Number(kgToLbs(laterDefaults.weightKg).toFixed(1)));
    setHasManuallyEditedLaterWeight(false);
    setSpurtTiming('auto');
    setUploadedPhotoDataUrl(null);
    setSavePhotoToAlbum(true);
    setPhotoEstimateNote(null);
    setPhotoEstimateError(null);
  }, [
    isOpen,
    initialMode,
    childProfile.id,
    childProfile.sex,
    childProfile.birthDate,
    childProfile.ageTwoHeightCm,
    childProfile.ageTwoWeightKg,
  ]);

  // Compute exact age at later photo (from DOB + photoDate if DOB exists, else manual selector)
  const laterAgeMonths = useMemo(() => {
    if (childProfile.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(photoDate)) {
      const exact = calculateExactAgeFromDob(childProfile.birthDate, photoDate);
      if (exact && exact.totalMonths >= 25) {
        return clampNumber(exact.totalMonths, 25, VALIDATION_BOUNDS.AGE_MONTHS_MAX);
      }
    }
    return clampNumber(
      manualLaterAgeYears * 12 + manualLaterAgeExtraMonths,
      25,
      VALIDATION_BOUNDS.AGE_MONTHS_MAX,
    );
  }, [childProfile.birthDate, photoDate, manualLaterAgeYears, manualLaterAgeExtraMonths]);

  // Auto-suggest later weight when height/age changes unless user typed a custom weight
  useEffect(() => {
    if (mode !== 'age1_spurt' || hasManuallyEditedLaterWeight) return;
    const estKg = estimateWeightFromHeightAndAge(
      childProfile.sex ?? 'unspecified',
      laterAgeMonths,
      inchesToCm(clampNumber(laterInches, MIN_LATER_IN, MAX_LATER_IN)),
    );
    setLaterLbs(Number(kgToLbs(estKg).toFixed(1)));
  }, [mode, hasManuallyEditedLaterWeight, childProfile.sex, laterAgeMonths, laterInches]);

  // Live Growth Spurt Calculation
  const spurtEstimate = useMemo(() => {
    const safeAge1Cm = inchesToCm(clampNumber(ageOneInches, MIN_AGE1_IN, MAX_AGE1_IN));
    const safeAge1Kg = lbsToKg(clampNumber(ageOneLbs, MIN_AGE1_LBS, MAX_AGE1_LBS));
    const safeLaterCm = inchesToCm(clampNumber(laterInches, MIN_LATER_IN, MAX_LATER_IN));
    const safeLaterKg = lbsToKg(clampNumber(laterLbs, MIN_LATER_LBS, MAX_LATER_LBS));

    return estimateGrowthTrajectoryFromAgeOne({
      sex: childProfile.sex ?? 'unspecified',
      ageOneHeightCm: safeAge1Cm,
      ageOneWeightKg: safeAge1Kg,
      laterAgeMonths,
      laterHeightCm: safeLaterCm,
      laterWeightKg: safeLaterKg,
      spurtTiming,
    });
  }, [
    childProfile.sex,
    ageOneInches,
    ageOneLbs,
    laterAgeMonths,
    laterInches,
    laterLbs,
    spurtTiming,
  ]);

  if (!isOpen) return null;

  // Mode 1 derived values
  const safeHeightIn = clampNumber(heightInches, MIN_AGE2_IN, MAX_AGE2_IN);
  const safeWeightLbs = clampNumber(weightLbs, MIN_AGE2_LBS, MAX_AGE2_LBS);
  const previewHeightCm = Number(
    clampNumber(
      inchesToCm(safeHeightIn),
      VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MIN,
      VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MAX,
    ).toFixed(1),
  );
  const previewWeightKg = Number(
    clampNumber(
      lbsToKg(safeWeightLbs),
      VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MIN,
      VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MAX,
    ).toFixed(1),
  );
  const wholeFeet = Math.floor(safeHeightIn / 12);
  const remainingInches = Number((safeHeightIn - wholeFeet * 12).toFixed(1));

  const handleFeetOrInchesChange = (nextFeet: number, nextRemInches: number) => {
    const total = clampNumber(nextFeet * 12 + nextRemInches, MIN_AGE2_IN, MAX_AGE2_IN);
    setHeightInches(Number(total.toFixed(1)));
  };

  // Mode 2 photo upload + optional AI height estimation
  const handleSelectPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoEstimateError(null);
    setPhotoEstimateNote(null);

    // If file has a valid lastModified date that is at least ~1.1 years after DOB, offer it smoothly
    if (file.lastModified && childProfile.birthDate) {
      const fileIso = getIsoDateFromTimestamp(file.lastModified);
      const exact = calculateExactAgeFromDob(childProfile.birthDate, fileIso);
      if (exact && exact.totalMonths >= 25) {
        setPhotoDate(fileIso);
      }
    }

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      try {
        const prepared = await prepareWallPhotoForAnalysis(reader.result);
        setUploadedPhotoDataUrl(prepared.dataUrl);
      } catch {
        setUploadedPhotoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRunAiPhotoHeightEstimate = async () => {
    if (!uploadedPhotoDataUrl) return;
    setIsAnalyzingPhoto(true);
    setPhotoEstimateError(null);
    setPhotoEstimateNote(null);
    try {
      const result = await requestAiWallHeightEstimate({
        imageDataUrl: uploadedPhotoDataUrl,
        ageMonths: laterAgeMonths,
        childName: childProfile.name,
        calibrationMode: 'general_wall',
      });
      if (result.estimatedInches > 0) {
        const clamped = Number(
          clampNumber(result.estimatedInches, MIN_LATER_IN, MAX_LATER_IN).toFixed(1),
        );
        setLaterInches(clamped);
        setPhotoEstimateNote(
          `Photo estimate: ${formatFeetInches(inchesToCm(clamped))} (±${result.marginInches.toFixed(1)}" · ${result.detectedReferenceLabel}). Feel free to fine-tune below!`,
        );
      }
    } catch (err) {
      setPhotoEstimateError(
        err instanceof Error
          ? err.message
          : 'Could not read height from this photo automatically — you can still adjust the height slider below.',
      );
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'age2') {
        await onSaveAgeTwoBaseline({
          ageTwoHeightCm: previewHeightCm,
          ageTwoWeightKg: previewWeightKg,
        });
      } else if (onSaveAgeOneAndPhotoSpurt) {
        const safeAge1Cm = Number(
          clampNumber(
            inchesToCm(clampNumber(ageOneInches, MIN_AGE1_IN, MAX_AGE1_IN)),
            VALIDATION_BOUNDS.HEIGHT_CM_MIN,
            VALIDATION_BOUNDS.HEIGHT_CM_MAX,
          ).toFixed(1),
        );
        const safeAge1Kg = Number(
          clampNumber(
            lbsToKg(clampNumber(ageOneLbs, MIN_AGE1_LBS, MAX_AGE1_LBS)),
            VALIDATION_BOUNDS.WEIGHT_KG_MIN,
            VALIDATION_BOUNDS.WEIGHT_KG_MAX,
          ).toFixed(1),
        );
        const safeLaterCm = Number(
          clampNumber(
            inchesToCm(clampNumber(laterInches, MIN_LATER_IN, MAX_LATER_IN)),
            VALIDATION_BOUNDS.HEIGHT_CM_MIN,
            VALIDATION_BOUNDS.HEIGHT_CM_MAX,
          ).toFixed(1),
        );
        const safeLaterKg = Number(
          clampNumber(
            lbsToKg(clampNumber(laterLbs, MIN_LATER_LBS, MAX_LATER_LBS)),
            VALIDATION_BOUNDS.WEIGHT_KG_MIN,
            VALIDATION_BOUNDS.WEIGHT_KG_MAX,
          ).toFixed(1),
        );

        const safeAge1Date = VALIDATION_BOUNDS.DATE_PATTERN.test(ageOneDate)
          ? ageOneDate
          : getLocalTodayIso();
        const safeLaterDate = VALIDATION_BOUNDS.DATE_PATTERN.test(photoDate)
          ? photoDate
          : getLocalTodayIso();

        const peakLabel = spurtEstimate.peakSpurt
          ? `${spurtEstimate.peakSpurt.label} (~+${spurtEstimate.peakSpurt.heightVelocityInPerYr.toFixed(1)} in/yr)`
          : 'steady curve';

        await onSaveAgeOneAndPhotoSpurt({
          ageTwoHeightCm: spurtEstimate.estimatedAgeTwoHeightCm,
          ageTwoWeightKg: spurtEstimate.estimatedAgeTwoWeightKg,
          ageOneMeasurement: {
            ageMonths: 12,
            heightCm: safeAge1Cm,
            weightKg: safeAge1Kg,
            recordedDate: safeAge1Date,
            note: `Age 1 baseline · Used to guesstimate Age 2 & growth spurt`,
          },
          laterMeasurement: {
            ageMonths: laterAgeMonths,
            heightCm: safeLaterCm,
            weightKg: safeLaterKg,
            recordedDate: safeLaterDate,
            note: `Growth Spurt Check-In · Peak estimated ${peakLabel}`.slice(
              0,
              VALIDATION_BOUNDS.NOTE_MAX_LEN,
            ),
          },
          photoPayload:
            uploadedPhotoDataUrl && savePhotoToAlbum
              ? {
                  dataUrl: uploadedPhotoDataUrl,
                  capturedDate: safeLaterDate,
                  ageMonths: laterAgeMonths,
                  heightCm: safeLaterCm,
                  weightKg: safeLaterKg,
                  caption: `${childProfile.name} at ${formatAgeLabel(laterAgeMonths)} · ${spurtEstimate.spurtHeadline}`.slice(
                    0,
                    VALIDATION_BOUNDS.CAPTION_MAX_LEN,
                  ),
                }
              : undefined,
          spurtSummary: spurtEstimate.spurtHeadline,
        });
      } else {
        await onSaveAgeTwoBaseline({
          ageTwoHeightCm: spurtEstimate.estimatedAgeTwoHeightCm,
          ageTwoWeightKg: spurtEstimate.estimatedAgeTwoWeightKg,
        });
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const busy = isSaving || submitting;

  // Mini SVG Chart geometry for Mode 2
  const chartW = 460;
  const chartH = 164;
  const padL = 42;
  const padR = 20;
  const padT = 18;
  const padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const minAgeM = 12;
  const maxAgeM = Math.max(25, laterAgeMonths);
  const allHeightsIn = spurtEstimate.points.flatMap((p) => [
    cmToInches(p.estimatedHeightCm),
    cmToInches(p.steadyWhoHeightCm),
  ]);
  const minHIn = Math.floor(Math.min(...allHeightsIn) - 1.5);
  const maxHIn = Math.ceil(Math.max(...allHeightsIn) + 2.0);
  const hRange = Math.max(4, maxHIn - minHIn);

  const ageToX = (m: number) => padL + ((m - minAgeM) / Math.max(1, maxAgeM - minAgeM)) * plotW;
  const inToY = (inchesVal: number) => padT + plotH - ((inchesVal - minHIn) / hRange) * plotH;

  const estPathD = spurtEstimate.points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${ageToX(p.ageMonths).toFixed(1)} ${inToY(cmToInches(p.estimatedHeightCm)).toFixed(1)}`)
    .join(' ');
  const steadyPathD = spurtEstimate.points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${ageToX(p.ageMonths).toFixed(1)} ${inToY(cmToInches(p.steadyWhoHeightCm)).toFixed(1)}`)
    .join(' ');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-age-two-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className={`w-full ${
          mode === 'age1_spurt' ? 'max-w-2xl' : 'max-w-md'
        } my-auto max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 border-2 border-sky-300 dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5 transition-all`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-sky-100 dark:border-slate-800 pb-3.5">
          <div className="space-y-1">
            <h3
              id="edit-age-two-title"
              className="text-lg font-display font-bold text-indigo-950 dark:text-white"
            >
              {mode === 'age2'
                ? `Adjust ${childProfile.name} at Age 2`
                : `Estimate Age 2 & Growth Spurt from Age 1`}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {mode === 'age2'
                ? `Update ${childProfile.name}’s starting Age 2 baseline, or switch tabs if you only know Age 1 + a later photo.`
                : `Don’t remember Age 2? Enter ${childProfile.name}’s Age 1 size and upload a photo from a later date (like 3 years later) to guesstimate Age 2 and where the biggest growth spurt happened.`}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close baseline editor"
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-sky-50 dark:hover:bg-slate-800 hover:text-indigo-950 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div
          role="tablist"
          aria-label="Baseline entry method"
          className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-sky-50 dark:bg-slate-800 border border-sky-200 dark:border-slate-700"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'age2'}
            onClick={() => setMode('age2')}
            className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'age2'
                ? 'bg-white dark:bg-slate-900 text-indigo-950 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white'
            }`}
          >
            I Know Age 2
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'age1_spurt'}
            onClick={() => setMode('age1_spurt')}
            className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'age1_spurt'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Age 1 + Later Photo
          </button>
        </div>

        {mode === 'age2' ? (
          <>
            {/* Mode 1: Direct Age 2 Height Controls */}
            <div className="space-y-3 bg-sky-50/70 dark:bg-slate-800/70 border border-sky-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-900 dark:text-sky-300">
                  <Ruler className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                  <span>Height at Age 2</span>
                </div>
                <span className="text-xs font-mono tabular-nums font-bold text-indigo-950 dark:text-white">
                  {formatFeetInches(previewHeightCm)} · {formatMetricHeight(previewHeightCm)}
                </span>
              </div>

              <input
                type="range"
                aria-label="Age 2 height in inches"
                min={MIN_AGE2_IN}
                max={MAX_AGE2_IN}
                step={0.1}
                value={safeHeightIn}
                onChange={(e) => setHeightInches(parseFloat(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />

              <div className="grid grid-cols-3 gap-2.5">
                <label className="space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span>Feet</span>
                  <input
                    type="number"
                    min={2}
                    max={3}
                    step={1}
                    value={wholeFeet}
                    onChange={(e) =>
                      handleFeetOrInchesChange(parseInt(e.target.value, 10) || 2, remainingInches)
                    }
                    className="w-full h-10 px-2.5 rounded-lg border border-sky-200 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums text-sm font-bold text-indigo-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </label>

                <label className="space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span>Inches</span>
                  <input
                    type="number"
                    min={0}
                    max={11.9}
                    step={0.1}
                    value={remainingInches}
                    onChange={(e) =>
                      handleFeetOrInchesChange(wholeFeet, parseFloat(e.target.value) || 0)
                    }
                    className="w-full h-10 px-2.5 rounded-lg border border-sky-200 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums text-sm font-bold text-indigo-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </label>

                <label className="space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span>Total in</span>
                  <input
                    type="number"
                    min={MIN_AGE2_IN}
                    max={MAX_AGE2_IN}
                    step={0.1}
                    value={heightInches}
                    onChange={(e) => setHeightInches(parseFloat(e.target.value) || MIN_AGE2_IN)}
                    className="w-full h-10 px-2.5 rounded-lg border border-sky-200 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums text-sm font-bold text-indigo-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </label>
              </div>
            </div>

            {/* Direct Age 2 Weight Controls */}
            <div className="space-y-3 bg-emerald-50/70 dark:bg-slate-800/70 border border-emerald-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-300">
                  <Scale className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span>Weight at Age 2</span>
                </div>
                <span className="text-xs font-mono tabular-nums font-bold text-indigo-950 dark:text-white">
                  {formatPounds(previewWeightKg)} · {formatMetricWeight(previewWeightKg)}
                </span>
              </div>

              <input
                type="range"
                aria-label="Age 2 weight in pounds"
                min={MIN_AGE2_LBS}
                max={MAX_AGE2_LBS}
                step={0.2}
                value={safeWeightLbs}
                onChange={(e) => setWeightLbs(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />

              <label className="block space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <span>Weight (lbs)</span>
                <input
                  type="number"
                  min={MIN_AGE2_LBS}
                  max={MAX_AGE2_LBS}
                  step={0.1}
                  value={weightLbs}
                  onChange={(e) => setWeightLbs(parseFloat(e.target.value) || MIN_AGE2_LBS)}
                  className="w-full h-10 px-3 rounded-lg border border-emerald-200 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums text-sm font-bold text-indigo-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
            </div>
          </>
        ) : (
          /* Mode 2: Age 1 Baseline + Later Dated Photo -> Growth Spurt Guesstimator */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Step 1: Age 1 Measurements */}
              <div className="space-y-3 bg-sky-50/70 dark:bg-slate-800/70 border border-sky-200 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-sky-900 dark:text-sky-300">
                    1. Known Size at Age 1 (12 mos)
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {formatFeetInches(inchesToCm(ageOneInches))}
                  </span>
                </div>

                {/* Age 1 Height */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <span>Height at Age 1</span>
                    <span className="font-mono tabular-nums font-bold text-indigo-950 dark:text-white">
                      {ageOneInches.toFixed(1)} in · {formatMetricHeight(inchesToCm(ageOneInches))}
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="Age 1 height in inches"
                    min={MIN_AGE1_IN}
                    max={MAX_AGE1_IN}
                    step={0.1}
                    value={clampNumber(ageOneInches, MIN_AGE1_IN, MAX_AGE1_IN)}
                    onChange={(e) => setAgeOneInches(parseFloat(e.target.value))}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                {/* Age 1 Weight */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <span>Weight at Age 1</span>
                    <span className="font-mono tabular-nums font-bold text-indigo-950 dark:text-white">
                      {ageOneLbs.toFixed(1)} lbs · {formatMetricWeight(lbsToKg(ageOneLbs))}
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="Age 1 weight in pounds"
                    min={MIN_AGE1_LBS}
                    max={MAX_AGE1_LBS}
                    step={0.2}
                    value={clampNumber(ageOneLbs, MIN_AGE1_LBS, MAX_AGE1_LBS)}
                    onChange={(e) => setAgeOneLbs(parseFloat(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>

                <label className="block space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                    Age 1 Checkup Date
                  </span>
                  <input
                    type="date"
                    value={ageOneDate}
                    onChange={(e) => setAgeOneDate(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-sky-200 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono text-xs font-semibold text-indigo-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </label>
              </div>

              {/* Step 2: Upload Later Photo & Date */}
              <div className="space-y-3 bg-amber-50/70 dark:bg-slate-800/70 border border-amber-200 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-950 dark:text-amber-300">
                    2. Later Photo (e.g. 3 yrs later)
                  </span>
                  <span className="text-[11px] font-mono tabular-nums font-bold text-indigo-950 dark:text-white">
                    {formatAgeLabel(laterAgeMonths)}
                  </span>
                </div>

                {/* Upload photo box */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleSelectPhotoFile(e)}
                  className="hidden"
                />

                {uploadedPhotoDataUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={uploadedPhotoDataUrl}
                      alt={`${childProfile.name} later check-in photo`}
                      className="w-16 h-16 rounded-xl object-cover border border-amber-300 dark:border-slate-600 shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleRunAiPhotoHeightEstimate()}
                          disabled={isAnalyzingPhoto}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {isAnalyzingPhoto ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
                              Estimating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              Guesstimate Height
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-100/60 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                        >
                          Change
                        </button>
                      </div>
                      <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={savePhotoToAlbum}
                          onChange={(e) => setSavePhotoToAlbum(e.target.checked)}
                          className="rounded accent-amber-500 cursor-pointer"
                        />
                        <span>Save photo to album</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full min-h-[56px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700/80 bg-white/80 dark:bg-slate-900/60 hover:bg-amber-100/50 dark:hover:bg-slate-800 text-xs font-bold text-amber-950 dark:text-amber-200 transition-colors cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                    <span>Upload a Later Photo (Optional AI Height)</span>
                    <Upload className="w-3.5 h-3.5 opacity-70 shrink-0" aria-hidden="true" />
                  </button>
                )}

                {photoEstimateNote && (
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-snug">
                    {photoEstimateNote}
                  </p>
                )}
                {photoEstimateError && (
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-snug">
                    {photoEstimateError}
                  </p>
                )}

                {/* Photo Date + Age fallback if DOB missing */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="block space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <span>Photo Date</span>
                    <input
                      type="date"
                      value={photoDate}
                      onChange={(e) => setPhotoDate(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-amber-200 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono text-xs font-semibold text-indigo-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </label>

                  {!childProfile.birthDate ? (
                    <label className="block space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      <span>Child’s Age (yrs)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={2}
                          max={16}
                          value={manualLaterAgeYears}
                          onChange={(e) =>
                            setManualLaterAgeYears(clampNumber(parseInt(e.target.value, 10) || 4, 2, 16))
                          }
                          className="w-full h-9 px-2 rounded-lg border border-amber-200 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono text-xs font-bold text-indigo-950 dark:text-white"
                        />
                        <input
                          type="number"
                          min={0}
                          max={11}
                          value={manualLaterAgeExtraMonths}
                          onChange={(e) =>
                            setManualLaterAgeExtraMonths(
                              clampNumber(parseInt(e.target.value, 10) || 0, 0, 11),
                            )
                          }
                          aria-label="Extra months"
                          className="w-16 h-9 px-2 rounded-lg border border-amber-200 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono text-xs font-bold text-indigo-950 dark:text-white"
                        />
                      </div>
                    </label>
                  ) : (
                    <div className="flex flex-col justify-end pb-1">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Span from Age 1
                      </span>
                      <span className="text-xs font-mono tabular-nums font-bold text-indigo-950 dark:text-white">
                        {spurtEstimate.spanYears.toFixed(1)} yrs later
                      </span>
                    </div>
                  )}
                </div>

                {/* Later Height & Weight */}
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <span>Height ({formatFeetInches(inchesToCm(laterInches))})</span>
                    <input
                      type="number"
                      min={MIN_LATER_IN}
                      max={MAX_LATER_IN}
                      step={0.1}
                      value={laterInches}
                      onChange={(e) => setLaterInches(parseFloat(e.target.value) || MIN_LATER_IN)}
                      className="w-full h-9 px-2.5 rounded-lg border border-amber-200 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums text-xs font-bold text-indigo-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </label>
                  <label className="space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <span>Weight (lbs)</span>
                    <input
                      type="number"
                      min={MIN_LATER_LBS}
                      max={MAX_LATER_LBS}
                      step={0.2}
                      value={laterLbs}
                      onChange={(e) => {
                        setHasManuallyEditedLaterWeight(true);
                        setLaterLbs(parseFloat(e.target.value) || MIN_LATER_LBS);
                      }}
                      className="w-full h-9 px-2.5 rounded-lg border border-amber-200 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums text-xs font-bold text-indigo-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Step 3: Live Growth Spurt Guesstimate Curve & Results */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-display font-bold text-indigo-950 dark:text-white">
                    {spurtEstimate.spurtHeadline}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {spurtEstimate.spurtExplanation}
                  </p>
                </div>
              </div>

              {/* Clean 3-Stat Readout (Unboxed Typographic Layout) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2.5 border-y border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">
                    Estimated Age 2 Baseline
                  </span>
                  <span className="font-mono tabular-nums font-bold text-indigo-950 dark:text-white text-sm">
                    {formatFeetInches(spurtEstimate.estimatedAgeTwoHeightCm)} ·{' '}
                    {formatPounds(spurtEstimate.estimatedAgeTwoWeightKg)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">
                    Estimated Spurt Speed
                  </span>
                  <span className="font-mono tabular-nums font-bold text-amber-700 dark:text-amber-300 text-sm">
                    {spurtEstimate.peakSpurt
                      ? `+${spurtEstimate.peakSpurt.heightVelocityInPerYr.toFixed(1)} in/yr (${spurtEstimate.peakSpurt.label})`
                      : 'Steady pace'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">
                    Total Growth ({spurtEstimate.spanYears.toFixed(1)} yrs)
                  </span>
                  <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                    +{cmToInches(Math.max(0, spurtEstimate.totalHeightGainCm)).toFixed(1)} in · +
                    {kgToLbs(Math.max(0, spurtEstimate.totalWeightGainKg)).toFixed(1)} lbs
                  </span>
                </div>
              </div>

              {/* Interactive Growth Spurt Curve SVG */}
              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${chartW} ${chartH}`}
                  className="w-full min-w-[360px] h-auto"
                  role="img"
                  aria-label="Estimated growth trajectory from Age 1 to later photo showing likely growth spurt window"
                >
                  {/* Highlighted Growth Spurt Window Band */}
                  {spurtEstimate.peakSpurt && (
                    <g>
                      <rect
                        x={ageToX(spurtEstimate.peakSpurt.fromAgeMonths)}
                        y={padT}
                        width={Math.max(
                          12,
                          ageToX(spurtEstimate.peakSpurt.toAgeMonths) -
                            ageToX(spurtEstimate.peakSpurt.fromAgeMonths),
                        )}
                        height={plotH}
                        rx={6}
                        className="fill-amber-300/35 dark:fill-amber-500/20"
                      />
                      <text
                        x={
                          (ageToX(spurtEstimate.peakSpurt.fromAgeMonths) +
                            ageToX(spurtEstimate.peakSpurt.toAgeMonths)) /
                          2
                        }
                        y={padT + 12}
                        textAnchor="middle"
                        fontSize={9.5}
                        fontWeight={700}
                        className="fill-amber-800 dark:fill-amber-300"
                      >
                        Likely Spurt
                      </text>
                    </g>
                  )}

                  {/* Horizontal Baseline Axis */}
                  <line
                    x1={padL}
                    y1={padT + plotH}
                    x2={chartW - padR}
                    y2={padT + plotH}
                    className="stroke-slate-300 dark:stroke-slate-600"
                    strokeWidth={1}
                  />

                  {/* Steady WHO Percentile Comparison (Dashed) */}
                  <path
                    d={steadyPathD}
                    fill="none"
                    className="stroke-slate-400 dark:stroke-slate-500"
                    strokeWidth={1.75}
                    strokeDasharray="4 4"
                  />

                  {/* Estimated Growth Trajectory (Solid) */}
                  <path
                    d={estPathD}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth={2.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Plot Points & X-Axis Labels */}
                  {spurtEstimate.points.map((pt) => {
                    const cx = ageToX(pt.ageMonths);
                    const cy = inToY(cmToInches(pt.estimatedHeightCm));
                    const dotFill = pt.isAgeTwoEstimate
                      ? '#f59e0b'
                      : pt.isLaterPhotoAnchor
                        ? '#10b981'
                        : '#0284c7';
                    return (
                      <g key={pt.ageMonths}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={pt.isAgeTwoEstimate ? 5.5 : 4.5}
                          fill={dotFill}
                          stroke="#ffffff"
                          strokeWidth={1.6}
                        />
                        <text
                          x={cx}
                          y={Math.max(padT + 10, cy - 9)}
                          textAnchor="middle"
                          fontSize={9.5}
                          fontWeight={700}
                          fontFamily="JetBrains Mono, monospace"
                          className="fill-indigo-950 dark:fill-white"
                        >
                          {formatFeetInches(pt.estimatedHeightCm)}
                        </text>
                        <text
                          x={cx}
                          y={chartH - 8}
                          textAnchor="middle"
                          fontSize={9.5}
                          fontWeight={pt.isAgeTwoEstimate ? 700 : 600}
                          className={
                            pt.isAgeTwoEstimate
                              ? 'fill-amber-700 dark:fill-amber-300'
                              : 'fill-slate-500 dark:fill-slate-400'
                          }
                        >
                          {pt.isAgeTwoEstimate ? 'Est. Age 2' : pt.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Spurt Pattern Selector (Lets parents explore when the spurt happened) */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  When did you notice the biggest jump?
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      { id: 'auto', label: 'Auto Fit' },
                      { id: 'early_toddler', label: 'Ages 1–2' },
                      { id: 'mid_childhood', label: 'Middle Years' },
                      { id: 'recent_leap', label: 'Recent Year' },
                      { id: 'steady', label: 'Steady' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSpurtTiming(opt.id)}
                      className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer whitespace-nowrap ${
                        spurtTiming === opt.id
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-950 dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-sky-100 dark:border-slate-800">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {mode === 'age1_spurt'
              ? 'Saves Age 1, estimated Age 2 baseline, and your later photo milestone.'
              : 'Recalculates all growth comparisons automatically.'}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
              {busy
                ? 'Saving...'
                : mode === 'age2'
                  ? 'Save Age 2 Baseline'
                  : 'Apply Estimate & Save Milestones'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
