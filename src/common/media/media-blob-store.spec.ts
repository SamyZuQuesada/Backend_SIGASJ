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

    it('permite servir medios públicos como /uploads/comunicados/ y /uploads/galeria/', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          mime: 'image/jpeg',
          contenido: Buffer.from('imagen-bytes'),
        },
      ]);

      req = {
        method: 'GET',
        originalUrl: '/uploads/comunicados/aviso.jpg',
        url: '/uploads/comunicados/aviso.jpg',
      };

      middleware.use(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(res.end).toHaveBeenCalledWith(Buffer.from('imagen-bytes'));
    });
  });
});
