import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ParsedReceiptItem } from './parsers/index.js';

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
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('ocr') private readonly ocrQueue: Queue,
  ) {
    this.s3 = new S3Client({
      region: 'auto',
      ...(process.env['R2_ENDPOINT'] && { endpoint: process.env['R2_ENDPOINT'] }),
      credentials: {
        accessKeyId: process.env['R2_ACCESS_KEY_ID'] ?? '',
        secretAccessKey: process.env['R2_SECRET_ACCESS_KEY'] ?? '',
      },
    });
    this.bucket = process.env['R2_BUCKET_NAME'] ?? 'pantryai';
  }

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

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: imageKey,
        Body: imageBuffer,
        ContentType: mimeType,
      }),
    );

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

  /**
   * Add the chosen parsed items to the user's stock (web review flow).
   * `indices` point into the job's stored `parsedItems`, so the client only sends a selection
   * and the server uses its own trusted copy (keeps EAN-13 / expiry that the UI never exposes).
   */
  async confirmJob(jobId: string, userId: string, indices: number[]): Promise<{ added: number }> {
    const job = await this.getJob(jobId, userId);

    if (job.status === 'CONFIRMED') {
      throw new BadRequestException('Job already confirmed');
    }

    if (job.status !== 'COMPLETED') {
      throw new BadRequestException('Job is not ready to confirm');
    }

    const parsed = (job.parsedItems ?? []) as unknown as ParsedReceiptItem[];
    const unique = [...new Set(indices)];
    const selected = unique
      .filter((i) => Number.isInteger(i) && i >= 0 && i < parsed.length)
      .map((i) => parsed[i] as ParsedReceiptItem);

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

  /**
   * Match each parsed item to a product (EAN-13 first, then generic name) and create a stock item.
   * Shared by the worker's auto-commit path and the web confirm endpoint.
   */
  async commitParsedItems(userId: string, items: ParsedReceiptItem[]): Promise<void> {
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
          location: 'PANTRY',
          // If receipt has an expiry date, copy it to the stock item.
          ...(item.expirationDate && { expirationDate: new Date(item.expirationDate) }),
        },
      });
    }
  }

  async deleteImageFromR2(imageKey: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: imageKey }));
  }
}
