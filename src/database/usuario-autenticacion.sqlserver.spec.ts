import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config as loadEnv } from 'dotenv';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { HttpLoggingInterceptor } from '../common/interceptors/http-logging.interceptor';
import { Role } from '../common/enums/role.enum';
import authConfig from '../config/auth.config';
import jwtConfig from '../config/jwt.config';
import { PasswordService } from '../modules/auth/password.service';
import { Usuario } from '../modules/usuarios/entities/usuario.entity';
import { UsuariosModule } from '../modules/usuarios/usuarios.module';
import { UsuariosService } from '../modules/usuarios/usuarios.service';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

const authFlagPrevio = process.env.AUTH_REQUIRE_PASSWORD;
const runId = Date.now().toString(36);
const claveInicial = `Qa${runId}Aa1`;
const claveNueva = `Qb${runId}Bb2`;
const claveAjena = `Qc${runId}Cc3`;
const secretos = [claveInicial, claveNueva, claveAjena];

const correos = {
  operador: `qa.auth.${runId}.operador@sigasj.test`,
  administradora: `qa.auth.${runId}.admin@sigasj.test`,
  secretaria: `qa.auth.${runId}.secretaria@sigasj.test`,
  fontanero: `qa.auth.${runId}.fontanero@sigasj.test`,
};

type Publico = {
  id: number;
  nombre: string;
  correo: string;
  activo: boolean;
  rol: string;
};

type LoginBody = {
  accessToken?: string;
  user?: { id: number; role: string; email: string; name: string };
  statusCode?: number;
  message?: string | string[];
};

type ColumnInfo = {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  CHARACTER_MAXIMUM_LENGTH: number | null;
  IS_NULLABLE: string;
  COLUMN_DEFAULT: string | null;
};

type CountRow = { total: number | string };

const prefijoCorreo = `qa.auth.${runId}.%@sigasj.test`;

function textoDe(value: unknown): string {
  return JSON.stringify(value) ?? '';
}

function exponeSecreto(value: unknown): boolean {
  const texto = textoDe(value);
  if (/\$2[aby]\$/.test(texto)) {
    return true;
  }
  return secretos.some((secreto) => texto.includes(secreto));
}

/**
 * Comprueba la estructura de autenticación contra la base local SIGASJ.
 * Los usuarios llevan el prefijo qa.auth.<ejecución> y se borran al final.
 * No escribe contraseñas ni hashes en logs de la prueba.
 */
