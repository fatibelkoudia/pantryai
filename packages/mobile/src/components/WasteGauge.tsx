import { colors } from '@pantryai/shared';
import { View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

interface WasteGaugeProps {
  score: number;
  // Arc color from the mood (mascotMoodMeta[mood].accent).
  accent: string;
}

// Semicircular 0-100 gauge; the arc fills with the score and is colored by mood.
export function WasteGauge({ score, accent }: WasteGaugeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const length = Math.PI * 80;
  const offset = length * (1 - clamped / 100);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      accessibilityLabel="Waste Level"
    >
      <Svg viewBox="0 0 200 120" width={200} height={120}>
        <Path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke={colors.warmGray}
          strokeWidth={16}
          strokeLinecap="round"
        />
        <Path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke={accent}
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={offset}
        />
        <SvgText
          x="100"
          y="92"
          textAnchor="middle"
          fontSize="40"
          fontWeight="800"
          fill={colors.charcoal}
        >
          {String(clamped)}
        </SvgText>
        <SvgText x="100" y="112" textAnchor="middle" fontSize="13" fill={colors.textMuted}>
          Waste Level
        </SvgText>
      </Svg>
    </View>
  );
}
