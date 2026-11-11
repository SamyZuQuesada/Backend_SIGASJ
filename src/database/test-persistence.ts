/**
 * Prueba de persistencia TypeORM en Azure SQL Database (Tarea 11.4.5).
 * Realiza un ciclo controlado INSERT -> SELECT -> UPDATE -> SELECT -> DELETE -> SELECT
 * utilizando un UUID aleatorio generado en tiempo de ejecución.
 * Protegido: valida que el destino sea exclusivamente Azure SQL sigasj-dev con sigasj_app.
 */
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  describeDbTarget,
  resolveMssqlDriverOptions,
  sanitizeDbErrorMessage,
} from '../config/mssql-connection';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { Comunicado } from '../modules/comunicados/entities/comunicado.entity';

const EXPECTED_HOST = 'sigasj-dev.database.windows.net';
const EXPECTED_DATABASE = 'sigasj-dev';
const EXPECTED_USER = 'sigasj_app';

const TEST_MARKER = 'PRUEBA-AZURE-1145';
const TEST_ID = randomUUID();
const TEST_TITLE = `${TEST_MARKER}: Persistencia TypeORM [${TEST_ID.slice(0, 8)}]`;
const INITIAL_DESC =
  'Registro temporal de prueba: validación de INSERT en Azure SQL Database';
const UPDATED_DESC =
  'Registro temporal de prueba: validación de UPDATE confirmada en Azure SQL Database';

