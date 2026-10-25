import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { Role } from '../../common/enums/role.enum';
import { PlazoArregloPago } from '../../common/enums/plazo-arreglo-pago.enum';
import { SolicitudEstado } from '../../common/enums/solicitud-estado.enum';
import { TipoDocumentoSolicitud } from '../../common/enums/tipo-documento-solicitud.enum';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { CalidadTitularCambioTitular } from '../../common/enums/calidad-titular-cambio-titular.enum';
import { MedioNotificacionCambioTitular } from '../../common/enums/medio-notificacion-cambio-titular.enum';
import { NaturalezaInmuebleCambioTitular } from '../../common/enums/naturaleza-inmueble-cambio-titular.enum';
import { PropositoInfraestructuraLinderosConfirmado } from '../../common/enums/proposito-infraestructura-linderos.enum';
import { TipoPersonaInfraestructuraLinderos } from '../../common/enums/tipo-persona-infraestructura-linderos.enum';
import { PropositoDisponibilidadServiciosConfirmado } from '../../common/enums/proposito-disponibilidad-servicios.enum';
import { TipoPersonaDisponibilidadServicios } from '../../common/enums/tipo-persona-disponibilidad-servicios.enum';
import { CreateSolicitudAfiliacionDto } from './dto/create-solicitud-afiliacion.dto';
import { CreateSolicitudArregloPagoDto } from './dto/create-solicitud-arreglo-pago.dto';
import { CreateSolicitudCambioTitularDto } from './dto/create-solicitud-cambio-titular.dto';
import { CreateSolicitudDisponibilidadServiciosDto } from './dto/create-solicitud-disponibilidad-servicios.dto';
import { CreateSolicitudInfraestructuraLinderosDto } from './dto/create-solicitud-infraestructura-linderos.dto';
import { CreateSolicitudConstanciaServicioDto } from './dto/create-solicitud-constancia-servicio.dto';
import { MotivoConstanciaServicio } from '../../common/enums/motivo-constancia-servicio.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DocumentoSolicitud } from './entities/documento-solicitud.entity';
import { HistorialSolicitud } from './entities/historial-solicitud.entity';
import { SolicitudAfiliacion } from './entities/solicitud-afiliacion.entity';
import { SolicitudArregloPago } from './entities/solicitud-arreglo-pago.entity';
import { SolicitudCambioTitular } from './entities/solicitud-cambio-titular.entity';
import { SolicitudDisponibilidadServicios } from './entities/solicitud-disponibilidad-servicios.entity';
import { SolicitudInfraestructuraLinderos } from './entities/solicitud-infraestructura-linderos.entity';
import { SolicitudConstanciaServicio } from './entities/solicitud-constancia-servicio.entity';
import { SolicitudServicio } from './entities/solicitud-servicio.entity';
import { Solicitud } from './entities/solicitud.entity';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';
import {
  MENSAJE_SEGUIMIENTO_NO_ENCONTRADO,
  SolicitudNoEncontradaException,
  SolicitudSeguimientoNoEncontradaException,
} from './errors/solicitud.errors';
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
  saveSolicitudDocumentPending: jest.fn((file) => {
    if (!file?.buffer?.toString()?.startsWith('%PDF-')) {
      throw new BadRequestException(
        'El contenido del archivo no coincide con su formato declarado.',
      );
    }
    const filename = `1729789123-uuid-${file.originalname}`;
    return {
      rutaReferenciaArchivo: `/uploads/solicitudes/pendientes/${filename}`,
      filename,
      absolutePath: `/tmp/${filename}`,
    };
  }),
  MAX_SOLICITUD_DOCUMENT_BYTES: 10 * 1024 * 1024,
}));

