/**
 * Opciones compartidas MSSQL (Nest runtime + TypeORM CLI / migraciones).
 * No imprime contraseñas ni connection strings.
 */
import { existsSync, readFileSync } from 'node:fs';
import { isProductionNodeEnv } from './production-secrets';

export const MSSQL_POOL = {
  /** Una instancia Nest; no agotar SQL Server en Render Free / starter. */
  max: 10,
  /** No mantener conexiones ociosas innecesarias. */
  min: 0,
  idleTimeoutMillis: 30_000,
  acquireTimeoutMillis: 30_000,
} as const;

export const MSSQL_TIMEOUTS = {
  connectTimeout: 30_000,
  connectionTimeout: 30_000,
  requestTimeout: 30_000,
} as const;

/** Reintentos Nest TypeORM: pocos y espaciados (evita tormenta). */
export const TYPEORM_RETRY = {
  retryAttempts: 5,
  retryDelay: 3_000,
} as const;

export type MssqlDriverOptions = {
  encrypt: boolean;
  trustServerCertificate: boolean;
  enableArithAbort: boolean;
  connectTimeout: number;
  requestTimeout: number;
  enableKeepAlive: boolean;
  keepAliveInitialDelay: number;
  useUTC: boolean;
  cryptoCredentialsDetails?: { ca: string | Buffer | Array<string | Buffer> };
};

function envFlag(env: NodeJS.ProcessEnv, key: string): boolean | undefined {
  const raw = env[key]?.trim().toLowerCase();
  if (raw === undefined || raw === '') {
    return undefined;
  }
  if (['1', 'true', 'yes', 'on'].includes(raw)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(raw)) {
    return false;
  }
  return undefined;
}

export function parseDbPort(
  raw: string | undefined,
  defaultPort: number,
): number {
  const value = parseInt(raw || String(defaultPort), 10);
  if (!Number.isFinite(value) || value <= 0 || value > 65535) {
    throw new Error(
      `DB_PORT inválido (${raw ?? 'undefined'}). Debe ser un entero 1–65535.`,
    );
  }
  return value;
}

function loadCaMaterial(env: NodeJS.ProcessEnv): string | undefined {
  const inline = env.DB_SSL_CA?.trim();
  if (inline) {
    return inline.replace(/\\n/g, '\n');
  }
  const path = env.DB_SSL_CA_PATH?.trim();
  if (!path) {
    return undefined;
  }
  if (!existsSync(path)) {
    throw new Error(
      `DB_SSL_CA_PATH apunta a un archivo inexistente. Configure la CA de Railway/SQL sin subir claves privadas al repo.`,
    );
  }
  return readFileSync(path, 'utf8');
}

function getDbDatabaseName(env: NodeJS.ProcessEnv): string | undefined {
  return env.DB_DATABASE?.trim() || env.DB_NAME?.trim();
}

function getDbUserName(env: NodeJS.ProcessEnv): string | undefined {
  return env.DB_USERNAME?.trim() || env.DB_USER?.trim();
}

/**
 * TLS MSSQL:
 * - Producción: encrypt=true, trustServerCertificate=false (validación real).
 *   En Azure SQL Database (*.database.windows.net), trustServerCertificate siempre debe ser false.
 * - Desarrollo/test: permite trust local para certificados autofirmados.
 * - CA opcional: DB_SSL_CA (PEM) o DB_SSL_CA_PATH.
 * - Prohibido: NODE_TLS_REJECT_UNAUTHORIZED=0 (no lo establecemos aquí).
 */
export function resolveMssqlDriverOptions(
  env: NodeJS.ProcessEnv = process.env,
): MssqlDriverOptions {
  const production = isProductionNodeEnv(env.NODE_ENV);
  const host = env.DB_HOST?.trim() || '';
  const isAzureSql = host.toLowerCase().includes('database.windows.net');
  const encryptOverride = envFlag(env, 'DB_ENCRYPT');
  const trustOverride = envFlag(env, 'DB_TRUST_SERVER_CERTIFICATE');

  const encrypt = production
    ? (encryptOverride ?? true)
    : (encryptOverride ?? false);

  let trustServerCertificate: boolean;
  if (production) {
    if (isAzureSql && trustOverride === true) {
      throw new Error(
        'En Azure SQL Database (*.database.windows.net), DB_TRUST_SERVER_CERTIFICATE no puede ser true. Debe validarse el certificado TLS emitido por la CA pública.',
      );
    }
    trustServerCertificate = trustOverride === true;
  } else {
    trustServerCertificate = trustOverride ?? true;
  }

  if (production && encrypt === false) {
    throw new Error(
      'En producción DB_ENCRYPT no puede ser false. La conexión a Azure SQL Database debe ir cifrada con TLS.',
    );
  }

  const options: MssqlDriverOptions = {
    encrypt,
    trustServerCertificate,
    enableArithAbort: true,
    connectTimeout: MSSQL_TIMEOUTS.connectTimeout,
    requestTimeout: MSSQL_TIMEOUTS.requestTimeout,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    useUTC: true,
  };

  const ca = loadCaMaterial(env);
  if (ca) {
    options.cryptoCredentialsDetails = { ca };
  }

  return options;
}

