'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ChallengeProgress } from '@pantryai/shared';
import { apiClient } from '@/lib/api';

// The XP/star header and the user's challenges with progress bars. We use the Sunny
// Yellow colour for the rewards bits. The data comes from GET /challenges, which also
// hands out XP for anything the user just finished.
export function GamificationCard() {
  const { t } = useTranslation();
  const challenges = useQuery({
    queryKey: ['challenges'],
    queryFn: () => apiClient.getChallenges(),
  });

  if (challenges.isLoading) {
    return (
      <section className="rounded-card border border-border bg-surface-card p-5" aria-busy="true">
        <p role="status" className="text-slate-500">
          {t('gamification.loading')}
        </p>
      </section>
    );
  }

  if (challenges.isError || !challenges.data) {
    return null;
  }

  const { xp, challenges: list } = challenges.data;
  const completed = list.filter((c) => c.completed).length;

  return (
    <section
      aria-label={t('gamification.ariaLabel')}
      className="flex flex-col gap-4 rounded-card border border-border bg-surface-card p-5"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-2xl">
            ⭐
          </span>
          <div>
            <p className="text-2xl font-bold leading-none">{t('gamification.xp', { count: xp })}</p>
            <p className="text-xs text-slate-500">
              {t('gamification.challengesDone', { completed, total: list.length })}
            </p>
          </div>
        </div>
      </header>

      <ul className="flex flex-col gap-3">
        {list.map((challenge) => (
          <ChallengeRow key={challenge.key} challenge={challenge} />
        ))}
      </ul>
    </section>
  );
}

function ChallengeRow({ challenge }: { challenge: ChallengeProgress }) {
  const { t } = useTranslation();
  const pct = challenge.target > 0 ? Math.round((challenge.progress / challenge.target) * 100) : 0;
  const title = t(`challenges.${challenge.key}.title`, { defaultValue: challenge.title });
  const description = t(`challenges.${challenge.key}.description`, {
    defaultValue: challenge.description,
  });

  return (
    <li className="rounded-card bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-slate-600">{description}</p>
        </div>
        {challenge.completed ? (
          <span className="shrink-0 rounded-full bg-sunny px-2 py-1 text-xs font-bold text-charcoal">
            {t('gamification.xpChipDone', { count: challenge.xp })}
          </span>
        ) : (
          <span className="shrink-0 text-xs font-semibold text-slate-500">
            {t('gamification.xpChip', { count: challenge.xp })}
          </span>
        )}
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={challenge.progress}
        aria-valuemin={0}
        aria-valuemax={challenge.target}
        aria-label={t('gamification.progressA11y', { title })}
      >
        <div className="h-full rounded-full bg-sunny" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-right text-xs text-slate-500">
        {challenge.progress} / {challenge.target}
      </p>
    </li>
  );
}
