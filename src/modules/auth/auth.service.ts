import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import { verifyPassword } from './password.util';
import { Usuario } from '../usuarios/entities/usuario.entity';

const CREDENCIALES_INVALIDAS = 'Credenciales inválidas';
const USUARIO_INACTIVO = 'El usuario se encuentra inactivo.';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  private devLoginWithoutPassword(): boolean {
    return (
      this.configService.get<boolean>('auth.devLoginWithoutPassword') === true
    );
  }

  async login(loginDto: LoginDto) {
    const correo = loginDto.email.trim().toLowerCase();
    const devSinPassword = this.devLoginWithoutPassword();
    const qb = this.usuarioRepository
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .where('LOWER(usuario.correo) = :correo', { correo });

    if (!devSinPassword) {
      qb.addSelect('usuario.passwordHash');
    }

    const usuario = await qb.getOne();

    if (!usuario) {
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    if (!devSinPassword) {
      if (!usuario.passwordHash) {
        throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
      }

      const passwordOk = await verifyPassword(
        loginDto.password,
        usuario.passwordHash,
      );
      if (!passwordOk) {
        throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
      }
    }

    if (!usuario.activo) {
      throw new UnauthorizedException(USUARIO_INACTIVO);
    }

    const role = this.asRole(usuario.rol?.nombre);
    if (!role) {
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    const payload: JwtPayload = {
      sub: usuario.idUsuario,
      email: usuario.correo,
      role,
      name: usuario.nombre,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: usuario.idUsuario,
        email: usuario.correo,
        role,
        name: usuario.nombre,
      },
    };
  }

  private asRole(nombre: string | undefined): Role | null {
    if (!nombre) {
      return null;
    }
    return (Object.values(Role) as string[]).includes(nombre)
      ? (nombre as Role)
      : null;
  }
}
