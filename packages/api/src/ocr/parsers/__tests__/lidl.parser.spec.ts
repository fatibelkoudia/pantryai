import { describe, expect, it } from 'vitest';
import { LidlParser } from '../lidl.parser.js';

const parser = new LidlParser();

const LIDL_RECEIPT = `
LIDL
================
YAOURT NATUR BCO  1.89 A
PAIN COMPLET 5CE  0.99 A
REMISE            -0.20
LAIT ECRM 1L UHT  0.85 A
POMMES GOLDEN     2.45 A
x2
TOTAL          6.98
CB             6.98
`.trim();

describe('LidlParser', () => {
  it('extracts 4 product lines and ignores TOTAL and CB', () => {
    const items = parser.parse(LIDL_RECEIPT);
    expect(items).toHaveLength(4);
  });

  it('associates REMISE with the previous product and adjusts price', () => {
    const items = parser.parse(LIDL_RECEIPT);
    // PAIN COMPLET: 0.99 - 0.20 = 0.79
    const pain = items.find((i) => i.name.toLowerCase().includes('pain'));
    expect(pain?.price).toBeCloseTo(0.79);
  });

  it('captures x2 quantity multiplier from the subsequent line', () => {
    const items = parser.parse(LIDL_RECEIPT);
    const pommes = items.find((i) => i.name.toLowerCase().includes('pommes'));
    expect(pommes?.quantity).toBe(2);
  });

  it('returns confidence 0.85 for all items', () => {
    const items = parser.parse(LIDL_RECEIPT);
    for (const item of items) {
      expect(item.confidence).toBe(0.85);
    }
  });

  it('handles receipt with no discounts', () => {
    const text = 'LIDL\nYAOURT NATUR BCO  1.89 A\nLAIT ECRM 1L UHT  0.85 A\nTOTAL  2.74';
    const items = parser.parse(text);
    expect(items).toHaveLength(2);
    expect(items[0]?.price).toBeCloseTo(1.89);
  });

  it('returns empty array for empty input', () => {
    expect(parser.parse('')).toEqual([]);
  });
});
