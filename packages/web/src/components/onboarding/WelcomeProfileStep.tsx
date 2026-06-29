'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { avatarPresets, getAvatarPreset } from '@pantryai/shared';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AvatarImage } from '@/components/AvatarImage';
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
          <div key={preset.id} className="flex w-14 flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setAvatarId(preset.id)}
              aria-pressed={selected.id === preset.id}
              aria-label={preset.name}
              style={{ backgroundColor: preset.bg }}
              className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-full transition-all duration-150 ${
                selected.id === preset.id
                  ? 'scale-105 ring-2 ring-brand-deep shadow-glow-brand'
                  : ''
              }`}
            >
              <AvatarImage id={preset.id} size={56} />
            </button>
            <span
              className={`text-[11px] font-semibold ${
                selected.id === preset.id ? 'text-brand-deep' : 'text-slate-500'
              }`}
            >
              {preset.name}
            </span>
          </div>
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
        className="rounded-xl border border-border bg-white/70 px-3 py-2 backdrop-blur-sm"
      />
    </StepShell>
  );
}
