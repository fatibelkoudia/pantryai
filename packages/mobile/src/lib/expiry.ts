import { expiry } from '../theme';

export type ExpiryLevel = 'ok' | 'soon' | 'expired' | 'none';

// how many days until the date (negative means it already passed), null if there's no date
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

export function expiryLabel(days: number | null): string {
  if (days === null) return 'No date';
  if (days < 0) {
    const n = Math.abs(days);
    return `Expired ${n}d ago`;
  }
  if (days === 0) return 'Today';
  return `${days}d left`;
}

// badge colors from the shared Trashy tokens (same roles as the web app)
export const EXPIRY_COLORS: Record<ExpiryLevel, { bg: string; fg: string }> = {
  ok: expiry.ok,
  soon: expiry.soon,
  expired: expiry.expired,
  none: expiry.none,
};
