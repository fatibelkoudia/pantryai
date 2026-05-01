export type ShoppingItemSource = 'LOW_STOCK' | 'RECIPE' | 'MANUAL';

export interface ShoppingItem {
  id: string;
  userId: string;
  name: string;
  quantity?: number;
  unit?: string;
  checked: boolean;
  source: ShoppingItemSource;
  createdAt: string;
}

export interface CreateShoppingItemDto {
  name: string;
  quantity?: number;
  unit?: string;
}

export interface UpdateShoppingItemDto {
  name?: string;
  quantity?: number;
  unit?: string;
  checked?: boolean;
}

export interface GenerateShoppingListDto {
  /**
   * Recipes whose missing ingredients should be added. When omitted, the server
   * falls back to the user's auto-suggested recipes (>= 70% match).
   */
  recipeIds?: string[];
  /**
   * Stock items at or below this quantity count as "low stock". Defaults to 1.
   */
  lowStockThreshold?: number;
}

export interface ShoppingListResponse {
  items: ShoppingItem[];
}
