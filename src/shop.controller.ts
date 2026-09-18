import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ShopService } from './shop.service';
import { AuthService } from './auth.service';
import { CsrfGuard } from './csrf.guard';

@Controller('api')
export class ShopController {
  constructor(private readonly shop: ShopService, private readonly auth: AuthService) {}
  private key(request: Request) {
    const user = this.auth.user(request.headers.cookie);
    const expected = request.get('X-Session-User');
    if (expected && expected !== (user?.id ?? 'guest')) throw new UnauthorizedException('Сессия изменилась. Войдите снова.');
    if (user) return `user:${user.id}`;
    const key = request.get('X-Cart-Key') || '';
    this.shop.validateGuestKey(key);
    return key;
  }
  @Get('health') health() { return { status: 'ok', storage: 'sqlite', contractVersion: 2 }; }
  @Get('products') products() { return this.shop.listProducts(); }
  @Get('cart') cart(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    return this.shop.getCart(this.key(request));
  }
  @Post('cart/items') @UseGuards(CsrfGuard)
  add(@Req() request: Request, @Body() body: { productId?: unknown; quantity?: unknown } | undefined) {
    return this.shop.change(this.key(request), body?.productId, body?.quantity, true);
  }
  @Patch('cart/items/:id') @UseGuards(CsrfGuard)
  update(@Req() request: Request, @Param('id') id: string, @Body() body: { quantity?: unknown } | undefined) {
    return this.shop.change(this.key(request), id, body?.quantity);
  }
  @Delete('cart/items/:id') @UseGuards(CsrfGuard)
  remove(@Req() request: Request, @Param('id') id: string) { return this.shop.remove(this.key(request), id); }
}
