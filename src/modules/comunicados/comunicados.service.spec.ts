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
    remove: jest.fn(async (entity: Comunicado) => {
      const index = items.findIndex((item) => item.id === entity.id);
      if (index >= 0) {
        items.splice(index, 1);
      }
      return entity;
    }),
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

  it('al desactivar un comunicado deja de aparecer en la landing', async () => {
    const created = await service.create({
      titulo: 'Aviso visible',
      descripcion: 'Sale en la landing mientras esté activo',
      estado: 'Activo',
      esPublico: true,
    });

    expect(
      (await service.findPublicos()).some((item) => item.id === created.id),
    ).toBe(true);

    await service.setEstado(created.id, 'Inactivo');

    expect(
      (await service.findPublicos()).some((item) => item.id === created.id),
    ).toBe(false);
    expect(
      (await service.findAllAdmin()).some(
        (item) => item.id === created.id && item.estado === 'Inactivo',
      ),
    ).toBe(true);

    const reactivated = await service.setEstado(created.id, 'Activo');
    expect(reactivated.estado).toBe('Activo');
    expect(
      (await service.findPublicos()).some((item) => item.id === created.id),
    ).toBe(true);
  });

  it('expone en la landing un comunicado activo aunque solo tenga título', async () => {
    const created = await service.create({
      titulo: 'Aviso solo con título',
    });

    expect(created.estado).toBe('Activo');
    expect(created.esPublico).toBe(true);
    expect(
      (await service.findPublicos()).some(
        (item) => item.id === created.id && item.titulo === 'Aviso solo con título',
      ),
    ).toBe(true);
  });

  it('lista primero en público el comunicado más reciente', async () => {
    await service.create({
      titulo: 'Aviso anterior',
      fechaPublicacion: '2026-08-01T12:00:00.000Z',
    });
    const newest = await service.create({
      titulo: 'Aviso reciente',
      fechaPublicacion: '2026-08-21T18:00:00.000Z',
    });

    const publicos = await service.findPublicos();
    expect(publicos[0]?.id).toBe(newest.id);
  });

  it('elimina un comunicado y lo saca de administración y de la landing', async () => {
    const created = await service.create({
      titulo: 'Aviso a eliminar',
      estado: 'Activo',
      esPublico: true,
    });

    await service.remove(created.id);

    expect(
      (await service.findAllAdmin()).some((item) => item.id === created.id),
    ).toBe(false);
    expect(
      (await service.findPublicos()).some((item) => item.id === created.id),
    ).toBe(false);
  });
});
