// Trashy mascot art, one expression per waste mood. These are simple code-drawn
// SVG placeholders (a happy little trash bag with a leaf) so the mood UI works on
// both web and mobile from one source; swap in final art later by replacing the
// strings here. Web renders the string inline / as a data-URI <img>; mobile renders
// it with react-native-svg's SvgXml.
//
// Each face differs only in the eyes + mouth; the body is shared. Colors come from
// the Trashy palette in ./tokens.ts.

import { colors } from './tokens.js';
import type { WasteMood } from '../types/waste.js';

// Shared bag body + leaf. The `face` argument is dropped in where the expression goes.
function trashy(face: string): string {
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img">
  <ellipse cx="60" cy="110" rx="34" ry="6" fill="${colors.charcoal}" opacity="0.08"/>
  <path d="M30 38 h60 l-5 60 a8 8 0 0 1 -8 7 H43 a8 8 0 0 1 -8 -7 Z" fill="${colors.leafGreen}"/>
  <path d="M28 34 q32 -10 64 0 l-2 8 q-30 -8 -60 0 Z" fill="${colors.charcoal}" opacity="0.85"/>
  <path d="M60 34 q4 -16 18 -18 q-2 14 -18 18 Z" fill="${colors.leafGreen}" stroke="#2f8f33" stroke-width="1.5"/>
  <g>${face}</g>
</svg>`;
}

// Faces, best mood to worst.
const FACES: Record<WasteMood, string> = {
  // wide happy eyes + big smile
  EXCELLENT: `
    <circle cx="48" cy="64" r="5" fill="#202020"/>
    <circle cx="72" cy="64" r="5" fill="#202020"/>
    <circle cx="50" cy="62" r="1.6" fill="#fff"/>
    <circle cx="74" cy="62" r="1.6" fill="#fff"/>
    <path d="M44 78 q16 16 32 0" stroke="#202020" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  // content smile
  GOOD: `
    <circle cx="48" cy="64" r="4.5" fill="#202020"/>
    <circle cx="72" cy="64" r="4.5" fill="#202020"/>
    <path d="M46 78 q14 10 28 0" stroke="#202020" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  // neutral / flat mouth
  OKAY: `
    <circle cx="48" cy="65" r="4.5" fill="#202020"/>
    <circle cx="72" cy="65" r="4.5" fill="#202020"/>
    <path d="M47 80 h26" stroke="#202020" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  // worried, slight frown + raised brows
  BAD: `
    <circle cx="48" cy="66" r="4.5" fill="#202020"/>
    <circle cx="72" cy="66" r="4.5" fill="#202020"/>
    <path d="M42 58 l10 4" stroke="#202020" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M78 58 l-10 4" stroke="#202020" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M46 82 q14 -10 28 0" stroke="#202020" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  // sad, big frown + a tear
  AWFUL: `
    <circle cx="48" cy="66" r="4.5" fill="#202020"/>
    <circle cx="72" cy="66" r="4.5" fill="#202020"/>
    <path d="M42 60 l10 3" stroke="#202020" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M78 60 l-10 3" stroke="#202020" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M44 84 q16 -14 32 0" stroke="#202020" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M48 72 q-3 6 0 9 q3 -3 0 -9 Z" fill="${colors.coralOrange}"/>`,
};

// Full SVG markup per mood.
export const MASCOT_SVG: Record<WasteMood, string> = {
  EXCELLENT: trashy(FACES.EXCELLENT),
  GOOD: trashy(FACES.GOOD),
  OKAY: trashy(FACES.OKAY),
  BAD: trashy(FACES.BAD),
  AWFUL: trashy(FACES.AWFUL),
};

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
