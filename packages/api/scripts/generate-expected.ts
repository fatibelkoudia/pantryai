/**
 * Generate .expected.json files from current parser output.
 * Run after checking smoke-fixtures output.
 * Usage: pnpm generate-expected
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GenericParser, ParserRegistry } from '../src/ocr/parsers/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../src/ocr/__tests__/fixtures/receipts');
const registry = new ParserRegistry();
const generic = new GenericParser();

// One main fixture per retailer
const TARGETS: [string, string][] = [
  ['CARREFOUR', 'carrefour/DOC-20260322-WA0005..ocr.txt'],
  ['LIDL', 'lidl/lidl_05.ocr.txt'],
  ['LECLERC', 'leclerc/leclerc_02.ocr.txt'],
  ['AUCHAN', 'auchan/auchan_01.ocr.txt'],
  ['GRAND FRAIS', 'grand-frais/grand-frais_01.ocr.txt'],
];

for (const [, relative] of TARGETS) {
  const ocrPath = path.join(FIXTURES_DIR, relative);
  if (!existsSync(ocrPath)) {
    console.warn(`SKIP (missing): ${relative}`);
    continue;
  }

  const rawText = readFileSync(ocrPath, 'utf8');
  const parser = registry.detect(rawText) ?? generic;
  const items = parser.parse(rawText);

  const expectedPath = ocrPath.replace('.ocr.txt', '.expected.json');
  const output = { retailer: parser.retailerName, items };
  writeFileSync(expectedPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(
    `✓  ${relative.replace('.ocr.txt', '.expected.json')} — ${items.length} items [${parser.retailerName}]`,
  );
}
