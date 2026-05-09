'use client';

import { useQuery } from '@tanstack/react-query';
import { mascotMoodMeta } from '@pantryai/shared';
import { apiClient } from '@/lib/api';
import { TrashyMood } from './TrashyMood';
import { WasteGauge } from './WasteGauge';

// Trashy's mood card: the mascot + the Waste Level gauge over the trailing 30 days.
export function WasteMoodCard() {
  const waste = useQuery({
    queryKey: ['waste'],
    queryFn: () => apiClient.getWasteLevel(),
  });

  if (waste.isLoading) {
    return (
      <section className="rounded-card border border-border bg-surface-card p-5" aria-busy="true">
        <p role="status" className="text-slate-500">
          Checking on Trashy…
        </p>
      </section>
    );
  }

  if (waste.isError || !waste.data) {
    return null;
  }

  const { score, mood, counts } = waste.data;
  const meta = mascotMoodMeta[mood];

  return (
    <section className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface-card p-5 sm:flex-row sm:items-center sm:gap-6">
      <TrashyMood mood={mood} />
      <div className="flex flex-1 flex-col items-center gap-2 sm:items-start">
        <WasteGauge score={score} accent={meta.accent} />
        <p className="text-center text-sm text-slate-600 sm:text-left">{meta.message}</p>
        {counts.total > 0 ? (
          <p className="text-center text-xs text-slate-500 sm:text-left">
            Last 30 days: {counts.consumed} used · {counts.discarded} thrown out · {counts.expired}{' '}
            expired
          </p>
        ) : (
          <p className="text-center text-xs text-slate-500 sm:text-left">
            No items resolved yet. Mark what you use or toss to see your level move.
          </p>
        )}
      </div>
    </section>
  );
}
