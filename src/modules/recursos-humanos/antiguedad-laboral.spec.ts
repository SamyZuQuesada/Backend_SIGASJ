import { calcularAntiguedad } from './antiguedad-laboral';

describe('calcularAntiguedad', () => {
  it('devuelve null sin fecha o con fecha inválida', () => {
    expect(calcularAntiguedad(null)).toBeNull();
    expect(calcularAntiguedad(undefined)).toBeNull();
    expect(calcularAntiguedad('')).toBeNull();
    expect(calcularAntiguedad('2020-13-01')).toBeNull();
  });

  it('devuelve null si la fecha de ingreso es futura', () => {
    expect(
      calcularAntiguedad('2099-01-01', new Date('2026-11-15T18:00:00Z')),
    ).toBeNull();
  });

  it('calcula años, meses y días desde la fecha de ingreso', () => {
    const result = calcularAntiguedad(
      '2024-01-15',
      new Date('2026-03-20T18:00:00Z'),
    );
    expect(result).toMatchObject({
      anios: 2,
      meses: 2,
      dias: 5,
      totalDias: expect.any(Number),
      totalSemanas: expect.any(Number),
    });
    expect(result?.etiqueta).toContain('2 años');
    expect(result?.etiqueta).toContain('2 meses');
    expect(result?.totalDias).toBeGreaterThan(700);
  });

  it('marca cero años para un ingreso reciente', () => {
    const result = calcularAntiguedad(
      '2026-11-01',
      new Date('2026-11-15T18:00:00Z'),
    );
    expect(result).toMatchObject({
      anios: 0,
      meses: 0,
      dias: 14,
      totalSemanas: 2,
    });
    expect(result?.etiqueta).toBe('14 días');
  });
});
