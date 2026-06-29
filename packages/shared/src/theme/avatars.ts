import { colors } from './tokens.js';

// Preset avatars for the profile page. We don't do photo uploads (no storage
// for them, and one less RGPD thing to worry about), the user just picks one
// of these and we store its id on their account.
//
// Every avatar is Trashy the mascot in a different outfit. The art is one PNG
// per avatar in ../assets/avatars (the id is the file name without .png). This
// package only ships compiled JS, so the apps load the PNGs themselves; here we
// just keep the id, a cute display name and a soft tile color so both apps show
// each one the same way.
export interface AvatarPreset {
  id: string;
  name: string;
  bg: string;
}

// A few soft tints from the palette to give the picker some variety. The art
// mostly fills its tile, so this shows as a gentle halo behind each avatar.
const tints = [
  colors.softMint,
  colors.heroMint,
  colors.paleYellow,
  colors.redTint,
  colors.warmGray,
  colors.creamSurface,
];

// The plain Trashy everybody starts with, also the fallback for an unknown id.
export const defaultAvatarPreset: AvatarPreset = {
  id: 'classic',
  name: 'Classic',
  bg: colors.softMint,
};

// name only, the bg gets filled in below so we don't repeat the tint list.
const presets: Array<Omit<AvatarPreset, 'bg'>> = [
  { id: 'classic', name: 'Classic' },
  { id: 'chef', name: 'Chef' },
  { id: 'gardner', name: 'Gardener' },
  { id: 'super_eco', name: 'Super Eco' },
  { id: 'yogi', name: 'Yogi' },
  { id: 'artist', name: 'Artist' },
  { id: 'musician', name: 'Musician' },
  { id: 'scientist', name: 'Scientist' },
  { id: 'bookworm', name: 'Bookworm' },
  { id: 'gamer', name: 'Gamer' },
  { id: 'tech_savvy', name: 'Techie' },
  { id: 'active', name: 'Sporty' },
  { id: 'explorer', name: 'Explorer' },
  { id: 'traveller', name: 'Traveller' },
  { id: 'forest_ranger', name: 'Ranger' },
  { id: 'beach_clean', name: 'Beach Buddy' },
  { id: 'community_hero', name: 'Hero' },
  { id: 'tiny_con', name: 'Royal' },
  { id: 'moods', name: 'Cheerful' },
  { id: 'sleepy', name: 'Sleepy' },
];

export const avatarPresets: AvatarPreset[] = presets.map((preset, i) => ({
  ...preset,
  bg: tints[i % tints.length] ?? colors.softMint,
}));

export const DEFAULT_AVATAR_ID = defaultAvatarPreset.id;

// Look up a preset by id, falling back to the default one so an unknown or
// missing id never breaks the UI.
export function getAvatarPreset(id: string | null | undefined): AvatarPreset {
  return avatarPresets.find((preset) => preset.id === id) ?? defaultAvatarPreset;
}
