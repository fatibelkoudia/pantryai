// Integration tests for GET /recipes/suggest. Real test DB on 5433, real HTTP via Supertest.
//
// We stub the TheMealDB client to return nothing, so the suggestions only come from the
// bundled French recipes (no network, no Redis). The JWT guard is swapped for a header
// stub so the suggestions are scoped to the caller's own stock.
//
// We check that a user who has the right ingredients gets a matching recipe back (it needs
// at least 70% of them), and that a user with an empty pantry gets nothing.
import { ExecutionContext, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { testPrisma } from '../../test-setup.integration.js';
import { RecipeController } from '../recipe.controller.js';
import { RecipeService } from '../recipe.service.js';
import { TheMealDbClient } from '../themealdb.client.js';

const USER_A = 'test-user-id-0000-0000-000000000001';
const USER_EMPTY = 'test-user-id-0000-0000-000000000002';

const guardStub = {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { userId: req.headers['x-test-user'] ?? USER_A, email: 'who@pantryai.test' };
    return true;
  },
};

let app: NestFastifyApplication;

// Put a product in the caller's stock by name (creates the product + stock row).
async function stock(userId: string, productName: string): Promise<void> {
  const product = await testPrisma.product.create({ data: { name: productName } });
  await testPrisma.stockItem.create({
    data: { userId, productId: product.id, quantity: 1, unit: 'unit', location: 'PANTRY' },
  });
}

beforeAll(async () => {
  process.env['DATABASE_TRANSACTION_POOLER_URL'] =
    process.env['DATABASE_TEST_URL'] ??
    'postgresql://pantryai:pantryai@localhost:5433/pantryai_test';
  const prisma = new PrismaService();

  const moduleRef = await Test.createTestingModule({
    controllers: [RecipeController],
    providers: [
      RecipeService,
      { provide: PrismaService, useValue: prisma },
      // Offline: pretend TheMealDB found nothing, so only local recipes are scored.
      { provide: TheMealDbClient, useValue: { searchByIngredients: async () => [] } },
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
  // Eggs + butter cover "Omelette nature" (salt/pepper are pantry staples, ignored),
  // so it should score 1.0 and come back as a suggestion.
  await stock(USER_A, 'oeufs');
  await stock(USER_A, 'beurre');
});

describe('GET /recipes/suggest', () => {
  it('suggests a recipe the caller can make from their stock, scoped to them', async () => {
    const res = await request(app.getHttpServer())
      .get('/recipes/suggest')
      .set('x-test-user', USER_A)
      .expect(200);

    expect(Array.isArray(res.body.suggestions)).toBe(true);
    const omelette = res.body.suggestions.find(
      (s: { recipe: { name: string } }) => s.recipe.name === 'Omelette nature',
    );
    expect(omelette).toBeDefined();
    // Every suggestion respects the 70% contract and carries its missing list.
    for (const s of res.body.suggestions) {
      expect(s.score).toBeGreaterThanOrEqual(0.7);
      expect(Array.isArray(s.missingIngredients)).toBe(true);
    }
    // Holding both eggs and butter, the omelette has nothing missing.
    expect(omelette.missingIngredients).toEqual([]);
  });

  it('returns no suggestions for a user with an empty pantry', async () => {
    const res = await request(app.getHttpServer())
      .get('/recipes/suggest')
      .set('x-test-user', USER_EMPTY)
      .expect(200);

    expect(res.body.suggestions).toEqual([]);
  });
});
