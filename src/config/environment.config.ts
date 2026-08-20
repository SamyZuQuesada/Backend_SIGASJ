import { registerAs } from '@nestjs/config';

export default registerAs('environment', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  uploadsRoot: process.env.UPLOAD_DIR || 'uploads',
}));
