import React, { useEffect, useRef, useState } from 'react';
import { Cake, Camera, Trash2, UserPlus, X } from 'lucide-react';
import {
  AccessoryId,
  BiologicalSex,
  calculateExactAgeFromDob,
  CHARACTER_PALETTES,
  ChildProfile,
  clampNumber,
  cmToInches,
  formatFeetInches,
  formatMetricHeight,
  formatMetricWeight,
  formatPounds,
  formatTotalInches,
  getLocalTodayIso,
  HAIR_COLOR_PRESETS,
  HairStyle,
  inchesToCm,
  kgToLbs,
  lbsToKg,
  PaletteId,
  sanitizeBiologicalSex,
  SKIN_TONE_PRESETS,
  splitCmToFeetAndInches,
  VALIDATION_BOUNDS,
} from '../types';
import { cropPortraitToDataUrl } from '../services/avatarPhotoService';

export interface NewChildCreationPayload {
  name: string;
  birthDate: string;
  sex: BiologicalSex;
  ageTwoHeightCm: number;
  ageTwoWeightKg: number;
  currentHeightCm: number;
  currentWeightKg: number;
  currentAgeMonths: number;
  paletteId: PaletteId;
  accessoryId: AccessoryId;
  hairStyle: HairStyle;
  skinTone: string;
  hairColor: string;
  initialAvatarDataUrl?: string | null;
  initialRawPhotoDataUrl?: string | null;
}

interface AddChildModalProps {
  isOpen: boolean;
  existingChildren: ChildProfile[];
  isSaving: boolean;
  onClose: () => void;
  onCreateChild: (payload: NewChildCreationPayload) => Promise<void>;
}

const ACCESSORY_OPTIONS: { id: AccessoryId; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'sprout', label: 'Sprout' },
  { id: 'cap', label: 'Sun Cap' },
  { id: 'crown', label: 'Crown' },
  { id: 'dino', label: 'Dino' },
];

const HAIR_OPTIONS: { id: HairStyle; label: string }[] = [
  { id: 'curls', label: 'Curls' },
  { id: 'bob', label: 'Bob' },
  { id: 'spiky', label: 'Spiky' },
  { id: 'puffs', label: 'Puffs' },
];

// Approximate typical height (cm) and weight (kg) by age in months for convenient initial defaults
function estimateTypicalSizeForAgeMonths(ageMonths: number): {
  heightCm: number;
  weightKg: number;
} {
  const clamped = clampNumber(ageMonths, 12, 192);
  if (clamped <= 24) return { heightCm: 86.5, weightKg: 12.5 };
  if (clamped <= 36) return { heightCm: 95.5, weightKg: 14.4 };
  if (clamped <= 48) return { heightCm: 103.0, weightKg: 16.3 };
  if (clamped <= 60) return { heightCm: 110.0, weightKg: 18.4 };
  if (clamped <= 72) return { heightCm: 116.0, weightKg: 20.6 };
  if (clamped <= 84) return { heightCm: 121.5, weightKg: 22.9 };
  if (clamped <= 96) return { heightCm: 127.0, weightKg: 25.4 };
  if (clamped <= 120) return { heightCm: 138.0, weightKg: 31.5 };
  if (clamped <= 144) return { heightCm: 150.0, weightKg: 40.5 };
  return { heightCm: 162.0, weightKg: 51.0 };
}

