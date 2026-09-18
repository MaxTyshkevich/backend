import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response, CookieOptions } from 'express';
import { AuthService, sessionCookie, sessionLifetime } from './auth.service';
import { CsrfGuard } from './csrf.guard';
import { ShopService } from './shop.service';

@Controller('api/auth')
@UseGuards(CsrfGuard)
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly shop: ShopService) {}
  private options(): CookieOptions {
    return { httpOnly: true, secure: process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api' };
  }
  @Get('me') me(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    return { user: this.auth.user(request.headers.cookie) };
  }
  @Post('register') register(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.authenticate(body, request, response, true);
  }
  @Post('login') login(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.authenticate(body, request, response, false);
  }
  private async authenticate(body: unknown, request: Request, response: Response, registration: boolean) {
    const input = this.auth.credentials(body, registration);
    this.auth.limit(request.ip || 'unknown', input.email);
    const guest = request.get('X-Cart-Key');
    if (guest) this.shop.validateGuestKey(guest);
    const user = await (registration ? this.auth.register(input) : this.auth.login(input));
    if (guest) this.shop.mergeGuest(guest, user.id);
    const token = this.auth.start(user, request.headers.cookie);
    response.cookie(sessionCookie, token, { ...this.options(), maxAge: sessionLifetime });
    response.setHeader('Cache-Control', 'no-store');
    return { user };
  }
  @Post('logout') logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.auth.end(request.headers.cookie);
    response.clearCookie(sessionCookie, this.options());
    response.setHeader('Cache-Control', 'no-store');
    return { user: null };
  }
}
