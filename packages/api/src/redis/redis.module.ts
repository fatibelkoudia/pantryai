import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

// Makes one ioredis client we can share across the app. Same connection
// settings as the BullMQ queue (REDIS_HOST / REDIS_PORT) so we only point at
// one Redis. Right now the product OFF cache is the only thing using it.
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis =>
        new Redis({
          host: process.env['REDIS_HOST'] ?? 'localhost',
          port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
          // Don't let a missing/slow Redis hang requests forever.
          maxRetriesPerRequest: 2,
          enableOfflineQueue: false,
        }),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  // Nest hands us the same instance it created from the factory above.
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
