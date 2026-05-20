// Integration tests for the auth flow (register -> login -> refresh -> guarded route).
// Real test DB on 5433, real HTTP through Supertest, real JWT signing and the real
// Passport strategy guarding GET /auth/me. We only fake R2 storage (the delete-account
// path uses it, none of these flows do).
//
// The idea is to check the whole thing hangs together: a new user can log in, trade a
// refresh token for a fresh access token, reach a guarded route with it, and a missing
// or expired token gets a 401.
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service.js';
import { R2StorageService } from '../../storage/r2-storage.service.js';
import '../../test-setup.integration.js';
import { AuthController } from '../auth.controller.js';
import { AuthService } from '../auth.service.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { JwtStrategy } from '../strategies/jwt.strategy.js';

const JWT_SECRET = 'test-access-secret';
const JWT_REFRESH_SECRET = 'test-refresh-secret';

let app: NestFastifyApplication;
let jwt: JwtService;

// A fresh email per registration; the shared setup never truncates the users table.
let counter = 0;
const freshEmail = () => `flow-${Date.now()}-${counter++}@pantryai.test`;

async function register(email = freshEmail(), password = 'Sup3rSecret!') {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password, name: 'Flow Tester' })
    .expect(201);
  return { email, password, ...res.body } as {
    email: string;
    password: string;
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; name: string | null };
  };
}

beforeAll(async () => {
  // JwtStrategy reads JWT_SECRET in its constructor and AuthService signs refresh
  // tokens with JWT_REFRESH_SECRET, so both must be set before the module compiles.
  process.env['JWT_SECRET'] = JWT_SECRET;
  process.env['JWT_REFRESH_SECRET'] = JWT_REFRESH_SECRET;
  process.env['DATABASE_TRANSACTION_POOLER_URL'] =
    process.env['DATABASE_TEST_URL'] ??
    'postgresql://pantryai:pantryai@localhost:5433/pantryai_test';
  const prisma = new PrismaService();

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ ignoreEnvFile: true }),
      PassportModule,
      JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '15m' } }),
    ],
    controllers: [AuthController],
    providers: [
      AuthService,
      JwtStrategy,
      JwtAuthGuard,
      { provide: PrismaService, useValue: prisma },
      { provide: R2StorageService, useValue: { deleteObject: async () => undefined } },
    ],
  }).compile();

  app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  jwt = moduleRef.get(JwtService);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
});

describe('Auth flow', () => {
  it('registers a user and returns a token pair', async () => {
    const session = await register();
    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
    expect(session.user.email).toBe(session.email);
  });

  it('rejects registering the same email twice (409)', async () => {
    const session = await register();
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: session.email, password: 'whatever1!' })
      .expect(409);
  });

  it('logs in with the right credentials and 401s on a wrong password', async () => {
    const session = await register();

    const ok = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: session.email, password: session.password })
      .expect(200);
    expect(ok.body.accessToken).toBeTruthy();

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: session.email, password: 'wrong-password' })
      .expect(401);
  });

  it('swaps a refresh token for a fresh access token', async () => {
    const session = await register();
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('rejects a garbage refresh token (401)', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'not-a-real-token' })
      .expect(401);
  });

  it('reaches the guarded GET /auth/me with a valid access token', async () => {
    const session = await register();
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(res.body.id).toBe(session.user.id);
    expect(res.body.email).toBe(session.email);
  });

  it('rejects GET /auth/me with no token (401)', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rejects GET /auth/me with an expired access token (401)', async () => {
    const session = await register();
    const expired = jwt.sign(
      { sub: session.user.id, email: session.email },
      { secret: JWT_SECRET, expiresIn: '-1s' },
    );
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
  });
});
