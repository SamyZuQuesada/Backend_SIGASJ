import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContenidoPublicoService } from './contenido-publico.service';
import { ContactoUbicacion } from './entities/contacto-ubicacion.entity';
import { GaleriaFoto } from './entities/galeria-foto.entity';

const createContactoRepo = () => {
  const items: ContactoUbicacion[] = [];

  return {
    findOne: jest.fn(async ({ where: { id } }: { where: { id: number } }) =>
      items.find((item) => item.id === id),
    ),
    create: jest.fn(
      (data: Partial<ContactoUbicacion>) => ({ ...data }) as ContactoUbicacion,
    ),
    save: jest.fn(async (entity: ContactoUbicacion) => {
      const index = items.findIndex((item) => item.id === entity.id);
      if (index >= 0) {
        items[index] = entity;
      } else {
        items.push(entity);
      }
      return entity;
    }),
  };
};

const createGaleriaRepo = () => {
  const items: GaleriaFoto[] = [];
  let nextId = 1;

  return {
    count: jest.fn(async () => items.length),
    find: jest.fn(async (opts?: { where?: { activa?: boolean } }) => {
      const filtered = opts?.where?.activa
        ? items.filter((item) => item.activa)
        : [...items];
      return filtered.sort(
        (left, right) => left.ordenVisualizacion - right.ordenVisualizacion,
      );
    }),
    findOne: jest.fn(async ({ where: { id } }: { where: { id: number } }) =>
      items.find((item) => item.id === id),
    ),
    create: jest.fn((data: Partial<GaleriaFoto>) => ({ ...data }) as GaleriaFoto),
    save: jest.fn(async (entity: GaleriaFoto | GaleriaFoto[]) => {
      const list = Array.isArray(entity) ? entity : [entity];
      for (const row of list) {
        if (!row.id) {
          row.id = nextId;
          nextId += 1;
        }
        const index = items.findIndex((item) => item.id === row.id);
        if (index >= 0) {
          items[index] = row;
        } else {
          items.push(row);
        }
      }
      return Array.isArray(entity) ? list : list[0];
    }),
    remove: jest.fn(async (entity: GaleriaFoto) => {
      const index = items.findIndex((item) => item.id === entity.id);
      if (index >= 0) {
        items.splice(index, 1);
      }
      return entity;
    }),
  };
};

describe('ContenidoPublicoService', () => {
  let service: ContenidoPublicoService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ContenidoPublicoService,
        {
          provide: getRepositoryToken(ContactoUbicacion),
          useValue: createContactoRepo(),
        },
        {
          provide: getRepositoryToken(GaleriaFoto),
          useValue: createGaleriaRepo(),
        },
      ],
    }).compile();

    service = module.get(ContenidoPublicoService);
    await service.onModuleInit();
  });

  it('actualiza contacto y ubicación sin perder el resto de campos', async () => {
    const updated = await service.updateContacto({
      telefono: '2222-2222',
      horarioAtencion: 'Lunes a viernes 8 a.m. a 4 p.m.',
    });

    expect(updated.telefono).toBe('2222-2222');
    expect(updated.horarioAtencion).toContain('Lunes a viernes');
    expect(updated.email).toBeTruthy();
    expect(updated.latitud).toBeDefined();
    expect((await service.getContacto()).telefono).toBe('2222-2222');
  });

  it('crea, desactiva y elimina fotografías de la galería', async () => {
    const created = await service.createGaleria({
      titulo: 'Tanque nuevo',
      textoAlternativo: 'Tanque de almacenamiento',
      url: '/api/v1/public/media/galeria/demo.jpg',
    });

    expect((await service.getGaleria()).some((item) => item.id === created.id)).toBe(
      true,
    );

    await service.updateGaleria(created.id, { activa: false });
    expect((await service.getGaleria()).some((item) => item.id === created.id)).toBe(
      false,
    );
    expect(
      (await service.getGaleriaAdmin()).some(
        (item) => item.id === created.id && !item.activa,
      ),
    ).toBe(true);

    await service.removeGaleria(created.id);
    expect(
      (await service.getGaleriaAdmin()).some((item) => item.id === created.id),
    ).toBe(false);
  });
});
