import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OBSERVACION_AVERIA_MAX_LENGTH } from './create-observacion-averia.dto';
import {
  OBSERVACION_FINAL_VACIA,
  ResolverAveriaDto,
} from './resolver-averia.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(ResolverAveriaDto, payload);
  const errors = await validate(dto);
  return { dto, errors };
}

describe('ResolverAveriaDto', () => {
  it('acepta observacionFinal válida y recorta espacios', async () => {
    const { dto, errors } = await validateDto({
      observacionFinal:
        '  Se reemplazó el tramo dañado y se verificó la presión.  ',
    });
    expect(errors).toHaveLength(0);
    expect(dto.observacionFinal).toBe(
      'Se reemplazó el tramo dañado y se verificó la presión.',
    );
  });

  it('rechaza texto vacío', async () => {
    const { errors } = await validateDto({ observacionFinal: '' });
    expect(
      errors.some((error) =>
        Object.values(error.constraints ?? {}).includes(OBSERVACION_FINAL_VACIA),
      ),
    ).toBe(true);
  });

  it('rechaza solo espacios', async () => {
    const { dto, errors } = await validateDto({ observacionFinal: '    ' });
    expect(dto.observacionFinal).toBe('');
    expect(errors.some((error) => error.property === 'observacionFinal')).toBe(
      true,
    );
  });

  it('acepta únicamente observacionFinal como campo del DTO', async () => {
    const { dto, errors } = await validateDto({
      observacionFinal: 'Trabajo concluido.',
    });
    expect(errors).toHaveLength(0);
    expect(Object.keys(dto)).toEqual(['observacionFinal']);
  });

  it('rechaza textos que superan el máximo', async () => {
    const { errors } = await validateDto({
      observacionFinal: 'a'.repeat(OBSERVACION_AVERIA_MAX_LENGTH + 1),
    });
    expect(errors.some((error) => error.property === 'observacionFinal')).toBe(
      true,
    );
  });
});
