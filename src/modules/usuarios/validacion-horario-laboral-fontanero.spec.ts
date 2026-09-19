import { BadRequestException } from '@nestjs/common';
import { DiaSemana } from '../../common/enums/dia-semana.enum';
import { fechaEnAsada, partesLaboralesEnAsada } from '../../common/time/reloj-asada';
import {
  assertPuedeIniciarAtencionPorHorario,
  compararInstanteConHorario,
  MOTIVO_SIN_HORARIO,
  ResultadoHorarioLaboral,
  type EvaluacionHorarioLaboral,
} from './validacion-horario-laboral-fontanero';

describe('compararInstanteConHorario', () => {
  it('detecta dentro, fuera e incompleto', () => {
    const diez = 10 * 3600;
    expect(compararInstanteConHorario('07:00', '16:00', diez)).toBe('dentro');
    expect(compararInstanteConHorario('07:00', '16:00', 16 * 3600)).toBe('fuera');
    expect(compararInstanteConHorario('07:00', '07:00', diez)).toBe('incompleto');
    expect(compararInstanteConHorario('', '16:00', diez)).toBe('incompleto');
  });
});

describe('assertPuedeIniciarAtencionPorHorario', () => {
  const base: EvaluacionHorarioLaboral = {
    resultado: ResultadoHorarioLaboral.SIN_HORARIO_CONFIGURADO,
    puedeIniciarAtencion: false,
    idFontanero: 3,
    momento: new Date().toISOString(),
    diaSemana: DiaSemana.LUNES,
    horario: null,
    motivo: MOTIVO_SIN_HORARIO,
  };

  it('permite iniciar solo cuando está dentro de horario', () => {
    expect(() =>
      assertPuedeIniciarAtencionPorHorario({
        ...base,
        resultado: ResultadoHorarioLaboral.DENTRO_DE_HORARIO,
        puedeIniciarAtencion: true,
        motivo: 'ok',
      }),
    ).not.toThrow();
  });

  it('no asume que sin horario se puede iniciar atención', () => {
    expect(() => assertPuedeIniciarAtencionPorHorario(base)).toThrow(
      BadRequestException,
    );
    expect(() => assertPuedeIniciarAtencionPorHorario(base)).toThrow(
      MOTIVO_SIN_HORARIO,
    );
  });
});

describe('reloj ASADA', () => {
  it('resuelve lunes 10:00 de Costa Rica', () => {
    const momento = fechaEnAsada(2026, 8, 21, 10, 0, 0);
    const partes = partesLaboralesEnAsada(momento);
    expect(partes.diaSemana).toBe(DiaSemana.LUNES);
    expect(partes.segundosDesdeMedianoche).toBe(10 * 3600);
  });
});
