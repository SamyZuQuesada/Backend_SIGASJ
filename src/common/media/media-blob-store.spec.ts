import { DataSource } from 'typeorm';
import {
  bindMediaDataSource,
  ensureMediaBlobTable,
  isMediaBlobTableReady,
  setMediaBlobTableReadyForTesting,
  mediaStorageKey,
  persistUploadedMedia,
  readStoredMedia,
  relocateUploadedMedia,
  forgetUploadedMedia,
} from './media-blob.store';
import { MediaBlobMiddleware } from './media-blob.middleware';
import type { Request, Response } from 'express';

describe('MediaBlob Store & Middleware Integration Unit Tests', () => {
  let mockQuery: jest.Mock;
  let mockDataSource: DataSource;

  beforeEach(() => {
    mockQuery = jest.fn();
    mockDataSource = {
      options: { type: 'mssql' },
      query: mockQuery,
    } as unknown as DataSource;
    bindMediaDataSource(mockDataSource);
    setMediaBlobTableReadyForTesting(false);
  });

  describe('ensureMediaBlobTable', () => {
    it('diagnostica y no intenta CREATE TABLE si la tabla no existe', async () => {
      mockQuery.mockResolvedValueOnce([{ tableId: null }]);

      const ready = await ensureMediaBlobTable();
      expect(ready).toBe(false);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain('SELECT OBJECT_ID');
      expect(sql).not.toContain('CREATE TABLE');
    });

    it('detecta exitosamente si la tabla existe', async () => {
      mockQuery.mockResolvedValueOnce([{ tableId: 12345 }]);

      const ready = await ensureMediaBlobTable();
      expect(ready).toBe(true);
      expect(isMediaBlobTableReady()).toBe(true);
    });
  });

  describe('relocateUploadedMedia', () => {
    it('actualiza la ruta de un archivo persistido al reubicarse (ej. de pendiente a definitiva)', async () => {
      mockQuery.mockResolvedValueOnce([{ tableId: 12345 }]); // ensureMediaBlobTable
      mockQuery.mockResolvedValueOnce([]); // UPDATE

      const oldPath = '/uploads/solicitudes/pendientes/doc-1.pdf';
      const newPath = '/uploads/solicitudes/19/doc-1.pdf';

      const success = await relocateUploadedMedia(oldPath, newPath);
      expect(success).toBe(true);

      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[0]).toContain('UPDATE dbo.ArchivoMedia');
      expect(updateCall[1]).toEqual([oldPath, newPath]);
    });
  });

  describe('persistUploadedMedia', () => {
    it('persiste binario calculando tamaño y fecha sin errores', async () => {
      mockQuery.mockResolvedValueOnce([{ tableId: 12345 }]); // ensureMediaBlobTable
      mockQuery.mockResolvedValueOnce([]); // UPSERT

      const buffer = Buffer.from('contenido de prueba');
      await persistUploadedMedia('/uploads/galeria/foto.jpg', 'image/jpeg', buffer);

      const upsertCall = mockQuery.mock.calls[1];
      expect(upsertCall[0]).toContain('tamanoBytes');
      expect(upsertCall[0]).toContain('createdAt');
      expect(upsertCall[1][0]).toBe('/uploads/galeria/foto.jpg');
      expect(upsertCall[1][1]).toBe('image/jpeg');
      expect(upsertCall[1][3]).toBe(buffer.length);
    });
  });

  describe('MediaBlobMiddleware - Protección de documentos privados', () => {
    let middleware: MediaBlobMiddleware;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: jest.Mock;

    beforeEach(() => {
      middleware = new MediaBlobMiddleware();
      res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        end: jest.fn(),
        json: jest.fn(),
        headersSent: false,
      };
      next = jest.fn();
    });

    it('bloquea con 403 Forbidden acceso público directo a /uploads/solicitudes/ y no llama a next()', () => {
      req = {
        method: 'GET',
        originalUrl: '/uploads/solicitudes/19/cedula.pdf',
        url: '/uploads/solicitudes/19/cedula.pdf',
      };

      middleware.use(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403, error: 'Forbidden' }),
      );
    });

    it('bloquea con 403 Forbidden acceso público directo a /uploads/solicitudes-ausencia/', () => {
      req = {
        method: 'GET',
        originalUrl: '/uploads/solicitudes-ausencia/11/incapacidad.pdf',
        url: '/uploads/solicitudes-ausencia/11/incapacidad.pdf',
      };

      middleware.use(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('bloquea con 403 Forbidden acceso público directo a /uploads/movimientos-inventario/', () => {
      req = {
        method: 'GET',
        originalUrl: '/uploads/movimientos-inventario/1/factura.pdf',
        url: '/uploads/movimientos-inventario/1/factura.pdf',
      };

      middleware.use(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('bloquea con 403 Forbidden acceso público directo a /uploads/actividades-fontanero/', () => {
      req = {
        method: 'GET',
        originalUrl: '/uploads/actividades-fontanero/1/foto.jpg',
        url: '/uploads/actividades-fontanero/1/foto.jpg',
      };

      middleware.use(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('bloquea con 403 Forbidden acceso a través de /api/v1/uploads/solicitudes/', () => {
      req = {
        method: 'GET',
        originalUrl: '/api/v1/uploads/solicitudes/19/documento.pdf',
        url: '/api/v1/uploads/solicitudes/19/documento.pdf',
      };

      middleware.use(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('permite servir medios públicos como /uploads/comunicados/ desde dbo.ArchivoMedia cuando no están en disco', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          mime: 'image/jpeg',
          contenido: Buffer.from('imagen-comunicado-bytes'),
        },
      ]);

      req = {
        method: 'GET',
        originalUrl: '/uploads/comunicados/1789018161592-test.jpg',
        url: '/uploads/comunicados/1789018161592-test.jpg',
      };

      middleware.use(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(res.setHeader).toHaveBeenCalledWith('Cross-Origin-Resource-Policy', 'cross-origin');
      expect(res.end).toHaveBeenCalledWith(Buffer.from('imagen-comunicado-bytes'));
    });

    it('permite servir fotos de /uploads/proyectos/ desde dbo.ArchivoMedia', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          mime: 'image/jpeg',
          contenido: Buffer.from('proyecto-cover-bytes'),
        },
      ]);

      req = {
        method: 'GET',
        originalUrl: '/uploads/proyectos/1_cover_test.jpg',
        url: '/uploads/proyectos/1_cover_test.jpg',
      };

      middleware.use(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(res.end).toHaveBeenCalledWith(Buffer.from('proyecto-cover-bytes'));
    });

    it('permite servir medios solicitados con prefijo /api/v1/uploads/ desde dbo.ArchivoMedia', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          mime: 'image/png',
          contenido: Buffer.from('galeria-png-bytes'),
        },
      ]);

      req = {
        method: 'GET',
        originalUrl: '/api/v1/uploads/galeria/1787372809687-test.png',
        url: '/api/v1/uploads/galeria/1787372809687-test.png',
      };

      middleware.use(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(res.end).toHaveBeenCalledWith(Buffer.from('galeria-png-bytes'));
    });

    it('responde correctamente a peticiones HEAD sin enviar el cuerpo binario', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          mime: 'image/jpeg',
          contenido: Buffer.from('bytes-para-head'),
        },
      ]);

      req = {
        method: 'HEAD',
        originalUrl: '/uploads/comunicados/archivo-head-remoto.jpg',
        url: '/uploads/comunicados/archivo-head-remoto.jpg',
      };

      middleware.use(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(res.end).toHaveBeenCalledWith(); // Sin argumentos (sin body)
    });

    it('llama a next() cuando el archivo no existe en dbo.ArchivoMedia ni en disco', async () => {
      mockQuery.mockResolvedValueOnce([]); // no rows found

      req = {
        method: 'GET',
        originalUrl: '/uploads/comunicados/no-existe.jpg',
        url: '/uploads/comunicados/no-existe.jpg',
      };

      middleware.use(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });
});
