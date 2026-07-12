import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { StockDisposition } from '@pantryai/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStockItemDto } from './dto/create-stock-item.dto.js';
import { StockQueryDto } from './dto/stock-query.dto.js';
import { UpdateStockItemDto } from './dto/update-stock-item.dto.js';
import { STOCK_REMOVED, type StockRemovedEvent } from './stock.events.js';

// Matches the default of UserSettings.expiringSoonDays for users without a settings row.
const DEFAULT_EXPIRING_SOON_DAYS = 3;

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async findAll(userId: string, query: StockQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // "expiring soon" used to be a fixed 7 days, now the user can set the window
    // on their profile page. No settings row means they kept the default.
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    const soonDays = settings?.expiringSoonDays ?? DEFAULT_EXPIRING_SOON_DAYS;
    const soonCutoff = new Date(Date.now() + soonDays * 24 * 60 * 60 * 1000);

    const where = {
      userId,
      deletedAt: null,
      ...(query.location !== undefined && { location: query.location }),
      ...(query.expiringSoon === true && {
        expirationDate: { not: null, lte: soonCutoff },
      }),
      ...(query.search !== undefined && {
        product: { name: { contains: query.search, mode: 'insensitive' as const } },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.stockItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { addedAt: 'desc' },
        include: { product: true },
      }),
      this.prisma.stockItem.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  async findOne(id: string, userId: string) {
    const item = await this.prisma.stockItem.findFirst({
      where: { id, deletedAt: null },
      include: { product: true },
    });
    if (!item) throw new NotFoundException('Stock item not found');
    if (item.userId !== userId) throw new ForbiddenException();
    return item;
  }

  async create(userId: string, dto: CreateStockItemDto) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) {
      throw new NotFoundException(`Product not found: ${dto.productId}`);
    }

    // when the client doesn't say where the item goes, fall back to the default
    // location the user picked in their settings (and PANTRY if they never did)
    const settings = dto.location
      ? null
      : await this.prisma.userSettings.findUnique({ where: { userId } });
    const location = dto.location ?? settings?.defaultStockLocation ?? 'PANTRY';

    return this.prisma.stockItem.create({
      data: {
        userId,
        productId: dto.productId,
        quantity: dto.quantity,
        unit: dto.unit,
        expirationDate: dto.expirationDate ?? null,
        location,
      },
      include: { product: true },
    });
  }

  async update(id: string, userId: string, dto: UpdateStockItemDto) {
    await this.findOne(id, userId);
    return this.prisma.stockItem.update({
      where: { id },
      data: {
        ...(dto.productId !== undefined && { productId: dto.productId }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.expirationDate !== undefined && { expirationDate: dto.expirationDate }),
        ...(dto.location !== undefined && { location: dto.location }),
      },
      include: { product: true },
    });
  }

  async remove(id: string, userId: string, disposition?: StockDisposition) {
    const item = await this.findOne(id, userId);
    await this.prisma.stockItem.update({
      where: { id },
      data: { deletedAt: new Date(), disposition: disposition ?? defaultDisposition(item) },
    });
    // Tell the gamification module so it can re-check the user's challenges.
    this.events.emit(STOCK_REMOVED, { userId } satisfies StockRemovedEvent);
  }
}

// When the client doesn't say how the item left the pantry, infer it: an item
// removed past its expiration date is treated as EXPIRED waste, otherwise we
// assume it was eaten (CONSUMED). An explicit DISCARDED only ever comes from the UI.
function defaultDisposition(item: { expirationDate: Date | null }): StockDisposition {
  if (item.expirationDate && item.expirationDate.getTime() < Date.now()) {
    return 'EXPIRED';
  }
  return 'CONSUMED';
}
