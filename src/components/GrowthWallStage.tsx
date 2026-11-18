import React from 'react';
import { Camera, Play, Pause, Sparkles } from 'lucide-react';
import {
  calculateExactAgeFromDob,
  ChildProfile,
  clampNumber,
  formatAgeLabel,
  formatHeight,
  formatHeightDelta,
  formatHumanDate,
  formatWeight,
  formatWeightDelta,
  getFunComparison,
  getGrowthStageInfo,
  GrowthMeasurement,
  UnitSystem,
} from '../types';
import { evaluateChildWhoPercentiles } from '../services/whoGrowthService';
import { CharacterFigureGroup } from './GrowingCharacterSvg';

interface GrowthWallStageProps {
  childProfile: ChildProfile;
  avatarPhotoUrl: string | null;
  measurements: GrowthMeasurement[];
  activeHeightCm: number;
  activeWeightKg: number;
  activeAgeMonths: number;
  isPreviewDirty: boolean;
  units: UnitSystem;
  onUnitsChange: (units: UnitSystem) => void;
  onSelectMilestoneOnWall: (measurement: GrowthMeasurement) => void;
  isPlayingTimelapse: boolean;
  onToggleTimelapse: () => void;
  onOpenPhotoStudio: () => void;
}

const MIN_RULER_CM = 65;
const MAX_RULER_CM = 175;
const RULER_TOP_Y = 52;
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
  const clamped = clampNumber(cm, MIN_RULER_CM, MAX_RULER_CM);
  const ratio = (clamped - MIN_RULER_CM) / (MAX_RULER_CM - MIN_RULER_CM);
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
  units,
  onUnitsChange,
  onSelectMilestoneOnWall,
  isPlayingTimelapse,
  onToggleTimelapse,
  onOpenPhotoStudio,
}) => {
  const ageTwoCrownY = heightCmToSvgY(childProfile.ageTwoHeightCm);
  const currentCrownY = heightCmToSvgY(activeHeightCm);

  const heightGainCm = activeHeightCm - childProfile.ageTwoHeightCm;
  const weightGainKg = activeWeightKg - childProfile.ageTwoWeightKg;

  const stageInfo = getGrowthStageInfo(activeAgeMonths);
  const exactDobAge = childProfile.birthDate
    ? calculateExactAgeFromDob(childProfile.birthDate)
    : null;

  const whoEval = evaluateChildWhoPercentiles({
    heightCm: activeHeightCm,
    weightKg: activeWeightKg,
    ageMonths: activeAgeMonths,
    sex: childProfile.sex,
  });
  const whoPeerMedianY = heightCmToSvgY(whoEval.height.medianValue);

  const funFacts = getFunComparison(
    activeHeightCm,
    activeWeightKg,
    childProfile.ageTwoHeightCm,
  );

  // Scale dial rotation (-135 deg at 0 kg up to +135 deg at 60 kg)
  const scaleAngle = -135 + clampNumber(activeWeightKg / 60, 0, 1) * 270;
  const ageTwoScaleAngle =
    -135 + clampNumber(childProfile.ageTwoWeightKg / 60, 0, 1) * 270;

  // Generate ruler ticks every 5 cm from 70 to 175
  const rulerTicks: number[] = [];
  for (let cm = 70; cm <= 175; cm += 5) {
    rulerTicks.push(cm);
  }

  // Sort measurements ascending by ageMonths for clean wall display
  const sortedMarks = [...measurements].sort((a, b) => a.ageMonths - b.ageMonths);

  return (
    <div className="bg-white border-2 border-sky-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-5 shadow-xs">
      {/* Stage Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sky-100 pb-4">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-bold text-indigo-950">{childProfile.name}’s Growth Wall</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-sky-700">{stageInfo.stageName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums font-semibold text-indigo-900">
              WHO Height {whoEval.height.ordinalLabel} · Weight {whoEval.weight.ordinalLabel}
            </span>
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
                <span className="text-orange-600 font-bold">Live Preview</span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-600">{stageInfo.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenPhotoStudio}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-sky-950 bg-sky-100 hover:bg-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-sky-700" aria-hidden="true" />
            {avatarPhotoUrl ? 'Change Photo' : 'Photo Avatar'}
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

          {/* Interactive Unit Segmented Switch */}
          <div
            role="group"
            aria-label="Measurement units"
            className="flex items-center gap-1 p-1 bg-sky-100 rounded-lg"
          >
            <button
              type="button"
              onClick={() => onUnitsChange('metric')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                units === 'metric'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-sky-900 hover:text-indigo-950'
              }`}
            >
              cm · kg
            </button>
            <button
              type="button"
              onClick={() => onUnitsChange('imperial')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                units === 'imperial'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-sky-900 hover:text-indigo-950'
              }`}
            >
              ft/in · lb
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Bright Storybook Playroom Wall & Scale Canvas */}
      <div className="w-full overflow-hidden rounded-xl border-2 border-sky-200">
        <svg
          viewBox="0 0 680 590"
          className="w-full h-auto select-none"
          role="img"
          aria-label={`Interactive height and weight growth chart comparing ${childProfile.name} at Age 2 (${formatHeight(childProfile.ageTwoHeightCm, units)}) with ${formatAgeLabel(activeAgeMonths)} (${formatHeight(activeHeightCm, units)} and ${formatWeight(activeWeightKg, units)}).`}
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

          {/* Playroom Wall Grid Horizontal Reference Lines */}
          {rulerTicks
            .filter((cm) => cm % 10 === 0)
            .map((cm) => {
              const y = heightCmToSvgY(cm);
              return (
                <line
                  key={`grid_${cm}`}
                  x1={24}
                  y1={y}
                  x2={530}
                  y2={y}
                  stroke="#7dd3fc"
                  strokeWidth={1.1}
                  strokeDasharray="4 5"
                  opacity={0.75}
                />
              );
            })}

          {/* Crisp White Baseboard & Warm Apricot Playroom Floor */}
          <rect x={0} y={FLOOR_Y - 12} width={680} height={12} fill="#ffffff" />
          <line x1={0} y1={FLOOR_Y - 12} x2={680} y2={FLOOR_Y - 12} stroke="#bae6fd" strokeWidth={1.5} />
          <rect x={0} y={FLOOR_Y} width={680} height={108} fill="url(#sunnyFloor)" />
          <line x1={0} y1={FLOOR_Y} x2={680} y2={FLOOR_Y} stroke="#f97316" strokeWidth={2} />

          {/* Bright Honey-Gold Wall Growth Ruler Board (Right Side x=532..654) */}
          <rect
            x={532}
            y={18}
            width={124}
            height={FLOOR_Y - 24}
            rx={10}
            fill="url(#honeyWoodRuler)"
            stroke="#d97706"
            strokeWidth={2.5}
          />
          <circle cx={594} cy={32} r={4} fill="#e0f2fe" stroke="#b45309" strokeWidth={1.8} />

          {/* Ruler Ticks & Labels */}
          {rulerTicks.map((cm, idx) => {
            const y = heightCmToSvgY(cm);
            const isMajor = cm % 10 === 0;
            const tickLen = isMajor ? 22 : 12;
            const labelText =
              units === 'metric'
                ? `${cm}`
                : `${Math.floor(cm / 2.54 / 12)}'${Math.round((cm / 2.54) % 12)}"`;

            return (
              <g key={`tick_${cm}`}>
                <line
                  x1={532}
                  y1={y}
                  x2={532 + tickLen}
                  y2={y}
                  stroke={isMajor ? '#78350f' : '#92400e'}
                  strokeWidth={isMajor ? 2.1 : 1.2}
                />
                {isMajor && (
                  <>
                    <circle
                      cx={558}
                      cy={y}
                      r={2.5}
                      fill={RAINBOW_PIN_COLORS[idx % RAINBOW_PIN_COLORS.length]}
                    />
                    <text
                      x={565}
                      y={y + 4}
                      fill="#451a03"
                      fontSize={11}
                      fontWeight={700}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {labelText}
                    </text>
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
                  cx={640}
                  cy={markY}
                  r={isCurrentSelected ? 5.5 : 4}
                  fill={isCurrentSelected ? '#e11d48' : pinColor}
                  stroke="#ffffff"
                  strokeWidth={1.2}
                />
                <text
                  x={630}
                  y={markY + 3.5}
                  textAnchor="end"
                  fill={isCurrentSelected ? '#881337' : '#451a03'}
                  fontSize={9.5}
                  fontWeight={700}
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  {m.ageMonths < 12
                    ? `${m.ageMonths}m`
                    : `${Math.floor(m.ageMonths / 12)}y${m.ageMonths % 12 ? `${m.ageMonths % 12}m` : ''}`}
                </text>
              </g>
            );
          })}

          {/* WHO 50th Percentile Peer Median Reference Marker on Ruler */}
          <g>
            <line
              x1={474}
              y1={whoPeerMedianY}
              x2={536}
              y2={whoPeerMedianY}
              stroke="#4338ca"
              strokeWidth={1.6}
              strokeDasharray="3 3"
            />
            <text
              x={526}
              y={whoPeerMedianY - 4}
              textAnchor="end"
              fill="#312e81"
              fontSize={8.5}
              fontWeight={700}
              fontFamily="JetBrains Mono, monospace"
            >
              WHO 50th ({formatHeight(whoEval.height.medianValue, units)})
            </text>
          </g>

          {/* LEFT LANE: Age 2 Baseline Toddler Figure (x=138) */}
          <line
            x1={92}
            y1={ageTwoCrownY}
            x2={532}
            y2={ageTwoCrownY}
            stroke="#0284c7"
            strokeWidth={1.8}
            strokeDasharray="6 4"
          />
          <CharacterFigureGroup
            instanceId="age_two_wall"
            centerX={138}
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

          {/* Age 2 Baseline Floor Label */}
          <rect
            x={64}
            y={FLOOR_Y + 12}
            width={148}
            height={42}
            rx={10}
            fill="#ffffff"
            stroke="#38bdf8"
            strokeWidth={1.8}
          />
          <text
            x={138}
            y={FLOOR_Y + 29}
            textAnchor="middle"
            fill="#0369a1"
            fontSize={12}
            fontWeight={700}
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            At Age 2
          </text>
          <text
            x={138}
            y={FLOOR_Y + 46}
            textAnchor="middle"
            fill="#0f172a"
            fontSize={11}
            fontWeight={700}
            fontFamily="JetBrains Mono, monospace"
          >
            {`${formatHeight(childProfile.ageTwoHeightCm, units)} · ${formatWeight(childProfile.ageTwoWeightKg, units)}`}
          </text>

          {/* GROWTH DELTA VERTICAL BRACKET (Between Age 2 Crown & Current Crown) */}
          {Math.abs(ageTwoCrownY - currentCrownY) >= 6 && (
            <g>
              <line
                x1={236}
                y1={ageTwoCrownY}
                x2={236}
                y2={currentCrownY}
                stroke="#e11d48"
                strokeWidth={2.5}
              />
              <line
                x1={228}
                y1={ageTwoCrownY}
                x2={244}
                y2={ageTwoCrownY}
                stroke="#e11d48"
                strokeWidth={2.5}
              />
              <line
                x1={228}
                y1={currentCrownY}
                x2={244}
                y2={currentCrownY}
                stroke="#e11d48"
                strokeWidth={2.5}
              />
              <rect
                x={190}
                y={(ageTwoCrownY + currentCrownY) / 2 - 14}
                width={92}
                height={26}
                rx={8}
                fill="#f43f5e"
                stroke="#ffffff"
                strokeWidth={1.5}
              />
              <text
                x={236}
                y={(ageTwoCrownY + currentCrownY) / 2 + 3}
                textAnchor="middle"
                fill="#ffffff"
                fontSize={11.5}
                fontWeight={700}
                fontFamily="JetBrains Mono, monospace"
              >
                {formatHeightDelta(heightGainCm, units)}
              </text>
            </g>
          )}

          {/* CENTER-RIGHT LANE: Active Growing Kid Standing on Bright Coral-Turquoise Floor Scale */}
          <rect
            x={290}
            y={FLOOR_Y}
            width={156}
            height={16}
            rx={6}
            fill="#06b6d4"
            stroke="#0e7490"
            strokeWidth={2}
          />
          <rect
            x={304}
            y={FLOOR_Y + 16}
            width={128}
            height={10}
            rx={4}
            fill="#0f172a"
          />

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

          {/* Current Height Bright Callout Tag */}
          <g>
            <rect
              x={404}
              y={Math.max(18, currentCrownY - 32)}
              width={120}
              height={26}
              rx={8}
              fill="#16a34a"
              stroke="#ffffff"
              strokeWidth={1.5}
            />
            <text
              x={464}
              y={Math.max(18, currentCrownY - 32) + 17}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={12}
              fontWeight={700}
              fontFamily="JetBrains Mono, monospace"
            >
              {formatHeight(activeHeightCm, units)}
            </text>
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
            isWaveActive={isPlayingTimelapse || isPreviewDirty}
          />

          {/* Active Kid Name & Growth Summary Card Under Scale */}
          <rect
            x={244}
            y={FLOOR_Y + 32}
            width={248}
            height={44}
            rx={10}
            fill="#ffffff"
            stroke="#f59e0b"
            strokeWidth={1.8}
          />
          <text
            x={368}
            y={FLOOR_Y + 50}
            textAnchor="middle"
            fill="#0f172a"
            fontSize={12.5}
            fontWeight={700}
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            {`${childProfile.name} · ${formatAgeLabel(activeAgeMonths)}`}
          </text>
          <text
            x={368}
            y={FLOOR_Y + 67}
            textAnchor="middle"
            fill="#047857"
            fontSize={11}
            fontWeight={700}
            fontFamily="JetBrains Mono, monospace"
          >
            {`${formatHeightDelta(heightGainCm, units)} vs Age 2 · ${formatWeightDelta(weightGainKg, units)}`}
          </text>

          {/* BRIGHT TURQUOISE & SUNSHINE WEIGHT DIAL GAUGE */}
          <g>
            <circle
              cx={578}
              cy={535}
              r={45}
              fill="#ffffff"
              stroke="#06b6d4"
              strokeWidth={4.5}
            />
            <circle
              cx={578}
              cy={535}
              r={38}
              fill="none"
              stroke="#fde047"
              strokeWidth={3}
              strokeDasharray="6 4"
            />
            <g transform={`rotate(${ageTwoScaleAngle}, 578, 535)`}>
              <line
                x1={578}
                y1={535}
                x2={578}
                y2={504}
                stroke="#38bdf8"
                strokeWidth={2}
                strokeDasharray="2 2"
              />
            </g>
            <g transform={`rotate(${scaleAngle}, 578, 535)`}>
              <line
                x1={578}
                y1={540}
                x2={578}
                y2={498}
                stroke="#f43f5e"
                strokeWidth={3}
                strokeLinecap="round"
              />
            </g>
            <circle cx={578} cy={535} r={5} fill="#0f172a" />
            <text
              x={578}
              y={557}
              textAnchor="middle"
              fill="#0f172a"
              fontSize={11}
              fontWeight={700}
              fontFamily="JetBrains Mono, monospace"
            >
              {formatWeight(activeWeightKg, units)}
            </text>
            <text
              x={578}
              y={570}
              textAnchor="middle"
              fill="#0284c7"
              fontSize={8.5}
              fontWeight={700}
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              WEIGHT
            </text>
          </g>
        </svg>
      </div>

      {/* Bright Kid-Friendly Size Discovery Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
            <span>How Tall Is That?</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">{funFacts.heightFact}</p>
        </div>

        <div className="space-y-1 md:border-l md:border-sky-200 md:pl-4">
          <p className="text-xs font-bold text-emerald-800">Sprouted Since Age 2</p>
          <p className="text-xs text-slate-700 leading-relaxed">{funFacts.growthFact}</p>
        </div>

        <div className="space-y-1 md:border-l md:border-sky-200 md:pl-4">
          <p className="text-xs font-bold text-rose-700">Scale Fun Fact</p>
          <p className="text-xs text-slate-700 leading-relaxed">{funFacts.weightFact}</p>
        </div>
      </div>
    </div>
  );
};
