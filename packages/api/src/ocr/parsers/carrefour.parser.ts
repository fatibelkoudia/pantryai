import {
  type ParsedReceiptItem,
  type ReceiptParser,
  parsePrice,
  toTitleCase,
} from './receipt-parser.interface.js';

// Plain text row: EAN13  PRODUCT NAME   QTY   PRICE
const EAN13_ROW = /^(\d{13})\s{2,}(.+?)\s{2,}(\d+)\s+(\d+[,.]\d{2})\s*$/;

// Skip lines in plain text mode
const SKIP_LINE = /^\s*(REMISE|DISCOUNT|AVOIR|TOTAL|TVA|SUBTOTAL|FIDEL|CARTE|CODE|={3}|-{3})/i;

// Market format hint: TVA% in first column
const MD_DETECT_MARKET = /^\|\s*\d+[\d.]*%\s*\|/;

// Hyper format hint: DESIGNATION header
const MD_DETECT_HYPER = /^\|\s*DESIGNATION/i;

// Market table row: | TVA% | Product name | QTE x P.U. | Total |
const MD_ROW = /^\|\s*([\d.]+%)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([\d.,]+)\s*\|\s*$/;

// Hyper table row: | NAME | P.U x QTE | MONTANT |
// Examples: |  4 266G LS RECETT BOU |  | 9,66  |
//           |  6 197G SMARTIES POCH | Remise Immédiate | 4,84-7,29  |
const HYPER_ROW = /^\|\s*(.+?)\s*\|\s*([^|]*?)\s*\|\s*([\d.,]+)\s*\|\s*$/;

// Markdown separator row
const MD_SEPARATOR = /^\|\s*---/;

// Qty from "N x price" in QTE column
const QTY_X = /^(\d+)\s*x/i;

// Skip non-food names in markdown mode
const SKIP_MD_NAMES = /^(COUPON FIDELITE|SAC DE CAISSE|TOTAL)/i;

export class CarrefourParser implements ReceiptParser {
  readonly retailerName = 'CARREFOUR';

  parse(rawText: string): ParsedReceiptItem[] {
    const lines = rawText.split('\n');

    if (lines.some((l) => MD_DETECT_HYPER.test(l.trim()))) {
      return this.parseHyperMarkdown(lines);
    }
    if (lines.some((l) => MD_DETECT_MARKET.test(l.trim()))) {
      return this.parseMarkdown(lines);
    }
    return this.parsePlainText(lines);
  }

  private parsePlainText(lines: string[]): ParsedReceiptItem[] {
    const items: ParsedReceiptItem[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || SKIP_LINE.test(trimmed)) continue;

      const match = EAN13_ROW.exec(trimmed);
      if (!match) continue;

      const ean13 = match[1];
      const rawName = match[2];
      const rawQty = match[3];
      const rawPrice = match[4];

      if (!ean13 || !rawName || !rawQty || !rawPrice) continue;

      const name = toTitleCase(rawName.trim().replace(/\s+/g, ' '));
      const qty = parseInt(rawQty, 10);
      const price = parsePrice(rawPrice);

      items.push({
        name,
        ean13,
        ...(qty > 0 && { quantity: qty }),
        price,
        confidence: 0.95,
      });
    }

    return items;
  }

  private parseMarkdown(lines: string[]): ParsedReceiptItem[] {
    const items: ParsedReceiptItem[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (MD_SEPARATOR.test(trimmed)) continue;

      const match = MD_ROW.exec(trimmed);
      if (!match) continue;

      const tva = match[1];
      const rawName = match[2];
      const qteCol = match[3];
      const rawPrice = match[4];

      // Empty TVA column usually means discount/summary row
      if (!tva || !tva.trim()) continue;

      if (!rawName || !rawPrice) continue;

      const name = rawName.trim().replace(/\s+/g, ' ');

      // Skip non-food items
      if (SKIP_MD_NAMES.test(name)) continue;

      const price = parsePrice(rawPrice);

      // Skip zero-price rows
      if (price === 0) continue;

      // Parse quantity from QTE column (ex: "2 x 0.99")
      let quantity: number | undefined;
      const qtyMatch = qteCol ? QTY_X.exec(qteCol.trim()) : null;
      if (qtyMatch && qtyMatch[1]) {
        const qty = parseInt(qtyMatch[1], 10);
        if (qty > 1) {
          quantity = qty;
        }
      }

      items.push({
        name: toTitleCase(name),
        ...(quantity !== undefined && { quantity }),
        price,
        confidence: 0.9,
      });
    }

    return items;
  }

  // Carrefour Hyper format: | DESIGNATION | P.U x QTE | MONTANT |
  // Example: |  6 197G SMARTIES POCH | Remise Immédiate | 4,84-7,29  |
  private parseHyperMarkdown(lines: string[]): ParsedReceiptItem[] {
    const items: ParsedReceiptItem[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || MD_SEPARATOR.test(trimmed)) continue;
      if (MD_DETECT_HYPER.test(trimmed)) continue; // skip header

      const match = HYPER_ROW.exec(trimmed);
      if (!match) continue;

      const rawName = match[1];
      const rawPrice = match[3];
      if (!rawName || !rawPrice) continue;

      // Remove leading category digit code (ex: "4 266G..." => "266G...")
      const name = toTitleCase(
        rawName
          .trim()
          .replace(/^\d+\s+/, '')
          .replace(/\s+/g, ' '),
      );

      if (!name || SKIP_MD_NAMES.test(name)) continue;

      // Skip "Remise Immédiate" rows using middle column
      const midCol = (match[2] ?? '').trim();
      if (/Remise/i.test(midCol)) continue;

      const price = parsePrice(rawPrice);
      if (isNaN(price) || price <= 0) continue;

      items.push({ name, price, confidence: 0.75 });
    }

    return items;
  }
}
