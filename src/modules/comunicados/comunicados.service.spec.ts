import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ComunicadosService } from './comunicados.service';
import { Comunicado } from './entities/comunicado.entity';

const createMemoryRepo = () => {
  const items: Comunicado[] = [];

  return {
    items,
    count: jest.fn(async () => items.length),
    find: jest.fn(async () => [...items]),
    findOne: jest.fn(async ({ where: { id } }: { where: { id: string } }) =>
      items.find((item) => item.id === id),
    ),
    create: jest.fn((data: Partial<Comunicado>) => ({ ...data }) as Comunicado),
    save: jest.fn(async (entity: Comunicado | Comunicado[]) => {
      const list = Array.isArray(entity) ? entity : [entity];
      for (const row of list) {
        const index = items.findIndex((item) => item.id === row.id);
        if (index >= 0) {
          items[index] = row;
        } else {
          items.push(row);
        }
      }
      return Array.isArray(entity) ? list : list[0];
    }),
  };
};

describe('ComunicadosService', () => {
  let service: ComunicadosService;
  let repo: ReturnType<typeof createMemoryRepo>;

  beforeEach(async () => {
    repo = createMemoryRepo();
    const module = await Test.createTestingModule({
      providers: [
        ComunicadosService,
        { provide: getRepositoryToken(Comunicado), useValue: repo },
      ],
    }).compile();

    service = module.get(ComunicadosService);
    await service.onModuleInit();
  });

  it('expone en público solo comunicados activos y públicos', async () => {
    const created = await service.create({
      titulo: 'Aviso interno',
      descripcion: 'No debe salir en la landing',
      estado: 'Inactivo',
      esPublico: false,
    });

    const publicos = await service.findPublicos();
    expect(publicos.some((item) => item.id === created.id)).toBe(false);
    expect(
      publicos.every((item) => item.estado === 'Activo' && item.esPublico),
    ).toBe(true);
  });

  it('permite crear y actualizar un comunicado desde administración', async () => {
    const created = await service.create({
      titulo: 'Corte programado',
      descripcion: 'Sector norte',
      contenido: 'Detalle del corte',
      tipo: 'Mantenimiento',
      prioridad: 'Alta',
    });

    expect(created.titulo).toBe('Corte programado');
    expect(created.estado).toBe('Activo');

    const updated = await service.update(created.id, {
      titulo: 'Corte reprogramado',
      estado: 'Inactivo',
    });

    expect(updated.titulo).toBe('Corte reprogramado');
    expect(updated.estado).toBe('Inactivo');
    expect(
      (await service.findAllAdmin()).some((item) => item.id === created.id),
    ).toBe(true);
  });
});
