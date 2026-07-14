import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, FadeInRight, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../src/api/client';
import { AuroraBackground } from '../src/components/onboarding/AuroraBackground';
import { DoneStep } from '../src/components/onboarding/DoneStep';
import { LanguageStep } from '../src/components/onboarding/LanguageStep';
import { NotificationsStep } from '../src/components/onboarding/NotificationsStep';
import { OnboardingSlides } from '../src/components/onboarding/OnboardingSlides';
import { PantryStep } from '../src/components/onboarding/PantryStep';
import { ProfileStep } from '../src/components/onboarding/ProfileStep';
import { useAuthStore } from '../src/store/auth';
import { colors, font, glass, radii, spacing } from '../src/theme';

// slides first, then the four setup steps, then the celebration
const STEP_COUNT = 4;
type Phase = 'slides' | number | 'done';

// First-run onboarding. Slides tell the story, four skippable setup steps follow,
// and a small celebration closes it out. Every step saves on its own; the whole
// flow is marked complete from the finale (or when the user skips), which is what
// makes the auth gate route on to the tabs.
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const setUser = useAuthStore((s) => s.setUser);
  const [phase, setPhase] = useState<Phase>('slides');
  const [slideIndex, setSlideIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  async function finish() {
    try {
      setFinishError(null);
      setFinishing(true);
      const updated = await apiClient.completeOnboarding();
      setUser(updated);
      // the auth gate sees onboardingCompletedAt is set and replaces to the tabs
    } catch {
      setFinishError(t('onboarding.finishFailed'));
    } finally {
      setFinishing(false);
    }
  }

  // move on from a setup step, celebrating once we run past the last one
  function advanceFrom(index: number) {
    void Haptics.selectionAsync();
    if (index + 1 < STEP_COUNT) {
      setPhase(index + 1);
    } else {
      setPhase('done');
    }
  }

  function renderPhase() {
    if (phase === 'slides') {
      return <OnboardingSlides onDone={() => setPhase(0)} onIndexChange={setSlideIndex} />;
    }
    if (phase === 'done') {
      return <DoneStep onFinish={() => void finish()} loading={finishing} />;
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
    <View style={styles.root}>
      <AuroraBackground tone={phase === 'slides' && slideIndex === 0 ? 'problem' : 'solution'} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => void finish()}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.skipPill}
          >
            <Text style={styles.skip}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        </View>
        <Animated.View
          key={phase === 'slides' ? 'slides' : `step-${phase}`}
          style={styles.phase}
          {...(reduce
            ? {}
            : { entering: FadeInRight.duration(280).easing(Easing.out(Easing.cubic)) })}
        >
          {renderPhase()}
        </Animated.View>
        {finishError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{finishError}</Text>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.warmCream },
  safe: { flex: 1 },
  phase: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  skipPill: {
    backgroundColor: glass.bg,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
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
