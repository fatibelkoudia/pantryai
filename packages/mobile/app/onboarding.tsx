import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiClient } from '../src/api/client';
import { LanguageStep } from '../src/components/onboarding/LanguageStep';
import { NotificationsStep } from '../src/components/onboarding/NotificationsStep';
import { OnboardingSlides } from '../src/components/onboarding/OnboardingSlides';
import { PantryStep } from '../src/components/onboarding/PantryStep';
import { ProfileStep } from '../src/components/onboarding/ProfileStep';
import { useAuthStore } from '../src/store/auth';
import { colors, font, spacing } from '../src/theme';

// slides first, then the four setup steps
const STEP_COUNT = 4;
type Phase = 'slides' | number;

// First-run onboarding. Slides explain the app, then four skippable setup steps.
// Every step saves on its own; the whole flow is marked complete at the end (or
// when the user skips), which is what makes the auth gate route on to the tabs.
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const setUser = useAuthStore((s) => s.setUser);
  const [phase, setPhase] = useState<Phase>('slides');
  const [finishError, setFinishError] = useState<string | null>(null);

  async function finish() {
    try {
      setFinishError(null);
      const updated = await apiClient.completeOnboarding();
      setUser(updated);
      // the auth gate sees onboardingCompletedAt is set and replaces to the tabs
    } catch {
      setFinishError(t('onboarding.finishFailed'));
    }
  }

  // move on from a setup step, finishing once we run past the last one
  function advanceFrom(index: number) {
    if (index + 1 < STEP_COUNT) {
      setPhase(index + 1);
    } else {
      void finish();
    }
  }

  function renderPhase() {
    if (phase === 'slides') {
      return <OnboardingSlides onDone={() => setPhase(0)} />;
    }
    const stepProps = {
      stepIndex: phase,
      totalSteps: STEP_COUNT,
      onAdvance: () => advanceFrom(phase),
    };
    switch (phase) {
      case 0:
        return <LanguageStep {...stepProps} />;
      case 1:
        return <ProfileStep {...stepProps} />;
      case 2:
        return <PantryStep {...stepProps} />;
      default:
        return <NotificationsStep {...stepProps} />;
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => void finish()} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.skip}>{t('onboarding.skip')}</Text>
        </TouchableOpacity>
      </View>
      {renderPhase()}
      {finishError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{finishError}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.warmCream },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  skip: { fontSize: 15, fontFamily: font.bold, color: colors.textMuted },
  errorBanner: {
    backgroundColor: colors.redTint,
    margin: spacing.lg,
    borderRadius: 8,
    padding: spacing.md,
  },
  errorText: {
    fontSize: 14,
    fontFamily: font.semibold,
    color: colors.redText,
    textAlign: 'center',
  },
});
