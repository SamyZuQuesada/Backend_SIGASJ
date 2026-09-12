import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EstadoAveria } from '../../../common/enums/estado-averia.enum';
import {
  ADMIN_AVERIAS_LIMIT_DEFAULT,
  ADMIN_AVERIAS_LIMIT_MAX,
  ADMIN_AVERIAS_PAGE_DEFAULT,
  QueryAveriasAdminDto,
} from './query-averias-admin.dto';

async function validateQuery(payload: Record<string, unknown>) {
  const dto = plainToInstance(QueryAveriasAdminDto, payload, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('QueryAveriasAdminDto', () => {
  it('aplica page=1 y limit=20 por defecto', async () => {
    const { dto, errors } = await validateQuery({});
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(ADMIN_AVERIAS_PAGE_DEFAULT);
    expect(dto.limit).toBe(ADMIN_AVERIAS_LIMIT_DEFAULT);
    expect(dto.search).toBeUndefined();
    expect(dto.estado).toBeUndefined();
    expect(dto.prioridad).toBeUndefined();
    expect(dto.tipo).toBeUndefined();
    expect(dto.fontaneroId).toBeUndefined();
    expect(dto.fechaDesde).toBeUndefined();
    expect(dto.fechaHasta).toBeUndefined();
  });

  it('transforma strings numéricos de page, limit y fontaneroId', async () => {
    const { dto, errors } = await validateQuery({
      page: '2',
      limit: '25',
      fontaneroId: '7',
    });
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(25);
    expect(dto.fontaneroId).toBe(7);
  });

  it('recorta search, prioridad y tipo; ignora search solo con espacios', async () => {
    const trimmed = await validateQuery({
      search: '  AV-2026-0001  ',
      prioridad: '  ALTA  ',
      tipo: '  TUBERIA  ',
    });
    expect(trimmed.errors).toHaveLength(0);
    expect(trimmed.dto.search).toBe('AV-2026-0001');
    expect(trimmed.dto.prioridad).toBe('ALTA');
    expect(trimmed.dto.tipo).toBe('TUBERIA');

    const unassigned = await validateQuery({ prioridad: 'SIN_ASIGNAR' });
    expect(unassigned.errors).toHaveLength(0);
    expect(unassigned.dto.prioridad).toBe('SIN_ASIGNAR');

    const blank = await validateQuery({ search: '   ' });
    expect(blank.errors).toHaveLength(0);
    expect(blank.dto.search).toBeUndefined();
  });

  it('acepta el estado real RECIBIDA y normaliza minúsculas', async () => {
    const exact = await validateQuery({ estado: EstadoAveria.RECIBIDA });
    expect(exact.errors).toHaveLength(0);
    expect(exact.dto.estado).toBe(EstadoAveria.RECIBIDA);

    const lower = await validateQuery({ estado: 'recibida' });
    expect(lower.errors).toHaveLength(0);
    expect(lower.dto.estado).toBe(EstadoAveria.RECIBIDA);
  });

  it('rechaza estados que no existen en EstadoAveria', async () => {
    for (const estado of ['ASIGNADA', 'EN_ATENCION', 'RESUELTA', 'inventado']) {
      const { errors } = await validateQuery({ estado });
      expect(errors.some((error) => error.property === 'estado')).toBe(true);
    }
  });

  it('rechaza page y limit inválidos', async () => {
    expect(
      (await validateQuery({ page: '0' })).errors.some(
        (error) => error.property === 'page',
      ),
    ).toBe(true);
    expect(
      (await validateQuery({ page: '-1' })).errors.some(
        (error) => error.property === 'page',
      ),
    ).toBe(true);
    expect(
      (await validateQuery({ page: 'abc' })).errors.some(
        (error) => error.property === 'page',
      ),
    ).toBe(true);
    expect(
      (await validateQuery({ limit: '0' })).errors.some(
        (error) => error.property === 'limit',
      ),
    ).toBe(true);
    expect(
      (await validateQuery({ limit: '-10' })).errors.some(
        (error) => error.property === 'limit',
      ),
    ).toBe(true);
    expect(
      (await validateQuery({ limit: 'abc' })).errors.some(
        (error) => error.property === 'limit',
      ),
    ).toBe(true);
    expect(
      (await validateQuery({ limit: ADMIN_AVERIAS_LIMIT_MAX + 1 })).errors.some(
        (error) => error.property === 'limit',
      ),
    ).toBe(true);
  });

  it('rechaza fontaneroId no entero o no positivo', async () => {
    expect(
      (await validateQuery({ fontaneroId: 'abc' })).errors.some(
        (error) => error.property === 'fontaneroId',
      ),
    ).toBe(true);
    expect(
      (await validateQuery({ fontaneroId: '0' })).errors.some(
        (error) => error.property === 'fontaneroId',
      ),
    ).toBe(true);
    expect(
      (await validateQuery({ fontaneroId: '-3' })).errors.some(
        (error) => error.property === 'fontaneroId',
      ),
    ).toBe(true);
  });

  it('acepta fechas YYYY-MM-DD y rechaza formatos ambiguos', async () => {
    const valid = await validateQuery({
      fechaDesde: '2026-09-01',
      fechaHasta: '2026-09-12',
    });
    expect(valid.errors).toHaveLength(0);
    expect(valid.dto.fechaDesde).toBe('2026-09-01');
    expect(valid.dto.fechaHasta).toBe('2026-09-12');

    expect(
      (await validateQuery({ fechaDesde: '01/02/2026' })).errors.some(
        (error) => error.property === 'fechaDesde',
      ),
    ).toBe(true);
    expect(
      (await validateQuery({ fechaHasta: '2026-09-12T10:00:00Z' })).errors.some(
        (error) => error.property === 'fechaHasta',
      ),
    ).toBe(true);
  });
});
