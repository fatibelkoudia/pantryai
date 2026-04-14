/**
 * Integration tests for processImageJob().
 * Uses real Prisma test DB (5433).
 * S3/R2, Mistral OCR, and Tesseract are mocked.
 *
 * Fixture-based blocks auto-skip if .ocr.txt/.expected.json are missing.
 * Error-handling blocks always run.
 */

// Hoisted mocks

const { mockS3Send, mockMistralOcrProcess, mockMistralChatComplete, mockTesseract } = vi.hoisted(
  () => ({
    mockS3Send: vi.fn(),
    mockMistralOcrProcess: vi.fn(),
    mockMistralChatComplete: vi.fn(),
    mockTesseract: { recognize: vi.fn() },
  }),
);

// Module mocks

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({ send: mockS3Send })),
  GetObjectCommand: vi.fn((input: Record<string, unknown>) => ({ _cmd: 'get', ...input })),
  DeleteObjectCommand: vi.fn((input: Record<string, unknown>) => ({ _cmd: 'delete', ...input })),
}));

vi.mock('@mistralai/mistralai', () => ({
  Mistral: vi.fn(() => ({
    ocr: { process: mockMistralOcrProcess },
    chat: { complete: mockMistralChatComplete },
  })),
}));

vi.mock('tesseract.js', () => ({ default: mockTesseract }));

vi.mock('@nestjs/bullmq', () => ({
  Processor: () => () => undefined,
  InjectQueue: () => () => undefined,
  WorkerHost: class {
    async process(): Promise<void> {}
  },
}));

// Imports

import { type Job } from 'bullmq';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { testPrisma } from '../../test-setup.integration.js';
import { OcrProcessor } from '../ocr.processor.js';
import { OcrService } from '../ocr.service.js';
import type { OcrJobPayload } from '../ocr.service.js';
import type { ParsedReceiptItem } from '../parsers/index.js';

// Constants, helpers, and types

const TEST_USER_ID = 'test-user-id-0000-0000-000000000001';
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures/receipts');

interface ExpectedFixture {
  retailer: string;
  items: Array<{
    name: string;
    quantity?: number;
    unit?: string;
    price?: number;
    ean13?: string;
    confidence: number;
  }>;
}

function makeS3Body(buffer: Buffer): AsyncIterable<Uint8Array> {
  return (async function* () {
    yield buffer;
  })();
}

function makeMistralOcrResponse(text: string) {
  return { pages: [{ markdown: text }] };
}

function loadFixture(
  ocrRelative: string,
  fallbackRetailer: string,
): {
  ocrPath: string;
  ocrText: string;
  expected: ExpectedFixture;
} {
  const ocrPath = path.join(FIXTURES_DIR, ocrRelative);
  const expectedPath = ocrPath.replace('.ocr.txt', '.expected.json');
  const ocrText = existsSync(ocrPath) ? readFileSync(ocrPath, 'utf8') : '';
  const expected: ExpectedFixture = existsSync(expectedPath)
    ? (JSON.parse(readFileSync(expectedPath, 'utf8')) as ExpectedFixture)
    : { retailer: fallbackRetailer, items: [] };
  return { ocrPath, ocrText, expected };
}

// Shared beforeEach: fresh processor + clean mocks

let processor: OcrProcessor;

beforeEach(() => {
  const ocrService = new OcrService(testPrisma as unknown as PrismaService, {} as never);
  processor = new OcrProcessor(testPrisma as unknown as PrismaService, ocrService);
  vi.clearAllMocks();
  mockS3Send.mockResolvedValue({});
});

// DB helpers

async function createJob(imageKey = 'receipts/test.jpg'): Promise<string> {
  const job = await testPrisma.ocrJob.create({
    data: { userId: TEST_USER_ID, imageKey, status: 'PENDING' },
  });
  return job.id;
}

function makeFakeJob(jobId: string, imageKey = 'receipts/test.jpg'): Job<OcrJobPayload> {
  return {
    name: 'process',
    data: { jobId, userId: TEST_USER_ID, imageKey, mimeType: 'image/jpeg' },
  } as Job<OcrJobPayload>;
}

function mockS3WithOcr(ocrText: string): void {
  mockS3Send.mockImplementation((cmd: { _cmd: string }) => {
    if (cmd._cmd === 'get') {
      return Promise.resolve({ Body: makeS3Body(Buffer.from('fake-image')) });
    }
    return Promise.resolve({});
  });
  mockMistralOcrProcess.mockResolvedValue(makeMistralOcrResponse(ocrText));
}

// Shared fixture test factory
// Each retailer block reuses the same assertions.

