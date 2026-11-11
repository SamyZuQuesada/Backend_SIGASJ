import { registerAs } from '@nestjs/config';

/**
 * En desarrollo el front inicia sesión por rol (sin gestionar contraseñas).
 * AUTH_REQUIRE_PASSWORD=true fuerza verificación bcrypt también en local.
 * En producción el selector de rol del frontend sigue enviando su clave fija,
 * así que esas tres cuentas se crean o alinean al arrancar.
 */
export default registerAs('auth', () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const requirePassword = process.env.AUTH_REQUIRE_PASSWORD === 'true';
  const parsedRounds = Number(process.env.BCRYPT_ROUNDS);
  const bcryptRounds =
    Number.isFinite(parsedRounds) && parsedRounds >= 10
      ? Math.floor(parsedRounds)
      : 10;

  return {
    devLoginWithoutPassword: nodeEnv === 'development' && !requirePassword,
    alignRolePickerPassword: nodeEnv === 'production',
    /** Cost factor bcrypt; override con BCRYPT_ROUNDS (>= 10). */
    bcryptRounds,
  };
});
