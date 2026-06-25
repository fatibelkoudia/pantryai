'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AuroraBackground } from '@/components/onboarding/AuroraBackground';
import { WelcomeSlides } from '@/components/onboarding/WelcomeSlides';
import { WelcomeLanguageStep } from '@/components/onboarding/WelcomeLanguageStep';
import { WelcomeProfileStep } from '@/components/onboarding/WelcomeProfileStep';
import { WelcomePantryStep } from '@/components/onboarding/WelcomePantryStep';
import { WelcomeDone } from '@/components/onboarding/WelcomeDone';
import { smooth } from '@/components/onboarding/motion';

// slides first, then three setup steps, then the celebration (no notifications step on web)
const STEP_COUNT = 3;
type Phase = 'slides' | number | 'done';

// First-run onboarding for the web app. Guards itself, then runs the slides, the
// setup steps and the finale. Completing or skipping marks onboarding done, which
// lets the app shell stop bouncing the user back here.
export default function WelcomePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { status, user, refreshUser } = useAuth();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('slides');
  const [slideIndex, setSlideIndex] = useState(0);
  const [finishError, setFinishError] = useState<string | null>(null);

  // own guard: send anon users to login and already-onboarded users home
  useEffect(() => {
    if (status === 'anon') {
      router.replace('/login');
    } else if (status === 'authed' && user?.onboardingCompletedAt) {
      router.replace('/home');
    }
  }, [status, user, router]);

  async function finish() {
    try {
      setFinishError(null);
      await apiClient.completeOnboarding();
      // refresh the user first so the app shell's guard sees the flag before we navigate
      await refreshUser();
      router.replace('/home');
    } catch {
      setFinishError(t('onboarding.finishFailed'));
    }
  }

  function advanceFrom(index: number) {
    if (index + 1 < STEP_COUNT) {
      setPhase(index + 1);
    } else {
      setPhase('done');
    }
  }

  if (status !== 'authed' || user?.onboardingCompletedAt) {
    return <p className="text-expiry-none">{t('common.saving')}</p>;
  }

  function renderPhase() {
    if (phase === 'slides') {
      return <WelcomeSlides onDone={() => setPhase(0)} onIndexChange={setSlideIndex} />;
    }
    if (phase === 'done') {
      return <WelcomeDone onFinish={() => void finish()} />;
    }
    const stepProps = {
      stepIndex: phase,
      totalSteps: STEP_COUNT,
      onAdvance: () => advanceFrom(phase),
    };
    switch (phase) {
      case 0:
        return <WelcomeLanguageStep {...stepProps} />;
      case 1:
        return <WelcomeProfileStep {...stepProps} />;
      default:
        return <WelcomePantryStep {...stepProps} />;
    }
  }

  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-6">
      <AuroraBackground tone={phase === 'slides' && slideIndex === 0 ? 'problem' : 'solution'} />
      <div className="flex w-full justify-end">
        <button
          type="button"
          onClick={() => void finish()}
          className="rounded-full border border-glass-border bg-glass px-4 py-1.5 text-sm font-bold text-expiry-none backdrop-blur-md transition hover:text-brand-deep"
        >
          {t('onboarding.skip')}
        </button>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={phase === 'slides' ? 'slides' : `step-${phase}`}
          className="w-full"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={smooth}
        >
          {renderPhase()}
        </motion.div>
      </AnimatePresence>
      {finishError ? (
        <p role="alert" className="text-sm font-semibold text-expiry-urgent">
          {finishError}
        </p>
      ) : null}
    </div>
  );
}
