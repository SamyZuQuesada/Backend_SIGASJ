import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { EntityManager, Repository } from 'typeorm';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { PlazoArregloPago } from '../../common/enums/plazo-arreglo-pago.enum';
import {
  TipoDocumentoSolicitud,
  normalizarTipoDocumentoSolicitud,
} from '../../common/enums/tipo-documento-solicitud.enum';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import {
  linkSolicitudDocumentFile,
  saveSolicitudDocumentPending,
  deleteSolicitudDocumentFile,
  SolicitudDocumentFile,
} from '../../common/media/public-media';
import * as mediaBlobStore from '../../common/media/media-blob.store';
import { SolicitudesService } from './solicitudes.service';
import { Solicitud } from './entities/solicitud.entity';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';
import { SolicitudServicio } from './entities/solicitud-servicio.entity';
import { SolicitudArregloPago } from './entities/solicitud-arreglo-pago.entity';
import { SolicitudCambioTitular } from './entities/solicitud-cambio-titular.entity';
import { SolicitudInfraestructuraLinderos } from './entities/solicitud-infraestructura-linderos.entity';
import { SolicitudAfiliacion } from './entities/solicitud-afiliacion.entity';
import { SolicitudDisponibilidadServicios } from './entities/solicitud-disponibilidad-servicios.entity';
import { SolicitudConstanciaServicio } from './entities/solicitud-constancia-servicio.entity';
import { DocumentoSolicitud } from './entities/documento-solicitud.entity';
import { HistorialSolicitud } from './entities/historial-solicitud.entity';
import { TiposSolicitudService } from './tipos-solicitud.service';
import { PropositoInfraestructuraLinderosConfirmado } from '../../common/enums/proposito-infraestructura-linderos.enum';
import { PropositoDisponibilidadServiciosConfirmado } from '../../common/enums/proposito-disponibilidad-servicios.enum';
import { CalidadTitularCambioTitular } from '../../common/enums/calidad-titular-cambio-titular.enum';
import { NaturalezaInmuebleCambioTitular } from '../../common/enums/naturaleza-inmueble-cambio-titular.enum';
import { MedioNotificacionCambioTitular } from '../../common/enums/medio-notificacion-cambio-titular.enum';
import { MotivoConstanciaServicio } from '../../common/enums/motivo-constancia-servicio.enum';
import { TipoPersonaDisponibilidadServicios } from '../../common/enums/tipo-persona-disponibilidad-servicios.enum';
import { TipoPersonaInfraestructuraLinderos } from '../../common/enums/tipo-persona-infraestructura-linderos.enum';

