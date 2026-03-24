import { describe, expect, it } from 'vitest';
import { GenericParser } from '../generic.parser.js';

const parser = new GenericParser();

const TIER1_RECEIPT = `
SUPERMARCHE INCONNU
LAIT ENTIER  2 l  1.89
FARINE  1 kg  0.95
TOTAL  2.84
`.trim();

const TIER2_RECEIPT = `
MAGASIN LOCAL
BAGUETTE TRADITION    0.95
JAMBON BLANC          2.45
TOTAL                 3.40
`.trim();

describe('GenericParser', () => {
  it('extracts tier-1 items with quantity and unit at confidence 0.85', () => {
    const items = parser.parse(TIER1_RECEIPT);
    const lait = items.find((i) => i.name.toLowerCase().includes('lait'));
    expect(lait).toBeDefined();
    expect(lait?.quantity).toBeCloseTo(2);
    expect(lait?.unit).toBe('l');
    expect(lait?.price).toBeCloseTo(1.89);
    expect(lait?.confidence).toBe(0.85);
  });

  it('extracts tier-2 items with price only at confidence 0.60', () => {
    const items = parser.parse(TIER2_RECEIPT);
    const baguette = items.find((i) => i.name.toLowerCase().includes('baguette'));
    expect(baguette).toBeDefined();
    expect(baguette?.price).toBeCloseTo(0.95);
    expect(baguette?.confidence).toBe(0.6);
  });

  it('skips TOTAL lines', () => {
    const items = parser.parse(TIER2_RECEIPT);
    const names = items.map((i) => i.name.toUpperCase());
    expect(names.some((n) => n.includes('TOTAL'))).toBe(false);
  });

  it('deduplicates repeated product names', () => {
    const text = 'BAGUETTE TRADITION    0.95\nBAGUETTE TRADITION    0.95';
    const items = parser.parse(text);
    expect(items).toHaveLength(1);
  });

  it('returns empty array for receipt with only totals and headers', () => {
    const text = 'TOTAL  10.00\nTVA 5.5%  0.55\nMERCI DE VOTRE VISITE';
    const items = parser.parse(text);
    expect(items).toHaveLength(0);
  });
});
