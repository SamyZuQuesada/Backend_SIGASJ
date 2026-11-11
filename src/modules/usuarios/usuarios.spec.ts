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
import { UsuariosService } from './usuarios.service';
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
  let usuariosService: UsuariosService;
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
    usuariosService = moduleFixture.get(UsuariosService);
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
      role: Role.SECRETARIA_EJECUTIVA,
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
    expect(secretaria.rol.nombre).toBe(Role.SECRETARIA_EJECUTIVA);
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
    expect(serialized).not.toMatch(/\$2[aby]\$/);
    expect(response.body).toHaveProperty('data');
    const data = (response.body as { data: Array<Record<string, unknown>> })
      .data;
    expect(data.length).toBeGreaterThan(0);
    for (const row of data) {
      expect(typeof row.id).toBe('number');
      expect(typeof row.nombre).toBe('string');
      expect(typeof row.correo).toBe('string');
      expect(typeof row.activo).toBe('boolean');
      expect(typeof row.rol).toBe('string');
      expect(row).not.toHaveProperty('passwordHash');
    }
    expect(jwtService).toBeDefined();
  });

  it('find() normal no carga passwordHash; addSelect sí lo obtiene', async () => {
    const correo = 'hash.select@asadasanjuan.cr';
    await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Select Hash',
      correo,
      role: Role.FONTANERO,
    });
    const sinHash = await usuarios.findOne({ where: { correo } });
    expect(sinHash).toBeTruthy();
    expect(sinHash?.passwordHash).toBeUndefined();

    const conHash = await usuarios
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordHash')
      .where('usuario.correo = :correo', { correo })
      .getOne();
    expect(conHash?.passwordHash).toBeDefined();
    expect(conHash?.passwordHash).not.toBe(PASSWORD_PRUEBA);
    expect(conHash?.passwordHash?.startsWith('$2')).toBe(true);
  });

  it('applyPlainPassword: hash al crear; update sin password no re-hashea', async () => {
    const correo = 'pwd.change@asadasanjuan.cr';
    const entity = usuarios.create({
      nombre: 'Cambio Pwd',
      correo,
      passwordHash: '',
      activo: true,
      idRol: rolesMap[Role.ABONADO].idRol,
    });
    const applied = await usuariosService.applyPlainPassword(
      entity,
      'TestPassword123!',
    );
    expect(applied).toBe(true);
    expect(entity.passwordHash).not.toBe('TestPassword123!');
    expect(entity.passwordHash.startsWith('$2')).toBe(true);
    await usuarios.save(entity);

    const conHash = await usuarios
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordHash')
      .where('usuario.correo = :correo', { correo })
      .getOne();
    const hashOriginal = conHash!.passwordHash;
    expect(hashOriginal).toBeDefined();

    const sinCambio = await usuariosService.applyPlainPassword(conHash!, '');
    expect(sinCambio).toBe(false);
    expect(conHash!.passwordHash).toBe(hashOriginal);

    const sinCambioNull = await usuariosService.applyPlainPassword(
      conHash!,
      undefined,
    );
    expect(sinCambioNull).toBe(false);
    expect(conHash!.passwordHash).toBe(hashOriginal);

    const cambiado = await usuariosService.applyPlainPassword(
      conHash!,
      'NuevaPassword456!',
    );
    expect(cambiado).toBe(true);
    expect(conHash!.passwordHash).not.toBe(hashOriginal);
    expect(conHash!.passwordHash).not.toBe('NuevaPassword456!');
    await usuarios.save(conHash!);

    const loginVieja = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: correo, password: 'TestPassword123!' });
    expect(loginVieja.status).toBe(401);

    const loginNueva = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: correo, password: 'NuevaPassword456!' });
    expect(loginNueva.status).toBe(200);
    expect(loginNueva.body).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(loginNueva.body)).not.toMatch(/\$2[aby]\$/);
  });
});
