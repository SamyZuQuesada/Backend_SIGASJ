import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CambiarEstadoMaterialDto } from './cambiar-estado-material.dto';

async function validateCambiarEstado(payload: Record<string, unknown>) {
  const dto = plainToInstance(CambiarEstadoMaterialDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('CambiarEstadoMaterialDto — validaciones de entrada', () => {
  it('acepta booleano true directamente', async () => {
    const { dto, errors } = await validateCambiarEstado({ activo: true });
    expect(errors).toHaveLength(0);
    expect(dto.activo).toBe(true);
  });

  it('acepta booleano false directamente', async () => {
    const { dto, errors } = await validateCambiarEstado({ activo: false });
    expect(errors).toHaveLength(0);
    expect(dto.activo).toBe(false);
  });

  it('transforma strings "Activo", "activo" o "1" a true', async () => {
    const res1 = await validateCambiarEstado({ activo: 'Activo' });
    expect(res1.errors).toHaveLength(0);
    expect(res1.dto.activo).toBe(true);

    const res2 = await validateCambiarEstado({ activo: '  activo  ' });
    expect(res2.errors).toHaveLength(0);
    expect(res2.dto.activo).toBe(true);

    const res3 = await validateCambiarEstado({ activo: '1' });
    expect(res3.errors).toHaveLength(0);
    expect(res3.dto.activo).toBe(true);
  });

  it('transforma strings "Inactivo", "inactivo" o "0" a false', async () => {
    const res1 = await validateCambiarEstado({ activo: 'Inactivo' });
    expect(res1.errors).toHaveLength(0);
    expect(res1.dto.activo).toBe(false);

    const res2 = await validateCambiarEstado({ activo: '  inactivo  ' });
    expect(res2.errors).toHaveLength(0);
    expect(res2.dto.activo).toBe(false);

    const res3 = await validateCambiarEstado({ activo: '0' });
    expect(res3.errors).toHaveLength(0);
    expect(res3.dto.activo).toBe(false);
  });

  it('rechaza si falta el campo activo', async () => {
    const { errors } = await validateCambiarEstado({});
    expect(errors.some((e) => e.property === 'activo')).toBe(true);
  });

  it('rechaza si el valor no es un booleano ni texto válido de estado', async () => {
    const { errors } = await validateCambiarEstado({
      activo: 'estado_invalido',
    });
    const error = errors.find((e) => e.property === 'activo');
    expect(error).toBeDefined();
    expect(error?.constraints?.isBoolean).toBeDefined();
  });
});
