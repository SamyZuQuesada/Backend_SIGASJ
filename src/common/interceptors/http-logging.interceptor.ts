import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { isLivenessPath, safeRequestPath } from '../http/request-id';
import type { RequestWithId } from '../middleware/request-id.middleware';

/**
 * Log operativo liviano: method, path, status, duración, requestId.
 * No body, no Authorization, no cookies. Omite /health (Render hace polling).
 * Usa el evento `finish` para leer el status final tras ExceptionFilter.
 */
@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithId>();
    const res = http.getResponse<Response>();
    const path = safeRequestPath(req.originalUrl || req.url);
    const skipNoise = isLivenessPath(path);
    const started = Date.now();
    const requestId = req.requestId ?? '-';
    const method = req.method;

    if (!skipNoise) {
      res.on('finish', () => {
        this.write(
          method,
          path,
          res.statusCode,
          Date.now() - started,
          requestId,
        );
      });
    }

    return next.handle();
  }

  private write(
    method: string,
    path: string,
    status: number,
    durationMs: number,
    requestId: string,
  ): void {
    const line = `${method} ${path} ${status} ${durationMs}ms requestId=${requestId}`;
    if (status >= 500) {
      this.logger.error(line);
    } else if (status >= 400) {
      this.logger.warn(line);
    } else {
      this.logger.log(line);
    }
  }
}
