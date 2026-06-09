// Trashy design tokens. This is the one place we keep colors, type, radii and spacing.
// Both apps read from here: mobile imports these values directly, and the web Tailwind
// @theme block in packages/web/src/app/globals.css mirrors the same hex values (Tailwind
// can't import TS, so if you change a hex here, change it there too).
//
// Palette comes from help/UX.md (the "Trashy" brand) plus the Stitch mockups, which
// added the deeper greens, the warm cream background and the urgency tints.

// Raw brand colors. These are the named swatches from the brand doc + the mockups.
export const colors = {
  leafGreen: '#4CAF50', // brand green: active tabs/segments, success, Trashy's leaf
  forestGreen: '#006E1C', // deep green: screen titles, primary buttons, links
  paleGreen: '#94F990', // light green fill: icon boxes, "Safe" badges
  heroMint: '#E8F7E0', // tinted card background (daily tip / mission cards)
  softMint: '#EBF7ED', // soft green tint for small boxes and highlights
  warmCream: '#FFF8EE', // app background, cozy kitchen feel
  sunnyYellow: '#FFD166', // rewards / gamification accents and mid-urgency tints
  paleYellow: '#FFDF9B', // soft yellow card background (badges, achievements)
  amberText: '#765900', // readable text on Sunny Yellow tints
  coralOrange: '#FF7A59', // soft warnings and alert accents
  brickRed: '#AE3115', // urgent actions: "Use today", "Toss it"
  redTint: '#FFDAD2', // soft red card/badge background
  redText: '#8C1900', // readable text on redTint
  charcoal: '#202020', // primary text and Trashy's body
  warmGray: '#F2F2F2', // neutral surfaces
  creamSurface: '#F6F3F2', // inputs and segmented tracks on the cream background
  surfaceGray: '#EAE7E7', // quiet buttons and chips

  // handy extras used around the UI
  white: '#FFFFFF',
  onBrand: '#FFFFFF', // text/icon color that sits on top of the greens
  textMuted: '#5B6660', // softened charcoal for secondary text (AA on white/cream)
  border: '#D9E6DC', // gentle green-tinted hairline for cards
} as const;

// Expiration badge colors, following the mockups: green when safe, yellow when the
// date is getting close, red when it's tomorrow or already gone.
export const expiry = {
  ok: { bg: '#94F990', fg: '#005313' },
  soon: { bg: '#FFD166', fg: '#765900' },
  urgent: { bg: '#FFDAD2', fg: '#8C1900' },
  expired: { bg: '#FFDAD6', fg: '#93000A' },
  none: { bg: '#EAE7E7', fg: '#5B6660' },
} as const;

// The "3D-lite" button lip from the design doc: a slightly darker bottom edge so
// solid buttons look pressable instead of flat. Spread into RN button styles;
// the web mirrors it with `box-shadow: 0 3px 0 rgb(0 0 0 / 0.15)`.
export const buttonLip = {
  borderBottomWidth: 3,
  borderBottomColor: 'rgba(0, 0, 0, 0.15)',
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
