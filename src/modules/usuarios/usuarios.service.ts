import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, ROLES_SISTEMA } from '../../common/enums/role.enum';
import { hashPassword } from '../auth/password.util';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/usuario.entity';

export type UsuarioPublico = {
  id: number;
  nombre: string;
  correo: string;
  activo: boolean;
  rol: Role;
};

/** Correos usados por el login de desarrollo del front (selector de rol). */
const CUENTAS_LOGIN_DESARROLLO: ReadonlyArray<{
  nombre: string;
  correo: string;
  rol: Role;
}> = [
  {
    nombre: 'Administradora',
    correo: 'admin@asadasanjuan.cr',
    rol: Role.ADMINISTRADORA,
  },
  {
    nombre: 'Secretaria',
    correo: 'secretaria@asadasanjuan.cr',
    rol: Role.SECRETARIA,
  },
  {
    nombre: 'Fontanero demo',
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
  ) {}

  async onModuleInit(): Promise<void> {
    await this.asegurarRolesBase();
    await this.asegurarCuentasLoginDesarrollo();
  }

  private async asegurarCuentasLoginDesarrollo(): Promise<void> {
    if (
      this.configService.get<boolean>('auth.devLoginWithoutPassword') !== true
    ) {
      return;
    }

    const placeholderHash = await hashPassword('dev-login-placeholder');

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
