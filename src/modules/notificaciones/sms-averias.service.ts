import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  EstadoEnvioSmsAveria,
  MotivoBloqueoSmsAveria,
} from '../../common/enums/estado-envio-sms-averia.enum';
import { TipoEventoAveria } from '../../common/enums/tipo-evento-averia.enum';
import { TipoEventoSmsAveria } from '../../common/enums/tipo-evento-sms-averia.enum';
import { Averia } from '../averias/entities/averia.entity';
import { registrarEventoHistorialEnManager } from '../averias/historial-averias.registro';
import { IntentoSmsAveria } from './entities/intento-sms-averia.entity';
import { isUniqueViolation } from './notificaciones-averias.service';
import {
  SMS_AVERIA_SENDER,
  type SmsAveriaResultado,
  type SmsAveriaSender,
} from './sms-averia.sender';

export type PreparacionSmsAveria = {
  tipoEvento: TipoEventoSmsAveria;
  destinatarioClase: 'reportante';
  estadoEnvio: EstadoEnvioSmsAveria;
  motivoBloqueo: MotivoBloqueoSmsAveria;
  idAveria: number;
};

/**
 * Prepara y registra intentos SMS del Reportante (diagramas de proceso).
 * El envío real queda en el puerto SMS (Infobip). Sin proveedor
 * persiste NO_ENVIADO / PROVEEDOR_NO_CONFIGURADO.
 */
@Injectable()
export class SmsAveriasService {
  private readonly logger = new Logger(SmsAveriasService.name);

  constructor(
    @InjectRepository(IntentoSmsAveria)
    private readonly intentoRepository: Repository<IntentoSmsAveria>,
    @Inject(SMS_AVERIA_SENDER)
    private readonly sender: SmsAveriaSender,
    @Optional()
    private readonly configService?: ConfigService,
  ) {}

  async prepararConfirmacionRegistro(
    averia: Averia,
  ): Promise<PreparacionSmsAveria> {
    return this.preparar(averia, TipoEventoSmsAveria.CONFIRMACION_REGISTRO);
  }

  async prepararPendiente(averia: Averia): Promise<PreparacionSmsAveria> {
    return this.preparar(averia, TipoEventoSmsAveria.AVERIA_PENDIENTE);
  }

  async prepararResuelta(averia: Averia): Promise<PreparacionSmsAveria> {
    return this.preparar(averia, TipoEventoSmsAveria.AVERIA_RESUELTA);
  }

  private async preparar(
    averia: Averia,
    tipoEvento: TipoEventoSmsAveria,
  ): Promise<PreparacionSmsAveria> {
    const existente = await this.intentoRepository.findOne({
      where: { idAveria: averia.id, tipoEvento },
    });
    if (existente) {
      return toPreparacion(existente);
    }

    const resultado = await this.resolverEnvio(averia, tipoEvento);
    if (resultado.estado === EstadoEnvioSmsAveria.NO_ENVIADO) {
      this.logger.log(
        `SMS ${tipoEvento} no enviado (avería ${averia.id}): ${resultado.motivo}`,
      );
    } else if (resultado.estado === EstadoEnvioSmsAveria.ENVIADO) {
      this.logger.log(
        `SMS ${tipoEvento} avería ${averia.id} aceptado por proveedor ` +
          `HTTP ${resultado.httpStatus ?? 'n/a'} ` +
          `messageId=${resultado.messageId ?? 'n/a'}`,
      );
    } else if (resultado.estado === EstadoEnvioSmsAveria.ERROR) {
      this.logger.warn(
        `SMS ${tipoEvento} avería ${averia.id} error HTTP ${resultado.httpStatus ?? 'n/a'}`,
      );
    }

    try {
      const saved = await this.persistirIntento(averia, tipoEvento, resultado);
      return toPreparacion(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const duplicado = await this.intentoRepository.findOne({
          where: { idAveria: averia.id, tipoEvento },
        });
        if (duplicado) {
          return toPreparacion(duplicado);
        }
      }
      throw error;
    }
  }

