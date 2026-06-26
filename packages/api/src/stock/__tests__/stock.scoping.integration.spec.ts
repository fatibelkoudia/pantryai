// Integration tests for stock CRUD and user scoping. We don't use database RLS, every
// query is filtered by userId in the service, so these tests make sure that holds up.
// Real test DB on 5433, real HTTP via Supertest.
//
// We swap the JWT guard for a small stub that reads the user from a header, so we can
// act as user A or user B. The rest is real: the controller, the service, the Prisma
// client. The event emitter is faked (the gamification re-sync isn't what we're testing).
//
// Two things to check: a user can do the whole lifecycle on their own items, and a user
// can never read, change or delete someone else's item (403, not a quiet success).
import { ExecutionContext, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { testPrisma } from '../../test-setup.integration.js';
import { StockController } from '../stock.controller.js';
import { StockService } from '../stock.service.js';

const USER_A = 'test-user-id-0000-0000-000000000001';
const USER_B = 'test-user-id-0000-0000-000000000002';

const guardStub = {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { userId: req.headers['x-test-user'] ?? USER_A, email: 'who@pantryai.test' };
    return true;
  },
};

let app: NestFastifyApplication;
// Product all stock items point at; recreated each test (products are truncated).
let productId: string;

async function ensureUserB(): Promise<void> {
  await testPrisma.user.upsert({
    where: { id: USER_B },
    update: {},
    create: { id: USER_B, email: 'userb@pantryai.test', name: 'B', passwordHash: 'x' },
  });
}

// Create a stock item directly in the DB for the given user.
async function seedItem(userId: string): Promise<string> {
  const item = await testPrisma.stockItem.create({
    data: { userId, productId, quantity: 1, unit: 'unit', location: 'PANTRY' },
  });
  return item.id;
}

beforeAll(async () => {
  process.env['DATABASE_TRANSACTION_POOLER_URL'] =
    process.env['DATABASE_TEST_URL'] ??
    'postgresql://pantryai:pantryai@localhost:5433/pantryai_test';
  const prisma = new PrismaService();

  const moduleRef = await Test.createTestingModule({
    controllers: [StockController],
    providers: [
      StockService,
      { provide: PrismaService, useValue: prisma },
      { provide: EventEmitter2, useValue: { emit: () => true } },
    ],
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
});

beforeEach(async () => {
  await ensureUserB();
  const product = await testPrisma.product.create({ data: { name: 'Test Milk' } });
  productId = product.id;
});

describe('Stock CRUD owner lifecycle', () => {
  it('creates, reads, updates and soft-deletes the caller own item', async () => {
    const created = await request(app.getHttpServer())
      .post('/stocks')
      .set('x-test-user', USER_A)
      .send({ productId, quantity: 2, unit: 'L', location: 'FRIDGE' })
      .expect(201);
    const id = created.body.id;
    expect(created.body.userId).toBe(USER_A);

    const got = await request(app.getHttpServer())
      .get(`/stocks/${id}`)
      .set('x-test-user', USER_A)
      .expect(200);
    expect(got.body.quantity).toBe(2);

    const patched = await request(app.getHttpServer())
      .patch(`/stocks/${id}`)
      .set('x-test-user', USER_A)
      .send({ quantity: 5 })
      .expect(200);
    expect(patched.body.quantity).toBe(5);

    await request(app.getHttpServer())
      .delete(`/stocks/${id}?disposition=CONSUMED`)
      .set('x-test-user', USER_A)
      .expect(204);

    // Soft-deleted: it no longer shows up for the owner.
    await request(app.getHttpServer()).get(`/stocks/${id}`).set('x-test-user', USER_A).expect(404);
  });

  it('lists only the caller own items', async () => {
    await seedItem(USER_A);
    await seedItem(USER_A);
    await seedItem(USER_B);

    const res = await request(app.getHttpServer())
      .get('/stocks')
      .set('x-test-user', USER_A)
      .expect(200);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.every((i: { userId: string }) => i.userId === USER_A)).toBe(true);
  });

  it('404s on an unknown id', async () => {
    await request(app.getHttpServer())
      .get('/stocks/does-not-exist')
      .set('x-test-user', USER_A)
      .expect(404);
  });
});

describe("Stock CRUD cross-user denial (can't touch another user's item)", () => {
  it('forbids reading user A item as user B (403)', async () => {
    const id = await seedItem(USER_A);
    await request(app.getHttpServer()).get(`/stocks/${id}`).set('x-test-user', USER_B).expect(403);
  });

  it('forbids updating user A item as user B (403)', async () => {
    const id = await seedItem(USER_A);
    await request(app.getHttpServer())
      .patch(`/stocks/${id}`)
      .set('x-test-user', USER_B)
      .send({ quantity: 99 })
      .expect(403);

    // The item is untouched.
    const item = await testPrisma.stockItem.findUnique({ where: { id } });
    expect(item?.quantity).toBe(1);
  });

  it('forbids deleting user A item as user B (403)', async () => {
    const id = await seedItem(USER_A);
    await request(app.getHttpServer())
      .delete(`/stocks/${id}`)
      .set('x-test-user', USER_B)
      .expect(403);

    // Still live (not soft-deleted).
    const item = await testPrisma.stockItem.findUnique({ where: { id } });
    expect(item?.deletedAt).toBeNull();
  });
});
