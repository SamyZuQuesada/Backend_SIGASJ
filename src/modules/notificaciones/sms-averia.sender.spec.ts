import { EstadoEnvioSmsAveria } from '../../common/enums/estado-envio-sms-averia.enum';
import { TipoEventoSmsAveria } from '../../common/enums/tipo-evento-sms-averia.enum';
import { SmsAveriaSinProveedor } from './sms-averia.sender';

describe('SmsAveriaSinProveedor', () => {
  it('no confirma entrega: siempre NO_ENVIADO por proveedor no configurado', async () => {
    const sender = new SmsAveriaSinProveedor();
    const resultado = await sender.enviar({
      idAveria: 12,
      codigoSeguimiento: 'AV-2026-0001',
      tipoEvento: TipoEventoSmsAveria.CONFIRMACION_REGISTRO,
    });

    expect(resultado.estado).toBe(EstadoEnvioSmsAveria.NO_ENVIADO);
    expect(resultado.estado).not.toBe(EstadoEnvioSmsAveria.SIMULADO);
    expect(JSON.stringify(resultado)).not.toMatch(/ENTREGADA/);
  });
});
