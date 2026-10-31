import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, type PublicUser } from './auth.service';

export type AuthenticatedRequest = Request & { user: PublicUser };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.auth.user(request.headers.cookie);
    const expected = request.get('X-Session-User');
    if (!user || (expected && expected !== user.id)) {
      throw new UnauthorizedException('Войдите в аккаунт заново');
    }
    request.user = user;
    return true;
  }
}
