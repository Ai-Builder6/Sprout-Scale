import React, { useEffect, useState } from 'react';
import { Camera, Play, Pause, Ruler, Sparkles, Square, Volume2 } from 'lucide-react';
import {
  calculateExactAgeFromDob,
  ChildProfile,
  clampNumber,
  cmToInches,
  formatAgeLabel,
  formatFeetInches,
  formatHeightDelta,
  formatHumanDate,
  formatMetricHeight,
  formatMetricWeight,
  formatPounds,
  formatTotalInches,
  formatWeightDelta,
  getFunComparison,
  getGrowthStageInfo,
  GrowthMeasurement,
  inchesToCm,
  kgToLbs,
} from '../types';
import { CharacterFigureGroup } from './GrowingCharacterSvg';
import {
  speakWithElevenLabsAvatar,
  stopAvatarSpeech,
} from '../services/elevenLabsVoiceService';

interface GrowthWallStageProps {
  childProfile: ChildProfile;
  avatarPhotoUrl: string | null;
  measurements: GrowthMeasurement[];
  activeHeightCm: number;
  activeWeightKg: number;
  activeAgeMonths: number;
  isPreviewDirty: boolean;
  onSelectMilestoneOnWall: (measurement: GrowthMeasurement) => void;
  isPlayingTimelapse: boolean;
  onToggleTimelapse: () => void;
  onOpenPhotoStudio: () => void;
  onOpenWallHeightEstimator: () => void;
  onEditAgeTwoBaseline?: () => void;
}

const MIN_RULER_INCHES = 26; // 2' 2" (~66 cm)
const MAX_RULER_INCHES = 68; // 5' 8" (~172.7 cm)
const RULER_TOP_Y = 54;
const FLOOR_Y = 482;

const RAINBOW_PIN_COLORS = [
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#10b981',
  '#0ea5e9',
  '#8b5cf6',
];

function heightCmToSvgY(cm: number): number {
  const inches = clampNumber(cmToInches(cm), MIN_RULER_INCHES, MAX_RULER_INCHES);
  const ratio = (inches - MIN_RULER_INCHES) / (MAX_RULER_INCHES - MIN_RULER_INCHES);
  return FLOOR_Y - ratio * (FLOOR_Y - RULER_TOP_Y);
}

function inchesToSvgY(inchesVal: number): number {
  const clamped = clampNumber(inchesVal, MIN_RULER_INCHES, MAX_RULER_INCHES);
  const ratio = (clamped - MIN_RULER_INCHES) / (MAX_RULER_INCHES - MIN_RULER_INCHES);
  return FLOOR_Y - ratio * (FLOOR_Y - RULER_TOP_Y);
}

