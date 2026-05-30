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

// End of the product list: "39 LIGNES 42 ARTICLES", the TVA table, or totals.
const STOP_LINE = /^(\d+\s+LIGNES\b|TVA\s+Taux|TOTAL\b|NET\s+TTC\b)/i;

export class GrandFraisParser implements ReceiptParser {
  readonly retailerName = 'GRAND FRAIS';

  parse(rawText: string): ParsedReceiptItem[] {
    const items: ParsedReceiptItem[] = [];
    // Name of a weight item waiting for its NET line to supply the price.
    let pendingWeightName: string | null = null;

    for (const line of rawText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (STOP_LINE.test(trimmed)) break;

      // Unit-priced product (qty x price on a single line).
      const unitMatch = UNIT_LINE.exec(trimmed);
      if (unitMatch && unitMatch[1] && unitMatch[2] && unitMatch[3]) {
        pendingWeightName = null;
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
        continue;
      }

      // Weight item name (price arrives on the following NET line).
      const nameMatch = WEIGHT_NAME_LINE.exec(trimmed);
      if (nameMatch && nameMatch[1]) {
        pendingWeightName = toTitleCase(nameMatch[1].trim().replace(/\s+/g, ' '));
        continue;
      }

      // Anything else (société headers, PT tare, offers, store info) is ignored
      // and discards any half-formed weight item.
      pendingWeightName = null;
    }

    return items;
  }
}
