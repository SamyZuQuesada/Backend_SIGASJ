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
import {
  deletePhysicalMediaFile,
  saveProyectoImage,
  type UploadedImageFile,
} from '../../common/media/public-media';
import { withDbRetry } from '../../common/persistence/with-db-retry';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { CreateProyectoImagenDto } from './dto/create-proyecto-imagen.dto';
import { QueryProyectosAdminDto } from './dto/query-proyectos-admin.dto';
import { ReordenarImagenesDto } from './dto/reordenar-imagenes.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { UpdateProyectoEstadoDto } from './dto/update-proyecto-estado.dto';
import { UpdateProyectoVisibilidadDto } from './dto/update-proyecto-visibilidad.dto';
import { ImagenProyecto } from './entities/imagen-proyecto.entity';


import { Proyecto } from './entities/proyecto.entity';

export type ProyectosAdminListado = {
  data: Proyecto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ProyectoPublicoCard = {
  id: number;
  nombre: string;
  imagenPrincipal: string | null;
  duracion: string | null;
  estado: EstadoProyecto;
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
    @InjectRepository(ImagenProyecto)
    private readonly imagenRepository: Repository<ImagenProyecto>,
  ) {}

  async create(
    dto: CreateProyectoDto,
    user?: AuthenticatedUser,
    file?: UploadedImageFile,
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

        const saved = await this.proyectoRepository.save(proyecto);

        if (file) {
          const coverUrl = saveProyectoImage(saved.id, file, 'cover');
          saved.imagenPrincipal = coverUrl;
          return await this.proyectoRepository.save(saved);
        }

        return saved;
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

  async findAllPublic(): Promise<ProyectoPublicoCard[]> {
    try {
      return await withDbRetry(async () => {
        const proyectos = await this.proyectoRepository
          .createQueryBuilder('proyecto')
          .select([
            'proyecto.id',
            'proyecto.nombre',
            'proyecto.imagenPrincipal',
            'proyecto.duracion',
            'proyecto.estado',
          ])
          .where('proyecto.activo = :activo', { activo: true })
          .orderBy('proyecto.createdAt', 'DESC')
          .addOrderBy('proyecto.id', 'DESC')
          .getMany();

        return proyectos.map((proyecto) => ({
          id: proyecto.id,
          nombre: proyecto.nombre,
          imagenPrincipal: proyecto.imagenPrincipal,
          duracion: proyecto.duracion,
          estado: proyecto.estado,
        }));
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('No se pudieron consultar los proyectos públicos');
      throw new InternalServerErrorException(
        'No se pudieron consultar los proyectos públicos',
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
    file?: UploadedImageFile,
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

        if (dto.removeImagenPrincipal) {
          if (proyecto.imagenPrincipal) {
            deletePhysicalMediaFile(proyecto.imagenPrincipal);
            proyecto.imagenPrincipal = null;
          }
        }

        if (file) {
          if (proyecto.imagenPrincipal) {
            deletePhysicalMediaFile(proyecto.imagenPrincipal);
          }
          proyecto.imagenPrincipal = saveProyectoImage(
            proyecto.id,
            file,
            'cover',
          );
        }

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

  async updateEstado(
    id: number,
    dto: UpdateProyectoEstadoDto,
    user?: AuthenticatedUser,
  ): Promise<ProyectoAdminDetalle> {
    void user;

    if (!isEstadoProyectoValido(dto.estado)) {
      throw new BadRequestException(
        'El estado debe ser PENDIENTE, EN_PROCESO o COMPLETADO',
      );
    }

    try {
      return await withDbRetry(async () => {
        const proyecto = await this.proyectoRepository.findOne({
          where: { id },
          relations: { imagenes: true },
        });

        if (!proyecto) {
          throw new NotFoundException('Proyecto no encontrado');
        }

        proyecto.estado = dto.estado;
        const saved = await this.proyectoRepository.save(proyecto);
        return toProyectoAdminDetalle(saved);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('No se pudo actualizar el estado del proyecto');
      throw new InternalServerErrorException(
        'No se pudo actualizar el estado del proyecto',
      );
    }
  }

  async updateVisibilidad(
    id: number,
    dto: UpdateProyectoVisibilidadDto,
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

        proyecto.activo = dto.activo;
        const saved = await this.proyectoRepository.save(proyecto);
        return toProyectoAdminDetalle(saved);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('No se pudo actualizar la visibilidad del proyecto');
      throw new InternalServerErrorException(
        'No se pudo actualizar la visibilidad del proyecto',
      );
    }
  }

  async updateImagenPrincipal(
    id: number,
    file?: UploadedImageFile,
  ): Promise<ProyectoAdminDetalle> {
    if (!file) {
      throw new BadRequestException('Debe proporcionar un archivo de imagen');
    }

    try {
      return await withDbRetry(async () => {
        const proyecto = await this.proyectoRepository.findOne({
          where: { id },
          relations: { imagenes: true },
        });

        if (!proyecto) {
          throw new NotFoundException('Proyecto no encontrado');
        }

        if (proyecto.imagenPrincipal) {
          deletePhysicalMediaFile(proyecto.imagenPrincipal);
        }

        proyecto.imagenPrincipal = saveProyectoImage(id, file, 'cover');
        const saved = await this.proyectoRepository.save(proyecto);
        return toProyectoAdminDetalle(saved);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        'No se pudo actualizar la imagen principal del proyecto',
      );
      throw new InternalServerErrorException(
        'No se pudo actualizar la imagen principal del proyecto',
      );
    }
  }

  async removeImagenPrincipal(id: number): Promise<ProyectoAdminDetalle> {
    try {
      return await withDbRetry(async () => {
        const proyecto = await this.proyectoRepository.findOne({
          where: { id },
          relations: { imagenes: true },
        });

        if (!proyecto) {
          throw new NotFoundException('Proyecto no encontrado');
        }

        if (proyecto.imagenPrincipal) {
          deletePhysicalMediaFile(proyecto.imagenPrincipal);
          proyecto.imagenPrincipal = null;
        }

        const saved = await this.proyectoRepository.save(proyecto);
        return toProyectoAdminDetalle(saved);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        'No se pudo eliminar la imagen principal del proyecto',
      );
      throw new InternalServerErrorException(
        'No se pudo eliminar la imagen principal del proyecto',
      );
    }
  }

  async addImagenGaleria(
    proyectoId: number,
    dto: CreateProyectoImagenDto,
    file?: UploadedImageFile,
  ): Promise<ProyectoAdminDetalle> {
    if (!file) {
      throw new BadRequestException('Debe proporcionar un archivo de imagen');
    }

    try {
      return await withDbRetry(async () => {
        const proyecto = await this.proyectoRepository.findOne({
          where: { id: proyectoId },
        });

        if (!proyecto) {
          throw new NotFoundException('Proyecto no encontrado');
        }

        const url = saveProyectoImage(proyectoId, file, 'galeria');

        let orden = dto.orden;
        if (orden === undefined) {
          const maxOrdenResult = await this.imagenRepository
            .createQueryBuilder('imagen')
            .select('MAX(imagen.orden)', 'max')
            .where('imagen.proyectoId = :proyectoId', { proyectoId })
            .getRawOne();
          const currentMax =
            maxOrdenResult?.max != null ? Number(maxOrdenResult.max) : -1;
          orden = currentMax + 1;
        }

        const imagen = this.imagenRepository.create({
          proyecto,
          url,
          descripcion: dto.descripcion ?? null,
          orden,
        });

        await this.imagenRepository.save(imagen);
        return this.findOneAdmin(proyectoId);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        'No se pudo agregar la imagen a la galería del proyecto',
      );
      throw new InternalServerErrorException(
        'No se pudo agregar la imagen a la galería del proyecto',
      );
    }
  }

  async removeImagenGaleria(
    proyectoId: number,
    imagenId: number,
  ): Promise<ProyectoAdminDetalle> {
    try {
      return await withDbRetry(async () => {
        const proyecto = await this.proyectoRepository.findOne({
          where: { id: proyectoId },
        });

        if (!proyecto) {
          throw new NotFoundException('Proyecto no encontrado');
        }

        const imagen = await this.imagenRepository.findOne({
          where: { id: imagenId, proyecto: { id: proyectoId } },
        });

        if (!imagen) {
          throw new NotFoundException('Fotografía de galería no encontrada');
        }

        deletePhysicalMediaFile(imagen.url);
        await this.imagenRepository.remove(imagen);

        return this.findOneAdmin(proyectoId);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('No se pudo eliminar la imagen de la galería');
      throw new InternalServerErrorException(
        'No se pudo eliminar la imagen de la galería',
      );
    }
  }

  async reordenarImagenesGaleria(
    proyectoId: number,
    dto: ReordenarImagenesDto,
  ): Promise<ProyectoAdminDetalle> {
    try {
      return await withDbRetry(async () => {
        const proyecto = await this.proyectoRepository.findOne({
          where: { id: proyectoId },
        });

        if (!proyecto) {
          throw new NotFoundException('Proyecto no encontrado');
        }

        for (const item of dto.items) {
          await this.imagenRepository.update(
            { id: item.id, proyecto: { id: proyectoId } },
            { orden: item.orden },
          );
        }

        return this.findOneAdmin(proyectoId);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('No se pudo reordenar las imágenes de la galería');
      throw new InternalServerErrorException(
        'No se pudo reordenar las imágenes de la galería',
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

