import { describe, expect, it } from 'vitest';
import {
  compositeScore,
  itemsToNextMood,
  monthlyScores,
  moodFromScore,
  pantryScoreFromCounts,
  recencyWeight,
  scoreFromCounts,
  trendFromItems,
  weeklyScores,
  weightedScore,
  type AgedItem,
  type PantryCounts,
} from '../waste-scoring.js';

// shorthand for building aged items in the tests below
function aged(disposition: AgedItem['disposition'], ageDays: number, rescued = false): AgedItem {
  return { disposition, ageDays, rescued };
}

// an empty pantry: nothing at risk, pantry part scores 100
const NO_PANTRY: PantryCounts = { total: 0, expired: 0, expiringSoon: 0 };

describe('scoreFromCounts', () => {
  it('returns 100 when nothing has been resolved (empty state)', () => {
    expect(scoreFromCounts({ consumed: 0, discarded: 0, expired: 0 })).toBe(100);
  });

  it('is 100 when everything was consumed', () => {
    expect(scoreFromCounts({ consumed: 10, discarded: 0, expired: 0 })).toBe(100);
  });

  it('counts both discarded and expired as waste', () => {
    // 6 good of 10 -> 60
    expect(scoreFromCounts({ consumed: 6, discarded: 2, expired: 2 })).toBe(60);
  });

  it('is 0 when nothing was consumed', () => {
    expect(scoreFromCounts({ consumed: 0, discarded: 3, expired: 1 })).toBe(0);
  });

  it('rounds to the nearest integer', () => {
    // 2 / 3 = 66.66 -> 67
    expect(scoreFromCounts({ consumed: 2, discarded: 1, expired: 0 })).toBe(67);
  });
});

describe('moodFromScore', () => {
  it('maps every band', () => {
    expect(moodFromScore(100)).toBe('EXCELLENT');
    expect(moodFromScore(90)).toBe('EXCELLENT');
    expect(moodFromScore(89)).toBe('GOOD');
    expect(moodFromScore(70)).toBe('GOOD');
    expect(moodFromScore(69)).toBe('OKAY');
    expect(moodFromScore(50)).toBe('OKAY');
    expect(moodFromScore(49)).toBe('BAD');
    expect(moodFromScore(30)).toBe('BAD');
    expect(moodFromScore(29)).toBe('AWFUL');
    expect(moodFromScore(0)).toBe('AWFUL');
  });
});

describe('recencyWeight', () => {
  it('halves every 14 days', () => {
    expect(recencyWeight(0)).toBe(1);
    expect(recencyWeight(14)).toBeCloseTo(0.5);
    expect(recencyWeight(28)).toBeCloseTo(0.25);
    expect(recencyWeight(30)).toBeCloseTo(0.2264, 3);
  });

  it('clamps negative ages to full weight', () => {
    expect(recencyWeight(-3)).toBe(1);
  });
});

describe('weightedScore', () => {
  it('is 100 for an empty window', () => {
    expect(weightedScore([])).toBe(100);
  });

  it('is 100 when everything was consumed, at any age', () => {
    expect(weightedScore([aged('CONSUMED', 0), aged('CONSUMED', 25)])).toBe(100);
  });

  it('matches the plain score when all items have the same age', () => {
    const items = [
      aged('CONSUMED', 10),
      aged('CONSUMED', 10),
      aged('DISCARDED', 10),
      aged('EXPIRED', 10),
    ];
    expect(weightedScore(items)).toBe(scoreFromCounts({ consumed: 2, discarded: 1, expired: 1 }));
  });

  it('weighs recent items more than old ones', () => {
    // consumed today (w=1) vs discarded 28 days ago (w=0.25): 1/1.25 -> 80
    expect(weightedScore([aged('CONSUMED', 0), aged('DISCARDED', 28)])).toBe(80);
    // the mirror: old good deed, fresh waste: 0.25/1.25 -> 20
    expect(weightedScore([aged('DISCARDED', 0), aged('CONSUMED', 28)])).toBe(20);
  });

  it('lets a bad week fade instead of dragging the score for a month', () => {
    const items = [
      ...Array.from({ length: 7 }, () => aged('DISCARDED', 20)),
      ...Array.from({ length: 5 }, () => aged('CONSUMED', 0)),
    ];
    // unweighted this would be 42 (BAD); weighted it lands around 66 (OKAY)
    expect(weightedScore(items)).toBe(66);
  });

  it('gives a rescue extra weight', () => {
    // plain: 1 / 2 -> 50; rescued: 1.5 / 2.5 -> 60
    expect(weightedScore([aged('CONSUMED', 0), aged('DISCARDED', 0)])).toBe(50);
    expect(weightedScore([aged('CONSUMED', 0, true), aged('DISCARDED', 0)])).toBe(60);
  });
});

