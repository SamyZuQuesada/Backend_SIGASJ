import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createTestAccount,
  createTransport,
  getTestMessageUrl,
  type SentMessageInfo,
  type Transporter,
} from 'nodemailer';
import {
  construirHtmlReparacionExitosa,
  construirTextoReparacionExitosa,
} from './correo-reparacion-exitosa.template';
import { Averia } from './entities/averia.entity';

/**
 * Notifica al reportante por correo cuando la avería queda resuelta.
 * Usa `correoReportante` del reporte público. No bloquea ni revierte
 * la resolución si el correo falla o no está configurado.
 */
@Injectable()
export class NotificacionCorreoAveriaService {
  private readonly logger = new Logger(NotificacionCorreoAveriaService.name);
  private transporter: Transporter | null = null;
  private transporterReady: Promise<Transporter | null> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async notificarReparacionExitosa(averia: Averia): Promise<void> {
    const destino = averia.correoReportante?.trim().toLowerCase() || '';
    if (!destino) {
      this.logger.warn(
        `Avería ${averia.codigoSeguimiento}: sin correo del reportante; no se envía aviso de reparación.`,
      );
      return;
    }

    const datosCorreo = {
      nombreReportante: averia.nombreReportante ?? '',
      codigoSeguimiento: averia.codigoSeguimiento,
      ubicacion: averia.ubicacion,
      sectorComunidad: averia.sectorComunidad,
    };
    const asunto = `Su avería ${averia.codigoSeguimiento} fue solucionada — SIGASJ`;
    const text = construirTextoReparacionExitosa(datosCorreo);
    const html = construirHtmlReparacionExitosa(datosCorreo);

    const enabled = this.configService.get<boolean>('mail.enabled') === true;
    if (!enabled) {
      this.logger.log(
        `MAIL_ENABLED=false — notificación omitida (avería ${averia.codigoSeguimiento} → ${destino}).`,
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
      const from =
        this.configService.get<string>('mail.from') ??
        'SIGASJ ASADA <noreply@asadasanjuan.cr>';
      const info: SentMessageInfo = await transporter.sendMail({
        from,
        to: destino,
        subject: asunto,
        text,
        html,
      });
      const preview = getTestMessageUrl(info);
      if (preview) {
        this.logger.log(
          `Correo de prueba (Ethereal) avería=${averia.codigoSeguimiento} → ${destino}. Vista previa: ${preview}`,
        );
      } else {
        this.logger.log(
          `Correo de reparación exitosa enviado: avería=${averia.codigoSeguimiento} → ${destino}`,
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `No se pudo enviar correo de reparación avería=${averia.codigoSeguimiento}: ${message}`,
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
      this.transporter = createTransport({
        host,
        port,
        secure,
        auth: { user, pass: password },
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
}
