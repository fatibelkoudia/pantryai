import { Injectable, Logger } from '@nestjs/common';
import type { Recipe, RecipeSuggestion } from '@pantryai/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { rankSuggestions } from './recipe-scoring.js';
import { TheMealDbClient } from './themealdb.client.js';
import localRecipes from './data/recipes.fr.json';

// Shape of one recipe in the bundled JSON file.
interface LocalRecipe {
  name: string;
  category?: string;
  instructions?: string;
  imageUrl?: string;
  ingredients: { name: string; measure: string }[];
}

// A recipe row read back from the DB with its ingredients joined.
interface RecipeRow {
  id: string;
  externalId: string | null;
  name: string;
  category: string | null;
  instructions: string | null;
  imageUrl: string | null;
  ingredients: { name: string; measure: string }[];
}

@Injectable()
export class RecipeService {
  private readonly logger = new Logger(RecipeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly themealdb: TheMealDbClient,
  ) {}

  // Suggest recipes the user can mostly make from what's in their stock.
  // Local French recipes are always in the running, and TheMealDB adds more when
  // it's reachable. Everything goes through the same scoring.
  async suggest(userId: string): Promise<RecipeSuggestion[]> {
    const stockNames = await this.getStockNames(userId);

    await this.ensureLocalSeeded();
    const local = await this.loadLocalRecipes();

    // Try the online search too. If TheMealDB is down we just get an empty list
    // back and still have the local recipes to suggest from.
    const online = await this.themealdb.searchByIngredients(stockNames);
    await this.cacheOnlineRecipes(online);

    return rankSuggestions([...local, ...online], stockNames);
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

  // Seed the bundled French recipes into the DB once. After that this is a cheap
  // count check that does nothing.
  private async ensureLocalSeeded(): Promise<void> {
    const existing = await this.prisma.recipe.count({ where: { source: 'LOCAL' } });
    if (existing > 0) return;

    const recipes = localRecipes as LocalRecipe[];
    for (const recipe of recipes) {
      await this.prisma.recipe.create({
        data: {
          name: recipe.name,
          category: recipe.category ?? null,
          instructions: recipe.instructions ?? null,
          imageUrl: recipe.imageUrl ?? null,
          source: 'LOCAL',
          ingredients: {
            create: recipe.ingredients.map((ing) => ({ name: ing.name, measure: ing.measure })),
          },
        },
      });
    }
    this.logger.log(`Seeded ${recipes.length} local French recipes`);
  }

  private async loadLocalRecipes(): Promise<Recipe[]> {
    const rows = (await this.prisma.recipe.findMany({
      where: { source: 'LOCAL' },
      include: { ingredients: true },
    })) as RecipeRow[];
    return rows.map((row) => this.mapRow(row));
  }

  // Persist the recipes we pulled from TheMealDB so we have them next time and can
  // still show them if TheMealDB goes down. Keyed by externalId, never duplicated.
  private async cacheOnlineRecipes(recipes: Recipe[]): Promise<void> {
    for (const recipe of recipes) {
      if (!recipe.externalId) continue;
      try {
        await this.prisma.recipe.upsert({
          where: { externalId: recipe.externalId },
          create: {
            externalId: recipe.externalId,
            name: recipe.name,
            category: recipe.category ?? null,
            instructions: recipe.instructions ?? null,
            imageUrl: recipe.imageUrl ?? null,
            source: 'THEMEALDB',
            ingredients: {
              create: recipe.ingredients.map((ing) => ({ name: ing.name, measure: ing.measure })),
            },
          },
          update: {},
        });
      } catch (error) {
        // Caching is a nice-to-have; a write failure shouldn't break suggestions.
        this.logger.warn(`Could not cache recipe ${recipe.externalId}: ${String(error)}`);
      }
    }
  }

  private mapRow(row: RecipeRow): Recipe {
    return {
      id: row.id,
      name: row.name,
      ingredients: row.ingredients.map((ing) => ({ name: ing.name, measure: ing.measure })),
      ...(row.externalId != null && { externalId: row.externalId }),
      ...(row.category != null && { category: row.category }),
      ...(row.instructions != null && { instructions: row.instructions }),
      ...(row.imageUrl != null && { imageUrl: row.imageUrl }),
    };
  }
}
