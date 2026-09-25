import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import { Role } from '../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  crearUsuarioPrueba,
  seedRolesBase,
  seedStaffLoginUsers,
} from '../usuarios/usuarios.test-helpers';
import { AveriasModule } from './averias.module';
import {
  AVERIAS_TEST_ENTITIES,
  vaciarNotificacionesAveriaPrueba,
} from './averias.test-entities';
import { Averia } from './entities/averia.entity';
import type {
  AveriaHistorialItem,
  AveriasHistorialListado,
} from './averias.service';

type SeedAveria = {
  codigoSeguimiento: string;
  fechaReporte: Date;
  nombreReportante: string;
  sectorComunidad: string;
  estado: EstadoAveria;
  prioridad?: string | null;
  tipoAveria?: string | null;
  idFontaneroAsignado?: number | null;
  fechaAsignacion?: Date | null;
  fechaInicioAtencion?: Date | null;
  fechaResolucion?: Date | null;
};

const CAMPOS_HISTORIAL = [
  'id',
  'codigoSeguimiento',
  'fechaReporte',
  'nombreReportante',
  'sectorComunidad',
  'estado',
  'tipoAveria',
  'prioridad',
  'fontanero',
  'fechaAsignacion',
  'fechaInicioAtencion',
  'fechaResolucion',
] as const;

const SENSIBLE =
  /identificacionReportante|telefonoReportante|correoReportante|ubicacion|descripcion|observacionesAtencion|idAbonado|password|"email"|"correo"/i;

