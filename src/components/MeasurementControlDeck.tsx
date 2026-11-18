import React, { useState } from 'react';
import {
  Cake,
  Camera,
  Check,
  Minus,
  Plus,
  RotateCcw,
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
  formatHeight,
  formatHeightDelta,
  formatHumanDate,
  formatWeight,
  formatWeightDelta,
  getLocalTodayIso,
  HAIR_COLOR_PRESETS,
  HairStyle,
  PaletteId,
  sanitizeBiologicalSex,
  SKIN_TONE_PRESETS,
  UnitSystem,
  VALIDATION_BOUNDS,
} from '../types';
import { evaluateChildWhoPercentiles } from '../services/whoGrowthService';

export type ControlDeckTab = 'measure' | 'character';

interface MeasurementControlDeckProps {
  activeTab: ControlDeckTab;
  onTabChange: (tab: ControlDeckTab) => void;
  childProfile: ChildProfile;
  avatarPhotoUrl: string | null;
  units: UnitSystem;
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
  onCreateNewChild: (newChild: {
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
  units,
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
  onRemoveAvatarPhoto,
  onSaveCharacterProfile,
  onCreateNewChild,
}) => {
  // Local state for Child Info, DOB, WHO sex & Avatar customization form synced when childProfile changes
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
  const [isAddingNewKid, setIsAddingNewKid] = useState(false);

  // Keep form synced when switching active child or when photo skinTone updates
  React.useEffect(() => {
    if (!isAddingNewKid) {
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
    }
  }, [childProfile, isAddingNewKid]);

  const draftYears = Math.floor(draftAgeMonths / 12);
  const draftRemMonths = draftAgeMonths % 12;

  const whoDraftEval = evaluateChildWhoPercentiles({
    heightCm: draftHeightCm,
    weightKg: draftWeightKg,
    ageMonths: draftAgeMonths,
    sex: childProfile.sex,
  });

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

  const handleCharacterFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = editName.trim().slice(0, VALIDATION_BOUNDS.NAME_MAX_LEN) || 'Sprout';
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

    if (isAddingNewKid) {
      await onCreateNewChild(payload);
      setIsAddingNewKid(false);
    } else {
      await onSaveCharacterProfile(payload);
    }
  };

