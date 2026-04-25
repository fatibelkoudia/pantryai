/**
 * Unit tests for OcrProcessor product matching and MIME passthrough.
 * Covers EAN-13/ean13 matching, dedupe by name, expirationDate, and MIME in data URI.
 * Uses mocks only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@nestjs/bullmq', () => ({
  Processor: () => () => undefined,
  WorkerHost: class {
    async process(): Promise<void> {}
  },
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({ send: vi.fn() })),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}));

vi.mock('@mistralai/mistralai', () => ({
  Mistral: vi.fn(() => ({
    ocr: { process: vi.fn() },
    chat: { complete: vi.fn() },
  })),
}));

vi.mock('tesseract.js', () => ({ default: { recognize: vi.fn() } }));

import type { PrismaService } from '../../prisma/prisma.service.js';
import { OcrProcessor } from '../ocr.processor.js';
import type { ParsedReceiptItem } from '../parsers/index.js';

// Helper type to call private members in tests
interface PrivateProcessor {
  upsertStockItems: (userId: string, items: ParsedReceiptItem[]) => Promise<void>;
  runMistralOcr: (buf: Buffer, mimeType?: string) => Promise<string>;
  mistral: { ocr: { process: ReturnType<typeof vi.fn> } };
}

const USER_ID = 'user-1';

function makePrisma() {
  const prisma = {
    product: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    stockItem: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
  return prisma;
}

let prismaMock: ReturnType<typeof makePrisma>;
let processor: OcrProcessor;
let priv: PrivateProcessor;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock = makePrisma();
  processor = new OcrProcessor(prismaMock as unknown as PrismaService);
  priv = processor as unknown as PrivateProcessor;
});

function item(overrides: Partial<ParsedReceiptItem> & { name: string }): ParsedReceiptItem {
  return { confidence: 0.7, ...overrides };
}

describe('upsertStockItems() — product matching', () => {
  it('creates distinct products for distinct names', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.create
      .mockResolvedValueOnce({ id: 'p1', name: 'Lait' })
      .mockResolvedValueOnce({ id: 'p2', name: 'Pain' });

    await priv.upsertStockItems(USER_ID, [item({ name: 'Lait' }), item({ name: 'Pain' })]);

    expect(prismaMock.product.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.stockItem.create).toHaveBeenCalledTimes(2);
  });

  it('reuses the same product for the same name regardless of case/whitespace', async () => {
    prismaMock.product.findFirst
      .mockResolvedValueOnce(null) // first item: no match
      .mockResolvedValueOnce({ id: 'p1', name: 'Lait' }); // second item: reuse existing product
    prismaMock.product.create.mockResolvedValue({ id: 'p1', name: 'Lait' });

    await priv.upsertStockItems(USER_ID, [item({ name: 'Lait' }), item({ name: '  LAIT  ' })]);

    expect(prismaMock.product.create).toHaveBeenCalledTimes(1);
    // name is normalized (trim + collapse spaces)
    expect(prismaMock.product.create).toHaveBeenCalledWith({ data: { name: 'Lait' } });
    expect(prismaMock.stockItem.create).toHaveBeenCalledTimes(2);
  });

  it('scopes name matches to ean13:null so a loose line cannot merge into a barcoded product', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.create.mockResolvedValue({ id: 'p1', name: 'Lait' });

    await priv.upsertStockItems(USER_ID, [item({ name: 'Lait' })]);

    expect(prismaMock.product.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: 'Lait', mode: 'insensitive' }, ean13: null },
    });
  });

  it('matches by EAN-13 first and reuses it regardless of name', async () => {
    prismaMock.product.findFirst.mockResolvedValue({ id: 'pX', ean13: '3017620422003' });

    await priv.upsertStockItems(USER_ID, [item({ name: 'whatever', ean13: '3017620422003' })]);

    expect(prismaMock.product.findFirst).toHaveBeenCalledWith({
      where: { ean13: '3017620422003' },
    });
    expect(prismaMock.product.create).not.toHaveBeenCalled();
    expect(prismaMock.stockItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ productId: 'pX' }) }),
    );
  });

  it('threads expirationDate onto the created StockItem', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.create.mockResolvedValue({ id: 'p1', name: 'Yaourt' });

    await priv.upsertStockItems(USER_ID, [item({ name: 'Yaourt', expirationDate: '2026-07-01' })]);

    const data = prismaMock.stockItem.create.mock.calls[0]![0].data;
    expect(data.expirationDate).toBeInstanceOf(Date);
    expect((data.expirationDate as Date).toISOString()).toBe(new Date('2026-07-01').toISOString());
  });

  it('omits expirationDate when the item has none', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.create.mockResolvedValue({ id: 'p1', name: 'Sel' });

    await priv.upsertStockItems(USER_ID, [item({ name: 'Sel' })]);

    expect(prismaMock.stockItem.create.mock.calls[0]![0].data).not.toHaveProperty('expirationDate');
  });
});

describe('runMistralOcr() — MIME passthrough', () => {
  it('sends the provided MIME type in the data: URI', async () => {
    priv.mistral.ocr.process.mockResolvedValue({ pages: [{ markdown: 'text' }] });

    await priv.runMistralOcr(Buffer.from('img'), 'image/png');

    const arg = priv.mistral.ocr.process.mock.calls[0]![0];
    expect(arg.document.imageUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('defaults to image/jpeg when no MIME is provided', async () => {
    priv.mistral.ocr.process.mockResolvedValue({ pages: [{ markdown: 'text' }] });

    await priv.runMistralOcr(Buffer.from('img'));

    const arg = priv.mistral.ocr.process.mock.calls[0]![0];
    expect(arg.document.imageUrl).toMatch(/^data:image\/jpeg;base64,/);
  });
});
