import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { TipoEventoHistorialRrhh } from '../../common/enums/tipo-evento-historial-rrhh.enum';
import { TipoMovimientoVacaciones } from '../../common/enums/tipo-movimiento-vacaciones.enum';
import {
  EventoHistorialColaboradorDto,
  HistorialColaboradorResponseDto,
} from './dto/historial-colaborador.dto';
import {
  HISTORIAL_LIMIT_DEFAULT,
  HISTORIAL_PAGE_DEFAULT,
  QueryHistorialColaboradorDto,
} from './dto/query-historial-colaborador.dto';
import { Colaborador } from './entities/colaborador.entity';
import { Incapacidad } from './entities/incapacidad.entity';
import { MovimientoVacaciones } from './entities/movimiento-vacaciones.entity';
import { PermisoColaborador } from './entities/permiso-colaborador.entity';
import {
  aFechaIso,
  compararFechasIso,
  esFechaCalendario,
} from './fecha-permiso';

const ORDEN_TIPO: Record<TipoEventoHistorialRrhh, number> = {
  [TipoEventoHistorialRrhh.INCAPACIDAD]: 0,
  [TipoEventoHistorialRrhh.PERMISO]: 1,
  [TipoEventoHistorialRrhh.VACACION]: 2,
};

@Injectable()
export class HistorialColaboradorService {
  private readonly logger = new Logger(HistorialColaboradorService.name);

  constructor(
    @InjectRepository(Colaborador)
    private readonly colaboradorRepository: Repository<Colaborador>,
    @InjectRepository(PermisoColaborador)
    private readonly permisoRepository: Repository<PermisoColaborador>,
    @InjectRepository(MovimientoVacaciones)
    private readonly vacacionesRepository: Repository<MovimientoVacaciones>,
    @InjectRepository(Incapacidad)
    private readonly incapacidadRepository: Repository<Incapacidad>,
  ) {}

  /**
   * Historial administrativo consolidado (solo lectura).
   *
   * Fecha cronológica por tipo:
   * - PERMISO → fechaInicio
   * - VACACION → fecha del movimiento
   * - INCAPACIDAD → fechaInicio
   *
   * Orden: fecha DESC, luego tipo (estable), luego id DESC.
   * Luego se pagina sobre el conjunto filtrado.
   */
  async getHistorialColaborador(
    colaboradorId: number,
    query: QueryHistorialColaboradorDto = {},
  ): Promise<HistorialColaboradorResponseDto> {
    const page = query.page ?? HISTORIAL_PAGE_DEFAULT;
    const limit = query.limit ?? HISTORIAL_LIMIT_DEFAULT;
    this.validarRangoFechas(query.fechaDesde, query.fechaHasta);

    const colaborador = await this.colaboradorRepository.findOne({
      where: { id: colaboradorId },
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        cedula: true,
        cargo: true,
      },
    });

    if (!colaborador) {
      throw new NotFoundException('No se encontró el colaborador solicitado.');
    }

    const incluirPermisos =
      !query.tipo || query.tipo === TipoEventoHistorialRrhh.PERMISO;
    const incluirVacaciones =
      !query.tipo || query.tipo === TipoEventoHistorialRrhh.VACACION;
    const incluirIncapacidades =
      !query.tipo || query.tipo === TipoEventoHistorialRrhh.INCAPACIDAD;

    const [permisos, vacaciones, incapacidades] = await Promise.all([
      incluirPermisos
        ? this.permisoRepository.find({
            where: this.wherePeriodo(
              colaboradorId,
              query.fechaDesde,
              query.fechaHasta,
            ),
            select: {
              id: true,
              colaboradorId: true,
              fechaInicio: true,
              fechaFin: true,
              motivo: true,
              observaciones: true,
            },
          })
        : Promise.resolve([] as PermisoColaborador[]),
      incluirVacaciones
        ? this.vacacionesRepository.find({
            where: this.whereFechaMovimiento(
              colaboradorId,
              query.fechaDesde,
              query.fechaHasta,
            ),
            select: {
              id: true,
              colaboradorId: true,
              tipo: true,
              cantidadDias: true,
              fecha: true,
              observaciones: true,
            },
          })
        : Promise.resolve([] as MovimientoVacaciones[]),
      incluirIncapacidades
        ? this.incapacidadRepository.find({
            where: this.wherePeriodo(
              colaboradorId,
              query.fechaDesde,
              query.fechaHasta,
            ),
            select: {
              id: true,
              colaboradorId: true,
              fechaInicio: true,
              fechaFin: true,
              observaciones: true,
            },
          })
        : Promise.resolve([] as Incapacidad[]),
    ]);

    let historialCompleto = [
      ...permisos.map((p) => this.mapPermiso(p)),
      ...vacaciones.map((v) => this.mapVacacion(v)),
      ...incapacidades.map((i) => this.mapIncapacidad(i)),
    ].sort(compararEventosHistorial);

    // Refuerzo sobre la fecha cronológica unificada (evento.fecha).
    if (query.fechaDesde) {
      historialCompleto = historialCompleto.filter(
        (evento) => evento.fecha >= query.fechaDesde!,
      );
    }
    if (query.fechaHasta) {
      historialCompleto = historialCompleto.filter(
        (evento) => evento.fecha <= query.fechaHasta!,
      );
    }

