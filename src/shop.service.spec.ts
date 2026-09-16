import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ShopService } from './shop.service';

describe('ShopService', () => {
  let shop: ShopService;
  const a = 'c9c5c662-b782-49b1-8ddd-1eac2388c001';
  const b = 'c9c5c662-b782-49b1-8ddd-1eac2388c002';
  beforeEach(() => {
   
 
    shop = new ShopService();
  });
  it('calculates prices on the server and isolates carts', () => {
    shop.change(a, 'keyboard', 2, true);
    expect(shop.getCart(a).totalMinor).toBe(29800);
    expect(shop.getCart(b).items).toEqual([]);
    shop.change(a, 'keyboard', 1, true);
    expect(shop.getCart(a).items[0].quantity).toBe(3);
    shop.change(a, 'keyboard', 1);
    expect(shop.getCart(a).totalMinor).toBe(14900);
    expect(shop.remove(a, 'keyboard').totalMinor).toBe(0);
  });
  it('rejects malformed keys, unknown products and invalid quantities without a partial mutation', () => {
    expect(() => shop.getCart('invalid')).toThrow(BadRequestE
x     ception);
        ,
      
    expect(() => shop.change(a, 'missing', 1)).toThrow(NotFoundException);
    for (const quantity of [0, -1, 1.5, '2', 100, undefined])
      expect(() => shop.change(a, 'dock', quantity)).toThrow(
        BadRequestException,
      );
    shop.change(a, 'dock', 99);
    expect(() => shop.change(a, 'dock', 1, true)).toThrow(BadRequestException);
    expect(shop.getCart(a).items[0].quantity).toBe(99);
  });
});
