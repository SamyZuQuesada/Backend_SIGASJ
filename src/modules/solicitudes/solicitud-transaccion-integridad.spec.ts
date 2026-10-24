import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { PlazoArregloPago } from '../../common/enums/plazo-arreglo-pago.enum';
import { TipoDocumentoSolicitud } from '../../common/enums/tipo-documento-solicitud.enum';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { deleteSolicitudDocumentFile } from '../../common/media/public-media';
import { CreateSolicitudArregloPagoDto } from './dto/create-solicitud-arreglo-pago.dto';
import { DocumentoSolicitud } from './entities/documento-solicitud.entity';
import { HistorialSolicitud } from './entities/historial-solicitud.entity';
import { SolicitudArregloPago } from './entities/solicitud-arreglo-pago.entity';
import { SolicitudServicio } from './entities/solicitud-servicio.entity';
import { Solicitud } from './entities/solicitud.entity';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';
import { SolicitudesService } from './solicitudes.service';
import { TiposSolicitudService } from './tipos-solicitud.service';

jest.mock('../../common/media/public-media', () => ({
  linkSolicitudDocumentFile: jest.fn(
    (solicitudId: number, pendingPath: string) => ({
      rutaReferenciaArchivo: `/uploads/solicitudes/${solicitudId}/${pendingPath.split('/').pop()}`,
      filename: pendingPath.split('/').pop(),
    }),
  ),
  deleteSolicitudDocumentFile: jest.fn(),
  saveSolicitudDocumentPending: jest.fn(),
  MAX_SOLICITUD_DOCUMENT_BYTES: 10 * 1024 * 1024,
}));

