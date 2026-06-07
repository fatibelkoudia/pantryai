import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDeviceDto } from './dto/register-device.dto.js';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  // Save the caller's Expo push token. We look it up by the token itself, so if the
  // same phone gets used by a different account later, the row just switches to the new user.
  async register(userId: string, dto: RegisterDeviceDto) {
    return this.prisma.userDevice.upsert({
      where: { expoPushToken: dto.expoPushToken },
      update: { userId, platform: dto.platform },
      create: { userId, expoPushToken: dto.expoPushToken, platform: dto.platform },
    });
  }
}
