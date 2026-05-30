import { describe, expect, it } from 'vitest';
import { GrandFraisParser } from '../grand-frais.parser.js';

const parser = new GrandFraisParser();

// Real Grand Frais "GIE" multi-société ticket (per-société sections, leading
// VAT code, "Nx" quantities, comma decimals, weight items on a NET line).
const GRAND_FRAIS_RECEIPT = `
GIE DE VILLENEUVE LOUBET
97 AVENUE DES CAVALIERS
06270 VILLENEUVE-LOUBET
FRANCE
07/06/2026 11:50:10 N° Ticket vente 748
Numéro client 1238569345
------------------------------------------
T Qt Description PU TTC
SNC FL VILLENEUVE LOUBET
A 1x *CHAMPIGNON BLANC PC FR 1,99 € 1,99 €
A *MELON VERT
 NET 2,545 kg x 2,99 €/kg 7,61 €
 PT 0,005 kg
A 1x *POMME PINK LADY BQTE 8 2,99 € 2,99 €
A *TOMATE COTELEE ROUGE
 NET 0,875 kg x 3,99 €/kg 3,49 €
 PT 0,005 kg
A 2x *OIGNON BLANC FRANCE BO 1,99 € 3,98 €
A *PECHE PLATE BLANCHE
 NET 0,500 kg x 3,49 €/kg 1,75 €
 PT 0,005 kg
 Offre APP Pêche Plate -0,51 €
SNC VILLENEUVESEC
C 1x BOISSON APERITIVO ITA 14,99 € 14,99 €
------------------------------------------
39 LIGNES 42 ARTICLES
------------------------------------------
TVA Taux Mt.HT Mt.TVA Mt.TTC
TOTAL HT 123,36 €
NET TTC 131,94 €
VOTRE MAGASIN GRAND FRAIS VOUS ACCUEILLE
`.trim();

describe('GrandFraisParser', () => {
  it('extracts every product line, ignoring société headers, tare and totals', () => {
    const items = parser.parse(GRAND_FRAIS_RECEIPT);
    // 4 unit-priced + 3 weight items = 7 products.
    expect(items).toHaveLength(7);
  });

  it('parses a unit-priced row with quantity and total price', () => {
    const items = parser.parse(GRAND_FRAIS_RECEIPT);
    const oignon = items.find((i) => i.name.toLowerCase().includes('oignon blanc'));
    expect(oignon).toMatchObject({ quantity: 2, price: 3.98 });
  });

  it('parses a weight item from the following NET line', () => {
    const items = parser.parse(GRAND_FRAIS_RECEIPT);
    const melon = items.find((i) => i.name.toLowerCase().includes('melon'));
    expect(melon).toMatchObject({ quantity: 2.545, unit: 'kg', price: 7.61 });
  });

  it('handles a row without an asterisk prefix (BOISSON APERITIVO)', () => {
    const items = parser.parse(GRAND_FRAIS_RECEIPT);
    const boisson = items.find((i) => i.name.toLowerCase().includes('boisson'));
    expect(boisson).toMatchObject({ quantity: 1, price: 14.99 });
  });

  it('excludes société headers, the "Offre" discount and the totals section', () => {
    const items = parser.parse(GRAND_FRAIS_RECEIPT);
    const names = items.map((i) => i.name.toLowerCase());
    expect(names.some((n) => n.includes('snc'))).toBe(false);
    expect(names.some((n) => n.includes('offre'))).toBe(false);
    expect(names.some((n) => n.includes('total'))).toBe(false);
    expect(names.some((n) => n.includes('lignes'))).toBe(false);
  });

  it('returns empty array for empty input', () => {
    expect(parser.parse('')).toEqual([]);
  });
});
