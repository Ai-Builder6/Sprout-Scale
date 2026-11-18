import React from 'react';
import {
  AccessoryId,
  CHARACTER_PALETTES,
  clampNumber,
  HairStyle,
  PaletteId,
} from '../types';

export interface CharacterFigureGroupProps {
  centerX: number;
  floorY: number;
  crownY: number;
  ageMonths: number;
  heightCm: number;
  weightKg: number;
  paletteId: PaletteId;
  accessoryId: AccessoryId;
  hairStyle: HairStyle;
  mode: 'age-two-baseline' | 'current';
  isWaveActive?: boolean;
}

/**
 * Renders an anatomically evolving growing child SVG group anchored cleanly between
 * `crownY` (exact top of head aligned with the height ruler) and `floorY` (exact shoe sole).
 */
export const CharacterFigureGroup: React.FC<CharacterFigureGroupProps> = ({
  centerX,
  floorY,
  crownY,
  ageMonths,
  heightCm,
  weightKg,
  paletteId,
  accessoryId,
  hairStyle,
  mode,
  isWaveActive = false,
}) => {
  const palette = CHARACTER_PALETTES[paletteId] ?? CHARACTER_PALETTES.meadow;
  const isBaseline = mode === 'age-two-baseline';

  const totalHeight = Math.max(85, floorY - crownY);

  // Developmental maturity factor: 0.0 at Age 2 (24 mos) -> 1.0 at Age 11 (132 mos)
  const maturity = clampNumber((ageMonths - 24) / 108, 0, 1);

  // Body-positive build factor gently reflecting weight relative to height
  const heightMeters = Math.max(0.7, heightCm / 100);
  const bmi = weightKg / (heightMeters * heightMeters);
  const buildFactor = clampNumber(1 + (bmi - 16) * 0.022, 0.9, 1.16);

  // Anatomical proportions smoothly shift from Toddler (Age 2) to Big Kid:
  // Toddler head is ~27.5% of total height; Big kid head is ~17.5% of total height
  const headRatio = 0.275 - maturity * 0.1;
  const neckRatio = 0.025 + maturity * 0.01;
  const torsoRatio = 0.35 - maturity * 0.03;
  const legRatio = 1 - headRatio - neckRatio - torsoRatio;

  const headH = totalHeight * headRatio;
  const headRx = headH * 0.54 * (1 + (1 - maturity) * 0.05) * clampNumber(buildFactor, 0.95, 1.07);
  const headRy = headH * 0.5;
  const headCy = crownY + headRy;

  const neckTopY = crownY + headH - 2;
  const torsoTopY = neckTopY + totalHeight * neckRatio;
  const torsoH = totalHeight * torsoRatio;
  const hipY = torsoTopY + torsoH;

  const shoulderHalfW = Math.max(15, totalHeight * (0.118 + maturity * 0.018) * buildFactor);
  const waistHalfW = Math.max(14, totalHeight * (0.112 - maturity * 0.006) * buildFactor);

  const shoeH = Math.max(8, totalHeight * 0.055);
  const ankleY = floorY - shoeH;
  const legH = Math.max(16, ankleY - hipY);
  const legOffsetX = waistHalfW * 0.48;
  const legWidth = Math.max(8, waistHalfW * 0.44);

  // Color assignments (muted editorial blueprint palette for Age 2 ghost, vibrant for current)
  const skinFill = isBaseline ? '#e2e8f0' : palette.skin;
  const cheekFill = isBaseline ? '#cbd5e1' : palette.cheeks;
  const hairFill = isBaseline ? '#94a3b8' : palette.hair;
  const shirtFill = isBaseline ? '#cbd5e1' : palette.shirtPrimary;
  const shirtSubFill = isBaseline ? '#f1f5f9' : palette.shirtSecondary;
  const pantsFill = isBaseline ? '#94a3b8' : palette.overalls;
  const shoeFill = isBaseline ? '#64748b' : palette.shoes;
  const strokeColor = isBaseline ? '#64748b' : '#1e293b';

  // Clothing stage based on age
  const stageIndex =
    ageMonths < 36 ? 0 : ageMonths < 60 ? 1 : ageMonths < 96 ? 2 : 3;

  // Arm geometry
  const armLen = torsoH * 0.88;
  const armWidth = Math.max(6.5, legWidth * 0.72);
  const leftShoulderX = centerX - shoulderHalfW + 2;
  const rightShoulderX = centerX + shoulderHalfW - 2;
  const shoulderY = torsoTopY + 7;

  return (
    <g
      opacity={isBaseline ? 0.78 : 1}
      strokeDasharray={isBaseline ? '3 2' : undefined}
    >
      {/* Subtle floor shadow */}
      <ellipse
        cx={centerX}
        cy={floorY + 2}
        rx={waistHalfW * 1.25}
        ry={4.5}
        fill={isBaseline ? '#cbd5e1' : '#0f172a'}
        opacity={isBaseline ? 0.45 : 0.12}
        stroke="none"
      />

      {/* Left Arm */}
      <g
        transform={`rotate(${isBaseline ? 14 : 18}, ${leftShoulderX}, ${shoulderY})`}
      >
        <rect
          x={leftShoulderX - armWidth}
          y={shoulderY}
          width={armWidth}
          height={armLen}
          rx={armWidth / 2}
          fill={skinFill}
          stroke={strokeColor}
          strokeWidth={1.6}
        />
        {/* Short sleeve cuff */}
        <rect
          x={leftShoulderX - armWidth - 0.5}
          y={shoulderY}
          width={armWidth + 1}
          height={armLen * 0.42}
          rx={4}
          fill={shirtFill}
          stroke={strokeColor}
          strokeWidth={1.6}
        />
      </g>

      {/* Right Arm — friendly raised wave on active character */}
      <g
        transform={
          !isBaseline && (isWaveActive || stageIndex >= 1)
            ? `rotate(-128, ${rightShoulderX}, ${shoulderY})`
            : `rotate(-16, ${rightShoulderX}, ${shoulderY})`
        }
      >
        <rect
          x={rightShoulderX}
          y={shoulderY}
          width={armWidth}
          height={armLen}
          rx={armWidth / 2}
          fill={skinFill}
          stroke={strokeColor}
          strokeWidth={1.6}
        />
        <rect
          x={rightShoulderX - 0.5}
          y={shoulderY}
          width={armWidth + 1}
          height={armLen * 0.42}
          rx={4}
          fill={shirtFill}
          stroke={strokeColor}
          strokeWidth={1.6}
        />
      </g>

      {/* Legs */}
      <rect
        x={centerX - legOffsetX - legWidth / 2}
        y={hipY - 3}
        width={legWidth}
        height={legH + 5}
        rx={legWidth * 0.4}
        fill={stageIndex >= 2 ? pantsFill : skinFill}
        stroke={strokeColor}
        strokeWidth={1.6}
      />
      <rect
        x={centerX + legOffsetX - legWidth / 2}
        y={hipY - 3}
        width={legWidth}
        height={legH + 5}
        rx={legWidth * 0.4}
        fill={stageIndex >= 2 ? pantsFill : skinFill}
        stroke={strokeColor}
        strokeWidth={1.6}
      />

      {/* Shorts for Toddler (Stage 0) & Preschooler (Stage 1) */}
      {stageIndex < 2 && (
        <>
          <rect
            x={centerX - legOffsetX - legWidth / 2 - 1}
            y={hipY - 4}
            width={legWidth + 2}
            height={legH * 0.48}
            rx={4}
            fill={pantsFill}
            stroke={strokeColor}
            strokeWidth={1.6}
          />
          <rect
            x={centerX + legOffsetX - legWidth / 2 - 1}
            y={hipY - 4}
            width={legWidth + 2}
            height={legH * 0.48}
            rx={4}
            fill={pantsFill}
            stroke={strokeColor}
            strokeWidth={1.6}
          />
          {/* Socks */}
          <rect
            x={centerX - legOffsetX - legWidth / 2 + 0.5}
            y={ankleY - legH * 0.22}
            width={legWidth - 1}
            height={legH * 0.24}
            fill="#ffffff"
            stroke={strokeColor}
            strokeWidth={1.2}
          />
          <rect
            x={centerX + legOffsetX - legWidth / 2 + 0.5}
            y={ankleY - legH * 0.22}
            width={legWidth - 1}
            height={legH * 0.24}
            fill="#ffffff"
            stroke={strokeColor}
            strokeWidth={1.2}
          />
        </>
      )}

      {/* Sneakers */}
      <path
        d={`M ${centerX - legOffsetX - legWidth * 0.75} ${floorY}
            L ${centerX - legOffsetX + legWidth * 0.65} ${floorY}
            Q ${centerX - legOffsetX + legWidth * 0.7} ${ankleY - 1} ${centerX - legOffsetX} ${ankleY - 1}
            Q ${centerX - legOffsetX - legWidth * 0.85} ${ankleY} ${centerX - legOffsetX - legWidth * 0.75} ${floorY} Z`}
        fill={shoeFill}
        stroke={strokeColor}
        strokeWidth={1.6}
      />
      <path
        d={`M ${centerX + legOffsetX - legWidth * 0.65} ${floorY}
            L ${centerX + legOffsetX + legWidth * 0.75} ${floorY}
            Q ${centerX + legOffsetX + legWidth * 0.85} ${ankleY} ${centerX + legOffsetX} ${ankleY - 1}
            Q ${centerX + legOffsetX - legWidth * 0.7} ${ankleY - 1} ${centerX + legOffsetX - legWidth * 0.65} ${floorY} Z`}
        fill={shoeFill}
        stroke={strokeColor}
        strokeWidth={1.6}
      />

      {/* Neck */}
      <rect
        x={centerX - headRx * 0.26}
        y={neckTopY}
        width={headRx * 0.52}
        height={torsoTopY - neckTopY + 5}
        rx={4}
        fill={skinFill}
        stroke={strokeColor}
        strokeWidth={1.5}
      />

      {/* Torso Base */}
      <path
        d={`M ${centerX - shoulderHalfW} ${torsoTopY + 8}
            Q ${centerX - shoulderHalfW} ${torsoTopY} ${centerX - shoulderHalfW * 0.55} ${torsoTopY}
            L ${centerX + shoulderHalfW * 0.55} ${torsoTopY}
            Q ${centerX + shoulderHalfW} ${torsoTopY} ${centerX + shoulderHalfW} ${torsoTopY + 8}
            L ${centerX + waistHalfW} ${hipY}
            L ${centerX - waistHalfW} ${hipY} Z`}
        fill={shirtFill}
        stroke={strokeColor}
        strokeWidth={1.7}
      />

      {/* Stage-Specific Outfit Details */}
      {stageIndex === 0 && (
        /* Age 2 Toddler Bib Overalls */
        <g>
          <path
            d={`M ${centerX - waistHalfW * 0.72} ${torsoTopY + torsoH * 0.28}
                L ${centerX + waistHalfW * 0.72} ${torsoTopY + torsoH * 0.28}
                L ${centerX + waistHalfW} ${hipY}
                L ${centerX - waistHalfW} ${hipY} Z`}
            fill={pantsFill}
            stroke={strokeColor}
            strokeWidth={1.5}
          />
          {/* Straps */}
          <line
            x1={centerX - waistHalfW * 0.52}
            y1={torsoTopY + 1}
            x2={centerX - waistHalfW * 0.52}
            y2={torsoTopY + torsoH * 0.34}
            stroke={pantsFill}
            strokeWidth={4.5}
            strokeLinecap="round"
          />
          <line
            x1={centerX + waistHalfW * 0.52}
            y1={torsoTopY + 1}
            x2={centerX + waistHalfW * 0.52}
            y2={torsoTopY + torsoH * 0.34}
            stroke={pantsFill}
            strokeWidth={4.5}
            strokeLinecap="round"
          />
          {/* Overall Buttons */}
          <circle
            cx={centerX - waistHalfW * 0.52}
            cy={torsoTopY + torsoH * 0.34}
            r={2.4}
            fill={shirtSubFill}
            stroke={strokeColor}
            strokeWidth={1}
          />
          <circle
            cx={centerX + waistHalfW * 0.52}
            cy={torsoTopY + torsoH * 0.34}
            r={2.4}
            fill={shirtSubFill}
            stroke={strokeColor}
            strokeWidth={1}
          />
        </g>
      )}

      {stageIndex === 1 && (
        /* Age 3–4 Preschool Explorer Horizontal Stripes */
        <g stroke="none">
          <rect
            x={centerX - waistHalfW * 0.88}
            y={torsoTopY + torsoH * 0.28}
            width={waistHalfW * 1.76}
            height={torsoH * 0.14}
            rx={2}
            fill={shirtSubFill}
          />
          <rect
            x={centerX - waistHalfW * 0.92}
            y={torsoTopY + torsoH * 0.56}
            width={waistHalfW * 1.84}
            height={torsoH * 0.14}
            rx={2}
            fill={shirtSubFill}
          />
        </g>
      )}

      {stageIndex === 2 && (
        /* Age 5–7 Big Kid Star Badge & Collar */
        <g>
          <circle
            cx={centerX}
            cy={torsoTopY + torsoH * 0.45}
            r={Math.max(6, torsoH * 0.15)}
            fill={shirtSubFill}
            stroke={strokeColor}
            strokeWidth={1.2}
          />
          <polygon
            points={`${centerX},${torsoTopY + torsoH * 0.36} ${centerX + 2.5},${torsoTopY + torsoH * 0.43} ${centerX + 5.5},${torsoTopY + torsoH * 0.43} ${centerX + 3},${torsoTopY + torsoH * 0.47} ${centerX + 4},${torsoTopY + torsoH * 0.53} ${centerX},${torsoTopY + torsoH * 0.49} ${centerX - 4},${torsoTopY + torsoH * 0.53} ${centerX - 3},${torsoTopY + torsoH * 0.47} ${centerX - 5.5},${torsoTopY + torsoH * 0.43} ${centerX - 2.5},${torsoTopY + torsoH * 0.43}`}
            fill={shoeFill}
            stroke="none"
          />
        </g>
      )}

      {stageIndex >= 3 && (
        /* Age 8+ Trailblazer Chevron Pullover */
        <path
          d={`M ${centerX - shoulderHalfW * 0.85} ${torsoTopY + torsoH * 0.25}
              L ${centerX} ${torsoTopY + torsoH * 0.48}
              L ${centerX + shoulderHalfW * 0.85} ${torsoTopY + torsoH * 0.25}
              L ${centerX + shoulderHalfW * 0.9} ${torsoTopY + torsoH * 0.4}
              L ${centerX} ${torsoTopY + torsoH * 0.62}
              L ${centerX - shoulderHalfW * 0.9} ${torsoTopY + torsoH * 0.4} Z`}
          fill={shirtSubFill}
          stroke="none"
        />
      )}

      {/* Back Hair Layer (for bob & puffs) */}
      {hairStyle === 'bob' && (
        <path
          d={`M ${centerX - headRx * 1.12} ${headCy - headRy * 0.1}
              Q ${centerX - headRx * 1.18} ${headCy + headRy * 0.95} ${centerX - headRx * 0.7} ${headCy + headRy * 0.95}
              L ${centerX + headRx * 0.7} ${headCy + headRy * 0.95}
              Q ${centerX + headRx * 1.18} ${headCy + headRy * 0.95} ${centerX + headRx * 1.12} ${headCy - headRy * 0.1} Z`}
          fill={hairFill}
          stroke={strokeColor}
          strokeWidth={1.6}
        />
      )}
      {hairStyle === 'puffs' && (
        <>
          <circle
            cx={centerX - headRx * 0.95}
            cy={headCy - headRy * 0.55}
            r={headRx * 0.42}
            fill={hairFill}
            stroke={strokeColor}
            strokeWidth={1.6}
          />
          <circle
            cx={centerX + headRx * 0.95}
            cy={headCy - headRy * 0.55}
            r={headRx * 0.42}
            fill={hairFill}
            stroke={strokeColor}
            strokeWidth={1.6}
          />
        </>
      )}

      {/* Ears */}
      <circle
        cx={centerX - headRx * 0.98}
        cy={headCy + headRy * 0.06}
        r={headRx * 0.18}
        fill={skinFill}
        stroke={strokeColor}
        strokeWidth={1.5}
      />
      <circle
        cx={centerX + headRx * 0.98}
        cy={headCy + headRy * 0.06}
        r={headRx * 0.18}
        fill={skinFill}
        stroke={strokeColor}
        strokeWidth={1.5}
      />

      {/* Head Oval (Top sits cleanly at crownY) */}
      <ellipse
        cx={centerX}
        cy={headCy}
        rx={headRx}
        ry={headRy}
        fill={skinFill}
        stroke={strokeColor}
        strokeWidth={1.8}
      />

      {/* Top Hair Fringe (kept flush at crownY so ruler line matches crownY) */}
      {hairStyle === 'curls' && (
        <path
          d={`M ${centerX - headRx * 0.92} ${headCy - headRy * 0.25}
              Q ${centerX - headRx * 0.6} ${crownY - 2} ${centerX - headRx * 0.15} ${crownY + 3}
              Q ${centerX + headRx * 0.25} ${crownY - 3} ${centerX + headRx * 0.65} ${crownY + 2}
              Q ${centerX + headRx * 0.95} ${headCy - headRy * 0.55} ${centerX + headRx * 0.92} ${headCy - headRy * 0.2}
              Q ${centerX + headRx * 0.45} ${headCy - headRy * 0.48} ${centerX} ${headCy - headRy * 0.42}
              Q ${centerX - headRx * 0.45} ${headCy - headRy * 0.48} ${centerX - headRx * 0.92} ${headCy - headRy * 0.25} Z`}
          fill={hairFill}
          stroke={strokeColor}
          strokeWidth={1.5}
        />
      )}
      {(hairStyle === 'bob' || hairStyle === 'puffs') && (
        <path
          d={`M ${centerX - headRx * 0.94} ${headCy - headRy * 0.2}
              Q ${centerX} ${crownY - 3} ${centerX + headRx * 0.94} ${headCy - headRy * 0.2}
              Q ${centerX + headRx * 0.4} ${headCy - headRy * 0.52} ${centerX} ${headCy - headRy * 0.46}
              Q ${centerX - headRx * 0.4} ${headCy - headRy * 0.52} ${centerX - headRx * 0.94} ${headCy - headRy * 0.2} Z`}
          fill={hairFill}
          stroke={strokeColor}
          strokeWidth={1.5}
        />
      )}
      {hairStyle === 'spiky' && (
        <path
          d={`M ${centerX - headRx * 0.88} ${headCy - headRy * 0.25}
              L ${centerX - headRx * 0.55} ${crownY - 2}
              L ${centerX - headRx * 0.25} ${crownY + 4}
              L ${centerX + headRx * 0.05} ${crownY - 3}
              L ${centerX + headRx * 0.32} ${crownY + 4}
              L ${centerX + headRx * 0.62} ${crownY - 1}
              L ${centerX + headRx * 0.88} ${headCy - headRy * 0.25}
              Q ${centerX} ${headCy - headRy * 0.48} ${centerX - headRx * 0.88} ${headCy - headRy * 0.25} Z`}
          fill={hairFill}
          stroke={strokeColor}
          strokeWidth={1.5}
        />
      )}

      {/* Facial Expression */}
      {/* Eyes */}
      <circle
        cx={centerX - headRx * 0.34}
        cy={headCy - headRy * 0.02}
        r={Math.max(2.3, headRx * 0.11)}
        fill={strokeColor}
        stroke="none"
      />
      <circle
        cx={centerX + headRx * 0.34}
        cy={headCy - headRy * 0.02}
        r={Math.max(2.3, headRx * 0.11)}
        fill={strokeColor}
        stroke="none"
      />
      {!isBaseline && (
        <>
          <circle
            cx={centerX - headRx * 0.31}
            cy={headCy - headRy * 0.06}
            r={Math.max(0.9, headRx * 0.04)}
            fill="#ffffff"
            stroke="none"
          />
          <circle
            cx={centerX + headRx * 0.37}
            cy={headCy - headRy * 0.06}
            r={Math.max(0.9, headRx * 0.04)}
            fill="#ffffff"
            stroke="none"
          />
        </>
      )}

      {/* Rosy Cheeks */}
      <ellipse
        cx={centerX - headRx * 0.54}
        cy={headCy + headRy * 0.18}
        rx={headRx * 0.16}
        ry={headRy * 0.09}
        fill={cheekFill}
        opacity={0.65}
        stroke="none"
      />
      <ellipse
        cx={centerX + headRx * 0.54}
        cy={headCy + headRy * 0.18}
        rx={headRx * 0.16}
        ry={headRy * 0.09}
        fill={cheekFill}
        opacity={0.65}
        stroke="none"
      />

      {/* Joyful Smile */}
      <path
        d={`M ${centerX - headRx * 0.28} ${headCy + headRy * 0.22}
            Q ${centerX} ${headCy + headRy * 0.48} ${centerX + headRx * 0.28} ${headCy + headRy * 0.22}`}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.8}
        strokeLinecap="round"
      />

      {/* Top Head Accessory (Decorative above crownY; baseline always wears tiny sprout) */}
      {(isBaseline || accessoryId === 'sprout') && (
        <g strokeDasharray="none">
          <path
            d={`M ${centerX} ${crownY} Q ${centerX + 1} ${crownY - 10} ${centerX} ${crownY - 14}`}
            fill="none"
            stroke={isBaseline ? '#64748b' : '#15803d'}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <path
            d={`M ${centerX} ${crownY - 11} Q ${centerX - 11} ${crownY - 19} ${centerX - 12} ${crownY - 10} Q ${centerX - 5} ${crownY - 6} ${centerX} ${crownY - 11} Z`}
            fill={isBaseline ? '#cbd5e1' : '#22c55e'}
            stroke={strokeColor}
            strokeWidth={1.3}
          />
          <path
            d={`M ${centerX} ${crownY - 13} Q ${centerX + 11} ${crownY - 21} ${centerX + 12} ${crownY - 12} Q ${centerX + 5} ${crownY - 8} ${centerX} ${crownY - 13} Z`}
            fill={isBaseline ? '#e2e8f0' : '#4ade80'}
            stroke={strokeColor}
            strokeWidth={1.3}
          />
        </g>
      )}

      {!isBaseline && accessoryId === 'cap' && (
        <g>
          <path
            d={`M ${centerX - headRx * 0.85} ${crownY + 4}
                Q ${centerX} ${crownY - 14} ${centerX + headRx * 0.85} ${crownY + 4} Z`}
            fill={palette.shoes}
            stroke={strokeColor}
            strokeWidth={1.5}
          />
          <path
            d={`M ${centerX + headRx * 0.2} ${crownY + 3}
                L ${centerX + headRx * 1.25} ${crownY + 5}
                Q ${centerX + headRx * 0.8} ${crownY + 8} ${centerX - headRx * 0.2} ${crownY + 4} Z`}
            fill={palette.shirtPrimary}
            stroke={strokeColor}
            strokeWidth={1.4}
          />
        </g>
      )}

      {!isBaseline && accessoryId === 'crown' && (
        <polygon
          points={`${centerX - 13},${crownY + 2} ${centerX - 15},${crownY - 11} ${centerX - 6},${crownY - 4} ${centerX},${crownY - 14} ${centerX + 6},${crownY - 4} ${centerX + 15},${crownY - 11} ${centerX + 13},${crownY + 2}`}
          fill="#fbbf24"
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      )}

      {!isBaseline && accessoryId === 'dino' && (
        <g>
          <polygon
            points={`${centerX - 10},${crownY + 2} ${centerX - 5},${crownY - 9} ${centerX - 1},${crownY + 1}`}
            fill="#10b981"
            stroke={strokeColor}
            strokeWidth={1.4}
          />
          <polygon
            points={`${centerX - 1},${crownY + 1} ${centerX + 4},${crownY - 11} ${centerX + 9},${crownY + 1}`}
            fill="#34d399"
            stroke={strokeColor}
            strokeWidth={1.4}
          />
          <polygon
            points={`${centerX + 9},${crownY + 2} ${centerX + 14},${crownY - 7} ${centerX + 17},${crownY + 3}`}
            fill="#10b981"
            stroke={strokeColor}
            strokeWidth={1.4}
          />
        </g>
      )}
    </g>
  );
};
