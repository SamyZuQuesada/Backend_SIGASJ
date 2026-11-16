import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { readStoredMedia } from './media-blob.store';

@Injectable()
export class MediaBlobMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    const requestPath = req.originalUrl || req.url;
    let normalized = (requestPath || '').toLowerCase().replace(/\\/g, '/');
    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      // Si el URI es inválido, continuar con el string en bruto
    }

    // Documentos privados bajo solicitudes, ausencias, inventario o actividades de fontanero:
    // NUNCA se sirven por middleware público ni por Express Static.
    // Solo accesibles mediante sus respectivos controladores protegidos (JwtAuthGuard y RolesGuard).
    const isPrivateFolder =
      normalized.includes('/uploads/solicitudes/') ||
      normalized.includes('/uploads/solicitudes-ausencia/') ||
      normalized.includes('/uploads/movimientos-inventario/') ||
      normalized.includes('/uploads/actividades-fontanero/') ||
      normalized.includes('/api/v1/uploads/solicitudes/') ||
      normalized.includes('/api/v1/uploads/solicitudes-ausencia/') ||
      normalized.includes('/api/v1/uploads/movimientos-inventario/') ||
      normalized.includes('/api/v1/uploads/actividades-fontanero/');

    if (isPrivateFolder) {
      res.status(403).json({
        statusCode: 403,
        error: 'Forbidden',
        message:
          'Acceso denegado: los documentos privados no se exponen mediante rutas estáticas. Utilice los endpoints autenticados y autorizados de la API.',
      });
      return;
    }

    void readStoredMedia(requestPath)
      .then((stored) => {
        if (!stored || res.headersSent) {
          next();
          return;
        }

        res.status(200);
        res.setHeader('Content-Type', stored.mime);
        res.setHeader('Content-Length', String(stored.bytes.length));
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        res.end(stored.bytes);
      })
      .catch(() => next());
  }
}
