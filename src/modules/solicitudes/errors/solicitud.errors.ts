import { NotFoundException } from '@nestjs/common';

/**
 * Errores comunes y centralizados del módulo de Solicitudes Digitales.
 */
export class TipoSolicitudNoEncontradoException extends NotFoundException {
  constructor(criterio: string | number) {
    super(`El tipo de solicitud '${criterio}' no fue encontrado.`);
  }
}

export class SolicitudNoEncontradaException extends NotFoundException {
  constructor(criterio: string | number) {
    super(`La solicitud '${criterio}' no fue encontrada.`);
  }
}

/** Mensaje genérico de seguimiento público (anti-enumeración). */
export const MENSAJE_SEGUIMIENTO_NO_ENCONTRADO =
  'No fue posible localizar una solicitud con los datos proporcionados.';

/**
 * Combinación código+identificación inválida o consulta pública incompleta.
 * Misma respuesta para código inexistente, identificación incorrecta o cruce.
 */
export class SolicitudSeguimientoNoEncontradaException extends NotFoundException {
  constructor() {
    super(MENSAJE_SEGUIMIENTO_NO_ENCONTRADO);
  }
}
