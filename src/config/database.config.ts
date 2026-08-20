import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

type DbType = 'postgres' | 'mysql' | 'mariadb' | 'mssql';

function sanitizeEnvValue(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }

  return value.trim().replace(/^['"]|['"]$/g, '');
}

function resolveDbType(raw: string | undefined): DbType {
  const configured = raw as DbType | undefined;
  if (
    configured === 'postgres' ||
    configured === 'mysql' ||
    configured === 'mariadb' ||
    configured === 'mssql'
  ) {
    return configured;
  }

  return 'mssql';
}

function defaultPort(dbType: DbType): number {
  if (dbType === 'mssql') {
    return 1435;
  }
  if (dbType === 'mysql' || dbType === 'mariadb') {
    return 3306;
  }

  return 5432;
}

function defaultUsername(dbType: DbType): string {
  return dbType === 'mssql' ? 'sa' : 'postgres';
}

function defaultPassword(dbType: DbType): string {
  return dbType === 'mssql' ? 'SigasjDev2026' : 'postgres';
}

function defaultDatabase(dbType: DbType): string {
  return dbType === 'mssql' ? 'SIGASJ' : 'sigasj_db';
}

export function buildTypeOrmOptions(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const dbType = resolveDbType(
    sanitizeEnvValue(configService.get<string>('DB_TYPE')),
  );

  return {
    type: dbType,
    host: sanitizeEnvValue(configService.get<string>('DB_HOST')) || 'localhost',
    port: parseInt(
      sanitizeEnvValue(configService.get<string>('DB_PORT')) ||
        String(defaultPort(dbType)),
      10,
    ),
    username:
      sanitizeEnvValue(configService.get<string>('DB_USERNAME')) ||
      defaultUsername(dbType),
    password:
      sanitizeEnvValue(configService.get<string>('DB_PASSWORD')) ||
      defaultPassword(dbType),
    database:
      sanitizeEnvValue(configService.get<string>('DB_DATABASE')) ||
      defaultDatabase(dbType),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: configService.get<string>('NODE_ENV') === 'development',
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    migrationsRun: false,
    logging: configService.get<string>('NODE_ENV') === 'development',
    options:
      dbType === 'mssql'
        ? { encrypt: false, trustServerCertificate: true }
        : undefined,
  } as TypeOrmModuleOptions;
}
