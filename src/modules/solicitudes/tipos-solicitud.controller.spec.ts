import { Test, TestingModule } from '@nestjs/testing';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';
import { TiposSolicitudController } from './tipos-solicitud.controller';
import { TiposSolicitudService } from './tipos-solicitud.service';

describe('TiposSolicitudController', () => {
  let controller: TiposSolicitudController;
  let service: TiposSolicitudService;

  const mockTipo: TipoSolicitud = {
    id: 1,
    nombre: 'Solicitud de Arreglo de Pago Domiciliar',
    descripcion: 'Convenio',
    slug: TipoSolicitudSlug.ARREGLO_PAGO,
    activo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TiposSolicitudController],
      providers: [
        {
          provide: TiposSolicitudService,
          useValue: {
            findActivos: jest.fn().mockResolvedValue([mockTipo]),
            findBySlug: jest.fn().mockResolvedValue(mockTipo),
          },
        },
      ],
    }).compile();

    controller = module.get<TiposSolicitudController>(TiposSolicitudController);
    service = module.get<TiposSolicitudService>(TiposSolicitudService);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('findActivos debe llamar al servicio y retornar los tipos activos', async () => {
    const result = await controller.findActivos();
    expect(service.findActivos).toHaveBeenCalled();
    expect(result).toEqual([mockTipo]);
  });

  it('findBySlug debe delegar al servicio con el slug correspondiente', async () => {
    const result = await controller.findBySlug('arreglo-pago');
    expect(service.findBySlug).toHaveBeenCalledWith('arreglo-pago');
    expect(result).toEqual(mockTipo);
  });
});
