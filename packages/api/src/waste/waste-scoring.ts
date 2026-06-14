import type {
  StockDisposition,
  WasteCounts,
  WasteMonth,
  WasteMood,
  WasteTrend,
} from '@pantryai/shared';
import { wasteMoodBands } from '@pantryai/shared';

// The Waste Level formula (DEV_PLAN.md section 5.3, updated 2026-07-11).
// Both DISCARDED and EXPIRED count as waste; only CONSUMED is the "good" outcome.
//
// The score mixes two parts:
//
//   score = round(0.7 * outcome + 0.3 * pantry)
//
// The outcome part is what happened over the window, recency weighted: each
// resolved item counts less the older it is, with a 14 day half life. A "rescue"
// (an item eaten with 3 days or less left before its expiry date) counts 1.5x,
// because saving food that was about to go off is the whole point of the app.
//
// The pantry part is the fridge right now: items already expired or about to
// expire drag it down. So eating lots of fresh items can't hide food that is
// dying in the fridge, which is exactly what a waste score should catch.
//
// With no resolved items and nothing at risk the score is 100, so a brand new
// user starts on EXCELLENT. We do that on purpose: it keeps things encouraging
// and never guilt-trips someone who hasn't used the app yet.

export const WASTE_WINDOW_DAYS = 30;
export const WASTE_HALF_LIFE_DAYS = 14;
// how much of the score the outcome part is worth; the pantry gets the rest
export const OUTCOME_SHARE = 0.7;
// eaten with this many days (or less) left before expiry = a rescue
export const RESCUE_WINDOW_DAYS = 3;
export const RESCUE_BONUS = 1.5;
// an expiring-soon item in stock counts as half an expired one
export const PANTRY_SOON_RISK = 0.5;
// trend = last 7 days vs the rest of the window
export const TREND_RECENT_DAYS = 7;
// how many points apart the two sides need to be before we call it a trend
export const TREND_DEAD_ZONE = 5;
export const WEEKLY_BUCKETS = 4;
// the all-time history never returns more than this many months
export const HISTORY_MONTHS_CAP = 24;

// A resolved item: how it left the pantry, how many days ago (fractional, never
// negative), and whether it was a rescue. The service builds these so the math
// here stays pure and easy to test.
export interface AgedItem {
  disposition: StockDisposition;
  ageDays: number;
  rescued: boolean;
}

// What's sitting in the pantry right now.
export interface PantryCounts {
  total: number;
  expired: number;
  expiringSoon: number;
}

// The plain unweighted ratio. Still used for the trend, the weekly bars and the
// monthly history, where each bucket is short enough that weighting inside it
// wouldn't matter (and the pantry has no history to mix in).
export function scoreFromCounts(
  counts: Pick<WasteCounts, 'consumed' | 'discarded' | 'expired'>,
): number {
  const total = counts.consumed + counts.discarded + counts.expired;
  if (total === 0) return 100;
  return Math.round((counts.consumed / total) * 100);
}

// Mood bands come from the shared wasteMoodBands so the apps use the same numbers.
export function moodFromScore(score: number): WasteMood {
  for (const band of wasteMoodBands) {
    if (score >= band.min) return band.mood;
  }
  return 'AWFUL';
}

// How much an item counts based on its age. Halves every 14 days.
export function recencyWeight(ageDays: number): number {
  return Math.pow(0.5, Math.max(0, ageDays) / WASTE_HALF_LIFE_DAYS);
}

function weightedSums(items: AgedItem[]): { consumed: number; total: number } {
  let consumed = 0;
  let total = 0;
  for (const item of items) {
    let w = recencyWeight(item.ageDays);
    if (item.disposition === 'CONSUMED' && item.rescued) w *= RESCUE_BONUS;
    total += w;
    if (item.disposition === 'CONSUMED') consumed += w;
  }
  return { consumed, total };
}

// The unrounded outcome ratio, kept private so the composite only rounds once.
function outcomeRaw(items: AgedItem[]): number {
  const { consumed, total } = weightedSums(items);
  if (total === 0) return 100;
  return (consumed / total) * 100;
}

// The recency weighted outcome score on its own. Empty window is still 100.
export function weightedScore(items: AgedItem[]): number {
  return Math.round(outcomeRaw(items));
}

// How healthy the pantry looks right now. 100 = nothing at risk, and an empty
// pantry is also 100 (nothing to worry about is not a problem).
export function pantryScoreFromCounts(pantry: PantryCounts): number {
  if (pantry.total === 0) return 100;
  const risk = pantry.expired + PANTRY_SOON_RISK * pantry.expiringSoon;
  return Math.round(100 * Math.max(0, 1 - risk / pantry.total));
}

// The full Waste Level: 70% outcome, 30% pantry, rounded once at the end.
export function compositeScore(items: AgedItem[], pantry: PantryCounts): number {
  return Math.round(
    OUTCOME_SHARE * outcomeRaw(items) + (1 - OUTCOME_SHARE) * pantryScoreFromCounts(pantry),
  );
}

