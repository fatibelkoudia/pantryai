/**
 * Integration tests for processQrJob().
 * Uses real Prisma test DB (5433).
 * fetch, node:dns/promises, and Mistral OCR are mocked.
 * No S3 here because QR jobs have no imageKey.
 */

// Hoisted mocks

const { mockFetch, mockLookup, mockMistralOcrProcess, mockMistralChatComplete } = vi.hoisted(
  () => ({
    mockFetch: vi.fn(),
    mockLookup: vi.fn(),
    mockMistralOcrProcess: vi.fn(),
    mockMistralChatComplete: vi.fn(),
  }),
);

// Module mocks

vi.mock('node:dns/promises', () => ({ lookup: mockLookup }));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({ send: vi.fn() })),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}));

vi.mock('@mistralai/mistralai', () => ({
  Mistral: vi.fn(() => ({
    ocr: { process: mockMistralOcrProcess },
    chat: { complete: mockMistralChatComplete },
  })),
}));

vi.mock('tesseract.js', () => ({ default: { recognize: vi.fn() } }));

vi.mock('@nestjs/bullmq', () => ({
  Processor: () => () => undefined,
  WorkerHost: class {
    async process(): Promise<void> {}
  },
}));

// Imports

import { type Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { testPrisma } from '../../test-setup.integration.js';
import { OcrProcessor } from '../ocr.processor.js';
import type { QrJobPayload } from '../ocr.service.js';
import type { ParsedReceiptItem } from '../parsers/index.js';

// Constants

const TEST_USER_ID = 'test-user-id-0000-0000-000000000001';
const TEST_QR_URL = 'https://receipts.example.com/ticket/abc123';
const PUBLIC_IP = { address: '93.184.216.34', family: 4 } as const;

// Response helpers

function makeJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h === 'content-type' ? 'application/json' : null) },
    json: () => Promise.resolve(body),
    body: null,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function makeHtmlResponse(html: string, status = 200): Response {
  const bytes = new TextEncoder().encode(html);
  let readerDone = false;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h === 'content-type' ? 'text/html; charset=utf-8' : null) },
    body: {
      getReader: () => ({
        read: () => {
          if (readerDone) return Promise.resolve({ done: true as const, value: undefined });
          readerDone = true;
          return Promise.resolve({ done: false as const, value: bytes });
        },
        cancel: () => Promise.resolve(),
      }),
    },
    text: () => Promise.resolve(html),
    arrayBuffer: () => Promise.resolve(bytes.buffer),
  } as unknown as Response;
}

function makePdfResponse(buf: Buffer, status = 200): Response {
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h === 'content-type' ? 'application/pdf' : null) },
    body: null,
    arrayBuffer: () => Promise.resolve(ab),
    json: () => Promise.reject(new Error('Not JSON')),
  } as unknown as Response;
}

function makeErrorResponse(status: number): Response {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    body: null,
  } as unknown as Response;
}

// DB helpers

async function createQrJob(): Promise<string> {
  const job = await testPrisma.ocrJob.create({
    data: { userId: TEST_USER_ID, status: 'PENDING' },
  });
  return job.id;
}

function makeFakeQrJob(jobId: string, url = TEST_QR_URL): Job<QrJobPayload> {
  return {
    name: 'process-qr',
    data: { jobId, userId: TEST_USER_ID, url },
  } as Job<QrJobPayload>;
}

// Shared beforeEach

let processor: OcrProcessor;

beforeEach(() => {
  processor = new OcrProcessor(testPrisma as unknown as PrismaService);
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mockLookup.mockResolvedValue(PUBLIC_IP);
  vi.stubGlobal('fetch', mockFetch);
});

// JSON receipt (loi AGEC)

describe('processQrJob — JSON receipt (loi AGEC)', () => {
  const JSON_RECEIPT = {
    enseigneCommerciale: 'CARREFOUR MARKET',
    items: [
      { libelle: 'Farine Blé T55 1kg', quantite: 1, unite: 'pcs', prixUnitaire: 0.89 },
      { libelle: 'Beurre Doux 250g', quantite: 2, unite: 'pcs', prixUnitaire: 1.55 },
      { libelle: 'Lait Demi-Écrémé 1L', quantite: 3, unite: 'pcs', prixUnitaire: 0.95 },
    ],
  };

  beforeEach(() => {
    mockFetch.mockResolvedValue(makeJsonResponse(JSON_RECEIPT));
  });

  it('sets job status COMPLETED', async () => {
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('COMPLETED');
    expect(job?.completedAt).toBeTruthy();
  });

  it('stores retailer from enseigneCommerciale', async () => {
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.retailer).toBe('CARREFOUR MARKET');
  });

  it('rawText is null for JSON receipts', async () => {
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.rawText).toBeNull();
  });

  it('extracts 3 items with correct names, quantities, and prices', async () => {
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    const items = job?.parsedItems as unknown as ParsedReceiptItem[];
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      name: 'Farine Blé T55 1kg',
      quantity: 1,
      unit: 'pcs',
      price: 0.89,
      confidence: 0.95,
    });
    expect(items[1]).toMatchObject({
      name: 'Beurre Doux 250g',
      quantity: 2,
      unit: 'pcs',
      price: 1.55,
      confidence: 0.95,
    });
    expect(items[2]).toMatchObject({
      name: 'Lait Demi-Écrémé 1L',
      quantity: 3,
      unit: 'pcs',
      price: 0.95,
      confidence: 0.95,
    });
  });

  it('creates StockItems in DB for each extracted item', async () => {
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const stockItems = await testPrisma.stockItem.findMany({ where: { userId: TEST_USER_ID } });
    expect(stockItems).toHaveLength(3);
  });

  it('does NOT call Mistral OCR', async () => {
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    expect(mockMistralOcrProcess).not.toHaveBeenCalled();
  });

  it('does NOT call Mistral Chat', async () => {
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    expect(mockMistralChatComplete).not.toHaveBeenCalled();
  });
});

