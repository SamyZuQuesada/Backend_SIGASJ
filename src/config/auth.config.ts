import { registerAs } from '@nestjs/config';

/**
 * En desarrollo el front inicia sesión por rol (sin gestionar contraseñas).
 * AUTH_REQUIRE_PASSWORD=true fuerza verificación bcrypt también en local.
 */
export default registerAs('auth', () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const requirePassword = process.env.AUTH_REQUIRE_PASSWORD === 'true';

  return {
    devLoginWithoutPassword: nodeEnv === 'development' && !requirePassword,
  };
});
