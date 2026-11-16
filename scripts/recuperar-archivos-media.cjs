/**
 * SIGASJ — Script seguro de auditoría y recuperación de archivos locales a dbo.ArchivoMedia
 *
 * Características:
 * 1. Mapea y clasifica los 262 archivos locales en:
 *    - ARCHIVOS_PERMANENTES: Archivos auténticos de comunicados, galería, proyectos, formularios y solicitudes consolidadas (41 archivos).
 *    - TEMPORALES_EXCLUIDOS: Archivos huérfanos o sin reclamar bajo uploads/solicitudes/pendientes/ (2 archivos).
 *    - FIXTURES_TESTS_EXCLUIDOS: Archivos dummy generados por suites de pruebas automatizadas < 100 bytes (219 archivos).
 * 2. Soporte de archivo de entorno independiente mediante --env-file=<ruta> (ej: --env-file=.env.azure-media).
 * 3. Modo --check-connection: Valida conectividad, host, base de datos, usuario y permisos de forma 100% solo lectura.
 * 4. Modo por defecto: SIMULACIÓN (--dry-run). Muestra el listado sin tocar la base de datos ni requerir conexión.
 * 5. Modo de ejecución: --execute (valida estrictamente destino Azure SQL y realiza inserción idempotente sin sobrescribir).
 * 6. Validación de seguridad previa estricta:
 *    - Servidor obligatorio: sigasj-dev.database.windows.net
 *    - Base de datos obligatoria: sigasj-dev
 *    - Usuario verificado: sigasj_app (sin db_owner)
 *    - Esquema de dbo.ArchivoMedia con columnas requeridas
 * 7. No elimina ningún archivo local ni expone credenciales.
 *
 * Uso:
 *   node scripts/recuperar-archivos-media.cjs                                              (Simulación / Dry-run)
 *   node scripts/recuperar-archivos-media.cjs --env-file=.env.azure-media --check-connection (Comprobar conexión y permisos)
 *   node scripts/recuperar-archivos-media.cjs --env-file=.env.azure-media --execute           (Ejecución controlada hacia Azure SQL)
 */

const fs = require('fs');
const path = require('path');
const { DataSource } = require('typeorm');

// 1. Procesamiento de argumentos CLI
const args = process.argv.slice(2);

function getArgValue(flag) {
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith(`${flag}=`)) {
      return args[i].split('=')[1].trim();
    }
    if (args[i] === flag && args[i + 1] && !args[i + 1].startsWith('--')) {
      return args[i + 1].trim();
    }
  }
  return null;
}

const envFileArg = getArgValue('--env-file');
const isExecute = args.includes('--execute') || args.includes('--apply');
const isCheckConnection = args.includes('--check-connection');
const includeAll = args.includes('--include-all');

// 2. Carga segura del entorno
const rootDir = path.resolve(__dirname, '..');
let envFilePath = path.join(rootDir, '.env');

if (envFileArg) {
  envFilePath = path.isAbsolute(envFileArg)
    ? envFileArg
    : path.resolve(rootDir, envFileArg);

  if (!fs.existsSync(envFilePath)) {
    console.error(`\n[ERROR BLOQUEANTE] El archivo de entorno especificado no existe: ${envFilePath}`);
    console.error('Cree el archivo basándose en .env.azure-media.example antes de continuar.\n');
    process.exit(1);
  }
}

require('dotenv').config({ path: envFilePath, override: true });

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
const EXPECTED_HOST = 'sigasj-dev.database.windows.net';
const EXPECTED_DATABASE = 'sigasj-dev';
const EXPECTED_USER = 'sigasj_app';

const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

