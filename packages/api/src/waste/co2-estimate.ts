import { resolveTipCategory, type TipCategory } from '@pantryai/shared';

// Roughly how much CO2 (in kg) it takes to produce 1 kg of food, per category.
// The numbers are averages we took from ADEME's Agribalyse dataset
// (agribalyse.ademe.fr): meat is by far the heaviest, dairy is in the middle,
// fruit and veg are light. Exported so /waste/items can show the user how the
// estimate is calculated.
export const CO2_PER_KG: Record<TipCategory, number> = {
  viande: 12,
  'produits-laitiers': 3.2,
  cereales: 1.2,
  fruits: 0.6,
  legumes: 0.5,
};

// When we can't tell what a product is, assume a mixed-basket average.
export const CO2_PER_KG_DEFAULT = 1.8;

// Rough average weight of one grocery "piece" (an apple, a yogurt cup...).
export const PIECE_WEIGHT_KG = 0.25;

// Turn "500 g" / "1 L" / "2 pcs" into kilograms. We pretend liquids weigh 1 kg
// per liter, which is close enough for a rough estimate.
function toKg(quantity: number, unit: string): number {
  const u = unit.trim().toLowerCase();
  if (u === 'kg' || u === 'l') return quantity;
  if (u === 'g' || u === 'ml') return quantity / 1000;
  if (u === 'cl') return quantity / 100;
  return quantity * PIECE_WEIGHT_KG; // pcs, packs, cups...
}

export interface ConsumedItemForCo2 {
  quantity: number;
  unit: string;
  product: { name?: string | undefined; category?: string | undefined };
}

// The raw (unrounded) estimate for a single item.
function itemCo2Raw(item: ConsumedItemForCo2): number {
  const category = resolveTipCategory(item.product);
  const factor = category ? CO2_PER_KG[category] : CO2_PER_KG_DEFAULT;
  return toKg(item.quantity, item.unit) * factor;
}

// The estimate for one item, rounded to a decimal, for the per-item breakdown.
export function estimateCo2ItemKg(item: ConsumedItemForCo2): number {
  return Math.round(itemCo2Raw(item) * 10) / 10;
}

// Producing food costs CO2, so every item that gets eaten instead of tossed is
// CO2 that wasn't wasted. We keep it simple like the recipe scoring: category
// keywords + fixed factors, no external calls, same items always give the same
// number.
export function estimateCo2AvoidedKg(items: ConsumedItemForCo2[]): number {
  let total = 0;
  for (const item of items) {
    total += itemCo2Raw(item);
  }
  // one decimal is plenty for a rough estimate
  return Math.round(total * 10) / 10;
}
