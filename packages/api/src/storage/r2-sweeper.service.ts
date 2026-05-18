import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { R2StorageService } from './r2-storage.service.js';

// RGPD: receipt images must not live longer than 24h.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Keys look like receipts/{userId}/{jobId}.{ext}. We pull the jobId out to tidy the DB row.
const RECEIPT_KEY = /^receipts\/[^/]+\/([^/.]+)\./;

// Safety net for deleting receipt images. Normally the image is deleted as soon as the job
// finishes (see ocr.processor), but if the app crashes before that, the image is stuck in R2.
// So once a day we delete anything older than 24h and no receipt image lives past that.
@Injectable()
export class R2SweeperService {
  private readonly logger = new Logger(R2SweeperService.name);

  constructor(
    private readonly storage: R2StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async sweepOrphans(): Promise<void> {
    const cutoff = Date.now() - MAX_AGE_MS;
    let objects;
    try {
      objects = await this.storage.listReceiptObjects();
    } catch (err) {
      this.logger.error(`Sweep aborted, could not list R2 objects: ${(err as Error).message}`);
      return;
    }

    let deleted = 0;
    for (const object of objects) {
      if (object.lastModified.getTime() >= cutoff) continue;

      try {
        await this.storage.deleteObject(object.key);
        await this.clearImageKey(object.key);
        deleted += 1;
      } catch (err) {
        // One bad object shouldn't stop the rest of the sweep.
        this.logger.warn(`Failed to sweep ${object.key}: ${(err as Error).message}`);
      }
    }

    this.logger.log(
      `R2 sweep done: ${deleted} orphaned receipt image(s) older than 24h removed out of ${objects.length} scanned`,
    );
  }

  // Set imageKey back to null on the matching job so the DB doesn't point at a file we deleted.
  // We look the job up by its id, so the per-user scoping extension doesn't get in the way.
  private async clearImageKey(key: string): Promise<void> {
    const jobId = RECEIPT_KEY.exec(key)?.[1];
    if (!jobId) return;

    const job = await this.prisma.ocrJob.findUnique({
      where: { id: jobId },
      select: { id: true, imageKey: true },
    });
    if (job?.imageKey) {
      await this.prisma.ocrJob.update({ where: { id: jobId }, data: { imageKey: null } });
    }
  }
}
