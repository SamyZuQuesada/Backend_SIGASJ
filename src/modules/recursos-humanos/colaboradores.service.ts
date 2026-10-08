import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Not, Repository, WhereExpressionBuilder } from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  CreateColaboradorDto,
  normalizarCedula,
} from './dto/create-colaborador.dto';
import {
  COLABORADORES_LIMIT_DEFAULT,
  COLABORADORES_PAGE_DEFAULT,
  QueryColaboradoresDto,
} from './dto/query-colaboradores.dto';
import { UpdateColaboradorDto } from './dto/update-colaborador.dto';
import { Colaborador } from './entities/colaborador.entity';

export type ColaboradoresListado = {
  data: Colaborador[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const escaparLike = (valor: string): string =>
  valor.replace(/[\\%_[\]]/g, '\\$&');

const patronLike = (valor: string): string => `%${escaparLike(valor)}%`;

const sinGuiones = (valor: string): string => valor.replace(/[-\s]/g, '');

const esViolacionUnicidad = (error: unknown): boolean => {
  const e = error as { number?: number; code?: string; message?: string };
  return (
    e?.number === 2601 ||
    e?.number === 2627 ||
    e?.code === '23505' ||
    e?.code === 'SQLITE_CONSTRAINT' ||
    (typeof e?.message === 'string' &&
      (e.message.includes('UQ_') || e.message.includes('UNIQUE')))
  );
};

@Injectable()
export class ColaboradoresService {
  private readonly logger = new Logger(ColaboradoresService.name);

  constructor(
    @InjectRepository(Colaborador)
    private readonly colaboradorRepository: Repository<Colaborador>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  async create(dto: CreateColaboradorDto): Promise<Colaborador> {
    const cedula = normalizarCedula(dto.cedula);
    const usuarioId = dto.usuarioId ?? null;

    if (await this.colaboradorRepository.exists({ where: { cedula } })) {
      throw new ConflictException(
        `Ya existe un colaborador registrado con la cédula "${cedula}"`,
      );
    }

    if (usuarioId !== null) {
      await this.validarUsuarioDisponible(usuarioId);
    }

    const colaborador = this.colaboradorRepository.create({
      nombre: dto.nombre.trim(),
      apellidos: dto.apellidos.trim(),
      cedula,
      correoElectronico: dto.correoElectronico.trim().toLowerCase(),
      cargo: dto.cargo.trim(),
      activo: true,
      usuarioId,
    });

    try {
      const guardado = await this.colaboradorRepository.save(colaborador);
      this.logger.log(
        `Colaborador registrado: id=${guardado.id}, cedula=${guardado.cedula}`,
      );
      return guardado;
    } catch (error) {
      if (esViolacionUnicidad(error)) {
        throw new ConflictException(
          'Ya existe un colaborador con la misma cédula o la misma cuenta de usuario',
        );
      }
      throw error;
    }
  }

  async findAll(query: QueryColaboradoresDto): Promise<ColaboradoresListado> {
    const page = query.page ?? COLABORADORES_PAGE_DEFAULT;
    const limit = query.limit ?? COLABORADORES_LIMIT_DEFAULT;

    const qb = this.colaboradorRepository
      .createQueryBuilder('c')
      .setParameter('likeEscape', '\\');

    if (query.search) {
      qb.andWhere(
        new Brackets((inner) => {
          inner
            .where('c.nombre LIKE :search ESCAPE :likeEscape')
            .orWhere('c.apellidos LIKE :search ESCAPE :likeEscape');
          this.condicionCedula(inner, 'searchCedula');
        }),
      )
        .setParameter('search', patronLike(query.search))
        .setParameter('searchCedula', patronLike(sinGuiones(query.search)));
    }

    if (query.nombre) {
      qb.andWhere('c.nombre LIKE :nombre ESCAPE :likeEscape', {
        nombre: patronLike(query.nombre),
      });
    }

    if (query.apellidos) {
      qb.andWhere('c.apellidos LIKE :apellidos ESCAPE :likeEscape', {
        apellidos: patronLike(query.apellidos),
      });
    }

    if (query.cedula) {
      qb.andWhere(
        new Brackets((inner) => this.condicionCedula(inner, 'cedula')),
      ).setParameter('cedula', patronLike(sinGuiones(query.cedula)));
    }

    if (query.cargo) {
      qb.andWhere('LOWER(c.cargo) = LOWER(:cargo)', { cargo: query.cargo });
    }

    if (query.activo !== undefined) {
      qb.andWhere('c.activo = :activo', { activo: query.activo });
    }

    qb.orderBy('c.apellidos', 'ASC')
      .addOrderBy('c.nombre', 'ASC')
      .addOrderBy('c.id', 'ASC')
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

  async findOne(id: number): Promise<Colaborador> {
    const colaborador = await this.colaboradorRepository.findOne({
      where: { id },
      relations: { usuario: true },
    });
    if (!colaborador) {
      throw new NotFoundException(`No existe un colaborador con id ${id}`);
    }
    return colaborador;
  }

  async update(id: number, dto: UpdateColaboradorDto): Promise<Colaborador> {
    const cambios = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (cambios.length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para actualizar',
      );
    }

    const colaborador = await this.obtenerPorId(id);

    if (dto.cedula !== undefined) {
      const cedula = normalizarCedula(dto.cedula);
      if (cedula !== colaborador.cedula) {
        const enUso = await this.colaboradorRepository.exists({
          where: { cedula, id: Not(id) },
        });
        if (enUso) {
          throw new ConflictException(
            `Ya existe un colaborador registrado con la cédula "${cedula}"`,
          );
        }
      }
      colaborador.cedula = cedula;
    }

    if (dto.usuarioId !== undefined) {
      if (dto.usuarioId !== null && dto.usuarioId !== colaborador.usuarioId) {
        await this.validarUsuarioDisponible(dto.usuarioId, id);
      }
      colaborador.usuarioId = dto.usuarioId;
    }

    if (dto.nombre !== undefined) colaborador.nombre = dto.nombre;
    if (dto.apellidos !== undefined) colaborador.apellidos = dto.apellidos;
    if (dto.correoElectronico !== undefined) {
      colaborador.correoElectronico = dto.correoElectronico;
    }
    if (dto.cargo !== undefined) colaborador.cargo = dto.cargo;

    try {
      await this.colaboradorRepository.save(colaborador);
    } catch (error) {
      if (esViolacionUnicidad(error)) {
        throw new ConflictException(
          'Ya existe un colaborador con la misma cédula o la misma cuenta de usuario',
        );
      }
      throw error;
    }

    this.logger.log(`Colaborador actualizado: id=${id}`);
    return this.findOne(id);
  }

  async cambiarEstado(id: number, activo: boolean): Promise<Colaborador> {
    const colaborador = await this.obtenerPorId(id);
    if (colaborador.activo !== activo) {
      colaborador.activo = activo;
      await this.colaboradorRepository.save(colaborador);
      this.logger.log(
        `Colaborador ${activo ? 'activado' : 'inactivado'}: id=${id}`,
      );
    }
    return this.findOne(id);
  }

  private async obtenerPorId(id: number): Promise<Colaborador> {
    const colaborador = await this.colaboradorRepository.findOneBy({ id });
    if (!colaborador) {
      throw new NotFoundException(`No existe un colaborador con id ${id}`);
    }
    return colaborador;
  }

  private condicionCedula(qb: WhereExpressionBuilder, parametro: string): void {
    qb.orWhere(
      `REPLACE(c.cedula, '-', '') LIKE :${parametro} ESCAPE :likeEscape`,
    );
  }

  private async validarUsuarioDisponible(
    usuarioId: number,
    colaboradorIdActual?: number,
  ): Promise<void> {
    const usuarioExiste = await this.usuarioRepository.exists({
      where: { idUsuario: usuarioId },
    });
    if (!usuarioExiste) {
      throw new BadRequestException(`El usuario con id ${usuarioId} no existe`);
    }

    const yaAsignado = await this.colaboradorRepository.exists({
      where:
        colaboradorIdActual === undefined
          ? { usuarioId }
          : { usuarioId, id: Not(colaboradorIdActual) },
    });
    if (yaAsignado) {
      throw new ConflictException(
        `El usuario con id ${usuarioId} ya está asignado a otro colaborador`,
      );
    }
  }
}
