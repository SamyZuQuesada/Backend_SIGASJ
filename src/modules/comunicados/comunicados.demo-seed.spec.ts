import { asegurarComunicadosDemo, COMUNICADOS_DEMO } from './comunicados.demo-seed';
import { Comunicado } from './entities/comunicado.entity';

const createMemoryRepo = () => {
  const items: Comunicado[] = [];

  return {
    items,
    find: jest.fn(async () => [...items]),
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

describe('comunicados demo seed', () => {
  it('inserta dos comunicados públicos activos para la landing', async () => {
    const repo = createMemoryRepo();
    const creados = await asegurarComunicadosDemo(repo as never);

    expect(creados).toBe(2);
    expect(repo.items).toHaveLength(2);
    expect(repo.items.map((item) => item.id)).toEqual(
      COMUNICADOS_DEMO.map((item) => item.id),
    );
    expect(repo.items.map((item) => item.titulo)).toEqual(
      COMUNICADOS_DEMO.map((item) => item.titulo),
    );
    expect(
      repo.items.every(
        (item) => item.estado === 'Activo' && item.esPublico === true,
      ),
    ).toBe(true);
  });

  it('no duplica si los comunicados demo ya existen', async () => {
    const repo = createMemoryRepo();
    await asegurarComunicadosDemo(repo as never);
    const segunda = await asegurarComunicadosDemo(repo as never);

    expect(segunda).toBe(0);
    expect(repo.items).toHaveLength(2);
  });
});
