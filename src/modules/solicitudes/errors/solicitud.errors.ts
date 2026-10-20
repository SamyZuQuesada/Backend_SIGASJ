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
