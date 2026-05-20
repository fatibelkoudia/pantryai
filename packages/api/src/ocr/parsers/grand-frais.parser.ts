import {
  type ParsedReceiptItem,
  type ReceiptParser,
  parsePrice,
  toTitleCase,
} from './receipt-parser.interface.js';

// Unit-priced row (single line):
//   "A 1x *CHAMPIGNON BLANC PC FR 1,99 € 1,99 €"
//   <VAT letter> <qty>x [*]<name> <unit price> € <total> €
const UNIT_LINE = /^[A-Z]\s+(\d+)\s*x\s+\*?(.+?)\s+\d+[,.]\d{2}\s*€\s+(\d+[,.]\d{2})\s*€$/;

// Weight item name line; the price is on the following NET line:
//   "A *MELON VERT"
const WEIGHT_NAME_LINE = /^[A-Z]\s+\*(.+?)\s*$/;

// Weight detail line completing the previous name:
//   "NET 2,545 kg x 2,99 €/kg 7,61 €"
const WEIGHT_DETAIL_LINE = /^NET\s+([\d,.]+)\s*kg\s*x\s*[\d,.]+\s*€\/kg\s+([\d,.]+)\s*€$/i;

// End of the product list: "39 LIGNES 42 ARTICLES", "28 TOTAL 64.68€",
// the TVA table, or totals.
const STOP_LINE = /^(\d+\s+LIGNES\b|\d+\s+TOTAL\b|TVA\s+Taux|TOTAL\b|NET\s+TTC\b)/i;

// --- Second format: per-magasin "Le Primeur de Wickrange" tickets ---
// Here the price sits on the same line as the name, followed by a VAT code:
//   "MAIS EPI 5.00€ 14"          <name> <total> € <vat code>
// A multiplier or a weight detail can follow on the next line and refine the qty:
//   "4 x 1.25€"                  qty 4
//   "1.345 kg x 1.99 €/kg"       weight item, qty 1.345 kg
const WICK_PRODUCT_LINE = /^(.+?)\s+(\d+[.,]\d{2})\s*€\s+\d+\s*$/;
const WICK_MULTIPLIER_LINE = /^(\d+)\s*x\s+[\d.,]+\s*€\s*$/;
const WICK_WEIGHT_LINE = /^([\d.,]+)\s*kg\s*x\s*[\d.,]+\s*€\/kg\s*$/i;
// Société headers and discount/offer/tare lines we never want as products.
const WICK_SKIP_LINE = /^(-|Tare\b|OP\b|Prix\s+TVA\b|Carte\s+Bancaire\b)/i;

function cleanWickName(raw: string): string {
  // Drop trailing dots/spaces left by truncated names ("COURGETTE FILET 1." -> "Courgette Filet 1").
  return toTitleCase(
    raw
      .trim()
      .replace(/[.\s]+$/, '')
      .replace(/\s+/g, ' '),
  );
}

export class GrandFraisParser implements ReceiptParser {
  readonly retailerName = 'GRAND FRAIS';

  parse(rawText: string): ParsedReceiptItem[] {
    const items: ParsedReceiptItem[] = [];
    // Name of a weight item waiting for its NET line to supply the price (GIE format).
    let pendingWeightName: string | null = null;
    // Last product pushed in the Wickrange format, so a following multiplier or
    // weight line can refine its quantity.
    let lastWickItem: ParsedReceiptItem | null = null;

    for (const line of rawText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (STOP_LINE.test(trimmed)) break;

      // Unit-priced product (qty x price on a single line).
      const unitMatch = UNIT_LINE.exec(trimmed);
      if (unitMatch && unitMatch[1] && unitMatch[2] && unitMatch[3]) {
        pendingWeightName = null;
        lastWickItem = null;
        const qty = parseInt(unitMatch[1], 10);
        items.push({
          name: toTitleCase(unitMatch[2].trim().replace(/\s+/g, ' ')),
          ...(qty > 0 && { quantity: qty }),
          price: parsePrice(unitMatch[3]),
          confidence: 0.9,
        });
        continue;
      }

      // NET line completes a pending weight item.
      const weightMatch = WEIGHT_DETAIL_LINE.exec(trimmed);
      if (weightMatch && weightMatch[1] && weightMatch[2] && pendingWeightName) {
        items.push({
          name: pendingWeightName,
          quantity: parsePrice(weightMatch[1]),
          unit: 'kg',
          price: parsePrice(weightMatch[2]),
          confidence: 0.9,
        });
        pendingWeightName = null;
        lastWickItem = null;
        continue;
      }

      // Weight item name (price arrives on the following NET line).
      const nameMatch = WEIGHT_NAME_LINE.exec(trimmed);
      if (nameMatch && nameMatch[1]) {
        pendingWeightName = toTitleCase(nameMatch[1].trim().replace(/\s+/g, ' '));
        lastWickItem = null;
        continue;
      }

      // --- Wickrange format ---

      // A "N x price€" line right after a product means it was bought N times.
      const multMatch = WICK_MULTIPLIER_LINE.exec(trimmed);
      if (multMatch && multMatch[1] && lastWickItem) {
        lastWickItem.quantity = parseInt(multMatch[1], 10);
        continue;
      }

      // A "weight kg x price €/kg" line turns the previous product into a weight item.
      const wickWeight = WICK_WEIGHT_LINE.exec(trimmed);
      if (wickWeight && wickWeight[1] && lastWickItem) {
        lastWickItem.quantity = parsePrice(wickWeight[1]);
        lastWickItem.unit = 'kg';
        continue;
      }

      if (WICK_SKIP_LINE.test(trimmed)) {
        pendingWeightName = null;
        lastWickItem = null;
        continue;
      }

      // "<name> <total>€ <vat code>", the usual Wickrange product line.
      const wickProduct = WICK_PRODUCT_LINE.exec(trimmed);
      if (wickProduct && wickProduct[1] && wickProduct[2]) {
        const item: ParsedReceiptItem = {
          name: cleanWickName(wickProduct[1]),
          price: parsePrice(wickProduct[2]),
          confidence: 0.85,
        };
        items.push(item);
        lastWickItem = item;
        pendingWeightName = null;
        continue;
      }

      // Anything else (société headers, PT tare, offers, store info) is ignored
      // and discards any half-formed item.
      pendingWeightName = null;
      lastWickItem = null;
    }

    return items;
  }
}
