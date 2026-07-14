import '@testing-library/jest-dom/vitest';
// Set up the shared i18next instance so components that call useTranslation get
// the real English strings in tests instead of raw keys.
import '@/lib/i18n';