async function main(): Promise<void> {
  const env = process.env;

  // 1. Validación de seguridad previa estricta: impedir ejecución si no es exactamente Azure SQL
  const host = env.DB_HOST?.trim();
  const database = env.DB_DATABASE?.trim() || env.DB_NAME?.trim();
  const user = env.DB_USERNAME?.trim() || env.DB_USER?.trim();

  if (host !== EXPECTED_HOST) {
    throw new Error(
      `Seguridad abortada: DB_HOST debe ser exactamente "${EXPECTED_HOST}", pero se detectó "${host}". No se ejecutará ninguna operación.`,
    );
  }
  if (database !== EXPECTED_DATABASE) {
    throw new Error(
      `Seguridad abortada: La base de datos debe ser exactamente "${EXPECTED_DATABASE}", pero se detectó "${database}". No se ejecutará ninguna operación.`,
    );
  }
  if (user !== EXPECTED_USER) {
    throw new Error(
      `Seguridad abortada: El usuario debe ser exactamente "${EXPECTED_USER}", pero se detectó "${user}". No se ejecutará ninguna operación.`,
    );
  }

  const tls = resolveMssqlDriverOptions(env);
  if (!tls.encrypt || tls.trustServerCertificate) {
    throw new Error(
      `Seguridad abortada: La conexión a Azure SQL requiere encrypt=true y trustServerCertificate=false (actual: encrypt=${tls.encrypt}, trustServerCertificate=${tls.trustServerCertificate}).`,
    );
  }

  console.log('[SIGASJ-11.4.5] Destino validado para Azure SQL Database:');
  console.log(`  ${describeDbTarget(env)}`);
  console.log(
    `  TLS: encrypt=${tls.encrypt}, trustServerCertificate=${tls.trustServerCertificate}`,
  );
  console.log(`  ID generado para esta prueba: ${TEST_ID}`);

  const options = buildMigrationDataSourceOptions(env);
  const dataSource = new DataSource(options);

  let insertCompleted = false;
  let cleanupCompleted = false;

  try {
    await dataSource.initialize();
    console.log(
      '[SIGASJ-11.4.5] Conexión establecida exitosamente con Azure SQL Database.',
    );

    const repo = dataSource.getRepository(Comunicado);

    // 1. Verificación previa: comprobar que el UUID generado NO existe
    console.log(
      '[SIGASJ-11.4.5] Paso 1/6: Verificando que el UUID generado no existe previamente...',
    );
    const preexistente = await repo.findOne({ where: { id: TEST_ID } });
    if (preexistente) {
      throw new Error(
        `Colisión inesperada: el UUID ${TEST_ID} ya existe en Azure SQL.`,
      );
    }
    console.log(
      '[SIGASJ-11.4.5] Paso 1/6 verificado: el UUID es único y no existe en la base de datos.',
    );

    // 2. INSERT
    console.log(
      '[SIGASJ-11.4.5] Paso 2/6: Ejecutando INSERT con confirmación en Azure SQL...',
    );
    const entity = repo.create({
      id: TEST_ID,
      titulo: TEST_TITLE,
      descripcion: INITIAL_DESC,
      contenido:
        'Validación de operaciones de escritura y persistencia real (Tarea 11.4.5).',
      tipo: 'Informativo',
      prioridad: 'Baja',
      estado: 'Inactivo',
      esPublico: false,
      fechaPublicacion: new Date(),
      fechaExpiracion: null,
      imagenUrl: null,
    });
    await repo.save(entity);
    insertCompleted = true;
    console.log('[SIGASJ-11.4.5] Paso 2/6 completado: registro insertado.');

    // 3. SELECT (verificar persistencia del INSERT)
    console.log(
      '[SIGASJ-11.4.5] Paso 3/6: Ejecutando SELECT para verificar persistencia real del INSERT...',
    );
    const select1 = await repo.findOne({ where: { id: TEST_ID } });
    if (!select1) {
      throw new Error(
        `Fallo de persistencia: no se encontró el registro con ID ${TEST_ID} tras INSERT.`,
      );
    }
    if (select1.titulo !== TEST_TITLE || select1.descripcion !== INITIAL_DESC) {
      throw new Error(
        'Fallo de integridad: los datos consultados no coinciden con los guardados.',
      );
    }
    console.log(
      '[SIGASJ-11.4.5] Paso 3/6 verificado: el registro persiste en Azure SQL con los valores correctos.',
    );

    // 4. UPDATE
    console.log(
      '[SIGASJ-11.4.5] Paso 4/6: Ejecutando UPDATE sobre el campo descripcion...',
    );
    select1.descripcion = UPDATED_DESC;
    await repo.save(select1);
    console.log(
      '[SIGASJ-11.4.5] Paso 4/6 completado: actualización enviada y confirmada.',
    );

    // 5. SELECT (verificar persistencia del UPDATE)
    console.log(
      '[SIGASJ-11.4.5] Paso 5/6: Ejecutando SELECT para verificar persistencia real del UPDATE...',
    );
    const select2 = await repo.findOne({ where: { id: TEST_ID } });
    if (!select2) {
      throw new Error(
        `Fallo de persistencia: no se encontró el registro con ID ${TEST_ID} tras UPDATE.`,
      );
    }
    if (select2.descripcion !== UPDATED_DESC) {
      throw new Error(
        `Fallo de actualización: se esperaba "${UPDATED_DESC}" pero se recuperó "${select2.descripcion}".`,
      );
    }
    console.log(
      '[SIGASJ-11.4.5] Paso 5/6 verificado: la modificación persistió en Azure SQL Database.',
    );

    // 6. DELETE (con verificación estricta de propiedad)
    console.log(
      '[SIGASJ-11.4.5] Paso 6/6: Ejecutando DELETE del registro temporal...',
    );
    if (select2.id !== TEST_ID || !select2.titulo.startsWith(TEST_MARKER)) {
      throw new Error(
        'Seguridad abortada: no se pudo confirmar la propiedad del registro antes de eliminar.',
      );
    }
    await repo.remove(select2);
    console.log('[SIGASJ-11.4.5] Paso 6/6 completado: registro eliminado.');

    // 7. SELECT final (confirmar ausencia total de residuos)
    const selectFinal = await repo.findOne({ where: { id: TEST_ID } });
    if (selectFinal !== null) {
      throw new Error(
        `Fallo de eliminación: el registro ${TEST_ID} todavía existe en la base de datos.`,
      );
    }
    cleanupCompleted = true;
    console.log(
      '[SIGASJ-11.4.5] Verificación final: Cero residuos confirmados (el registro temporal ya no existe).',
    );
    console.log(
      '[SIGASJ-11.4.5] PRUEBA EXITOSA: INSERT, SELECT, UPDATE y DELETE verificados en Azure SQL Database.',
    );
  } catch (error: unknown) {
    console.error(
      `[SIGASJ-11.4.5] Error durante la prueba: ${sanitizeDbErrorMessage(error)}`,
    );
    process.exitCode = 1;
  } finally {
    // Limpieza de seguridad en finally únicamente si se insertó y no se completó el borrado
    if (insertCompleted && !cleanupCompleted) {
      try {
        if (dataSource.isInitialized) {
          const repo = dataSource.getRepository(Comunicado);
          const pendiente = await repo.findOne({ where: { id: TEST_ID } });
          if (
            pendiente &&
            pendiente.id === TEST_ID &&
            pendiente.titulo.startsWith(TEST_MARKER)
          ) {
            await repo.remove(pendiente);
            cleanupCompleted = true;
            console.log(
              `[SIGASJ-11.4.5] Limpieza de seguridad en finally completada para ID: ${TEST_ID}`,
            );
          }
        }
      } catch (cleanupErr) {
        console.error(
          `[SIGASJ-11.4.5] ATENCIÓN: Falló la limpieza en finally. Registro pendiente de eliminar ID: ${TEST_ID}`,
        );
        process.exitCode = 1;
      }
    }

    if (!cleanupCompleted && insertCompleted) {
      console.error(
        `[SIGASJ-11.4.5] ALERTA: La prueba terminó con un registro pendiente en Azure SQL. ID: ${TEST_ID}`,
      );
      process.exitCode = 1;
    }

    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    `[SIGASJ-11.4.5] Error fatal: ${sanitizeDbErrorMessage(error)}`,
  );
  process.exit(1);
});
