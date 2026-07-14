// Thin re-export of the shared Trashy tokens so mobile screens import the design system
// from one local module. The actual values live in @pantryai/shared (the single source).
export { buttonLip, colors, expiry, glass, glow, radii, spacing, font } from '@pantryai/shared';
export type { ExpiryColorLevel } from '@pantryai/shared';
