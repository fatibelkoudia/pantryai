import {
  type ParsedReceiptItem,
  type ReceiptParser,
  parsePrice,
  toTitleCase,
} from './receipt-parser.interface.js';

// Product row: NAME  PRICE [A|B|C]
const PRODUCT_LINE = /^([A-Z][A-Z0-9\s\-']{2,}?)\s{2,}(\d+[.,]\d{2})\s*[ABC]?\s*$/;

// Discount row: REMISE  -X.XX
const DISCOUNT_LINE = /^REMISE\b.*?(-\d+[.,]\d{2})/i;

// Qty line: x2 / X 2 / * 2
const QTY_LINE = /^[xX*]\s*(\d+)\s*$/;

// Weight line: 0.485 KG ...
const WEIGHT_LINE = /^(\d+[.,]\d{3})\s*(KG|G|L|CL)\b/i;

// Skip lines in plain text mode
const SKIP_LINE =
  /^(TOTAL|TVA|SOUS-TOTAL|ESPECES|CB|RENDU|EURO|SOLDE|POINTS|MERCI|LIDL|\*{3}|={3}|-{3}|\d{2}\/\d{2})/i;

// Markdown mode hint: 3+ lines with pipe-delimited rows
const MD_TABLE_ROW = /^\|\s*[^|]+\s*\|/;

// Markdown header/separator rows to skip
const MD_HEADER = /^\|\s*Article/i;
const MD_SEPARATOR = /^\|\s*---/;

// Markdown product row, 4-column format: | name | P.U. | Qty | EUR |
// Examples from real Lidl receipts:
//   |  Tomate ronde 1kg | 1,89 | 1 | 1,89 A T  |
//   |  Banane | 0,99 | 2 | 1,98 A T  |
//   |  Nom X-Tra |  |  | -3,86  |   ← discount row, P.U. empty
const MD_ROW_4COL = /^\|\s*([^|]+?)\s*\|\s*([\d.,]*)\s*\|\s*(\d*)\s*\|\s*([^|]*?)\s*\|\s*$/;

// Markdown product row, 3-column fallback: | name | P.U. | EUR |
const MD_ROW_3COL = /^\|\s*([^|]+?)\s*\|\s*([\d.,]+)?\s*\|\s*([^|]*?)\s*\|\s*$/;

// EUR column: optional qty, amount, optional tax code/flag
// Handles: "1,89 A T", "2 1,98 A T", "17,25 B", "1 2,93 A T"
const EUR_COL = /^(?:(\d+)\s+)?([\d.,]+)\s*(?:[AB]\s*)?T?\s*$/;

interface PendingItem {
  name: string;
  price: number;
  quantity?: number;
  unit?: string;
}

export class LidlParser implements ReceiptParser {
  readonly retailerName = 'LIDL';

  parse(rawText: string): ParsedReceiptItem[] {
    const lines = rawText.split('\n');

    // Some Lidl digital receipts come as raw HTML tables
    if (rawText.includes('<table>') && rawText.includes('<td>')) {
      return this.parseHtmlTable(rawText);
    }

    // Markdown mode: at least 3 pipe-delimited rows
    const mdLineCount = lines.filter((l) => MD_TABLE_ROW.test(l.trim())).length;
    if (mdLineCount >= 3) {
      return this.parseMarkdown(lines);
    }

    return this.parsePlainText(lines);
  }

  private parseHtmlTable(rawText: string): ParsedReceiptItem[] {
    const items: ParsedReceiptItem[] = [];
    // Parse each <tr> row and read its <td> cells
    const rowRe = /<tr>([\s\S]*?)<\/tr>/gi;
    const cellRe = /<td>([^<]*)<\/td>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRe.exec(rawText)) !== null) {
      const rowHtml = rowMatch[1] ?? '';
      const cells: string[] = [];
      let cellMatch: RegExpExecArray | null;
      cellRe.lastIndex = 0;
      while ((cellMatch = cellRe.exec(rowHtml)) !== null) {
        cells.push((cellMatch[1] ?? '').trim());
      }
      // Expected cells: Article | P.U. | Qty | EUR
      if (cells.length < 3) continue;
      const [rawName, rawPu, rawQty] = cells;
      if (!rawName || !rawPu) continue;

      // Skip discount and total rows
      const puVal = rawPu.trim();
      if (!puVal || /^[-−]/.test(puVal)) continue;
      if (/^(Nombre|A payer|Total|TOTAL|Carte|TVA)/i.test(rawName)) continue;
      if (/^(Ménocline|Réduction|Rem\s)/i.test(rawName)) continue;

      const price = parsePrice(puVal);
      if (isNaN(price) || price <= 0) continue;

      const qtyNum = rawQty ? parseInt(rawQty, 10) : NaN;
      const quantity = !isNaN(qtyNum) && qtyNum > 1 ? qtyNum : undefined;

      items.push({
        name: toTitleCase(rawName.replace(/\s+/g, ' ')),
        price,
        ...(quantity !== undefined && { quantity }),
        confidence: 0.8,
      });
    }
    return items;
  }

  private parsePlainText(lines: string[]): ParsedReceiptItem[] {
    const items: ParsedReceiptItem[] = [];
    let pending: PendingItem | null = null;

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

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (SKIP_LINE.test(trimmed)) {
        flush();
        continue;
      }

      const discountMatch = DISCOUNT_LINE.exec(trimmed);
      if (discountMatch) {
        // Apply discount to previous product
        if (pending && discountMatch[1]) {
          pending.price = Math.max(0, pending.price + parsePrice(discountMatch[1]));
        }
        continue;
      }

      const qtyMatch = QTY_LINE.exec(trimmed);
      if (qtyMatch) {
        if (pending && qtyMatch[1]) {
          pending.quantity = parseInt(qtyMatch[1], 10);
        }
        continue;
      }

      const weightMatch = WEIGHT_LINE.exec(trimmed);
      if (weightMatch) {
        if (pending && weightMatch[1] && weightMatch[2]) {
          pending.quantity = parsePrice(weightMatch[1]);
          pending.unit = weightMatch[2].toLowerCase();
        }
        continue;
      }

      const productMatch = PRODUCT_LINE.exec(trimmed);
      if (productMatch) {
        flush();
        const rawName = productMatch[1];
        const rawPrice = productMatch[2];
        if (!rawName || !rawPrice) continue;
        pending = {
          name: toTitleCase(rawName.trim().replace(/\s+/g, ' ')),
          price: parsePrice(rawPrice),
        };
        continue;
      }
    }

    flush();
    return items;
  }

  private parseMarkdown(lines: string[]): ParsedReceiptItem[] {
    const items: ParsedReceiptItem[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (MD_SEPARATOR.test(trimmed)) continue;
      if (MD_HEADER.test(trimmed)) continue;

      // Try 4-column first, then fallback to 3-column
      const match4 = MD_ROW_4COL.exec(trimmed);
      const match3 = !match4 ? MD_ROW_3COL.exec(trimmed) : null;

      let rawName: string | undefined;
      let unitPrice: string | undefined;
      let quantity: number | undefined;
      let eurCol: string | undefined;

      if (match4) {
        rawName = match4[1];
        unitPrice = match4[2];
        const rawQty = match4[3];
        eurCol = match4[4];
        if (rawQty && rawQty.trim()) {
          const q = parseInt(rawQty.trim(), 10);
          if (q > 1) quantity = q;
        }
      } else if (match3) {
        rawName = match3[1];
        unitPrice = match3[2];
        eurCol = match3[3];
        // Try qty from EUR column
        const eurMatch = eurCol ? EUR_COL.exec(eurCol.trim()) : null;
        if (eurMatch && eurMatch[1]) {
          const q = parseInt(eurMatch[1], 10);
          if (q > 1) quantity = q;
        }
      } else {
        continue;
      }

      // Skip discount rows with missing unit price
      if (!unitPrice || !unitPrice.trim()) continue;
      if (!rawName) continue;

      const name = rawName.trim().replace(/\s+/g, ' ');

      // Skip discount/reduction rows by name
      if (/^(Rem |Nom |Reduction )/i.test(name)) continue;

      // Skip rows where EUR starts with '-' (negative = discount)
      if (eurCol && eurCol.trim().startsWith('-')) continue;

      const price = parsePrice(unitPrice);
      if (isNaN(price) || price <= 0) continue;

      items.push({
        name: toTitleCase(name),
        price,
        ...(quantity !== undefined && { quantity }),
        confidence: 0.85,
      });
    }

    return items;
  }
}
