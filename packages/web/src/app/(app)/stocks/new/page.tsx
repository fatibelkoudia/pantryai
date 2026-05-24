'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@pantryai/shared';
import type { CreateStockItemDto, Product, StockLocation } from '@pantryai/shared';
import { apiClient } from '@/lib/api';

const LOCATIONS: StockLocation[] = ['FRIDGE', 'FREEZER', 'PANTRY'];

export default function NewStockPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Product-by-barcode
  const [ean, setEan] = useState('');
  const [eanLoading, setEanLoading] = useState(false);

  // Inline create
  const [newName, setNewName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [creating, setCreating] = useState(false);

  // Stock fields
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [expiration, setExpiration] = useState('');
  const [location, setLocation] = useState<StockLocation>('PANTRY');
  const [saving, setSaving] = useState(false);

  async function lookupByEan() {
    if (!ean.trim()) return;
    setEanLoading(true);
    setError(null);
    try {
      const found = await apiClient.getProductByEan13(ean.trim());
      setProduct(found);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Product lookup failed');
    } finally {
      setEanLoading(false);
    }
  }

  async function createProduct() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await apiClient.createProduct({
        name: newName.trim(),
        ...(newBrand.trim() ? { brand: newBrand.trim() } : {}),
      });
      setProduct(created);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not create product');
    } finally {
      setCreating(false);
    }
  }

  async function addToStock(event: React.FormEvent) {
    event.preventDefault();
    if (!product) return;
    setSaving(true);
    setError(null);
    try {
      const dto: CreateStockItemDto = {
        productId: product.id,
        quantity: Number(quantity),
        unit,
        location,
      };
      if (expiration) dto.expirationDate = new Date(expiration).toISOString();
      await apiClient.createStockItem(dto);
      await queryClient.invalidateQueries({ queryKey: ['stocks'] });
      router.push('/stocks');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not add to stock');
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-bold">Add a stock item</h1>

      {error ? (
        <p role="alert" className="text-sm text-expiry-expired">
          {error}
        </p>
      ) : null}

      {/* Step 1 — choose a product */}
      <div className="rounded-card border border-border bg-surface-card p-4">
        <h2 className="mb-3 font-semibold">1. Choose a product</h2>

        {product ? (
          <div className="flex items-center justify-between gap-2 rounded-md bg-green-50 px-3 py-2 text-sm">
            <span>
              Selected: <strong>{product.name}</strong>
              {product.brand ? ` — ${product.brand}` : ''}
            </span>
            <button
              type="button"
              onClick={() => setProduct(null)}
              className="font-medium text-brand hover:underline"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <label htmlFor="ean" className="text-sm font-medium">
                Find by barcode (EAN-13)
              </label>
              <div className="flex gap-2">
                <input
                  id="ean"
                  inputMode="numeric"
                  value={ean}
                  onChange={(e) => setEan(e.target.value)}
                  className="flex-1 rounded-md border border-border px-3 py-2"
                  placeholder="3033490004934"
                />
                <button
                  type="button"
                  onClick={() => void lookupByEan()}
                  disabled={eanLoading}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {eanLoading ? 'Looking up…' : 'Look up'}
                </button>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-2 text-sm text-slate-500">Or create a new product</p>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="new-name" className="text-sm font-medium">
                    Name
                  </label>
                  <input
                    id="new-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="rounded-md border border-border px-3 py-2"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="new-brand" className="text-sm font-medium">
                    Brand <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="new-brand"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    className="rounded-md border border-border px-3 py-2"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void createProduct()}
                  disabled={creating || !newName.trim()}
                  className="self-start rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {creating ? 'Creating…' : 'Use this product'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 2 — stock details */}
      <form onSubmit={addToStock} className="rounded-card border border-border bg-surface-card p-4">
        <h2 className="mb-3 font-semibold">2. Stock details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="quantity" className="text-sm font-medium">
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              min={0}
              step="any"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="rounded-md border border-border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="unit" className="text-sm font-medium">
              Unit
            </label>
            <input
              id="unit"
              required
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="rounded-md border border-border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="expiration" className="text-sm font-medium">
              Expiration date <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="expiration"
              type="date"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
              className="rounded-md border border-border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="location" className="text-sm font-medium">
              Location
            </label>
            <select
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value as StockLocation)}
              className="rounded-md border border-border px-3 py-2"
            >
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={!product || saving}
          className="mt-4 rounded-md bg-brand px-4 py-2 font-medium text-brand-fg disabled:opacity-60"
        >
          {saving ? 'Adding…' : 'Add to stock'}
        </button>
      </form>
    </section>
  );
}
