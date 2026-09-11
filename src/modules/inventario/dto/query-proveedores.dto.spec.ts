import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryProveedoresDto } from './query-proveedores.dto';

async function validateQuery(payload: Record<string, unknown>) {
  const dto = plainToInstance(QueryProveedoresDto, payload);
  const errors = await validate(dto);
  return { dto, errors };
}

describe('QueryProveedoresDto — validaciones de entrada', () => {
  it('aplica valores por defecto para page=1 y limit=20', async () => {
    const { dto, errors } = await validateQuery({});

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.activo).toBeUndefined();
    expect(dto.nombre).toBeUndefined();
    expect(dto.search).toBeUndefined();
  });

  it('transforma parámetros string numéricos y booleanos de query params', async () => {
    const { dto, errors } = await validateQuery({
      activo: 'true',
      nombre: '  Lagar  ',
      search: '  3-101  ',
      page: '2',
      limit: '50',
    });

    expect(errors).toHaveLength(0);
    expect(dto.activo).toBe(true);
    expect(dto.nombre).toBe('Lagar');
    expect(dto.search).toBe('3-101');
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
  });

  it('rechaza page menor que 1 o limit mayor que 100', async () => {
    const { errors: errPage } = await validateQuery({
      page: 0,
    });
    expect(errPage.some((e) => e.property === 'page')).toBe(true);

    const { errors: errLimit } = await validateQuery({
      limit: 101,
    });
    expect(errLimit.some((e) => e.property === 'limit')).toBe(true);
  });
});
