import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GamificationService } from '../gamification.service.js';
import { CHALLENGE_DEFS } from '../challenges.js';

// One challenge that is already satisfied by the signals below (10 consumed >= 10).
const USE_IT_ALL = {
  id: 'c1',
  key: 'use-it-all',
  title: 'Use It All',
  description: 'Eat 10 items.',
  xp: 150,
  rule: { type: 'consume_count', target: 10 },
};

// Two instants in different ISO weeks, to check the weekly reset.
const WEEK_A = new Date('2026-07-08T10:00:00Z'); // Wednesday, week 28
const WEEK_B = new Date('2026-07-15T10:00:00Z'); // Wednesday, week 29

// A fake Prisma that remembers the XP total and which challenge weeks are already
// done, so we can check the XP gets added once per challenge per week.
function buildMock() {
  const state = { xpTotal: 0, claimed: new Set<string>() };

  const claim = (where: { challengeId: string; weekKey: string; completedAt: null }) => {
    const key = `${where.challengeId}:${where.weekKey}`;
    if (where.completedAt === null && !state.claimed.has(key)) {
      state.claimed.add(key);
      return { count: 1 };
    }
    return { count: 0 };
  };

  const tx = {
    userChallenge: { updateMany: vi.fn(({ where }) => claim(where)) },
    userXp: {
      update: vi.fn(({ data }) => {
        state.xpTotal += data.total.increment;
        return { userId: 'u1', total: state.xpTotal };
      }),
    },
  };

  const prisma = {
    challenge: {
      upsert: vi.fn(),
      findMany: vi.fn(async () => [USE_IT_ALL]),
    },
    userXp: {
      upsert: vi.fn(),
      findUnique: vi.fn(async () => ({ userId: 'u1', total: state.xpTotal })),
    },
    userChallenge: {
      upsert: vi.fn(),
      findMany: vi.fn(async ({ where }: { where: { weekKey: string } }) => {
        const done = state.claimed.has(`c1:${where.weekKey}`);
        return [
          {
            challengeId: 'c1',
            weekKey: where.weekKey,
            progress: 10,
            completedAt: done ? new Date() : null,
          },
        ];
      }),
    },
    stockItem: {
      groupBy: vi.fn(async () => [{ location: 'PANTRY', _count: { _all: 10 } }]),
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    shoppingItem: { count: vi.fn(async () => 0) },
    lessonCompletion: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };

  return { prisma, state, tx };
}

describe('GamificationService', () => {
  let mock: ReturnType<typeof buildMock>;
  let service: GamificationService;

  beforeEach(() => {
    mock = buildMock();
    service = new GamificationService(mock.prisma as never);
  });

  it('saves every challenge on startup (upsert, so no duplicates)', async () => {
    await service.onModuleInit();
    expect(mock.prisma.challenge.upsert).toHaveBeenCalledTimes(CHALLENGE_DEFS.length);
  });

  it('awards XP when a challenge first completes', async () => {
    await service.syncChallenges('u1', WEEK_A);
    expect(mock.state.xpTotal).toBe(150);
    expect(mock.tx.userXp.update).toHaveBeenCalledTimes(1);
  });

  it('does not give the XP again when synced more than once in the same week', async () => {
    await service.syncChallenges('u1', WEEK_A);
    await service.syncChallenges('u1', WEEK_A);
    await service.syncChallenges('u1', WEEK_A);

    expect(mock.state.xpTotal).toBe(150);
    // The increment ran once; later claims matched 0 rows.
    expect(mock.tx.userXp.update).toHaveBeenCalledTimes(1);
  });

  it('pays the XP again in a new week (weekly reset)', async () => {
    await service.syncChallenges('u1', WEEK_A);
    await service.syncChallenges('u1', WEEK_B);

    expect(mock.state.xpTotal).toBe(300);
    expect(mock.tx.userXp.update).toHaveBeenCalledTimes(2);
  });

  it('only counts signals from the current week', async () => {
    await service.syncChallenges('u1', WEEK_A);

    // Monday July 6th 2026, 00:00 in Paris = July 5th 22:00 UTC (summer time)
    expect(mock.prisma.stockItem.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: { gte: new Date('2026-07-05T22:00:00.000Z') },
        }),
      }),
    );
  });

  it('getChallenges returns the XP total, completed challenge and streak fields', async () => {
    const result = await service.getChallenges('u1', WEEK_A);

    expect(result.xp).toBe(150);
    expect(result.challenges).toHaveLength(1);
    expect(result.challenges[0]).toMatchObject({
      key: 'use-it-all',
      target: 10,
      progress: 10,
      completed: true,
    });
    expect(result.streak).toBe(0);
    expect(result.streakActiveToday).toBe(false);
    // the week ends the following Monday at midnight Paris time
    expect(result.weekEndsAt).toBe('2026-07-12T22:00:00.000Z');
  });

  it('computes the streak from lesson and consumption days', async () => {
    const now = new Date('2026-07-08T10:00:00Z');
    mock.prisma.lessonCompletion.findMany.mockResolvedValue([
      { completedAt: new Date('2026-07-08T08:00:00Z') },
      { completedAt: new Date('2026-07-06T08:00:00Z') },
    ] as never);
    mock.prisma.stockItem.findMany.mockResolvedValue([
      { deletedAt: new Date('2026-07-07T08:00:00Z') },
    ] as never);

    const streak = await service.getStreak('u1', now);
    expect(streak).toEqual({ streak: 3, activeToday: true });
  });
});
