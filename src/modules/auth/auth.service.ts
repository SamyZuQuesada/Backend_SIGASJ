import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  login(loginDto: LoginDto) {
    // La validación real contra entidad de Usuario se integrará con el backlog correspondiente.
    const { email, password } = loginDto;

    // Validación base para la infraestructura de Auth
    if (!email || !password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload: JwtPayload = {
      sub: 'demo-user-id',
      email: email,
      role: Role.ADMINISTRADORA,
      name: 'Usuario Administrador',
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        name: payload.name,
      },
    };
  }
}
