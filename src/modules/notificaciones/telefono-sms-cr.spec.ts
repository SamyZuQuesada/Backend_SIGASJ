import { normalizarTelefonoSmsCr } from './telefono-sms-cr';

describe('normalizarTelefonoSmsCr', () => {
  it('antepone 506 a 8 dígitos locales', () => {
    expect(normalizarTelefonoSmsCr('88881234')).toBe('50688881234');
  });

  it('acepta +506 y quita el signo', () => {
    expect(normalizarTelefonoSmsCr('+50688881234')).toBe('50688881234');
  });

  it('conserva 506 ya internacional', () => {
    expect(normalizarTelefonoSmsCr('50688881234')).toBe('50688881234');
  });

  it('limpia guiones y espacios', () => {
    expect(normalizarTelefonoSmsCr('8888-1234')).toBe('50688881234');
    expect(normalizarTelefonoSmsCr(' 8888 1234 ')).toBe('50688881234');
  });

  it('rechaza valores inválidos', () => {
    expect(normalizarTelefonoSmsCr('')).toBeNull();
    expect(normalizarTelefonoSmsCr('123')).toBeNull();
    expect(normalizarTelefonoSmsCr('abcdefgh')).toBeNull();
    expect(normalizarTelefonoSmsCr('8888-000')).toBeNull();
    expect(normalizarTelefonoSmsCr(undefined)).toBeNull();
  });
});
