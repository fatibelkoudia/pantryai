// Tests for the Auchan parser.
// Auchan tickets come out of the OCR as a little 2-column table
// ("| *NAME.. | price |"), so the parser just reads those rows. We run the test on
// the saved auchan_01 fixture so it matches what the real OCR actually gives us.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AuchanParser } from '../auchan.parser.js';

const parser = new AuchanParser();

const FIXTURE_DIR = path.resolve(__dirname, '../../__tests__/fixtures/receipts/auchan');
const ocrText = readFileSync(path.join(FIXTURE_DIR, 'auchan_01.ocr.txt'), 'utf8');
const expected = JSON.parse(
  readFileSync(path.join(FIXTURE_DIR, 'auchan_01.expected.json'), 'utf8'),
) as { retailer: string; items: { name: string; price: number; quantity?: number }[] };

describe('AuchanParser', () => {
  it('extracts every table row from the recorded fixture', () => {
    const items = parser.parse(ocrText);
    expect(items).toHaveLength(expected.items.length);
  });

  it('matches the expected items name-for-name and price-for-price', () => {
    const items = parser.parse(ocrText);
    for (const [i, expectedItem] of expected.items.entries()) {
      expect(items[i]).toMatchObject(expectedItem);
    }
  });

  it('reads an inline "qty*price" cell as quantity + unit price', () => {
    const items = parser.parse(ocrText);
    // "| *AUCHAN EAU AROMATI.. | 3*1,20 |" -> 3 units at 1.20 each.
    const eau = items.find((i) => i.name === 'Eau Aromati');
    expect(eau).toMatchObject({ quantity: 3, price: 1.2 });
  });

  it('strips the AUCHAN/AUC prefix and the trailing ".." from names', () => {
    const items = parser.parse('|  *AUCHAN VRAC VANILL.. | 3,32  |');
    expect(items[0]?.name).toBe('Vrac Vanill');
  });

  it('skips code-like (non-food) rows that start with a long digit run', () => {
    const items = parser.parse(ocrText);
    // "| 443120PARIS RHONE 1.. | 2*44,99 |" is a product-code line, not food.
    expect(items.some((i) => /rhone|443120/i.test(i.name))).toBe(false);
  });

  it('ignores the separator row and any non-table text', () => {
    const items = parser.parse(
      ['# Auchan', 'OSNY', '| --- | --- |', '|  *AUCHAN ABRICOT | 1,73  |'].join('\n'),
    );
    expect(items).toEqual([{ name: 'Abricot', price: 1.73, confidence: 0.8 }]);
  });

  it('tags every item with the 0.8 OCR-table confidence', () => {
    const items = parser.parse(ocrText);
    expect(items.every((i) => i.confidence === 0.8)).toBe(true);
  });

  it('returns an empty array for empty input', () => {
    expect(parser.parse('')).toEqual([]);
  });
});