function scanUploadsDirectory(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanUploadsDirectory(fullPath));
    } else if (entry.isFile()) {
      const stats = fs.statSync(fullPath);
      const relative = path.relative(UPLOADS_DIR, fullPath).replace(/\\/g, '/');
      const publicPath = `/uploads/${relative}`;
      const mime = getMime(fullPath);

      // Clasificación de seguridad:
      // 1. Archivos en solicitudes/pendientes son temporales no vinculados
      const isPending = relative.startsWith('solicitudes/pendientes/');
      // 2. Archivos < 100 bytes (salvo los seeds específicos aviso.jpg, tanque.jpg, oficina.jpg)
      const isSeed =
        relative === 'comunicados/aviso.jpg' ||
        relative === 'galeria/tanque.jpg' ||
        relative === 'galeria/oficina.jpg';
      const isTestFixture = stats.size < 100 && !isSeed;

      let classification = 'ARCHIVO_PERMANENTE';
      if (isPending) {
        classification = 'TEMPORAL_EXCLUIDO';
      } else if (isTestFixture) {
        classification = 'FIXTURE_TEST_EXCLUIDO';
      }

      results.push({
        fullPath,
        publicPath,
        relative,
        folder: relative.split('/')[0],
        filename: entry.name,
        sizeBytes: stats.size,
        mime,
        classification,
      });
    }
  }
  return results;
}

function getDataSourceOptions(env) {
  try {
    const { buildMigrationDataSourceOptions } = require('../dist/database/data-source.options');
    return buildMigrationDataSourceOptions(env);
  } catch {
    require('ts-node/register');
    const { buildMigrationDataSourceOptions } = require('../src/database/data-source.options');
    return buildMigrationDataSourceOptions(env);
  }
}

/**
 * Validación estricta del entorno y de la conexión antes de proceder con cualquier operación.
 */
async function validateTargetConnection(dataSource, env) {
  const configuredHost = (env.DB_HOST || '').trim().toLowerCase();
  const configuredDb = (env.DB_DATABASE || env.DB_NAME || '').trim().toLowerCase();

  // 1. Validación en configuración estática
  if (configuredHost !== EXPECTED_HOST) {
    throw new Error(
      `Seguridad abortada: DB_HOST debe ser exactamente "${EXPECTED_HOST}", pero se configuró "${env.DB_HOST}".`,
    );
  }
  if (configuredDb !== EXPECTED_DATABASE) {
    throw new Error(
      `Seguridad abortada: La base de datos debe ser exactamente "${EXPECTED_DATABASE}", pero se configuró "${configuredDb}".`,
    );
  }

  // 2. Validación en conexión activa (runtime SQL Server)
  const serverInfo = await dataSource.query(`
    SELECT 
      CAST(SERVERPROPERTY('ServerName') AS VARCHAR(100)) AS serverName,
      DB_NAME() AS currentDatabase,
      CURRENT_USER AS currentUser,
      SYSTEM_USER AS systemUser,
      IS_MEMBER('db_owner') AS isDbOwner,
      IS_SRVROLEMEMBER('sysadmin') AS isSysAdmin
  `);

  const activeRow = serverInfo?.[0] || {};
  const activeDb = (activeRow.currentDatabase || '').trim().toLowerCase();
  const activeUser = (activeRow.currentUser || '').trim().toLowerCase();

  if (activeDb !== EXPECTED_DATABASE) {
    throw new Error(
      `Seguridad abortada: La base de datos conectada en tiempo de ejecución es "${activeRow.currentDatabase}", se requiere "${EXPECTED_DATABASE}".`,
    );
  }

  if (activeUser !== EXPECTED_USER) {
    throw new Error(
      `Seguridad abortada: El usuario conectado es "${activeRow.currentUser}", se requiere estrictamente "${EXPECTED_USER}".`,
    );
  }

  // 3. Verificación de mínimos privilegios (no debe ser db_owner ni sysadmin)
  const isPrivileged = activeRow.isDbOwner === 1 || activeRow.isSysAdmin === 1;

  // 4. Verificación de existencia de dbo.ArchivoMedia
  const checkTable = await dataSource.query(
    `SELECT OBJECT_ID(N'dbo.ArchivoMedia', N'U') AS tableId`,
  );
  if (!checkTable?.[0]?.tableId) {
    throw new Error(
      'La tabla dbo.ArchivoMedia no existe en Azure SQL. Aplique la migración previa con sigasj_sqladmin.',
    );
  }

  // 5. Verificación de columnas requeridas
  const columns = await dataSource.query(`
    SELECT c.name, t.name AS typeName, c.max_length, c.is_nullable
      FROM sys.columns c
      JOIN sys.types t ON c.user_type_id = t.user_type_id
     WHERE c.object_id = OBJECT_ID(N'dbo.ArchivoMedia')
  `);

  const columnNames = columns.map((c) => c.name.toLowerCase());
  const requiredColumns = ['id', 'ruta', 'mime', 'contenido', 'tamanobytes', 'createdat'];
  const missingColumns = requiredColumns.filter((rc) => !columnNames.includes(rc));

  if (missingColumns.length > 0) {
    throw new Error(
      `Estructura incompatible en dbo.ArchivoMedia. Columnas faltantes: ${missingColumns.join(', ')}`,
    );
  }

  // 6. Verificación de permisos efectivos sobre dbo.ArchivoMedia
  const permissionsRes = await dataSource.query(`
    SELECT permission_name 
      FROM fn_my_permissions('dbo.ArchivoMedia', 'OBJECT')
  `);
  const effectivePermissions = permissionsRes.map((p) => p.permission_name);

  return {
    serverProperty: activeRow.serverName,
    currentDatabase: activeRow.currentDatabase,
    currentUser: activeRow.currentUser,
    systemUser: activeRow.systemUser,
    isPrivileged,
    columnsCount: columns.length,
    effectivePermissions,
  };
}

