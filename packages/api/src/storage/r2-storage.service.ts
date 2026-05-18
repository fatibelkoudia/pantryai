import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';

// All receipt images live under this prefix in the bucket: receipts/{userId}/{jobId}.{ext}
const RECEIPTS_PREFIX = 'receipts/';

export interface StoredObject {
  key: string;
  lastModified: Date;
}

// One place that talks to Cloudflare R2 (which speaks the S3 API).
// The OCR service and the OCR worker used to each make their own S3 client, so the
// setup was copied in two spots. Now they both use this.
@Injectable()
export class R2StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor() {
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

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string): Promise<Buffer> {
    const response = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async deleteObject(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  // List every receipt image in the bucket with the date it was last written.
  // The daily sweeper uses this to find images that should already be gone.
  // We loop over pages so we get the whole bucket, not just the first page.
  async listReceiptObjects(): Promise<StoredObject[]> {
    const objects: StoredObject[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: RECEIPTS_PREFIX,
          ...(continuationToken && { ContinuationToken: continuationToken }),
        }),
      );

      for (const item of response.Contents ?? []) {
        if (item.Key && item.LastModified) {
          objects.push({ key: item.Key, lastModified: item.LastModified });
        }
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    return objects;
  }
}
