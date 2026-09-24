import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  EstadoEnvioSmsAveria,
  MotivoBloqueoSmsAveria,
} from '../../common/enums/estado-envio-sms-averia.enum';
import { TipoEventoSmsAveria } from '../../common/enums/tipo-evento-sms-averia.enum';
import { Averia } from '../averias/entities/averia.entity';
import { IntentoSmsAveria } from './entities/intento-sms-averia.entity';
import { SmsAveriasService } from './sms-averias.service';
import { SMS_AVERIA_SENDER, type SmsAveriaSender } from './sms-averia.sender';

describe('SmsAveriasService — preparación sin envío real', () => {
  let service: SmsAveriasService;
  let intentos: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let sender: { enviar: jest.Mock };

  const averia = { id: 7, codigoSeguimiento: 'AV-2026-0007' } as Averia;

  beforeEach(async () => {
    intentos = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((row: IntentoSmsAveria) =>
        Promise.resolve({ ...row, id: 1 }),
      ),
      create: jest.fn((row: Partial<IntentoSmsAveria>) => row),
    };
    sender = {
      enviar: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SmsAveriasService,
        { provide: getRepositoryToken(IntentoSmsAveria), useValue: intentos },
        { provide: SMS_AVERIA_SENDER, useValue: sender },
      ],
    }).compile();

    service = moduleRef.get(SmsAveriasService);
  });

  it('confirma registro: NO_ENVIADO por proveedor no configurado; destinatario reportante', async () => {
    const prep = await service.prepararConfirmacionRegistro(averia);
    expect(prep.estadoEnvio).toBe(EstadoEnvioSmsAveria.NO_ENVIADO);
    expect(prep.motivoBloqueo).toBe(
      MotivoBloqueoSmsAveria.PROVEEDOR_NO_CONFIGURADO,
    );
    expect(prep.destinatarioClase).toBe('reportante');
    expect(sender.enviar).not.toHaveBeenCalled();
  });

  it('pendiente: NO_ENVIADO por proveedor no configurado; destinatario reportante', async () => {
    const prep = await service.prepararPendiente(averia);
    expect(prep.estadoEnvio).toBe(EstadoEnvioSmsAveria.NO_ENVIADO);
    expect(prep.motivoBloqueo).toBe(
      MotivoBloqueoSmsAveria.PROVEEDOR_NO_CONFIGURADO,
    );
    expect(prep.destinatarioClase).toBe('reportante');
    expect(sender.enviar).not.toHaveBeenCalled();
  });

  it('resuelta: destinatario reportante, no DESTINATARIO_NO_CONFIRMADO', async () => {
    const prep = await service.prepararResuelta(averia);
    expect(prep.estadoEnvio).toBe(EstadoEnvioSmsAveria.NO_ENVIADO);
    expect(prep.motivoBloqueo).toBe(
      MotivoBloqueoSmsAveria.PROVEEDOR_NO_CONFIGURADO,
    );
    expect(prep.destinatarioClase).toBe('reportante');
    expect(prep.motivoBloqueo).not.toBe(
      MotivoBloqueoSmsAveria.DESTINATARIO_NO_CONFIRMADO,
    );
    expect(sender.enviar).not.toHaveBeenCalled();
  });

  it('no registra un segundo intento del mismo evento', async () => {
    intentos.findOne.mockResolvedValue({
      idAveria: 7,
      tipoEvento: TipoEventoSmsAveria.CONFIRMACION_REGISTRO,
      destinatarioClase: 'reportante',
      estadoEnvio: EstadoEnvioSmsAveria.NO_ENVIADO,
      motivoBloqueo: MotivoBloqueoSmsAveria.PROVEEDOR_NO_CONFIGURADO,
    });
    await service.prepararConfirmacionRegistro(averia);
    expect(intentos.save).not.toHaveBeenCalled();
  });

  it('un sender que reporta ENTREGADA no se persiste como entrega', async () => {
    sender.enviar.mockResolvedValue({
      estado: 'ENTREGADA',
      motivo: MotivoBloqueoSmsAveria.PROVEEDOR_NO_CONFIGURADO,
    });
    const crudo = await service.ejecutarSenderDePrueba({
      idAveria: 7,
      codigoSeguimiento: 'AV-2026-0007',
      tipoEvento: TipoEventoSmsAveria.CONFIRMACION_REGISTRO,
    });
    expect(crudo.estado).toBe(EstadoEnvioSmsAveria.NO_ENVIADO);
    expect(JSON.stringify(crudo)).not.toMatch(/ENTREGADA/);
  });

  it('con Infobip habilitado persiste ENVIADO y destinatario reportante', async () => {
    const moduleConConfig = await Test.createTestingModule({
      providers: [
        SmsAveriasService,
        { provide: getRepositoryToken(IntentoSmsAveria), useValue: intentos },
        { provide: SMS_AVERIA_SENDER, useValue: sender },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'sms.enabled') {
                return true;
              }
              if (key === 'sms.provider') {
                return 'infobip';
              }
              return undefined;
            },
          },
        },
      ],
    }).compile();
    const conConfig = moduleConConfig.get(SmsAveriasService);
    sender.enviar.mockResolvedValue({
      estado: EstadoEnvioSmsAveria.ENVIADO,
      motivo: MotivoBloqueoSmsAveria.NINGUNO,
      httpStatus: 200,
      messageId: 'msg-test',
    });
    const prep = await conConfig.prepararConfirmacionRegistro({
      ...averia,
      telefonoReportante: '8888-1111',
    } as Averia);
    expect(sender.enviar).toHaveBeenCalledWith(
      expect.objectContaining({
        telefonoDestino: '8888-1111',
        tipoEvento: TipoEventoSmsAveria.CONFIRMACION_REGISTRO,
      }),
    );
    expect(prep.estadoEnvio).toBe(EstadoEnvioSmsAveria.ENVIADO);
    expect(prep.destinatarioClase).toBe('reportante');
    expect(intentos.save).toHaveBeenCalled();
  });

  it('AVERIA_RESUELTA con Infobip conserva destinatario reportante', async () => {
    const moduleConConfig = await Test.createTestingModule({
      providers: [
        SmsAveriasService,
        { provide: getRepositoryToken(IntentoSmsAveria), useValue: intentos },
        { provide: SMS_AVERIA_SENDER, useValue: sender },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'sms.enabled'
                ? true
                : key === 'sms.provider'
                  ? 'infobip'
                  : undefined,
          },
        },
      ],
    }).compile();
    const conConfig = moduleConConfig.get(SmsAveriasService);
    sender.enviar.mockResolvedValue({
      estado: EstadoEnvioSmsAveria.ENVIADO,
      motivo: MotivoBloqueoSmsAveria.NINGUNO,
      httpStatus: 200,
    });
    const prep = await conConfig.prepararResuelta(averia);
    expect(prep.tipoEvento).toBe(TipoEventoSmsAveria.AVERIA_RESUELTA);
    expect(prep.destinatarioClase).toBe('reportante');
    expect(prep.motivoBloqueo).not.toBe(
      MotivoBloqueoSmsAveria.DESTINATARIO_NO_CONFIRMADO,
    );
  });

  it('propaga fallo simulado del proveedor sin marcarlo ENTREGADA', async () => {
    sender.enviar.mockResolvedValue({
      estado: EstadoEnvioSmsAveria.ERROR,
      motivo: MotivoBloqueoSmsAveria.FALLO_PROVEEDOR,
    });
    const crudo = await service.ejecutarSenderDePrueba({
      idAveria: 7,
      codigoSeguimiento: 'AV-2026-0007',
      tipoEvento: TipoEventoSmsAveria.AVERIA_PENDIENTE,
    });
    expect(crudo.estado).toBe(EstadoEnvioSmsAveria.ERROR);
    expect(crudo.motivo).toBe(MotivoBloqueoSmsAveria.FALLO_PROVEEDOR);
  });
});

describe('SmsAveriasService tipos', () => {
  it('el token del sender se inyecta desacoplado del proveedor', () => {
    expect(SMS_AVERIA_SENDER).toBe('SMS_AVERIA_SENDER');
    const sender: SmsAveriaSender = {
      enviar: () =>
        Promise.resolve({
          estado: EstadoEnvioSmsAveria.NO_ENVIADO,
          motivo: MotivoBloqueoSmsAveria.PROVEEDOR_NO_CONFIGURADO,
        }),
    };
    expect(typeof sender.enviar).toBe('function');
  });
});
