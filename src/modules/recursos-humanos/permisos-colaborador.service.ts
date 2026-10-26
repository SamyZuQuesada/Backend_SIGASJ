import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EstadoSolicitudAusencia } from '../../common/enums/estado-solicitud-ausencia.enum';
import { TipoMovimientoVacaciones } from '../../common/enums/tipo-movimiento-vacaciones.enum';
import { SolicitudAusencia } from '../solicitudes-ausencia/entities/solicitud-ausencia.entity';
import {
  diasAusenciaSinFeriados,
  esFeriadoCostaRica,
} from '../solicitudes-ausencia/feriados-costa-rica';
import { rangosCalendarioSeSolapan } from '../solicitudes-ausencia/solape-ausencia.util';
import { CreatePermisoColaboradorDto } from './dto/create-permiso-colaborador.dto';
import {
  PERMISOS_LIMIT_DEFAULT,
  PERMISOS_PAGE_DEFAULT,
  QueryPermisosColaboradorDto,
} from './dto/query-permisos-colaborador.dto';
import { UpdatePermisoColaboradorDto } from './dto/update-permiso-colaborador.dto';
import { Colaborador } from './entities/colaborador.entity';
import { MovimientoVacaciones } from './entities/movimiento-vacaciones.entity';
import { PermisoColaborador } from './entities/permiso-colaborador.entity';
import { compararFechasIso, esFechaCalendario } from './fecha-permiso';