  private managerTransaccional(): EntityManager | null {
    const manager = this.intentoRepository.manager;
    if (
      !manager ||
      typeof manager.transaction !== 'function' ||
      !manager.connection ||
      typeof manager.connection.hasMetadata !== 'function'
    ) {
      return null;
    }
    return manager;
  }

  private async persistirIntento(
    averia: Averia,
    tipoEvento: TipoEventoSmsAveria,
    resultado: SmsAveriaResultado,
  ): Promise<IntentoSmsAveria> {
    const data = {
      idAveria: averia.id,
      tipoEvento,
      destinatarioClase: 'reportante' as const,
      estadoEnvio: resultado.estado,
      motivoBloqueo: resultado.motivo,
    };
    const manager = this.managerTransaccional();
    if (!manager) {
      return this.intentoRepository.save(this.intentoRepository.create(data));
    }
    return manager.transaction(async (tx) => {
      const saved = await tx.save(
        IntentoSmsAveria,
        tx.create(IntentoSmsAveria, data),
      );
      const motivo =
        resultado.motivo && resultado.motivo !== MotivoBloqueoSmsAveria.NINGUNO
          ? ` (${resultado.motivo})`
          : '';
      await registrarEventoHistorialEnManager(tx, {
        idAveria: averia.id,
        tipoEvento: TipoEventoAveria.NOTIFICACION,
        descripcion:
          `Notificación SMS ${tipoEvento}. Resultado: ${resultado.estado}${motivo}.`.slice(
            0,
            500,
          ),
        referenciaTipo: 'IntentoSmsAveria',
        referenciaId: saved.id,
      });
      return saved;
    });
  }

  /**
   * Sin proveedor no llama al sender.
   * El teléfono del reportante viaja solo al puerto, no a la tabla.
   */
  private async resolverEnvio(
    averia: Averia,
    tipoEvento: TipoEventoSmsAveria,
  ): Promise<SmsAveriaResultado> {
    const enabled = this.configService?.get<boolean>('sms.enabled') === true;
    const provider = this.configService?.get<string>('sms.provider') || 'none';

    if (!enabled || provider === 'none') {
      return {
        estado: EstadoEnvioSmsAveria.NO_ENVIADO,
        motivo: MotivoBloqueoSmsAveria.PROVEEDOR_NO_CONFIGURADO,
      };
    }

    return this.normalizarResultadoSender(
      await this.sender.enviar({
        idAveria: averia.id,
        codigoSeguimiento: averia.codigoSeguimiento,
        tipoEvento,
        telefonoDestino: averia.telefonoReportante,
      }),
    );
  }

  /** Solo para pruebas del puerto inyectado. */
  async ejecutarSenderDePrueba(
    payload: Parameters<SmsAveriaSender['enviar']>[0],
  ): Promise<SmsAveriaResultado> {
    return this.normalizarResultadoSender(await this.sender.enviar(payload));
  }

  /** Un mock que reporte ENTREGADA no se persiste como entrega. */
  private normalizarResultadoSender(
    crudo: SmsAveriaResultado,
  ): SmsAveriaResultado {
    if ((crudo.estado as string) === 'ENTREGADA') {
      return {
        estado: EstadoEnvioSmsAveria.NO_ENVIADO,
        motivo: MotivoBloqueoSmsAveria.PROVEEDOR_NO_CONFIGURADO,
      };
    }
    return crudo;
  }
}

const toPreparacion = (row: IntentoSmsAveria): PreparacionSmsAveria => ({
  tipoEvento: row.tipoEvento,
  destinatarioClase: 'reportante',
  estadoEnvio: row.estadoEnvio,
  motivoBloqueo: row.motivoBloqueo,
  idAveria: row.idAveria,
});
