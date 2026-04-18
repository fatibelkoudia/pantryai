import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStockItemDto } from './dto/create-stock-item.dto.js';
import { StockQueryDto } from './dto/stock-query.dto.js';
import { UpdateStockItemDto } from './dto/update-stock-item.dto.js';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: StockQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const where = {
      userId,
      deletedAt: null,
      ...(query.location !== undefined && { location: query.location }),
      ...(query.expiringSoon === true && {
        expirationDate: { not: null, lte: sevenDaysFromNow },
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

    return this.prisma.stockItem.create({
      data: {
        userId,
        productId: dto.productId,
        quantity: dto.quantity,
        unit: dto.unit,
        expirationDate: dto.expirationDate ?? null,
        location: dto.location ?? 'PANTRY',
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

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.stockItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
