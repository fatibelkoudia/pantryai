/**
 * Unit tests for R2SweeperService.
 * Fake storage + fake prisma, no real R2 or DB.
 * Checks the 24h boundary (old deleted, fresh kept) and the imageKey null-out.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { R2SweeperService } from '../r2-sweeper.service.js';
import type { R2StorageService, StoredObject } from '../r2-storage.service.js';

const HOUR = 60 * 60 * 1000;

function makeStorage(objects: StoredObject[]) {
  return {
    listReceiptObjects: vi.fn().mockResolvedValue(objects),
    deleteObject: vi.fn().mockResolvedValue(undefined),
  } as unknown as R2StorageService;
}

function makePrisma() {
  return {
    ocrJob: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaService;
}

describe('R2SweeperService.sweepOrphans', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes receipt objects older than 24h', async () => {
    const storage = makeStorage([
      { key: 'receipts/u1/job-old.jpg', lastModified: new Date(Date.now() - 30 * HOUR) },
    ]);
    const prisma = makePrisma();

    await new R2SweeperService(storage, prisma).sweepOrphans();

    expect(storage.deleteObject).toHaveBeenCalledWith('receipts/u1/job-old.jpg');
  });

  it('keeps objects newer than 24h', async () => {
    const storage = makeStorage([
      { key: 'receipts/u1/job-fresh.jpg', lastModified: new Date(Date.now() - 2 * HOUR) },
    ]);
    const prisma = makePrisma();

    await new R2SweeperService(storage, prisma).sweepOrphans();

    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('nulls the imageKey on the matching job when one still points at the object', async () => {
    const storage = makeStorage([
      { key: 'receipts/u1/job-old.jpg', lastModified: new Date(Date.now() - 30 * HOUR) },
    ]);
    const prisma = makePrisma();
    vi.mocked(prisma.ocrJob.findUnique).mockResolvedValue({
      id: 'job-old',
      imageKey: 'receipts/u1/job-old.jpg',
    } as never);

    await new R2SweeperService(storage, prisma).sweepOrphans();

    expect(prisma.ocrJob.update).toHaveBeenCalledWith({
      where: { id: 'job-old' },
      data: { imageKey: null },
    });
  });

  it('does not abort the sweep when one object fails to delete', async () => {
    const storage = makeStorage([
      { key: 'receipts/u1/bad.jpg', lastModified: new Date(Date.now() - 30 * HOUR) },
      { key: 'receipts/u1/good.jpg', lastModified: new Date(Date.now() - 30 * HOUR) },
    ]);
    vi.mocked(storage.deleteObject)
      .mockRejectedValueOnce(new Error('R2 down'))
      .mockResolvedValueOnce(undefined);
    const prisma = makePrisma();

    await new R2SweeperService(storage, prisma).sweepOrphans();

    expect(storage.deleteObject).toHaveBeenCalledTimes(2);
    expect(storage.deleteObject).toHaveBeenCalledWith('receipts/u1/good.jpg');
  });
});
