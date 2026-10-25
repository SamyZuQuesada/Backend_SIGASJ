import {
  diasAusenciaSinFeriados,
  domingoPascua,
  esFeriadoCostaRica,
  listarFeriadosEnRango,
} from './feriados-costa-rica';

describe('feriados-costa-rica', () => {
  it('calcula Jueves y Viernes Santo 2026', () => {
    expect(domingoPascua(2026)).toBe('2026-04-05');
    expect(esFeriadoCostaRica('2026-04-02')).toBe(true);
    expect(esFeriadoCostaRica('2026-04-03')).toBe(true);
    expect(esFeriadoCostaRica('2026-04-04')).toBe(false);
  });

  it('excluye feriados del conteo de días', () => {
    expect(listarFeriadosEnRango('2026-04-01', '2026-04-06')).toEqual([
      '2026-04-02',
      '2026-04-03',
    ]);
    expect(diasAusenciaSinFeriados('2026-04-01', '2026-04-06')).toBe(4);
    expect(esFeriadoCostaRica('2026-09-15')).toBe(true);
  });
});
