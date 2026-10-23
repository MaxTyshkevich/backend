import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node scripts/seed.mjs',
  },
  datasource: {
    // Generation/build need no database. Connecting commands must supply a URL.
    url: process.env.DATABASE_URL ?? '',
  },
});
