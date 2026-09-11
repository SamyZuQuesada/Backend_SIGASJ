import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProveedorDto } from './update-proveedor.dto';

async function validateUpdate(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdateProveedorDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('UpdateProveedorDto — validaciones de entrada', () => {
  it('acepta un payload vacío sin errores (todos los campos son opcionales)', async () => {
    const { errors } = await validateUpdate({});
    expect(errors).toHaveLength(0);
  });

  it('acepta actualización parcial de campos válidos con trim', async () => {
    const { dto, errors } = await validateUpdate({
      nombre: '  Nuevo Nombre Proveedor  ',
      telefono: '  8888-0000  ',
      correo: '  CONTACTO@PROVEEDOR.CR  ',
    });

    expect(errors).toHaveLength(0);
    expect(dto.nombre).toBe('Nuevo Nombre Proveedor');
    expect(dto.telefono).toBe('8888-0000');
    expect(dto.correo).toBe('contacto@proveedor.cr');
  });

  it('rechaza si el nombre se envía vacío o con solo espacios', async () => {
    const { errors } = await validateUpdate({
      nombre: '    ',
    });
    expect(errors.some((e) => e.property === 'nombre')).toBe(true);
  });

  it('rechaza si el correo tiene un formato inválido', async () => {
    const { errors } = await validateUpdate({
      correo: 'correo_invalido',
    });
    expect(errors.some((e) => e.property === 'correo')).toBe(true);
  });
});
