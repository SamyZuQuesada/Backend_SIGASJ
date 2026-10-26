import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createTestAccount,
  createTransport,
  getTestMessageUrl,
  type SentMessageInfo,
  type Transporter,
} from 'nodemailer';
import { Repository } from 'typeorm';
import { TipoSolicitudAusencia } from '../../common/enums/tipo-solicitud-ausencia.enum';
import { Colaborador } from '../recursos-humanos/entities/colaborador.entity';
import {
  construirHtmlAprobacionAusencia,
  construirTextoAprobacionAusencia,
} from './correo-aprobacion-ausencia.template';
import { parseCorreosAviso } from './correos-aviso.util';
import { SolicitudAusencia } from './entities/solicitud-ausencia.entity';

/**
 * Notifica cuando se aprueba una solicitud de ausencia.
 * Prioriza el correo que el Fontanero indicó en la solicitud.
 * No bloquea ni revierte la aprobación si el correo falla o no está configurado.
 */
@Injectable()
export class NotificacionSolicitudAusenciaService {
  private readonly logger = new Logger(
    NotificacionSolicitudAusenciaService.name,
  );
  private transporter: Transporter | null = null;
  private transporterReady: Promise<Transporter | null> | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Colaborador)
    private readonly colaboradorRepository: Repository<Colaborador>,
  ) {}

  async notificarAprobacion(solicitud: SolicitudAusencia): Promise<void> {
    await this.notificarDecision(solicitud, 'aprobada');
  }

  async notificarRechazo(solicitud: SolicitudAusencia): Promise<void> {
    await this.notificarDecision(solicitud, 'rechazada');
  }

  private async notificarDecision(
    solicitud: SolicitudAusencia,
    decision: 'aprobada' | 'rechazada',
  ): Promise<void> {
    const colaborador =
      solicitud.colaborador ??
      (await this.colaboradorRepository.findOne({
        where: { id: solicitud.colaboradorId },
      }));

    const destinos = parseCorreosAviso(
      solicitud.correoNotificacion?.trim() ||
        colaborador?.correoElectronico?.trim() ||
        '',
    );
    const destino = destinos.join(', ');

    if (!destino) {
      this.logger.warn(
        `${decision} id=${solicitud.id}: sin correo de notificación; no se envía aviso.`,
      );
      return;
    }

    const tipoLabel =
      solicitud.tipo === TipoSolicitudAusencia.VACACIONES
        ? 'vacaciones'
        : 'permiso';
    const nombre = colaborador
      ? `${colaborador.nombre} ${colaborador.apellidos}`.trim()
      : '';
    const frontendBase =
      this.configService.get<string>('mail.frontendBaseUrl')?.trim() || '';
    const urlMisSolicitudes = frontendBase
      ? `${frontendBase}/fontanero/mis-solicitudes/${solicitud.id}`
      : null;

    const datosCorreo = {
      nombre,
      tipoLabel,
      solicitudId: solicitud.id,
      fechaInicio: solicitud.fechaInicio,
      fechaFin: solicitud.fechaFin,
      motivo: solicitud.motivo,
      urlMisSolicitudes,
      decision,
      comentarioRechazo: solicitud.motivoRechazo,
    };
    const asunto = `Su solicitud de ${tipoLabel} fue ${decision} — SIGASJ`;
    const text = construirTextoAprobacionAusencia(datosCorreo);
    const html = construirHtmlAprobacionAusencia(datosCorreo);

    const enabled = this.configService.get<boolean>('mail.enabled') === true;
    if (!enabled) {
      this.logger.log(
        `MAIL_ENABLED=false — notificación omitida (${decision} id=${solicitud.id} → ${destino}).`,
      );
      return;
    }

    try {
      const transporter = await this.obtenerTransporter();
      if (!transporter) {
        this.logger.warn(
          `Correo no configurado (MAIL_HOST / MAIL_USER). Notificación omitida → ${destino}.`,
        );
        return;
      }
      const from = this.resolverRemitente();
      const info: SentMessageInfo = await transporter.sendMail({
        from,
        to: destinos,
        subject: asunto,
        text,
        html,
      });
      const preview = getTestMessageUrl(info);
      if (preview) {
        this.logger.log(
          `Correo de prueba (Ethereal) solicitud=${solicitud.id} → ${destino}. Vista previa: ${preview}`,
        );
      } else {
        this.logger.log(
          `Correo de ${decision} enviado: solicitud=${solicitud.id} → ${destino}`,
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `No se pudo enviar correo de ${decision} id=${solicitud.id}: ${message}`,
      );
    }
  }

  private obtenerTransporter(): Promise<Transporter | null> {
    if (this.transporter) {
      return Promise.resolve(this.transporter);
    }
    if (!this.transporterReady) {
      this.transporterReady = this.crearTransporter();
    }
    return this.transporterReady;
  }

  private async crearTransporter(): Promise<Transporter | null> {
    const host = this.configService.get<string>('mail.host')?.trim() ?? '';
    const user = this.configService.get<string>('mail.user')?.trim() ?? '';
    const password = this.configService.get<string>('mail.password') ?? '';
    const port = this.configService.get<number>('mail.port') ?? 587;
    const secure = this.configService.get<boolean>('mail.secure') === true;

    if (host && user && password) {
      const esGmail =
        host.toLowerCase().includes('gmail') ||
        user.toLowerCase().endsWith('@gmail.com');
      this.transporter = esGmail
        ? createTransport({
            service: 'gmail',
            auth: { user, pass: password },
            connectionTimeout: 12_000,
          })
        : createTransport({
            host,
            port,
            secure,
            requireTLS: !secure && port === 587,
            auth: { user, pass: password },
            connectionTimeout: 12_000,
          });
      return this.transporter;
    }

    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';
    if (nodeEnv !== 'production') {
      try {
        const test = await createTestAccount();
        this.transporter = createTransport({
          host: test.smtp.host,
          port: test.smtp.port,
          secure: test.smtp.secure,
          auth: { user: test.user, pass: test.pass },
        });
        this.logger.warn(
          'MAIL_USER/MAIL_PASSWORD vacíos: usando Ethereal (solo vista previa en logs, no llega a bandejas reales).',
        );
        return this.transporter;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`No se pudo crear cuenta Ethereal: ${message}`);
        return null;
      }
    }

    return null;
  }

  /**
   * Gmail rechaza un From de otro dominio (p. ej. noreply@asadasanjuan.cr).
   */
  private resolverRemitente(): string {
    const from =
      this.configService.get<string>('mail.from')?.trim() ||
      'SIGASJ ASADA <noreply@asadasanjuan.cr>';
    const user = this.configService.get<string>('mail.user')?.trim() ?? '';
    if (!user) {
      return from;
    }
    const fromLower = from.toLowerCase();
    if (fromLower.includes(user.toLowerCase())) {
      return from;
    }
    if (user.toLowerCase().endsWith('@gmail.com')) {
      return `SIGASJ ASADA <${user}>`;
    }
    return from;
  }
}
