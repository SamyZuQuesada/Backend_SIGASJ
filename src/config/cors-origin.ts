import { isProductionNodeEnv } from './production-secrets';

const DEV_DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
] as const;

function splitOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/**
 * Orígenes CORS explícitos desde variables reales del proyecto.
 * No inventa dominios Vercel. No usa wildcard en producción.
 *
 * - FRONTEND_URL (preferido para CORS)
 * - FRONTEND_BASE_URL (ya usado por correo)
 * - CORS_ALLOWED_ORIGINS (lista CSV adicional)
 * - En no-producción: localhost Vite por defecto
 */
export function resolveCorsAllowedOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const fromEnv = [
    ...splitOrigins(env.FRONTEND_URL),
    ...splitOrigins(env.FRONTEND_BASE_URL),
    ...splitOrigins(env.CORS_ALLOWED_ORIGINS),
  ];

  const unique = Array.from(new Set(fromEnv));

  if (!isProductionNodeEnv(env.NODE_ENV)) {
    for (const origin of DEV_DEFAULT_ORIGINS) {
      if (!unique.includes(origin)) {
        unique.push(origin);
      }
    }
  }

  return unique;
}

export type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;

/**
 * Callback Nest/Express: solo orígenes en la allowlist.
 * Requests sin Origin (servidor-servidor / curl) no activan CORS del navegador;
 * la API sigue protegida por JWT/Guards.
 */
export function createCorsOriginDelegate(
  env: NodeJS.ProcessEnv = process.env,
): (origin: string | undefined, callback: CorsOriginCallback) => void {
  const allowed = new Set(resolveCorsAllowedOrigins(env));

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowed.has(origin.replace(/\/$/, ''))) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}

export const CORS_METHODS = [
  'GET',
  'HEAD',
  'PUT',
  'PATCH',
  'POST',
  'DELETE',
  'OPTIONS',
] as const;

export const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept',
] as const;
