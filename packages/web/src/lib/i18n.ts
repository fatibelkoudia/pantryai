'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { i18nResources } from '@pantryai/shared';

// One i18next instance for the whole app. We always start in English so the
// server render and the first client render agree (no hydration mismatch),
// then LocaleSync switches to the user's saved language once we know it.
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: i18nResources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false }, // react already escapes
  });
}

export { i18n };
