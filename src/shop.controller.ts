import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { ShopService } from './shop.service';

@Controller('api')
export class ShopController {
  constructor(private readonly shop: ShopService) {}
  @Get('health') health() { return { status: 'ok', storage: 'memory', contractVersion: 1 }; }
  @Get('products') products() { return this.shop.listProducts(); }
  @Get('cart') cart(@Headers('x-cart-key') key: string) { return this.shop.getCart(key); }
  @Post('cart/items') add(@Headers('x-cart-key') key: string, @Body() body: { productId?: unknown; quantity?: unknown } | undefined) {
    return this.shop.change(key, body?.productId, body?.quantity, true);
  }
  @Patch('cart/items/:id') update(@Headers('x-cart-key') key: string, @Param('id') id: string, @Body() body: { quantity?: unknown } | undefined) {
    return this.shop.change(key, id, body?.quantity);
  }
  @Delete('cart/items/:id') remove(@Headers('x-cart-key') key: string, @Param('id') id: string) { return this.shop.remove(key, id); }
}
