import { Injectable } from '@nestjs/common';

export type ApiHealthStatus = {
  name: string;
  status: 'ok';
  message: string;
  version: string;
};

@Injectable()
export class AppService {
  getHealth(): ApiHealthStatus {
    return {
      name: 'SIGASJ API',
      status: 'ok',
      message: 'Sistema de Gestión de la ASADA San Juan',
      version: '1.0.0',
    };
  }
}
