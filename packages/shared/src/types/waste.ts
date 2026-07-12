// Waste Level: a 0-100 score of how much of the user's food gets eaten vs. wasted,
// and a mood for the Trashy mascot derived from it. See the api `waste` module for
// the scoring and DEV_PLAN.md section 4.3b / 5.3 for the agreed formula.

// How a stock item left the pantry. Set when an item is removed.
export type StockDisposition = 'CONSUMED' | 'DISCARDED' | 'EXPIRED';

// Trashy's five moods, best to worst.
export type WasteMood = 'EXCELLENT' | 'GOOD' | 'OKAY' | 'BAD' | 'AWFUL';

// Is the user doing better or worse lately? Compares the last 7 days to the
// rest of the window.
export type WasteTrend = 'IMPROVING' | 'STEADY' | 'WORSENING';

// The score bands for each mood, best to worst. min is the band floor.
// The api mood logic and the client progress bars both read this, so they
// can't end up with different thresholds.
export const wasteMoodBands: readonly { mood: WasteMood; min: number }[] = [
  { mood: 'EXCELLENT', min: 90 },
  { mood: 'GOOD', min: 70 },
  { mood: 'OKAY', min: 50 },
  { mood: 'BAD', min: 30 },
  { mood: 'AWFUL', min: 0 },
];

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
  // Rough estimate of the production CO2 (kg) saved by eating items instead of
  // tossing them. Agribalyse category averages; see the api waste/co2-estimate.
  co2AvoidedKg: number;
  // The next mood up, or null when already EXCELLENT.
  nextMood: WasteMood | null;
  // How many more consumed items would reach that next mood ("use ~N more items").
  // Computed on the server because the score is recency-weighted.
  // Null when already EXCELLENT, or when the pantry blocks it (see pantryBlocked).
  itemsToNextMood: number | null;
  // True when the next mood can't be reached by eating alone: the expired and
  // expiring items in stock drag the score too much, deal with those first.
  pantryBlocked: boolean;
  // The state of the pantry right now, 30% of the score.
  pantry: {
    total: number; // items currently in stock
    expired: number; // already past their date
    expiringSoon: number; // expiring within 3 days
    score: number; // 0-100, 100 = nothing at risk
  };
  // How many consumed items in the window were rescues (eaten with 3 days or
  // less left before expiry). Rescues count extra in the score.
  rescuedCount: number;
  // Last 7 days vs days 8-30. Null when either side has no items yet.
  trend: WasteTrend | null;
  // Score per week for the last 4 weeks, oldest first. Null = no items that week.
  weeklyScores: (number | null)[];
}

// One resolved item from the waste window, for the stat card detail sheets.
export interface WasteResolvedItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  unit: string;
  disposition: StockDisposition;
  resolvedAt: string;
  expirationDate: string | null;
  rescued: boolean;
  // kg of CO2 production avoided by eating it. Only set for consumed items.
  co2Kg: number | null;
}

export interface WasteItemsResponse {
  // newest first, capped at 200 (the window is 30 days so the cap rarely matters)
  items: WasteResolvedItem[];
  // the numbers behind the CO2 estimate, so the UI can show how it's calculated
  co2Info: {
    perKgByCategory: Record<string, number>;
    perKgDefault: number;
    pieceWeightKg: number;
  };
}

// One month of history for the all-time view.
export interface WasteMonth {
  month: string; // 'YYYY-MM'
  score: number | null; // plain unweighted score; null = nothing resolved that month
  consumed: number;
  discarded: number;
  expired: number;
}

export interface WasteHistoryResponse {
  // oldest first, from the first resolved item (capped at 24 months) to now
  months: WasteMonth[];
}
