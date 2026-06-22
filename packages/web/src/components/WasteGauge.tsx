'use client';

import { useTranslation } from 'react-i18next';
import { colors } from '@pantryai/shared';

interface WasteGaugeProps {
  score: number;
  // Arc color, comes from the mood (mascotMoodMeta[mood].accent).
  accent: string;
}

// A semicircular 0-100 gauge. The arc fills proportionally to the score and is
// colored by the mood it lands in (green -> yellow -> coral).
export function WasteGauge({ score, accent }: WasteGaugeProps) {
  const { t } = useTranslation();
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  // Semicircle path: radius 80, centered at (100,100), from left to right.
  const length = Math.PI * 80;
  const offset = length * (1 - clamped / 100);

  return (
    <div
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={t('waste.gaugeLabel')}
    >
      <svg viewBox="0 0 200 120" width="200" height="120" aria-hidden="true">
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke={colors.warmGray}
          strokeWidth={16}
          strokeLinecap="round"
        />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke={accent}
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={offset}
        />
        <text
          x="100"
          y="92"
          textAnchor="middle"
          fontSize="40"
          fontWeight="800"
          fill={colors.charcoal}
        >
          {clamped}
        </text>
        <text x="100" y="112" textAnchor="middle" fontSize="13" fill={colors.textMuted}>
          {t('waste.gaugeLabel')}
        </text>
      </svg>
    </div>
  );
}
