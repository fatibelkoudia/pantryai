'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// "Today's Tip" card for the dashboard. It just shows one random conservation tip
// from the learning module, and we only swap it for a new one once a day.
export function TodaysTipCard() {
  const tip = useQuery({
    queryKey: ['learning', 'tip', 'today'],
    queryFn: () => apiClient.getRandomTip(),
    staleTime: 24 * 60 * 60 * 1000,
  });

  if (!tip.data?.tip) return null;

  const { title, body, source } = tip.data.tip;

  return (
    <aside
      aria-label="Today's tip"
      className="rounded-card border border-border bg-surface-card p-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">Today&apos;s tip</p>
      <h2 className="mt-1 font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
      <p className="mt-3 text-xs text-slate-400">Source: {source}</p>
    </aside>
  );
}
