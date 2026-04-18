import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { StockLocation } from './create-stock-item.dto.js';

export class StockQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter items expiring within 7 days', example: true })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  expiringSoon?: boolean;

  @ApiPropertyOptional({ enum: StockLocation, description: 'Filter by storage location' })
  @IsEnum(StockLocation)
  @IsOptional()
  location?: StockLocation;

  @ApiPropertyOptional({ example: 'yogurt', description: 'Search by product name' })
  @IsString()
  @IsOptional()
  search?: string;
}
