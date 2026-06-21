/**
 * Unit tests for OcrService product matching and OcrProcessor MIME passthrough.
 * Covers EAN-13/ean13 matching, dedupe by name, expirationDate, and MIME in data URI.
 * Uses mocks only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@nestjs/bullmq', () => ({
  Processor: () => () => undefined,
  InjectQueue: () => () => undefined,
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
import { OcrService } from '../ocr.service.js';
import type { ParsedReceiptItem } from '../parsers/index.js';

// Helper type to call private members in tests
interface PrivateProcessor {
  runMistralOcr: (buf: Buffer, mimeType?: string) => Promise<string>;
  mistral: { ocr: { process: ReturnType<typeof vi.fn> } };
}

const USER_ID = 'user-1';

function makePrisma() {
  const prisma = {
    ocrJob: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
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
let service: OcrService;
let processor: OcrProcessor;
let priv: PrivateProcessor;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock = makePrisma();
  service = new OcrService(prismaMock as unknown as PrismaService, {} as never, {} as never);
  processor = new OcrProcessor(prismaMock as unknown as PrismaService, service, {} as never);
  priv = processor as unknown as PrivateProcessor;
});

function item(overrides: Partial<ParsedReceiptItem> & { name: string }): ParsedReceiptItem {
  return { confidence: 0.7, ...overrides };
}

describe('commitParsedItems() — product matching', () => {
  it('creates distinct products for distinct names', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.create
      .mockResolvedValueOnce({ id: 'p1', name: 'Lait' })
      .mockResolvedValueOnce({ id: 'p2', name: 'Pain' });

    await service.commitParsedItems(USER_ID, [item({ name: 'Lait' }), item({ name: 'Pain' })]);

    expect(prismaMock.product.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.stockItem.create).toHaveBeenCalledTimes(2);
  });

  it('reuses the same product for the same name regardless of case/whitespace', async () => {
    prismaMock.product.findFirst
      .mockResolvedValueOnce(null) // first item: no match
      .mockResolvedValueOnce({ id: 'p1', name: 'Lait' }); // second item: reuse existing product
    prismaMock.product.create.mockResolvedValue({ id: 'p1', name: 'Lait' });

    await service.commitParsedItems(USER_ID, [item({ name: 'Lait' }), item({ name: '  LAIT  ' })]);

    expect(prismaMock.product.create).toHaveBeenCalledTimes(1);
    // name is normalized (trim + collapse spaces)
    expect(prismaMock.product.create).toHaveBeenCalledWith({ data: { name: 'Lait' } });
    expect(prismaMock.stockItem.create).toHaveBeenCalledTimes(2);
  });

  it('scopes name matches to ean13:null so a loose line cannot merge into a barcoded product', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.create.mockResolvedValue({ id: 'p1', name: 'Lait' });

    await service.commitParsedItems(USER_ID, [item({ name: 'Lait' })]);

    expect(prismaMock.product.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: 'Lait', mode: 'insensitive' }, ean13: null },
    });
  });

  it('matches by EAN-13 first and reuses it regardless of name', async () => {
    prismaMock.product.findFirst.mockResolvedValue({ id: 'pX', ean13: '3017620422003' });

    await service.commitParsedItems(USER_ID, [item({ name: 'whatever', ean13: '3017620422003' })]);

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

    await service.commitParsedItems(USER_ID, [
      item({ name: 'Yaourt', expirationDate: '2026-07-01' }),
    ]);

    const data = prismaMock.stockItem.create.mock.calls[0]![0].data;
    expect(data.expirationDate).toBeInstanceOf(Date);
    expect((data.expirationDate as Date).toISOString()).toBe(new Date('2026-07-01').toISOString());
  });

  it('omits expirationDate when the item has none', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.create.mockResolvedValue({ id: 'p1', name: 'Sel' });

    await service.commitParsedItems(USER_ID, [item({ name: 'Sel' })]);

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

describe('confirmJob() — selective add to stock', () => {
  const PARSED = [
    { name: 'Lait', quantity: 1, confidence: 0.9 },
    { name: 'Pain', quantity: 2, confidence: 0.8 },
    { name: 'Sel', confidence: 0.7 },
  ];

  function mockJob(overrides: Record<string, unknown> = {}) {
    prismaMock.ocrJob.findUnique.mockResolvedValue({
      id: 'job-1',
      userId: USER_ID,
      status: 'COMPLETED',
      parsedItems: PARSED,
      ...overrides,
    });
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.create.mockResolvedValue({ id: 'p1', name: 'X' });
  }

  it('adds only the selected indices and returns the count', async () => {
    mockJob();

    const result = await service.confirmJob('job-1', USER_ID, [0, 2]);

    expect(result).toEqual({ added: 2 });
    expect(prismaMock.stockItem.create).toHaveBeenCalledTimes(2);
  });

  it('marks the job CONFIRMED after committing', async () => {
    mockJob();

    await service.confirmJob('job-1', USER_ID, [0]);

    expect(prismaMock.ocrJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'CONFIRMED' },
    });
  });

  it('rejects a second confirm and does not add items again', async () => {
    mockJob({ status: 'CONFIRMED' });

    await expect(service.confirmJob('job-1', USER_ID, [0])).rejects.toThrow(
      'Job already confirmed',
    );
    expect(prismaMock.stockItem.create).not.toHaveBeenCalled();
  });

  it('ignores duplicate and out-of-range indices', async () => {
    mockJob();

    const result = await service.confirmJob('job-1', USER_ID, [0, 0, 99, -1]);

    expect(result).toEqual({ added: 1 });
    expect(prismaMock.stockItem.create).toHaveBeenCalledTimes(1);
  });

  it('rejects when the job is not COMPLETED', async () => {
    mockJob({ status: 'PROCESSING' });

    await expect(service.confirmJob('job-1', USER_ID, [0])).rejects.toThrow();
    expect(prismaMock.stockItem.create).not.toHaveBeenCalled();
  });

  it('rejects when no valid items are selected', async () => {
    mockJob();

    await expect(service.confirmJob('job-1', USER_ID, [99])).rejects.toThrow();
    expect(prismaMock.stockItem.create).not.toHaveBeenCalled();
  });
});
