import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { withDbRetry } from '../../common/persistence/with-db-retry';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import { QueryCategoriasDto } from './dto/query-categorias.dto';
import { QueryMaterialesDto } from './dto/query-materiales.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { Material } from './entities/material.entity';

export type MaterialesPaginados = {
  data: Material[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CategoriasPaginadas = {
  data: CategoriaMaterial[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

@Injectable()
export class InventarioService {
  private readonly logger = new Logger(InventarioService.name);

  constructor(
    @InjectRepository(Material)
    private readonly materialRepository: Repository<Material>,
    @InjectRepository(CategoriaMaterial)
    private readonly categoriaRepository: Repository<CategoriaMaterial>,
  ) {}

  /**
   * Registra un nuevo artículo dentro del catálogo de materiales de la bodega.
   *
   * Regla de negocio fundamental:
   * La creación del artículo en el catálogo NO representa una entrada física de existencias.
   * Por tanto, `stockActual` se inicializa estrictamente en 0.
   */
  async create(dto: CreateMaterialDto): Promise<Material> {
    const nombreNormalizado = dto.nombre.trim();

    try {
      // Validar duplicados de nombre de forma insensible a mayúsculas y espacios
      const materialExistente = await withDbRetry(() =>
        this.materialRepository
          .createQueryBuilder('material')
          .where('LOWER(TRIM(material.nombre)) = LOWER(:nombre)', {
            nombre: nombreNormalizado,
          })
          .getOne(),
      );

      if (materialExistente) {
        throw new ConflictException(
          `Ya existe un material registrado con el nombre "${nombreNormalizado}"`,
        );
      }

      const idCat = dto.idCategoria ?? dto.categoriaId;
      let categoriaValida: CategoriaMaterial | null = null;
      if (typeof idCat === 'number') {
        const categoria = await withDbRetry(() =>
          this.categoriaRepository.findOne({
            where: { id: idCat },
          }),
        );

        if (!categoria) {
          throw new NotFoundException(`La categoría con ID ${idCat} no existe`);
        }

        if (!categoria.activo) {
          throw new BadRequestException(
            'No se puede asignar una categoría inactiva a un nuevo material',
          );
        }

        categoriaValida = categoria;
      }

      const material = this.materialRepository.create({
        nombre: nombreNormalizado,
        descripcion: dto.descripcion ?? null,
        unidadMedida: dto.unidadMedida.trim(),
        ubicacion: dto.ubicacion ?? null,
        stockMinimo: dto.stockMinimo ?? 0,
        stockActual: 0, // No genera entrada de inventario
        activo: true,
        idCategoria: categoriaValida ? categoriaValida.id : null,
        categoria: categoriaValida,
      });

      return await withDbRetry(() => this.materialRepository.save(material));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Error inesperado al registrar el material "${dto.nombre}":`,
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo registrar el material en el catálogo de inventario',
      );
    }
  }

  /**
   * Consulta el listado ordenado y paginado de materiales registrados en bodega.
   * Permite filtrar por estado (activo/inactivo) y búsqueda parcial por nombre.
   */
  async findAll(query: QueryMaterialesDto): Promise<MaterialesPaginados> {
    try {
      return await withDbRetry(async () => {
        const qb = this.materialRepository
          .createQueryBuilder('material')
          .leftJoinAndSelect('material.categoria', 'categoria');

        const nombre = query.nombre?.trim();
        if (nombre) {
          qb.andWhere('LOWER(material.nombre) LIKE LOWER(:nombre)', {
            nombre: `%${nombre}%`,
          });
        }

        if (typeof query.activo === 'boolean') {
          qb.andWhere('material.activo = :activo', { activo: query.activo });
        }

        const idCat = query.idCategoria ?? query.categoriaId;
        if (idCat) {
          qb.andWhere('material.idCategoria = :idCategoria', {
            idCategoria: idCat,
          });
        }

        qb.orderBy('material.nombre', 'ASC').addOrderBy('material.id', 'ASC');

        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        qb.skip((page - 1) * limit).take(limit);

        const [data, total] = await qb.getManyAndCount();

        return {
          data,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 0,
        };
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Error al consultar el listado de materiales:', error);
      throw new InternalServerErrorException(
        'No se pudo consultar el catálogo de materiales',
      );
    }
  }

  /**
   * Consulta el detalle completo de un material específico por su identificador numérico.
   * Utilizado para alimentar formularios de edición y visualización detallada de artículos.
   */
  async findOne(id: number): Promise<Material> {
    try {
      const material = await withDbRetry(() =>
        this.materialRepository.findOne({
          where: { id },
          relations: { categoria: true },
        }),
      );

      if (!material) {
        throw new NotFoundException(`Material con ID ${id} no encontrado`);
      }

      return material;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error al consultar el material con ID ${id}:`, error);
      throw new InternalServerErrorException(
        'No se pudo consultar el detalle del material',
      );
    }
  }

  /**
   * Actualiza la información descriptiva y administrativa de un material existente.
   * Regla crítica: stockActual es inmutable desde este endpoint de catálogo.
   */
  async update(id: number, dto: UpdateMaterialDto): Promise<Material> {
    const material = await this.findOne(id);

    if (dto.nombre !== undefined) {
      const nombreNormalizado = dto.nombre.trim();
      const duplicado = await withDbRetry(() =>
        this.materialRepository
          .createQueryBuilder('material')
          .where('material.id != :id', { id })
          .andWhere('LOWER(TRIM(material.nombre)) = LOWER(:nombre)', {
            nombre: nombreNormalizado,
          })
          .getOne(),
      );

      if (duplicado) {
        throw new ConflictException(
          `Ya existe otro material registrado con el nombre "${nombreNormalizado}"`,
        );
      }

      material.nombre = nombreNormalizado;
    }

    if (dto.descripcion !== undefined) {
      material.descripcion = dto.descripcion?.trim() || null;
    }

    if (dto.unidadMedida !== undefined) {
      material.unidadMedida = dto.unidadMedida.trim();
    }

    if (dto.ubicacion !== undefined) {
      material.ubicacion = dto.ubicacion?.trim() || null;
    }

    if (dto.stockMinimo !== undefined) {
      material.stockMinimo = dto.stockMinimo;
    }

    if (dto.activo !== undefined) {
      material.activo = dto.activo;
    }

    const idCat =
      dto.idCategoria !== undefined ? dto.idCategoria : dto.categoriaId;

    if (idCat !== undefined) {
      if (idCat === null) {
        material.idCategoria = null;
        material.categoria = null;
      } else if (material.idCategoria !== idCat) {
        const categoria = await withDbRetry(() =>
          this.categoriaRepository.findOne({
            where: { id: idCat },
          }),
        );

        if (!categoria) {
          throw new NotFoundException(`La categoría con ID ${idCat} no existe`);
        }

        if (!categoria.activo) {
          throw new BadRequestException(
            'No se puede asignar una categoría inactiva a un material',
          );
        }

        material.idCategoria = categoria.id;
        material.categoria = categoria;
      }
    }

    // Regla de negocio: stockActual se preserva intacto
    try {
      return await withDbRetry(() => this.materialRepository.save(material));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error al actualizar el material con ID ${id}:`, error);
      throw new InternalServerErrorException(
        'No se pudo actualizar el material en el catálogo de inventario',
      );
    }
  }

  /**
   * Cambia el estado operativo de un material (Activo / Inactivo) sin eliminarlo de la base de datos.
   * Preserva el historial de transacciones, existencias y referencias operativas.
   */
  async cambiarEstado(id: number, activo: boolean): Promise<Material> {
    const material = await this.findOne(id);

    material.activo = activo;

    try {
      return await withDbRetry(() => this.materialRepository.save(material));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Error al cambiar el estado del material con ID ${id}:`,
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo actualizar el estado del material',
      );
    }
  }

  /* =========================================================================
   * GESTIÓN DE CATEGORÍAS DE MATERIALES
   * ========================================================================= */

  /**
   * Registra una nueva categoría para agrupar y organizar materiales de bodega.
   */
  async createCategoria(dto: CreateCategoriaDto): Promise<CategoriaMaterial> {
    const nombreNormalizado = dto.nombre.trim();

    try {
      const categoriaExistente = await withDbRetry(() =>
        this.categoriaRepository
          .createQueryBuilder('categoria')
          .where('LOWER(TRIM(categoria.nombre)) = LOWER(:nombre)', {
            nombre: nombreNormalizado,
          })
          .getOne(),
      );

      if (categoriaExistente) {
        throw new ConflictException(
          `Ya existe una categoría registrada con el nombre "${nombreNormalizado}"`,
        );
      }

      const categoria = this.categoriaRepository.create({
        nombre: nombreNormalizado,
        descripcion: dto.descripcion ?? null,
        activo: true,
      });

      return await withDbRetry(() => this.categoriaRepository.save(categoria));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error al registrar categoría "${dto.nombre}":`, error);
      throw new InternalServerErrorException(
        'No se pudo registrar la categoría de materiales',
      );
    }
  }

  /**
   * Obtiene la lista de categorías con soporte de paginación, búsqueda por nombre y filtro por estado.
   */
  async findAllCategorias(
    query: QueryCategoriasDto = {},
  ): Promise<CategoriasPaginadas> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    try {
      const qb = this.categoriaRepository.createQueryBuilder('categoria');

      if (query.activo !== undefined) {
        qb.andWhere('categoria.activo = :activo', { activo: query.activo });
      }

      if (query.nombre) {
        qb.andWhere('LOWER(categoria.nombre) LIKE LOWER(:nombre)', {
          nombre: `%${query.nombre.trim()}%`,
        });
      }

      qb.orderBy('categoria.nombre', 'ASC');
      qb.skip(skip).take(limit);

      const [data, total] = await withDbRetry(() => qb.getManyAndCount());
      const totalPages = Math.ceil(total / limit);

      return {
        data,
        total,
        page,
        limit,
        totalPages: totalPages === 0 && total === 0 ? 0 : totalPages,
      };
    } catch (error) {
      this.logger.error('Error al consultar el catálogo de categorías:', error);
      throw new InternalServerErrorException(
        'No se pudo obtener el listado de categorías',
      );
    }
  }

  /**
   * Consulta una categoría de materiales por su ID.
   */
  async findOneCategoria(id: number): Promise<CategoriaMaterial> {
    try {
      const categoria = await withDbRetry(() =>
        this.categoriaRepository.findOne({
          where: { id },
        }),
      );

      if (!categoria) {
        throw new NotFoundException(
          `No se encontró la categoría de materiales con el ID ${id}`,
        );
      }

      return categoria;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error al consultar la categoría con ID ${id}:`, error);
      throw new InternalServerErrorException(
        'Error interno al consultar la categoría',
      );
    }
  }

  /**
   * Actualiza los datos descriptivos de una categoría existente.
   */
  async updateCategoria(
    id: number,
    dto: UpdateCategoriaDto,
  ): Promise<CategoriaMaterial> {
    const categoria = await this.findOneCategoria(id);

    if (dto.nombre !== undefined) {
      const nombreNormalizado = dto.nombre.trim();

      if (nombreNormalizado.toLowerCase() !== categoria.nombre.toLowerCase()) {
        const duplicado = await withDbRetry(() =>
          this.categoriaRepository
            .createQueryBuilder('categoria')
            .where('LOWER(TRIM(categoria.nombre)) = LOWER(:nombre)', {
              nombre: nombreNormalizado,
            })
            .andWhere('categoria.id != :id', { id })
            .getOne(),
        );

        if (duplicado) {
          throw new ConflictException(
            `Ya existe otra categoría registrada con el nombre "${nombreNormalizado}"`,
          );
        }
      }

      categoria.nombre = nombreNormalizado;
    }

    if (dto.descripcion !== undefined) {
      categoria.descripcion = dto.descripcion?.trim() || null;
    }

    try {
      return await withDbRetry(() => this.categoriaRepository.save(categoria));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Error al actualizar la categoría con ID ${id}:`,
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo actualizar la categoría en el catálogo',
      );
    }
  }

  /**
   * Cambia el estado operativo de una categoría (Activa / Inactiva) sin eliminarla físicamente.
   * Preserva el historial y las relaciones con materiales históricos.
   */
  async cambiarEstadoCategoria(
    id: number,
    activo: boolean,
  ): Promise<CategoriaMaterial> {
    const categoria = await this.findOneCategoria(id);

    categoria.activo = activo;

    try {
      return await withDbRetry(() => this.categoriaRepository.save(categoria));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Error al cambiar el estado de la categoría con ID ${id}:`,
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo actualizar el estado de la categoría',
      );
    }
  }
}
