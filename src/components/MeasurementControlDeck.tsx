import React, { useState } from 'react';
import { Check, Minus, Plus, RotateCcw, UserPlus } from 'lucide-react';
import {
  AccessoryId,
  CHARACTER_PALETTES,
  ChildProfile,
  clampNumber,
  formatHeight,
  formatHeightDelta,
  formatWeight,
  formatWeightDelta,
  HairStyle,
  PaletteId,
  UnitSystem,
  VALIDATION_BOUNDS,
} from '../types';

export type ControlDeckTab = 'measure' | 'character';

interface MeasurementControlDeckProps {
  activeTab: ControlDeckTab;
  onTabChange: (tab: ControlDeckTab) => void;
  childProfile: ChildProfile;
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
  onSaveCharacterProfile: (updates: {
    name: string;
    ageTwoHeightCm: number;
    ageTwoWeightKg: number;
    paletteId: PaletteId;
    accessoryId: AccessoryId;
    hairStyle: HairStyle;
  }) => Promise<void>;
  onCreateNewChild: (newChild: {
    name: string;
    ageTwoHeightCm: number;
    ageTwoWeightKg: number;
    paletteId: PaletteId;
    accessoryId: AccessoryId;
    hairStyle: HairStyle;
  }) => Promise<void>;
}

