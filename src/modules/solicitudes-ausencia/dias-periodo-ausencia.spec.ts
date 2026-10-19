import { diasInclusiveEntreFechas } from './dias-periodo-ausencia';

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
