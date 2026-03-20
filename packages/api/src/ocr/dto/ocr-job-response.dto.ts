import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OcrParsedItemDto {
  @ApiProperty({ example: 'Yaourt nature' })
  name!: string;

  @ApiPropertyOptional({ example: 2 })
  quantity?: number;

  @ApiPropertyOptional({ example: 'unit' })
  unit?: string;

  @ApiProperty({ example: 0.95, description: 'Confidence score 0–1' })
  confidence!: number;
}

export class OcrJobResponseDto {
  @ApiProperty({ example: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] })
  status!: string;

  @ApiPropertyOptional({ example: 'receipts/user-id/job-id.jpg' })
  imageKey?: string;

  @ApiPropertyOptional({ example: 'Lidl' })
  retailer?: string;

  @ApiPropertyOptional({ example: 'LIDL\nYaourt nature x2  1.29\n...' })
  rawText?: string;

  @ApiPropertyOptional({ type: [OcrParsedItemDto] })
  parsedItems?: OcrParsedItemDto[];

  @ApiPropertyOptional({ example: 'Mistral OCR unavailable and Tesseract failed' })
  error?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  completedAt?: Date;
}
