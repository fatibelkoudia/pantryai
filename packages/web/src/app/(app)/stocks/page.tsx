'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StockDisposition, StockLocation, StockQuery } from '@pantryai/shared';
import { GamificationCard } from '@/components/GamificationCard';
import { StockCard } from '@/components/StockCard';
import { TodaysTipCard } from '@/components/TodaysTipCard';
import { WasteMoodCard } from '@/components/WasteMoodCard';
import { apiClient } from '@/lib/api';

const LOCATION_TABS: { value: StockLocation | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'FRIDGE', label: 'Fridge' },
  { value: 'FREEZER', label: 'Freezer' },
  { value: 'PANTRY', label: 'Pantry' },
];

export default function StocksPage() {
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
      <WasteMoodCard />
      <GamificationCard />
      <TodaysTipCard />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">My stock</h1>
        <Link
          href="/stocks/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg"
        >
          Add item
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <div role="tablist" aria-label="Filter by location" className="flex gap-1">
          {LOCATION_TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={location === tab.value}
              onClick={() => setLocation(tab.value)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                location === tab.value ? 'bg-brand text-brand-fg' : 'border border-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={expiringSoon}
            onChange={(e) => setExpiringSoon(e.target.checked)}
          />
          Expiring soon (≤7 days)
        </label>

        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="search" className="sr-only">
            Search by product name
          </label>
          <input
            id="search"
            type="search"
            placeholder="Search by product name…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {stocks.isLoading ? (
        <p role="status" className="text-slate-500">
          Loading your stock…
        </p>
      ) : stocks.isError ? (
        <p role="alert" className="text-expiry-expired">
          Could not load stock. Please try again.
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
          <p>No stock items yet.</p>
          <Link
            href="/stocks/new"
            className="mt-2 inline-block font-medium text-brand hover:underline"
          >
            Add your first item
          </Link>
        </div>
      )}
    </section>
  );
}
