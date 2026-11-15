import { registerAs } from '@nestjs/config';

/**
 * Auth local vs producción.
 *
 * - Bypass de contraseña: SOLO con NODE_ENV=development y AUTH_REQUIRE_PASSWORD≠true.
 *   Nunca en production/prod ni cuando hay indicios de hosting (p. ej. Render).
 * - Alineación de cuentas del selector (`dev-login`): SOLO con
 *   AUTH_ALIGN_ROLE_PICKER_PASSWORD=true (opt-in). Ya no se activa solo por
 *   NODE_ENV=production (evita claves conocidas en despliegues reales).
 */
export function normalizeNodeEnv(raw: string | undefined): string {
  return (raw || 'development').trim().toLowerCase();
}

export function isProductionLikeEnv(env: {
  nodeEnv?: string;
  render?: string;
}): boolean {
  const nodeEnv = normalizeNodeEnv(env.nodeEnv);
  if (nodeEnv === 'production' || nodeEnv === 'prod') {
    return true;
  }
  // Render inyecta RENDER=true en servicios desplegados.
  return String(env.render || '').toLowerCase() === 'true';
}

export function resolveAuthFlags(env: {
  nodeEnv?: string;
  render?: string;
  authRequirePassword?: string;
  authAlignRolePickerPassword?: string;
}): {
  nodeEnv: string;
  isProductionLike: boolean;
  devLoginWithoutPassword: boolean;
  alignRolePickerPassword: boolean;
} {
  const nodeEnv = normalizeNodeEnv(env.nodeEnv);
  const isProductionLike = isProductionLikeEnv(env);
  const requirePassword = String(env.authRequirePassword || '') === 'true';
  const alignExplicit =
    String(env.authAlignRolePickerPassword || '') === 'true';

  const isDevelopment = nodeEnv === 'development' && !isProductionLike;

  return {
    nodeEnv,
    isProductionLike,
    // Fail closed: bypass solo en development local explícito.
    devLoginWithoutPassword: isDevelopment && !requirePassword,
    // Fail closed: alineación de clave conocida solo opt-in.
    alignRolePickerPassword: alignExplicit,
  };
}

export default registerAs('auth', () => {
  const flags = resolveAuthFlags({
    nodeEnv: process.env.NODE_ENV,
    render: process.env.RENDER,
    authRequirePassword: process.env.AUTH_REQUIRE_PASSWORD,
    authAlignRolePickerPassword: process.env.AUTH_ALIGN_ROLE_PICKER_PASSWORD,
  });

  const parsedRounds = Number(process.env.BCRYPT_ROUNDS);
  const bcryptRounds =
    Number.isFinite(parsedRounds) && parsedRounds >= 10
      ? Math.floor(parsedRounds)
      : 10;

  return {
    ...flags,
    /** Cost factor bcrypt; override con BCRYPT_ROUNDS (>= 10). */
    bcryptRounds,
  };
});
