import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JotformWebhookService } from './jotform-webhook.service';

@ApiTags('Integraciones · Jotform')
@Controller('integraciones/jotform')
export class JotformWebhookController {
  constructor(private readonly webhookService: JotformWebhookService) {}

  /**
   * Ruta canónica PBI 6.5.2:
   * POST /api/v1/integraciones/jotform/ausencias
   *
   * Jotform no ofrece firma HMAC del webhook; la autenticidad se valida con
   * JOTFORM_WEBHOOK_SECRET en el query `key` (URL del webhook configurada en Jotform).
   * No usa JWT de usuario SIGASJ.
   */
  @Post('ausencias')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook de submissions de solicitud de ausencia (Jotform)',
    description:
      'Protegido con JOTFORM_WEBHOOK_SECRET en query `key`. ' +
      'Crea SolicitudAusencia PENDIENTE; no crea PermisoColaborador ni MovimientoVacaciones. ' +
      'Idempotente por submissionID (jotformSubmissionId UNIQUE).',
  })
  @ApiQuery({
    name: 'key',
    required: true,
    description: 'Secreto del webhook (JOTFORM_WEBHOOK_SECRET)',
  })
  procesar(@Body() body: unknown, @Query('key') key?: string) {
    return this.webhookService.procesar(body, key);
  }
}
