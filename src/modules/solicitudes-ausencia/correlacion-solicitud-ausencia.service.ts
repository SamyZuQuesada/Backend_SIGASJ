import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { Colaborador } from '../recursos-humanos/entities/colaborador.entity';
import { CorrelacionSolicitudAusencia } from './entities/correlacion-solicitud-ausencia.entity';

export type CorrelacionEmitida = {
  token: string;
  expiresAt: string;
  colaboradorId: number;
  formId: string;
};

@Injectable()
export class CorrelacionSolicitudAusenciaService {
  private readonly logger = new Logger(
    CorrelacionSolicitudAusenciaService.name,
  );

  constructor(
    @InjectRepository(CorrelacionSolicitudAusencia)
    private readonly correlacionRepository: Repository<CorrelacionSolicitudAusencia>,
    @InjectRepository(Colaborador)
    private readonly colaboradorRepository: Repository<Colaborador>,
    private readonly configService: ConfigService,
  ) {}

  async emitirParaUsuario(usuarioId: number): Promise<CorrelacionEmitida> {
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      throw new BadRequestException(
        'No fue posible identificar al usuario autenticado',
      );
    }

    const colaborador = await this.colaboradorRepository.findOne({
      where: { usuarioId, activo: true },
    });
    if (!colaborador) {
      throw new NotFoundException(
        'No hay un colaborador activo vinculado a su cuenta. Contacte a administración.',
      );
    }

    const ttlMinutos =
      this.configService.get<number>('jotform.correlacionTtlMinutos') ?? 60;
    const expiresAt = new Date(Date.now() + ttlMinutos * 60_000);
    const token = randomBytes(24).toString('hex');

    await this.correlacionRepository.save(
      this.correlacionRepository.create({
        token,
        colaboradorId: colaborador.id,
        usuarioId,
        expiresAt,
        usedAt: null,
        jotformSubmissionId: null,
      }),
    );

    this.logger.log(
      `Correlación emitida: colaboradorId=${colaborador.id}, usuarioId=${usuarioId}`,
    );

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      colaboradorId: colaborador.id,
      formId: (this.configService.get<string>('jotform.formId') ?? '').trim(),
    };
  }

  /**
   * Consume el token de forma atómica (UPDATE WHERE usedAt IS NULL).
   * Evita que dos submissions usen el mismo token.
   */
  async consumirToken(
    token: string,
    jotformSubmissionId: string,
    manager: EntityManager,
  ): Promise<number> {
    const repo = manager.getRepository(CorrelacionSolicitudAusencia);
    const now = new Date();
    const result = await repo
      .createQueryBuilder()
      .update(CorrelacionSolicitudAusencia)
      .set({
        usedAt: now,
        jotformSubmissionId,
      })
      .where('token = :token', { token: token.trim() })
      .andWhere('usedAt IS NULL')
      .andWhere('expiresAt > :now', { now })
      .execute();

    if ((result.affected ?? 0) !== 1) {
      const existente = await repo.findOne({ where: { token: token.trim() } });
      if (!existente) {
        throw new BadRequestException('Token de correlación inválido');
      }
      if (existente.usedAt) {
        throw new BadRequestException('Token de correlación ya utilizado');
      }
      throw new BadRequestException('El token de correlación expiró');
    }

    const correlacion = await repo.findOneOrFail({
      where: { token: token.trim() },
    });
    return correlacion.colaboradorId;
  }
}
