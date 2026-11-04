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
