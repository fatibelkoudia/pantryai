// One easing for the whole onboarding, so every animation feels like the same app.
// Fast start, gentle stop, no bounce.
const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const smooth = { duration: 0.35, ease: easeOut };
