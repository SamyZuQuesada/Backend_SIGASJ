import { registerAs } from '@nestjs/config';
import { resolveJwtSecret } from './production-secrets';

export default registerAs('jwt', () => ({
  secret: resolveJwtSecret(),
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
}));
