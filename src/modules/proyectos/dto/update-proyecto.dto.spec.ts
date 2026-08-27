import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProyectoDto } from './update-proyecto.dto';

async function validateUpdate(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdateProyectoDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('UpdateProyectoDto', () => {
  it('acepta un body vacío como actualización parcial', async () => {
    const { dto, errors } = await validateUpdate({});
    expect(errors).toHaveLength(0);
    expect(dto.nombre).toBeUndefined();
    expect(dto.descripcion).toBeUndefined();
    expect(dto.encargadoRealizacion).toBeUndefined();
    expect(dto.duracion).toBeUndefined();
  });

  it('acepta únicamente el nombre', async () => {
    const { dto, errors } = await validateUpdate({
      nombre: '  Nuevo nombre  ',
    });
    expect(errors).toHaveLength(0);
    expect(dto.nombre).toBe('Nuevo nombre');
    expect(dto.descripcion).toBeUndefined();
  });

  it('rechaza nombre vacío o solo espacios', async () => {
    const empty = await validateUpdate({ nombre: '' });
    expect(empty.errors.some((error) => error.property === 'nombre')).toBe(
      true,
    );

    const blank = await validateUpdate({ nombre: '   ' });
    expect(blank.errors.some((error) => error.property === 'nombre')).toBe(
      true,
    );
  });

  it('valida descripción, encargado y duración cuando se envían', async () => {
    const { errors } = await validateUpdate({
      descripcion: 'Ampliación de la red principal',
      encargadoRealizacion: 'Ing. María Rodríguez',
      duracion: '8 meses',
    });
    expect(errors).toHaveLength(0);

    const invalid = await validateUpdate({
      descripcion: { texto: 'no es un string' },
      encargadoRealizacion: ['Ing. María'],
      duracion: { meses: 8 },
    });
    expect(
      invalid.errors.some((error) => error.property === 'descripcion'),
    ).toBe(true);
    expect(
      invalid.errors.some((error) => error.property === 'encargadoRealizacion'),
    ).toBe(true);
    expect(invalid.errors.some((error) => error.property === 'duracion')).toBe(
      true,
    );
  });

  it('rechaza encargado y duración que exceden la longitud del modelo', async () => {
    const encargado = await validateUpdate({
      encargadoRealizacion: 'x'.repeat(151),
    });
    expect(
      encargado.errors.some(
        (error) => error.property === 'encargadoRealizacion',
      ),
    ).toBe(true);

    const duracion = await validateUpdate({ duracion: 'x'.repeat(101) });
    expect(duracion.errors.some((error) => error.property === 'duracion')).toBe(
      true,
    );
  });

  it('no declara campos internos ni de publicación', () => {
    const dto = new UpdateProyectoDto();
    expect(dto).not.toHaveProperty('id');
    expect(dto).not.toHaveProperty('estado');
    expect(dto).not.toHaveProperty('activo');
    expect(dto).not.toHaveProperty('imagenPrincipal');
    expect(dto).not.toHaveProperty('imagenes');
    expect(dto).not.toHaveProperty('createdAt');
    expect(dto).not.toHaveProperty('updatedAt');
    expect(dto).not.toHaveProperty('createdBy');
    expect(dto).not.toHaveProperty('idUsuarioCreador');
  });
});
