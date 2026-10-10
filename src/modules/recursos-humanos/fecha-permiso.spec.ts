import {
  aFechaIso,
  aFechaLocal,
  compararFechasIso,
  esFechaCalendario,
} from './fecha-permiso';

describe('fecha-permiso', () => {
  it('acepta fechas de calendario y rechaza días inexistentes', () => {
    expect(esFechaCalendario('2026-10-12')).toBe(true);
    expect(esFechaCalendario('2026-02-31')).toBe(false);
    expect(compararFechasIso('2026-10-14', '2026-10-12')).toBeGreaterThan(0);
  });

  it('conserva YYYY-MM-DD en textos ISO', () => {
    expect(aFechaIso('2026-10-12T00:00:00.000Z')).toBe('2026-10-12');
  });

  it('no atrasa el día cuando el driver entrega medianoche local', () => {
    const local = new Date(2026, 9, 12, 0, 0, 0, 0);
    expect(aFechaIso(local)).toBe('2026-10-12');
  });

  it('conserva el día cuando el valor es medianoche UTC', () => {
    expect(aFechaIso(new Date('2026-10-12T00:00:00.000Z'))).toBe('2026-10-12');
  });

  it('arma una fecha local del mismo día para persistir en SQL Server', () => {
    const local = aFechaLocal('2026-10-12');
    expect(local.getFullYear()).toBe(2026);
    expect(local.getMonth()).toBe(9);
    expect(local.getDate()).toBe(12);
    expect(local.getHours()).toBe(0);
  });
});
