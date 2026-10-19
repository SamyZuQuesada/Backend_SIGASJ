import { normalizarHoraLaboral } from './horario-laboral-fontanero.validation';

describe('normalizarHoraLaboral con valores del driver (columna time, useUTC)', () => {
  it('lee la hora desde los componentes UTC, sin depender del huso del servidor', () => {
    expect(normalizarHoraLaboral(new Date('1970-01-01T08:30:00.000Z'))).toBe(
      '08:30:00',
    );
    expect(normalizarHoraLaboral(new Date('1970-01-01T00:00:00.000Z'))).toBe(
      '00:00:00',
    );
    expect(normalizarHoraLaboral(new Date('1970-01-01T23:59:59.000Z'))).toBe(
      '23:59:59',
    );
  });

  it('sigue aceptando cadenas HH:mm y HH:mm:ss', () => {
    expect(normalizarHoraLaboral('07:00')).toBe('07:00:00');
    expect(normalizarHoraLaboral('17:45:10')).toBe('17:45:10');
    expect(normalizarHoraLaboral('25:00')).toBeNull();
  });
});
