import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssignAveriaFontaneroDto } from './assign-averia-fontanero.dto';
import { UpdateAveriaEstadoDto } from './update-averia-estado.dto';

async function validateDto<T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
) {
  const dto = plainToInstance(cls, payload);
  const errors = await validate(dto);
  return { dto, errors };
}

describe('DTOs administrativos de avería (2.3 / 2.4)', () => {
  it('normaliza estado a mayúsculas', async () => {
    const { dto, errors } = await validateDto(UpdateAveriaEstadoDto, {
      estado: 'en_revision',
    });
    expect(errors).toHaveLength(0);
    expect(dto.estado).toBe('EN_REVISION');
  });

  it('acepta fontaneroId entero positivo y convierte string numérico', async () => {
    const { dto, errors } = await validateDto(AssignAveriaFontaneroDto, {
      fontaneroId: '7',
    });
    expect(errors).toHaveLength(0);
    expect(dto.fontaneroId).toBe(7);
  });

  it('rechaza fontaneroId UUID, 0 o ausente', async () => {
    expect(
      (await validateDto(AssignAveriaFontaneroDto, {})).errors.some(
        (error) => error.property === 'fontaneroId',
      ),
    ).toBe(true);
    expect(
      (
        await validateDto(AssignAveriaFontaneroDto, { fontaneroId: 0 })
      ).errors.some((error) => error.property === 'fontaneroId'),
    ).toBe(true);
    expect(
      (
        await validateDto(AssignAveriaFontaneroDto, {
          fontaneroId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        })
      ).errors.some((error) => error.property === 'fontaneroId'),
    ).toBe(true);
  });
});
