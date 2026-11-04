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
  if (
    !rest ||
    parts.some((part) => !part || part === '.' || part === '..')
  ) {
    return null;
  }

  return `/uploads/${parts.join('/')}`;
}

export async function ensureMediaBlobTable(): Promise<void> {
  if (!dataSource || dataSource.options.type !== 'mssql' || tableReady) {
    return;
  }

  await dataSource.query(`
    IF OBJECT_ID(N'dbo.ArchivoMedia', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.ArchivoMedia (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ruta VARCHAR(500) NOT NULL,
        mime VARCHAR(120) NOT NULL,
        contenido VARBINARY(MAX) NOT NULL,
        CONSTRAINT UQ_ArchivoMedia_ruta UNIQUE (ruta)
      );
    END
  `);
  tableReady = true;
}

export async function persistUploadedMedia(
  publicPath: string,
  mime: string,
  bytes: Buffer,
): Promise<void> {
  const ruta = mediaStorageKey(publicPath);
  if (!ruta || !dataSource || dataSource.options.type !== 'mssql') {
    return;
  }

  try {
    if (!tableReady) {
      await ensureMediaBlobTable();
    }
    const hex = bytes.toString('hex');
    await dataSource.query(
      `IF EXISTS (SELECT 1 FROM dbo.ArchivoMedia WHERE ruta = @0)
         UPDATE dbo.ArchivoMedia
            SET mime = @1, contenido = CONVERT(VARBINARY(MAX), @2, 2)
          WHERE ruta = @0
       ELSE
         INSERT INTO dbo.ArchivoMedia (ruta, mime, contenido)
         VALUES (@0, @1, CONVERT(VARBINARY(MAX), @2, 2))`,
      [ruta, mime, hex],
    );
  } catch (error) {
    logger.error(
      `No se pudo guardar ${ruta} en la base: ${error instanceof Error ? error.message : 'error'}`,
    );
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
    const rows = (await dataSource.query(
      `SELECT mime, contenido FROM dbo.ArchivoMedia WHERE ruta = @0`,
      [ruta],
    )) as Array<{ mime?: string; contenido?: Buffer | Uint8Array }>;
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
