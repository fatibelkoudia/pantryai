import { i18nResources } from '@pantryai/shared';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Start from the phone's language when we support it, English otherwise.
// Once the user's settings are loaded, LocaleSync switches to their saved pick.
const deviceLanguage = getLocales()[0]?.languageCode ?? 'en';

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: i18nResources,
    lng: deviceLanguage in i18nResources ? deviceLanguage : 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false }, // react already escapes
  });
}

export { i18n };
