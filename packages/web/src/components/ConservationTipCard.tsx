'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resolveTipCategory } from '@pantryai/shared';
import type { Product } from '@pantryai/shared';
import { apiClient } from '@/lib/api';

const DISABLED_KEY = 'pantryai:tips-disabled';

// true if the user turned tips off on this device before
function tipsDisabled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(DISABLED_KEY) === 'true';
}

interface ConservationTipCardProps {
  product: Pick<Product, 'name' | 'category'>;
}

// Shows one conservation tip for a product on the stock item page. We try to match
// the product to a category so the tip is relevant. The user can hide it for now
// or turn tips off for good (risk F5), and we remember that in localStorage.
export function ConservationTipCard({ product }: ConservationTipCardProps) {
  // Read the stored preference once on mount. Defaults to enabled.
  const [disabled, setDisabled] = useState<boolean>(tipsDisabled);
  const [dismissed, setDismissed] = useState(false);

  const category = resolveTipCategory(product);

  const tip = useQuery({
    queryKey: ['learning', 'tip', category ?? 'any'],
    queryFn: () => apiClient.getRandomTip(category ?? undefined),
    enabled: !disabled && !dismissed,
    staleTime: 60 * 60 * 1000,
  });

  if (disabled || dismissed) return null;
  if (!tip.data?.tip) return null;

  const { title, body, source } = tip.data.tip;

  function disableTips() {
    window.localStorage.setItem(DISABLED_KEY, 'true');
    setDisabled(true);
  }

  return (
    <aside
      aria-label="Conservation tip"
      className="rounded-card border border-border bg-surface-card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Conservation tip</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss tip"
          className="text-sm text-slate-400 hover:text-slate-600"
        >
          Dismiss
        </button>
      </div>
      <h2 className="mt-1 font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">Source: {source}</p>
        <button
          type="button"
          onClick={disableTips}
          className="text-xs text-slate-400 underline hover:text-slate-600"
        >
          Don&apos;t show tips
        </button>
      </div>
    </aside>
  );
}