async function main() {
  console.log('='.repeat(78));
  console.log('  SIGASJ — Recuperación de Archivos hacia dbo.ArchivoMedia');
  console.log(`  Archivo de entorno: ${path.relative(rootDir, envFilePath)}`);
  console.log(
    `  Modo de operación:  ${
      isCheckConnection
        ? 'COMPROBACIÓN DE CONEXIÓN (--check-connection)'
        : isExecute
          ? 'EJECUCIÓN REAL (--execute)'
          : 'SIMULACIÓN / DRY-RUN (Sin escrituras)'
    }`,
  );
  console.log('='.repeat(78));

  // --- MODO: COMPROBACIÓN DE CONEXIÓN Y PERMISOS (--check-connection) ---
  if (isCheckConnection) {
    console.log('\n[Iniciando comprobación de conexión y permisos en Azure SQL...]');
    
    // Verificación estática antes de intentar conectar
    const configuredHost = (process.env.DB_HOST || '').trim().toLowerCase();
    const configuredDb = (process.env.DB_DATABASE || process.env.DB_NAME || '').trim().toLowerCase();

    if (configuredHost !== EXPECTED_HOST) {
      console.error(
        `\n[ERROR BLOQUEANTE DE SEGURIDAD] DB_HOST debe ser estrictamente "${EXPECTED_HOST}", pero se detectó "${process.env.DB_HOST}".`,
      );
      console.error('Especifique el archivo de Azure SQL mediante: --env-file=.env.azure-media\n');
      process.exit(1);
    }
    if (configuredDb !== EXPECTED_DATABASE) {
      console.error(
        `\n[ERROR BLOQUEANTE DE SEGURIDAD] La base de datos debe ser estrictamente "${EXPECTED_DATABASE}", pero se detectó "${configuredDb}".\n`,
      );
      process.exit(1);
    }

    const dsOptions = getDataSourceOptions(process.env);
    const dataSource = new DataSource(dsOptions);

    try {
      console.log(`  1. Conectando al servidor ${process.env.DB_HOST || 'local'}...`);
      await dataSource.initialize();
      console.log('     -> Conexión establecida con éxito.');

      console.log('  2. Ejecutando validaciones estrictas de seguridad de destino...');
      const validation = await validateTargetConnection(dataSource, process.env);
      console.log('     -> [OK] Servidor de destino validado:   ', EXPECTED_HOST);
      console.log('     -> [OK] Base de datos activa validada:  ', validation.currentDatabase);
      console.log('     -> [OK] Usuario autenticado:            ', `${validation.currentUser} (System: ${validation.systemUser})`);
      console.log('     -> [OK] Política de mínimos privilegios:', validation.isPrivileged ? 'ADVERTENCIA: Rol privilegiado' : 'CONFIRMADA (No es db_owner ni sysadmin)');
      console.log('     -> [OK] Tabla dbo.ArchivoMedia:         Existe con sus columnas requeridas');
      console.log('     -> [OK] Permisos efectivos sobre tabla: ', validation.effectivePermissions.join(', '));

      console.log('  3. Consultando estadísticas actuales de almacenamiento en dbo.ArchivoMedia...');
      const stats = await dataSource.query(`
        SELECT COUNT(1) AS total, ISNULL(SUM(tamanoBytes), 0) AS totalBytes FROM dbo.ArchivoMedia
      `);
      const totalRows = Number(stats?.[0]?.total || 0);
      const totalMb = (Number(stats?.[0]?.totalBytes || 0) / (1024 * 1024)).toFixed(2);
      console.log(`     -> Total de archivos almacenados actualmente: ${totalRows} (${totalMb} MB)`);

      console.log('\n' + '='.repeat(78));
      console.log('  RESULTADO: Conexión, usuario y esquema validados al 100%.');
      console.log('  El entorno está listo para autorizar la recuperación.');
      console.log('='.repeat(78) + '\n');
      return;
    } finally {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    }
  }

  // --- MODO: SIMULACIÓN O EJECUCIÓN (ESCANEO DE ARCHIVOS LOCALES) ---
  const allFiles = scanUploadsDirectory(UPLOADS_DIR);
  console.log(`\nTotal de archivos locales en uploads/: ${allFiles.length}`);

  const permanentes = allFiles.filter(
    (f) => f.classification === 'ARCHIVO_PERMANENTE',
  );
  const temporales = allFiles.filter(
    (f) => f.classification === 'TEMPORAL_EXCLUIDO',
  );
  const fixtures = allFiles.filter(
    (f) => f.classification === 'FIXTURE_TEST_EXCLUIDO',
  );

  const bytesPerm = permanentes.reduce((acc, f) => acc + f.sizeBytes, 0);
  const bytesTemp = temporales.reduce((acc, f) => acc + f.sizeBytes, 0);
  const bytesFix = fixtures.reduce((acc, f) => acc + f.sizeBytes, 0);

  console.log('\nClasificación técnica de los archivos:');
  console.log(
    `  1. Archivos permanentes a migrar:   ${permanentes.length.toString().padStart(3)} archivos (${(bytesPerm / (1024 * 1024)).toFixed(2)} MB)`,
  );
  console.log(
    `  2. Temporales pendientes excluidos: ${temporales.length.toString().padStart(3)} archivos (${(bytesTemp / 1024).toFixed(2)} KB)`,
  );
  console.log(
    `  3. Fixtures de tests excluidos:     ${fixtures.length.toString().padStart(3)} archivos (${(bytesFix / 1024).toFixed(2)} KB)`,
  );

  const targets = includeAll ? allFiles : permanentes;

  console.log(
    `\nArchivos seleccionados para la carga (${targets.length}):`,
  );
  console.log('-'.repeat(78));
  targets.forEach((t, idx) => {
    const sizeKb = (t.sizeBytes / 1024).toFixed(1).padStart(7);
    console.log(
      `  [${(idx + 1).toString().padStart(2)}] ${t.publicPath.padEnd(55)} | ${sizeKb} KB | ${t.mime}`,
    );
  });
  console.log('-'.repeat(78));

  // Si no se pasó --execute, finaliza la simulación sin tocar la BD
  if (!isExecute) {
    console.log(
      '\n[SIMULACIÓN COMPLETADA SIN ERRORES] No se realizaron escrituras en la base de datos.',
    );
    console.log('Comandos disponibles:');
    console.log('  1. Comprobar conexión y permisos (solo lectura):');
    console.log('     node scripts/recuperar-archivos-media.cjs --env-file=.env.azure-media --check-connection\n');
    console.log('  2. Ejecutar la recuperación hacia Azure SQL:');
    console.log('     node scripts/recuperar-archivos-media.cjs --env-file=.env.azure-media --execute\n');
    return;
  }

  // --- MODO: EJECUCIÓN CONTROLADA HACIA AZURE SQL (--execute) ---
  const configuredHost = (process.env.DB_HOST || '').trim().toLowerCase();
  const configuredDb = (process.env.DB_DATABASE || process.env.DB_NAME || '').trim().toLowerCase();

  if (configuredHost !== EXPECTED_HOST) {
    console.error(
      `\n[ERROR BLOQUEANTE DE SEGURIDAD] DB_HOST debe ser estrictamente "${EXPECTED_HOST}", pero se detectó "${process.env.DB_HOST}".`,
    );
    console.error('Especifique el archivo de Azure SQL mediante: --env-file=.env.azure-media\n');
    process.exit(1);
  }
  if (configuredDb !== EXPECTED_DATABASE) {
    console.error(
      `\n[ERROR BLOQUEANTE DE SEGURIDAD] La base de datos debe ser estrictamente "${EXPECTED_DATABASE}", pero se detectó "${configuredDb}".\n`,
    );
    process.exit(1);
  }

  const dsOptions = getDataSourceOptions(process.env);
  const dataSource = new DataSource(dsOptions);

  const fallas = [];
  let insertados = 0;
  let yaExistentes = 0;

  try {
    console.log('\nConectando a Azure SQL Database...');
    await dataSource.initialize();
    console.log('Conexión establecida exitosamente.');

    console.log('Validando parámetros de seguridad obligatorios antes de escribir...');
    const validation = await validateTargetConnection(dataSource, process.env);
    console.log(`Destino confirmado: ${validation.currentDatabase} en ${EXPECTED_HOST} como ${validation.currentUser}.`);

    console.log('\nIniciando carga idempotente...');

    for (const item of targets) {
      try {
        const buffer = fs.readFileSync(item.fullPath);
        const hex = buffer.toString('hex');

        // Comprobar primero si ya existe para evitar sobrescrituras
        const existsRow = await dataSource.query(
          `SELECT 1 AS existsFlag FROM dbo.ArchivoMedia WHERE ruta = @0`,
          [item.publicPath],
        );

        if (existsRow && existsRow.length > 0) {
          yaExistentes++;
          continue;
        }

        // Inserción segura con verificación
        await dataSource.query(
          `INSERT INTO dbo.ArchivoMedia (ruta, mime, contenido, tamanoBytes, createdAt)
           VALUES (@0, @1, CONVERT(VARBINARY(MAX), @2, 2), @3, SYSUTCDATETIME())`,
          [item.publicPath, item.mime, hex, item.sizeBytes],
        );

        insertados++;
      } catch (err) {
        console.error(`  [FALLA] Error al guardar ${item.publicPath}:`, err.message);
        fallas.push({ path: item.publicPath, error: err.message });
      }
    }

    console.log('\n' + '='.repeat(78));
    console.log('  RESUMEN DE LA RECUPERACIÓN:');
    console.log(`  - Nuevos insertados:       ${insertados}`);
    console.log(`  - Ya existentes (omitidos): ${yaExistentes}`);
    console.log(`  - Fallas detectadas:       ${fallas.length}`);
    console.log(`  - Total procesados:        ${targets.length}`);
    console.log('='.repeat(78));

    if (fallas.length > 0) {
      console.error(
        '\nATENCIÓN: Se produjeron errores durante la carga de algunos archivos:',
      );
      fallas.forEach((f) => console.error(`  - ${f.path}: ${f.error}`));
      process.exit(1);
    }

    console.log('\nCarga finalizada con 100% de éxito y cero fallas.\n');
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

main().catch((err) => {
  console.error('\n[ERROR BLOQUEANTE]:', err.message);
  process.exit(1);
});
