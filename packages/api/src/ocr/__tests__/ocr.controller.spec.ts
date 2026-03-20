import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasImageMagicBytes, OcrController } from '../ocr.controller.js';

const JPEG_BUFFER = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16, 1)]);
const PNG_BUFFER = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16, 1),
]);
const WEBP_BUFFER = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.alloc(4, 0),
  Buffer.from('WEBP', 'ascii'),
  Buffer.alloc(16, 1),
]);

const mockOcrService = {
  createJob: vi.fn(),
  createQrJob: vi.fn(),
  getJob: vi.fn(),
};

function fakeUploadRequest(mimetype: string, content: Buffer) {
  return {
    user: { userId: 'user-1', email: 'user@example.com' },
    file: () =>
      Promise.resolve({
        mimetype,
        file: (async function* () {
          yield content;
        })(),
      }),
  } as never;
}

describe('hasImageMagicBytes', () => {
  it('accepts JPEG, PNG, and WebP signatures', () => {
    expect(hasImageMagicBytes(JPEG_BUFFER)).toBe(true);
    expect(hasImageMagicBytes(PNG_BUFFER)).toBe(true);
    expect(hasImageMagicBytes(WEBP_BUFFER)).toBe(true);
  });

  it('rejects non-image content and too-short buffers', () => {
    expect(hasImageMagicBytes(Buffer.from('not an image, just text'))).toBe(false);
    expect(hasImageMagicBytes(Buffer.from([0xff, 0xd8]))).toBe(false);
  });
});

describe('OcrController.scan upload validation', () => {
  let controller: OcrController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new OcrController(mockOcrService as never);
  });

  it('rejects disallowed MIME types before reading the stream', async () => {
    await expect(controller.scan(fakeUploadRequest('text/plain', JPEG_BUFFER))).rejects.toThrow(
      BadRequestException,
    );
    expect(mockOcrService.createJob).not.toHaveBeenCalled();
  });

  it('rejects a renamed non-image file via magic-byte sniffing', async () => {
    const fakeJpeg = Buffer.from('malicious payload pretending to be a JPEG');
    await expect(controller.scan(fakeUploadRequest('image/jpeg', fakeJpeg))).rejects.toThrow(
      BadRequestException,
    );
    expect(mockOcrService.createJob).not.toHaveBeenCalled();
  });

  it('queues the job for a genuine JPEG upload', async () => {
    mockOcrService.createJob.mockResolvedValue({ jobId: 'job-1' });

    const result = await controller.scan(fakeUploadRequest('image/jpeg', JPEG_BUFFER));

    expect(result).toEqual({ jobId: 'job-1' });
    expect(mockOcrService.createJob).toHaveBeenCalledWith('user-1', JPEG_BUFFER, 'image/jpeg');
  });
});
