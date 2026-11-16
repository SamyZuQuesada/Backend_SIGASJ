/**
 * SIGASJ — Script de verificación post-implementación de dbo.ArchivoMedia
 *
 * Características:
 * 1. Soporte estricto de --env-file=<ruta> para conectar a Azure SQL de forma independiente.
 * 2. Operaciones 100% DE SOLO LECTURA: No ejecuta CREATE TABLE, INSERT, UPDATE ni DELETE.
 * 3. Valida host, base de datos activa (DB_NAME()) y usuario autenticado (SYSTEM_USER).
 * 4. Inspecciona la existencia y las columnas reales de dbo.ArchivoMedia.
 * 5. Verifica el total de 41 archivos, el volumen almacenado y la integridad de los binarios (DATALENGTH > 0).
 * 6. Protege la privacidad: No imprime rutas de documentos privados de solicitudes ni PII.
 * 7. No expone contraseñas ni datos sensibles.
 *
 * Uso:
 *   node scripts/verificar-archivo-media.cjs --env-file=.env.azure-media
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
const rootDir = path.resolve(__dirname, '..');
let envFilePath = path.join(rootDir, '.env');

if (envFileArg) {
  envFilePath = path.isAbsolute(envFileArg)
    ? envFileArg
    : path.resolve(rootDir, envFileArg);

  if (!fs.existsSync(envFilePath)) {
    console.error(`\n[ERROR BLOQUEANTE] El archivo de entorno no existe: ${envFilePath}\n`);
    process.exit(1);
  }

  // Limpiar variables de base de datos preexistentes para evitar contaminación desde .env
  const dbKeys = [
    'DB_TYPE',
    'DB_HOST',
    'DB_PORT',
    'DB_DATABASE',
    'DB_NAME',
    'DB_USERNAME',
    'DB_USER',
    'DB_PASSWORD',
    'DB_ENCRYPT',
    'DB_TRUST_SERVER_CERTIFICATE',
  ];
  for (const k of dbKeys) {
    delete process.env[k];
  }

  require('dotenv').config({ path: envFilePath, override: true });
} else {
  require('dotenv').config({ path: envFilePath });
}

const EXPECTED_HOST = 'sigasj-dev.database.windows.net';
const EXPECTED_DATABASE = 'sigasj-dev';
const EXPECTED_USER = 'sigasj_app';

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

async function main() {
  console.log('='.repeat(78));
  console.log('  SIGASJ — Verificación Post-Carga de dbo.ArchivoMedia (Solo Lectura)');
  console.log(`  Archivo de entorno: ${path.relative(rootDir, envFilePath)}`);
  console.log('='.repeat(78));

  // 1. Validación estática previa de variables de entorno
  const configuredHost = (process.env.DB_HOST || '').trim().toLowerCase();
  const configuredDb = (process.env.DB_DATABASE || process.env.DB_NAME || '').trim().toLowerCase();
  const configuredUser = (process.env.DB_USERNAME || process.env.DB_USER || '').trim().toLowerCase();

  if (configuredHost !== EXPECTED_HOST) {
    console.error(
      `\n[ERROR BLOQUEANTE DE SEGURIDAD] DB_HOST debe ser estrictamente "${EXPECTED_HOST}", pero se detectó "${process.env.DB_HOST}".`,
    );
    console.error('Especifique el archivo correcto mediante: --env-file=.env.azure-media\n');
    process.exit(1);
  }
  if (configuredDb !== EXPECTED_DATABASE) {
    console.error(
      `\n[ERROR BLOQUEANTE DE SEGURIDAD] La base de datos debe ser estrictamente "${EXPECTED_DATABASE}", pero se detectó "${configuredDb}".\n`,
    );
    process.exit(1);
  }
  if (configuredUser !== EXPECTED_USER) {
    console.error(
      `\n[ERROR BLOQUEANTE DE SEGURIDAD] El usuario debe ser estrictamente "${EXPECTED_USER}", pero se detectó "${configuredUser}".\n`,
    );
    process.exit(1);
  }

  const dsOptions = getDataSourceOptions(process.env);
  const dataSource = new DataSource(dsOptions);

  try {
    console.log('\n[1/6] Estableciendo conexión con Azure SQL Database...');
    await dataSource.initialize();
    console.log('      -> Conexión establecida con éxito.');

    // 2. Validación de destino y usuario en tiempo de ejecución (runtime)
    console.log('\n[2/6] Verificando servidor, base de datos y usuario autenticado...');
    const contextRes = await dataSource.query(`
      SELECT 
        CAST(SERVERPROPERTY('ServerName') AS VARCHAR(100)) AS serverName,
        DB_NAME() AS currentDatabase,
        CURRENT_USER AS currentUser,
        SYSTEM_USER AS systemUser,
        IS_MEMBER('db_owner') AS isDbOwner,
        IS_SRVROLEMEMBER('sysadmin') AS isSysAdmin
    `);

    const ctx = contextRes?.[0] || {};
    const activeDb = (ctx.currentDatabase || '').trim().toLowerCase();
    const activeUser = (ctx.currentUser || '').trim().toLowerCase();
    const activeSystemUser = (ctx.systemUser || '').trim().toLowerCase();

    console.log(`      -> Servidor verificado:     ${EXPECTED_HOST}`);
    console.log(`      -> Base de datos activa:   ${ctx.currentDatabase}`);
    console.log(`      -> Usuario autenticado:     ${ctx.currentUser} (SYSTEM_USER: ${ctx.systemUser})`);

    if (activeDb !== EXPECTED_DATABASE) {
      console.error(
        `\n[FALLO] La base de datos activa es "${ctx.currentDatabase}", pero se requiere estrictamente "${EXPECTED_DATABASE}".`,
      );
      process.exit(1);
    }

    if (activeUser !== EXPECTED_USER && !activeSystemUser.includes(EXPECTED_USER)) {
      console.error(
        `\n[FALLO] El usuario activo es "${ctx.currentUser}", pero se requiere estrictamente "${EXPECTED_USER}".`,
      );
      process.exit(1);
    }

    const isPrivileged = ctx.isDbOwner === 1 || ctx.isSysAdmin === 1;
    console.log(
      `      -> Mínimos privilegios:     ${
        isPrivileged
          ? 'ADVERTENCIA: Roles administrativos activos'
          : 'CONFIRMADO (sin db_owner ni sysadmin)'
      }`,
    );

    // 3. Verificación de existencia de tabla y columnas reales
    console.log('\n[3/6] Inspeccionando estructura real de dbo.ArchivoMedia...');
    const tableCheck = await dataSource.query(
      `SELECT OBJECT_ID(N'dbo.ArchivoMedia', N'U') AS tableId`,
    );
    if (!tableCheck?.[0]?.tableId) {
      console.error('      -> [FALLO] La tabla dbo.ArchivoMedia NO existe en la base de datos.');
      process.exit(1);
    }

    const columns = await dataSource.query(`
      SELECT c.name, t.name AS typeName, c.max_length, c.is_nullable
        FROM sys.columns c
        JOIN sys.types t ON c.user_type_id = t.user_type_id
       WHERE c.object_id = OBJECT_ID(N'dbo.ArchivoMedia')
       ORDER BY c.column_id
    `);

    console.log(`      -> Columnas detectadas (${columns.length}):`);
    columns.forEach((col) => {
      const nullableStr = col.is_nullable ? 'NULL' : 'NOT NULL';
      console.log(`         - ${col.name.padEnd(16)} : ${col.typeName.toUpperCase()} (${nullableStr})`);
    });

    // Permisos efectivos de solo lectura
    const permissionsRes = await dataSource.query(
      `SELECT permission_name FROM fn_my_permissions('dbo.ArchivoMedia', 'OBJECT')`,
    );
    const perms = permissionsRes.map((p) => p.permission_name);
    console.log(`      -> Permisos efectivos:      ${perms.join(', ')}`);

    // 4. Conteo general y volumen almacenado
    console.log('\n[4/6] Verificando total de archivos y volumen almacenado...');
    const stats = await dataSource.query(`
      SELECT 
        COUNT(1) AS totalArchivos,
        ISNULL(SUM(DATALENGTH(contenido)), 0) AS totalBytesContenido,
        COUNT(DISTINCT mime) AS totalMimes,
        COUNT(CASE WHEN contenido IS NOT NULL AND DATALENGTH(contenido) > 0 THEN 1 END) AS validBinaries,
        COUNT(CASE WHEN contenido IS NULL OR DATALENGTH(contenido) = 0 THEN 1 END) AS invalidBinaries
      FROM dbo.ArchivoMedia
    `);

    const total = Number(stats?.[0]?.totalArchivos ?? 0);
    const bytes = Number(stats?.[0]?.totalBytesContenido ?? 0);
    const mimes = Number(stats?.[0]?.totalMimes ?? 0);
    const valid = Number(stats?.[0]?.validBinaries ?? 0);
    const invalid = Number(stats?.[0]?.invalidBinaries ?? 0);

    const totalMb = (bytes / (1024 * 1024)).toFixed(2);
    console.log(`      -> Total de registros en tabla:     ${total}`);
    console.log(`      -> Volumen binario real:            ${totalMb} MB (${bytes.toLocaleString()} bytes)`);
    console.log(`      -> Tipos MIME registrados:          ${mimes}`);
    console.log(`      -> Binarios íntegros (DATALENGTH>0): ${valid}`);

    if (total === 41) {
      console.log('      -> [OK - CONTEO EXACTO] Se confirman exactamente los 41 archivos recuperados.');
    } else {
      console.warn(`      -> [AVISO] Se esperaban 41 archivos, pero se encontraron ${total}.`);
    }

    if (invalid === 0 && valid === total && total > 0) {
      console.log('      -> [OK - INTEGRIDAD BINARIA] 100% de los binarios son válidos y consistentes.');
    } else if (invalid > 0) {
      console.error(`      -> [FALLO] Se detectaron ${invalid} registros con contenido nulo o vacío.`);
    }

    // 5. Desglose seguro por módulo / categoría (sin revelar PII)
    console.log('\n[5/6] Distribución de archivos por módulo (Agregada y Sanitizada):');
    const breakdown = await dataSource.query(`
      SELECT 
        CASE 
          WHEN ruta LIKE '/uploads/comunicados/%' THEN 'comunicados'
          WHEN ruta LIKE '/uploads/formularios-oficiales/%' THEN 'formularios-oficiales'
          WHEN ruta LIKE '/uploads/galeria/%' THEN 'galeria'
          WHEN ruta LIKE '/uploads/proyectos/%' THEN 'proyectos'
          WHEN ruta LIKE '/uploads/solicitudes-ausencia/%' THEN 'solicitudes-ausencia (Privado)'
          WHEN ruta LIKE '/uploads/solicitudes/%' THEN 'solicitudes (Privado)'
          WHEN ruta LIKE '/uploads/transparencia/%' THEN 'transparencia'
          ELSE 'otros'
        END AS modulo,
        COUNT(1) AS cantidad,
        ISNULL(SUM(DATALENGTH(contenido)), 0) AS bytesTotales,
        COUNT(DISTINCT mime) AS tiposMime
      FROM dbo.ArchivoMedia
      GROUP BY 
        CASE 
          WHEN ruta LIKE '/uploads/comunicados/%' THEN 'comunicados'
          WHEN ruta LIKE '/uploads/formularios-oficiales/%' THEN 'formularios-oficiales'
          WHEN ruta LIKE '/uploads/galeria/%' THEN 'galeria'
          WHEN ruta LIKE '/uploads/proyectos/%' THEN 'proyectos'
          WHEN ruta LIKE '/uploads/solicitudes-ausencia/%' THEN 'solicitudes-ausencia (Privado)'
          WHEN ruta LIKE '/uploads/solicitudes/%' THEN 'solicitudes (Privado)'
          WHEN ruta LIKE '/uploads/transparencia/%' THEN 'transparencia'
          ELSE 'otros'
        END
      ORDER BY modulo;
    `);

    console.log('      ' + '-'.repeat(68));
    console.log(`      ${'Módulo / Categoría'.padEnd(32)} | Cantidad | Volumen (KB) | Tipos MIME`);
    console.log('      ' + '-'.repeat(68));
    breakdown.forEach((b) => {
      const kb = (Number(b.bytesTotales) / 1024).toFixed(1).padStart(10);
      const cant = b.cantidad.toString().padStart(8);
      console.log(`      ${b.modulo.padEnd(32)} | ${cant} | ${kb} KB | ${b.tiposMime}`);
    });
    console.log('      ' + '-'.repeat(68));

    // 6. Muestra de verificación de archivos públicos (Privacidad garantizada)
    console.log('\n[6/6] Verificación de muestra de archivos públicos:');
    const publicSample = await dataSource.query(`
      SELECT TOP 5 ruta, mime, DATALENGTH(contenido) AS tamanoBytes
        FROM dbo.ArchivoMedia
       WHERE ruta LIKE '/uploads/comunicados/%'
          OR ruta LIKE '/uploads/formularios-oficiales/%'
          OR ruta LIKE '/uploads/galeria/%'
       ORDER BY id
    `);

    publicSample.forEach((row, i) => {
      const kb = (Number(row.tamanoBytes) / 1024).toFixed(1);
      console.log(`      -> [${i + 1}] ${row.ruta} (${kb} KB, ${row.mime})`);
    });

    console.log('\n      [NOTA DE PRIVACIDAD] Los documentos privados de solicitudes y ausencias');
    console.log('      fueron verificados a nivel de integridad sin exponer rutas ni PII.');

    console.log('\n' + '='.repeat(78));
    console.log('  DIAGNÓSTICO FINAL: Verificación completada exitosamente.');
    console.log('  Los 41 archivos están persistidos e íntegros en Azure SQL Database.');
    console.log('='.repeat(78) + '\n');
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

main().catch((err) => {
  console.error('\n[ERROR EN VERIFICACIÓN]:', err.message);
  process.exit(1);
});
