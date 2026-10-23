import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

type StoredCart = { quantities: Record<string, number>; revision: number };

@Injectable()
export class CartService {
  constructor(private readonly database: PrismaService) {}
  validateGuestKey(key: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        key ?? '',
      )
    ) {
      throw new BadRequestException('X-Cart-Key must be a UUID v4');
    }
  }
  private normalize(key: string) {
    if (!key.startsWith('user:')) this.validateGuestKey(key);
    return key.toLowerCase();
  }
  private async cart(
    tx: Prisma.TransactionClient,
    key: string,
  ): Promise<StoredCart> {
    if (
      !key.startsWith('user:') &&
      (await tx.guestClaim.findUnique({ where: { cartId: key } }))
    ) {
      throw new GoneException(
        'Гостевая корзина уже перенесена. Обновите сессию.',
      );
    }
    const row = await tx.cart.findUnique({ where: { id: key } });
    return {
      quantities: (row?.quantities ?? {}) as Record<string, number>,
      revision: row?.revision ?? 0,
    };
  }
  private async save(
    tx: Prisma.TransactionClient,
    key: string,
    cart: StoredCart,
  ) {
    await tx.cart.upsert({
      where: { id: key },
      create: { id: key, ...cart },
      update: cart,
    });
  }
  private async response(tx: Prisma.TransactionClient, cart: StoredCart) {
    const products = await tx.product.findMany({
      where: { id: { in: Object.keys(cart.quantities) } },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    const items = Object.entries(cart.quantities).map(
      ([productId, quantity]) => {
        const product = byId.get(productId);
        if (!product) throw new NotFoundException('Product not found');
        return {
          productId,
          title: product.title,
          priceMinor: product.priceMinor,
          quantity,
        };
      },
    );
    return {
      items,
      totalMinor: items.reduce(
        (sum, item) => sum + item.priceMinor * item.quantity,
        0,
      ),
      currency: 'USD',
      revision: cart.revision,
    };
  }
  async mergeGuest(guest: string, userId: string) {
    this.validateGuestKey(guest);
    guest = this.normalize(guest);
    const targetKey = `user:${userId}`;
    await this.database.withLocks(
      [`cart:${guest}`, `cart:${targetKey}`],
      async (tx) => {
        if (await tx.guestClaim.findUnique({ where: { cartId: guest } }))
          return;
        const source = await this.cart(tx, guest);
        const target = await this.cart(tx, targetKey);
        for (const [id, quantity] of Object.entries(source.quantities)) {
          target.quantities[id] = Math.min(
            99,
            (target.quantities[id] ?? 0) + quantity,
          );
        }
        target.revision += 1;
        await this.save(tx, targetKey, target);
        await tx.guestClaim.create({ data: { cartId: guest, userId } });
        await tx.cart.deleteMany({ where: { id: guest } });
      },
    );
  }
  async getCart(key: string) {
    key = this.normalize(key);
    return this.database.withLocks([`cart:${key}`], async (tx) =>
      this.response(tx, await this.cart(tx, key)),
    );
  }
  async change(
    key: string,
    productId: unknown,
    quantity: unknown,
    add = false,
  ) {
    key = this.normalize(key);
    if (typeof productId !== 'string')
      throw new NotFoundException('Product not found');
    if (
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    )
      throw new BadRequestException('Quantity must be an integer from 1 to 99');
    return this.database.withLocks([`cart:${key}`], async (tx) => {
      const cart = await this.cart(tx, key);
      if (!(await tx.product.findUnique({ where: { id: productId } })))
        throw new NotFoundException('Product not found');
      const next = quantity + (add ? (cart.quantities[productId] ?? 0) : 0);
      if (next > 99) throw new BadRequestException('Maximum quantity is 99');
      cart.quantities[productId] = next;
      cart.revision += 1;
      await this.save(tx, key, cart);
      return this.response(tx, cart);
    });
  }
  async remove(key: string, productId: string) {
    key = this.normalize(key);
    return this.database.withLocks([`cart:${key}`], async (tx) => {
      const cart = await this.cart(tx, key);
      if (Object.hasOwn(cart.quantities, productId)) {
        delete cart.quantities[productId];
        cart.revision += 1;
      }
      await this.save(tx, key, cart);
      return this.response(tx, cart);
    });
  }
}
