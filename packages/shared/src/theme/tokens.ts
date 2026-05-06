// Trashy design tokens. This is the one place we keep colors, type, radii and spacing.
// Both apps read from here: mobile imports these values directly, and the web Tailwind
// @theme block in packages/web/src/app/globals.css mirrors the same hex values (Tailwind
// can't import TS, so if you change a hex here, change it there too).
//
// Palette comes from help/UX.md (the "Trashy" brand). Don't reintroduce the old ad-hoc green.

// Raw brand colors. These are the named swatches from the brand doc.
export const colors = {
  leafGreen: '#4CAF50', // primary brand: buttons, success, links, Trashy's leaf
  softMint: '#EBF7ED', // app background, keeps things feeling fresh
  sunnyYellow: '#FFD166', // rewards / gamification accents only (not expiry)
  coralOrange: '#FF7A59', // warnings: expiring items and alerts
  charcoal: '#202020', // primary text and Trashy's body
  warmGray: '#F2F2F2', // cards, containers, neutral surfaces

  // handy extras used around the UI
  white: '#FFFFFF',
  onBrand: '#FFFFFF', // text/icon color that sits on top of leafGreen
  textMuted: '#5B6660', // softened charcoal for secondary text (AA on white/mint)
  border: '#D9E6DC', // gentle green-tinted hairline for cards over mint
} as const;

// Expiration badge colors. Each level is a tinted background with a text color that
// stays AA-readable on that tint. soon/expired lean on Coral Orange / red, ok on Leaf Green.
export const expiry = {
  ok: { bg: '#E6F4EA', fg: '#1F7A34' },
  soon: { bg: '#FFEDE6', fg: '#B23B17' },
  expired: { bg: '#FDE7E7', fg: '#B0201F' },
  none: { bg: '#F2F2F2', fg: '#5B6660' },
} as const;

// Corner radii. Trashy is a soft, rounded, card-based look.
export const radii = {
  sm: 8,
  card: 16,
  lg: 20,
  pill: 999,
} as const;

// Spacing scale (in px / RN units).
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

// Font family names. The web loads "Nunito" via next/font; mobile loads the matching
// @expo-google-fonts/nunito weights, whose family names are the *_Weight strings below.
export const font = {
  family: 'Nunito', // base / web
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  black: 'Nunito_800ExtraBold',
} as const;

export type ExpiryColorLevel = keyof typeof expiry;
