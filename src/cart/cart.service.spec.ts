import {
  BadRequestException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CartService } from './cart.service';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { clearTestDatabase } from '../../test/database';

describe('CartService with PostgreSQL', () => {
  let db: PrismaService;
  let cart: CartService;
  beforeEach(async () => {
    db = new PrismaService();
    await db.onModuleInit();
    await clearTestDatabase(db);
    cart = new CartService(db);
  });
  afterEach(async () => {
    await db.onModuleDestroy();
  });
  it('calculates prices, isolates carts and rejects invalid mutations', async () => {
    const a = randomUUID(),
      b = randomUUID();
    await cart.change(a, 'keyboard', 2, true);
    expect((await cart.getCart(a)).totalMinor).toBe(29800);
    expect((await cart.getCart(b)).items).toEqual([]);
    await cart.change(a, 'keyboard', 1, true);
    expect((await cart.getCart(a)).items[0].quantity).toBe(3);
    await cart.change(a, 'keyboard', 1);
    expect((await cart.remove(a, 'keyboard')).totalMinor).toBe(0);
    await expect(cart.getCart('invalid')).rejects.toThrow(BadRequestException);
    await expect(cart.change(a, 'missing', 1)).rejects.toThrow(
      NotFoundException,
    );
    for (const quantity of [0, -1, 1.5, '2', 100, undefined])
      await expect(cart.change(a, 'dock', quantity)).rejects.toThrow(
        BadRequestException,
      );
    await cart.change(a, 'dock', 99);
    await expect(cart.change(a, 'dock', 1, true)).rejects.toThrow(
      BadRequestException,
    );
    expect((await cart.getCart(a)).items[0].quantity).toBe(99);
  });
  it('serializes concurrent increments across two independent connections', async () => {
    const otherDb = new PrismaService();
    await otherDb.onModuleInit();
    try {
      const other = new CartService(otherDb),
        key = randomUUID();
      await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          (i % 2 ? other : cart).change(key, 'dock', 1, true),
        ),
      );
      const result = await cart.getCart(key);
      expect(result.items[0].quantity).toBe(20);
      expect(result.revision).toBe(20);
    } finally {
      await otherDb.onModuleDestroy();
    }
  });
  it('claims a guest cart once under concurrent merges and mutations', async () => {
    const auth = new AuthService(db);
    const user = await auth.register({
      email: 'merge@example.com',
      name: 'Merge',
      password: 'correct horse battery staple',
    });
    const guest = randomUUID();
    await cart.change(guest, 'dock', 2);
    await Promise.all([
      cart.mergeGuest(guest, user.id),
      cart.mergeGuest(guest.toUpperCase(), user.id),
      cart.change(`user:${user.id}`, 'dock', 1, true),
    ]);
    expect((await cart.getCart(`user:${user.id}`)).items[0].quantity).toBe(3);
    await expect(cart.getCart(guest)).rejects.toThrow(GoneException);
    await expect(cart.change(guest, 'dock', 1)).rejects.toThrow(GoneException);
    expect(await db.guestClaim.count()).toBe(1);
  });
});
