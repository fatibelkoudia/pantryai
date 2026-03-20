/**
 * Unit tests for OcrService queue behavior.
 * Checks BullMQ retries, MIME passthrough, and R2 key extension mapping.
 * Uses mocks only (no DB/Redis/R2).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({ send: vi.fn() })),
  PutObjectCommand: vi.fn((args) => ({ _cmd: 'put', ...args })),
  DeleteObjectCommand: vi.fn((args) => ({ _cmd: 'delete', ...args })),
}));

import type { Queue } from 'bullmq';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { OcrService } from '../ocr.service.js';

const TEST_USER_ID = 'user-1';

function makePrisma() {
  return {
    ocrJob: {
      create: vi.fn().mockResolvedValue({ id: 'job-1' }),
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaService;
}

function makeQueue() {
  return { add: vi.fn().mockResolvedValue(undefined) } as unknown as Queue;
}

let prisma: PrismaService;
let queue: Queue;
let service: OcrService;

beforeEach(() => {
  vi.clearAllMocks();
  prisma = makePrisma();
  queue = makeQueue();
  service = new OcrService(prisma, queue);
});

describe('createJob() — image OCR', () => {
  it('enqueues with attempts: 3 and exponential backoff', async () => {
    await service.createJob(TEST_USER_ID, Buffer.from('img'), 'image/jpeg');

    const [, , opts] = vi.mocked(queue.add).mock.calls[0]!;
    expect(opts).toMatchObject({
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  });

  it('threads the real MIME type into the job payload', async () => {
    await service.createJob(TEST_USER_ID, Buffer.from('img'), 'image/png');

    const [name, payload] = vi.mocked(queue.add).mock.calls[0]!;
    expect(name).toBe('process');
    expect(payload).toMatchObject({ userId: TEST_USER_ID, mimeType: 'image/png' });
  });

  it('derives the R2 key extension from the MIME type', async () => {
    await service.createJob(TEST_USER_ID, Buffer.from('img'), 'image/webp');

    const [, payload] = vi.mocked(queue.add).mock.calls[0]! as [string, { imageKey: string }];
    expect(payload.imageKey).toMatch(/\.webp$/);
  });

  it('falls back to a .jpg key for an unmapped MIME type', async () => {
    await service.createJob(TEST_USER_ID, Buffer.from('img'), 'image/heic');

    const [, payload] = vi.mocked(queue.add).mock.calls[0]! as [string, { imageKey: string }];
    expect(payload.imageKey).toMatch(/\.jpg$/);
  });
});

describe('createQrJob() — QR e-ticket', () => {
  it('enqueues process-qr with attempts: 3 and exponential backoff', async () => {
    await service.createQrJob(TEST_USER_ID, 'https://example.com/ticket.json');

    const [name, , opts] = vi.mocked(queue.add).mock.calls[0]!;
    expect(name).toBe('process-qr');
    expect(opts).toMatchObject({
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  });
});
