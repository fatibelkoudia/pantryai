'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@pantryai/shared';
import type { ShoppingItem } from '@pantryai/shared';
import { apiClient } from '@/lib/api';

export default function ShoppingListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['shopping-list'],
    queryFn: () => apiClient.getShoppingList(),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
  }

  function onError(err: unknown) {
    setError(err instanceof ApiClientError ? err.message : t('common.error'));
  }

  const generate = useMutation({
    mutationFn: () => apiClient.generateShoppingList({}),
    onSuccess: invalidate,
    onError,
  });

  const add = useMutation({
    mutationFn: (itemName: string) => apiClient.addShoppingItem({ name: itemName }),
    onSuccess: async () => {
      setName('');
      await invalidate();
    },
    onError,
  });

  const toggle = useMutation({
    mutationFn: (item: ShoppingItem) =>
      apiClient.updateShoppingItem(item.id, { checked: !item.checked }),
    onSuccess: invalidate,
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.deleteShoppingItem(id),
    onSuccess: invalidate,
    onError,
  });

  const items = list.data?.items ?? [];

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (trimmed) add.mutate(trimmed);
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t('shopping.title')}</h1>
        <p className="text-sm text-slate-500">{t('shopping.subtitle')}</p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-expiry-expired">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setError(null);
            generate.mutate();
          }}
          disabled={generate.isPending}
          className="rounded-md bg-brand px-4 py-2 font-medium text-brand-fg disabled:opacity-60"
        >
          {generate.isPending ? t('shopping.generating') : t('shopping.generate')}
        </button>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          aria-label={t('shopping.addItemLabel')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('shopping.addItemPlaceholder')}
          className="flex-1 rounded-md border border-border px-3 py-2"
        />
        <button
          type="submit"
          disabled={add.isPending || !name.trim()}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {t('common.add')}
        </button>
      </form>

      {list.isLoading ? (
        <p role="status" className="text-slate-500">
          {t('shopping.loading')}
        </p>
      ) : list.isError ? (
        <p role="alert" className="text-expiry-expired">
          {t('shopping.loadError')}
        </p>
      ) : items.length === 0 ? (
        <div className="rounded-card border border-dashed border-border p-10 text-center text-slate-500">
          <p>{t('shopping.empty')}</p>
          <p className="mt-1 text-sm">{t('shopping.emptyHint')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-card border border-border bg-surface-card px-4 py-3"
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => toggle.mutate(item)}
                aria-label={
                  item.checked
                    ? t('shopping.markNotBoughtA11y', { name: item.name })
                    : t('shopping.markBoughtA11y', { name: item.name })
                }
                className="h-5 w-5"
              />
              <div className="flex flex-1 flex-col">
                <span className={item.checked ? 'text-slate-400 line-through' : 'font-medium'}>
                  {item.name}
                  {item.quantity != null ? (
                    <span className="text-slate-500">
                      {' '}
                      — {item.quantity}
                      {item.unit ? ` ${item.unit}` : ''}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-slate-400">
                  {t(`shopping.sources.${item.source}`)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => remove.mutate(item.id)}
                aria-label={t('shopping.removeA11y', { name: item.name })}
                className="text-sm text-slate-400 hover:text-expiry-expired"
              >
                {t('common.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
