import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { DevTokenDto } from './dto/dev-token.dto';
import { LoginDto } from './dto/login.dto';

export type AuthLoginResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  user: {
    id: string;
    email: string;
    role: Role;
    name: string;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  login(loginDto: LoginDto): AuthLoginResponse {
    const { email, password } = loginDto;

    if (!email || !password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.issueToken({
      sub: 'demo-user-id',
      email,
      role: Role.ADMINISTRADORA,
      name: 'Usuario Administrador',
    });
  }

  devToken(devTokenDto: DevTokenDto): AuthLoginResponse {
    this.assertDevTokenAllowed();

    const role = this.mapDevRole(devTokenDto.rol);

    return this.issueToken({
      sub: `dev-${role.toLowerCase()}`,
      email: `${role.toLowerCase()}@dev.sigasj.local`,
      role,
      name: `Usuario ${this.displayRoleName(role)}`,
    });
  }

  private assertDevTokenAllowed(): void {
    const nodeEnv = this.configService.get<string>('environment.nodeEnv');

    if (nodeEnv === 'production') {
      throw new ForbiddenException(
        'El token de desarrollo no está disponible en producción',
      );
    }
  }

  private mapDevRole(rol: string): Role {
    const normalized = rol.trim().toUpperCase();

    switch (normalized) {
      case Role.ADMINISTRADORA:
        return Role.ADMINISTRADORA;
      case Role.SECRETARIA:
        return Role.SECRETARIA;
      case Role.FONTANERO:
        return Role.FONTANERO;
      default:
        throw new UnauthorizedException('Rol no permitido para desarrollo');
    }
  }

  private displayRoleName(role: Role): string {
    switch (role) {
      case Role.ADMINISTRADORA:
        return 'Administradora';
      case Role.SECRETARIA:
        return 'Secretaria';
      case Role.FONTANERO:
        return 'Fontanero';
      default:
        return role;
    }
  }

  private issueToken(payload: JwtPayload): AuthLoginResponse {
    return {
      accessToken: this.jwtService.sign(payload),
      tokenType: 'Bearer',
      user: {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        name: payload.name ?? 'Usuario',
      },
    };
  }
}
