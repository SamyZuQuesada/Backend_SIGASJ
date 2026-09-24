import { ConfigService } from '@nestjs/config';
import {
  EstadoEnvioSmsAveria,
  MotivoBloqueoSmsAveria,
} from '../../common/enums/estado-envio-sms-averia.enum';
import { TipoEventoSmsAveria } from '../../common/enums/tipo-evento-sms-averia.enum';
import {
  InfobipSmsAveriaProvider,
  textoSmsAveria,
} from './sms-averia-infobip.sender';

function cuerpoSmsEnviado(mock: jest.Mock): string {
  // Jest tipa mock.calls como any.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const init: unknown = mock.mock.calls[0]?.[1];
  if (
    init &&
    typeof init === 'object' &&
    'body' in init &&
    typeof init.body === 'string'
  ) {
    return init.body;
  }
  return '';
}

function urlSmsEnviado(mock: jest.Mock): string {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const url: unknown = mock.mock.calls[0]?.[0];
  return typeof url === 'string' ? url : '';
}

describe('InfobipSmsAveriaProvider', () => {
  const payload = {
    idAveria: 7,
    codigoSeguimiento: 'AV-2026-0007',
    tipoEvento: TipoEventoSmsAveria.CONFIRMACION_REGISTRO,
    telefonoDestino: '8888-1111',
  };

  let fetchMock: jest.Mock;
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const configDe = (values: Record<string, string | boolean>) =>
    ({
      get: (key: string) => values[key],
    }) as unknown as ConfigService;

  const infobipListo = (
    extra: Record<string, string | boolean> = {},
  ): ConfigService =>
    configDe({
      'sms.infobip.baseUrl': 'https://example.api.infobip.com',
      'sms.infobip.apiKey': 'test-key',
      'sms.infobip.sender': '447491163443',
      'sms.testMode': true,
      'sms.testTo': '50670009999',
      ...extra,
    });

  const respuestaOk = (messageId = 'msg-1') => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ messages: [{ messageId }] }),
  });

  it('no llama Infobip si faltan credenciales', async () => {
    const sender = new InfobipSmsAveriaProvider(
      configDe({
        'sms.infobip.baseUrl': '',
        'sms.infobip.apiKey': '',
        'sms.infobip.sender': '',
      }),
    );
    const resultado = await sender.enviar(payload);
    expect(resultado.estado).toBe(EstadoEnvioSmsAveria.NO_ENVIADO);
    expect(resultado.motivo).toBe(
      MotivoBloqueoSmsAveria.PROVEEDOR_NO_CONFIGURADO,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('2xx usa /sms/3/messages y ENVIADO (no SIMULADO)', async () => {
    fetchMock.mockResolvedValue(respuestaOk('abc-123'));
    const sender = new InfobipSmsAveriaProvider(infobipListo());
    const resultado = await sender.enviar(payload);
    expect(resultado.estado).toBe(EstadoEnvioSmsAveria.ENVIADO);
    expect(resultado.estado).not.toBe(EstadoEnvioSmsAveria.SIMULADO);
    expect(resultado.httpStatus).toBe(200);
    expect(resultado.messageId).toBe('abc-123');
    expect(urlSmsEnviado(fetchMock)).toContain('/sms/3/messages');
    const cuerpo = cuerpoSmsEnviado(fetchMock);
    expect(cuerpo).toContain('"sender":"447491163443"');
    expect(cuerpo).toContain('"content"');
    expect(cuerpo).toContain('50670009999');
    expect(cuerpo).not.toContain('88881111');
    expect(cuerpo).not.toContain('8888-1111');
  });

  it('HTTP 400', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({}),
    });
    const resultado = await new InfobipSmsAveriaProvider(infobipListo()).enviar(
      payload,
    );
    expect(resultado.estado).toBe(EstadoEnvioSmsAveria.ERROR);
    expect(resultado.httpStatus).toBe(400);
  });

  it.each([401, 403])('HTTP %s', async (status) => {
    fetchMock.mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.resolve({}),
    });
    const resultado = await new InfobipSmsAveriaProvider(infobipListo()).enviar(
      payload,
    );
    expect(resultado.estado).toBe(EstadoEnvioSmsAveria.ERROR);
    expect(resultado.httpStatus).toBe(status);
  });

  it('HTTP 500', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });
    const resultado = await new InfobipSmsAveriaProvider(infobipListo()).enviar(
      payload,
    );
    expect(resultado.estado).toBe(EstadoEnvioSmsAveria.ERROR);
    expect(resultado.httpStatus).toBe(500);
  });

  it('timeout', async () => {
    const timeout = new Error('aborted');
    timeout.name = 'TimeoutError';
    fetchMock.mockRejectedValue(timeout);
    const resultado = await new InfobipSmsAveriaProvider(infobipListo()).enviar(
      payload,
    );
    expect(resultado.estado).toBe(EstadoEnvioSmsAveria.ERROR);
    expect(resultado.motivo).toBe(MotivoBloqueoSmsAveria.FALLO_PROVEEDOR);
  });

  it('error de red', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const resultado = await new InfobipSmsAveriaProvider(infobipListo()).enviar(
      payload,
    );
    expect(resultado.estado).toBe(EstadoEnvioSmsAveria.ERROR);
  });

  it('SMS_TEST_MODE usa SMS_TEST_TO y no el reportante', async () => {
    fetchMock.mockResolvedValue(respuestaOk());
    await new InfobipSmsAveriaProvider(infobipListo()).enviar(payload);
    expect(cuerpoSmsEnviado(fetchMock)).toContain('50670009999');
    expect(cuerpoSmsEnviado(fetchMock)).not.toContain('50688881111');
  });

  it('SMS_TEST_TO ausente no envía', async () => {
    const resultado = await new InfobipSmsAveriaProvider(
      infobipListo({ 'sms.testTo': '' }),
    ).enviar(payload);
    expect(resultado.estado).toBe(EstadoEnvioSmsAveria.NO_ENVIADO);
    expect(resultado.motivo).toBe(MotivoBloqueoSmsAveria.SMS_TEST_TO_AUSENTE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('teléfono de 8 dígitos se envía con 506', async () => {
    fetchMock.mockResolvedValue(respuestaOk());
    await new InfobipSmsAveriaProvider(
      infobipListo({ 'sms.testMode': false }),
    ).enviar({ ...payload, telefonoDestino: '88881234' });
    expect(cuerpoSmsEnviado(fetchMock)).toContain('50688881234');
  });

  it('teléfono +506 se normaliza', async () => {
    fetchMock.mockResolvedValue(respuestaOk());
    await new InfobipSmsAveriaProvider(
      infobipListo({ 'sms.testMode': false }),
    ).enviar({ ...payload, telefonoDestino: '+50688881234' });
    expect(cuerpoSmsEnviado(fetchMock)).toContain('50688881234');
  });

  it('teléfono 506 se conserva', async () => {
    fetchMock.mockResolvedValue(respuestaOk());
    await new InfobipSmsAveriaProvider(
      infobipListo({ 'sms.testMode': false }),
    ).enviar({ ...payload, telefonoDestino: '50688881234' });
    expect(cuerpoSmsEnviado(fetchMock)).toContain('50688881234');
  });

  it('teléfono inválido no llama Infobip', async () => {
    const resultado = await new InfobipSmsAveriaProvider(
      infobipListo({ 'sms.testMode': false }),
    ).enviar({ ...payload, telefonoDestino: '123' });
    expect(resultado.estado).toBe(EstadoEnvioSmsAveria.NO_ENVIADO);
    expect(resultado.motivo).toBe(MotivoBloqueoSmsAveria.TELEFONO_INVALIDO);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [TipoEventoSmsAveria.CONFIRMACION_REGISTRO, 'fue registrado correctamente'],
    [TipoEventoSmsAveria.AVERIA_PENDIENTE, 'pendiente de atención'],
    [TipoEventoSmsAveria.AVERIA_RESUELTA, 'completada exitosamente'],
  ] as const)('texto %s', async (tipoEvento, fragmento) => {
    fetchMock.mockResolvedValue(respuestaOk());
    await new InfobipSmsAveriaProvider(infobipListo()).enviar({
      ...payload,
      tipoEvento,
    });
    expect(cuerpoSmsEnviado(fetchMock)).toContain(fragmento);
    expect(textoSmsAveria(tipoEvento, 'AV-1')).toContain(fragmento);
  });
});
