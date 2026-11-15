/**
 * Inserta filas demo en SolicitudServicio (tabla legacy del KPI
 * "solicitudes en trámite" del dashboard).
 *
 * Uso: npx ts-node -r tsconfig-paths/register src/database/seed-demo-solicitud-servicio.ts
 */
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { SolicitudEstado } from '../common/enums/solicitud-estado.enum';
import { SolicitudServicio } from '../modules/solicitudes/entities/solicitud-servicio.entity';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

async function seed(): Promise<void> {
  const dataSource = new DataSource(buildMigrationDataSourceOptions());
  await dataSource.initialize();

  try {
    const repo = dataSource.getRepository(SolicitudServicio);
    const stamp = Date.now();
    const rows = [
      {
        nombre: 'Andrea',
        apellidos: 'Quesada Mora',
        cedula: `2-0700-${String(stamp).slice(-4)}`,
        telefono: '8888-4401',
        correo: `solicitud.demo.${stamp}.1@ejemplo.cr`,
        direccion: 'San Juan, 50 m oeste de la plaza',
        estado: SolicitudEstado.APROBADA,
        utilizada: false,
      },
      {
        nombre: 'Ricardo',
        apellidos: 'Brenes Soto',
        cedula: `2-0701-${String(stamp).slice(-4)}`,
        telefono: '8888-4402',
        correo: `solicitud.demo.${stamp}.2@ejemplo.cr`,
        direccion: 'Barrio Nuevo, casa esquinera',
        estado: SolicitudEstado.APROBADA,
        utilizada: false,
      },
      {
        nombre: 'Patricia',
        apellidos: 'Araya Vargas',
        cedula: `2-0702-${String(stamp).slice(-4)}`,
        telefono: '8888-4403',
        correo: `solicitud.demo.${stamp}.3@ejemplo.cr`,
        direccion: 'Los Ángeles, frente al tanque',
        estado: SolicitudEstado.APROBADA,
        utilizada: false,
      },
    ];

    const saved = await repo.save(rows.map((row) => repo.create(row)));
    console.log(
      `[SIGASJ] SolicitudServicio demo: ${saved.length} filas APROBADA/utilizada=false`,
    );
    console.log(
      saved.map((s) => ({ id: s.idSolicitud, nombre: s.nombre, cedula: s.cedula })),
    );
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

seed().catch((error: unknown) => {
  console.error('[SIGASJ] Error seed SolicitudServicio:', error);
  process.exit(1);
});
