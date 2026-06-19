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

// A fake Prisma that remembers the XP total and which challenges are already done,
// so we can check the XP only ever gets added once per challenge.
function buildMock() {
  const state = { xpTotal: 0, claimed: new Set<string>() };

  const claim = (where: { challengeId: string; completedAt: null }) => {
    if (where.completedAt === null && !state.claimed.has(where.challengeId)) {
      state.claimed.add(where.challengeId);
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
      findMany: vi.fn(async () =>
        state.claimed.has('c1')
          ? [{ challengeId: 'c1', progress: 10, completedAt: new Date() }]
          : [{ challengeId: 'c1', progress: 10, completedAt: null }],
      ),
    },
    stockItem: {
      groupBy: vi.fn(async () => [{ location: 'PANTRY', _count: { _all: 10 } }]),
      count: vi.fn(async () => 0),
    },
    shoppingItem: { count: vi.fn(async () => 0) },
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
    await service.syncChallenges('u1');
    expect(mock.state.xpTotal).toBe(150);
    expect(mock.tx.userXp.update).toHaveBeenCalledTimes(1);
  });

  it('does not give the XP again when synced more than once', async () => {
    await service.syncChallenges('u1');
    await service.syncChallenges('u1');
    await service.syncChallenges('u1');

    expect(mock.state.xpTotal).toBe(150);
    // The increment ran once; later claims matched 0 rows.
    expect(mock.tx.userXp.update).toHaveBeenCalledTimes(1);
  });

  it('getChallenges returns the XP total and completed challenge', async () => {
    const result = await service.getChallenges('u1');

    expect(result.xp).toBe(150);
    expect(result.challenges).toHaveLength(1);
    expect(result.challenges[0]).toMatchObject({
      key: 'use-it-all',
      target: 10,
      progress: 10,
      completed: true,
    });
  });
});
