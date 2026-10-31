import {
  assertProductionSecrets,
  isInsecureJwtSecret,
  isProductionNodeEnv,
  resolveJwtSecret,
} from './production-secrets';

describe('production-secrets', () => {
  const strong = 'x'.repeat(48);

  it('detecta secretos inseguros conocidos', () => {
    expect(isInsecureJwtSecret(undefined)).toBe(true);
    expect(isInsecureJwtSecret('')).toBe(true);
    expect(isInsecureJwtSecret('secret')).toBe(true);
    expect(isInsecureJwtSecret('super_secret_jwt_key_sigasj_2026')).toBe(true);
    expect(isInsecureJwtSecret(strong)).toBe(false);
  });

  it('en producción exige JWT_SECRET fuerte', () => {
    expect(() =>
      resolveJwtSecret({
        NODE_ENV: 'production',
        JWT_SECRET: 'secret',
      }),
    ).toThrow(/JWT_SECRET/);

    expect(
      resolveJwtSecret({
        NODE_ENV: 'production',
        JWT_SECRET: strong,
      }),
    ).toBe(strong);
  });

  it('en desarrollo permite fallback local documentado', () => {
    const secret = resolveJwtSecret({
      NODE_ENV: 'development',
    });
    expect(secret.length).toBeGreaterThan(8);
    expect(isProductionNodeEnv('development')).toBe(false);
  });

  it('assertProductionSecrets exige origen frontend en producción', () => {
    expect(() =>
      assertProductionSecrets({
        NODE_ENV: 'production',
        JWT_SECRET: strong,
      }),
    ).toThrow(/FRONTEND_URL/);

    expect(() =>
      assertProductionSecrets({
        NODE_ENV: 'production',
        JWT_SECRET: strong,
        FRONTEND_URL: 'https://frontend-autorizado.example',
      }),
    ).not.toThrow();
  });

  it('assertProductionSecrets no falla fuera de producción', () => {
    expect(() =>
      assertProductionSecrets({ NODE_ENV: 'development' }),
    ).not.toThrow();
  });
});
