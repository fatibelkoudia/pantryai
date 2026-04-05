import Link from 'next/link';
import type { StockItemWithProduct } from '@pantryai/shared';
import { ExpirationBadge } from './ExpirationBadge';

const LOCATION_LABEL: Record<string, string> = {
  FRIDGE: 'Fridge',
  FREEZER: 'Freezer',
  PANTRY: 'Pantry',
};

interface StockCardProps {
  item: StockItemWithProduct;
  onDelete?: (id: string) => void;
}

export function StockCard({ item, onDelete }: StockCardProps) {
  const { product } = item;

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
          <dt className="font-medium">Quantity:</dt>
          <dd>
            {item.quantity} {item.unit}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium">Location:</dt>
          <dd>{LOCATION_LABEL[item.location] ?? item.location}</dd>
        </div>
      </dl>

      <div className="mt-2 flex gap-3 text-sm">
        <Link href={`/stocks/${item.id}`} className="font-medium text-brand hover:underline">
          Edit
        </Link>
        {onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="font-medium text-expiry-expired hover:underline"
          >
            Delete
          </button>
        ) : null}
      </div>
    </article>
  );
}
