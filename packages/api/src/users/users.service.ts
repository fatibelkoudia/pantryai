import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserExportDto } from './dto/user-export.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // RGPD Article 20: build a copy of everything we store about this user so they can take it.
  // The reads go through the per-user scoped client, so they can only return this user's rows.
  // For OCR jobs we only send the metadata, never the imageKey or the raw text.
  async exportUserData(userId: string): Promise<UserExportDto> {
    const scoped = this.prisma.forUser(userId);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    const [stockItems, ocrJobs] = await Promise.all([
      scoped.stockItem.findMany({
        where: { deletedAt: null },
        orderBy: { addedAt: 'desc' },
        select: {
          id: true,
          quantity: true,
          unit: true,
          expirationDate: true,
          location: true,
          addedAt: true,
          product: { select: { name: true, ean13: true } },
        },
      }),
      scoped.ocrJob.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          retailer: true,
          parsedItems: true,
          createdAt: true,
          completedAt: true,
        },
      }),
    ]);

    return {
      exportedAt: new Date(),
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      stockItems: stockItems.map((item) => ({
        id: item.id,
        product: item.product.name,
        ean13: item.product.ean13,
        quantity: item.quantity,
        unit: item.unit,
        expirationDate: item.expirationDate,
        location: item.location,
        addedAt: item.addedAt,
      })),
      ocrJobs: ocrJobs.map((job) => ({
        id: job.id,
        status: job.status,
        retailer: job.retailer,
        parsedItems: job.parsedItems,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      })),
    };
  }
}
