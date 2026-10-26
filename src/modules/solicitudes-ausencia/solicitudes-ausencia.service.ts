import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, In, Repository } from 'typeorm';
import { EstadoSolicitudAusencia } from '../../common/enums/estado-solicitud-ausencia.enum';
import { TipoMovimientoVacaciones } from '../../common/enums/tipo-movimiento-vacaciones.enum';
import { TipoRegistroGeneradoAusencia } from '../../common/enums/tipo-registro-generado-ausencia.enum';
import { TipoSolicitudAusencia } from '../../common/enums/tipo-solicitud-ausencia.enum';
import { NotificacionesAveriasService } from '../notificaciones/notificaciones-averias.service';
import { ColaboradoresService } from '../recursos-humanos/colaboradores.service';
import { Colaborador } from '../recursos-humanos/entities/colaborador.entity';
import { MovimientoVacaciones } from '../recursos-humanos/entities/movimiento-vacaciones.entity';
import { PermisoColaborador } from '../recursos-humanos/entities/permiso-colaborador.entity';
import {
  compararFechasIso,
  esFechaCalendario,
} from '../recursos-humanos/fecha-permiso';
import { PermisosColaboradorService } from '../recursos-humanos/permisos-colaborador.service';
import {
  BalanceVacaciones,
  VacacionesService,
} from '../recursos-humanos/vacaciones.service';
import {
  deleteAusenciaDocument,
  getAusenciaDocumentFilePath,
  saveAusenciaDocument,
  type ActividadDocumentFile,
  validateActividadDocument,
} from '../../common/media/public-media';
import {
  fusionarDocumentosAusencia,
  type AdjuntoSolicitudAusencia,
} from './adjuntos-ausencia';
import { rangosCalendarioSeSolapan } from './solape-ausencia.util';
import {
  diasVacacionesNetos,
  resumenDiasVacaciones,
  type ResumenDiasVacaciones,
} from './dias-periodo-ausencia';
import {
  diasAusenciaSinFeriados,
  esFeriadoCostaRica,
} from './feriados-costa-rica';
import { CrearSolicitudAusenciaFontaneroDto } from './dto/crear-solicitud-ausencia-fontanero.dto';
import { RechazarSolicitudAusenciaDto } from './dto/rechazar-solicitud-ausencia.dto';
import {
  QuerySolicitudesAusenciaDto,
  SOLICITUDES_AUSENCIA_LIMIT_DEFAULT,
  SOLICITUDES_AUSENCIA_PAGE_DEFAULT,
} from './dto/query-solicitudes-ausencia.dto';
import {
  SolicitudAusenciaFontaneroResponse,
  toSolicitudAusenciaFontaneroResponse,
} from './dto/solicitud-ausencia-fontanero.response';
import { DocumentoSolicitudAusencia } from './entities/documento-solicitud-ausencia.entity';
import { SolicitudAusencia } from './entities/solicitud-ausencia.entity';
import { NotificacionSolicitudAusenciaService } from './notificacion-solicitud-ausencia.service';

