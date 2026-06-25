'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import trashyExcellent from '../../../../shared/src/assets/mascot/trashy_excellent.png';
import { ConfettiBurst } from './ConfettiBurst';
import { GlassCard } from './GlassCard';
import { smooth } from './motion';

// The finale: confetti, a very happy Trashy, and the door into the app.
export function WelcomeDone({ onFinish }: { onFinish: () => void }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  return (
    <GlassCard className="relative w-full p-6 sm:p-8">
      <ConfettiBurst />
      <div className="flex flex-col items-center gap-4 text-center">
        <motion.div
          initial={reduce ? false : { scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={smooth}
        >
          <Image src={trashyExcellent} alt="" width={180} height={180} priority />
        </motion.div>
        <h2 className="text-2xl font-extrabold text-brand-deep">{t('onboarding.done.title')}</h2>
        <p className="text-base leading-relaxed text-expiry-none">{t('onboarding.done.body')}</p>
        <button
          type="button"
          onClick={onFinish}
          className="w-full rounded-full bg-brand-deep px-4 py-2.5 font-bold text-brand-fg shadow-btn-lip-glow transition hover:brightness-110 active:translate-y-0.5 active:shadow-btn-lip"
        >
          {t('onboarding.done.cta')}
        </button>
      </div>
    </GlassCard>
  );
}