export function buildMssqlExtra(
  driverOptions: MssqlDriverOptions,
): Record<string, unknown> {
  return {
    pool: { ...MSSQL_POOL },
    connectionTimeout: MSSQL_TIMEOUTS.connectionTimeout,
    requestTimeout: MSSQL_TIMEOUTS.requestTimeout,
    options: driverOptions,
  };
}

export function assertProductionDatabaseEnv(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!isProductionNodeEnv(env.NODE_ENV)) {
    return;
  }

  const dbType = (env.DB_TYPE || '').trim().toLowerCase();
  if (dbType !== 'mssql') {
    throw new Error(
      'En producción DB_TYPE debe ser mssql (Azure SQL Database / Microsoft SQL Server).',
    );
  }

  const host = env.DB_HOST?.trim();
  if (!host) {
    throw new Error(
      'DB_HOST es obligatorio en producción (servidor Azure SQL Database, ej. sigasj-dev.database.windows.net).',
    );
  }
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.toLowerCase().includes('localdb')
  ) {
    throw new Error(
      'DB_HOST de producción no puede ser localhost/LocalDB. Use el servidor Azure SQL Database configurado.',
    );
  }

  parseDbPort(env.DB_PORT, 1433);

  const database = getDbDatabaseName(env);
  if (!database) {
    throw new Error(
      'DB_DATABASE (o DB_NAME) es obligatorio en producción (ej. sigasj-dev).',
    );
  }

  const username = getDbUserName(env);
  if (!username) {
    throw new Error(
      'DB_USERNAME (o DB_USER) es obligatorio en producción (ej. sigasj_app).',
    );
  }

  const lowerUser = username.toLowerCase();
  if (
    lowerUser === 'sa' ||
    lowerUser === 'sigasj_sqladmin' ||
    lowerUser === 'sqladmin' ||
    lowerUser === 'admin' ||
    lowerUser === 'administrator'
  ) {
    throw new Error(
      `Producción no debe conectarse con credenciales administrativas (${username}). Utilice el usuario de aplicación restringido sigasj_app.`,
    );
  }

  if (!env.DB_PASSWORD?.length) {
    throw new Error('DB_PASSWORD es obligatorio en producción.');
  }

  const syncFlag = envFlag(env, 'DB_SYNCHRONIZE');
  if (syncFlag === true) {
    throw new Error(
      'En producción DB_SYNCHRONIZE debe ser false. El esquema de Azure SQL no debe ser alterado automáticamente.',
    );
  }

  const isAzureSql = host.toLowerCase().includes('database.windows.net');
  const trustOverride = envFlag(env, 'DB_TRUST_SERVER_CERTIFICATE');
  if (isAzureSql && trustOverride === true) {
    throw new Error(
      'En Azure SQL Database (*.database.windows.net), DB_TRUST_SERVER_CERTIFICATE debe ser false. La validación TLS es obligatoria.',
    );
  }

  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    throw new Error(
      'NODE_TLS_REJECT_UNAUTHORIZED=0 está prohibido. Debe utilizar certificados válidos o configurar la CA correspondiente.',
    );
  }
}

/** Mensaje de error seguro para logs (sin password ni URI completa). */
export function sanitizeDbErrorMessage(error: unknown): string {
  let text: string;
  if (error instanceof Error) {
    text = `${error.name}: ${error.message}`;
  } else {
    text = String(error);
  }

  return text
    .replace(/Password\s*=\s*[^;'"\s]+/gi, 'Password=***')
    .replace(/Pwd\s*=\s*[^;'"\s]+/gi, 'Pwd=***')
    .replace(/:\/\/([^:/]+):([^@/]+)@/gi, '://$1:***@')
    .replace(/(password|pwd|passwd)\s*[:=]\s*\S+/gi, '$1=***');
}

export function describeDbTarget(env: NodeJS.ProcessEnv = process.env): string {
  const host = env.DB_HOST?.trim() || '(undefined)';
  const port = env.DB_PORT?.trim() || '(default)';
  const database = getDbDatabaseName(env) || '(undefined)';
  const username = getDbUserName(env) ? '(definido)' : '(undefined)';
  return `type=${env.DB_TYPE || '(undefined)'} host=${host} port=${port} database=${database} username=${username}`;
}
