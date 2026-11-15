import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Role,
  ROLES_SISTEMA,
  ROLE_ETIQUETA,
} from '../../common/enums/role.enum';
import { PasswordService } from '../auth/password.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
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
    nombre: ROLE_ETIQUETA[Role.ADMINISTRADORA],
    correo: 'admin@asadasanjuan.cr',
    rol: Role.ADMINISTRADORA,
  },
  {
    nombre: ROLE_ETIQUETA[Role.SECRETARIA],
    correo: 'secretaria@asadasanjuan.cr',
    rol: Role.SECRETARIA,
  },
  {
    nombre: ROLE_ETIQUETA[Role.FONTANERO],
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

    const placeholderHash = await this.passwordService.hash(
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
    const passwordHash = await this.passwordService.hash(CLAVE_SELECTOR_ROL);

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
          passwordOk = await this.passwordService.compare(
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

  async crear(dto: CreateUsuarioDto): Promise<UsuarioPublico> {
    const correo = dto.correo.trim().toLowerCase();
    const duplicado = await this.usuarioRepository.findOne({
      where: { correo },
    });
    if (duplicado) {
      throw new ConflictException('Ya existe un usuario con este correo.');
    }

    const rol = await this.obtenerRol(dto.rol);
    const passwordHash = await this.passwordService.hash(dto.password);
    const guardado = await this.usuarioRepository.save(
      this.usuarioRepository.create({
        nombre: dto.nombre.trim(),
        correo,
        passwordHash,
        activo: dto.activo ?? true,
        idRol: rol.idRol,
        rol,
      }),
    );
    this.logger.log(`Usuario creado: id=${guardado.idUsuario}`);
    return this.toPublico(guardado);
  }

  async actualizar(id: number, dto: UpdateUsuarioDto): Promise<UsuarioPublico> {
    const usuario = await this.usuarioRepository.findOne({
      where: { idUsuario: id },
      relations: { rol: true },
    });
    if (!usuario) {
      throw new NotFoundException(`No existe un usuario con id ${id}`);
    }

    const patch: Partial<Usuario> = {};
    if (dto.nombre !== undefined) {
      patch.nombre = dto.nombre.trim();
    }
    if (dto.activo !== undefined) {
      patch.activo = dto.activo;
    }
    if (dto.rol !== undefined) {
      const rol = await this.obtenerRol(dto.rol);
      patch.idRol = rol.idRol;
      patch.rol = rol;
    }
    if (typeof dto.password === 'string' && dto.password.length > 0) {
      patch.passwordHash = await this.passwordService.hash(dto.password);
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para actualizar',
      );
    }

    const { rol: _rolRelacion, ...columnas } = patch;
    void _rolRelacion;
    await this.usuarioRepository.update(id, columnas);

    const actualizado = await this.usuarioRepository.findOne({
      where: { idUsuario: id },
      relations: { rol: true },
    });
    if (!actualizado) {
      throw new NotFoundException(`No existe un usuario con id ${id}`);
    }
    this.logger.log(`Usuario actualizado: id=${id}`);
    return this.toPublico(actualizado);
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

  private async obtenerRol(nombre: Role): Promise<Rol> {
    const rol = await this.findRolPorNombre(nombre);
    if (!rol) {
      throw new BadRequestException(`El rol ${nombre} no existe.`);
    }
    return rol;
  }
}
