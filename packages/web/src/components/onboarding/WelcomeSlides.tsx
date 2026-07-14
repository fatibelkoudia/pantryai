'use client';

import Image from 'next/image';
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { WasteMood } from '@pantryai/shared';
import trashyBad from '../../../../shared/src/assets/mascot/trashy_bad.png';
import trashyExcellent from '../../../../shared/src/assets/mascot/trashy_excellent.png';
import trashyGood from '../../../../shared/src/assets/mascot/trashy_good.png';
import trashyOkay from '../../../../shared/src/assets/mascot/trashy_okey.png';
import { CountUp } from './CountUp';
import { GlassCard } from './GlassCard';
import { PlayVignette } from './PlayVignette';
import { ReceiptScanVignette } from './ReceiptScanVignette';
import { RescueVignette } from './RescueVignette';
import { smooth } from './motion';

const MASCOTS = {
  BAD: trashyBad,
  OKAY: trashyOkay,
  GOOD: trashyGood,
  EXCELLENT: trashyExcellent,
} satisfies Partial<Record<WasteMood, typeof trashyGood>>;

// ADEME's figure for food thrown away at home in France, per person per year.
const WASTE_KG_PER_YEAR = 30;

interface WelcomeSlidesProps {
  onDone: () => void;
  // lets the page tint the aurora coral while the "we waste food" slide is up
  onIndexChange?: (index: number) => void;
}

// The intro story, in four slides: the problem, then scan, rescue and play.
// Trashy's mood follows along, sad at the start and thrilled by the end.
export function WelcomeSlides({ onDone, onIndexChange }: WelcomeSlidesProps) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  const slides = [
    {
      mood: 'BAD' as const,
      title: t('onboarding.slides.hookTitle'),
      body: t('onboarding.slides.hookBody'),
      vignette: (
        <div className="flex flex-col items-center gap-1">
          <CountUp
            to={WASTE_KG_PER_YEAR}
            suffix={t('onboarding.slides.hookStatSuffix')}
            className="text-5xl font-extrabold text-coral"
          />
          <p className="max-w-64 text-sm font-semibold text-expiry-none">
            {t('onboarding.slides.hookStatLabel')}
          </p>
        </div>
      ),
    },
    {
      mood: 'OKAY' as const,
      title: t('onboarding.slides.scanTitle'),
      body: t('onboarding.slides.scanBody'),
      vignette: <ReceiptScanVignette />,
    },
    {
      mood: 'GOOD' as const,
      title: t('onboarding.slides.rescueTitle'),
      body: t('onboarding.slides.rescueBody'),
      vignette: <RescueVignette />,
    },
    {
      mood: 'EXCELLENT' as const,
      title: t('onboarding.slides.playTitle'),
      body: t('onboarding.slides.playBody'),
      vignette: <PlayVignette />,
    },
  ];
  const slide = slides[index] ?? slides[0]!;
  const isLast = index === slides.length - 1;

  function go(next: number) {
    setIndex(next);
    onIndexChange?.(next);
  }

  return (
    <GlassCard className="w-full p-6 sm:p-8">
      <div className="flex w-full flex-col items-center gap-5 text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            className="flex w-full flex-col items-center gap-4"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
            transition={smooth}
          >
            <motion.div
              initial={reduce ? false : { scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={smooth}
            >
              <Image src={MASCOTS[slide.mood]} alt="" width={150} height={150} priority />
            </motion.div>
            {slide.vignette}
            <h2 className="text-2xl font-extrabold text-brand-deep">{slide.title}</h2>
            <p className="text-base leading-relaxed text-expiry-none">{slide.body}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              aria-current={i === index}
              onClick={() => go(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-5 bg-brand shadow-glow-brand' : 'w-2 bg-border'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => (isLast ? onDone() : go(index + 1))}
          className="w-full rounded-full bg-brand-deep px-4 py-2.5 font-bold text-brand-fg shadow-btn-lip-glow transition hover:brightness-110 active:translate-y-0.5 active:shadow-btn-lip"
        >
          {isLast ? t('onboarding.getStarted') : t('onboarding.continue')}
        </button>
      </div>
    </GlassCard>
  );
}
