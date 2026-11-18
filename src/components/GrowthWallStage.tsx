import React from 'react';
import { Play, Pause, Sparkles } from 'lucide-react';
import {
  ChildProfile,
  clampNumber,
  formatAgeLabel,
  formatHeight,
  formatHeightDelta,
  formatWeight,
  formatWeightDelta,
  getFunComparison,
  getGrowthStageInfo,
  GrowthMeasurement,
  UnitSystem,
} from '../types';
import { CharacterFigureGroup } from './GrowingCharacterSvg';

interface GrowthWallStageProps {
  childProfile: ChildProfile;
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
}

const MIN_RULER_CM = 65;
const MAX_RULER_CM = 175;
const RULER_TOP_Y = 46;
const FLOOR_Y = 482;

function heightCmToSvgY(cm: number): number {
  const clamped = clampNumber(cm, MIN_RULER_CM, MAX_RULER_CM);
  const ratio = (clamped - MIN_RULER_CM) / (MAX_RULER_CM - MIN_RULER_CM);
  return FLOOR_Y - ratio * (FLOOR_Y - RULER_TOP_Y);
}

export const GrowthWallStage: React.FC<GrowthWallStageProps> = ({
  childProfile,
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
}) => {
  const ageTwoCrownY = heightCmToSvgY(childProfile.ageTwoHeightCm);
  const currentCrownY = heightCmToSvgY(activeHeightCm);

  const heightGainCm = activeHeightCm - childProfile.ageTwoHeightCm;
  const weightGainKg = activeWeightKg - childProfile.ageTwoWeightKg;

  const stageInfo = getGrowthStageInfo(activeAgeMonths);
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
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-5">
      {/* Stage Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-800">{childProfile.name}’s Growth Wall</span>
            <span aria-hidden="true">·</span>
            <span>{stageInfo.stageName}</span>
            {isPreviewDirty && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 font-medium">Live Preview</span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-500">{stageInfo.description}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleTimelapse}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {isPlayingTimelapse ? (
              <>
                <Pause className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                Pause Growth Story
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                Play Growth from Age 2
              </>
            )}
          </button>

          {/* Interactive Unit Segmented Switch */}
          <div
            role="group"
            aria-label="Measurement units"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              onClick={() => onUnitsChange('metric')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                units === 'metric'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              cm · kg
            </button>
            <button
              type="button"
              onClick={() => onUnitsChange('imperial')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                units === 'imperial'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ft/in · lb
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Growth Wall & Wooden Floor Scale Canvas */}
      <div className="w-full overflow-hidden rounded-xl bg-slate-50 border border-slate-200/80">
        <svg
          viewBox="0 0 680 590"
          className="w-full h-auto select-none"
          role="img"
          aria-label={`Interactive height and weight growth chart comparing ${childProfile.name} at Age 2 (${formatHeight(childProfile.ageTwoHeightCm, units)}) with ${formatAgeLabel(activeAgeMonths)} (${formatHeight(activeHeightCm, units)} and ${formatWeight(activeWeightKg, units)}).`}
        >
          {/* Subtle Playroom Wall Grid Horizontal Reference Lines */}
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
                  stroke="#e2e8f0"
                  strokeWidth={1}
                  strokeDasharray="3 5"
                />
              );
            })}

          {/* Baseboard & Warm Wooden Playroom Floor */}
          <rect x={0} y={FLOOR_Y - 12} width={680} height={12} fill="#f1f5f9" />
          <line x1={0} y1={FLOOR_Y - 12} x2={680} y2={FLOOR_Y - 12} stroke="#cbd5e1" strokeWidth={1} />
          <rect x={0} y={FLOOR_Y} width={680} height={108} fill="#ede8df" />
          <line x1={0} y1={FLOOR_Y} x2={680} y2={FLOOR_Y} stroke="#cbd5e1" strokeWidth={1.5} />

          {/* Handcrafted Natural Oak Wall Growth Ruler Board (Right Side x=532..648) */}
          <rect
            x={532}
            y={20}
            width={122}
            height={FLOOR_Y - 26}
            rx={8}
            fill="#dfc39d"
            stroke="#8c6843"
            strokeWidth={2}
          />
          {/* Subtle Wood Grain Vertical Accent Lines */}
          <line x1={556} y1={24} x2={556} y2={FLOOR_Y - 8} stroke="#d4b48a" strokeWidth={1} />
          <line x1={626} y1={24} x2={626} y2={FLOOR_Y - 8} stroke="#d4b48a" strokeWidth={1} />
          <circle cx={593} cy={33} r={3.5} fill="#f8fafc" stroke="#8c6843" strokeWidth={1.5} />

          {/* Ruler Ticks & Labels */}
          {rulerTicks.map((cm) => {
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
                  stroke="#5c4023"
                  strokeWidth={isMajor ? 1.8 : 1.1}
                />
                {isMajor && (
                  <text
                    x={560}
                    y={y + 4}
                    fill="#4a3319"
                    fontSize={11}
                    fontWeight={600}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {labelText}
                  </text>
                )}
              </g>
            );
          })}

          {/* Saved Penciled Milestone Marks on the Wall Ruler (Interactive!) */}
          {sortedMarks.map((m) => {
            const markY = heightCmToSvgY(m.heightCm);
            const isCurrentSelected =
              Math.abs(m.heightCm - activeHeightCm) < 0.15 &&
              m.ageMonths === activeAgeMonths;
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
                  stroke={isCurrentSelected ? '#059669' : '#0f172a'}
                  strokeWidth={isCurrentSelected ? 2.6 : 1.6}
                />
                <circle
                  cx={635}
                  cy={markY}
                  r={isCurrentSelected ? 5 : 3.5}
                  fill={isCurrentSelected ? '#059669' : '#785532'}
                />
                <text
                  x={626}
                  y={markY + 3.5}
                  textAnchor="end"
                  fill={isCurrentSelected ? '#065f46' : '#5c4023'}
                  fontSize={9.5}
                  fontWeight={isCurrentSelected ? 700 : 600}
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  {`${Math.floor(m.ageMonths / 12)}y${m.ageMonths % 12 ? `${m.ageMonths % 12}m` : ''}`}
                </text>
              </g>
            );
          })}

          {/* LEFT LANE: Age 2 Baseline Toddler Silhouette (x=135) */}
          <line
            x1={95}
            y1={ageTwoCrownY}
            x2={532}
            y2={ageTwoCrownY}
            stroke="#94a3b8"
            strokeWidth={1.4}
            strokeDasharray="5 4"
          />
          <CharacterFigureGroup
            centerX={138}
            floorY={FLOOR_Y}
            crownY={ageTwoCrownY}
            ageMonths={24}
            heightCm={childProfile.ageTwoHeightCm}
            weightKg={childProfile.ageTwoWeightKg}
            paletteId={childProfile.paletteId}
            accessoryId="sprout"
            hairStyle={childProfile.hairStyle}
            mode="age-two-baseline"
          />

          {/* Age 2 Baseline Floor Label */}
          <text
            x={138}
            y={FLOOR_Y + 24}
            textAnchor="middle"
            fill="#475569"
            fontSize={12}
            fontWeight={700}
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            At Age 2
          </text>
          <text
            x={138}
            y={FLOOR_Y + 42}
            textAnchor="middle"
            fill="#64748b"
            fontSize={11.5}
            fontWeight={600}
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
                stroke="#059669"
                strokeWidth={2}
              />
              <line
                x1={229}
                y1={ageTwoCrownY}
                x2={243}
                y2={ageTwoCrownY}
                stroke="#059669"
                strokeWidth={2}
              />
              <line
                x1={229}
                y1={currentCrownY}
                x2={243}
                y2={currentCrownY}
                stroke="#059669"
                strokeWidth={2}
              />
              <rect
                x={194}
                y={(ageTwoCrownY + currentCrownY) / 2 - 13}
                width={84}
                height={24}
                rx={6}
                fill="#ecfdf5"
                stroke="#10b981"
                strokeWidth={1.2}
              />
              <text
                x={236}
                y={(ageTwoCrownY + currentCrownY) / 2 + 3}
                textAnchor="middle"
                fill="#065f46"
                fontSize={11}
                fontWeight={700}
                fontFamily="JetBrains Mono, monospace"
              >
                {formatHeightDelta(heightGainCm, units)}
              </text>
            </g>
          )}

          {/* CENTER-RIGHT LANE: Active Growing Kid Standing on Floor Scale (x=368) */}
          {/* Scale Step Platform sits cleanly with top surface at FLOOR_Y */}
          <rect
            x={292}
            y={FLOOR_Y}
            width={152}
            height={16}
            rx={5}
            fill="#cfa97e"
            stroke="#6b4c2a"
            strokeWidth={1.8}
          />
          <rect
            x={304}
            y={FLOOR_Y + 16}
            width={128}
            height={10}
            rx={3}
            fill="#475569"
          />

          {/* Current Height Measurement Line & Sliding Wooden Stadiometer Head Paddle */}
          <line
            x1={320}
            y1={currentCrownY}
            x2={532}
            y2={currentCrownY}
            stroke="#059669"
            strokeWidth={2}
          />
          {/* Stadiometer Sliding Head Paddle */}
          <path
            d={`M 488 ${currentCrownY} L 534 ${currentCrownY} L 534 ${currentCrownY - 12} L 520 ${currentCrownY - 12} Z`}
            fill="#059669"
          />

          {/* Current Height Callout Tag */}
          <g>
            <rect
              x={408}
              y={Math.max(18, currentCrownY - 30)}
              width={116}
              height={24}
              rx={6}
              fill="#0f172a"
            />
            <text
              x={466}
              y={Math.max(18, currentCrownY - 30) + 16}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={11.5}
              fontWeight={700}
              fontFamily="JetBrains Mono, monospace"
            >
              {formatHeight(activeHeightCm, units)}
            </text>
          </g>

          {/* Active Growing Character */}
          <CharacterFigureGroup
            centerX={368}
            floorY={FLOOR_Y}
            crownY={currentCrownY}
            ageMonths={activeAgeMonths}
            heightCm={activeHeightCm}
            weightKg={activeWeightKg}
            paletteId={childProfile.paletteId}
            accessoryId={childProfile.accessoryId}
            hairStyle={childProfile.hairStyle}
            mode="current"
            isWaveActive={isPlayingTimelapse || isPreviewDirty}
          />

          {/* Active Age Label Under Scale */}
          <text
            x={368}
            y={FLOOR_Y + 46}
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
            y={FLOOR_Y + 64}
            textAnchor="middle"
            fill="#047857"
            fontSize={11.5}
            fontWeight={600}
            fontFamily="JetBrains Mono, monospace"
          >
            {`${formatHeightDelta(heightGainCm, units)} taller · ${formatWeightDelta(weightGainKg, units)} since Age 2`}
          </text>

          {/* INTERACTIVE BRASS & OAK WEIGHT DIAL GAUGE (Bottom Right x=568, y=534) */}
          <g>
            <circle
              cx={568}
              cy={535}
              r={44}
              fill="#ffffff"
              stroke="#b48a5a"
              strokeWidth={4}
            />
            <circle
              cx={568}
              cy={535}
              r={38}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={1.2}
              strokeDasharray="2 4"
            />
            {/* Age 2 Weight Reference Needle (Muted) */}
            <g transform={`rotate(${ageTwoScaleAngle}, 568, 535)`}>
              <line
                x1={568}
                y1={535}
                x2={568}
                y2={505}
                stroke="#94a3b8"
                strokeWidth={1.6}
                strokeDasharray="2 2"
              />
            </g>
            {/* Active Weight Needle */}
            <g transform={`rotate(${scaleAngle}, 568, 535)`}>
              <line
                x1={568}
                y1={540}
                x2={568}
                y2={499}
                stroke="#059669"
                strokeWidth={2.6}
                strokeLinecap="round"
              />
            </g>
            <circle cx={568} cy={535} r={4.5} fill="#0f172a" />
            <text
              x={568}
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
              x={568}
              y={570}
              textAnchor="middle"
              fill="#64748b"
              fontSize={8.5}
              fontWeight={600}
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              SCALE
            </text>
          </g>
        </svg>
      </div>

      {/* Kid-Friendly Size Discovery Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>How Tall Is That?</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">{funFacts.heightFact}</p>
        </div>

        <div className="space-y-1 md:border-l md:border-slate-200 md:pl-4">
          <p className="text-xs font-semibold text-slate-800">Sprouted Since Age 2</p>
          <p className="text-xs text-slate-600 leading-relaxed">{funFacts.growthFact}</p>
        </div>

        <div className="space-y-1 md:border-l md:border-slate-200 md:pl-4">
          <p className="text-xs font-semibold text-slate-800">Scale Fun Fact</p>
          <p className="text-xs text-slate-600 leading-relaxed">{funFacts.weightFact}</p>
        </div>
      </div>
    </div>
  );
};
