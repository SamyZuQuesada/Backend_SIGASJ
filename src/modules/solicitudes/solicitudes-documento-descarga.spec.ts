import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '../../common/enums/role.enum';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
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

describe('Descarga Segura de Archivos Binarios de Documentos (Backend)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  // Directorio temporal de pruebas bajo uploads/solicitudes
  const testUploadsDir = resolve(process.cwd(), 'uploads', 'solicitudes', '15');
  const dummyPdfName = 'test-doc-15-40.pdf';
  const dummyPdfPath = join(testUploadsDir, dummyPdfName);
  const dummyPdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

  const mockSolicitud15: Partial<Solicitud> = {
    id: 15,
    codigoSeguimiento: 'SOL-2026-X8K91B',
    tipoSolicitudId: 2,
    estado: EstadoSolicitud.EN_REVISION,
    fechaIngreso: new Date('2026-10-24T18:30:00Z'),
  };

  const mockDocumento40: Partial<DocumentoSolicitud> = {
    id: 40,
    solicitudId: 15,
    nombreOriginal: 'cedula_identidad_carlos.pdf',
    nombreInterno: dummyPdfName,
    mimeType: 'application/pdf',
    tipoArchivo: 'application/pdf',
    tamano: dummyPdfContent.length,
    tamanio: dummyPdfContent.length,
    ubicacion: `/uploads/solicitudes/15/${dummyPdfName}`,
  };

  const mockDocumentoPerteneceAOtra: Partial<DocumentoSolicitud> = {
    id: 99,
    solicitudId: 999, // Pertenece a solicitud 999, no a la 15
    nombreOriginal: 'plano_otra_solicitud.pdf',
    nombreInterno: 'otro.pdf',
    mimeType: 'application/pdf',
    tipoArchivo: 'application/pdf',
    tamano: 100,
    tamanio: 100,
    ubicacion: '/uploads/solicitudes/999/otro.pdf',
  };

  const signAsRole = (role?: Role) => {
    const payload: Partial<JwtPayload> = {
      sub: '10',
      email: 'admin.docs@asadasanjuan.cr',
      name: 'Usuario Docs',
    };
    if (role) {
      payload.role = role;
    }
    return jwtService.sign(payload);
  };

  let mockSolicitudFindOne: jest.Mock;
  let mockDocumentoFindOne: jest.Mock;

  beforeAll(async () => {
    // Crear archivo físico real en uploads/solicitudes/15 para que existsSync y sendFile respondan 200
    mkdirSync(testUploadsDir, { recursive: true });
    writeFileSync(dummyPdfPath, dummyPdfContent);

    mockSolicitudFindOne = jest.fn();
    mockDocumentoFindOne = jest.fn();

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
            findOne: mockSolicitudFindOne,
          },
        },
        {
          provide: getRepositoryToken(DocumentoSolicitud),
          useValue: {
            findOne: mockDocumentoFindOne,
          },
        },
        {
          provide: getRepositoryToken(SolicitudServicio),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(TipoSolicitud),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(SolicitudArregloPago),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(SolicitudCambioTitular),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(SolicitudInfraestructuraLinderos),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(SolicitudAfiliacion),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(SolicitudDisponibilidadServicios),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(SolicitudConstanciaServicio),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(HistorialSolicitud),
          useValue: { find: jest.fn() },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    try {
      rmSync(testUploadsDir, { recursive: true, force: true });
    } catch {}
    await app.close();
  });

  beforeEach(() => {
    mockSolicitudFindOne.mockReset();
    mockDocumentoFindOne.mockReset();

    // Default implementations
    mockSolicitudFindOne.mockImplementation(async (options: any) => {
      const id = options?.where?.id;
      if (id === 15) {
        return mockSolicitud15;
      }
      return null;
    });

    mockDocumentoFindOne.mockImplementation(async (options: any) => {
      const { id, solicitudId } = options?.where || {};
      if (id === 40 && (!solicitudId || solicitudId === 15)) {
        return mockDocumento40;
      }
      if (id === 99) {
        if (!solicitudId || solicitudId === 999) {
          return mockDocumentoPerteneceAOtra;
        }
        return null;
      }
      return null;
    });
  });

  describe('1. Endpoint binario y formato de respuesta (Punto 1, 2 y 8)', () => {
    it('GET /solicitudes/15/documentos/40/descargar devuelve 200 con cuerpo binario y headers correctos', async () => {
      const token = signAsRole(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/solicitudes/15/documentos/40/descargar')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Content-Type debe ser el MIME verificado
      expect(response.headers['content-type']).toContain('application/pdf');

      // Content-Disposition debe ser inline con el nombre original codificado en UTF-8
      expect(response.headers['content-disposition']).toContain('inline');
      expect(response.headers['content-disposition']).toContain('cedula_identidad_carlos.pdf');

      // Cuerpo binario no vacío coincidente con el archivo en disco
      expect(response.body).toBeInstanceOf(Buffer);
      expect(response.body.length).toBe(dummyPdfContent.length);
      expect(response.body.toString('utf-8')).toBe(dummyPdfContent.toString('utf-8'));
    });

    it('GET /solicitudes/15/documentos/40 (sin sufijo descargar) también devuelve el archivo correctamente', async () => {
      const token = signAsRole(Role.SECRETARIA);

      const response = await request(app.getHttpServer())
        .get('/solicitudes/15/documentos/40')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.body.length).toBe(dummyPdfContent.length);
    });
  });

  describe('2. Validación de pertenencia simultánea (Punto 3)', () => {
    it('debe devolver 404 si se solicita un documento que pertenece a otra solicitud', async () => {
      const token = signAsRole(Role.ADMINISTRADORA);

      // El documento 99 pertenece a la solicitud 999, se intenta descargar indicando solicitudId 15
      const response = await request(app.getHttpServer())
        .get('/solicitudes/15/documentos/99/descargar')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.message).toContain('no pertenece a la solicitud');
    });

    it('debe devolver 404 si el documentoId no existe en la base de datos', async () => {
      const token = signAsRole(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/solicitudes/15/documentos/99999/descargar')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.message).toContain('no fue encontrado');
    });

    it('debe devolver 404 si la solicitud padre no existe', async () => {
      const token = signAsRole(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/solicitudes/8888/documentos/40/descargar')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.message).toContain('no fue encontrada');
    });
  });

  describe('3. Control de Acceso y Seguridad RBAC (Punto 4)', () => {
    it('debe responder 401 si no se envía token', async () => {
      const response = await request(app.getHttpServer())
        .get('/solicitudes/15/documentos/40/descargar')
        .expect(401);

      expect(response.body.message).toBe('No autenticado');
    });

    it('debe responder 403 al rol ABONADO', async () => {
      const tokenAbonado = signAsRole(Role.ABONADO);

      const response = await request(app.getHttpServer())
        .get('/solicitudes/15/documentos/40/descargar')
        .set('Authorization', `Bearer ${tokenAbonado}`)
        .expect(403);

      expect(response.body.message).toBe('Acceso denegado');
    });

    it('debe responder 403 al rol AYUDANTE', async () => {
      const tokenAyudante = signAsRole(Role.AYUDANTE);

      const response = await request(app.getHttpServer())
        .get('/solicitudes/15/documentos/40/descargar')
        .set('Authorization', `Bearer ${tokenAyudante}`)
        .expect(403);

      expect(response.body.message).toBe('Acceso denegado');
    });

    it('debe permitir descarga a ADMINISTRADORA, SECRETARIA y FONTANERO', async () => {
      for (const role of [Role.ADMINISTRADORA, Role.SECRETARIA, Role.FONTANERO]) {
        const token = signAsRole(role);
        await request(app.getHttpServer())
          .get('/solicitudes/15/documentos/40/descargar')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      }
    });
  });

  describe('4. Prevención de Path Traversal (Punto 5)', () => {
    it('debe devolver 403 si la ubicación registrada en base de datos intenta escapar de uploads/solicitudes', async () => {
      const token = signAsRole(Role.ADMINISTRADORA);

      // Simular registro malicioso con path traversal
      mockDocumentoFindOne.mockImplementationOnce(async () => ({
        id: 55,
        solicitudId: 15,
        nombreOriginal: 'archivo_peligroso.pdf',
        mimeType: 'application/pdf',
        ubicacion: '../../../windows/system32/cmd.exe',
      }));

      const response = await request(app.getHttpServer())
        .get('/solicitudes/15/documentos/55/descargar')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.message).toBe('Ruta de documento inválida');
    });
  });

  describe('5. Manejo de archivo físico ausente en servidor (Punto 6)', () => {
    it('debe devolver 404 controlado sin revelar la ruta del servidor si el archivo físico no existe', async () => {
      const token = signAsRole(Role.ADMINISTRADORA);

      // Simular registro válido en BD pero que el archivo físico fue eliminado del disco
      mockDocumentoFindOne.mockImplementationOnce(async () => ({
        id: 77,
        solicitudId: 15,
        nombreOriginal: 'archivo_eliminado.pdf',
        mimeType: 'application/pdf',
        ubicacion: '/uploads/solicitudes/15/inexistente_en_disco.pdf',
      }));

      const response = await request(app.getHttpServer())
        .get('/solicitudes/15/documentos/77/descargar')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.message).toBe('El archivo físico del documento no fue encontrado en el servidor.');
      // Verificar que NO se filtre la ruta interna del sistema de archivos en el response
      expect(response.body.message).not.toContain('C:');
      expect(response.body.message).not.toContain('uploads');
    });
  });
});
