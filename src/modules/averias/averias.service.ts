import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import {
  ESTADO_AVERIA_LABELS,
  EstadoAveria,
} from '../../common/enums/estado-averia.enum';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ahoraDelSistema } from '../../common/time/reloj-asada';
import { withDbRetry } from '../../common/persistence/with-db-retry';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ValidacionHorarioLaboralFontaneroService } from '../usuarios/validacion-horario-laboral-fontanero.service';
import type { EvaluacionHorarioLaboral } from '../usuarios/validacion-horario-laboral-fontanero';
import {
  estadoTrasValidarHorarioAsignacion,
  prepararEventoNotificacionHorarioAsignacion,
  type EventoNotificacionHorarioAsignacion,
} from './averias.asignacion-horario';
import {
  assertEstadoAveriaCompatibleConFontanero,
  assertTransicionEstadoAveria,
} from './averias.estado-transiciones';
import {
  assertHorarioPermiteIniciarAtencion,
  registrarInicioAtencionExitoso,
} from './averias.inicio-atencion';
import { usuarioEsFontaneroAsignable } from './averias.fontanero-asignable';
import {
  ADMIN_AVERIAS_LIMIT_DEFAULT,
  ADMIN_AVERIAS_PAGE_DEFAULT,
  ADMIN_AVERIAS_PRIORIDAD_SIN_ASIGNAR,
  QueryAveriasAdminDto,
} from './dto/query-averias-admin.dto';
import { AssignAveriaFontaneroDto } from './dto/assign-averia-fontanero.dto';
import { CreatePublicAveriaDto } from './dto/create-public-averia.dto';
import {
  CreateObservacionAveriaDto,
  OBSERVACION_AVERIA_REGISTRADA,
} from './dto/create-observacion-averia.dto';
import {
  AVERIA_FONTANERO_RESOLVER_FORBIDDEN,
  AVERIA_NO_EN_ATENCION,
  AVERIA_RESOLVER_ERROR,
  AVERIA_RESUELTA_OK,
  ResolverAveriaDto,
} from './dto/resolver-averia.dto';
import { RegistroPublicoAveriaResponseDto } from './dto/registro-publico-averia-response.dto';
import { UpdateAveriaClasificacionDto } from './dto/update-averia-clasificacion.dto';
import { UpdateAveriaClasificacionFontaneroDto } from './dto/update-averia-clasificacion-fontanero.dto';
import { UpdateAveriaEstadoDto } from './dto/update-averia-estado.dto';
import { UpdateAveriaPrioridadDto } from './dto/update-averia-prioridad.dto';
import { UpdateAveriaPrioridadFontaneroDto } from './dto/update-averia-prioridad-fontanero.dto';
import {
  buildCodigoSeguimiento,
  CODIGO_SEGUIMIENTO_MAX_RETRIES,
  isCodigoSeguimientoUniqueViolation,
  parseConsecutiveFromCodigo,
} from './averias.codigo-seguimiento';
import { Averia } from './entities/averia.entity';
import { ObservacionAveria } from './entities/observacion-averia.entity';
import { NotificacionesAveriasService } from '../notificaciones/notificaciones-averias.service';
import { SmsAveriasService } from '../notificaciones/sms-averias.service';

const REGISTRO_OK = 'Avería registrada correctamente.';
const REGISTRO_ERROR = 'No se pudo registrar la avería. Intente nuevamente.';
const LISTADO_ERROR = 'No se pudieron consultar las averías';
const DETALLE_ERROR = 'No se pudo consultar la avería';
const ACTUALIZACION_ERROR = 'No se pudo actualizar la avería';
const INICIO_ATENCION_ERROR =
  'No se pudo iniciar la atención. Intente nuevamente.';
const FONTANEROS_ERROR = 'No se pudieron consultar los fontaneros';
const OBSERVACION_ERROR =
  'No se pudo registrar la observación. Intente nuevamente.';
export const AVERIA_ADMIN_NOT_FOUND = 'No se encontró la avería solicitada.';
export const AVERIA_FONTANERO_FORBIDDEN =
  'No tiene autorización para consultar esta avería.';
export const AVERIA_FONTANERO_YA_CERRADA =
  'No se puede calificar una avería resuelta o cancelada.';
export const TIPO_AVERIA_SIN_CLASIFICAR = 'Sin clasificar';
export const PRIORIDAD_AVERIA_SIN_ASIGNAR = 'Sin asignar';
export const OBSERVACIONES_ATENCION_VACIAS = 'Sin observaciones';
export const FONTANERO_ASIGNABLE_NOT_FOUND =
  'No se encontró el fontanero solicitado.';
export const FONTANERO_ROL_INVALIDO =
  'El usuario seleccionado no tiene rol FONTANERO.';
export const FONTANERO_INACTIVO =
  'El fontanero seleccionado se encuentra inactivo.';
export const AVERIA_YA_ASIGNADA = 'La avería ya tiene un fontanero asignado.';
const RANGO_FECHAS_INVALIDO = 'fechaDesde no puede ser posterior a fechaHasta';
const FECHA_CALENDARIO_INVALIDA =
  'fechaDesde y fechaHasta deben ser una fecha calendario válida (YYYY-MM-DD)';

export type AveriaAdminFontanero = {
  id: number;
  nombre?: string;
};

/** Identificador básico. No existe entidad Abonado; solo se persiste idAbonado. */
export type AveriaAdminAbonado = {
  id: number;
};

/**
 * Detalle administrativo. Campos planos, mismos nombres que el listado.
 * Fontanero: `{ id, nombre }` cuando hay asignación; Abonado sigue siendo `{ id }`.
 */
