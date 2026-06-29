import { getAvatarPreset } from '@pantryai/shared';
import { Image, type ImageSourcePropType, type StyleProp, type ImageStyle } from 'react-native';

// One PNG per avatar in the shared package. Metro needs the requires to be
// static, so we list them all out. Keyed by the preset id (the file name).
const AVATAR_IMAGES: Record<string, ImageSourcePropType> = {
  classic: require('../../../shared/src/assets/avatars/classic.png'),
  chef: require('../../../shared/src/assets/avatars/chef.png'),
  gardner: require('../../../shared/src/assets/avatars/gardner.png'),
  super_eco: require('../../../shared/src/assets/avatars/super_eco.png'),
  yogi: require('../../../shared/src/assets/avatars/yogi.png'),
  artist: require('../../../shared/src/assets/avatars/artist.png'),
  musician: require('../../../shared/src/assets/avatars/musician.png'),
  scientist: require('../../../shared/src/assets/avatars/scientist.png'),
  bookworm: require('../../../shared/src/assets/avatars/bookworm.png'),
  gamer: require('../../../shared/src/assets/avatars/gamer.png'),
  tech_savvy: require('../../../shared/src/assets/avatars/tech_savvy.png'),
  active: require('../../../shared/src/assets/avatars/active.png'),
  explorer: require('../../../shared/src/assets/avatars/explorer.png'),
  traveller: require('../../../shared/src/assets/avatars/traveller.png'),
  forest_ranger: require('../../../shared/src/assets/avatars/forest_ranger.png'),
  beach_clean: require('../../../shared/src/assets/avatars/beach_clean.png'),
  community_hero: require('../../../shared/src/assets/avatars/community_hero.png'),
  tiny_con: require('../../../shared/src/assets/avatars/tiny_con.png'),
  moods: require('../../../shared/src/assets/avatars/moods.png'),
  sleepy: require('../../../shared/src/assets/avatars/sleepy.png'),
};

interface AvatarImageProps {
  id: string | null | undefined;
  size: number;
  style?: StyleProp<ImageStyle>;
}

// Renders the avatar art for a preset id. Falls back to the default avatar when
// the id is unknown or missing, same as getAvatarPreset.
export function AvatarImage({ id, size, style }: AvatarImageProps) {
  const preset = getAvatarPreset(id);
  const source = AVATAR_IMAGES[preset.id] ?? AVATAR_IMAGES.classic;
  return (
    <Image
      source={source}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      resizeMode="cover"
    />
  );
}
