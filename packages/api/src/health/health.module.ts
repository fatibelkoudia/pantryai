import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

// PrismaService and the Redis client are both @Global, so we only need to list
// the controller here.
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
