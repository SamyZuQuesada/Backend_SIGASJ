import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from './auth.module';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  PASSWORD_PRUEBA,
  crearUsuarioPrueba,
  seedRolesBase,
} from '../usuarios/usuarios.test-helpers';

describe('Auth persistido (sin login demo)', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let usuarios: Repository<Usuario>;
  let rolesMap: Record<Role, Rol>;
  let fontaneroA: Usuario;
  let fontaneroB: Usuario;
  let secretaria: Usuario;
  let administradora: Usuario;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          dropSchema: true,
          entities: [Usuario, Rol],
          synchronize: true,
        }),
        AuthModule,
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
    jwtService = moduleFixture.get(JwtService);
    const dataSource = moduleFixture.get(DataSource);
    usuarios = dataSource.getRepository(Usuario);
    const roles = dataSource.getRepository(Rol);
    rolesMap = await seedRolesBase(roles);

    administradora = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Administradora',
      correo: 'admin@asadasanjuan.cr',
      role: Role.ADMINISTRADORA,
    });
    secretaria = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Secretaria',
      correo: 'secretaria@asadasanjuan.cr',
      role: Role.SECRETARIA,
    });
    fontaneroA = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Carlos Pérez',
      correo: 'carlos@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    fontaneroB = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'José Ramírez',
      correo: 'jose@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Inactivo',
      correo: 'inactivo@asadasanjuan.cr',
      role: Role.FONTANERO,
      activo: false,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const login = (email: string, password = PASSWORD_PRUEBA) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });

  const tokenOf = (body: unknown): string => {
    if (
      typeof body === 'object' &&
      body !== null &&
      'accessToken' in body &&
      typeof body.accessToken === 'string'
    ) {
      return body.accessToken;
    }
    throw new Error('La respuesta de login no incluye accessToken');
  };

  const decode = (token: string): JwtPayload => {
    const payload: unknown = jwtService.decode(token);
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('sub' in payload) ||
      !('role' in payload) ||
      !('email' in payload)
    ) {
      throw new Error('JWT de prueba inválido');
    }
    const sub = payload.sub;
    const role = payload.role;
    const email = payload.email;
    const name = 'name' in payload ? payload.name : undefined;
    if (
      (typeof sub !== 'string' && typeof sub !== 'number') ||
      typeof role !== 'string' ||
      typeof email !== 'string'
    ) {
      throw new Error('JWT de prueba inválido');
    }
    return {
      sub,
      role: role as JwtPayload['role'],
      email,
      ...(typeof name === 'string' ? { name } : {}),
    };
  };

  const loginPayload = async (email: string) =>
    decode(tokenOf((await login(email).expect(200)).body));

  it('login persistido válido: JWT sub = idUsuario y role persistido', async () => {
    const response = await login('admin@asadasanjuan.cr').expect(200);
    const body = response.body as {
      accessToken: string;
      user: { id: number; role: string; name: string };
    };
    const payload = decode(body.accessToken);
    expect(Number(payload.sub)).toBe(administradora.idUsuario);
    expect(payload.sub).not.toBe('demo-user-id');
    expect(payload.role).toBe(Role.ADMINISTRADORA);
    expect(body.user.id).toBe(administradora.idUsuario);
    expect(body.user.role).toBe(Role.ADMINISTRADORA);
    expect(JSON.stringify(payload)).not.toMatch(/passwordHash/i);
  });

  it('Fontanero A y B comparten rol FONTANERO con sub distintos', async () => {
    const a = await loginPayload('carlos@asadasanjuan.cr');
    const b = await loginPayload('jose@asadasanjuan.cr');
    expect(a.role).toBe(Role.FONTANERO);
    expect(b.role).toBe(Role.FONTANERO);
    expect(Number(a.sub)).toBe(fontaneroA.idUsuario);
    expect(Number(b.sub)).toBe(fontaneroB.idUsuario);
    expect(a.sub).not.toBe(b.sub);
  });

  it('Secretaria y Administradora usan el rol persistido, no el correo', async () => {
    const sec = await loginPayload('secretaria@asadasanjuan.cr');
    expect(sec.role).toBe(Role.SECRETARIA);
    expect(Number(sec.sub)).toBe(secretaria.idUsuario);
    const admin = await loginPayload('admin@asadasanjuan.cr');
    expect(admin.role).toBe(Role.ADMINISTRADORA);
  });

  it('rechaza inactivo y credenciales inválidas; no usa demo-user-id', async () => {
    await login('inactivo@asadasanjuan.cr').expect(401);
    await login('admin@asadasanjuan.cr', 'WrongPass1').expect(401);
    await login('noexiste@asadasanjuan.cr').expect(401);
    const ok = await login('carlos@asadasanjuan.cr').expect(200);
    expect(JSON.stringify(ok.body)).not.toContain('demo-user-id');
  });

  it('no deriva el rol desde el correo', async () => {
    await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'No es admin',
      correo: 'admin.falso@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    const payload = await loginPayload('admin.falso@asadasanjuan.cr');
    expect(payload.role).toBe(Role.FONTANERO);
    expect(payload.role).not.toBe(Role.ADMINISTRADORA);
  });
});
