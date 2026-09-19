import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Role, ROLES_SISTEMA } from '../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { hashPassword } from '../auth/password.util';
import { HorarioLaboralFontanero } from './entities/horario-laboral-fontanero.entity';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/usuario.entity';
import { UsuariosModule } from './usuarios.module';
import {
  PASSWORD_PRUEBA,
  crearUsuarioPrueba,
  seedRolesBase,
} from './usuarios.test-helpers';

describe('Usuarios y roles persistidos', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let roles: Repository<Rol>;
  let usuarios: Repository<Usuario>;
  let jwtService: JwtService;
  let adminToken: string;
  let rolesMap: Record<Role, Rol>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          dropSchema: true,
          entities: [Usuario, Rol, HorarioLaboralFontanero],
          synchronize: true,
        }),
        AuthModule,
        UsuariosModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const dataSource = moduleFixture.get(DataSource);
    roles = dataSource.getRepository(Rol);
    usuarios = dataSource.getRepository(Usuario);
    jwtService = moduleFixture.get(JwtService);
    rolesMap = await seedRolesBase(roles);

    await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Administradora',
      correo: 'admin@asadasanjuan.cr',
      role: Role.ADMINISTRADORA,
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@asadasanjuan.cr', password: PASSWORD_PRUEBA });
    adminToken = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('persiste los 4 roles base con nombre único', async () => {
    const persistidos = await roles.find({ order: { nombre: 'ASC' } });
    expect(persistidos.map((rol) => rol.nombre).sort()).toEqual(
      [...ROLES_SISTEMA].sort(),
    );
    await expect(
      roles.save(roles.create({ nombre: Role.FONTANERO })),
    ).rejects.toBeInstanceOf(QueryFailedError);
  });

  it('crea dos Usuarios FONTANERO distintos y no limita la cantidad', async () => {
    const a = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Carlos Pérez',
      correo: 'carlos.fontanero@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    const b = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'José Ramírez',
      correo: 'jose.fontanero@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    const c = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Ana Fontanera',
      correo: 'ana.fontanero@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    expect(a.idUsuario).not.toBe(b.idUsuario);
    expect(a.rol.nombre).toBe(Role.FONTANERO);
    expect(b.rol.nombre).toBe(Role.FONTANERO);
    expect(c.rol.nombre).toBe(Role.FONTANERO);
    expect([a.idRol, b.idRol, c.idRol]).toEqual([
      rolesMap[Role.FONTANERO].idRol,
      rolesMap[Role.FONTANERO].idRol,
      rolesMap[Role.FONTANERO].idRol,
    ]);
  });

  it('distingue SECRETARIA, ADMINISTRADORA, activo e inactivo', async () => {
    const secretaria = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Secretaria',
      correo: 'secretaria.roles@asadasanjuan.cr',
      role: Role.SECRETARIA,
    });
    const admin = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Otra admin',
      correo: 'admin2@asadasanjuan.cr',
      role: Role.ADMINISTRADORA,
    });
    const inactivo = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero inactivo',
      correo: 'inactivo@asadasanjuan.cr',
      role: Role.FONTANERO,
      activo: false,
    });
    expect(secretaria.rol.nombre).toBe(Role.SECRETARIA);
    expect(admin.rol.nombre).toBe(Role.ADMINISTRADORA);
    expect(inactivo.activo).toBe(false);
    const activo = await usuarios.findOneBy({
      correo: 'carlos.fontanero@asadasanjuan.cr',
    });
    expect(activo?.activo).toBe(true);
  });

  it('rechaza correo duplicado', async () => {
    await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Uno',
      correo: 'unico@asadasanjuan.cr',
      role: Role.ABONADO,
    });
    await expect(
      usuarios.save(
        usuarios.create({
          nombre: 'Dos',
          correo: 'unico@asadasanjuan.cr',
          passwordHash: await hashPassword(PASSWORD_PRUEBA),
          activo: true,
          idRol: rolesMap[Role.ABONADO].idRol,
        }),
      ),
    ).rejects.toBeInstanceOf(QueryFailedError);
  });

  it('GET /usuarios no expone passwordHash', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(/passwordHash/i);
    expect(response.body).toHaveProperty('data');
    expect(jwtService).toBeDefined();
  });
});