describe('SolicitudesService', () => {
  let service: SolicitudesService;
  let findServicio: jest.Mock;
  let findOneSolicitud: jest.Mock;
  let findAndCountSolicitud: jest.Mock;
  let saveSolicitud: jest.Mock;
  let createSolicitud: jest.Mock;
  let saveArregloPago: jest.Mock;
  let createArregloPago: jest.Mock;
  let findBySlugTipo: jest.Mock;
  let transactionMock: jest.Mock;
  let createCambioTitular: jest.Mock;
  let saveCambioTitular: jest.Mock;
  let createInfraestructura: jest.Mock;
  let saveInfraestructura: jest.Mock;
  let createAfiliacion: jest.Mock;
  let saveAfiliacion: jest.Mock;
  let createDisponibilidad: jest.Mock;
  let saveDisponibilidad: jest.Mock;
  let findDocumentos: jest.Mock;
  let saveDocumento: jest.Mock;
  let createDocumento: jest.Mock;
  let findHistorial: jest.Mock;
  let saveHistorial: jest.Mock;
  let createHistorial: jest.Mock;
  let createQueryBuilderGetOne: jest.Mock;

  const docsInfraReunion = [
    {
      id: 1,
      tokenReclamo: 'tok-id',
      tipoDocumento: TipoDocumentoSolicitud.IDENTIFICACION,
      rutaReferenciaArchivo: '/uploads/solicitudes/pendientes/a.pdf',
      nombreOriginal: 'cedula.pdf',
      tipoArchivo: 'application/pdf',
      tamanio: 100,
      solicitudId: null,
    },
    {
      id: 2,
      tokenReclamo: 'tok-pc',
      tipoDocumento: TipoDocumentoSolicitud.PLANO_CATASTRADO,
      rutaReferenciaArchivo: '/uploads/solicitudes/pendientes/b.pdf',
      nombreOriginal: 'plano.pdf',
      tipoArchivo: 'application/pdf',
      tamanio: 200,
      solicitudId: null,
    },
    {
      id: 3,
      tokenReclamo: 'tok-pa',
      tipoDocumento: TipoDocumentoSolicitud.PLANO_AGRIMENSURA,
      rutaReferenciaArchivo: '/uploads/solicitudes/pendientes/c.pdf',
      nombreOriginal: 'agrimensura.pdf',
      tipoArchivo: 'application/pdf',
      tamanio: 300,
      solicitudId: null,
    },
  ];

  const mockSolicitud = {
    id: 1,
    tipoSolicitudId: 1,
    tipoSolicitud: {
      id: 1,
      nombre: 'Solicitud de Arreglo de Pago Domiciliar',
      descripcion: 'Convenio de pago',
      slug: TipoSolicitudSlug.ARREGLO_PAGO,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    codigoSeguimiento: 'SOL-2026-00001',
    estado: EstadoSolicitud.PENDIENTE,
    fechaIngreso: new Date('2026-10-20T10:00:00Z'),
    createdAt: new Date('2026-10-20T10:00:00Z'),
    updatedAt: new Date('2026-10-20T10:00:00Z'),
    documentos: [],
    establecerValoresPorDefecto: jest.fn(),
  } as unknown as Solicitud;

  const pendienteServicio: SolicitudServicio = {
    idSolicitud: 1,
    nombre: 'María',
    apellidos: 'Rodríguez Mora',
    cedula: '1-2345-6789',
    telefono: '8888-1234',
    correo: 'maria.rodriguez@correo.cr',
    direccion: 'San Juan, Desamparados',
    estado: SolicitudEstado.APROBADA,
    utilizada: false,
  };

  beforeEach(async () => {
    findServicio = jest.fn();
    findOneSolicitud = jest.fn();
    findAndCountSolicitud = jest.fn();
    saveSolicitud = jest.fn();
    createSolicitud = jest.fn();
    saveArregloPago = jest.fn();
    createArregloPago = jest.fn();
    createCambioTitular = jest.fn();
    saveCambioTitular = jest.fn();
    createInfraestructura = jest.fn();
    saveInfraestructura = jest.fn();
    createAfiliacion = jest.fn();
    saveAfiliacion = jest.fn();
    createDisponibilidad = jest.fn();
    saveDisponibilidad = jest.fn();
    findDocumentos = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(docsInfraReunion.map((doc) => ({ ...doc }))),
      );
    saveDocumento = jest
      .fn()
      .mockImplementation((doc: unknown) => Promise.resolve(doc));
    createDocumento = jest.fn().mockImplementation((doc: unknown) => doc);
    findHistorial = jest.fn().mockResolvedValue([
      {
        id: 1,
        solicitudId: 1,
        estadoAnterior: null,
        estadoNuevo: EstadoSolicitud.PENDIENTE,
        observacionPublica: null,
        notaInterna: null,
        idUsuario: null,
        fecha: new Date('2026-10-20T10:00:00Z'),
      },
    ]);
    createQueryBuilderGetOne = jest.fn().mockResolvedValue(null);
    findBySlugTipo = jest.fn().mockResolvedValue(mockSolicitud.tipoSolicitud);
    findHistorial = jest.fn().mockResolvedValue([]);
    saveHistorial = jest
      .fn()
      .mockImplementation((hist: unknown) => Promise.resolve({ id: 1, ...(hist as object) }));
    createHistorial = jest
      .fn()
      .mockImplementation((hist: unknown) => ({ id: 1, ...(hist as object) }));
    transactionMock = jest.fn();

    const qbChain = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: createQueryBuilderGetOne,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudesService,
        {
          provide: getRepositoryToken(SolicitudServicio),
          useValue: {
            find: findServicio,
          },
        },
        {
          provide: getRepositoryToken(Solicitud),
          useValue: {
            findOne: findOneSolicitud,
            findAndCount: findAndCountSolicitud,
            save: saveSolicitud,
            create: createSolicitud,
            createQueryBuilder: jest.fn().mockReturnValue(qbChain),
            manager: {
              transaction: transactionMock,
            },
          },
        },
        {
          provide: getRepositoryToken(SolicitudArregloPago),
          useValue: {
            save: saveArregloPago,
            create: createArregloPago,
          },
        },
        {
          provide: getRepositoryToken(SolicitudCambioTitular),
          useValue: {
            save: saveCambioTitular,
            create: createCambioTitular,
          },
        },
        {
          provide: getRepositoryToken(SolicitudInfraestructuraLinderos),
          useValue: {
            save: saveInfraestructura,
            create: createInfraestructura,
          },
        },
        {
          provide: getRepositoryToken(SolicitudAfiliacion),
          useValue: {
            save: saveAfiliacion,
            create: createAfiliacion,
          },
        },
        {
          provide: getRepositoryToken(SolicitudDisponibilidadServicios),
          useValue: {
            save: saveDisponibilidad,
            create: createDisponibilidad,
          },
        },
        {
          provide: getRepositoryToken(DocumentoSolicitud),
          useValue: {
            find: findDocumentos,
            save: saveDocumento,
            create: createDocumento,
          },
        },
        {
          provide: getRepositoryToken(HistorialSolicitud),
          useValue: {
            find: findHistorial,
            save: saveHistorial,
            create: createHistorial,
          },
        },

        {
          provide: TiposSolicitudService,
          useValue: {
            findBySlug: findBySlugTipo,
          },
        },
      ],
    }).compile();

    service = module.get<SolicitudesService>(SolicitudesService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('findByCodigoSeguimiento', () => {
    it('debe devolver la solicitud cuando el código existe', async () => {
      findOneSolicitud.mockResolvedValue(mockSolicitud);

      const result = await service.findByCodigoSeguimiento('sol-2026-00001');

      expect(findOneSolicitud).toHaveBeenCalledWith({
        where: { codigoSeguimiento: 'SOL-2026-00001' },
        relations: { tipoSolicitud: true },
      });
      expect(result).toEqual(mockSolicitud);
    });

    it('debe lanzar SolicitudNoEncontradaException cuando el código no existe', async () => {
      findOneSolicitud.mockResolvedValue(null);

      await expect(
        service.findByCodigoSeguimiento('CODIGO-INEXISTENTE'),
      ).rejects.toThrow(SolicitudNoEncontradaException);
    });
  });

  describe('consultarSeguimientoPublico', () => {
    const dtoOk = {
      codigo: 'SOL-2026-00001',
      identificacion: '1-1234-0567',
    };

    it('código inexistente → error genérico (sin revelar existencia)', async () => {
      createQueryBuilderGetOne.mockResolvedValue(null);

      await expect(service.consultarSeguimientoPublico(dtoOk)).rejects.toThrow(
        SolicitudSeguimientoNoEncontradaException,
      );
      await expect(service.consultarSeguimientoPublico(dtoOk)).rejects.toThrow(
        MENSAJE_SEGUIMIENTO_NO_ENCONTRADO,
      );
    });

    it('código existente + identificación incorrecta → mismo error genérico', async () => {
      createQueryBuilderGetOne.mockResolvedValue(null);

      try {
        await service.consultarSeguimientoPublico({
          codigo: 'SOL-2026-00001',
          identificacion: '9-9999-9999',
        });
        fail('debió fallar');
      } catch (error) {
        expect(error).toBeInstanceOf(SolicitudSeguimientoNoEncontradaException);
        expect((error as Error).message).toBe(
          MENSAJE_SEGUIMIENTO_NO_ENCONTRADO,
        );
      }
    });

    it('combinación correcta → DTO público sin notaInterna/usuario/documentos/id', async () => {
      createQueryBuilderGetOne.mockResolvedValue(mockSolicitud);
      findHistorial.mockResolvedValue([
        {
          fecha: new Date('2026-10-19T10:00:00Z'),
          estadoAnterior: null,
          estadoNuevo: EstadoSolicitud.PENDIENTE,
          observacionPublica: null,
          notaInterna: null,
          idUsuario: null,
        },
        {
          fecha: new Date('2026-10-21T12:00:00Z'),
          estadoAnterior: EstadoSolicitud.PENDIENTE,
          estadoNuevo: EstadoSolicitud.EN_REVISION,
          observacionPublica: 'Su solicitud está en revisión.',
          notaInterna: 'Dato interno confidencial',
          idUsuario: 7,
          usuario: { idUsuario: 7, nombre: 'María Admin', email: 'a@b.cr' },
        },
      ]);

      const result = await service.consultarSeguimientoPublico(dtoOk);
      const serialized = JSON.stringify(result);

      expect(result.codigoSeguimiento).toBe('SOL-2026-00001');
      expect(result.estado).toBe(EstadoSolicitud.PENDIENTE);
      expect(result.fechaIngreso).toEqual(mockSolicitud.fechaIngreso);
      expect(result.tipoSolicitud).toEqual({
        nombre: 'Solicitud de Arreglo de Pago Domiciliar',
        slug: TipoSolicitudSlug.ARREGLO_PAGO,
      });
      expect(result.historial).toHaveLength(2);
      expect(result.historial[0].estadoAnterior).toBeNull();
      expect(result.historial[1].observacionPublica).toBe(
        'Su solicitud está en revisión.',
      );

      expect(serialized).not.toContain('Dato interno confidencial');
      expect(serialized).not.toContain('notaInterna');
      expect(serialized).not.toContain('idUsuario');
      expect(serialized).not.toContain('María Admin');
      expect(serialized).not.toContain('a@b.cr');
      expect(serialized).not.toContain('1-1234-0567');
      expect(serialized).not.toMatch(/"id"\s*:/);
      expect(findHistorial).toHaveBeenCalledWith({
        where: { solicitudId: 1 },
        order: { fecha: 'ASC', id: 'ASC' },
        select: {
          fecha: true,
          estadoAnterior: true,
          estadoNuevo: true,
          observacionPublica: true,
        },
      });
    });

    it('error de query → respuesta genérica (no filtra detalle interno)', async () => {
      createQueryBuilderGetOne.mockRejectedValue(new Error('SQL explosion'));

      await expect(service.consultarSeguimientoPublico(dtoOk)).rejects.toThrow(
        SolicitudSeguimientoNoEncontradaException,
      );
    });

    it('sin historial → estado actual y historial vacío', async () => {
      createQueryBuilderGetOne.mockResolvedValue(mockSolicitud);
      findHistorial.mockResolvedValue([]);

      const result = await service.consultarSeguimientoPublico(dtoOk);
      expect(result.estado).toBe(EstadoSolicitud.PENDIENTE);
      expect(result.historial).toEqual([]);
    });
  });

  describe('findById', () => {
    it('debe devolver la solicitud cuando el ID existe', async () => {
      findOneSolicitud.mockResolvedValue(mockSolicitud);

      const result = await service.findById(1);

      expect(findOneSolicitud).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { tipoSolicitud: true },
      });
      expect(result).toEqual(mockSolicitud);
    });

    it('debe lanzar SolicitudNoEncontradaException cuando el ID no existe', async () => {
      findOneSolicitud.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(
        SolicitudNoEncontradaException,
      );
    });
  });

  describe('findAll', () => {
    it('debe listar solicitudes con filtros y paginación', async () => {
      findAndCountSolicitud.mockResolvedValue([[mockSolicitud], 1]);

      const result = await service.findAll({
        estado: EstadoSolicitud.PENDIENTE,
        page: 1,
        limit: 10,
      });

      expect(findAndCountSolicitud).toHaveBeenCalledWith({
        where: { estado: EstadoSolicitud.PENDIENTE },
        relations: { tipoSolicitud: true },
        order: { fechaIngreso: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result.solicitudes).toEqual([mockSolicitud]);
      expect(result.total).toBe(1);
    });
  });

  describe('crearSolicitudArregloPago', () => {
    const dtoValido: CreateSolicitudArregloPagoDto = {
      nombre: 'Carlos Jiménez Mora',
      cedula: '1-0987-0654',
      vecinoDe: 'San Juan de Desamparados',
      telefono: '8877-6655',
      numeroCuentaServicio: 'CTA-99881',
      montoPrimaInicial: 35000,
      plazoSeleccionado: PlazoArregloPago.MESES_6,
      firma: 'data:image/png;base64,AAA...',
    };

    it('debe registrar exitosamente la Solicitud y su detalle SolicitudArregloPago', async () => {
      const mockCreatedSol = {
        id: 77,
        tipoSolicitudId: 1,
        codigoSeguimiento: 'SOL-2026-00001',
        estado: EstadoSolicitud.PENDIENTE,
        fechaIngreso: new Date(),
      };
      createSolicitud.mockReturnValue(mockCreatedSol);
      saveSolicitud.mockResolvedValue(mockCreatedSol);

      const mockCreatedDetalle = {
        id: 12,
        solicitudId: 77,
        ...dtoValido,
      };
      createArregloPago.mockReturnValue(mockCreatedDetalle);
      saveArregloPago.mockResolvedValue(mockCreatedDetalle);

      const resultado = await service.crearSolicitudArregloPago(dtoValido);

      expect(findBySlugTipo).toHaveBeenCalledWith(
        TipoSolicitudSlug.ARREGLO_PAGO,
      );
      expect(createSolicitud).toHaveBeenCalled();
      expect(saveSolicitud).toHaveBeenCalled();
      expect(createArregloPago).toHaveBeenCalledWith(
        expect.objectContaining({
          solicitudId: 77,
          nombre: 'Carlos Jiménez Mora',
          cedula: '1-0987-0654',
          numeroCuentaServicio: 'CTA-99881',
          montoPrimaInicial: 35000,
          plazoSeleccionado: PlazoArregloPago.MESES_6,
        }),
      );
      expect(saveArregloPago).toHaveBeenCalled();
      expect(resultado.detalleArregloPago).toEqual(mockCreatedDetalle);
      expect(resultado.codigoSeguimiento).toBeDefined();
    });

    it('debe rechazar con BadRequestException si el plazo seleccionado no es válido', async () => {
      const dtoInvalido = {
        ...dtoValido,
        // valor intencional fuera del enum oficial
        plazoSeleccionado: '60 meses' as unknown as PlazoArregloPago,
      };

      await expect(
        service.crearSolicitudArregloPago(dtoInvalido),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar con BadRequestException si la prima inicial es negativa', async () => {
      const dtoNegativo = {
        ...dtoValido,
        montoPrimaInicial: -1000,
      };

      await expect(
        service.crearSolicitudArregloPago(dtoNegativo),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('crearSolicitudCambioTitular', () => {
    /* Mocks de EntityManager/transaction usan any de forma controlada. */
    /* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
    const tipoCambio = {
      id: 2,
      nombre: 'Cambio de Nombre del Titular del Servicio',
      descripcion: 'Traspaso',
      slug: TipoSolicitudSlug.CAMBIO_TITULAR,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const dtoValido: CreateSolicitudCambioTitularDto = {
      nombreSolicitante: 'Ana Lucía Vargas Quirós',
      identificacionSolicitante: '1-1234-0567',
      telefono: '8888-1234',
      nombrePropietarioRegistral: 'Carlos Alberto Mora Jiménez',
      identificacionPropietario: '1-0987-6543',
      folioReal: '123456-000',
      planoCatastrado: 'SJ-1',
      naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
      calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
      nis: 'NIS-45892',
      facturaANombreDe: 'Carlos Alberto Mora Jiménez',
      medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
      medioNotificacionSecundario: MedioNotificacionCambioTitular.TELEFONO,
      firma: 'data:image/png;base64,AAA',
    };

    it('debe crear Solicitud + detalle en transacción y relacionarlos', async () => {
      findBySlugTipo.mockResolvedValue(tipoCambio);

      const mockCreatedSol = {
        id: 90,
        tipoSolicitudId: 2,
        codigoSeguimiento: 'SOL-2026-00090',
        estado: EstadoSolicitud.PENDIENTE,
        fechaIngreso: new Date(),
      };
      const mockCreatedDetalle = {
        id: 33,
        solicitudId: 90,
        ...dtoValido,
      };

      createSolicitud.mockReturnValue(mockCreatedSol);
      saveSolicitud.mockResolvedValue(mockCreatedSol);
      createCambioTitular.mockReturnValue(mockCreatedDetalle);
      saveCambioTitular.mockResolvedValue(mockCreatedDetalle);

      transactionMock.mockImplementation(async (work) => {
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === Solicitud) {
              return {
                create: createSolicitud,
                save: saveSolicitud,
              };
            }
            if (entity === SolicitudCambioTitular) {
              return {
                create: createCambioTitular,
                save: saveCambioTitular,
              };
            }
            throw new Error('Repo inesperado');
          },
        };
        return work(manager);
      });

      const resultado = await service.crearSolicitudCambioTitular(dtoValido);

      expect(findBySlugTipo).toHaveBeenCalledWith(
        TipoSolicitudSlug.CAMBIO_TITULAR,
      );
      expect(transactionMock).toHaveBeenCalled();
      expect(createCambioTitular).toHaveBeenCalledWith(
        expect.objectContaining({
          solicitudId: 90,
          nombreSolicitante: 'Ana Lucía Vargas Quirós',
          nis: 'NIS-45892',
          naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
          calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
        }),
      );
      expect(resultado.detalleCambioTitular).toEqual(mockCreatedDetalle);
      expect(resultado.estado).toBe(EstadoSolicitud.PENDIENTE);
      expect(resultado.tipoSolicitud?.slug).toBe(
        TipoSolicitudSlug.CAMBIO_TITULAR,
      );
    });

    it('debe hacer rollback si falla el detalle (transacción)', async () => {
      findBySlugTipo.mockResolvedValue(tipoCambio);
      createSolicitud.mockReturnValue({ id: 91 });
      saveSolicitud.mockResolvedValue({ id: 91 });
      createCambioTitular.mockReturnValue({});
      saveCambioTitular.mockRejectedValue(new Error('fallo detalle'));

      transactionMock.mockImplementation(async (work) => {
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === Solicitud) {
              return { create: createSolicitud, save: saveSolicitud };
            }
            if (entity === SolicitudCambioTitular) {
              return { create: createCambioTitular, save: saveCambioTitular };
            }
            throw new Error('Repo inesperado');
          },
        };
        return work(manager);
      });

      await expect(
        service.crearSolicitudCambioTitular(dtoValido),
      ).rejects.toThrow('fallo detalle');
    });

    it('no toma estado ni solicitudId desde el DTO (mass assignment)', async () => {
      findBySlugTipo.mockResolvedValue(tipoCambio);
      const dtoConAdmin = {
        ...dtoValido,
      } as CreateSolicitudCambioTitularDto & {
        estado?: string;
        solicitudId?: number;
      };
      dtoConAdmin.estado = EstadoSolicitud.APROBADA;
      dtoConAdmin.solicitudId = 999;

      createSolicitud.mockImplementation((data) => data);
      saveSolicitud.mockImplementation(async (data) => ({ ...data, id: 92 }));
      createCambioTitular.mockImplementation((data) => data);
      saveCambioTitular.mockImplementation(async (data) => ({
        ...data,
        id: 34,
      }));

      transactionMock.mockImplementation(async (work) => {
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === Solicitud) {
              return { create: createSolicitud, save: saveSolicitud };
            }
            if (entity === SolicitudCambioTitular) {
              return { create: createCambioTitular, save: saveCambioTitular };
            }
            throw new Error('Repo inesperado');
          },
        };
        return work(manager);
      });

      const resultado = await service.crearSolicitudCambioTitular(dtoConAdmin);

      expect(createSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: EstadoSolicitud.PENDIENTE,
        }),
      );
      expect(createSolicitud.mock.calls[0][0].estado).not.toBe(
        EstadoSolicitud.APROBADA,
      );
      expect(createCambioTitular).toHaveBeenCalledWith(
        expect.objectContaining({ solicitudId: 92 }),
      );
      expect(createCambioTitular.mock.calls[0][0].solicitudId).not.toBe(999);
      expect(resultado.estado).toBe(EstadoSolicitud.PENDIENTE);
    });
    /* eslint-enable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
  });

  describe('crearSolicitudInfraestructuraLinderos', () => {
    /* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
    const tipoInfra = {
      id: 3,
      nombre: 'Constancia de Infraestructura Frente a Linderos de un Inmueble',
      descripcion: 'Constancia',
      slug: TipoSolicitudSlug.INFRAESTRUCTURA_LINDEROS,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const dtoFisica: CreateSolicitudInfraestructuraLinderosDto = {
      nis: 'NIS-77881',
      tipoPersona: TipoPersonaInfraestructuraLinderos.FISICA,
      nombreFisica: 'María Elena',
      apellidosFisica: 'Rodríguez Vargas',
      identificacionFisica: '1-1234-0567',
      telefonoFisica: '8888-1234',
      calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
      provincia: 'San José',
      canton: 'Pérez Zeledón',
      distrito: 'San Isidro de El General',
      direccionExacta: '100 m norte',
      planoCatastrado: 'SJ-1',
      planoAgrimensura: 'AG-1',
      proposito: PropositoInfraestructuraLinderosConfirmado.REUNION_FINCAS,
      medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
      valorNotificacionPrincipal: 'maria@ejemplo.com',
      firma: 'data:image/png;base64,AAA',
      documentos: [
        { id: 1, tokenReclamo: 'tok-id' },
        { id: 2, tokenReclamo: 'tok-pc' },
        { id: 3, tokenReclamo: 'tok-pa' },
      ],
    };

    const mockTransaction = () => {
      transactionMock.mockImplementation(async (work) => {
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === Solicitud) {
              return { create: createSolicitud, save: saveSolicitud };
            }
            if (entity === SolicitudInfraestructuraLinderos) {
              return {
                create: createInfraestructura,
                save: saveInfraestructura,
              };
            }
            if (entity === DocumentoSolicitud) {
              return { create: createDocumento, save: saveDocumento };
            }
            throw new Error('Repo inesperado');
          },
        };
        return work(manager);
      });
    };

    it('debe crear Solicitud + detalle en transacción', async () => {
      findBySlugTipo.mockResolvedValue(tipoInfra);
      const mockCreatedSol = {
        id: 110,
        tipoSolicitudId: 3,
        codigoSeguimiento: 'SOL-2026-00110',
        estado: EstadoSolicitud.PENDIENTE,
        fechaIngreso: new Date(),
      };
      const mockCreatedDetalle = {
        id: 44,
        solicitudId: 110,
        ...dtoFisica,
      };

      createSolicitud.mockReturnValue(mockCreatedSol);
      saveSolicitud.mockResolvedValue(mockCreatedSol);
      createInfraestructura.mockReturnValue(mockCreatedDetalle);
      saveInfraestructura.mockResolvedValue(mockCreatedDetalle);
      mockTransaction();

      const resultado =
        await service.crearSolicitudInfraestructuraLinderos(dtoFisica);

      expect(findBySlugTipo).toHaveBeenCalledWith(
        TipoSolicitudSlug.INFRAESTRUCTURA_LINDEROS,
      );
      expect(transactionMock).toHaveBeenCalled();
      expect(createInfraestructura).toHaveBeenCalledWith(
        expect.objectContaining({
          solicitudId: 110,
          nis: 'NIS-77881',
          tipoPersona: TipoPersonaInfraestructuraLinderos.FISICA,
          proposito: PropositoInfraestructuraLinderosConfirmado.REUNION_FINCAS,
          planoAgrimensura: 'AG-1',
        }),
      );
      expect(resultado.detalleInfraestructuraLinderos).toEqual(
        mockCreatedDetalle,
      );
      expect(resultado.estado).toBe(EstadoSolicitud.PENDIENTE);
    });

    it('debe hacer rollback si falla el detalle', async () => {
      findBySlugTipo.mockResolvedValue(tipoInfra);
      createSolicitud.mockReturnValue({ id: 111 });
      saveSolicitud.mockResolvedValue({ id: 111 });
      createInfraestructura.mockReturnValue({});
      saveInfraestructura.mockRejectedValue(new Error('fallo detalle infra'));
      mockTransaction();

      await expect(
        service.crearSolicitudInfraestructuraLinderos(dtoFisica),
      ).rejects.toThrow('fallo detalle infra');
    });

    it('no toma estado ni solicitudId desde el DTO', async () => {
      findBySlugTipo.mockResolvedValue(tipoInfra);
      const dtoConAdmin = {
        ...dtoFisica,
      } as CreateSolicitudInfraestructuraLinderosDto & {
        estado?: string;
        solicitudId?: number;
      };
      dtoConAdmin.estado = EstadoSolicitud.APROBADA;
      dtoConAdmin.solicitudId = 999;

      createSolicitud.mockImplementation((data) => data);
      saveSolicitud.mockImplementation(async (data) => ({ ...data, id: 112 }));
      createInfraestructura.mockImplementation((data) => data);
      saveInfraestructura.mockImplementation(async (data) => ({
        ...data,
        id: 45,
      }));
      mockTransaction();

      const resultado =
        await service.crearSolicitudInfraestructuraLinderos(dtoConAdmin);

      expect(createSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({ estado: EstadoSolicitud.PENDIENTE }),
      );
      expect(createSolicitud.mock.calls[0][0].estado).not.toBe(
        EstadoSolicitud.APROBADA,
      );
      expect(createInfraestructura.mock.calls[0][0].solicitudId).toBe(112);
      expect(createInfraestructura.mock.calls[0][0].solicitudId).not.toBe(999);
      expect(resultado.estado).toBe(EstadoSolicitud.PENDIENTE);
    });

    it('rechaza correo inválido en valor de notificación', async () => {
      await expect(
        service.crearSolicitudInfraestructuraLinderos({
          ...dtoFisica,
          valorNotificacionPrincipal: 'no-es-correo',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('rechaza Reunión de fincas sin planoAgrimensura (service)', async () => {
      await expect(
        service.crearSolicitudInfraestructuraLinderos({
          ...dtoFisica,
          planoAgrimensura: undefined,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('INFRA-QA-001 — rechaza documento inexistente o token inválido', async () => {
      findDocumentos.mockResolvedValueOnce([]);
      await expect(
        service.crearSolicitudInfraestructuraLinderos(dtoFisica),
      ).rejects.toThrow(BadRequestException);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('INFRA-QA-001 — rechaza si falta tipo documental obligatorio', async () => {
      findDocumentos.mockResolvedValueOnce(
        docsInfraReunion
          .filter(
            (d) => d.tipoDocumento !== TipoDocumentoSolicitud.IDENTIFICACION,
          )
          .map((doc) => ({ ...doc })),
      );
      await expect(
        service.crearSolicitudInfraestructuraLinderos({
          ...dtoFisica,
          documentos: [
            { id: 2, tokenReclamo: 'tok-pc' },
            { id: 3, tokenReclamo: 'tok-pa' },
          ],
        }),
      ).rejects.toThrow(/identificacion/i);
      expect(transactionMock).not.toHaveBeenCalled();
    });
    /* eslint-enable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
  });

  describe('crearSolicitudDisponibilidadServicios', () => {
    /* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
    const tipoDisp = {
      id: 5,
      nombre: 'Constancia de Disponibilidad de Servicios',
      descripcion: 'Disponibilidad',
      slug: TipoSolicitudSlug.DISPONIBILIDAD_SERVICIOS,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docsDisp = [docsInfraReunion[0], docsInfraReunion[1]];

    const dtoFisica: CreateSolicitudDisponibilidadServiciosDto = {
      tipoPersona: TipoPersonaDisponibilidadServicios.FISICA,
      nombreFisica: 'María Elena',
      primerApellidoFisica: 'Rodríguez',
      segundoApellidoFisica: 'Vargas',
      identificacionFisica: '1-1234-0567',
      telefonoFisica: '8888-1234',
      medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
      valorNotificacionPrincipal: 'maria@ejemplo.com',
      provincia: 'San José',
      canton: 'Pérez Zeledón',
      distrito: 'San Isidro',
      direccionExacta: '100 m norte',
      planoCatastrado: 'SJ-1',
      naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
      calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
      proposito: PropositoDisponibilidadServiciosConfirmado.FRACCIONAMIENTO,
      descripcionProyecto: 'Construcción de 4 unidades',
      cantidadDormitorios: 3,
      areaConstruccion: 185.5,
      caudalRequerido: 0.75,
      autorizacionInspeccion: true,
      documentos: [
        { id: 1, tokenReclamo: 'tok-id' },
        { id: 2, tokenReclamo: 'tok-pc' },
      ],
    };

    const mockTransactionDisp = () => {
      transactionMock.mockImplementation(async (work) => {
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === Solicitud) {
              return { create: createSolicitud, save: saveSolicitud };
            }
            if (entity === SolicitudDisponibilidadServicios) {
              return {
                create: createDisponibilidad,
                save: saveDisponibilidad,
              };
            }
            if (entity === DocumentoSolicitud) {
              return { create: createDocumento, save: saveDocumento };
            }
            throw new Error('Repo inesperado');
          },
        };
        return work(manager);
      });
    };

    beforeEach(() => {
      findDocumentos.mockImplementation(() =>
        Promise.resolve(docsDisp.map((doc) => ({ ...doc }))),
      );
    });

    it('debe crear Solicitud + detalle + documentos en transacción', async () => {
      findBySlugTipo.mockResolvedValue(tipoDisp);
      const mockCreatedSol = {
        id: 210,
        tipoSolicitudId: 5,
        codigoSeguimiento: 'SOL-2026-00210',
        estado: EstadoSolicitud.PENDIENTE,
        fechaIngreso: new Date(),
      };
      const mockCreatedDetalle = {
        id: 88,
        solicitudId: 210,
        proposito: dtoFisica.proposito,
        descripcionProyecto: dtoFisica.descripcionProyecto,
      };

      createSolicitud.mockReturnValue(mockCreatedSol);
      saveSolicitud.mockResolvedValue(mockCreatedSol);
      createDisponibilidad.mockReturnValue(mockCreatedDetalle);
      saveDisponibilidad.mockResolvedValue(mockCreatedDetalle);
      mockTransactionDisp();

      const resultado =
        await service.crearSolicitudDisponibilidadServicios(dtoFisica);

      expect(findBySlugTipo).toHaveBeenCalledWith(
        TipoSolicitudSlug.DISPONIBILIDAD_SERVICIOS,
      );
      expect(transactionMock).toHaveBeenCalled();
      expect(createDisponibilidad).toHaveBeenCalledWith(
        expect.objectContaining({
          solicitudId: 210,
          tipoPersona: TipoPersonaDisponibilidadServicios.FISICA,
          proposito: PropositoDisponibilidadServiciosConfirmado.FRACCIONAMIENTO,
          descripcionProyecto: 'Construcción de 4 unidades',
          areaConstruccion: 185.5,
          caudalRequerido: 0.75,
          autorizacionInspeccion: true,
        }),
      );
      expect(resultado.detalleDisponibilidadServicios).toEqual(
        mockCreatedDetalle,
      );
      expect(resultado.estado).toBe(EstadoSolicitud.PENDIENTE);
    });

    it('debe hacer rollback si falla el detalle', async () => {
      findBySlugTipo.mockResolvedValue(tipoDisp);
      createSolicitud.mockReturnValue({ id: 211 });
      saveSolicitud.mockResolvedValue({ id: 211 });
      createDisponibilidad.mockReturnValue({});
      saveDisponibilidad.mockRejectedValue(
        new Error('fallo detalle disponibilidad'),
      );
      mockTransactionDisp();

      await expect(
        service.crearSolicitudDisponibilidadServicios(dtoFisica),
      ).rejects.toThrow('fallo detalle disponibilidad');
    });

    it('rechaza descripción vacía antes de persistir', async () => {
      await expect(
        service.crearSolicitudDisponibilidadServicios({
          ...dtoFisica,
          descripcionProyecto: '   ',
        }),
      ).rejects.toThrow(/descripción del proyecto/i);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('rechaza sin plano textual (catastrado ni agrimensura)', async () => {
      await expect(
        service.crearSolicitudDisponibilidadServicios({
          ...dtoFisica,
          planoCatastrado: undefined,
          planoAgrimensura: undefined,
        }),
      ).rejects.toThrow(/plano catastrado o plano de agrimensura/i);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('rechaza documento faltante (identificación)', async () => {
      findDocumentos.mockResolvedValueOnce(
        docsDisp
          .filter(
            (d) => d.tipoDocumento !== TipoDocumentoSolicitud.IDENTIFICACION,
          )
          .map((doc) => ({ ...doc })),
      );
      await expect(
        service.crearSolicitudDisponibilidadServicios({
          ...dtoFisica,
          documentos: [{ id: 2, tokenReclamo: 'tok-pc' }],
        }),
      ).rejects.toThrow(/identificacion/i);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('exige poder cuando calidad es Representante legal', async () => {
      await expect(
        service.crearSolicitudDisponibilidadServicios({
          ...dtoFisica,
          calidadTitular: CalidadTitularCambioTitular.REPRESENTANTE_LEGAL,
        }),
      ).rejects.toThrow(/poder/i);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('no toma estado ni solicitudId desde el DTO', async () => {
      findBySlugTipo.mockResolvedValue(tipoDisp);
      const dtoConAdmin = {
        ...dtoFisica,
      } as CreateSolicitudDisponibilidadServiciosDto & {
        estado?: string;
        solicitudId?: number;
      };
      dtoConAdmin.estado = EstadoSolicitud.APROBADA;
      dtoConAdmin.solicitudId = 999;

      createSolicitud.mockImplementation((data) => data);
      saveSolicitud.mockImplementation(async (data) => ({ ...data, id: 212 }));
      createDisponibilidad.mockImplementation((data) => data);
      saveDisponibilidad.mockImplementation(async (data) => ({
        ...data,
        id: 89,
      }));
      mockTransactionDisp();

      const resultado =
        await service.crearSolicitudDisponibilidadServicios(dtoConAdmin);

      expect(createSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({ estado: EstadoSolicitud.PENDIENTE }),
      );
      expect(createDisponibilidad.mock.calls[0][0].solicitudId).toBe(212);
      expect(createDisponibilidad.mock.calls[0][0].solicitudId).not.toBe(999);
      expect(resultado.estado).toBe(EstadoSolicitud.PENDIENTE);
    });

    it('persiste campos de proyecto condicionales como NULL cuando no vienen', async () => {
      findBySlugTipo.mockResolvedValue(tipoDisp);
      const sinProyectoExtra = { ...dtoFisica };
      delete (sinProyectoExtra as { cantidadDormitorios?: number })
        .cantidadDormitorios;
      delete (sinProyectoExtra as { areaConstruccion?: number })
        .areaConstruccion;
      delete (sinProyectoExtra as { caudalRequerido?: number }).caudalRequerido;

      createSolicitud.mockReturnValue({ id: 213 });
      saveSolicitud.mockResolvedValue({ id: 213 });
      createDisponibilidad.mockImplementation((data) => data);
      saveDisponibilidad.mockImplementation(async (data) => ({
        ...data,
        id: 90,
      }));
      mockTransactionDisp();

      await service.crearSolicitudDisponibilidadServicios(sinProyectoExtra);

      expect(createDisponibilidad).toHaveBeenCalledWith(
        expect.objectContaining({
          cantidadDormitorios: null,
          areaConstruccion: null,
          caudalRequerido: null,
          numeroDisponibilidadAnterior: null,
          nis: null,
        }),
      );
    });
    /* eslint-enable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
  });

  describe('crearSolicitudAfiliacion', () => {
    /* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
    const tipoAfiliacion = {
      id: 4,
      nombre: 'Solicitud de Afiliación',
      descripcion: 'Afiliación',
      slug: TipoSolicitudSlug.AFILIACION,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const dtoValido: CreateSolicitudAfiliacionDto = {
      fechaSolicitud: '2026-10-23',
      nombre: 'María Elena Rodríguez Vargas',
      identificacion: '01-0234-0567',
      vecinoDe: 'San Juan, 200 m norte',
      estadoCivil: 'Casado(a)',
      telefono: '8888-1234',
      correoElectronico: 'maria@ejemplo.com',
      numeroAbonado: '0045892',
      numeroPlano: 'SJ-1234567-2020',
      folioReal: '123456-000',
      firmaSolicitante: 'data:image/png;base64,sol',
      recomendacion1Nombre: 'Carlos Alberto Mora Chaves',
      recomendacion1Identificacion: '1-0987-6543',
      recomendacion1NumeroAbonado: '12045',
      recomendacion1Firma: 'data:image/png;base64,rec1',
      recomendacion2Nombre: 'Ana Lucía Vargas Quirós',
      recomendacion2Identificacion: '1-2345-6789',
      recomendacion2NumeroAbonado: '13088',
      recomendacion2Firma: 'data:image/png;base64,rec2',
    };

    const mockTransaction = () => {
      transactionMock.mockImplementation(async (work) => {
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === Solicitud) {
              return { create: createSolicitud, save: saveSolicitud };
            }
            if (entity === SolicitudAfiliacion) {
              return { create: createAfiliacion, save: saveAfiliacion };
            }
            throw new Error('Repo inesperado');
          },
        };
        return work(manager);
      });
    };

    it('debe crear Solicitud + detalle con ambas recomendaciones en transacción', async () => {
      findBySlugTipo.mockResolvedValue(tipoAfiliacion);
      const mockCreatedSol = {
        id: 120,
        tipoSolicitudId: 4,
        codigoSeguimiento: 'SOL-2026-00120',
        estado: EstadoSolicitud.PENDIENTE,
        fechaIngreso: new Date(),
      };
      const mockCreatedDetalle = {
        id: 50,
        solicitudId: 120,
        ...dtoValido,
      };

      createSolicitud.mockReturnValue(mockCreatedSol);
      saveSolicitud.mockResolvedValue(mockCreatedSol);
      createAfiliacion.mockReturnValue(mockCreatedDetalle);
      saveAfiliacion.mockResolvedValue(mockCreatedDetalle);
      mockTransaction();

      const resultado = await service.crearSolicitudAfiliacion(dtoValido);

      expect(findBySlugTipo).toHaveBeenCalledWith(TipoSolicitudSlug.AFILIACION);
      expect(transactionMock).toHaveBeenCalled();
      expect(createAfiliacion).toHaveBeenCalledWith(
        expect.objectContaining({
          solicitudId: 120,
          nombre: dtoValido.nombre,
          numeroAbonado: '0045892',
          recomendacion1Nombre: dtoValido.recomendacion1Nombre,
          recomendacion2Nombre: dtoValido.recomendacion2Nombre,
          recomendacion1NumeroAbonado: '12045',
          recomendacion2NumeroAbonado: '13088',
        }),
      );
      expect(createAfiliacion.mock.calls[0][0]).not.toHaveProperty('estado');
      expect(createAfiliacion.mock.calls[0][0]).not.toHaveProperty(
        'fechaSesion',
      );
      expect(resultado.detalleAfiliacion).toEqual(mockCreatedDetalle);
      expect(resultado.estado).toBe(EstadoSolicitud.PENDIENTE);
    });

    it('debe hacer rollback si falla el detalle (recomendaciones incluidas)', async () => {
      findBySlugTipo.mockResolvedValue(tipoAfiliacion);
      createSolicitud.mockReturnValue({ id: 121 });
      saveSolicitud.mockResolvedValue({ id: 121 });
      createAfiliacion.mockReturnValue({});
      saveAfiliacion.mockRejectedValue(new Error('fallo detalle afiliacion'));
      mockTransaction();

      await expect(service.crearSolicitudAfiliacion(dtoValido)).rejects.toThrow(
        'fallo detalle afiliacion',
      );
    });

    it('no toma estado ni solicitudId ni campos Junta desde el DTO', async () => {
      findBySlugTipo.mockResolvedValue(tipoAfiliacion);
      const dtoConAdmin = {
        ...dtoValido,
      } as CreateSolicitudAfiliacionDto & {
        estado?: string;
        solicitudId?: number;
        fechaSesion?: string;
        numeroAcuerdo?: string;
      };
      dtoConAdmin.estado = EstadoSolicitud.APROBADA;
      dtoConAdmin.solicitudId = 999;
      dtoConAdmin.fechaSesion = '2026-11-01';
      dtoConAdmin.numeroAcuerdo = 'JD-01';

      createSolicitud.mockImplementation((data) => data);
      saveSolicitud.mockImplementation(async (data) => ({ ...data, id: 122 }));
      createAfiliacion.mockImplementation((data) => data);
      saveAfiliacion.mockImplementation(async (data) => ({
        ...data,
        id: 51,
      }));
      mockTransaction();

      const resultado = await service.crearSolicitudAfiliacion(dtoConAdmin);

      expect(createSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({ estado: EstadoSolicitud.PENDIENTE }),
      );
      expect(createSolicitud.mock.calls[0][0].estado).not.toBe(
        EstadoSolicitud.APROBADA,
      );
      expect(createAfiliacion.mock.calls[0][0].solicitudId).toBe(122);
      expect(createAfiliacion.mock.calls[0][0].solicitudId).not.toBe(999);
      expect(createAfiliacion.mock.calls[0][0].fechaSesion).toBeUndefined();
      expect(createAfiliacion.mock.calls[0][0].numeroAcuerdo).toBeUndefined();
      expect(resultado.estado).toBe(EstadoSolicitud.PENDIENTE);
    });

    it('persiste firmas nulas cuando se omiten', async () => {
      findBySlugTipo.mockResolvedValue(tipoAfiliacion);
      const sinFirmas: CreateSolicitudAfiliacionDto = {
        ...dtoValido,
        firmaSolicitante: undefined,
        recomendacion1Firma: undefined,
        recomendacion2Firma: undefined,
        folioReal: undefined,
      };

      createSolicitud.mockReturnValue({ id: 123 });
      saveSolicitud.mockResolvedValue({ id: 123 });
      createAfiliacion.mockImplementation((data) => data);
      saveAfiliacion.mockImplementation(async (data) => data);
      mockTransaction();

      await service.crearSolicitudAfiliacion(sinFirmas);

      expect(createAfiliacion).toHaveBeenCalledWith(
        expect.objectContaining({
          firmaSolicitante: null,
          recomendacion1Firma: null,
          recomendacion2Firma: null,
          folioReal: null,
        }),
      );
    });
    /* eslint-enable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
  });

  describe('crearSolicitudConstanciaServicio y validarConstanciaServicio', () => {
    const dtoConstanciaBase: CreateSolicitudConstanciaServicioDto = {
      tipoServicio: 'Domiciliar',
      nis: 'NIS-45892',
      propietarioInmueble: 'María Elena Rodríguez Vargas',
      nombreSolicitante: 'Carlos Alberto Mora Jiménez',
      identificacionSolicitante: '1-1234-0567',
      correoElectronico: 'carlos.mora@ejemplo.com',
      telefono: '8888-1234',
      folioReal: '123456-000',
      planoCatastrado: 'SJ-1234567-2020',
      planoAgrimensura: 'AG-998877-2019',
      naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
      calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
      provincia: 'San José',
      canton: 'Pérez Zeledón',
      distrito: 'San Isidro de El General',
      direccionExacta: '100 m norte de la iglesia',
      motivo: MotivoConstanciaServicio.BONO_VIVIENDA,
      tramitePorRealizar: 'Solicitud bono BANHVI',
      medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
      medioNotificacionSecundario: MedioNotificacionCambioTitular.TELEFONO,
      firma: 'data:image/png;base64,sample',
    };

    it('1. Valida y acepta motivos oficiales estándar', () => {
      expect(() =>
        service.validarConstanciaServicio(dtoConstanciaBase),
      ).not.toThrow();

      const conBanco = {
        ...dtoConstanciaBase,
        motivo: MotivoConstanciaServicio.TRAMITE_BANCARIO,
      };
      expect(() => service.validarConstanciaServicio(conBanco)).not.toThrow();
    });

    it('2. Exige descripción en otroMotivo cuando se utiliza la opción Otro', () => {
      const conOtroSinDetalle = {
        ...dtoConstanciaBase,
        motivo: MotivoConstanciaServicio.OTRO,
        otroMotivo: undefined,
      };
      expect(() =>
        service.validarConstanciaServicio(conOtroSinDetalle),
      ).toThrow(BadRequestException);
      expect(() =>
        service.validarConstanciaServicio(conOtroSinDetalle),
      ).toThrow(
        'Debe especificar el motivo en otroMotivo cuando selecciona la opción "Otro".',
      );

      const conOtroEspacios = {
        ...dtoConstanciaBase,
        motivo: MotivoConstanciaServicio.OTRO,
        otroMotivo: '   ',
      };
      expect(() => service.validarConstanciaServicio(conOtroEspacios)).toThrow(
        BadRequestException,
      );
    });

    it('3. Acepta motivo Otro cuando se proporciona otroMotivo válido', () => {
      const conOtroValido = {
        ...dtoConstanciaBase,
        motivo: MotivoConstanciaServicio.OTRO,
        otroMotivo: 'Trámite especial ante el IMAS',
      };
      expect(() =>
        service.validarConstanciaServicio(conOtroValido),
      ).not.toThrow();
    });

    it('4. Rechaza motivo no permitido o inexistente', () => {
      const conMotivoInvalido = {
        ...dtoConstanciaBase,
        motivo: 'Motivo No Catalogado' as MotivoConstanciaServicio,
      };
      expect(() =>
        service.validarConstanciaServicio(conMotivoInvalido),
      ).toThrow(BadRequestException);
      expect(() =>
        service.validarConstanciaServicio(conMotivoInvalido),
      ).toThrow(/no es válido/);
    });

    it('5. Rechaza medios de notificación principal y secundario idénticos', () => {
      const conMediosIdenticos = {
        ...dtoConstanciaBase,
        medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
        medioNotificacionSecundario: MedioNotificacionCambioTitular.CORREO,
      };
      expect(() =>
        service.validarConstanciaServicio(conMediosIdenticos),
      ).toThrow(BadRequestException);
      expect(() =>
        service.validarConstanciaServicio(conMediosIdenticos),
      ).toThrow(/no puede ser idéntico al principal/);
    });

    it('6. Registra solicitud y detalle de constancia correctamente en transacción', async () => {
      const tipoConstancia: TipoSolicitud = {
        id: 6,
        nombre: 'Constancia de Servicio Existente',
        slug: TipoSolicitudSlug.SERVICIO_EXISTENTE,
        descripcion: 'Formulario oficial de constancia de servicio',
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      findBySlugTipo.mockResolvedValue(tipoConstancia);

      const mockSolicitudCreada = {
        id: 601,
        tipoSolicitudId: 6,
        codigoSeguimiento: 'SOL-2026-SERV01',
        estado: EstadoSolicitud.PENDIENTE,
        fechaIngreso: new Date(),
      };
      createSolicitud.mockReturnValue(mockSolicitudCreada);
      saveSolicitud.mockResolvedValue(mockSolicitudCreada);

      const mockDetalleCreado = {
        id: 701,
        solicitudId: 601,
        ...dtoConstanciaBase,
      };

      const createDetalleConstancia = jest
        .fn()
        .mockReturnValue(mockDetalleCreado);
      const saveDetalleConstancia = jest
        .fn()
        .mockResolvedValue(mockDetalleCreado);

      transactionMock.mockImplementation(async (callback) => {
        const managerMock = {
          getRepository: (entity: unknown) => {
            if (entity === Solicitud) {
              return {
                create: createSolicitud,
                save: saveSolicitud,
              };
            }
            if (entity === SolicitudConstanciaServicio) {
              return {
                create: createDetalleConstancia,
                save: saveDetalleConstancia,
              };
            }
            if (entity === DocumentoSolicitud) {
              return {
                save: saveDocumento,
              };
            }
            return {};
          },
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return await callback(managerMock);
      });

      const resultado =
        await service.crearSolicitudConstanciaServicio(dtoConstanciaBase);

      expect(resultado).toBeDefined();
      expect(createSolicitud).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoSolicitudId: 6,
          estado: EstadoSolicitud.PENDIENTE,
        }),
      );
      expect(createDetalleConstancia).toHaveBeenCalledWith(
        expect.objectContaining({
          solicitudId: 601,
          tipoServicio: 'Domiciliar',
          nis: 'NIS-45892',
          motivo: MotivoConstanciaServicio.BONO_VIVIENDA,
        }),
      );
      expect(resultado.detalleConstanciaServicio).toEqual(mockDetalleCreado);
    });
  });

  describe('actualizarEstado', () => {
    const adminUser: AuthenticatedUser = {
      userId: '7',
      idUsuario: 7,
      email: 'admin@asada.cr',
      role: Role.ADMINISTRADORA,
      name: 'Admin',
    };

    type HistorialCreatePayload = {
      solicitudId: number;
      estadoAnterior: EstadoSolicitud | null;
      estadoNuevo: EstadoSolicitud;
      observacionPublica: string | null;
      notaInterna: string | null;
      idUsuario: number;
    };

    type TxManager = {
      getRepository: (entity: unknown) => unknown;
    };

    const setupCambioEstadoTx = (opts?: {
      solicitud?: typeof mockSolicitud | null;
      affected?: number;
      historialFail?: boolean;
    }) => {
      const solicitudValor =
        opts?.solicitud !== undefined ? opts.solicitud : { ...mockSolicitud };
      const findOneTx = jest.fn().mockResolvedValue(solicitudValor);
      const executeClaim = jest
        .fn()
        .mockResolvedValue({ affected: opts?.affected ?? 1 });
      const createHistorial = jest.fn((data: HistorialCreatePayload) => data);
      const saveHistorial = jest.fn((data: HistorialCreatePayload) => {
        if (opts?.historialFail) {
          return Promise.reject(new Error('fallo historial'));
        }
        return Promise.resolve({
          ...data,
          id: 41,
          fecha: new Date('2026-10-24T18:00:00Z'),
        });
      });

      transactionMock.mockImplementation((work: (m: TxManager) => unknown) => {
        const manager: TxManager = {
          getRepository: (entity: unknown) => {
            if (entity === Solicitud) {
              return {
                findOne: findOneTx,
                createQueryBuilder: () => ({
                  update: () => ({
                    set: () => ({
                      where: () => ({
                        andWhere: () => ({
                          execute: executeClaim,
                        }),
                      }),
                    }),
                  }),
                }),
              };
            }
            if (entity === HistorialSolicitud) {
              return {
                create: createHistorial,
                save: saveHistorial,
              };
            }
            throw new Error('Repo inesperado');
          },
        };
        return work(manager);
      });

      return { findOneTx, executeClaim, createHistorial, saveHistorial };
    };

    it('cambia estado, crea historial y usa usuario del JWT', async () => {
      const { createHistorial, executeClaim } = setupCambioEstadoTx();

      const result = await service.actualizarEstado(
        1,
        {
          estadoNuevo: EstadoSolicitud.EN_REVISION,
          observacionPublica: 'Mensaje público',
          notaInterna: 'Nota interna',
        },
        adminUser,
      );

      expect(executeClaim).toHaveBeenCalled();
      expect(createHistorial).toHaveBeenCalledWith(
        expect.objectContaining({
          solicitudId: 1,
          estadoAnterior: EstadoSolicitud.PENDIENTE,
          estadoNuevo: EstadoSolicitud.EN_REVISION,
          observacionPublica: 'Mensaje público',
          notaInterna: 'Nota interna',
          idUsuario: 7,
        }),
      );
      expect(result.estadoAnterior).toBe(EstadoSolicitud.PENDIENTE);
      expect(result.estadoNuevo).toBe(EstadoSolicitud.EN_REVISION);
      expect(result.idUsuario).toBe(7);
      expect(result.historialId).toBe(41);
    });

    it('mantiene observacionPublica y notaInterna independientes', async () => {
      setupCambioEstadoTx();

      const result = await service.actualizarEstado(
        1,
        {
          estadoNuevo: EstadoSolicitud.RECHAZADA,
          observacionPublica: 'A',
          notaInterna: 'B',
        },
        adminUser,
      );

      expect(result.observacionPublica).toBe('A');
      expect(result.notaInterna).toBe('B');
    });

    it('ignora idUsuario del cliente: siempre usa JWT', async () => {
      const { createHistorial } = setupCambioEstadoTx();

      await service.actualizarEstado(
        1,
        { estadoNuevo: EstadoSolicitud.APROBADA },
        adminUser,
      );

      const payload = createHistorial.mock.calls[0]?.[0] as
        HistorialCreatePayload | undefined;
      expect(payload?.idUsuario).toBe(7);
    });

    it('rechaza mismo estado sin crear historial', async () => {
      const { saveHistorial, executeClaim } = setupCambioEstadoTx({
        solicitud: {
          ...mockSolicitud,
          estado: EstadoSolicitud.APROBADA,
        },
      });

      await expect(
        service.actualizarEstado(
          1,
          { estadoNuevo: EstadoSolicitud.APROBADA },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(executeClaim).not.toHaveBeenCalled();
      expect(saveHistorial).not.toHaveBeenCalled();
    });

    it('404 si la solicitud no existe', async () => {
      const { saveHistorial } = setupCambioEstadoTx({ solicitud: null });

      await expect(
        service.actualizarEstado(
          999,
          { estadoNuevo: EstadoSolicitud.EN_REVISION },
          adminUser,
        ),
      ).rejects.toThrow(SolicitudNoEncontradaException);

      expect(saveHistorial).not.toHaveBeenCalled();
    });

    it('rollback: si falla historial, la transacción propaga el error', async () => {
      setupCambioEstadoTx({ historialFail: true });

      await expect(
        service.actualizarEstado(
          1,
          { estadoNuevo: EstadoSolicitud.FINALIZADA },
          adminUser,
        ),
      ).rejects.toThrow('fallo historial');
    });

    it('409 si el claim concurrente no afecta filas', async () => {
      setupCambioEstadoTx({ affected: 0 });

      await expect(
        service.actualizarEstado(
          1,
          { estadoNuevo: EstadoSolicitud.CANCELADA },
          adminUser,
        ),
      ).rejects.toThrow(/concurrente/);
    });

    it('secuencia A→B→C deja historial coherente en llamadas sucesivas', async () => {
      const estados = [
        EstadoSolicitud.PENDIENTE,
        EstadoSolicitud.EN_REVISION,
        EstadoSolicitud.APROBADA,
      ];
      let idx = 0;
      const historiales: Array<{
        estadoAnterior: EstadoSolicitud | null;
        estadoNuevo: EstadoSolicitud;
      }> = [];

      transactionMock.mockImplementation((work: (m: TxManager) => unknown) => {
        const estadoActual = estados[idx];
        const manager: TxManager = {
          getRepository: (entity: unknown) => {
            if (entity === Solicitud) {
              return {
                findOne: jest.fn().mockResolvedValue({
                  ...mockSolicitud,
                  estado: estadoActual,
                }),
                createQueryBuilder: () => ({
                  update: () => ({
                    set: () => ({
                      where: () => ({
                        andWhere: () => ({
                          execute: jest.fn().mockResolvedValue({ affected: 1 }),
                        }),
                      }),
                    }),
                  }),
                }),
              };
            }
            if (entity === HistorialSolicitud) {
              return {
                create: (data: HistorialCreatePayload) => data,
                save: (data: HistorialCreatePayload) => {
                  historiales.push({
                    estadoAnterior: data.estadoAnterior,
                    estadoNuevo: data.estadoNuevo,
                  });
                  idx += 1;
                  return Promise.resolve({
                    ...data,
                    id: historiales.length,
                    fecha: new Date(),
                  });
                },
              };
            }
            throw new Error('Repo inesperado');
          },
        };
        return work(manager);
      });

      await service.actualizarEstado(
        1,
        { estadoNuevo: EstadoSolicitud.EN_REVISION },
        adminUser,
      );
      await service.actualizarEstado(
        1,
        { estadoNuevo: EstadoSolicitud.APROBADA },
        { ...adminUser, idUsuario: 9, userId: '9' },
      );

      expect(historiales).toEqual([
        {
          estadoAnterior: EstadoSolicitud.PENDIENTE,
          estadoNuevo: EstadoSolicitud.EN_REVISION,
        },
        {
          estadoAnterior: EstadoSolicitud.EN_REVISION,
          estadoNuevo: EstadoSolicitud.APROBADA,
        },
      ]);
    });
  });

  describe('findDocumentosBySolicitudId y findHistorialBySolicitudId', () => {
    it('debe devolver documentos e historial asociados', async () => {
      findOneSolicitud.mockResolvedValue(mockSolicitud);
      findDocumentos.mockResolvedValue([
        { id: 1, nombreOriginal: 'cedula.pdf', solicitudId: 1 },
      ]);

      const docs = await service.findDocumentosBySolicitudId(1);
      const hist = await service.findHistorialBySolicitudId(1);

      expect(docs).toHaveLength(1);
      expect(hist).toHaveLength(1);
      expect(hist[0].estadoNuevo).toBe(EstadoSolicitud.PENDIENTE);
      expect(hist[0].usuario).toBeNull();
      expect(findDocumentos).toHaveBeenCalled();
      expect(findHistorial).toHaveBeenCalledWith({
        where: { solicitudId: 1 },
        relations: { usuario: { rol: true } },
        order: { fecha: 'ASC', id: 'ASC' },
      });
    });

    it('mapea usuario responsable sin datos sensibles', async () => {
      findOneSolicitud.mockResolvedValue(mockSolicitud);
      findHistorial.mockResolvedValueOnce([
        {
          id: 2,
          solicitudId: 1,
          estadoAnterior: EstadoSolicitud.PENDIENTE,
          estadoNuevo: EstadoSolicitud.EN_REVISION,
          observacionPublica: 'Pública',
          notaInterna: 'Interna',
          idUsuario: 7,
          fecha: new Date('2026-10-21T10:00:00Z'),
          usuario: {
            idUsuario: 7,
            nombre: 'María Rodríguez',
            correo: 'secreto@example.com',
            password: 'hash',
            rol: { nombre: 'ADMINISTRADORA' },
          },
        },
      ]);

      const hist = await service.findHistorialBySolicitudId(1);

      expect(hist[0].usuario).toEqual({
        idUsuario: 7,
        nombre: 'María Rodríguez',
        rol: 'ADMINISTRADORA',
      });
      expect(hist[0]).not.toHaveProperty('correo');
      expect(JSON.stringify(hist[0])).not.toContain('secreto@');
      expect(JSON.stringify(hist[0])).not.toContain('hash');
    });
  });

  describe('findAprobadasPendientes (compatibilidad histórica)', () => {
    it('devuelve solicitudes aprobadas pendientes con datos del solicitante', async () => {
      findServicio.mockResolvedValue([pendienteServicio]);

      const result = await service.findAprobadasPendientes();

      expect(findServicio).toHaveBeenCalledWith({
        where: { estado: SolicitudEstado.APROBADA, utilizada: false },
        order: { idSolicitud: 'ASC' },
      });
      expect(result.solicitudes).toHaveLength(1);
      expect(result.mensaje).toBeNull();
    });

    it('devuelve mensaje claro cuando no hay solicitudes pendientes', async () => {
      findServicio.mockResolvedValue([]);

      const result = await service.findAprobadasPendientes();

      expect(result.solicitudes).toEqual([]);
      expect(result.mensaje).toBe(
        'No hay solicitudes aprobadas pendientes de registro.',
      );
    });
  });

  describe('subirDocumentoSolicitud (Seguridad y Metadatos)', () => {
    const validPdfFile = {
      originalname: 'cedula.pdf',
      mimetype: 'application/pdf',
      size: 14,
      buffer: Buffer.from('%PDF-1.7 prueba'),
    };

    it('sube documento legítimo, genera nombreInterno único y registra metadatos sin exponer rutas del SO', async () => {
      saveDocumento.mockImplementation((doc: any) =>
        Promise.resolve({
          ...doc,
          id: 77,
          fechaCarga: new Date('2026-10-24T12:00:00Z'),
        }),
      );

      const res = await service.subirDocumentoSolicitud(
        validPdfFile,
        TipoDocumentoSolicitud.IDENTIFICACION,
      );

      expect(res.id).toBe(77);
      expect(res.nombreOriginal).toBe('cedula.pdf');
      expect(res.nombreInterno).toBeDefined();
      expect(res.nombreInterno).toContain('cedula.pdf');
      expect(res.mimeType).toBe('application/pdf');
      expect(res.tamano).toBe(14);
      expect(res.ubicacion).toBe(`/uploads/solicitudes/pendientes/${res.nombreInterno}`);
      expect(res.ubicacion).not.toContain('C:');
      expect(res.tokenReclamo).toBeDefined();
      expect(res.fechaCarga).toBeInstanceOf(Date);
    });

    it('rechaza si el tipo de documento no es válido', async () => {
      await expect(
        service.subirDocumentoSolicitud(validPdfFile, 'tipo-inexistente'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza archivo con formato o firma inválida', async () => {
      const corruptFile = {
        originalname: 'falso.pdf',
        mimetype: 'application/pdf',
        size: 15,
        buffer: Buffer.from('No soy un pdf!!'),
      };

      await expect(
        service.subirDocumentoSolicitud(
          corruptFile,
          TipoDocumentoSolicitud.IDENTIFICACION,
        ),
      ).rejects.toThrow(
        'El contenido del archivo no coincide con su formato declarado.',
      );
    });
  });
});
