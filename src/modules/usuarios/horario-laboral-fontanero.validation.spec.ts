import {
  MENSAJE_HORA_FORMATO_INVALIDO,
  esHoraInicioAnteriorAFin,
  horaLaboralASegundos,
  segundosDesdeMedianoche,
  normalizarHoraLaboral,
} from './horario-laboral-fontanero.validation';

describe('Validación de hora laboral', () => {
  it('normaliza HH:mm y HH:mm:ss', () => {
    expect(normalizarHoraLaboral('07:00')).toBe('07:00:00');
    expect(normalizarHoraLaboral('16:00:00')).toBe('16:00:00');
    expect(normalizarHoraLaboral(' 09:30 ')).toBe('09:30:00');
  });

  it('rechaza horas inválidas', () => {
    expect(normalizarHoraLaboral('24:00')).toBeNull();
    expect(normalizarHoraLaboral('07:60')).toBeNull();
    expect(normalizarHoraLaboral('7:00')).toBeNull();
    expect(normalizarHoraLaboral('')).toBeNull();
    expect(normalizarHoraLaboral(null)).toBeNull();
    expect(MENSAJE_HORA_FORMATO_INVALIDO).toContain('HH:mm');
  });

  it('exige hora de inicio anterior a la de finalización', () => {
    expect(esHoraInicioAnteriorAFin('07:00', '16:00')).toBe(true);
    expect(esHoraInicioAnteriorAFin('07:00:00', '07:00:00')).toBe(false);
    expect(esHoraInicioAnteriorAFin('16:00', '07:00')).toBe(false);
    expect(esHoraInicioAnteriorAFin('25:00', '16:00')).toBe(false);
  });

  it('convierte hora a segundos desde medianoche', () => {
    expect(horaLaboralASegundos('07:00')).toBe(7 * 3600);
    expect(horaLaboralASegundos('16:00:30')).toBe(16 * 3600 + 30);
    expect(horaLaboralASegundos('99:00')).toBeNull();
  });

  it('obtiene el instante del día desde un Date local', () => {
    const momento = new Date(2026, 8, 21, 7, 30, 0);
    expect(segundosDesdeMedianoche(momento)).toBe(7 * 3600 + 30 * 60);
  });
});
