import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, ROLE_LABELS, ROLES_SISTEMA } from '../../common/enums/role.enum';
import { PasswordService } from '../auth/password.service';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/usuario.entity';

export type UsuarioPublico = {
  id: number;
  nombre: string;
  correo: string;
  activo: boolean;
  rol: Role;
};

/**
 * Clave que el selector de rol del frontend ya envía en el bundle público.
 * No es un secreto: producción solo la usa para esas tres cuentas.
 */
const CLAVE_SELECTOR_ROL = 'dev-login';

/** Correos usados por el login de desarrollo del front (selector de rol). */
const CUENTAS_LOGIN_DESARROLLO: ReadonlyArray<{
  nombre: string;
  correo: string;
  rol: Role;
}> = [
  {
    nombre: ROLE_LABELS[Role.ADMINISTRADORA],
    correo: 'admin@asadasanjuan.cr',
    rol: Role.ADMINISTRADORA,
  },
  {
    nombre: ROLE_LABELS[Role.SECRETARIA_EJECUTIVA],
    correo: 'secretaria@asadasanjuan.cr',
    rol: Role.SECRETARIA_EJECUTIVA,
  },
  {
    nombre: ROLE_LABELS[Role.FONTANERO],
    correo: 'fontanero@asadasanjuan.cr',
    rol: Role.FONTANERO,
  },
];

@Injectable()
export class UsuariosService implements OnModuleInit {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * Asigna `passwordHash` desde texto plano. No persiste.
   * `undefined` / `null` / `''` → no modifica (evita doble hash en updates).
   */
  async applyPlainPassword(
    usuario: Pick<Usuario, 'passwordHash'> | Usuario,
    plain: string | undefined | null,
  ): Promise<boolean> {
    if (plain === undefined || plain === null || plain === '') {
      return false;
    }
    usuario.passwordHash = await this.passwordService.hashPassword(plain);
    return true;
  }

  /**
   * Lookup interno para AuthService.
   * No exponer vía controller: puede incluir `passwordHash` con addSelect.
   */
  async findByCorreoForAuth(
    correo: string,
    options: { includePasswordHash?: boolean } = {},
  ): Promise<Usuario | null> {
    const normalized = correo.trim().toLowerCase();
    const qb = this.usuarioRepository
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .where('LOWER(usuario.correo) = :correo', { correo: normalized });

    if (options.includePasswordHash) {
      qb.addSelect('usuario.passwordHash');
    }

    return qb.getOne();
  }

  /**
   * Lookup interno para JwtStrategy / AuthService.getMe.
   * No expone passwordHash.
   */
  async findByIdForAuth(idUsuario: number): Promise<Usuario | null> {
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      return null;
    }

    return this.usuarioRepository.findOne({
      where: { idUsuario },
      relations: { rol: true },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.asegurarRolesBase();
    await this.asegurarCuentasLoginDesarrollo();
  }

  private async asegurarCuentasLoginDesarrollo(): Promise<void> {
    const devSinPassword =
      this.configService.get<boolean>('auth.devLoginWithoutPassword') === true;
    const alinearSelector =
      this.configService.get<boolean>('auth.alignRolePickerPassword') === true;

    if (alinearSelector) {
      await this.alinearCuentasSelectorRol();
      return;
    }

    if (!devSinPassword) {
      return;
    }

    const placeholderHash = await this.passwordService.hashPassword(
      'dev-login-placeholder',
    );

    for (const cuenta of CUENTAS_LOGIN_DESARROLLO) {
      const correo = cuenta.correo.trim().toLowerCase();
      const existente = await this.usuarioRepository.findOne({
        where: { correo },
      });
      if (existente) {
        continue;
      }

      const rol = await this.findRolPorNombre(cuenta.rol);
      if (!rol) {
        this.logger.warn(
          `No se creó ${correo}: falta el rol ${cuenta.rol} en la base de datos.`,
        );
        continue;
      }

      await this.usuarioRepository.save(
        this.usuarioRepository.create({
          nombre: cuenta.nombre,
          correo,
          passwordHash: placeholderHash,
          activo: true,
          idRol: rol.idRol,
        }),
      );
      this.logger.log(`Cuenta de desarrollo creada: ${correo} (${cuenta.rol})`);
    }
  }

  private async alinearCuentasSelectorRol(): Promise<void> {
    const passwordHash =
      await this.passwordService.hashPassword(CLAVE_SELECTOR_ROL);

    for (const cuenta of CUENTAS_LOGIN_DESARROLLO) {
      const correo = cuenta.correo.trim().toLowerCase();
      const rol = await this.findRolPorNombre(cuenta.rol);
      if (!rol) {
        this.logger.warn(
          `No se alineó ${correo}: falta el rol ${cuenta.rol} en la base de datos.`,
        );
        continue;
      }

      const existente = await this.usuarioRepository
        .createQueryBuilder('usuario')
        .addSelect('usuario.passwordHash')
        .where('LOWER(usuario.correo) = :correo', { correo })
        .getOne();

      if (!existente) {
        await this.usuarioRepository.save(
          this.usuarioRepository.create({
            nombre: cuenta.nombre,
            correo,
            passwordHash,
            activo: true,
            idRol: rol.idRol,
          }),
        );
        this.logger.log(`Cuenta del selector de rol creada: ${correo}`);
        continue;
      }

      let passwordOk = false;
      if (existente.passwordHash) {
        try {
          passwordOk = await this.passwordService.comparePassword(
            CLAVE_SELECTOR_ROL,
            existente.passwordHash,
          );
        } catch {
          passwordOk = false;
        }
      }
      if (passwordOk && existente.activo && existente.idRol === rol.idRol) {
        continue;
      }

      await this.usuarioRepository.update(existente.idUsuario, {
        passwordHash: passwordOk ? existente.passwordHash : passwordHash,
        activo: true,
        idRol: rol.idRol,
      });
      this.logger.log(`Cuenta del selector de rol lista: ${correo}`);
    }
  }

  async asegurarRolesBase(): Promise<Rol[]> {
    const persistidos: Rol[] = [];
    for (const nombre of ROLES_SISTEMA) {
      const existente = await this.rolRepository.findOne({ where: { nombre } });
      if (existente) {
        persistidos.push(existente);
        continue;
      }
      persistidos.push(await this.rolRepository.save({ nombre }));
    }
    return persistidos;
  }

  async findRolPorNombre(nombre: Role): Promise<Rol | null> {
    return this.rolRepository.findOne({ where: { nombre } });
  }

  async findAll(): Promise<{ data: UsuarioPublico[] }> {
    const rows = await this.usuarioRepository.find({
      relations: { rol: true },
      order: { idUsuario: 'ASC' },
    });
    return {
      data: rows.map((usuario) => this.toPublico(usuario)),
    };
  }

  toPublico(usuario: Usuario): UsuarioPublico {
    return {
      id: usuario.idUsuario,
      nombre: usuario.nombre,
      correo: usuario.correo,
      activo: usuario.activo,
      rol: usuario.rol.nombre,
    };
  }
}
