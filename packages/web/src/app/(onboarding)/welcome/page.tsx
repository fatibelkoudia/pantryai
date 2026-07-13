'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { WelcomeSlides } from '@/components/onboarding/WelcomeSlides';
import { WelcomeLanguageStep } from '@/components/onboarding/WelcomeLanguageStep';
import { WelcomeProfileStep } from '@/components/onboarding/WelcomeProfileStep';
import { WelcomePantryStep } from '@/components/onboarding/WelcomePantryStep';

// slides first, then three setup steps (no notifications step on web)
const STEP_COUNT = 3;
type Phase = 'slides' | number;

// First-run onboarding for the web app. Guards itself, then runs the slides and
// setup steps. Completing or skipping marks onboarding done, which lets the app
// shell stop bouncing the user back here.
export default function WelcomePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { status, user, refreshUser } = useAuth();
  const [phase, setPhase] = useState<Phase>('slides');
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
      void finish();
    }
  }

  if (status !== 'authed' || user?.onboardingCompletedAt) {
    return <p className="text-expiry-none">{t('common.saving')}</p>;
  }

  function renderPhase() {
    if (phase === 'slides') {
      return <WelcomeSlides onDone={() => setPhase(0)} />;
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
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <div className="flex w-full justify-end">
        <button
          type="button"
          onClick={() => void finish()}
          className="font-bold text-expiry-none hover:underline"
        >
          {t('onboarding.skip')}
        </button>
      </div>
      {renderPhase()}
      {finishError ? (
        <p role="alert" className="text-sm font-semibold text-expiry-urgent">
          {finishError}
        </p>
      ) : null}
    </div>
  );
}
