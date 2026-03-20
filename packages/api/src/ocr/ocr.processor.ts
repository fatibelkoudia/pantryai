import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Mistral } from '@mistralai/mistralai';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { lookup } from 'node:dns/promises';
import Tesseract from 'tesseract.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { OcrJobPayload, QrJobPayload } from './ocr.service.js';
import type { ParsedReceipt, ParsedReceiptItem } from './parsers/index.js';
import { GenericParser, ParserRegistry } from './parsers/index.js';

const RECEIPT_PARSE_PROMPT = `You are a receipt parser. Given OCR text from a French supermarket receipt, extract the product list.
Return a JSON object with the following shape:
{
  "retailer": "<store name if visible, else null>",
  "items": [
    { "name": "<product name>", "quantity": <number or null>, "unit": "<unit string or null>" }
  ]
}
Only include actual food/drink products. Skip totals, taxes, loyalty points, and store info lines.
Respond with valid JSON only.`;

// Run max 3 OCR jobs at once so the API stays responsive.
@Processor('ocr', { concurrency: 3 })
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name);
  private readonly s3: S3Client;
  private readonly mistral: Mistral;
  private readonly bucket: string;

  private readonly parserRegistry = new ParserRegistry();
  private readonly genericParser = new GenericParser();

  constructor(private readonly prisma: PrismaService) {
    super();
    this.s3 = new S3Client({
      region: 'auto',
      ...(process.env['R2_ENDPOINT'] && { endpoint: process.env['R2_ENDPOINT'] }),
      credentials: {
        accessKeyId: process.env['R2_ACCESS_KEY_ID'] ?? '',
        secretAccessKey: process.env['R2_SECRET_ACCESS_KEY'] ?? '',
      },
    });
    this.mistral = new Mistral({ apiKey: process.env['MISTRAL_API_KEY'] ?? '' });
    this.bucket = process.env['R2_BUCKET_NAME'] ?? 'pantryai-receipts';
  }

  async process(job: Job<OcrJobPayload | QrJobPayload>): Promise<void> {
    if (job.name === 'process-qr') {
      return this.processQrJob(job as Job<QrJobPayload>);
    }
    return this.processImageJob(job as Job<OcrJobPayload>);
  }

  private async processImageJob(job: Job<OcrJobPayload>): Promise<void> {
    const { jobId, userId, imageKey, mimeType } = job.data;
    let imageBuffer: Buffer | null = null;

    try {
      await this.prisma.ocrJob.update({
        where: { id: jobId },
        data: { status: 'PROCESSING' },
      });

      imageBuffer = await this.downloadFromR2(imageKey);

      // Try Mistral first, then Tesseract if it fails.
      let rawText: string;
      try {
        rawText = await this.runMistralOcr(imageBuffer, mimeType ?? 'image/jpeg');
        this.logger.log(`Mistral OCR succeeded for job ${jobId}`);
      } catch (mistralErr) {
        this.logger.warn(
          `Mistral OCR failed for job ${jobId}, falling back to Tesseract: ${(mistralErr as Error).message}`,
        );
        rawText = await this.runTesseractOcr(imageBuffer);
      }

      const parsed = await this.parseReceiptText(rawText);

      await this.upsertStockItems(userId, parsed.items);

      await this.prisma.ocrJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          // Prisma nullable fields should use null, not undefined.
          retailer: parsed.retailer ?? null,
          // RGPD: don't keep raw OCR text after parsing.
          rawText: null,
          // Prisma JSON typing is strict, so cast here.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parsedItems: parsed.items as any,
        },
      });

      this.logger.log(`Job ${jobId} completed — ${parsed.items.length} items extracted`);

      // RGPD: delete the receipt image after success.
      await this.safeDeleteFromR2(imageKey);
    } catch (err) {
      const message = (err as Error).message;

      // Not the last try: keep the image and let BullMQ retry.
      if (!this.isFinalAttempt(job)) {
        this.logger.warn(
          `Job ${jobId} attempt ${(job.attemptsMade ?? 0) + 1} failed, will retry: ${message}`,
        );
        throw err;
      }

      // Last try failed: mark FAILED and delete the image (RGPD).
      this.logger.error(`Job ${jobId} failed (no attempts left): ${message}`);
      await this.prisma.ocrJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', error: message },
      });
      await this.safeDeleteFromR2(imageKey);
    }
  }

  private async processQrJob(job: Job<QrJobPayload>): Promise<void> {
    const { jobId, userId, url } = job.data;

    try {
      await this.prisma.ocrJob.update({
        where: { id: jobId },
        data: { status: 'PROCESSING' },
      });

      await this.validatePublicUrl(url);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`Remote URL returned HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      const isPdf = contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf');

      let parsed: ParsedReceipt;
      let rawText: string | null = null;

      if (contentType.includes('application/json')) {
        const json = (await response.json()) as unknown;
        parsed = this.parseJsonReceipt(json);
        // Keep rawText empty here, parsedItems already has the data.
      } else if (isPdf) {
        const buf = Buffer.from(await response.arrayBuffer());
        if (buf.length > 5 * 1024 * 1024) throw new Error('PDF exceeds 5 MB limit');
        rawText = await this.runMistralOcrPdf(buf);
        parsed = await this.parseReceiptText(rawText);
      } else {
        rawText = await this.readBodyWithLimit(response, 5 * 1024 * 1024);
        const text = contentType.includes('text/html') ? this.stripHtml(rawText) : rawText;
        parsed = await this.parseReceiptText(text);
      }

      await this.upsertStockItems(userId, parsed.items);

      await this.prisma.ocrJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          retailer: parsed.retailer ?? null,
          ...(rawText !== null && { rawText }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parsedItems: parsed.items as any,
        },
      });

      this.logger.log(`QR job ${jobId} completed — ${parsed.items.length} items extracted`);
    } catch (err) {
      const message = (err as Error).message;

      // Not the last try: fail now and let BullMQ retry.
      if (!this.isFinalAttempt(job)) {
        this.logger.warn(
          `QR job ${jobId} attempt ${(job.attemptsMade ?? 0) + 1} failed, will retry: ${message}`,
        );
        throw err;
      }

      this.logger.error(`QR job ${jobId} failed (no attempts left): ${message}`);
      await this.prisma.ocrJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', error: message },
      });
    }
    // QR/AGEC jobs have no image in R2, so nothing to delete.
  }

  // Returns true when this is the last BullMQ attempt.
  // Also handles tests where attempts fields are missing.
  private isFinalAttempt(job: Job): boolean {
    const maxAttempts = job.opts?.attempts ?? 1;
    const attemptsMade = job.attemptsMade ?? 0;
    return attemptsMade + 1 >= maxAttempts;
  }

  private async safeDeleteFromR2(imageKey: string): Promise<void> {
    if (!imageKey) return;
    await this.deleteFromR2(imageKey).catch((err: unknown) => {
      this.logger.warn(`Failed to delete R2 image ${imageKey}: ${(err as Error).message}`);
    });
  }

  // Create/find products, then add stock items.
  private async upsertStockItems(userId: string, items: ParsedReceiptItem[]): Promise<void> {
    for (const item of items) {
      const name = this.normalizeName(item.name);

      // EAN-13 match is the safest match.
      let product = item.ean13
        ? await this.prisma.product.findFirst({ where: { ean13: item.ean13 } })
        : null;

      // No ean13: match by name only on generic OCR products.
      // This avoids mixing fuzzy OCR lines with real EAN-13 products.
      if (!product && !item.ean13) {
        product = await this.prisma.product.findFirst({
          where: { name: { equals: name, mode: 'insensitive' }, ean13: null },
        });
      }

      if (!product) {
        product = await this.prisma.product.create({
          data: { name, ...(item.ean13 && { ean13: item.ean13 }) },
        });
      }

      await this.prisma.stockItem.create({
        data: {
          userId,
          productId: product.id,
          quantity: item.quantity ?? 1,
          unit: item.unit ?? 'unit',
          location: 'PANTRY',
          // If receipt has an expiry date, copy it to the stock item.
          ...(item.expirationDate && { expirationDate: new Date(item.expirationDate) }),
        },
      });
    }
  }

  private normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
  }

  private async validatePublicUrl(rawUrl: string): Promise<void> {
    const parsed = new URL(rawUrl);
    const { address } = await lookup(parsed.hostname);
    const PRIVATE = [/^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./];
    if (
      address === '0.0.0.0' ||
      address === '::1' ||
      /^f[cd]/i.test(address) ||
      PRIVATE.some((re) => re.test(address))
    ) {
      throw new Error(`SSRF: resolved ${parsed.hostname} to private address ${address}`);
    }
  }

  private async runMistralOcrPdf(buf: Buffer): Promise<string> {
    const base64 = buf.toString('base64');
    const response = await this.mistral.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        documentUrl: `data:application/pdf;base64,${base64}`,
      },
    });
    return response.pages.map((p: { markdown: string }) => p.markdown).join('\n');
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/td>/gi, '  ')
      .replace(/<\/th>/gi, '  ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)))
      .replace(/[ \t]{3,}/g, '  ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private parseJsonReceipt(json: unknown): ParsedReceipt {
    if (typeof json !== 'object' || json === null) return { items: [] };
    const r = json as Record<string, unknown>;

    const rawItems = (r['items'] ?? r['lignes'] ?? r['products'] ?? r['produits']) as
      | unknown[]
      | undefined;
    if (!Array.isArray(rawItems)) return { items: [] };

    const items: ParsedReceiptItem[] = rawItems
      .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
      .map((i) => {
        const name = String(i['libelle'] ?? i['name'] ?? i['label'] ?? i['nom'] ?? '').trim();
        const quantity =
          typeof i['quantite'] === 'number'
            ? i['quantite']
            : typeof i['quantity'] === 'number'
              ? i['quantity']
              : typeof i['qty'] === 'number'
                ? i['qty']
                : undefined;
        const unit = (i['unite'] ?? i['unit'] ?? i['uniteMesure']) as string | undefined;
        const price =
          typeof i['prixUnitaire'] === 'number'
            ? i['prixUnitaire']
            : typeof i['price'] === 'number'
              ? i['price']
              : undefined;
        const rawExpiration = (i['dlc'] ?? i['ddm'] ?? i['expirationDate'] ?? i['dateLimite']) as
          | string
          | undefined;
        const expirationDate =
          typeof rawExpiration === 'string' && !Number.isNaN(Date.parse(rawExpiration))
            ? rawExpiration
            : undefined;
        return {
          name,
          ...(typeof quantity === 'number' && { quantity }),
          ...(typeof unit === 'string' && unit.trim() && { unit: unit.trim() }),
          ...(typeof price === 'number' && { price }),
          ...(expirationDate && { expirationDate }),
          confidence: 0.95,
        };
      })
      .filter((i) => i.name.length > 0);

    const retailer =
      typeof r['enseigneCommerciale'] === 'string'
        ? r['enseigneCommerciale']
        : typeof r['retailer'] === 'string'
          ? r['retailer']
          : typeof r['magasin'] === 'string'
            ? r['magasin']
            : undefined;

    return { items, ...(retailer && { retailer }) };
  }

  private async readBodyWithLimit(response: Response, maxBytes: number): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) return response.text();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        reader.cancel().catch(() => undefined);
        throw new Error('Remote content exceeds 5 MB limit');
      }
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }

  private async downloadFromR2(imageKey: string): Promise<Buffer> {
    const response = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: imageKey }),
    );

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  private async deleteFromR2(imageKey: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: imageKey }));
  }

  private async runMistralOcr(imageBuffer: Buffer, mimeType = 'image/jpeg'): Promise<string> {
    const base64 = imageBuffer.toString('base64');
    const response = await this.mistral.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        type: 'image_url',
        imageUrl: `data:${mimeType};base64,${base64}`,
      },
    });
    return response.pages.map((p: { markdown: string }) => p.markdown).join('\n');
  }

  private async runTesseractOcr(imageBuffer: Buffer): Promise<string> {
    const result = await Tesseract.recognize(imageBuffer, 'fra+eng', {
      logger: () => undefined,
    });
    return result.data.text;
  }

  private async parseReceiptText(rawText: string): Promise<ParsedReceipt> {
    // First try a store-specific parser.
    const parser = this.parserRegistry.detect(rawText);
    if (parser) {
      this.logger.log(`Using ${parser.retailerName} parser`);
      return { retailer: parser.retailerName, items: parser.parse(rawText) };
    }

    // If store is unknown, ask Mistral Chat.
    try {
      const response = await this.mistral.chat.complete({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: RECEIPT_PARSE_PROMPT },
          { role: 'user', content: rawText },
        ],
        responseFormat: { type: 'json_object' },
      });

      const content = response.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        return { items: [] };
      }

      const raw = JSON.parse(content) as { retailer?: string | null; items?: unknown[] };
      const items: ParsedReceiptItem[] = Array.isArray(raw.items)
        ? (raw.items as Array<Record<string, unknown>>)
            .filter((i) => typeof i['name'] === 'string')
            .map((i) => ({
              name: i['name'] as string,
              ...(typeof i['quantity'] === 'number' && { quantity: i['quantity'] as number }),
              ...(typeof i['unit'] === 'string' && { unit: i['unit'] as string }),
              confidence: 0.7,
            }))
        : [];

      const result: ParsedReceipt = { items };
      if (raw.retailer) result.retailer = raw.retailer;
      return result;
    } catch {
      // If Mistral fails, use GenericParser.
      this.logger.warn('Mistral Chat failed, using GenericParser fallback');
      return { items: this.genericParser.parse(rawText) };
    }
  }
}
