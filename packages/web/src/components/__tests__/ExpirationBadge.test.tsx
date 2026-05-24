import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExpirationBadge, daysUntil, expiryLevel } from '../ExpirationBadge';

function isoInDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

describe('daysUntil / expiryLevel', () => {
  it('returns null for no date', () => {
    expect(daysUntil(undefined)).toBeNull();
    expect(expiryLevel(null)).toBe('none');
  });

  it('classifies far future as ok (>7d)', () => {
    expect(expiryLevel(daysUntil(isoInDays(30)))).toBe('ok');
  });

  it('classifies within 7 days as soon', () => {
    expect(expiryLevel(daysUntil(isoInDays(3)))).toBe('soon');
  });

  it('classifies today as soon', () => {
    expect(daysUntil(isoInDays(0))).toBe(0);
    expect(expiryLevel(0)).toBe('soon');
  });

  it('classifies past dates as expired', () => {
    expect(expiryLevel(daysUntil(isoInDays(-2)))).toBe('expired');
  });
});

describe('<ExpirationBadge />', () => {
  it('renders green (ok) for >7 days', () => {
    render(<ExpirationBadge expirationDate={isoInDays(30)} />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('data-level', 'ok');
    expect(badge).toHaveTextContent(/days left/);
  });

  it('renders yellow (soon) for <=7 days', () => {
    render(<ExpirationBadge expirationDate={isoInDays(3)} />);
    expect(screen.getByRole('status')).toHaveAttribute('data-level', 'soon');
  });

  it('renders red (expired) for past dates', () => {
    render(<ExpirationBadge expirationDate={isoInDays(-2)} />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('data-level', 'expired');
    expect(badge).toHaveTextContent(/Expired/);
  });

  it('renders neutral "No date" when no date provided', () => {
    render(<ExpirationBadge />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('data-level', 'none');
    expect(badge).toHaveTextContent('No date');
    expect(badge).toHaveAttribute('aria-label', 'Expiration: No date');
  });
});
