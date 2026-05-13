import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { ChallengeProgress, ChallengeRule, ChallengesResponse } from '@pantryai/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { StockRemovedEvent } from '../stock/stock.events.js';
import { STOCK_REMOVED } from '../stock/stock.events.js';
import { CHALLENGE_DEFS } from './challenges.js';
import { evaluateProgress, type ChallengeSignals } from './challenge-rules.js';

@Injectable()
export class GamificationService implements OnModuleInit {
  private readonly logger = new Logger(GamificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Put our challenge definitions in the database when the app starts. We key on
  // `key` so running this again just updates the rows instead of adding duplicates.
  // The recipes module does the same thing since we don't have a prisma seed script.
  async onModuleInit(): Promise<void> {
    await this.seedChallenges();
  }

  async seedChallenges(): Promise<void> {
    for (const def of CHALLENGE_DEFS) {
      await this.prisma.challenge.upsert({
        where: { key: def.key },
        create: {
          key: def.key,
          title: def.title,
          description: def.description,
          xp: def.xp,
          rule: def.rule,
        },
        update: { title: def.title, description: def.description, xp: def.xp, rule: def.rule },
      });
    }
  }

  // When the user uses up or throws out a stock item, they might have just finished
  // a challenge, so we re-check here. We catch any error on purpose so a problem in
  // here can never make removing a stock item fail.
  @OnEvent(STOCK_REMOVED)
  async onStockRemoved(event: StockRemovedEvent): Promise<void> {
    try {
      await this.syncChallenges(event.userId);
    } catch (error) {
      this.logger.warn(`Challenge sync after stock removal failed: ${String(error)}`);
    }
  }

  // Work out the progress for every challenge again and hand out XP for any the user
  // has just finished. It's fine to call this as often as we want: each challenge
  // only ever pays out its XP once.
  async syncChallenges(userId: string): Promise<void> {
    await this.prisma.userXp.upsert({
      where: { userId },
      create: { userId, total: 0 },
      update: {},
    });

    const signals = await this.gatherSignals(userId);
    const challenges = await this.prisma.challenge.findMany();

    for (const challenge of challenges) {
      const { progress, target } = evaluateProgress(challenge.rule as ChallengeRule, signals);

      await this.prisma.userChallenge.upsert({
        where: { userId_challengeId: { userId, challengeId: challenge.id } },
        create: { userId, challengeId: challenge.id, progress },
        update: { progress },
      });

      if (progress >= target) {
        await this.awardIfNewlyCompleted(userId, challenge.id, challenge.xp);
      }
    }
  }

  // Mark the challenge done and add its XP. The updateMany only changes the row
  // while completedAt is still empty, so if two of these run at once only the first
  // one actually updates a row, and only that one adds the XP. That's how we avoid
  // paying out twice.
  private async awardIfNewlyCompleted(
    userId: string,
    challengeId: string,
    xp: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.userChallenge.updateMany({
        where: { userId, challengeId, completedAt: null },
        data: { completedAt: new Date() },
      });
      if (claimed.count === 1) {
        await tx.userXp.update({ where: { userId }, data: { total: { increment: xp } } });
      }
    });
  }

  async getChallenges(userId: string): Promise<ChallengesResponse> {
    await this.syncChallenges(userId);

    const [xp, challenges, userChallenges] = await Promise.all([
      this.prisma.userXp.findUnique({ where: { userId } }),
      this.prisma.challenge.findMany({ orderBy: { xp: 'asc' } }),
      this.prisma.userChallenge.findMany({ where: { userId } }),
    ]);

    const byChallengeId = new Map(userChallenges.map((uc) => [uc.challengeId, uc]));

    const result: ChallengeProgress[] = challenges.map((challenge) => {
      const uc = byChallengeId.get(challenge.id);
      const { target } = evaluateProgress(challenge.rule as ChallengeRule, emptySignals());
      return {
        key: challenge.key,
        title: challenge.title,
        description: challenge.description,
        xp: challenge.xp,
        progress: uc?.progress ?? 0,
        target,
        completed: uc?.completedAt != null,
        completedAt: uc?.completedAt?.toISOString() ?? null,
      };
    });

    return { xp: xp?.total ?? 0, challenges: result };
  }

  // Grab all the numbers the rules need in one go. The window counts are stored by
  // the number of days each rule wants, so a rule can just look its own days up.
  private async gatherSignals(userId: string): Promise<ChallengeSignals> {
    const windowDays = Array.from(
      new Set(
        CHALLENGE_DEFS.map((d) => (d.rule.type === 'no_waste_window' ? d.rule.windowDays : null)),
      ),
    ).filter((d): d is number => d != null);

    const [consumedGroups, shoppingChecked, windowConsumed, windowWaste] = await Promise.all([
      this.prisma.stockItem.groupBy({
        by: ['location'],
        where: { userId, disposition: 'CONSUMED' },
        _count: { _all: true },
      }),
      this.prisma.shoppingItem.count({ where: { userId, checked: true } }),
      this.countWindows(userId, windowDays, ['CONSUMED']),
      this.countWindows(userId, windowDays, ['DISCARDED', 'EXPIRED']),
    ]);

    const consumedByLocation: Record<string, number> = {};
    let consumedTotal = 0;
    for (const group of consumedGroups) {
      const count = group._count._all;
      consumedByLocation[group.location] = count;
      consumedTotal += count;
    }

    return { consumedTotal, consumedByLocation, windowConsumed, windowWaste, shoppingChecked };
  }

  // Count items with one of the given dispositions, resolved within each window.
  private async countWindows(
    userId: string,
    windowDays: number[],
    dispositions: ('CONSUMED' | 'DISCARDED' | 'EXPIRED')[],
  ): Promise<Record<number, number>> {
    const now = Date.now();
    const entries = await Promise.all(
      windowDays.map(async (days) => {
        const from = new Date(now - days * 24 * 60 * 60 * 1000);
        const count = await this.prisma.stockItem.count({
          where: { userId, disposition: { in: dispositions }, deletedAt: { gte: from } },
        });
        return [days, count] as const;
      }),
    );
    return Object.fromEntries(entries);
  }
}

// All-zero signals. We only use this when building the response to read each rule's
// target. The real progress there comes from the saved UserChallenge row, not this.
function emptySignals(): ChallengeSignals {
  return {
    consumedTotal: 0,
    consumedByLocation: {},
    windowConsumed: {},
    windowWaste: {},
    shoppingChecked: 0,
  };
}
