import { finDiaEnAsada, inicioDiaEnAsada } from '../../common/time/reloj-asada';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Asociado } from './entities/asociado.entity';
import { normalizarCedula } from '../../common/utils/cedula.util';
import { CreateAsociadoDto } from './dto/create-asociado.dto';
import { UpdateAsociadoDto } from './dto/update-asociado.dto';
import { UpdateEstadoAsociadoDto } from './dto/update-estado-asociado.dto';
import {
  ASOCIADOS_LIMIT_DEFAULT,
  ASOCIADOS_PAGE_DEFAULT,
  QueryAsociadosDto,
} from './dto/query-asociados.dto';
import {
  HistorialAsociadoItemDto,
  HistorialAsociadosResponseDto,
} from './dto/historial-asociado.dto';
import {
  HISTORIAL_ASOCIADOS_LIMIT_DEFAULT,
  HISTORIAL_ASOCIADOS_PAGE_DEFAULT,
  OrdenHistorial,
  QueryHistorialAsociadosDto,
} from './dto/query-historial-asociados.dto';

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
    if (!dto) {
      throw new BadRequestException('Los datos del asociado son obligatorios');
    }

    const nombre = dto.nombre?.trim();
    if (!nombre) {
      throw new BadRequestException('El nombre es obligatorio');
    }
    if (nombre.length > 100) {
      throw new BadRequestException(
        'El nombre no puede exceder 100 caracteres',
      );
    }

    const apellidos = dto.apellidos?.trim();
    if (!apellidos) {
      throw new BadRequestException('Los apellidos son obligatorios');
    }
    if (apellidos.length > 100) {
      throw new BadRequestException(
        'Los apellidos no pueden exceder 100 caracteres',
      );
    }

    const cedulaRaw = dto.cedula?.trim();
    if (!cedulaRaw) {
      throw new BadRequestException('La cédula es obligatoria');
    }
    const cedulaNormalizada = normalizarCedula(dto.cedula);
    if (!cedulaNormalizada || cedulaNormalizada.trim() === '') {
      throw new BadRequestException('La cédula es obligatoria');
    }
    if (cedulaNormalizada.length > 30) {
      throw new BadRequestException(
        'La cédula no puede exceder 30 caracteres',
      );
    }

    const correoRaw = dto.correoElectronico ?? (dto as any).correo;
    const correoLimpio = correoRaw?.trim().toLowerCase();
    if (!correoLimpio) {
      throw new BadRequestException('El correo electrónico es obligatorio');
    }
    if (correoLimpio.length > 150) {
      throw new BadRequestException(
        'El correo electrónico no puede exceder 150 caracteres',
      );
    }
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexEmail.test(correoLimpio)) {
      throw new BadRequestException(
        'El correo electrónico no tiene un formato válido',
      );
    }

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
      nombre,
      apellidos,
      cedula: cedulaNormalizada,
      correoElectronico: correoLimpio,
      activo: true,
      fechaRegistro,
      fechaInactivacion: null,
      motivoInactivacion: null,
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
        error?.code === 'SQLITE_CONSTRAINT' ||
        error?.message?.includes('UQ_') ||
        error?.message?.includes('duplicate') ||
        error?.message?.includes('UNIQUE')
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
    const cedulaNormalizada = normalizarCedula(cedula);
    return this.asociadoRepository.findOne({
      where: { cedula: cedulaNormalizada },
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

    const fechaRegDesde = query.fechaRegistroDesde ?? query.fechaDesde;
    if (fechaRegDesde) {
      qb.andWhere('a.fechaRegistro >= :fechaRegDesde', {
        fechaRegDesde: inicioDiaEnAsada(fechaRegDesde),
      });
    }

    const fechaRegHasta = query.fechaRegistroHasta ?? query.fechaHasta;
    if (fechaRegHasta) {
      qb.andWhere('a.fechaRegistro <= :fechaRegHasta', {
        fechaRegHasta: finDiaEnAsada(fechaRegHasta),
      });
    }

    if (query.fechaInactivacionDesde) {
      qb.andWhere('a.fechaInactivacion >= :fechaInactDesde', {
        fechaInactDesde: inicioDiaEnAsada(query.fechaInactivacionDesde),
      });
    }

    if (query.fechaInactivacionHasta) {
      qb.andWhere('a.fechaInactivacion <= :fechaInactHasta', {
        fechaInactHasta: finDiaEnAsada(query.fechaInactivacionHasta),
      });
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

  async update(id: number, dto: UpdateAsociadoDto): Promise<Asociado> {
    const cambios = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (cambios.length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para actualizar',
      );
    }

    const asociado = await this.findOne(id);

    if (dto.cedula !== undefined) {
      if (
        dto.cedula === null ||
        typeof dto.cedula !== 'string' ||
        dto.cedula.trim() === ''
      ) {
        throw new BadRequestException('La cédula es obligatoria');
      }
      const cedulaNormalizada = normalizarCedula(dto.cedula);
      if (cedulaNormalizada.length > 30) {
        throw new BadRequestException(
          'La cédula no puede exceder 30 caracteres',
        );
      }
      if (cedulaNormalizada !== asociado.cedula) {
        const asociadoExistente = await this.asociadoRepository.findOne({
          where: { cedula: cedulaNormalizada },
        });

        if (asociadoExistente && asociadoExistente.id !== id) {
          throw new ConflictException(
            `Ya existe un asociado registrado con la cédula "${cedulaNormalizada}"`,
          );
        }
      }
      asociado.cedula = cedulaNormalizada;
    }

    if (dto.nombre !== undefined) {
      if (
        dto.nombre === null ||
        typeof dto.nombre !== 'string' ||
        dto.nombre.trim() === ''
      ) {
        throw new BadRequestException('El nombre es obligatorio');
      }
      if (dto.nombre.trim().length > 100) {
        throw new BadRequestException(
          'El nombre no puede exceder 100 caracteres',
        );
      }
      asociado.nombre = dto.nombre.trim();
    }

    if (dto.apellidos !== undefined) {
      if (
        dto.apellidos === null ||
        typeof dto.apellidos !== 'string' ||
        dto.apellidos.trim() === ''
      ) {
        throw new BadRequestException('Los apellidos son obligatorios');
      }
      if (dto.apellidos.trim().length > 100) {
        throw new BadRequestException(
          'Los apellidos no pueden exceder 100 caracteres',
        );
      }
      asociado.apellidos = dto.apellidos.trim();
    }

    const correo = dto.correoElectronico ?? dto.correo;
    if (correo !== undefined) {
      if (
        correo === null ||
        typeof correo !== 'string' ||
        correo.trim() === ''
      ) {
        throw new BadRequestException(
          'El correo electrónico no puede estar vacío',
        );
      }
      const correoLimpio = correo.trim().toLowerCase();
      if (correoLimpio.length > 150) {
        throw new BadRequestException(
          'El correo electrónico no puede exceder 150 caracteres',
        );
      }
      const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!regexEmail.test(correoLimpio)) {
        throw new BadRequestException(
          'El correo electrónico no tiene un formato válido',
        );
      }
      asociado.correoElectronico = correoLimpio;
    }

    asociado.updatedAt = new Date();

    try {
      const guardado = await this.asociadoRepository.save(asociado);
      this.logger.log(`Asociado modificado exitosamente: id=${guardado.id}`);
      return guardado;
    } catch (error: any) {
      if (
        error?.number === 2601 ||
        error?.number === 2627 ||
        error?.code === '23505' ||
        error?.code === 'SQLITE_CONSTRAINT' ||
        error?.message?.includes('UQ_') ||
        error?.message?.includes('duplicate') ||
        error?.message?.includes('UNIQUE')
      ) {
        throw new ConflictException(
          `Ya existe un asociado registrado con la cédula "${asociado.cedula}"`,
        );
      }
      throw error;
    }
  }

  /**
   * Activa o inactiva un asociado (PBI 5.4).
   * Al inactivar registra la fecha y el motivo; al reactivar ambos vuelven a NULL.
   * Si el asociado ya está en el estado pedido no se modifica nada, para no
   * sobrescribir la fecha ni el motivo de una inactivación anterior.
   */
  async cambiarEstado(
    id: number,
    dto: UpdateEstadoAsociadoDto,
  ): Promise<Asociado> {
    const asociado = await this.findOne(id);
    if (asociado.activo === dto.activo) {
      return asociado;
    }

    if (dto.activo) {
      asociado.activo = true;
      asociado.fechaInactivacion = null;
      asociado.motivoInactivacion = null;
    } else {
      asociado.activo = false;
      asociado.fechaInactivacion = new Date();
      asociado.motivoInactivacion = dto.motivo?.trim() ?? null;
    }

    const guardado = await this.asociadoRepository.save(asociado);
    this.logger.log(
      `Asociado ${dto.activo ? 'reactivado' : 'inactivado'}: id=${id}`,
    );
    return guardado;
  }

  /**
   * Endpoint administrativo de solo consulta para recuperar el historial de asociados.
   * Incluye tanto asociados activos como inactivos (anteriores), con datos de contacto,
   * estado y fechas de registro e inactivación.
   * Consulta directa y de solo lectura sobre la tabla Asociado en SQL Server.
   */
  async getHistorial(
    query: QueryHistorialAsociadosDto = {},
  ): Promise<HistorialAsociadosResponseDto> {
    const page = query.page ?? HISTORIAL_ASOCIADOS_PAGE_DEFAULT;
    const limit = query.limit ?? HISTORIAL_ASOCIADOS_LIMIT_DEFAULT;
    const direccion = query.orden === OrdenHistorial.DESC ? 'DESC' : 'ASC';

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

    if (query.nombre) {
      qb.andWhere('a.nombre LIKE :nombreFiltro ESCAPE :likeEscape', {
        nombreFiltro: patronLike(query.nombre),
      });
    }

    if (query.apellidos) {
      qb.andWhere('a.apellidos LIKE :apellidosFiltro ESCAPE :likeEscape', {
        apellidosFiltro: patronLike(query.apellidos),
      });
    }

    if (query.cedula) {
      qb.andWhere(
        "REPLACE(REPLACE(a.cedula, '-', ''), ' ', '') LIKE :cedulaFiltro ESCAPE :likeEscape",
        {
          cedulaFiltro: patronLike(sinGuiones(query.cedula)),
        },
      );
    }

    const estadoFiltro =
      query.activo !== undefined ? query.activo : query.estado;
    if (estadoFiltro !== undefined) {
      qb.andWhere('a.activo = :activo', { activo: estadoFiltro });
    }

    if (query.fechaRegistro) {
      qb.andWhere(
        'a.fechaRegistro >= :fRegExactaInicio AND a.fechaRegistro <= :fRegExactaFin',
        {
          fRegExactaInicio: inicioDiaEnAsada(query.fechaRegistro),
          fRegExactaFin: finDiaEnAsada(query.fechaRegistro),
        },
      );
    }

    const fRegDesde = query.fechaRegistroDesde ?? query.fechaDesde;
    if (fRegDesde) {
      qb.andWhere('a.fechaRegistro >= :fRegDesde', {
        fRegDesde: inicioDiaEnAsada(fRegDesde),
      });
    }

    const fRegHasta = query.fechaRegistroHasta ?? query.fechaHasta;
    if (fRegHasta) {
      qb.andWhere('a.fechaRegistro <= :fRegHasta', {
        fRegHasta: finDiaEnAsada(fRegHasta),
      });
    }

    if (query.fechaInactivacion) {
      qb.andWhere(
        'a.fechaInactivacion >= :fInactExactaInicio AND a.fechaInactivacion <= :fInactExactaFin',
        {
          fInactExactaInicio: inicioDiaEnAsada(query.fechaInactivacion),
          fInactExactaFin: finDiaEnAsada(query.fechaInactivacion),
        },
      );
    }

    if (query.fechaInactivacionDesde) {
      qb.andWhere('a.fechaInactivacion >= :fInactDesde', {
        fInactDesde: inicioDiaEnAsada(query.fechaInactivacionDesde),
      });
    }

    if (query.fechaInactivacionHasta) {
      qb.andWhere('a.fechaInactivacion <= :fInactHasta', {
        fInactHasta: finDiaEnAsada(query.fechaInactivacionHasta),
      });
    }

    qb.orderBy('a.apellidos', direccion)
      .addOrderBy('a.nombre', direccion)
      .addOrderBy('a.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    const items: HistorialAsociadoItemDto[] = data.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      apellidos: a.apellidos,
      cedula: a.cedula,
      correo: a.correoElectronico,
      correoElectronico: a.correoElectronico,
      activo: a.activo,
      estado: a.activo ? 'Activo' : 'Inactivo',
      fechaRegistro: a.fechaRegistro,
      fechaInactivacion: a.fechaInactivacion,
      motivoInactivacion: a.motivoInactivacion,
    }));

    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }
}
