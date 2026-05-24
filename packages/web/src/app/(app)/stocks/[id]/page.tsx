'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@pantryai/shared';
import type { StockLocation, UpdateStockItemDto } from '@pantryai/shared';
import { ExpirationBadge } from '@/components/ExpirationBadge';
import { apiClient } from '@/lib/api';

const LOCATIONS: StockLocation[] = ['FRIDGE', 'FREEZER', 'PANTRY'];

/** Convert an ISO date string to the `YYYY-MM-DD` a date input expects. */
function toDateInput(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export default function StockDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  const stock = useQuery({
    queryKey: ['stocks', id],
    queryFn: () => apiClient.getStock(id),
  });

  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [expiration, setExpiration] = useState('');
  const [location, setLocation] = useState<StockLocation>('PANTRY');
  const [error, setError] = useState<string | null>(null);

  // Hydrate the form once the item loads.
  useEffect(() => {
    if (stock.data) {
      setQuantity(String(stock.data.quantity));
      setUnit(stock.data.unit);
      setExpiration(toDateInput(stock.data.expirationDate));
      setLocation(stock.data.location);
    }
  }, [stock.data]);

  const update = useMutation({
    mutationFn: (dto: UpdateStockItemDto) => apiClient.updateStock(id, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stocks'] });
      router.push('/stocks');
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : 'Update failed'),
  });

  const remove = useMutation({
    mutationFn: () => apiClient.deleteStock(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stocks'] });
      router.push('/stocks');
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : 'Delete failed'),
  });

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const dto: UpdateStockItemDto = { quantity: Number(quantity), unit, location };
    if (expiration) dto.expirationDate = new Date(expiration).toISOString();
    update.mutate(dto);
  }

  if (stock.isLoading) {
    return (
      <p role="status" className="text-slate-500">
        Loading…
      </p>
    );
  }
  if (stock.isError || !stock.data) {
    return (
      <p role="alert" className="text-expiry-expired">
        Stock item not found.
      </p>
    );
  }

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{stock.data.product.name}</h1>
          {stock.data.product.brand ? (
            <p className="text-slate-500">{stock.data.product.brand}</p>
          ) : null}
        </div>
        <ExpirationBadge expirationDate={stock.data.expirationDate} />
      </header>

      {error ? (
        <p role="alert" className="text-sm text-expiry-expired">
          {error}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="rounded-card border border-border bg-surface-card p-4">
        <h2 className="mb-3 font-semibold">Edit</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="quantity" className="text-sm font-medium">
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              min={0}
              step="any"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="rounded-md border border-border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="unit" className="text-sm font-medium">
              Unit
            </label>
            <input
              id="unit"
              required
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="rounded-md border border-border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="expiration" className="text-sm font-medium">
              Expiration date
            </label>
            <input
              id="expiration"
              type="date"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
              className="rounded-md border border-border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="location" className="text-sm font-medium">
              Location
            </label>
            <select
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value as StockLocation)}
              className="rounded-md border border-border px-3 py-2"
            >
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            disabled={update.isPending}
            className="rounded-md bg-brand px-4 py-2 font-medium text-brand-fg disabled:opacity-60"
          >
            {update.isPending ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="rounded-md border border-expiry-expired px-4 py-2 font-medium text-expiry-expired disabled:opacity-60"
          >
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </form>
    </section>
  );
}
