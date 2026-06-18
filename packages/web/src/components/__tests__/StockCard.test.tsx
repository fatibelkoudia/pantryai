import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { StockItemWithProduct } from '@pantryai/shared';
import { StockCard } from '../StockCard';

function isoInDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

const item: StockItemWithProduct = {
  id: 'stock-1',
  userId: 'user-1',
  productId: 'prod-1',
  quantity: 2,
  unit: 'kg',
  expirationDate: isoInDays(10),
  location: 'FRIDGE',
  addedAt: isoInDays(-1),
  createdAt: isoInDays(-1),
  updatedAt: isoInDays(-1),
  product: {
    id: 'prod-1',
    name: 'Greek Yogurt',
    brand: 'Fage',
    createdAt: isoInDays(-1),
    updatedAt: isoInDays(-1),
  },
};

describe('<StockCard />', () => {
  it('renders product name, brand, quantity/unit, location and a badge', () => {
    render(<StockCard item={item} />);

    expect(screen.getByRole('heading', { name: 'Greek Yogurt' })).toBeInTheDocument();
    expect(screen.getByText('Fage')).toBeInTheDocument();
    expect(screen.getByText('2 kg')).toBeInTheDocument();
    expect(screen.getByText('Fridge')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('data-level', 'ok');
  });

  it('links to the detail page', () => {
    render(<StockCard item={item} />);
    const links = screen.getAllByRole('link');
    expect(links.some((a) => a.getAttribute('href') === '/stocks/stock-1')).toBe(true);
  });

  it('calls onRemove with CONSUMED when "Used it" is clicked', () => {
    const onRemove = vi.fn();
    render(<StockCard item={item} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Used it' }));
    expect(onRemove).toHaveBeenCalledWith('stock-1', 'CONSUMED');
  });

  it('calls onRemove with DISCARDED when "Threw it out" is clicked', () => {
    const onRemove = vi.fn();
    render(<StockCard item={item} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Threw it out' }));
    expect(onRemove).toHaveBeenCalledWith('stock-1', 'DISCARDED');
  });
});
