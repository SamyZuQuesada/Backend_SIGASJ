import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EstadoProyecto,
  isEstadoProyectoValido,
} from '../../common/enums/estado-proyecto.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { withDbRetry } from '../../common/persistence/with-db-retry';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { QueryProyectosAdminDto } from './dto/query-proyectos-admin.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { ImagenProyecto } from './entities/imagen-proyecto.entity';
import { Proyecto } from './entities/proyecto.entity';

export type ProyectosAdminListado = {
  data: Proyecto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ImagenProyectoAdminDetalle = {
  id: number;
  url: string;
  descripcion: string | null;
  orden: number;
  createdAt: Date;
};

export type ProyectoAdminDetalle = {
  id: number;
  nombre: string;
  descripcion: string | null;
  encargadoRealizacion: string | null;
  duracion: string | null;
  estado: EstadoProyecto;
  imagenPrincipal: string | null;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
  imagenes: ImagenProyectoAdminDetalle[];
};

const toImagenAdminDetalle = (
  imagen: ImagenProyecto,
): ImagenProyectoAdminDetalle => ({
  id: imagen.id,
  url: imagen.url,
  descripcion: imagen.descripcion,
  orden: imagen.orden,
  createdAt: imagen.createdAt,
});

const toProyectoAdminDetalle = (proyecto: Proyecto): ProyectoAdminDetalle => ({
  id: proyecto.id,
  nombre: proyecto.nombre,
  descripcion: proyecto.descripcion,
  encargadoRealizacion: proyecto.encargadoRealizacion,
  duracion: proyecto.duracion,
  estado: proyecto.estado,
  imagenPrincipal: proyecto.imagenPrincipal,
  activo: proyecto.activo,
  createdAt: proyecto.createdAt,
  updatedAt: proyecto.updatedAt,
  imagenes: (proyecto.imagenes ?? []).map(toImagenAdminDetalle),
});

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

@Injectable()
export class ProyectosService {
  private readonly logger = new Logger(ProyectosService.name);

  constructor(
    @InjectRepository(Proyecto)
    private readonly proyectoRepository: Repository<Proyecto>,
  ) {}

  async create(
    dto: CreateProyectoDto,
    user?: AuthenticatedUser,
  ): Promise<Proyecto> {
    void user;

    const estado = dto.estado ?? EstadoProyecto.PENDIENTE;
    if (!isEstadoProyectoValido(estado)) {
      throw new BadRequestException(
        'El estado debe ser PENDIENTE, EN_PROCESO o COMPLETADO',
      );
    }

    try {
      return await withDbRetry(async () => {
        const proyecto = this.proyectoRepository.create({
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
          encargadoRealizacion: dto.encargadoRealizacion ?? null,
          duracion: dto.duracion ?? null,
          estado,
          imagenPrincipal: dto.imagenPrincipal ?? null,
          activo: false,
        });

        return this.proyectoRepository.save(proyecto);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('No se pudo registrar el proyecto');
      throw new InternalServerErrorException(
        'No se pudo registrar el proyecto',
      );
    }
  }

  async findAllAdmin(
    query: QueryProyectosAdminDto = {},
  ): Promise<ProyectosAdminListado> {
    try {
      return await withDbRetry(async () => {
        const qb = this.proyectoRepository
          .createQueryBuilder('proyecto')
          .select([
            'proyecto.id',
            'proyecto.nombre',
            'proyecto.descripcion',
            'proyecto.encargadoRealizacion',
            'proyecto.duracion',
            'proyecto.estado',
            'proyecto.imagenPrincipal',
            'proyecto.activo',
            'proyecto.createdAt',
            'proyecto.updatedAt',
          ]);

        const nombre = query.nombre?.trim();
        if (nombre) {
          qb.andWhere('proyecto.nombre LIKE :nombre', {
            nombre: `%${nombre}%`,
          });
        }

        if (query.estado) {
          if (!isEstadoProyectoValido(query.estado)) {
            throw new BadRequestException(
              'El estado debe ser PENDIENTE, EN_PROCESO o COMPLETADO',
            );
          }

          qb.andWhere('proyecto.estado = :estado', { estado: query.estado });
        }

        if (typeof query.activo === 'boolean') {
          qb.andWhere('proyecto.activo = :activo', { activo: query.activo });
        }

        qb.orderBy('proyecto.createdAt', 'DESC').addOrderBy(
          'proyecto.id',
          'DESC',
        );

        const page = query.page ?? DEFAULT_PAGE;
        const limit = query.limit ?? DEFAULT_LIMIT;
        qb.skip((page - 1) * limit).take(limit);

        const [data, total] = await qb.getManyAndCount();
        return {
          data,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('No se pudieron consultar los proyectos');
      throw new InternalServerErrorException(
        'No se pudieron consultar los proyectos',
      );
    }
  }

  async findOneAdmin(id: number): Promise<ProyectoAdminDetalle> {
    try {
      return await withDbRetry(async () => {
        const proyecto = await this.loadAdminById(id);
        return toProyectoAdminDetalle(proyecto);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('No se pudo consultar el proyecto');
      throw new InternalServerErrorException(
        'No se pudo consultar el proyecto',
      );
    }
  }

  async updateAdmin(
    id: number,
    dto: UpdateProyectoDto,
    user?: AuthenticatedUser,
  ): Promise<ProyectoAdminDetalle> {
    void user;

    try {
      return await withDbRetry(async () => {
        const proyecto = await this.proyectoRepository.findOne({
          where: { id },
          relations: { imagenes: true },
        });

        if (!proyecto) {
          throw new NotFoundException('Proyecto no encontrado');
        }

        const cambios = this.camposInformacionGeneral(dto);
        this.proyectoRepository.merge(proyecto, cambios);
        const saved = await this.proyectoRepository.save(proyecto);
        return toProyectoAdminDetalle(saved);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('No se pudo actualizar el proyecto');
      throw new InternalServerErrorException(
        'No se pudo actualizar el proyecto',
      );
    }
  }

  private camposInformacionGeneral(
    dto: UpdateProyectoDto,
  ): Partial<
    Pick<
      Proyecto,
      'nombre' | 'descripcion' | 'encargadoRealizacion' | 'duracion'
    >
  > {
    const cambios: Partial<
      Pick<
        Proyecto,
        'nombre' | 'descripcion' | 'encargadoRealizacion' | 'duracion'
      >
    > = {};

    if (dto.nombre !== undefined) {
      cambios.nombre = dto.nombre;
    }
    if (dto.descripcion !== undefined) {
      cambios.descripcion = dto.descripcion;
    }
    if (dto.encargadoRealizacion !== undefined) {
      cambios.encargadoRealizacion = dto.encargadoRealizacion;
    }
    if (dto.duracion !== undefined) {
      cambios.duracion = dto.duracion;
    }

    return cambios;
  }

  private async loadAdminById(id: number): Promise<Proyecto> {
    const proyecto = await this.proyectoRepository
      .createQueryBuilder('proyecto')
      .select([
        'proyecto.id',
        'proyecto.nombre',
        'proyecto.descripcion',
        'proyecto.encargadoRealizacion',
        'proyecto.duracion',
        'proyecto.estado',
        'proyecto.imagenPrincipal',
        'proyecto.activo',
        'proyecto.createdAt',
        'proyecto.updatedAt',
        'imagenes.id',
        'imagenes.url',
        'imagenes.descripcion',
        'imagenes.orden',
        'imagenes.createdAt',
      ])
      .leftJoinAndSelect('proyecto.imagenes', 'imagenes')
      .where('proyecto.id = :id', { id })
      .orderBy('imagenes.orden', 'ASC')
      .addOrderBy('imagenes.id', 'ASC')
      .getOne();

    if (!proyecto) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    return proyecto;
  }
}
