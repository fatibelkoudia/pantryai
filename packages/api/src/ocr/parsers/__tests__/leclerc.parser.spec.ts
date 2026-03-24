import { describe, expect, it } from 'vitest';
import { LeclercParser } from '../leclerc.parser.js';

const parser = new LeclercParser();

const LECLERC_RECEIPT = `
E.LECLERC
EPICERIE
FARINE DE BLE T55          0,89 A
SUCRE BLANC 1KG             0,95 A
FRAIS
YAOURT NATURE X8            1,29 A
BEURRE PLAQUETTE            1,89 A
TOTAL NET A PAYER           5,02
TVA 5.5%                    0,28
`.trim();

describe('LeclercParser', () => {
  it('extracts 4 product lines', () => {
    const items = parser.parse(LECLERC_RECEIPT);
    expect(items).toHaveLength(4);
  });

  it('skips category headers EPICERIE and FRAIS', () => {
    const items = parser.parse(LECLERC_RECEIPT);
    const names = items.map((i) => i.name.toUpperCase());
    expect(names).not.toContain('EPICERIE');
    expect(names).not.toContain('FRAIS');
  });

  it('skips TOTAL NET A PAYER line', () => {
    const items = parser.parse(LECLERC_RECEIPT);
    const names = items.map((i) => i.name.toUpperCase());
    expect(names.some((n) => n.includes('TOTAL'))).toBe(false);
  });

  it('extracts embedded quantity from YAOURT NATURE X8', () => {
    const items = parser.parse(LECLERC_RECEIPT);
    const yaourt = items.find((i) => i.name.toLowerCase().includes('yaourt'));
    expect(yaourt?.quantity).toBe(8);
  });

  it('returns confidence 0.80 for clean lines', () => {
    const items = parser.parse(LECLERC_RECEIPT);
    for (const item of items) {
      expect(item.confidence).toBe(0.8);
    }
  });

  it('reduces confidence to 0.50 for lines with OCR noise (digit inside word)', () => {
    const noisyText = 'E.LECLERC\nYA0URT NATURE  1,29 A';
    const items = parser.parse(noisyText);
    expect(items).toHaveLength(1);
    expect(items[0]?.confidence).toBe(0.5);
  });

  it('returns empty array for empty input', () => {
    expect(parser.parse('')).toEqual([]);
  });
});
