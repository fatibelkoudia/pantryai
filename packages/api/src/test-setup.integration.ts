import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeEach } from 'vitest';
import { PrismaClient } from './generated/prisma/client.js';

// This file is loaded before any test files, and sets up a shared Prisma client for integration tests.
const pool = new Pool({
  connectionString:
    process.env['DATABASE_TEST_URL'] ??
    'postgresql://pantryai:pantryai@localhost:5433/pantryai_test',
});

export const testPrisma = new PrismaClient({ adapter: new PrismaPg(pool) });

beforeEach(async () => {
  // Truncate in FK-safe order: stock_items -> ocr_jobs -> products -> users
  await testPrisma.$executeRaw`TRUNCATE TABLE "stock_items" CASCADE`;
  await testPrisma.$executeRaw`TRUNCATE TABLE "ocr_jobs" CASCADE`;
  await testPrisma.$executeRaw`TRUNCATE TABLE "products" CASCADE`;
  // Keep one stable test user so ocr_jobs.userId FK is always valid
  await testPrisma.$executeRaw`
    INSERT INTO "users" ("id", "email", "name", "passwordHash", "createdAt", "updatedAt")
    VALUES (
      'test-user-id-0000-0000-000000000001',
      'test@pantryai.test',
      'Test User',
      '$2b$10$placeholder',
      NOW(), NOW()
    )
    ON CONFLICT ("id") DO NOTHING
  `;
});

afterAll(async () => {
  await testPrisma.$disconnect();
  await pool.end();
});
