import type { Product } from './product.js';

export type StockLocation = 'FRIDGE' | 'FREEZER' | 'PANTRY';

export interface StockItem {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  unit: string;
  expirationDate?: string;
  location: StockLocation;
  addedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStockItemDto {
  productId: string;
  quantity: number;
  unit: string;
  expirationDate?: string;
  location?: StockLocation;
}

/** Stock item as returned by the API, with its joined product. */
export interface StockItemWithProduct extends StockItem {
  product: Product;
}

// Fields you can change on a stock item. For the date: a string sets it,
// null removes it, and leaving it out keeps the current date.
export type UpdateStockItemDto = Partial<Omit<CreateStockItemDto, 'expirationDate'>> & {
  expirationDate?: string | null;
};

export interface StockQuery {
  page?: number;
  limit?: number;
  expiringSoon?: boolean;
  location?: StockLocation;
  search?: string;
}
