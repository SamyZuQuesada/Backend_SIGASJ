import {
  assertProductionDatabaseEnv,
  parseDbPort,
  resolveMssqlDriverOptions,
  sanitizeDbErrorMessage,
} from './mssql-connection';

describe('mssql-connection', () => {
  it('parseDbPort exige número válido', () => {
    expect(parseDbPort('54321', 1433)).toBe(54321);
    expect(() => parseDbPort('abc', 1433)).toThrow(/DB_PORT/);
    expect(() => parseDbPort('0', 1433)).toThrow(/DB_PORT/);
  });

  it('producción cifra y valida certificado por defecto', () => {
    const opts = resolveMssqlDriverOptions({
      NODE_ENV: 'production',
    });
    expect(opts.encrypt).toBe(true);
    expect(opts.trustServerCertificate).toBe(false);
  });

  it('desarrollo permite trust local para autofirmados', () => {
    const opts = resolveMssqlDriverOptions({
      NODE_ENV: 'development',
    });
    expect(opts.encrypt).toBe(false);
    expect(opts.trustServerCertificate).toBe(true);
  });

  it('producción rechaza DB_ENCRYPT=false y sa / localhost', () => {
    expect(() =>
      resolveMssqlDriverOptions({
        NODE_ENV: 'production',
        DB_ENCRYPT: 'false',
      }),
    ).toThrow(/DB_ENCRYPT/);

    expect(() =>
      assertProductionDatabaseEnv({
        NODE_ENV: 'production',
        DB_TYPE: 'mssql',
        DB_HOST: 'localhost',
        DB_PORT: '1433',
        DB_DATABASE: 'SIGASJ',
        DB_USERNAME: 'sigasj_app',
        DB_PASSWORD: 'x',
      }),
    ).toThrow(/localhost/);

    expect(() =>
      assertProductionDatabaseEnv({
        NODE_ENV: 'production',
        DB_TYPE: 'mssql',
        DB_HOST: 'switchback.proxy.rlwy.net',
        DB_PORT: '54321',
        DB_DATABASE: 'SIGASJ',
        DB_USERNAME: 'sa',
        DB_PASSWORD: 'x',
      }),
    ).toThrow(/\bsa\b/);
  });

  it('producción rechaza NODE_TLS_REJECT_UNAUTHORIZED=0', () => {
    expect(() =>
      assertProductionDatabaseEnv({
        NODE_ENV: 'production',
        DB_TYPE: 'mssql',
        DB_HOST: 'switchback.proxy.rlwy.net',
        DB_PORT: '54321',
        DB_DATABASE: 'SIGASJ',
        DB_USERNAME: 'sigasj_app',
        DB_PASSWORD: 'x',
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
      }),
    ).toThrow(/NODE_TLS_REJECT_UNAUTHORIZED/);
  });

  it('sanitizeDbErrorMessage no deja passwords', () => {
    const msg = sanitizeDbErrorMessage(
      new Error(
        'Login failed for user; Password=SuperSecret123; Server=x,1433',
      ),
    );
    expect(msg).not.toMatch(/SuperSecret123/);
    expect(msg).toMatch(/Password=\*\*\*/);
  });

  it('trust explícito en producción solo con flag (no permanente)', () => {
    const opts = resolveMssqlDriverOptions({
      NODE_ENV: 'production',
      DB_TRUST_SERVER_CERTIFICATE: 'true',
    });
    expect(opts.encrypt).toBe(true);
    expect(opts.trustServerCertificate).toBe(true);
  });
});
