/**
 * Pruebas de la estructura de autenticación (backlog 10.1.x).
 * Datos 100% sintéticos. Persistencia en sqljs aislado (no producción).
 * No imprime passwords ni passwordHash.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { Role, ROLE_LABELS } from '../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { HttpLoggingInterceptor } from '../../common/interceptors/http-logging.interceptor';
import authConfig from '../../config/auth.config';
import jwtConfig from '../../config/jwt.config';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { UsuariosService } from '../usuarios/usuarios.service';
import {
  PASSWORD_PRUEBA,
  seedRolesBase,
} from '../usuarios/usuarios.test-helpers';
import { AuthModule } from './auth.module';
import { PasswordService } from './password.service';
import { comparePassword } from './password.util';

const SUFFIX = `authstruct.${Date.now()}`;
const PWD_A = PASSWORD_PRUEBA;
const PWD_B = 'NuevaSintetica456!';

describe('Estructura de autenticación (integral)', () => {
  jest.setTimeout(45_000);

  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usuarios: Repository<Usuario>;
  let rolesMap: Record<Role, Rol>;
  let passwordService: PasswordService;
  let usuariosService: UsuariosService;
  let jwtService: JwtService;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let capturedLogs: string[];

  const correo = (tag: string) => `${tag}.${SUFFIX}@test.sigasj.local`;

  const assertNoSecrets = (payload: unknown) => {
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/passwordHash/i);
    expect(serialized).not.toMatch(/\$2[aby]\$/);
    expect(serialized).not.toContain(PWD_A);
    expect(serialized).not.toContain(PWD_B);
  };

  const loadWithHash = (email: string) =>
    usuarios
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .addSelect('usuario.passwordHash')
      .where('usuario.correo = :email', { email: email.toLowerCase() })
      .getOneOrFail();

  const createSynthetic = async (
    tag: string,
    role: Role,
    activo = true,
  ): Promise<Usuario> => {
    const entity = usuarios.create({
      nombre: `TEST_${tag}_AUTH`,
      correo: correo(tag),
      passwordHash: '',
      activo,
      idRol: rolesMap[role].idRol,
      rol: rolesMap[role],
    });
    const applied = await usuariosService.applyPlainPassword(entity, PWD_A);
    expect(applied).toBe(true);
    expect(entity.passwordHash).not.toBe(PWD_A);
    expect(entity.passwordHash.startsWith('$2')).toBe(true);
    return usuarios.save(entity);
  };

  beforeAll(async () => {
    capturedLogs = [];
    logSpy = jest
      .spyOn(console, 'log')
      .mockImplementation((...args: unknown[]) => {
        capturedLogs.push(args.map(String).join(' '));
      });
    warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation((...args: unknown[]) => {
        capturedLogs.push(args.map(String).join(' '));
      });
    errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation((...args: unknown[]) => {
        capturedLogs.push(args.map(String).join(' '));
      });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig, authConfig],
        }),
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          dropSchema: true,
          entities: [Usuario, Rol],
          synchronize: true,
        }),
        AuthModule,
        UsuariosModule,
      ],
      providers: [
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor },
      ],
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

    dataSource = moduleFixture.get(DataSource);
    usuarios = dataSource.getRepository(Usuario);
    rolesMap = await seedRolesBase(dataSource.getRepository(Rol));
    passwordService = moduleFixture.get(PasswordService);
    usuariosService = moduleFixture.get(UsuariosService);
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    await app.close();
  });

  describe('PasswordService / hash', () => {
    it('genera hash distinto de la password y compare correcta/incorrecta', async () => {
      const hash = await passwordService.hashPassword(PWD_A);
      expect(hash).not.toBe(PWD_A);
      expect(hash.startsWith('$2')).toBe(true);
      expect(await passwordService.comparePassword(PWD_A, hash)).toBe(true);
      expect(await passwordService.comparePassword(PWD_B, hash)).toBe(false);
      expect(await passwordService.comparePassword(PWD_A, 'not-a-hash')).toBe(
        false,
      );
    });

    it('dos hashes de la misma password pueden diferir (salt bcrypt)', async () => {
      const a = await passwordService.hashPassword(PWD_A);
      const b = await passwordService.hashPassword(PWD_A);
      expect(a).not.toBe(b);
      expect(await comparePassword(PWD_A, a)).toBe(true);
      expect(await comparePassword(PWD_A, b)).toBe(true);
    });
  });

  describe('Creación sintéticos + roles + persistencia', () => {
    let admin: Usuario;
    let secretaria: Usuario;
    let fontanero: Usuario;

    beforeAll(async () => {
      admin = await createSynthetic('ADMIN', Role.ADMINISTRADORA);
      secretaria = await createSynthetic(
        'SECRETARIA',
        Role.SECRETARIA_EJECUTIVA,
      );
      fontanero = await createSynthetic('FONTANERO', Role.FONTANERO);
    });

    it('persiste tres usuarios con hash bcrypt y sin password plano en columnas', async () => {
      const rows = await usuarios
        .createQueryBuilder('usuario')
        .addSelect('usuario.passwordHash')
        .leftJoinAndSelect('usuario.rol', 'rol')
        .where('usuario.correo LIKE :pat', {
          pat: `%.${SUFFIX}@test.sigasj.local`,
        })
        .getMany();

      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row.passwordHash).toBeDefined();
        expect(row.passwordHash.length).toBeGreaterThanOrEqual(50);
        expect(row.passwordHash).not.toBe(PWD_A);
        expect(await comparePassword(PWD_A, row.passwordHash)).toBe(true);
        expect(row.correo).not.toContain('password');
      }

      const meta = dataSource.getMetadata(Usuario);
      expect(meta.findColumnWithPropertyName('password')).toBeUndefined();
      expect(meta.findColumnWithPropertyName('passwordHash')).toBeDefined();
    });

    it('roles coinciden con definición central (valores estables)', async () => {
      const a = await loadWithHash(admin.correo);
      const s = await loadWithHash(secretaria.correo);
      const f = await loadWithHash(fontanero.correo);

      expect(a.rol.nombre).toBe(Role.ADMINISTRADORA);
      expect(a.rol.nombre).toBe('ADMINISTRADORA');
      expect(ROLE_LABELS[Role.ADMINISTRADORA]).toBe('Administradora');

      expect(s.rol.nombre).toBe(Role.SECRETARIA_EJECUTIVA);
      expect(s.rol.nombre).toBe('SECRETARIA');
      expect(ROLE_LABELS[Role.SECRETARIA_EJECUTIVA]).toBe(
        'Secretaria Ejecutiva',
      );
      expect(s.rol.nombre).not.toBe('Secretaria');
      expect(s.rol.nombre).not.toBe('Secretaria Ejecutiva');

      expect(f.rol.nombre).toBe(Role.FONTANERO);
      expect(f.rol.nombre).toBe('FONTANERO');
    });

    it('find() normal no carga passwordHash; toPublico tampoco lo expone', async () => {
      const sinHash = await usuarios.findOne({
        where: { correo: admin.correo },
        relations: { rol: true },
      });
      expect(sinHash?.passwordHash).toBeUndefined();
      const publico = usuariosService.toPublico(sinHash!);
      expect(publico).not.toHaveProperty('passwordHash');
      expect(publico).not.toHaveProperty('password');
      assertNoSecrets(publico);
    });
  });

  describe('Estado activo / inactivo', () => {
    it('persiste Activo → Inactivo → Activo y Auth rechaza inactivo', async () => {
      const user = await createSynthetic('ESTADO', Role.FONTANERO, true);
      expect(user.activo).toBe(true);

      await usuarios.update(user.idUsuario, { activo: false });
      const inactivo = await usuarios.findOneByOrFail({
        idUsuario: user.idUsuario,
      });
      expect(inactivo.activo).toBe(false);

      const loginInactivo = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.correo, password: PWD_A });
      expect(loginInactivo.status).toBe(401);
      assertNoSecrets(loginInactivo.body);

      await usuarios.update(user.idUsuario, { activo: true });
      const activo = await usuarios.findOneByOrFail({
        idUsuario: user.idUsuario,
      });
      expect(activo.activo).toBe(true);

      const loginActivo = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.correo, password: PWD_A });
      expect(loginActivo.status).toBe(200);
      assertNoSecrets(loginActivo.body);
    });
  });

  describe('Cambio de password (applyPlainPassword) sin doble hash', () => {
    it('cambia hash; antigua falla; nueva funciona; update vacío no re-hashea', async () => {
      const user = await createSynthetic('PWDCHG', Role.ABONADO);
      const before = await loadWithHash(user.correo);
      const hashAntes = before.passwordHash;

      const changed = await usuariosService.applyPlainPassword(before, PWD_B);
      expect(changed).toBe(true);
      expect(before.passwordHash).not.toBe(hashAntes);
      expect(before.passwordHash).not.toBe(PWD_B);
      await usuarios.save(before);

      const after = await loadWithHash(user.correo);
      expect(await comparePassword(PWD_A, after.passwordHash)).toBe(false);
      expect(await comparePassword(PWD_B, after.passwordHash)).toBe(true);

      const hashTrasCambio = after.passwordHash;
      const noOp = await usuariosService.applyPlainPassword(after, '');
      expect(noOp).toBe(false);
      expect(after.passwordHash).toBe(hashTrasCambio);

      const loginVieja = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.correo, password: PWD_A });
      expect(loginVieja.status).toBe(401);

      const loginNueva = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.correo, password: PWD_B });
      expect(loginNueva.status).toBe(200);
      assertNoSecrets(loginNueva.body);
    });
  });

  describe('Responses y JWT seguros', () => {
    let adminToken: string;

    beforeAll(async () => {
      await createSynthetic('RESP', Role.ADMINISTRADORA);
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: correo('RESP'), password: PWD_A })
        .expect(200);
      adminToken = (login.body as { accessToken: string }).accessToken;
      const decoded: unknown = jwtService.decode(adminToken);
      expect(decoded).toEqual(
        expect.objectContaining({ role: Role.ADMINISTRADORA }),
      );
      assertNoSecrets(decoded);
      assertNoSecrets(login.body);
    });

    it('login incorrecto no expone hash ni password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: correo('RESP'), password: 'WrongPass999!' })
        .expect(401);
      assertNoSecrets(res.body);
    });

    it('GET /usuarios no expone passwordHash', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/usuarios')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertNoSecrets(res.body);
      const data = (res.body as { data: Array<Record<string, unknown>> }).data;
      expect(data.length).toBeGreaterThan(0);
      for (const row of data) {
        expect(row).not.toHaveProperty('passwordHash');
        expect(row).not.toHaveProperty('password');
      }
    });

    it('sin token → 401; Fontanero en ruta admin/secretaria → 403', async () => {
      await request(app.getHttpServer()).get('/api/v1/usuarios').expect(401);

      await createSynthetic('GUARD_FONT', Role.FONTANERO);
      const fontLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: correo('GUARD_FONT'), password: PWD_A })
        .expect(200);
      const fontToken = (fontLogin.body as { accessToken: string }).accessToken;

      await request(app.getHttpServer())
        .get('/api/v1/usuarios')
        .set('Authorization', `Bearer ${fontToken}`)
        .expect(403);

      await createSynthetic('GUARD_SEC', Role.SECRETARIA_EJECUTIVA);
      const secLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: correo('GUARD_SEC'), password: PWD_A })
        .expect(200);
      const secToken = (secLogin.body as { accessToken: string }).accessToken;
      await request(app.getHttpServer())
        .get('/api/v1/usuarios')
        .set('Authorization', `Bearer ${secToken}`)
        .expect(200);
    });
  });

  describe('Logs', () => {
    it('flujos create/login no dejan password ni bcrypt hash en console', () => {
      const blob = capturedLogs.join('\n');
      expect(blob).not.toContain(PWD_A);
      expect(blob).not.toContain(PWD_B);
      expect(blob).not.toMatch(/\$2[aby]\$[^\s]{20,}/);
      expect(blob).not.toMatch(/passwordHash\s*[:=]/i);
    });
  });

  describe('Cleanup / repetibilidad', () => {
    it('usuarios de esta suite son identificables por correo sintético', () => {
      return usuarios
        .createQueryBuilder('usuario')
        .where('usuario.correo LIKE :pat', {
          pat: `%.${SUFFIX}@test.sigasj.local`,
        })
        .getCount()
        .then((count) => {
          expect(count).toBeGreaterThanOrEqual(3);
        });
      // sqljs dropSchema en next run → cleanup automático
    });
  });
});
