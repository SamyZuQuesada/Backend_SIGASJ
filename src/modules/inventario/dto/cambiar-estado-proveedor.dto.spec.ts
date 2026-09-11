import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CambiarEstadoProveedorDto } from './cambiar-estado-proveedor.dto';

async function validateEstado(payload: Record<string, unknown>) {
  const dto = plainToInstance(CambiarEstadoProveedorDto, payload);
  const errors = await validate(dto);
  return { dto, errors };
}

describe('CambiarEstadoProveedorDto — validaciones de entrada', () => {
  it('acepta booleanos directos (true / false)', async () => {
    const { dto: dtoTrue, errors: errorsTrue } = await validateEstado({
      activo: true,
    });
    expect(errorsTrue).toHaveLength(0);
    expect(dtoTrue.activo).toBe(true);

    const { dto: dtoFalse, errors: errorsFalse } = await validateEstado({
      activo: false,
    });
    expect(errorsFalse).toHaveLength(0);
    expect(dtoFalse.activo).toBe(false);
  });

  it('acepta y transforma strings equivalentes a activo/inactivo', async () => {
    const { dto: dtoActivo, errors: errActivo } = await validateEstado({
      activo: 'Activo',
    });
    expect(errActivo).toHaveLength(0);
    expect(dtoActivo.activo).toBe(true);

    const { dto: dtoInactivo, errors: errInactivo } = await validateEstado({
      activo: 'Inactivo',
    });
    expect(errInactivo).toHaveLength(0);
    expect(dtoInactivo.activo).toBe(false);
  });

  it('rechaza valores no booleanos ni equivalentes', async () => {
    const { errors } = await validateEstado({
      activo: 'estado_invalido',
    });
    expect(errors.some((e) => e.property === 'activo')).toBe(true);
  });

  it('rechaza si falta la propiedad activo', async () => {
    const { errors } = await validateEstado({});
    expect(errors.some((e) => e.property === 'activo')).toBe(true);
  });
});