// How many more items the user needs to consume (fresh ones, starting today, so
// weight 1) to reach the next mood up. Eating only moves the outcome part, so
// when the pantry drags too hard the next band can be unreachable that way:
// items is null and pantryBlocked says why. Null when already EXCELLENT.
export function itemsToNextMood(
  items: AgedItem[],
  pantry: PantryCounts,
): { nextMood: WasteMood; items: number | null; pantryBlocked: boolean } | null {
  const score = compositeScore(items, pantry);
  const mood = moodFromScore(score);
  const bandIndex = wasteMoodBands.findIndex((band) => band.mood === mood);
  if (bandIndex <= 0) return null; // already at the top
  const nextBand = wasteMoodBands[bandIndex - 1];
  if (!nextBand) return null;

  // We need 0.7 * x_n + 0.3 * p >= min - 0.5 (round(x) >= min is x >= min - 0.5),
  // where x_n = 100 * (C + n) / (T + n). Solve for the outcome threshold first.
  const p = pantryScoreFromCounts(pantry);
  const threshold = (nextBand.min - 0.5 - (1 - OUTCOME_SHARE) * p) / OUTCOME_SHARE;
  if (threshold >= 100) {
    // even a perfect outcome can't get there, the pantry is the problem
    return { nextMood: nextBand.mood, items: null, pantryBlocked: true };
  }

  const { consumed: c, total: t } = weightedSums(items);
  let n = Math.max(1, Math.ceil((threshold * t - 100 * c) / (100 - threshold)));

  // float safety: check the real formula and nudge if we landed just short
  const landed = (extra: number) =>
    Math.round(OUTCOME_SHARE * (((c + extra) / (t + extra)) * 100) + (1 - OUTCOME_SHARE) * p) >=
    nextBand.min;
  if (!landed(n)) n += 1;

  return { nextMood: nextBand.mood, items: n, pantryBlocked: false };
}

// Split the window into "last 7 days" and "everything before that" and compare
// their plain scores. Null when either side is empty: comparing against a side
// with no items would just be comparing against a made-up 100.
export function trendFromItems(items: AgedItem[]): WasteTrend | null {
  const recent = { consumed: 0, discarded: 0, expired: 0 };
  const prior = { consumed: 0, discarded: 0, expired: 0 };
  let recentTotal = 0;
  let priorTotal = 0;
  for (const item of items) {
    const bucket = item.ageDays < TREND_RECENT_DAYS ? recent : prior;
    if (item.disposition === 'CONSUMED') bucket.consumed += 1;
    else if (item.disposition === 'DISCARDED') bucket.discarded += 1;
    else bucket.expired += 1;
    if (bucket === recent) recentTotal += 1;
    else priorTotal += 1;
  }
  if (recentTotal === 0 || priorTotal === 0) return null;

  const diff = scoreFromCounts(recent) - scoreFromCounts(prior);
  if (diff > TREND_DEAD_ZONE) return 'IMPROVING';
  if (diff < -TREND_DEAD_ZONE) return 'WORSENING';
  return 'STEADY';
}

// Plain score per week for the last 4 weeks, oldest first. A week with no items
// is null so the UI can show a placeholder instead of a fake perfect 100.
// Note: the window is 30 days but 4 weeks is 28, so items aged 28-30 days still
// count in the score and trend but don't show up in any bar. That's fine.
export function weeklyScores(items: AgedItem[]): (number | null)[] {
  const buckets = Array.from({ length: WEEKLY_BUCKETS }, () => ({
    consumed: 0,
    discarded: 0,
    expired: 0,
    total: 0,
  }));
  for (const item of items) {
    const index = Math.floor(item.ageDays / 7);
    if (index < 0 || index >= WEEKLY_BUCKETS) continue;
    const bucket = buckets[index];
    if (!bucket) continue;
    if (item.disposition === 'CONSUMED') bucket.consumed += 1;
    else if (item.disposition === 'DISCARDED') bucket.discarded += 1;
    else bucket.expired += 1;
    bucket.total += 1;
  }
  // bucket 0 is the newest week, the UI wants oldest first
  return buckets.map((bucket) => (bucket.total === 0 ? null : scoreFromCounts(bucket))).reverse();
}

// 'YYYY-MM' in UTC for a date.
function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

// One entry per UTC calendar month, from the first resolved item to now, empty
// months included as nulls so the chart shows the gaps. Capped at the last 24
// months so a very old account can't blow up the response.
export function monthlyScores(
  rows: { disposition: StockDisposition; resolvedAt: Date }[],
  now: Date,
): WasteMonth[] {
  if (rows.length === 0) return [];

  const byMonth = new Map<string, { consumed: number; discarded: number; expired: number }>();
  let firstMonthStart: Date | null = null;
  for (const row of rows) {
    const key = monthKey(row.resolvedAt);
    let bucket = byMonth.get(key);
    if (!bucket) {
      bucket = { consumed: 0, discarded: 0, expired: 0 };
      byMonth.set(key, bucket);
    }
    if (row.disposition === 'CONSUMED') bucket.consumed += 1;
    else if (row.disposition === 'DISCARDED') bucket.discarded += 1;
    else bucket.expired += 1;

    const monthStart = new Date(
      Date.UTC(row.resolvedAt.getUTCFullYear(), row.resolvedAt.getUTCMonth(), 1),
    );
    if (firstMonthStart === null || monthStart < firstMonthStart) firstMonthStart = monthStart;
  }

  // walk month by month from the first (or the cap) to the current one
  const capStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (HISTORY_MONTHS_CAP - 1), 1),
  );
  let cursor = firstMonthStart !== null && firstMonthStart > capStart ? firstMonthStart : capStart;
  const currentStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const months: WasteMonth[] = [];
  while (cursor <= currentStart) {
    const key = monthKey(cursor);
    const bucket = byMonth.get(key);
    if (bucket) {
      months.push({ month: key, score: scoreFromCounts(bucket), ...bucket });
    } else {
      months.push({ month: key, score: null, consumed: 0, discarded: 0, expired: 0 });
    }
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return months;
}
