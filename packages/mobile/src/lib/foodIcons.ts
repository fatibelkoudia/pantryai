import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

// Rough icon guess from the product category so the rows aren't all the same glyph.
export function categoryIcon(category?: string): IoniconName {
  const c = (category ?? '').toLowerCase();
  if (c.includes('fruit')) return 'nutrition-outline';
  if (c.includes('veg') || c.includes('salad') || c.includes('herb')) return 'leaf-outline';
  if (
    c.includes('dairy') ||
    c.includes('milk') ||
    c.includes('cheese') ||
    c.includes('yogurt') ||
    c.includes('egg')
  ) {
    return 'egg-outline';
  }
  if (c.includes('meat') || c.includes('fish') || c.includes('seafood')) return 'fish-outline';
  if (c.includes('drink') || c.includes('juice') || c.includes('beverage')) return 'cafe-outline';
  return 'restaurant-outline';
}
