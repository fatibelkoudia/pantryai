import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateShoppingItemDto {
  @ApiProperty({ example: 'Lait demi-écrémé' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ example: 2 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ example: 'L' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({
    enum: ['MANUAL', 'RECIPE'],
    description:
      'Where the item comes from, so the list can label it. Defaults to MANUAL. ' +
      'LOW_STOCK is reserved for the generator.',
  })
  @IsIn(['MANUAL', 'RECIPE'])
  @IsOptional()
  source?: 'MANUAL' | 'RECIPE';
}
