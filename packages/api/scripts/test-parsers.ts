/**
 * Quick parser smoke test (no full stack needed).
 * Usage: pnpm tsx scripts/test-parsers.ts
 */
import { CarrefourParser } from '../src/ocr/parsers/carrefour.parser.js';
import { GenericParser } from '../src/ocr/parsers/generic.parser.js';
import { LeclercParser } from '../src/ocr/parsers/leclerc.parser.js';
import { LidlParser } from '../src/ocr/parsers/lidl.parser.js';
import { ParserRegistry } from '../src/ocr/parsers/parser-registry.js';
import type { ParsedReceiptItem } from '../src/ocr/parsers/receipt-parser.interface.js';

// Sample receipts

const SAMPLES: Record<string, string> = {
  carrefour: `
CARREFOUR MARKET PARIS 15
================
3228857000166  FARINE BLE T55 1KG          1     0,89
3175680011480  BEURRE EXTRA FIN 250G        2     1,55
                REMISE CARTE -0,20
3274080005003  LAIT DEMI ECREME 1L          6     0,89
3029330003533  YAOURT NATURE 500G           1     1,29
TOTAL ARTICLES                                    9,21
TVA 5.5%                                          0,51
`.trim(),

  lidl: `
LIDL
================
YAOURT NATUR BCO  1.89 A
PAIN COMPLET 5CE  0.99 A
REMISE            -0.20
LAIT ECRM 1L UHT  0.85 A
POMMES GOLDEN     2.45 A
x2
TOMATES RONDES    1.29 A
TOTAL          9.27
CB             9.27
`.trim(),

  leclerc: `
E.LECLERC
EPICERIE
FARINE DE BLE T55          0,89 A
SUCRE BLANC 1KG             0,95 A
FRAIS
YAOURT NATURE X8            1,29 A
BEURRE PLAQUETTE 250G       1,89 A
SURGELES
PIZZA ROYALE 400G           3,45 A
TOTAL NET A PAYER           8,47
TVA 5.5%                    0,47
`.trim(),

  generic: `
SUPERMARCHE BONHEUR
BAGUETTE TRADITION    0.95
JAMBON BLANC 4T       2.45
LAIT ENTIER  2 l  1.89
TOTAL                 5.29
`.trim(),
};

// Runner

const registry = new ParserRegistry();
const parsers = {
  carrefour: new CarrefourParser(),
  lidl: new LidlParser(),
  leclerc: new LeclercParser(),
  generic: new GenericParser(),
};

function printTable(items: ParsedReceiptItem[]): void {
  if (items.length === 0) {
    console.log('  (no items extracted)\n');
    return;
  }

  const rows = items.map((item) => ({
    Name: item.name,
    Qty: item.quantity?.toString() ?? '-',
    Unit: item.unit ?? '-',
    Price: item.price != null ? `€${item.price.toFixed(2)}` : '-',
    EAN: item.ean13 ?? '-',
    Conf: item.confidence.toFixed(2),
    Flag: item.confidence < 0.5 ? '⚠ low' : '',
  }));

  const cols = Object.keys(rows[0]) as (keyof (typeof rows)[0])[];
  const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c]).length)));

  const line = widths.map((w) => '-'.repeat(w + 2)).join('+');
  const header = cols.map((c, i) => c.padEnd(widths[i]!)).join(' | ');

  console.log(`  ${header}`);
  console.log(`  ${line}`);
  for (const row of rows) {
    const cells = cols.map((c, i) => String(row[c]).padEnd(widths[i]!)).join(' | ');
    console.log(`  ${cells}`);
  }
  console.log();
}

for (const [name, rawText] of Object.entries(SAMPLES)) {
  const detected = registry.detect(rawText);
  const parser = detected ?? parsers[name as keyof typeof parsers];
  const strategy = detected ? `${detected.retailerName} (auto-detected)` : `${name} (manual)`;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Receipt: ${name.toUpperCase()}  |  Parser: ${strategy}`);
  console.log(`${'═'.repeat(60)}`);

  const items = parser.parse(rawText);
  printTable(items);

  const lowConf = items.filter((i) => i.confidence < 0.5);
  if (lowConf.length > 0) {
    console.log(
      `  ⚠  ${lowConf.length} low-confidence item(s): ${lowConf.map((i) => i.name).join(', ')}`,
    );
  }

  console.log(`  ✓  ${items.length} item(s) extracted`);
}

console.log(`\n${'═'.repeat(60)}\n`);
