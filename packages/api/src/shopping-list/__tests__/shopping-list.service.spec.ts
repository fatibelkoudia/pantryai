import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { RecipeSuggestion } from '@pantryai/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecipeService } from '../../recipes/recipe.service.js';
import { ShoppingListService } from '../shopping-list.service.js';

const mockPrisma = {
  shoppingItem: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  stockItem: { findMany: vi.fn() },
  recipe: { findMany: vi.fn() },
  userSettings: { findUnique: vi.fn() },
};

const mockRecipeService = {
  suggest: vi.fn(),
};

function makeService(): ShoppingListService {
  return new ShoppingListService(
    mockPrisma as never,
    mockRecipeService as unknown as RecipeService,
  );
}

// One suggestion the user is missing "Beurre" and "Sucre" for.
const crepeSuggestion: RecipeSuggestion = {
  recipe: { id: 'r1', name: 'Crêpes', ingredients: [] },
  score: 0.8,
  matchedIngredients: ['Farine', 'Oeufs'],
  missingIngredients: ['Beurre', 'Sucre'],
};

describe('ShoppingListService.generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Low/expiring stock: yoghurt is low (qty 1), the rest is plentiful.
    mockPrisma.stockItem.findMany.mockResolvedValue([{ product: { name: 'Yaourt nature' } }]);
    mockRecipeService.suggest.mockResolvedValue([crepeSuggestion]);
    // No existing items, then return what was created on the final findAll.
    mockPrisma.shoppingItem.findMany.mockResolvedValue([]);
    mockPrisma.shoppingItem.createMany.mockResolvedValue({ count: 0 });
    // no saved settings by default, the constant default threshold applies
    mockPrisma.userSettings.findUnique.mockResolvedValue(null);
  });

  it('uses the low stock threshold from the user settings when the request has none', async () => {
    mockPrisma.userSettings.findUnique.mockResolvedValue({ lowStockThreshold: 5 });

    await makeService().generate('user-1', {});

    expect(mockPrisma.stockItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ quantity: { lte: 5 } }]),
        }),
      }),
    );
  });

  it('lets an explicit request threshold win over the saved setting', async () => {
    mockPrisma.userSettings.findUnique.mockResolvedValue({ lowStockThreshold: 5 });

    await makeService().generate('user-1', { lowStockThreshold: 2 });

    expect(mockPrisma.stockItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ quantity: { lte: 2 } }]),
        }),
      }),
    );
  });

  it('merges low/expiring stock with recipe gaps', async () => {
    await makeService().generate('user-1', {});

    const created = mockPrisma.shoppingItem.createMany.mock.calls[0]?.[0].data as Array<{
      name: string;
      source: string;
    }>;
    const names = created.map((item) => item.name);
    expect(names).toContain('Yaourt nature');
    expect(names).toContain('Beurre');
    expect(names).toContain('Sucre');
    expect(created.find((item) => item.name === 'Yaourt nature')?.source).toBe('LOW_STOCK');
    expect(created.find((item) => item.name === 'Beurre')?.source).toBe('RECIPE');
  });

  it('dedupes a name shared by low stock and a recipe, keeping LOW_STOCK', async () => {
    mockPrisma.stockItem.findMany.mockResolvedValue([{ product: { name: 'Beurre' } }]);

    await makeService().generate('user-1', {});

    const created = mockPrisma.shoppingItem.createMany.mock.calls[0]?.[0].data as Array<{
      name: string;
      source: string;
    }>;
    const beurre = created.filter((item) => item.name === 'Beurre');
    expect(beurre).toHaveLength(1);
    expect(beurre[0]?.source).toBe('LOW_STOCK');
  });

  it('does not re-add an item already on the list (normalized match)', async () => {
    // "beurre" already present; the recipe gap "Beurre" should be skipped.
    mockPrisma.stockItem.findMany.mockResolvedValue([]);
    mockPrisma.shoppingItem.findMany.mockResolvedValueOnce([{ name: 'beurre' }]);

    await makeService().generate('user-1', {});

    const created = mockPrisma.shoppingItem.createMany.mock.calls[0]?.[0].data as Array<{
      name: string;
    }>;
    expect(created.map((item) => item.name)).not.toContain('Beurre');
    expect(created.map((item) => item.name)).toContain('Sucre');
  });

  it('respects the low-stock threshold passed in', async () => {
    await makeService().generate('user-1', { lowStockThreshold: 3 });

    const where = mockPrisma.stockItem.findMany.mock.calls[0]?.[0].where;
    expect(where.OR[0]).toEqual({ quantity: { lte: 3 } });
  });

  it('skips recipe gaps when includeRecipes is false (stock only)', async () => {
    await makeService().generate('user-1', { includeRecipes: false });

    expect(mockRecipeService.suggest).not.toHaveBeenCalled();
    const created = mockPrisma.shoppingItem.createMany.mock.calls[0]?.[0].data as Array<{
      name: string;
      source: string;
    }>;
    expect(created.map((item) => item.name)).toEqual(['Yaourt nature']);
    expect(created[0]?.source).toBe('LOW_STOCK');
  });

  it('uses chosen recipes (not suggestions) when recipeIds are given', async () => {
    mockPrisma.stockItem.findMany.mockResolvedValue([]); // nothing low, no stock
    mockPrisma.recipe.findMany.mockResolvedValue([
      {
        id: 'r9',
        name: 'Omelette',
        ingredients: [
          { name: 'Oeufs', measure: '3' },
          { name: 'Fromage', measure: '50 g' },
        ],
      },
    ]);

    await makeService().generate('user-1', { recipeIds: ['r9'] });

    expect(mockRecipeService.suggest).not.toHaveBeenCalled();
    const created = mockPrisma.shoppingItem.createMany.mock.calls[0]?.[0].data as Array<{
      name: string;
    }>;
    // With an empty stock, both ingredients are missing.
    expect(created.map((item) => item.name)).toEqual(expect.arrayContaining(['Oeufs', 'Fromage']));
  });
});

describe('ShoppingListService manual CRUD', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a manual item with source MANUAL', async () => {
    mockPrisma.shoppingItem.create.mockResolvedValue({ id: 's1' });
    await makeService().create('user-1', { name: 'Café', quantity: 1, unit: 'paquet' });
    expect(mockPrisma.shoppingItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', name: 'Café', source: 'MANUAL' }),
      }),
    );
  });

  it('keeps the RECIPE source when the app adds a missing ingredient', async () => {
    mockPrisma.shoppingItem.create.mockResolvedValue({ id: 's2' });
    await makeService().create('user-1', { name: 'Beurre', source: 'RECIPE' });
    expect(mockPrisma.shoppingItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Beurre', source: 'RECIPE' }),
      }),
    );
  });

  it('checks an item the user owns', async () => {
    mockPrisma.shoppingItem.findUnique.mockResolvedValue({ id: 's1', userId: 'user-1' });
    mockPrisma.shoppingItem.update.mockResolvedValue({ id: 's1', checked: true });
    await makeService().update('s1', 'user-1', { checked: true });
    expect(mockPrisma.shoppingItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        // ticking an item also stamps checkedAt for the weekly challenge window
        data: { checked: true, checkedAt: expect.any(Date) },
      }),
    );
  });

  it('rejects updating an item owned by someone else', async () => {
    mockPrisma.shoppingItem.findUnique.mockResolvedValue({ id: 's1', userId: 'other' });
    await expect(makeService().update('s1', 'user-1', { checked: true })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('404s when removing a missing item', async () => {
    mockPrisma.shoppingItem.findUnique.mockResolvedValue(null);
    await expect(makeService().remove('nope', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
