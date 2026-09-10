import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCategoriaDto } from './create-categoria.dto';

async function validateCreate(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateCategoriaDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('CreateCategoriaDto — validaciones de entrada', () => {
  it('acepta una categoría con todos los campos válidos y aplica trim', async () => {
    const { dto, errors } = await validateCreate({
      nombre: '  Tuberías y Mangueras  ',
      descripcion: '  Líneas principales de distribución  ',
    });

    expect(errors).toHaveLength(0);
    expect(dto.nombre).toBe('Tuberías y Mangueras');
    expect(dto.descripcion).toBe('Líneas principales de distribución');
  });

  it('acepta una categoría con solo el nombre obligatorio', async () => {
    const { dto, errors } = await validateCreate({
      nombre: 'Accesorios PVC',
    });

    expect(errors).toHaveLength(0);
    expect(dto.nombre).toBe('Accesorios PVC');
    expect(dto.descripcion).toBeUndefined();
  });

  it('rechaza si falta el nombre o solo tiene espacios en blanco', async () => {
    const { errors: errorsFalta } = await validateCreate({});
    expect(errorsFalta.some((e) => e.property === 'nombre')).toBe(true);

    const { errors: errorsEspacios } = await validateCreate({
      nombre: '    ',
    });
    expect(errorsEspacios.some((e) => e.property === 'nombre')).toBe(true);
  });

  it('rechaza si el nombre no es string', async () => {
    const { errors } = await validateCreate({
      nombre: 12345,
    });
    expect(errors.some((e) => e.property === 'nombre')).toBe(true);
  });

  it('rechaza si el nombre excede 100 caracteres', async () => {
    const { errors } = await validateCreate({
      nombre: 'A'.repeat(101),
    });
    expect(errors.some((e) => e.property === 'nombre')).toBe(true);
  });

  it('rechaza si la descripción excede 500 caracteres', async () => {
    const { errors } = await validateCreate({
      nombre: 'Válvulas',
      descripcion: 'D'.repeat(501),
    });
    expect(errors.some((e) => e.property === 'descripcion')).toBe(true);
  });

  it('transforma descripción con solo espacios en blanco a undefined', async () => {
    const { dto, errors } = await validateCreate({
      nombre: 'Válvulas',
      descripcion: '   ',
    });
    expect(errors).toHaveLength(0);
    expect(dto.descripcion).toBeUndefined();
  });
});
