export interface StockItem {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  unit: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStockItemDto {
  productId: string;
  quantity: number;
  unit: string;
  expiresAt?: string;
}
