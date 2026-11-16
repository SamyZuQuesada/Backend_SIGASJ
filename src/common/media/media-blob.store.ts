import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

const logger = new Logger('MediaBlob');

let dataSource: DataSource | null = null;
let tableReady = false;

export type StoredMedia = {
  mime: string;
  bytes: Buffer;
};

export function bindMediaDataSource(source: DataSource): void {
  dataSource = source;
}

export function isMediaBlobTableReady(): boolean {
  return tableReady;
}

export function setMediaBlobTableReadyForTesting(ready: boolean): void {
  tableReady = ready;
}

export function mediaStorageKey(publicPath: string): string | null {
  let url = publicPath.trim().replace(/\\/g, '/');
  const query = url.indexOf('?');
  if (query >= 0) {
    url = url.slice(0, query);
  }

  try {
    url = decodeURIComponent(url);
  } catch {
    return null;
  }

  const mediaPrefix = '/api/v1/public/media/';
  const shortMediaPrefix = '/public/media/';
  const apiUploadsPrefix = '/api/v1/uploads/';

  if (url.startsWith(mediaPrefix)) {
    url = `/uploads/${url.slice(mediaPrefix.length)}`;
  } else if (url.startsWith(shortMediaPrefix)) {
    url = `/uploads/${url.slice(shortMediaPrefix.length)}`;
  } else if (url.startsWith(apiUploadsPrefix)) {
    url = `/uploads/${url.slice(apiUploadsPrefix.length)}`;
  } else {
    const uploadsIdx = url.toLowerCase().indexOf('uploads/');
    if (uploadsIdx === -1) {
      return null;
    }
    url = `/uploads/${url.slice(uploadsIdx + 'uploads/'.length).replace(/^\/+/, '')}`;
  }

  const rest = url.slice('/uploads/'.length);
  const parts = rest.split('/');
  if (!rest || parts.some((part) => !part || part === '.' || part === '..')) {
    return null;
  }

  return `/uploads/${parts.join('/')}`;
}

export async function ensureMediaBlobTable(): Promise<boolean> {
  if (!dataSource || dataSource.options.type !== 'mssql') {
    return false;
  }
  if (tableReady) {
    return true;
  }

  try {
    const rows = await dataSource.query(`
      SELECT OBJECT_ID(N'dbo.ArchivoMedia', N'U') AS tableId
    `);
    const exists = Boolean(rows?.[0]?.tableId);
    if (exists) {
      tableReady = true;
      logger.log(
        '[MediaBlob] Tabla dbo.ArchivoMedia detectada y lista para almacenamiento persistente.',
      );
      return true;
    }

    logger.warn(
      '[MediaBlob] DIAGNÓSTICO: La tabla dbo.ArchivoMedia NO existe en la base de datos. ' +
        'El backend no ejecutará CREATE TABLE automáticamente por directriz de mínimos privilegios (sigasj_app). ' +
        'Aplique la migración TypeORM correspondiente o cree la tabla mediante sigasj_sqladmin.',
    );
    return false;
  } catch (error) {
    logger.error(
      `[MediaBlob] No se pudo verificar la existencia de dbo.ArchivoMedia: ${error instanceof Error ? error.message : 'error'}`,
    );
    return false;
  }
}

export async function persistUploadedMedia(
  publicPath: string,
  mime: string,
  bytes: Buffer,
): Promise<boolean> {
  const ruta = mediaStorageKey(publicPath);
  if (!ruta || !dataSource || dataSource.options.type !== 'mssql') {
    return false;
  }

  try {
    if (!tableReady) {
      const ready = await ensureMediaBlobTable();
      if (!ready) {
        return false;
      }
    }
    const hex = bytes.toString('hex');
    const tamano = bytes.length;
    await dataSource.query(
      `IF EXISTS (SELECT 1 FROM dbo.ArchivoMedia WHERE ruta = @0)
         UPDATE dbo.ArchivoMedia
            SET mime = @1,
                contenido = CONVERT(VARBINARY(MAX), @2, 2),
                tamanoBytes = @3,
                updatedAt = SYSUTCDATETIME()
          WHERE ruta = @0
       ELSE
         INSERT INTO dbo.ArchivoMedia (ruta, mime, contenido, tamanoBytes, createdAt)
         VALUES (@0, @1, CONVERT(VARBINARY(MAX), @2, 2), @3, SYSUTCDATETIME())`,
      [ruta, mime, hex, tamano],
    );
    return true;
  } catch (error) {
    logger.error(
      `No se pudo guardar ${ruta} en dbo.ArchivoMedia: ${error instanceof Error ? error.message : 'error'}`,
    );
    throw error;
  }
}

export async function relocateUploadedMedia(
  oldPublicPath: string,
  newPublicPath: string,
): Promise<boolean> {
  const oldRuta = mediaStorageKey(oldPublicPath);
  const newRuta = mediaStorageKey(newPublicPath);
  if (
    !oldRuta ||
    !newRuta ||
    oldRuta === newRuta ||
    !dataSource ||
    dataSource.options.type !== 'mssql'
  ) {
    return false;
  }

  try {
    if (!tableReady) {
      const ready = await ensureMediaBlobTable();
      if (!ready) {
        return false;
      }
    }

    const rows = await dataSource.query(
      `UPDATE dbo.ArchivoMedia
          SET ruta = @1,
              updatedAt = SYSUTCDATETIME()
        WHERE ruta = @0;
       SELECT @@ROWCOUNT AS affectedRows;`,
      [oldRuta, newRuta],
    );
    const affected = rows?.[0]?.affectedRows ?? 1;
    return affected > 0;
  } catch (error) {
    logger.error(
      `No se pudo reubicar ${oldRuta} hacia ${newRuta}: ${error instanceof Error ? error.message : 'error'}`,
    );
    throw error;
  }
}

export async function readStoredMedia(
  publicPath: string,
): Promise<StoredMedia | null> {
  const ruta = mediaStorageKey(publicPath);
  if (!ruta || !dataSource || dataSource.options.type !== 'mssql') {
    return null;
  }

  try {
    const rows = await dataSource.query(
      `SELECT mime, contenido FROM dbo.ArchivoMedia WHERE ruta = @0`,
      [ruta],
    );
    const row = rows?.[0];
    if (!row?.contenido) {
      return null;
    }
    return {
      mime: row.mime || 'application/octet-stream',
      bytes: Buffer.isBuffer(row.contenido)
        ? row.contenido
        : Buffer.from(row.contenido),
    };
  } catch {
    return null;
  }
}

export function forgetUploadedMedia(publicPath: string): void {
  const ruta = mediaStorageKey(publicPath);
  if (!ruta || !dataSource || dataSource.options.type !== 'mssql') {
    return;
  }

  void dataSource
    .query(`DELETE FROM dbo.ArchivoMedia WHERE ruta = @0`, [ruta])
    .catch(() => undefined);
}
