import type { Recipe } from '@pantryai/shared';
import { describe, expect, it } from 'vitest';
import { normalizeIngredient, rankSuggestions, scoreRecipe } from '../recipe-scoring.js';

function recipe(name: string, ingredients: string[]): Recipe {
  return {
    id: name,
    name,
    ingredients: ingredients.map((n) => ({ name: n, measure: '1' })),
  };
}

describe('normalizeIngredient', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(normalizeIngredient('Crème Fraîche')).toBe('creme fraiche');
    expect(normalizeIngredient("Huile d'olive")).toBe('huile d olive');
  });
});

describe('scoreRecipe', () => {
  it('computes ingredients in stock / ingredients required', () => {
    const r = recipe('Quatre-quarts', ['oeufs', 'beurre', 'lait', 'fromage']);
    const { score, matched, missing } = scoreRecipe(r, ['oeufs', 'beurre', 'fromage']);

    // 3 of 4 ingredients are in stock.
    expect(score).toBeCloseTo(0.75);
    expect(matched).toEqual(['oeufs', 'beurre', 'fromage']);
    expect(missing).toEqual(['lait']);
  });

  it('ignores pantry staples (salt, pepper, water) when scoring', () => {
    const r = recipe('Omelette nature', ['oeufs', 'beurre', 'sel', 'poivre']);
    const { score, matched, missing } = scoreRecipe(r, ['oeufs', 'beurre']);

    // sel and poivre drop out, so eggs + butter is a full match.
    expect(score).toBeCloseTo(1);
    expect(matched).toEqual(['oeufs', 'beurre']);
    expect(missing).toEqual([]);
  });

  it('matches across accents, case and plurals', () => {
    const r = recipe('Salade', ['Tomates', 'Oignon', 'Huile']);
    const { score } = scoreRecipe(r, ['tomate', 'OIGNONS', 'huile']);
    expect(score).toBeCloseTo(1);
  });

  it('matches a multi-word stock name against a single ingredient token', () => {
    const r = recipe('Sauce', ['tomate']);
    const { matched } = scoreRecipe(r, ['Tomates cerises bio']);
    expect(matched).toEqual(['tomate']);
  });

  it('returns 0 for a recipe with no ingredients (no divide by zero)', () => {
    const r = recipe('Empty', []);
    expect(scoreRecipe(r, ['oeufs']).score).toBe(0);
  });

  it('returns 0 when the stock is empty', () => {
    const r = recipe('Omelette', ['oeufs', 'beurre']);
    expect(scoreRecipe(r, []).score).toBe(0);
  });
});

describe('rankSuggestions', () => {
  const recipes = [
    recipe('Tout', ['oeufs', 'beurre', 'lait', 'farine']), // 4/4 = 1.0
    recipe('Presque', ['oeufs', 'beurre', 'lait', 'sucre']), // 3/4 = 0.75
    recipe('Moitie', ['oeufs', 'beurre', 'chocolat', 'creme']), // 2/4 = 0.5
  ];
  const stock = ['oeufs', 'beurre', 'lait', 'farine'];

  it('keeps only recipes at or above the 0.70 threshold', () => {
    const result = rankSuggestions(recipes, stock);
    expect(result.map((s) => s.recipe.name)).toEqual(['Tout', 'Presque']);
  });

  it('sorts by score descending', () => {
    const result = rankSuggestions(recipes, stock);
    expect(result[0]?.score).toBeGreaterThan(result[1]?.score ?? 1);
  });

  it('reports the missing ingredients of each suggestion', () => {
    const result = rankSuggestions(recipes, stock);
    const presque = result.find((s) => s.recipe.name === 'Presque');
    expect(presque?.missingIngredients).toEqual(['sucre']);
  });

  it('respects a custom threshold', () => {
    const result = rankSuggestions(recipes, stock, 0.5);
    expect(result).toHaveLength(3);
  });

  it('drops recipes that use fewer stock items than minMatched', () => {
    // "Solo" is a perfect 1/1 match but only uses one item from the stock.
    const withSmall = [...recipes, recipe('Solo', ['farine'])];
    const result = rankSuggestions(withSmall, stock, 0.7, 3);
    expect(result.map((s) => s.recipe.name)).toEqual(['Tout', 'Presque']);
  });

  it('keeps the old behaviour with the default minMatched of 1', () => {
    const withSmall = [...recipes, recipe('Solo', ['farine'])];
    const result = rankSuggestions(withSmall, stock);
    expect(result.map((s) => s.recipe.name)).toContain('Solo');
  });

  it('combines both knobs: threshold first, then the min matched count', () => {
    // At 0.5 the "Moitie" recipe (2/4) gets in, but minMatched 3 kicks it out again.
    const result = rankSuggestions(recipes, stock, 0.5, 3);
    expect(result.map((s) => s.recipe.name)).toEqual(['Tout', 'Presque']);
  });

  it('breaks score ties alphabetically by name', () => {
    const tied = [recipe('Zucchini', ['oeufs', 'beurre']), recipe('Avocat', ['oeufs', 'beurre'])];
    const result = rankSuggestions(tied, ['oeufs', 'beurre']);
    expect(result.map((s) => s.recipe.name)).toEqual(['Avocat', 'Zucchini']);
  });
});