// HTML receipt

describe('processQrJob — HTML receipt', () => {
  const HTML_RECEIPT = `
    <html><body>
    <table>
      <tr><td>YAOURT NATURE 500G</td><td>0,89</td></tr>
      <tr><td>JUS ORANGE 1L</td><td>2,35</td></tr>
      <tr><td>PAIN COMPLET 400G</td><td>1,45</td></tr>
    </table>
    </body></html>
  `;

  beforeEach(() => {
    mockFetch.mockResolvedValue(makeHtmlResponse(HTML_RECEIPT));
  });

  it('sets job status COMPLETED', async () => {
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('COMPLETED');
  });

  it('stores rawText (the raw HTML source) in OcrJob record', async () => {
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    // rawText keeps original HTML body; stripHtml is only for parsing
    expect(job?.rawText).toBeTruthy();
    expect(job?.rawText).toContain('YAOURT NATURE 500G');
  });

  it('does NOT call Mistral OCR', async () => {
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    expect(mockMistralOcrProcess).not.toHaveBeenCalled();
  });
});

// PDF receipt

describe('processQrJob — PDF receipt', () => {
  const PDF_OCR_TEXT = 'LIDL\nYAOURT NATURE  0,89 A\nFROMENT  1,29 A\nTicket de vente';

  beforeEach(() => {
    mockFetch.mockResolvedValue(makePdfResponse(Buffer.from('fake-pdf-bytes')));
    mockMistralOcrProcess.mockResolvedValue({ pages: [{ markdown: PDF_OCR_TEXT }] });
  });

  it('sets job status COMPLETED', async () => {
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('COMPLETED');
  });

  it('calls Mistral OCR with a data:application/pdf base64 URL', async () => {
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    expect(mockMistralOcrProcess).toHaveBeenCalledOnce();
    const call = mockMistralOcrProcess.mock.calls[0]![0] as {
      model: string;
      document: { type: string; documentUrl: string };
    };
    expect(call.model).toBe('mistral-ocr-latest');
    expect(call.document.type).toBe('document_url');
    expect(call.document.documentUrl).toMatch(/^data:application\/pdf;base64,/);
  });

  it('stores rawText from OCR output', async () => {
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.rawText).toBe(PDF_OCR_TEXT);
  });

  it('detects retailer from OCR text (LIDL)', async () => {
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.retailer).toBe('LIDL');
  });
});

// SSRF protection

describe('processQrJob — SSRF protection', () => {
  it('sets status FAILED for 127.x.x.x (loopback)', async () => {
    mockLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 });
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('FAILED');
    expect(job?.error).toContain('SSRF');
  });

  it('sets status FAILED for 10.x.x.x (RFC-1918 class A)', async () => {
    mockLookup.mockResolvedValue({ address: '10.0.0.1', family: 4 });
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('FAILED');
    expect(job?.error).toContain('SSRF');
  });

  it('sets status FAILED for 192.168.x.x (RFC-1918 class C)', async () => {
    mockLookup.mockResolvedValue({ address: '192.168.1.1', family: 4 });
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('FAILED');
    expect(job?.error).toContain('SSRF');
  });

  it('does NOT call fetch when SSRF check fails', async () => {
    mockLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 });
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// HTTP error response

describe('processQrJob — HTTP error response', () => {
  it('sets status FAILED when remote returns 500', async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(500));
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('FAILED');
    expect(job?.error).toContain('500');
  });

  it('sets status FAILED when remote returns 404', async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(404));
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('FAILED');
    expect(job?.error).toContain('404');
  });
});

// Size limits

describe('processQrJob — size limit exceeded', () => {
  it('sets status FAILED when HTML body exceeds 5 MB', async () => {
    const OVER_5MB = 5 * 1024 * 1024 + 1;
    const bigBytes = new Uint8Array(OVER_5MB);
    let readerDone = false;
    const bigResponse = {
      ok: true,
      status: 200,
      headers: { get: (h: string) => (h === 'content-type' ? 'text/html' : null) },
      body: {
        getReader: () => ({
          read: () => {
            if (readerDone) return Promise.resolve({ done: true as const, value: undefined });
            readerDone = true;
            return Promise.resolve({ done: false as const, value: bigBytes });
          },
          cancel: () => Promise.resolve(),
        }),
      },
    } as unknown as Response;

    mockFetch.mockResolvedValue(bigResponse);
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('FAILED');
    expect(job?.error).toContain('5 MB');
  });

  it('sets status FAILED when PDF body exceeds 5 MB', async () => {
    const OVER_5MB = 5 * 1024 * 1024 + 1;
    mockFetch.mockResolvedValue(makePdfResponse(Buffer.alloc(OVER_5MB)));
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('FAILED');
    expect(job?.error).toContain('5 MB');
  });
});

// Timeout / abort

describe('processQrJob — fetch timeout', () => {
  it('sets status FAILED when fetch is aborted (AbortError)', async () => {
    // Simulate 10s AbortController timeout: fetch rejects with AbortError.
    mockFetch.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));
    const jobId = await createQrJob();
    await processor.process(makeFakeQrJob(jobId));
    const job = await testPrisma.ocrJob.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('FAILED');
    expect(job?.error).toContain('aborted');
  });
});
