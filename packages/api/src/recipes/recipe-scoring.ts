import type { Recipe, RecipeSuggestion } from '@pantryai/shared';

// Default threshold: a recipe is only suggested if the user already has at least
// this fraction of its ingredients. The dossier asks for 70%, and since the
// profile page landed the user can move it in their settings.
export const DEFAULT_SCORE_THRESHOLD = 0.7;

// Default for the other settings knob: a recipe must use at least this many
// items the user actually has. 1 keeps the old behaviour (any match is enough).
export const DEFAULT_MIN_MATCHED_ITEMS = 1;

// Little connector words inside an ingredient name ("huile d olive", "sauce de
// soja"). They carry no meaning on their own so we drop them before matching.
const CONNECTOR_TOKENS = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'au', 'aux', 'et']);

// Ingredients everybody is assumed to have. If a recipe only needs these, we don't
// hold them against it (a user with eggs and butter should still get "omelette",
// even though the recipe also lists salt and pepper).
const PANTRY_STAPLES = new Set(['sel', 'poivre', 'eau']);

// Lowercase, drop accents, strip anything that isn't a letter/number/space, and
// squeeze the spaces. So "Tomates cerises" and "tomate" both come out comparable.
export function normalizeIngredient(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Pull out the "meaningful" tokens of an ingredient name. Single letters and
// connector words are dropped, and a trailing "s" is chopped so plurals match
// singulars (tomates -> tomate).
function tokenize(name: string): string[] {
  return normalizeIngredient(name)
    .split(' ')
    .filter((token) => token.length > 1 && !CONNECTOR_TOKENS.has(token))
    .map((token) => (token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token));
}

// An ingredient that is nothing but pantry staples (salt, pepper, water). We leave
// these out of scoring entirely.
function isPantryStaple(name: string): boolean {
  const tokens = tokenize(name);
  return tokens.length > 0 && tokens.every((token) => PANTRY_STAPLES.has(token));
}

// True if any meaningful token of the recipe ingredient also appears in the stock
// item (or the other way round). Just plain word matching, no AI guessing, so the
// same stock always gives the same answer.
function ingredientInStock(ingredient: string, stockTokenSets: Set<string>[]): boolean {
  const tokens = tokenize(ingredient);
  if (tokens.length === 0) return false;
  return stockTokenSets.some((stockTokens) => tokens.some((token) => stockTokens.has(token)));
}

export interface RecipeScore {
  score: number;
  matched: string[];
  missing: string[];
}

// Score = how many of the recipe's ingredients you already have / how many it needs.
// A recipe with no ingredients scores 0 (nothing to cook, and avoids dividing by zero).
export function scoreRecipe(recipe: Recipe, stockNames: string[]): RecipeScore {
  const stockTokenSets = stockNames.map((name) => new Set(tokenize(name)));

  const matched: string[] = [];
  const missing: string[] = [];

  for (const ingredient of recipe.ingredients) {
    // Salt/pepper/water don't count for or against the recipe.
    if (isPantryStaple(ingredient.name)) continue;

    if (ingredientInStock(ingredient.name, stockTokenSets)) {
      matched.push(ingredient.name);
    } else {
      missing.push(ingredient.name);
    }
  }

  const required = matched.length + missing.length;
  const score = required === 0 ? 0 : matched.length / required;

  return { score, matched, missing };
}

// Score every recipe, keep the ones at or above the threshold that also use at
// least `minMatched` items from the stock, and sort best first (ties broken
// alphabetically so the order is stable).
export function rankSuggestions(
  recipes: Recipe[],
  stockNames: string[],
  threshold: number = DEFAULT_SCORE_THRESHOLD,
  minMatched: number = DEFAULT_MIN_MATCHED_ITEMS,
): RecipeSuggestion[] {
  return recipes
    .map((recipe) => {
      const { score, matched, missing } = scoreRecipe(recipe, stockNames);
      return {
        recipe,
        score,
        matchedIngredients: matched,
        missingIngredients: missing,
      };
    })
    .filter(
      (suggestion) =>
        suggestion.score >= threshold && suggestion.matchedIngredients.length >= minMatched,
    )
    .sort((a, b) => b.score - a.score || a.recipe.name.localeCompare(b.recipe.name));
}
