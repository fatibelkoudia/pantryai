import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { colors, font, radii, spacing } from '../../theme';
import { PrimaryButton } from '../PrimaryButton';
import { TrashyMood } from '../TrashyMood';
import { GlassCard } from './GlassCard';
import { StepProgress } from './StepProgress';

interface StepScaffoldProps {
  stepIndex: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  onContinue: () => void;
  onSkip: () => void;
  continueLabel: string;
  loading?: boolean;
  error?: string | null;
}

// The shared chrome every setup step sits in: progress bar, a small Trashy next to
// the title, the step's own content in a glass card, then the Continue + skip footer.
export function StepScaffold({
  stepIndex,
  totalSteps,
  title,
  subtitle,
  children,
  onContinue,
  onSkip,
  continueLabel,
  loading = false,
  error,
}: StepScaffoldProps) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  // stagger helper so title, subtitle and body slide in one after the other
  const enter = (delay: number) =>
    reduce
      ? {}
      : { entering: FadeInDown.delay(delay).duration(280).easing(Easing.out(Easing.cubic)) };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <StepProgress stepIndex={stepIndex} totalSteps={totalSteps} />
        <GlassCard style={styles.card}>
          <Animated.View style={styles.titleRow} {...enter(0)}>
            <TrashyMood mood="GOOD" size={44} showLabel={false} />
            <Text style={styles.title}>{title}</Text>
          </Animated.View>
          <Animated.Text style={styles.subtitle} {...enter(60)}>
            {subtitle}
          </Animated.Text>
          <Animated.View style={styles.body} {...enter(120)}>
            {children}
          </Animated.View>
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </GlassCard>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label={continueLabel} onPress={onContinue} loading={loading} glow />
        <PrimaryButton
          label={t('onboarding.skipStep')}
          onPress={onSkip}
          variant="ghost"
          disabled={loading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: {
    flex: 1,
    fontSize: 24,
    fontFamily: font.black,
    color: colors.forestGreen,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: font.regular,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  body: { gap: spacing.md },
  errorBanner: {
    backgroundColor: colors.redTint,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  errorText: { fontSize: 14, fontFamily: font.semibold, color: colors.redText },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
});
