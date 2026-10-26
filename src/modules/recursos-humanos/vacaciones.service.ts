import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EstadoSolicitudAusencia } from '../../common/enums/estado-solicitud-ausencia.enum';
import {
  TIPOS_MOVIMIENTO_VACACIONES,
  TipoMovimientoVacaciones,
} from '../../common/enums/tipo-movimiento-vacaciones.enum';
import { SolicitudAusencia } from '../solicitudes-ausencia/entities/solicitud-ausencia.entity';
import { esFeriadoCostaRica } from '../solicitudes-ausencia/feriados-costa-rica';
import { rangosCalendarioSeSolapan } from '../solicitudes-ausencia/solape-ausencia.util';
import { CreateMovimientoVacacionesDto } from './dto/create-movimiento-vacaciones.dto';
import {
  MOVIMIENTOS_VACACIONES_LIMIT_DEFAULT,
  MOVIMIENTOS_VACACIONES_PAGE_DEFAULT,
  QueryMovimientosVacacionesDto,
} from './dto/query-movimientos-vacaciones.dto';
import { ColaboradoresService } from './colaboradores.service';
import { Colaborador } from './entities/colaborador.entity';
import { MovimientoVacaciones } from './entities/movimiento-vacaciones.entity';
import { PermisoColaborador } from './entities/permiso-colaborador.entity';
import { compararFechasIso, esFechaCalendario } from './fecha-permiso';
import { calcularSaldoVacaciones, SaldoVacaciones } from './saldo-vacaciones';

export type RegistrarMovimientoVacacionesInput =
  CreateMovimientoVacacionesDto & {
    signoAjuste?: 1 | -1 | null;
    registradoPorUsuarioId?: number | null;
  };

export type SaldoVacacionesColaborador = SaldoVacaciones & {
  colaboradorId: number;
  totalMovimientos: number;
};

export type ColaboradorResumen = Pick<
  Colaborador,
  'id' | 'nombre' | 'apellidos' | 'cedula' | 'cargo' | 'activo'
>;

/** Balance de vacaciones que se expone por el API. */
export type BalanceVacaciones = SaldoVacacionesColaborador & {
  colaborador: ColaboradorResumen;
};

