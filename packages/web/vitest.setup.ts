import '@testing-library/jest-dom/vitest';
// Set up the shared i18next instance so components that call useTranslation get
// the real English strings in tests instead of raw keys.
import '@/lib/i18n';

// framer-motion asks matchMedia about prefers-reduced-motion; jsdom doesn't have it
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;
