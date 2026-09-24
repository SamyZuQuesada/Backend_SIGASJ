import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EstadoEnvioSmsAveria,
  MotivoBloqueoSmsAveria,
} from '../../common/enums/estado-envio-sms-averia.enum';
import { TipoEventoSmsAveria } from '../../common/enums/tipo-evento-sms-averia.enum';
import {
  type SmsAveriaPayload,
  type SmsAveriaResultado,
  type SmsAveriaSender,
} from './sms-averia.sender';
import { normalizarTelefonoSmsCr } from './telefono-sms-cr';

type InfobipSmsResponse = {
  messages?: Array<{
    messageId?: string;
    status?: { groupId?: number; name?: string };
  }>;
};

@Injectable()
export class InfobipSmsAveriaProvider implements SmsAveriaSender {
  private readonly logger = new Logger(InfobipSmsAveriaProvider.name);

  constructor(private readonly config: ConfigService) {}

  async enviar(payload: SmsAveriaPayload): Promise<SmsAveriaResultado> {
    const baseUrl = this.config.get<string>('sms.infobip.baseUrl') || '';
    const apiKey = this.config.get<string>('sms.infobip.apiKey') || '';
    const sender = this.config.get<string>('sms.infobip.sender') || '';
    const testMode = this.config.get<boolean>('sms.testMode') === true;
    const testToRaw = this.config.get<string>('sms.testTo') || '';

    if (!baseUrl || !apiKey || !sender) {
      return {
        estado: EstadoEnvioSmsAveria.NO_ENVIADO,
        motivo: MotivoBloqueoSmsAveria.PROVEEDOR_NO_CONFIGURADO,
      };
    }

    if (testMode && !testToRaw.trim()) {
      this.logger.warn(
        `SMS ${payload.tipoEvento} avería ${payload.idAveria} bloqueado: SMS_TEST_TO ausente`,
      );
      return {
        estado: EstadoEnvioSmsAveria.NO_ENVIADO,
        motivo: MotivoBloqueoSmsAveria.SMS_TEST_TO_AUSENTE,
      };
    }

    const destino = testMode
      ? normalizarTelefonoSmsCr(testToRaw)
      : normalizarTelefonoSmsCr(payload.telefonoDestino);
    if (!destino) {
      return {
        estado: EstadoEnvioSmsAveria.NO_ENVIADO,
        motivo: MotivoBloqueoSmsAveria.TELEFONO_INVALIDO,
      };
    }

    try {
      const response = await fetch(`${baseUrl}/sms/3/messages`, {
        method: 'POST',
        headers: {
          Authorization: `App ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              destinations: [{ to: destino }],
              sender,
              content: {
                text: textoSmsAveria(
                  payload.tipoEvento,
                  payload.codigoSeguimiento,
                ),
              },
            },
          ],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.status >= 400 && response.status < 500) {
        this.logger.warn(
          `Infobip HTTP ${response.status} (cliente) avería ${payload.idAveria}`,
        );
        return {
          estado: EstadoEnvioSmsAveria.ERROR,
          motivo: MotivoBloqueoSmsAveria.FALLO_PROVEEDOR,
          httpStatus: response.status,
        };
      }

      if (!response.ok) {
        this.logger.warn(
          `Infobip HTTP ${response.status} (proveedor) avería ${payload.idAveria}`,
        );
        return {
          estado: EstadoEnvioSmsAveria.ERROR,
          motivo: MotivoBloqueoSmsAveria.FALLO_PROVEEDOR,
          httpStatus: response.status,
        };
      }

      const body = (await response.json()) as InfobipSmsResponse;
      const messageId = body.messages?.[0]?.messageId;
      this.logger.log(
        `SMS ${payload.tipoEvento} avería ${payload.idAveria} aceptado por proveedor HTTP ${response.status} messageId=${messageId ?? 'n/a'}`,
      );
      return {
        estado: EstadoEnvioSmsAveria.ENVIADO,
        motivo: MotivoBloqueoSmsAveria.NINGUNO,
        httpStatus: response.status,
        messageId,
      };
    } catch (error) {
      const timeout =
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError');
      const causa =
        error instanceof Error && error.cause && typeof error.cause === 'object'
          ? (error.cause as { code?: string; message?: string })
          : undefined;
      this.logger.warn(
        `Infobip ${timeout ? 'timeout' : 'red'} avería ${payload.idAveria}: ` +
          `${error instanceof Error ? error.name : 'error'} ` +
          `${error instanceof Error ? error.message : ''} ` +
          `cause.code=${causa?.code ?? 'n/a'} ` +
          `cause.message=${causa?.message ?? 'n/a'}`,
      );
      return {
        estado: EstadoEnvioSmsAveria.ERROR,
        motivo: MotivoBloqueoSmsAveria.FALLO_PROVEEDOR,
      };
    }
  }
}

export function textoSmsAveria(
  tipoEvento: TipoEventoSmsAveria,
  codigoSeguimiento: string,
): string {
  switch (tipoEvento) {
    case TipoEventoSmsAveria.CONFIRMACION_REGISTRO:
      return (
        `SIGASJ: Su reporte de avería ${codigoSeguimiento} ` +
        'fue registrado correctamente.'
      );
    case TipoEventoSmsAveria.AVERIA_PENDIENTE:
      return (
        `SIGASJ: Su avería ${codigoSeguimiento} ` +
        'se encuentra pendiente de atención.'
      );
    case TipoEventoSmsAveria.AVERIA_RESUELTA:
      return (
        `SIGASJ: La reparación de su avería ${codigoSeguimiento} ` +
        'fue completada exitosamente.'
      );
  }
}
