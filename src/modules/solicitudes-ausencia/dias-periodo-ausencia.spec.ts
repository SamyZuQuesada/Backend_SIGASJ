import {
  diasInclusiveEntreFechas,
  diasVacacionesNetos,
  resumenDiasVacaciones,
} from './dias-periodo-ausencia';

describe('diasInclusiveEntreFechas', () => {
  it('cuenta un solo día', () => {
    expect(diasInclusiveEntreFechas('2026-11-01', '2026-11-01')).toBe(1);
  });

  it('cuenta el rango inclusivo', () => {
    expect(diasInclusiveEntreFechas('2026-12-01', '2026-12-05')).toBe(5);
  });

  it('rechaza rangos invertidos', () => {
    expect(diasInclusiveEntreFechas('2026-12-05', '2026-12-01')).toBe(0);
  });
});

describe('diasVacacionesNetos (excluye feriados CR)', () => {
  it('no descuenta si no hay feriado en el periodo', () => {
    expect(diasVacacionesNetos('2026-11-01', '2026-11-05')).toBe(5);
  });

  it('excluye feriados de Semana Santa y Juan Santamaría', () => {
    // 1–12 abr 2026 = 12 días calendario; feriados 2, 3 y 11 abr → 9 netos
    const resumen = resumenDiasVacaciones('2026-04-01', '2026-04-12');
    expect(resumen.diasCalendario).toBe(12);
    expect(resumen.feriados.map((f) => f.fecha)).toEqual([
      '2026-04-02',
      '2026-04-03',
      '2026-04-11',
    ]);
    expect(resumen.diasNetos).toBe(9);
  });

  it('un solo día feriado cuenta 0 días netos', () => {
    expect(diasVacacionesNetos('2026-05-01', '2026-05-01')).toBe(0);
  });
});