describe('SIGASJ — Soporte Documental Integral para los 6 Formularios Oficiales', () => {
  let service: SolicitudesService;

  const validPdfBuffer = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF',
  );
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  const makeFile = (
    originalname: string,
    mimetype: string,
    buffer: Buffer,
  ): SolicitudDocumentFile => ({
    originalname,
    mimetype,
    size: buffer.length,
    buffer,
  });

  // Mocks de repositorio y EntityManager
  let mockDocSavedList: DocumentoSolicitud[] = [];
  let nextDocId = 100;

  const createMockDoc = (data: Partial<DocumentoSolicitud>): DocumentoSolicitud => ({
    id: data.id ?? nextDocId++,
    solicitudId: data.solicitudId ?? null,
    tipoDocumento: data.tipoDocumento ?? TipoDocumentoSolicitud.IDENTIFICACION,
    nombreOriginal: data.nombreOriginal ?? 'documento.pdf',
    nombreInterno: data.nombreInterno ?? '12345-uuid.pdf',
    mimeType: data.mimeType ?? 'application/pdf',
    tipoArchivo: data.tipoArchivo ?? 'application/pdf',
    tamano: data.tamano ?? 1024,
    tamanio: data.tamanio ?? 1024,
    ubicacion: data.ubicacion ?? '/uploads/solicitudes/pendientes/12345-uuid.pdf',
    rutaReferenciaArchivo:
      data.rutaReferenciaArchivo ??
      '/uploads/solicitudes/pendientes/12345-uuid.pdf',
    tokenReclamo: data.tokenReclamo ?? 'token-valido-1234',
    fechaCarga: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as DocumentoSolicitud);

  let mockDocRepo: Partial<Repository<DocumentoSolicitud>>;
  let mockSolicitudRepo: Partial<Repository<Solicitud>>;
  let mockTipoRepo: Partial<Repository<TipoSolicitud>>;
  let mockHistorialRepo: Partial<Repository<HistorialSolicitud>>;

  beforeEach(async () => {
    mockDocSavedList = [];
    nextDocId = 100;

    mockDocRepo = {
      create: jest.fn().mockImplementation((data) => createMockDoc(data)),
      save: jest.fn().mockImplementation((doc) => {
        const index = mockDocSavedList.findIndex((d) => d.id === doc.id);
        if (index >= 0) {
          mockDocSavedList[index] = { ...mockDocSavedList[index], ...doc };
          return Promise.resolve(mockDocSavedList[index]);
        }
        const created = createMockDoc(doc);
        mockDocSavedList.push(created);
        return Promise.resolve(created);
      }),
      find: jest.fn().mockImplementation((options) => {
        let list = [...mockDocSavedList];
        if (options?.where?.solicitudId !== undefined) {
          const sId = options.where.solicitudId;
          if (sId === null || (typeof sId === 'object' && sId?._type === 'isNull')) {
            list = list.filter((d) => d.solicitudId === null || d.solicitudId === undefined);
          } else {
            list = list.filter((d) => d.solicitudId === sId);
          }
        }
        if (options?.where?.id) {
          const idOp = options.where.id;
          const targetIds = Array.isArray(idOp)
            ? idOp
            : Array.isArray(idOp?._value)
              ? idOp._value
              : Array.isArray(idOp?.value)
                ? idOp.value
                : [idOp];
          list = list.filter((d) => targetIds.includes(d.id));
        }
        return Promise.resolve(list);
      }),
      findOne: jest.fn().mockImplementation((options) => {
        const found = mockDocSavedList.find((d) => {
          if (options.where.id && options.where.solicitudId !== undefined) {
            return d.id === options.where.id && d.solicitudId === options.where.solicitudId;
          }
          if (options.where.id) return d.id === options.where.id;
          return false;
        });
        return Promise.resolve(found || null);
      }),
    };

    const mockManager: Partial<EntityManager> = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === DocumentoSolicitud) return mockDocRepo;
        return {
          create: jest.fn().mockImplementation((d) => ({ id: 50, ...d })),
          save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 50, ...d })),
          findOne: jest.fn().mockResolvedValue({ id: 50 }),
        };
      }),
    };

    mockSolicitudRepo = {
      create: jest.fn().mockImplementation((data) => ({
        id: 1,
        codigoSeguimiento: 'SOL-2026-TEST01',
        estado: EstadoSolicitud.PENDIENTE,
        fechaIngreso: new Date(),
        ...data,
      })),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ id: 1, ...data })),
      findOne: jest.fn().mockImplementation((options) => {
        return Promise.resolve({
          id: options.where.id,
          codigoSeguimiento: 'SOL-2026-TEST01',
          estado: EstadoSolicitud.PENDIENTE,
          fechaIngreso: new Date(),
          tipoSolicitudId: 1,
          tipoSolicitud: { id: 1, slug: TipoSolicitudSlug.ARREGLO_PAGO, nombre: 'Arreglo' },
          documentos: mockDocSavedList.filter((d) => d.solicitudId === options.where.id),
        });
      }),
      manager: {
        ...mockManager,
        transaction: jest.fn().mockImplementation(async (cb: (m: any) => Promise<any>) => {
          return cb(mockManager);
        }),
      } as any,
    };

    mockTipoRepo = {
      findOne: jest.fn().mockImplementation((opts) =>
        Promise.resolve({ id: 1, slug: opts.where.slug, nombre: 'Tipo' }),
      ),
    };

    mockHistorialRepo = {
      create: jest.fn().mockImplementation((data) => ({ id: 1, ...data })),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ id: 1, ...data })),
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudesService,
        { provide: getRepositoryToken(SolicitudServicio), useValue: {} },
        { provide: getRepositoryToken(Solicitud), useValue: mockSolicitudRepo },
        { provide: getRepositoryToken(SolicitudArregloPago), useValue: {} },
        { provide: getRepositoryToken(TipoSolicitud), useValue: mockTipoRepo },
        { provide: getRepositoryToken(DocumentoSolicitud), useValue: mockDocRepo },
        { provide: getRepositoryToken(HistorialSolicitud), useValue: mockHistorialRepo },
      ],
    }).compile();

    service = module.get<SolicitudesService>(SolicitudesService);
  });

  describe('1. Carga y Normalización en POST /api/v1/solicitudes/documentos', () => {
    it('acepta y almacena un PDF de identificación', async () => {
      const file = makeFile('cedula.pdf', 'application/pdf', validPdfBuffer);
      const res = await service.subirDocumentoSolicitud(file, 'identificacion');

      expect(res.id).toBeDefined();
      expect(res.tipoDocumento).toBe(TipoDocumentoSolicitud.IDENTIFICACION);
      expect(res.tokenReclamo).toBeDefined();
      expect(res.ubicacion).toMatch(/^\/uploads\/solicitudes\/pendientes\//);
      deleteSolicitudDocumentFile(res.ubicacion);
    });

    it('acepta y almacena un comprobante de pago para Arreglo de Pago', async () => {
      const file = makeFile('recibo.png', 'image/png', validPngBuffer);
      const res = await service.subirDocumentoSolicitud(file, 'comprobante-pago');

      expect(res.tipoDocumento).toBe(TipoDocumentoSolicitud.COMPROBANTE_PAGO);
      deleteSolicitudDocumentFile(res.ubicacion);
    });

    it('normaliza alias comunes (recibo, comprobante, cedula, adjunto)', async () => {
      expect(normalizarTipoDocumentoSolicitud('comprobante')).toBe(
        TipoDocumentoSolicitud.COMPROBANTE_PAGO,
      );
      expect(normalizarTipoDocumentoSolicitud('recibo')).toBe(
        TipoDocumentoSolicitud.COMPROBANTE_PAGO,
      );
      expect(normalizarTipoDocumentoSolicitud('cedula')).toBe(
        TipoDocumentoSolicitud.IDENTIFICACION,
      );
      expect(normalizarTipoDocumentoSolicitud('adjunto')).toBe(
        TipoDocumentoSolicitud.OTRO,
      );
    });

    it('rechaza tipos de documento no permitidos con BadRequestException', async () => {
      const file = makeFile('archivo.pdf', 'application/pdf', validPdfBuffer);
      await expect(
        service.subirDocumentoSolicitud(file, 'tipo-ficticio-invalido'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Fallback de Almacenamiento Persistente en linkSolicitudDocumentFile', () => {
    it('si el archivo local no existe, lo recupera desde dbo.ArchivoMedia y lo vincula', async () => {
      const mockBytes = Buffer.from('%PDF-1.4 persistent content');
      const pendingRuta = '/uploads/solicitudes/pendientes/recuperable-123.pdf';

      // Mock de readStoredMedia devolviendo el contenido desde Azure SQL
      jest.spyOn(mediaBlobStore, 'readStoredMedia').mockResolvedValueOnce({
        mime: 'application/pdf',
        bytes: mockBytes,
      });
      jest.spyOn(mediaBlobStore, 'relocateUploadedMedia').mockResolvedValueOnce(true);

      const linked = await linkSolicitudDocumentFile(42, pendingRuta);

      expect(linked.rutaReferenciaArchivo).toBe(
        `/uploads/solicitudes/42/recuperable-123.pdf`,
      );
      expect(linked.filename).toBe('recuperable-123.pdf');

      // Limpieza
      deleteSolicitudDocumentFile(linked.rutaReferenciaArchivo);
    });

    it('si el archivo no existe en disco ni en dbo.ArchivoMedia, lanza NotFoundException', async () => {
      const pendingRuta = '/uploads/solicitudes/pendientes/inexistente-total.pdf';
      jest.spyOn(mediaBlobStore, 'readStoredMedia').mockResolvedValueOnce(null);

      await expect(linkSolicitudDocumentFile(42, pendingRuta)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('3. Verificación de los 6 Formularios Oficiales con Documentos', () => {
    // Helper para precargar documentos pendientes en el mock
    const seedPendingDoc = (tipo: TipoDocumentoSolicitud, id = nextDocId++) => {
      const token = `token-${id}`;
      const doc = createMockDoc({
        id,
        solicitudId: null,
        tipoDocumento: tipo,
        tokenReclamo: token,
        rutaReferenciaArchivo: `/uploads/solicitudes/pendientes/doc-${id}.pdf`,
      });
      mockDocSavedList.push(doc);
      return { id, tokenReclamo: token };
    };

    beforeEach(() => {
      // Mock de linkSolicitudDocumentFile para evitar escrituras reales en disco durante pruebas de service
      jest.spyOn(mediaBlobStore, 'readStoredMedia').mockResolvedValue({
        mime: 'application/pdf',
        bytes: validPdfBuffer,
      });
      jest.spyOn(mediaBlobStore, 'relocateUploadedMedia').mockResolvedValue(true);
    });

    it('Formulario 1 (Arreglo de Pago): vincula documentos opcionales de comprobante e identificación', async () => {
      const doc1 = seedPendingDoc(TipoDocumentoSolicitud.IDENTIFICACION);
      const doc2 = seedPendingDoc(TipoDocumentoSolicitud.COMPROBANTE_PAGO);

      const sol = await service.crearSolicitudArregloPago({
        nombre: 'Carlos Alvarado',
        cedula: '1-1234-5678',
        vecinoDe: 'San Juan',
        telefono: '8888-8888',
        numeroCuentaServicio: 'CTA-101',
        montoPrimaInicial: 15000,
        plazoSeleccionado: PlazoArregloPago.MESES_6,
        documentos: [doc1, doc2],
      });

      expect(sol.documentos).toHaveLength(2);
      expect(mockDocSavedList.find((d) => d.id === doc1.id)?.solicitudId).toBe(sol.id);
      expect(mockDocSavedList.find((d) => d.id === doc2.id)?.solicitudId).toBe(sol.id);
    });

    it('Formulario 2 (Cambio de Titular): vincula documentos con tipo "otro" para título/escritura y tipos específicos para identificación y poder', async () => {
      const docIden = seedPendingDoc(TipoDocumentoSolicitud.IDENTIFICACION);
      const docPoder = seedPendingDoc(TipoDocumentoSolicitud.PODER);
      const docEscritura = seedPendingDoc(TipoDocumentoSolicitud.OTRO);
      // Asignar nombres originales para verificar conservación de metadatos
      const d1 = mockDocSavedList.find((d) => d.id === docIden.id)!;
      d1.nombreOriginal = 'cedula_solicitante.pdf';
      const d2 = mockDocSavedList.find((d) => d.id === docPoder.id)!;
      d2.nombreOriginal = 'poder_especial.pdf';
      const d3 = mockDocSavedList.find((d) => d.id === docEscritura.id)!;
      d3.nombreOriginal = 'escritura_publica_finca_12345.pdf';

      const sol = await service.crearSolicitudCambioTitular({
        nombreSolicitante: 'María Soto',
        identificacionSolicitante: '2-2345-6789',
        telefono: '8765-4321',
        nombrePropietarioRegistral: 'María Soto',
        identificacionPropietario: '2-2345-6789',
        naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
        calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
        nis: 'NIS-9988',
        facturaANombreDe: 'María Soto',
        medioNotificacionPrincipal: MedioNotificacionCambioTitular.TELEFONO,
        documentos: [docIden, docPoder, docEscritura],
      });

      expect(sol.documentos).toHaveLength(3);
      expect(mockDocSavedList.find((d) => d.id === docEscritura.id)?.solicitudId).toBe(sol.id);
      expect(mockDocSavedList.find((d) => d.id === docEscritura.id)?.nombreOriginal).toBe(
        'escritura_publica_finca_12345.pdf',
      );
      expect(mockDocSavedList.find((d) => d.id === docEscritura.id)?.tipoDocumento).toBe(
        TipoDocumentoSolicitud.OTRO,
      );
    });

    it('Formulario 3 (Infraestructura y Linderos): exige y vincula documentos requeridos', async () => {
      const docIden = seedPendingDoc(TipoDocumentoSolicitud.IDENTIFICACION);
      const docPlano = seedPendingDoc(TipoDocumentoSolicitud.PLANO_CATASTRADO);
      const docAgrimensura = seedPendingDoc(TipoDocumentoSolicitud.PLANO_AGRIMENSURA);

      const sol = await service.crearSolicitudInfraestructuraLinderos({
        nis: 'NIS-12345',
        tipoPersona: TipoPersonaInfraestructuraLinderos.FISICA,
        nombreFisica: 'Pedro',
        apellidosFisica: 'Pérez Gómez',
        identificacionFisica: '1-0987-0654',
        telefonoFisica: '8899-7766',
        calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
        provincia: 'Guanacaste',
        canton: 'Santa Cruz',
        distrito: 'San Juan',
        direccionExacta: '200m este del parque',
        planoCatastrado: 'G-12345',
        planoAgrimensura: 'AG-12345',
        proposito: PropositoInfraestructuraLinderosConfirmado.REUNION_FINCAS,
        medioNotificacionPrincipal: MedioNotificacionCambioTitular.TELEFONO,
        documentos: [docIden, docPlano, docAgrimensura],
      });

      expect(sol.documentos).toHaveLength(3);
      expect(mockDocSavedList.find((d) => d.id === docIden.id)?.solicitudId).toBe(sol.id);
      expect(mockDocSavedList.find((d) => d.id === docPlano.id)?.solicitudId).toBe(sol.id);
      expect(mockDocSavedList.find((d) => d.id === docAgrimensura.id)?.solicitudId).toBe(sol.id);
    });

    it('Formulario 4 (Afiliación): permite crear solicitud sin documentos (documentos opcionales)', async () => {
      const sol = await service.crearSolicitudAfiliacion({
        fechaSolicitud: '2026-11-16',
        nombre: 'Carlos Jiménez',
        identificacion: '1-0987-0543',
        vecinoDe: 'San Juan',
        estadoCivil: 'Casado',
        telefono: '8333-2211',
        correoElectronico: 'carlos@correo.com',
        numeroAbonado: 'ABO-77',
        numeroPlano: 'P-7788',
        recomendacion1Nombre: 'Socio 1',
        recomendacion1Identificacion: '1-1111-1111',
        recomendacion1NumeroAbonado: 'ABO-1',
        recomendacion2Nombre: 'Socio 2',
        recomendacion2Identificacion: '2-2222-2222',
        recomendacion2NumeroAbonado: 'ABO-2',
        documentos: [],
      });

      expect(sol.id).toBe(50);
      expect(sol.documentos).toBeUndefined();
    });

    it('Formulario 4 (Afiliación): vincula uno o varios documentos opcionales cuando se proporcionan', async () => {
      const doc1 = seedPendingDoc(TipoDocumentoSolicitud.IDENTIFICACION);
      const doc2 = seedPendingDoc(TipoDocumentoSolicitud.OTRO);

      const sol = await service.crearSolicitudAfiliacion({
        fechaSolicitud: '2026-11-16',
        nombre: 'Lucía Méndez',
        identificacion: '3-0345-0678',
        vecinoDe: 'San Juan',
        estadoCivil: 'Soltera',
        telefono: '8444-5555',
        correoElectronico: 'lucia@correo.com',
        numeroAbonado: 'ABO-50',
        numeroPlano: 'P-5050',
        recomendacion1Nombre: 'Socio 1',
        recomendacion1Identificacion: '1-1111-1111',
        recomendacion1NumeroAbonado: 'ABO-1',
        recomendacion2Nombre: 'Socio 2',
        recomendacion2Identificacion: '2-2222-2222',
        recomendacion2NumeroAbonado: 'ABO-2',
        documentos: [doc1, doc2],
      });

      expect(sol.documentos).toHaveLength(2);
      expect(mockDocSavedList.find((d) => d.id === doc1.id)?.solicitudId).toBe(sol.id);
      expect(mockDocSavedList.find((d) => d.id === doc2.id)?.solicitudId).toBe(sol.id);
    });

    it('Formulario 5 (Disponibilidad de Servicios): exige y vincula documentos obligatorios', async () => {
      const docIden = seedPendingDoc(TipoDocumentoSolicitud.IDENTIFICACION);
      const docPlano = seedPendingDoc(TipoDocumentoSolicitud.PLANO_CATASTRADO);

      const sol = await service.crearSolicitudDisponibilidadServicios({
        tipoPersona: TipoPersonaDisponibilidadServicios.FISICA,
        nombreFisica: 'Ana',
        primerApellidoFisica: 'Campos',
        segundoApellidoFisica: 'Mora',
        identificacionFisica: '1-1234-5678',
        telefonoFisica: '8888-1122',
        naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
        calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
        provincia: 'Guanacaste',
        canton: 'Santa Cruz',
        distrito: 'San Juan',
        direccionExacta: 'Frente al templo',
        proposito: PropositoDisponibilidadServiciosConfirmado.FRACCIONAMIENTO,
        planoCatastrado: 'G-9988',
        descripcionProyecto: 'Vivienda unifamiliar',
        autorizacionInspeccion: true,
        medioNotificacionPrincipal: MedioNotificacionCambioTitular.TELEFONO,
        documentos: [docIden, docPlano],
      });

      expect(sol.documentos).toHaveLength(2);
      expect(mockDocSavedList.find((d) => d.id === docIden.id)?.solicitudId).toBe(sol.id);
    });

    it('Formulario 6 (Constancia de Servicio Existente): vincula documentos adjuntos', async () => {
      const doc = seedPendingDoc(TipoDocumentoSolicitud.OTRO);

      const sol = await service.crearSolicitudConstanciaServicio({
        tipoServicio: 'Agua Potable Domiciliar',
        nis: 'NIS-7744',
        propietarioInmueble: 'Manuel Gómez',
        nombreSolicitante: 'Manuel Gómez',
        identificacionSolicitante: '1-0555-0666',
        correoElectronico: 'manuel@correo.com',
        telefono: '8877-6655',
        naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
        calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
        provincia: 'Guanacaste',
        canton: 'Santa Cruz',
        distrito: 'San Juan',
        direccionExacta: 'Calle Central',
        motivo: MotivoConstanciaServicio.TRAMITE_BANCARIO,
        medioNotificacionPrincipal: MedioNotificacionCambioTitular.TELEFONO,
        documentos: [doc],
      });

      expect(sol.documentos).toHaveLength(1);
      expect(mockDocSavedList.find((d) => d.id === doc.id)?.solicitudId).toBe(sol.id);
    });
  });

  describe('4. Consulta de Detalle Administrativo', () => {
    it('obtenerDetalle retorna los documentos asociados a la solicitud', async () => {
      const doc1 = createMockDoc({ id: 101, solicitudId: 1, nombreOriginal: 'cedula.pdf' });
      const doc2 = createMockDoc({ id: 102, solicitudId: 1, nombreOriginal: 'comprobante.pdf' });
      mockDocSavedList = [doc1, doc2];

      const detalle = await service.obtenerDetalle(1);

      expect(detalle.documentos).toHaveLength(2);
      expect(detalle.documentos?.[0].nombreOriginal).toBe('cedula.pdf');
      expect((detalle as any).camposAdministrativos.totalDocumentos).toBe(2);
    });
  });
});
