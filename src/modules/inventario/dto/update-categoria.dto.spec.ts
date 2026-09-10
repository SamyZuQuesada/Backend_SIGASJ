import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateCategoriaDto } from './update-categoria.dto';

async function validateUpdate(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdateCategoriaDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('UpdateCategoriaDto — validaciones de entrada', () => {
  it('acepta payload vacío (sin modificaciones)', async () => {
    const { errors } = await validateUpdate({});
    expect(errors).toHaveLength(0);
  });

  it('acepta y sanitiza actualización de nombre y descripción', async () => {
    const { dto, errors } = await validateUpdate({
      nombre: '  Tuberías PEAD  ',
      descripcion: '  Para líneas de alta presión  ',
    });

    expect(errors).toHaveLength(0);
    expect(dto.nombre).toBe('Tuberías PEAD');
    expect(dto.descripcion).toBe('Para líneas de alta presión');
  });

  it('rechaza si el nombre se envía vacío o solo con espacios', async () => {
    const { errors } = await validateUpdate({
      nombre: '   ',
    });
    expect(errors.some((e) => e.property === 'nombre')).toBe(true);
  });

  it('rechaza si el nombre excede 100 caracteres', async () => {
    const { errors } = await validateUpdate({
      nombre: 'N'.repeat(101),
    });
    expect(errors.some((e) => e.property === 'nombre')).toBe(true);
  });

  it('rechaza si la descripción excede 500 caracteres', async () => {
    const { errors } = await validateUpdate({
      descripcion: 'D'.repeat(501),
    });
    expect(errors.some((e) => e.property === 'descripcion')).toBe(true);
  });

  it('transforma descripción con solo espacios en blanco a undefined', async () => {
    const { dto, errors } = await validateUpdate({
      descripcion: '   ',
    });
    expect(errors).toHaveLength(0);
    expect(dto.descripcion).toBeUndefined();
  });
});
