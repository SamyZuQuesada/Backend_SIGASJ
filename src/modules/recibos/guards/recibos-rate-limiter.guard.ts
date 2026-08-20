import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

@Injectable()
export class RecibosRateLimiterGuard implements CanActivate {
  private readonly requestCounts = new Map<string, RateLimitRecord>();

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';

    const windowMs =
      this.configService.get<number>('acueductosCr.rateLimitWindowMs') || 60000;
    const maxRequests =
      this.configService.get<number>('acueductosCr.rateLimitMax') || 10;

    const now = Date.now();
    this.cleanExpired(now);

    const record = this.requestCounts.get(clientIp);

    if (!record || now > record.resetTime) {
      this.requestCounts.set(clientIp, {
        count: 1,
        resetTime: now + windowMs,
      });
      return true;
    }

    if (record.count >= maxRequests) {
      throw new HttpException(
        'Demasiadas consultas de recibos desde esta dirección IP. Por favor intente más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.count++;
    return true;
  }

  private cleanExpired(now: number): void {
    for (const [ip, record] of this.requestCounts.entries()) {
      if (now > record.resetTime) {
        this.requestCounts.delete(ip);
      }
    }
  }
}
