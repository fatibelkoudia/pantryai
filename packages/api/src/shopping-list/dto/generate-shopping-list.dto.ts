import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class GenerateShoppingListDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      "Recipes whose missing ingredients should be added. When omitted, the user's " +
      'auto-suggested recipes (>= 70% match) are used instead.',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  recipeIds?: string[];

  @ApiPropertyOptional({
    example: 1,
    description: 'Stock items at or below this quantity count as low stock. Defaults to 1.',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  lowStockThreshold?: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'Set to false to only add low/expiring stock and skip recipe ingredients. Defaults to true.',
  })
  @IsBoolean()
  @IsOptional()
  includeRecipes?: boolean;
}
