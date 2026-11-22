import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { UploadedImageFile } from '../../common/media/public-media';
import { parseRole, Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { Usuario } from '../usuarios/entities/usuario.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateMeDto } from './dto/update-me.dto';
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
  /** Ruta pública de foto de perfil, o null si no hay. */
  avatar: string | null;
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

  /**
   * Bypass de contraseña solo si auth.config lo habilitó Y el entorno no es
   * product-like (defensa en profundidad ante mala configuración).
   */
  private allowsPasswordBypass(): boolean {
    if (
      this.configService.get<boolean>('auth.devLoginWithoutPassword') !== true
    ) {
      return false;
    }

    if (this.configService.get<boolean>('auth.isProductionLike') === true) {
      return false;
    }

    const nodeEnv = String(
      this.configService.get<string>('auth.nodeEnv') ??
        this.configService.get<string>('environment.nodeEnv') ??
        process.env.NODE_ENV ??
        '',
    )
      .trim()
      .toLowerCase();

    return nodeEnv === 'development';
  }

  /**
   * Valida identidad: buscar Usuario → compare password → estado activo → rol.
   * Retorna solo datos mínimos (sin password / passwordHash).
   * No usa rol/estado del LoginDto.
   */
  async validateCredentials(loginDto: LoginDto): Promise<AuthLoginUser> {
    const correo = loginDto.email.trim().toLowerCase();
    const requirePassword = !this.allowsPasswordBypass();

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
    return this.toAuthUser(usuario, role);
  }

  private toAuthUser(usuario: Usuario, role: Role): AuthLoginUser {
    return {
      id: usuario.idUsuario,
      email: usuario.correo,
      role,
      name: usuario.nombre,
      avatar: usuario.fotoPerfilUrl?.trim() || null,
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

  /**
   * Sesión actual desde JWT ya validado (JwtStrategy).
   * Relee usuario en BD para devolver datos frescos sin passwordHash.
   */
  async getMe(userId: number): Promise<AuthLoginUser> {
    const usuario = await this.usuariosService.findByIdForAuth(userId);
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

    return this.toAuthUser(usuario, role);
  }

  async updateMe(userId: number, dto: UpdateMeDto): Promise<AuthLoginUser> {
    const usuario = await this.usuariosService.updateOwnNombre(
      userId,
      dto.name,
    );
    const role = parseRole(usuario.rol?.nombre);
    if (!role) {
      throw new UnauthorizedException('Token inválido');
    }
    return this.toAuthUser(usuario, role);
  }

  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<{ ok: true }> {
    await this.usuariosService.changeOwnPassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
    return { ok: true };
  }

  async updateAvatar(
    userId: number,
    file: UploadedImageFile | undefined,
  ): Promise<AuthLoginUser> {
    if (!file) {
      throw new BadRequestException('Debe adjuntar una imagen de perfil.');
    }
    const usuario = await this.usuariosService.updateOwnFoto(userId, file);
    const role = parseRole(usuario.rol?.nombre);
    if (!role) {
      throw new UnauthorizedException('Token inválido');
    }
    return this.toAuthUser(usuario, role);
  }

  async clearAvatar(userId: number): Promise<AuthLoginUser> {
    const usuario = await this.usuariosService.clearOwnFoto(userId);
    const role = parseRole(usuario.rol?.nombre);
    if (!role) {
      throw new UnauthorizedException('Token inválido');
    }
    return this.toAuthUser(usuario, role);
  }
}
