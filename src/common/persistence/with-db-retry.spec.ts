import { isTransientDbError, withDbRetry } from './with-db-retry';

describe('withDbRetry', () => {
  it('reconoce cortes transitorios de SQL Server', () => {
    expect(
      isTransientDbError(
        new Error('QueryFailedError: ConnectionError: Connection lost - read ECONNRESET'),
      ),
    ).toBe(true);
    expect(isTransientDbError(new Error('Fotografía no encontrada'))).toBe(false);
  });

  it('reintenta y resuelve cuando la segunda llamada funciona', async () => {
    let calls = 0;

    const result = await withDbRetry(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('Connection lost - read ECONNRESET');
      }
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });
});
