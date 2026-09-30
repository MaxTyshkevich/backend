import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();

    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    // A non-simple header prevents cross-site form submissions. CORS and this
    // explicit origin check prevent untrusted browsers from sending the header.
    if (request.get('X-Requested-With') !== 'microfronts')
      throw new ForbiddenException('Missing CSRF request header');
    const origin = request.get('Origin');
    const allowed = (
      process.env.CORS_ORIGINS ||
      'http://localhost:5173,http://localhost:5174,http://localhost:5175'
    )
      .split(',')
      .map((value) => value.trim());
    if (origin && !allowed.includes(origin))
      throw new ForbiddenException('Origin is not allowed');
    return true;
  }
}
