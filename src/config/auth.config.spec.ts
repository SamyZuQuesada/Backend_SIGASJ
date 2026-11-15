import {
  isProductionLikeEnv,
  normalizeNodeEnv,
  resolveAuthFlags,
} from './auth.config';

describe('auth.config — harden producción', () => {
  it('normaliza NODE_ENV a minúsculas con default development', () => {
    expect(normalizeNodeEnv(undefined)).toBe('development');
    expect(normalizeNodeEnv('Production')).toBe('production');
    expect(normalizeNodeEnv(' PROD ')).toBe('prod');
  });

  it('detecta entorno product-like por NODE_ENV o RENDER', () => {
    expect(isProductionLikeEnv({ nodeEnv: 'production' })).toBe(true);
    expect(isProductionLikeEnv({ nodeEnv: 'prod' })).toBe(true);
    expect(isProductionLikeEnv({ nodeEnv: 'development', render: 'true' })).toBe(
      true,
    );
    expect(isProductionLikeEnv({ nodeEnv: 'development' })).toBe(false);
    expect(isProductionLikeEnv({ nodeEnv: 'test' })).toBe(false);
  });

  it('permite bypass de password solo en development local', () => {
    expect(
      resolveAuthFlags({
        nodeEnv: 'development',
        authRequirePassword: 'false',
      }).devLoginWithoutPassword,
    ).toBe(true);

    expect(
      resolveAuthFlags({
        nodeEnv: 'development',
        authRequirePassword: 'true',
      }).devLoginWithoutPassword,
    ).toBe(false);

    expect(
      resolveAuthFlags({
        nodeEnv: 'production',
        authRequirePassword: 'false',
      }).devLoginWithoutPassword,
    ).toBe(false);

    expect(
      resolveAuthFlags({
        nodeEnv: 'development',
        render: 'true',
        authRequirePassword: 'false',
      }).devLoginWithoutPassword,
    ).toBe(false);
  });

  it('alineación de clave conocida es opt-in (no automática en production)', () => {
    expect(
      resolveAuthFlags({
        nodeEnv: 'production',
      }).alignRolePickerPassword,
    ).toBe(false);

    expect(
      resolveAuthFlags({
        nodeEnv: 'production',
        authAlignRolePickerPassword: 'true',
      }).alignRolePickerPassword,
    ).toBe(true);

    expect(
      resolveAuthFlags({
        nodeEnv: 'development',
        authAlignRolePickerPassword: 'true',
      }).alignRolePickerPassword,
    ).toBe(true);
  });
});
