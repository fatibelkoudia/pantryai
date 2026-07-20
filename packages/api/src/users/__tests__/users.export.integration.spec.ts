/**
 * Integration tests for GET /users/me/export (RGPD Article 20).
 * Real test DB (5433), full HTTP through Supertest against a real Nest + Fastify app.
 *
 * The controller and service are built by Nest's DI container (SWC adds the decorator
 * metadata that makes constructor injection work under vitest). We swap the JwtAuthGuard for
 * a stub so a header decides who is "logged in". Everything else (pipes, controller, service,
 * the scoped Prisma client) is the real thing.
 *
 * We check two things: the export gives back all of the caller's data with no image keys or
 * raw text, and user A's export never contains user B's rows (the app-level userId scoping).
 */
import { ExecutionContext, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { testPrisma } from '../../test-setup.integration.js';
import { UsersController } from '../users.controller.js';
import { UsersService } from '../users.service.js';

// User A is the stable user that test-setup recreates before each test.
const USER_A = 'test-user-id-0000-0000-000000000001';
const USER_B = 'test-user-id-0000-0000-000000000002';

// Stub guard: read the logged-in user from a header so we can act as A or B.
const guardStub = {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { userId: req.headers['x-test-user'] ?? USER_A, email: 'who@pantryai.test' };
    return true;
  },
};

let app: NestFastifyApplication;
let prisma: PrismaService;

beforeAll(async () => {
  // PrismaService reads the pooler URL in its constructor; point it at the test DB so
  // forUser() runs against the same database the seed helpers write to.
  process.env['DATABASE_TRANSACTION_POOLER_URL'] =
    process.env['DATABASE_TEST_URL'] ??
    'postgresql://pantryai:pantryai@localhost:5433/pantryai_test';
  prisma = new PrismaService();

  const moduleRef = await Test.createTestingModule({
    controllers: [UsersController],
    providers: [UsersService, { provide: PrismaService, useValue: prisma }],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(guardStub)
    .compile();

  app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function seedUser(userId: string, label: string): Promise<void> {
  if (userId !== USER_A) {
    // The shared setup wipes stock/ocr/products but not users, so user B can stick around
    // between tests. Upsert keeps the seeding safe to run every time.
    await testPrisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: `${label}@pantryai.test`, name: label, passwordHash: 'x' },
    });
  }

  const product = await testPrisma.product.create({ data: { name: `${label}-milk` } });
  await testPrisma.stockItem.create({
    data: { userId, productId: product.id, quantity: 2, unit: 'unit', location: 'PANTRY' },
  });
  await testPrisma.ocrJob.create({
    data: {
      userId,
      status: 'COMPLETED',
      retailer: `${label}-store`,
      imageKey: `receipts/${userId}/job.jpg`,
      rawText: 'secret raw OCR text',
      parsedItems: [{ name: `${label}-milk`, quantity: 2 }],
      completedAt: new Date(),
    },
  });
}

beforeEach(async () => {
  await seedUser(USER_A, 'alice');
  await seedUser(USER_B, 'bob');
});

describe('GET /users/me/export', () => {
  it("returns the caller's full profile, stock and ocr metadata", async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me/export')
      .set('x-test-user', USER_A)
      .expect(200);

    expect(res.body.profile.id).toBe(USER_A);
    expect(res.body.stockItems).toHaveLength(1);
    expect(res.body.stockItems[0].product).toBe('alice-milk');
    expect(res.body.ocrJobs).toHaveLength(1);
    expect(res.body.ocrJobs[0].retailer).toBe('alice-store');
    expect(res.body.exportedAt).toBeDefined();
  });

  it('never exposes receipt image keys or raw OCR text', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me/export')
      .set('x-test-user', USER_A)
      .expect(200);

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('imageKey');
    expect(serialized).not.toContain('receipts/');
    expect(serialized).not.toContain('secret raw OCR text');
  });

  it("does not leak another user's data (cross-user denial via scoping)", async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me/export')
      .set('x-test-user', USER_A)
      .expect(200);

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('bob');
    expect(res.body.stockItems.every((s: { product: string }) => s.product === 'alice-milk')).toBe(
      true,
    );
    expect(res.body.ocrJobs.every((j: { retailer: string }) => j.retailer === 'alice-store')).toBe(
      true,
    );
  });
});
