import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConsultarSeguimientoSolicitudDto } from './consultar-seguimiento-solicitud.dto';

describe('ConsultarSeguimientoSolicitudDto', () => {
  const validar = async (plain: Record<string, unknown>) => {
    const dto = plainToInstance(ConsultarSeguimientoSolicitudDto, plain);
    return { dto, errors: await validate(dto) };
  };

  it('acepta código e identificación válidos y normaliza código', async () => {
    const { dto, errors } = await validar({
      codigo: '  sol-2026-00001  ',
      identificacion: '  01-0234-0567  ',
    });
    expect(errors).toHaveLength(0);
    expect(dto.codigo).toBe('SOL-2026-00001');
    expect(dto.identificacion).toBe('01-0234-0567');
  });

  it('rechaza código sin identificación', async () => {
    const { errors } = await validar({ codigo: 'SOL-2026-00001' });
    expect(errors.some((e) => e.property === 'identificacion')).toBe(true);
  });

  it('rechaza identificación sin código', async () => {
    const { errors } = await validar({ identificacion: '1-1234-0567' });
    expect(errors.some((e) => e.property === 'codigo')).toBe(true);
  });

  it('rechaza ambos vacíos', async () => {
    const { errors } = await validar({ codigo: '', identificacion: '' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rechaza formato de código inválido', async () => {
    const { errors } = await validar({
      codigo: 'ABC-123',
      identificacion: '1-1234-0567',
    });
    expect(errors.some((e) => e.property === 'codigo')).toBe(true);
  });

  it('conserva ceros y guiones en identificación (string)', async () => {
    const { dto, errors } = await validar({
      codigo: 'SOL-2026-00001',
      identificacion: '01-0234-0005',
    });
    expect(errors).toHaveLength(0);
    expect(dto.identificacion).toBe('01-0234-0005');
    expect(typeof dto.identificacion).toBe('string');
  });
});
