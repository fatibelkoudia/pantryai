import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExpoPushMessage, sendExpoPushMessages } from './expo-push.js';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Runs every day at 08:00. It's just a wrapper so we can call the real logic
  // directly from tests without waiting for the schedule to fire.
  @Cron('0 8 * * *')
  async handleExpirationAlerts(): Promise<void> {
    await this.checkExpiringItems();
  }

  async checkExpiringItems(): Promise<void> {
    const threshold = new Date(Date.now() + THREE_DAYS_MS);

    // Items expiring within 3 days that we haven't alerted on yet.
    // We don't load product names on purpose: the message stays generic so we don't
    // send what people have in their fridge out to Expo's push servers.
    const items = await this.prisma.stockItem.findMany({
      where: {
        deletedAt: null,
        expirationNotifiedAt: null,
        expirationDate: { not: null, lte: threshold },
      },
    });

    if (items.length === 0) {
      this.logger.log('Expiration alerts: no items to notify');
      return;
    }

    // Group items by user so each user gets a single summary push per device.
    const byUser = new Map<string, typeof items>();
    for (const item of items) {
      const list = byUser.get(item.userId) ?? [];
      list.push(item);
      byUser.set(item.userId, list);
    }

    const messages: ExpoPushMessage[] = [];
    const notifiedItemIds: string[] = [];

    for (const [userId, userItems] of byUser) {
      const devices = await this.prisma.userDevice.findMany({ where: { userId } });
      if (devices.length === 0) continue;

      const count = userItems.length;
      const body =
        count === 1
          ? '1 item in your pantry is expiring soon. Open PantryAI to check it.'
          : `${count} items in your pantry are expiring soon. Open PantryAI to check them.`;

      for (const device of devices) {
        messages.push({
          to: device.expoPushToken,
          title: 'Food expiring soon',
          body,
          data: { type: 'expiring' },
        });
      }

      // Mark these items as notified regardless of how many devices the user has.
      notifiedItemIds.push(...userItems.map((i) => i.id));
    }

    if (messages.length === 0) {
      this.logger.log(`Expiration alerts: ${items.length} items but no registered devices`);
      return;
    }

    await sendExpoPushMessages(messages);

    await this.prisma.stockItem.updateMany({
      where: { id: { in: notifiedItemIds } },
      data: { expirationNotifiedAt: new Date() },
    });

    this.logger.log(
      `Expiration alerts: sent ${messages.length} push messages for ${notifiedItemIds.length} items`,
    );
  }
}