function fixtureTests(
  label: string,
  ocrRelative: string,
  fallbackRetailer: string,
  opts: { noMistralChat?: boolean; imageKey?: string } = {},
): void {
  const { ocrPath, ocrText, expected } = loadFixture(ocrRelative, fallbackRetailer);
  const imageKey = opts.imageKey ?? 'receipts/test.jpg';
  const expectNoMistralChat = opts.noMistralChat ?? true;

  describe.skipIf(!existsSync(ocrPath))(`processImageJob — ${label}`, () => {
    beforeEach(() => {
      mockS3WithOcr(ocrText);
    });

    it('sets job status COMPLETED', async () => {
      const jobId = await createJob(imageKey);
      await processor.process(makeFakeJob(jobId, imageKey));
      const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('COMPLETED');
      expect(job?.completedAt).toBeTruthy();
    });

    it('stores retailer in OcrJob record', async () => {
      const jobId = await createJob(imageKey);
      await processor.process(makeFakeJob(jobId, imageKey));
      const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
      expect(job?.retailer).toBe(expected.retailer);
    });

    it('sets rawText to null on COMPLETED (RGPD)', async () => {
      const jobId = await createJob(imageKey);
      await processor.process(makeFakeJob(jobId, imageKey));
      const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
      expect(job?.rawText).toBeNull();
    });

    it('extracts items matching expected.json count', async () => {
      const jobId = await createJob(imageKey);
      await processor.process(makeFakeJob(jobId, imageKey));
      const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
      const parsedItems = job?.parsedItems as unknown as ParsedReceiptItem[];
      expect(parsedItems).toHaveLength(expected.items.length);
    });

    it('extracts items matching expected.json content', async () => {
      const jobId = await createJob(imageKey);
      await processor.process(makeFakeJob(jobId, imageKey));
      const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
      const parsedItems = job?.parsedItems as unknown as ParsedReceiptItem[];
      for (const [i, expectedItem] of expected.items.entries()) {
        expect(parsedItems[i]).toMatchObject(expectedItem);
      }
    });

    it('creates StockItems in DB for each extracted item', async () => {
      const jobId = await createJob(imageKey);
      await processor.process(makeFakeJob(jobId, imageKey));
      const stockItems = await testPrisma.stockItem.findMany({ where: { userId: TEST_USER_ID } });
      expect(stockItems).toHaveLength(expected.items.length);
    });

    if (expectNoMistralChat) {
      it('does NOT call Mistral Chat (dedicated parser handles this)', async () => {
        const jobId = await createJob(imageKey);
        await processor.process(makeFakeJob(jobId, imageKey));
        expect(mockMistralChatComplete).not.toHaveBeenCalled();
      });
    }

    it('calls DeleteObjectCommand once', async () => {
      const jobId = await createJob(imageKey);
      await processor.process(makeFakeJob(jobId, imageKey));
      const deleteCalls = mockS3Send.mock.calls.filter(
        (args) => (args[0] as { _cmd: string })._cmd === 'delete',
      );
      expect(deleteCalls).toHaveLength(1);
    });
  });
}

// Fixture-driven tests: one block per retailer

fixtureTests('Carrefour Market PDF', 'carrefour/DOC-20260322-WA0005..ocr.txt', 'CARREFOUR', {
  imageKey: 'receipts/carrefour-test.jpg',
});

fixtureTests('Lidl markdown table', 'lidl/lidl_05.ocr.txt', 'LIDL', {
  imageKey: 'receipts/lidl-test.jpg',
});

fixtureTests('Leclerc paper scan', 'leclerc/leclerc_02.ocr.txt', 'LECLERC', {
  imageKey: 'receipts/leclerc-test.jpg',
});

fixtureTests('Auchan receipt', 'auchan/auchan_01.ocr.txt', 'AUCHAN', {
  imageKey: 'receipts/auchan-test.jpg',
});

fixtureTests('Grand Frais receipt', 'grand-frais/grand-frais_01.ocr.txt', 'GRAND FRAIS', {
  imageKey: 'receipts/grand-frais-test.jpg',
});

// Error handling: Mistral OCR fails -> Tesseract fallback

describe('processImageJob — Mistral OCR failure → Tesseract fallback', () => {
  it('calls Tesseract when Mistral OCR throws', async () => {
    mockS3Send.mockImplementation((cmd: { _cmd: string }) => {
      if (cmd._cmd === 'get') {
        return Promise.resolve({ Body: makeS3Body(Buffer.from('img')) });
      }
      return Promise.resolve({});
    });
    mockMistralOcrProcess.mockRejectedValue(new Error('Mistral OCR timeout'));
    mockTesseract.recognize.mockResolvedValue({ data: { text: 'LIDL\nYAOURT  1.89 A\n' } });

    const jobId = await createJob();
    await processor.process(makeFakeJob(jobId));

    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('COMPLETED');
    expect(mockTesseract.recognize).toHaveBeenCalledOnce();
  });
});

// Error handling: all OCR fails -> FAILED

describe('processImageJob — all OCR fails → FAILED status', () => {
  it('sets status FAILED when both Mistral and Tesseract throw', async () => {
    mockS3Send.mockImplementation((cmd: { _cmd: string }) => {
      if (cmd._cmd === 'get') {
        return Promise.resolve({ Body: makeS3Body(Buffer.from('img')) });
      }
      return Promise.resolve({});
    });
    mockMistralOcrProcess.mockRejectedValue(new Error('Mistral down'));
    mockTesseract.recognize.mockRejectedValue(new Error('Tesseract crash'));

    const jobId = await createJob();
    await processor.process(makeFakeJob(jobId));

    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('FAILED');
    expect(job?.error).toContain('Tesseract crash');
  });

  it('still calls DeleteObjectCommand in finally block even on failure', async () => {
    mockS3Send.mockImplementation((cmd: { _cmd: string }) => {
      if (cmd._cmd === 'get') {
        return Promise.resolve({ Body: makeS3Body(Buffer.from('img')) });
      }
      return Promise.resolve({});
    });
    mockMistralOcrProcess.mockRejectedValue(new Error('down'));
    mockTesseract.recognize.mockRejectedValue(new Error('down'));

    const jobId = await createJob('receipts/fail-test.jpg');
    await processor.process(makeFakeJob(jobId, 'receipts/fail-test.jpg'));

    const deleteCalls = mockS3Send.mock.calls.filter(
      (args) => (args[0] as { _cmd: string })._cmd === 'delete',
    );
    expect(deleteCalls).toHaveLength(1);
  });
});

// Error handling: S3 download failure

describe('processImageJob — S3 download failure', () => {
  it('sets status FAILED when S3 throws', async () => {
    mockS3Send.mockRejectedValue(new Error('S3 NoSuchKey'));

    const jobId = await createJob();
    await processor.process(makeFakeJob(jobId));

    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('FAILED');
    expect(job?.error).toContain('S3 NoSuchKey');
  });
});
