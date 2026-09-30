import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString)
      throw new Error(
        'DATABASE_URL is required. Run npm run db:setup; see docs/DATABASE_GUIDE.md.',
      );
    super({
      adapter: new PrismaPg({
        connectionString,
        max: 10,
        connectionTimeoutMillis: 5000,
      }),
    });
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Locks cover missing rows too. Sorted keys avoid deadlocks. READ COMMITTED
  // lets queries after a waited lock see changes committed by the previous owner.
  async withLocks<T>(
    keys: string[],
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(
      async (tx) => {
        for (const key of [...new Set(keys)].sort()) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
        }
        return action(tx);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10000,
        timeout: 15000,
      },
    );
  }
}
