import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client.js';

// Models that belong to one user. When you query one of these through forUser(), we add a
// userId filter for you, so if a query forgets to filter by user it still can't read another
// user's rows. Shared tables like Product and Recipe aren't in this list and aren't touched.
const USER_OWNED_MODELS = [
  'StockItem',
  'OcrJob',
  'ShoppingItem',
  'UserDevice',
  'UserXp',
  'UserChallenge',
] as const;

// The query types that take a `where`, which is where we add the userId.
const SCOPED_OPERATIONS = [
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
] as const;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const pool = new Pool({ connectionString: process.env['DATABASE_TRANSACTION_POOLER_URL'] });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }

  // Extra safety layer you opt into. Returns a client that adds `userId` to every read and
  // write on a user-owned model, so even if a query forgets to filter by user, it still can't
  // see or change another user's data. We use it on per-user routes like the RGPD export.
  // Background jobs that need to look at every user (the notification sweep, the R2 sweeper)
  // just keep using the normal client.
  forUser(userId: string) {
    const ownedModels = new Set<string>(USER_OWNED_MODELS);
    const scopedOps = new Set<string>(SCOPED_OPERATIONS);

    return this.$extends({
      query: {
        $allModels: {
          $allOperations({ model, operation, args, query }) {
            if (model && ownedModels.has(model) && scopedOps.has(operation)) {
              const typedArgs = args as { where?: Record<string, unknown> };
              typedArgs.where = { ...typedArgs.where, userId };
            }
            return query(args);
          },
        },
      },
    });
  }
}