const ACCESSORY_OPTIONS: { id: AccessoryId; label: string }[] = [
  { id: 'sprout', label: 'Sprout' },
  { id: 'cap', label: 'Sun Cap' },
  { id: 'crown', label: 'Crown' },
  { id: 'dino', label: 'Dino Spikes' },
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
  onSaveCharacterProfile,
  onCreateNewChild,
}) => {
  // Local state for Character & Age 2 customization form synced when childProfile changes
  const [editName, setEditName] = useState(childProfile.name);
  const [editAgeTwoHeight, setEditAgeTwoHeight] = useState(childProfile.ageTwoHeightCm);
  const [editAgeTwoWeight, setEditAgeTwoWeight] = useState(childProfile.ageTwoWeightKg);
  const [editPalette, setEditPalette] = useState<PaletteId>(childProfile.paletteId);
  const [editAccessory, setEditAccessory] = useState<AccessoryId>(childProfile.accessoryId);
  const [editHair, setEditHair] = useState<HairStyle>(childProfile.hairStyle);
  const [isAddingNewKid, setIsAddingNewKid] = useState(false);

  // Keep form synced when switching active child
  React.useEffect(() => {
    if (!isAddingNewKid) {
      setEditName(childProfile.name);
      setEditAgeTwoHeight(childProfile.ageTwoHeightCm);
      setEditAgeTwoWeight(childProfile.ageTwoWeightKg);
      setEditPalette(childProfile.paletteId);
      setEditAccessory(childProfile.accessoryId);
      setEditHair(childProfile.hairStyle);
    }
  }, [childProfile, isAddingNewKid]);

  const draftYears = Math.floor(draftAgeMonths / 12);
  const draftRemMonths = draftAgeMonths % 12;

  const heightGainCm = draftHeightCm - childProfile.ageTwoHeightCm;
  const weightGainKg = draftWeightKg - childProfile.ageTwoWeightKg;
  const percentTaller = Math.max(
    0,
    ((draftHeightCm - childProfile.ageTwoHeightCm) / childProfile.ageTwoHeightCm) * 100,
  );

  const handleCharacterFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = editName.trim().slice(0, VALIDATION_BOUNDS.NAME_MAX_LEN) || 'Sprout';
    const payload = {
      name: trimmedName,
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
    setEditAgeTwoHeight(86.5);
    setEditAgeTwoWeight(12.5);
    setEditPalette('sunny');
    setEditAccessory('sprout');
    setEditHair('bob');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-5">
      {/* Segmented Control Deck Tabs */}
      <div className="space-y-4">
        <div
          role="tablist"
          aria-label="Measurement and character controls"
          className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'measure'}
            onClick={() => onTabChange('measure')}
            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'measure'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mark Height & Weight
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'character'}
            onClick={() => onTabChange('character')}
            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'character'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Character & Age 2
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
                className="text-sm font-semibold text-slate-900"
              >
                Height Today
              </label>
              <span className="text-base font-bold font-mono tabular-nums text-emerald-700">
                {formatHeight(draftHeightCm, units)}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label="Decrease height"
                onClick={() =>
                  onChangeDraftHeight(
                    Number(clampNumber(draftHeightCm - 0.5, 70, 175).toFixed(1)),
                  )
                }
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <Minus className="w-4 h-4" aria-hidden="true" />
              </button>

              <input
                id="height-slider"
                type="range"
                min={70}
                max={175}
                step={0.5}
                value={draftHeightCm}
                onChange={(e) => onChangeDraftHeight(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
              />

              <button
                type="button"
                aria-label="Increase height"
                onClick={() =>
                  onChangeDraftHeight(
                    Number(clampNumber(draftHeightCm + 0.5, 70, 175).toFixed(1)),
                  )
                }
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Slide to watch {childProfile.name} stretch up the wooden ruler
            </p>
          </div>

          {/* Weight Slider + Fine Controls */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-baseline justify-between gap-2">
              <label
                htmlFor="weight-slider"
                className="text-sm font-semibold text-slate-900"
              >
                Weight Today
              </label>
              <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                {formatWeight(draftWeightKg, units)}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label="Decrease weight"
                onClick={() =>
                  onChangeDraftWeight(
                    Number(clampNumber(draftWeightKg - 0.2, 8, 75).toFixed(1)),
                  )
                }
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <Minus className="w-4 h-4" aria-hidden="true" />
              </button>

              <input
                id="weight-slider"
                type="range"
                min={8}
                max={75}
                step={0.2}
                value={draftWeightKg}
                onChange={(e) => onChangeDraftWeight(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
              />

              <button
                type="button"
                aria-label="Increase weight"
                onClick={() =>
                  onChangeDraftWeight(
                    Number(clampNumber(draftWeightKg + 0.2, 8, 75).toFixed(1)),
                  )
                }
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Age (Years & Months) + Date */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
            <div className="space-y-1.5">
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
                    clampNumber(yrs * 12 + draftRemMonths, 24, 216),
                  );
                }}
                className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {Array.from({ length: 15 }, (_, idx) => idx + 2).map((yr) => (
                  <option key={yr} value={yr}>
                    {yr} years
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
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
                  onChangeDraftAgeMonths(clampNumber(draftYears * 12 + mos, 24, 216));
                }}
                className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {Array.from({ length: 12 }, (_, m) => m).map((m) => (
                  <option key={m} value={m}>
                    {m} mos
                  </option>
                ))}
              </select>
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
                className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
                className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Unboxed Growth Comparison Summary */}
          <div className="pt-3 border-t border-slate-100 space-y-1">
            <p className="text-xs font-semibold text-slate-800">
              Growth Since Age 2 ({formatHeight(childProfile.ageTwoHeightCm, units)},{' '}
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
              className="flex-1 h-11 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {isSaving ? 'Marking Wall...' : 'Mark Height & Weight'}
            </button>

            {isPreviewDirty && (
              <button
                type="button"
                onClick={onResetDraft}
                className="h-11 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Reset
              </button>
            )}
          </div>
        </form>
      ) : (
        /* Character & Age 2 Baseline Customization Form */
        <form onSubmit={handleCharacterFormSubmit} className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              {isAddingNewKid ? 'Create New Kid Profile' : `Customize ${childProfile.name}`}
            </h3>
            {!isAddingNewKid ? (
              <button
                type="button"
                onClick={startNewKidFlow}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                Add Kid
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingNewKid(false)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="kid-name-input"
              className="block text-xs font-semibold text-slate-700"
            >
              Kid’s First Name or Nickname
            </label>
            <input
              id="kid-name-input"
              type="text"
              required
              maxLength={VALIDATION_BOUNDS.NAME_MAX_LEN}
              placeholder="e.g. Maya"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Age 2 Baseline Height & Weight */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div className="space-y-1.5">
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
                className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                {formatHeight(editAgeTwoHeight, 'imperial')}
              </p>
            </div>

            <div className="space-y-1.5">
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
                className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                {formatWeight(editAgeTwoWeight, 'imperial')}
              </p>
            </div>
          </div>

          {/* Color Palette Picker */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <span className="block text-xs font-semibold text-slate-700">
              Outfit & Character Palette
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
                    className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-emerald-600 bg-emerald-50/70 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hair Style Picker */}
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-slate-700">Hair Style</span>
            <div className="grid grid-cols-4 gap-1.5">
              {HAIR_OPTIONS.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setEditHair(h.id)}
                  className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    editHair === h.id
                      ? 'border-emerald-600 bg-emerald-50/70 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Top Accessory Picker */}
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-slate-700">
              Head Accessory
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {ACCESSORY_OPTIONS.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setEditAccessory(acc.id)}
                  className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    editAccessory === acc.id
                      ? 'border-emerald-600 bg-emerald-50/70 text-slate-900'
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
            className="w-full h-11 px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {isSaving
              ? 'Saving...'
              : isAddingNewKid
                ? 'Create Kid & Start at Age 2'
                : 'Save Character & Age 2 Baseline'}
          </button>
        </form>
      )}
    </div>
  );
};
