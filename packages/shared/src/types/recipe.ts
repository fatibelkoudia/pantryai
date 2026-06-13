export interface Recipe {
  id: string;
  externalId?: string;
  name: string;
  category?: string;
  instructions?: string;
  imageUrl?: string;
  ingredients: RecipeIngredient[];
}

export interface RecipeIngredient {
  name: string;
  measure: string;
}

export interface RecipeSuggestion {
  recipe: Recipe;
  /** Fraction of the recipe's ingredients the user already has, 0..1. */
  score: number;
  /** Recipe ingredients matched against the user's stock. */
  matchedIngredients: string[];
  /** Recipe ingredients the user still needs to buy. */
  missingIngredients: string[];
}

export interface RecipeSuggestionsResponse {
  suggestions: RecipeSuggestion[];
}
