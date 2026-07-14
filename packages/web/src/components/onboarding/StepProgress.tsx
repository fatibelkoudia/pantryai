'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { smooth } from './motion';

interface StepProgressProps {
  stepIndex: number;
  totalSteps: number;
}

// The setup progress bar. The fill eases to the new width on every step, and the
// old "Step X of Y" text lives on as the accessible label.
export function StepProgress({ stepIndex, totalSteps }: StepProgressProps) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const step = stepIndex + 1;

  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-valuenow={step}
      aria-label={t('onboarding.stepOf', { step, total: totalSteps })}
      className="h-1.5 w-full rounded-full bg-brand-deep/10"
    >
      <motion.div
        className="h-full rounded-full bg-linear-to-r from-brand to-brand-deep shadow-glow-brand"
        initial={false}
        animate={{ width: `${(step / totalSteps) * 100}%` }}
        transition={reduce ? { duration: 0 } : { ...smooth, duration: 0.45 }}
      />
    </div>
  );
}
