import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const secret = configService.get<string>('jwt.secret');
    if (!secret) {
      throw new Error(
        'jwt.secret no configurado. Defina JWT_SECRET (obligatorio en producción).',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload) {
    if (
      !payload ||
      payload.sub === undefined ||
      payload.sub === null ||
      payload.sub === ''
    ) {
      throw new UnauthorizedException('Token inválido');
    }
    const parsed = Number(payload.sub);
    return {
      userId: String(payload.sub),
      ...(Number.isInteger(parsed) ? { idUsuario: parsed } : {}),
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
  }
}
