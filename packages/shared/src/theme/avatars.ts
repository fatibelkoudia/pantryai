import { colors } from './tokens.js';

// Preset avatars for the profile page. We don't do photo uploads (no storage
// for them, and one less RGPD thing to worry about), the user just picks one
// of these and we store its id on their account.
export interface AvatarPreset {
  id: string;
  emoji: string;
  bg: string;
}

// The one everybody starts with, also used as the fallback when an id is unknown.
export const defaultAvatarPreset: AvatarPreset = {
  id: 'sprout',
  emoji: '🌱',
  bg: colors.paleGreen,
};

export const avatarPresets: AvatarPreset[] = [
  defaultAvatarPreset,
  { id: 'tomato', emoji: '🍅', bg: colors.redTint },
  { id: 'avocado', emoji: '🥑', bg: colors.heroMint },
  { id: 'lemon', emoji: '🍋', bg: colors.paleYellow },
  { id: 'broccoli', emoji: '🥦', bg: colors.softMint },
  { id: 'strawberry', emoji: '🍓', bg: colors.redTint },
  { id: 'chef', emoji: '👩‍🍳', bg: colors.warmGray },
  { id: 'basket', emoji: '🧺', bg: colors.paleYellow },
];

export const DEFAULT_AVATAR_ID = defaultAvatarPreset.id;

// Look up a preset by id, falling back to the default one so an unknown or
// missing id never breaks the UI.
export function getAvatarPreset(id: string | null | undefined): AvatarPreset {
  return avatarPresets.find((preset) => preset.id === id) ?? defaultAvatarPreset;
}
