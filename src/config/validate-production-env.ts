export const JWT_SECRET_INSEGURO_EJEMPLO = 'super_secret_jwt_key_sigasj_2026';

export function collectProductionEnvProblems(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const problems: string[] = [];
  const jwt = env.JWT_SECRET?.trim() ?? '';
  if (!jwt || jwt === JWT_SECRET_INSEGURO_EJEMPLO) {
    problems.push(
      'JWT_SECRET debe definirse con un valor distinto del ejemplo de desarrollo.',
    );
  }
  if (!env.DB_TYPE?.trim()) {
    problems.push('DB_TYPE es obligatorio.');
  }
  if (!env.DB_HOST?.trim()) {
    problems.push('DB_HOST es obligatorio.');
  }
  if (!env.DB_DATABASE?.trim()) {
    problems.push('DB_DATABASE es obligatorio.');
  }
  if (env.DB_TRUSTED_CONNECTION !== 'true') {
    if (!env.DB_USERNAME?.trim()) {
      problems.push(
        'DB_USERNAME es obligatorio si DB_TRUSTED_CONNECTION no es true.',
      );
    }
    if (!env.DB_PASSWORD?.trim()) {
      problems.push(
        'DB_PASSWORD es obligatorio si DB_TRUSTED_CONNECTION no es true.',
      );
    }
  }
  const cors =
    env.CORS_ORIGINS?.trim() || env.FRONTEND_BASE_URL?.trim() || '';
  if (!cors) {
    problems.push(
      'CORS_ORIGINS o FRONTEND_BASE_URL es obligatorio (origen del frontend).',
    );
  }
  return problems;
}

export function assertProductionEnv(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if ((env.NODE_ENV || '').toLowerCase() !== 'production') {
    return;
  }
  const problems = collectProductionEnvProblems(env);
  if (problems.length > 0) {
    throw new Error(
      `Configuración de producción incompleta:\n- ${problems.join('\n- ')}`,
    );
  }
}
