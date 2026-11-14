import { buildMssqlDriverOptions } from './mssql-tls';

describe('buildMssqlDriverOptions', () => {
  it('en desarrollo no exige TLS y confía en el certificado local', () => {
    const options = buildMssqlDriverOptions({ NODE_ENV: 'development' });
    expect(options.encrypt).toBe(false);
    expect(options.trustServerCertificate).toBe(true);
  });

  it('en producción cifra y no confía en certificados arbitrarios', () => {
    const options = buildMssqlDriverOptions({ NODE_ENV: 'production' });
    expect(options.encrypt).toBe(true);
    expect(options.trustServerCertificate).toBe(false);
  });

  it('respeta DB_ENCRYPT y DB_TRUST_SERVER_CERTIFICATE', () => {
    const options = buildMssqlDriverOptions({
      NODE_ENV: 'production',
      DB_ENCRYPT: 'false',
      DB_TRUST_SERVER_CERTIFICATE: 'true',
    });
    expect(options.encrypt).toBe(false);
    expect(options.trustServerCertificate).toBe(true);
  });
});
