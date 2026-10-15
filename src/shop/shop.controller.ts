import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CartService } from '../cart/cart.service';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CsrfGuard } from '../common/guards/csrf.guard';

@Controller('api')
export class ShopController {
  constructor(
    private readonly shop: CartService,
    private readonly auth: AuthService,
    private readonly database: PrismaService,
  ) {}
  private async key(request: Request) {
    const user = await this.auth.user(request.headers.cookie);
    const expected = request.get('X-Session-User');
    if (expected && expected !== (user?.id ?? 'guest'))
      throw new UnauthorizedException('Сессия изменилась. Войдите снова.');
    if (user) return `user:${user.id}`;
    const key = request.get('X-Cart-Key') || '';
    this.shop.validateGuestKey(key);
    return key;
  }

  @Get('products') products() {
    return this.shop.listProducts();
  }
  @Get('cart') async cart(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.shop.getCart(await this.key(request));
  }
  @Post('cart/items')
  @UseGuards(CsrfGuard)
  async add(
    @Req() request: Request,
    @Body() body: { productId?: unknown; quantity?: unknown } | undefined,
  ) {
    return this.shop.change(
      await this.key(request),
      body?.productId,
      body?.quantity,
      true,
    );
  }
  @Patch('cart/items/:id')
  @UseGuards(CsrfGuard)
  async update(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: { quantity?: unknown } | undefined,
  ) {
    return this.shop.change(await this.key(request), id, body?.quantity);
  }
  @Delete('cart/items/:id')
  @UseGuards(CsrfGuard)
  async remove(@Req() request: Request, @Param('id') id: string) {
    return this.shop.remove(await this.key(request), id);
  }
}
