import {
  BadRequestException,
  Injectable,
  NotFoundException,
  GoneException,
} from '@nestjs/common';
import { DatabaseService } from './database.service';

const products = [
  {
    id: 'keyboard',
    title: 'Split keyboard',
    priceMinor: 14900,
    currency: 'USD',
    badge: 'new',
  },
  {
    id: 'monitor',
    title: 'Portable monitor',
    priceMinor: 22900,
    currency: 'USD',
  },
  {
    id: 'dock',
    title: 'USB-C dock',
    priceMinor: 11900,
    currency: 'USD',
    badge: 'team pick',
  },
];
type StoredCart = { quantities: Map<string, number>; revision: number };

@Injectable()
export class ShopService {
  constructor(private readonly database: DatabaseService) {}
  listProducts() {
    return products.map((product) => ({ ...product }));
  }

  validateGuestKey(key: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        key ?? '',
      )
    ) {
      throw new BadRequestException('X-Cart-Key must be a UUID v4');
    }
  }
  private cart(key: string): StoredCart {
    if (!key.startsWith('user:')) {
      this.validateGuestKey(key);
      if (this.database.db.prepare('SELECT cart_id FROM guest_claims WHERE cart_id = ?').get(key))
        throw new GoneException('Гостевая корзина уже перенесена. Обновите сессию.');
    }
    const row = this.database.db.prepare('SELECT quantities, revision FROM carts WHERE id = ?').get(key);
    return { quantities: new Map(Object.entries(JSON.parse(String(row?.quantities ?? '{}')))), revision: Number(row?.revision ?? 0) };
  }
  private save(key: string, cart: StoredCart) {
    this.database.db.prepare(`INSERT INTO carts VALUES (?, ?, ?) ON CONFLICT(id)
      DO UPDATE SET quantities = excluded.quantities, revision = excluded.revision`)
      .run(key, JSON.stringify(Object.fromEntries(cart.quantities)), cart.revision);
  }
  mergeGuest(guest: string, userId: string) {
    this.validateGuestKey(guest);
    this.database.transaction(() => {
      if (this.database.db.prepare('SELECT cart_id FROM guest_claims WHERE cart_id = ?').get(guest)) return;
      const source = this.cart(guest);
      const target = this.cart(`user:${userId}`);
      for (const [id, quantity] of source.quantities) target.quantities.set(id, Math.min(99, (target.quantities.get(id) ?? 0) + quantity));
      target.revision += 1;
      this.save(`user:${userId}`, target);
      this.database.db.prepare('INSERT INTO guest_claims VALUES (?, ?)').run(guest, userId);
      this.database.db.prepare('DELETE FROM carts WHERE id = ?').run(guest);
    });
  }

  getCart(key: string) {
    const cart = this.cart(key);
    const items = [...cart.quantities].map(([productId, quantity]) => {
      const product = products.find((item) => item.id === productId)!;
      return {
        productId,
        title: product.title,
        priceMinor: product.priceMinor,
        quantity,
      };
    });
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

  change(key: string, productId: unknown, quantity: unknown, add = false) {
    if (
      typeof productId !== 'string' ||
      !products.some((item) => item.id === productId)
    )
      throw new NotFoundException('Product not found');
    if (
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    )
      throw new BadRequestException('Quantity must be an integer from 1 to 99');
    const cart = this.cart(key);
    const next = quantity + (add ? (cart.quantities.get(productId) ?? 0) : 0);
    if (next > 99) throw new BadRequestException('Maximum quantity is 99');
    cart.quantities.set(productId, next);
    cart.revision += 1;
    this.save(key, cart);
    return this.getCart(key);
  }

  remove(key: string, productId: string) {
    const cart = this.cart(key);
    if (cart.quantities.delete(productId)) cart.revision += 1;
    this.save(key, cart);
    return this.getCart(key);
  }
}
