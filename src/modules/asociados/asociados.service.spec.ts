import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AsociadosService } from './asociados.service';
import { Asociado } from './entities/asociado.entity';
import { CreateAsociadoDto } from './dto/create-asociado.dto';

describe('AsociadosService', () => {
  let service: AsociadosService;
  let repo: jest.Mocked<Repository<Asociado>>;

  const mockRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsociadosService,
        {
          provide: getRepositoryToken(Asociado),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<AsociadosService>(AsociadosService);
    repo = module.get(getRepositoryToken(Asociado));
  });

  describe('create()', () => {
    const validDto: CreateAsociadoDto = {
      nombre: '  María Elena  ',
      apellidos: '  González Vargas  ',
      cedula: '  5-0123-0456  ',
      correoElectronico: '  Maria.Gonzalez@Example.com  ',
    };

    it('debe registrar un nuevo asociado con activo = true y fechaInactivacion = null', async () => {
      repo.findOne.mockResolvedValue(null);

      const mockAsociado: Partial<Asociado> = {
        id: 1,
        nombre: 'María Elena',
        apellidos: 'González Vargas',
        cedula: '5-0123-0456',
        correoElectronico: 'maria.gonzalez@example.com',
        activo: true,
        fechaRegistro: new Date('2026-02-01T00:00:00Z'),
        fechaInactivacion: null,
      };

      repo.create.mockReturnValue(mockAsociado as Asociado);
      repo.save.mockResolvedValue(mockAsociado as Asociado);

      const result = await service.create(validDto);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { cedula: '5-0123-0456' },
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'María Elena',
          apellidos: 'González Vargas',
          cedula: '5-0123-0456',
          correoElectronico: 'maria.gonzalez@example.com',
          activo: true,
          fechaInactivacion: null,
        }),
      );
      expect(repo.save).toHaveBeenCalled();
      expect(result.id).toBe(1);
      expect(result.activo).toBe(true);
      expect(result.fechaInactivacion).toBeNull();
    });

    it('debe respetar fechaRegistro si se envía explícitamente en el DTO', async () => {
      repo.findOne.mockResolvedValue(null);

      const fechaIso = '2025-10-15T12:00:00.000Z';
      const dtoConFecha: CreateAsociadoDto = {
        ...validDto,
        fechaRegistro: fechaIso,
      };

      repo.create.mockImplementation((data) => data as Asociado);
      repo.save.mockImplementation(async (data) => data as Asociado);

      const result = await service.create(dtoConFecha);

      expect(result.fechaRegistro).toEqual(new Date(fechaIso));
    });

    it('debe lanzar ConflictException si ya existe un asociado con la misma cédula', async () => {
      const asociadoExistente = {
        id: 99,
        cedula: '5-0123-0456',
        nombre: 'Otro Asociado',
      } as Asociado;

      repo.findOne.mockResolvedValue(asociadoExistente);

      await expect(service.create(validDto)).rejects.toThrow(ConflictException);
      await expect(service.create(validDto)).rejects.toThrow(
        'Ya existe un asociado registrado con la cédula "5-0123-0456"',
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('debe capturar errores de violación de unicidad concurrentes en save() y lanzar ConflictException', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue({} as Asociado);
      repo.save.mockRejectedValue({
        number: 2601,
        message:
          'Cannot insert duplicate key row in object with unique index UQ_Asociado_cedula',
      });

      await expect(service.create(validDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findById(), findByCedula(), findOne()', () => {
    it('debe buscar por id', async () => {
      const mockAsociado = { id: 1, nombre: 'Juan' } as Asociado;
      repo.findOne.mockResolvedValue(mockAsociado);

      const result = await service.findById(1);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toBe(mockAsociado);
    });

    it('debe buscar por cédula sanitizada', async () => {
      const mockAsociado = { id: 1, cedula: '1-1234-0567' } as Asociado;
      repo.findOne.mockResolvedValue(mockAsociado);

      const result = await service.findByCedula('  1-1234-0567  ');
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { cedula: '1-1234-0567' },
      });
      expect(result).toBe(mockAsociado);
    });

    it('findOne devuelve el asociado cuando existe', async () => {
      const mockAsociado = { id: 7, nombre: 'Ana' } as Asociado;
      repo.findOne.mockResolvedValue(mockAsociado);

      await expect(service.findOne(7)).resolves.toBe(mockAsociado);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 7 } });
    });

    it('findOne lanza NotFoundException cuando el asociado no existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });
});
