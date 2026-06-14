import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

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
}
