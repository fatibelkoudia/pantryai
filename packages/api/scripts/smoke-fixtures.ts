/**
 * Quick smoke test for OCR fixtures against parser registry.
 * Usage: pnpm smoke-fixtures
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GenericParser, ParserRegistry } from '../src/ocr/parsers/index.js';
import type { ParsedReceiptItem } from '../src/ocr/parsers/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../src/ocr/__tests__/fixtures/receipts');
const registry = new ParserRegistry();
const generic = new GenericParser();

const FILES: [string, string][] = [
  ['Carrefour Market PDF', 'carrefour/DOC-20260322-WA0005..ocr.txt'],
  ['Carrefour Hyper JPG', 'carrefour/2966342_1.ocr.txt'],
  ['Lidl HTML table', 'lidl/lidl_01.ocr.txt'],
  ['Lidl plain text', 'lidl/lidl_04.ocr.txt'],
  ['Lidl markdown table', 'lidl/lidl_05.ocr.txt'],
  ['Leclerc real receipt', 'leclerc/leclerc_02.ocr.txt'],
  ['Auchan real receipt', 'auchan/auchan_01.ocr.txt'],
  ['Grand Frais real receipt', 'grand-frais/grand-frais_01.ocr.txt'],
];

function printItems(items: ParsedReceiptItem[], max = 6): void {
  const cols = { Name: 30, Qty: 5, Price: 8, Conf: 6 };
  const header = `${'Name'.padEnd(cols.Name)} ${'Qty'.padEnd(cols.Qty)} ${'Price'.padEnd(cols.Price)} ${'Conf'.padEnd(cols.Conf)}`;
  const sep = Object.values(cols)
    .map((w) => '-'.repeat(w + 1))
    .join('+');
  console.log(`  ${header}`);
  console.log(`  ${sep}`);
  for (const [i, item] of items.slice(0, max).entries()) {
    const qty = item.quantity?.toString() ?? '-';
    const price = item.price != null ? `€${item.price.toFixed(2)}` : '-';
    const flag = item.confidence < 0.5 ? ' ⚠ low' : '';
    console.log(
      `  ${item.name.padEnd(cols.Name)} ${qty.padEnd(cols.Qty)} ${price.padEnd(cols.Price)} ${item.confidence.toFixed(2)}${flag}`,
    );
    void i;
  }
  if (items.length > max) console.log(`  ... and ${items.length - max} more items`);
}

let totalFiles = 0;
let totalItems = 0;

for (const [label, relative] of FILES) {
  const filePath = path.join(FIXTURES_DIR, relative);
  const divider = '═'.repeat(62);
  console.log(`\n${divider}`);

  if (!existsSync(filePath)) {
    console.log(`  ⚠  MISSING fixture: ${relative}`);
    console.log(
      `     Run: pnpm record-ocr src/ocr/__tests__/fixtures/receipts/${relative.replace('.ocr.txt', '.jpg')}`,
    );
    continue;
  }

  const rawText = readFileSync(filePath, 'utf8');
  const parser = registry.detect(rawText) ?? generic;
  const items = parser.parse(rawText);

  console.log(`  ${label}  [${parser.retailerName}]  →  ${items.length} items`);
  console.log(divider);
  printItems(items);

  const lowConf = items.filter((i) => i.confidence < 0.5);
  if (lowConf.length) {
    console.log(
      `\n  ⚠  ${lowConf.length} low-confidence item(s): ${lowConf.map((i) => i.name).join(', ')}`,
    );
  }

  totalFiles++;
  totalItems += items.length;
}

console.log(`\n${'═'.repeat(62)}`);
console.log(`  ${totalFiles} fixtures processed, ${totalItems} total items extracted`);
console.log(`${'═'.repeat(62)}\n`);
