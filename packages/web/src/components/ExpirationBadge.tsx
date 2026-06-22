'use client';

import { useTranslation } from 'react-i18next';

export type ExpiryLevel = 'ok' | 'soon' | 'expired' | 'none';

/** Whole days from now until `dateIso` (negative = past). Returns null when no date. */
export function daysUntil(dateIso: string | undefined, now: Date = new Date()): number | null {
  if (!dateIso) return null;
  const target = new Date(dateIso);
  if (Number.isNaN(target.getTime())) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startOfTarget = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
  );
  return Math.round((startOfTarget - startOfToday) / msPerDay);
}

export function expiryLevel(days: number | null): ExpiryLevel {
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= 7) return 'soon';
  return 'ok';
}

const LEVEL_CLASS: Record<ExpiryLevel, string> = {
  ok: 'bg-expiry-ok-bg text-expiry-ok',
  soon: 'bg-expiry-soon-bg text-expiry-soon',
  expired: 'bg-expiry-expired-bg text-expiry-expired',
  none: 'bg-expiry-none-bg text-expiry-none',
};

interface ExpirationBadgeProps {
  expirationDate?: string | undefined;
}

export function ExpirationBadge({ expirationDate }: ExpirationBadgeProps) {
  const { t } = useTranslation();
  const days = daysUntil(expirationDate);
  const level = expiryLevel(days);

  let text: string;
  if (days === null) text = t('expiry.noDate');
  else if (days < 0) text = t('expiry.expiredAgo', { count: Math.abs(days) });
  else if (days === 0) text = t('expiry.today');
  else text = t('expiry.daysLeft', { count: days });

  return (
    <span
      role="status"
      aria-label={t('expiry.a11y', { text })}
      data-level={level}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_CLASS[level]}`}
    >
      {text}
    </span>
  );
}
