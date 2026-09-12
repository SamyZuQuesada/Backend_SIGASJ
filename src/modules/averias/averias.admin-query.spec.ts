import {
  escapeLikePattern,
  isValidIsoDateOnly,
  toStartOfNextUtcDay,
  toStartOfUtcDay,
} from './averias.service';

describe('helpers de consulta administrativa de averías', () => {
  it('valida fechas calendario YYYY-MM-DD', () => {
    expect(isValidIsoDateOnly('2026-09-12')).toBe(true);
    expect(isValidIsoDateOnly('2026-02-30')).toBe(false);
    expect(isValidIsoDateOnly('2026-13-01')).toBe(false);
    expect(isValidIsoDateOnly('01/02/2026')).toBe(false);
  });

  it('calcula el día siguiente exclusivo en UTC para incluir todo fechaHasta', () => {
    expect(toStartOfUtcDay('2026-09-12').toISOString()).toBe(
      '2026-09-12T00:00:00.000Z',
    );
    expect(toStartOfNextUtcDay('2026-09-12').toISOString()).toBe(
      '2026-09-13T00:00:00.000Z',
    );
  });

  it('escapa comodines de LIKE', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%');
    expect(escapeLikePattern('AV_2026')).toBe('AV\\_2026');
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
  });
});
