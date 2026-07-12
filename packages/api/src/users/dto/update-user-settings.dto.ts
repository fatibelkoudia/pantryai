import { ApiPropertyOptional } from '@nestjs/swagger';
import { SETTINGS_LIMITS, SUPPORTED_LOCALES } from '@pantryai/shared';
import { IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

// The three storage places we know about, same values as the Prisma enum.
const STOCK_LOCATIONS = ['FRIDGE', 'FREEZER', 'PANTRY'] as const;
export type StockLocationValue = (typeof STOCK_LOCATIONS)[number];

// Every field is optional so the clients can save one knob at a time.
// The min/max bounds come from the shared package so the apps use the same ones.
export class UpdateUserSettingsDto {
  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, example: 'fr' })
  @IsIn(SUPPORTED_LOCALES)
  @IsOptional()
  locale?: (typeof SUPPORTED_LOCALES)[number];

  @ApiPropertyOptional({
    example: 2,
    description: 'A recipe must use at least this many items from the stock to be suggested.',
  })
  @IsInt()
  @Min(SETTINGS_LIMITS.recipeMinMatchedItems.min)
  @Max(SETTINGS_LIMITS.recipeMinMatchedItems.max)
  @IsOptional()
  recipeMinMatchedItems?: number;

  @ApiPropertyOptional({
    example: 0.7,
    description: 'Fraction of a recipe ingredients the user must already own (0.3 to 1).',
  })
  @IsNumber()
  @Min(SETTINGS_LIMITS.recipeMatchThreshold.min)
  @Max(SETTINGS_LIMITS.recipeMatchThreshold.max)
  @IsOptional()
  recipeMatchThreshold?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Days before the expiration date where an item counts as expiring soon.',
  })
  @IsInt()
  @Min(SETTINGS_LIMITS.expiringSoonDays.min)
  @Max(SETTINGS_LIMITS.expiringSoonDays.max)
  @IsOptional()
  expiringSoonDays?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Quantity at or below this counts as low stock for the shopping list.',
  })
  @IsInt()
  @Min(SETTINGS_LIMITS.lowStockThreshold.min)
  @Max(SETTINGS_LIMITS.lowStockThreshold.max)
  @IsOptional()
  lowStockThreshold?: number;

  @ApiPropertyOptional({ enum: STOCK_LOCATIONS, example: 'FRIDGE' })
  @IsIn(STOCK_LOCATIONS)
  @IsOptional()
  defaultStockLocation?: StockLocationValue;
}
