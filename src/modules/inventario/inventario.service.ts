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
import { TipoMovimientoInventario } from '../../common/enums/tipo-movimiento-inventario.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { withDbRetry } from '../../common/persistence/with-db-retry';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { QueryCategoriasDto } from './dto/query-categorias.dto';
import { QueryMaterialesDto } from './dto/query-materiales.dto';
import {
  deleteMovimientoDocument,
  getMovimientoDocumentFilePath,
  saveMovimientoDocument,
  type MovimientoDocumentFile,
} from '../../common/media/public-media';
import { QueryProveedoresDto } from './dto/query-proveedores.dto';
import { RegistrarEntradaDto } from './dto/registrar-entrada.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { Material } from './entities/material.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';

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

export type ProveedoresPaginados = {
  data: Proveedor[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ConfirmacionEntradaInventario = {
  movimiento: MovimientoInventario;
  material: Material;
  stockAnterior: number;
  stockActual: number;
  mensaje: string;
};

@Injectable()
export class InventarioService {
  private readonly logger = new Logger(InventarioService.name);

  constructor(
    @InjectRepository(Material)
    private readonly materialRepository: Repository<Material>,
    @InjectRepository(CategoriaMaterial)
    private readonly categoriaRepository: Repository<CategoriaMaterial>,
    @InjectRepository(Proveedor)
    private readonly proveedorRepository: Repository<Proveedor>,
    @InjectRepository(MovimientoInventario)
    private readonly movimientoRepository: Repository<MovimientoInventario>,
    @InjectRepository(DocumentoMovimientoInventario)
    private readonly documentoMovimientoRepository: Repository<DocumentoMovimientoInventario>,
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

      const idProv = dto.idProveedor ?? dto.proveedorId;
      let proveedorValido: Proveedor | null = null;
      if (typeof idProv === 'number') {
        const proveedor = await withDbRetry(() =>
          this.proveedorRepository.findOne({
            where: { id: idProv },
          }),
        );

        if (!proveedor) {
          throw new NotFoundException(`El proveedor con ID ${idProv} no existe`);
        }

        if (!proveedor.activo) {
          throw new BadRequestException(
            'No se puede asignar un proveedor inactivo a un nuevo material',
          );
        }

        proveedorValido = proveedor;
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
        idProveedor: proveedorValido ? proveedorValido.id : null,
        proveedor: proveedorValido,
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
   * Permite filtrar por estado (activo/inactivo), categoría, proveedor y búsqueda parcial por nombre.
   */
  async findAll(query: QueryMaterialesDto): Promise<MaterialesPaginados> {
    try {
      return await withDbRetry(async () => {
        const qb = this.materialRepository
          .createQueryBuilder('material')
          .leftJoinAndSelect('material.categoria', 'categoria')
          .leftJoinAndSelect('material.proveedor', 'proveedor');

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

        const idProv = query.idProveedor ?? query.proveedorId;
        if (idProv) {
          qb.andWhere('material.idProveedor = :idProveedor', {
            idProveedor: idProv,
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
          relations: { categoria: true, proveedor: true },
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

    const idProv =
      dto.idProveedor !== undefined ? dto.idProveedor : dto.proveedorId;

    if (idProv !== undefined) {
      if (idProv === null) {
        material.idProveedor = null;
        material.proveedor = null;
      } else if (material.idProveedor !== idProv) {
        const proveedor = await withDbRetry(() =>
          this.proveedorRepository.findOne({
            where: { id: idProv },
          }),
        );

        if (!proveedor) {
          throw new NotFoundException(`El proveedor con ID ${idProv} no existe`);
        }

        if (!proveedor.activo) {
          throw new BadRequestException(
            'No se puede asignar un proveedor inactivo a un material',
          );
        }

        material.idProveedor = proveedor.id;
        material.proveedor = proveedor;
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

  /* =========================================================================
   * GESTIÓN DE PROVEEDORES
   * ========================================================================= */

  /**
   * Registra un nuevo proveedor en el catálogo de inventario.
   */
  async createProveedor(dto: CreateProveedorDto): Promise<Proveedor> {
    const nombreNormalizado = dto.nombre.trim();
    const identificacionNormalizada = dto.identificacion?.trim() || null;

    try {
      const qb = this.proveedorRepository
        .createQueryBuilder('proveedor')
        .where('LOWER(TRIM(proveedor.nombre)) = LOWER(:nombre)', {
          nombre: nombreNormalizado,
        });

      if (identificacionNormalizada) {
        qb.orWhere('TRIM(proveedor.identificacion) = :identificacion', {
          identificacion: identificacionNormalizada,
        });
      }

      const proveedorExistente = await withDbRetry(() => qb.getOne());

      if (proveedorExistente) {
        if (
          identificacionNormalizada &&
          proveedorExistente.identificacion?.toLowerCase() ===
            identificacionNormalizada.toLowerCase()
        ) {
          throw new ConflictException(
            `Ya existe un proveedor registrado con la identificación "${identificacionNormalizada}"`,
          );
        }
        throw new ConflictException(
          `Ya existe un proveedor registrado con el nombre "${nombreNormalizado}"`,
        );
      }

      const proveedor = this.proveedorRepository.create({
        nombre: nombreNormalizado,
        razonSocial: dto.razonSocial?.trim() || null,
        identificacion: identificacionNormalizada,
        telefono: dto.telefono?.trim() || null,
        correo: dto.correo?.trim().toLowerCase() || null,
        direccion: dto.direccion?.trim() || null,
        personaContacto: dto.personaContacto?.trim() || null,
        activo: true,
      });

      return await withDbRetry(() => this.proveedorRepository.save(proveedor));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error al registrar proveedor "${dto.nombre}":`, error);
      throw new InternalServerErrorException(
        'No se pudo registrar el proveedor en el catálogo',
      );
    }
  }

  /**
   * Obtiene la lista paginada de proveedores con filtros opcionales de estado y búsqueda.
   */
  async findAllProveedores(
    query: QueryProveedoresDto = {},
  ): Promise<ProveedoresPaginados> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    try {
      const qb = this.proveedorRepository.createQueryBuilder('proveedor');

      if (query.activo !== undefined) {
        qb.andWhere('proveedor.activo = :activo', { activo: query.activo });
      }

      if (query.nombre) {
        qb.andWhere('LOWER(proveedor.nombre) LIKE LOWER(:nombre)', {
          nombre: `%${query.nombre.trim()}%`,
        });
      }

      if (query.search) {
        const searchPattern = `%${query.search.trim()}%`;
        qb.andWhere(
          '(LOWER(proveedor.nombre) LIKE LOWER(:search) OR LOWER(proveedor.razonSocial) LIKE LOWER(:search) OR LOWER(proveedor.identificacion) LIKE LOWER(:search))',
          { search: searchPattern },
        );
      }

      qb.orderBy('proveedor.nombre', 'ASC');
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
      this.logger.error('Error al consultar el catálogo de proveedores:', error);
      throw new InternalServerErrorException(
        'No se pudo obtener el listado de proveedores',
      );
    }
  }

  /**
   * Consulta el detalle de un proveedor por su ID.
   */
  async findOneProveedor(id: number): Promise<Proveedor> {
    try {
      const proveedor = await withDbRetry(() =>
        this.proveedorRepository.findOne({
          where: { id },
        }),
      );

      if (!proveedor) {
        throw new NotFoundException(
          `No se encontró el proveedor con el ID ${id}`,
        );
      }

      return proveedor;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error al consultar el proveedor con ID ${id}:`, error);
      throw new InternalServerErrorException(
        'Error interno al consultar el proveedor',
      );
    }
  }

  /**
   * Actualiza los datos de un proveedor existente.
   */
  async updateProveedor(
    id: number,
    dto: UpdateProveedorDto,
  ): Promise<Proveedor> {
    const proveedor = await this.findOneProveedor(id);

    if (dto.nombre !== undefined) {
      const nombreNormalizado = dto.nombre.trim();
      if (nombreNormalizado.toLowerCase() !== proveedor.nombre.toLowerCase()) {
        const duplicado = await withDbRetry(() =>
          this.proveedorRepository
            .createQueryBuilder('proveedor')
            .where('LOWER(TRIM(proveedor.nombre)) = LOWER(:nombre)', {
              nombre: nombreNormalizado,
            })
            .andWhere('proveedor.id != :id', { id })
            .getOne(),
        );

        if (duplicado) {
          throw new ConflictException(
            `Ya existe otro proveedor registrado con el nombre "${nombreNormalizado}"`,
          );
        }
      }
      proveedor.nombre = nombreNormalizado;
    }

    if (dto.identificacion !== undefined && dto.identificacion !== null) {
      const idenNormalizada = dto.identificacion.trim();
      if (
        !proveedor.identificacion ||
        idenNormalizada.toLowerCase() !==
          proveedor.identificacion.toLowerCase()
      ) {
        const duplicado = await withDbRetry(() =>
          this.proveedorRepository
            .createQueryBuilder('proveedor')
            .where('LOWER(TRIM(proveedor.identificacion)) = LOWER(:identificacion)', {
              identificacion: idenNormalizada,
            })
            .andWhere('proveedor.id != :id', { id })
            .getOne(),
        );

        if (duplicado) {
          throw new ConflictException(
            `Ya existe otro proveedor registrado con la identificación "${idenNormalizada}"`,
          );
        }
      }
      proveedor.identificacion = idenNormalizada || null;
    } else if (dto.identificacion === null) {
      proveedor.identificacion = null;
    }

    if (dto.razonSocial !== undefined) {
      proveedor.razonSocial = dto.razonSocial?.trim() || null;
    }

    if (dto.telefono !== undefined) {
      proveedor.telefono = dto.telefono?.trim() || null;
    }

    if (dto.correo !== undefined) {
      proveedor.correo = dto.correo?.trim().toLowerCase() || null;
    }

    if (dto.direccion !== undefined) {
      proveedor.direccion = dto.direccion?.trim() || null;
    }

    if (dto.personaContacto !== undefined) {
      proveedor.personaContacto = dto.personaContacto?.trim() || null;
    }

    try {
      return await withDbRetry(() => this.proveedorRepository.save(proveedor));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Error al actualizar el proveedor con ID ${id}:`,
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo actualizar el proveedor en el catálogo',
      );
    }
  }

  /**
   * Cambia el estado operativo de un proveedor (Activo / Inactivo) sin eliminarlo físicamente.
   * Preserva el historial y las relaciones con materiales y compras históricas.
   */
  async cambiarEstadoProveedor(
    id: number,
    activo: boolean,
  ): Promise<Proveedor> {
    const proveedor = await this.findOneProveedor(id);

    proveedor.activo = activo;

    try {
      return await withDbRetry(() => this.proveedorRepository.save(proveedor));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Error al cambiar el estado del proveedor con ID ${id}:`,
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo actualizar el estado del proveedor',
      );
    }
  }

  /**
   * Registra una entrada física de materiales a la bodega de la ASADA.
   *
   * Reglas de negocio fundamentales:
   * 1. Operación atómica: el incremento del stockActual y el registro del MovimientoInventario
   *    se ejecutan dentro de una misma transacción con reintentos para evitar inconsistencias.
   * 2. El material debe existir en el catálogo y estar activo (activo === true).
   * 3. La cantidad debe ser un entero estrictamente positivo (> 0).
   * 4. Si se especifica un proveedor, este debe existir y encontrarse activo.
   * 5. El frontend no calcula existencias; el backend calcula stockActual = stockAnterior + cantidad.
   * 6. Se registra el movimiento con tipo = ENTRADA y el usuario responsable extraído del token JWT.
   */
  async registrarEntrada(
    dto: RegistrarEntradaDto,
    user: AuthenticatedUser,
  ): Promise<ConfirmacionEntradaInventario> {
    const idMaterial = dto.idMaterial ?? dto.materialId;
    if (!idMaterial) {
      throw new BadRequestException(
        'Debe especificar el identificador del material (idMaterial)',
      );
    }

    const userAny = user as unknown as Record<string, unknown>;
    const rawUserId =
      user?.userId ??
      userAny?.id ??
      userAny?.idUsuario ??
      userAny?.sub;
    const idUsuario = Number(rawUserId);
    if (!idUsuario || isNaN(idUsuario)) {
      throw new BadRequestException(
        'No se pudo identificar el usuario responsable de la operación',
      );
    }

    const idProveedor = dto.idProveedor ?? dto.proveedorId ?? null;

    try {
      return await withDbRetry(async () => {
        return await this.materialRepository.manager.transaction(
          async (manager) => {
            const materialRepo = manager.getRepository(Material);
            const movimientoRepo = manager.getRepository(MovimientoInventario);
            const proveedorRepo = manager.getRepository(Proveedor);

            const material = await materialRepo.findOne({
              where: { id: idMaterial },
            });

            if (!material) {
              throw new NotFoundException(
                `Material con ID ${idMaterial} no encontrado en el inventario`,
              );
            }

            if (!material.activo) {
              throw new BadRequestException(
                `No se pueden registrar entradas para el material "${material.nombre}" porque se encuentra inactivo`,
              );
            }

            let proveedor: Proveedor | null = null;
            if (idProveedor !== null && idProveedor !== undefined) {
              proveedor = await proveedorRepo.findOne({
                where: { id: idProveedor },
              });

              if (!proveedor) {
                throw new NotFoundException(
                  `Proveedor con ID ${idProveedor} no encontrado en el catálogo`,
                );
              }

              if (!proveedor.activo) {
                throw new BadRequestException(
                  `El proveedor "${proveedor.nombre}" se encuentra inactivo y no puede ser seleccionado para entradas`,
                );
              }
            }

            const stockAnterior = material.stockActual;
            const stockActual = stockAnterior + dto.cantidad;

            material.stockActual = stockActual;
            await materialRepo.save(material);

            const movimiento = movimientoRepo.create({
              tipo: TipoMovimientoInventario.ENTRADA,
              cantidad: dto.cantidad,
              fechaMovimiento: dto.fechaMovimiento ?? new Date(),
              observacion: dto.observacion ? dto.observacion.trim() : null,
              idMaterial: material.id,
              idUsuario,
              idProveedor: proveedor ? proveedor.id : (idProveedor || null),
            });

            const movimientoGuardado = await movimientoRepo.save(movimiento);

            this.logger.log(
              `Entrada registrada con éxito: Material "${material.nombre}" (ID: ${material.id}), +${dto.cantidad} unidades (Stock: ${stockAnterior} -> ${stockActual}), Movimiento ID: ${movimientoGuardado.id}, Usuario ID: ${idUsuario}`,
            );

            return {
              movimiento: movimientoGuardado,
              material,
              stockAnterior,
              stockActual,
              mensaje: `Entrada física registrada exitosamente. Se ingresaron ${dto.cantidad} unidades de "${material.nombre}". Stock actualizado de ${stockAnterior} a ${stockActual}.`,
            };
          },
        );
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Error al registrar entrada de inventario para el material con ID ${idMaterial}:`,
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo registrar la entrada de inventario',
      );
    }
  }

  /**
   * Adjunta un archivo de respaldo (factura, recibo, comprobante) a un movimiento de inventario.
   */
  async adjuntarDocumentoMovimiento(
    movimientoId: number,
    file: MovimientoDocumentFile,
    user?: AuthenticatedUser,
  ): Promise<DocumentoMovimientoInventario> {
    if (!movimientoId || isNaN(movimientoId) || movimientoId <= 0) {
      throw new BadRequestException('ID de movimiento inválido');
    }

    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo de respaldo');
    }

    const movimiento = await withDbRetry(() =>
      this.movimientoRepository.findOne({
        where: { id: movimientoId },
      }),
    );

    if (!movimiento) {
      throw new NotFoundException(
        `Movimiento de inventario con ID ${movimientoId} no encontrado`,
      );
    }

    // Validar y guardar físicamente el archivo de respaldo de forma segura
    const { rutaReferenciaArchivo, filename } = saveMovimientoDocument(
      movimientoId,
      file,
    );

    try {
      const nuevoDoc = this.documentoMovimientoRepository.create({
        nombreOriginal: file.originalname || filename,
        tipoArchivo: file.mimetype,
        rutaReferenciaArchivo,
        tamanio: file.size,
        idMovimiento: movimientoId,
      });

      const documentoGuardado = await withDbRetry(() =>
        this.documentoMovimientoRepository.save(nuevoDoc),
      );

      this.logger.log(
        `Documento adjuntado exitosamente al movimiento ${movimientoId}: "${nuevoDoc.nombreOriginal}" (ID: ${documentoGuardado.id}) por usuario ${user?.userId ?? (user as any)?.idUsuario ?? 'sistema'}`,
      );

      return documentoGuardado;
    } catch (dbError) {
      // Rollback físico si falla la persistencia en base de datos
      deleteMovimientoDocument(movimientoId, rutaReferenciaArchivo);
      this.logger.error(
        `Error al persistir documento para el movimiento ${movimientoId}:`,
        dbError,
      );
      throw new InternalServerErrorException(
        'No se pudo registrar el documento en la base de datos',
      );
    }
  }

  /**
   * Lista todos los documentos de respaldo asociados a un movimiento de inventario.
   */
  async listarDocumentosMovimiento(
    movimientoId: number,
  ): Promise<DocumentoMovimientoInventario[]> {
    if (!movimientoId || isNaN(movimientoId) || movimientoId <= 0) {
      throw new BadRequestException('ID de movimiento inválido');
    }

    const movimiento = await withDbRetry(() =>
      this.movimientoRepository.findOne({
        where: { id: movimientoId },
      }),
    );

    if (!movimiento) {
      throw new NotFoundException(
        `Movimiento de inventario con ID ${movimientoId} no encontrado`,
      );
    }

    return await withDbRetry(() =>
      this.documentoMovimientoRepository.find({
        where: { idMovimiento: movimientoId },
        order: { createdAt: 'DESC' },
      }),
    );
  }

  /**
   * Obtiene la ruta física absoluta y el tipo MIME de un documento de respaldo
   * para su descarga o visualización segura, validando que pertenezca al movimiento indicado.
   */
  async obtenerArchivoDocumento(
    movimientoId: number,
    filename: string,
  ): Promise<{
    absolutePath: string;
    mimeType: string;
    documento: DocumentoMovimientoInventario;
  }> {
    if (!movimientoId || isNaN(movimientoId) || movimientoId <= 0) {
      throw new BadRequestException('ID de movimiento inválido');
    }

    const movimiento = await withDbRetry(() =>
      this.movimientoRepository.findOne({
        where: { id: movimientoId },
      }),
    );

    if (!movimiento) {
      throw new NotFoundException(
        `Movimiento de inventario con ID ${movimientoId} no encontrado`,
      );
    }

    const { absolutePath, mimeType } = getMovimientoDocumentFilePath(
      movimientoId,
      filename,
    );

    const suffix = `/documentos/${filename}`;
    const documentos = await withDbRetry(() =>
      this.documentoMovimientoRepository.find({
        where: { idMovimiento: movimientoId },
      }),
    );

    const docEncontrado = documentos.find((d) =>
      d.rutaReferenciaArchivo.endsWith(suffix),
    );

    if (!docEncontrado) {
      throw new NotFoundException(
        'El registro del documento no existe en la base de datos',
      );
    }

    return {
      absolutePath,
      mimeType,
      documento: docEncontrado,
    };
  }
}

