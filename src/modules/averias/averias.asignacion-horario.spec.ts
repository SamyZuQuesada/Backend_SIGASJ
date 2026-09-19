import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import {
  MOTIVO_DENTRO_DE_HORARIO,
  MOTIVO_FUERA_DE_HORARIO,
  MOTIVO_SIN_HORARIO,
  ResultadoHorarioLaboral,
  type EvaluacionHorarioLaboral,
} from '../usuarios/validacion-horario-laboral-fontanero';
import {
  EVENTO_SMS_FONTANERO_FUERA_DE_HORARIO,
  estadoTrasValidarHorarioAsignacion,
  prepararEventoNotificacionHorarioAsignacion,
} from './averias.asignacion-horario';
import { esTransicionEstadoAveriaValida } from './averias.estado-transiciones';

const baseEvaluacion = (
  overrides: Partial<EvaluacionHorarioLaboral>,
): EvaluacionHorarioLaboral => ({
  resultado: ResultadoHorarioLaboral.DENTRO_DE_HORARIO,
  puedeIniciarAtencion: true,
  idFontanero: 7,
  momento: '2026-09-21T16:00:00.000Z',
  diaSemana: 1,
  horario: null,
  motivo: MOTIVO_DENTRO_DE_HORARIO,
  ...overrides,
});

describe('estadoTrasValidarHorarioAsignacion', () => {
  it('mantiene ASIGNADA solo cuando el Fontanero está dentro de jornada', () => {
    expect(
      estadoTrasValidarHorarioAsignacion(baseEvaluacion({})),
    ).toBe(EstadoAveria.ASIGNADA);
  });

  it('pasa a PENDIENTE si está fuera, sin horario o incompleto', () => {
    expect(
      estadoTrasValidarHorarioAsignacion(
        baseEvaluacion({
          resultado: ResultadoHorarioLaboral.FUERA_DE_HORARIO,
          puedeIniciarAtencion: false,
          motivo: MOTIVO_FUERA_DE_HORARIO,
        }),
      ),
    ).toBe(EstadoAveria.PENDIENTE);
    expect(
      estadoTrasValidarHorarioAsignacion(
        baseEvaluacion({
          resultado: ResultadoHorarioLaboral.SIN_HORARIO_CONFIGURADO,
          puedeIniciarAtencion: false,
          motivo: MOTIVO_SIN_HORARIO,
        }),
      ),
    ).toBe(EstadoAveria.PENDIENTE);
    expect(
      estadoTrasValidarHorarioAsignacion(
        baseEvaluacion({
          resultado: ResultadoHorarioLaboral.HORARIO_INCOMPLETO,
          puedeIniciarAtencion: false,
          motivo: 'incompleto',
        }),
      ),
    ).toBe(EstadoAveria.PENDIENTE);
  });

  it('nunca propone un estado Fuera de horario', () => {
    const estado = estadoTrasValidarHorarioAsignacion(
      baseEvaluacion({
        resultado: ResultadoHorarioLaboral.FUERA_DE_HORARIO,
        puedeIniciarAtencion: false,
      }),
    );
    expect(estado).toBe(EstadoAveria.PENDIENTE);
    expect(Object.values(EstadoAveria)).not.toContain('FUERA_DE_HORARIO');
    expect(
      esTransicionEstadoAveriaValida(EstadoAveria.ASIGNADA, estado),
    ).toBe(true);
  });
});

describe('prepararEventoNotificacionHorarioAsignacion', () => {
  it('no arma SMS cuando permanece Asignada', () => {
    expect(
      prepararEventoNotificacionHorarioAsignacion({
        idAveria: 1,
        codigoSeguimiento: 'AV-1',
        telefonoReportante: '8888-1111',
        idFontanero: 7,
        evaluacion: baseEvaluacion({}),
      }),
    ).toBeNull();
  });

  it('prepara el evento de fuera de horario sin enviarlo', () => {
    const evento = prepararEventoNotificacionHorarioAsignacion({
      idAveria: 25,
      codigoSeguimiento: 'AV-ASG-HOR',
      telefonoReportante: '8888-1111',
      idFontanero: 7,
      evaluacion: baseEvaluacion({
        resultado: ResultadoHorarioLaboral.FUERA_DE_HORARIO,
        puedeIniciarAtencion: false,
        motivo: MOTIVO_FUERA_DE_HORARIO,
      }),
    });
    expect(evento).toEqual({
      tipo: EVENTO_SMS_FONTANERO_FUERA_DE_HORARIO,
      destinatario: 'reportante',
      idAveria: 25,
      codigoSeguimiento: 'AV-ASG-HOR',
      telefonoReportante: '8888-1111',
      idFontanero: 7,
      resultadoHorario: ResultadoHorarioLaboral.FUERA_DE_HORARIO,
      motivo: MOTIVO_FUERA_DE_HORARIO,
    });
  });
});
