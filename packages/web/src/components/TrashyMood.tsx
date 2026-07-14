'use client';

import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { mascotMoodMeta, type WasteMood } from '@pantryai/shared';
import trashyAwful from '../../../shared/src/assets/mascot/trashy_awful.png';
import trashyBad from '../../../shared/src/assets/mascot/trashy_bad.png';
import trashyExcellent from '../../../shared/src/assets/mascot/trashy_excellent.png';
import trashyGood from '../../../shared/src/assets/mascot/trashy_good.png';
import trashyOkay from '../../../shared/src/assets/mascot/trashy_okey.png';

// The mascot art is one PNG per mood, shipped in the shared package.
const MASCOT_IMAGES = {
  EXCELLENT: trashyExcellent,
  GOOD: trashyGood,
  OKAY: trashyOkay,
  BAD: trashyBad,
  AWFUL: trashyAwful,
} satisfies Record<WasteMood, typeof trashyGood>;

interface TrashyMoodProps {
  mood: WasteMood;
  size?: number;
}

// Renders the Trashy mascot for a given mood.
export function TrashyMood({ mood, size = 120 }: TrashyMoodProps) {
  const { t } = useTranslation();
  const meta = mascotMoodMeta[mood];
  const label = t(`waste.moods.${mood}`);
  return (
    <div className="flex flex-col items-center gap-1">
      <Image
        src={MASCOT_IMAGES[mood]}
        alt={t('mascot.looks', { mood: label.toLowerCase() })}
        width={size}
        height={size}
        style={{ objectFit: 'contain' }}
      />
      <span className="text-sm font-bold" style={{ color: meta.accent }}>
        {label}
      </span>
    </div>
  );
}
