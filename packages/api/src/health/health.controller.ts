import { Controller, Get, Inject, NotFoundException, Query } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';

type Check = 'up' | 'down';

interface HealthReport {
  status: 'ok' | 'degraded';
  db: Check;
  redis: Check;
  uptime: number;
}

// Public liveness/readiness check. Uptime Robot pings this every few minutes and
// the Docker healthcheck hits it too. It touches Postgres and Redis so a green
// /health means the whole request path is actually usable, not just that the
// process is alive.
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness + readiness (database + Redis)' })
  @ApiResponse({ status: 200, description: 'All dependencies reachable' })
  async check(): Promise<HealthReport> {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);
    const status = db === 'up' && redis === 'up' ? 'ok' : 'degraded';
    return { status, db, redis, uptime: Math.round(process.uptime()) };
  }

  private async checkDb(): Promise<Check> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<Check> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
  // This endpoint is used to verify that Sentry is correctly configured. It is not
  // part of the public API and is excluded from the Swagger docs
  @Get('sentry-test')
  @ApiExcludeEndpoint()
  sentryTest(@Query('token') token?: string) {
    const expected = process.env['SENTRY_TEST_TOKEN'];
    if (!expected || token !== expected) throw new NotFoundException();
    throw new Error('Verification Sentry — erreur de test volontaire');
  }
}
