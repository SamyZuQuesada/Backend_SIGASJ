import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { DocumentoSolicitud } from './entities/documento-solicitud.entity';
import { HistorialSolicitud } from './entities/historial-solicitud.entity';
import { SolicitudAfiliacion } from './entities/solicitud-afiliacion.entity';
import { SolicitudArregloPago } from './entities/solicitud-arreglo-pago.entity';
import { SolicitudCambioTitular } from './entities/solicitud-cambio-titular.entity';
import { SolicitudConstanciaServicio } from './entities/solicitud-constancia-servicio.entity';
import { SolicitudDisponibilidadServicios } from './entities/solicitud-disponibilidad-servicios.entity';
import { SolicitudInfraestructuraLinderos } from './entities/solicitud-infraestructura-linderos.entity';
import { SolicitudServicio } from './entities/solicitud-servicio.entity';
import { Solicitud } from './entities/solicitud.entity';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

/**
 * Tarea: Control de Acceso y Seguridad en la Gestión de Solicitudes (Backend / Frontend)
 * Criterios evaluados:
 * 1. Un usuario público no accede (401 Unauthorized ante falta o invalidez de JWT).
 * 2. Un usuario sin rol o con rol no autorizado recibe 403 Forbidden.
 * 3. Los roles autorizados (ADMINISTRADORA, SECRETARIA, FONTANERO) pueden gestionar solicitudes.
 * 4. El acceso por URL directa (vía navegador o cliente HTTP) no evade los permisos.
 * 5. Los endpoints ciudadanos públicos (seguimiento, registro de trámite) no se ven afectados.
 */