export type AveriaAdminDetail = {
  id: number;
  codigoSeguimiento: string;
  fechaReporte: Date;
  nombreReportante: string;
  identificacionReportante: string | null;
  telefonoReportante: string;
  correoReportante: string | null;
  abonado: AveriaAdminAbonado | null;
  sectorComunidad: string;
  ubicacion: string;
  descripcion: string;
  estado: EstadoAveria;
  tipoAveria: string | null;
  prioridad: string | null;
  fontanero: AveriaAdminFontanero | null;
  fechaAsignacion: Date | null;
  fechaInicioAtencion: Date | null;
  fechaResolucion: Date | null;
  observacionesAtencion: string | null;
  observaciones: AveriaObservacionItem[];
};

export type AveriaAdminListItem = {
  id: number;
  codigoSeguimiento: string;
  fechaReporte: Date;
  nombreReportante: string;
  sectorComunidad: string;
  ubicacion: string;
  descripcion: string;
  estado: EstadoAveria;
  tipoAveria: string | null;
  prioridad: string | null;
  fontanero: AveriaAdminFontanero | null;
};

export type AveriasAdminListado = {
  data: AveriaAdminListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type AveriasAdminFontanerosListado = {
  data: AveriaAdminFontanero[];
};

export type HorarioLaboralAsignacion = {
  resultado: EvaluacionHorarioLaboral['resultado'];
  dentroDeHorario: boolean;
  motivo: string;
};

/**
 * Respuesta de PATCH /asignacion. Incluye la validación de horario (2.6.3)
 * y el evento preparado para el SMS posterior (2.8), sin enviarlo.
 */
export type AveriaAsignacionResult = AveriaAdminDetail & {
  horarioLaboral: HorarioLaboralAsignacion;
  notificacionPendiente: EventoNotificacionHorarioAsignacion | null;
};

export type AveriaObservacionItem = {
  id: number;
  observacion: string;
  fechaCreacion: Date;
  autor: {
    id: number;
    nombre: string;
  };
};

export type CreateObservacionAveriaResponse = {
  message: string;
  data: AveriaObservacionItem;
};

export const ESTADOS_LISTADO_FONTANERO: readonly EstadoAveria[] = [
  EstadoAveria.ASIGNADA,
  EstadoAveria.PENDIENTE,
  EstadoAveria.EN_ATENCION,
];

export type AveriaFontaneroListItem = {
  id: number;
  codigoSeguimiento: string;
  fechaAsignacion: Date | null;
  estado: EstadoAveria;
  sectorComunidad: string;
  ubicacion: string;
  descripcion: string;
  tipoAveria: string;
  prioridad: string;
  fechaInicioAtencion: Date | null;
};

export type AveriasFontaneroListado = {
  data: AveriaFontaneroListItem[];
};

/**
 * Detalle para el Fontanero autenticado. Solo datos necesarios para atender.
 * No incluye identificación, correo, Abonado ni secretos de Usuario.
 */
export type AveriaFontaneroDetail = {
  id: number;
  codigoSeguimiento: string;
  fechaReporte: Date;
  fechaAsignacion: Date | null;
  estado: EstadoAveria;
  sectorComunidad: string;
  ubicacion: string;
  descripcion: string;
  nombreReportante: string;
  telefonoReportante: string;
  tipoAveria: string;
  prioridad: string;
  fechaInicioAtencion: Date | null;
  fechaResolucion: Date | null;
  observacionesAtencion: string;
  observaciones: AveriaObservacionItem[];
};

export type ResolverAveriaResponse = {
  message: string;
  data: AveriaFontaneroDetail;
};

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDateOnly(value: string): boolean {
  const match = ISO_DATE_ONLY.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

export function toStartOfUtcDay(isoDate: string): Date {
  const match = ISO_DATE_ONLY.exec(isoDate);
  if (!match) {
    throw new BadRequestException(FECHA_CALENDARIO_INVALIDA);
  }
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
}

export function toStartOfNextUtcDay(isoDate: string): Date {
  const start = toStartOfUtcDay(isoDate);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_[\]]/g, '\\$&');
}

function toAdminFontanero(averia: Averia): AveriaAdminFontanero | null {
  if (averia.idFontaneroAsignado == null) {
    return null;
  }
  const nombre = averia.fontaneroAsignado?.nombre?.trim();
  return {
    id: averia.idFontaneroAsignado,
    ...(nombre ? { nombre } : {}),
  };
}

function toAdminListItem(averia: Averia): AveriaAdminListItem {
  return {
    id: averia.id,
    codigoSeguimiento: averia.codigoSeguimiento,
    fechaReporte: averia.fechaReporte,
    nombreReportante: averia.nombreReportante,
    sectorComunidad: averia.sectorComunidad,
    ubicacion: averia.ubicacion,
    descripcion: averia.descripcion,
    estado: averia.estado,
    tipoAveria: averia.tipoAveria ?? null,
    prioridad: averia.prioridad ?? null,
    fontanero: toAdminFontanero(averia),
  };
}

export function toAdminDetail(
  averia: Averia,
  observaciones: AveriaObservacionItem[] = [],
): AveriaAdminDetail {
  return {
    id: averia.id,
    codigoSeguimiento: averia.codigoSeguimiento,
    fechaReporte: averia.fechaReporte,
    nombreReportante: averia.nombreReportante,
    identificacionReportante: averia.identificacionReportante ?? null,
    telefonoReportante: averia.telefonoReportante,
    correoReportante: averia.correoReportante ?? null,
    abonado: averia.idAbonado != null ? { id: averia.idAbonado } : null,
    sectorComunidad: averia.sectorComunidad,
    ubicacion: averia.ubicacion,
    descripcion: averia.descripcion,
    estado: averia.estado,
    tipoAveria: averia.tipoAveria ?? null,
    prioridad: averia.prioridad ?? null,
    fontanero: toAdminFontanero(averia),
    fechaAsignacion: averia.fechaAsignacion ?? null,
    fechaInicioAtencion: averia.fechaInicioAtencion ?? null,
    fechaResolucion: averia.fechaResolucion ?? null,
    observacionesAtencion: averia.observacionesAtencion ?? null,
    observaciones,
  };
}

