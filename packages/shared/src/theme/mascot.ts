// Trashy mascot mood metadata. The mascot art itself is one PNG per mood in
// ../assets/mascot (trashy_excellent.png, trashy_good.png, trashy_okey.png,
// trashy_bad.png, trashy_awful.png). This package only ships compiled JS, so the
// apps load those PNGs themselves; here we just keep the shared labels, messages
// and accent colors so both apps describe each mood the same way.

import { colors } from './tokens.js';
import type { WasteMood, WasteTrend } from '../types/waste.js';

// Accent color (from the palette) per mood for the mood UI. Sunny Yellow is
// reserved for rewards, so it marks the middle "OKAY" mood; coral flags trouble.
// The label and message text lives in the i18n catalog (waste.moods / waste.messages)
// so both apps can show it in the user's language.
export const mascotMoodMeta: Record<WasteMood, { accent: string }> = {
  EXCELLENT: { accent: colors.leafGreen },
  GOOD: { accent: colors.leafGreen },
  OKAY: { accent: colors.sunnyYellow },
  BAD: { accent: colors.coralOrange },
  AWFUL: { accent: colors.coralOrange },
};

// Chip colors for the trend chip (last 7 days vs the rest of the window). The
// label text is in the catalog under waste.trend.
export const wasteTrendMeta: Record<WasteTrend, { fg: string; bg: string }> = {
  IMPROVING: { fg: colors.forestGreen, bg: colors.heroMint },
  STEADY: { fg: colors.textMuted, bg: colors.surfaceGray },
  WORSENING: { fg: colors.brickRed, bg: colors.redTint },
};
