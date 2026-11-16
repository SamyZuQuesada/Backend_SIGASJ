import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../../common/filters/http-exception.filter';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../../config/jwt.config';
import { AuthModule } from '../../auth/auth.module';
import { Rol } from '../../usuarios/entities/rol.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import {
  crearUsuarioPrueba,
  seedRolesBase,
} from '../../usuarios/usuarios.test-helpers';
import { SolicitudAusencia } from '../../solicitudes-ausencia/entities/solicitud-ausencia.entity';
import { DocumentoSolicitudAusencia } from '../../solicitudes-ausencia/entities/documento-solicitud-ausencia.entity';
import { Colaborador } from '../entities/colaborador.entity';
import { Incapacidad } from '../entities/incapacidad.entity';
import { MovimientoVacaciones } from '../entities/movimiento-vacaciones.entity';
import { PermisoColaborador } from '../entities/permiso-colaborador.entity';
import { Puesto } from '../entities/puesto.entity';
import { RecursosHumanosModule } from '../recursos-humanos.module';

export const COLABORADORES_URL = '/api/v1/rrhh/colaboradores';

export type ColaboradoresTestApp = {
  app: INestApplication<App>;
  colaboradorRepository: Repository<Colaborador>;
  puestoRepository: Repository<Puesto>;
  usuarioRepository: Repository<Usuario>;
  rolRepository: Repository<Rol>;
  signAs: (role: Role) => string;
  crearUsuario: (correo: string) => Promise<Usuario>;
  seedPuesto: (nombre?: string) => Promise<Puesto>;
};

/** App Nest con base SQL.js en memoria y la misma configuración de main.ts. */
export async function crearColaboradoresTestApp(): Promise<ColaboradoresTestApp> {
  const moduleFixture = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
      TypeOrmModule.forRoot({
        type: 'sqljs',
        autoSave: false,
        dropSchema: true,
        entities: [
          Colaborador,
          PermisoColaborador,
          MovimientoVacaciones,
          Incapacidad,
          Puesto,
          Usuario,
          Rol,
          // Colaborador declara @OneToMany solicitudesAusencia
          SolicitudAusencia,
          DocumentoSolicitudAusencia,
        ],
        synchronize: true,
      }),
      AuthModule,
      RecursosHumanosModule,
    ],
    providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();

  const jwtService = moduleFixture.get(JwtService);
  const colaboradorRepository = moduleFixture.get<Repository<Colaborador>>(
    getRepositoryToken(Colaborador),
  );
  const puestoRepository = moduleFixture.get<Repository<Puesto>>(
    getRepositoryToken(Puesto),
  );
  const usuarioRepository = moduleFixture.get<Repository<Usuario>>(
    getRepositoryToken(Usuario),
  );
  const rolRepository = moduleFixture.get<Repository<Rol>>(
    getRepositoryToken(Rol),
  );

  // JwtStrategy revalida contra Usuario activo: el token debe usar un id real.
  const roles = await seedRolesBase(rolRepository);
  const usuariosPorRol = {} as Record<Role, Usuario>;
  for (const role of Object.values(Role)) {
    usuariosPorRol[role] = await crearUsuarioPrueba(
      usuarioRepository,
      roles,
      {
        nombre: `Usuario ${role}`,
        correo: `qa.${role.toLowerCase()}@asadasanjuan.cr`,
        role,
      },
    );
  }

  const signAs = (role: Role) => {
    const usuario = usuariosPorRol[role];
    const payload: JwtPayload = {
      sub: String(usuario.idUsuario),
      email: usuario.correo,
      role,
      name: usuario.nombre,
    };
    return jwtService.sign(payload);
  };

  const seedPuesto = async (nombre = 'Fontanero'): Promise<Puesto> => {
    const existente = await puestoRepository.findOneBy({ nombre });
    if (existente) return existente;
    return puestoRepository.save(
      puestoRepository.create({
        nombre,
        critico: false,
        activo: true,
      }),
    );
  };

  const crearUsuario = async (correo: string): Promise<Usuario> => {
    return crearUsuarioPrueba(usuarioRepository, roles, {
      nombre: 'Fontanero Prueba',
      correo,
      role: Role.FONTANERO,
    });
  };

  return {
    app,
    colaboradorRepository,
    puestoRepository,
    usuarioRepository,
    rolRepository,
    signAs,
    crearUsuario,
    seedPuesto,
  };
}
