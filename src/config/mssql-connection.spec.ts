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
      DB_HOST: 'sigasj-dev.database.windows.net',
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
        DB_HOST: 'sigasj-dev.database.windows.net',
        DB_ENCRYPT: 'false',
      }),
    ).toThrow(/DB_ENCRYPT/);

    expect(() =>
      assertProductionDatabaseEnv({
        NODE_ENV: 'production',
        DB_TYPE: 'mssql',
        DB_HOST: 'localhost',
        DB_PORT: '1433',
        DB_DATABASE: 'sigasj-dev',
        DB_USERNAME: 'sigasj_app',
        DB_PASSWORD: 'x',
      }),
    ).toThrow(/localhost/);

    expect(() =>
      assertProductionDatabaseEnv({
        NODE_ENV: 'production',
        DB_TYPE: 'mssql',
        DB_HOST: 'sigasj-dev.database.windows.net',
        DB_PORT: '1433',
        DB_DATABASE: 'sigasj-dev',
        DB_USERNAME: 'sa',
        DB_PASSWORD: 'x',
      }),
    ).toThrow(/credenciales administrativas/);
  });

  it('producción rechaza usuario administrativo sigasj_sqladmin', () => {
    expect(() =>
      assertProductionDatabaseEnv({
        NODE_ENV: 'production',
        DB_TYPE: 'mssql',
        DB_HOST: 'sigasj-dev.database.windows.net',
        DB_PORT: '1433',
        DB_DATABASE: 'sigasj-dev',
        DB_USERNAME: 'sigasj_sqladmin',
        DB_PASSWORD: 'x',
      }),
    ).toThrow(/credenciales administrativas/);
  });

  it('producción acepta DB_NAME y DB_USER como alias de DB_DATABASE y DB_USERNAME', () => {
    expect(() =>
      assertProductionDatabaseEnv({
        NODE_ENV: 'production',
        DB_TYPE: 'mssql',
        DB_HOST: 'sigasj-dev.database.windows.net',
        DB_PORT: '1433',
        DB_NAME: 'sigasj-dev',
        DB_USER: 'sigasj_app',
        DB_PASSWORD: 'ValidPassword123!',
      }),
    ).not.toThrow();
  });

  it('producción rechaza DB_SYNCHRONIZE=true', () => {
    expect(() =>
      assertProductionDatabaseEnv({
        NODE_ENV: 'production',
        DB_TYPE: 'mssql',
        DB_HOST: 'sigasj-dev.database.windows.net',
        DB_PORT: '1433',
        DB_NAME: 'sigasj-dev',
        DB_USER: 'sigasj_app',
        DB_PASSWORD: 'ValidPassword123!',
        DB_SYNCHRONIZE: 'true',
      }),
    ).toThrow(/DB_SYNCHRONIZE/);
  });

  it('producción rechaza DB_TRUST_SERVER_CERTIFICATE=true para Azure SQL Database', () => {
    expect(() =>
      resolveMssqlDriverOptions({
        NODE_ENV: 'production',
        DB_HOST: 'sigasj-dev.database.windows.net',
        DB_TRUST_SERVER_CERTIFICATE: 'true',
      }),
    ).toThrow(/Azure SQL Database/);

    expect(() =>
      assertProductionDatabaseEnv({
        NODE_ENV: 'production',
        DB_TYPE: 'mssql',
        DB_HOST: 'sigasj-dev.database.windows.net',
        DB_PORT: '1433',
        DB_NAME: 'sigasj-dev',
        DB_USER: 'sigasj_app',
        DB_PASSWORD: 'ValidPassword123!',
        DB_TRUST_SERVER_CERTIFICATE: 'true',
      }),
    ).toThrow(/DB_TRUST_SERVER_CERTIFICATE/);
  });

  it('producción rechaza NODE_TLS_REJECT_UNAUTHORIZED=0', () => {
    expect(() =>
      assertProductionDatabaseEnv({
        NODE_ENV: 'production',
        DB_TYPE: 'mssql',
        DB_HOST: 'sigasj-dev.database.windows.net',
        DB_PORT: '1433',
        DB_DATABASE: 'sigasj-dev',
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
});
