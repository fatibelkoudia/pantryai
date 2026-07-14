'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import trashyGood from '../../../../shared/src/assets/mascot/trashy_good.png';
import { GlassCard } from './GlassCard';
import { StepProgress } from './StepProgress';
import { smooth } from './motion';

interface StepShellProps {
  stepIndex: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  onContinue: () => void;
  onSkip: () => void;
  loading?: boolean;
  error?: string | null;
}

// Shared chrome for a web onboarding step: progress bar, a small Trashy next to the
// heading, the step's own content staggering in, then Continue + "skip this step".
export function StepShell({
  stepIndex,
  totalSteps,
  title,
  subtitle,
  children,
  onContinue,
  onSkip,
  loading = false,
  error,
}: StepShellProps) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const item = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 8 },
    show: reduce ? { opacity: 1 } : { opacity: 1, y: 0, transition: smooth },
  };

  return (
    <GlassCard className="w-full p-6 sm:p-8">
      <motion.div
        className="flex w-full flex-col gap-4"
        variants={{ show: { transition: { staggerChildren: 0.06 } } }}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={item}>
          <StepProgress stepIndex={stepIndex} totalSteps={totalSteps} />
        </motion.div>
        <motion.div variants={item} className="flex items-center gap-3">
          <Image src={trashyGood} alt="" width={48} height={48} />
          <h2 className="text-2xl font-extrabold text-brand-deep">{title}</h2>
        </motion.div>
        <motion.p variants={item} className="text-sm text-expiry-none">
          {subtitle}
        </motion.p>
        <motion.div variants={item} className="flex flex-col gap-3">
          {children}
        </motion.div>
        {error ? (
          <p
            role="alert"
            className="rounded-md bg-expiry-urgent-bg px-3 py-2 text-sm font-semibold text-expiry-urgent"
          >
            {error}
          </p>
        ) : null}
        <motion.div variants={item} className="mt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={onContinue}
            disabled={loading}
            className="rounded-full bg-brand-deep px-4 py-2.5 font-bold text-brand-fg shadow-btn-lip-glow transition hover:brightness-110 active:translate-y-0.5 active:shadow-btn-lip disabled:opacity-60"
          >
            {loading ? t('common.saving') : t('onboarding.continue')}
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={loading}
            className="rounded-full px-4 py-2 font-bold text-brand-deep hover:underline disabled:opacity-60"
          >
            {t('onboarding.skipStep')}
          </button>
        </motion.div>
      </motion.div>
    </GlassCard>
  );
}
