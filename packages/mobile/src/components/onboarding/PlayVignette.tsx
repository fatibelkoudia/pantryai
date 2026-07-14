import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { colors, font, radii, spacing } from '../../theme';

// Mock of the gamification bits: streak, level and an XP bar filling up.
// Pure decoration, hidden from screen readers.
export function PlayVignette() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const fill = useSharedValue(0);

  useEffect(() => {
    const target = trackWidth * 0.8;
    fill.value = reduce
      ? target
      : withDelay(400, withTiming(target, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [fill, trackWidth, reduce]);

  const fillStyle = useAnimatedStyle(() => ({ width: fill.value }));

  return (
    <View
      style={styles.column}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.chipsRow}>
        <View style={[styles.chip, styles.chipMint]}>
          <Text style={styles.chipMintText}>🔥 {t('onboarding.vignettes.playStreak')}</Text>
        </View>
        <View style={[styles.chip, styles.chipSunny]}>
          <Text style={styles.chipSunnyText}>{t('onboarding.vignettes.playLevel')}</Text>
        </View>
      </View>

      <View style={styles.track} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>

      <Animated.Text
        style={styles.xp}
        {...(reduce
          ? {}
          : { entering: FadeInUp.delay(800).duration(280).easing(Easing.out(Easing.cubic)) })}
      >
        {t('onboarding.vignettes.playXp')}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: spacing.sm, width: '100%', maxWidth: 240 },
  chipsRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  chipMint: { backgroundColor: colors.softMint },
  chipMintText: { fontSize: 12, fontFamily: font.bold, color: colors.forestGreen },
  chipSunny: { backgroundColor: colors.paleYellow },
  chipSunnyText: { fontSize: 12, fontFamily: font.bold, color: colors.amberText },
  track: {
    height: 8,
    width: '100%',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 110, 28, 0.12)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.leafGreen },
  xp: { fontSize: 12, fontFamily: font.bold, color: colors.leafGreen },
});
