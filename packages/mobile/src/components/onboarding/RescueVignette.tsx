import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, font, radii, spacing } from '../../theme';

// Mock of the rescue moment: an item running out of days, then a recipe card
// sliding in to save it. Pure decoration, hidden from screen readers.
export function RescueVignette() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduce) return;
    pulse.value = withRepeat(withTiming(1.05, { duration: 900 }), -1, true);
  }, [pulse, reduce]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View
      style={styles.column}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.itemCard}>
        <Text style={styles.emoji}>🥬</Text>
        <Text style={styles.itemName}>{t('onboarding.vignettes.rescueItem')}</Text>
        <Animated.View style={[styles.badge, pulseStyle]}>
          <Text style={styles.badgeText}>{t('onboarding.vignettes.rescueDays')}</Text>
        </Animated.View>
      </View>

      <Animated.View
        style={styles.recipeCard}
        {...(reduce
          ? {}
          : { entering: FadeInUp.delay(500).duration(280).easing(Easing.out(Easing.cubic)) })}
      >
        <Text style={styles.emoji}>🍳</Text>
        <Text style={styles.recipeName}>{t('onboarding.vignettes.rescueRecipe')}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: spacing.sm },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emoji: { fontSize: 20 },
  itemName: { fontSize: 14, fontFamily: font.bold, color: colors.charcoal },
  badge: {
    backgroundColor: colors.sunnyYellow,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontFamily: font.bold, color: colors.amberText },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.heroMint,
    borderRadius: radii.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  recipeName: { fontSize: 14, fontFamily: font.bold, color: colors.forestGreen },
});
