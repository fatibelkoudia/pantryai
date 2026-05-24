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

export type UpdateStockItemDto = Partial<CreateStockItemDto>;

export interface StockQuery {
  page?: number;
  limit?: number;
  expiringSoon?: boolean;
  location?: StockLocation;
  search?: string;
}
