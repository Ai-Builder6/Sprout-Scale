import React, { useState } from 'react';
import {
  Cake,
  Camera,
  Check,
  Minus,
  Plus,
  RotateCcw,
  Ruler,
  Trash2,
  UserPlus,
} from 'lucide-react';
import {
  AccessoryId,
  BiologicalSex,
  calculateExactAgeFromDob,
  CHARACTER_PALETTES,
  ChildProfile,
  clampNumber,
  cmToInches,
  formatFeetInches,
  formatHeightDelta,
  formatHumanDate,
  formatMetricHeight,
  formatMetricWeight,
  formatPounds,
  formatTotalInches,
  formatWeightDelta,
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

export type ControlDeckTab = 'measure' | 'character';

interface MeasurementControlDeckProps {
  activeTab: ControlDeckTab;
  onTabChange: (tab: ControlDeckTab) => void;
  childProfile: ChildProfile;
  avatarPhotoUrl: string | null;
  draftHeightCm: number;
  draftWeightKg: number;
  draftAgeMonths: number;
  draftDate: string;
  draftNote: string;
  isPreviewDirty: boolean;
  isSaving: boolean;
  statusBanner: { type: 'success' | 'error'; message: string } | null;
  onChangeDraftHeight: (cm: number) => void;
  onChangeDraftWeight: (kg: number) => void;
  onChangeDraftAgeMonths: (months: number) => void;
  onChangeDraftDate: (date: string) => void;
  onChangeDraftNote: (note: string) => void;
  onResetDraft: () => void;
  onSubmitMeasurement: (e: React.FormEvent) => void;
  onOpenPhotoStudio: () => void;
  onOpenWallHeightEstimator: () => void;
  onRemoveAvatarPhoto: () => Promise<void>;
  onSaveCharacterProfile: (updates: {
    name: string;
    birthDate: string;
    sex: BiologicalSex;
    ageTwoHeightCm: number;
    ageTwoWeightKg: number;
    paletteId: PaletteId;
    accessoryId: AccessoryId;
    hairStyle: HairStyle;
    skinTone: string;
    hairColor: string;
  }) => Promise<void>;
  onOpenAddChildModal: () => void;
  totalChildrenCount: number;
  onDeleteChild: (childId: string) => Promise<void>;
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

export const MeasurementControlDeck: React.FC<MeasurementControlDeckProps> = ({
  activeTab,
  onTabChange,
  childProfile,
  avatarPhotoUrl,
  draftHeightCm,
  draftWeightKg,
  draftAgeMonths,
  draftDate,
  draftNote,
  isPreviewDirty,
  isSaving,
  statusBanner,
  onChangeDraftHeight,
  onChangeDraftWeight,
  onChangeDraftAgeMonths,
  onChangeDraftDate,
  onChangeDraftNote,
  onResetDraft,
  onSubmitMeasurement,
  onOpenPhotoStudio,
  onOpenWallHeightEstimator,
  onRemoveAvatarPhoto,
  onSaveCharacterProfile,
  onOpenAddChildModal,
  totalChildrenCount,
  onDeleteChild,
}) => {
  // Local state for Child Info, DOB & Avatar customization form synced when childProfile.id changes
  const [editName, setEditName] = useState(childProfile.name);
  const [editBirthDate, setEditBirthDate] = useState(childProfile.birthDate || '');
  const [editSex, setEditSex] = useState<BiologicalSex>(childProfile.sex || 'unspecified');
  const [editAgeTwoHeight, setEditAgeTwoHeight] = useState(childProfile.ageTwoHeightCm);
  const [editAgeTwoWeight, setEditAgeTwoWeight] = useState(childProfile.ageTwoWeightKg);
  const [editPalette, setEditPalette] = useState<PaletteId>(childProfile.paletteId);
  const [editAccessory, setEditAccessory] = useState<AccessoryId>(childProfile.accessoryId);
  const [editHair, setEditHair] = useState<HairStyle>(childProfile.hairStyle);
  const [editSkinTone, setEditSkinTone] = useState<string>(
    childProfile.skinTone || SKIN_TONE_PRESETS[1].hex,
  );
  const [editHairColor, setEditHairColor] = useState<string>(
    childProfile.hairColor || HAIR_COLOR_PRESETS[1].hex,
  );
  const [confirmDeleteChild, setConfirmDeleteChild] = useState<boolean>(false);
  const nameInputRef = React.useRef<HTMLInputElement | null>(null);

  // Sync form fields whenever the selected child ID changes (never reset mid-typing!)
  React.useEffect(() => {
    setConfirmDeleteChild(false);
    setEditName(childProfile.name);
    setEditBirthDate(childProfile.birthDate || '');
    setEditSex(childProfile.sex || 'unspecified');
    setEditAgeTwoHeight(childProfile.ageTwoHeightCm);
    setEditAgeTwoWeight(childProfile.ageTwoWeightKg);
    setEditPalette(childProfile.paletteId);
    setEditAccessory(childProfile.accessoryId);
    setEditHair(childProfile.hairStyle);
    setEditSkinTone(childProfile.skinTone || SKIN_TONE_PRESETS[1].hex);
    setEditHairColor(childProfile.hairColor || HAIR_COLOR_PRESETS[1].hex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfile.id]);

  const draftYears = Math.floor(draftAgeMonths / 12);
  const draftRemMonths = draftAgeMonths % 12;

  // Imperial values driving sliders, steppers, and feet/inches selectors
  const draftSplitHeight = splitCmToFeetAndInches(draftHeightCm);
  const draftTotalInchesNum = Number(cmToInches(draftHeightCm).toFixed(2));
  const draftWeightLbsNum = Number(kgToLbs(draftWeightKg).toFixed(1));

  // Imperial Age 2 baseline values for the Child Info form
  const editAgeTwoSplit = splitCmToFeetAndInches(editAgeTwoHeight);
  const editAgeTwoWeightLbs = Number(kgToLbs(editAgeTwoWeight).toFixed(1));

  // Exact age calculated from child's Date of Birth relative to the selected measurement date
  const dobCalculatedOnDraftDate = childProfile.birthDate
    ? calculateExactAgeFromDob(childProfile.birthDate, draftDate)
    : null;

  // Live age preview in the Child Info form as the parent types/picks a Date of Birth
  const liveFormDobCalc = editBirthDate
    ? calculateExactAgeFromDob(editBirthDate)
    : null;

  const heightGainCm = draftHeightCm - childProfile.ageTwoHeightCm;
  const weightGainKg = draftWeightKg - childProfile.ageTwoWeightKg;
  const percentTaller = Math.max(
    0,
    ((draftHeightCm - childProfile.ageTwoHeightCm) / childProfile.ageTwoHeightCm) * 100,
  );

  const applyDraftInches = (nextTotalInches: number) => {
    const clampedInches = clampNumber(nextTotalInches, 26, 68);
    const nextCm = Number(clampNumber(inchesToCm(clampedInches), 65, 175).toFixed(1));
    onChangeDraftHeight(nextCm);
  };

  const applyDraftPounds = (nextLbs: number) => {
    const clampedLbs = clampNumber(nextLbs, 16, 165);
    const nextKg = Number(clampNumber(lbsToKg(clampedLbs), 7, 75).toFixed(1));
    onChangeDraftWeight(nextKg);
  };

  const updateAgeTwoFeetInches = (feet: number, remInches: number) => {
    const safeInches = clampNumber(feet * 12 + remInches, 27.6, 45.2);
    const nextCm = Number(
      clampNumber(
        inchesToCm(safeInches),
        VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MIN,
        VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MAX,
      ).toFixed(1),
    );
    setEditAgeTwoHeight(nextCm);
  };

  const updateAgeTwoPounds = (lbs: number) => {
    const nextKg = Number(
      clampNumber(
        lbsToKg(lbs),
        VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MIN,
        VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MAX,
      ).toFixed(1),
    );
    setEditAgeTwoWeight(nextKg);
  };

  const handleCharacterFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName =
      editName.trim().slice(0, VALIDATION_BOUNDS.NAME_MAX_LEN) ||
      childProfile.name ||
      'Sprout';
    const cleanDob = VALIDATION_BOUNDS.DATE_PATTERN.test(editBirthDate) ? editBirthDate : '';
    const payload = {
      name: trimmedName,
      birthDate: cleanDob,
      sex: sanitizeBiologicalSex(editSex),
      ageTwoHeightCm: Number(
        clampNumber(
          editAgeTwoHeight,
          VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MIN,
          VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MAX,
        ).toFixed(1),
      ),
      ageTwoWeightKg: Number(
        clampNumber(
          editAgeTwoWeight,
          VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MIN,
          VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MAX,
        ).toFixed(1),
      ),
      paletteId: editPalette,
      accessoryId: editAccessory,
      hairStyle: editHair,
      skinTone: VALIDATION_BOUNDS.HEX_COLOR_PATTERN.test(editSkinTone)
        ? editSkinTone
        : SKIN_TONE_PRESETS[1].hex,
      hairColor: VALIDATION_BOUNDS.HEX_COLOR_PATTERN.test(editHairColor)
        ? editHairColor
        : HAIR_COLOR_PRESETS[1].hex,
    };

    await onSaveCharacterProfile(payload);
  };

  return (
    <div className="bg-white border-2 border-amber-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-5 shadow-xs">
      {/* Segmented Control Deck Tabs */}
      <div className="space-y-4">
        <div
          role="tablist"
          aria-label="Measurement and child info controls"
          className="grid grid-cols-2 gap-1 p-1 bg-sky-100 rounded-lg"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'measure'}
            onClick={() => onTabChange('measure')}
            className={`px-3 py-2 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'measure'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-sky-900 hover:text-indigo-950'
            }`}
          >
            Mark Height &amp; Weight
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'character'}
            onClick={() => onTabChange('character')}
            className={`px-3 py-2 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'character'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-sky-900 hover:text-indigo-950'
            }`}
          >
            Child Info &amp; Avatar
          </button>
        </div>

        {statusBanner && (
          <div
            role="status"
            className={`px-3.5 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2 border ${
              statusBanner.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-red-50 text-red-900 border-red-200'
            }`}
          >
            {statusBanner.type === 'success' && (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            )}
            <span>{statusBanner.message}</span>
          </div>
        )}
      </div>

      {activeTab === 'measure' ? (
        <form noValidate onSubmit={onSubmitMeasurement} className="space-y-5">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-sky-100">
            <span className="text-xs font-bold text-indigo-950">
              Measuring: {childProfile.name}
            </span>
            <button
              type="button"
              onClick={onOpenAddChildModal}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:underline cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
              + Add Another Child
            </button>
          </div>
          {/* Height Slider + Feet & Inches Controls (Imperial Primary, cm Secondary) */}
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <label
                htmlFor="height-slider"
                className="text-sm font-bold text-indigo-950"
              >
                Height Today (ft &amp; in)
              </label>
              <div className="text-right">
                <span className="text-base font-bold font-mono tabular-nums text-sky-700">
                  {formatFeetInches(draftHeightCm)}{' '}
                  <span className="text-xs font-bold text-indigo-950">
                    ({formatTotalInches(draftHeightCm)})
                  </span>
                </span>
                <span className="block text-[11px] font-mono tabular-nums text-slate-400">
                  {formatMetricHeight(draftHeightCm)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label="Decrease height by half an inch"
                onClick={() => applyDraftInches(draftTotalInchesNum - 0.5)}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 transition-colors shrink-0 cursor-pointer"
              >
                <Minus className="w-4 h-4" aria-hidden="true" />
              </button>

              <input
                id="height-slider"
                type="range"
                min={26}
                max={68}
                step={0.25}
                value={clampNumber(draftTotalInchesNum, 26, 68)}
                onChange={(e) => applyDraftInches(parseFloat(e.target.value))}
                className="w-full accent-sky-600 h-2.5 bg-sky-100 rounded-lg cursor-pointer"
              />

              <button
                type="button"
                aria-label="Increase height by half an inch"
                onClick={() => applyDraftInches(draftTotalInchesNum + 0.5)}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 transition-colors shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Direct Feet + Extra Inches Quick Inputs */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="draft-feet-select"
                  className="text-xs font-semibold text-slate-600 whitespace-nowrap"
                >
                  Feet
                </label>
                <select
                  id="draft-feet-select"
                  value={draftSplitHeight.feet}
                  onChange={(e) => {
                    const nextFt = parseInt(e.target.value, 10);
                    applyDraftInches(nextFt * 12 + draftSplitHeight.inches);
                  }}
                  className="w-full h-9 px-2.5 text-xs font-mono font-semibold tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  {[2, 3, 4, 5].map((ft) => (
                    <option key={ft} value={ft}>
                      {ft} ft
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="draft-inches-input"
                  className="text-xs font-semibold text-slate-600 whitespace-nowrap"
                >
                  Inches
                </label>
                <input
                  id="draft-inches-input"
                  type="number"
                  min={0}
                  max={11.9}
                  step={0.1}
                  value={draftSplitHeight.inches}
                  onChange={(e) => {
                    const nextIn = clampNumber(parseFloat(e.target.value) || 0, 0, 11.9);
                    applyDraftInches(draftSplitHeight.feet * 12 + nextIn);
                  }}
                  className="w-full h-9 px-2.5 text-xs font-mono font-semibold tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
            </div>

            {/* Guesstimate Height in Inches from a Wall Photo CTA */}
            <button
              type="button"
              onClick={onOpenWallHeightEstimator}
              className="w-full py-2 px-3 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Ruler className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
              Guesstimate Inches from a Wall Photo
            </button>
          </div>

          {/* Weight Slider + Pounds Controls (Pounds Primary, kg Secondary) */}
          <div className="space-y-2.5 pt-2 border-t border-sky-100">
            <div className="flex items-baseline justify-between gap-2">
              <label
                htmlFor="weight-slider"
                className="text-sm font-bold text-indigo-950"
              >
                Weight Today (lb)
              </label>
              <div className="text-right">
                <span className="text-base font-bold font-mono tabular-nums text-rose-700">
                  {formatPounds(draftWeightKg)}
                </span>
                <span className="block text-[11px] font-mono tabular-nums text-slate-400">
                  {formatMetricWeight(draftWeightKg)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label="Decrease weight by half a pound"
                onClick={() => applyDraftPounds(draftWeightLbsNum - 0.5)}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100 transition-colors shrink-0 cursor-pointer"
              >
                <Minus className="w-4 h-4" aria-hidden="true" />
              </button>

              <input
                id="weight-slider"
                type="range"
                min={16}
                max={165}
                step={0.5}
                value={clampNumber(draftWeightLbsNum, 16, 165)}
                onChange={(e) => applyDraftPounds(parseFloat(e.target.value))}
                className="w-full accent-rose-500 h-2.5 bg-amber-100 rounded-lg cursor-pointer"
              />

              <button
                type="button"
                aria-label="Increase weight by half a pound"
                onClick={() => applyDraftPounds(draftWeightLbsNum + 0.5)}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100 transition-colors shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Automatic Age from Date of Birth + Manual Preview Override */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            {dobCalculatedOnDraftDate ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="text-slate-700">
                  <span className="font-bold text-indigo-950">Auto-Calculated Age:</span>{' '}
                  <span className="font-mono font-bold text-sky-800">
                    {dobCalculatedOnDraftDate.formattedExactAge}
                  </span>
                </div>
                {draftAgeMonths !== dobCalculatedOnDraftDate.totalMonths ? (
                  <button
                    type="button"
                    onClick={() =>
                      onChangeDraftAgeMonths(dobCalculatedOnDraftDate.totalMonths)
                    }
                    className="font-bold text-sky-700 hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Sync to DOB
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onTabChange('character')}
                    className="text-slate-500 hover:text-indigo-950 whitespace-nowrap cursor-pointer"
                  >
                    DOB {formatHumanDate(childProfile.birthDate)}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                <span>Enter Date of Birth to calculate age automatically</span>
                <button
                  type="button"
                  onClick={() => onTabChange('character')}
                  className="font-bold text-sky-700 hover:underline whitespace-nowrap cursor-pointer"
                >
                  Set Birthday
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="age-years-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Age (Years)
                </label>
                <select
                  id="age-years-select"
                  value={draftYears}
                  onChange={(e) => {
                    const yrs = parseInt(e.target.value, 10);
                    onChangeDraftAgeMonths(
                      clampNumber(yrs * 12 + draftRemMonths, 0, 216),
                    );
                  }}
                  className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  {Array.from({ length: 18 }, (_, idx) => idx).map((yr) => (
                    <option key={yr} value={yr}>
                      {yr} {yr === 1 ? 'year' : 'years'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="age-months-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Extra Months
                </label>
                <select
                  id="age-months-select"
                  value={draftRemMonths}
                  onChange={(e) => {
                    const mos = parseInt(e.target.value, 10);
                    onChangeDraftAgeMonths(clampNumber(draftYears * 12 + mos, 0, 216));
                  }}
                  className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  {Array.from({ length: 12 }, (_, m) => m).map((m) => (
                    <option key={m} value={m}>
                      {m} mos
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="recorded-date-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Measured On
              </label>
              <input
                id="recorded-date-input"
                type="date"
                required
                value={draftDate}
                onChange={(e) => onChangeDraftDate(e.target.value)}
                className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="milestone-note-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Memory Note
              </label>
              <input
                id="milestone-note-input"
                type="text"
                maxLength={VALIDATION_BOUNDS.NOTE_MAX_LEN}
                placeholder="e.g. New school shoes!"
                value={draftNote}
                onChange={(e) => onChangeDraftNote(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>
          </div>

          {/* Unboxed Growth Comparison Summary (Feet/Inches & Pounds Primary, Metric Secondary) */}
          <div className="pt-3 border-t border-slate-100 space-y-1">
            <p className="text-xs font-semibold text-slate-800">
              Growth vs. Age 2 ({formatFeetInches(childProfile.ageTwoHeightCm)} /{' '}
              {formatTotalInches(childProfile.ageTwoHeightCm)},{' '}
              {formatPounds(childProfile.ageTwoWeightKg)})
            </p>
            <p className="text-xs font-mono font-bold tabular-nums text-indigo-950">
              <span>{formatHeightDelta(heightGainCm, 'imperial')} height</span>
              <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
              <span>{formatWeightDelta(weightGainKg, 'imperial')} weight</span>
              <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
              <span>+{percentTaller.toFixed(0)}% taller</span>
            </p>
            <p className="text-[11px] font-mono tabular-nums text-slate-400">
              <span>Secondary: {formatHeightDelta(heightGainCm, 'metric')}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{formatWeightDelta(weightGainKg, 'metric')}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>
                Age 2 ({formatMetricHeight(childProfile.ageTwoHeightCm)},{' '}
                {formatMetricWeight(childProfile.ageTwoWeightKg)})
              </span>
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 h-11 px-4 py-2.5 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isSaving ? 'Marking Wall...' : 'Mark Height & Weight'}
            </button>

            {isPreviewDirty && (
              <button
                type="button"
                onClick={onResetDraft}
                className="h-11 px-3.5 py-2.5 text-xs font-bold text-sky-900 bg-sky-100 hover:bg-sky-200 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Reset
              </button>
            )}
          </div>
        </form>
      ) : (
        /* Child Info, Date of Birth & Realistic Photo Avatar Form */
        <form noValidate onSubmit={handleCharacterFormSubmit} className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-indigo-950">
              {childProfile.name}’s Info &amp; Avatar
            </h3>
            <button
              type="button"
              onClick={onOpenAddChildModal}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
              Add Another Child
            </button>
          </div>

          {/* Realistic Child Photo Avatar Strip */}
          <div className="flex items-center justify-between gap-3 p-3 bg-sky-50/90 border border-sky-200 rounded-xl">
            <div className="flex items-center gap-3 min-w-0">
              {avatarPhotoUrl ? (
                <img
                  src={avatarPhotoUrl}
                  alt={`${childProfile.name} avatar portrait`}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5 text-amber-800" aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-indigo-950 truncate">
                  {avatarPhotoUrl ? 'Real Photo Avatar Active' : 'Realistic Photo Avatar'}
                </p>
                <p className="text-[11px] text-slate-600">
                  Take a camera pic or upload a photo
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onOpenPhotoStudio}
                className="px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                {avatarPhotoUrl ? 'Edit Pic' : 'Take / Upload'}
              </button>
              {avatarPhotoUrl && (
                <button
                  type="button"
                  aria-label="Remove photo from avatar"
                  onClick={() => void onRemoveAvatarPhoto()}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Name + Date of Birth */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="kid-name-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Child’s Name
              </label>
              <input
                ref={nameInputRef}
                id="kid-name-input"
                type="text"
                required
                maxLength={VALIDATION_BOUNDS.NAME_MAX_LEN}
                placeholder="e.g. Maya"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="kid-dob-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Date of Birth
              </label>
              <input
                id="kid-dob-input"
                type="date"
                max={getLocalTodayIso()}
                value={editBirthDate}
                onChange={(e) => setEditBirthDate(e.target.value)}
                className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>
          </div>

          {/* WHO Growth Chart Reference Curve (Boy / Girl / Combined) */}
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-slate-700">
              WHO Growth Chart Curve
            </span>
            <div className="grid grid-cols-3 gap-1.5">
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
                  onClick={() => setEditSex(opt.id)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                    editSex === opt.id
                      ? 'border-sky-600 bg-sky-50 text-indigo-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Calculated Age Readout from Date of Birth */}
          {liveFormDobCalc && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700 pt-0.5">
              <Cake className="w-3.5 h-3.5 text-rose-500 shrink-0" aria-hidden="true" />
              <span className="font-bold text-indigo-950">
                Age: {liveFormDobCalc.formattedExactAge}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-600">
                {liveFormDobCalc.isBirthdayToday
                  ? 'Happy Birthday today!'
                  : `Next birthday in ${liveFormDobCalc.daysUntilNextBirthday} days`}
              </span>
            </div>
          )}

          {/* Age 2 Baseline Height (ft & in) & Weight (lb) — Metric Secondary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div className="space-y-1">
              <label
                htmlFor="age2-feet-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Age 2 Height (ft &amp; in)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  id="age2-feet-select"
                  value={editAgeTwoSplit.feet}
                  onChange={(e) => {
                    const ft = parseInt(e.target.value, 10);
                    updateAgeTwoFeetInches(ft, editAgeTwoSplit.inches);
                  }}
                  className="w-full h-10 px-2 text-xs font-mono font-semibold tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  <option value={2}>2 ft</option>
                  <option value={3}>3 ft</option>
                </select>
                <input
                  id="age2-inches-input"
                  type="number"
                  aria-label="Age 2 extra inches"
                  step="0.1"
                  min={0}
                  max={11.9}
                  value={editAgeTwoSplit.inches}
                  onChange={(e) => {
                    const nextIn = clampNumber(parseFloat(e.target.value) || 0, 0, 11.9);
                    updateAgeTwoFeetInches(editAgeTwoSplit.feet, nextIn);
                  }}
                  className="w-full h-10 px-2.5 text-xs font-mono font-semibold tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                {formatTotalInches(editAgeTwoHeight)} · {formatMetricHeight(editAgeTwoHeight)}
              </p>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="age2-weight-lbs-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Age 2 Weight (lb)
              </label>
              <input
                id="age2-weight-lbs-input"
                type="number"
                step="0.1"
                min={18}
                max={55}
                value={editAgeTwoWeightLbs}
                onChange={(e) => updateAgeTwoPounds(parseFloat(e.target.value) || 27.6)}
                className="w-full h-10 px-3 text-sm font-mono font-semibold tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
              <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                Secondary: {formatMetricWeight(editAgeTwoWeight)}
              </p>
            </div>
          </div>

          {/* Natural Skin Complexion Swatches */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <span className="block text-xs font-semibold text-slate-700">
              Natural Complexion
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {SKIN_TONE_PRESETS.map((tone) => {
                const selected = editSkinTone.toLowerCase() === tone.hex.toLowerCase();
                return (
                  <button
                    key={tone.id}
                    type="button"
                    title={tone.label}
                    aria-label={`Skin tone ${tone.label}`}
                    onClick={() => setEditSkinTone(tone.hex)}
                    className={`p-1 rounded-full border-2 transition-transform cursor-pointer ${
                      selected
                        ? 'border-sky-600 scale-110'
                        : 'border-transparent hover:border-slate-300'
                    }`}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill={tone.hex}
                        stroke="#334155"
                        strokeWidth="1.2"
                      />
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Natural Hair Color & Style */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Hair Color &amp; Style
              </span>
              <div className="flex items-center gap-1.5">
                {HAIR_COLOR_PRESETS.map((hc) => {
                  const selected = editHairColor.toLowerCase() === hc.hex.toLowerCase();
                  return (
                    <button
                      key={hc.id}
                      type="button"
                      title={hc.label}
                      aria-label={`Hair color ${hc.label}`}
                      onClick={() => setEditHairColor(hc.hex)}
                      className={`p-0.5 rounded-full border-2 cursor-pointer ${
                        selected ? 'border-sky-600' : 'border-transparent'
                      }`}
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                        <circle
                          cx="9"
                          cy="9"
                          r="7.5"
                          fill={hc.hex}
                          stroke="#334155"
                          strokeWidth="1"
                        />
                      </svg>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {HAIR_OPTIONS.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setEditHair(h.id)}
                  className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    editHair === h.id
                      ? 'border-sky-600 bg-sky-50 text-indigo-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Outfit Color Palette Picker */}
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-slate-700">
              Outfit Colors
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CHARACTER_PALETTES) as PaletteId[]).map((pid) => {
                const p = CHARACTER_PALETTES[pid];
                const active = editPalette === pid;
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => setEditPalette(pid)}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'border-sky-600 bg-sky-50 text-indigo-950'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Top Accessory Picker */}
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-slate-700">
              Head Accessory
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {ACCESSORY_OPTIONS.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setEditAccessory(acc.id)}
                  className={`px-2 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    editAccessory === acc.id
                      ? 'border-sky-600 bg-sky-50 text-indigo-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full h-11 px-4 py-2.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 bg-sky-600 hover:bg-sky-700 text-white"
          >
            {isSaving
              ? 'Saving...'
              : `Save ${editName.trim() || childProfile.name}’s Info & Avatar`}
          </button>

          {totalChildrenCount > 1 && (
            <div className="pt-2 border-t border-slate-100">
              {confirmDeleteChild ? (
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                  <span className="text-xs font-semibold text-rose-900">
                    Remove {childProfile.name} &amp; their measurements?
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void onDeleteChild(childProfile.id)}
                      className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer"
                    >
                      Confirm Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteChild(false)}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteChild(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-700 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Remove {childProfile.name}’s profile
                </button>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
};
