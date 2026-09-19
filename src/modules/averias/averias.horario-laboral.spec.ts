import { InternalServerErrorException } from '@nestjs/common';
import { AveriasService } from './averias.service';
import {
  ResultadoHorarioLaboral,
  ValidacionHorarioLaboralFontaneroService,
} from './averias.horario-laboral';

describe('AveriasService horario laboral', () => {
  it('expone la validación centralizada para asignación e inicio de atención', async () => {
    const evaluacion = {
      resultado: ResultadoHorarioLaboral.DENTRO_DE_HORARIO,
      puedeIniciarAtencion: true,
      idFontanero: 7,
      momento: '2026-09-21T16:00:00.000Z',
      diaSemana: 1,
      horario: {
        id: 1,
        diaSemana: 1,
        horaInicio: '07:00:00',
        horaFin: '16:00:00',
        activo: true,
      },
      motivo: 'El Fontanero se encuentra dentro de su horario laboral.',
    };
    const validacion = {
      evaluarAhora: jest.fn().mockResolvedValue(evaluacion),
    };
    const service = new AveriasService(
      {} as never,
      {} as never,
      undefined,
      validacion as unknown as ValidacionHorarioLaboralFontaneroService,
    );

    await expect(service.evaluarHorarioLaboralFontanero(7)).resolves.toEqual(
      evaluacion,
    );
    expect(validacion.evaluarAhora).toHaveBeenCalledWith(7);
  });

  it('no permite que el Frontend inyecte la hora de validación', () => {
    const service = new AveriasService({} as never, {} as never);
    expect(service.evaluarHorarioLaboralFontanero).toHaveLength(1);
  });

  it('falla de forma explícita si el servicio de horario no está cableado', () => {
    const service = new AveriasService({} as never, {} as never);
    expect(() => service.evaluarHorarioLaboralFontanero(3)).toThrow(
      InternalServerErrorException,
    );
  });
});
