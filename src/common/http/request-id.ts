import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

const MAX_LEN = 128;
const SAFE_ID = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * Acepta X-Request-Id del cliente solo si es corto y seguro;
 * si no, genera UUID del servidor.
 */
export function resolveRequestId(incoming: unknown): string {
  if (typeof incoming === 'string') {
    const trimmed = incoming.trim();
    if (SAFE_ID.test(trimmed) && trimmed.length <= MAX_LEN) {
      return trimmed;
    }
  }
  if (Array.isArray(incoming) && typeof incoming[0] === 'string') {
    return resolveRequestId(incoming[0]);
  }
  return randomUUID();
}

/** Path sin query (evita tokens/PII en logs). */
export function safeRequestPath(urlOrPath: string | undefined): string {
  if (!urlOrPath) {
    return '/';
  }
  const withoutQuery = urlOrPath.split('?', 1)[0] || '/';
  return withoutQuery.length > 256
    ? `${withoutQuery.slice(0, 256)}…`
    : withoutQuery;
}

export function isLivenessPath(path: string): boolean {
  const normalized = path.replace(/\/+$/, '') || '/';
  return (
    normalized === '/api/v1' ||
    normalized === '/api/v1/health' ||
    normalized === '/health' ||
    normalized.endsWith('/health')
  );
}
