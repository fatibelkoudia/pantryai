import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateShoppingItemDto {
  @ApiPropertyOptional({ example: 'Lait entier' })
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ example: 'L' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  checked?: boolean;
}
