import type { Recipe } from '@pantryai/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeService } from '../recipe.service.js';
import type { TheMealDbClient } from '../themealdb.client.js';

// One local recipe the user can fully make (oeufs + lait + farine all in stock).
const localCrepesRow = {
  id: 'local-crepes',
  externalId: null,
  name: 'Crepes',
  category: 'Dessert',
  instructions: null,
  imageUrl: null,
  ingredients: [
    { name: 'farine', measure: '250 g' },
    { name: 'oeufs', measure: '3' },
    { name: 'lait', measure: '50 cl' },
  ],
};

const stockItems = [
  { product: { name: 'Farine de ble' } },
  { product: { name: 'Oeufs frais' } },
  { product: { name: 'Lait demi-ecreme' } },
];

const mockPrisma = {
  stockItem: { findMany: vi.fn() },
  recipe: {
    count: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
};

const mockThemealdb = {
  searchByIngredients: vi.fn(),
};

function makeService(): RecipeService {
  return new RecipeService(mockPrisma as never, mockThemealdb as unknown as TheMealDbClient);
}

describe('RecipeService.suggest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.recipe.count.mockResolvedValue(62); // already seeded
    mockPrisma.recipe.findMany.mockResolvedValue([localCrepesRow]);
    mockPrisma.stockItem.findMany.mockResolvedValue(stockItems);
    mockThemealdb.searchByIngredients.mockResolvedValue([]);
  });

  it('reads stock scoped to the user and to non-deleted items', async () => {
    await makeService().suggest('user-1');
    expect(mockPrisma.stockItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', deletedAt: null } }),
    );
  });

  it('seeds local recipes the first time when the table is empty', async () => {
    mockPrisma.recipe.count.mockResolvedValue(0);
    await makeService().suggest('user-1');
    expect(mockPrisma.recipe.create).toHaveBeenCalled();
  });

  it('does not re-seed when local recipes already exist', async () => {
    await makeService().suggest('user-1');
    expect(mockPrisma.recipe.create).not.toHaveBeenCalled();
  });

  it('falls back to local recipes when TheMealDB is down and still scores >= 70%', async () => {
    // searchByIngredients already swallows network errors and returns [], so an
    // outage looks like an empty online list to the service.
    mockThemealdb.searchByIngredients.mockResolvedValue([]);

    const result = await makeService().suggest('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.recipe.name).toBe('Crepes');
    expect(result[0]?.score).toBeCloseTo(1);
  });

  it('includes and caches recipes returned by TheMealDB', async () => {
    const online: Recipe = {
      id: 'themealdb-1',
      externalId: '1',
      name: 'Pancakes',
      ingredients: [
        { name: 'farine', measure: '1' },
        { name: 'oeufs', measure: '1' },
        { name: 'lait', measure: '1' },
      ],
    };
    mockThemealdb.searchByIngredients.mockResolvedValue([online]);

    const result = await makeService().suggest('user-1');

    expect(result.map((s) => s.recipe.name)).toContain('Pancakes');
    expect(mockPrisma.recipe.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { externalId: '1' } }),
    );
  });
});