export type SolicitudesAusenciaListado = {
  data: SolicitudAusencia[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type SolicitudAusenciaDetalle = SolicitudAusencia & {
  saldoVacaciones: BalanceVacaciones | null;
  resumenVacaciones: ResumenDiasVacaciones | null;
};

export type DocumentoAusenciaResponse = {
  id: number;
  solicitudId: number;
  nombreOriginal: string;
  tipoArchivo: string;
  rutaReferenciaArchivo: string;
  tamanio: number;
  fechaCarga: Date;
};

@Injectable()
export class SolicitudesAusenciaService {
  private readonly logger = new Logger(SolicitudesAusenciaService.name);

  constructor(
    @InjectRepository(SolicitudAusencia)
    private readonly solicitudRepository: Repository<SolicitudAusencia>,
    @InjectRepository(DocumentoSolicitudAusencia)
    private readonly documentoRepository: Repository<DocumentoSolicitudAusencia>,
    @InjectRepository(Colaborador)
    private readonly colaboradorRepository: Repository<Colaborador>,
    private readonly colaboradoresService: ColaboradoresService,
    private readonly permisosService: PermisosColaboradorService,
    private readonly vacacionesService: VacacionesService,
    private readonly notificacionSolicitudAusencia: NotificacionSolicitudAusenciaService,
    @Optional()
    private readonly notificacionesCampana?: NotificacionesAveriasService,
  ) {}

  /**
   * Resuelve el Colaborador activo vinculado al usuario autenticado.
   * No acepta colaboradorId del cliente.
   */
  async obtenerColaboradorDelUsuarioAutenticado(
    usuarioId: number,
  ): Promise<Colaborador> {
    const colaborador =
      await this.colaboradoresService.resolverActivoPorUsuarioId(usuarioId);
    if (colaborador) {
      return colaborador;
    }
    throw new ForbiddenException(
      'No hay un colaborador activo vinculado a su cuenta',
    );
  }

  /**
   * Listado propio del Fontanero (solo lectura).
   * Filtro de propietario en SQL; orden estable más reciente → más antigua.
   * Sin paginación: el PBI no la exige y no hay volumen obligatorio.
   */
  async listarSolicitudesPropias(
    usuarioId: number,
  ): Promise<SolicitudAusenciaFontaneroResponse[]> {
    const colaborador =
      await this.obtenerColaboradorDelUsuarioAutenticado(usuarioId);

    const solicitudes = await this.solicitudRepository.find({
      where: { colaboradorId: colaborador.id },
      relations: { documentos: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });

    return solicitudes.map(toSolicitudAusenciaFontaneroResponse);
  }

  /**
   * Detalle propio: WHERE id = :id AND colaboradorId = :colaboradorId.
   * Ajena o inexistente → 404 (no se revela existencia de recursos ajenos).
   */
  async obtenerSolicitudPropia(
    usuarioId: number,
    solicitudId: number,
  ): Promise<SolicitudAusenciaFontaneroResponse> {
    const colaborador =
      await this.obtenerColaboradorDelUsuarioAutenticado(usuarioId);

    const solicitud = await this.solicitudRepository.findOne({
      where: { id: solicitudId, colaboradorId: colaborador.id },
      relations: { documentos: true },
    });
    if (!solicitud) {
      throw new NotFoundException(
        `No existe la solicitud de ausencia ${solicitudId}`,
      );
    }
    return toSolicitudAusenciaFontaneroResponse(solicitud);
  }

  /**
   * Adjunta evidencia (PDF/JPG/PNG) a una solicitud propia PENDIENTE.
   */
  async adjuntarDocumentoPropio(
    usuarioId: number,
    solicitudId: number,
    file: ActividadDocumentFile | undefined,
  ): Promise<DocumentoAusenciaResponse> {
    validateActividadDocument(file);
    const colaborador =
      await this.obtenerColaboradorDelUsuarioAutenticado(usuarioId);

    const solicitud = await this.solicitudRepository.findOne({
      where: { id: solicitudId, colaboradorId: colaborador.id },
    });
    if (!solicitud) {
      throw new NotFoundException(
        `No existe la solicitud de ausencia ${solicitudId}`,
      );
    }
    if (solicitud.estado !== EstadoSolicitudAusencia.PENDIENTE) {
      throw new ConflictException(
        'Solo se puede adjuntar evidencia a solicitudes pendientes',
      );
    }

    const { rutaReferenciaArchivo } = saveAusenciaDocument(solicitudId, file);
    const documento = this.documentoRepository.create({
      solicitudId,
      nombreOriginal: file.originalname,
      tipoArchivo: file.mimetype,
      rutaReferenciaArchivo,
      tamanio: file.size,
    });

    let saved: DocumentoSolicitudAusencia;
    try {
      saved = await this.documentoRepository.save(documento);
    } catch (error) {
      try {
        deleteAusenciaDocument(solicitudId, rutaReferenciaArchivo);
      } catch {
        // Se conserva el error original de persistencia.
      }
      throw error;
    }

    return {
      id: saved.id,
      solicitudId,
      nombreOriginal: saved.nombreOriginal,
      tipoArchivo: saved.tipoArchivo,
      rutaReferenciaArchivo: saved.rutaReferenciaArchivo,
      tamanio: saved.tamanio,
      fechaCarga: saved.fechaCarga,
    };
  }

  async obtenerArchivoDocumento(
    solicitudId: number,
    filename: string,
    opts?: { usuarioId?: number; rolAdministradora?: boolean },
  ): Promise<{
    absolutePath: string;
    mimeType: string;
    documento: DocumentoSolicitudAusencia;
  }> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id: solicitudId },
      relations: { documentos: true },
    });
    if (!solicitud) {
      throw new NotFoundException('Documento de evidencia no encontrado');
    }

    const visibles = fusionarDocumentosAusencia(
      solicitudId,
      solicitud.documentos ?? [],
      solicitud.adjuntosJson,
      solicitud.createdAt,
    );
    const match = visibles.find((d) =>
      d.rutaReferenciaArchivo.endsWith(`/${filename}`),
    );
    if (!match) {
      throw new NotFoundException('Documento de evidencia no encontrado');
    }

    if (!opts?.rolAdministradora) {
      if (!opts?.usuarioId) {
        throw new ForbiddenException('No autorizado');
      }
      const colaborador = await this.obtenerColaboradorDelUsuarioAutenticado(
        opts.usuarioId,
      );
      if (solicitud.colaboradorId !== colaborador.id) {
        throw new NotFoundException('Documento de evidencia no encontrado');
      }
    }

    const { absolutePath, mimeType } = getAusenciaDocumentFilePath(
      solicitudId,
      filename,
    );
    return {
      absolutePath,
      mimeType,
      documento: {
        nombreOriginal: match.nombreOriginal,
      } as DocumentoSolicitudAusencia,
    };
  }

  /**
   * Alta desde el formulario nativo del Fontanero (JWT → Colaborador).
   * Queda PENDIENTE; no crea PermisoColaborador ni MovimientoVacaciones.
   */
  async crearSolicitudPropia(
    usuarioId: number,
    dto: CrearSolicitudAusenciaFontaneroDto,
    archivos: AdjuntoSolicitudAusencia[] = [],
  ): Promise<SolicitudAusenciaFontaneroResponse> {
    const colaborador =
      await this.obtenerColaboradorDelUsuarioAutenticado(usuarioId);

    if (dto.tipo === TipoSolicitudAusencia.PERMISO && !dto.motivo?.trim()) {
      throw new BadRequestException('Indique el motivo del permiso');
    }
    if (dto.tipo === TipoSolicitudAusencia.VACACIONES && archivos.length > 0) {
      throw new BadRequestException(
        'La solicitud de vacaciones no admite archivos adjuntos',
      );
    }

    const { solicitud, creada } =
      await this.solicitudRepository.manager.transaction(async (manager) =>
        this.crearPendiente({
          colaboradorId: colaborador.id,
          tipo: dto.tipo,
          fechaInicio: dto.fechaInicio,
          fechaFin: dto.fechaFin,
          motivo:
            dto.tipo === TipoSolicitudAusencia.VACACIONES
              ? null
              : dto.motivo?.trim() || null,
          correoNotificacion: dto.correo.trim().toLowerCase(),
          jotformSubmissionId: `sigasj-${randomUUID()}`,
          manager,
        }),
      );

    if (creada && archivos.length > 0) {
      const guardados: DocumentoSolicitudAusencia[] = [];
      for (const file of archivos) {
        const { rutaReferenciaArchivo } = saveAusenciaDocument(
          solicitud.id,
          file,
        );
        try {
          const documento = await this.documentoRepository.save(
            this.documentoRepository.create({
              solicitudId: solicitud.id,
              nombreOriginal: file.originalname,
              tipoArchivo: file.mimetype,
              rutaReferenciaArchivo,
              tamanio: file.size,
            }),
          );
          guardados.push(documento);
        } catch (error) {
          try {
            deleteAusenciaDocument(solicitud.id, rutaReferenciaArchivo);
          } catch {
            // Se conserva el error original de persistencia.
          }
          throw error;
        }
      }
      solicitud.documentos = guardados;
    }

    if (creada) {
      await this.avisarAdministradorasSolicitudPendiente(
        solicitud,
        colaborador,
      );
    }

    return toSolicitudAusenciaFontaneroResponse(solicitud);
  }

  /**
   * Campana interna (fuera de la transacción de alta), igual que averías.
   */
  async avisarAdministradorasSolicitudPendiente(
    solicitud: SolicitudAusencia,
    colaborador?: Colaborador | null,
  ): Promise<void> {
    if (!this.notificacionesCampana) {
      return;
    }
    try {
      const conColaborador =
        colaborador != null
          ? ({ ...solicitud, colaborador } as SolicitudAusencia)
          : solicitud.colaborador
            ? solicitud
            : await this.solicitudRepository.findOne({
                where: { id: solicitud.id },
                relations: { colaborador: true },
              });
      if (!conColaborador) {
        return;
      }
      await this.notificacionesCampana.notificarAdministradorasSolicitudAusenciaPendiente(
        conColaborador,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo notificar en campana la solicitud ${solicitud.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async crearPendiente(input: {
    colaboradorId: number;
    tipo: TipoSolicitudAusencia;
    fechaInicio: string;
    fechaFin: string;
    motivo: string | null;
    correoNotificacion?: string | null;
    jotformSubmissionId: string;
    manager: EntityManager;
  }): Promise<{ solicitud: SolicitudAusencia; creada: boolean }> {
    this.validarFechas(input.fechaInicio, input.fechaFin);
    await this.assertPeriodoLibre(
      input.manager,
      input.colaboradorId,
      input.tipo,
      input.fechaInicio,
      input.fechaFin,
    );

    const repo = input.manager.getRepository(SolicitudAusencia);
    const existente = await repo.findOne({
      where: { jotformSubmissionId: input.jotformSubmissionId },
    });
    if (existente) {
      this.logger.log(
        `Webhook idempotente: submission=${input.jotformSubmissionId} ya existe id=${existente.id}`,
      );
      return { solicitud: existente, creada: false };
    }

    try {
      const solicitud = repo.create({
        colaboradorId: input.colaboradorId,
        tipo: input.tipo,
        fechaInicio: input.fechaInicio,
        fechaFin: input.fechaFin,
        motivo: input.motivo,
        correoNotificacion:
          input.correoNotificacion?.trim().toLowerCase() || null,
        observaciones: null,
        estado: EstadoSolicitudAusencia.PENDIENTE,
        jotformSubmissionId: input.jotformSubmissionId,
        reviewedAt: null,
        reviewedByUsuarioId: null,
        motivoRechazo: null,
        registroGeneradoId: null,
        registroGeneradoTipo: null,
      });
      const guardada = await repo.save(solicitud);
      this.logger.log(
        `SolicitudAusencia PENDIENTE id=${guardada.id} tipo=${guardada.tipo} submission=${guardada.jotformSubmissionId}`,
      );
      return { solicitud: guardada, creada: true };
    } catch (error) {
      const duplicada = await repo.findOne({
        where: { jotformSubmissionId: input.jotformSubmissionId },
      });
      if (duplicada) {
        return { solicitud: duplicada, creada: false };
      }
      throw error;
    }
  }

  async findAll(
    query: QuerySolicitudesAusenciaDto,
  ): Promise<SolicitudesAusenciaListado> {
    const page = query.page ?? SOLICITUDES_AUSENCIA_PAGE_DEFAULT;
    const limit = query.limit ?? SOLICITUDES_AUSENCIA_LIMIT_DEFAULT;

    const qb = this.solicitudRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.colaborador', 'c');

    if (query.estado) {
      qb.andWhere('s.estado = :estado', { estado: query.estado });
    }
    if (query.tipo) {
      qb.andWhere('s.tipo = :tipo', { tipo: query.tipo });
    }
    if (query.colaboradorId !== undefined) {
      qb.andWhere('s.colaboradorId = :colaboradorId', {
        colaboradorId: query.colaboradorId,
      });
    }

    qb.orderBy('s.createdAt', 'DESC')
      .addOrderBy('s.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  async findOneDetalle(id: number): Promise<SolicitudAusenciaDetalle> {
    const solicitud = await this.findOne(id);
    let saldoVacaciones: BalanceVacaciones | null = null;
    let resumenVacaciones: ResumenDiasVacaciones | null = null;
    if (solicitud.tipo === TipoSolicitudAusencia.VACACIONES) {
      resumenVacaciones = resumenDiasVacaciones(
        solicitud.fechaInicio,
        solicitud.fechaFin,
      );
      try {
        saldoVacaciones = await this.vacacionesService.obtenerBalance(
          solicitud.colaboradorId,
        );
      } catch {
        saldoVacaciones = null;
      }
    }
    return Object.assign(solicitud, { saldoVacaciones, resumenVacaciones });
  }

  async findOne(id: number): Promise<SolicitudAusencia> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id },
      relations: { colaborador: true, documentos: true },
    });
    if (!solicitud) {
      throw new NotFoundException(`No existe la solicitud de ausencia ${id}`);
    }
    solicitud.documentos = fusionarDocumentosAusencia(
      solicitud.id,
      solicitud.documentos ?? [],
      solicitud.adjuntosJson,
      solicitud.createdAt,
    ) as DocumentoSolicitudAusencia[];
    return solicitud;
  }

  async aprobar(
    id: number,
    reviewedByUsuarioId: number,
  ): Promise<SolicitudAusencia> {
    const actualizada = await this.solicitudRepository.manager.transaction(
      async (manager) => {
        const repo = manager.getRepository(SolicitudAusencia);
        const solicitud = await repo.findOne({ where: { id } });
        if (!solicitud) {
          throw new NotFoundException(
            `No existe la solicitud de ausencia ${id}`,
          );
        }
        if (solicitud.estado !== EstadoSolicitudAusencia.PENDIENTE) {
          throw new ConflictException(
            `Solo se pueden aprobar solicitudes PENDIENTE (estado actual: ${solicitud.estado})`,
          );
        }

        const colaboradorExiste = await manager
          .getRepository(Colaborador)
          .exists({
            where: { id: solicitud.colaboradorId },
          });
        if (!colaboradorExiste) {
          throw new BadRequestException(
            `El colaborador con id ${solicitud.colaboradorId} no existe`,
          );
        }

        this.validarFechas(solicitud.fechaInicio, solicitud.fechaFin);
        await this.assertPeriodoLibre(
          manager,
          solicitud.colaboradorId,
          solicitud.tipo,
          solicitud.fechaInicio,
          solicitud.fechaFin,
          solicitud.id,
        );

        // Claim atómico: solo una aprobación gana el UPDATE (anti-concurrencia).
        const claim = await repo
          .createQueryBuilder()
          .update(SolicitudAusencia)
          .set({
            estado: EstadoSolicitudAusencia.APROBADA,
            reviewedAt: new Date(),
            reviewedByUsuarioId,
            motivoRechazo: null,
          })
          .where('id = :id', { id })
          .andWhere('estado = :estado', {
            estado: EstadoSolicitudAusencia.PENDIENTE,
          })
          .execute();

        if ((claim.affected ?? 0) !== 1) {
          throw new ConflictException(
            'La solicitud ya fue procesada por otra operación',
          );
        }

        // Si falla RRHH, la transacción hace ROLLBACK completo (incluido el claim).
        if (solicitud.tipo === TipoSolicitudAusencia.PERMISO) {
          const permiso = await this.permisosService.create(
            {
              colaboradorId: solicitud.colaboradorId,
              fechaInicio: solicitud.fechaInicio,
              fechaFin: solicitud.fechaFin,
              motivo:
                solicitud.motivo?.trim() || 'Solicitud aprobada vía Jotform',
              observaciones: `SolicitudAusencia #${solicitud.id}`,
            },
            manager,
          );
          await repo.update(id, {
            registroGeneradoId: permiso.id,
            registroGeneradoTipo: TipoRegistroGeneradoAusencia.PERMISO,
          });
        } else if (solicitud.tipo === TipoSolicitudAusencia.VACACIONES) {
          const cantidadDias = diasVacacionesNetos(
            solicitud.fechaInicio,
            solicitud.fechaFin,
          );
          if (cantidadDias < 1) {
            throw new BadRequestException(
              'El periodo de vacaciones no produce días válidos tras descontar feriados',
            );
          }
          // Saldo se revalida en VacacionesService al momento de aprobar.
          const movimiento = await this.vacacionesService.registrarMovimiento(
            {
              colaboradorId: solicitud.colaboradorId,
              tipo: TipoMovimientoVacaciones.DISFRUTADO,
              cantidadDias,
              fecha: solicitud.fechaInicio,
              observaciones:
                solicitud.motivo?.trim() ||
                `Disfrute ${solicitud.fechaInicio} – ${solicitud.fechaFin} por SolicitudAusencia #${solicitud.id}`,
              registradoPorUsuarioId: reviewedByUsuarioId,
            },
            manager,
          );
          await repo.update(id, {
            registroGeneradoId: movimiento.id,
            registroGeneradoTipo:
              TipoRegistroGeneradoAusencia.MOVIMIENTO_VACACIONES,
          });
        } else {
          throw new BadRequestException('Tipo de solicitud no soportado');
        }

        this.logger.log(`SolicitudAusencia APROBADA id=${id}`);
        const guardada = await repo.findOne({
          where: { id },
          relations: { colaborador: true },
        });
        if (!guardada) {
          throw new NotFoundException(
            `No existe la solicitud de ausencia ${id}`,
          );
        }
        return guardada;
      },
    );

    // Fuera de la transacción: un fallo de correo no revierte la aprobación.
    try {
      await this.notificacionSolicitudAusencia.notificarAprobacion(
        actualizada,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Notificación de aprobación omitida id=${id}: ${message}`,
      );
    }
    await this.avisarFontaneroDecision(actualizada, 'aprobada');

    return this.findOne(id);
  }

  async rechazar(
    id: number,
    reviewedByUsuarioId: number,
    dto: RechazarSolicitudAusenciaDto = {},
  ): Promise<SolicitudAusencia> {
    await this.solicitudRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(SolicitudAusencia);
      const claim = await repo
        .createQueryBuilder()
        .update(SolicitudAusencia)
        .set({
          estado: EstadoSolicitudAusencia.RECHAZADA,
          reviewedAt: new Date(),
          reviewedByUsuarioId,
          motivoRechazo: dto.motivoRechazo ?? null,
          registroGeneradoId: null,
          registroGeneradoTipo: null,
        })
        .where('id = :id', { id })
        .andWhere('estado = :estado', {
          estado: EstadoSolicitudAusencia.PENDIENTE,
        })
        .execute();

      if ((claim.affected ?? 0) !== 1) {
        const actual = await repo.findOne({ where: { id } });
        if (!actual) {
          throw new NotFoundException(
            `No existe la solicitud de ausencia ${id}`,
          );
        }
        throw new ConflictException(
          `Solo se pueden rechazar solicitudes PENDIENTE (estado actual: ${actual.estado})`,
        );
      }

      this.logger.log(`SolicitudAusencia RECHAZADA id=${id}`);
    });
    const rechazada = await this.findOne(id);
    try {
      await this.notificacionSolicitudAusencia.notificarRechazo(rechazada);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Notificación de rechazo omitida id=${id}: ${message}`,
      );
    }
    await this.avisarFontaneroDecision(rechazada, 'rechazada');
    return rechazada;
  }

  private async avisarFontaneroDecision(
    solicitud: SolicitudAusencia,
    decision: 'aprobada' | 'rechazada',
  ): Promise<void> {
    if (!this.notificacionesCampana) {
      return;
    }
    try {
      await this.notificacionesCampana.notificarFontaneroSolicitudAusencia(
        solicitud,
        decision,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo notificar al Fontanero la solicitud ${solicitud.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async assertPeriodoLibre(
    manager: EntityManager,
    colaboradorId: number,
    _tipo: TipoSolicitudAusencia,
    fechaInicio: string,
    fechaFin: string,
    excluirSolicitudId?: number,
  ): Promise<void> {
    const solicitudes = await manager.getRepository(SolicitudAusencia).find({
      where: {
        colaboradorId,
        estado: In([
          EstadoSolicitudAusencia.PENDIENTE,
          EstadoSolicitudAusencia.APROBADA,
        ]),
      },
    });
    const choqueSolicitud = solicitudes.find(
      (item) =>
        item.id !== excluirSolicitudId &&
        rangosCalendarioSeSolapan(
          fechaInicio,
          fechaFin,
          item.fechaInicio,
          item.fechaFin,
        ),
    );
    if (choqueSolicitud) {
      throw new ConflictException(
        'Ya existe una solicitud de ausencia en ese periodo para este colaborador',
      );
    }

    const permisos = await manager.getRepository(PermisoColaborador).find({
      where: { colaboradorId },
    });
    const choquePermiso = permisos.find((item) =>
      rangosCalendarioSeSolapan(
        fechaInicio,
        fechaFin,
        item.fechaInicio,
        item.fechaFin,
      ),
    );
    if (choquePermiso) {
      throw new ConflictException(
        'Ya existe un permiso registrado en ese periodo',
      );
    }

    const movimientos = await manager.getRepository(MovimientoVacaciones).find({
      where: {
        colaboradorId,
        tipo: TipoMovimientoVacaciones.DISFRUTADO,
      },
    });
    const choqueMovimiento = movimientos.find(
      (item) => item.fecha >= fechaInicio && item.fecha <= fechaFin,
    );
    if (choqueMovimiento) {
      throw new ConflictException(
        'Ya existe un disfrute de vacaciones en ese periodo',
      );
    }
  }

  private validarFechas(fechaInicio: string, fechaFin: string): void {
    if (!esFechaCalendario(fechaInicio)) {
      throw new BadRequestException('fechaInicio no es una fecha válida');
    }
    if (!esFechaCalendario(fechaFin)) {
      throw new BadRequestException('fechaFin no es una fecha válida');
    }
    if (compararFechasIso(fechaInicio, fechaFin) > 0) {
      throw new BadRequestException(
        'fechaFin no puede ser anterior a fechaInicio',
      );
    }
    if (esFeriadoCostaRica(fechaInicio)) {
      throw new BadRequestException(
        'La fecha de inicio no puede ser un feriado',
      );
    }
    if (esFeriadoCostaRica(fechaFin)) {
      throw new BadRequestException(
        'La fecha de fin no puede ser un feriado',
      );
    }
    if (diasAusenciaSinFeriados(fechaInicio, fechaFin) < 1) {
      throw new BadRequestException(
        'El periodo no incluye días hábiles: solo hay feriados en ese rango',
      );
    }
  }
}
