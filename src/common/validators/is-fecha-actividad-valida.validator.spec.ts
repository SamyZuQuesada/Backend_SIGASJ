import {
  getFechaActividadValidationError,
  isFechaActividadValida,
  parseFechaActividad,
} from './is-fecha-actividad-valida.validator';

describe('isFechaActividadValida', () => {
  const now = new Date('2026-09-07T15:30:00.000Z');

  it('acepta una fecha válida del día actual o anterior', () => {
    expect(isFechaActividadValida('2026-09-07', now)).toBe(true);
    expect(isFechaActividadValida('2026-01-01', now)).toBe(true);
  });

  it('rechaza fechas futuras', () => {
    expect(getFechaActividadValidationError('2026-09-08', now)).toBe('futura');
    expect(isFechaActividadValida('2026-09-08', now)).toBe(false);
  });

  it('rechaza formatos inválidos', () => {
    expect(getFechaActividadValidationError('07-09-2026', now)).toBe('formato');
    expect(getFechaActividadValidationError('2026/09/07', now)).toBe('formato');
  });

  it('rechaza fechas de calendario inválidas', () => {
    expect(getFechaActividadValidationError('2026-02-31', now)).toBe(
      'calendario',
    );
    expect(parseFechaActividad('2026-02-31')).toBeNull();
  });
});
