import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryCategoriasDto } from './query-categorias.dto';

async function validateQuery(payload: Record<string, unknown>) {
  const dto = plainToInstance(QueryCategoriasDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('QueryCategoriasDto — validaciones de filtros y paginación', () => {
  it('aplica valores por defecto si no se envían parámetros', async () => {
    const { dto, errors } = await validateQuery({});
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.activo).toBeUndefined();
    expect(dto.nombre).toBeUndefined();
  });

  it('parsea correctamente activo booleano o variantes textuales', async () => {
    const res1 = await validateQuery({ activo: true });
    expect(res1.errors).toHaveLength(0);
    expect(res1.dto.activo).toBe(true);

    const res2 = await validateQuery({ activo: 'false' });
    expect(res2.errors).toHaveLength(0);
    expect(res2.dto.activo).toBe(false);

    const res3 = await validateQuery({ activo: '1' });
    expect(res3.errors).toHaveLength(0);
    expect(res3.dto.activo).toBe(true);
  });

  it('aplica trim al término de búsqueda nombre', async () => {
    const { dto, errors } = await validateQuery({
      nombre: '  Tubo  ',
    });
    expect(errors).toHaveLength(0);
    expect(dto.nombre).toBe('Tubo');
  });

  it('rechaza límites o páginas inválidas', async () => {
    const resPag = await validateQuery({ page: 0 });
    expect(resPag.errors.some((e) => e.property === 'page')).toBe(true);

    const resLim = await validateQuery({ limit: 101 });
    expect(resLim.errors.some((e) => e.property === 'limit')).toBe(true);
  });
});
