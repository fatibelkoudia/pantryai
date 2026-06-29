import Image, { type StaticImageData } from 'next/image';
import { getAvatarPreset } from '@pantryai/shared';
import active from '../../../shared/src/assets/avatars/active.png';
import artist from '../../../shared/src/assets/avatars/artist.png';
import beachClean from '../../../shared/src/assets/avatars/beach_clean.png';
import bookworm from '../../../shared/src/assets/avatars/bookworm.png';
import chef from '../../../shared/src/assets/avatars/chef.png';
import classic from '../../../shared/src/assets/avatars/classic.png';
import communityHero from '../../../shared/src/assets/avatars/community_hero.png';
import explorer from '../../../shared/src/assets/avatars/explorer.png';
import forestRanger from '../../../shared/src/assets/avatars/forest_ranger.png';
import gamer from '../../../shared/src/assets/avatars/gamer.png';
import gardner from '../../../shared/src/assets/avatars/gardner.png';
import moods from '../../../shared/src/assets/avatars/moods.png';
import musician from '../../../shared/src/assets/avatars/musician.png';
import scientist from '../../../shared/src/assets/avatars/scientist.png';
import sleepy from '../../../shared/src/assets/avatars/sleepy.png';
import superEco from '../../../shared/src/assets/avatars/super_eco.png';
import techSavvy from '../../../shared/src/assets/avatars/tech_savvy.png';
import tinyCon from '../../../shared/src/assets/avatars/tiny_con.png';
import traveller from '../../../shared/src/assets/avatars/traveller.png';
import yogi from '../../../shared/src/assets/avatars/yogi.png';

// One PNG per avatar, shipped in the shared package. Keyed by the preset id.
const AVATAR_IMAGES: Record<string, StaticImageData> = {
  classic,
  chef,
  gardner,
  super_eco: superEco,
  yogi,
  artist,
  musician,
  scientist,
  bookworm,
  gamer,
  tech_savvy: techSavvy,
  active,
  explorer,
  traveller,
  forest_ranger: forestRanger,
  beach_clean: beachClean,
  community_hero: communityHero,
  tiny_con: tinyCon,
  moods,
  sleepy,
};

interface AvatarImageProps {
  id: string | null | undefined;
  size: number;
  className?: string;
}

// Renders the avatar art for a preset id. Falls back to the default avatar when
// the id is unknown or missing, same as getAvatarPreset.
export function AvatarImage({ id, size, className }: AvatarImageProps) {
  const preset = getAvatarPreset(id);
  const src = AVATAR_IMAGES[preset.id] ?? classic;
  return (
    <Image
      src={src}
      alt={preset.name}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'cover', borderRadius: '50%' }}
    />
  );
}
