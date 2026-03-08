import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';
import { defineConfig } from 'prisma/config';

config({ path: resolve(import.meta.dirname, '.env') });

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  datasource: {
    // Use direct connection for all Prisma CLI operations (migrations, introspection).
    // Runtime queries go through the pooler via DATABASE_TRANSACTION_POOLER_URL in prisma.service.ts.
    url: (process.env['DATABASE_DIRECT_URL'] ??
      process.env['DATABASE_TRANSACTION_POOLER_URL']) as string,
  },
  migrate: {
    async adapter() {
      // Use direct connection (not pooler) for migrations — PgBouncer transaction
      // mode (port 6543) doesn't support the advisory locks Prisma needs.
      const url =
        process.env['DATABASE_DIRECT_URL'] ?? process.env['DATABASE_TRANSACTION_POOLER_URL'];
      const pool = new Pool({ connectionString: url });
      return new PrismaPg(pool);
    },
  },
});
