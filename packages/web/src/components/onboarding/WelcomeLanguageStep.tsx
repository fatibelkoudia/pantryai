'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LOCALE_FLAGS, SUPPORTED_LOCALES } from '@pantryai/shared';
import type { Locale } from '@pantryai/shared';
import { apiClient } from '@/lib/api';
import { StepShell } from './StepShell';

interface StepProps {
  stepIndex: number;
  totalSteps: number;
  onAdvance: () => void;
}

// Pick a language. Tapping a card switches the UI right away; Continue saves it.
export function WelcomeLanguageStep({ stepIndex, totalSteps, onAdvance }: StepProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Locale>(
    (SUPPORTED_LOCALES as readonly string[]).includes(i18n.language)
      ? (i18n.language as Locale)
      : 'en',
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => apiClient.updateSettings({ locale: selected }),
    onSuccess: (data) => {
      // seed the cache so LocaleSync can't flip the language back
      queryClient.setQueryData(['settings'], data);
      onAdvance();
    },
    onError: () => setError(t('onboarding.saveFailed')),
  });

  function pick(locale: Locale) {
    setSelected(locale);
    void i18n.changeLanguage(locale);
  }

  return (
    <StepShell
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      title={t('onboarding.language.title')}
      subtitle={t('onboarding.language.subtitle')}
      onContinue={() => {
        setError(null);
        save.mutate();
      }}
      onSkip={onAdvance}
      loading={save.isPending}
      error={error}
    >
      <div className="flex gap-3">
        {SUPPORTED_LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            onClick={() => pick(locale)}
            aria-pressed={selected === locale}
            className={`flex flex-1 flex-col items-center gap-2 rounded-card border py-6 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 ${
              selected === locale
                ? 'border-brand bg-mint shadow-glow-brand'
                : 'border-border bg-white/60'
            }`}
          >
            <span className="text-4xl">{LOCALE_FLAGS[locale]}</span>
            <span className="font-bold text-charcoal">{t(`settings.languages.${locale}`)}</span>
          </button>
        ))}
      </div>
    </StepShell>
  );
}
