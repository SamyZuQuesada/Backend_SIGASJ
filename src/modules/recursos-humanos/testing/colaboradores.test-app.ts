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
import { Colaborador } from '../entities/colaborador.entity';
import { PermisoColaborador } from '../entities/permiso-colaborador.entity';
import { RecursosHumanosModule } from '../recursos-humanos.module';

export const COLABORADORES_URL = '/api/v1/rrhh/colaboradores';

export type ColaboradoresTestApp = {
  app: INestApplication<App>;
  colaboradorRepository: Repository<Colaborador>;
  usuarioRepository: Repository<Usuario>;
  rolRepository: Repository<Rol>;
  signAs: (role: Role) => string;
  crearUsuario: (correo: string) => Promise<Usuario>;
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
        entities: [Colaborador, PermisoColaborador, Usuario, Rol],
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
  const usuarioRepository = moduleFixture.get<Repository<Usuario>>(
    getRepositoryToken(Usuario),
  );
  const rolRepository = moduleFixture.get<Repository<Rol>>(
    getRepositoryToken(Rol),
  );

  const signAs = (role: Role) => {
    const payload: JwtPayload = {
      sub: '1',
      email: `${role.toLowerCase()}@asadasanjuan.cr`,
      role,
      name: `Usuario ${role}`,
    };
    return jwtService.sign(payload);
  };

  const crearUsuario = async (correo: string): Promise<Usuario> => {
    let rol = await rolRepository.findOneBy({ nombre: Role.FONTANERO });
    rol ??= await rolRepository.save(
      rolRepository.create({ nombre: Role.FONTANERO }),
    );
    return usuarioRepository.save(
      usuarioRepository.create({
        nombre: 'Fontanero Prueba',
        correo,
        passwordHash: 'x',
        activo: true,
        idRol: rol.idRol,
      }),
    );
  };

  return {
    app,
    colaboradorRepository,
    usuarioRepository,
    rolRepository,
    signAs,
    crearUsuario,
  };
}
