import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { parseRole, Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';
import { PasswordService } from './password.service';

/** Misma respuesta para usuario inexistente y password incorrecta (anti-enumeración). */
const CREDENCIALES_INVALIDAS = 'Credenciales inválidas';
/** Contrato existente: cuenta inactiva puede comunicarse de forma explícita. */
const USUARIO_INACTIVO = 'El usuario se encuentra inactivo.';

export type AuthLoginUser = {
  id: number;
  email: string;
  role: Role;
  name: string;
};

export type AuthLoginResult = {
  accessToken: string;
  user: AuthLoginUser;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly usuariosService: UsuariosService,
  ) {}

  private devLoginWithoutPassword(): boolean {
    return (
      this.configService.get<boolean>('auth.devLoginWithoutPassword') === true
    );
  }

  /**
   * Valida identidad: buscar Usuario → compare password → estado activo → rol.
   * Retorna solo datos mínimos (sin password / passwordHash).
   * No usa rol/estado del LoginDto.
   */
  async validateCredentials(loginDto: LoginDto): Promise<AuthLoginUser> {
    const correo = loginDto.email.trim().toLowerCase();
    const requirePassword = !this.devLoginWithoutPassword();

    const usuario = await this.usuariosService.findByCorreoForAuth(correo, {
      includePasswordHash: requirePassword,
    });

    if (!usuario) {
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    if (requirePassword) {
      if (!usuario.passwordHash) {
        throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
      }

      const passwordOk = await this.passwordService.comparePassword(
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

    const role = parseRole(usuario.rol?.nombre);
    if (!role) {
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    // Objeto explícito: nunca spread de Entity (evitar passwordHash).
    return {
      id: usuario.idUsuario,
      email: usuario.correo,
      role,
      name: usuario.nombre,
    };
  }

  /**
   * Login HTTP: valida credenciales y emite JWT existente del módulo Auth.
   * La emisión JWT ya formaba parte del sistema; no se inventa un token falso.
   */
  async login(loginDto: LoginDto): Promise<AuthLoginResult> {
    const user = await this.validateCredentials(loginDto);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user,
    };
  }
}
