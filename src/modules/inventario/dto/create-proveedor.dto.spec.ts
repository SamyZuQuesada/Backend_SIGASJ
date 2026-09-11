import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProveedorDto } from './create-proveedor.dto';

async function validateCreate(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateProveedorDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('CreateProveedorDto — validaciones de entrada', () => {
  it('acepta un proveedor con todos los campos válidos y aplica trim', async () => {
    const { dto, errors } = await validateCreate({
      nombre: '  Ferretería El Lagar  ',
      razonSocial: '  El Lagar S.A.  ',
      identificacion: '  3-101-123456  ',
      telefono: '  2680-1122  ',
      correo: '  VENTAS@LAGAR.CR  ',
      direccion: '  Nicoya centro  ',
      personaContacto: '  Carlos Méndez  ',
    });

    expect(errors).toHaveLength(0);
    expect(dto.nombre).toBe('Ferretería El Lagar');
    expect(dto.razonSocial).toBe('El Lagar S.A.');
    expect(dto.identificacion).toBe('3-101-123456');
    expect(dto.telefono).toBe('2680-1122');
    expect(dto.correo).toBe('ventas@lagar.cr');
    expect(dto.direccion).toBe('Nicoya centro');
    expect(dto.personaContacto).toBe('Carlos Méndez');
  });

  it('acepta un proveedor con solo el nombre obligatorio', async () => {
    const { dto, errors } = await validateCreate({
      nombre: 'Ferretería Santa Cruz',
    });

    expect(errors).toHaveLength(0);
    expect(dto.nombre).toBe('Ferretería Santa Cruz');
    expect(dto.razonSocial).toBeUndefined();
    expect(dto.identificacion).toBeUndefined();
    expect(dto.telefono).toBeUndefined();
    expect(dto.correo).toBeUndefined();
    expect(dto.direccion).toBeUndefined();
    expect(dto.personaContacto).toBeUndefined();
  });

  it('rechaza si falta el nombre o solo tiene espacios en blanco', async () => {
    const { errors: errorsFalta } = await validateCreate({});
    expect(errorsFalta.some((e) => e.property === 'nombre')).toBe(true);

    const { errors: errorsEspacios } = await validateCreate({
      nombre: '    ',
    });
    expect(errorsEspacios.some((e) => e.property === 'nombre')).toBe(true);
  });

  it('rechaza si el nombre excede 150 caracteres', async () => {
    const { errors } = await validateCreate({
      nombre: 'A'.repeat(151),
    });
    expect(errors.some((e) => e.property === 'nombre')).toBe(true);
  });

  it('rechaza si el correo no tiene un formato de email válido', async () => {
    const { errors } = await validateCreate({
      nombre: 'Proveedor X',
      correo: 'correo-no-valido',
    });
    expect(errors.some((e) => e.property === 'correo')).toBe(true);
  });

  it('acepta correo vacío convirtiéndolo a undefined', async () => {
    const { dto, errors } = await validateCreate({
      nombre: 'Proveedor X',
      correo: '   ',
    });
    expect(errors).toHaveLength(0);
    expect(dto.correo).toBeUndefined();
  });

  it('rechaza si los campos exceden sus longitudes máximas', async () => {
    const { errors: errRazon } = await validateCreate({
      nombre: 'Valido',
      razonSocial: 'A'.repeat(201),
    });
    expect(errRazon.some((e) => e.property === 'razonSocial')).toBe(true);

    const { errors: errIden } = await validateCreate({
      nombre: 'Valido',
      identificacion: 'A'.repeat(51),
    });
    expect(errIden.some((e) => e.property === 'identificacion')).toBe(true);

    const { errors: errDir } = await validateCreate({
      nombre: 'Valido',
      direccion: 'A'.repeat(501),
    });
    expect(errDir.some((e) => e.property === 'direccion')).toBe(true);
  });
});