describe('GET /api/v1/admin/averias/historial', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let averias: Repository<Averia>;
  let usuarios: Repository<Usuario>;
  let rolesMap: Record<Role, Rol>;
  let adminToken: string;
  let secretariaToken: string;
  let fontaneroId: number;
  let fontaneroNombre: string;
  let usuarioSeq = 0;

  const signAs = (role: Role, sub = '9') => {
    const payload: JwtPayload = {
      sub,
      email: 'usuario@asadasanjuan.cr',
      role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
  };

  const getHistorial = (
    query: Record<string, string | number> = {},
    token?: string | null,
  ) => {
    const req = request(app.getHttpServer()).get(
      '/api/v1/admin/averias/historial',
    );
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.query(query);
  };

  const persist = async (seed: SeedAveria) => {
    return averias.save(
      averias.create({
        codigoSeguimiento: seed.codigoSeguimiento,
        fechaReporte: seed.fechaReporte,
        nombreReportante: seed.nombreReportante,
        identificacionReportante: '1-2345-6789',
        telefonoReportante: '8888-8888',
        correoReportante: 'reportante@example.com',
        idAbonado: 44,
        ubicacion: '200 m este de la escuela',
        sectorComunidad: seed.sectorComunidad,
        descripcion: 'Fuga visible en tubería',
        estado: seed.estado,
        tipoAveria: seed.tipoAveria ?? null,
        prioridad: seed.prioridad ?? null,
        idFontaneroAsignado: seed.idFontaneroAsignado ?? null,
        fechaAsignacion: seed.fechaAsignacion ?? null,
        fechaInicioAtencion: seed.fechaInicioAtencion ?? null,
        fechaResolucion: seed.fechaResolucion ?? null,
        observacionesAtencion: 'nota interna',
      }),
    );
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig],
        }),
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          dropSchema: true,
          entities: [...AVERIAS_TEST_ENTITIES],
          synchronize: true,
        }),
        AuthModule,
        AveriasModule,
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
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    const dataSource = moduleFixture.get(DataSource);
    averias = dataSource.getRepository(Averia);
    usuarios = dataSource.getRepository(Usuario);
    rolesMap = await seedRolesBase(dataSource.getRepository(Rol));
    await seedStaffLoginUsers(usuarios, rolesMap);

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@asadasanjuan.cr', password: 'Password123!' });
    expect(adminLogin.status).toBe(200);
    adminToken = (adminLogin.body as { accessToken: string }).accessToken;

    const secretariaLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'secretaria@asadasanjuan.cr',
        password: 'Password123!',
      });
    expect(secretariaLogin.status).toBe(200);
    secretariaToken = (secretariaLogin.body as { accessToken: string })
      .accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await vaciarNotificacionesAveriaPrueba(averias.manager.connection);
    await averias.clear();
    await usuarios.clear();
    usuarioSeq += 1;
    const fontanero = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero historial',
      correo: `fontanero.hist.${usuarioSeq}.${Date.now()}@asadasanjuan.cr`,
      role: Role.FONTANERO,
    });
    fontaneroId = fontanero.idUsuario;
    fontaneroNombre = fontanero.nombre;

    await persist({
      codigoSeguimiento: 'AV-2026-0001',
      fechaReporte: new Date('2026-09-12T15:00:00.000Z'),
      nombreReportante: 'María Rodríguez',
      sectorComunidad: 'San Juan',
      estado: EstadoAveria.RECIBIDA,
    });
    await persist({
      codigoSeguimiento: 'AV-2026-0002',
      fechaReporte: new Date('2026-09-10T12:00:00.000Z'),
      nombreReportante: 'Juan Pérez',
      sectorComunidad: 'San Juan',
      estado: EstadoAveria.ASIGNADA,
      prioridad: 'ALTA',
      tipoAveria: 'TUBO_MADRE',
      idFontaneroAsignado: fontaneroId,
      fechaAsignacion: new Date('2026-09-10T13:00:00.000Z'),
    });
    await persist({
      codigoSeguimiento: 'AV-2026-0003',
      fechaReporte: new Date('2026-08-15T10:00:00.000Z'),
      nombreReportante: 'Ana Soto',
      sectorComunidad: 'Palmares',
      estado: EstadoAveria.PENDIENTE,
      prioridad: 'MEDIA',
      tipoAveria: 'TUBO_MEDIDOR',
      idFontaneroAsignado: fontaneroId,
      fechaAsignacion: new Date('2026-08-15T11:00:00.000Z'),
    });
    await persist({
      codigoSeguimiento: 'AV-2026-0004',
      fechaReporte: new Date('2026-08-20T09:00:00.000Z'),
      nombreReportante: 'Carlos Mora',
      sectorComunidad: 'San Juan Norte',
      estado: EstadoAveria.EN_ATENCION,
      prioridad: 'BAJA',
      tipoAveria: 'TUBO_MADRE',
      idFontaneroAsignado: fontaneroId,
      fechaAsignacion: new Date('2026-08-20T09:30:00.000Z'),
      fechaInicioAtencion: new Date('2026-08-20T10:00:00.000Z'),
    });
    await persist({
      codigoSeguimiento: 'AV-2026-0005',
      fechaReporte: new Date('2026-08-01T08:00:00.000Z'),
      nombreReportante: 'Lucía Brenes',
      sectorComunidad: 'Palmares',
      estado: EstadoAveria.RESUELTA,
      prioridad: 'ALTA',
      tipoAveria: 'TUBO_MEDIDOR',
      idFontaneroAsignado: fontaneroId,
      fechaAsignacion: new Date('2026-08-01T09:00:00.000Z'),
      fechaInicioAtencion: new Date('2026-08-01T10:00:00.000Z'),
      fechaResolucion: new Date('2026-08-01T16:00:00.000Z'),
    });
    await persist({
      codigoSeguimiento: 'AV-2026-0031',
      fechaReporte: new Date('2026-08-31T23:30:00.000Z'),
      nombreReportante: 'Elena Vargas',
      sectorComunidad: 'Cangrejal',
      estado: EstadoAveria.RECIBIDA,
    });
    for (const [code, day] of [
      ['AV-2026-0006', '10'],
      ['AV-2026-0007', '11'],
      ['AV-2026-0008', '12'],
    ] as const) {
      await persist({
        codigoSeguimiento: code,
        fechaReporte: new Date(`2026-07-${day}T08:00:00.000Z`),
        nombreReportante: `Vecino ${day}`,
        sectorComunidad: 'San Juan',
        estado: EstadoAveria.RECIBIDA,
      });
    }
  });

  const expectListShape = (body: AveriasHistorialListado) => {
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(typeof body.page).toBe('number');
    expect(typeof body.limit).toBe('number');
    expect(typeof body.totalPages).toBe('number');
  };

  const expectResumen = (item: AveriaHistorialItem) => {
    expect(Object.keys(item).sort()).toEqual([...CAMPOS_HISTORIAL].sort());
    expect(typeof item.id).toBe('number');
    expect(typeof item.codigoSeguimiento).toBe('string');
    expect(item.fechaReporte).toBeDefined();
    expect(typeof item.nombreReportante).toBe('string');
    expect(typeof item.sectorComunidad).toBe('string');
    expect(Object.values(EstadoAveria)).toContain(item.estado);
    expect(item.estado).not.toBe('REPORTADA');
    expect(item.estado).not.toBe('EN_PROCESO');
    expect(JSON.stringify(item)).not.toMatch(SENSIBLE);
    if (item.fontanero) {
      expect(Object.keys(item.fontanero).sort()).toEqual(['id', 'nombre']);
    }
  };

  it('Administradora autenticada recibe el historial paginado', async () => {
    const response = await getHistorial({}, adminToken).expect(200);
    const body = response.body as AveriasHistorialListado;
    expectListShape(body);
    expect(body).toMatchObject({ page: 1, limit: 20, total: 9, totalPages: 1 });
    expect(body.data).toHaveLength(9);
    body.data.forEach(expectResumen);
  });

  it('Secretaria autenticada consulta el historial', async () => {
    const body = (await getHistorial({}, secretariaToken).expect(200))
      .body as AveriasHistorialListado;
    expect(body.total).toBe(9);
  });

  it('sin token responde 401 y no devuelve data', async () => {
    const response = await getHistorial({}).expect(401);
    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    expect(response.body).not.toHaveProperty('data');
  });

  it('token inválido responde 401', async () => {
    await getHistorial({}, 'token-invalido').expect(401);
  });

  it('Fontanero y Abonado reciben 403', async () => {
    for (const role of [Role.FONTANERO, Role.ABONADO]) {
      const response = await getHistorial({}, signAs(role)).expect(403);
      expect(response.body).toMatchObject({
        statusCode: 403,
        message: 'Acceso denegado',
      });
      expect(response.body).not.toHaveProperty('data');
    }
  });

  it('incluye los estados vigentes, activos y resueltos, del más reciente al más antiguo', async () => {
    const body = (await getHistorial({}, adminToken).expect(200))
      .body as AveriasHistorialListado;
    const porCodigo = Object.fromEntries(
      body.data.map((item) => [item.codigoSeguimiento, item]),
    );

    expect(porCodigo['AV-2026-0001'].estado).toBe(EstadoAveria.RECIBIDA);
    expect(porCodigo['AV-2026-0002'].estado).toBe(EstadoAveria.ASIGNADA);
    expect(porCodigo['AV-2026-0003'].estado).toBe(EstadoAveria.PENDIENTE);
    expect(porCodigo['AV-2026-0004'].estado).toBe(EstadoAveria.EN_ATENCION);
    expect(porCodigo['AV-2026-0005'].estado).toBe(EstadoAveria.RESUELTA);

    expect(body.data.map((item) => item.codigoSeguimiento)).toEqual([
      'AV-2026-0001',
      'AV-2026-0002',
      'AV-2026-0031',
      'AV-2026-0004',
      'AV-2026-0003',
      'AV-2026-0005',
      'AV-2026-0008',
      'AV-2026-0007',
      'AV-2026-0006',
    ]);
    expect(JSON.stringify(body)).not.toMatch(/REPORTADA|EN_PROCESO|En proceso/);
  });

  it('muestra seguimiento y deja la resolución en null si aún no está resuelta', async () => {
    const body = (await getHistorial({}, adminToken).expect(200))
      .body as AveriasHistorialListado;
    const porCodigo = Object.fromEntries(
      body.data.map((item) => [item.codigoSeguimiento, item]),
    );

    const recibida = porCodigo['AV-2026-0001'];
    expect(recibida.prioridad).toBeNull();
    expect(recibida.tipoAveria).toBeNull();
    expect(recibida.fontanero).toBeNull();
    expect(recibida.fechaAsignacion).toBeNull();
    expect(recibida.fechaInicioAtencion).toBeNull();
    expect(recibida.fechaResolucion).toBeNull();
    expect(recibida.sectorComunidad).toBe('San Juan');
    expect(recibida.nombreReportante).toBe('María Rodríguez');

    const asignada = porCodigo['AV-2026-0002'];
    expect(asignada.prioridad).toBe('ALTA');
    expect(asignada.tipoAveria).toBe('TUBO_MADRE');
    expect(asignada.fontanero).toEqual({
      id: fontaneroId,
      nombre: fontaneroNombre,
    });
    expect(asignada.fechaAsignacion).not.toBeNull();
    expect(asignada.fechaInicioAtencion).toBeNull();
    expect(asignada.fechaResolucion).toBeNull();

    const enAtencion = porCodigo['AV-2026-0004'];
    expect(enAtencion.fechaInicioAtencion).not.toBeNull();
    expect(enAtencion.fechaResolucion).toBeNull();

    const resuelta = porCodigo['AV-2026-0005'];
    expect(new Date(resuelta.fechaResolucion as string).toISOString()).toBe(
      '2026-08-01T16:00:00.000Z',
    );
  });

  it('filtra por estado con el valor persistido o la etiqueta', async () => {
    const porCodigo = (
      await getHistorial({ estado: EstadoAveria.RESUELTA }, adminToken).expect(
        200,
      )
    ).body as AveriasHistorialListado;
    expect(porCodigo.data.map((item) => item.codigoSeguimiento)).toEqual([
      'AV-2026-0005',
    ]);

    const porEtiqueta = (
      await getHistorial({ estado: 'Resuelta' }, adminToken).expect(200)
    ).body as AveriasHistorialListado;
    expect(porEtiqueta.total).toBe(1);

    const pendiente = (
      await getHistorial(
        { estado: 'Pendiente de atención' },
        adminToken,
      ).expect(200)
    ).body as AveriasHistorialListado;
    expect(pendiente.data[0].estado).toBe(EstadoAveria.PENDIENTE);

    const enAtencion = (
      await getHistorial({ estado: 'En atención' }, adminToken).expect(200)
    ).body as AveriasHistorialListado;
    expect(enAtencion.data[0].estado).toBe(EstadoAveria.EN_ATENCION);
  });

  it('filtra por prioridad, tipo y fontanero', async () => {
    const alta = (
      await getHistorial({ prioridad: 'Alta' }, adminToken).expect(200)
    ).body as AveriasHistorialListado;
    expect(alta.total).toBe(2);
    expect(alta.data.every((item) => item.prioridad === 'ALTA')).toBe(true);

    const tuboMadre = (
      await getHistorial({ tipo: 'Tubo madre' }, adminToken).expect(200)
    ).body as AveriasHistorialListado;
    expect(tuboMadre.data.map((item) => item.codigoSeguimiento).sort()).toEqual(
      ['AV-2026-0002', 'AV-2026-0004'],
    );

    const fontanero = (
      await getHistorial({ fontaneroId }, adminToken).expect(200)
    ).body as AveriasHistorialListado;
    expect(fontanero.total).toBe(4);
    expect(
      fontanero.data.every((item) => item.fontanero?.id === fontaneroId),
    ).toBe(true);

    const sinPrioridad = (
      await getHistorial({ prioridad: 'SIN_ASIGNAR' }, adminToken).expect(200)
    ).body as AveriasHistorialListado;
    expect(sinPrioridad.data.every((item) => item.prioridad === null)).toBe(
      true,
    );
    expect(sinPrioridad.total).toBe(5);
  });

  it('filtra por sector exacto, sin mezclar comunidades parecidas', async () => {
    const sanJuan = (
      await getHistorial({ sector: 'san juan' }, adminToken).expect(200)
    ).body as AveriasHistorialListado;
    expect(
      sanJuan.data.every((item) => item.sectorComunidad === 'San Juan'),
    ).toBe(true);
    expect(
      sanJuan.data.some((item) => item.sectorComunidad === 'San Juan Norte'),
    ).toBe(false);

    const norte = (
      await getHistorial({ sector: 'San Juan Norte' }, adminToken).expect(200)
    ).body as AveriasHistorialListado;
    expect(norte.total).toBe(1);
    expect(norte.data[0].codigoSeguimiento).toBe('AV-2026-0004');
  });

  it('el rango de fechas incluye el día final completo', async () => {
    const body = (
      await getHistorial(
        { fechaDesde: '2026-08-01', fechaHasta: '2026-08-31' },
        adminToken,
      ).expect(200)
    ).body as AveriasHistorialListado;
    expect(body.data.map((item) => item.codigoSeguimiento)).toEqual([
      'AV-2026-0031',
      'AV-2026-0004',
      'AV-2026-0003',
      'AV-2026-0005',
    ]);
  });

  it('busca por código de seguimiento exacto y parcial', async () => {
    const exacto = (
      await getHistorial(
        { codigoSeguimiento: 'AV-2026-0005' },
        adminToken,
      ).expect(200)
    ).body as AveriasHistorialListado;
    expect(exacto.total).toBe(1);
    expect(exacto.data[0].nombreReportante).toBe('Lucía Brenes');

    const parcial = (
      await getHistorial(
        { codigoSeguimiento: 'av-2026-000' },
        adminToken,
      ).expect(200)
    ).body as AveriasHistorialListado;
    expect(parcial.total).toBe(8);
    expect(
      parcial.data.every((item) =>
        item.codigoSeguimiento.toLowerCase().includes('av-2026-000'),
      ),
    ).toBe(true);
  });

  it('combina los filtros con AND', async () => {
    const body = (
      await getHistorial(
        {
          estado: 'Resuelta',
          prioridad: 'Alta',
          tipo: 'Tubo medidor',
          fontaneroId,
          sector: 'Palmares',
          fechaDesde: '2026-08-01',
          fechaHasta: '2026-08-31',
          codigoSeguimiento: 'AV-2026-0005',
        },
        adminToken,
      ).expect(200)
    ).body as AveriasHistorialListado;
    expect(body.total).toBe(1);
    expect(body.data[0].codigoSeguimiento).toBe('AV-2026-0005');

    const vacio = (
      await getHistorial(
        { estado: 'Resuelta', prioridad: 'BAJA' },
        adminToken,
      ).expect(200)
    ).body as AveriasHistorialListado;
    expect(vacio).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
  });

  it('pagina en el servidor y conserva el total filtrado', async () => {
    const page1 = (
      await getHistorial({ page: 1, limit: 4 }, adminToken).expect(200)
    ).body as AveriasHistorialListado;
    const page2 = (
      await getHistorial({ page: 2, limit: 4 }, adminToken).expect(200)
    ).body as AveriasHistorialListado;
    const fuera = (
      await getHistorial({ page: 5, limit: 4 }, adminToken).expect(200)
    ).body as AveriasHistorialListado;

    expect(page1).toMatchObject({
      total: 9,
      page: 1,
      limit: 4,
      totalPages: 3,
    });
    expect(page1.data).toHaveLength(4);
    expect(page2.data).toHaveLength(4);
    const ids1 = page1.data.map((item) => item.id);
    const ids2 = page2.data.map((item) => item.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
    expect(fuera).toEqual({
      data: [],
      total: 9,
      page: 5,
      limit: 4,
      totalPages: 3,
    });
  });

  it('desempata la misma fecha de reporte por id descendente', async () => {
    await averias.clear();
    const instante = new Date('2026-09-10T12:00:00.000Z');
    const antigua = await persist({
      codigoSeguimiento: 'AV-ORD-0001',
      fechaReporte: new Date('2026-09-09T12:00:00.000Z'),
      nombreReportante: 'Antigua',
      sectorComunidad: 'San Juan',
      estado: EstadoAveria.RECIBIDA,
    });
    const primera = await persist({
      codigoSeguimiento: 'AV-ORD-0002',
      fechaReporte: instante,
      nombreReportante: 'Empate A',
      sectorComunidad: 'San Juan',
      estado: EstadoAveria.ASIGNADA,
    });
    const segunda = await persist({
      codigoSeguimiento: 'AV-ORD-0003',
      fechaReporte: instante,
      nombreReportante: 'Empate B',
      sectorComunidad: 'San Juan',
      estado: EstadoAveria.RESUELTA,
    });

    const body = (await getHistorial({}, adminToken).expect(200))
      .body as AveriasHistorialListado;
    expect(body.data.map((item) => item.id)).toEqual([
      segunda.id,
      primera.id,
      antigua.id,
    ]);
  });

  it('una búsqueda sin coincidencias responde 200 con total 0', async () => {
    const body = (
      await getHistorial(
        { codigoSeguimiento: 'XYZ-NO-EXISTE' },
        adminToken,
      ).expect(200)
    ).body as AveriasHistorialListado;
    expect(body).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
  });

  it('rechaza estados antiguos y el resto de filtros inválidos con 400', async () => {
    const cases: Array<Record<string, string | number>> = [
      { page: 'abc' },
      { page: 0 },
      { page: -1 },
      { limit: -1 },
      { limit: 1000000 },
      { estado: 'REPORTADA' },
      { estado: 'Reportada' },
      { estado: 'EN_PROCESO' },
      { estado: 'En proceso' },
      { estado: 'inventado' },
      { prioridad: 'inventada' },
      { tipo: 'CABLE' },
      { fontaneroId: 'abc' },
      { fontaneroId: 0 },
      { fechaDesde: '01/02/2026' },
      { fechaHasta: 'no-es-fecha' },
      { fechaDesde: '2026-09-12', fechaHasta: '2026-09-01' },
      { fechaDesde: '2026-02-30' },
      { otro: 'no-permitido' },
    ];

    for (const query of cases) {
      const response = await getHistorial(query, adminToken);
      expect(response.status).toBe(400);
      expect(response.status).not.toBe(500);
      expect(response.body).not.toHaveProperty('data');
    }
  });

  it('el código de seguimiento no inyecta SQL ni devuelve toda la colección', async () => {
    const body = (
      await getHistorial(
        { codigoSeguimiento: "' OR 1=1 --" },
        adminToken,
      ).expect(200)
    ).body as AveriasHistorialListado;
    expect(body.total).toBe(0);
    expect(body.data).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(
      /QueryFailedError|SQL Server|sqlite/i,
    );
  });
});