export type PermisosColaboradorListado = {
  data: PermisoColaborador[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

@Injectable()
export class PermisosColaboradorService {
  private readonly logger = new Logger(PermisosColaboradorService.name);

  constructor(
    @InjectRepository(PermisoColaborador)
    private readonly permisoRepository: Repository<PermisoColaborador>,
    @InjectRepository(Colaborador)
    private readonly colaboradorRepository: Repository<Colaborador>,
  ) {}

  async create(
    dto: CreatePermisoColaboradorDto,
    managerExterno?: EntityManager,
  ): Promise<PermisoColaborador> {
    this.validarRango(dto.fechaInicio, dto.fechaFin);

    const ejecutar = async (manager: EntityManager) => {
      const colaboradorRepo = manager.getRepository(Colaborador);
      const existe = await colaboradorRepo.exists({
        where: { id: dto.colaboradorId },
      });
      if (!existe) {
        throw new BadRequestException(
          `El colaborador con id ${dto.colaboradorId} no existe`,
        );
      }

      const permisoRepo = manager.getRepository(PermisoColaborador);
      await this.assertSinSolape(
        manager,
        dto.colaboradorId,
        dto.fechaInicio,
        dto.fechaFin,
      );
      const permiso = permisoRepo.create({
        colaboradorId: dto.colaboradorId,
        fechaInicio: dto.fechaInicio,
        fechaFin: dto.fechaFin,
        motivo: dto.motivo.trim(),
        observaciones: dto.observaciones ?? null,
      });
      return permisoRepo.save(permiso);
    };

    const guardado = managerExterno
      ? await ejecutar(managerExterno)
      : await this.permisoRepository.manager.transaction(ejecutar);

    this.logger.log(
      `Permiso registrado: id=${guardado.id}, colaboradorId=${guardado.colaboradorId}`,
    );
    return managerExterno ? guardado : this.findOne(guardado.id);
  }

  async findAll(
    query: QueryPermisosColaboradorDto,
  ): Promise<PermisosColaboradorListado> {
    const page = query.page ?? PERMISOS_PAGE_DEFAULT;
    const limit = query.limit ?? PERMISOS_LIMIT_DEFAULT;

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

    const qb = this.permisoRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.colaborador', 'c');

    if (query.colaboradorId !== undefined) {
      qb.andWhere('p.colaboradorId = :colaboradorId', {
        colaboradorId: query.colaboradorId,
      });
    }

    if (query.fechaInicio) {
      qb.andWhere('p.fechaFin >= :fechaInicio', {
        fechaInicio: query.fechaInicio,
      });
    }

    if (query.fechaFin) {
      qb.andWhere('p.fechaInicio <= :fechaFin', {
        fechaFin: query.fechaFin,
      });
    }

    qb.orderBy('p.fechaInicio', 'DESC')
      .addOrderBy('p.id', 'DESC')
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

  async findOne(id: number): Promise<PermisoColaborador> {
    const permiso = await this.permisoRepository.findOne({
      where: { id },
      relations: { colaborador: true },
    });
    if (!permiso) {
      throw new NotFoundException(`No existe un permiso con id ${id}`);
    }
    return permiso;
  }

  async update(
    id: number,
    dto: UpdatePermisoColaboradorDto,
  ): Promise<PermisoColaborador> {
    const cambios = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (cambios.length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para actualizar',
      );
    }

    const permiso = await this.obtenerPorId(id);

    if (dto.colaboradorId !== undefined) {
      await this.validarColaborador(dto.colaboradorId);
      permiso.colaboradorId = dto.colaboradorId;
    }

    if (dto.fechaInicio !== undefined) {
      permiso.fechaInicio = dto.fechaInicio;
    }
    if (dto.fechaFin !== undefined) {
      permiso.fechaFin = dto.fechaFin;
    }
    this.validarRango(permiso.fechaInicio, permiso.fechaFin);
    await this.assertSinSolape(
      this.permisoRepository.manager,
      permiso.colaboradorId,
      permiso.fechaInicio,
      permiso.fechaFin,
      permiso.id,
    );

    if (dto.motivo !== undefined) {
      permiso.motivo = dto.motivo;
    }
    if (dto.observaciones !== undefined) {
      permiso.observaciones = dto.observaciones;
    }

    await this.permisoRepository.save(permiso);
    this.logger.log(`Permiso actualizado: id=${id}`);
    return this.findOne(id);
  }

  private async obtenerPorId(id: number): Promise<PermisoColaborador> {
    const permiso = await this.permisoRepository.findOneBy({ id });
    if (!permiso) {
      throw new NotFoundException(`No existe un permiso con id ${id}`);
    }
    return permiso;
  }

  private async validarColaborador(colaboradorId: number): Promise<void> {
    const existe = await this.colaboradorRepository.exists({
      where: { id: colaboradorId },
    });
    if (!existe) {
      throw new BadRequestException(
        `El colaborador con id ${colaboradorId} no existe`,
      );
    }
  }

  private validarRango(fechaInicio: string, fechaFin: string): void {
    if (!esFechaCalendario(fechaInicio)) {
      throw new BadRequestException(
        'La fecha de inicio no es una fecha válida',
      );
    }
    if (!esFechaCalendario(fechaFin)) {
      throw new BadRequestException('La fecha de fin no es una fecha válida');
    }
    if (compararFechasIso(fechaInicio, fechaFin) > 0) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la fecha de inicio',
      );
    }
    if (esFeriadoCostaRica(fechaInicio)) {
      throw new BadRequestException(
        'La fecha de inicio no puede ser un feriado',
      );
    }
    if (esFeriadoCostaRica(fechaFin)) {
      throw new BadRequestException('La fecha de fin no puede ser un feriado');
    }
    if (diasAusenciaSinFeriados(fechaInicio, fechaFin) < 1) {
      throw new BadRequestException(
        'El periodo no incluye días hábiles: solo hay feriados en ese rango',
      );
    }
  }

  private async assertSinSolape(
    manager: EntityManager,
    colaboradorId: number,
    fechaInicio: string,
    fechaFin: string,
    excluirPermisoId?: number,
  ): Promise<void> {
    const permisos = await manager.getRepository(PermisoColaborador).find({
      where: { colaboradorId },
    });
    if (
      permisos.some(
        (item) =>
          item.id !== excluirPermisoId &&
          rangosCalendarioSeSolapan(
            fechaInicio,
            fechaFin,
            item.fechaInicio,
            item.fechaFin,
          ),
      )
    ) {
      throw new ConflictException(
        'Ya existe un permiso registrado en ese periodo',
      );
    }

    const pendientes = await manager.getRepository(SolicitudAusencia).find({
      where: {
        colaboradorId,
        estado: EstadoSolicitudAusencia.PENDIENTE,
      },
    });
    if (
      pendientes.some((item) =>
        rangosCalendarioSeSolapan(
          fechaInicio,
          fechaFin,
          item.fechaInicio,
          item.fechaFin,
        ),
      )
    ) {
      throw new ConflictException(
        'Hay una solicitud de ausencia pendiente en ese periodo',
      );
    }

    const movimientos = await manager.getRepository(MovimientoVacaciones).find({
      where: {
        colaboradorId,
        tipo: TipoMovimientoVacaciones.DISFRUTADO,
      },
    });
    if (
      movimientos.some(
        (item) => item.fecha >= fechaInicio && item.fecha <= fechaFin,
      )
    ) {
      throw new ConflictException(
        'Ya existe un disfrute de vacaciones en ese periodo',
      );
    }
  }
}
