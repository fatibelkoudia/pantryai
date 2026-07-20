import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
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

// In the mobile edit sheet, sending expirationDate = null means "remove the date".
// Sending nothing means "don't touch the date". These tests check both cases work.
describe('stock DTO expirationDate transformation', () => {
  it('keeps null (clears the date) and passes validation', () => {
    const dto = plainToInstance(UpdateStockItemDto, { expirationDate: null });
    expect(dto.expirationDate).toBeNull();
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('transforms an ISO date string into a Date', () => {
    const dto = plainToInstance(UpdateStockItemDto, { expirationDate: '2026-08-01' });
    expect(dto.expirationDate).toBeInstanceOf(Date);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('leaves expirationDate undefined when omitted (date untouched)', () => {
    const dto = plainToInstance(UpdateStockItemDto, { quantity: 5 });
    expect(dto.expirationDate).toBeUndefined();
  });
});
