'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { smooth } from './motion';

// Mock of the gamification bits: streak, level and an XP bar filling up.
// Decorative only.
export function PlayVignette() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  return (
    <div aria-hidden className="flex w-full max-w-60 flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-mint px-2.5 py-1 text-xs font-bold text-brand-deep">
          🔥 {t('onboarding.vignettes.playStreak')}
        </span>
        <span className="rounded-full bg-sunny-pale px-2.5 py-1 text-xs font-bold text-expiry-soon">
          {t('onboarding.vignettes.playLevel')}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-brand-deep/10">
        <motion.div
          className="h-full rounded-full bg-linear-to-r from-brand to-brand-deep"
          initial={reduce ? false : { width: '20%' }}
          animate={{ width: '80%' }}
          transition={reduce ? { duration: 0 } : { ...smooth, duration: 0.6, delay: 0.4 }}
        />
      </div>

      <motion.span
        className="text-xs font-bold text-brand"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...smooth, delay: 0.8 }}
      >
        {t('onboarding.vignettes.playXp')}
      </motion.span>
    </div>
  );
}
