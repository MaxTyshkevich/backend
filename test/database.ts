import { PrismaService } from '../src/database/prisma.service';

export async function clearTestDatabase(database: PrismaService) {
  const url = new URL(process.env.DATABASE_URL || '');
  if (
    url.pathname !== '/microfronts_test' ||
    !['localhost', '127.0.0.1', 'db-test'].includes(url.hostname)
  ) {
    throw new Error('Refusing to clear a non-test database');
  }
  await database.$transaction([
    database.session.deleteMany(),
    database.guestClaim.deleteMany(),
    database.cart.deleteMany(),
    database.authAttempt.deleteMany(),
    database.user.deleteMany(),
  ]);
}
