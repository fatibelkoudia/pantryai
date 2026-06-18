import { Injectable } from '@nestjs/common';
import type { WasteLevelResponse } from '@pantryai/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { moodFromScore, scoreFromCounts, WASTE_WINDOW_DAYS } from './waste-scoring.js';

@Injectable()
export class WasteService {
  constructor(private readonly prisma: PrismaService) {}

  async getLevel(userId: string): Promise<WasteLevelResponse> {
    const to = new Date();
    const from = new Date(to.getTime() - WASTE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // All of the user's resolved (removed, dispositioned) items in the window.
    // The soft-deleted rows are the event log, keyed on deletedAt.
    const rows = await this.prisma.stockItem.findMany({
      where: {
        userId,
        disposition: { not: null },
        deletedAt: { gte: from, lte: to },
      },
      select: { disposition: true },
    });

    const counts = { consumed: 0, discarded: 0, expired: 0 };
    for (const row of rows) {
      if (row.disposition === 'CONSUMED') counts.consumed += 1;
      else if (row.disposition === 'DISCARDED') counts.discarded += 1;
      else if (row.disposition === 'EXPIRED') counts.expired += 1;
    }

    const total = counts.consumed + counts.discarded + counts.expired;
    const score = scoreFromCounts(counts);

    return {
      score,
      mood: moodFromScore(score),
      window: { days: WASTE_WINDOW_DAYS, from: from.toISOString(), to: to.toISOString() },
      counts: { ...counts, total },
    };
  }
}
