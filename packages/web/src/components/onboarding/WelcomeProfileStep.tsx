'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { avatarPresets, getAvatarPreset } from '@pantryai/shared';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { StepShell } from './StepShell';

interface StepProps {
  stepIndex: number;
  totalSteps: number;
  onAdvance: () => void;
}

// Pick an avatar and a display name. Only sends fields the user actually set.
export function WelcomeProfileStep({ stepIndex, totalSteps, onAdvance }: StepProps) {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [avatarId, setAvatarId] = useState<string | null>(user?.avatarId ?? null);
  const [error, setError] = useState<string | null>(null);

  const selected = getAvatarPreset(avatarId);

  const save = useMutation({
    mutationFn: () =>
      apiClient.updateProfile({
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(avatarId ? { avatarId } : {}),
      }),
    onSuccess: async () => {
      await refreshUser();
      onAdvance();
    },
    onError: () => setError(t('onboarding.saveFailed')),
  });

  return (
    <StepShell
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      title={t('onboarding.profile.title')}
      subtitle={t('onboarding.profile.subtitle')}
      onContinue={() => {
        setError(null);
        save.mutate();
      }}
      onSkip={onAdvance}
      loading={save.isPending}
      error={error}
    >
      <span className="text-sm font-bold">{t('profile.chooseAvatar')}</span>
      <div className="flex flex-wrap gap-3">
        {avatarPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setAvatarId(preset.id)}
            aria-pressed={selected.id === preset.id}
            style={{ backgroundColor: preset.bg }}
            className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
              selected.id === preset.id ? 'ring-2 ring-brand-deep' : ''
            }`}
          >
            {preset.emoji}
          </button>
        ))}
      </div>

      <label htmlFor="onboarding-name" className="text-sm font-bold">
        {t('profile.name')}
      </label>
      <input
        id="onboarding-name"
        type="text"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('profile.namePlaceholder')}
        className="rounded-md border border-border bg-surface-input px-3 py-2"
      />
    </StepShell>
  );
}
