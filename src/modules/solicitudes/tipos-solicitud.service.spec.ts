import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';
import { TipoSolicitudNoEncontradoException } from './errors/solicitud.errors';
import { TiposSolicitudService } from './tipos-solicitud.service';

describe('TiposSolicitudService', () => {
  let service: TiposSolicitudService;
  let find: jest.Mock;
  let findOne: jest.Mock;
  let save: jest.Mock;

  const mockTipo: TipoSolicitud = {
    id: 1,
    nombre: 'Solicitud de Arreglo de Pago Domiciliar',
    descripcion: 'Convenio de pago',
    slug: TipoSolicitudSlug.ARREGLO_PAGO,
    activo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    find = jest.fn();
    findOne = jest.fn();
    save = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TiposSolicitudService,
        {
          provide: getRepositoryToken(TipoSolicitud),
          useValue: {
            find,
            findOne,
            save,
          },
        },
      ],
    }).compile();

    service = module.get<TiposSolicitudService>(TiposSolicitudService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('findActivos', () => {
    it('debe consultar únicamente los tipos activos ordenados por ID con su formulario oficial', async () => {
      find.mockResolvedValue([mockTipo]);

      const result = await service.findActivos();

      expect(find).toHaveBeenCalledWith({
        where: { activo: true },
        relations: { formularioOficial: true },
        order: { id: 'ASC' },
      });
      expect(result).toEqual([mockTipo]);
    });
  });

  describe('findBySlug', () => {
    it('debe devolver el tipo cuando el slug existe y está activo', async () => {
      findOne.mockResolvedValue(mockTipo);

      const result = await service.findBySlug('arreglo-pago');

      expect(findOne).toHaveBeenCalledWith({
        where: { slug: 'arreglo-pago', activo: true },
        relations: { formularioOficial: true },
      });
      expect(result).toEqual(mockTipo);
    });

    it('debe normalizar espacios y mayúsculas en el slug', async () => {
      findOne.mockResolvedValue(mockTipo);

      await service.findBySlug('  ARREGLO-PAGO  ');

      expect(findOne).toHaveBeenCalledWith({
        where: { slug: 'arreglo-pago', activo: true },
        relations: { formularioOficial: true },
      });
    });

    it('debe lanzar TipoSolicitudNoEncontradoException si el slug no existe', async () => {
      findOne.mockResolvedValue(null);

      await expect(service.findBySlug('tramite-inexistente')).rejects.toThrow(
        TipoSolicitudNoEncontradoException,
      );
    });
  });

  describe('findById', () => {
    it('debe devolver el tipo cuando el id existe', async () => {
      findOne.mockResolvedValue(mockTipo);

      const result = await service.findById(1);

      expect(findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { formularioOficial: true },
      });
      expect(result).toEqual(mockTipo);
    });

    it('debe lanzar TipoSolicitudNoEncontradoException si el id no existe', async () => {
      findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(
        TipoSolicitudNoEncontradoException,
      );
    });
  });

  describe('cambiarEstadoActivo', () => {
    it('debe inactivar un tipo sin eliminarlo', async () => {
      findOne.mockResolvedValue({ ...mockTipo });
      save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.cambiarEstadoActivo(1, false);

      expect(result.activo).toBe(false);
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, activo: false }),
      );
    });
  });
});
