import {
  type ParsedReceiptItem,
  type ReceiptParser,
  parsePrice,
  toTitleCase,
} from './receipt-parser.interface.js';

// 2-column markdown row from Mistral OCR (Auchan)
// Examples:
//   |  *AUCHAN VRAC VANILL.. | 3,32  |
//   |  *AUCHAN EAU AROMATI.. | 3*1,20  |   ← 3 units at 1.20
//   |  443120PARIS RHONE 1.. | 2*44,99  |  ← code-like item (often non-food)
const TABLE_ROW = /^\|\s*\*?(.*?)\s*\|\s*([\d.,*]+)\s*\|\s*$/;

// Inline qty+price like "3*1,20" => qty=3, price=1.20
const QTY_PRICE = /^(\d+)\*([\d.,]+)$/;

// Skip obvious non-food lines
const SKIP_NAMES = /^(AVOIR|REMISE|COUPON|SAC |REDUCTION|TICKET|BON )/i;

// Skip code-like names starting with many digits
const PRODUCT_CODE_PREFIX = /^\d{4,}/;

function cleanName(raw: string): string {
  return raw
    .replace(/^(AUCHAN\s+|AUC\s+)/i, '') // remove Auchan prefix
    .replace(/\.\.$/, '') // remove trailing ".."
    .trim();
}

export class AuchanParser implements ReceiptParser {
  readonly retailerName = 'AUCHAN';

  parse(rawText: string): ParsedReceiptItem[] {
    const items: ParsedReceiptItem[] = [];

    for (const line of rawText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || /^\| ?---/.test(trimmed)) continue;

      const rowMatch = TABLE_ROW.exec(trimmed);
      if (!rowMatch) continue;

      const rawName = (rowMatch[1] ?? '').trim();
      const rawPrice = (rowMatch[2] ?? '').trim();

      if (!rawName || !rawPrice) continue;

      const name = cleanName(rawName);
      if (!name) continue;
      if (SKIP_NAMES.test(name)) continue;
      if (PRODUCT_CODE_PREFIX.test(name)) continue; // skip code-like non-food lines

      let price: number;
      let quantity: number | undefined;

      const qtyMatch = QTY_PRICE.exec(rawPrice);
      if (qtyMatch && qtyMatch[1] && qtyMatch[2]) {
        quantity = parseInt(qtyMatch[1], 10);
        price = parsePrice(qtyMatch[2]);
      } else {
        price = parsePrice(rawPrice);
      }

      if (isNaN(price) || price <= 0) continue;

      items.push({
        name: toTitleCase(name),
        price,
        ...(quantity !== undefined && quantity > 1 && { quantity }),
        confidence: 0.8,
      });
    }

    return items;
  }
}