    const total = historialCompleto.length;
    const totalPages = Math.ceil(total / limit) || 0;
    const inicio = (page - 1) * limit;
    const historial = historialCompleto.slice(inicio, inicio + limit);

    this.logger.debug(
      `Historial colaborador ${colaboradorId}: total=${total} page=${page}/${totalPages}`,
    );

    return {
      colaborador: {
        id: colaborador.id,
        nombre: colaborador.nombre,
        apellidos: colaborador.apellidos,
        cedula: colaborador.cedula,
        cargo: colaborador.cargo,
      },
      historial,
      total,
      page,
      limit,
      totalPages,
    };
  }

  private validarRangoFechas(fechaDesde?: string, fechaHasta?: string): void {
    if (fechaDesde && !esFechaCalendario(fechaDesde)) {
      throw new BadRequestException('fechaDesde no es una fecha válida');
    }
    if (fechaHasta && !esFechaCalendario(fechaHasta)) {
      throw new BadRequestException('fechaHasta no es una fecha válida');
    }
    if (
      fechaDesde &&
      fechaHasta &&
      compararFechasIso(fechaDesde, fechaHasta) > 0
    ) {
      throw new BadRequestException(
        'La fecha inicial del filtro no puede ser posterior a la fecha final',
      );
    }
  }

  private wherePeriodo(
    colaboradorId: number,
    fechaDesde?: string,
    fechaHasta?: string,
  ): FindOptionsWhere<PermisoColaborador | Incapacidad> {
    if (fechaDesde && fechaHasta) {
      return {
        colaboradorId,
        fechaInicio: Between(fechaDesde, fechaHasta),
      };
    }
    if (fechaDesde) {
      return {
        colaboradorId,
        fechaInicio: MoreThanOrEqual(fechaDesde),
      };
    }
    if (fechaHasta) {
      return {
        colaboradorId,
        fechaInicio: LessThanOrEqual(fechaHasta),
      };
    }
    return { colaboradorId };
  }

  private whereFechaMovimiento(
    colaboradorId: number,
    fechaDesde?: string,
    fechaHasta?: string,
  ): FindOptionsWhere<MovimientoVacaciones> {
    if (fechaDesde && fechaHasta) {
      return { colaboradorId, fecha: Between(fechaDesde, fechaHasta) };
    }
    if (fechaDesde) {
      return { colaboradorId, fecha: MoreThanOrEqual(fechaDesde) };
    }
    if (fechaHasta) {
      return { colaboradorId, fecha: LessThanOrEqual(fechaHasta) };
    }
    return { colaboradorId };
  }

  private mapPermiso(
    permiso: PermisoColaborador,
  ): EventoHistorialColaboradorDto {
    const fechaInicio = aFechaIso(permiso.fechaInicio);
    const fechaFin = aFechaIso(permiso.fechaFin);
    return {
      id: permiso.id,
      tipo: TipoEventoHistorialRrhh.PERMISO,
      fecha: fechaInicio,
      fechaInicio,
      fechaFin,
      descripcion: permiso.motivo?.trim() || 'Permiso',
      motivo: permiso.motivo,
      observaciones: permiso.observaciones ?? null,
    };
  }

  private mapVacacion(
    movimiento: MovimientoVacaciones,
  ): EventoHistorialColaboradorDto {
    const fecha = aFechaIso(movimiento.fecha);
    const etiqueta =
      movimiento.tipo === TipoMovimientoVacaciones.ACUMULADO
        ? 'Acumulado'
        : 'Disfrutado';
    const obs = movimiento.observaciones?.trim();
    return {
      id: movimiento.id,
      tipo: TipoEventoHistorialRrhh.VACACION,
      fecha,
      fechaInicio: null,
      fechaFin: null,
      descripcion: obs
        ? `${etiqueta}: ${movimiento.cantidadDias} día(s). ${obs}`
        : `${etiqueta}: ${movimiento.cantidadDias} día(s)`,
      tipoMovimiento: movimiento.tipo,
      cantidadDias: movimiento.cantidadDias,
      observaciones: movimiento.observaciones ?? null,
    };
  }

  private mapIncapacidad(
    incapacidad: Incapacidad,
  ): EventoHistorialColaboradorDto {
    const fechaInicio = aFechaIso(incapacidad.fechaInicio);
    const fechaFin = aFechaIso(incapacidad.fechaFin);
    const obs = incapacidad.observaciones?.trim();
    return {
      id: incapacidad.id,
      tipo: TipoEventoHistorialRrhh.INCAPACIDAD,
      fecha: fechaInicio,
      fechaInicio,
      fechaFin,
      descripcion: obs || 'Incapacidad',
      observaciones: incapacidad.observaciones ?? null,
    };
  }
}

/** Más reciente primero; desempate estable por tipo e id. */
export function compararEventosHistorial(
  a: EventoHistorialColaboradorDto,
  b: EventoHistorialColaboradorDto,
): number {
  const porFecha = b.fecha.localeCompare(a.fecha);
  if (porFecha !== 0) return porFecha;
  const porTipo = ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo];
  if (porTipo !== 0) return porTipo;
  return b.id - a.id;
}
