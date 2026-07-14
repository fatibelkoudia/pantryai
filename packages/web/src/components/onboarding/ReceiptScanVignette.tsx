'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { smooth } from './motion';

// Little mock of the scan flow: a receipt with shimmering lines, and pantry chips
// popping in next to it. Pure decoration, so it's aria-hidden.
export function ReceiptScanVignette() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const items = [
    t('onboarding.vignettes.receiptItem1'),
    t('onboarding.vignettes.receiptItem2'),
    t('onboarding.vignettes.receiptItem3'),
  ];

  return (
    <div aria-hidden className="flex items-center justify-center gap-3">
      <div className="w-28 rounded-md border border-border bg-white px-3 py-2 shadow-sm">
        <p className="text-[10px] font-bold tracking-widest text-expiry-none">
          {t('onboarding.vignettes.receiptTitle')}
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 rounded-full bg-border"
              {...(reduce
                ? {}
                : {
                    animate: { opacity: [0.35, 1, 0.35] },
                    transition: { duration: 1.8, repeat: Infinity, delay: i * 0.2 },
                  })}
            />
          ))}
        </div>
      </div>

      <span className="text-xl font-bold text-brand">›</span>

      <div className="flex flex-col items-start gap-1.5">
        {items.map((label, i) => (
          <motion.span
            key={label}
            className="rounded-full bg-mint px-2.5 py-1 text-xs font-bold text-brand-deep"
            initial={reduce ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...smooth, delay: 0.4 + i * 0.25 }}
          >
            {label}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
