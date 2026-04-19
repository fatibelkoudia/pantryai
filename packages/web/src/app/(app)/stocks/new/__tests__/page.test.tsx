import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Product } from '@pantryai/shared';

const { push, listProducts, createProduct, createStockItem, getProductByEan13 } = vi.hoisted(
  () => ({
    push: vi.fn(),
    listProducts: vi.fn(),
    createProduct: vi.fn(),
    createStockItem: vi.fn(),
    getProductByEan13: vi.fn(),
  }),
);

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api', () => ({
  apiClient: { listProducts, createProduct, createStockItem, getProductByEan13 },
}));

import NewStockPage from '../page';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Greek Yogurt',
    brand: 'Fage',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NewStockPage />
    </QueryClientProvider>,
  );
}

describe('<NewStockPage /> manual entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searches existing products and selects a match', async () => {
    listProducts.mockResolvedValue({
      items: [makeProduct()],
      meta: { page: 1, limit: 10, total: 1 },
    });

    renderPage();

    fireEvent.change(screen.getByLabelText('Search existing products'), {
      target: { value: 'yog' },
    });

    // debounced search hits the API with the trimmed term
    await waitFor(() => expect(listProducts).toHaveBeenCalledWith({ search: 'yog', limit: 10 }));

    const result = await screen.findByRole('button', { name: /Greek Yogurt/ });
    fireEvent.click(result);

    expect(screen.getByText(/Selected:/)).toBeInTheDocument();
    expect(createProduct).not.toHaveBeenCalled();
  });

  it('creates a new product when nothing matches (F3 fallback)', async () => {
    listProducts.mockResolvedValue({ items: [], meta: { page: 1, limit: 10, total: 0 } });
    createProduct.mockResolvedValue(makeProduct({ id: 'prod-new', name: 'Homemade jam' }));

    renderPage();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Homemade jam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this product' }));

    await waitFor(() => expect(createProduct).toHaveBeenCalledWith({ name: 'Homemade jam' }));

    expect(await screen.findByText(/Homemade jam/)).toBeInTheDocument();
  });

  it('adds the selected product to stock', async () => {
    listProducts.mockResolvedValue({
      items: [makeProduct()],
      meta: { page: 1, limit: 10, total: 1 },
    });
    createStockItem.mockResolvedValue({});

    renderPage();

    fireEvent.change(screen.getByLabelText('Search existing products'), {
      target: { value: 'yog' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Greek Yogurt/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Add to stock' }));

    await waitFor(() =>
      expect(createStockItem).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'prod-1', unit: 'pcs', location: 'PANTRY' }),
      ),
    );
    expect(push).toHaveBeenCalledWith('/stocks');
  });
});
