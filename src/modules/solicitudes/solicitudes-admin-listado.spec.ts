import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Between, In, LessThanOrEqual, Like, MoreThanOrEqual } from 'typeorm';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { Role } from '../../common/enums/role.enum';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';
import { Solicitud } from './entities/solicitud.entity';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';
import { SolicitudArregloPago } from './entities/solicitud-arreglo-pago.entity';
import { SolicitudCambioTitular } from './entities/solicitud-cambio-titular.entity';
import { SolicitudInfraestructuraLinderos } from './entities/solicitud-infraestructura-linderos.entity';
import { SolicitudAfiliacion } from './entities/solicitud-afiliacion.entity';
import { SolicitudDisponibilidadServicios } from './entities/solicitud-disponibilidad-servicios.entity';
import { SolicitudConstanciaServicio } from './entities/solicitud-constancia-servicio.entity';
import { SolicitudServicio } from './entities/solicitud-servicio.entity';
import { DocumentoSolicitud } from './entities/documento-solicitud.entity';
import { HistorialSolicitud } from './entities/historial-solicitud.entity';

describe('Panel Administrativo - Consulta y Filtrado de Solicitudes', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let service: SolicitudesService;

  const mockSolicitud = {
    id: 1,
    tipoSolicitudId: 1,
    tipoSolicitud: {
      id: 1,
      nombre: 'Arreglo de Pago',
      slug: TipoSolicitudSlug.ARREGLO_PAGO,
    },
    codigoSeguimiento: 'SOL-2026-A82K91',
    estado: EstadoSolicitud.PENDIENTE,
    fechaIngreso: new Date('2026-10-24T10:00:00Z'),
  } as unknown as Solicitud;

  let findAndCountSolicitud: jest.Mock;
  let findArregloPago: jest.Mock;
  let findCambioTitular: jest.Mock;
  let findInfraestructura: jest.Mock;
  let findAfiliacion: jest.Mock;
  let findDisponibilidad: jest.Mock;
  let findConstancia: jest.Mock;

  const signAs = (role: Role, sub = '1') => {
    const payload: JwtPayload = {
      sub,
      email: 'admin@asadasanjuan.cr',
      role,
      name: 'Personal Administrativo',
    };
    return jwtService.sign(payload);
  };

  beforeEach(async () => {
    findAndCountSolicitud = jest
      .fn()
      .mockResolvedValue([[mockSolicitud], 1]);
    findArregloPago = jest.fn().mockResolvedValue([]);
    findCambioTitular = jest.fn().mockResolvedValue([]);
    findInfraestructura = jest.fn().mockResolvedValue([]);
    findAfiliacion = jest.fn().mockResolvedValue([]);
    findDisponibilidad = jest.fn().mockResolvedValue([]);
    findConstancia = jest.fn().mockResolvedValue([]);

    const mockManager = {
      getRepository: (entity: unknown) => {
        if (entity === SolicitudArregloPago) {
          return { find: findArregloPago };
        }
        if (entity === SolicitudCambioTitular) {
          return { find: findCambioTitular };
        }
        if (entity === SolicitudInfraestructuraLinderos) {
          return { find: findInfraestructura };
        }
        if (entity === SolicitudAfiliacion) {
          return { find: findAfiliacion };
        }
        if (entity === SolicitudDisponibilidadServicios) {
          return { find: findDisponibilidad };
        }
        if (entity === SolicitudConstanciaServicio) {
          return { find: findConstancia };
        }
        return { find: jest.fn().mockResolvedValue([]) };
      },
    };

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
          provide: getRepositoryToken(SolicitudServicio),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Solicitud),
          useValue: {
            findAndCount: findAndCountSolicitud,
            findOne: jest.fn().mockResolvedValue(mockSolicitud),
            manager: mockManager,
          },
        },
        {
          provide: getRepositoryToken(SolicitudArregloPago),
          useValue: { find: findArregloPago },
        },
        {
          provide: getRepositoryToken(TipoSolicitud),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(DocumentoSolicitud),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(HistorialSolicitud),
          useValue: { find: jest.fn() },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    service = moduleFixture.get(SolicitudesService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('1. Control de Acceso y Protección de Endpoint (Feature 12)', () => {
    it('debe rechazar con 401 Unauthorized si la petición no incluye token JWT', async () => {
      const response = await request(app.getHttpServer())
        .get('/solicitudes')
        .expect(401);

      expect(response.body).toMatchObject({ message: 'No autenticado' });
    });

    it('debe rechazar con 403 Forbidden a usuarios con rol ABONADO', async () => {
      await request(app.getHttpServer())
        .get('/solicitudes')
        .set('Authorization', `Bearer ${signAs(Role.ABONADO)}`)
        .expect(403);
    });

    it('debe rechazar con 403 Forbidden a usuarios con rol AYUDANTE', async () => {
      await request(app.getHttpServer())
        .get('/solicitudes')
        .set('Authorization', `Bearer ${signAs(Role.AYUDANTE)}`)
        .expect(403);
    });

    it('debe permitir el acceso a usuarios con rol ADMINISTRADORA', async () => {
      const response = await request(app.getHttpServer())
        .get('/solicitudes')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(response.body.solicitudes).toBeDefined();
      expect(response.body.total).toBe(1);
    });

    it('debe permitir el acceso a usuarios con rol SECRETARIA', async () => {
      const response = await request(app.getHttpServer())
        .get('/solicitudes')
        .set('Authorization', `Bearer ${signAs(Role.SECRETARIA)}`)
        .expect(200);

      expect(response.body.solicitudes).toBeDefined();
      expect(response.body.total).toBe(1);
    });

    it('debe permitir el acceso a usuarios con rol FONTANERO', async () => {
      const response = await request(app.getHttpServer())
        .get('/solicitudes')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO)}`)
        .expect(200);

      expect(response.body.solicitudes).toBeDefined();
      expect(response.body.total).toBe(1);
    });
  });

  describe('2. Paginación y rendimiento', () => {
    it('debe responder con metadatos de paginación (total, page, limit, totalPages)', async () => {
      findAndCountSolicitud.mockResolvedValue([[mockSolicitud], 45]);

      const response = await request(app.getHttpServer())
        .get('/solicitudes?page=2&limit=15')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(15);
      expect(response.body.total).toBe(45);
      expect(response.body.totalPages).toBe(3);
      expect(response.body.hasPrevPage).toBe(true);
      expect(response.body.hasNextPage).toBe(true);

      expect(findAndCountSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 15,
          take: 15,
        }),
      );
    });

    it('no debe incluir la relación con documentos pesados en el listado', async () => {
      await request(app.getHttpServer())
        .get('/solicitudes')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      // relations solo debe traer tipoSolicitud, no documentos
      expect(findAndCountSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: { tipoSolicitud: true },
        }),
      );
    });
  });

  describe('3. Filtros individuales', () => {
    it('debe filtrar por código de seguimiento', async () => {
      await request(app.getHttpServer())
        .get('/solicitudes?codigo=SOL-2026-A82K91')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(findAndCountSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            codigoSeguimiento: Like('%SOL-2026-A82K91%'),
          }),
        }),
      );
    });

    it('debe filtrar por estado del trámite', async () => {
      await request(app.getHttpServer())
        .get(`/solicitudes?estado=${EstadoSolicitud.PENDIENTE}`)
        .set('Authorization', `Bearer ${signAs(Role.SECRETARIA)}`)
        .expect(200);

      expect(findAndCountSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            estado: EstadoSolicitud.PENDIENTE,
          }),
        }),
      );
    });

    it('debe filtrar por tipo de solicitud (ID y slug)', async () => {
      await request(app.getHttpServer())
        .get('/solicitudes?tipoSolicitudId=2&slug=cambio-titular')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(findAndCountSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tipoSolicitudId: 2,
            tipoSolicitud: { slug: 'cambio-titular' },
          }),
        }),
      );
    });

    it('debe filtrar por rango de fechas (fechaDesde y fechaHasta)', async () => {
      await request(app.getHttpServer())
        .get('/solicitudes?fechaDesde=2026-01-01&fechaHasta=2026-06-30')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(findAndCountSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fechaIngreso: expect.any(Object),
          }),
        }),
      );
    });

    it('debe filtrar únicamente por fechaDesde cuando fechaHasta no se especifica', async () => {
      await request(app.getHttpServer())
        .get('/solicitudes?fechaDesde=2026-05-01')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(findAndCountSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fechaIngreso: MoreThanOrEqual(new Date('2026-05-01')),
          }),
        }),
      );
    });

    it('debe filtrar únicamente por fechaHasta cuando fechaDesde no se especifica', async () => {
      await request(app.getHttpServer())
        .get('/solicitudes?fechaHasta=2026-10-31')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(findAndCountSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fechaIngreso: expect.any(Object),
          }),
        }),
      );
    });

    it('debe filtrar por número de identificación buscando en los detalles de formularios', async () => {
      // Simular que el solicitante aparece en Arreglo de Pago con solicitudId = 15
      findArregloPago.mockResolvedValueOnce([{ solicitudId: 15 }]);

      await request(app.getHttpServer())
        .get('/solicitudes?identificacion=1-0987-0654')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(findAndCountSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: In([15]),
          }),
        }),
      );
    });

    it('debe devolver resultado vacío si la búsqueda por identificación no coincide con ningún trámite', async () => {
      // Ningún formulario contiene la identificación
      findArregloPago.mockResolvedValue([]);
      findCambioTitular.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/solicitudes?identificacion=9-9999-9999')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(response.body.solicitudes).toEqual([]);
      expect(response.body.total).toBe(0);
      expect(findAndCountSolicitud).not.toHaveBeenCalled();
    });
  });

  describe('4. Ordenamiento cronológico por fecha', () => {
    it('debe ordenar por fechaIngreso DESC por defecto', async () => {
      await request(app.getHttpServer())
        .get('/solicitudes')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(findAndCountSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { fechaIngreso: 'DESC' },
        }),
      );
    });

    it('debe permitir ordenar por fechaIngreso ASC explícitamente', async () => {
      await request(app.getHttpServer())
        .get('/solicitudes?orden=ASC')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(findAndCountSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { fechaIngreso: 'ASC' },
        }),
      );
    });
  });

  describe('5. Filtros combinados', () => {
    it('debe soportar la combinación de múltiples filtros simultáneos (estado, código, fechas y tipo)', async () => {
      await request(app.getHttpServer())
        .get(
          `/solicitudes?estado=${EstadoSolicitud.PENDIENTE}&slug=arreglo-pago&codigo=SOL-2026&fechaDesde=2026-01-01&fechaHasta=2026-12-31&orden=ASC&page=1&limit=10`,
        )
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(findAndCountSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            estado: EstadoSolicitud.PENDIENTE,
            tipoSolicitud: { slug: 'arreglo-pago' },
            codigoSeguimiento: Like('%SOL-2026%'),
            fechaIngreso: expect.any(Object),
          }),
          order: { fechaIngreso: 'ASC' },
          skip: 0,
          take: 10,
        }),
      );
    });
  });
});
