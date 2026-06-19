'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WasteMood } from '@pantryai/shared';
import trashyExcellent from '../../../../shared/src/assets/mascot/trashy_excellent.png';
import trashyGood from '../../../../shared/src/assets/mascot/trashy_good.png';
import trashyOkay from '../../../../shared/src/assets/mascot/trashy_okey.png';

const MASCOTS = {
  GOOD: trashyGood,
  OKAY: trashyOkay,
  EXCELLENT: trashyExcellent,
} satisfies Partial<Record<WasteMood, typeof trashyGood>>;

// The 3 intro slides, driven by state (Prev/Next + dots) so we don't need a
// carousel library.
export function WelcomeSlides({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  const slides = [
    {
      mood: 'GOOD' as const,
      title: t('onboarding.slides.scanTitle'),
      body: t('onboarding.slides.scanBody'),
    },
    {
      mood: 'OKAY' as const,
      title: t('onboarding.slides.trackTitle'),
      body: t('onboarding.slides.trackBody'),
    },
    {
      mood: 'EXCELLENT' as const,
      title: t('onboarding.slides.cookTitle'),
      body: t('onboarding.slides.cookBody'),
    },
  ];
  const slide = slides[index] ?? slides[0]!;
  const isLast = index === slides.length - 1;

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
      <Image src={MASCOTS[slide.mood]} alt="" width={200} height={200} priority />
      <h2 className="text-2xl font-extrabold text-brand-deep">{slide.title}</h2>
      <p className="text-base leading-relaxed text-expiry-none">{slide.body}</p>

      <div className="flex items-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Slide ${i + 1}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className={`h-2 rounded-full transition-all ${
              i === index ? 'w-5 bg-brand' : 'w-2 bg-border'
            }`}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => (isLast ? onDone() : setIndex((i) => i + 1))}
        className="w-full rounded-full bg-brand-deep px-4 py-2.5 font-bold text-brand-fg shadow-btn-lip"
      >
        {isLast ? t('onboarding.getStarted') : t('onboarding.continue')}
      </button>
    </div>
  );
}
