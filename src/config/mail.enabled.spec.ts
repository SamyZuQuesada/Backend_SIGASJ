import { resolverMailEnabled } from './mail.enabled';

describe('resolverMailEnabled', () => {
  it('respeta MAIL_ENABLED=false aunque haya credenciales', () => {
    expect(
      resolverMailEnabled({
        MAIL_ENABLED: 'false',
        MAIL_USER: 'asada@gmail.com',
        MAIL_PASSWORD: 'x',
      }),
    ).toBe(false);
  });

  it('habilita con MAIL_ENABLED=true', () => {
    expect(resolverMailEnabled({ MAIL_ENABLED: 'true' })).toBe(true);
  });

  it('habilita si no hay bandera pero sí hay SMTP', () => {
    expect(
      resolverMailEnabled({
        MAIL_USER: 'asada@gmail.com',
        MAIL_PASSWORD: 'app-pass',
      }),
    ).toBe(true);
  });

  it('queda apagado sin bandera ni credenciales', () => {
    expect(resolverMailEnabled({})).toBe(false);
  });
});
