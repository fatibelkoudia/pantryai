/**
 * Run Mistral OCR once for one image and save the text fixture.
 * Usage: pnpm tsx scripts/record-ocr-fixture.ts <path-to-image>
 * Output: saves <image-path>.ocr.txt next to the image.
 * Requires MISTRAL_API_KEY.
 */
import { Mistral } from '@mistralai/mistralai';
import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

config({ path: path.resolve(process.cwd(), '.env') });

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: pnpm tsx scripts/record-ocr-fixture.ts <path-to-image>');
  process.exit(1);
}

const apiKey = process.env['MISTRAL_API_KEY'];
if (!apiKey) {
  console.error('Error: MISTRAL_API_KEY not set in environment or .env');
  process.exit(1);
}

const absolutePath = path.resolve(process.cwd(), imagePath);
const ext = path.extname(absolutePath).toLowerCase();
const outPath = absolutePath.replace(/\.(jpg|jpeg|png|pdf)$/i, '.ocr.txt');

console.log(`Reading: ${absolutePath}`);
const buffer = readFileSync(absolutePath);
const base64 = buffer.toString('base64');

const mimeTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
};
const mimeType = mimeTypes[ext] ?? 'image/jpeg';
const isPdf = ext === '.pdf';

const mistral = new Mistral({ apiKey });

async function run(): Promise<void> {
  console.log(`Running Mistral OCR (${isPdf ? 'PDF' : 'image'} mode)...`);

  let ocrText: string;

  if (isPdf) {
    const response = await mistral.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        documentUrl: `data:${mimeType};base64,${base64}`,
      },
    });
    ocrText = response.pages.map((p: { markdown: string }) => p.markdown).join('\n\n');
  } else {
    const response = await mistral.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        type: 'image_url',
        imageUrl: `data:${mimeType};base64,${base64}`,
      },
    });
    ocrText = response.pages.map((p: { markdown: string }) => p.markdown).join('\n\n');
  }

  writeFileSync(outPath, ocrText, 'utf8');
  console.log(`\nSaved OCR text to: ${outPath}`);
  console.log(`\n--- Preview (first 20 lines) ---`);
  console.log(ocrText.split('\n').slice(0, 20).join('\n'));
  console.log('---');
}

run().catch((err: unknown) => {
  console.error('OCR failed:', (err as Error).message);
  process.exit(1);
});
