export type MssqlTlsOptions = {
  encrypt: boolean;
  trustServerCertificate: boolean;
  enableArithAbort: true;
  connectTimeout: number;
  requestTimeout: number;
  enableKeepAlive: boolean;
  keepAliveInitialDelay: number;
  useUTC: boolean;
};

export function buildMssqlDriverOptions(
  env: NodeJS.ProcessEnv = process.env,
): MssqlTlsOptions {
  const isProd = (env.NODE_ENV || '').toLowerCase() === 'production';
  const encrypt =
    env.DB_ENCRYPT === 'true' || (isProd && env.DB_ENCRYPT !== 'false');
  const trustServerCertificate =
    env.DB_TRUST_SERVER_CERTIFICATE === 'true' ||
    (!isProd && env.DB_TRUST_SERVER_CERTIFICATE !== 'false');

  return {
    encrypt,
    trustServerCertificate,
    enableArithAbort: true,
    connectTimeout: 30_000,
    requestTimeout: 30_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    useUTC: true,
  };
}
