import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';
import { CreateStockItemDto, StockLocation } from '../dto/create-stock-item.dto.js';
import { UpdateStockItemDto } from '../dto/update-stock-item.dto.js';

// Regression: a default initializer on CreateStockItemDto.location used to leak
// through PartialType and through class-transformer, so `location` was never
// `undefined` after transformation. That silently reset the location on partial
// PATCH updates and overrode the user's defaultStockLocation on create.
// The unit tests missed it because they passed plain objects, not transformed DTOs.
describe('stock DTO location default does not leak after transformation', () => {
  it('leaves location undefined on an update payload that omits it', () => {
    const dto = plainToInstance(UpdateStockItemDto, { quantity: 5 });
    expect(dto.location).toBeUndefined();
  });

  it('leaves location undefined on a create payload that omits it', () => {
    const dto = plainToInstance(CreateStockItemDto, {
      productId: 'prod-uuid-1',
      quantity: 2,
      unit: 'L',
    });
    expect(dto.location).toBeUndefined();
  });

  it('keeps an explicitly provided location', () => {
    const dto = plainToInstance(UpdateStockItemDto, { location: StockLocation.FRIDGE });
    expect(dto.location).toBe(StockLocation.FRIDGE);
  });
});
