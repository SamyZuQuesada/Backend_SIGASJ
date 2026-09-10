import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { MulterError } from 'multer';

const INTERNAL_MESSAGE = 'Error interno del servidor';

const TECHNICAL_PATTERN =
  /\b(QueryFailedError|EntityNotFoundError|TypeORM|SQL|stack|constraint|INSERT|UPDATE|DELETE|SELECT|driverError|ECONNREFUSED|at\s+\w+\s+\()/i;

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const multerMapped = this.mapMulterError(exception);
    if (multerMapped) {
      this.logger.warn(
        `${request.method} ${request.url} ${multerMapped.statusCode} MulterError`,
      );
      response.status(multerMapped.statusCode).json(multerMapped);
      return;
    }

    const payloadMapped = this.mapPayloadTooLarge(exception);
    if (payloadMapped) {
      this.logger.warn(
        `${request.method} ${request.url} ${payloadMapped.statusCode} PayloadTooLarge`,
      );
      response.status(payloadMapped.statusCode).json(payloadMapped);
      return;
    }

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      isHttp && status < 500
        ? this.sanitizePublicMessage(this.publicHttpMessage(exception))
        : INTERNAL_MESSAGE;

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

  private mapPayloadTooLarge(
    exception: unknown,
  ): { statusCode: number; message: string } | null {
    if (!(exception instanceof HttpException)) {
      return null;
    }
    if (exception.getStatus() !== HttpStatus.PAYLOAD_TOO_LARGE) {
      return null;
    }
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'El archivo no puede superar 10 MB.',
    };
  }

  private mapMulterError(
    exception: unknown,
  ): { statusCode: number; message: string } | null {
    if (!this.isMulterError(exception)) {
      return null;
    }

    switch (exception.code) {
      case 'LIMIT_FILE_SIZE':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'El archivo no puede superar 10 MB.',
        };
      case 'LIMIT_FILE_COUNT':
      case 'LIMIT_UNEXPECTED_FILE':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Se superó la cantidad máxima de documentos permitidos.',
        };
      default:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'El archivo enviado no es válido.',
        };
    }
  }

  private isMulterError(exception: unknown): exception is MulterError {
    return (
      exception instanceof MulterError ||
      (typeof exception === 'object' &&
        exception !== null &&
        'name' in exception &&
        (exception as { name?: string }).name === 'MulterError' &&
        'code' in exception &&
        typeof (exception as { code?: unknown }).code === 'string')
    );
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

  private sanitizePublicMessage(message: string | string[]): string | string[] {
    if (Array.isArray(message)) {
      return message.map((item) =>
        this.looksTechnical(item)
          ? 'Los datos enviados no son válidos. Revise la información e intente nuevamente.'
          : item,
      );
    }
    if (this.looksTechnical(message)) {
      return 'Los datos enviados no son válidos. Revise la información e intente nuevamente.';
    }
    return message;
  }

  private looksTechnical(text: string): boolean {
    return TECHNICAL_PATTERN.test(text) || text.length > 220;
  }

  private safeExceptionName(exception: unknown): string {
    if (exception instanceof Error) {
      return exception.name;
    }
    return 'Error';
  }
}
