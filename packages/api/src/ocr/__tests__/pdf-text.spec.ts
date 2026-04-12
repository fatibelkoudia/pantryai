import { describe, expect, it } from 'vitest';
import type { StructuredTextItem } from 'unpdf';
import { hasUsableText, reconstructPdfLines } from '../pdf-text.js';

// Minimal StructuredTextItem factory (only the fields reconstructPdfLines reads).
function item(str: string, x: number, y: number, hasEOL = false): StructuredTextItem {
  return { str, x, y, width: 0, height: 0, fontSize: 10, fontFamily: 'F1', dir: 'ltr', hasEOL };
}

describe('reconstructPdfLines()', () => {
  it('groups items on the same y into one line, ordered left-to-right by x', () => {
    const pages: StructuredTextItem[][] = [
      [item('1,99 €', 200, 700), item('A 1x *CHAMPIGNON', 50, 700, true)],
    ];
    expect(reconstructPdfLines(pages)).toBe('A 1x *CHAMPIGNON 1,99 €');
  });

  it('splits items with different y values into separate lines', () => {
    const pages: StructuredTextItem[][] = [
      [item('A *MELON VERT', 50, 700), item('NET 2,545 kg', 50, 686)],
    ];
    expect(reconstructPdfLines(pages)).toBe('A *MELON VERT\nNET 2,545 kg');
  });

  it('starts a new line on an hasEOL marker even at the same y', () => {
    const pages: StructuredTextItem[][] = [
      [item('LINE ONE', 50, 700, true), item('LINE TWO', 50, 700)],
    ];
    expect(reconstructPdfLines(pages)).toBe('LINE ONE\nLINE TWO');
  });

  it('collapses internal whitespace and drops blank lines', () => {
    const pages: StructuredTextItem[][] = [[item('A   1x    PAIN', 50, 700)]];
    expect(reconstructPdfLines(pages)).toBe('A 1x PAIN');
  });

  it('returns an empty string for no items', () => {
    expect(reconstructPdfLines([[]])).toBe('');
  });
});

describe('hasUsableText()', () => {
  it('accepts a real text layer with plenty of letters', () => {
    expect(hasUsableText('A 1x *CHAMPIGNON BLANC PC FR 1,99 €')).toBe(true);
  });

  it('rejects empty or near-empty output from an image-only PDF', () => {
    expect(hasUsableText('')).toBe(false);
    expect(hasUsableText('  \n  ')).toBe(false);
    expect(hasUsableText('12,99 € 3,40 €')).toBe(false);
  });
});
