import { AuchanParser } from './auchan.parser.js';
import { CarrefourParser } from './carrefour.parser.js';
import { GrandFraisParser } from './grand-frais.parser.js';
import { LeclercParser } from './leclerc.parser.js';
import { LidlParser } from './lidl.parser.js';
import type { ReceiptParser } from './receipt-parser.interface.js';

export class ParserRegistry {
  detect(rawText: string): ReceiptParser | null {
    // Check only first 20 lines for brand names in the header
    const header = rawText.split('\n').slice(0, 20).join('\n');

    if (/CARREFOUR/i.test(header)) return new CarrefourParser();
    if (/E\.LECLERC|LECLERC/i.test(header)) return new LeclercParser();
    if (/\bAuchan\b|auchan\.fr/i.test(header)) return new AuchanParser();

    // Grand Frais branding often sits in the footer ("VOTRE MAGASIN GRAND FRAIS"),
    // so search the full text; "Prix TVA" in the header is an extra hint.
    if (/GRAND[\s-]?FRAIS/i.test(rawText) || /^Prix\s+TVA/im.test(header)) {
      return new GrandFraisParser();
    }

    // Lidl digital receipts can put brand name at the bottom, so search full text
    // "Ticket de vente" is a good Lidl hint in French supermarket receipts
    if (/\bLIDL\b|lidl\.fr|Ticket de vente/i.test(rawText)) return new LidlParser();

    return null;
  }
}
