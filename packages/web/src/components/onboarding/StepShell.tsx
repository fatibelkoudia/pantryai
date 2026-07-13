'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface StepShellProps {
  stepIndex: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  onContinue: () => void;
  onSkip: () => void;
  loading?: boolean;
  error?: string | null;
}

// Shared chrome for a web onboarding step: progress line, heading, the step's own
// content, then the Continue + "skip this step" buttons.
export function StepShell({
  stepIndex,
  totalSteps,
  title,
  subtitle,
  children,
  onContinue,
  onSkip,
  loading = false,
  error,
}: StepShellProps) {
  const { t } = useTranslation();

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <p className="text-sm font-bold uppercase tracking-wide text-brand">
        {t('onboarding.stepOf', { step: stepIndex + 1, total: totalSteps })}
      </p>
      <h2 className="text-2xl font-extrabold text-brand-deep">{title}</h2>
      <p className="text-sm text-expiry-none">{subtitle}</p>
      <div className="flex flex-col gap-3">{children}</div>
      {error ? (
        <p
          role="alert"
          className="rounded-md bg-expiry-urgent-bg px-3 py-2 text-sm font-semibold text-expiry-urgent"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-2 flex flex-col gap-2">
        <button
          type="button"
          onClick={onContinue}
          disabled={loading}
          className="rounded-full bg-brand-deep px-4 py-2.5 font-bold text-brand-fg shadow-btn-lip disabled:opacity-60"
        >
          {loading ? t('common.saving') : t('onboarding.continue')}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={loading}
          className="rounded-full px-4 py-2 font-bold text-brand-deep hover:underline disabled:opacity-60"
        >
          {t('onboarding.skipStep')}
        </button>
      </div>
    </div>
  );
}
