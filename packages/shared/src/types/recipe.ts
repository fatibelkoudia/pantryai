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
