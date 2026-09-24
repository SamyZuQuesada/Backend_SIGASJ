import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

async function main(): Promise<void> {
  const ds = new DataSource(buildMigrationDataSourceOptions());
  await ds.initialize();
  try {
    const rows = await ds.query(`
      SELECT u.idUsuario, u.correo, u.nombre, u.activo, r.nombre AS rol
      FROM Usuario u
      LEFT JOIN Rol r ON r.idRol = u.idRol
      ORDER BY r.nombre, u.idUsuario
    `);
    console.log('[SIGASJ] USUARIOS_DEV', JSON.stringify(rows, null, 2));
  } finally {
    await ds.destroy();
  }
}

void main();
