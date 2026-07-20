import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { StockLocation } from '../../stock/dto/create-stock-item.dto.js';

// One item the user chose to add to their stock from a scanned receipt.
// "index" is the position of the item in the parsedItems list.
// The quantity, unit, expiration date and location are optional because
// the user can change them before adding, but they don't have to.
export class ConfirmOcrItemDto {
  @ApiProperty({ example: 0, description: "Index into the job's parsedItems" })
  @IsInt()
  @Min(0)
  index!: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ example: 'L' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expirationDate?: Date;

  @ApiPropertyOptional({ enum: StockLocation })
  @IsOptional()
  @IsEnum(StockLocation)
  location?: StockLocation;
}

export class ConfirmOcrJobDto {
  @ApiPropertyOptional({
    description:
      "Indices into the job's parsedItems to add with their parsed values (no edits). " +
      'Use `items` instead to add with per-item edits.',
    example: [0, 1, 3],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  indices?: number[];

  @ApiPropertyOptional({
    description: 'Selected items with per-item edits (quantity, unit, expiration date, location).',
    type: [ConfirmOcrItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmOcrItemDto)
  items?: ConfirmOcrItemDto[];
}
