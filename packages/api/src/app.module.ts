import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { validateEnv } from './config/env.validation.js';
import { DevicesModule } from './devices/devices.module.js';
import { GamificationModule } from './gamification/gamification.module.js';
import { HealthModule } from './health/health.module.js';
import { LearningModule } from './learning/learning.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OcrModule } from './ocr/ocr.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProductModule } from './product/product.module.js';
import { RecipesModule } from './recipes/recipes.module.js';
import { RedisModule } from './redis/redis.module.js';
import { ShoppingListModule } from './shopping-list/shopping-list.module.js';
import { StockModule } from './stock/stock.module.js';
import { StorageModule } from './storage/storage.module.js';
import { UsersModule } from './users/users.module.js';
import { WasteModule } from './waste/waste.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    BullModule.forRoot({
      connection: {
        host: process.env['REDIS_HOST'] ?? 'localhost',
        port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
      },
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    StorageModule,
    AuthModule,
    UsersModule,
    ProductModule,
    StockModule,
    WasteModule,
    RecipesModule,
    ShoppingListModule,
    LearningModule,
    OcrModule,
    DevicesModule,
    NotificationsModule,
    GamificationModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
