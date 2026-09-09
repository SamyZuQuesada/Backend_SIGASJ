/**
 * Catálogo de mensajes del módulo de actividades del Fontanero.
 *
 * Contrato HTTP (compatible con React / interpretActividadApiError):
 * - Éxito: payload plano (DTO o listado `{ data, total, ... }`). Sin envelope
 *   `{ success, message, data }` — rompería el Frontend.
 * - Error: `{ statusCode, message }` vía HttpExceptionFilter.
 *
 * Los avisos visuales de éxito (p. ej. “Actividad registrada correctamente”)
 * los arma el Frontend a partir del status 200/201; aquí se estandarizan
 * los mensajes de error controlados.
 */
export const ACTIVIDADES_MSG = {
  // Auth / acceso (alineado con JwtAuthGuard / RolesGuard)
  unauthorized: 'No autenticado',
  forbidden: 'Acceso denegado',

  // Recursos
  actividadNotFound: 'Actividad no encontrada',
  tipoNotFound: 'Tipo de actividad no encontrado',
  tipoInactivo: 'El tipo de actividad no está activo',
  invalidId: 'El identificador de la actividad no es válido',

  // Dominio
  yaRevisada: 'La actividad ya fue revisada',
  rangoFechasInvalido: 'fechaInicio no puede ser posterior a fechaFin',
  informacionIncompleta:
    'La información de la actividad está incompleta. Revise los campos indicados.',

  // Documentos / Multer
  documentoRequerido: 'Debe adjuntar un archivo.',
  documentoDemasiadoGrande: 'El archivo no puede superar 10 MB.',
  documentoLimiteCantidad:
    'Se superó la cantidad máxima de documentos permitidos.',
  documentoCampoInvalido: 'El archivo enviado no es válido.',

  // Genéricos seguros
  validacionGenerica:
    'Los datos enviados no son válidos. Revise la información e intente nuevamente.',
  interno: 'Error interno del servidor',
} as const;

export type ActividadesMsgKey = keyof typeof ACTIVIDADES_MSG;
