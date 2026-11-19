import React from 'react';
import {
  AccessoryId,
  CHARACTER_PALETTES,
  clampNumber,
  HairStyle,
  PaletteId,
  sanitizeHexColor,
} from '../types';
import { useDefaultAppAvatar } from '../services/defaultAvatarService';

export interface CharacterFigureGroupProps {
  instanceId: string;
  centerX: number;
  floorY: number;
  crownY: number;
  ageMonths: number;
  heightCm: number;
  weightKg: number;
  paletteId: PaletteId;
  accessoryId: AccessoryId;
  hairStyle: HairStyle;
  skinTone?: string;
  hairColor?: string;
  avatarPhotoUrl?: string | null;
  mode: 'age-two-baseline' | 'current';
  isWaveActive?: boolean;
}

function adjustHexBrightness(hex: string, amount: number): string {
  const clean = sanitizeHexColor(hex, '#f4c9a8').replace('#', '');
  const r = clampNumber((parseInt(clean.slice(0, 2), 16) || 240) + amount, 0, 255);
  const g = clampNumber((parseInt(clean.slice(2, 4), 16) || 200) + amount, 0, 255);
  const b = clampNumber((parseInt(clean.slice(4, 6), 16) || 168) + amount, 0, 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`;
}

/**
 * Renders the growing child avatar anchored cleanly between `crownY` (exact top of head
 * aligned with the height ruler) and `floorY` (exact feet/sole on the floor/scale).
 * Defaults to the illustrated SproutScale boy avatar, and seamlessly supports a parent's
 * custom cropped child photo portrait (`avatarPhotoUrl`).
 */
export const CharacterFigureGroup: React.FC<CharacterFigureGroupProps> = ({
  instanceId,
  centerX,
  floorY,
  crownY,
  ageMonths,
  heightCm,
  weightKg,
  paletteId,
  accessoryId,
  hairStyle,
  skinTone,
  hairColor,
  avatarPhotoUrl,
  mode,
  isWaveActive = false,
}) => {
  const defaultAppAvatar = useDefaultAppAvatar();
  const palette = CHARACTER_PALETTES[paletteId] ?? CHARACTER_PALETTES.meadow;
  const isBaseline = mode === 'age-two-baseline';
  const hasPhoto = Boolean(avatarPhotoUrl && avatarPhotoUrl.length > 0);

  const totalHeight = Math.max(82, floorY - crownY);

  // Developmental maturity factor: 0.0 at Age 2 (24 mos) -> 1.0 at Age 11 (132 mos)
  const maturity = clampNumber((ageMonths - 24) / 108, 0, 1);

  // Body-positive build factor gently reflecting weight relative to height
  const heightMeters = Math.max(0.65, heightCm / 100);
  const bmi = weightKg / (heightMeters * heightMeters);
  const buildFactor = clampNumber(1 + (bmi - 16) * 0.022, 0.9, 1.16);

  // Default App Avatar: Full-body illustrated SproutScale boy anchored crownY -> floorY
  if (!hasPhoto) {
    const gentleWidthFactor = clampNumber(
      1 + (bmi - 16) * 0.014 + (isBaseline ? 0.04 : -maturity * 0.03),
      0.93,
      1.08,
    );
    const figHeight = totalHeight;
    const figWidth = figHeight * defaultAppAvatar.aspectRatio * gentleWidthFactor;
    const figX = centerX - figWidth / 2;
    const figY = crownY;
    const headRxEst = figWidth * 0.34;
    const strokeColor = '#1e293b';

    return (
      <g opacity={isBaseline ? 0.92 : 1}>
        {/* Soft natural floor shadow beneath bare feet */}
        <ellipse
          cx={centerX}
          cy={floorY + 2}
          rx={Math.max(18, figWidth * 0.34)}
          ry={4.5}
          fill="#0f172a"
          opacity={isBaseline ? 0.13 : 0.19}
        />

        {/* Illustrated SproutScale Boy Full-Body Avatar */}
        <image
          href={defaultAppAvatar.fullBodyUrl}
          x={figX}
          y={figY}
          width={figWidth}
          height={figHeight}
          preserveAspectRatio="none"
        />

        {/* Optional playful head accessory on active figure (keeps sprout emblem clean on shirt) */}
        {!isBaseline && accessoryId === 'cap' && (
          <g>
            <path
              d={`M ${centerX - headRxEst * 0.88} ${crownY + 6}
                  Q ${centerX} ${crownY - 12} ${centerX + headRxEst * 0.88} ${crownY + 6} Z`}
              fill={palette.shoes}
              stroke={strokeColor}
              strokeWidth={1.45}
            />
            <path
              d={`M ${centerX + headRxEst * 0.18} ${crownY + 5}
                  L ${centerX + headRxEst * 1.24} ${crownY + 7}
                  Q ${centerX + headRxEst * 0.8} ${crownY + 10} ${centerX - headRxEst * 0.2} ${crownY + 6} Z`}
              fill={palette.shirtPrimary}
              stroke={strokeColor}
              strokeWidth={1.35}
            />
          </g>
        )}

        {!isBaseline && accessoryId === 'crown' && (
          <polygon
            points={`${centerX - 13},${crownY + 4} ${centerX - 15},${crownY - 9} ${centerX - 6},${crownY - 2} ${centerX},${crownY - 12} ${centerX + 6},${crownY - 2} ${centerX + 15},${crownY - 9} ${centerX + 13},${crownY + 4}`}
            fill="#fbbf24"
            stroke={strokeColor}
            strokeWidth={1.45}
            strokeLinejoin="round"
          />
        )}

        {!isBaseline && accessoryId === 'dino' && (
          <g>
            <polygon
              points={`${centerX - 10},${crownY + 4} ${centerX - 5},${crownY - 7} ${centerX - 1},${crownY + 3}`}
              fill="#10b981"
              stroke={strokeColor}
              strokeWidth={1.35}
            />
            <polygon
              points={`${centerX - 1},${crownY + 3} ${centerX + 4},${crownY - 9} ${centerX + 9},${crownY + 3}`}
              fill="#34d399"
              stroke={strokeColor}
              strokeWidth={1.35}
            />
            <polygon
              points={`${centerX + 9},${crownY + 4} ${centerX + 14},${crownY - 5} ${centerX + 17},${crownY + 5}`}
              fill="#10b981"
              stroke={strokeColor}
              strokeWidth={1.35}
            />
          </g>
        )}
      </g>
    );
  }

  // Realistic pediatric proportions shifting smoothly from Toddler (Age 2) to Big Kid:
  const headRatio = 0.255 - maturity * 0.085;
  const neckRatio = 0.028 + maturity * 0.01;
  const torsoRatio = 0.345 - maturity * 0.025;

  const headH = totalHeight * headRatio;
  const headRx =
    headH * 0.485 * (1 + (1 - maturity) * 0.045) * clampNumber(buildFactor, 0.96, 1.06);
  const headRy = headH * 0.5;
  const headCy = crownY + headRy;

  const neckTopY = crownY + headH - 3;
  const torsoTopY = neckTopY + totalHeight * neckRatio;
  const torsoH = totalHeight * torsoRatio;
  const hipY = torsoTopY + torsoH;

  const shoulderHalfW = Math.max(15.5, totalHeight * (0.116 + maturity * 0.02) * buildFactor);
  const waistHalfW = Math.max(14, totalHeight * (0.106 - maturity * 0.005) * buildFactor);

  const shoeH = Math.max(9, totalHeight * 0.056);
  const ankleY = floorY - shoeH;
  const legH = Math.max(16, ankleY - hipY);
  const legOffsetX = waistHalfW * 0.48;
  const legWidth = Math.max(8.5, waistHalfW * 0.45);

  // Natural complexion & hair colors (used on both Age 2 and Current for realistic appearance)
  const baseSkin = sanitizeHexColor(skinTone, palette.skin);
  const skinHighlight = adjustHexBrightness(baseSkin, 14);
  const skinShadow = adjustHexBrightness(baseSkin, -22);
  const skinLine = adjustHexBrightness(baseSkin, -58);

  const baseHair = sanitizeHexColor(hairColor, palette.hair);
  const hairHighlight = adjustHexBrightness(baseHair, 32);

  const shirtFill = isBaseline ? '#38bdf8' : palette.shirtPrimary;
  const shirtShadow = adjustHexBrightness(shirtFill, -22);
  const shirtSubFill = isBaseline ? '#fef08a' : palette.shirtSecondary;
  const pantsFill = isBaseline ? '#1d4ed8' : palette.overalls;
  const pantsShadow = adjustHexBrightness(pantsFill, -24);
  const shoeFill = isBaseline ? '#f97316' : palette.shoes;
  const strokeColor = '#1e293b';

  const stageIndex =
    ageMonths < 36 ? 0 : ageMonths < 60 ? 1 : ageMonths < 96 ? 2 : 3;

  // Arm geometry
  const armLen = torsoH * 0.9;
  const armWidth = Math.max(7, legWidth * 0.74);
  const leftShoulderX = centerX - shoulderHalfW + 3;
  const rightShoulderX = centerX + shoulderHalfW - 3;
  const shoulderY = torsoTopY + 7;

  const skinGradId = `skinGrad_${instanceId}`;
  const shirtGradId = `shirtGrad_${instanceId}`;
  const pantsGradId = `pantsGrad_${instanceId}`;
  const headClipId = `headClip_${instanceId}`;

  const effectiveAccessory: AccessoryId = isBaseline
    ? hasPhoto && accessoryId === 'none'
      ? 'none'
      : 'sprout'
    : accessoryId;

  const leftLegX = centerX - legOffsetX;
  const rightLegX = centerX + legOffsetX;

  return (
    <g opacity={isBaseline ? 0.92 : 1}>
      <defs>
        <radialGradient id={skinGradId} cx="42%" cy="35%" r="68%">
          <stop offset="0%" stopColor={skinHighlight} />
          <stop offset="72%" stopColor={baseSkin} />
          <stop offset="100%" stopColor={skinShadow} />
        </radialGradient>
        <linearGradient id={shirtGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={shirtFill} />
          <stop offset="100%" stopColor={shirtShadow} />
        </linearGradient>
        <linearGradient id={pantsGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={pantsFill} />
          <stop offset="100%" stopColor={pantsShadow} />
        </linearGradient>
        <clipPath id={headClipId}>
          <ellipse cx={centerX} cy={headCy} rx={headRx} ry={headRy} />
        </clipPath>
      </defs>

      {/* Soft natural floor shadow */}
      <ellipse
        cx={centerX}
        cy={floorY + 2}
        rx={waistHalfW * 1.28}
        ry={4.5}
        fill="#0f172a"
        opacity={isBaseline ? 0.12 : 0.17}
      />

      {/* Left Arm with contoured forearm & hand */}
      <g transform={`rotate(${isBaseline ? 13 : 16}, ${leftShoulderX}, ${shoulderY})`}>
        <path
          d={`M ${leftShoulderX - armWidth * 0.95} ${shoulderY + 3}
              Q ${leftShoulderX - armWidth * 0.5} ${shoulderY - 2} ${leftShoulderX} ${shoulderY + 3}
              L ${leftShoulderX - armWidth * 0.12} ${shoulderY + armLen * 0.88}
              Q ${leftShoulderX - armWidth * 0.48} ${shoulderY + armLen * 0.95} ${leftShoulderX - armWidth * 0.84} ${shoulderY + armLen * 0.88} Z`}
          fill={`url(#${skinGradId})`}
          stroke={strokeColor}
          strokeWidth={1.35}
        />
        {/* Sculpted Left Hand & Thumb */}
        <ellipse
          cx={leftShoulderX - armWidth * 0.48}
          cy={shoulderY + armLen * 0.93}
          rx={armWidth * 0.44}
          ry={armWidth * 0.5}
          fill={`url(#${skinGradId})`}
          stroke={strokeColor}
          strokeWidth={1.25}
        />
        <circle
          cx={leftShoulderX - armWidth * 0.08}
          cy={shoulderY + armLen * 0.89}
          r={armWidth * 0.18}
          fill={baseSkin}
          stroke={strokeColor}
          strokeWidth={1.1}
        />
        {/* Tailored Sleeve */}
        <path
          d={`M ${leftShoulderX - armWidth - 0.8} ${shoulderY + 2}
              Q ${leftShoulderX - armWidth * 0.5} ${shoulderY - 3} ${leftShoulderX + 0.8} ${shoulderY + 2}
              L ${leftShoulderX - 0.2} ${shoulderY + armLen * 0.42}
              L ${leftShoulderX - armWidth} ${shoulderY + armLen * 0.42} Z`}
          fill={`url(#${shirtGradId})`}
          stroke={strokeColor}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </g>

      {/* Right Arm — friendly wave when active */}
      <g
        transform={
          !isBaseline && (isWaveActive || stageIndex >= 1)
            ? `rotate(-128, ${rightShoulderX}, ${shoulderY})`
            : `rotate(-15, ${rightShoulderX}, ${shoulderY})`
        }
      >
        <path
          d={`M ${rightShoulderX} ${shoulderY + 3}
              Q ${rightShoulderX + armWidth * 0.5} ${shoulderY - 2} ${rightShoulderX + armWidth * 0.95} ${shoulderY + 3}
              L ${rightShoulderX + armWidth * 0.84} ${shoulderY + armLen * 0.88}
              Q ${rightShoulderX + armWidth * 0.48} ${shoulderY + armLen * 0.95} ${rightShoulderX + armWidth * 0.12} ${shoulderY + armLen * 0.88} Z`}
          fill={`url(#${skinGradId})`}
          stroke={strokeColor}
          strokeWidth={1.35}
        />
        {/* Sculpted Right Hand & Thumb */}
        <ellipse
          cx={rightShoulderX + armWidth * 0.48}
          cy={shoulderY + armLen * 0.93}
          rx={armWidth * 0.44}
          ry={armWidth * 0.5}
          fill={`url(#${skinGradId})`}
          stroke={strokeColor}
          strokeWidth={1.25}
        />
        <circle
          cx={rightShoulderX + armWidth * 0.08}
          cy={shoulderY + armLen * 0.89}
          r={armWidth * 0.18}
          fill={baseSkin}
          stroke={strokeColor}
          strokeWidth={1.1}
        />
        {/* Tailored Right Sleeve */}
        <path
          d={`M ${rightShoulderX - 0.8} ${shoulderY + 2}
              Q ${rightShoulderX + armWidth * 0.5} ${shoulderY - 3} ${rightShoulderX + armWidth + 0.8} ${shoulderY + 2}
              L ${rightShoulderX + armWidth} ${shoulderY + armLen * 0.42}
              L ${rightShoulderX + 0.2} ${shoulderY + armLen * 0.42} Z`}
          fill={`url(#${shirtGradId})`}
          stroke={strokeColor}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </g>

      {/* Anatomically Tapered Legs */}
      <path
        d={`M ${leftLegX - legWidth * 0.52} ${hipY - 3}
            L ${leftLegX + legWidth * 0.52} ${hipY - 3}
            L ${leftLegX + legWidth * 0.42} ${ankleY + 2}
            L ${leftLegX - legWidth * 0.42} ${ankleY + 2} Z`}
        fill={stageIndex >= 2 ? `url(#${pantsGradId})` : `url(#${skinGradId})`}
        stroke={strokeColor}
        strokeWidth={1.45}
      />
      <path
        d={`M ${rightLegX - legWidth * 0.52} ${hipY - 3}
            L ${rightLegX + legWidth * 0.52} ${hipY - 3}
            L ${rightLegX + legWidth * 0.42} ${ankleY + 2}
            L ${rightLegX - legWidth * 0.42} ${ankleY + 2} Z`}
        fill={stageIndex >= 2 ? `url(#${pantsGradId})` : `url(#${skinGradId})`}
        stroke={strokeColor}
        strokeWidth={1.45}
      />

      {/* Pants Cuff Details for Big Kid (Stage 2+) */}
      {stageIndex >= 2 && (
        <g>
          <rect
            x={leftLegX - legWidth * 0.46}
            y={ankleY - 4}
            width={legWidth * 0.92}
            height={5}
            rx={2}
            fill={pantsShadow}
            stroke={strokeColor}
            strokeWidth={1.1}
          />
          <rect
            x={rightLegX - legWidth * 0.46}
            y={ankleY - 4}
            width={legWidth * 0.92}
            height={5}
            rx={2}
            fill={pantsShadow}
            stroke={strokeColor}
            strokeWidth={1.1}
          />
        </g>
      )}

      {/* Tailored Shorts & Striped Crew Socks for Toddler & Preschooler */}
      {stageIndex < 2 && (
        <>
          {/* Pelvis / Shorts Bridge */}
          <path
            d={`M ${centerX - waistHalfW} ${hipY - 5}
                L ${centerX + waistHalfW} ${hipY - 5}
                L ${rightLegX + legWidth * 0.58} ${hipY + legH * 0.46}
                L ${rightLegX - legWidth * 0.54} ${hipY + legH * 0.46}
                L ${centerX} ${hipY + legH * 0.22}
                L ${leftLegX + legWidth * 0.54} ${hipY + legH * 0.46}
                L ${leftLegX - legWidth * 0.58} ${hipY + legH * 0.46} Z`}
            fill={`url(#${pantsGradId})`}
            stroke={strokeColor}
            strokeWidth={1.45}
            strokeLinejoin="round"
          />
          {/* Subtle knee dimples */}
          <path
            d={`M ${leftLegX - 2.2} ${hipY + legH * 0.6} Q ${leftLegX} ${hipY + legH * 0.63} ${leftLegX + 2.2} ${hipY + legH * 0.6}`}
            fill="none"
            stroke={skinLine}
            strokeWidth={1}
            opacity={0.45}
            strokeLinecap="round"
          />
          <path
            d={`M ${rightLegX - 2.2} ${hipY + legH * 0.6} Q ${rightLegX} ${hipY + legH * 0.63} ${rightLegX + 2.2} ${hipY + legH * 0.6}`}
            fill="none"
            stroke={skinLine}
            strokeWidth={1}
            opacity={0.45}
            strokeLinecap="round"
          />
          {/* Ribbed Athletic Socks with Stripe */}
          <rect
            x={leftLegX - legWidth * 0.43}
            y={ankleY - legH * 0.24}
            width={legWidth * 0.86}
            height={legH * 0.26}
            rx={1.5}
            fill="#ffffff"
            stroke={strokeColor}
            strokeWidth={1.2}
          />
          <line
            x1={leftLegX - legWidth * 0.4}
            y1={ankleY - legH * 0.19}
            x2={leftLegX + legWidth * 0.4}
            y2={ankleY - legH * 0.19}
            stroke={shoeFill}
            strokeWidth={1.8}
          />
          <rect
            x={rightLegX - legWidth * 0.43}
            y={ankleY - legH * 0.24}
            width={legWidth * 0.86}
            height={legH * 0.26}
            rx={1.5}
            fill="#ffffff"
            stroke={strokeColor}
            strokeWidth={1.2}
          />
          <line
            x1={rightLegX - legWidth * 0.4}
            y1={ankleY - legH * 0.19}
            x2={rightLegX + legWidth * 0.4}
            y2={ankleY - legH * 0.19}
            stroke={shoeFill}
            strokeWidth={1.8}
          />
        </>
      )}

      {/* Detailed Sneakers with White Rubber Soles & Laces */}
      {/* Left Sneaker */}
      <g>
        <path
          d={`M ${leftLegX - legWidth * 0.82} ${floorY - 3}
              Q ${leftLegX - legWidth * 0.8} ${ankleY - 1} ${leftLegX - legWidth * 0.05} ${ankleY - 1}
              Q ${leftLegX + legWidth * 0.62} ${ankleY - 1} ${leftLegX + legWidth * 0.64} ${floorY - 3} Z`}
          fill={shoeFill}
          stroke={strokeColor}
          strokeWidth={1.4}
        />
        <rect
          x={leftLegX - legWidth * 0.86}
          y={floorY - 3.4}
          width={legWidth * 1.54}
          height={3.4}
          rx={1.6}
          fill="#ffffff"
          stroke={strokeColor}
          strokeWidth={1.2}
        />
        <line
          x1={leftLegX - legWidth * 0.35}
          y1={ankleY + 2}
          x2={leftLegX - legWidth * 0.1}
          y2={ankleY + 2}
          stroke="#ffffff"
          strokeWidth={1.3}
          strokeLinecap="round"
        />
      </g>

      {/* Right Sneaker */}
      <g>
        <path
          d={`M ${rightLegX - legWidth * 0.64} ${floorY - 3}
              Q ${rightLegX - legWidth * 0.62} ${ankleY - 1} ${rightLegX + legWidth * 0.05} ${ankleY - 1}
              Q ${rightLegX + legWidth * 0.8} ${ankleY - 1} ${rightLegX + legWidth * 0.82} ${floorY - 3} Z`}
          fill={shoeFill}
          stroke={strokeColor}
          strokeWidth={1.4}
        />
        <rect
          x={rightLegX - legWidth * 0.68}
          y={floorY - 3.4}
          width={legWidth * 1.54}
          height={3.4}
          rx={1.6}
          fill="#ffffff"
          stroke={strokeColor}
          strokeWidth={1.2}
        />
        <line
          x1={rightLegX + legWidth * 0.1}
          y1={ankleY + 2}
          x2={rightLegX + legWidth * 0.35}
          y2={ankleY + 2}
          stroke="#ffffff"
          strokeWidth={1.3}
          strokeLinecap="round"
        />
      </g>

      {/* Neck with subtle chin shadow */}
      <rect
        x={centerX - headRx * 0.25}
        y={neckTopY}
        width={headRx * 0.5}
        height={torsoTopY - neckTopY + 6}
        rx={4}
        fill={`url(#${skinGradId})`}
        stroke={strokeColor}
        strokeWidth={1.35}
      />
      <ellipse
        cx={centerX}
        cy={neckTopY + 3}
        rx={headRx * 0.23}
        ry={2.5}
        fill={skinShadow}
        opacity={0.55}
      />

      {/* Contoured Torso & Crewneck Collar */}
      <path
        d={`M ${centerX - shoulderHalfW} ${torsoTopY + 9}
            Q ${centerX - shoulderHalfW} ${torsoTopY} ${centerX - shoulderHalfW * 0.5} ${torsoTopY}
            L ${centerX + shoulderHalfW * 0.5} ${torsoTopY}
            Q ${centerX + shoulderHalfW} ${torsoTopY} ${centerX + shoulderHalfW} ${torsoTopY + 9}
            L ${centerX + waistHalfW} ${hipY}
            L ${centerX - waistHalfW} ${hipY} Z`}
        fill={`url(#${shirtGradId})`}
        stroke={strokeColor}
        strokeWidth={1.55}
      />
      {/* Crewneck Ribbed Collar */}
      <path
        d={`M ${centerX - headRx * 0.34} ${torsoTopY + 0.5}
            Q ${centerX} ${torsoTopY + 7.5} ${centerX + headRx * 0.34} ${torsoTopY + 0.5}`}
        fill="none"
        stroke={shirtSubFill}
        strokeWidth={2.4}
        strokeLinecap="round"
      />

      {/* Stage-Specific Realistic Outfit Details */}
      {stageIndex === 0 && (
        /* Toddler Denim Bib Overalls with Chest Pocket & Brass Buttons */
        <g>
          <path
            d={`M ${centerX - waistHalfW * 0.72} ${torsoTopY + torsoH * 0.28}
                L ${centerX + waistHalfW * 0.72} ${torsoTopY + torsoH * 0.28}
                L ${centerX + waistHalfW} ${hipY}
                L ${centerX - waistHalfW} ${hipY} Z`}
            fill={`url(#${pantsGradId})`}
            stroke={strokeColor}
            strokeWidth={1.4}
          />
          {/* Front Bib Pocket */}
          <path
            d={`M ${centerX - waistHalfW * 0.34} ${torsoTopY + torsoH * 0.44}
                L ${centerX + waistHalfW * 0.34} ${torsoTopY + torsoH * 0.44}
                L ${centerX + waistHalfW * 0.3} ${torsoTopY + torsoH * 0.68}
                Q ${centerX} ${torsoTopY + torsoH * 0.74} ${centerX - waistHalfW * 0.3} ${torsoTopY + torsoH * 0.68} Z`}
            fill={pantsShadow}
            stroke="#93c5fd"
            strokeWidth={1}
          />
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
          <circle
            cx={centerX - waistHalfW * 0.52}
            cy={torsoTopY + torsoH * 0.34}
            r={2.3}
            fill="#fbbf24"
            stroke={strokeColor}
            strokeWidth={0.9}
          />
          <circle
            cx={centerX + waistHalfW * 0.52}
            cy={torsoTopY + torsoH * 0.34}
            r={2.3}
            fill="#fbbf24"
            stroke={strokeColor}
            strokeWidth={0.9}
          />
        </g>
      )}

      {stageIndex === 1 && (
        /* Preschool Explorer Woven Stripes */
        <g>
          <rect
            x={centerX - waistHalfW * 0.88}
            y={torsoTopY + torsoH * 0.3}
            width={waistHalfW * 1.76}
            height={torsoH * 0.13}
            rx={2}
            fill={shirtSubFill}
          />
          <rect
            x={centerX - waistHalfW * 0.92}
            y={torsoTopY + torsoH * 0.57}
            width={waistHalfW * 1.84}
            height={torsoH * 0.13}
            rx={2}
            fill={shirtSubFill}
          />
        </g>
      )}

      {stageIndex === 2 && (
        /* Big Kid Varsity Patch & Hem Trim */
        <g>
          <circle
            cx={centerX + waistHalfW * 0.34}
            cy={torsoTopY + torsoH * 0.36}
            r={Math.max(5.2, torsoH * 0.12)}
            fill={shirtSubFill}
            stroke={strokeColor}
            strokeWidth={1.1}
          />
          <rect
            x={centerX - waistHalfW}
            y={hipY - 5}
            width={waistHalfW * 2}
            height={5}
            rx={1.5}
            fill={shirtSubFill}
            stroke={strokeColor}
            strokeWidth={1.1}
          />
        </g>
      )}

      {stageIndex >= 3 && (
        /* Trailblazer Sporty Pullover Chevron & Pocket Seam */
        <g>
          <path
            d={`M ${centerX - shoulderHalfW * 0.84} ${torsoTopY + torsoH * 0.24}
                L ${centerX} ${torsoTopY + torsoH * 0.46}
                L ${centerX + shoulderHalfW * 0.84} ${torsoTopY + torsoH * 0.24}
                L ${centerX + shoulderHalfW * 0.88} ${torsoTopY + torsoH * 0.38}
                L ${centerX} ${torsoTopY + torsoH * 0.6}
                L ${centerX - shoulderHalfW * 0.88} ${torsoTopY + torsoH * 0.38} Z`}
            fill={shirtSubFill}
          />
        </g>
      )}

      {/* Back Hair Layer (rendered when no photo is used so real photo hair isn't distorted, or subtle framing) */}
      {!hasPhoto && hairStyle === 'bob' && (
        <path
          d={`M ${centerX - headRx * 1.12} ${headCy - headRy * 0.12}
              Q ${centerX - headRx * 1.2} ${headCy + headRy * 0.96} ${centerX - headRx * 0.72} ${headCy + headRy * 0.96}
              L ${centerX + headRx * 0.72} ${headCy + headRy * 0.96}
              Q ${centerX + headRx * 1.2} ${headCy + headRy * 0.96} ${centerX + headRx * 1.12} ${headCy - headRy * 0.12} Z`}
          fill={baseHair}
          stroke={strokeColor}
          strokeWidth={1.45}
        />
      )}
      {!hasPhoto && hairStyle === 'puffs' && (
        <>
          <circle
            cx={centerX - headRx * 0.96}
            cy={headCy - headRy * 0.54}
            r={headRx * 0.42}
            fill={baseHair}
            stroke={strokeColor}
            strokeWidth={1.45}
          />
          <circle
            cx={centerX + headRx * 0.96}
            cy={headCy - headRy * 0.54}
            r={headRx * 0.42}
            fill={baseHair}
            stroke={strokeColor}
            strokeWidth={1.45}
          />
        </>
      )}

      {/* Natural Ears with Inner Helix */}
      <g>
        <ellipse
          cx={centerX - headRx * 0.98}
          cy={headCy + headRy * 0.05}
          rx={headRx * 0.16}
          ry={headRy * 0.2}
          fill={`url(#${skinGradId})`}
          stroke={strokeColor}
          strokeWidth={1.3}
        />
        <path
          d={`M ${centerX - headRx * 1.02} ${headCy - headRy * 0.02} Q ${centerX - headRx * 0.95} ${headCy + headRy * 0.05} ${centerX - headRx * 1.0} ${headCy + headRy * 0.12}`}
          fill="none"
          stroke={skinLine}
          strokeWidth={0.9}
          strokeLinecap="round"
        />
        <ellipse
          cx={centerX + headRx * 0.98}
          cy={headCy + headRy * 0.05}
          rx={headRx * 0.16}
          ry={headRy * 0.2}
          fill={`url(#${skinGradId})`}
          stroke={strokeColor}
          strokeWidth={1.3}
        />
        <path
          d={`M ${centerX + headRx * 1.02} ${headCy - headRy * 0.02} Q ${centerX + headRx * 0.95} ${headCy + headRy * 0.05} ${centerX + headRx * 1.0} ${headCy + headRy * 0.12}`}
          fill="none"
          stroke={skinLine}
          strokeWidth={0.9}
          strokeLinecap="round"
        />
      </g>

      {/* HEAD: Either Real Cropped Child Photo Portrait OR Detailed Shaded Portrait */}
      {hasPhoto && avatarPhotoUrl ? (
        <g>
          <ellipse
            cx={centerX}
            cy={headCy}
            rx={headRx}
            ry={headRy}
            fill={`url(#${skinGradId})`}
          />
          <image
            href={avatarPhotoUrl}
            x={centerX - headRx * 1.04}
            y={headCy - headRy * 1.04}
            width={headRx * 2.08}
            height={headRy * 2.08}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${headClipId})`}
          />
          {/* Subtle 3D portrait rim shading so the real photo blends naturally onto the neck & body */}
          <ellipse
            cx={centerX}
            cy={headCy}
            rx={headRx}
            ry={headRy}
            fill="none"
            stroke={isBaseline ? '#0284c7' : strokeColor}
            strokeWidth={isBaseline ? 2 : 1.7}
          />
          <ellipse
            cx={centerX}
            cy={headCy}
            rx={Math.max(1, headRx - 1.4)}
            ry={Math.max(1, headRy - 1.4)}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.42}
            strokeWidth={1.1}
          />
        </g>
      ) : (
        <g>
          {/* Shaded Anatomical Head Oval */}
          <ellipse
            cx={centerX}
            cy={headCy}
            rx={headRx}
            ry={headRy}
            fill={`url(#${skinGradId})`}
            stroke={strokeColor}
            strokeWidth={1.6}
          />

          {/* Layered Natural Hair with Highlight Strands */}
          {hairStyle === 'curls' && (
            <g>
              <path
                d={`M ${centerX - headRx * 0.95} ${headCy - headRy * 0.22}
                    Q ${centerX - headRx * 0.65} ${crownY - 3} ${centerX - headRx * 0.15} ${crownY + 2}
                    Q ${centerX + headRx * 0.25} ${crownY - 4} ${centerX + headRx * 0.68} ${crownY + 1.5}
                    Q ${centerX + headRx * 0.98} ${headCy - headRy * 0.56} ${centerX + headRx * 0.95} ${headCy - headRy * 0.18}
                    Q ${centerX + headRx * 0.45} ${headCy - headRy * 0.5} ${centerX} ${headCy - headRy * 0.43}
                    Q ${centerX - headRx * 0.45} ${headCy - headRy * 0.5} ${centerX - headRx * 0.95} ${headCy - headRy * 0.22} Z`}
                fill={baseHair}
                stroke={strokeColor}
                strokeWidth={1.4}
              />
              <path
                d={`M ${centerX - headRx * 0.52} ${crownY + 4} Q ${centerX - headRx * 0.2} ${crownY + 1} ${centerX + headRx * 0.28} ${crownY + 4}`}
                fill="none"
                stroke={hairHighlight}
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={0.65}
              />
            </g>
          )}
          {(hairStyle === 'bob' || hairStyle === 'puffs') && (
            <g>
              <path
                d={`M ${centerX - headRx * 0.96} ${headCy - headRy * 0.18}
                    Q ${centerX} ${crownY - 3.5} ${centerX + headRx * 0.96} ${headCy - headRy * 0.18}
                    Q ${centerX + headRx * 0.42} ${headCy - headRy * 0.54} ${centerX} ${headCy - headRy * 0.47}
                    Q ${centerX - headRx * 0.42} ${headCy - headRy * 0.54} ${centerX - headRx * 0.96} ${headCy - headRy * 0.18} Z`}
                fill={baseHair}
                stroke={strokeColor}
                strokeWidth={1.4}
              />
              <path
                d={`M ${centerX - headRx * 0.48} ${crownY + 4.5} Q ${centerX} ${crownY + 1} ${centerX + headRx * 0.48} ${crownY + 4.5}`}
                fill="none"
                stroke={hairHighlight}
                strokeWidth={1.4}
                strokeLinecap="round"
                opacity={0.6}
              />
            </g>
          )}
          {hairStyle === 'spiky' && (
            <path
              d={`M ${centerX - headRx * 0.9} ${headCy - headRy * 0.24}
                  L ${centerX - headRx * 0.56} ${crownY - 2.5}
                  L ${centerX - headRx * 0.25} ${crownY + 3.5}
                  L ${centerX + headRx * 0.05} ${crownY - 3.5}
                  L ${centerX + headRx * 0.32} ${crownY + 3.5}
                  L ${centerX + headRx * 0.62} ${crownY - 1.5}
                  L ${centerX + headRx * 0.9} ${headCy - headRy * 0.24}
                  Q ${centerX} ${headCy - headRy * 0.49} ${centerX - headRx * 0.9} ${headCy - headRy * 0.24} Z`}
              fill={baseHair}
              stroke={strokeColor}
              strokeWidth={1.4}
            />
          )}

          {/* Soft Natural Eyebrows */}
          <path
            d={`M ${centerX - headRx * 0.5} ${headCy - headRy * 0.2}
                Q ${centerX - headRx * 0.34} ${headCy - headRy * 0.28} ${centerX - headRx * 0.18} ${headCy - headRy * 0.21}`}
            fill="none"
            stroke={baseHair}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <path
            d={`M ${centerX + headRx * 0.18} ${headCy - headRy * 0.21}
                Q ${centerX + headRx * 0.34} ${headCy - headRy * 0.28} ${centerX + headRx * 0.5} ${headCy - headRy * 0.2}`}
            fill="none"
            stroke={baseHair}
            strokeWidth={1.5}
            strokeLinecap="round"
          />

          {/* Lifelike Expressive Eyes (Sclera + Iris + Pupil + Catchlight + Upper Lash) */}
          {[-1, 1].map((dir) => {
            const eyeX = centerX + dir * headRx * 0.34;
            const eyeY = headCy - headRy * 0.02;
            const eyeRx = Math.max(3.4, headRx * 0.165);
            const eyeRy = Math.max(2.9, headRy * 0.135);
            const irisR = Math.max(2.1, headRx * 0.105);
            return (
              <g key={`eye_${dir}`}>
                <ellipse
                  cx={eyeX}
                  cy={eyeY}
                  rx={eyeRx}
                  ry={eyeRy}
                  fill="#ffffff"
                  stroke={strokeColor}
                  strokeWidth={1.05}
                />
                <circle cx={eyeX} cy={eyeY + 0.2} r={irisR} fill="#4b3621" />
                <circle cx={eyeX} cy={eyeY + 0.2} r={irisR * 0.54} fill="#0f172a" />
                <circle
                  cx={eyeX - irisR * 0.32}
                  cy={eyeY - irisR * 0.32}
                  r={Math.max(0.85, irisR * 0.32)}
                  fill="#ffffff"
                />
                <path
                  d={`M ${eyeX - eyeRx} ${eyeY - 0.3} Q ${eyeX} ${eyeY - eyeRy * 1.15} ${eyeX + eyeRx} ${eyeY - 0.3}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={1.35}
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* Subtle Sculpted Nose */}
          <path
            d={`M ${centerX - headRx * 0.06} ${headCy + headRy * 0.14}
                Q ${centerX} ${headCy + headRy * 0.2} ${centerX + headRx * 0.07} ${headCy + headRy * 0.14}`}
            fill="none"
            stroke={skinLine}
            strokeWidth={1.25}
            strokeLinecap="round"
          />

          {/* Warm Cheek Glow */}
          <ellipse
            cx={centerX - headRx * 0.54}
            cy={headCy + headRy * 0.17}
            rx={headRx * 0.15}
            ry={headRy * 0.085}
            fill="#fb7185"
            opacity={0.36}
          />
          <ellipse
            cx={centerX + headRx * 0.54}
            cy={headCy + headRy * 0.17}
            rx={headRx * 0.15}
            ry={headRy * 0.085}
            fill="#fb7185"
            opacity={0.36}
          />

          {/* Natural Joyful Smile */}
          <path
            d={`M ${centerX - headRx * 0.27} ${headCy + headRy * 0.29}
                Q ${centerX} ${headCy + headRy * 0.5} ${centerX + headRx * 0.27} ${headCy + headRy * 0.29}`}
            fill="#e11d48"
            fillOpacity={0.22}
            stroke={strokeColor}
            strokeWidth={1.55}
            strokeLinecap="round"
          />
        </g>
      )}

      {/* Top Head Accessory (perched cleanly at crownY) */}
      {effectiveAccessory === 'sprout' && (
        <g>
          <path
            d={`M ${centerX} ${crownY} Q ${centerX + 1} ${crownY - 10} ${centerX} ${crownY - 14}`}
            fill="none"
            stroke="#15803d"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <path
            d={`M ${centerX} ${crownY - 11} Q ${centerX - 11} ${crownY - 19} ${centerX - 12} ${crownY - 10} Q ${centerX - 5} ${crownY - 6} ${centerX} ${crownY - 11} Z`}
            fill="#22c55e"
            stroke={strokeColor}
            strokeWidth={1.25}
          />
          <path
            d={`M ${centerX} ${crownY - 13} Q ${centerX + 11} ${crownY - 21} ${centerX + 12} ${crownY - 12} Q ${centerX + 5} ${crownY - 8} ${centerX} ${crownY - 13} Z`}
            fill="#4ade80"
            stroke={strokeColor}
            strokeWidth={1.25}
          />
        </g>
      )}

      {effectiveAccessory === 'cap' && (
        <g>
          <path
            d={`M ${centerX - headRx * 0.86} ${crownY + 4}
                Q ${centerX} ${crownY - 14} ${centerX + headRx * 0.86} ${crownY + 4} Z`}
            fill={palette.shoes}
            stroke={strokeColor}
            strokeWidth={1.45}
          />
          <path
            d={`M ${centerX + headRx * 0.18} ${crownY + 3}
                L ${centerX + headRx * 1.24} ${crownY + 5}
                Q ${centerX + headRx * 0.8} ${crownY + 8} ${centerX - headRx * 0.2} ${crownY + 4} Z`}
            fill={palette.shirtPrimary}
            stroke={strokeColor}
            strokeWidth={1.35}
          />
        </g>
      )}

      {effectiveAccessory === 'crown' && (
        <polygon
          points={`${centerX - 13},${crownY + 2} ${centerX - 15},${crownY - 11} ${centerX - 6},${crownY - 4} ${centerX},${crownY - 14} ${centerX + 6},${crownY - 4} ${centerX + 15},${crownY - 11} ${centerX + 13},${crownY + 2}`}
          fill="#fbbf24"
          stroke={strokeColor}
          strokeWidth={1.45}
          strokeLinejoin="round"
        />
      )}

      {effectiveAccessory === 'dino' && (
        <g>
          <polygon
            points={`${centerX - 10},${crownY + 2} ${centerX - 5},${crownY - 9} ${centerX - 1},${crownY + 1}`}
            fill="#10b981"
            stroke={strokeColor}
            strokeWidth={1.35}
          />
          <polygon
            points={`${centerX - 1},${crownY + 1} ${centerX + 4},${crownY - 11} ${centerX + 9},${crownY + 1}`}
            fill="#34d399"
            stroke={strokeColor}
            strokeWidth={1.35}
          />
          <polygon
            points={`${centerX + 9},${crownY + 2} ${centerX + 14},${crownY - 7} ${centerX + 17},${crownY + 3}`}
            fill="#10b981"
            stroke={strokeColor}
            strokeWidth={1.35}
          />
        </g>
      )}
    </g>
  );
};
