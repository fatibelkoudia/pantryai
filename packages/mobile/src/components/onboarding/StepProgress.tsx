import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, glow, radii } from '../../theme';

interface StepProgressProps {
  stepIndex: number;
  totalSteps: number;
}

// The setup progress bar. The fill eases to the new width on every step, and the
// old "Step X of Y" text lives on as the accessibility label.
export function StepProgress({ stepIndex, totalSteps }: StepProgressProps) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const width = useSharedValue(0);

  const target = trackWidth * ((stepIndex + 1) / totalSteps);

  useEffect(() => {
    width.value = reduce
      ? target
      : withTiming(target, { duration: 450, easing: Easing.out(Easing.cubic) });
  }, [width, target, reduce]);

  const fillStyle = useAnimatedStyle(() => ({ width: width.value }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('onboarding.stepOf', { step: stepIndex + 1, total: totalSteps })}
      accessibilityValue={{ min: 1, max: totalSteps, now: stepIndex + 1 }}
      style={styles.track}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 110, 28, 0.12)',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.leafGreen,
    boxShadow: `0 0 12px ${glow.brand}`,
  },
});
