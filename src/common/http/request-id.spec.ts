import {
  isLivenessPath,
  resolveRequestId,
  safeRequestPath,
} from './request-id';

describe('request-id helpers', () => {
  it('acepta X-Request-Id seguro y genera UUID si no', () => {
    expect(resolveRequestId('abc-12345')).toBe('abc-12345');
    expect(resolveRequestId('x'.repeat(200)).length).toBe(36);
    expect(resolveRequestId('bad id with spaces').length).toBe(36);
    expect(resolveRequestId(undefined).length).toBe(36);
  });

  it('safeRequestPath elimina query', () => {
    expect(safeRequestPath('/api/v1/usuarios?token=secret')).toBe(
      '/api/v1/usuarios',
    );
  });

  it('detecta rutas de liveness', () => {
    expect(isLivenessPath('/api/v1/health')).toBe(true);
    expect(isLivenessPath('/api/v1')).toBe(true);
    expect(isLivenessPath('/api/v1/usuarios')).toBe(false);
  });
});
