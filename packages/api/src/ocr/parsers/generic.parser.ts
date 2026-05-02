import {
  type ParsedReceiptItem,
  type ReceiptParser,
  parsePrice,
  toTitleCase,
} from './receipt-parser.interface.js';

// Tier 1: name + qty + unit + price (best confidence)
const TIER1 =
  /^(.+?)\s+(\d+(?:[,.]\d+)?)\s*(kg|g|l|cl|ml|unités?|pcs?|pièces?)\s+(\d+[,.]\d{2})\s*$/i;

// Tier 2: name + price at end (2+ spaces between)
const TIER2 = /^([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s\-'%\.]{2,40}?)\s{2,}(\d+[,.]\d{2})\s*[A-C]?\s*$/;

// Tier 3: name-like line with no visible price
const TIER3 = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s\-']{2,49})\s*$/;

// Skip obvious non-product lines
const SKIP_LINE =
  /^(TOTAL|TVA|SOUS|NET|CB|ESPECE|RENDU|MONNAIE|MERCI|POINT|FIDELIT|TICKET|\d{2}[\/\-]\d{2}|={3}|-{3}|\*{3})/i;

// All-caps single-word lines (store names/headers)
const HEADER_LINE = /^[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ]{3,}\s*$/;

function normalizeName(s: string): string {
  return toTitleCase(s.trim().replace(/\s+/g, ' '));
}

export class GenericParser implements ReceiptParser {
  readonly retailerName = 'GENERIC';

  parse(rawText: string): ParsedReceiptItem[] {
    const items: ParsedReceiptItem[] = [];
    const seenNames = new Set<string>();

    for (const line of rawText.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length < 3) continue;
      if (SKIP_LINE.test(trimmed)) continue;
      if (HEADER_LINE.test(trimmed)) continue;

      const tier1Match = TIER1.exec(trimmed);
      if (tier1Match && tier1Match[1] && tier1Match[2] && tier1Match[3] && tier1Match[4]) {
        const name = normalizeName(tier1Match[1]);
        if (seenNames.has(name)) continue;
        seenNames.add(name);
        items.push({
          name,
          quantity: parsePrice(tier1Match[2]),
          unit: tier1Match[3].toLowerCase(),
          price: parsePrice(tier1Match[4]),
          confidence: 0.85,
        });
        continue;
      }

      const tier2Match = TIER2.exec(trimmed);
      if (tier2Match && tier2Match[1] && tier2Match[2]) {
        const name = normalizeName(tier2Match[1]);
        if (seenNames.has(name)) continue;
        seenNames.add(name);
        items.push({
          name,
          price: parsePrice(tier2Match[2]),
          confidence: 0.6,
        });
        continue;
      }

      const tier3Match = TIER3.exec(trimmed);
      if (tier3Match && tier3Match[1]) {
        const name = normalizeName(tier3Match[1]);
        if (seenNames.has(name)) continue;
        seenNames.add(name);
        items.push({ name, confidence: 0.35 });
      }
    }

    return items;
  }
}
