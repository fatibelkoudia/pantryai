import {
  type ParsedReceiptItem,
  type ReceiptParser,
  parsePrice,
  toTitleCase,
} from './receipt-parser.interface.js';

// Product row like "MAIS EPI 5.00€ 14"
// Name is uppercase text, price is before €, then VAT code at the end
const PRODUCT_LINE = /^([A-Z][A-Z\d\s.'/\-]{2,}?)\s+([\d]+\.[\d]{2})€\s+\d{1,2}$/;

// Qty row for previous item: "4 x 1.25€"
const QTY_LINE = /^(\d+)\s*x\s*([\d.]+)€$/;

// Weight row for previous item: "1.345 kg x 1.99 €/kg"
const WEIGHT_LINE = /^([\d.]+)\s*kg\s*x\s*([\d.]+)\s*€\/kg$/i;

// Skip discount/summary lines
const SKIP_LINE = /^(-\d|Tare\s|TOTAL\b|Carte\s|28\s+TOTAL|OP\s+|Prix\s+TVA|--|^-[A-Z])/i;

interface PendingItem {
  name: string;
  price: number;
  quantity?: number;
  unit?: string;
}

export class GrandFraisParser implements ReceiptParser {
  readonly retailerName = 'GRAND FRAIS';

  parse(rawText: string): ParsedReceiptItem[] {
    const items: ParsedReceiptItem[] = [];
    let pending: PendingItem | null = null;
    let pastTotal = false;

    const flush = (): void => {
      if (!pending) return;
      items.push({
        name: pending.name,
        price: pending.price,
        ...(pending.quantity !== undefined && { quantity: pending.quantity }),
        ...(pending.unit !== undefined && { unit: pending.unit }),
        confidence: 0.85,
      });
      pending = null;
    };

    for (const line of rawText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Stop parsing after TOTAL section
      if (/^\d{1,3}\s+TOTAL\b/i.test(trimmed) || /^TOTAL\b/i.test(trimmed)) {
        flush();
        pastTotal = true;
      }
      if (pastTotal) continue;
      if (SKIP_LINE.test(trimmed)) {
        flush();
        continue;
      }

      // Qty for previous item
      const qtyMatch = QTY_LINE.exec(trimmed);
      if (qtyMatch && pending && qtyMatch[1]) {
        pending.quantity = parseInt(qtyMatch[1], 10);
        continue;
      }

      // Weight for previous item
      const weightMatch = WEIGHT_LINE.exec(trimmed);
      if (weightMatch && pending && weightMatch[1]) {
        pending.quantity = parseFloat(weightMatch[1]);
        pending.unit = 'kg';
        continue;
      }

      // Product row
      const productMatch = PRODUCT_LINE.exec(trimmed);
      if (productMatch && productMatch[1] && productMatch[2]) {
        flush();
        pending = {
          name: toTitleCase(productMatch[1].trim().replace(/\.\s*$/, '')),
          price: parsePrice(productMatch[2]),
        };
        continue;
      }
    }

    flush();
    return items;
  }
}
