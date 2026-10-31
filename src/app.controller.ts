import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService, type ApiHealthStatus } from './app.service';

@ApiTags('Salud')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Estado de la API (liveness)',
    description:
      'Confirma que el proceso NestJS responde. Público, sin JWT. No comprueba SQL Server.',
  })
  @ApiResponse({
    status: 200,
    description: 'Proceso disponible',
  })
  getHealth(): ApiHealthStatus {
    return this.appService.getHealth();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health Check (Render)',
    description:
      'Ruta oficial de liveness. Prefijo global → GET /api/v1/health. Sin autenticación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Proceso disponible',
  })
  getHealthAlias(): ApiHealthStatus {
    return this.appService.getHealth();
  }
}
