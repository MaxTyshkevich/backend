import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response, CookieOptions } from 'express';
import { AuthService, sessionCookie, sessionLifetime } from './auth.service';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CartService } from '../cart/cart.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('api/auth')
@UseGuards(CsrfGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly shop: CartService,
  ) {}
  private options(): CookieOptions {
    return {
      httpOnly: true,
      secure:
        process.env.COOKIE_SECURE !== 'false' &&
        process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api',
    };
  }
  @Get('me') async me(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return { user: await this.auth.user(request.headers.cookie) };
  }
  @Post('register')
  async register(
    @Body() body: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.limit(request.ip || 'unknown', body.email);

    const user = await this.auth.register(body);

    const token = await this.auth.start(user, request.headers.cookie);

    response.cookie(sessionCookie, token, {
      ...this.options(),
      maxAge: sessionLifetime,
    });

    response.setHeader('Cache-Control', 'no-store');

    return { success: true };
  }
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    console.log({ body });
    await this.auth.limit(request.ip || 'unknown', body.email);
    const user = await this.auth.login(body);

    const token = await this.auth.start(user, request.headers.cookie);

    response.cookie(sessionCookie, token, {
      ...this.options(),
      maxAge: sessionLifetime,
    });

    response.setHeader('Cache-Control', 'no-store');
    return { success: true };
  }
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.end(request.headers.cookie);
    response.clearCookie(sessionCookie, this.options());
    response.setHeader('Cache-Control', 'no-store');
    return { success: true };
  }
}
