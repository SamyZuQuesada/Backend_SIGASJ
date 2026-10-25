import {
  domingoPascua,
  feriadosDelAnio,
  feriadosEnPeriodo,
} from './feriados-costa-rica';

describe('feriados-costa-rica', () => {
  it('calcula Pascua 2026 (5 de abril)', () => {
    expect(domingoPascua(2026)).toEqual({ mes: 4, dia: 5 });
  });

  it('incluye Jueves y Viernes Santo 2026 (2 y 3 de abril)', () => {
    const fechas = feriadosDelAnio(2026).map((f) => f.fecha);
    expect(fechas).toContain('2026-04-02');
    expect(fechas).toContain('2026-04-03');
  });

  it('lista los 12 feriados oficiales de 2026', () => {
    const fechas = feriadosDelAnio(2026).map((f) => f.fecha);
    expect(fechas).toEqual([
      '2026-01-01',
      '2026-04-02',
      '2026-04-03',
      '2026-04-11',
      '2026-05-01',
      '2026-07-25',
      '2026-08-02',
      '2026-08-15',
      '2026-08-31',
      '2026-09-15',
      '2026-12-01',
      '2026-12-25',
    ]);
  });

  it('filtra feriados dentro del periodo solicitado', () => {
    const enRango = feriadosEnPeriodo('2026-04-01', '2026-04-12');
    expect(enRango.map((f) => f.fecha)).toEqual([
      '2026-04-02',
      '2026-04-03',
      '2026-04-11',
    ]);
  });
});
