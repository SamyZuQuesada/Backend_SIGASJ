import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateObservacionAveriaDto,
  OBSERVACION_AVERIA_MAX_LENGTH,
  OBSERVACION_AVERIA_VACIA,
} from './create-observacion-averia.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateObservacionAveriaDto, payload);
  const errors = await validate(dto);
  return { dto, errors };
}

describe('CreateObservacionAveriaDto', () => {
  it('acepta un texto válido y recorta espacios', async () => {
    const { dto, errors } = await validateDto({
      observacion: '  Se revisó la ubicación y se identificó la fuga.  ',
    });
    expect(errors).toHaveLength(0);
    expect(dto.observacion).toBe(
      'Se revisó la ubicación y se identificó la fuga.',
    );
  });

  it('rechaza texto vacío', async () => {
    const { errors } = await validateDto({ observacion: '' });
    expect(errors.some((error) => error.property === 'observacion')).toBe(true);
    expect(
      errors.some((error) =>
        Object.values(error.constraints ?? {}).includes(
          OBSERVACION_AVERIA_VACIA,
        ),
      ),
    ).toBe(true);
  });

  it('rechaza solo espacios', async () => {
    const { dto, errors } = await validateDto({ observacion: '       ' });
    expect(dto.observacion).toBe('');
    expect(errors.some((error) => error.property === 'observacion')).toBe(true);
  });

  it('rechaza ausencia de observacion', async () => {
    const { errors } = await validateDto({});
    expect(errors.some((error) => error.property === 'observacion')).toBe(true);
  });

  it('rechaza textos que superan el máximo', async () => {
    const { errors } = await validateDto({
      observacion: 'a'.repeat(OBSERVACION_AVERIA_MAX_LENGTH + 1),
    });
    expect(errors.some((error) => error.property === 'observacion')).toBe(true);
  });
});