describe('Tarea 1 - Integridad Transaccional del Registro de Solicitudes', () => {
  let service: SolicitudesService;
  let solicitudRepo: Repository<Solicitud>;
  let arregloPagoRepo: Repository<SolicitudArregloPago>;
  let documentoRepo: Repository<DocumentoSolicitud>;
  let historialRepo: Repository<HistorialSolicitud>;

  let mockTransaction: jest.Mock;
  let mockSolicitudSaved: Solicitud;
  let mockDetalleSaved: SolicitudArregloPago;
  let mockDocumentSaved: DocumentoSolicitud;
  let mockHistorialSaved: HistorialSolicitud;

  const tipoArreglo: TipoSolicitud = {
    id: 1,
    nombre: 'Solicitud de Arreglo de Pago Domiciliar',
    descripcion: 'Convenio de pago',
    slug: TipoSolicitudSlug.ARREGLO_PAGO,
    activo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    solicitudes: [],
  };

  const dtoArregloPago: CreateSolicitudArregloPagoDto = {
    nombre: 'Juan Carlos Rodríguez Mora',
    cedula: '1-1234-0567',
    vecinoDe: 'San Juan de Desamparados',
    telefono: '8888-1234',
    numeroCuentaServicio: 'CTA-00984',
    montoPrimaInicial: 25000,
    plazoSeleccionado: PlazoArregloPago.MESES_6,
    firma: 'data:image/png;base64,AAA',
    documentos: [
      {
        id: 10,
        tokenReclamo: 'tok-doc-10',
      },
    ],
  };

  const getDocumentoPendiente = () =>
    ({
      id: 10,
      tokenReclamo: 'tok-doc-10',
      tipoDocumento: TipoDocumentoSolicitud.IDENTIFICACION,
      nombreOriginal: 'cedula.pdf',
      nombreInterno: 'cedula_10.pdf',
      mimeType: 'application/pdf',
      tipoArchivo: 'application/pdf',
      tamano: 1024,
      tamanio: 1024,
      ubicacion: '/uploads/solicitudes/pendientes/cedula_10.pdf',
      rutaReferenciaArchivo: '/uploads/solicitudes/pendientes/cedula_10.pdf',
      solicitudId: null,
      fechaCarga: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      sincronizarMetadatos: jest.fn(),
    }) as DocumentoSolicitud;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockSolicitudSaved = {
      id: 42,
      tipoSolicitudId: 1,
      codigoSeguimiento: 'SOL-2026-00042',
      estado: EstadoSolicitud.PENDIENTE,
      fechaIngreso: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      establecerValoresPorDefecto: jest.fn(),
    } as unknown as Solicitud;

    mockDetalleSaved = {
      id: 84,
      solicitudId: 42,
      nombre: dtoArregloPago.nombre,
      cedula: dtoArregloPago.cedula,
      vecinoDe: dtoArregloPago.vecinoDe,
      telefono: dtoArregloPago.telefono,
      numeroCuentaServicio: dtoArregloPago.numeroCuentaServicio,
      montoPrimaInicial: dtoArregloPago.montoPrimaInicial,
      plazoSeleccionado: dtoArregloPago.plazoSeleccionado,
      firma: dtoArregloPago.firma,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as SolicitudArregloPago;

    mockDocumentSaved = {
      ...getDocumentoPendiente(),
      solicitudId: 42,
      tokenReclamo: 'used:10:abc123',
    } as DocumentoSolicitud;

    mockHistorialSaved = {
      id: 100,
      solicitudId: 42,
      evento: 'REGISTRADA',
      tipoEvento: 'CREACION',
      descripcion: 'Registro inicial de solicitud de arreglo de pago domiciliar',
      estadoAnterior: null,
      estadoNuevo: EstadoSolicitud.PENDIENTE,
      idUsuario: null,
      fechaHora: new Date(),
    } as unknown as HistorialSolicitud;

    mockTransaction = jest.fn(async (callback: (manager: EntityManager) => Promise<unknown>) => {
      const mockManager = {
        getRepository: (entity: unknown) => {
          if (entity === Solicitud) {
            return {
              create: jest.fn().mockReturnValue(mockSolicitudSaved),
              save: jest.fn().mockResolvedValue(mockSolicitudSaved),
            };
          }
          if (entity === SolicitudArregloPago) {
            return {
              create: jest.fn().mockReturnValue(mockDetalleSaved),
              save: jest.fn().mockResolvedValue(mockDetalleSaved),
            };
          }
          if (entity === DocumentoSolicitud) {
            return {
              create: jest.fn().mockImplementation((d) => d),
              save: jest.fn().mockResolvedValue(mockDocumentSaved),
              find: jest.fn().mockImplementation(() => Promise.resolve([getDocumentoPendiente()])),
            };
          }
          if (entity === HistorialSolicitud) {
            return {
              create: jest.fn().mockReturnValue(mockHistorialSaved),
              save: jest.fn().mockResolvedValue(mockHistorialSaved),
            };
          }
          throw new Error('Repositorio no mockeado');
        },
      } as unknown as EntityManager;

      return callback(mockManager);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudesService,
        {
          provide: getRepositoryToken(SolicitudServicio),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Solicitud),
          useValue: {
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(null),
            }),
            manager: {
              transaction: mockTransaction,
            },
          },
        },
        {
          provide: getRepositoryToken(SolicitudArregloPago),
          useValue: {
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DocumentoSolicitud),
          useValue: {
            find: jest
              .fn()
              .mockImplementation(() =>
                Promise.resolve([getDocumentoPendiente()]),
              ),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(HistorialSolicitud),
          useValue: {
            find: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: TiposSolicitudService,
          useValue: {
            findBySlug: jest.fn().mockResolvedValue(tipoArreglo),
          },
        },
      ],
    }).compile();

    service = module.get<SolicitudesService>(SolicitudesService);
    solicitudRepo = module.get(getRepositoryToken(Solicitud));
    arregloPagoRepo = module.get(getRepositoryToken(SolicitudArregloPago));
    documentoRepo = module.get(getRepositoryToken(DocumentoSolicitud));
    historialRepo = module.get(getRepositoryToken(HistorialSolicitud));
  });

  describe('1. Operación exitosa (Guarda todos los 4 componentes conjuntamente)', () => {
    it('debe registrar Solicitud, Detalle, Documentos y Evento Inicial de Historial en una sola transacción', async () => {
      const resultado = await service.crearSolicitudArregloPago(dtoArregloPago);

      // Verificación de ejecución en transacción
      expect(mockTransaction).toHaveBeenCalledTimes(1);

      // Verificación de componentes vinculados
      expect(resultado).toBeDefined();
      expect(resultado.id).toBe(42);
      expect(resultado.codigoSeguimiento).toBeDefined();
      expect(resultado.codigoSeguimiento).toMatch(
        /^SOL-\d{4}-[A-Z0-9]{5,10}$/i,
      );

      // 1. Solicitud principal
      expect(resultado.estado).toBe(EstadoSolicitud.PENDIENTE);

      // 2. Detalle del formulario
      expect(resultado.detalleArregloPago).toBeDefined();
      expect(resultado.detalleArregloPago?.id).toBe(84);
      expect(resultado.detalleArregloPago?.solicitudId).toBe(42);

      // 3. Documentos adjuntos reclamados
      expect(resultado.documentos).toBeDefined();
      expect(resultado.documentos).toHaveLength(1);
      expect(resultado.documentos?.[0].solicitudId).toBe(42);

      // 4. Evento inicial de historial
      expect(resultado.historial).toBeDefined();
      expect(resultado.historial).toHaveLength(1);
      expect(resultado.historial?.[0].solicitudId).toBe(42);
      expect(resultado.historial?.[0].evento).toBe('REGISTRADA');
      expect(resultado.historial?.[0].estadoNuevo).toBe(EstadoSolicitud.PENDIENTE);
    });

    it('conserva la integridad referencial: el id de la solicitud coincide en Detalle, Documentos e Historial', async () => {
      const resultado = await service.crearSolicitudArregloPago(dtoArregloPago);

      const idSolicitud = resultado.id;
      expect(resultado.detalleArregloPago?.solicitudId).toBe(idSolicitud);
      expect(resultado.documentos?.[0].solicitudId).toBe(idSolicitud);
      expect(resultado.historial?.[0].solicitudId).toBe(idSolicitud);
    });

    it('el código de seguimiento asignado es único y no expone el ID interno', async () => {
      const resultado = await service.crearSolicitudArregloPago(dtoArregloPago);

      expect(resultado.codigoSeguimiento).not.toBe(String(resultado.id));
      expect(resultado.codigoSeguimiento.startsWith('SOL-')).toBe(true);
    });
  });

  describe('2. Rollback ante fallos (No quedan solicitudes parcialmente guardadas)', () => {
    it('debe ejecutar rollback si la inserción del detalle falla', async () => {
      mockTransaction.mockImplementation(async (callback) => {
        const mockManager = {
          getRepository: (entity: unknown) => {
            if (entity === Solicitud) {
              return {
                create: jest.fn().mockReturnValue(mockSolicitudSaved),
                save: jest.fn().mockResolvedValue(mockSolicitudSaved),
              };
            }
            if (entity === SolicitudArregloPago) {
              return {
                create: jest.fn().mockReturnValue(mockDetalleSaved),
                save: jest.fn().mockRejectedValue(new Error('Fallo al insertar detalle de formulario')),
              };
            }
            if (entity === DocumentoSolicitud) {
              return {
                save: jest.fn().mockResolvedValue(mockDocumentSaved),
              };
            }
            if (entity === HistorialSolicitud) {
              return {
                create: jest.fn(),
                save: jest.fn(),
              };
            }
            throw new Error('Repo desconocido');
          },
        } as unknown as EntityManager;

        return callback(mockManager);
      });

      await expect(
        service.crearSolicitudArregloPago(dtoArregloPago),
      ).rejects.toThrow('Fallo al insertar detalle de formulario');

      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('debe ejecutar rollback y limpiar archivos físicos en disco si falla la vinculación de documentos', async () => {
      mockTransaction.mockImplementation(async (callback) => {
        const mockManager = {
          getRepository: (entity: unknown) => {
            if (entity === Solicitud) {
              return {
                create: jest.fn().mockReturnValue(mockSolicitudSaved),
                save: jest.fn().mockResolvedValue(mockSolicitudSaved),
              };
            }
            if (entity === SolicitudArregloPago) {
              return {
                create: jest.fn().mockReturnValue(mockDetalleSaved),
                save: jest.fn().mockResolvedValue(mockDetalleSaved),
              };
            }
            if (entity === DocumentoSolicitud) {
              return {
                save: jest.fn().mockRejectedValue(new Error('Error de disco o base de datos en documento')),
              };
            }
            if (entity === HistorialSolicitud) {
              return {
                create: jest.fn().mockReturnValue(mockHistorialSaved),
                save: jest.fn().mockResolvedValue(mockHistorialSaved),
              };
            }
            throw new Error('Repo desconocido');
          },
        } as unknown as EntityManager;

        return callback(mockManager);
      });

      await expect(
        service.crearSolicitudArregloPago(dtoArregloPago),
      ).rejects.toThrow('Error de disco o base de datos en documento');

      // Verifica limpieza de archivo físico en caso de rollback
      expect(deleteSolicitudDocumentFile).toHaveBeenCalled();
    });

    it('debe ejecutar rollback si falla el evento inicial de historial', async () => {
      mockTransaction.mockImplementation(async (callback) => {
        const mockManager = {
          getRepository: (entity: unknown) => {
            if (entity === Solicitud) {
              return {
                create: jest.fn().mockReturnValue(mockSolicitudSaved),
                save: jest.fn().mockResolvedValue(mockSolicitudSaved),
              };
            }
            if (entity === SolicitudArregloPago) {
              return {
                create: jest.fn().mockReturnValue(mockDetalleSaved),
                save: jest.fn().mockResolvedValue(mockDetalleSaved),
              };
            }
            if (entity === DocumentoSolicitud) {
              return {
                save: jest.fn().mockResolvedValue(mockDocumentSaved),
              };
            }
            if (entity === HistorialSolicitud) {
              return {
                create: jest.fn().mockReturnValue(mockHistorialSaved),
                save: jest.fn().mockRejectedValue(new InternalServerErrorException('Fallo al registrar evento inicial de historial')),
              };
            }
            throw new Error('Repo desconocido');
          },
        } as unknown as EntityManager;

        return callback(mockManager);
      });

      await expect(
        service.crearSolicitudArregloPago(dtoArregloPago),
      ).rejects.toThrow('Fallo al registrar evento inicial de historial');
    });
  });

  describe('3. Validación previa a la transacción', () => {
    it('debe rechazar datos inválidos antes de abrir transacción (ej. plazo no permitido)', async () => {
      const dtoInvalido = {
        ...dtoArregloPago,
        plazoSeleccionado: 'plazo_invalido' as unknown as PlazoArregloPago,
      };

      await expect(
        service.crearSolicitudArregloPago(dtoInvalido),
      ).rejects.toThrow(BadRequestException);

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('debe rechazar montos negativos antes de abrir transacción', async () => {
      const dtoInvalido = {
        ...dtoArregloPago,
        montoPrimaInicial: -500,
      };

      await expect(
        service.crearSolicitudArregloPago(dtoInvalido),
      ).rejects.toThrow(BadRequestException);

      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('4. Método registrarSolicitudIntegral (Reutilizable para cualquier formulario)', () => {
    it('permite registrar integralmente cualquier formulario guardando Solicitud + Detalle + Documentos + Historial', async () => {
      const customDetalle = { id: 99, datoEspecifico: 'valor' };

      const resultado = await service.registrarSolicitudIntegral({
        tipoSolicitudSlug: TipoSolicitudSlug.ARREGLO_PAGO,
        fallbackTipoSolicitudId: 1,
        crearDetalle: jest.fn().mockResolvedValue(customDetalle),
        asignarRelacionDetalle: (solicitud, detalle) => {
          (solicitud as any).detalleCustom = detalle;
        },
        documentosReferencias: dtoArregloPago.documentos,
        descripcionHistorial: 'Registro de prueba integral',
        eventoHistorial: 'REGISTRADA',
      });

      expect(resultado).toBeDefined();
      expect((resultado as any).detalleCustom).toEqual(customDetalle);
      expect(resultado.historial).toBeDefined();
      expect(resultado.historial).toHaveLength(1);
      expect(resultado.documentos).toBeDefined();
      expect(resultado.documentos).toHaveLength(1);
    });
  });
});
