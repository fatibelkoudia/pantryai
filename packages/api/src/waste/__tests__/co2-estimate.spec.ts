import { describe, expect, it } from 'vitest';
import { estimateCo2AvoidedKg } from '../co2-estimate.js';

describe('estimateCo2AvoidedKg', () => {
  it('returns 0 for no items', () => {
    expect(estimateCo2AvoidedKg([])).toBe(0);
  });

  it('uses the meat factor for meat products (12 kg CO2e per kg)', () => {
    const result = estimateCo2AvoidedKg([
      { quantity: 1, unit: 'kg', product: { name: 'Boeuf haché' } },
    ]);
    expect(result).toBe(12);
  });

  it('uses the light plant factors for fruit and veg', () => {
    const fruit = estimateCo2AvoidedKg([{ quantity: 1, unit: 'kg', product: { name: 'Pommes' } }]);
    const veg = estimateCo2AvoidedKg([{ quantity: 1, unit: 'kg', product: { name: 'Carottes' } }]);
    expect(fruit).toBe(0.6);
    expect(veg).toBe(0.5);
  });

  it('converts grams and milliliters to kilograms', () => {
    // 500 g of cheese: 0.5 kg x 3.2 = 1.6
    const grams = estimateCo2AvoidedKg([
      { quantity: 500, unit: 'g', product: { name: 'Fromage râpé' } },
    ]);
    expect(grams).toBe(1.6);

    // 1000 ml of milk weighs ~1 kg: 1 x 3.2 = 3.2
    const milliliters = estimateCo2AvoidedKg([
      { quantity: 1000, unit: 'ml', product: { name: 'Lait demi-écrémé' } },
    ]);
    expect(milliliters).toBe(3.2);
  });

  it('counts pieces at a rough average weight', () => {
    // 4 tomatoes: 4 x 0.25 kg x 0.5 = 0.5
    const result = estimateCo2AvoidedKg([
      { quantity: 4, unit: 'pcs', product: { name: 'Tomates' } },
    ]);
    expect(result).toBe(0.5);
  });

  it('falls back to a mixed-basket average for unknown products', () => {
    // 1 kg of mystery: 1 x 1.8 = 1.8
    const result = estimateCo2AvoidedKg([
      { quantity: 1, unit: 'kg', product: { name: 'Zorglub' } },
    ]);
    expect(result).toBe(1.8);
  });

  it('sums across items and rounds to one decimal', () => {
    const result = estimateCo2AvoidedKg([
      { quantity: 2, unit: 'pcs', product: { name: 'Yaourt nature' } }, // 0.5 x 3.2 = 1.6
      { quantity: 300, unit: 'g', product: { name: 'Riz basmati' } }, // 0.3 x 1.2 = 0.36
    ]);
    expect(result).toBe(2);
  });
});
