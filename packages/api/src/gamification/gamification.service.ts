import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { ChallengeProgress, ChallengeRule, ChallengesResponse } from '@pantryai/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { StockRemovedEvent } from '../stock/stock.events.js';
import { STOCK_REMOVED } from '../stock/stock.events.js';
import { CHALLENGE_DEFS } from './challenges.js';
import { evaluateProgress, type ChallengeSignals } from './challenge-rules.js';
import { computeStreak } from './streak.js';
import { dayKey, weekEnd, weekKey, weekStart } from './week.js';

// how far back we look for streak activity; past a year the query cost isn't
// worth it and a 400-day streak deserves to be capped anyway
const STREAK_LOOKBACK_DAYS = 400;

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

  // Work out this week's progress for every challenge again and hand out XP for
  // any the user has just finished. Challenges are weekly: progress lives on the
  // (user, challenge, week) row, so on Monday everyone starts a fresh row at 0 and
  // can earn the XP again. It's fine to call this as often as we want: each row
  // only ever pays out its XP once.
  async syncChallenges(userId: string, now = new Date()): Promise<void> {
    await this.prisma.userXp.upsert({
      where: { userId },
      create: { userId, total: 0 },
      update: {},
    });

    const week = weekKey(now);
    const since = weekStart(now);
    const signals = await this.gatherSignals(userId, since, now);
    const challenges = await this.prisma.challenge.findMany();

    for (const challenge of challenges) {
      const { progress, target } = evaluateProgress(challenge.rule as ChallengeRule, signals);

      await this.prisma.userChallenge.upsert({
        where: {
          userId_challengeId_weekKey: { userId, challengeId: challenge.id, weekKey: week },
        },
        create: { userId, challengeId: challenge.id, weekKey: week, progress },
        update: { progress },
      });

      if (progress >= target) {
        await this.awardIfNewlyCompleted(userId, challenge.id, week, challenge.xp);
      }
    }
  }

  // Mark this week's challenge row done and add its XP. The updateMany only changes
  // the row while completedAt is still empty, so if two of these run at once only
  // the first one actually updates a row, and only that one adds the XP. That's how
  // we avoid paying out twice within a week.
  private async awardIfNewlyCompleted(
    userId: string,
    challengeId: string,
    week: string,
    xp: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.userChallenge.updateMany({
        where: { userId, challengeId, weekKey: week, completedAt: null },
        data: { completedAt: new Date() },
      });
      if (claimed.count === 1) {
        await tx.userXp.update({ where: { userId }, data: { total: { increment: xp } } });
      }
    });
  }

  async getChallenges(userId: string, now = new Date()): Promise<ChallengesResponse> {
    await this.syncChallenges(userId, now);

    const week = weekKey(now);
    const [xp, challenges, userChallenges, streak] = await Promise.all([
      this.prisma.userXp.findUnique({ where: { userId } }),
      this.prisma.challenge.findMany({ orderBy: { xp: 'asc' } }),
      this.prisma.userChallenge.findMany({ where: { userId, weekKey: week } }),
      this.getStreak(userId, now),
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

    return {
      xp: xp?.total ?? 0,
      challenges: result,
      streak: streak.streak,
      streakActiveToday: streak.activeToday,
      weekEndsAt: weekEnd(now).toISOString(),
    };
  }

  // The daily streak: distinct Paris days with at least one anti-waste activity
  // (a finished lesson or a consumed stock item), counted back from today. Nothing
  // is stored, we just recompute it from the timestamps we already keep.
  async getStreak(
    userId: string,
    now = new Date(),
  ): Promise<{ streak: number; activeToday: boolean }> {
    const since = new Date(now.getTime() - STREAK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const [lessonDays, consumedDays] = await Promise.all([
      this.prisma.lessonCompletion.findMany({
        where: { userId, completedAt: { gte: since } },
        select: { completedAt: true },
      }),
      this.prisma.stockItem.findMany({
        where: { userId, disposition: 'CONSUMED', deletedAt: { gte: since } },
        select: { deletedAt: true },
      }),
    ]);

    const days = new Set<string>();
    for (const lesson of lessonDays) days.add(dayKey(lesson.completedAt));
    for (const item of consumedDays) {
      if (item.deletedAt) days.add(dayKey(item.deletedAt));
    }

    return computeStreak(days, dayKey(now));
  }

  // Grab all the numbers the rules need in one go, counting only from `since` (the
  // start of the current week) so progress resets on Monday. The window counts are
  // stored by the number of days each rule wants, so a rule can just look its own
  // days up; windows never reach back before the week started.
  private async gatherSignals(userId: string, since: Date, now: Date): Promise<ChallengeSignals> {
    const windowDays = Array.from(
      new Set(
        CHALLENGE_DEFS.map((d) => (d.rule.type === 'no_waste_window' ? d.rule.windowDays : null)),
      ),
    ).filter((d): d is number => d != null);

    const [consumedGroups, shoppingChecked, windowConsumed, windowWaste] = await Promise.all([
      this.prisma.stockItem.groupBy({
        by: ['location'],
        where: { userId, disposition: 'CONSUMED', deletedAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.shoppingItem.count({
        where: { userId, checked: true, checkedAt: { gte: since } },
      }),
      this.countWindows(userId, windowDays, ['CONSUMED'], since, now),
      this.countWindows(userId, windowDays, ['DISCARDED', 'EXPIRED'], since, now),
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

  // Count items with one of the given dispositions, resolved within each window,
  // clamped so a window never starts before the current week did.
  private async countWindows(
    userId: string,
    windowDays: number[],
    dispositions: ('CONSUMED' | 'DISCARDED' | 'EXPIRED')[],
    since: Date,
    now: Date,
  ): Promise<Record<number, number>> {
    const entries = await Promise.all(
      windowDays.map(async (days) => {
        const windowFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const from = windowFrom > since ? windowFrom : since;
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
