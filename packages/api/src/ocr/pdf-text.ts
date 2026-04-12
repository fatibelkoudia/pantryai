import type { StructuredTextItem } from 'unpdf';

// Items within this many PDF units of each other on the y-axis are one line.
const Y_TOLERANCE = 2;

/**
 * Rebuild visual lines from pdf.js text items. unpdf's `extractText` flattens
 * everything onto a single line, which breaks line-based receipt parsers, so we
 * group items by their y position and order each line left-to-right by x.
 */
export function reconstructPdfLines(pages: StructuredTextItem[][]): string {
  const out: string[] = [];

  for (const page of pages) {
    let line: StructuredTextItem[] = [];
    let currentY: number | null = null;

    const flush = (): void => {
      if (line.length === 0) return;
      // POS PDFs often split a line into separate position runs, so join with a
      // space (then collapse) to keep adjacent fields from merging together.
      const text = [...line]
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) out.push(text);
      line = [];
    };

    for (const item of page) {
      if (currentY === null || Math.abs(item.y - currentY) <= Y_TOLERANCE) {
        line.push(item);
        currentY ??= item.y;
      } else {
        flush();
        line = [item];
        currentY = item.y;
      }
      if (item.hasEOL) {
        flush();
        currentY = null;
      }
    }
    flush();
  }

  return out.join('\n');
}

/**
 * True when the string looks like a real text layer rather than the empty/noise
 * output of a scanned, image-only PDF (which should fall back to OCR).
 */
export function hasUsableText(text: string): boolean {
  return (text.match(/[A-Za-zÀ-ÿ]/g)?.length ?? 0) >= 20;
}

/** Read a PDF's embedded text layer, preserving line structure. */
export async function extractPdfTextLayer(buf: Buffer): Promise<string> {
  // Dynamic import keeps pdf.js out of the worker's startup path.
  const { extractTextItems, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { items } = await extractTextItems(pdf);
  return reconstructPdfLines(items);
}