export function resolveAuthenticatedUsuarioId(user: AuthenticatedUser): number {
  const raw = user.idUsuario ?? user.userId;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ForbiddenException(AVERIA_FONTANERO_FORBIDDEN);
  }
  return id;
}

export function toFontaneroListItem(averia: Averia): AveriaFontaneroListItem {
  return {
    id: averia.id,
    codigoSeguimiento: averia.codigoSeguimiento,
    fechaAsignacion: averia.fechaAsignacion ?? null,
    estado: averia.estado,
    sectorComunidad: averia.sectorComunidad,
    ubicacion: averia.ubicacion,
    descripcion: averia.descripcion,
    tipoAveria: averia.tipoAveria?.trim() || TIPO_AVERIA_SIN_CLASIFICAR,
    prioridad: averia.prioridad?.trim() || PRIORIDAD_AVERIA_SIN_ASIGNAR,
    fechaInicioAtencion: averia.fechaInicioAtencion ?? null,
  };
}

export function toFontaneroDetail(
  averia: Averia,
  observaciones: AveriaObservacionItem[] = [],
): AveriaFontaneroDetail {
  const observacionesAtencion = averia.observacionesAtencion?.trim();
  return {
    id: averia.id,
    codigoSeguimiento: averia.codigoSeguimiento,
    fechaReporte: averia.fechaReporte,
    fechaAsignacion: averia.fechaAsignacion ?? null,
    estado: averia.estado,
    sectorComunidad: averia.sectorComunidad,
    ubicacion: averia.ubicacion,
    descripcion: averia.descripcion,
    nombreReportante: averia.nombreReportante,
    telefonoReportante: averia.telefonoReportante,
    tipoAveria: averia.tipoAveria?.trim() || TIPO_AVERIA_SIN_CLASIFICAR,
    prioridad: averia.prioridad?.trim() || PRIORIDAD_AVERIA_SIN_ASIGNAR,
    fechaInicioAtencion: averia.fechaInicioAtencion ?? null,
    fechaResolucion: averia.fechaResolucion ?? null,
    observacionesAtencion:
      observacionesAtencion || OBSERVACIONES_ATENCION_VACIAS,
    observaciones,
  };
}

export function buildFindOneFontaneroQuery(
  repository: Repository<Averia>,
  id: number,
): SelectQueryBuilder<Averia> {
  return repository
    .createQueryBuilder('averia')
    .select([
      'averia.id',
      'averia.codigoSeguimiento',
      'averia.fechaReporte',
      'averia.fechaAsignacion',
      'averia.estado',
      'averia.sectorComunidad',
      'averia.ubicacion',
      'averia.descripcion',
      'averia.nombreReportante',
      'averia.telefonoReportante',
      'averia.tipoAveria',
      'averia.prioridad',
      'averia.fechaInicioAtencion',
      'averia.fechaResolucion',
      'averia.observacionesAtencion',
      'averia.idFontaneroAsignado',
    ])
    .where('averia.id = :id', { id });
}

export function buildFindOneAdminQuery(
  repository: Repository<Averia>,
  id: number,
): SelectQueryBuilder<Averia> {
  return repository
    .createQueryBuilder('averia')
    .leftJoin('averia.fontaneroAsignado', 'fontanero')
    .select([
      'averia.id',
      'averia.codigoSeguimiento',
      'averia.fechaReporte',
      'averia.nombreReportante',
      'averia.identificacionReportante',
      'averia.telefonoReportante',
      'averia.correoReportante',
      'averia.idAbonado',
      'averia.sectorComunidad',
      'averia.ubicacion',
      'averia.descripcion',
      'averia.estado',
      'averia.tipoAveria',
      'averia.prioridad',
      'averia.idFontaneroAsignado',
      'averia.fechaAsignacion',
      'averia.fechaInicioAtencion',
      'averia.fechaResolucion',
      'averia.observacionesAtencion',
      'fontanero.idUsuario',
      'fontanero.nombre',
    ])
    .where('averia.id = :id', { id });
}

@Injectable()
export class AveriasService {
  private readonly logger = new Logger(AveriasService.name);

  constructor(
    @InjectRepository(Averia)
    private readonly averiaRepository: Repository<Averia>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(ObservacionAveria)
    private readonly observacionRepositoryInjected?: Repository<ObservacionAveria>,
    private readonly validacionHorarioLaboral?: ValidacionHorarioLaboralFontaneroService,
    @Optional()
    private readonly notificacionesAverias?: NotificacionesAveriasService,
    @Optional()
    private readonly smsAverias?: SmsAveriasService,
  ) {}

