import {
  DIA_SEMANA_LABELS,
  DIAS_SEMANA,
  DiaSemana,
  diaSemanaDesdeFecha,
  isDiaSemanaValido,
} from './dia-semana.enum';

describe('DiaSemana', () => {
  it('cubre lunes a domingo con valores ISO 1 a 7', () => {
    expect(DIAS_SEMANA).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(DiaSemana.LUNES).toBe(1);
    expect(DiaSemana.DOMINGO).toBe(7);
  });

  it('acepta solo enteros del 1 al 7', () => {
    expect(isDiaSemanaValido(DiaSemana.LUNES)).toBe(true);
    expect(isDiaSemanaValido(DiaSemana.VIERNES)).toBe(true);
    expect(isDiaSemanaValido(0)).toBe(false);
    expect(isDiaSemanaValido(8)).toBe(false);
    expect(isDiaSemanaValido(1.5)).toBe(false);
    expect(isDiaSemanaValido('LUNES')).toBe(false);
  });

  it('expone etiquetas en español', () => {
    expect(DIA_SEMANA_LABELS[DiaSemana.LUNES]).toBe('Lunes');
    expect(DIA_SEMANA_LABELS[DiaSemana.MIERCOLES]).toBe('Miércoles');
    expect(DIA_SEMANA_LABELS[DiaSemana.DOMINGO]).toBe('Domingo');
  });

  it('convierte Date.getDay() a ISO (lunes = 1)', () => {
    // 2026-09-21 es lunes.
    expect(diaSemanaDesdeFecha(new Date(2026, 8, 21, 10, 0, 0))).toBe(
      DiaSemana.LUNES,
    );
    expect(diaSemanaDesdeFecha(new Date(2026, 8, 27, 10, 0, 0))).toBe(
      DiaSemana.DOMINGO,
    );
  });
});
