'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { StockDisposition, StockItemWithProduct } from '@pantryai/shared';
import { ExpirationBadge } from './ExpirationBadge';

interface StockCardProps {
  item: StockItemWithProduct;
  onRemove?: (id: string, disposition: StockDisposition) => void;
}

export function StockCard({ item, onRemove }: StockCardProps) {
  const { product } = item;
  const { t } = useTranslation();

  return (
    <article className="flex flex-col gap-2 rounded-card border border-border bg-surface-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold">
          <Link href={`/stocks/${item.id}`} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        <ExpirationBadge expirationDate={item.expirationDate} />
      </div>

      {product.brand ? <p className="text-sm text-slate-500">{product.brand}</p> : null}

      <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700">
        <div className="flex gap-1">
          <dt className="font-medium">{t('stock.quantity')}:</dt>
          <dd>
            {item.quantity} {item.unit}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium">{t('stock.location')}:</dt>
          <dd>{t(`locations.${item.location}`)}</dd>
        </div>
      </dl>

      <div className="mt-2 flex flex-wrap gap-3 text-sm">
        <Link href={`/stocks/${item.id}`} className="font-medium text-brand hover:underline">
          {t('common.edit')}
        </Link>
        {onRemove ? (
          <>
            <button
              type="button"
              onClick={() => onRemove(item.id, 'CONSUMED')}
              className="font-medium text-brand hover:underline"
            >
              {t('stock.usedIt')}
            </button>
            <button
              type="button"
              onClick={() => onRemove(item.id, 'DISCARDED')}
              className="font-medium text-expiry-expired hover:underline"
            >
              {t('stock.threwOut')}
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}
