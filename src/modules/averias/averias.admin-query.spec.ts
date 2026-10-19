import {
  escapeLikePattern,
  isValidIsoDateOnly,
  toStartOfAsadaDay,
  toStartOfNextAsadaDay,
} from './averias.service';

describe('helpers de consulta administrativa de averías', () => {
  it('valida fechas calendario YYYY-MM-DD', () => {
    expect(isValidIsoDateOnly('2026-09-12')).toBe(true);
    expect(isValidIsoDateOnly('2026-02-30')).toBe(false);
    expect(isValidIsoDateOnly('2026-13-01')).toBe(false);
    expect(isValidIsoDateOnly('01/02/2026')).toBe(false);
  });

  it('el día del filtro es el de Costa Rica (empieza a las 06:00 UTC) e incluye todo fechaHasta', () => {
    expect(toStartOfAsadaDay('2026-09-12').toISOString()).toBe(
      '2026-09-12T06:00:00.000Z',
    );
    expect(toStartOfNextAsadaDay('2026-09-12').toISOString()).toBe(
      '2026-09-13T06:00:00.000Z',
    );
  });

  it('una avería de las 20:35 del 17 en Costa Rica cae dentro del día 17', () => {
    const reporte = new Date('2026-10-18T02:35:47.000Z').getTime();
    expect(reporte).toBeGreaterThanOrEqual(
      toStartOfAsadaDay('2026-10-17').getTime(),
    );
    expect(reporte).toBeLessThan(toStartOfNextAsadaDay('2026-10-17').getTime());
  });

  it('rechaza fechas que no son de calendario', () => {
    expect(() => toStartOfAsadaDay('2026-02-30')).toThrow();
    expect(() => toStartOfNextAsadaDay('12/09/2026')).toThrow();
  });

  it('escapa comodines de LIKE', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%');
    expect(escapeLikePattern('AV_2026')).toBe('AV\\_2026');
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
  });
});
