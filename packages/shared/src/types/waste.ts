// Waste Level: a 0-100 score of how much of the user's food gets eaten vs. wasted,
// and a mood for the Trashy mascot derived from it. See the api `waste` module for
// the scoring and DEV_PLAN.md section 4.3b / 5.3 for the agreed formula.

// How a stock item left the pantry. Set when an item is removed.
export type StockDisposition = 'CONSUMED' | 'DISCARDED' | 'EXPIRED';

// Trashy's five moods, best to worst.
export type WasteMood = 'EXCELLENT' | 'GOOD' | 'OKAY' | 'BAD' | 'AWFUL';

export interface WasteCounts {
  consumed: number;
  discarded: number;
  expired: number;
  total: number;
}

export interface WasteLevelResponse {
  // 0-100, higher is better (less waste). 100 when there's nothing resolved yet.
  score: number;
  mood: WasteMood;
  window: { days: number; from: string; to: string };
  counts: WasteCounts;
}
