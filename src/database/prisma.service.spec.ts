import { PrismaService } from './prisma.service';
import { HttpException } from '@nestjs/common';
import { AuthService, sessionCookie } from '../auth/auth.service';
import { CartService } from '../cart/cart.service';
import { clearTestDatabase } from '../../test/database';

it('persists users, sessions and carts across connection reopen', async () => {
  let db = new PrismaService();
  await db.onModuleInit();
  try {
    await clearTestDatabase(db);
    let auth = new AuthService(db);
    const user = await auth.register({
      name: 'Persistent',
      email: 'persist@example.com',
      password: 'long test password',
    });
    const token = await auth.start(user);
    await new CartService(db).change(`user:${user.id}`, 'dock', 3);
    await db.onModuleDestroy();
    db = new PrismaService();
    await db.onModuleInit();
    auth = new AuthService(db);
    expect((await auth.user(`${sessionCookie}=${token}`))?.id).toBe(user.id);
    expect(
      (await new CartService(db).getCart(`user:${user.id}`)).items[0].quantity,
    ).toBe(3);
    expect(
      (
        await auth.login({
          email: user.email,
          password: 'long test password',
          name: '',
        })
      ).id,
    ).toBe(user.id);
  } finally {
    await db.onModuleDestroy();
  }
});

it('limits concurrent authentication attempts atomically', async () => {
  const db = new PrismaService();
  await db.onModuleInit();
  try {
    await clearTestDatabase(db);
    const auth = new AuthService(db);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        auth.limit('test-ip', 'limit@example.com'),
      ),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(10);
    for (const result of results)
      if (result.status === 'rejected') {
        expect(result.reason).toBeInstanceOf(HttpException);
        expect((result.reason as HttpException).getStatus()).toBe(429);
      }
    expect(
      (
        await db.authAttempt.findUniqueOrThrow({
          where: { bucket: 'email:limit@example.com' },
        })
      ).attempts,
    ).toBe(10);
  } finally {
    await db.onModuleDestroy();
  }
});
