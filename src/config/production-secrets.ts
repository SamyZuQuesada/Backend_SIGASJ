/**
 * Validación de secretos de producción (JWT).
 * No imprime valores. No introduce un segundo mecanismo de env validation.
 */

const INSECURE_JWT_DEFAULTS = new Set([
  'super_secret_jwt_key_sigasj_2026',
  'secret',
  '123456',
  'jwt-secret',
  'changeme',
  'password',
]);

const DEV_ONLY_JWT_FALLBACK = 'super_secret_jwt_key_sigasj_2026';

export function isProductionNodeEnv(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return (nodeEnv || 'development').toLowerCase() === 'production';
}

export function isInsecureJwtSecret(secret: string | undefined): boolean {
  if (!secret || !secret.trim()) {
    return true;
  }
  return INSECURE_JWT_DEFAULTS.has(secret.trim());
}

/**
 * Resuelve JWT_SECRET.
 * Producción: obligatorio y distinto de defaults conocidos.
 * Desarrollo/test: usa env o fallback local documentado (nunca en Render).
 */
export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.JWT_SECRET?.trim();
  if (isProductionNodeEnv(env.NODE_ENV)) {
    if (isInsecureJwtSecret(raw)) {
      throw new Error(
        'JWT_SECRET es obligatorio en producción y no puede usar un valor de desarrollo o placeholder. Configure un secreto fuerte en Render (Environment Variables) y reinicie el servicio.',
      );
    }
    return raw as string;
  }
  if (raw) {
    return raw;
  }
  return DEV_ONLY_JWT_FALLBACK;
}

/**
 * Falla el bootstrap en producción si faltan secretos críticos.
 * Llamar desde main.ts antes de listen.
 */
export function assertProductionSecrets(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!isProductionNodeEnv(env.NODE_ENV)) {
    return;
  }
  // Fuerza la misma regla que resolveJwtSecret (sin imprimir el valor).
  resolveJwtSecret(env);

  const frontend =
    env.FRONTEND_URL?.trim() ||
    env.FRONTEND_BASE_URL?.trim() ||
    env.CORS_ALLOWED_ORIGINS?.trim();
  if (!frontend) {
    throw new Error(
      'En producción debe definir FRONTEND_URL (o FRONTEND_BASE_URL / CORS_ALLOWED_ORIGINS) con el origen HTTPS autorizado del Frontend (p. ej. Vercel). No use wildcard.',
    );
  }
}
