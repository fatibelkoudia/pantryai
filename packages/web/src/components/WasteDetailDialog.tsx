'use client';

import { useQuery } from '@tanstack/react-query';
import type { WasteCounts, WasteResolvedItem } from '@pantryai/shared';
import { apiClient } from '@/lib/api';

export type WasteDetailType = 'used' | 'tossed' | 'co2';

const TITLES: Record<WasteDetailType, string> = {
  used: 'Items used',
  tossed: 'Thrown out',
  co2: 'CO2 avoided',
};

// Readable names for the CO2 factor table categories.
const CATEGORY_LABELS: Record<string, string> = {
  viande: 'Meat',
  'produits-laitiers': 'Dairy',
  cereales: 'Grains',
  fruits: 'Fruit',
  legumes: 'Vegetables',
};

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS_SHORT[d.getMonth()] ?? '?'} ${d.getDate()}`;
}

function ItemRow({ item, right }: { item: WasteResolvedItem; right?: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
        <p className="text-xs text-slate-500">
          {item.quantity} {item.unit} · {shortDate(item.resolvedAt)}
        </p>
      </div>
      {item.rescued ? (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
          Rescue
        </span>
      ) : null}
      {right ? <span className="text-xs font-bold text-slate-700">{right}</span> : null}
    </li>
  );
}

interface WasteDetailDialogProps {
  type: WasteDetailType;
  counts: WasteCounts;
  rescuedCount: number;
  onClose: () => void;
}

// The "how is this number made" dialog behind the mood card figures. Same
// hand-rolled dialog approach as the receipt review modal.
export function WasteDetailDialog({ type, counts, rescuedCount, onClose }: WasteDetailDialogProps) {
  const details = useQuery({
    queryKey: ['waste', 'items'],
    queryFn: () => apiClient.getWasteItems(),
  });

  const items = details.data?.items ?? [];
  const used = items.filter((i) => i.disposition === 'CONSUMED');
  const tossed = items.filter((i) => i.disposition !== 'CONSUMED');
  const co2Info = details.data?.co2Info;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={TITLES[type]}
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{TITLES[type]}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full px-2 text-xl text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        </div>

        {details.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : type === 'used' ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">
              Everything you marked as used in the last 30 days. Rescues (items eaten with 3 days or
              less left before expiry) count extra toward Trashy&apos;s mood.
            </p>
            {rescuedCount > 0 ? (
              <p className="text-sm font-bold text-emerald-800">
                {rescuedCount} of them {rescuedCount === 1 ? 'was a rescue' : 'were rescues'}. Nice
                save!
              </p>
            ) : null}
            {used.length === 0 ? (
              <p className="text-xs text-slate-500">Nothing used yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {used.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </div>
        ) : type === 'tossed' ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">
              Items that got thrown out or expired in the last 30 days. Both count as waste and pull
              the score down, and fresher waste weighs more than old waste.
            </p>
            <p className="text-sm font-bold text-slate-800">
              {counts.discarded} thrown out · {counts.expired} expired
            </p>
            {tossed.length === 0 ? (
              <p className="text-xs text-slate-500">Nothing wasted. Trashy approves!</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {tossed.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    right={item.disposition === 'EXPIRED' ? 'expired' : 'tossed'}
                  />
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">
              Producing food costs CO2, so every item you eat instead of tossing is production CO2
              that wasn&apos;t wasted. We turn each item into kilograms (a piece counts as{' '}
              {co2Info ? co2Info.pieceWeightKg * 1000 : 250} g) and multiply by its category&apos;s
              factor.
            </p>
            {used.length === 0 ? (
              <p className="text-xs text-slate-500">Use some items to start saving CO2.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {used.map((item) => (
                  <ItemRow key={item.id} item={item} right={`${item.co2Kg ?? 0} kg`} />
                ))}
              </ul>
            )}
            {co2Info ? (
              <div>
                <p className="mb-1 text-sm font-bold text-slate-800">
                  Factors (kg CO2 per kg of food)
                </p>
                <dl className="flex flex-col gap-1">
                  {Object.entries(co2Info.perKgByCategory).map(([key, factor]) => (
                    <div key={key} className="flex justify-between text-xs text-slate-600">
                      <dt>{CATEGORY_LABELS[key] ?? key}</dt>
                      <dd className="font-bold text-slate-800">{factor}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs text-slate-600">
                    <dt>Anything else</dt>
                    <dd className="font-bold text-slate-800">{co2Info.perKgDefault}</dd>
                  </div>
                </dl>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
