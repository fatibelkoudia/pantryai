import type { WasteCounts, WasteMood } from '@pantryai/shared';

// The Waste Level formula (DEV_PLAN.md section 5.3, confirmed 2026-06-18).
// Both DISCARDED and EXPIRED count as waste; only CONSUMED is the "good" outcome.
//
// score = round(100 * consumed / (consumed + discarded + expired))
//
// With no resolved items the score is 100, so a brand new user starts on EXCELLENT.
// We do that on purpose: it keeps things encouraging and never guilt-trips someone
// who hasn't used the app yet.

export const WASTE_WINDOW_DAYS = 30;

export function scoreFromCounts(
  counts: Pick<WasteCounts, 'consumed' | 'discarded' | 'expired'>,
): number {
  const total = counts.consumed + counts.discarded + counts.expired;
  if (total === 0) return 100;
  return Math.round((counts.consumed / total) * 100);
}

// Mood bands: EXCELLENT >=90, GOOD >=70, OKAY >=50, BAD >=30, AWFUL <30.
export function moodFromScore(score: number): WasteMood {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 70) return 'GOOD';
  if (score >= 50) return 'OKAY';
  if (score >= 30) return 'BAD';
  return 'AWFUL';
}
