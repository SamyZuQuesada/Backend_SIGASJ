import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { PlazoArregloPago } from '../../common/enums/plazo-arreglo-pago.enum';
import { SolicitudEstado } from '../../common/enums/solicitud-estado.enum';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { CreateSolicitudArregloPagoDto } from './dto/create-solicitud-arreglo-pago.dto';
import { SolicitudArregloPago } from './entities/solicitud-arreglo-pago.entity';
import { SolicitudServicio } from './entities/solicitud-servicio.entity';
import { Solicitud } from './entities/solicitud.entity';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';
import { SolicitudNoEncontradaException } from './errors/solicitud.errors';
import { SolicitudesService } from './solicitudes.service';
import { TiposSolicitudService } from './tipos-solicitud.service';

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

  const mockSolicitud: Solicitud = {
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
    documentos: [{ id: 1, nombreArchivo: 'cedula.pdf' }],
    historial: [{ id: 1, evento: 'REGISTRADA' }],
    establecerValoresPorDefecto: jest.fn(),
  };

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
    findBySlugTipo = jest.fn().mockResolvedValue(mockSolicitud.tipoSolicitud);

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
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(null),
            }),
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
        plazoSeleccionado: '60 meses' as any,
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

  describe('actualizarEstado', () => {
    it('debe actualizar el estado de la solicitud', async () => {
      findOneSolicitud.mockResolvedValue({ ...mockSolicitud });
      saveSolicitud.mockImplementation((s) => Promise.resolve(s));

      const actualizada = await service.actualizarEstado(
        1,
        EstadoSolicitud.APROBADA,
      );

      expect(actualizada.estado).toBe(EstadoSolicitud.APROBADA);
      expect(saveSolicitud).toHaveBeenCalled();
    });
  });

  describe('findDocumentosBySolicitudId y findHistorialBySolicitudId', () => {
    it('debe devolver documentos e historial asociados', async () => {
      findOneSolicitud.mockResolvedValue(mockSolicitud);

      const docs = await service.findDocumentosBySolicitudId(1);
      const hist = await service.findHistorialBySolicitudId(1);

      expect(docs).toHaveLength(1);
      expect(hist).toHaveLength(1);
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
});
