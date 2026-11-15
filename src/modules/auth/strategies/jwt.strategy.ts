import { Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { parseRole, Role } from '../../../common/enums/role.enum';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { UsuariosService } from '../../usuarios/usuarios.service';

const USUARIO_INACTIVO = 'El usuario se encuentra inactivo.';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @Optional()
    @Inject(UsuariosService)
    private readonly usuariosService?: UsuariosService,
  ) {
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

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (
      !payload ||
      payload.sub === undefined ||
      payload.sub === null ||
      payload.sub === ''
    ) {
      throw new UnauthorizedException('Token inválido');
    }

    const parsed = Number(payload.sub);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new UnauthorizedException('Token inválido');
    }

    if (this.usuariosService) {
      const usuario = await this.usuariosService.findByIdForAuth(parsed);
      if (!usuario) {
        throw new UnauthorizedException('Token inválido');
      }
      if (!usuario.activo) {
        throw new UnauthorizedException(USUARIO_INACTIVO);
      }

      const role = parseRole(usuario.rol?.nombre);
      if (!role) {
        throw new UnauthorizedException('Token inválido');
      }

      return {
        userId: String(usuario.idUsuario),
        idUsuario: usuario.idUsuario,
        email: usuario.correo,
        role,
        name: usuario.nombre,
      };
    }

    // Fallback para pruebas unitarias sin UsuariosService.
    const role = parseRole(payload.role) ?? (payload.role as Role);
    if (!role) {
      throw new UnauthorizedException('Token inválido');
    }

    return {
      userId: String(payload.sub),
      idUsuario: parsed,
      email: payload.email,
      role,
      name: payload.name,
    };
  }
}
