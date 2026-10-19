import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { CorrelacionSolicitudAusenciaService } from './correlacion-solicitud-ausencia.service';
import { SolicitudAusencia } from './entities/solicitud-ausencia.entity';
import {
  parseJotformWebhookPayload,
  type JotformFieldMap,
} from './jotform-payload.mapper';
import { SolicitudesAusenciaService } from './solicitudes-ausencia.service';

export type WebhookProcesado = {
  id: number;
  estado: string;
  creada: boolean;
  jotformSubmissionId: string;
};

@Injectable()
export class JotformWebhookService {
  private readonly logger = new Logger(JotformWebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly correlacionService: CorrelacionSolicitudAusenciaService,
    private readonly solicitudesService: SolicitudesAusenciaService,
    @InjectRepository(SolicitudAusencia)
    private readonly solicitudRepository: Repository<SolicitudAusencia>,
  ) {}

  /**
   * Valida JOTFORM_WEBHOOK_SECRET (query `key` de la URL configurada en Jotform).
   * Comparación en tiempo constante cuando las longitudes coinciden.
   */
  assertWebhookSecret(key: string | undefined): void {
    const expected = (
      this.configService.get<string>('jotform.webhookSecret') ?? ''
    ).trim();
    if (!expected) {
      throw new UnauthorizedException(
        'Webhook de Jotform no configurado (JOTFORM_WEBHOOK_SECRET)',
      );
    }
    if (!key || !this.secretosCoinciden(key, expected)) {
      throw new UnauthorizedException('Webhook no autorizado');
    }
  }

  async procesar(
    body: unknown,
    webhookKey: string | undefined,
  ): Promise<WebhookProcesado> {
    this.assertWebhookSecret(webhookKey);

    const fields = this.configService.get<JotformFieldMap>(
      'jotform.fields',
    ) ?? {
      correlacion: 'correlacion',
      tipo: 'tipo',
      fechaInicio: 'fechaInicio',
      fechaFin: 'fechaFin',
      motivo: 'motivo',
    };

    const parsed = parseJotformWebhookPayload(body, fields);

    const configuredFormId = (
      this.configService.get<string>('jotform.formId') ?? ''
    ).trim();
    if (configuredFormId) {
      if (!parsed.formId) {
        throw new BadRequestException(
          'Falta formId de Jotform; no se puede validar el formulario',
        );
      }
      if (parsed.formId !== configuredFormId) {
        throw new BadRequestException('formId de Jotform no coincide');
      }
    }

    await this.verificarSubmissionSiCorresponde(parsed.jotformSubmissionId);

    // Idempotencia antes de consumir el token (retry de Jotform).
    const yaExiste = await this.solicitudRepository.findOne({
      where: { jotformSubmissionId: parsed.jotformSubmissionId },
    });
    if (yaExiste) {
      this.logger.log(
        `Webhook Jotform idempotente submission=${parsed.jotformSubmissionId} solicitud=${yaExiste.id}`,
      );
      return {
        id: yaExiste.id,
        estado: yaExiste.estado,
        creada: false,
        jotformSubmissionId: yaExiste.jotformSubmissionId,
      };
    }

    const resultado = await this.solicitudRepository.manager.transaction(
      async (manager) => {
        // Colaborador SOLO desde token de correlación emitido en Backend (JWT Fontanero).
        // Cualquier colaboradorId del payload Jotform se ignora.
        const colaboradorId = await this.correlacionService.consumirToken(
          parsed.correlacionToken,
          parsed.jotformSubmissionId,
          manager,
        );

        const { solicitud, creada } =
          await this.solicitudesService.crearPendiente({
            colaboradorId,
            tipo: parsed.tipo,
            fechaInicio: parsed.fechaInicio,
            fechaFin: parsed.fechaFin,
            motivo: parsed.motivo,
            jotformSubmissionId: parsed.jotformSubmissionId,
            manager,
          });

        this.logger.log(
          `Webhook Jotform submission=${parsed.jotformSubmissionId} solicitud=${solicitud.id} creada=${creada}`,
        );

        return {
          id: solicitud.id,
          estado: solicitud.estado,
          creada,
          jotformSubmissionId: solicitud.jotformSubmissionId!,
          solicitud,
        };
      },
    );

    if (resultado.creada) {
      await this.solicitudesService.avisarAdministradorasSolicitudPendiente(
        resultado.solicitud,
      );
    }

    return {
      id: resultado.id,
      estado: resultado.estado,
      creada: resultado.creada,
      jotformSubmissionId: resultado.jotformSubmissionId,
    };
  }

  private secretosCoinciden(recibido: string, esperado: string): boolean {
    const a = Buffer.from(recibido);
    const b = Buffer.from(esperado);
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  }

  /**
   * Opcional: si JOTFORM_VERIFY_SUBMISSION=true y hay API key,
   * confirma la submission contra la API de Jotform (solo Backend).
   */
  private async verificarSubmissionSiCorresponde(
    submissionId: string,
  ): Promise<void> {
    const verify =
      this.configService.get<boolean>('jotform.verifySubmission') === true;
    const apiKey = (
      this.configService.get<string>('jotform.apiKey') ?? ''
    ).trim();
    if (!verify || !apiKey) {
      return;
    }

    const base = (
      this.configService.get<string>('jotform.apiBaseUrl') ??
      'https://api.jotform.com'
    ).replace(/\/$/, '');

    const response = await fetch(`${base}/submission/${submissionId}`, {
      headers: { APIKEY: apiKey },
    });

    if (!response.ok) {
      this.logger.warn(
        `Verificación Jotform falló: submission=${submissionId} status=${response.status}`,
      );
      throw new BadRequestException(
        'No se pudo verificar la submission en Jotform',
      );
    }
  }
}
