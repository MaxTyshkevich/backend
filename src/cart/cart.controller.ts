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
import { CartService } from './cart.service';
import { AuthService } from '../auth/auth.service';
import { CsrfGuard } from '../common/guards/csrf.guard';

@Controller('api/cart')
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly auth: AuthService,
  ) {}
  private async key(request: Request) {
    const user = await this.auth.user(request.headers.cookie);
    const expected = request.get('X-Session-User');
    if (expected && expected !== (user?.id ?? 'guest'))
      throw new UnauthorizedException('Сессия изменилась. Войдите снова.');
    if (user) return `user:${user.id}`;
    const key = request.get('X-Cart-Key') || '';
    this.cartService.validateGuestKey(key);
    return key;
  }

  @Get() async cart(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.cartService.getCart(await this.key(request));
  }
  @Post('items')
  @UseGuards(CsrfGuard)
  async add(
    @Req() request: Request,
    @Body() body: { productId?: unknown; quantity?: unknown } | undefined,
  ) {
    return this.cartService.change(
      await this.key(request),
      body?.productId,
      body?.quantity,
      true,
    );
  }
  @Patch('items/:id')
  @UseGuards(CsrfGuard)
  async update(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: { quantity?: unknown } | undefined,
  ) {
    return this.cartService.change(await this.key(request), id, body?.quantity);
  }
  @Delete('items/:id')
  @UseGuards(CsrfGuard)
  async remove(@Req() request: Request, @Param('id') id: string) {
    return this.cartService.remove(await this.key(request), id);
  }
}
