'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SETTINGS_LIMITS } from '@pantryai/shared';
import type { StockLocation } from '@pantryai/shared';
import { apiClient } from '@/lib/api';
import { StepShell } from './StepShell';

interface StepProps {
  stepIndex: number;
  totalSteps: number;
  onAdvance: () => void;
}

const LOCATIONS: StockLocation[] = ['FRIDGE', 'FREEZER', 'PANTRY'];

// The two pantry settings a new user actually feels: default location and how many
// days ahead we warn about expiry.
export function WelcomePantryStep({ stepIndex, totalSteps, onAdvance }: StepProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<StockLocation>('PANTRY');
  const [days, setDays] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      apiClient.updateSettings({ defaultStockLocation: location, expiringSoonDays: days }),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      onAdvance();
    },
    onError: () => setError(t('onboarding.saveFailed')),
  });

  const { min, max } = SETTINGS_LIMITS.expiringSoonDays;

  return (
    <StepShell
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      title={t('onboarding.pantry.title')}
      subtitle={t('onboarding.pantry.subtitle')}
      onContinue={() => {
        setError(null);
        save.mutate();
      }}
      onSkip={onAdvance}
      loading={save.isPending}
      error={error}
    >
      <span className="text-sm font-bold">{t('onboarding.pantry.defaultLocation')}</span>
      <div className="flex gap-2 rounded-card bg-surface-input p-1">
        {LOCATIONS.map((loc) => (
          <button
            key={loc}
            type="button"
            onClick={() => setLocation(loc)}
            aria-pressed={location === loc}
            className={`flex-1 rounded-md py-2 text-sm font-semibold ${
              location === loc ? 'bg-mint text-brand-deep' : 'text-expiry-none'
            }`}
          >
            {t(`settings.locations.${loc}`)}
          </button>
        ))}
      </div>

      <span className="text-sm font-bold">{t('onboarding.pantry.expiringWindow')}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setDays((d) => Math.max(min, d - 1))}
          disabled={days <= min}
          aria-label={`${t('onboarding.pantry.expiringWindow')} -`}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-input text-lg font-bold disabled:opacity-40"
        >
          −
        </button>
        <span className="min-w-20 text-center font-bold">
          {t('settings.daysUnit', { count: days })}
        </span>
        <button
          type="button"
          onClick={() => setDays((d) => Math.min(max, d + 1))}
          disabled={days >= max}
          aria-label={`${t('onboarding.pantry.expiringWindow')} +`}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-input text-lg font-bold disabled:opacity-40"
        >
          +
        </button>
      </div>
    </StepShell>
  );
}
