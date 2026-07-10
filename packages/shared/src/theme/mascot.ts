// Trashy mascot mood metadata. The mascot art itself is one PNG per mood in
// ../assets/mascot (trashy_excellent.png, trashy_good.png, trashy_okey.png,
// trashy_bad.png, trashy_awful.png). This package only ships compiled JS, so the
// apps load those PNGs themselves; here we just keep the shared labels, messages
// and accent colors so both apps describe each mood the same way.

import { colors } from './tokens.js';
import type { WasteMood } from '../types/waste.js';

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
