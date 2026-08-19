import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: Error | undefined, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException('No autenticado');
    }
    return user;
  }
}
