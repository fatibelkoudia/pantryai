'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { GamificationCard } from '@/components/GamificationCard';
import { StockCard } from '@/components/StockCard';
import { TodaysTipCard } from '@/components/TodaysTipCard';
import { WasteMoodCard } from '@/components/WasteMoodCard';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

// How many expiring items to preview on Home before linking to Inventory.
const EXPIRING_PREVIEW = 6;

export default function HomePage() {
  const { user } = useAuth();
  // user might still be loading, so fall back to a plain hello until we have a name
  const greeting = user?.name ? `Hi, ${user.name}!` : 'Hi there!';

  const expiring = useQuery({
    queryKey: ['stocks', { expiringSoon: true }],
    queryFn: () => apiClient.listStocks({ expiringSoon: true }),
  });

  const expiringItems = expiring.data?.items ?? [];

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{greeting}</h1>
        <p className="text-sm font-semibold text-brand">Waste less. Cook more.</p>
      </header>

      <WasteMoodCard />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GamificationCard />
        <TodaysTipCard />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Expiring soon</h2>
          <Link href="/stocks" className="text-sm font-medium text-brand hover:underline">
            See all
          </Link>
        </div>

        {expiring.isLoading ? (
          <p role="status" className="text-slate-500">
            Loading…
          </p>
        ) : expiringItems.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {expiringItems.slice(0, EXPIRING_PREVIEW).map((item) => (
              <li key={item.id}>
                <StockCard item={item} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-card border border-dashed border-border p-8 text-center text-slate-500">
            Nothing expiring soon. Nice work keeping waste down!
          </div>
        )}
      </div>
    </section>
  );
}
