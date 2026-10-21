import { ConfigService } from '@nestjs/config';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import { Averia } from './entities/averia.entity';
import { NotificacionCorreoAveriaService } from './notificacion-correo-averia.service';

describe('NotificacionCorreoAveriaService', () => {
  const buildAveria = (overrides: Partial<Averia> = {}): Averia =>
    ({
      id: 1,
      codigoSeguimiento: 'AV-2026-0001',
      nombreReportante: 'María Rodríguez',
      correoReportante: 'maria@example.com',
      ubicacion: 'Calle 1',
      sectorComunidad: 'San Juan',
      estado: EstadoAveria.RESUELTA,
      ...overrides,
    }) as Averia;

  it('omite el envío cuando no hay correo del reportante', async () => {
    const get = jest.fn();
    const service = new NotificacionCorreoAveriaService({
      get,
    } as unknown as ConfigService);
    const warn = jest.spyOn(service['logger'], 'warn').mockImplementation();

    await service.notificarReparacionExitosa(
      buildAveria({ correoReportante: null }),
    );

    expect(get).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('sin correo del reportante'),
    );
  });

  it('omite el envío cuando MAIL_ENABLED no está activo', async () => {
    const get = jest.fn((key: string) => {
      if (key === 'mail.enabled') return false;
      return undefined;
    });
    const service = new NotificacionCorreoAveriaService({
      get,
    } as unknown as ConfigService);
    const log = jest.spyOn(service['logger'], 'log').mockImplementation();

    await service.notificarReparacionExitosa(buildAveria());

    expect(get).toHaveBeenCalledWith('mail.enabled');
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('MAIL_ENABLED=false'),
    );
  });
});
