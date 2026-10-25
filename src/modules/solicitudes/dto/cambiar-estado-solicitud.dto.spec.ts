import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EstadoSolicitud } from '../../../common/enums/estado-solicitud.enum';
import { CambiarEstadoSolicitudDto } from './cambiar-estado-solicitud.dto';

describe('CambiarEstadoSolicitudDto', () => {
  const validar = async (plain: Record<string, unknown>) => {
    const dto = plainToInstance(CambiarEstadoSolicitudDto, plain);
    return validate(dto);
  };

  it('acepta estadoNuevo oficial con observaciones opcionales', async () => {
    const errors = await validar({
      estadoNuevo: EstadoSolicitud.EN_REVISION,
      observacionPublica: 'Mensaje público',
      notaInterna: 'Nota interna',
    });
    expect(errors).toHaveLength(0);
  });

  it('rechaza estadoNuevo no oficial', async () => {
    const errors = await validar({ estadoNuevo: 'URGENTE' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'estadoNuevo')).toBe(true);
  });

  it('rechaza textos que exceden 1000 caracteres', async () => {
    const largo = 'x'.repeat(1001);
    const errors = await validar({
      estadoNuevo: EstadoSolicitud.RECHAZADA,
      observacionPublica: largo,
      notaInterna: largo,
    });
    expect(errors.some((e) => e.property === 'observacionPublica')).toBe(true);
    expect(errors.some((e) => e.property === 'notaInterna')).toBe(true);
  });
});
