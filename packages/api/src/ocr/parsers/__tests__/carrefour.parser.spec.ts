import { describe, expect, it } from 'vitest';
import { CarrefourParser } from '../carrefour.parser.js';

const parser = new CarrefourParser();

const CARREFOUR_RECEIPT = `
CARREFOUR MARKET PARIS 15
================
3228857000166  FARINE BLE T55 1KG          1     0,89
3175680011480  BEURRE EXTRA FIN 250G        2     1,55
                REMISE CARTE -0,20
3274080005003  LAIT DEMI ECREME 1L          6     0,89
TOTAL ARTICLES                                    9,88
TVA 5.5%                                          0,54
`.trim();

describe('CarrefourParser', () => {
  it('extracts 3 product lines and ignores TOTAL and TVA', () => {
    const items = parser.parse(CARREFOUR_RECEIPT);
    expect(items).toHaveLength(3);
  });

  it('parses EAN-13 codes correctly', () => {
    const items = parser.parse(CARREFOUR_RECEIPT);
    expect(items[0]?.ean13).toBe('3228857000166');
    expect(items[1]?.ean13).toBe('3175680011480');
    expect(items[2]?.ean13).toBe('3274080005003');
  });

  it('parses French comma decimal prices', () => {
    const items = parser.parse(CARREFOUR_RECEIPT);
    expect(items[0]?.price).toBeCloseTo(0.89);
    expect(items[1]?.price).toBeCloseTo(1.55);
  });

  it('normalizes product names to title case', () => {
    const items = parser.parse(CARREFOUR_RECEIPT);
    expect(items[0]?.name).toBe('Farine Ble T55 1kg');
    expect(items[1]?.name).toBe('Beurre Extra Fin 250g');
  });

  it('parses quantity correctly', () => {
    const items = parser.parse(CARREFOUR_RECEIPT);
    expect(items[0]?.quantity).toBe(1);
    expect(items[1]?.quantity).toBe(2);
    expect(items[2]?.quantity).toBe(6);
  });

  it('returns confidence 0.95 for all items', () => {
    const items = parser.parse(CARREFOUR_RECEIPT);
    for (const item of items) {
      expect(item.confidence).toBe(0.95);
    }
  });

  it('returns empty array for empty input', () => {
    expect(parser.parse('')).toEqual([]);
  });

  it('skips REMISE lines without crashing', () => {
    const text =
      '3228857000166  FARINE BLE T55 1KG          1     0,89\n                REMISE CARTE -0,20';
    const items = parser.parse(text);
    expect(items).toHaveLength(1);
  });
});
