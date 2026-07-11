import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Recipe } from '@pantryai/shared';
import { normalizeIngredient, scoreRecipe } from '../recipes/recipe-scoring.js';
import { RecipeService } from '../recipes/recipe.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateShoppingItemDto } from './dto/create-shopping-item.dto.js';
import { GenerateShoppingListDto } from './dto/generate-shopping-list.dto.js';
import { UpdateShoppingItemDto } from './dto/update-shopping-item.dto.js';

// Default quantity at or below which a stock item is considered "low".
const DEFAULT_LOW_STOCK_THRESHOLD = 1;
// Stock expiring within this many days also lands on the list (use/replace soon).
const EXPIRY_WINDOW_DAYS = 7;

type ShoppingSource = 'LOW_STOCK' | 'RECIPE' | 'MANUAL';

// A name we want on the list, before dedupe and persistence.
interface Candidate {
  name: string;
  source: ShoppingSource;
}

@Injectable()
export class ShoppingListService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipeService: RecipeService,
  ) {}

  // The user's current list. Unchecked items first, then oldest first so the order
  // is stable as things get ticked off.
  async findAll(userId: string) {
    const items = await this.prisma.shoppingItem.findMany({
      where: { userId },
      orderBy: [{ checked: 'asc' }, { createdAt: 'asc' }],
    });
    return { items };
  }

  // Merge low/expiring stock with the missing ingredients of the chosen recipes
  // (or the user's suggested recipes when none are chosen), drop duplicates, and
  // persist the new entries. Existing items are never duplicated.
  async generate(userId: string, dto: GenerateShoppingListDto) {
    const threshold = dto.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

    const lowStock = await this.getLowStockNames(userId, threshold);
    // the caller can opt out of recipe ingredients and only restock the basics
    const recipeGaps =
      dto.includeRecipes === false ? [] : await this.getRecipeGaps(userId, dto.recipeIds);

    // LOW_STOCK before RECIPE so a name shared by both keeps the LOW_STOCK source.
    const candidates: Candidate[] = [
      ...lowStock.map((name) => ({ name, source: 'LOW_STOCK' as const })),
      ...recipeGaps.map((name) => ({ name, source: 'RECIPE' as const })),
    ];

    const existing = await this.prisma.shoppingItem.findMany({
      where: { userId },
      select: { name: true },
    });
    const seen = new Set(existing.map((item) => normalizeIngredient(item.name)));

    const toCreate: Candidate[] = [];
    for (const candidate of candidates) {
      const key = normalizeIngredient(candidate.name);
      if (key.length === 0 || seen.has(key)) continue;
      seen.add(key);
      toCreate.push(candidate);
    }

    if (toCreate.length > 0) {
      await this.prisma.shoppingItem.createMany({
        data: toCreate.map((candidate) => ({
          userId,
          name: candidate.name,
          source: candidate.source,
        })),
      });
    }

    return this.findAll(userId);
  }

  async create(userId: string, dto: CreateShoppingItemDto) {
    return this.prisma.shoppingItem.create({
      data: {
        userId,
        name: dto.name,
        quantity: dto.quantity ?? null,
        unit: dto.unit ?? null,
        // RECIPE when the app adds missing recipe ingredients, MANUAL otherwise
        source: dto.source ?? 'MANUAL',
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateShoppingItemDto) {
    await this.findOne(id, userId);
    return this.prisma.shoppingItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.checked !== undefined && { checked: dto.checked }),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.shoppingItem.delete({ where: { id } });
  }

  // Shared ownership check: 404 if it doesn't exist, 403 if it's someone else's.
  private async findOne(id: string, userId: string) {
    const item = await this.prisma.shoppingItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Shopping item not found');
    if (item.userId !== userId) throw new ForbiddenException();
    return item;
  }

  // Product names of stock that is running low OR expiring within the window.
  private async getLowStockNames(userId: string, threshold: number): Promise<string[]> {
    const expiryCutoff = new Date(Date.now() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const items = await this.prisma.stockItem.findMany({
      where: {
        userId,
        deletedAt: null,
        OR: [
          { quantity: { lte: threshold } },
          { expirationDate: { not: null, lte: expiryCutoff } },
        ],
      },
      include: { product: true },
    });

    const names = new Set<string>();
    for (const item of items) {
      if (item.product?.name) names.add(item.product.name);
    }
    return [...names];
  }

  // Missing ingredients across the chosen recipes (or the user's suggestions when
  // no ids are given), scored against the current stock.
  private async getRecipeGaps(userId: string, recipeIds?: string[]): Promise<string[]> {
    if (!recipeIds || recipeIds.length === 0) {
      const suggestions = await this.recipeService.suggest(userId);
      return suggestions.flatMap((suggestion) => suggestion.missingIngredients);
    }

    const stockNames = await this.getStockNames(userId);
    const rows = await this.prisma.recipe.findMany({
      where: { id: { in: recipeIds } },
      include: { ingredients: true },
    });

    return rows.flatMap((row) => {
      const recipe: Recipe = {
        id: row.id,
        name: row.name,
        ingredients: row.ingredients.map((ing) => ({ name: ing.name, measure: ing.measure })),
      };
      return scoreRecipe(recipe, stockNames).missing;
    });
  }

  // Distinct product names currently in the user's stock (not soft-deleted).
  private async getStockNames(userId: string): Promise<string[]> {
    const items = await this.prisma.stockItem.findMany({
      where: { userId, deletedAt: null },
      include: { product: true },
    });
    const names = new Set<string>();
    for (const item of items) {
      if (item.product?.name) names.add(item.product.name);
    }
    return [...names];
  }
}
