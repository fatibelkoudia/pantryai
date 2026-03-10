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
