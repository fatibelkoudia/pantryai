import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInLeft,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, font, radii, spacing } from '../../theme';

// One shimmering line on the mock receipt.
function ShimmerLine({ delay, reduce }: { delay: number; reduce: boolean }) {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    if (reduce) return;
    opacity.value = withDelay(delay, withRepeat(withTiming(1, { duration: 900 }), -1, true));
  }, [opacity, delay, reduce]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.line, style]} />;
}

// Little mock of the scan flow: a receipt with shimmering lines, and pantry chips
// popping in next to it. Pure decoration, so it's hidden from screen readers.
export function ReceiptScanVignette() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const items = [
    t('onboarding.vignettes.receiptItem1'),
    t('onboarding.vignettes.receiptItem2'),
    t('onboarding.vignettes.receiptItem3'),
  ];

  return (
    <View
      style={styles.row}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.receipt}>
        <Text style={styles.receiptTitle}>{t('onboarding.vignettes.receiptTitle')}</Text>
        {[0, 1, 2].map((i) => (
          <ShimmerLine key={i} delay={i * 200} reduce={reduce} />
        ))}
      </View>

      <Text style={styles.chevron}>›</Text>

      <View style={styles.chips}>
        {items.map((label, i) => (
          <Animated.View
            key={label}
            style={styles.chip}
            {...(reduce
              ? {}
              : {
                  entering: FadeInLeft.delay(400 + i * 250)
                    .duration(280)
                    .easing(Easing.out(Easing.cubic)),
                })}
          >
            <Text style={styles.chipText}>{label}</Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  receipt: {
    width: 104,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    gap: 6,
  },
  receiptTitle: {
    fontSize: 10,
    fontFamily: font.bold,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  line: { height: 6, borderRadius: radii.pill, backgroundColor: colors.border },
  chevron: { fontSize: 20, fontFamily: font.black, color: colors.leafGreen },
  chips: { alignItems: 'flex-start', gap: 6 },
  chip: {
    backgroundColor: colors.softMint,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  chipText: { fontSize: 12, fontFamily: font.bold, color: colors.forestGreen },
});
