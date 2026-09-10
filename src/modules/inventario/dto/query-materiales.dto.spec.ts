import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryMaterialesDto } from './query-materiales.dto';

async function validateQuery(payload: Record<string, unknown>) {
  const dto = plainToInstance(QueryMaterialesDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('QueryMaterialesDto — validaciones y transformaciones', () => {
  it('aplica valores por defecto cuando no se envían parámetros', async () => {
    const { dto, errors } = await validateQuery({});

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(10);
    expect(dto.nombre).toBeUndefined();
    expect(dto.activo).toBeUndefined();
  });

  it('transforma y limpia el término de búsqueda por nombre', async () => {
    const { dto, errors } = await validateQuery({
      nombre: '   Tubo PVC   ',
    });

    expect(errors).toHaveLength(0);
    expect(dto.nombre).toBe('Tubo PVC');
  });

  it('convierte correctamente los valores de filtro activo a booleano', async () => {
    const trueCases = ['true', true, '1', 1];
    for (const val of trueCases) {
      const { dto, errors } = await validateQuery({ activo: val });
      expect(errors).toHaveLength(0);
      expect(dto.activo).toBe(true);
    }

    const falseCases = ['false', false, '0', 0];
    for (const val of falseCases) {
      const { dto, errors } = await validateQuery({ activo: val });
      expect(errors).toHaveLength(0);
      expect(dto.activo).toBe(false);
    }
  });

  it('transforma strings numéricos en page y limit', async () => {
    const { dto, errors } = await validateQuery({
      page: '3',
      limit: '25',
    });

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(25);
  });

  it('rechaza page menor a 1 o no entero', async () => {
    const { errors: errorsZero } = await validateQuery({ page: 0 });
    expect(errorsZero.some((e) => e.property === 'page')).toBe(true);

    const { errors: errorsDecimal } = await validateQuery({ page: 1.5 });
    expect(errorsDecimal.some((e) => e.property === 'page')).toBe(true);
  });

  it('rechaza limit menor a 1, mayor a 100 o no entero', async () => {
    const { errors: errorsZero } = await validateQuery({ limit: 0 });
    expect(errorsZero.some((e) => e.property === 'limit')).toBe(true);

    const { errors: errorsExcess } = await validateQuery({ limit: 101 });
    expect(errorsExcess.some((e) => e.property === 'limit')).toBe(true);

    const { errors: errorsDecimal } = await validateQuery({ limit: 10.5 });
    expect(errorsDecimal.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rechaza si el nombre excede 150 caracteres', async () => {
    const { errors } = await validateQuery({
      nombre: 'A'.repeat(151),
    });
    expect(errors.some((e) => e.property === 'nombre')).toBe(true);
  });

  it('acepta idCategoria numérico y alias categoriaId', async () => {
    const res1 = await validateQuery({ idCategoria: 2 });
    expect(res1.errors).toHaveLength(0);
    expect(res1.dto.idCategoria).toBe(2);

    const res2 = await validateQuery({ categoriaId: '3' });
    expect(res2.errors).toHaveLength(0);
    expect(res2.dto.categoriaId ?? res2.dto.idCategoria).toBe(3);
  });

  it('rechaza idCategoria si es menor a 1', async () => {
    const { errors } = await validateQuery({ idCategoria: 0 });
    expect(errors.some((e) => e.property === 'idCategoria')).toBe(true);
  });
});
