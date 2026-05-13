// We send this out whenever a stock item gets removed. The gamification module
// listens for it so it can re-check the user's challenge progress.
export const STOCK_REMOVED = 'stock.removed';

export interface StockRemovedEvent {
  userId: string;
}
