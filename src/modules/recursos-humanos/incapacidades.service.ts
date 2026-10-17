import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateIncapacidadDto } from './dto/create-incapacidad.dto';
import {
  INCAPACIDADES_LIMIT_DEFAULT,
  INCAPACIDADES_PAGE_DEFAULT,
  QueryIncapacidadesDto,
} from './dto/query-incapacidades.dto';
import { UpdateIncapacidadDto } from './dto/update-incapacidad.dto';
import { Colaborador } from './entities/colaborador.entity';
import { Incapacidad } from './entities/incapacidad.entity';
import { compararFechasIso, esFechaCalendario } from './fecha-permiso';

export type IncapacidadesListado = {
  data: Incapacidad[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

@Injectable()
export class IncapacidadesService {
  private readonly logger = new Logger(IncapacidadesService.name);

  constructor(
    @InjectRepository(Incapacidad)
    private readonly incapacidadRepository: Repository<Incapacidad>,
    @InjectRepository(Colaborador)
    private readonly colaboradorRepository: Repository<Colaborador>,
  ) {}

  async create(dto: CreateIncapacidadDto): Promise<Incapacidad> {
    await this.validarColaborador(dto.colaboradorId);
    this.validarRango(dto.fechaInicio, dto.fechaFin);

    const incapacidad = this.incapacidadRepository.create({
      colaboradorId: dto.colaboradorId,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      observaciones: dto.observaciones ?? null,
    });

    const guardada = await this.incapacidadRepository.save(incapacidad);
    this.logger.log(
      `Incapacidad registrada: id=${guardada.id}, colaboradorId=${guardada.colaboradorId}`,
    );
    return this.findOne(guardada.id);
  }

  async findAll(query: QueryIncapacidadesDto): Promise<IncapacidadesListado> {
    const page = query.page ?? INCAPACIDADES_PAGE_DEFAULT;
    const limit = query.limit ?? INCAPACIDADES_LIMIT_DEFAULT;

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

    const qb = this.incapacidadRepository
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.colaborador', 'c');

    if (query.colaboradorId !== undefined) {
      qb.andWhere('i.colaboradorId = :colaboradorId', {
        colaboradorId: query.colaboradorId,
      });
    }

    if (query.fechaInicio) {
      qb.andWhere('i.fechaFin >= :fechaInicio', {
        fechaInicio: query.fechaInicio,
      });
    }

    if (query.fechaFin) {
      qb.andWhere('i.fechaInicio <= :fechaFin', {
        fechaFin: query.fechaFin,
      });
    }

    qb.orderBy('i.fechaInicio', 'DESC')
      .addOrderBy('i.id', 'DESC')
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

  async findOne(id: number): Promise<Incapacidad> {
    const incapacidad = await this.incapacidadRepository.findOne({
      where: { id },
      relations: { colaborador: true },
    });
    if (!incapacidad) {
      throw new NotFoundException('No se encontró la incapacidad solicitada.');
    }
    return incapacidad;
  }

  async update(id: number, dto: UpdateIncapacidadDto): Promise<Incapacidad> {
    const cambios = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (cambios.length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para actualizar',
      );
    }

    const incapacidad = await this.obtenerPorId(id);

    const fechaInicio =
      dto.fechaInicio !== undefined ? dto.fechaInicio : incapacidad.fechaInicio;
    const fechaFin =
      dto.fechaFin !== undefined ? dto.fechaFin : incapacidad.fechaFin;
    this.validarRango(fechaInicio, fechaFin);

    if (dto.colaboradorId !== undefined) {
      await this.validarColaborador(dto.colaboradorId);
      incapacidad.colaboradorId = dto.colaboradorId;
    }

    incapacidad.fechaInicio = fechaInicio;
    incapacidad.fechaFin = fechaFin;

    if (dto.observaciones !== undefined) {
      incapacidad.observaciones = dto.observaciones;
    }

    await this.incapacidadRepository.save(incapacidad);
    this.logger.log(`Incapacidad actualizada: id=${id}`);
    return this.findOne(id);
  }

  private async obtenerPorId(id: number): Promise<Incapacidad> {
    const incapacidad = await this.incapacidadRepository.findOneBy({ id });
    if (!incapacidad) {
      throw new NotFoundException('No se encontró la incapacidad solicitada.');
    }
    return incapacidad;
  }

  private async validarColaborador(colaboradorId: number): Promise<void> {
    const existe = await this.colaboradorRepository.exists({
      where: { id: colaboradorId },
    });
    if (!existe) {
      throw new NotFoundException('No se encontró el colaborador solicitado.');
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
        'La fecha final no puede ser anterior a la fecha inicial.',
      );
    }
  }
}
