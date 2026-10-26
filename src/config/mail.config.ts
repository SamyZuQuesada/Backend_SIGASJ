import { registerAs } from '@nestjs/config';
import { resolverMailEnabled } from './mail.enabled';

/**
 * Correo opcional (aprobación de ausencias, reparación exitosa de averías, etc.).
 * Si está apagado, solo se registra en logs (no falla la operación).
 */
export default registerAs('mail', () => ({
  enabled: resolverMailEnabled(),
  host: process.env.MAIL_HOST ?? '',
  port: Number(process.env.MAIL_PORT ?? 587),
  secure: process.env.MAIL_SECURE === 'true',
  user: process.env.MAIL_USER ?? '',
  password: (process.env.MAIL_PASSWORD ?? '').replace(/\s+/g, ''),
  from:
    process.env.MAIL_FROM?.trim() || 'SIGASJ ASADA <noreply@asadasanjuan.cr>',
  /** Base del Frontend para enlaces del correo (ej. http://localhost:5173). */
  frontendBaseUrl: (process.env.FRONTEND_BASE_URL ?? '').replace(/\/$/, ''),
}));
