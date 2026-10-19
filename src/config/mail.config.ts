import { registerAs } from '@nestjs/config';

/**
 * Correo opcional para notificar aprobación de solicitudes de ausencia.
 * Si MAIL_ENABLED !== true, solo se registra en logs (no falla la aprobación).
 */
export default registerAs('mail', () => ({
  enabled: process.env.MAIL_ENABLED === 'true',
  host: process.env.MAIL_HOST ?? '',
  port: Number(process.env.MAIL_PORT ?? 587),
  secure: process.env.MAIL_SECURE === 'true',
  user: process.env.MAIL_USER ?? '',
  password: process.env.MAIL_PASSWORD ?? '',
  from:
    process.env.MAIL_FROM?.trim() ||
    'SIGASJ ASADA <noreply@asadasanjuan.cr>',
  /** Base del Frontend para enlaces del correo (ej. http://localhost:5173). */
  frontendBaseUrl: (process.env.FRONTEND_BASE_URL ?? '').replace(/\/$/, ''),
}));