describe('Seguridad y Control de Acceso RBAC - Solicitudes Administrativas', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const mockSolicitudBase: Partial<Solicitud> = {
    id: 10,
    codigoSeguimiento: 'SOL-2026-SEC001',
    tipoSolicitudId: 1,
    estado: 'PENDIENTE',
    fechaIngreso: new Date('2026-10-24T10:00:00Z'),
    observaciones: null,
    tipoSolicitud: {
      id: 1,
      codigo: 'ARREGLO_PAGO',
      nombre: 'Arreglo de Pago',
      slug: 'arreglo-pago',
      activo: true,
    } as TipoSolicitud,
    documentos: [],
    historial: [],
  };

  const signToken = (payload: Partial<JwtPayload>) => {
    return jwtService.sign(payload);
  };

  const signAsRole = (role?: Role) => {
    const payload: Partial<JwtPayload> = {
      sub: '42',
      email: 'test.seguridad@asadasanjuan.cr',
      name: 'Usuario Seguridad',
    };
    if (role) {
      payload.role = role;
    }
    return jwtService.sign(payload);
  };

  beforeAll(async () => {
    const mockFindAndCount = jest
      .fn()
      .mockResolvedValue([[mockSolicitudBase], 1]);
    const mockFindOne = jest.fn().mockResolvedValue(mockSolicitudBase);
    const mockFind = jest.fn().mockResolvedValue([]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig],
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: 'super_secret_jwt_key_sigasj_2026',
        }),
      ],
      controllers: [SolicitudesController],
      providers: [
        JwtStrategy,
        RolesGuard,
        SolicitudesService,
        {
          provide: getRepositoryToken(Solicitud),
          useValue: {
            findAndCount: mockFindAndCount,
            findOne: mockFindOne,
            manager: {
              findOne: mockFindOne,
            },
          },
        },
        {
          provide: getRepositoryToken(SolicitudServicio),
          useValue: { find: mockFind },
        },
        {
          provide: getRepositoryToken(TipoSolicitud),
          useValue: { findOne: jest.fn().mockResolvedValue(mockSolicitudBase.tipoSolicitud) },
        },
        {
          provide: getRepositoryToken(SolicitudArregloPago),
          useValue: { find: mockFind, findOne: mockFindOne },
        },
        {
          provide: getRepositoryToken(SolicitudCambioTitular),
          useValue: { find: mockFind, findOne: mockFindOne },
        },
        {
          provide: getRepositoryToken(SolicitudInfraestructuraLinderos),
          useValue: { find: mockFind, findOne: mockFindOne },
        },
        {
          provide: getRepositoryToken(SolicitudAfiliacion),
          useValue: { find: mockFind, findOne: mockFindOne },
        },
        {
          provide: getRepositoryToken(SolicitudDisponibilidadServicios),
          useValue: { find: mockFind, findOne: mockFindOne },
        },
        {
          provide: getRepositoryToken(SolicitudConstanciaServicio),
          useValue: { find: mockFind, findOne: mockFindOne },
        },
        {
          provide: getRepositoryToken(DocumentoSolicitud),
          useValue: { find: mockFind },
        },
        {
          provide: getRepositoryToken(HistorialSolicitud),
          useValue: { find: mockFind },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Criterio: Un usuario público no accede (401 Unauthorized)', () => {
    it('debe rechazar GET /solicitudes si no se provee cabecera Authorization', async () => {
      const response = await request(app.getHttpServer())
        .get('/solicitudes')
        .expect(401);

      expect(response.body.message).toBe('No autenticado');
    });

    it('debe rechazar GET /solicitudes/:id si no se provee cabecera Authorization', async () => {
      const response = await request(app.getHttpServer())
        .get('/solicitudes/10')
        .expect(401);

      expect(response.body.message).toBe('No autenticado');
    });

    it('debe rechazar GET /solicitudes/:id/detalle si no se provee cabecera Authorization', async () => {
      const response = await request(app.getHttpServer())
        .get('/solicitudes/10/detalle')
        .expect(401);

      expect(response.body.message).toBe('No autenticado');
    });

    it('debe rechazar con 401 si el token JWT es inválido o está corrupto', async () => {
      const response = await request(app.getHttpServer())
        .get('/solicitudes')
        .set('Authorization', 'Bearer token_invalido_totalmente_falso')
        .expect(401);

      expect(response.body.message).toBe('No autenticado');
    });

    it('debe rechazar con 401 si la cabecera no utiliza el esquema Bearer', async () => {
      const token = signAsRole(Role.ADMINISTRADORA);
      const response = await request(app.getHttpServer())
        .get('/solicitudes')
        .set('Authorization', `Basic ${token}`)
        .expect(401);

      expect(response.body.message).toBe('No autenticado');
    });
  });

  describe('2. Criterio: Un usuario sin rol recibe 403 Forbidden', () => {
    it('debe rechazar con 403 Forbidden a un token válido que no incluye rol en sus claims', async () => {
      const tokenSinRol = signToken({
        sub: '99',
        email: 'sinrol@asada.cr',
        name: 'Sin Rol',
        // role omitido intencionalmente
      });

      const response = await request(app.getHttpServer())
        .get('/solicitudes')
        .set('Authorization', `Bearer ${tokenSinRol}`)
        .expect(403);

      expect(response.body.message).toBe('Acceso denegado');
    });

    it('debe rechazar con 403 Forbidden al rol ABONADO en el listado y en el detalle', async () => {
      const tokenAbonado = signAsRole(Role.ABONADO);

      await request(app.getHttpServer())
        .get('/solicitudes')
        .set('Authorization', `Bearer ${tokenAbonado}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/solicitudes/10')
        .set('Authorization', `Bearer ${tokenAbonado}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/solicitudes/10/detalle')
        .set('Authorization', `Bearer ${tokenAbonado}`)
        .expect(403);
    });

    it('debe rechazar con 403 Forbidden al rol AYUDANTE en el listado y en el detalle', async () => {
      const tokenAyudante = signAsRole(Role.AYUDANTE);

      await request(app.getHttpServer())
        .get('/solicitudes')
        .set('Authorization', `Bearer ${tokenAyudante}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/solicitudes/10')
        .set('Authorization', `Bearer ${tokenAyudante}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/solicitudes/10/detalle')
        .set('Authorization', `Bearer ${tokenAyudante}`)
        .expect(403);
    });
  });

  describe('3. Criterio: Los roles autorizados pueden gestionar solicitudes', () => {
    it('ADMINISTRADORA puede acceder al listado y al detalle', async () => {
      const token = signAsRole(Role.ADMINISTRADORA);

      const resListado = await request(app.getHttpServer())
        .get('/solicitudes')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(resListado.body.solicitudes).toBeDefined();

      const resDetalle = await request(app.getHttpServer())
        .get('/solicitudes/10')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(resDetalle.body.id).toBe(10);
    });

    it('SECRETARIA puede acceder al listado y al detalle', async () => {
      const token = signAsRole(Role.SECRETARIA);

      const resListado = await request(app.getHttpServer())
        .get('/solicitudes')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(resListado.body.solicitudes).toBeDefined();

      const resDetalle = await request(app.getHttpServer())
        .get('/solicitudes/10')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(resDetalle.body.id).toBe(10);
    });

    it('FONTANERO puede acceder al listado y al detalle de solicitudes para revisión técnica', async () => {
      const token = signAsRole(Role.FONTANERO);

      const resListado = await request(app.getHttpServer())
        .get('/solicitudes')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(resListado.body.solicitudes).toBeDefined();

      const resDetalle = await request(app.getHttpServer())
        .get('/solicitudes/10/detalle')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(resDetalle.body.id).toBe(10);
    });
  });

  describe('4. Criterio: Una URL directa no evade permisos (Prueba de URL directa)', () => {
    it('escribir directamente la URL de detalle con ID específico sin autenticación es rechazado con 401', async () => {
      const urlDirectaDetalle = '/solicitudes/999';

      const response = await request(app.getHttpServer())
        .get(urlDirectaDetalle)
        .expect(401);

      expect(response.body.message).toBe('No autenticado');
    });

    it('escribir directamente la URL de listado con filtros complejos sin autenticación es rechazado con 401', async () => {
      const urlDirectaConFiltros =
        '/solicitudes?page=1&limit=20&estado=PENDIENTE&fechaDesde=2026-01-01&fechaHasta=2026-12-31';

      const response = await request(app.getHttpServer())
        .get(urlDirectaConFiltros)
        .expect(401);

      expect(response.body.message).toBe('No autenticado');
    });

    it('escribir directamente la URL de detalle con un token de abonado es rechazado con 403', async () => {
      const urlDirecta = '/solicitudes/10/detalle';
      const tokenAbonado = signAsRole(Role.ABONADO);

      const response = await request(app.getHttpServer())
        .get(urlDirecta)
        .set('Authorization', `Bearer ${tokenAbonado}`)
        .expect(403);

      expect(response.body.message).toBe('Acceso denegado');
    });
  });

  describe('5. Coexistencia con Endpoints Públicos de Ciudadanos', () => {
    it('consulta pública por código de seguimiento permanece accesible sin token JWT', async () => {
      // El endpoint público de seguimiento no requiere token
      const response = await request(app.getHttpServer())
        .get('/solicitudes/seguimiento/SOL-2026-SEC001')
        .expect(200);

      expect(response.body.codigoSeguimiento).toBe('SOL-2026-SEC001');
    });
  });
});