describe('pantryScoreFromCounts', () => {
  it('is 100 for an empty pantry', () => {
    expect(pantryScoreFromCounts(NO_PANTRY)).toBe(100);
  });

  it('is 100 when nothing is at risk', () => {
    expect(pantryScoreFromCounts({ total: 8, expired: 0, expiringSoon: 0 })).toBe(100);
  });

  it('drops for expired items in stock', () => {
    expect(pantryScoreFromCounts({ total: 10, expired: 2, expiringSoon: 0 })).toBe(80);
  });

  it('counts an expiring-soon item as half an expired one', () => {
    expect(pantryScoreFromCounts({ total: 10, expired: 0, expiringSoon: 2 })).toBe(90);
  });

  it('bottoms out at 0 when everything is expired', () => {
    expect(pantryScoreFromCounts({ total: 4, expired: 4, expiringSoon: 0 })).toBe(0);
    // risk can exceed the total (expired + soon), clamp instead of going negative
    expect(pantryScoreFromCounts({ total: 2, expired: 2, expiringSoon: 2 })).toBe(0);
  });
});

describe('compositeScore', () => {
  it('is 100 with nothing resolved and nothing at risk', () => {
    expect(compositeScore([], NO_PANTRY)).toBe(100);
  });

  it('mixes 70% outcome and 30% pantry, rounding once', () => {
    // outcome 65.79 unrounded, pantry 100: 0.7*65.79 + 30 = 76.05 -> 76
    const items = [
      ...Array.from({ length: 7 }, () => aged('DISCARDED', 20)),
      ...Array.from({ length: 5 }, () => aged('CONSUMED', 0)),
    ];
    expect(compositeScore(items, NO_PANTRY)).toBe(76);
    // same outcome with a dragging pantry (80): 0.7*65.79 + 24 = 70.05 -> 70
    expect(compositeScore(items, { total: 10, expired: 2, expiringSoon: 0 })).toBe(70);
  });

  it('keeps a perfect eater capped when the fridge is rotting', () => {
    // all consumed (outcome 100) but the whole pantry expired: 70 + 0 = 70
    const items = [aged('CONSUMED', 0), aged('CONSUMED', 1)];
    expect(compositeScore(items, { total: 3, expired: 3, expiringSoon: 0 })).toBe(70);
  });
});

describe('itemsToNextMood', () => {
  it('is null when already EXCELLENT (including the empty state)', () => {
    expect(itemsToNextMood([], NO_PANTRY)).toBeNull();
    expect(itemsToNextMood([aged('CONSUMED', 0)], NO_PANTRY)).toBeNull();
  });

  it('tells how many consumed items reach the next band', () => {
    // 1 consumed + 1 discarded today, empty pantry: composite 65 (OKAY).
    // one more consumed gives outcome 66.7 -> composite 77 (GOOD)
    const items = [aged('CONSUMED', 0), aged('DISCARDED', 0)];
    expect(itemsToNextMood(items, NO_PANTRY)).toEqual({
      nextMood: 'GOOD',
      items: 1,
      pantryBlocked: false,
    });
  });

  it('targets only the next band up, never two at once', () => {
    const items = [aged('CONSUMED', 0), aged('DISCARDED', 0)];
    const next = itemsToNextMood(items, NO_PANTRY)!;
    expect(next.nextMood).toBe('GOOD');
    const after = [...items, ...Array.from({ length: next.items! }, () => aged('CONSUMED', 0))];
    expect(moodFromScore(compositeScore(after, NO_PANTRY))).toBe('GOOD');
  });

  it('lands in the band it promises (rounding boundary near 90)', () => {
    // 5 consumed + 1 discarded today: composite 88 (GOOD); one more consumed
    // gives outcome 85.7 -> composite exactly 90 -> EXCELLENT
    const items = [...Array.from({ length: 5 }, () => aged('CONSUMED', 0)), aged('DISCARDED', 0)];
    const next = itemsToNextMood(items, NO_PANTRY)!;
    expect(next).toEqual({ nextMood: 'EXCELLENT', items: 1, pantryBlocked: false });
    const after = [...items, aged('CONSUMED', 0)];
    expect(moodFromScore(compositeScore(after, NO_PANTRY))).toBe('EXCELLENT');
  });

  it('flags when the pantry blocks the next band', () => {
    // perfect outcome but everything in stock expired: composite tops out at 70,
    // EXCELLENT is out of reach by eating alone
    const items = [aged('CONSUMED', 0)];
    const pantry: PantryCounts = { total: 2, expired: 2, expiringSoon: 0 };
    expect(itemsToNextMood(items, pantry)).toEqual({
      nextMood: 'EXCELLENT',
      items: null,
      pantryBlocked: true,
    });
  });
});

