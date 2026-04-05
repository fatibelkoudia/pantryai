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

function label(days: number | null): string {
  if (days === null) return 'No date';
  if (days < 0) {
    const n = Math.abs(days);
    return `Expired ${n} day${n === 1 ? '' : 's'} ago`;
  }
  if (days === 0) return 'Expires today';
  return `${days} day${days === 1 ? '' : 's'} left`;
}

interface ExpirationBadgeProps {
  expirationDate?: string | undefined;
}

export function ExpirationBadge({ expirationDate }: ExpirationBadgeProps) {
  const days = daysUntil(expirationDate);
  const level = expiryLevel(days);
  const text = label(days);

  return (
    <span
      role="status"
      aria-label={`Expiration: ${text}`}
      data-level={level}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_CLASS[level]}`}
    >
      {text}
    </span>
  );
}
