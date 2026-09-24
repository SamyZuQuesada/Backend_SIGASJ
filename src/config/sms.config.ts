import { registerAs } from '@nestjs/config';

/**
 * SMS de averías (PBI 2.8.2). Proveedor elegido: Infobip.
 * Variables: SMS_ENABLED, SMS_PROVIDER, INFOBIP_BASE_URL,
 * INFOBIP_API_KEY, INFOBIP_SENDER, SMS_TEST_MODE, SMS_TEST_TO.
 * No hardcodea la API key.
 */
export default registerAs('sms', () => ({
  enabled: process.env.SMS_ENABLED === 'true',
  provider: (process.env.SMS_PROVIDER || '').trim().toLowerCase() || 'none',
  testMode: process.env.SMS_TEST_MODE === 'true',
  testTo: (process.env.SMS_TEST_TO || '').trim(),
  infobip: {
    baseUrl: (process.env.INFOBIP_BASE_URL || '').trim().replace(/\/$/, ''),
    apiKey: (process.env.INFOBIP_API_KEY || '').trim(),
    sender: (process.env.INFOBIP_SENDER || '').trim(),
  },
}));
