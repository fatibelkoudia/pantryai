// Trashy mascot mood metadata. The mascot art itself is one PNG per mood in
// ../assets/mascot (trashy_excellent.png, trashy_good.png, trashy_okey.png,
// trashy_bad.png, trashy_awful.png). This package only ships compiled JS, so the
// apps load those PNGs themselves; here we just keep the shared labels, messages
// and accent colors so both apps describe each mood the same way.

import { colors } from './tokens.js';
import type { WasteMood, WasteTrend } from '../types/waste.js';

// Per-mood label + accent color (from the palette) for the mood UI. Sunny Yellow
// is reserved for rewards, so it marks the middle "OKAY" mood; coral flags trouble.
export const mascotMoodMeta: Record<WasteMood, { label: string; message: string; accent: string }> =
  {
    EXCELLENT: {
      label: 'Excellent',
      message: 'Almost nothing wasted. Trashy is thrilled!',
      accent: colors.leafGreen,
    },
    GOOD: { label: 'Good', message: 'Nice work keeping waste low.', accent: colors.leafGreen },
    OKAY: {
      label: 'Okay',
      message: 'Not bad. A little less waste and Trashy will smile.',
      accent: colors.sunnyYellow,
    },
    BAD: {
      label: 'Needs work',
      message: 'A fair bit is going to waste. You can turn this around.',
      accent: colors.coralOrange,
    },
    AWFUL: {
      label: 'Rough patch',
      message: "Lots of food wasted lately. Let's save more together.",
      accent: colors.coralOrange,
    },
  };

// Label + chip colors for the trend chip (last 7 days vs the rest of the window).
export const wasteTrendMeta: Record<WasteTrend, { label: string; fg: string; bg: string }> = {
  IMPROVING: { label: 'Improving', fg: colors.forestGreen, bg: colors.heroMint },
  STEADY: { label: 'Steady', fg: colors.textMuted, bg: colors.surfaceGray },
  WORSENING: { label: 'Getting worse', fg: colors.brickRed, bg: colors.redTint },
};

// Small line explaining the recency weighting to the user.
export const FORGIVENESS_HINT = 'Older waste counts less, Trashy forgives over time';

// Shown instead of the "use N more items" tip when the pantry state is what
// holds the score back, not the eating.
export const PANTRY_BLOCKED_HINT =
  "Eating more won't help right now, sort out the expiring items first";
