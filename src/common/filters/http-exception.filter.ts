import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      isHttp && status < 500
        ? this.publicHttpMessage(exception)
        : 'Error interno del servidor';

    const logLine = `${request.method} ${request.url} ${status} ${this.safeExceptionName(exception)}`;
    if (status >= 500) {
      this.logger.error(logLine);
    } else {
      this.logger.warn(logLine);
    }

    response.status(status).json({
      statusCode: status,
      message,
    });
  }

  private publicHttpMessage(exception: HttpException): string | string[] {
    const body = exception.getResponse();
    if (typeof body === 'string') {
      return body;
    }
    if (body && typeof body === 'object' && 'message' in body) {
      const { message } = body as { message: string | string[] };
      return message;
    }
    return exception.message;
  }

  private safeExceptionName(exception: unknown): string {
    if (exception instanceof Error) {
      return exception.name;
    }
    return 'Error';
  }
}
