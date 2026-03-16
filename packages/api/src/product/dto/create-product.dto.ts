import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsJSON, IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Greek Yogurt' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Danone' })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({ example: '3033490004934' })
  @IsString()
  @IsOptional()
  ean13?: string;

  @ApiPropertyOptional({ example: 'Dairy' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ example: 'https://images.openfoodfacts.org/...' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'JSON nutrition data' })
  @IsJSON()
  @IsOptional()
  nutritionData?: string;
}
