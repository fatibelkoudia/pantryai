import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import type { StockLocation } from '@pantryai/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { R2StorageService } from '../storage/r2-storage.service.js';
import { ConfirmOcrItemDto, ConfirmOcrJobDto } from './dto/confirm-ocr-job.dto.js';
import type { ParsedReceiptItem } from './parsers/index.js';

// A receipt item we are about to save. It can also carry the location the user chose.
type CommitItem = ParsedReceiptItem & { location?: StockLocation };

export interface OcrJobPayload {
  jobId: string;
  userId: string;
  imageKey: string;
  mimeType: string;
  /** When false, the worker extracts items but does NOT add them to stock (web review flow). */
  autoCommit?: boolean;
}

// BullMQ retry settings used by both OCR job types.
// If Mistral/network fails for a moment, the job retries instead of failing right away.
const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 100 },
} as const;

// Convert upload MIME type to the file extension we store in R2.
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export interface QrJobPayload {
  jobId: string;
  userId: string;
  url: string;
}

@Injectable()
export class OcrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: R2StorageService,
    @InjectQueue('ocr') private readonly ocrQueue: Queue,
  ) {}

  async createJob(
    userId: string,
    imageBuffer: Buffer,
    mimeType: string,
    autoCommit = true,
  ): Promise<{ jobId: string }> {
    const job = await this.prisma.ocrJob.create({
      data: { userId, status: 'PENDING' },
    });

    const extension = MIME_EXTENSIONS[mimeType] ?? 'jpg';
    const imageKey = `receipts/${userId}/${job.id}.${extension}`;

    await this.storage.putObject(imageKey, imageBuffer, mimeType);

    await this.prisma.ocrJob.update({
      where: { id: job.id },
      data: { imageKey },
    });

    await this.ocrQueue.add(
      'process',
      { jobId: job.id, userId, imageKey, mimeType, autoCommit } satisfies OcrJobPayload,
      JOB_OPTIONS,
    );

    return { jobId: job.id };
  }

  async createQrJob(userId: string, url: string): Promise<{ jobId: string }> {
    const job = await this.prisma.ocrJob.create({
      data: { userId, status: 'PENDING' },
    });

    await this.ocrQueue.add(
      'process-qr',
      { jobId: job.id, userId, url } satisfies QrJobPayload,
      JOB_OPTIONS,
    );

    return { jobId: job.id };
  }

  async getJob(jobId: string, userId: string) {
    const job = await this.prisma.ocrJob.findUnique({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException(`OCR job ${jobId} not found`);
    }

    if (job.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return job;
  }

  // Adds the receipt items the user picked to their stock.
  // The web app only sends the indices of the items it wants (no changes).
  // The mobile app sends items with the changes the user made (quantity, unit,
  // date, location). We accept both so both apps keep working.
  async confirmJob(
    jobId: string,
    userId: string,
    selection: number[] | ConfirmOcrJobDto,
  ): Promise<{ added: number }> {
    const dto: ConfirmOcrJobDto = Array.isArray(selection) ? { indices: selection } : selection;

    const job = await this.getJob(jobId, userId);

    if (job.status === 'CONFIRMED') {
      throw new BadRequestException('Job already confirmed');
    }

    if (job.status !== 'COMPLETED') {
      throw new BadRequestException('Job is not ready to confirm');
    }

    const parsed = (job.parsedItems ?? []) as unknown as ParsedReceiptItem[];
    const selected =
      dto.items && dto.items.length > 0
        ? selectEditedItems(parsed, dto.items)
        : selectByIndices(parsed, dto.indices ?? []);

    if (selected.length === 0) {
      throw new BadRequestException('No valid items selected');
    }

    await this.commitParsedItems(userId, selected);

    // Mark the job CONFIRMED so it can't be confirmed (and re-added) twice.
    await this.prisma.ocrJob.update({
      where: { id: jobId },
      data: { status: 'CONFIRMED' },
    });

    return { added: selected.length };
  }

  // Goes through each parsed item, finds the matching product (EAN-13 first,
  // then by name) and creates a stock item for it. Used both when we add items
  // automatically and when the user confirms them from the review screen.
  // If an item has a location we use it, otherwise it goes to the PANTRY.
  async commitParsedItems(userId: string, items: CommitItem[]): Promise<void> {
    for (const item of items) {
      const name = item.name.trim().replace(/\s+/g, ' ');

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
          location: item.location ?? 'PANTRY',
          // If receipt has an expiry date, copy it to the stock item.
          ...(item.expirationDate && { expirationDate: new Date(item.expirationDate) }),
        },
      });
    }
  }

  async deleteImageFromR2(imageKey: string): Promise<void> {
    await this.storage.deleteObject(imageKey);
  }
}

// Takes the list of indices the user selected and returns the matching items.
// It removes duplicates and skips any index that is not in the list.
function selectByIndices(parsed: ParsedReceiptItem[], indices: number[]): CommitItem[] {
  const unique = [...new Set(indices)];
  return unique
    .filter((i) => Number.isInteger(i) && i >= 0 && i < parsed.length)
    .map((i) => parsed[i] as ParsedReceiptItem);
}

// Same idea, but here the user also edited some fields. We start from the parsed
// item and only replace the fields the user changed. Duplicates and bad indices are skipped.
function selectEditedItems(parsed: ParsedReceiptItem[], edits: ConfirmOcrItemDto[]): CommitItem[] {
  const seen = new Set<number>();
  const selected: CommitItem[] = [];
  for (const edit of edits) {
    const inRange = Number.isInteger(edit.index) && edit.index >= 0 && edit.index < parsed.length;
    if (!inRange || seen.has(edit.index)) continue;
    seen.add(edit.index);
    const base = parsed[edit.index] as ParsedReceiptItem;
    selected.push({
      ...base,
      ...(edit.quantity !== undefined && { quantity: edit.quantity }),
      ...(edit.unit !== undefined && { unit: edit.unit }),
      ...(edit.expirationDate !== undefined && {
        expirationDate: edit.expirationDate.toISOString(),
      }),
      ...(edit.location !== undefined && { location: edit.location }),
    });
  }
  return selected;
}
