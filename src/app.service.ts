import { Injectable } from '@nestjs/common';

/** Liveness mínimo para Render. Sin secretos, sin PII, sin dependencias. */
export type ApiHealthStatus = {
  status: 'ok';
};

@Injectable()
export class AppService {
  getHealth(): ApiHealthStatus {
    return { status: 'ok' };
  }
}
