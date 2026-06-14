import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WasteService } from '../waste.service.js';

const mockPrismaService = {
  stockItem: {
    findMany: vi.fn(),
  },
};

// Frozen "now" so the item ages (and so the recency weights) are deterministic.
const NOW = new Date('2026-07-11T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

// Build fake resolved rows: a given disposition resolved ageDays ago, with the
// quantity/unit/product fields the CO2 estimate reads. Age 0 = resolved right
// now, weight 1, so tests that don't care about ages behave like before.
// daysToExpiry sets an expirationDate relative to the resolution time (2 or
// less makes a consumed item a rescue); undefined = no date.
function row(disposition: string, ageDays = 0, daysToExpiry?: number) {
  const deletedAt = new Date(NOW.getTime() - ageDays * DAY_MS);
  return {
    id: `item-${disposition}-${ageDays}-${daysToExpiry ?? 'none'}`,
    disposition,
    deletedAt,
    expirationDate:
      daysToExpiry === undefined ? null : new Date(deletedAt.getTime() + daysToExpiry * DAY_MS),
    quantity: 1,
    unit: 'pcs',
    product: { name: 'Mystery item', category: null },
  };
}

function rows(spec: { consumed?: number; discarded?: number; expired?: number }, ageDays = 0) {
  const out: ReturnType<typeof row>[] = [];
  for (let i = 0; i < (spec.consumed ?? 0); i++) out.push(row('CONSUMED', ageDays));
  for (let i = 0; i < (spec.discarded ?? 0); i++) out.push(row('DISCARDED', ageDays));
  for (let i = 0; i < (spec.expired ?? 0); i++) out.push(row('EXPIRED', ageDays));
  return out;
}

// An in-stock row for the pantry query. daysToExpiry is relative to NOW;
// negative = already expired, undefined = no date.
function stockRow(daysToExpiry?: number) {
  return {
    expirationDate:
      daysToExpiry === undefined ? null : new Date(NOW.getTime() + daysToExpiry * DAY_MS),
  };
}

// getLevel runs two queries: the resolved window rows and the current stock.
// Route the mock on the where clause so each test can set both sides.
function mockWaste(resolved: unknown[], inStock: unknown[] = []) {
  mockPrismaService.stockItem.findMany.mockImplementation(
    (args: { where: { deletedAt: unknown } }) =>
      Promise.resolve(args.where.deletedAt === null ? inStock : resolved),
  );
}

describe('WasteService', () => {
  let service: WasteService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    service = new WasteService(mockPrismaService as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('queries only the user, dispositioned items, within the 30-day window', async () => {
    mockWaste(rows({ consumed: 1 }));

    await service.getLevel('user-1');

    const arg = mockPrismaService.stockItem.findMany.mock.calls[0]![0];
    expect(arg.where.userId).toBe('user-1');
    expect(arg.where.disposition).toEqual({ not: null });
    expect(arg.where.deletedAt.gte).toBeInstanceOf(Date);
    // ~30 days back
    const days = (arg.where.deletedAt.lte - arg.where.deletedAt.gte) / DAY_MS;
    expect(Math.round(days)).toBe(30);
    // the recency weighting and rescues need the per-item timestamps
    expect(arg.select.deletedAt).toBe(true);
    expect(arg.select.expirationDate).toBe(true);
    // the second query is the pantry state
    const pantryArg = mockPrismaService.stockItem.findMany.mock.calls[1]![0];
    expect(pantryArg.where).toEqual({ userId: 'user-1', deletedAt: null });
  });

  it('returns 100 / EXCELLENT for a user with no history and no stock', async () => {
    mockWaste([]);

    const result = await service.getLevel('user-1');

    expect(result.score).toBe(100);
    expect(result.mood).toBe('EXCELLENT');
    expect(result.counts).toEqual({ consumed: 0, discarded: 0, expired: 0, total: 0 });
    expect(result.co2AvoidedKg).toBe(0);
    expect(result.pantry).toEqual({ total: 0, expired: 0, expiringSoon: 0, score: 100 });
    expect(result.rescuedCount).toBe(0);
  });

  it('estimates CO2 avoided from consumed items only', async () => {
    mockWaste([
      // 1 kg of beef eaten: 12 kg CO2e avoided
      {
        ...row('CONSUMED'),
        quantity: 1,
        unit: 'kg',
        product: { name: 'Boeuf haché', category: null },
      },
      // tossed items must not count
      {
        ...row('DISCARDED'),
        quantity: 5,
        unit: 'kg',
        product: { name: 'Poulet', category: null },
      },
    ]);

    const result = await service.getLevel('user-1');

    expect(result.co2AvoidedKg).toBe(12);
  });

  it('tallies counts and computes the score + mood (70% outcome, 30% pantry)', async () => {
    // outcome 60, empty pantry 100: 0.7*60 + 30 = 72
    mockWaste(rows({ consumed: 6, discarded: 2, expired: 2 }));

    const result = await service.getLevel('user-1');

    expect(result.counts).toEqual({ consumed: 6, discarded: 2, expired: 2, total: 10 });
    expect(result.score).toBe(72);
    expect(result.mood).toBe('GOOD');
  });

  it('drags the score down when the pantry holds expired items', async () => {
    // same outcome 60, but 2 of 10 in-stock items expired: pantry 80
    // 0.7*60 + 0.3*80 = 66
    const inStock = [stockRow(-1), stockRow(-1), ...Array.from({ length: 8 }, () => stockRow(10))];
    mockWaste(rows({ consumed: 6, discarded: 2, expired: 2 }), inStock);

    const result = await service.getLevel('user-1');

    expect(result.pantry).toEqual({ total: 10, expired: 2, expiringSoon: 0, score: 80 });
    expect(result.score).toBe(66);
    expect(result.mood).toBe('OKAY');
  });

  it('counts rescues and weighs them extra', async () => {
    // consumed 2 days before its date = rescue: outcome 1.5/2.5 = 60 -> 72,
    // without the rescue it would be 50 -> 65
    mockWaste([row('CONSUMED', 0, 2), row('DISCARDED', 0)]);

    const result = await service.getLevel('user-1');

    expect(result.rescuedCount).toBe(1);
    expect(result.score).toBe(72);
  });

  it('flags when eating alone cannot reach the next mood', async () => {
    // perfect outcome but the whole pantry expired: composite tops out at 70
    mockWaste(rows({ consumed: 2 }), [stockRow(-1), stockRow(-2)]);

    const result = await service.getLevel('user-1');

    expect(result.mood).toBe('GOOD');
    expect(result.nextMood).toBe('EXCELLENT');
    expect(result.itemsToNextMood).toBeNull();
    expect(result.pantryBlocked).toBe(true);
  });

  it('worsens the mood as discards rise and recovers as they fall (acceptance)', async () => {
    mockWaste(rows({ consumed: 9, discarded: 1 }));
    const good = await service.getLevel('user-1');

    mockWaste(rows({ consumed: 3, discarded: 7 }));
    const worse = await service.getLevel('user-1');

    mockWaste(rows({ consumed: 9, discarded: 1 }));
    const recovered = await service.getLevel('user-1');

    expect(good.score).toBeGreaterThan(worse.score);
    expect(recovered.score).toBeGreaterThan(worse.score);
    expect(good.mood).toBe('EXCELLENT'); // 0.7*90 + 30 = 93
    expect(worse.mood).toBe('OKAY'); // 0.7*30 + 30 = 51
  });

  it('forgives old waste faster than fresh waste (acceptance)', async () => {
    // 7 tossed 20 days ago + 5 consumed today. Unweighted outcome would be 42,
    // weighted it is ~66, so with an empty pantry the score lands at 76.
    mockWaste([...rows({ discarded: 7 }, 20), ...rows({ consumed: 5 }, 0)]);

    const result = await service.getLevel('user-1');

    expect(result.score).toBe(76);
    expect(result.mood).toBe('GOOD');
    // the raw counts still tell the honest, unweighted story
    expect(result.counts).toEqual({ consumed: 5, discarded: 7, expired: 0, total: 12 });
  });

  it('returns null trend and next-mood fields for an empty window', async () => {
    mockWaste([]);

    const result = await service.getLevel('user-1');

    expect(result.nextMood).toBeNull();
    expect(result.itemsToNextMood).toBeNull();
    expect(result.pantryBlocked).toBe(false);
    expect(result.trend).toBeNull();
    expect(result.weeklyScores).toEqual([null, null, null, null]);
  });

  it('fills the trend, next mood and weekly scores when there is history', async () => {
    // a better recent week (2/2) than the older one (1 of 3, 10 days ago)
    mockWaste([...rows({ consumed: 2 }, 1), ...rows({ consumed: 1, discarded: 2 }, 10)]);

    const result = await service.getLevel('user-1');

    expect(result.trend).toBe('IMPROVING');
    // outcome ~67.3, pantry 100: composite 77 (GOOD), EXCELLENT needs 5 more
    expect(result.score).toBe(77);
    expect(result.nextMood).toBe('EXCELLENT');
    expect(result.itemsToNextMood).toBe(5);
    // week buckets: 10 days ago -> second week, 1 day ago -> newest week
    expect(result.weeklyScores).toEqual([null, null, 33, 100]);
  });

  describe('getItems', () => {
    it('maps the resolved items with per-item CO2 and rescue flags', async () => {
      mockPrismaService.stockItem.findMany.mockResolvedValue([
        {
          ...row('CONSUMED', 0, 2),
          id: 'item-1',
          quantity: 1,
          unit: 'kg',
          product: { name: 'Boeuf haché', category: 'viande' },
        },
        { ...row('DISCARDED', 3), id: 'item-2' },
      ]);

      const result = await service.getItems('user-1');

      const arg = mockPrismaService.stockItem.findMany.mock.calls[0]![0];
      expect(arg.orderBy).toEqual({ deletedAt: 'desc' });
      expect(arg.take).toBe(200);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({
        id: 'item-1',
        name: 'Boeuf haché',
        disposition: 'CONSUMED',
        rescued: true,
        co2Kg: 12,
      });
      // tossed items carry no CO2 estimate
      expect(result.items[1]).toMatchObject({ id: 'item-2', rescued: false, co2Kg: null });
      // the factor table ships with the response so the UI can explain the math
      expect(result.co2Info.perKgByCategory.viande).toBe(12);
      expect(result.co2Info.perKgDefault).toBe(1.8);
      expect(result.co2Info.pieceWeightKg).toBe(0.25);
    });
  });

  describe('getHistory', () => {
    it('returns monthly buckets with gaps as nulls', async () => {
      mockPrismaService.stockItem.findMany.mockResolvedValue([
        { disposition: 'CONSUMED', deletedAt: new Date('2026-07-05T10:00:00Z') },
        { disposition: 'DISCARDED', deletedAt: new Date('2026-05-20T10:00:00Z') },
      ]);

      const result = await service.getHistory('user-1');

      expect(result.months.map((m) => m.month)).toEqual(['2026-05', '2026-06', '2026-07']);
      expect(result.months[0]!.score).toBe(0);
      expect(result.months[1]!.score).toBeNull();
      expect(result.months[2]!.score).toBe(100);
    });
  });
});
