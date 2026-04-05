import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';

export interface OcrJobPayload {
  jobId: string;
  userId: string;
  imageKey: string;
  mimeType: string;
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
      { jobId: job.id, userId, imageKey, mimeType } satisfies OcrJobPayload,
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

  async deleteImageFromR2(imageKey: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: imageKey }));
  }
}
