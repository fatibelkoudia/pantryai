'use client';

'use client';

import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useQuery } from '@tanstack/react-query';
import type { WasteCounts, WasteResolvedItem } from '@pantryai/shared';
import { apiClient } from '@/lib/api';

export type WasteDetailType = 'used' | 'tossed' | 'co2';

const TITLE_KEYS: Record<WasteDetailType, string> = {
  used: 'waste.detail.usedTitle',
  tossed: 'waste.detail.tossedTitle',
  co2: 'waste.detail.co2Title',
};

function shortDate(iso: string, t: TFunction): string {
  const d = new Date(iso);
  return `${t(`waste.months.${d.getMonth()}`)} ${d.getDate()}`;
}

function ItemRow({ item, right }: { item: WasteResolvedItem; right?: string }) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
        <p className="text-xs text-slate-500">
          {item.quantity} {item.unit} · {shortDate(item.resolvedAt, t)}
        </p>
      </div>
      {item.rescued ? (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
          {t('waste.detail.rescue')}
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
  const { t } = useTranslation();
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
        aria-label={t(TITLE_KEYS[type])}
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{t(TITLE_KEYS[type])}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-full px-2 text-xl text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        </div>

        {details.isLoading ? (
          <p className="text-sm text-slate-500">{t('common.loading')}</p>
        ) : type === 'used' ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">{t('waste.detail.usedIntro')}</p>
            {rescuedCount > 0 ? (
              <p className="text-sm font-bold text-emerald-800">
                {t('waste.detail.rescueLine', { count: rescuedCount })}
              </p>
            ) : null}
            {used.length === 0 ? (
              <p className="text-xs text-slate-500">{t('waste.detail.nothingUsed')}</p>
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
            <p className="text-sm text-slate-600">{t('waste.detail.tossedIntro')}</p>
            <p className="text-sm font-bold text-slate-800">
              {t('waste.tossedCount', { discarded: counts.discarded, expired: counts.expired })}
            </p>
            {tossed.length === 0 ? (
              <p className="text-xs text-slate-500">{t('waste.detail.nothingWasted')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {tossed.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    right={
                      item.disposition === 'EXPIRED'
                        ? t('waste.detail.expiredTag')
                        : t('waste.detail.tossedTag')
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">
              {t('waste.detail.co2Intro', {
                grams: co2Info ? co2Info.pieceWeightKg * 1000 : 250,
              })}
            </p>
            {used.length === 0 ? (
              <p className="text-xs text-slate-500">{t('waste.detail.co2Empty')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {used.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    right={t('waste.detail.kg', { count: item.co2Kg ?? 0 })}
                  />
                ))}
              </ul>
            )}
            {co2Info ? (
              <div>
                <p className="mb-1 text-sm font-bold text-slate-800">
                  {t('waste.detail.factorsTitle')}
                </p>
                <dl className="flex flex-col gap-1">
                  {Object.entries(co2Info.perKgByCategory).map(([key, factor]) => (
                    <div key={key} className="flex justify-between text-xs text-slate-600">
                      <dt>{t(`waste.co2Categories.${key}`, { defaultValue: key })}</dt>
                      <dd className="font-bold text-slate-800">{factor}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs text-slate-600">
                    <dt>{t('waste.detail.anythingElse')}</dt>
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
