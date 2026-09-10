import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CambiarEstadoCategoriaDto } from './cambiar-estado-categoria.dto';

async function validateEstado(payload: Record<string, unknown>) {
  const dto = plainToInstance(CambiarEstadoCategoriaDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('CambiarEstadoCategoriaDto — validaciones de entrada', () => {
  it('acepta booleanos directos true y false', async () => {
    const resTrue = await validateEstado({ activo: true });
    expect(resTrue.errors).toHaveLength(0);
    expect(resTrue.dto.activo).toBe(true);

    const resFalse = await validateEstado({ activo: false });
    expect(resFalse.errors).toHaveLength(0);
    expect(resFalse.dto.activo).toBe(false);
  });

  it('acepta variantes textuales comunes ("Activo", "Inactivo", "true", "false")', async () => {
    const res1 = await validateEstado({ activo: 'Activo' });
    expect(res1.errors).toHaveLength(0);
    expect(res1.dto.activo).toBe(true);

    const res2 = await validateEstado({ activo: 'inactivo' });
    expect(res2.errors).toHaveLength(0);
    expect(res2.dto.activo).toBe(false);

    const res3 = await validateEstado({ activo: 'true' });
    expect(res3.errors).toHaveLength(0);
    expect(res3.dto.activo).toBe(true);

    const res4 = await validateEstado({ activo: 'false' });
    expect(res4.errors).toHaveLength(0);
    expect(res4.dto.activo).toBe(false);
  });

  it('rechaza si falta el campo activo', async () => {
    const { errors } = await validateEstado({});
    expect(errors.some((e) => e.property === 'activo')).toBe(true);
  });

  it('rechaza valores no booleanos ni textuales reconocidos', async () => {
    const { errors } = await validateEstado({ activo: 'desconocido' });
    expect(errors.some((e) => e.property === 'activo')).toBe(true);
  });
});
