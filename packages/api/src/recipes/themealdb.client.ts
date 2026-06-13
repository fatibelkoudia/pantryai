import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Recipe } from '@pantryai/shared';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import { normalizeIngredient } from './recipe-scoring.js';

const BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

// We cache the full meal detail for a week. TheMealDB recipes basically never
// change, so this keeps us off their servers and lets us answer when they're down.
const CACHE_PREFIX = 'themealdb:meal:';
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

// Be polite: keep live calls under ~1 per second and don't fan out forever.
const MIN_INTERVAL_MS = 350;
const MAX_INGREDIENTS = 8;
const MAX_LOOKUPS = 25;
const FETCH_TIMEOUT_MS = 5000;

interface FilterMeal {
  idMeal: string;
}

interface FilterResponse {
  meals: FilterMeal[] | null;
}

// TheMealDB returns ingredients as flat strIngredient1..20 / strMeasure1..20 fields.
type LookupMeal = {
  idMeal: string;
  strMeal: string;
  strCategory?: string | null;
  strInstructions?: string | null;
  strMealThumb?: string | null;
} & Record<string, string | null | undefined>;

interface LookupResponse {
  meals: LookupMeal[] | null;
}

@Injectable()
export class TheMealDbClient {
  private readonly logger = new Logger(TheMealDbClient.name);

  // Spaces out live calls the same way the product OFF lookup does: each call
  // waits for the previous one, then waits out the rest of the interval.
  private fetchChain: Promise<unknown> = Promise.resolve();
  private lastFetchAt = 0;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // Find recipes that use the given stock ingredients. Returns whatever we could
  // map; on any network trouble it returns [] so the caller falls back to local.
  async searchByIngredients(stockNames: string[]): Promise<Recipe[]> {
    try {
      const ingredients = this.pickSearchIngredients(stockNames);
      if (ingredients.length === 0) return [];

      const mealIds = await this.collectMealIds(ingredients);
      if (mealIds.length === 0) return [];

      const recipes: Recipe[] = [];
      for (const id of mealIds.slice(0, MAX_LOOKUPS)) {
        const recipe = await this.lookupMeal(id);
        if (recipe) recipes.push(recipe);
      }
      return recipes;
    } catch (error) {
      // TheMealDB is unreachable or acting up. That's ok, we just have no online
      // recipes this time round and fall back to the local ones.
      this.logger.warn(`TheMealDB search failed, falling back to local: ${String(error)}`);
      return [];
    }
  }

  private pickSearchIngredients(stockNames: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const name of stockNames) {
      const normalized = normalizeIngredient(name);
      // filter.php wants a single ingredient term, so take the first word.
      const term = normalized.split(' ')[0];
      if (term && term.length > 2 && !seen.has(term)) {
        seen.add(term);
        result.push(term);
        if (result.length >= MAX_INGREDIENTS) break;
      }
    }
    return result;
  }

  private async collectMealIds(ingredients: string[]): Promise<string[]> {
    const ids = new Set<string>();
    for (const ingredient of ingredients) {
      const url = `${BASE_URL}/filter.php?i=${encodeURIComponent(ingredient)}`;
      const data = await this.rateLimitedFetch<FilterResponse>(url);
      for (const meal of data?.meals ?? []) {
        ids.add(meal.idMeal);
      }
    }
    return [...ids];
  }

  // Read the meal from Redis if we have it, otherwise fetch + cache it.
  private async lookupMeal(id: string): Promise<Recipe | null> {
    const cacheKey = CACHE_PREFIX + id;

    const cached = await this.readCache(cacheKey);
    if (cached !== undefined) return cached;

    const url = `${BASE_URL}/lookup.php?i=${encodeURIComponent(id)}`;
    const data = await this.rateLimitedFetch<LookupResponse>(url);
    const meal = data?.meals?.[0] ?? null;
    const recipe = meal ? this.mapMeal(meal) : null;

    await this.writeCache(cacheKey, recipe);
    return recipe;
  }

  private mapMeal(meal: LookupMeal): Recipe {
    const ingredients: { name: string; measure: string }[] = [];
    for (let i = 1; i <= 20; i++) {
      const name = (meal[`strIngredient${i}`] ?? '').trim();
      const measure = (meal[`strMeasure${i}`] ?? '').trim();
      if (name.length > 0) {
        ingredients.push({ name, measure });
      }
    }

    return {
      id: `themealdb-${meal.idMeal}`,
      externalId: meal.idMeal,
      name: meal.strMeal,
      ingredients,
      ...(meal.strCategory != null && { category: meal.strCategory }),
      ...(meal.strInstructions != null && { instructions: meal.strInstructions }),
      ...(meal.strMealThumb != null && { imageUrl: meal.strMealThumb }),
    };
  }

  private async readCache(key: string): Promise<Recipe | null | undefined> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return undefined;
      return JSON.parse(raw) as Recipe | null;
    } catch {
      return undefined;
    }
  }

  private async writeCache(key: string, value: Recipe | null): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS);
    } catch {
      // Couldn't cache it, no big deal. The caller already has the result.
    }
  }

  private rateLimitedFetch<T>(url: string): Promise<T> {
    const run = this.fetchChain.then(async () => {
      const wait = MIN_INTERVAL_MS - (Date.now() - this.lastFetchAt);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      this.lastFetchAt = Date.now();
      return this.fetchJson<T>(url);
    });
    this.fetchChain = run.catch(() => undefined);
    return run;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`TheMealDB responded ${response.status}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
