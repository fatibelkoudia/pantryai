import type { StockLocation } from './stock.js';

// Languages the UI knows about. The catalogs live in src/i18n/.
export const SUPPORTED_LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

// Flag shown next to each language in the selector.
export const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇬🇧',
  fr: '🇫🇷',
};

// The per-user settings row. The API creates it with these defaults the first
// time it is read, so a fresh account always gets something back.
export interface UserSettings {
  locale: Locale;
  // a recipe must use at least this many items from the stock to be suggested
  recipeMinMatchedItems: number;
  // and the user must own at least this fraction of its ingredients (0.3 to 1)
  recipeMatchThreshold: number;
  // days before the expiration date where an item counts as "expiring soon"
  expiringSoonDays: number;
  // quantity at or below this counts as low stock for the shopping list
  lowStockThreshold: number;
  defaultStockLocation: StockLocation;
  updatedAt: string;
}

export type UpdateUserSettingsDto = Partial<Omit<UserSettings, 'updatedAt'>>;

// Bounds shared by the API validation and the steppers in both apps, so the
// clients can't even ask for a value the server would refuse.
export const SETTINGS_LIMITS = {
  recipeMinMatchedItems: { min: 1, max: 10 },
  recipeMatchThreshold: { min: 0.3, max: 1 },
  expiringSoonDays: { min: 1, max: 14 },
  lowStockThreshold: { min: 0, max: 20 },
} as const;