describe('Estructura de autenticación en SQL Server de desarrollo', () => {
  jest.setTimeout(180_000);

  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usuarios: Repository<Usuario>;
  let passwordService: PasswordService;
  let usuariosService: UsuariosService;
  let jwtService: JwtService;
  let tokenOperador = '';
  let baseline = 0;
  const registros: string[] = [];
  const restaurarLoggers: Array<() => void> = [];

  const contar = async (): Promise<number> => {
    const rows = await dataSource.query<CountRow[]>(
      'SELECT COUNT(*) AS total FROM Usuario',
    );
    return Number(rows[0]?.total ?? 0);
  };

  const contarCorreo = async (correo: string): Promise<number> => {
    const rows = await dataSource.query<CountRow[]>(
      'SELECT COUNT(*) AS total FROM Usuario WHERE correo LIKE @0',
      [correo],
    );
    return Number(rows[0]?.total ?? 0);
  };

  const hashCoincide = async (id: number, plain: string): Promise<boolean> => {
    const row = await usuarios
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordHash')
      .where('usuario.idUsuario = :id', { id })
      .getOne();
    const hash = row?.passwordHash;
    if (
      !hash ||
      hash === plain ||
      !hash.startsWith('$2') ||
      hash.length < 50 ||
      hash.length > 255
    ) {
      return false;
    }
    return passwordService.compare(plain, hash);
  };

  const leerHash = async (id: number): Promise<string> => {
    const row = await usuarios
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordHash')
      .where('usuario.idUsuario = :id', { id })
      .getOne();
    if (!row?.passwordHash) {
      throw new Error('passwordHash ausente en el usuario sintético');
    }
    return row.passwordHash;
  };

  const limpiar = async (): Promise<void> => {
    if (!usuarios) {
      return;
    }
    await usuarios
      .createQueryBuilder()
      .delete()
      .where('correo LIKE :correo AND nombre LIKE :nombre', {
        correo: prefijoCorreo,
        nombre: 'QA Auth %',
      })
      .execute();
  };

  beforeAll(async () => {
    if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
      throw new Error('Esta prueba no se ejecuta en producción.');
    }
    const host = (process.env.DB_HOST || 'localhost').toLowerCase();
    const local =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.includes('localdb') ||
      host.includes('\\');
    if (!local) {
      throw new Error(
        'La prueba de autenticación solo corre contra una base local.',
      );
    }
    const database = (
      process.env.DB_DATABASE ||
      process.env.DB_NAME ||
      ''
    ).toLowerCase();
    if (database !== 'sigasj') {
      throw new Error('La base configurada no es la base de desarrollo.');
    }

    process.env.AUTH_REQUIRE_PASSWORD = 'true';

    const options = {
      ...buildMigrationDataSourceOptions(),
      logging: false,
      synchronize: false,
      migrationsRun: false,
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig, authConfig],
        }),
        TypeOrmModule.forRoot(options),
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
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    const anotar =
      (nivel: 'log' | 'warn' | 'error') =>
      (...args: unknown[]) => {
        registros.push(
          args
            .map((value) => (typeof value === 'string' ? value : ''))
            .join(' '),
        );
        if (nivel === 'error') {
          return;
        }
      };
    for (const nivel of ['log', 'warn', 'error'] as const) {
      const spy = jest
        .spyOn(Logger.prototype, nivel)
        .mockImplementation(anotar(nivel));
      restaurarLoggers.push(() => spy.mockRestore());
    }

    await app.init();

    dataSource = moduleFixture.get(DataSource);
    usuarios = dataSource.getRepository(Usuario);
    passwordService = moduleFixture.get(PasswordService);
    usuariosService = moduleFixture.get(UsuariosService);
    jwtService = moduleFixture.get(JwtService);

    const config = moduleFixture.get(ConfigService);
    if (config.get<boolean>('auth.devLoginWithoutPassword') !== false) {
      throw new Error(
        'La prueba exige comparación de contraseña y el entorno la está omitiendo.',
      );
    }
    if (config.get<boolean>('auth.alignRolePickerPassword') !== false) {
      throw new Error(
        'La prueba no debe realinear contraseñas de cuentas existentes.',
      );
    }
    if (dataSource.options.synchronize !== false) {
      throw new Error('synchronize debe permanecer desactivado.');
    }

    const catalogo = await dataSource.query<Array<{ nombre: string }>>(
      'SELECT DB_NAME() AS nombre',
    );
    if (catalogo[0]?.nombre !== 'SIGASJ') {
      throw new Error('La conexión no apunta a la base de desarrollo.');
    }

    baseline = await contar();
  });

  afterAll(async () => {
    try {
      await limpiar();
      if (dataSource?.isInitialized) {
        const restantes = await contarCorreo(prefijoCorreo);
        const total = await contar();
        if (restantes !== 0 || total !== baseline) {
          throw new Error(
            'La limpieza no restauró el conteo de usuarios de desarrollo.',
          );
        }
      }
      if (app) {
        await app.close();
      }
    } finally {
      for (const restaurar of restaurarLoggers) {
        restaurar();
      }
      if (authFlagPrevio === undefined) {
        delete process.env.AUTH_REQUIRE_PASSWORD;
      } else {
        process.env.AUTH_REQUIRE_PASSWORD = authFlagPrevio;
      }
    }
  });

  it('la tabla Usuario coincide con la entidad y no guarda contraseña plana', async () => {
    const metadata = dataSource.getMetadata(Usuario);
    const entityColumns = metadata.columns
      .map((column) => column.databaseName)
      .sort();
    const columns = await dataSource.query<ColumnInfo[]>(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Usuario'
    `);
    const dbColumns = columns.map((column) => column.COLUMN_NAME).sort();
    expect(dbColumns).toEqual(entityColumns);
    expect(dbColumns).toEqual(
      [
        'activo',
        'correo',
        'idRol',
        'idUsuario',
        'nombre',
        'passwordHash',
      ].sort(),
    );

    const hash = columns.find(
      (column) => column.COLUMN_NAME === 'passwordHash',
    );
    expect(hash?.DATA_TYPE).toBe('varchar');
    expect(hash?.CHARACTER_MAXIMUM_LENGTH).toBe(255);
    expect(hash?.IS_NULLABLE).toBe('NO');
    const correo = columns.find((column) => column.COLUMN_NAME === 'correo');
    expect(correo?.IS_NULLABLE).toBe('NO');
    expect(correo?.CHARACTER_MAXIMUM_LENGTH).toBe(150);
    const activo = columns.find((column) => column.COLUMN_NAME === 'activo');
    expect(activo?.DATA_TYPE).toBe('bit');
    expect(activo?.IS_NULLABLE).toBe('NO');
    expect(activo?.COLUMN_DEFAULT ?? '').toContain('1');

    const passwordPlano = await dataSource.query<CountRow[]>(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'Usuario'
        AND COLUMN_NAME IN ('password', 'clave', 'contrasena', 'contraseña')
    `);
    expect(Number(passwordPlano[0]?.total)).toBe(0);

    const unique = await dataSource.query<CountRow[]>(`
      SELECT COUNT(*) AS total
      FROM sys.indexes
      WHERE object_id = OBJECT_ID('Usuario')
        AND name = 'UQ_Usuario_correo'
        AND is_unique = 1
    `);
    expect(Number(unique[0]?.total)).toBe(1);

    const fk = await dataSource.query<
      Array<{ fk_name: string; ref_table: string; on_delete: string }>
    >(`
      SELECT fk.name AS fk_name,
             OBJECT_NAME(fk.referenced_object_id) AS ref_table,
             fk.delete_referential_action_desc AS on_delete
      FROM sys.foreign_keys fk
      WHERE fk.parent_object_id = OBJECT_ID('Usuario')
        AND fk.name = 'FK_Usuario_Rol_idRol'
    `);
    expect(fk).toHaveLength(1);
    expect(fk[0]?.ref_table).toBe('Rol');
    expect(fk[0]?.on_delete).toBe('NO_ACTION');
  });

  it('PasswordService genera hashes con salt y compare distingue la contraseña', async () => {
    const primero = await passwordService.hash(claveInicial);
    const segundo = await passwordService.hash(claveInicial);
    expect(primero === segundo).toBe(false);
    expect(primero === claveInicial).toBe(false);
    expect(await passwordService.compare(claveInicial, primero)).toBe(true);
    expect(await passwordService.compare(claveAjena, primero)).toBe(false);
    expect(await passwordService.compare(claveInicial, 'no-es-un-hash')).toBe(
      false,
    );
    await expect(passwordService.hash('')).rejects.toThrow(
      'La contraseña no es válida.',
    );
  });

  it('crea Administradora, Secretaria Ejecutiva y Fontanero por el flujo real', async () => {
    const operador = await usuariosService.crear({
      nombre: 'QA Auth Operador',
      correo: correos.operador,
      password: claveInicial,
      rol: Role.ADMINISTRADORA,
    });
    expect(operador).not.toHaveProperty('passwordHash');
    expect(operador).not.toHaveProperty('password');
    expect(exponeSecreto(operador)).toBe(false);

    const loginOperador = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: correos.operador, password: claveInicial })
      .expect(200);
    const cuerpoLogin = loginOperador.body as LoginBody;
    tokenOperador = cuerpoLogin.accessToken ?? '';
    expect(tokenOperador.length).toBeGreaterThan(0);
    expect(cuerpoLogin.user?.role).toBe(Role.ADMINISTRADORA);
    expect(exponeSecreto(cuerpoLogin)).toBe(false);
    const payload = jwtService.verify<LoginBody['user']>(tokenOperador);
    expect(payload?.role).toBe(Role.ADMINISTRADORA);
    expect(exponeSecreto(payload)).toBe(false);

    const creados: Array<{ correo: string; rol: Role; nombre: string }> = [
      {
        nombre: 'QA Auth Administradora',
        correo: correos.administradora,
        rol: Role.ADMINISTRADORA,
      },
      {
        nombre: 'QA Auth Secretaria Ejecutiva',
        correo: correos.secretaria,
        rol: Role.SECRETARIA,
      },
      {
        nombre: 'QA Auth Fontanero',
        correo: correos.fontanero,
        rol: Role.FONTANERO,
      },
    ];

    for (const cuenta of creados) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/usuarios')
        .set('Authorization', `Bearer ${tokenOperador}`)
        .send({
          nombre: cuenta.nombre,
          correo: cuenta.correo,
          password: claveInicial,
          rol: cuenta.rol,
          activo: true,
        })
        .expect(201);
      const body = response.body as Publico;
      expect(body.correo).toBe(cuenta.correo);
      expect(body.rol).toBe(cuenta.rol);
      expect(body.activo).toBe(true);
      expect(body).not.toHaveProperty('passwordHash');
      expect(body).not.toHaveProperty('password');
      expect(exponeSecreto(body)).toBe(false);

      const persistido = await usuarios.findOne({
        where: { correo: cuenta.correo },
        relations: { rol: true },
      });
      expect(persistido?.passwordHash).toBeUndefined();
      expect(persistido?.rol.nombre).toBe(cuenta.rol);
      expect(persistido?.activo).toBe(true);
      expect(JSON.stringify(persistido)).not.toMatch(/passwordHash/i);
      expect(await hashCoincide(body.id, claveInicial)).toBe(true);
      expect(await hashCoincide(body.id, claveAjena)).toBe(false);

      const sesion = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: cuenta.correo, password: claveInicial })
        .expect(200);
      const sesionBody = sesion.body as LoginBody;
      expect(sesionBody.user?.role).toBe(cuenta.rol);
      expect(
        jwtService.verify<{ role: string }>(sesionBody.accessToken ?? '').role,
      ).toBe(cuenta.rol);
      expect(exponeSecreto(sesionBody)).toBe(false);
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: cuenta.correo, password: claveAjena })
        .expect(401);
    }

    const rechazado = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({
        nombre: 'QA Auth Invalido',
        correo: `qa.auth.${runId}.invalido@sigasj.test`,
        password: claveInicial,
        rol: 'Administradora',
      })
      .expect(400);
    expect(exponeSecreto(rechazado.body)).toBe(false);
    expect(await contarCorreo(`qa.auth.${runId}.invalido@sigasj.test`)).toBe(0);
  });

  it('listado, login y serialización no exponen el hash', async () => {
    const listado = await request(app.getHttpServer())
      .get('/api/v1/usuarios')
      .set('Authorization', `Bearer ${tokenOperador}`)
      .expect(200);
    const data = (listado.body as { data: Publico[] }).data;
    const nuestros = data.filter((row) =>
      row.correo.startsWith(`qa.auth.${runId}.`),
    );
    expect(nuestros).toHaveLength(4);
    for (const row of data) {
      expect(row).not.toHaveProperty('passwordHash');
      expect(row).not.toHaveProperty('password');
    }
    expect(exponeSecreto(listado.body)).toBe(false);
    expect(nuestros.map((row) => row.rol).sort()).toEqual(
      [
        Role.ADMINISTRADORA,
        Role.ADMINISTRADORA,
        Role.FONTANERO,
        Role.SECRETARIA,
      ].sort(),
    );
  });

  it('cambia activo e inactivo y el login inactivo se rechaza', async () => {
    const fontanero = await usuarios.findOneByOrFail({
      correo: correos.fontanero,
    });
    expect(fontanero.activo).toBe(true);

    const inactivo = await request(app.getHttpServer())
      .patch(`/api/v1/usuarios/${fontanero.idUsuario}`)
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({ activo: false })
      .expect(200);
    expect((inactivo.body as Publico).activo).toBe(false);
    expect(exponeSecreto(inactivo.body)).toBe(false);
    const guardadoInactivo = await usuarios.findOneByOrFail({
      idUsuario: fontanero.idUsuario,
    });
    expect(guardadoInactivo.activo).toBe(false);

    const rechazo = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: correos.fontanero, password: claveInicial })
      .expect(401);
    expect(rechazo.body).toMatchObject({
      statusCode: 401,
      message: 'El usuario se encuentra inactivo.',
    });
    expect(exponeSecreto(rechazo.body)).toBe(false);

    const activo = await request(app.getHttpServer())
      .patch(`/api/v1/usuarios/${fontanero.idUsuario}`)
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({ activo: true })
      .expect(200);
    expect((activo.body as Publico).activo).toBe(true);
    const guardadoActivo = await usuarios.findOneByOrFail({
      idUsuario: fontanero.idUsuario,
    });
    expect(guardadoActivo.activo).toBe(true);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: correos.fontanero, password: claveInicial })
      .expect(200);
  });

  it('reemplaza el hash al cambiar la contraseña y lo conserva si no se envía', async () => {
    const fontanero = await usuarios.findOneByOrFail({
      correo: correos.fontanero,
    });
    const hashAntes = await leerHash(fontanero.idUsuario);

    const cambio = await request(app.getHttpServer())
      .patch(`/api/v1/usuarios/${fontanero.idUsuario}`)
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({ password: claveNueva })
      .expect(200);
    expect(cambio.body).not.toHaveProperty('passwordHash');
    expect(exponeSecreto(cambio.body)).toBe(false);

    const hashDespues = await leerHash(fontanero.idUsuario);
    expect(hashAntes === hashDespues).toBe(false);
    expect(await hashCoincide(fontanero.idUsuario, claveInicial)).toBe(false);
    expect(await hashCoincide(fontanero.idUsuario, claveNueva)).toBe(true);

    const soloNombre = await request(app.getHttpServer())
      .patch(`/api/v1/usuarios/${fontanero.idUsuario}`)
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({ nombre: 'QA Auth Fontanero Editado' })
      .expect(200);
    expect((soloNombre.body as Publico).nombre).toBe(
      'QA Auth Fontanero Editado',
    );
    expect(exponeSecreto(soloNombre.body)).toBe(false);
    expect((await leerHash(fontanero.idUsuario)) === hashDespues).toBe(true);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: correos.fontanero, password: claveInicial })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: correos.fontanero, password: claveNueva })
      .expect(200);
  });

  it('aplica 401 sin token y 403 cuando el rol no está autorizado', async () => {
    await request(app.getHttpServer()).get('/api/v1/usuarios').expect(401);

    const secretaria = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: correos.secretaria, password: claveInicial })
      .expect(200);
    const tokenSecretaria = (secretaria.body as LoginBody).accessToken ?? '';
    await request(app.getHttpServer())
      .get('/api/v1/usuarios')
      .set('Authorization', `Bearer ${tokenSecretaria}`)
      .expect(200);
    const secretariaBloqueada = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .set('Authorization', `Bearer ${tokenSecretaria}`)
      .send({
        nombre: 'QA Auth Extra',
        correo: `qa.auth.${runId}.extra@sigasj.test`,
        password: claveInicial,
        rol: Role.FONTANERO,
      })
      .expect(403);
    expect(secretariaBloqueada.body).toMatchObject({
      message: 'Acceso denegado',
    });

    const fontanero = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: correos.fontanero, password: claveNueva })
      .expect(200);
    const tokenFontanero = (fontanero.body as LoginBody).accessToken ?? '';
    expect(jwtService.verify<{ role: string }>(tokenFontanero).role).toBe(
      Role.FONTANERO,
    );
    const fontaneroBloqueado = await request(app.getHttpServer())
      .get('/api/v1/usuarios')
      .set('Authorization', `Bearer ${tokenFontanero}`)
      .expect(403);
    expect(fontaneroBloqueado.body).toMatchObject({
      message: 'Acceso denegado',
    });
    expect(exponeSecreto(fontaneroBloqueado.body)).toBe(false);

    const administradora = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: correos.administradora, password: claveInicial })
      .expect(200);
    const tokenAdministradora =
      (administradora.body as LoginBody).accessToken ?? '';
    await request(app.getHttpServer())
      .get('/api/v1/usuarios')
      .set('Authorization', `Bearer ${tokenAdministradora}`)
      .expect(200);
    expect(jwtService.verify<{ role: string }>(tokenAdministradora).role).toBe(
      Role.ADMINISTRADORA,
    );
  });

  it('los logs de alta, login y error no contienen contraseña ni hash', () => {
    expect(exponeSecreto(registros)).toBe(false);
    expect(
      registros.some((linea) => linea.includes('Usuario creado: id=')),
    ).toBe(true);
  });

  it('borra los usuarios sintéticos y conserva el conteo de desarrollo', async () => {
    expect(await contarCorreo(prefijoCorreo)).toBe(4);
    const conHash = await dataSource.query<CountRow[]>(
      'SELECT COUNT(*) AS total FROM Usuario WHERE correo LIKE @0 AND passwordHash IS NOT NULL AND LEN(passwordHash) >= 50 AND LEFT(passwordHash, 2) = @1',
      [prefijoCorreo, '$2'],
    );
    const conRol = await dataSource.query<CountRow[]>(
      'SELECT COUNT(*) AS total FROM Usuario WHERE correo LIKE @0 AND idRol IS NOT NULL',
      [prefijoCorreo],
    );
    const conEstado = await dataSource.query<CountRow[]>(
      'SELECT COUNT(*) AS total FROM Usuario WHERE correo LIKE @0 AND activo IS NOT NULL',
      [prefijoCorreo],
    );
    expect(Number(conHash[0]?.total)).toBe(4);
    expect(Number(conRol[0]?.total)).toBe(4);
    expect(Number(conEstado[0]?.total)).toBe(4);
    expect(await contar()).toBe(baseline + 4);

    await limpiar();

    expect(await contarCorreo(prefijoCorreo)).toBe(0);
    expect(await contar()).toBe(baseline);
  });
});
