import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePermisoColaboradorDto } from './dto/create-permiso-colaborador.dto';
import {
  PERMISOS_LIMIT_DEFAULT,
  PERMISOS_PAGE_DEFAULT,
  QueryPermisosColaboradorDto,
} from './dto/query-permisos-colaborador.dto';
import { UpdatePermisoColaboradorDto } from './dto/update-permiso-colaborador.dto';
import { Colaborador } from './entities/colaborador.entity';
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

  async create(dto: CreatePermisoColaboradorDto): Promise<PermisoColaborador> {
    await this.validarColaborador(dto.colaboradorId);
    this.validarRango(dto.fechaInicio, dto.fechaFin);

    const permiso = this.permisoRepository.create({
      colaboradorId: dto.colaboradorId,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      motivo: dto.motivo.trim(),
      observaciones: dto.observaciones ?? null,
    });

    const guardado = await this.permisoRepository.save(permiso);
    this.logger.log(
      `Permiso registrado: id=${guardado.id}, colaboradorId=${guardado.colaboradorId}`,
    );
    return this.findOne(guardado.id);
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
      throw new BadRequestException('La fecha de inicio no es una fecha válida');
    }
    if (!esFechaCalendario(fechaFin)) {
      throw new BadRequestException('La fecha de fin no es una fecha válida');
    }
    if (compararFechasIso(fechaInicio, fechaFin) > 0) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la fecha de inicio',
      );
    }
  }
}
