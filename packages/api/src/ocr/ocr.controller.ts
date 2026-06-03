import { MultipartFile } from '@fastify/multipart';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ConfirmOcrJobDto } from './dto/confirm-ocr-job.dto.js';
import { OcrJobResponseDto } from './dto/ocr-job-response.dto.js';
import { ScanQrDto } from './dto/scan-qr.dto.js';
import { OcrService } from './ocr.service.js';

interface JwtRequest {
  user: { userId: string; email: string };
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

// PDFs go through Mistral OCR, which the docs cap well under this; match the QR path's limit.
const MAX_PDF_BYTES = 5 * 1024 * 1024;

/** Check file signatures so renamed non-image files are rejected. */
export function hasImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) {
    return false;
  }
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isPng = buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const isWebp =
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return isJpeg || isPng || isWebp;
}

/** PDFs start with the `%PDF-` signature. */
export function hasPdfMagicBytes(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

type AuthedFastifyRequest = FastifyRequest &
  JwtRequest & {
    file(): Promise<MultipartFile | undefined>;
  };

@ApiTags('ocr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('scan')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Upload a receipt image or PDF and start async OCR processing' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Receipt image (JPEG/PNG/WebP, max 10 MB) or PDF (max 5 MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiQuery({
    name: 'autoCommit',
    required: false,
    description:
      'When "false", items are extracted but NOT added to stock — confirm them via POST /ocr/jobs/:id/confirm. Defaults to true.',
  })
  @ApiResponse({ status: 202, description: 'Job accepted - returns jobId' })
  @ApiResponse({ status: 400, description: 'No file uploaded or invalid format' })
  async scan(
    @Request() req: AuthedFastifyRequest,
    @Query('autoCommit') autoCommit?: string,
  ): Promise<{ jobId: string }> {
    const data = await req.file();

    if (!data) {
      throw new BadRequestException('No file uploaded');
    }

    if (!ALLOWED_MIME_TYPES.has(data.mimetype)) {
      throw new BadRequestException('Unsupported file type - expected JPEG, PNG, WebP, or PDF');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer);
    }
    const fileBuffer = Buffer.concat(chunks);

    if (fileBuffer.length === 0) {
      throw new BadRequestException('Uploaded file is empty');
    }

    const isPdf = data.mimetype === 'application/pdf';

    if (isPdf) {
      if (!hasPdfMagicBytes(fileBuffer)) {
        throw new BadRequestException('File content is not a valid PDF');
      }
      if (fileBuffer.length > MAX_PDF_BYTES) {
        throw new BadRequestException('PDF exceeds 5 MB limit');
      }
    } else if (!hasImageMagicBytes(fileBuffer)) {
      throw new BadRequestException('File content is not a valid JPEG, PNG, or WebP image');
    }

    // Only the literal string "false" opts out; anything else keeps the default auto-commit.
    return this.ocrService.createJob(
      req.user.userId,
      fileBuffer,
      data.mimetype,
      autoCommit !== 'false',
    );
  }

  @Post('scan-qr')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Submit a QR receipt URL for async processing (loi AGEC)' })
  @ApiBody({ type: ScanQrDto })
  @ApiResponse({ status: 202, description: 'Job accepted - returns jobId' })
  @ApiResponse({ status: 400, description: 'Invalid or non-public URL' })
  scanQr(@Body() dto: ScanQrDto, @Request() req: JwtRequest): Promise<{ jobId: string }> {
    return this.ocrService.createQrJob(req.user.userId, dto.url);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get OCR job status and results' })
  @ApiParam({ name: 'id', description: 'OCR job ID' })
  @ApiResponse({ status: 200, description: 'Job details', type: OcrJobResponseDto })
  @ApiResponse({ status: 404, description: 'Job not found' })
  getJob(@Param('id') id: string, @Request() req: JwtRequest) {
    return this.ocrService.getJob(id, req.user.userId);
  }

  @Post('jobs/:id/confirm')
  @ApiOperation({ summary: 'Add the selected parsed items from a completed job to stock' })
  @ApiParam({ name: 'id', description: 'OCR job ID' })
  @ApiResponse({ status: 201, description: 'Selected items added - returns the count' })
  @ApiResponse({ status: 400, description: 'Job not ready or no valid items selected' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  confirmJob(
    @Param('id') id: string,
    @Body() dto: ConfirmOcrJobDto,
    @Request() req: JwtRequest,
  ): Promise<{ added: number }> {
    return this.ocrService.confirmJob(id, req.user.userId, dto.indices);
  }
}
