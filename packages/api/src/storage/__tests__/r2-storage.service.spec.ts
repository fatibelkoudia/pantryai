// Tests for R2StorageService, the one spot that talks to Cloudflare R2 (over the S3 API).
// We mock the AWS SDK, so we just check the commands we build and that the paging and the
// stream-to-Buffer read work. No network, no real bucket.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({ send: mockSend })),
  PutObjectCommand: vi.fn((input) => ({ _cmd: 'put', ...input })),
  GetObjectCommand: vi.fn((input) => ({ _cmd: 'get', ...input })),
  DeleteObjectCommand: vi.fn((input) => ({ _cmd: 'delete', ...input })),
  ListObjectsV2Command: vi.fn((input) => ({ _cmd: 'list', ...input })),
}));

import { R2StorageService } from '../r2-storage.service.js';

function makeStreamBody(buffer: Buffer): AsyncIterable<Uint8Array> {
  return (async function* () {
    yield buffer;
  })();
}

let service: R2StorageService;

beforeEach(() => {
  vi.clearAllMocks();
  process.env['R2_BUCKET_NAME'] = 'test-bucket';
  service = new R2StorageService();
});

describe('R2StorageService', () => {
  it('putObject sends a PutObjectCommand with the body and content type', async () => {
    mockSend.mockResolvedValue({});
    await service.putObject('receipts/u/1.jpg', Buffer.from('img'), 'image/jpeg');

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0]![0]).toMatchObject({
      _cmd: 'put',
      Bucket: 'test-bucket',
      Key: 'receipts/u/1.jpg',
      ContentType: 'image/jpeg',
    });
  });

  it('getObject streams the response body into a Buffer', async () => {
    mockSend.mockResolvedValue({ Body: makeStreamBody(Buffer.from('hello')) });
    const out = await service.getObject('receipts/u/1.jpg');

    expect(out.toString()).toBe('hello');
    expect(mockSend.mock.calls[0]![0]).toMatchObject({ _cmd: 'get', Key: 'receipts/u/1.jpg' });
  });

  it('deleteObject sends a DeleteObjectCommand for the key', async () => {
    mockSend.mockResolvedValue({});
    await service.deleteObject('receipts/u/1.jpg');

    expect(mockSend.mock.calls[0]![0]).toMatchObject({ _cmd: 'delete', Key: 'receipts/u/1.jpg' });
  });

  it('listReceiptObjects walks every page and keeps only keys with a date', async () => {
    mockSend
      .mockResolvedValueOnce({
        Contents: [
          { Key: 'receipts/a.jpg', LastModified: new Date('2026-01-01') },
          { Key: 'receipts/no-date.jpg' }, // dropped: no LastModified
        ],
        IsTruncated: true,
        NextContinuationToken: 'page2',
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: 'receipts/b.jpg', LastModified: new Date('2026-01-02') }],
        IsTruncated: false,
      });

    const objects = await service.listReceiptObjects();

    expect(objects.map((o) => o.key)).toEqual(['receipts/a.jpg', 'receipts/b.jpg']);
    expect(mockSend).toHaveBeenCalledTimes(2);
    // The second call carries the continuation token from the first page.
    expect(mockSend.mock.calls[1]![0]).toMatchObject({ ContinuationToken: 'page2' });
  });

  it('listReceiptObjects returns empty when the bucket has no contents', async () => {
    mockSend.mockResolvedValue({});
    expect(await service.listReceiptObjects()).toEqual([]);
  });
});
