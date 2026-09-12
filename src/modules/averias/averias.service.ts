import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import {
  ESTADO_AVERIA_LABELS,
  EstadoAveria,
} from '../../common/enums/estado-averia.enum';
import { withDbRetry } from '../../common/persistence/with-db-retry';
import {
  ADMIN_AVERIAS_LIMIT_DEFAULT,
  ADMIN_AVERIAS_PAGE_DEFAULT,
  ADMIN_AVERIAS_PRIORIDAD_SIN_ASIGNAR,
  QueryAveriasAdminDto,
} from './dto/query-averias-admin.dto';
import { CreatePublicAveriaDto } from './dto/create-public-averia.dto';
import { RegistroPublicoAveriaResponseDto } from './dto/registro-publico-averia-response.dto';
import {
  buildCodigoSeguimiento,
  CODIGO_SEGUIMIENTO_MAX_RETRIES,
  isCodigoSeguimientoUniqueViolation,
  parseConsecutiveFromCodigo,
} from './averias.codigo-seguimiento';
import { Averia } from './entities/averia.entity';

const REGISTRO_OK = 'Avería registrada correctamente.';
const REGISTRO_ERROR = 'No se pudo registrar la avería. Intente nuevamente.';
const LISTADO_ERROR = 'No se pudieron consultar las averías';
const DETALLE_ERROR = 'No se pudo consultar la avería';
export const AVERIA_ADMIN_NOT_FOUND = 'No se encontró la avería solicitada.';
const RANGO_FECHAS_INVALIDO = 'fechaDesde no puede ser posterior a fechaHasta';
const FECHA_CALENDARIO_INVALIDA =
  'fechaDesde y fechaHasta deben ser una fecha calendario válida (YYYY-MM-DD)';

export type AveriaAdminFontanero = {
  id: number;
};

/** Identificador básico. No existe entidad Abonado; solo se persiste idAbonado. */
export type AveriaAdminAbonado = {
  id: number;
};

/**
 * Detalle administrativo. Campos planos, mismos nombres que el listado.
 * Abonado y Fontanero no tienen nombre en el modelo actual.
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
    fontanero:
      averia.idFontaneroAsignado != null
        ? { id: averia.idFontaneroAsignado }
        : null,
  };
}

export function toAdminDetail(averia: Averia): AveriaAdminDetail {
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
    fontanero:
      averia.idFontaneroAsignado != null
        ? { id: averia.idFontaneroAsignado }
        : null,
    fechaAsignacion: averia.fechaAsignacion ?? null,
    fechaInicioAtencion: averia.fechaInicioAtencion ?? null,
    fechaResolucion: averia.fechaResolucion ?? null,
    observacionesAtencion: averia.observacionesAtencion ?? null,
  };
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
    ])
    .where('averia.id = :id', { id });
}

@Injectable()
export class AveriasService {
  private readonly logger = new Logger(AveriasService.name);

  constructor(
    @InjectRepository(Averia)
    private readonly averiaRepository: Repository<Averia>,
  ) {}

  /**
   * Listado administrativo paginado. Filtros, orden y página se resuelven en SQL.
   * `descripcion` se devuelve completa: no hay regla aprobada de recorte.
   * `Usuario` solo expone `idUsuario`; el Fontanero del listado es `{ id }` o null.
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

        return toAdminDetail(averia);
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