  private async emitirEventosAveria(
    trabajo: () => Promise<void>,
  ): Promise<void> {
    try {
      await trabajo();
    } catch (error) {
      this.logger.error(
        'No se pudo registrar la notificación interna o el intento SMS',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async emitirSmsPorTransicionEstado(
    averia: Averia,
    estadoAnterior: EstadoAveria,
  ): Promise<void> {
    if (averia.estado === estadoAnterior) {
      return;
    }
    if (averia.estado === EstadoAveria.PENDIENTE) {
      await this.smsAverias?.prepararPendiente(averia);
    }
    if (averia.estado === EstadoAveria.RESUELTA) {
      await this.smsAverias?.prepararResuelta(averia);
    }
  }

  /**
   * Validación de horario para asignación e inicio de atención.
   * Usa el reloj del Backend; no acepta fecha/hora del Frontend.
   */
  evaluarHorarioLaboralFontanero(
    idFontanero: number,
  ): Promise<EvaluacionHorarioLaboral> {
    if (!this.validacionHorarioLaboral) {
      throw new InternalServerErrorException(
        'La validación de horario laboral no está disponible.',
      );
    }
    return this.validacionHorarioLaboral.evaluarAhora(idFontanero);
  }

  private async assertHorarioParaInicioAtencion(averia: Averia): Promise<void> {
    const idFontanero = averia.idFontaneroAsignado;
    if (idFontanero == null) {
      return;
    }
    const evaluacion = await this.evaluarHorarioLaboralFontanero(idFontanero);
    assertHorarioPermiteIniciarAtencion(evaluacion);
  }

  private getObservacionRepository(): Repository<ObservacionAveria> {
    return (
      this.observacionRepositoryInjected ??
      this.averiaRepository.manager.getRepository(ObservacionAveria)
    );
  }

  /**
   * Listado administrativo paginado. Filtros, orden y página se resuelven en SQL.
   * `descripcion` se devuelve completa: no hay regla aprobada de recorte.
   * `Usuario` solo expone identidad pública del Fontanero (`id` y `nombre`).
   */
  async findAllAdmin(
    query: QueryAveriasAdminDto,
  ): Promise<AveriasAdminListado> {
    try {
      return await withDbRetry(async () => {
        this.assertRangoFechasAdmin(query);

        const page = query.page ?? ADMIN_AVERIAS_PAGE_DEFAULT;
        const limit = query.limit ?? ADMIN_AVERIAS_LIMIT_DEFAULT;

        const qb = this.averiaRepository
          .createQueryBuilder('averia')
          .leftJoin('averia.fontaneroAsignado', 'fontanero')
          .select([
            'averia.id',
            'averia.codigoSeguimiento',
            'averia.fechaReporte',
            'averia.nombreReportante',
            'averia.sectorComunidad',
            'averia.ubicacion',
            'averia.descripcion',
            'averia.estado',
            'averia.tipoAveria',
            'averia.prioridad',
            'averia.idFontaneroAsignado',
            'fontanero.idUsuario',
            'fontanero.nombre',
          ]);

        const search = query.search?.trim();
        if (search) {
          const pattern = `%${escapeLikePattern(search)}%`;
          qb.andWhere(
            new Brackets((inner) => {
              inner
                .where(
                  'averia.codigoSeguimiento LIKE :search ESCAPE :likeEscape',
                )
                .orWhere(
                  'averia.nombreReportante LIKE :search ESCAPE :likeEscape',
                );
            }),
          );
          qb.setParameter('search', pattern);
          qb.setParameter('likeEscape', '\\');
        }

        if (query.estado) {
          qb.andWhere('averia.estado = :estado', { estado: query.estado });
        }

        if (query.prioridad === ADMIN_AVERIAS_PRIORIDAD_SIN_ASIGNAR) {
          qb.andWhere('averia.prioridad IS NULL');
        } else if (query.prioridad) {
          qb.andWhere('averia.prioridad = :prioridad', {
            prioridad: query.prioridad,
          });
        }

        if (query.tipo) {
          qb.andWhere('averia.tipoAveria = :tipo', { tipo: query.tipo });
        }

        if (query.fontaneroId !== undefined) {
          qb.andWhere('averia.idFontaneroAsignado = :fontaneroId', {
            fontaneroId: query.fontaneroId,
          });
        }

        if (query.fechaDesde) {
          qb.andWhere('averia.fechaReporte >= :fechaDesde', {
            fechaDesde: toStartOfUtcDay(query.fechaDesde),
          });
        }

        if (query.fechaHasta) {
          qb.andWhere('averia.fechaReporte < :fechaHastaExclusiva', {
            fechaHastaExclusiva: toStartOfNextUtcDay(query.fechaHasta),
          });
        }

        qb.orderBy('averia.fechaReporte', 'DESC').addOrderBy(
          'averia.id',
          'DESC',
        );

        qb.skip((page - 1) * limit).take(limit);

        const [rows, total] = await qb.getManyAndCount();

        return {
          data: rows.map(toAdminListItem),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 0,
        };
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Error inesperado al listar averías administrativas');
      throw new InternalServerErrorException(LISTADO_ERROR);
    }
  }

  /**
   * Fontaneros activos con rol persistido FONTANERO.
   */
  async listFontanerosAsignables(): Promise<AveriasAdminFontanerosListado> {
    try {
      return await withDbRetry(async () => {
        const rows = await this.usuarioRepository.find({
          relations: { rol: true },
          where: {
            activo: true,
            rol: { nombre: Role.FONTANERO },
          },
          order: { idUsuario: 'ASC' },
        });
        return {
          data: rows
            .filter((usuario) => usuarioEsFontaneroAsignable(usuario))
            .map((usuario) => ({
              id: usuario.idUsuario,
              nombre: usuario.nombre,
            })),
        };
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Error inesperado al listar fontaneros asignables');
      throw new InternalServerErrorException(FONTANEROS_ERROR);
    }
  }

  async updateEstado(
    id: number,
    dto: UpdateAveriaEstadoDto,
  ): Promise<AveriaAdminDetail> {
    return this.runAdminUpdate(
      'Error inesperado al actualizar el estado de una avería',
      async () => {
        const averia = await this.getAveriaForAdminUpdate(id);
        const estadoAnterior = averia.estado;
        assertTransicionEstadoAveria(averia.estado, dto.estado);
        if (averia.estado === dto.estado) {
          return toAdminDetail(averia);
        }
        assertEstadoAveriaCompatibleConFontanero(
          dto.estado,
          averia.idFontaneroAsignado,
        );
        if (dto.estado === EstadoAveria.EN_ATENCION) {
          await this.assertHorarioParaInicioAtencion(averia);
          registrarInicioAtencionExitoso(averia, ahoraDelSistema());
        } else {
          averia.estado = dto.estado;
        }
        const saved = await this.averiaRepository.save(averia);
        await this.emitirEventosAveria(async () => {
          await this.emitirSmsPorTransicionEstado(saved, estadoAnterior);
        });
        return toAdminDetail(saved);
      },
    );
  }

  async updatePrioridad(
    id: number,
    dto: UpdateAveriaPrioridadDto,
  ): Promise<AveriaAdminDetail> {
    return this.runAdminUpdate(
      'Error inesperado al actualizar la prioridad de una avería',
      async () => {
        const averia = await this.getAveriaForAdminUpdate(id);
        if (averia.prioridad === dto.prioridad) {
          return toAdminDetail(averia);
        }
        averia.prioridad = dto.prioridad;
        return toAdminDetail(await this.averiaRepository.save(averia));
      },
    );
  }

  async updateClasificacion(
    id: number,
    dto: UpdateAveriaClasificacionDto,
  ): Promise<AveriaAdminDetail> {
    return this.runAdminUpdate(
      'Error inesperado al actualizar la clasificación de una avería',
      async () => {
        const averia = await this.getAveriaForAdminUpdate(id);
        if (averia.tipoAveria === dto.clasificacion) {
          return toAdminDetail(averia);
        }
        averia.tipoAveria = dto.clasificacion;
        return toAdminDetail(await this.averiaRepository.save(averia));
      },
    );
  }

  /**
   * Asignación inicial al Fontanero (PBI 2.4 + 2.6.3).
   * Reutiliza transiciones de 2.3. Tras ASIGNADA valida el horario del
   * Backend: dentro de jornada permanece ASIGNADA; si no, pasa a PENDIENTE
   * sin soltar al Fontanero. No reasigna. El SMS de PENDIENTE se prepara
   * después del commit, sin envío real (2.8).
   */
  async assignFontanero(
    id: number,
    dto: AssignAveriaFontaneroDto,
  ): Promise<AveriaAsignacionResult> {
    return this.runAdminUpdate(
      'Error inesperado al asignar un fontanero a una avería',
      async () => {
        const resultado = await this.averiaRepository.manager.transaction(
          async (manager) => {
            const averia = await manager.findOne(Averia, { where: { id } });
            if (!averia) {
              throw new NotFoundException(AVERIA_ADMIN_NOT_FOUND);
            }
            if (averia.idFontaneroAsignado != null) {
              throw new BadRequestException(AVERIA_YA_ASIGNADA);
            }

            const usuario = await manager.findOne(Usuario, {
              where: { idUsuario: dto.fontaneroId },
              relations: { rol: true },
            });
            if (!usuario) {
              throw new NotFoundException(FONTANERO_ASIGNABLE_NOT_FOUND);
            }
            if (!usuario.activo) {
              throw new BadRequestException(FONTANERO_INACTIVO);
            }
            if (usuario.rol?.nombre !== Role.FONTANERO) {
              throw new BadRequestException(FONTANERO_ROL_INVALIDO);
            }

            assertTransicionEstadoAveria(averia.estado, EstadoAveria.ASIGNADA);

            averia.idFontaneroAsignado = usuario.idUsuario;
            averia.fontaneroAsignado = usuario;
            averia.fechaAsignacion = new Date();
            averia.estado = EstadoAveria.ASIGNADA;
            assertEstadoAveriaCompatibleConFontanero(
              averia.estado,
              averia.idFontaneroAsignado,
            );

            const evaluacion = await this.evaluarHorarioLaboralFontanero(
              usuario.idUsuario,
            );
            const estadoTrasHorario =
              estadoTrasValidarHorarioAsignacion(evaluacion);
            if (estadoTrasHorario !== EstadoAveria.ASIGNADA) {
              assertTransicionEstadoAveria(
                EstadoAveria.ASIGNADA,
                estadoTrasHorario,
              );
              averia.estado = estadoTrasHorario;
            }

            const persistida = await manager.save(averia);
            const notificacionPendiente =
              prepararEventoNotificacionHorarioAsignacion({
                idAveria: persistida.id,
                codigoSeguimiento: persistida.codigoSeguimiento,
                telefonoReportante: persistida.telefonoReportante,
                idFontanero: usuario.idUsuario,
                evaluacion,
              });
            if (notificacionPendiente) {
              this.logger.log(
                `Evento de notificación preparado (${notificacionPendiente.tipo}) para avería ${persistida.id}`,
              );
            }

            return {
              ...toAdminDetail(persistida),
              horarioLaboral: {
                resultado: evaluacion.resultado,
                dentroDeHorario: evaluacion.puedeIniciarAtencion,
                motivo: evaluacion.motivo,
              },
              notificacionPendiente,
            };
          },
        );

        await this.emitirEventosAveria(async () => {
          const persistida = await this.averiaRepository.findOne({
            where: { id: resultado.id },
          });
          if (!persistida) {
            return;
          }
          await this.notificacionesAverias?.notificarFontaneroAsignacion(
            persistida,
          );
          if (persistida.estado === EstadoAveria.PENDIENTE) {
            await this.smsAverias?.prepararPendiente(persistida);
          }
        });

        return resultado;
      },
    );
  }

  /**
   * Listado operativo del Fontanero autenticado.
   * Solo averías asignadas a él en Asignada, Pendiente de atención o En atención.
   */
  async findAllFontanero(
    user: AuthenticatedUser,
  ): Promise<AveriasFontaneroListado> {
    try {
      return await withDbRetry(async () => {
        const fontaneroId = resolveAuthenticatedUsuarioId(user);
        const rows = await this.averiaRepository
          .createQueryBuilder('averia')
          .select([
            'averia.id',
            'averia.codigoSeguimiento',
            'averia.fechaAsignacion',
            'averia.estado',
            'averia.sectorComunidad',
            'averia.ubicacion',
            'averia.descripcion',
            'averia.tipoAveria',
            'averia.prioridad',
            'averia.fechaInicioAtencion',
            'averia.idFontaneroAsignado',
          ])
          .where('averia.idFontaneroAsignado = :fontaneroId', { fontaneroId })
          .andWhere('averia.estado IN (:...estados)', {
            estados: [...ESTADOS_LISTADO_FONTANERO],
          })
          .orderBy('averia.fechaAsignacion', 'DESC')
          .addOrderBy('averia.id', 'DESC')
          .getMany();

        return { data: rows.map(toFontaneroListItem) };
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        'Error inesperado al consultar el listado de averías del Fontanero',
      );
      throw new InternalServerErrorException(LISTADO_ERROR);
    }
  }

  /**
   * Detalle de una avería asignada al Fontanero autenticado.
   * La identidad sale del JWT. No basta con conocer el ID.
   */
  async findOneFontanero(
    id: number,
    user: AuthenticatedUser,
  ): Promise<AveriaFontaneroDetail> {
    try {
      return await withDbRetry(async () => {
        const fontaneroId = resolveAuthenticatedUsuarioId(user);
        const averia = await buildFindOneFontaneroQuery(
          this.averiaRepository,
          id,
        ).getOne();

        if (!averia) {
          throw new NotFoundException(AVERIA_ADMIN_NOT_FOUND);
        }

        if (
          averia.idFontaneroAsignado == null ||
          Number(averia.idFontaneroAsignado) !== fontaneroId
        ) {
          throw new ForbiddenException(AVERIA_FONTANERO_FORBIDDEN);
        }

        const observaciones = await this.listObservacionesDeAveria(averia.id);
        return toFontaneroDetail(averia, observaciones);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        'Error inesperado al consultar el detalle de una avería para el Fontanero',
      );
      throw new InternalServerErrorException(DETALLE_ERROR);
    }
  }

  /**
   * Inserta una observación independiente. Relee la asignación en la misma
   * transacción para no honrar una consulta previa si hubo reasignación.
   */
  async createObservacionAveria(
    id: number,
    dto: CreateObservacionAveriaDto,
    user: AuthenticatedUser,
  ): Promise<CreateObservacionAveriaResponse> {
    try {
      return await withDbRetry(async () => {
        const fontaneroId = resolveAuthenticatedUsuarioId(user);
        return this.averiaRepository.manager.transaction(async (manager) => {
          const qb = manager
            .createQueryBuilder(Averia, 'averia')
            .where('averia.id = :id', { id });
          if (manager.connection.options.type === 'mssql') {
            qb.setLock('pessimistic_write');
          }

          const averia = await qb.getOne();
          if (!averia) {
            throw new NotFoundException(AVERIA_ADMIN_NOT_FOUND);
          }
          if (
            averia.idFontaneroAsignado == null ||
            Number(averia.idFontaneroAsignado) !== fontaneroId
          ) {
            throw new ForbiddenException(AVERIA_FONTANERO_FORBIDDEN);
          }

          const autor = await manager.findOne(Usuario, {
            where: { idUsuario: fontaneroId },
            select: { idUsuario: true, nombre: true },
          });
          if (!autor) {
            throw new ForbiddenException(AVERIA_FONTANERO_FORBIDDEN);
          }

          const row = manager.create(ObservacionAveria, {
            observacion: dto.observacion,
            idAveria: averia.id,
            idUsuarioAutor: autor.idUsuario,
          });
          const saved = await manager.save(row);
          const persisted =
            saved.fechaCreacion != null
              ? saved
              : await manager.findOneByOrFail(ObservacionAveria, {
                  id: saved.id,
                });

          return {
            message: OBSERVACION_AVERIA_REGISTRADA,
            data: {
              id: persisted.id,
              observacion: persisted.observacion,
              fechaCreacion: persisted.fechaCreacion,
              autor: {
                id: autor.idUsuario,
                nombre: autor.nombre,
              },
            },
          };
        });
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        'Error inesperado al registrar una observación de avería',
      );
      throw new InternalServerErrorException(OBSERVACION_ERROR);
    }
  }

  /**
   * Inicio de atención del Fontanero asignado.
   * Horario y fechaInicioAtencion se resuelven en el Backend.
   */
  async iniciarAtencion(
    id: number,
    user: AuthenticatedUser,
  ): Promise<AveriaFontaneroDetail> {
    try {
      return await withDbRetry(async () => {
        const fontaneroId = resolveAuthenticatedUsuarioId(user);
        const saved = await this.averiaRepository.manager.transaction(
          async (manager) => {
            const qb = manager
              .createQueryBuilder(Averia, 'averia')
              .leftJoinAndSelect('averia.fontaneroAsignado', 'fontanero')
              .where('averia.id = :id', { id });
            if (manager.connection.options.type === 'mssql') {
              qb.setLock('pessimistic_write');
            }

            const averia = await qb.getOne();
            if (!averia) {
              throw new NotFoundException(AVERIA_ADMIN_NOT_FOUND);
            }
            if (
              averia.idFontaneroAsignado == null ||
              Number(averia.idFontaneroAsignado) !== fontaneroId
            ) {
              throw new ForbiddenException(AVERIA_FONTANERO_FORBIDDEN);
            }

            assertTransicionEstadoAveria(
              averia.estado,
              EstadoAveria.EN_ATENCION,
            );
            if (averia.estado === EstadoAveria.EN_ATENCION) {
              return averia;
            }

            assertEstadoAveriaCompatibleConFontanero(
              EstadoAveria.EN_ATENCION,
              averia.idFontaneroAsignado,
            );
            await this.assertHorarioParaInicioAtencion(averia);
            registrarInicioAtencionExitoso(averia, ahoraDelSistema());
            return manager.save(averia);
          },
        );

        const observaciones = await this.listObservacionesDeAveria(saved.id);
        return toFontaneroDetail(saved, observaciones);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        'Error inesperado al iniciar la atención de una avería',
      );
      throw new InternalServerErrorException(INICIO_ATENCION_ERROR);
    }
  }

  /**
   * El Fontanero asignado califica prioridad (Baja / Media / Alta).
   */
  async updatePrioridadFontanero(
    id: number,
    dto: UpdateAveriaPrioridadFontaneroDto,
    user: AuthenticatedUser,
  ): Promise<AveriaFontaneroDetail> {
    return this.calificarAveriaFontanero(id, user, (averia) => {
      averia.prioridad = dto.prioridad;
    });
  }

  /**
   * El Fontanero asignado califica tipo (Tubo madre / Tubo medidor).
   */
  async updateClasificacionFontanero(
    id: number,
    dto: UpdateAveriaClasificacionFontaneroDto,
    user: AuthenticatedUser,
  ): Promise<AveriaFontaneroDetail> {
    return this.calificarAveriaFontanero(id, user, (averia) => {
      averia.tipoAveria = dto.clasificacion;
    });
  }

  private async calificarAveriaFontanero(
    id: number,
    user: AuthenticatedUser,
    apply: (averia: Averia) => void,
  ): Promise<AveriaFontaneroDetail> {
    try {
      return await withDbRetry(async () => {
        const fontaneroId = resolveAuthenticatedUsuarioId(user);
        const saved = await this.averiaRepository.manager.transaction(
          async (manager) => {
            const qb = manager
              .createQueryBuilder(Averia, 'averia')
              .leftJoinAndSelect('averia.fontaneroAsignado', 'fontanero')
              .where('averia.id = :id', { id });
            if (manager.connection.options.type === 'mssql') {
              qb.setLock('pessimistic_write');
            }

            const averia = await qb.getOne();
            if (!averia) {
              throw new NotFoundException(AVERIA_ADMIN_NOT_FOUND);
            }
            if (
              averia.idFontaneroAsignado == null ||
              Number(averia.idFontaneroAsignado) !== fontaneroId
            ) {
              throw new ForbiddenException(AVERIA_FONTANERO_FORBIDDEN);
            }
            if (
              averia.estado === EstadoAveria.RESUELTA ||
              averia.estado === EstadoAveria.CANCELADA
            ) {
              throw new BadRequestException(AVERIA_FONTANERO_YA_CERRADA);
            }

            apply(averia);
            return manager.save(averia);
          },
        );

        const observaciones = await this.listObservacionesDeAveria(saved.id);
        return toFontaneroDetail(saved, observaciones);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        'Error inesperado al calificar prioridad o tipo de una avería',
      );
      throw new InternalServerErrorException(ACTUALIZACION_ERROR);
    }
  }

  /**
   * Cierre operativo: En atención → Resuelta, con observación final.
   * Estado, fecha de resolución y autor no vienen del cliente.
   */
  async resolverAveria(
    id: number,
    dto: ResolverAveriaDto,
    user: AuthenticatedUser,
  ): Promise<ResolverAveriaResponse> {
    try {
      return await withDbRetry(async () => {
        const fontaneroId = resolveAuthenticatedUsuarioId(user);
        const saved = await this.averiaRepository.manager.transaction(
          async (manager) => {
            const qb = manager
              .createQueryBuilder(Averia, 'averia')
              .where('averia.id = :id', { id });
            if (manager.connection.options.type === 'mssql') {
              qb.setLock('pessimistic_write');
            }

            const averia = await qb.getOne();
            if (!averia) {
              throw new NotFoundException(AVERIA_ADMIN_NOT_FOUND);
            }
            if (
              averia.idFontaneroAsignado == null ||
              Number(averia.idFontaneroAsignado) !== fontaneroId
            ) {
              throw new ForbiddenException(AVERIA_FONTANERO_RESOLVER_FORBIDDEN);
            }
            if (averia.estado !== EstadoAveria.EN_ATENCION) {
              throw new BadRequestException(AVERIA_NO_EN_ATENCION);
            }

            assertTransicionEstadoAveria(averia.estado, EstadoAveria.RESUELTA);

            const autor = await manager.findOne(Usuario, {
              where: { idUsuario: fontaneroId },
              select: { idUsuario: true, nombre: true },
            });
            if (!autor) {
              throw new ForbiddenException(AVERIA_FONTANERO_RESOLVER_FORBIDDEN);
            }

            const observacion = manager.create(ObservacionAveria, {
              observacion: dto.observacionFinal,
              idAveria: averia.id,
              idUsuarioAutor: autor.idUsuario,
            });
            await manager.save(observacion);

            averia.estado = EstadoAveria.RESUELTA;
            averia.fechaResolucion = new Date();
            return manager.save(averia);
          },
        );

        await this.emitirEventosAveria(async () => {
          await this.smsAverias?.prepararResuelta(saved);
        });

        const observaciones = await this.listObservacionesDeAveria(saved.id);
        return {
          message: AVERIA_RESUELTA_OK,
          data: toFontaneroDetail(saved, observaciones),
        };
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        'Error inesperado al resolver una avería asignada al Fontanero',
      );
      throw new InternalServerErrorException(AVERIA_RESOLVER_ERROR);
    }
  }

  /**
   * Detalle administrativo por PK. LEFT JOIN de Fontanero para no perder
   * averías recién recibidas. No existe join de Abonado ni TipoAveria.
   */
  async findOneAdmin(id: number): Promise<AveriaAdminDetail> {
    try {
      return await withDbRetry(async () => {
        const averia = await buildFindOneAdminQuery(
          this.averiaRepository,
          id,
        ).getOne();

        if (!averia) {
          throw new NotFoundException(AVERIA_ADMIN_NOT_FOUND);
        }

        const observaciones = await this.listObservacionesDeAveria(averia.id);
        return toAdminDetail(averia, observaciones);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        'Error inesperado al consultar el detalle administrativo de una avería',
      );
      throw new InternalServerErrorException(DETALLE_ERROR);
    }
  }

  /**
   * Registro público de una avería. No exige JWT, Usuario ni Abonado.
   * `now` es inyectable para tests de año; el controller no lo expone.
   */
  async createPublicReport(
    dto: CreatePublicAveriaDto,
    now: Date = new Date(),
  ): Promise<RegistroPublicoAveriaResponseDto> {
    const year = now.getFullYear();
    let consecutive = await this.suggestNextConsecutive(year);

    for (
      let attempt = 1;
      attempt <= CODIGO_SEGUIMIENTO_MAX_RETRIES;
      attempt++
    ) {
      const codigoSeguimiento = buildCodigoSeguimiento(year, consecutive);
      const averia = this.buildPublicAveria(dto, codigoSeguimiento, now);

      try {
        const saved = await this.averiaRepository.save(averia);
        await this.emitirEventosAveria(async () => {
          await this.notificacionesAverias?.notificarAdministradorasNuevaAveria(
            saved,
          );
          await this.smsAverias?.prepararConfirmacionRegistro(saved);
        });
        return this.toPublicResponse(saved);
      } catch (error) {
        if (
          isCodigoSeguimientoUniqueViolation(error) &&
          attempt < CODIGO_SEGUIMIENTO_MAX_RETRIES
        ) {
          const suggested = await this.suggestNextConsecutive(year);
          consecutive = Math.max(consecutive + 1, suggested);
          continue;
        }

        if (isCodigoSeguimientoUniqueViolation(error)) {
          this.logger.error(
            `No se pudo generar un codigoSeguimiento único tras ${CODIGO_SEGUIMIENTO_MAX_RETRIES} intentos`,
          );
          throw new InternalServerErrorException(REGISTRO_ERROR);
        }

        if (error instanceof HttpException) {
          throw error;
        }

        this.logger.error(
          'Error inesperado al registrar una avería pública',
          error,
        );
        throw new InternalServerErrorException(REGISTRO_ERROR);
      }
    }

    throw new InternalServerErrorException(REGISTRO_ERROR);
  }

  private buildPublicAveria(
    dto: CreatePublicAveriaDto,
    codigoSeguimiento: string,
    fechaReporte: Date,
  ): Averia {
    return this.averiaRepository.create({
      codigoSeguimiento,
      fechaReporte,
      nombreReportante: dto.nombreReportante,
      identificacionReportante: dto.identificacionReportante ?? null,
      telefonoReportante: dto.telefonoReportante,
      correoReportante: dto.correoReportante ?? null,
      ubicacion: dto.ubicacion,
      sectorComunidad: dto.sectorComunidad,
      descripcion: dto.descripcion,
      estado: EstadoAveria.RECIBIDA,
      idAbonado: null,
      tipoAveria: null,
      prioridad: null,
      idFontaneroAsignado: null,
      fontaneroAsignado: null,
      fechaAsignacion: null,
      fechaInicioAtencion: null,
      fechaResolucion: null,
      observacionesAtencion: null,
    });
  }

  private async listObservacionesDeAveria(
    idAveria: number,
  ): Promise<AveriaObservacionItem[]> {
    const rows = await this.getObservacionRepository()
      .createQueryBuilder('obs')
      .innerJoin('obs.autor', 'autor')
      .select([
        'obs.id',
        'obs.observacion',
        'obs.fechaCreacion',
        'obs.idUsuarioAutor',
        'autor.idUsuario',
        'autor.nombre',
      ])
      .where('obs.idAveria = :idAveria', { idAveria })
      .orderBy('obs.fechaCreacion', 'ASC')
      .addOrderBy('obs.id', 'ASC')
      .getMany();

    return rows.map((row) => ({
      id: row.id,
      observacion: row.observacion,
      fechaCreacion: row.fechaCreacion,
      autor: {
        id: row.autor.idUsuario,
        nombre: row.autor.nombre,
      },
    }));
  }

  private async getAveriaForAdminUpdate(id: number): Promise<Averia> {
    const averia = await this.averiaRepository.findOne({
      where: { id },
      relations: { fontaneroAsignado: true },
    });
    if (!averia) {
      throw new NotFoundException(AVERIA_ADMIN_NOT_FOUND);
    }
    return averia;
  }

  private async runAdminUpdate<T extends AveriaAdminDetail>(
    logMessage: string,
    work: () => Promise<T>,
  ): Promise<T> {
    try {
      return await withDbRetry(work);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(logMessage);
      throw new InternalServerErrorException(ACTUALIZACION_ERROR);
    }
  }

  private toPublicResponse(averia: Averia): RegistroPublicoAveriaResponseDto {
    return {
      message: REGISTRO_OK,
      data: {
        codigoSeguimiento: averia.codigoSeguimiento,
        fechaReporte: averia.fechaReporte.toISOString(),
        estado: ESTADO_AVERIA_LABELS[averia.estado] ?? averia.estado,
      },
    };
  }

  private assertRangoFechasAdmin(query: QueryAveriasAdminDto): void {
    if (query.fechaDesde && !isValidIsoDateOnly(query.fechaDesde)) {
      throw new BadRequestException(FECHA_CALENDARIO_INVALIDA);
    }
    if (query.fechaHasta && !isValidIsoDateOnly(query.fechaHasta)) {
      throw new BadRequestException(FECHA_CALENDARIO_INVALIDA);
    }
    if (
      query.fechaDesde &&
      query.fechaHasta &&
      query.fechaDesde > query.fechaHasta
    ) {
      throw new BadRequestException(RANGO_FECHAS_INVALIDO);
    }
  }

  private async suggestNextConsecutive(year: number): Promise<number> {
    const prefix = `AV-${year}-`;
    const last = await this.averiaRepository
      .createQueryBuilder('averia')
      .select('averia.codigoSeguimiento', 'codigoSeguimiento')
      .where('averia.codigoSeguimiento LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('averia.codigoSeguimiento', 'DESC')
      .getRawOne<{ codigoSeguimiento?: string }>();

    const parsed = last?.codigoSeguimiento
      ? parseConsecutiveFromCodigo(last.codigoSeguimiento, year)
      : null;
    return (parsed ?? 0) + 1;
  }
}
