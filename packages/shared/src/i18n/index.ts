import { en } from './en.js';
import { fr } from './fr.js';

// The catalogs in the shape i18next wants them ({ lng: { translation: {...} } }).
// Both apps feed this straight into their i18next init.
export const i18nResources = {
  en: { translation: en },
  fr: { translation: fr },
} as const;

export { en, fr };