  const startNewKidFlow = () => {
    setIsAddingNewKid(true);
    setEditName('');
    setEditBirthDate('');
    setEditSex('unspecified');
    setEditAgeTwoHeight(86.5);
    setEditAgeTwoWeight(12.5);
    setEditPalette('sunny');
    setEditAccessory('sprout');
    setEditHair('bob');
    setEditSkinTone(SKIN_TONE_PRESETS[1].hex);
    setEditHairColor(HAIR_COLOR_PRESETS[1].hex);
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
        <form onSubmit={onSubmitMeasurement} className="space-y-5">
          {/* Height Slider + Fine Controls */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <label
                htmlFor="height-slider"
                className="text-sm font-bold text-indigo-950"
              >
                Height Today
              </label>
              <span className="text-base font-bold font-mono tabular-nums text-sky-700">
                {formatHeight(draftHeightCm, units)}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label="Decrease height"
                onClick={() =>
                  onChangeDraftHeight(
                    Number(clampNumber(draftHeightCm - 0.5, 65, 175).toFixed(1)),
                  )
                }
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 transition-colors shrink-0 cursor-pointer"
              >
                <Minus className="w-4 h-4" aria-hidden="true" />
              </button>

              <input
                id="height-slider"
                type="range"
                min={65}
                max={175}
                step={0.5}
                value={draftHeightCm}
                onChange={(e) => onChangeDraftHeight(parseFloat(e.target.value))}
                className="w-full accent-sky-600 h-2.5 bg-sky-100 rounded-lg cursor-pointer"
              />

              <button
                type="button"
                aria-label="Increase height"
                onClick={() =>
                  onChangeDraftHeight(
                    Number(clampNumber(draftHeightCm + 0.5, 65, 175).toFixed(1)),
                  )
                }
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 transition-colors shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-600">
              <span>
                WHO <strong className="font-mono text-sky-800">{whoDraftEval.height.ordinalLabel}</strong>{' '}
                percentile
              </span>
              <span className="font-mono tabular-nums text-slate-500">
                Peer avg {formatHeight(whoDraftEval.height.medianValue, units)}
              </span>
            </div>
          </div>

          {/* Weight Slider + Fine Controls */}
          <div className="space-y-2 pt-2 border-t border-sky-100">
            <div className="flex items-baseline justify-between gap-2">
              <label
                htmlFor="weight-slider"
                className="text-sm font-bold text-indigo-950"
              >
                Weight Today
              </label>
              <span className="text-base font-bold font-mono tabular-nums text-rose-700">
                {formatWeight(draftWeightKg, units)}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label="Decrease weight"
                onClick={() =>
                  onChangeDraftWeight(
                    Number(clampNumber(draftWeightKg - 0.2, 7, 75).toFixed(1)),
                  )
                }
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100 transition-colors shrink-0 cursor-pointer"
              >
                <Minus className="w-4 h-4" aria-hidden="true" />
              </button>

              <input
                id="weight-slider"
                type="range"
                min={7}
                max={75}
                step={0.2}
                value={draftWeightKg}
                onChange={(e) => onChangeDraftWeight(parseFloat(e.target.value))}
                className="w-full accent-rose-500 h-2.5 bg-amber-100 rounded-lg cursor-pointer"
              />

              <button
                type="button"
                aria-label="Increase weight"
                onClick={() =>
                  onChangeDraftWeight(
                    Number(clampNumber(draftWeightKg + 0.2, 7, 75).toFixed(1)),
                  )
                }
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100 transition-colors shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-600">
              <span>
                WHO <strong className="font-mono text-rose-700">{whoDraftEval.weight.ordinalLabel}</strong>{' '}
                percentile
              </span>
              <span className="font-mono tabular-nums text-slate-500">
                Peer avg {formatWeight(whoDraftEval.weight.medianValue, units)}
              </span>
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

          {/* Unboxed Growth Comparison Summary */}
          <div className="pt-3 border-t border-slate-100 space-y-1">
            <p className="text-xs font-semibold text-slate-800">
              Growth vs. Age 2 ({formatHeight(childProfile.ageTwoHeightCm, units)},{' '}
              {formatWeight(childProfile.ageTwoWeightKg, units)})
            </p>
            <p className="text-xs font-mono tabular-nums text-slate-600">
              <span>{formatHeightDelta(heightGainCm, units)} height</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{formatWeightDelta(weightGainKg, units)} weight</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>+{percentTaller.toFixed(0)}% taller</span>
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
        <form onSubmit={handleCharacterFormSubmit} className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-indigo-950">
              {isAddingNewKid ? 'Add New Child Info' : `${childProfile.name}’s Info & Avatar`}
            </h3>
            {!isAddingNewKid ? (
              <button
                type="button"
                onClick={startNewKidFlow}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-indigo-950 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                Add Child
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingNewKid(false)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Realistic Child Photo Avatar Strip */}
          {!isAddingNewKid && (
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
          )}

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

          {/* WHO Growth Standard Reference Curve Selector */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <span className="block text-xs font-semibold text-slate-700">
              WHO Growth Chart Reference Curve
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
                  className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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

          {/* Age 2 Baseline Height & Weight */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div className="space-y-1">
              <label
                htmlFor="age2-height-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Age 2 Height (cm)
              </label>
              <input
                id="age2-height-input"
                type="number"
                step="0.5"
                min={VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MIN}
                max={VALIDATION_BOUNDS.AGE_TWO_HEIGHT_MAX}
                value={editAgeTwoHeight}
                onChange={(e) => setEditAgeTwoHeight(parseFloat(e.target.value) || 86.5)}
                className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
              <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                {formatHeight(editAgeTwoHeight, 'imperial')}
              </p>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="age2-weight-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Age 2 Weight (kg)
              </label>
              <input
                id="age2-weight-input"
                type="number"
                step="0.1"
                min={VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MIN}
                max={VALIDATION_BOUNDS.AGE_TWO_WEIGHT_MAX}
                value={editAgeTwoWeight}
                onChange={(e) => setEditAgeTwoWeight(parseFloat(e.target.value) || 12.5)}
                className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
              <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                {formatWeight(editAgeTwoWeight, 'imperial')}
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
            className="w-full h-11 px-4 py-2.5 text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isSaving
              ? 'Saving...'
              : isAddingNewKid
                ? 'Save Child Info & Start Wall'
                : 'Save Child Info & Avatar'}
          </button>
        </form>
      )}
    </div>
  );
};
