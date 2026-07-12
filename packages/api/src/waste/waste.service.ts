import { Injectable } from '@nestjs/common';
import type {
  WasteHistoryResponse,
  WasteItemsResponse,
  WasteLevelResponse,
  WasteResolvedItem,
} from '@pantryai/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CO2_PER_KG,
  CO2_PER_KG_DEFAULT,
  PIECE_WEIGHT_KG,
  estimateCo2AvoidedKg,
  estimateCo2ItemKg,
} from './co2-estimate.js';
import {
  compositeScore,
  itemsToNextMood,
  monthlyScores,
  moodFromScore,
  pantryScoreFromCounts,
  trendFromItems,
  weeklyScores,
  RESCUE_WINDOW_DAYS,
  WASTE_WINDOW_DAYS,
  type AgedItem,
  type PantryCounts,
} from './waste-scoring.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// How many resolved items /waste/items returns at most. The window is 30 days
// so a normal household never hits this.
const ITEMS_CAP = 200;

// Eaten with 3 days or less left before the expiry date = a rescue (extra
// weight in the score). Eaten after the date is just a plain consume.
function isRescue(disposition: string, deletedAt: Date, expirationDate: Date | null): boolean {
  if (disposition !== 'CONSUMED' || expirationDate === null) return false;
  const left = expirationDate.getTime() - deletedAt.getTime();
  return left >= 0 && left <= RESCUE_WINDOW_DAYS * DAY_MS;
}

@Injectable()
export class WasteService {
  constructor(private readonly prisma: PrismaService) {}

  async getLevel(userId: string): Promise<WasteLevelResponse> {
    const to = new Date();
    const from = new Date(to.getTime() - WASTE_WINDOW_DAYS * DAY_MS);

    // All of the user's resolved (removed, dispositioned) items in the window.
    // The soft-deleted rows are the event log, keyed on deletedAt.
    const rows = await this.prisma.stockItem.findMany({
      where: {
        userId,
        disposition: { not: null },
        deletedAt: { gte: from, lte: to },
      },
      // quantity/unit/product for the CO2 estimate, deletedAt for the recency
      // weighting, expirationDate to spot rescues
      select: {
        disposition: true,
        deletedAt: true,
        expirationDate: true,
        quantity: true,
        unit: true,
        product: { select: { name: true, category: true } },
      },
    });

    // What's in the pantry right now: the 30% of the score that keeps eating
    // sprees from hiding food that's dying in the fridge.
    const inStock = await this.prisma.stockItem.findMany({
      where: { userId, deletedAt: null },
      select: { expirationDate: true },
    });
    const pantry: PantryCounts = { total: inStock.length, expired: 0, expiringSoon: 0 };
    for (const item of inStock) {
      if (item.expirationDate === null) continue;
      const left = item.expirationDate.getTime() - to.getTime();
      if (left < 0) pantry.expired += 1;
      else if (left <= RESCUE_WINDOW_DAYS * DAY_MS) pantry.expiringSoon += 1;
    }

    const counts = { consumed: 0, discarded: 0, expired: 0 };
    for (const row of rows) {
      if (row.disposition === 'CONSUMED') counts.consumed += 1;
      else if (row.disposition === 'DISCARDED') counts.discarded += 1;
      else if (row.disposition === 'EXPIRED') counts.expired += 1;
    }

    const total = counts.consumed + counts.discarded + counts.expired;

    // Pair every disposition with its age and whether it was a rescue (same
    // "to" as the window, never negative).
    const agedItems: AgedItem[] = [];
    let rescuedCount = 0;
    for (const row of rows) {
      if (row.disposition === null || row.deletedAt === null) continue;
      const ageDays = Math.max(0, (to.getTime() - row.deletedAt.getTime()) / DAY_MS);
      const rescued = isRescue(row.disposition, row.deletedAt, row.expirationDate);
      if (rescued) rescuedCount += 1;
      agedItems.push({ disposition: row.disposition, ageDays, rescued });
    }

    const score = compositeScore(agedItems, pantry);
    const next = itemsToNextMood(agedItems, pantry);

    // Only consumed items count: eating food instead of tossing it is what saves CO2.
    const co2AvoidedKg = estimateCo2AvoidedKg(
      rows
        .filter((row) => row.disposition === 'CONSUMED')
        .map((row) => ({
          quantity: row.quantity,
          unit: row.unit,
          product: { name: row.product.name, category: row.product.category ?? undefined },
        })),
    );

    return {
      score,
      mood: moodFromScore(score),
      window: { days: WASTE_WINDOW_DAYS, from: from.toISOString(), to: to.toISOString() },
      counts: { ...counts, total },
      co2AvoidedKg,
      nextMood: next?.nextMood ?? null,
      itemsToNextMood: next?.items ?? null,
      pantryBlocked: next?.pantryBlocked ?? false,
      pantry: { ...pantry, score: pantryScoreFromCounts(pantry) },
      rescuedCount,
      trend: trendFromItems(agedItems),
      weeklyScores: weeklyScores(agedItems),
    };
  }

  // The resolved items behind the counts, for the stat card detail sheets.
  async getItems(userId: string): Promise<WasteItemsResponse> {
    const to = new Date();
    const from = new Date(to.getTime() - WASTE_WINDOW_DAYS * DAY_MS);

    const rows = await this.prisma.stockItem.findMany({
      where: {
        userId,
        disposition: { not: null },
        deletedAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        disposition: true,
        deletedAt: true,
        expirationDate: true,
        quantity: true,
        unit: true,
        product: { select: { name: true, category: true } },
      },
      orderBy: { deletedAt: 'desc' },
      take: ITEMS_CAP,
    });

    const items: WasteResolvedItem[] = [];
    for (const row of rows) {
      if (row.disposition === null || row.deletedAt === null) continue;
      const consumed = row.disposition === 'CONSUMED';
      items.push({
        id: row.id,
        name: row.product.name,
        category: row.product.category,
        quantity: row.quantity,
        unit: row.unit,
        disposition: row.disposition,
        resolvedAt: row.deletedAt.toISOString(),
        expirationDate: row.expirationDate?.toISOString() ?? null,
        rescued: isRescue(row.disposition, row.deletedAt, row.expirationDate),
        co2Kg: consumed
          ? estimateCo2ItemKg({
              quantity: row.quantity,
              unit: row.unit,
              product: { name: row.product.name, category: row.product.category ?? undefined },
            })
          : null,
      });
    }

    return {
      items,
      co2Info: {
        perKgByCategory: CO2_PER_KG,
        perKgDefault: CO2_PER_KG_DEFAULT,
        pieceWeightKg: PIECE_WEIGHT_KG,
      },
    };
  }

  // All-time history, one entry per month. Computed live from the soft-deleted
  // rows; they are never pruned so the data is all still there.
  async getHistory(userId: string): Promise<WasteHistoryResponse> {
    const now = new Date();
    const rows = await this.prisma.stockItem.findMany({
      where: { userId, disposition: { not: null }, deletedAt: { not: null } },
      select: { disposition: true, deletedAt: true },
    });

    const resolved: {
      disposition: NonNullable<(typeof rows)[number]['disposition']>;
      resolvedAt: Date;
    }[] = [];
    for (const row of rows) {
      if (row.disposition === null || row.deletedAt === null) continue;
      resolved.push({ disposition: row.disposition, resolvedAt: row.deletedAt });
    }

    return { months: monthlyScores(resolved, now) };
  }
}
