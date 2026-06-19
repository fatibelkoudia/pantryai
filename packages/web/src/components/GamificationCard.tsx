'use client';

import { useQuery } from '@tanstack/react-query';
import type { ChallengeProgress } from '@pantryai/shared';
import { apiClient } from '@/lib/api';

// The XP/star header and the user's challenges with progress bars. We use the Sunny
// Yellow colour for the rewards bits. The data comes from GET /challenges, which also
// hands out XP for anything the user just finished.
export function GamificationCard() {
  const challenges = useQuery({
    queryKey: ['challenges'],
    queryFn: () => apiClient.getChallenges(),
  });

  if (challenges.isLoading) {
    return (
      <section className="rounded-card border border-border bg-surface-card p-5" aria-busy="true">
        <p role="status" className="text-slate-500">
          Loading your challenges…
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
      aria-label="Challenges and XP"
      className="flex flex-col gap-4 rounded-card border border-border bg-surface-card p-5"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-2xl">
            ⭐
          </span>
          <div>
            <p className="text-2xl font-bold leading-none">{xp} XP</p>
            <p className="text-xs text-slate-500">
              {completed} / {list.length} challenges done
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
  const pct = challenge.target > 0 ? Math.round((challenge.progress / challenge.target) * 100) : 0;

  return (
    <li className="rounded-card bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{challenge.title}</p>
          <p className="text-xs text-slate-600">{challenge.description}</p>
        </div>
        {challenge.completed ? (
          <span className="shrink-0 rounded-full bg-sunny px-2 py-1 text-xs font-bold text-charcoal">
            +{challenge.xp} XP ✓
          </span>
        ) : (
          <span className="shrink-0 text-xs font-semibold text-slate-500">+{challenge.xp} XP</span>
        )}
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={challenge.progress}
        aria-valuemin={0}
        aria-valuemax={challenge.target}
        aria-label={`${challenge.title} progress`}
      >
        <div className="h-full rounded-full bg-sunny" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-right text-xs text-slate-500">
        {challenge.progress} / {challenge.target}
      </p>
    </li>
  );
}
