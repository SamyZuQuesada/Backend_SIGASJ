import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EstadoProyecto } from '../../../common/enums/estado-proyecto.enum';
import { CreateProyectoDto } from './create-proyecto.dto';

async function validateCreate(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateProyectoDto, payload, {
    enableImplicitConversion: true,
  });
  return validate(dto);
}

describe('CreateProyectoDto — estado y visibilidad', () => {
  it('acepta únicamente los estados de 9.1.4', async () => {
    for (const estado of Object.values(EstadoProyecto)) {
      const errors = await validateCreate({
        nombre: 'Ampliación de acueducto',
        estado,
      });
      expect(errors).toHaveLength(0);
    }
  });

  it('rechaza un estado no reconocido y no deja pasar el DTO', async () => {
    const errors = await validateCreate({
      nombre: 'Ampliación de acueducto',
      estado: 'Inactivo',
    });

    const estadoError = errors.find((error) => error.property === 'estado');
    expect(estadoError).toBeDefined();
    expect(estadoError?.constraints).toEqual(
      expect.objectContaining({
        isEnum: 'El estado debe ser PENDIENTE, EN_PROCESO o COMPLETADO',
      }),
    );
  });

  it('no declara campos de visibilidad ni auditoría para el alta', () => {
    const dto = new CreateProyectoDto();
    expect(dto).not.toHaveProperty('activo');
    expect(dto).not.toHaveProperty('id');
    expect(dto).not.toHaveProperty('createdAt');
    expect(dto).not.toHaveProperty('updatedAt');
  });

  it('rechaza descripción, encargado y duración cuando no son texto', async () => {
    const descriptionErrors = await validateCreate({
      nombre: 'Ampliación de acueducto',
      descripcion: { texto: 'no es un string' },
    });
    expect(
      descriptionErrors.some((error) => error.property === 'descripcion'),
    ).toBe(true);

    const encargadoErrors = await validateCreate({
      nombre: 'Ampliación de acueducto',
      encargadoRealizacion: ['Ing. María'],
    });
    expect(
      encargadoErrors.some(
        (error) => error.property === 'encargadoRealizacion',
      ),
    ).toBe(true);

    const duracionErrors = await validateCreate({
      nombre: 'Ampliación de acueducto',
      duracion: { meses: 8 },
    });
    expect(duracionErrors.some((error) => error.property === 'duracion')).toBe(
      true,
    );
  });
});
