import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EstadoProyecto } from '../../../common/enums/estado-proyecto.enum';
import { QueryProyectosAdminDto } from './query-proyectos-admin.dto';

async function validateQuery(payload: Record<string, unknown>) {
  const dto = plainToInstance(QueryProyectosAdminDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('QueryProyectosAdminDto', () => {
  it('acepta una consulta sin filtros', async () => {
    const { dto, errors } = await validateQuery({});
    expect(errors).toHaveLength(0);
    expect(dto.nombre).toBeUndefined();
    expect(dto.estado).toBeUndefined();
    expect(dto.activo).toBeUndefined();
    expect(dto.page).toBeUndefined();
    expect(dto.limit).toBeUndefined();
  });

  it('recorta el nombre para búsqueda parcial', async () => {
    const { dto, errors } = await validateQuery({ nombre: '  acueducto  ' });
    expect(errors).toHaveLength(0);
    expect(dto.nombre).toBe('acueducto');
  });

  it('acepta únicamente los estados reales de Proyecto', async () => {
    for (const estado of Object.values(EstadoProyecto)) {
      const { errors } = await validateQuery({ estado });
      expect(errors).toHaveLength(0);
    }
  });

  it('rechaza un estado inválido', async () => {
    const { errors } = await validateQuery({ estado: 'EN_EJECUCION' });
    const estadoError = errors.find((error) => error.property === 'estado');
    expect(estadoError).toBeDefined();
    expect(estadoError?.constraints).toEqual(
      expect.objectContaining({
        isEnum: 'El estado debe ser PENDIENTE, EN_PROCESO o COMPLETADO',
      }),
    );
  });

  it('convierte el query param "false" en boolean false', async () => {
    const { dto, errors } = await validateQuery({ activo: 'false' });
    expect(errors).toHaveLength(0);
    expect(dto.activo).toBe(false);
  });

  it('convierte el query param "true" en boolean true', async () => {
    const { dto, errors } = await validateQuery({ activo: 'true' });
    expect(errors).toHaveLength(0);
    expect(dto.activo).toBe(true);
  });

  it('rechaza page menor a 1 y limit menor o igual a 0', async () => {
    const pageErrors = (await validateQuery({ page: '0' })).errors;
    expect(pageErrors.some((error) => error.property === 'page')).toBe(true);

    const limitErrors = (await validateQuery({ limit: '0' })).errors;
    expect(limitErrors.some((error) => error.property === 'limit')).toBe(true);
  });

  it('acepta page y limit enteros válidos', async () => {
    const { dto, errors } = await validateQuery({ page: '2', limit: '10' });
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(10);
  });
});
