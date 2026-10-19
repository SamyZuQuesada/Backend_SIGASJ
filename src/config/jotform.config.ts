import { registerAs } from '@nestjs/config';

/**
 * Integración Jotform (épica 6.5). Secretos solo en Backend.
 * El Frontend solo necesita el form ID público (VITE_JOTFORM_FORM_ID).
 */
export default registerAs('jotform', () => ({
  formId: (process.env.JOTFORM_FORM_ID || '').trim(),
  apiKey: (process.env.JOTFORM_API_KEY || '').trim(),
  apiBaseUrl: (process.env.JOTFORM_API_BASE_URL || 'https://api.jotform.com')
    .trim()
    .replace(/\/$/, ''),
  /**
   * Secreto en query `?key=` de
   * POST /api/v1/integraciones/jotform/ausencias
   * (Jotform no ofrece firma HMAC del webhook; la URL lleva el secreto).
   */
  webhookSecret: (process.env.JOTFORM_WEBHOOK_SECRET || '').trim(),
  /** Si true y hay API key, verifica submissionID contra la API de Jotform. */
  verifySubmission: process.env.JOTFORM_VERIFY_SUBMISSION === 'true',
  /** QIDs o nombres de campo del formulario (mapeo flexible). */
  fields: {
    correlacion: (
      process.env.JOTFORM_FIELD_CORRELACION || 'correlacion'
    ).trim(),
    tipo: (process.env.JOTFORM_FIELD_TIPO || 'tipo').trim(),
    fechaInicio: (
      process.env.JOTFORM_FIELD_FECHA_INICIO || 'fechaInicio'
    ).trim(),
    fechaFin: (process.env.JOTFORM_FIELD_FECHA_FIN || 'fechaFin').trim(),
    motivo: (process.env.JOTFORM_FIELD_MOTIVO || 'motivo').trim(),
  },
  /** TTL del token de correlación emitido al Fontanero (minutos). */
  correlacionTtlMinutos: Math.max(
    5,
    parseInt(process.env.JOTFORM_CORRELACION_TTL_MINUTOS || '60', 10) || 60,
  ),
}));
