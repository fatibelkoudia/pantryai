'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { TipCategory } from '@pantryai/shared';
import { TIP_CATEGORIES } from '@pantryai/shared';
import { apiClient } from '@/lib/api';

type Filter = TipCategory | 'all';

export default function LearnPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');

  const tips = useQuery({
    queryKey: ['learning', 'tips', filter],
    queryFn: () => apiClient.getTips(filter === 'all' ? undefined : filter),
  });

  const items = tips.data?.tips ?? [];

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t('learn.title')}</h1>
        <p className="text-sm text-slate-500">{t('learn.tipsSubtitle')}</p>
      </header>

      <div role="tablist" aria-label={t('learn.filterTipsA11y')} className="flex flex-wrap gap-2">
        {(['all', ...TIP_CATEGORIES] as Filter[]).map((cat) => {
          const active = filter === cat;
          return (
            <button
              key={cat}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(cat)}
              className={`rounded-full px-4 py-1 text-sm font-medium ${
                active ? 'bg-brand text-brand-fg' : 'border border-border'
              }`}
            >
              {t(`learn.categories.${cat}`)}
            </button>
          );
        })}
      </div>

      {tips.isLoading ? (
        <p role="status" className="text-slate-500">
          {t('learn.tipsLoading')}
        </p>
      ) : tips.isError ? (
        <p role="alert" className="text-expiry-expired">
          {t('learn.tipsError')}
        </p>
      ) : items.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((tip) => (
            <li
              key={tip.id}
              className="flex flex-col gap-1 rounded-card border border-border bg-surface-card p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">
                {t(`learn.categories.${tip.category}`)}
              </p>
              <h2 className="font-semibold">{tip.title}</h2>
              <p className="text-sm text-slate-600">{tip.body}</p>
              <p className="mt-2 text-xs text-slate-400">
                {t('tip.source', { source: tip.source })}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500">{t('learn.tipsEmpty')}</p>
      )}
    </section>
  );
}
