'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StockDisposition, StockLocation, StockQuery } from '@pantryai/shared';
import { StockCard } from '@/components/StockCard';
import { apiClient } from '@/lib/api';

const LOCATION_TABS: (StockLocation | 'ALL')[] = ['ALL', 'FRIDGE', 'FREEZER', 'PANTRY'];

export default function StocksPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<StockLocation | 'ALL'>('ALL');
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce the search input so we don't query on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const query: StockQuery = {};
  if (location !== 'ALL') query.location = location;
  if (expiringSoon) query.expiringSoon = true;
  if (search) query.search = search;

  const stocks = useQuery({
    queryKey: ['stocks', query],
    queryFn: () => apiClient.listStocks(query),
  });

  const remove = useMutation({
    mutationFn: ({ id, disposition }: { id: string; disposition: StockDisposition }) =>
      apiClient.deleteStock(id, disposition),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      // Resolving an item changes the Waste Level, so refresh Trashy's mood too.
      queryClient.invalidateQueries({ queryKey: ['waste'] });
      // It can also complete a challenge (e.g. Use It All), so refresh XP/challenges.
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
    },
  });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('stock.inventory')}</h1>
        <Link
          href="/stocks/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg"
        >
          {t('stock.addItem')}
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <div role="tablist" aria-label={t('stock.filterByLocationA11y')} className="flex gap-1">
          {LOCATION_TABS.map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={location === tab}
              onClick={() => setLocation(tab)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                location === tab ? 'bg-brand text-brand-fg' : 'border border-border'
              }`}
            >
              {t(`locations.${tab}`)}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={expiringSoon}
            onChange={(e) => setExpiringSoon(e.target.checked)}
          />
          {t('stock.expiringFilter')}
        </label>

        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="search" className="sr-only">
            {t('stock.searchNameLabel')}
          </label>
          <input
            id="search"
            type="search"
            placeholder={t('stock.searchNamePlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {stocks.isLoading ? (
        <p role="status" className="text-slate-500">
          {t('stock.loading')}
        </p>
      ) : stocks.isError ? (
        <p role="alert" className="text-expiry-expired">
          {t('stock.loadError')}
        </p>
      ) : stocks.data && stocks.data.items.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stocks.data.items.map((item) => (
            <li key={item.id}>
              <StockCard
                item={item}
                onRemove={(id, disposition) => remove.mutate({ id, disposition })}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-card border border-dashed border-border p-10 text-center text-slate-500">
          <p>{t('stock.empty')}</p>
          <Link
            href="/stocks/new"
            className="mt-2 inline-block font-medium text-brand hover:underline"
          >
            {t('stock.addFirst')}
          </Link>
        </div>
      )}
    </section>
  );
}
