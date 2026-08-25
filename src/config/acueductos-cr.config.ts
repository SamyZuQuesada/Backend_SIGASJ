import { registerAs } from '@nestjs/config';

export default registerAs('acueductosCr', () => ({
  baseUrl: process.env.ACUEDUCTOS_CR_BASE_URL || 'https://acueductoscr.com',
  provincia: parseInt(process.env.ACUEDUCTOS_CR_PROVINCIA || '5', 10),
  acueducto: parseInt(process.env.ACUEDUCTOS_CR_ACUEDUCTO || '207', 10),
  timeout: parseInt(process.env.ACUEDUCTOS_CR_TIMEOUT || '15000', 10),
  rateLimitWindowMs: parseInt(process.env.ACUEDUCTOS_CR_RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMax: parseInt(process.env.ACUEDUCTOS_CR_RATE_LIMIT_MAX || '10', 10),
}));
