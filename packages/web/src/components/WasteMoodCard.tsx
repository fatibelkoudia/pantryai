'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  colors,
  mascotMoodMeta,
  wasteMoodBands,
  wasteTrendMeta,
  type WasteMood,
  type WasteTrend,
} from '@pantryai/shared';
import { apiClient } from '@/lib/api';
import { TrashyMood } from './TrashyMood';
import { WasteDetailDialog, type WasteDetailType } from './WasteDetailDialog';
import { WasteGauge } from './WasteGauge';
import { WasteHistory } from './WasteHistory';

// Small arrow glyph for each trend direction.
const TREND_GLYPHS: Record<WasteTrend, string> = {
  IMPROVING: '↗',
  STEADY: '→',
  WORSENING: '↘',
};

// How far the score has climbed inside its current mood band, 0 to 1.
function bandProgress(score: number, mood: WasteMood): number {
  const index = wasteMoodBands.findIndex((band) => band.mood === mood);
  if (index === -1) return 0;
  const floor = wasteMoodBands[index]?.min ?? 0;
  const ceil = index === 0 ? 100 : (wasteMoodBands[index - 1]?.min ?? 100);
  if (ceil === floor) return 1;
  return Math.min(1, Math.max(0, (score - floor) / (ceil - floor)));
}

// Trashy's mood card: the mascot + the Waste Level gauge over the trailing 30 days.
export function WasteMoodCard() {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<WasteDetailType | null>(null);

  const waste = useQuery({
    queryKey: ['waste'],
    queryFn: () => apiClient.getWasteLevel(),
  });

  if (waste.isLoading) {
    return (
      <section className="rounded-card border border-border bg-surface-card p-5" aria-busy="true">
        <p role="status" className="text-slate-500">
          {t('waste.checking')}
        </p>
      </section>
    );
  }

  if (waste.isError || !waste.data) {
    return null;
  }

  const {
    score,
    mood,
    counts,
    co2AvoidedKg,
    nextMood,
    itemsToNextMood,
    pantryBlocked,
    rescuedCount,
    trend,
    weeklyScores,
  } = waste.data;
  const meta = mascotMoodMeta[mood];
  const trendMeta = trend ? wasteTrendMeta[trend] : null;
  const countBtn = 'underline decoration-dotted underline-offset-2 hover:text-slate-700';

  return (
    <section className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface-card p-5 sm:flex-row sm:items-center sm:gap-6">
      <TrashyMood mood={mood} />
      <div className="flex flex-1 flex-col items-center gap-2 sm:items-start">
        {trend && trendMeta ? (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-bold"
            style={{ background: trendMeta.bg, color: trendMeta.fg }}
          >
            {TREND_GLYPHS[trend]} {t(`waste.trend.${trend}`)}
          </span>
        ) : null}
        <WasteGauge score={score} accent={meta.accent} />
        <p className="text-center text-sm text-slate-600 sm:text-left">
          {t(`waste.messages.${mood}`)}
        </p>
        {nextMood !== null ? (
          <div className="flex w-full max-w-xs flex-col gap-1">
            {pantryBlocked || itemsToNextMood === null ? (
              <p className="text-center text-xs text-slate-600 sm:text-left">
                {t('waste.pantryBlockedHint')}
              </p>
            ) : (
              <p className="text-center text-xs text-slate-600 sm:text-left">
                {t('waste.useMoreItems', {
                  count: itemsToNextMood,
                  mood: t(`waste.moods.${nextMood}`),
                })}
              </p>
            )}
            <div className="h-1.5 w-full rounded-full" style={{ background: colors.warmGray }}>
              <div
                className="h-1.5 rounded-full"
                style={{
                  width: `${Math.round(bandProgress(score, mood) * 100)}%`,
                  background: meta.accent,
                }}
              />
            </div>
          </div>
        ) : null}
        {counts.total > 0 ? (
          <p className="text-center text-xs text-slate-500 sm:text-left">
            {t('waste.last30')}{' '}
            <button className={countBtn} onClick={() => setDialog('used')}>
              {t('waste.usedCount', { count: counts.consumed })}
            </button>{' '}
            ·{' '}
            <button className={countBtn} onClick={() => setDialog('tossed')}>
              {t('waste.tossedCount', { discarded: counts.discarded, expired: counts.expired })}
            </button>{' '}
            ·{' '}
            <button className={countBtn} onClick={() => setDialog('co2')}>
              {t('waste.co2Avoided', { count: co2AvoidedKg })}
            </button>
          </p>
        ) : (
          <p className="text-center text-xs text-slate-500 sm:text-left">
            {t('waste.noneResolved')}
          </p>
        )}
        <WasteHistory weeklyScores={weeklyScores} />
        <p className="text-center text-xs text-slate-500 sm:text-left">
          {t('waste.forgivenessHint')}
        </p>
      </div>
      {dialog ? (
        <WasteDetailDialog
          type={dialog}
          counts={counts}
          rescuedCount={rescuedCount}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </section>
  );
}
