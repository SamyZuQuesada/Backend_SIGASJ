import { Test, TestingModule } from '@nestjs/testing';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { Solicitud } from './entities/solicitud.entity';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

describe('SolicitudesController', () => {
  let controller: SolicitudesController;
  let service: SolicitudesService;

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
    fechaIngreso: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    establecerValoresPorDefecto: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SolicitudesController],
      providers: [
        {
          provide: SolicitudesService,
          useValue: {
            findAprobadasPendientes: jest.fn().mockResolvedValue({
              solicitudes: [],
              mensaje: null,
            }),
            findByCodigoSeguimiento: jest.fn().mockResolvedValue(mockSolicitud),
            findById: jest.fn().mockResolvedValue(mockSolicitud),
            findAll: jest.fn().mockResolvedValue({
              solicitudes: [mockSolicitud],
              total: 1,
            }),
            crearSolicitudArregloPago: jest
              .fn()
              .mockResolvedValue(mockSolicitud),
          },
        },
      ],
    }).compile();

    controller = module.get<SolicitudesController>(SolicitudesController);
    service = module.get<SolicitudesService>(SolicitudesService);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('crearArregloPago debe delegar el registro en el servicio', async () => {
    const dto = {
      nombre: 'Juan Rodríguez',
      cedula: '1-1234-0567',
      vecinoDe: 'San Juan',
      telefono: '8888-1234',
      numeroCuentaServicio: 'CTA-12345',
      montoPrimaInicial: 20000,
      plazoSeleccionado: '6 meses' as any,
    };

    const result = await controller.crearArregloPago(dto);
    expect(service.crearSolicitudArregloPago).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockSolicitud);
  });

  it('findByCodigoSeguimiento debe consultar la solicitud por código público', async () => {
    const result = await controller.findByCodigoSeguimiento('SOL-2026-00001');
    expect(service.findByCodigoSeguimiento).toHaveBeenCalledWith(
      'SOL-2026-00001',
    );
    expect(result).toEqual(mockSolicitud);
  });

  it('findById debe consultar la solicitud por ID', async () => {
    const result = await controller.findById(1);
    expect(service.findById).toHaveBeenCalledWith(1);
    expect(result).toEqual(mockSolicitud);
  });

  it('findAll debe consultar solicitudes con filtros', async () => {
    const query = { estado: EstadoSolicitud.PENDIENTE };
    const result = await controller.findAll(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
    expect(result.solicitudes).toHaveLength(1);
  });
});
