'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { smooth } from './motion';

// Mock of the rescue moment: an item running out of days, then a recipe card
// sliding in to save it. Decorative only.
export function RescueVignette() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  return (
    <div aria-hidden className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 rounded-card border border-border bg-white px-3 py-2 shadow-sm">
        <span className="text-xl">🥬</span>
        <span className="text-sm font-bold text-charcoal">
          {t('onboarding.vignettes.rescueItem')}
        </span>
        <motion.span
          className="rounded-full bg-expiry-soon-bg px-2 py-0.5 text-xs font-bold text-expiry-soon"
          {...(reduce
            ? {}
            : {
                animate: { scale: [1, 1.05, 1] },
                transition: { duration: 1.8, repeat: Infinity },
              })}
        >
          {t('onboarding.vignettes.rescueDays')}
        </motion.span>
      </div>

      <motion.div
        className="flex items-center gap-2 rounded-card bg-mint-hero px-3 py-2"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...smooth, delay: 0.5 }}
      >
        <span className="text-xl">🍳</span>
        <span className="text-sm font-bold text-brand-deep">
          {t('onboarding.vignettes.rescueRecipe')}
        </span>
      </motion.div>
    </div>
  );
}
