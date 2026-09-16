import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

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
type StoredCart = {
  quantities: Map<string, number>;
  revision: number;
  updatedAt: number;
};

@Injectable()
export class ShopService {
  private readonly carts = new Map<string, StoredCart>();
  listProducts() {
    return products.map((product) => ({ ...product }));
  }

  private cart(key: string): StoredCart {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        key ?? '',
      )
    ) {
      throw new BadRequestException('X-Cart-Key must be a UUID v4');
    }
    const now = Date.now();
    for (const [id, cart] of this.carts) {
      if (now - cart.updatedAt > 24 * 60 * 60 * 1000) this.carts.delete(id);
    }
    let cart = this.carts.get(key);
    if (!cart) {
      if (this.carts.size >= 1000)
        throw new ServiceUnavailableException('Demo cart capacity reached');
      cart = { quantities: new Map(), revision: 0, updatedAt: now };
      this.carts.set(key, cart);
    }
    cart.updatedAt = now;
    return cart;
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
    return this.getCart(key);
  }

  remove(key: string, productId: string) {
    const cart = this.cart(key);
    if (cart.quantities.delete(productId)) cart.revision += 1;
    return this.getCart(key);
  }
}
