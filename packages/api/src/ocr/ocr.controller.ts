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
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OcrJobResponseDto } from './dto/ocr-job-response.dto.js';
import { ScanQrDto } from './dto/scan-qr.dto.js';
import { OcrService } from './ocr.service.js';

interface JwtRequest {
  user: { userId: string; email: string };
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

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
  @ApiOperation({ summary: 'Upload a receipt image and start async OCR processing' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Receipt image (JPEG/PNG, max 10 MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 202, description: 'Job accepted - returns jobId' })
  @ApiResponse({ status: 400, description: 'No file uploaded or invalid format' })
  async scan(@Request() req: AuthedFastifyRequest): Promise<{ jobId: string }> {
    const data = await req.file();

    if (!data) {
      throw new BadRequestException('No file uploaded');
    }

    if (!ALLOWED_MIME_TYPES.has(data.mimetype)) {
      throw new BadRequestException('Unsupported file type - expected JPEG, PNG, or WebP');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer);
    }
    const imageBuffer = Buffer.concat(chunks);

    if (imageBuffer.length === 0) {
      throw new BadRequestException('Uploaded file is empty');
    }

    if (!hasImageMagicBytes(imageBuffer)) {
      throw new BadRequestException('File content is not a valid JPEG, PNG, or WebP image');
    }

    return this.ocrService.createJob(req.user.userId, imageBuffer, data.mimetype);
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
}
