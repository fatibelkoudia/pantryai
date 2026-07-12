import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ProfileResponseDto } from './dto/profile-response.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto.js';
import { UserExportDto } from './dto/user-export.dto.js';

// same cost as register in auth.service.ts, the hashes have to stay comparable
const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Update name, email and/or avatar. We check the email is free first because
  // two accounts with the same email would break login. There is no confirmation
  // email step, we have no mail server, the change just applies.
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
    const user = await this.findActiveUser(userId);

    if (dto.email !== undefined && dto.email !== user.email) {
      const taken = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (taken) {
        throw new ConflictException('Email is already in use');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.avatarId !== undefined && { avatarId: dto.avatarId }),
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarId: updated.avatarId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  // The user proves they know the current password, then we store a hash of the
  // new one. Wrong current password gives a 401, same as a failed login.
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.findActiveUser(userId);

    const currentOk = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentOk) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  // The settings row is created on first read with the schema defaults, so
  // accounts made before this feature existed get one too.
  async getSettings(userId: string) {
    await this.findActiveUser(userId);
    return this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async updateSettings(userId: string, dto: UpdateUserSettingsDto) {
    await this.findActiveUser(userId);
    return this.prisma.userSettings.upsert({
      where: { userId },
      // first save and the row doesn't exist yet: create it with the changes on top of defaults
      create: { userId, ...dto },
      update: { ...dto },
    });
  }

  private async findActiveUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  // RGPD Article 20: build a copy of everything we store about this user so they can take it.
  // The reads go through the per-user scoped client, so they can only return this user's rows.
  // For OCR jobs we only send the metadata, never the imageKey or the raw text.
  async exportUserData(userId: string): Promise<UserExportDto> {
    const scoped = this.prisma.forUser(userId);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    const [stockItems, ocrJobs, settings] = await Promise.all([
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
      // settings are part of the user's data too (RGPD wants everything)
      this.prisma.userSettings.findUnique({ where: { userId } }),
    ]);

    return {
      exportedAt: new Date(),
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarId: user.avatarId,
        createdAt: user.createdAt,
      },
      settings: settings
        ? {
            locale: settings.locale,
            recipeMinMatchedItems: settings.recipeMinMatchedItems,
            recipeMatchThreshold: settings.recipeMatchThreshold,
            expiringSoonDays: settings.expiringSoonDays,
            lowStockThreshold: settings.lowStockThreshold,
            defaultStockLocation: settings.defaultStockLocation,
          }
        : null,
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
