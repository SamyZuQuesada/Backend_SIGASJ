import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Asociado } from './entities/asociado.entity';
import { CreateAsociadoDto } from './dto/create-asociado.dto';
import {
  ASOCIADOS_LIMIT_DEFAULT,
  ASOCIADOS_PAGE_DEFAULT,
  QueryAsociadosDto,
} from './dto/query-asociados.dto';

export type AsociadosListado = {
  data: Asociado[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const escaparLike = (valor: string): string =>
  valor.replace(/[\\%_[\]]/g, '\\$&');

const patronLike = (valor: string): string => `%${escaparLike(valor)}%`;

const sinGuiones = (valor: string): string => valor.replace(/[-\s]/g, '');

@Injectable()
export class AsociadosService {
  private readonly logger = new Logger(AsociadosService.name);

  constructor(
    @InjectRepository(Asociado)
    private readonly asociadoRepository: Repository<Asociado>,
  ) {}

  /**
   * Registra un nuevo asociado dentro del sistema.
   * Valida unicidad de cédula, establece activo = true y asigna fechas correspondientes.
   */
  async create(dto: CreateAsociadoDto): Promise<Asociado> {
    const cedulaNormalizada = dto.cedula.trim();

    // 1. Verificar si ya existe un asociado con la misma cédula
    const asociadoExistente = await this.asociadoRepository.findOne({
      where: { cedula: cedulaNormalizada },
    });

    if (asociadoExistente) {
      throw new ConflictException(
        `Ya existe un asociado registrado con la cédula "${cedulaNormalizada}"`,
      );
    }

    // 2. Preparar la entidad
    const fechaRegistro = dto.fechaRegistro
      ? new Date(dto.fechaRegistro)
      : new Date();

    const nuevoAsociado = this.asociadoRepository.create({
      nombre: dto.nombre.trim(),
      apellidos: dto.apellidos.trim(),
      cedula: cedulaNormalizada,
      correoElectronico: dto.correoElectronico.trim().toLowerCase(),
      activo: true,
      fechaRegistro,
      fechaInactivacion: null,
    });

    // 3. Persistir en la base de datos controlando posibles condiciones de carrera
    try {
      const guardado = await this.asociadoRepository.save(nuevoAsociado);
      this.logger.log(
        `Asociado registrado exitosamente: id=${guardado.id}, cedula=${guardado.cedula}`,
      );
      return guardado;
    } catch (error: any) {
      if (
        error?.number === 2601 ||
        error?.number === 2627 ||
        error?.code === '23505' ||
        error?.message?.includes('UQ_') ||
        error?.message?.includes('duplicate')
      ) {
        throw new ConflictException(
          `Ya existe un asociado registrado con la cédula "${cedulaNormalizada}"`,
        );
      }
      throw error;
    }
  }

  async findById(id: number): Promise<Asociado | null> {
    return this.asociadoRepository.findOne({ where: { id } });
  }

  async findByCedula(cedula: string): Promise<Asociado | null> {
    return this.asociadoRepository.findOne({
      where: { cedula: cedula.trim() },
    });
  }

  /**
   * Listado paginado del padrón. `search` busca en nombre, apellidos y cédula
   * (la cédula se compara sin guiones ni espacios); `activo` filtra por estado.
   */
  async findAll(query: QueryAsociadosDto = {}): Promise<AsociadosListado> {
    const page = query.page ?? ASOCIADOS_PAGE_DEFAULT;
    const limit = query.limit ?? ASOCIADOS_LIMIT_DEFAULT;

    const qb = this.asociadoRepository
      .createQueryBuilder('a')
      .setParameter('likeEscape', '\\');

    if (query.search) {
      qb.andWhere(
        new Brackets((inner) => {
          inner
            .where('a.nombre LIKE :search ESCAPE :likeEscape')
            .orWhere('a.apellidos LIKE :search ESCAPE :likeEscape')
            .orWhere(
              "REPLACE(REPLACE(a.cedula, '-', ''), ' ', '') LIKE :searchCedula ESCAPE :likeEscape",
            );
        }),
      )
        .setParameter('search', patronLike(query.search))
        .setParameter('searchCedula', patronLike(sinGuiones(query.search)));
    }

    if (query.activo !== undefined) {
      qb.andWhere('a.activo = :activo', { activo: query.activo });
    }

    qb.orderBy('a.apellidos', 'ASC')
      .addOrderBy('a.nombre', 'ASC')
      .addOrderBy('a.id', 'ASC')
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

  async findOne(id: number): Promise<Asociado> {
    const asociado = await this.findById(id);
    if (!asociado) {
      throw new NotFoundException(`No existe un asociado con id ${id}`);
    }
    return asociado;
  }
}
