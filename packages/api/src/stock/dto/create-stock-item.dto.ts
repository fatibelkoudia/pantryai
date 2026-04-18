import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum StockLocation {
  FRIDGE = 'FRIDGE',
  FREEZER = 'FREEZER',
  PANTRY = 'PANTRY',
}

export class CreateStockItemDto {
  @ApiProperty({ example: 'prod-uuid-1' })
  @IsString()
  productId!: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty({ example: 'kg' })
  @IsString()
  unit!: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  expirationDate?: Date;

  @ApiPropertyOptional({ enum: StockLocation, default: StockLocation.PANTRY })
  @IsEnum(StockLocation)
  @IsOptional()
  location?: StockLocation = StockLocation.PANTRY;
}
