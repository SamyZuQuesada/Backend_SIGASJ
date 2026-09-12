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
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AveriasModule } from './averias.module';
import { Averia } from './entities/averia.entity';
import type {
  AveriaAdminListItem,
  AveriasAdminListado,
} from './averias.service';

type SeedAveria = {
  codigoSeguimiento: string;
  fechaReporte: Date;
  nombreReportante: string;
  sectorComunidad?: string;
  ubicacion?: string;
  descripcion?: string;
  prioridad?: string | null;
  tipoAveria?: string | null;
  idFontaneroAsignado?: number | null;
};

const SENSITIVE =
  /identificacionReportante|telefonoReportante|correoReportante|observacionesAtencion|password|idAbonado|"email"/i;

describe('GET /api/v1/admin/averias — listado administrativo', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let averias: Repository<Averia>;
  let usuarios: Repository<Usuario>;
  let adminToken: string;
  let secretariaToken: string;
  let fontaneroId: number;

  const signAs = (role: Role, sub = '1') => {
    const payload: JwtPayload = {
      sub,
      email: 'usuario@asadasanjuan.cr',
      role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
  };

  const getAverias = (
    query: Record<string, string | number> = {},
    token?: string | null,
  ) => {
    const req = request(app.getHttpServer()).get('/api/v1/admin/averias');
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
        telefonoReportante: '8888-8888',
        ubicacion: seed.ubicacion ?? '200 m este de la escuela',
        sectorComunidad: seed.sectorComunidad ?? 'San Juan',
        descripcion: seed.descripcion ?? 'Fuga visible en tubería',
        estado: EstadoAveria.RECIBIDA,
        tipoAveria: seed.tipoAveria ?? null,
        prioridad: seed.prioridad ?? null,
        idFontaneroAsignado: seed.idFontaneroAsignado ?? null,
        idAbonado: null,
        identificacionReportante: '1-2345-6789',
        correoReportante: 'reportante@example.com',
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
          entities: [Averia, Usuario],
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
    await averias.clear();
    await usuarios.clear();
    const fontanero = await usuarios.save(usuarios.create({}));
    fontaneroId = fontanero.idUsuario;

    await persist({
      codigoSeguimiento: 'AV-2026-0001',
      fechaReporte: new Date('2026-09-12T15:00:00.000Z'),
      nombreReportante: 'María Rodríguez',
    });
    await persist({
      codigoSeguimiento: 'AV-2026-0002',
      fechaReporte: new Date('2026-09-12T23:30:00.000Z'),
      nombreReportante: 'Juan Pérez',
      prioridad: 'ALTA',
      tipoAveria: 'TUBERIA',
      idFontaneroAsignado: fontaneroId,
    });
    await persist({
      codigoSeguimiento: 'AV-2026-0003',
      fechaReporte: new Date('2026-09-05T10:00:00.000Z'),
      nombreReportante: 'Ana Soto',
      prioridad: 'MEDIA',
    });
    await persist({
      codigoSeguimiento: 'AV-2026-0013',
      fechaReporte: new Date('2026-07-20T10:00:00.000Z'),
      nombreReportante: 'Elena Vargas',
      prioridad: 'BAJA',
    });
    await persist({
      codigoSeguimiento: 'AV-2026-0004',
      fechaReporte: new Date('2026-08-31T23:00:00.000Z'),
      nombreReportante: 'Carlos Mora',
      prioridad: 'ALTA',
      tipoAveria: 'TUBERIA',
      idFontaneroAsignado: fontaneroId,
    });
    await persist({
      codigoSeguimiento: 'AV-2026-0005',
      fechaReporte: new Date('2026-09-13T00:00:00.000Z'),
      nombreReportante: 'Lucía Brenes',
    });
    await persist({
      codigoSeguimiento: 'AV-2026-0006',
      fechaReporte: new Date('2026-09-01T00:00:00.000Z'),
      nombreReportante: 'Pedro Solís',
    });
    for (let index = 7; index <= 12; index += 1) {
      await persist({
        codigoSeguimiento: `AV-2026-00${index.toString().padStart(2, '0')}`,
        fechaReporte: new Date(`2026-08-${10 + index}T08:00:00.000Z`),
        nombreReportante: `Vecino ${index}`,
      });
    }
  });

  const expectListShape = (body: AveriasAdminListado) => {
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(typeof body.page).toBe('number');
    expect(typeof body.limit).toBe('number');
    expect(typeof body.totalPages).toBe('number');
  };

  const expectSafeItem = (item: AveriaAdminListItem) => {
    expect(typeof item.id).toBe('number');
    expect(typeof item.codigoSeguimiento).toBe('string');
    expect(item.fechaReporte).toBeDefined();
    expect(typeof item.nombreReportante).toBe('string');
    expect(typeof item.sectorComunidad).toBe('string');
    expect(typeof item.ubicacion).toBe('string');
    expect(typeof item.descripcion).toBe('string');
    expect(item.estado).toBe(EstadoAveria.RECIBIDA);
    expect(item.prioridad === null || typeof item.prioridad === 'string').toBe(
      true,
    );
    expect(
      item.tipoAveria === null || typeof item.tipoAveria === 'string',
    ).toBe(true);
    expect(
      item.fontanero === null ||
        (typeof item.fontanero === 'object' &&
          typeof item.fontanero.id === 'number'),
    ).toBe(true);
    expect(JSON.stringify(item)).not.toMatch(SENSITIVE);
  };

  it('Administradora autenticada recibe 200 con estructura paginada', async () => {
    const response = await getAverias({}, adminToken).expect(200);
    const body = response.body as AveriasAdminListado;
    expectListShape(body);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(body.total).toBe(13);
    expect(body.totalPages).toBe(1);
    expect(body.data).toHaveLength(13);
    body.data.forEach(expectSafeItem);
  });

  it('Secretaria autenticada recibe 200 (rol real SECRETARIA)', async () => {
    const response = await getAverias({}, secretariaToken).expect(200);
    const body = response.body as AveriasAdminListado;
    expect(body.total).toBe(13);
  });

  it('sin token responde 401 y no devuelve data', async () => {
    const response = await getAverias({}).expect(401);
    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    expect(response.body).not.toHaveProperty('data');
  });

  it('token inválido responde 401', async () => {
    await getAverias({}, 'token-invalido').expect(401);
  });

  it('Fontanero autenticado recibe 403 y no ve el listado', async () => {
    const response = await getAverias({}, signAs(Role.FONTANERO, '3')).expect(
      403,
    );
    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
    expect(response.body).not.toHaveProperty('data');
  });

  it('sin filtros incluye no clasificadas, sin Fontanero y ordena por fecha DESC, id DESC', async () => {
    const body = (await getAverias({}, adminToken).expect(200))
      .body as AveriasAdminListado;

    expect(body.data.some((item) => item.prioridad === null)).toBe(true);
    expect(body.data.some((item) => item.tipoAveria === null)).toBe(true);
    expect(body.data.some((item) => item.fontanero === null)).toBe(true);
    expect(body.data.some((item) => item.prioridad === 'ALTA')).toBe(true);
    expect(body.data.some((item) => item.fontanero?.id === fontaneroId)).toBe(
      true,
    );

    const stamps = body.data.map((item) => ({
      time: new Date(item.fechaReporte).getTime(),
      id: item.id,
    }));
    for (let index = 1; index < stamps.length; index += 1) {
      const prev = stamps[index - 1];
      const current = stamps[index];
      expect(prev.time >= current.time).toBe(true);
      if (prev.time === current.time) {
        expect(prev.id).toBeGreaterThan(current.id);
      }
    }
    expect(body.data[0].codigoSeguimiento).toBe('AV-2026-0005');
  });

  it('filtra por estado RECIBIDA (único valor real de EstadoAveria)', async () => {
    const body = (
      await getAverias({ estado: EstadoAveria.RECIBIDA }, adminToken).expect(
        200,
      )
    ).body as AveriasAdminListado;
    expect(body.total).toBe(13);
    expect(
      body.data.every((item) => item.estado === EstadoAveria.RECIBIDA),
    ).toBe(true);
  });

  it('no hay tests contra En atención o Resuelta: esos valores no existen en EstadoAveria', () => {
    expect(Object.values(EstadoAveria)).toEqual([EstadoAveria.RECIBIDA]);
  });

  it('filtra por prioridad almacenada y no rompe los null del listado general', async () => {
    const filtered = (
      await getAverias({ prioridad: 'ALTA' }, adminToken).expect(200)
    ).body as AveriasAdminListado;
    expect(filtered.total).toBe(2);
    expect(filtered.data.every((item) => item.prioridad === 'ALTA')).toBe(true);

    const media = (
      await getAverias({ prioridad: 'MEDIA' }, adminToken).expect(200)
    ).body as AveriasAdminListado;
    expect(media.total).toBe(1);
    expect(media.data.every((item) => item.prioridad === 'MEDIA')).toBe(true);

    const baja = (
      await getAverias({ prioridad: 'BAJA' }, adminToken).expect(200)
    ).body as AveriasAdminListado;
    expect(baja.total).toBe(1);
    expect(baja.data[0].codigoSeguimiento).toBe('AV-2026-0013');

    const unassigned = (
      await getAverias({ prioridad: 'SIN_ASIGNAR' }, adminToken).expect(200)
    ).body as AveriasAdminListado;
    expect(unassigned.total).toBeGreaterThan(0);
    expect(unassigned.data.every((item) => item.prioridad === null)).toBe(true);
    expect(
      unassigned.data.some((item) => item.codigoSeguimiento === 'AV-2026-0001'),
    ).toBe(true);
    expect(unassigned.data.some((item) => item.prioridad === 'ALTA')).toBe(
      false,
    );

    const general = (await getAverias({}, adminToken).expect(200))
      .body as AveriasAdminListado;
    const withoutPriority = general.data.find(
      (item) => item.codigoSeguimiento === 'AV-2026-0001',
    );
    expect(withoutPriority?.prioridad).toBeNull();
  });

  it('incluye averías sin tipo y sin Fontanero en el listado general', async () => {
    const body = (await getAverias({}, adminToken).expect(200))
      .body as AveriasAdminListado;
    const unclassified = body.data.find(
      (item) => item.codigoSeguimiento === 'AV-2026-0001',
    );
    expect(unclassified?.tipoAveria).toBeNull();
    expect(unclassified?.fontanero).toBeNull();
    expect(unclassified?.prioridad).toBeNull();
  });

  it('busca por código de seguimiento exacto y parcial', async () => {
    const exact = (
      await getAverias({ search: 'AV-2026-0001' }, adminToken).expect(200)
    ).body as AveriasAdminListado;
    expect(exact.total).toBe(1);
    expect(exact.data[0].codigoSeguimiento).toBe('AV-2026-0001');

    const partial = (
      await getAverias({ search: 'AV-2026-000' }, adminToken).expect(200)
    ).body as AveriasAdminListado;
    expect(partial.total).toBeGreaterThanOrEqual(6);
    expect(
      partial.data.every((item) =>
        item.codigoSeguimiento.includes('AV-2026-000'),
      ),
    ).toBe(true);
  });

  it('busca por parte del nombre del Reportante sin romper otros filtros', async () => {
    const byName = (
      await getAverias({ search: 'María' }, adminToken).expect(200)
    ).body as AveriasAdminListado;
    expect(byName.total).toBe(1);
    expect(byName.data[0].nombreReportante).toBe('María Rodríguez');

    const combined = (
      await getAverias(
        { search: 'Juan', estado: EstadoAveria.RECIBIDA },
        adminToken,
      ).expect(200)
    ).body as AveriasAdminListado;
    expect(combined.total).toBe(1);
    expect(combined.data[0].nombreReportante).toBe('Juan Pérez');
  });

  it('el rango de fechas incluye el día final completo y excluye fuera de rango', async () => {
    const body = (
      await getAverias(
        { fechaDesde: '2026-09-01', fechaHasta: '2026-09-12' },
        adminToken,
      ).expect(200)
    ).body as AveriasAdminListado;

    const codes = body.data.map((item) => item.codigoSeguimiento).sort();
    expect(codes).toEqual(
      ['AV-2026-0001', 'AV-2026-0002', 'AV-2026-0003', 'AV-2026-0006'].sort(),
    );
    expect(codes).not.toContain('AV-2026-0004');
    expect(codes).not.toContain('AV-2026-0005');
  });

  it('pagina en backend con total filtrado, páginas distintas y orden estable', async () => {
    const page1 = (
      await getAverias({ page: 1, limit: 5 }, adminToken).expect(200)
    ).body as AveriasAdminListado;
    const page2 = (
      await getAverias({ page: 2, limit: 5 }, adminToken).expect(200)
    ).body as AveriasAdminListado;

    expect(page1).toMatchObject({
      total: 13,
      page: 1,
      limit: 5,
      totalPages: 3,
    });
    expect(page2).toMatchObject({
      total: 13,
      page: 2,
      limit: 5,
      totalPages: 3,
    });
    expect(page1.data).toHaveLength(5);
    expect(page2.data).toHaveLength(5);
    expect(page1.total).not.toBe(page1.data.length);

    const ids1 = page1.data.map((item) => item.id);
    const ids2 = page2.data.map((item) => item.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it('ordena por fechaReporte DESC y desempata por id DESC', async () => {
    await averias.clear();
    const sameInstant = new Date('2026-09-10T12:00:00.000Z');
    const older = await persist({
      codigoSeguimiento: 'AV-ORD-0001',
      fechaReporte: new Date('2026-09-09T12:00:00.000Z'),
      nombreReportante: 'Antigua',
    });
    const firstSame = await persist({
      codigoSeguimiento: 'AV-ORD-0002',
      fechaReporte: sameInstant,
      nombreReportante: 'Empate A',
    });
    const secondSame = await persist({
      codigoSeguimiento: 'AV-ORD-0003',
      fechaReporte: sameInstant,
      nombreReportante: 'Empate B',
    });

    const body = (await getAverias({}, adminToken).expect(200))
      .body as AveriasAdminListado;
    expect(body.data.map((item) => item.id)).toEqual([
      secondSame.id,
      firstSame.id,
      older.id,
    ]);
  });

  it('combina filtros con AND (estado + prioridad, search + estado, fontanero + estado, tipo + fechas)', async () => {
    const estadoPrioridad = (
      await getAverias(
        { estado: EstadoAveria.RECIBIDA, prioridad: 'ALTA' },
        adminToken,
      ).expect(200)
    ).body as AveriasAdminListado;
    expect(estadoPrioridad.total).toBe(2);
    expect(
      estadoPrioridad.data.every((item) => item.prioridad === 'ALTA'),
    ).toBe(true);

    const searchEstado = (
      await getAverias(
        { search: 'Ana', estado: EstadoAveria.RECIBIDA },
        adminToken,
      ).expect(200)
    ).body as AveriasAdminListado;
    expect(searchEstado.total).toBe(1);
    expect(searchEstado.data[0].nombreReportante).toBe('Ana Soto');

    const fontaneroEstado = (
      await getAverias(
        { fontaneroId: fontaneroId, estado: EstadoAveria.RECIBIDA },
        adminToken,
      ).expect(200)
    ).body as AveriasAdminListado;
    expect(fontaneroEstado.total).toBe(2);
    expect(
      fontaneroEstado.data.every((item) => item.fontanero?.id === fontaneroId),
    ).toBe(true);

    const tipoFechas = (
      await getAverias(
        {
          tipo: 'TUBERIA',
          fechaDesde: '2026-09-01',
          fechaHasta: '2026-09-12',
        },
        adminToken,
      ).expect(200)
    ).body as AveriasAdminListado;
    expect(tipoFechas.total).toBe(1);
    expect(tipoFechas.data[0].codigoSeguimiento).toBe('AV-2026-0002');
  });

  it('página válida sin resultados responde 200 con data vacía', async () => {
    const body = (
      await getAverias({ page: 8, limit: 5 }, adminToken).expect(200)
    ).body as AveriasAdminListado;
    expect(body).toEqual({
      data: [],
      total: 13,
      page: 8,
      limit: 5,
      totalPages: 3,
    });
  });

  it('consulta válida sin coincidencias responde 200 con total 0', async () => {
    const body = (
      await getAverias({ search: 'XYZ-NO-EXISTE' }, adminToken).expect(200)
    ).body as AveriasAdminListado;
    expect(body).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
  });

  it('parámetros inválidos responden 400 y no 500', async () => {
    const cases: Array<Record<string, string | number>> = [
      { page: 'abc' },
      { page: 0 },
      { page: -1 },
      { limit: -1 },
      { limit: 1000000 },
      { estado: 'inventado' },
      { estado: 'EN_ATENCION' },
      { fontaneroId: 'abc' },
      { fontaneroId: 0 },
      { fechaDesde: '01/02/2026' },
      { fechaHasta: 'no-es-fecha' },
      { fechaDesde: '2026-09-12', fechaHasta: '2026-09-01' },
      { fechaDesde: '2026-02-30' },
    ];

    for (const query of cases) {
      const response = await getAverias(query, adminToken);
      expect(response.status).toBe(400);
      expect(response.status).not.toBe(500);
      expect(response.body).not.toHaveProperty('data');
    }
  });

  it('search malicioso no inyecta SQL ni devuelve toda la colección', async () => {
    const body = (
      await getAverias({ search: "' OR 1=1 --" }, adminToken).expect(200)
    ).body as AveriasAdminListado;
    expect(body.total).toBe(0);
    expect(body.data).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(
      /QueryFailedError|SQL Server|sqlite/i,
    );
  });

  it('prioridad o tipo sin catálogo se filtran por coincidencia exacta, no por enum inventado', async () => {
    const unknownPriority = (
      await getAverias({ prioridad: 'inventada' }, adminToken).expect(200)
    ).body as AveriasAdminListado;
    expect(unknownPriority.total).toBe(0);
    expect(unknownPriority.data).toEqual([]);

    const unknownTipo = (
      await getAverias({ tipo: 'Tubo madre' }, adminToken).expect(200)
    ).body as AveriasAdminListado;
    expect(unknownTipo.total).toBe(0);
  });
});
