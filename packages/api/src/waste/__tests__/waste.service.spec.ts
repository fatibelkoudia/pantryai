import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WasteService } from '../waste.service.js';

const mockPrismaService = {
  stockItem: {
    findMany: vi.fn(),
  },
};

// Build fake resolved rows: n of a given disposition, with the quantity/unit/
// product fields the CO2 estimate reads.
function row(disposition: string) {
  return {
    disposition,
    quantity: 1,
    unit: 'pcs',
    product: { name: 'Mystery item', category: null },
  };
}

function rows(spec: { consumed?: number; discarded?: number; expired?: number }) {
  const out: ReturnType<typeof row>[] = [];
  for (let i = 0; i < (spec.consumed ?? 0); i++) out.push(row('CONSUMED'));
  for (let i = 0; i < (spec.discarded ?? 0); i++) out.push(row('DISCARDED'));
  for (let i = 0; i < (spec.expired ?? 0); i++) out.push(row('EXPIRED'));
  return out;
}

describe('WasteService', () => {
  let service: WasteService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WasteService(mockPrismaService as never);
  });

  it('queries only the user, dispositioned items, within the 30-day window', async () => {
    mockPrismaService.stockItem.findMany.mockResolvedValue(rows({ consumed: 1 }));

    await service.getLevel('user-1');

    const arg = mockPrismaService.stockItem.findMany.mock.calls[0]![0];
    expect(arg.where.userId).toBe('user-1');
    expect(arg.where.disposition).toEqual({ not: null });
    expect(arg.where.deletedAt.gte).toBeInstanceOf(Date);
    // ~30 days back
    const days = (arg.where.deletedAt.lte - arg.where.deletedAt.gte) / (24 * 60 * 60 * 1000);
    expect(Math.round(days)).toBe(30);
  });

  it('returns 100 / EXCELLENT for a user with no resolved items', async () => {
    mockPrismaService.stockItem.findMany.mockResolvedValue([]);

    const result = await service.getLevel('user-1');

    expect(result.score).toBe(100);
    expect(result.mood).toBe('EXCELLENT');
    expect(result.counts).toEqual({ consumed: 0, discarded: 0, expired: 0, total: 0 });
    expect(result.co2AvoidedKg).toBe(0);
  });

  it('estimates CO2 avoided from consumed items only', async () => {
    mockPrismaService.stockItem.findMany.mockResolvedValue([
      // 1 kg of beef eaten: 12 kg CO2e avoided
      {
        disposition: 'CONSUMED',
        quantity: 1,
        unit: 'kg',
        product: { name: 'Boeuf haché', category: null },
      },
      // tossed items must not count
      {
        disposition: 'DISCARDED',
        quantity: 5,
        unit: 'kg',
        product: { name: 'Poulet', category: null },
      },
    ]);

    const result = await service.getLevel('user-1');

    expect(result.co2AvoidedKg).toBe(12);
  });

  it('tallies counts and computes the score + mood', async () => {
    mockPrismaService.stockItem.findMany.mockResolvedValue(
      rows({ consumed: 6, discarded: 2, expired: 2 }),
    );

    const result = await service.getLevel('user-1');

    expect(result.counts).toEqual({ consumed: 6, discarded: 2, expired: 2, total: 10 });
    expect(result.score).toBe(60);
    expect(result.mood).toBe('OKAY');
  });

  it('worsens the mood as discards rise and recovers as they fall (acceptance)', async () => {
    mockPrismaService.stockItem.findMany.mockResolvedValueOnce(rows({ consumed: 9, discarded: 1 }));
    const good = await service.getLevel('user-1');

    mockPrismaService.stockItem.findMany.mockResolvedValueOnce(rows({ consumed: 3, discarded: 7 }));
    const worse = await service.getLevel('user-1');

    mockPrismaService.stockItem.findMany.mockResolvedValueOnce(rows({ consumed: 9, discarded: 1 }));
    const recovered = await service.getLevel('user-1');

    expect(good.score).toBeGreaterThan(worse.score);
    expect(recovered.score).toBeGreaterThan(worse.score);
    expect(good.mood).toBe('EXCELLENT');
    expect(worse.mood).toBe('BAD');
  });
});
