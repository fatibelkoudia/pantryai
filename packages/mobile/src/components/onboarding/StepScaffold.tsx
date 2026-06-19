import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, radii, spacing } from '../../theme';
import { PrimaryButton } from '../PrimaryButton';

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

// The shared chrome every setup step sits in: progress line, title, the step's own
// content, then the Continue + "skip this step" footer.
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.progress}>
          {t('onboarding.stepOf', { step: stepIndex + 1, total: totalSteps })}
        </Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.body}>{children}</View>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label={continueLabel} onPress={onContinue} loading={loading} />
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
  content: { padding: spacing.lg, gap: spacing.sm },
  progress: {
    fontSize: 13,
    fontFamily: font.bold,
    color: colors.leafGreen,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: { fontSize: 26, fontFamily: font.black, color: colors.forestGreen },
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
