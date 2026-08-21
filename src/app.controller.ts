import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService, type ApiHealthStatus } from './app.service';

@ApiTags('Salud')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Estado de la API',
    description:
      'Confirma que el backend de SIGASJ está en ejecución. No requiere autenticación.',
  })
  @ApiResponse({
    status: 200,
    description: 'El servicio responde correctamente',
  })
  getHealth(): ApiHealthStatus {
    return this.appService.getHealth();
  }

  @Get('health')
  @ApiOperation({ summary: 'Chequeo de salud (alias)' })
  @ApiResponse({
    status: 200,
    description: 'El servicio responde correctamente',
  })
  getHealthAlias(): ApiHealthStatus {
    return this.appService.getHealth();
  }
}