export const AddChildModal: React.FC<AddChildModalProps> = ({
  isOpen,
  existingChildren,
  isSaving,
  onClose,
  onCreateChild,
}) => {
  const [name, setName] = useState<string>('');
  const [birthDate, setBirthDate] = useState<string>('');
  const [sex, setSex] = useState<BiologicalSex>('unspecified');
  const [ageTwoHeightCm, setAgeTwoHeightCm] = useState<number>(86.5);
  const [ageTwoWeightKg, setAgeTwoWeightKg] = useState<number>(12.5);
  const [currentHeightCm, setCurrentHeightCm] = useState<number>(103.0);
  const [currentWeightKg, setCurrentWeightKg] = useState<number>(16.5);
  const [currentAgeMonths, setCurrentAgeMonths] = useState<number>(48);
  const [hasEditedCurrentSize, setHasEditedCurrentSize] = useState<boolean>(false);

  const [paletteId, setPaletteId] = useState<PaletteId>('sunny');
  const [accessoryId, setAccessoryId] = useState<AccessoryId>('sprout');
  const [hairStyle, setHairStyle] = useState<HairStyle>('bob');
  const [skinTone, setSkinTone] = useState<string>(SKIN_TONE_PRESETS[1].hex);
  const [hairColor, setHairColor] = useState<string>(HAIR_COLOR_PRESETS[1].hex);

  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [rawUploadedDataUrl, setRawUploadedDataUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset clean blank state every time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    const paletteOrder: PaletteId[] = ['sunny', 'ocean', 'berry', 'meadow'];
    const hairOrder: HairStyle[] = ['bob', 'spiky', 'puffs', 'curls'];
    const count = existingChildren.length;

    setName('');
    setBirthDate('');
    setSex('unspecified');
    setAgeTwoHeightCm(86.5);
    setAgeTwoWeightKg(12.5);
    setCurrentHeightCm(103.0);
    setCurrentWeightKg(16.5);
    setCurrentAgeMonths(48);
    setHasEditedCurrentSize(false);
    setPaletteId(paletteOrder[count % paletteOrder.length]);
    setAccessoryId('sprout');
    setHairStyle(hairOrder[count % hairOrder.length]);
    setSkinTone(SKIN_TONE_PRESETS[1].hex);
    setHairColor(HAIR_COLOR_PRESETS[1].hex);
    setAvatarPreviewUrl(null);
    setRawUploadedDataUrl(null);
    setValidationError(null);

    const timer = window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [isOpen, existingChildren.length]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  const dobCalc = birthDate ? calculateExactAgeFromDob(birthDate) : null;

  const handleDobChange = (nextDob: string) => {
    setBirthDate(nextDob);
    const calc = calculateExactAgeFromDob(nextDob);
    if (calc) {
      setCurrentAgeMonths(calc.totalMonths);
      if (!hasEditedCurrentSize) {
        const est = estimateTypicalSizeForAgeMonths(calc.totalMonths);
        setCurrentHeightCm(est.heightCm);
        setCurrentWeightKg(est.weightKg);
      }
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (!result) return;
      setRawUploadedDataUrl(result);
      try {
        const cropped = await cropPortraitToDataUrl(result, {
          zoom: 1.2,
          offsetX: 0,
          offsetY: 0,
        });
        setAvatarPreviewUrl(cropped.croppedDataUrl);
        if (VALIDATION_BOUNDS.HEX_COLOR_PATTERN.test(cropped.sampledSkinHex)) {
          setSkinTone(cropped.sampledSkinHex);
        }
        setAccessoryId('none');
      } catch {
        setAvatarPreviewUrl(result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const currentSplit = splitCmToFeetAndInches(currentHeightCm);
  const currentWeightLbs = Number(kgToLbs(currentWeightKg).toFixed(1));
  const currentYears = Math.floor(currentAgeMonths / 12);
  const currentRemMonths = currentAgeMonths % 12;

  const ageTwoSplit = splitCmToFeetAndInches(ageTwoHeightCm);
  const ageTwoWeightLbs = Number(kgToLbs(ageTwoWeightKg).toFixed(1));

  const applyCurrentFeetInches = (feet: number, remInches: number) => {
    setHasEditedCurrentSize(true);
    const safeInches = clampNumber(feet * 12 + remInches, 24, 72);
    const nextCm = Number(
      clampNumber(
        inchesToCm(safeInches),
        VALIDATION_BOUNDS.HEIGHT_CM_MIN,
        VALIDATION_BOUNDS.HEIGHT_CM_MAX,
      ).toFixed(1),
    );
    setCurrentHeightCm(nextCm);
  };

  const applyCurrentPounds = (lbs: number) => {
    setHasEditedCurrentSize(true);
    const nextKg = Number(
      clampNumber(
        lbsToKg(lbs),
        VALIDATION_BOUNDS.WEIGHT_KG_MIN,
        VALIDATION_BOUNDS.WEIGHT_KG_MAX,
      ).toFixed(1),
    );
    setCurrentWeightKg(nextKg);
  };

  const applyAgeTwoFeetInches = (feet: number, remInches: number) => {
    const safeInches = clampNumber(feet * 12 + remInches, 27.6, 45.2);
    const nextCm = Number(
      clampNumber(
        inchesToCm(safeInches),
        VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MIN,
        VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MAX,
      ).toFixed(1),
    );
    setAgeTwoHeightCm(nextCm);
  };

  const applyAgeTwoPounds = (lbs: number) => {
    const nextKg = Number(
      clampNumber(
        lbsToKg(lbs),
        VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MIN,
        VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MAX,
      ).toFixed(1),
    );
    setAgeTwoWeightKg(nextKg);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim().slice(0, VALIDATION_BOUNDS.NAME_MAX_LEN);
    if (!trimmedName) {
      setValidationError('Please enter your child’s name to create their profile.');
      nameInputRef.current?.focus();
      return;
    }

    setValidationError(null);
    const cleanDob = VALIDATION_BOUNDS.DATE_PATTERN.test(birthDate) ? birthDate : '';
    const resolvedAgeMonths = dobCalc ? dobCalc.totalMonths : currentAgeMonths;

    await onCreateChild({
      name: trimmedName,
      birthDate: cleanDob,
      sex: sanitizeBiologicalSex(sex),
      ageTwoHeightCm: Number(
        clampNumber(
          ageTwoHeightCm,
          VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MIN,
          VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MAX,
        ).toFixed(1),
      ),
      ageTwoWeightKg: Number(
        clampNumber(
          ageTwoWeightKg,
          VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MIN,
          VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MAX,
        ).toFixed(1),
      ),
      currentHeightCm: Number(
        clampNumber(
          currentHeightCm,
          VALIDATION_BOUNDS.HEIGHT_CM_MIN,
          VALIDATION_BOUNDS.HEIGHT_CM_MAX,
        ).toFixed(1),
      ),
      currentWeightKg: Number(
        clampNumber(
          currentWeightKg,
          VALIDATION_BOUNDS.WEIGHT_KG_MIN,
          VALIDATION_BOUNDS.WEIGHT_KG_MAX,
        ).toFixed(1),
      ),
      currentAgeMonths: Math.round(
        clampNumber(
          resolvedAgeMonths,
          VALIDATION_BOUNDS.AGE_MONTHS_MIN,
          VALIDATION_BOUNDS.AGE_MONTHS_MAX,
        ),
      ),
      paletteId,
      accessoryId,
      hairStyle,
      skinTone: VALIDATION_BOUNDS.HEX_COLOR_PATTERN.test(skinTone)
        ? skinTone
        : SKIN_TONE_PRESETS[1].hex,
      hairColor: VALIDATION_BOUNDS.HEX_COLOR_PATTERN.test(hairColor)
        ? hairColor
        : HAIR_COLOR_PRESETS[1].hex,
      initialAvatarDataUrl: avatarPreviewUrl,
      initialRawPhotoDataUrl: rawUploadedDataUrl,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-child-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="bg-white border-2 border-emerald-200 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-emerald-50 border-b border-emerald-200">
          <div className="flex items-center gap-2.5">
            <UserPlus className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
            <div>
              <h2 id="add-child-modal-title" className="text-base sm:text-lg font-bold text-indigo-950">
                Add Another Child Profile
              </h2>
              <p className="text-xs text-slate-600">
                Each child gets their own separate Growth Wall, milestones, PDF reports &amp; photo album.{' '}
                {existingChildren.length > 0 && (
                  <span className="font-semibold text-emerald-900">
                    Saved: {existingChildren.map((c) => c.name).join(', ')}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            aria-label="Close add child dialog"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Form Body */}
        <form noValidate onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {validationError && (
            <div
              role="alert"
              className="px-3.5 py-2.5 text-xs font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg"
            >
              {validationError}
            </div>
          )}

          {/* 1. Name, Date of Birth & WHO Sex Curve */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label htmlFor="new-child-name" className="block text-xs font-bold text-indigo-950">
                Child’s Name *
              </label>
              <input
                ref={nameInputRef}
                id="new-child-name"
                type="text"
                maxLength={VALIDATION_BOUNDS.NAME_MAX_LEN}
                placeholder="e.g. Maya, Oliver, Zoe"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="new-child-dob" className="block text-xs font-bold text-indigo-950">
                Date of Birth
              </label>
              <input
                id="new-child-dob"
                type="date"
                max={getLocalTodayIso()}
                value={birthDate}
                onChange={(e) => handleDobChange(e.target.value)}
                className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {dobCalc && (
            <div className="flex flex-wrap items-center gap-2 text-xs bg-sky-50 border border-sky-200 rounded-lg px-3.5 py-2 text-slate-700">
              <Cake className="w-4 h-4 text-rose-500 shrink-0" aria-hidden="true" />
              <span className="font-bold text-indigo-950">
                Calculated Age: {dobCalc.formattedExactAge}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {dobCalc.isBirthdayToday
                  ? 'Happy Birthday today!'
                  : `Next birthday in ${dobCalc.daysUntilNextBirthday} days`}
              </span>
            </div>
          )}

          {/* WHO Growth Curve */}
          <div className="space-y-1.5">
            <span className="block text-xs font-bold text-indigo-950">
              WHO Growth Chart Curve
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'boy', label: 'Boy' },
                  { id: 'girl', label: 'Girl' },
                  { id: 'unspecified', label: 'Combined' },
                ] as { id: BiologicalSex; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSex(opt.id)}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                    sex === opt.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Optional Photo Upload Right Inside Add Child */}
          <div className="flex items-center justify-between gap-3 p-3.5 bg-sky-50/80 border border-sky-200 rounded-xl">
            <div className="flex items-center gap-3 min-w-0">
              {avatarPreviewUrl ? (
                <img
                  src={avatarPreviewUrl}
                  alt="New child portrait preview"
                  className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5 text-amber-800" aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-indigo-950">
                  {avatarPreviewUrl
                    ? 'Child Photo Ready for Avatar & Album'
                    : 'Optional: Upload or Take Child’s Photo'}
                </p>
                <p className="text-[11px] text-slate-600">
                  Frames onto {name.trim() || 'this child'}’s avatar and saves to their own album
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <input
                ref={photoFileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => photoFileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                {avatarPreviewUrl ? 'Change Photo' : 'Choose Photo'}
              </button>
              {avatarPreviewUrl && (
                <button
                  type="button"
                  aria-label="Remove selected photo"
                  onClick={() => {
                    setAvatarPreviewUrl(null);
                    setRawUploadedDataUrl(null);
                  }}
                  className="p-1.5 text-slate-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* 3. Current Height & Weight Today (Imperial Primary, Metric Secondary) */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-950">
                Current Measurements Today (ft &amp; in · lb)
              </h3>
              <span className="text-xs font-mono font-bold tabular-nums text-emerald-800">
                {formatFeetInches(currentHeightCm)} ({formatTotalInches(currentHeightCm)}) ·{' '}
                {formatPounds(currentWeightKg)}
              </span>
            </div>

            {!birthDate && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="new-child-age-yrs" className="block text-xs font-semibold text-slate-700">
                    Current Age (Years)
                  </label>
                  <select
                    id="new-child-age-yrs"
                    value={currentYears}
                    onChange={(e) => {
                      const yrs = parseInt(e.target.value, 10);
                      setCurrentAgeMonths(clampNumber(yrs * 12 + currentRemMonths, 0, 216));
                    }}
                    className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                  >
                    {Array.from({ length: 18 }, (_, i) => i).map((yr) => (
                      <option key={yr} value={yr}>
                        {yr} {yr === 1 ? 'year' : 'years'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="new-child-age-mos" className="block text-xs font-semibold text-slate-700">
                    Extra Months
                  </label>
                  <select
                    id="new-child-age-mos"
                    value={currentRemMonths}
                    onChange={(e) => {
                      const mos = parseInt(e.target.value, 10);
                      setCurrentAgeMonths(clampNumber(currentYears * 12 + mos, 0, 216));
                    }}
                    className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                  >
                    {Array.from({ length: 12 }, (_, m) => m).map((m) => (
                      <option key={m} value={m}>
                        {m} mos
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="new-child-cur-ft" className="block text-xs font-semibold text-slate-700">
                  Height Today (Feet &amp; Inches)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    id="new-child-cur-ft"
                    value={currentSplit.feet}
                    onChange={(e) =>
                      applyCurrentFeetInches(parseInt(e.target.value, 10), currentSplit.inches)
                    }
                    className="w-full h-10 px-2 text-xs font-mono font-semibold tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
                  >
                    {[1, 2, 3, 4, 5, 6].map((ft) => (
                      <option key={ft} value={ft}>
                        {ft} ft
                      </option>
                    ))}
                  </select>
                  <input
                    id="new-child-cur-in"
                    type="number"
                    step="0.1"
                    min={0}
                    max={11.9}
                    aria-label="Current extra inches"
                    value={currentSplit.inches}
                    onChange={(e) => {
                      const nextIn = clampNumber(parseFloat(e.target.value) || 0, 0, 11.9);
                      applyCurrentFeetInches(currentSplit.feet, nextIn);
                    }}
                    className="w-full h-10 px-2.5 text-xs font-mono font-semibold tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <p className="text-[11px] font-mono tabular-nums text-slate-500">
                  {formatTotalInches(currentHeightCm)} · {formatMetricHeight(currentHeightCm)}
                </p>
              </div>

              <div className="space-y-1">
                <label htmlFor="new-child-cur-lbs" className="block text-xs font-semibold text-slate-700">
                  Weight Today (lb)
                </label>
                <input
                  id="new-child-cur-lbs"
                  type="number"
                  step="0.1"
                  min={6}
                  max={260}
                  value={currentWeightLbs}
                  onChange={(e) => applyCurrentPounds(parseFloat(e.target.value) || 20)}
                  className="w-full h-10 px-3 text-sm font-mono font-semibold tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
                />
                <p className="text-[11px] font-mono tabular-nums text-slate-500">
                  Secondary: {formatMetricWeight(currentWeightKg)}
                </p>
              </div>
            </div>
          </div>

          {/* 4. Age 2 Starting Baseline (ft & in, lb) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label htmlFor="new-child-age2-ft" className="block text-xs font-semibold text-slate-700">
                Age 2 Starting Height (ft &amp; in)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  id="new-child-age2-ft"
                  value={ageTwoSplit.feet}
                  onChange={(e) =>
                    applyAgeTwoFeetInches(parseInt(e.target.value, 10), ageTwoSplit.inches)
                  }
                  className="w-full h-9 px-2 text-xs font-mono font-semibold tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                >
                  <option value={2}>2 ft</option>
                  <option value={3}>3 ft</option>
                </select>
                <input
                  id="new-child-age2-in"
                  type="number"
                  step="0.1"
                  min={0}
                  max={11.9}
                  aria-label="Age 2 extra inches"
                  value={ageTwoSplit.inches}
                  onChange={(e) => {
                    const nextIn = clampNumber(parseFloat(e.target.value) || 0, 0, 11.9);
                    applyAgeTwoFeetInches(ageTwoSplit.feet, nextIn);
                  }}
                  className="w-full h-9 px-2.5 text-xs font-mono font-semibold tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
              <p className="text-[11px] font-mono tabular-nums text-slate-400">
                {formatTotalInches(ageTwoHeightCm)} · {formatMetricHeight(ageTwoHeightCm)}
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="new-child-age2-lbs" className="block text-xs font-semibold text-slate-700">
                Age 2 Starting Weight (lb)
              </label>
              <input
                id="new-child-age2-lbs"
                type="number"
                step="0.1"
                min={18}
                max={55}
                value={ageTwoWeightLbs}
                onChange={(e) => applyAgeTwoPounds(parseFloat(e.target.value) || 27.6)}
                className="w-full h-9 px-3 text-xs font-mono font-semibold tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              />
              <p className="text-[11px] font-mono tabular-nums text-slate-400">
                Secondary: {formatMetricWeight(ageTwoWeightKg)}
              </p>
            </div>
          </div>

          {/* 5. Avatar Outfit, Hair & Complexion */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-slate-700">
                Outfit Colors
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(CHARACTER_PALETTES) as PaletteId[]).map((pid) => {
                  const p = CHARACTER_PALETTES[pid];
                  const active = paletteId === pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => setPaletteId(pid)}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-emerald-600 bg-emerald-50 text-indigo-950'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-semibold text-slate-700">
                Complexion &amp; Hair Style
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {SKIN_TONE_PRESETS.map((tone) => {
                  const selected = skinTone.toLowerCase() === tone.hex.toLowerCase();
                  return (
                    <button
                      key={tone.id}
                      type="button"
                      title={tone.label}
                      aria-label={`Skin tone ${tone.label}`}
                      onClick={() => setSkinTone(tone.hex)}
                      className={`p-0.5 rounded-full border-2 cursor-pointer ${
                        selected ? 'border-emerald-600 scale-110' : 'border-transparent'
                      }`}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                        <circle
                          cx="10"
                          cy="10"
                          r="8.5"
                          fill={tone.hex}
                          stroke="#334155"
                          strokeWidth="1"
                        />
                      </svg>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {HAIR_OPTIONS.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setHairStyle(h.id)}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-md border transition-colors cursor-pointer ${
                      hairStyle === h.id
                        ? 'border-emerald-600 bg-emerald-50 text-indigo-950'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-1">
                {ACCESSORY_OPTIONS.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setAccessoryId(acc.id)}
                    className={`px-1.5 py-1 text-[11px] font-semibold rounded-md border transition-colors cursor-pointer ${
                      accessoryId === acc.id
                        ? 'border-emerald-600 bg-emerald-50 text-indigo-950'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Submit Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              {isSaving
                ? 'Creating Profile...'
                : `Save ${name.trim() || 'New Child'} & Switch to Wall`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
