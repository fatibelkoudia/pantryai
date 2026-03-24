import {
  type ParsedReceiptItem,
  type ReceiptParser,
  parsePrice,
  toTitleCase,
} from './receipt-parser.interface.js';

// Product row with price at the end (comma or dot)
const PRODUCT_LINE = /^(.+?)\s+([\d]+[,.]\d{2})\s*[ABC]?\s*$/;

// Qty inside name, ex: YAOURT NATURE X8
const QTY_IN_NAME = /^(.*?)\s+[xX*](\d+)\s*$/;

// Skip summary/payment lines
const SKIP_LINE =
  /^(TOTAL|TVA|NET A PAYER|AVOIR|REMISE|POINTS|E\.LECLERC|LECLERC|RESTE|RENDU|SOIT|BON |CO\b|ESPECE|CARTE|={3}|-{3}|\d{2}\/\d{2})/i;

// OCR noise pattern: letter-digit-letter
const OCR_NOISE = /[A-Z]\d[A-Z]/;

const CATEGORY_HEADERS = new Set([
  'EPICERIE',
  'FRAIS',
  'SURGELES',
  'BOULANGERIE',
  'CHARCUTERIE',
  'CREMERIE',
  'DROGUERIE',
  'FRUITS ET LEGUMES',
  'MAREE',
  'BOUCHERIE',
  'TRAITEUR',
  'VINS',
  'BOISSONS',
  'HYGIENE',
  'ENTRETIEN',
  'TEXTILE',
  'BAZAR',
  'LIBRAIRIE',
  'ELECTROMENAGER',
]);

function isCategoryHeader(line: string): boolean {
  if (CATEGORY_HEADERS.has(line)) return true;
  // Fallback: all-caps, no digits, likely a section header
  return /^[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ\s\-]{3,}$/.test(line) && !/\d/.test(line);
}

/**
 * Convert one OCR markdown line to plain text.
 * This helps the product regex match more often.
 */
function preprocessLine(line: string): string {
  return line
    .replace(/!\[.*?\]\(.*?\)/g, '') // remove markdown images
    .replace(/\*\*([^*]+)\*\*/g, '$1') // remove bold markers
    .replace(/^\s*#+\s+/, '') // remove heading markers
    .replace(/&gt;/g, '>') // decode common HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/^(\s*>\s*)+/, '') // remove quote prefix
    .replace(/^\*\s+/, ''); // remove bullet prefix
}

export class LeclercParser implements ReceiptParser {
  readonly retailerName = 'LECLERC';

  parse(rawText: string): ParsedReceiptItem[] {
    const items: ParsedReceiptItem[] = [];
    let pastTotal = false;

    for (const rawLine of rawText.split('\n')) {
      const trimmed = preprocessLine(rawLine).trim();
      if (!trimmed) continue;

      // Once TOTAL appears, ignore lines after it.
      // The rest is usually summary/footer and can repeat product names.
      if (/^TOTAL\b/i.test(trimmed)) {
        pastTotal = true;
      }
      if (pastTotal) continue;

      if (SKIP_LINE.test(trimmed)) continue;
      if (isCategoryHeader(trimmed)) continue;

      const productMatch = PRODUCT_LINE.exec(trimmed);
      if (!productMatch) continue;

      const rawName = productMatch[1];
      const rawPrice = productMatch[2];
      if (!rawName || !rawPrice) continue;

      let name = rawName.trim().replace(/\s+/g, ' ');
      let quantity: number | undefined;

      // Extract qty in name (ex: "YAOURT NATURE X8")
      const qtyMatch = QTY_IN_NAME.exec(name);
      if (qtyMatch && qtyMatch[1] && qtyMatch[2]) {
        name = qtyMatch[1].trim();
        quantity = parseInt(qtyMatch[2], 10);
      }

      const confidence = OCR_NOISE.test(name) ? 0.5 : 0.8;

      items.push({
        name: toTitleCase(name),
        price: parsePrice(rawPrice),
        ...(quantity !== undefined && { quantity }),
        confidence,
      });
    }

    return items;
  }
}
