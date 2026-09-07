import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

async function runMigrations(): Promise<void> {
  const dataSource = new DataSource(buildMigrationDataSourceOptions());

  try {
    await dataSource.initialize();
    console.log('[SIGASJ] Conexión a base de datos establecida.');

    const pending = await dataSource.showMigrations();
    if (!pending) {
      console.log('[SIGASJ] No hay migraciones pendientes.');
      return;
    }

    const executed = await dataSource.runMigrations();
    console.log(
      `[SIGASJ] Migraciones aplicadas (${executed.length}):`,
      executed.map((item) => item.name).join(', ') || 'ninguna',
    );
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

runMigrations().catch((error: unknown) => {
  console.error('[SIGASJ] Error al ejecutar migraciones:', error);
  process.exit(1);
});
