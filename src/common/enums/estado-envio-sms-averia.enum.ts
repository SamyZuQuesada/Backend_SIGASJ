/**
 * Estado de un intento SMS.
 * ENVIADO: Infobip aceptó la petición (no implica entrega al teléfono).
 * SIMULADO queda por filas históricas; no se usa si Infobip aceptó.
 */
export enum EstadoEnvioSmsAveria {
  NO_ENVIADO = 'NO_ENVIADO',
  SIMULADO = 'SIMULADO',
  ENVIADO = 'ENVIADO',
  ERROR = 'ERROR',
}

export enum MotivoBloqueoSmsAveria {
  NINGUNO = 'NINGUNO',
  PROVEEDOR_NO_CONFIGURADO = 'PROVEEDOR_NO_CONFIGURADO',
  SMS_TEST_TO_AUSENTE = 'SMS_TEST_TO_AUSENTE',
  TELEFONO_INVALIDO = 'TELEFONO_INVALIDO',
  CONSENTIMIENTO_NO_REGISTRADO = 'CONSENTIMIENTO_NO_REGISTRADO',
  DESTINATARIO_NO_CONFIRMADO = 'DESTINATARIO_NO_CONFIRMADO',
  FALLO_PROVEEDOR = 'FALLO_PROVEEDOR',
}
