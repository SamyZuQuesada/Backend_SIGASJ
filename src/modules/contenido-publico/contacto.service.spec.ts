import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactoService } from './contacto.service';
import { ContactoPublico } from './entities/contacto-publico.entity';

describe('ContactoService', () => {
  let service: ContactoService;
  let repository: jest.Mocked<Repository<ContactoPublico>>;

  beforeEach(async () => {
    repository = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<ContactoPublico>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactoService,
        {
          provide: getRepositoryToken(ContactoPublico),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(ContactoService);
  });

  it('getContacto crea registro por defecto si no existe', async () => {
    repository.find.mockResolvedValue([]);
    repository.create.mockImplementation((value) => value as ContactoPublico);
    repository.save.mockImplementation(async (value) => ({
      ...(value as ContactoPublico),
      idContactoPublico: 1,
      creadoEn: new Date('2026-01-01T00:00:00.000Z'),
      actualizadoEn: new Date('2026-01-01T00:00:00.000Z'),
    }));

    const result = await service.getContacto();

    expect(result.telefono).toBe('8560-7584');
    expect(result.email).toBe('asadasanjuan24@gmail.com');
    expect(repository.save).toHaveBeenCalled();
  });

  it('updateContacto persiste cambios sobre el registro existente', async () => {
    const existing: ContactoPublico = {
      idContactoPublico: 1,
      telefono: '8560-7584',
      telefonosAdicionalesJson: null,
      email: 'asadasanjuan24@gmail.com',
      horarioAtencion: 'Lunes a sábado',
      horarioVentanilla: null,
      direccion: 'San Juan',
      referenciaUbicacion: null,
      regionResumen: 'Guanacaste',
      mapaUrl: null,
      mapaLatitud: null,
      mapaLongitud: null,
      mapaZoom: 19,
      textoUbicacionMapa: null,
      urlFacebook: null,
      descripcionContacto: null,
      creadoEn: new Date('2026-01-01T00:00:00.000Z'),
      actualizadoEn: new Date('2026-01-01T00:00:00.000Z'),
    };

    repository.find.mockResolvedValue([existing]);
    repository.save.mockImplementation(async (value) => value as ContactoPublico);

    const result = await service.updateContacto({
      telefono: '8888-8888',
      email: 'nuevo@sigasj.local',
      horarioAtencion: 'Lunes a viernes',
      direccion: 'Nueva dirección',
      regionResumen: 'Guanacaste',
    });

    expect(result.telefono).toBe('8888-8888');
    expect(result.email).toBe('nuevo@sigasj.local');
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        telefono: '8888-8888',
        email: 'nuevo@sigasj.local',
      }),
    );
  });
});
