import { TipoEventoSmsAveria } from '../../common/enums/tipo-evento-sms-averia.enum';
import {
  EstadoEnvioSmsAveria,
  MotivoBloqueoSmsAveria,
} from '../../common/enums/estado-envio-sms-averia.enum';

export type SmsAveriaPayload = {
  idAveria: number;
  codigoSeguimiento: string;
  tipoEvento: TipoEventoSmsAveria;
  /** Solo en memoria para el intento de envío. No se persiste. */
  telefonoDestino?: string;
};

export type SmsAveriaResultado = {
  estado: EstadoEnvioSmsAveria;
  motivo: MotivoBloqueoSmsAveria;
  httpStatus?: number;
  messageId?: string;
};

export const SMS_AVERIA_SENDER = 'SMS_AVERIA_SENDER';

export interface SmsAveriaSender {
  enviar(payload: SmsAveriaPayload): Promise<SmsAveriaResultado>;
}

/**
 * Adaptador por defecto: no hay proveedor contratado.
 * Un resultado SIMULADO o ENTREGADA de un mock de prueba no equivale a envío real.
 */
export class SmsAveriaSinProveedor implements SmsAveriaSender {
  enviar(payload: SmsAveriaPayload): Promise<SmsAveriaResultado> {
    void payload;
    return Promise.resolve({
      estado: EstadoEnvioSmsAveria.NO_ENVIADO,
      motivo: MotivoBloqueoSmsAveria.PROVEEDOR_NO_CONFIGURADO,
    });
  }
}
