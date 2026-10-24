import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { PlazoArregloPago } from '../../common/enums/plazo-arreglo-pago.enum';
import { Role } from '../../common/enums/role.enum';
import { TipoDocumentoSolicitud } from '../../common/enums/tipo-documento-solicitud.enum';
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

describe('Panel Administrativo - Detalle Completo de Solicitud (Tarea 4.12.2)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let service: SolicitudesService;

  let findOneSolicitud: jest.Mock;
  let findDocumentos: jest.Mock;
  let findHistorial: jest.Mock;
  let findOneArregloPago: jest.Mock;
  let findOneCambioTitular: jest.Mock;
  let findOneInfraestructura: jest.Mock;
  let findOneAfiliacion: jest.Mock;
  let findOneDisponibilidad: jest.Mock;
  let findOneConstancia: jest.Mock;

  const mockDocumento: DocumentoSolicitud = {
    id: 101,
    solicitudId: 1,
    tipoDocumento: TipoDocumentoSolicitud.IDENTIFICACION,
    nombreOriginal: 'cedula_solicitante.pdf',
    nombreInterno: 'internal_cedula.pdf',
    tipoArchivo: 'application/pdf',
    tamanio: 1048576,
    ubicacion: '/uploads/solicitudes/1/internal_cedula.pdf',
    rutaReferenciaArchivo: '/uploads/solicitudes/1/internal_cedula.pdf',
    tokenReclamo: 'used:101:token',
    fechaCarga: new Date('2026-10-24T10:00:00Z'),
  } as unknown as DocumentoSolicitud;

  const mockHistorial: HistorialSolicitud = {
    id: 201,
    solicitudId: 1,
    evento: 'REGISTRADA',
    tipoEvento: 'CREACION',
    descripcion: 'Solicitud registrada en el sistema',
    estadoAnterior: null,
    estadoNuevo: EstadoSolicitud.PENDIENTE,
    idUsuario: null,
    fechaHora: new Date('2026-10-24T10:00:00Z'),
  } as unknown as HistorialSolicitud;

  const mockSolicitudBase = {
    id: 1,
    tipoSolicitudId: 1,
    tipoSolicitud: {
      id: 1,
      nombre: 'Solicitud de Arreglo de Pago Domiciliar',
      slug: TipoSolicitudSlug.ARREGLO_PAGO,
    },
    codigoSeguimiento: 'SOL-2026-A82K91',
    estado: EstadoSolicitud.PENDIENTE,
    fechaIngreso: new Date('2026-10-24T10:00:00Z'),
    createdAt: new Date('2026-10-24T10:00:00Z'),
    updatedAt: new Date('2026-10-24T10:00:00Z'),
  } as unknown as Solicitud;

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
    findOneSolicitud = jest.fn();
    findDocumentos = jest.fn().mockResolvedValue([mockDocumento]);
    findHistorial = jest.fn().mockResolvedValue([mockHistorial]);
    findOneArregloPago = jest.fn();
    findOneCambioTitular = jest.fn();
    findOneInfraestructura = jest.fn();
    findOneAfiliacion = jest.fn();
    findOneDisponibilidad = jest.fn();
    findOneConstancia = jest.fn();

    const mockManager = {
      getRepository: (entity: unknown) => {
        if (entity === SolicitudArregloPago) {
          return { findOne: findOneArregloPago };
        }
        if (entity === SolicitudCambioTitular) {
          return { findOne: findOneCambioTitular };
        }
        if (entity === SolicitudInfraestructuraLinderos) {
          return { findOne: findOneInfraestructura };
        }
        if (entity === SolicitudAfiliacion) {
          return { findOne: findOneAfiliacion };
        }
        if (entity === SolicitudDisponibilidadServicios) {
          return { findOne: findOneDisponibilidad };
        }
        if (entity === SolicitudConstanciaServicio) {
          return { findOne: findOneConstancia };
        }
        return { findOne: jest.fn().mockResolvedValue(null) };
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
            findOne: findOneSolicitud,
            manager: mockManager,
          },
        },
        {
          provide: getRepositoryToken(SolicitudArregloPago),
          useValue: { findOne: findOneArregloPago },
        },
        {
          provide: getRepositoryToken(TipoSolicitud),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(DocumentoSolicitud),
          useValue: { find: findDocumentos },
        },
        {
          provide: getRepositoryToken(HistorialSolicitud),
          useValue: { find: findHistorial },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    service = moduleFixture.get(SolicitudesService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('1. Control de Acceso y Protección de Endpoint', () => {
    it('debe rechazar con 401 Unauthorized sin token JWT en GET /solicitudes/:id', async () => {
      const response = await request(app.getHttpServer())
        .get('/solicitudes/1')
        .expect(401);

      expect(response.body).toMatchObject({ message: 'No autenticado' });
    });

    it('debe rechazar con 401 Unauthorized sin token JWT en GET /solicitudes/:id/detalle', async () => {
      await request(app.getHttpServer())
        .get('/solicitudes/1/detalle')
        .expect(401);
    });

    it('debe rechazar con 403 Forbidden al rol ABONADO', async () => {
      await request(app.getHttpServer())
        .get('/solicitudes/1')
        .set('Authorization', `Bearer ${signAs(Role.ABONADO)}`)
        .expect(403);
    });

    it('debe rechazar con 403 Forbidden al rol AYUDANTE', async () => {
      await request(app.getHttpServer())
        .get('/solicitudes/1')
        .set('Authorization', `Bearer ${signAs(Role.AYUDANTE)}`)
        .expect(403);
    });

    it('debe permitir el acceso a ADMINISTRADORA, SECRETARIA y FONTANERO', async () => {
      findOneSolicitud.mockResolvedValue({ ...mockSolicitudBase });

      await request(app.getHttpServer())
        .get('/solicitudes/1')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/solicitudes/1')
        .set('Authorization', `Bearer ${signAs(Role.SECRETARIA)}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/solicitudes/1')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO)}`)
        .expect(200);
    });
  });

  describe('2. Manejo de Solicitudes Inexistentes', () => {
    it('debe devolver 404 Not Found cuando la solicitud no existe', async () => {
      findOneSolicitud.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/solicitudes/999')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(404);

      expect(response.body.message).toContain('no fue encontrada');
    });
  });

  describe('3. Reconocimiento del tipo de formulario y devolución del detalle específico', () => {
    it('debe reconocer Arreglo de Pago y vincular detalleArregloPago', async () => {
      const mockDetalleArreglo = {
        id: 10,
        solicitudId: 1,
        cedula: '1-0987-0654',
        nombre: 'Carlos Jiménez Mora',
        montoPrimaInicial: 35000,
        plazoSeleccionado: PlazoArregloPago.MESES_6,
        numeroCuentaServicio: 'CTA-99881',
      };

      findOneSolicitud.mockResolvedValue({
        ...mockSolicitudBase,
        tipoSolicitud: {
          id: 1,
          slug: TipoSolicitudSlug.ARREGLO_PAGO,
          nombre: 'Solicitud de Arreglo de Pago Domiciliar',
        },
      });
      findOneArregloPago.mockResolvedValue(mockDetalleArreglo);

      const response = await request(app.getHttpServer())
        .get('/solicitudes/1')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(response.body.id).toBe(1);
      expect(response.body.codigoSeguimiento).toBe('SOL-2026-A82K91');
      expect(response.body.detalleArregloPago).toBeDefined();
      expect(response.body.detalleArregloPago.montoPrimaInicial).toBe(35000);
      expect(response.body.detalleArregloPago.plazoSeleccionado).toBe(
        PlazoArregloPago.MESES_6,
      );
      expect(response.body.detalle).toBeDefined();
    });

    it('debe reconocer Cambio de Titular y vincular detalleCambioTitular', async () => {
      const mockDetalleCambio = {
        id: 20,
        solicitudId: 2,
        identificacionSolicitante: '1-1234-0567',
        nombreSolicitante: 'Laura Mora Soto',
        nis: 'NIS-88771',
        facturaANombreDe: 'Propietario Anterior',
      };

      findOneSolicitud.mockResolvedValue({
        ...mockSolicitudBase,
        id: 2,
        tipoSolicitud: {
          id: 2,
          slug: TipoSolicitudSlug.CAMBIO_TITULAR,
          nombre: 'Cambio de Titular',
        },
      });
      findOneCambioTitular.mockResolvedValue(mockDetalleCambio);

      const response = await request(app.getHttpServer())
        .get('/solicitudes/2/detalle')
        .set('Authorization', `Bearer ${signAs(Role.SECRETARIA)}`)
        .expect(200);

      expect(response.body.id).toBe(2);
      expect(response.body.detalleCambioTitular).toBeDefined();
      expect(response.body.detalleCambioTitular.nis).toBe('NIS-88771');
      expect(response.body.detalle).toBeDefined();
    });

    it('debe reconocer Disponibilidad de Servicios y vincular detalleDisponibilidadServicios', async () => {
      const mockDetalleDisp = {
        id: 30,
        solicitudId: 3,
        identificacionFisica: '1-0555-0444',
        proposito: 'Construcción de vivienda unifamiliar',
        autorizacionInspeccion: true,
      };

      findOneSolicitud.mockResolvedValue({
        ...mockSolicitudBase,
        id: 3,
        tipoSolicitud: {
          id: 5,
          slug: TipoSolicitudSlug.DISPONIBILIDAD_SERVICIOS,
          nombre: 'Constancia de Disponibilidad de Servicios',
        },
      });
      findOneDisponibilidad.mockResolvedValue(mockDetalleDisp);

      const response = await request(app.getHttpServer())
        .get('/solicitudes/3')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(response.body.id).toBe(3);
      expect(response.body.detalleDisponibilidadServicios).toBeDefined();
      expect(
        response.body.detalleDisponibilidadServicios.autorizacionInspeccion,
      ).toBe(true);
    });
  });

  describe('4. Consulta de Documentos Identificados e Historial', () => {
    it('debe incluir los documentos identificados con metadatos de archivo', async () => {
      findOneSolicitud.mockResolvedValue({ ...mockSolicitudBase });

      const response = await request(app.getHttpServer())
        .get('/solicitudes/1')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(response.body.documentos).toBeDefined();
      expect(response.body.documentos).toHaveLength(1);
      const doc = response.body.documentos[0];
      expect(doc.id).toBe(101);
      expect(doc.nombreOriginal).toBe('cedula_solicitante.pdf');
      expect(doc.tipoDocumento).toBe(TipoDocumentoSolicitud.IDENTIFICACION);
      expect(doc.tamanio).toBe(1048576);
      expect(doc.ubicacion).toBeDefined();
    });

    it('debe incluir el historial cronológico de auditoría', async () => {
      findOneSolicitud.mockResolvedValue({ ...mockSolicitudBase });

      const response = await request(app.getHttpServer())
        .get('/solicitudes/1')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(response.body.historial).toBeDefined();
      expect(response.body.historial).toHaveLength(1);
      const evento = response.body.historial[0];
      expect(evento.id).toBe(201);
      expect(evento.evento).toBe('REGISTRADA');
      expect(evento.estadoNuevo).toBe(EstadoSolicitud.PENDIENTE);
      expect(evento.fechaHora).toBeDefined();
    });
  });

  describe('5. Campos Administrativos y de Control ASADA', () => {
    it('debe exponer camposAdministrativos estructurados con el estado y control del formulario', async () => {
      const mockDetalleArreglo = {
        id: 10,
        solicitudId: 1,
        cedula: '1-0987-0654',
        montoPrimaInicial: 45000,
        plazoSeleccionado: PlazoArregloPago.MESES_12,
        numeroCuentaServicio: 'CTA-99881',
      };

      findOneSolicitud.mockResolvedValue({
        ...mockSolicitudBase,
        tipoSolicitud: {
          id: 1,
          slug: TipoSolicitudSlug.ARREGLO_PAGO,
          nombre: 'Solicitud de Arreglo de Pago Domiciliar',
        },
      });
      findOneArregloPago.mockResolvedValue(mockDetalleArreglo);

      const response = await request(app.getHttpServer())
        .get('/solicitudes/1')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(response.body.camposAdministrativos).toBeDefined();
      expect(response.body.camposAdministrativos.estadoActual).toBe(
        EstadoSolicitud.PENDIENTE,
      );
      expect(response.body.camposAdministrativos.codigoSeguimiento).toBe(
        'SOL-2026-A82K91',
      );
      expect(response.body.camposAdministrativos.totalDocumentos).toBe(1);
      expect(response.body.camposAdministrativos.totalEventosHistorial).toBe(1);
      expect(response.body.camposAdministrativos.plazoSeleccionado).toBe(
        PlazoArregloPago.MESES_12,
      );
      expect(response.body.camposAdministrativos.montoPrimaInicial).toBe(45000);
      expect(response.body.camposAdministrativos.numeroCuentaServicio).toBe(
        'CTA-99881',
      );
    });
  });
});