export type MovimientosVacacionesListado = {
  data: MovimientoVacaciones[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/**
 * Historial y saldo de vacaciones por colaborador.
 * Los movimientos son inmutables: para corregir se registra otro movimiento.
 */
@Injectable()
export class VacacionesService {
  private readonly logger = new Logger(VacacionesService.name);

  constructor(
    @InjectRepository(MovimientoVacaciones)
    private readonly movimientoRepository: Repository<MovimientoVacaciones>,
    @InjectRepository(Colaborador)
    private readonly colaboradorRepository: Repository<Colaborador>,
    private readonly colaboradoresService: ColaboradoresService,
  ) {}

  /**
   * Registra ACUMULADO, DISFRUTADO o AJUSTE.
   * DISFRUTADO / AJUSTE negativo no pueden dejar el saldo en negativo.
   */
  async registrarMovimiento(
    input: RegistrarMovimientoVacacionesInput,
    managerExterno?: EntityManager,
  ): Promise<MovimientoVacaciones> {
    this.validarTipo(input.tipo);
    this.validarCantidadDias(input.cantidadDias);
    this.validarFecha(input.fecha);
    if (input.tipo === TipoMovimientoVacaciones.AJUSTE) {
      if (input.signoAjuste !== 1 && input.signoAjuste !== -1) {
        throw new BadRequestException(
          'Un AJUSTE requiere signoAjuste 1 (suma) o -1 (resta)',
        );
      }
      if (!input.observaciones?.trim()) {
        throw new BadRequestException('Un AJUSTE requiere motivo');
      }
      if (
        input.registradoPorUsuarioId == null ||
        !Number.isInteger(input.registradoPorUsuarioId)
      ) {
        throw new BadRequestException(
          'Un AJUSTE requiere el usuario responsable del registro',
        );
      }
    }

    const ejecutar = async (manager: EntityManager) => {
      await this.validarColaboradorExiste(
        input.colaboradorId,
        manager,
        BadRequestException,
      );

      const saldo = await this.obtenerSaldo(input.colaboradorId, manager);
      if (input.tipo === TipoMovimientoVacaciones.DISFRUTADO) {
        if (esFeriadoCostaRica(input.fecha)) {
          throw new BadRequestException(
            'La fecha de disfrute no puede ser un feriado',
          );
        }
        if (input.cantidadDias > saldo.diasDisponibles) {
          throw new BadRequestException(
            `El colaborador no tiene saldo suficiente de vacaciones: dispone de ${saldo.diasDisponibles} día(s) y se intentan disfrutar ${input.cantidadDias}`,
          );
        }
        const solicitudes = await manager.getRepository(SolicitudAusencia).find({
          where: {
            colaboradorId: input.colaboradorId,
            estado: EstadoSolicitudAusencia.PENDIENTE,
          },
        });
        if (
          solicitudes.some((item) =>
            rangosCalendarioSeSolapan(
              input.fecha,
              input.fecha,
              item.fechaInicio,
              item.fechaFin,
            ),
          )
        ) {
          throw new ConflictException(
            'Hay una solicitud de ausencia pendiente en esa fecha',
          );
        }
        const permisos = await manager
          .getRepository(PermisoColaborador)
          .find({ where: { colaboradorId: input.colaboradorId } });
        if (
          permisos.some((item) =>
            rangosCalendarioSeSolapan(
              input.fecha,
              input.fecha,
              item.fechaInicio,
              item.fechaFin,
            ),
          )
        ) {
          throw new ConflictException(
            'Ya existe un permiso registrado en esa fecha',
          );
        }
        const disfrutados = await manager.getRepository(MovimientoVacaciones).find({
          where: {
            colaboradorId: input.colaboradorId,
            tipo: TipoMovimientoVacaciones.DISFRUTADO,
          },
        });
        if (disfrutados.some((item) => item.fecha === input.fecha)) {
          throw new ConflictException(
            'Ya existe un disfrute de vacaciones en esa fecha',
          );
        }
      }
      if (
        input.tipo === TipoMovimientoVacaciones.AJUSTE &&
        input.signoAjuste === -1 &&
        input.cantidadDias > saldo.diasDisponibles
      ) {
        throw new BadRequestException(
          `El ajuste dejaría el saldo negativo: dispone de ${saldo.diasDisponibles} día(s)`,
        );
      }

      const repo = manager.getRepository(MovimientoVacaciones);
      const movimiento = repo.create({
        colaboradorId: input.colaboradorId,
        tipo: input.tipo,
        cantidadDias: input.cantidadDias,
        signoAjuste:
          input.tipo === TipoMovimientoVacaciones.AJUSTE
            ? input.signoAjuste!
            : null,
        fecha: input.fecha,
        observaciones: input.observaciones ?? null,
        registradoPorUsuarioId: input.registradoPorUsuarioId ?? null,
      });
      return repo.save(movimiento);
    };

    const guardado = managerExterno
      ? await ejecutar(managerExterno)
      : await this.movimientoRepository.manager.transaction(ejecutar);

    this.logger.log(
      `Movimiento de vacaciones registrado: id=${guardado.id}, colaboradorId=${guardado.colaboradorId}, tipo=${guardado.tipo}, dias=${guardado.cantidadDias}`,
    );
    return managerExterno ? guardado : this.findOne(guardado.id);
  }

  async findOne(id: number): Promise<MovimientoVacaciones> {
    const movimiento = await this.movimientoRepository.findOne({
      where: { id },
      relations: { colaborador: true },
    });
    if (!movimiento) {
      throw new NotFoundException(
        `No existe un movimiento de vacaciones con id ${id}`,
      );
    }
    return movimiento;
  }

  /**
   * Historial paginado. Permite filtrar por colaborador, tipo y rango de
   * fechas del movimiento. Orden: fecha descendente, luego id descendente.
   */
  async findAll(
    query: QueryMovimientosVacacionesDto,
  ): Promise<MovimientosVacacionesListado> {
    const page = query.page ?? MOVIMIENTOS_VACACIONES_PAGE_DEFAULT;
    const limit = query.limit ?? MOVIMIENTOS_VACACIONES_LIMIT_DEFAULT;

    if (query.fechaInicio && !esFechaCalendario(query.fechaInicio)) {
      throw new BadRequestException('fechaInicio no es una fecha válida');
    }
    if (query.fechaFin && !esFechaCalendario(query.fechaFin)) {
      throw new BadRequestException('fechaFin no es una fecha válida');
    }
    if (
      query.fechaInicio &&
      query.fechaFin &&
      compararFechasIso(query.fechaInicio, query.fechaFin) > 0
    ) {
      throw new BadRequestException(
        'La fecha inicial del filtro no puede ser posterior a la fecha final',
      );
    }

    const qb = this.movimientoRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.colaborador', 'c');

    if (query.colaboradorId !== undefined) {
      qb.andWhere('m.colaboradorId = :colaboradorId', {
        colaboradorId: query.colaboradorId,
      });
    }
    if (query.tipo !== undefined) {
      qb.andWhere('m.tipo = :tipo', { tipo: query.tipo });
    }
    if (query.fechaInicio) {
      qb.andWhere('m.fecha >= :fechaInicio', {
        fechaInicio: query.fechaInicio,
      });
    }
    if (query.fechaFin) {
      qb.andWhere('m.fecha <= :fechaFin', { fechaFin: query.fechaFin });
    }

    qb.orderBy('m.fecha', 'DESC')
      .addOrderBy('m.id', 'DESC')
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

  /** Historial completo del colaborador, del más reciente al más antiguo. */
  async historial(colaboradorId: number): Promise<MovimientoVacaciones[]> {
    await this.validarColaboradorExiste(colaboradorId);
    return this.movimientoRepository.find({
      where: { colaboradorId },
      order: { fecha: 'DESC', id: 'DESC' },
    });
  }

  /**
   * Balance que se expone por el API: saldo derivado del historial más un
   * resumen del colaborador. 404 si el colaborador no existe.
   */
  async obtenerBalance(colaboradorId: number): Promise<BalanceVacaciones> {
    const colaborador = await this.colaboradorRepository.findOne({
      where: { id: colaboradorId },
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        cedula: true,
        cargo: true,
        activo: true,
      },
    });
    if (!colaborador) {
      throw new NotFoundException(
        `El colaborador con id ${colaboradorId} no existe`,
      );
    }

    const saldo = await this.obtenerSaldo(colaboradorId);
    return {
      ...saldo,
      colaborador: {
        id: colaborador.id,
        nombre: colaborador.nombre,
        apellidos: colaborador.apellidos,
        cedula: colaborador.cedula,
        cargo: colaborador.cargo,
        activo: colaborador.activo,
      },
    };
  }

  async calcularSaldo(
    colaboradorId: number,
  ): Promise<SaldoVacacionesColaborador> {
    await this.validarColaboradorExiste(colaboradorId);
    return this.obtenerSaldo(colaboradorId);
  }

  async obtenerBalancePorUsuarioId(
    usuarioId: number,
  ): Promise<BalanceVacaciones> {
    const colaborador =
      await this.colaboradoresService.resolverActivoPorUsuarioId(usuarioId);
    if (!colaborador) {
      throw new ForbiddenException(
        'No hay un colaborador activo vinculado a su cuenta',
      );
    }
    return this.obtenerBalance(colaborador.id);
  }

  private async obtenerSaldo(
    colaboradorId: number,
    manager: EntityManager = this.movimientoRepository.manager,
  ): Promise<SaldoVacacionesColaborador> {
    const movimientos = await manager.getRepository(MovimientoVacaciones).find({
      where: { colaboradorId },
      select: {
        id: true,
        tipo: true,
        cantidadDias: true,
        signoAjuste: true,
      },
    });

    return {
      colaboradorId,
      totalMovimientos: movimientos.length,
      ...calcularSaldoVacaciones(movimientos),
    };
  }

  private async validarColaboradorExiste(
    colaboradorId: number,
    manager: EntityManager = this.colaboradorRepository.manager,
    Excepcion:
      typeof BadRequestException | typeof NotFoundException = NotFoundException,
  ): Promise<void> {
    const existe = await manager
      .getRepository(Colaborador)
      .exists({ where: { id: colaboradorId } });
    if (!existe) {
      throw new Excepcion(`El colaborador con id ${colaboradorId} no existe`);
    }
  }

  private validarTipo(tipo: TipoMovimientoVacaciones): void {
    if (!TIPOS_MOVIMIENTO_VACACIONES.includes(tipo)) {
      throw new BadRequestException(
        `El tipo de movimiento debe ser ${TIPOS_MOVIMIENTO_VACACIONES.join(' o ')}`,
      );
    }
  }

  private validarCantidadDias(cantidadDias: number): void {
    if (!Number.isInteger(cantidadDias) || cantidadDias <= 0) {
      throw new BadRequestException(
        'La cantidad de días debe ser un entero mayor a cero',
      );
    }
  }

  private validarFecha(fecha: string): void {
    if (!esFechaCalendario(fecha)) {
      throw new BadRequestException('La fecha no es una fecha válida');
    }
  }
}