describe('trendFromItems', () => {
  it('is null when either side of the window is empty', () => {
    expect(trendFromItems([])).toBeNull();
    // only recent items
    expect(trendFromItems([aged('CONSUMED', 1), aged('DISCARDED', 2)])).toBeNull();
    // only older items
    expect(trendFromItems([aged('CONSUMED', 10), aged('DISCARDED', 12)])).toBeNull();
  });

  it('reads a clear improvement', () => {
    // recent: 1/1 -> 100, prior: 1 of 2 -> 50
    const items = [aged('CONSUMED', 1), aged('CONSUMED', 10), aged('DISCARDED', 10)];
    expect(trendFromItems(items)).toBe('IMPROVING');
  });

  it('reads a clear decline', () => {
    const items = [aged('DISCARDED', 1), aged('CONSUMED', 10), aged('CONSUMED', 12)];
    expect(trendFromItems(items)).toBe('WORSENING');
  });

  it('treats small differences as steady (dead zone)', () => {
    // recent: 2 of 3 -> 67, prior: 2 of 3 -> 67, diff 0
    const sameish = [
      aged('CONSUMED', 1),
      aged('CONSUMED', 2),
      aged('DISCARDED', 3),
      aged('CONSUMED', 10),
      aged('CONSUMED', 11),
      aged('DISCARDED', 12),
    ];
    expect(trendFromItems(sameish)).toBe('STEADY');
    // exactly +5 apart is still steady: recent 3/4=75, prior 7/10=70
    const fivePoints = [
      ...Array.from({ length: 3 }, () => aged('CONSUMED', 1)),
      aged('DISCARDED', 1),
      ...Array.from({ length: 7 }, () => aged('CONSUMED', 10)),
      ...Array.from({ length: 3 }, () => aged('DISCARDED', 10)),
    ];
    expect(trendFromItems(fivePoints)).toBe('STEADY');
  });
});

describe('weeklyScores', () => {
  it('is all nulls for an empty window', () => {
    expect(weeklyScores([])).toEqual([null, null, null, null]);
  });

  it('returns weeks oldest first with nulls for quiet weeks', () => {
    const items = [
      aged('CONSUMED', 1), // this week: 100
      aged('DISCARDED', 22), // 3 weeks ago: 0
    ];
    expect(weeklyScores(items)).toEqual([0, null, null, 100]);
  });

  it('puts an item aged exactly 7 days in the second newest week', () => {
    expect(weeklyScores([aged('CONSUMED', 7)])).toEqual([null, null, 100, null]);
  });

  it('ignores items older than 28 days (they still count in the score)', () => {
    expect(weeklyScores([aged('DISCARDED', 29)])).toEqual([null, null, null, null]);
  });

  it('scores a mixed week like scoreFromCounts', () => {
    const items = [aged('CONSUMED', 2), aged('CONSUMED', 3), aged('DISCARDED', 4)];
    expect(weeklyScores(items)).toEqual([
      null,
      null,
      null,
      scoreFromCounts({ consumed: 2, discarded: 1, expired: 0 }),
    ]);
  });
});

describe('monthlyScores', () => {
  const NOW = new Date('2026-07-11T12:00:00Z');

  it('is empty when nothing was ever resolved', () => {
    expect(monthlyScores([], NOW)).toEqual([]);
  });

  it('fills the gap months with nulls, oldest first', () => {
    const rows = [
      { disposition: 'CONSUMED' as const, resolvedAt: new Date('2026-07-05T10:00:00Z') },
      { disposition: 'DISCARDED' as const, resolvedAt: new Date('2026-05-20T10:00:00Z') },
    ];
    expect(monthlyScores(rows, NOW)).toEqual([
      { month: '2026-05', score: 0, consumed: 0, discarded: 1, expired: 0 },
      { month: '2026-06', score: null, consumed: 0, discarded: 0, expired: 0 },
      { month: '2026-07', score: 100, consumed: 1, discarded: 0, expired: 0 },
    ]);
  });

  it('buckets by UTC month', () => {
    const rows = [
      { disposition: 'CONSUMED' as const, resolvedAt: new Date('2026-06-30T23:59:59Z') },
    ];
    const months = monthlyScores(rows, NOW);
    expect(months[0]).toEqual({
      month: '2026-06',
      score: 100,
      consumed: 1,
      discarded: 0,
      expired: 0,
    });
  });

  it('caps the range at 24 months', () => {
    const rows = [
      { disposition: 'CONSUMED' as const, resolvedAt: new Date('2024-01-15T10:00:00Z') },
      { disposition: 'CONSUMED' as const, resolvedAt: new Date('2026-07-01T10:00:00Z') },
    ];
    const months = monthlyScores(rows, NOW);
    expect(months).toHaveLength(24);
    expect(months[0]!.month).toBe('2024-08'); // the 2024-01 item is older than the cap
    expect(months[23]!.month).toBe('2026-07');
    expect(months[23]!.score).toBe(100);
  });
});