export const GrowthWallStage: React.FC<GrowthWallStageProps> = ({
  childProfile,
  avatarPhotoUrl,
  measurements,
  activeHeightCm,
  activeWeightKg,
  activeAgeMonths,
  isPreviewDirty,
  onSelectMilestoneOnWall,
  isPlayingTimelapse,
  onToggleTimelapse,
  onOpenPhotoStudio,
  onOpenWallHeightEstimator,
  onEditAgeTwoBaseline,
}) => {
  const [showSecondaryMetric, setShowSecondaryMetric] = useState<boolean>(true);
  const [isSpeakingAvatar, setIsSpeakingAvatar] = useState<boolean>(false);
  const [isLoadingSpeech, setIsLoadingSpeech] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      stopAvatarSpeech();
    };
  }, []);

  const ageTwoCrownY = heightCmToSvgY(childProfile.ageTwoHeightCm);
  const currentCrownY = heightCmToSvgY(activeHeightCm);

  const heightGainCm = activeHeightCm - childProfile.ageTwoHeightCm;
  const weightGainKg = activeWeightKg - childProfile.ageTwoWeightKg;

  const stageInfo = getGrowthStageInfo(activeAgeMonths);
  const exactDobAge = childProfile.birthDate
    ? calculateExactAgeFromDob(childProfile.birthDate)
    : null;

  const funFacts = getFunComparison(
    activeHeightCm,
    activeWeightKg,
    childProfile.ageTwoHeightCm,
  );

  // Scale dial rotation (-135 deg at 0 lb up to +135 deg at 135 lb)
  const activeWeightLbs = kgToLbs(activeWeightKg);
  const ageTwoWeightLbs = kgToLbs(childProfile.ageTwoWeightKg);
  const scaleAngle = -135 + clampNumber(activeWeightLbs / 135, 0, 1) * 270;
  const ageTwoScaleAngle = -135 + clampNumber(ageTwoWeightLbs / 135, 0, 1) * 270;

  // Generate ruler ticks natively in INCHES every 2 inches from 26" to 68"
  const rulerInchTicks: number[] = [];
  for (let inch = 26; inch <= 68; inch += 2) {
    rulerInchTicks.push(inch);
  }

  // Sort measurements ascending by ageMonths for clean wall display
  const sortedMarks = [...measurements].sort((a, b) => a.ageMonths - b.ageMonths);

  const handleToggleAvatarSpeech = async () => {
    if (isSpeakingAvatar || isLoadingSpeech) {
      stopAvatarSpeech();
      setIsSpeakingAvatar(false);
      setIsLoadingSpeech(false);
      return;
    }

    const totalIn = cmToInches(activeHeightCm);
    const ft = Math.floor(totalIn / 12);
    const remIn = Math.round((totalIn % 12) * 10) / 10;
    const gainIn = Math.round(cmToInches(Math.max(0, heightGainCm)) * 10) / 10;
    const lbs = Math.round(kgToLbs(activeWeightKg) * 10) / 10;

    const spokenScript =
      gainIn > 0.2
        ? `Hi! I'm ${childProfile.name}! At ${formatAgeLabel(activeAgeMonths)}, I'm ${ft} feet ${remIn} inches tall and weigh ${lbs} pounds. I've grown ${gainIn} inches taller since I turned two!`
        : `Hi! I'm ${childProfile.name}! I'm ${ft} feet ${remIn} inches tall and weigh ${lbs} pounds. Watch me grow on SproutScale!`;

    setIsLoadingSpeech(true);
    try {
      await speakWithElevenLabsAvatar(spokenScript, {
        onStart: () => {
          setIsLoadingSpeech(false);
          setIsSpeakingAvatar(true);
        },
        onEnd: () => {
          setIsLoadingSpeech(false);
          setIsSpeakingAvatar(false);
        },
      });
    } catch {
      setIsLoadingSpeech(false);
      setIsSpeakingAvatar(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border-2 border-sky-200 dark:border-slate-700 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-5 shadow-xs">
      {/* Stage Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sky-100 dark:border-slate-800 pb-4">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-bold text-indigo-950 dark:text-white">
              {childProfile.name}’s Growth Wall
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-sky-700 dark:text-sky-300">{stageInfo.stageName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums font-bold text-indigo-950 dark:text-white">
              {formatFeetInches(activeHeightCm)} ({formatTotalInches(activeHeightCm)}) ·{' '}
              {formatPounds(activeWeightKg)}
            </span>
            {showSecondaryMetric && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {formatMetricHeight(activeHeightCm)} · {formatMetricWeight(activeWeightKg)}
                </span>
              </>
            )}
            {exactDobAge && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Born {formatHumanDate(childProfile.birthDate)} ({exactDobAge.formattedExactAge})
                </span>
              </>
            )}
            {isPreviewDirty && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-orange-600 dark:text-amber-400 font-bold">Live Preview</span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">{stageInfo.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenWallHeightEstimator}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-950 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/70 hover:bg-emerald-200 dark:hover:bg-emerald-900/70 border border-transparent dark:border-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Ruler className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            Wall Photo Guesstimate
          </button>

          <button
            type="button"
            onClick={onOpenPhotoStudio}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-sky-950 dark:text-sky-200 bg-sky-100 dark:bg-sky-950/70 hover:bg-sky-200 dark:hover:bg-sky-900/70 border border-transparent dark:border-sky-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
            {avatarPhotoUrl ? 'Change Photo' : 'Photo Avatar'}
          </button>

          <button
            type="button"
            onClick={() => void handleToggleAvatarSpeech()}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isSpeakingAvatar
                ? 'bg-rose-500 hover:bg-rose-600 text-white'
                : 'bg-indigo-100 dark:bg-indigo-950/70 hover:bg-indigo-200 dark:hover:bg-indigo-900/70 text-indigo-950 dark:text-indigo-200 border border-transparent dark:border-indigo-800'
            }`}
          >
            {isSpeakingAvatar ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                Stop Voice
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" aria-hidden="true" />
                {isLoadingSpeech ? 'Speaking...' : 'Hear Avatar'}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleTimelapse}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isPlayingTimelapse ? (
              <>
                <Pause className="w-3.5 h-3.5 text-slate-950" aria-hidden="true" />
                Pause Growth Story
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-slate-950" aria-hidden="true" />
                Play Growth from Age 2
              </>
            )}
          </button>

          {/* Toggle Secondary Metric Subtitles (Feet/Inches & Pounds always remain primary) */}
          <button
            type="button"
            onClick={() => setShowSecondaryMetric((prev) => !prev)}
            className={`px-2.5 py-2 text-xs font-bold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showSecondaryMetric
                ? 'bg-sky-50 dark:bg-slate-800 border-sky-200 dark:border-slate-700 text-sky-900 dark:text-sky-300'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            {showSecondaryMetric ? 'cm · kg sub: On' : 'cm · kg sub: Off'}
          </button>
        </div>
      </div>

      {/* Main Interactive Bright Storybook Playroom Wall & Scale Canvas */}
      <div className="w-full overflow-hidden rounded-xl border-2 border-sky-200 dark:border-slate-700">
        <svg
          viewBox="0 0 680 604"
          className="w-full h-auto select-none"
          role="img"
          aria-label={`Interactive height and weight growth chart comparing ${childProfile.name} at Age 2 (${formatFeetInches(childProfile.ageTwoHeightCm)}, ${formatPounds(childProfile.ageTwoWeightKg)}) with ${formatAgeLabel(activeAgeMonths)} (${formatFeetInches(activeHeightCm)}, ${formatPounds(activeWeightKg)}).`}
        >
          <defs>
            <linearGradient id="sunnySkyWall" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#bae6fd" />
              <stop offset="55%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#fef9c3" />
            </linearGradient>
            <linearGradient id="honeyWoodRuler" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
            <linearGradient id="sunnyFloor" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="100%" stopColor="#fdba74" />
            </linearGradient>
          </defs>

          {/* Bright Sunlit Sky Playroom Wall Background */}
          <rect x={0} y={0} width={680} height={FLOOR_Y} fill="url(#sunnySkyWall)" />

          {/* Cheerful Corner Sun & Fluffy Playroom Clouds */}
          <circle cx={46} cy={42} r={28} fill="#fde047" opacity={0.85} />
          <circle cx={46} cy={42} r={20} fill="#facc15" />

          {/* Cloud 1 */}
          <g fill="#ffffff" opacity={0.88}>
            <circle cx={145} cy={74} r={16} />
            <circle cx={166} cy={68} r={21} />
            <circle cx={189} cy={75} r={15} />
            <rect x={144} y={74} width={46} height={16} rx={8} />
          </g>

          {/* Cloud 2 */}
          <g fill="#ffffff" opacity={0.82}>
            <circle cx={385} cy={96} r={14} />
            <circle cx={404} cy={90} r={18} />
            <circle cx={424} cy={96} r={13} />
            <rect x={384} y={96} width={41} height={14} rx={7} />
          </g>

          {/* Colorful Playroom Bunting Pennant Garland Along Top Left */}
          <path
            d="M 88 18 Q 290 48 518 16"
            fill="none"
            stroke="#0284c7"
            strokeWidth={1.6}
          />
          {[
            { x: 125, y: 24, color: '#f43f5e' },
            { x: 185, y: 31, color: '#f97316' },
            { x: 245, y: 35, color: '#facc15' },
            { x: 305, y: 35, color: '#10b981' },
            { x: 365, y: 32, color: '#0ea5e9' },
            { x: 425, y: 27, color: '#8b5cf6' },
            { x: 480, y: 21, color: '#ec4899' },
          ].map((flag, i) => (
            <polygon
              key={`bunting_${i}`}
              points={`${flag.x - 13},${flag.y} ${flag.x + 13},${flag.y} ${flag.x},${flag.y + 22}`}
              fill={flag.color}
            />
          ))}

          {/* Playroom Wall Grid Horizontal Reference Lines (Every 6 Inches / Half-Foot) */}
          {rulerInchTicks
            .filter((inch) => inch % 6 === 0)
            .map((inch) => {
              const y = inchesToSvgY(inch);
              return (
                <line
                  key={`grid_in_${inch}`}
                  x1={24}
                  y1={y}
                  x2={530}
                  y2={y}
                  stroke="#7dd3fc"
                  strokeWidth={inch % 12 === 0 ? 1.4 : 1.0}
                  strokeDasharray="4 5"
                  opacity={0.78}
                />
              );
            })}

          {/* Crisp White Baseboard & Warm Apricot Playroom Floor */}
          <rect x={0} y={FLOOR_Y - 12} width={680} height={12} fill="#ffffff" />
          <line x1={0} y1={FLOOR_Y - 12} x2={680} y2={FLOOR_Y - 12} stroke="#bae6fd" strokeWidth={1.5} />
          <rect x={0} y={FLOOR_Y} width={680} height={122} fill="url(#sunnyFloor)" />
          <line x1={0} y1={FLOOR_Y} x2={680} y2={FLOOR_Y} stroke="#f97316" strokeWidth={2} />

          {/* Bright Honey-Gold Wall Growth Ruler Board (Feet & Inches Primary!) */}
          <rect
            x={532}
            y={18}
            width={132}
            height={FLOOR_Y - 24}
            rx={10}
            fill="url(#honeyWoodRuler)"
            stroke="#d97706"
            strokeWidth={2.5}
          />
          <circle cx={598} cy={31} r={4} fill="#e0f2fe" stroke="#b45309" strokeWidth={1.8} />
          <text
            x={598}
            y={45}
            textAnchor="middle"
            fill="#78350f"
            fontSize={8.5}
            fontWeight={700}
            fontFamily="JetBrains Mono, monospace"
          >
            FEET &amp; INCHES
          </text>

          {/* Ruler Ticks & Feet/Inches Labels */}
          {rulerInchTicks.map((inch, idx) => {
            const y = inchesToSvgY(inch);
            const isFullFoot = inch % 12 === 0;
            const isHalfFoot = inch % 6 === 0;
            const tickLen = isFullFoot ? 22 : isHalfFoot ? 16 : 9;
            const ft = Math.floor(inch / 12);
            const remIn = inch % 12;
            const labelPrimary = `${ft}'${remIn}"`;
            const cmSub = Math.round(inchesToCm(inch));

            return (
              <g key={`tick_in_${inch}`}>
                <line
                  x1={532}
                  y1={y}
                  x2={532 + tickLen}
                  y2={y}
                  stroke={isFullFoot ? '#451a03' : isHalfFoot ? '#78350f' : '#92400e'}
                  strokeWidth={isFullFoot ? 2.3 : isHalfFoot ? 1.8 : 1.1}
                />
                {isHalfFoot && (
                  <>
                    <circle
                      cx={557}
                      cy={y}
                      r={2.5}
                      fill={RAINBOW_PIN_COLORS[idx % RAINBOW_PIN_COLORS.length]}
                    />
                    <text
                      x={564}
                      y={y + 3.5}
                      fill="#451a03"
                      fontSize={isFullFoot ? 11 : 10}
                      fontWeight={700}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {`${labelPrimary} (${inch}")`}
                    </text>
                    {showSecondaryMetric && isFullFoot && (
                      <text
                        x={564}
                        y={y + 13}
                        fill="#78350f"
                        fontSize={8}
                        fontWeight={600}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {`${cmSub} cm`}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}

          {/* Saved Colorful Milestone Marks on the Wall Ruler (Interactive!) */}
          {sortedMarks.map((m, idx) => {
            const markY = heightCmToSvgY(m.heightCm);
            const isCurrentSelected =
              Math.abs(m.heightCm - activeHeightCm) < 0.15 &&
              m.ageMonths === activeAgeMonths;
            const pinColor = RAINBOW_PIN_COLORS[idx % RAINBOW_PIN_COLORS.length];

            return (
              <g
                key={m.id}
                onClick={() => onSelectMilestoneOnWall(m)}
                className="cursor-pointer"
              >
                <line
                  x1={514}
                  y1={markY}
                  x2={550}
                  y2={markY}
                  stroke={isCurrentSelected ? '#e11d48' : pinColor}
                  strokeWidth={isCurrentSelected ? 3 : 2}
                />
                <circle
                  cx={652}
                  cy={markY}
                  r={isCurrentSelected ? 5.5 : 4}
                  fill={isCurrentSelected ? '#e11d48' : pinColor}
                  stroke="#ffffff"
                  strokeWidth={1.2}
                />
              </g>
            );
          })}

          {/* LEFT LANE: Age 2 Baseline Toddler Figure (x=136) */}
          <line
            x1={84}
            y1={ageTwoCrownY}
            x2={532}
            y2={ageTwoCrownY}
            stroke="#0284c7"
            strokeWidth={1.8}
            strokeDasharray="6 4"
          />

          {/* Clickable At Age 2 Lane (Tag + Toddler Figure + Baseline Card) */}
          <g
            role={onEditAgeTwoBaseline ? 'button' : undefined}
            tabIndex={onEditAgeTwoBaseline ? 0 : undefined}
            aria-label={
              onEditAgeTwoBaseline
                ? `Edit ${childProfile.name} at Age 2 height and weight (${formatFeetInches(childProfile.ageTwoHeightCm)}, ${formatPounds(childProfile.ageTwoWeightKg)})`
                : undefined
            }
            onClick={onEditAgeTwoBaseline}
            onKeyDown={(e) => {
              if (!onEditAgeTwoBaseline) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onEditAgeTwoBaseline();
              }
            }}
            className={
              onEditAgeTwoBaseline
                ? 'cursor-pointer group focus:outline-none'
                : undefined
            }
          >
            {onEditAgeTwoBaseline && (
              <title>{`Click to adjust ${childProfile.name}'s Age 2 height and weight`}</title>
            )}

            {/* Age 2 Overhead Height Tag on the Child */}
            <g>
              <rect
                x={74}
                y={Math.max(16, ageTwoCrownY - 26)}
                width={124}
                height={22}
                rx={7}
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth={1.4}
              />
              <text
                x={136}
                y={Math.max(16, ageTwoCrownY - 26) + 14.5}
                textAnchor="middle"
                fill="#ffffff"
                fontSize={10.5}
                fontWeight={700}
                fontFamily="JetBrains Mono, monospace"
              >
                {`${formatFeetInches(childProfile.ageTwoHeightCm)} (${cmToInches(childProfile.ageTwoHeightCm).toFixed(1)}")`}
              </text>
            </g>

            <CharacterFigureGroup
              instanceId="age_two_wall"
              centerX={136}
              floorY={FLOOR_Y}
              crownY={ageTwoCrownY}
              ageMonths={24}
              heightCm={childProfile.ageTwoHeightCm}
              weightKg={childProfile.ageTwoWeightKg}
              paletteId={childProfile.paletteId}
              accessoryId={childProfile.accessoryId}
              hairStyle={childProfile.hairStyle}
              skinTone={childProfile.skinTone}
              hairColor={childProfile.hairColor}
              avatarPhotoUrl={avatarPhotoUrl}
              mode="age-two-baseline"
            />

            {/* Age 2 Baseline Card Directly Under Child (Feet & Pounds Primary, cm/kg Secondary) */}
            <rect
              x={48}
              y={FLOOR_Y + 10}
              width={176}
              height={showSecondaryMetric ? 58 : 44}
              rx={10}
              fill="#ffffff"
              stroke="#38bdf8"
              strokeWidth={1.8}
              className={
                onEditAgeTwoBaseline
                  ? 'transition-colors group-hover:fill-sky-50 group-hover:stroke-sky-600'
                  : undefined
              }
            />
            <text
              x={136}
              y={FLOOR_Y + 26}
              textAnchor="middle"
              fill="#0369a1"
              fontSize={11.5}
              fontWeight={700}
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              {onEditAgeTwoBaseline ? 'At Age 2 · Edit' : 'At Age 2'}
            </text>
            <text
              x={136}
              y={FLOOR_Y + 43}
              textAnchor="middle"
              fill="#0f172a"
              fontSize={11.5}
              fontWeight={700}
              fontFamily="JetBrains Mono, monospace"
            >
              {`${formatFeetInches(childProfile.ageTwoHeightCm)} · ${formatPounds(childProfile.ageTwoWeightKg)}`}
            </text>
            {showSecondaryMetric && (
              <text
                x={136}
                y={FLOOR_Y + 58}
                textAnchor="middle"
                fill="#64748b"
                fontSize={9.5}
                fontWeight={600}
                fontFamily="JetBrains Mono, monospace"
              >
                {`${formatTotalInches(childProfile.ageTwoHeightCm)} · ${formatMetricHeight(childProfile.ageTwoHeightCm)} · ${formatMetricWeight(childProfile.ageTwoWeightKg)}`}
              </text>
            )}
          </g>

          {/* GROWTH DELTA VERTICAL BRACKET (Inches Primary, cm Secondary) */}
          {Math.abs(ageTwoCrownY - currentCrownY) >= 6 && (
            <g>
              <line
                x1={238}
                y1={ageTwoCrownY}
                x2={238}
                y2={currentCrownY}
                stroke="#e11d48"
                strokeWidth={2.5}
              />
              <line
                x1={230}
                y1={ageTwoCrownY}
                x2={246}
                y2={ageTwoCrownY}
                stroke="#e11d48"
                strokeWidth={2.5}
              />
              <line
                x1={230}
                y1={currentCrownY}
                x2={246}
                y2={currentCrownY}
                stroke="#e11d48"
                strokeWidth={2.5}
              />
              <rect
                x={187}
                y={(ageTwoCrownY + currentCrownY) / 2 - (showSecondaryMetric ? 19 : 14)}
                width={102}
                height={showSecondaryMetric ? 36 : 26}
                rx={8}
                fill="#f43f5e"
                stroke="#ffffff"
                strokeWidth={1.5}
              />
              <text
                x={238}
                y={(ageTwoCrownY + currentCrownY) / 2 - (showSecondaryMetric ? 3 : -3)}
                textAnchor="middle"
                fill="#ffffff"
                fontSize={11.5}
                fontWeight={700}
                fontFamily="JetBrains Mono, monospace"
              >
                {formatHeightDelta(heightGainCm, 'imperial')}
              </text>
              {showSecondaryMetric && (
                <text
                  x={238}
                  y={(ageTwoCrownY + currentCrownY) / 2 + 11}
                  textAnchor="middle"
                  fill="#ffe4e6"
                  fontSize={9}
                  fontWeight={600}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {formatHeightDelta(heightGainCm, 'metric')}
                </text>
              )}
            </g>
          )}

          {/* CENTER-RIGHT LANE: Active Growing Kid Standing on Floor Scale */}
          <rect
            x={290}
            y={FLOOR_Y}
            width={156}
            height={18}
            rx={6}
            fill="#06b6d4"
            stroke="#0e7490"
            strokeWidth={2}
          />
          <text
            x={368}
            y={FLOOR_Y + 12.5}
            textAnchor="middle"
            fill="#ffffff"
            fontSize={9.5}
            fontWeight={700}
            fontFamily="JetBrains Mono, monospace"
          >
            {formatPounds(activeWeightKg)}
          </text>

          {/* Current Height Measurement Line & Sliding Stadiometer Paddle */}
          <line
            x1={320}
            y1={currentCrownY}
            x2={532}
            y2={currentCrownY}
            stroke="#16a34a"
            strokeWidth={2.5}
          />
          <path
            d={`M 484 ${currentCrownY} L 534 ${currentCrownY} L 534 ${currentCrownY - 14} L 516 ${currentCrownY - 14} Z`}
            fill="#16a34a"
          />

          {/* Current Height Overhead Callout on Active Child (Feet & Inches Primary, cm Secondary) */}
          <g>
            <rect
              x={382}
              y={Math.max(14, currentCrownY - (showSecondaryMetric ? 42 : 30))}
              width={144}
              height={showSecondaryMetric ? 38 : 26}
              rx={8}
              fill="#16a34a"
              stroke="#ffffff"
              strokeWidth={1.5}
            />
            <text
              x={454}
              y={Math.max(14, currentCrownY - (showSecondaryMetric ? 42 : 30)) + 16}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={11.5}
              fontWeight={700}
              fontFamily="JetBrains Mono, monospace"
            >
              {`${formatFeetInches(activeHeightCm)} (${cmToInches(activeHeightCm).toFixed(1)}")`}
            </text>
            {showSecondaryMetric && (
              <text
                x={454}
                y={Math.max(14, currentCrownY - 42) + 30}
                textAnchor="middle"
                fill="#dcfce7"
                fontSize={9.5}
                fontWeight={600}
                fontFamily="JetBrains Mono, monospace"
              >
                {formatMetricHeight(activeHeightCm)}
              </text>
            )}
          </g>

          {/* Active Growing Character */}
          <CharacterFigureGroup
            instanceId="current_wall"
            centerX={368}
            floorY={FLOOR_Y}
            crownY={currentCrownY}
            ageMonths={activeAgeMonths}
            heightCm={activeHeightCm}
            weightKg={activeWeightKg}
            paletteId={childProfile.paletteId}
            accessoryId={childProfile.accessoryId}
            hairStyle={childProfile.hairStyle}
            skinTone={childProfile.skinTone}
            hairColor={childProfile.hairColor}
            avatarPhotoUrl={avatarPhotoUrl}
            mode="current"
            isWaveActive={isPlayingTimelapse || isPreviewDirty || isSpeakingAvatar}
          />

          {/* Cheerful Speech Bubble when Avatar is Speaking */}
          {isSpeakingAvatar && (
            <g>
              <rect
                x={226}
                y={Math.max(16, currentCrownY - 12)}
                width={118}
                height={32}
                rx={12}
                fill="#ffffff"
                stroke="#4f46e5"
                strokeWidth={2}
              />
              <polygon
                points={`342,${Math.max(16, currentCrownY - 12) + 12} 354,${Math.max(16, currentCrownY - 12) + 18} 342,${Math.max(16, currentCrownY - 12) + 24}`}
                fill="#ffffff"
                stroke="#4f46e5"
                strokeWidth={1.6}
              />
              <text
                x={285}
                y={Math.max(16, currentCrownY - 12) + 20}
                textAnchor="middle"
                fill="#1e1b4b"
                fontSize={10.5}
                fontWeight={700}
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                {`Hi! I'm ${childProfile.name.slice(0, 10)}!`}
              </text>
            </g>
          )}

          {/* Active Kid Name, Feet/Inches & Pounds Card Under Scale (cm & kg Secondary) */}
          <rect
            x={236}
            y={FLOOR_Y + 24}
            width={264}
            height={showSecondaryMetric ? 62 : 46}
            rx={10}
            fill="#ffffff"
            stroke="#f59e0b"
            strokeWidth={1.8}
          />
          <text
            x={368}
            y={FLOOR_Y + 41}
            textAnchor="middle"
            fill="#0f172a"
            fontSize={12}
            fontWeight={700}
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            {`${childProfile.name} (${formatAgeLabel(activeAgeMonths)}) — ${formatFeetInches(activeHeightCm)} · ${formatPounds(activeWeightKg)}`}
          </text>
          <text
            x={368}
            y={FLOOR_Y + 57}
            textAnchor="middle"
            fill="#047857"
            fontSize={10.5}
            fontWeight={700}
            fontFamily="JetBrains Mono, monospace"
          >
            {`${formatHeightDelta(heightGainCm, 'imperial')} · ${formatWeightDelta(weightGainKg, 'imperial')} since Age 2`}
          </text>
          {showSecondaryMetric && (
            <text
              x={368}
              y={FLOOR_Y + 73}
              textAnchor="middle"
              fill="#64748b"
              fontSize={9.5}
              fontWeight={600}
              fontFamily="JetBrains Mono, monospace"
            >
              {`${formatTotalInches(activeHeightCm)} · ${formatMetricHeight(activeHeightCm)} · ${formatMetricWeight(activeWeightKg)}`}
            </text>
          )}

          {/* BRIGHT TURQUOISE & SUNSHINE WEIGHT DIAL GAUGE (Pounds Primary, kg Secondary) */}
          <g>
            <circle
              cx={588}
              cy={542}
              r={48}
              fill="#ffffff"
              stroke="#06b6d4"
              strokeWidth={4.5}
            />
            <circle
              cx={588}
              cy={542}
              r={41}
              fill="none"
              stroke="#fde047"
              strokeWidth={3}
              strokeDasharray="6 4"
            />
            <g transform={`rotate(${ageTwoScaleAngle}, 588, 542)`}>
              <line
                x1={588}
                y1={542}
                x2={588}
                y2={509}
                stroke="#38bdf8"
                strokeWidth={2}
                strokeDasharray="2 2"
              />
            </g>
            <g transform={`rotate(${scaleAngle}, 588, 542)`}>
              <line
                x1={588}
                y1={547}
                x2={588}
                y2={503}
                stroke="#f43f5e"
                strokeWidth={3}
                strokeLinecap="round"
              />
            </g>
            <circle cx={588} cy={542} r={4.5} fill="#0f172a" />
            <text
              x={588}
              y={561}
              textAnchor="middle"
              fill="#0f172a"
              fontSize={11.5}
              fontWeight={700}
              fontFamily="JetBrains Mono, monospace"
            >
              {formatPounds(activeWeightKg)}
            </text>
            {showSecondaryMetric ? (
              <text
                x={588}
                y={574}
                textAnchor="middle"
                fill="#64748b"
                fontSize={9}
                fontWeight={600}
                fontFamily="JetBrains Mono, monospace"
              >
                {formatMetricWeight(activeWeightKg)}
              </text>
            ) : (
              <text
                x={588}
                y={574}
                textAnchor="middle"
                fill="#0284c7"
                fontSize={8.5}
                fontWeight={700}
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                POUNDS
              </text>
            )}
          </g>
        </svg>
      </div>

      {/* Bright Kid-Friendly Size Discovery Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800 dark:text-sky-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
            <span>How Tall Is That?</span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            {funFacts.heightFact}
          </p>
        </div>

        <div className="space-y-1 md:border-l md:border-sky-200 dark:md:border-slate-700 md:pl-4">
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400">
            Sprouted Since Age 2
          </p>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            {funFacts.growthFact}
          </p>
        </div>

        <div className="space-y-1 md:border-l md:border-sky-200 dark:md:border-slate-700 md:pl-4">
          <p className="text-xs font-bold text-rose-700 dark:text-rose-400">Scale Fun Fact</p>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            {funFacts.weightFact}
          </p>
        </div>
      </div>
    </div>
  );
};
