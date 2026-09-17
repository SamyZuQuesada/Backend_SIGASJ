import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { EstadoAlertaReposicion } from '../../common/enums/estado-alerta-reposicion.enum';
import { EstadoReposicionMaterial } from '../../common/enums/estado-reposicion-material.enum';
import {
  esTransicionEstadoReposicionValida,
  MENSAJE_TRANSICIONES_ESTADO_REPOSICION,
} from '../../common/enums/estado-reposicion-material.transitions';
import { OrigenReposicionMaterial } from '../../common/enums/origen-reposicion-material.enum';
import { EstadoSolicitudMaterial } from '../../common/enums/estado-solicitud-material.enum';
import { Role } from '../../common/enums/role.enum';
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
import { QueryAlertasReposicionDto } from './dto/query-alertas-reposicion.dto';
import { CreateReposicionDesdeAlertaDto } from './dto/create-reposicion-desde-alerta.dto';
import { RegistrarCompraReposicionDto } from './dto/registrar-compra-reposicion.dto';
import { QueryReposicionesDto } from './dto/query-reposiciones.dto';
import { QuerySolicitudesMaterialDto } from './dto/query-solicitudes-material.dto';
import { RegistrarEntradaDto } from './dto/registrar-entrada.dto';
import { RegistrarSalidaDto } from './dto/registrar-salida.dto';
import { RegistrarSolicitudMaterialDto } from './dto/registrar-solicitud-material.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { Averia } from '../averias/entities/averia.entity';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { Material } from './entities/material.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { SolicitudMaterial } from './entities/solicitud-material.entity';
import { DetalleSolicitudMaterial } from './entities/detalle-solicitud-material.entity';
import { AlertaReposicion } from './entities/alerta-reposicion.entity';
import { ReposicionMaterial } from './entities/reposicion-material.entity';
import { DetalleReposicionMaterial } from './entities/detalle-reposicion-material.entity';
import {
  assertStockDisponible,
  ResultadoValidacionStock,
} from './utils/validar-stock.util';

export type { ResultadoValidacionStock };

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

export type ConfirmacionSalidaInventario = {
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
    @Optional()
    @InjectRepository(SolicitudMaterial)
    private readonly solicitudMaterialRepository?: Repository<SolicitudMaterial>,
    @Optional()
    @InjectRepository(DetalleSolicitudMaterial)
    private readonly detalleSolicitudRepository?: Repository<DetalleSolicitudMaterial>,
    @Optional()
    @InjectRepository(Averia)
    private readonly averiaRepository?: Repository<Averia>,
    @Optional()
    @InjectRepository(AlertaReposicion)
    private readonly alertaReposicionRepository?: Repository<AlertaReposicion>,
    @Optional()
    @InjectRepository(ReposicionMaterial)
    private readonly reposicionMaterialRepository?: Repository<ReposicionMaterial>,
    @Optional()
    @InjectRepository(DetalleReposicionMaterial)
    private readonly detalleReposicionRepository?: Repository<DetalleReposicionMaterial>,
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
          throw new NotFoundException(
            `El proveedor con ID ${idProv} no existe`,
          );
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
          throw new NotFoundException(
            `El proveedor con ID ${idProv} no existe`,
          );
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
      const [data, total] = await withDbRetry(async () => {
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

        return await qb.getManyAndCount();
      });

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
      const [data, total] = await withDbRetry(async () => {
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

        return await qb.getManyAndCount();
      });

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        total,
        page,
        limit,
        totalPages: totalPages === 0 && total === 0 ? 0 : totalPages,
      };
    } catch (error) {
      this.logger.error(
        'Error al consultar el catálogo de proveedores:',
        error,
      );
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
        idenNormalizada.toLowerCase() !== proveedor.identificacion.toLowerCase()
      ) {
        const duplicado = await withDbRetry(() =>
          this.proveedorRepository
            .createQueryBuilder('proveedor')
            .where(
              'LOWER(TRIM(proveedor.identificacion)) = LOWER(:identificacion)',
              {
                identificacion: idenNormalizada,
              },
            )
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
      user?.userId ?? userAny?.id ?? userAny?.idUsuario ?? userAny?.sub;
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
              idProveedor: proveedor ? proveedor.id : idProveedor || null,
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
   * Registra una salida física de materiales de la bodega (disminución de existencias).
   *
   * Reglas de negocio críticas:
   * 1. La operación requiere que el material exista y esté activo.
   * 2. La cantidad debe ser un entero estrictamente positivo (> 0).
   * 3. Se verifica la existencia disponible (Regla 4.5.2): si la cantidad solicitada excede el stock actual,
   *    la operación se rechaza inmediatamente para evitar stock negativo.
   * 4. El usuario responsable se extrae estrictamente de la sesión autenticada (JWT), nunca de un parámetro manipulable.
   * 5. Se conserva opcionalmente la referencia a una avería (idAveria) o a una solicitud (idSolicitud).
   * 6. La disminución de stock y la creación del MovimientoInventario (tipo SALIDA) se ejecutan dentro
   *    de una transacción atómica consistente con reintentos para evitar inconsistencias o actualizaciones parciales.
   */
  async registrarSalida(
    dto: RegistrarSalidaDto,
    user: AuthenticatedUser,
  ): Promise<ConfirmacionSalidaInventario> {
    const idMaterial = dto.idMaterial ?? dto.materialId;
    if (!idMaterial) {
      throw new BadRequestException(
        'Debe especificar el identificador del material (idMaterial)',
      );
    }

    const userAny = user as unknown as Record<string, unknown>;
    const rawUserId =
      user?.userId ?? userAny?.id ?? userAny?.idUsuario ?? userAny?.sub;
    const idUsuario = Number(rawUserId);
    if (!idUsuario || isNaN(idUsuario)) {
      throw new BadRequestException(
        'No se pudo identificar el usuario responsable de la operación',
      );
    }

    const idAveria = dto.idAveria ?? dto.averiaId ?? null;
    const idSolicitud = dto.idSolicitud ?? dto.solicitudId ?? null;

    try {
      return await withDbRetry(async () => {
        return await this.materialRepository.manager.transaction(
          async (manager) => {
            const materialRepo = manager.getRepository(Material);
            const movimientoRepo = manager.getRepository(MovimientoInventario);

            const material = await materialRepo.findOne({
              where: { id: idMaterial },
            });

            if (!material) {
              throw new NotFoundException(
                `Material con ID ${idMaterial} no encontrado en el inventario`,
              );
            }

            // Aplicación centralizada de la regla 4.5.2 de existencias disponibles
            const validacionStock = assertStockDisponible(
              material,
              dto.cantidad,
            );

            if (validacionStock.alcanzaStockMinimo) {
              this.logger.warn(
                `Alerta de stock mínimo (Backlog 4.8): Material "${material.nombre}" (ID: ${material.id}) alcanzará nivel crítico (${validacionStock.stockFinal} <= ${material.stockMinimo}) tras la salida.`,
              );
            }

            // Validar existencia de Avería y asignación de Fontanero si se envía idAveria
            if (idAveria !== null && idAveria !== undefined) {
              const averiaIdNum = Number(idAveria);
              if (typeof manager.query === 'function') {
                try {
                  const averias: Array<{
                    id: number;
                    idFontaneroAsignado?: number | null;
                  }> = await manager.query(
                    `SELECT id, idFontaneroAsignado FROM Averia WHERE id = ${averiaIdNum}`,
                  );
                  if (Array.isArray(averias)) {
                    if (averias.length === 0) {
                      throw new NotFoundException(
                        `Avería con ID ${averiaIdNum} no encontrada`,
                      );
                    }
                    const averiaAsignada = averias[0];
                    if (
                      user?.role === Role.FONTANERO &&
                      averiaAsignada.idFontaneroAsignado !== null &&
                      averiaAsignada.idFontaneroAsignado !== undefined &&
                      Number(averiaAsignada.idFontaneroAsignado) !== idUsuario
                    ) {
                      throw new BadRequestException(
                        'No puede registrar salidas de materiales para una avería que no tiene asignada',
                      );
                    }
                  }
                } catch (err) {
                  if (err instanceof HttpException) throw err;
                }
              }
            }

            // Validar existencia de Solicitud si se envía idSolicitud
            if (idSolicitud !== null && idSolicitud !== undefined) {
              const solicitudIdNum = Number(idSolicitud);
              if (typeof manager.query === 'function') {
                try {
                  const solicitudes: Array<{
                    idSolicitud: number;
                    estado?: string | null;
                  }> = await manager.query(
                    `SELECT idSolicitud, estado FROM SolicitudServicio WHERE idSolicitud = ${solicitudIdNum}`,
                  );
                  if (Array.isArray(solicitudes)) {
                    if (solicitudes.length === 0) {
                      throw new NotFoundException(
                        `Solicitud con ID ${solicitudIdNum} no encontrada`,
                      );
                    }
                  }
                } catch (err) {
                  if (err instanceof HttpException) throw err;
                }
              }
            }

            const stockAnterior = material.stockActual;
            const stockActual = validacionStock.stockFinal;

            material.stockActual = stockActual;
            await materialRepo.save(material);

            const movimiento = movimientoRepo.create({
              tipo: TipoMovimientoInventario.SALIDA,
              cantidad: dto.cantidad,
              fechaMovimiento: dto.fechaMovimiento ?? new Date(),
              observacion: dto.observacion ? dto.observacion.trim() : null,
              idMaterial: material.id,
              idUsuario,
              idAveria: idAveria ? Number(idAveria) : null,
              idSolicitud: idSolicitud ? Number(idSolicitud) : null,
            });

            const movimientoGuardado = await movimientoRepo.save(movimiento);

            await this.evaluarYGenerarAlertaReposicion(material, manager);

            this.logger.log(
              `Salida registrada con éxito: Material "${material.nombre}" (ID: ${material.id}), -${dto.cantidad} unidades (Stock: ${stockAnterior} -> ${stockActual}), Movimiento ID: ${movimientoGuardado.id}, Usuario ID: ${idUsuario}`,
            );

            return {
              movimiento: movimientoGuardado,
              material,
              stockAnterior,
              stockActual,
              mensaje: `Salida física registrada exitosamente. Se retiraron ${dto.cantidad} unidades de "${material.nombre}". Stock actualizado de ${stockAnterior} a ${stockActual}.`,
            };
          },
        );
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Error al registrar salida de inventario para el material con ID ${idMaterial}:`,
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo registrar la salida de inventario',
      );
    }
  }

  /**
   * Evalúa el stock del material después de una operación que reduce existencias
   * y genera una alerta de reposición cuando stockActual <= stockMinimo.
   *
   * No duplica alertas en estado PENDIENTE o EN_GESTION. Una alerta RESUELTA
   * permite generar una nueva si el stock vuelve a caer al umbral.
   * Un fallo al persistir la alerta no revierte la operación de inventario.
   */
  async evaluarYGenerarAlertaReposicion(
    material: Material,
    manager?: EntityManager,
  ): Promise<AlertaReposicion | null> {
    try {
      const stockActual = material.stockActual ?? 0;
      const stockMinimo = material.stockMinimo ?? 0;

      if (stockActual > stockMinimo) {
        return null;
      }

      const alertaRepo =
        manager?.getRepository(AlertaReposicion) ??
        this.alertaReposicionRepository;

      if (!alertaRepo) {
        this.logger.warn(
          `No se evaluó alerta de reposición para el material ID ${material.id}: repositorio no disponible`,
        );
        return null;
      }

      const alertaActiva = await alertaRepo.findOne({
        where: {
          idMaterial: material.id,
          estado: In([
            EstadoAlertaReposicion.PENDIENTE,
            EstadoAlertaReposicion.EN_GESTION,
          ]),
        },
      });

      if (alertaActiva) {
        this.logger.log(
          `Alerta de reposición activa ya existe para el material "${material.nombre}" (ID: ${material.id}, alerta ${alertaActiva.id}, estado ${alertaActiva.estado}). No se duplica.`,
        );
        return alertaActiva;
      }

      const alerta = alertaRepo.create({
        idMaterial: material.id,
        stockActual,
        stockMinimo,
        estado: EstadoAlertaReposicion.PENDIENTE,
        fechaGeneracion: new Date(),
        idUsuarioGestiona: null,
      });

      const guardada = await alertaRepo.save(alerta);
      this.logger.warn(
        `Alerta de reposición generada: Material "${material.nombre}" (ID: ${material.id}), stock ${stockActual} <= mínimo ${stockMinimo}. Alerta ID: ${guardada.id}`,
      );
      return guardada;
    } catch (error) {
      this.logger.error(
        `No se pudo generar la alerta de reposición para el material ID ${material.id}. La operación de inventario no se revierte.`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  /**
   * Listado administrativo de alertas de reposición (3.8.3).
   * No modifica stock. Ordena desde las más recientes.
   */
  async listarAlertasReposicionAdmin(
    query?: QueryAlertasReposicionDto,
  ): Promise<{
    data: Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const alertaRepo =
      this.alertaReposicionRepository ??
      this.materialRepository.manager.getRepository(AlertaReposicion);

    const take = query?.limit && query.limit > 0 ? Number(query.limit) : 10;
    const pageNum = query?.page && query.page > 0 ? Number(query.page) : 1;

    try {
      return await withDbRetry(async () => {
        const qb = alertaRepo
          .createQueryBuilder('alerta')
          .leftJoinAndSelect('alerta.material', 'material')
          .leftJoinAndSelect('alerta.usuarioGestiona', 'usuarioGestiona');

        if (query?.estado) {
          qb.where('alerta.estado = :estado', { estado: query.estado });
        }

        qb.orderBy('alerta.fechaGeneracion', 'DESC').addOrderBy(
          'alerta.id',
          'DESC',
        );

        const total = await qb.getCount();
        const skip = (pageNum - 1) * take;
        qb.skip(skip).take(take);
        const alertas = await qb.getMany();

        const data = alertas.map((alerta) => this.mapAlertaReposicionAdmin(alerta));

        return {
          data,
          total,
          page: pageNum,
          limit: take,
          totalPages: Math.ceil(total / take) || 0,
        };
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        'Error al consultar las alertas de reposición:',
        error,
      );
      throw new InternalServerErrorException(
        'No se pudieron consultar las alertas de reposición',
      );
    }
  }

  /**
   * Actualiza el estado de una alerta de reposición (3.8.6).
   * Flujo: PENDIENTE → EN_GESTION → RESUELTA. No se permite saltar ni revertir.
   * Registra a la administradora responsable y actualiza updatedAt.
   */
  async cambiarEstadoAlertaReposicionAdmin(
    id: number,
    estado: EstadoAlertaReposicion,
    user: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    if (!id || !Number.isInteger(id) || id <= 0) {
      throw new BadRequestException(
        'El identificador de la alerta debe ser un número entero mayor a cero',
      );
    }

    const rawUserId = user?.idUsuario ?? user?.userId;
    const idUsuario = Number(rawUserId);
    if (!idUsuario || Number.isNaN(idUsuario)) {
      throw new BadRequestException(
        'No se pudo identificar a la administradora responsable',
      );
    }

    const siguientePermitido: Record<
      EstadoAlertaReposicion,
      EstadoAlertaReposicion | null
    > = {
      [EstadoAlertaReposicion.PENDIENTE]: EstadoAlertaReposicion.EN_GESTION,
      [EstadoAlertaReposicion.EN_GESTION]: EstadoAlertaReposicion.RESUELTA,
      [EstadoAlertaReposicion.RESUELTA]: null,
    };

    const alertaRepo =
      this.alertaReposicionRepository ??
      this.materialRepository.manager.getRepository(AlertaReposicion);

    try {
      return await withDbRetry(async () => {
        const alerta = await alertaRepo.findOne({
          where: { id },
          relations: { material: true, usuarioGestiona: true },
        });

        if (!alerta) {
          throw new NotFoundException(
            `Alerta de reposición con ID ${id} no encontrada`,
          );
        }

        if (alerta.estado === estado) {
          throw new BadRequestException(
            `La alerta ya se encuentra en estado ${alerta.estado}`,
          );
        }

        const esperado = siguientePermitido[alerta.estado];
        if (esperado !== estado) {
          throw new BadRequestException(
            `No se puede cambiar una alerta de ${alerta.estado} a ${estado}. ` +
              'Las transiciones permitidas son PENDIENTE → EN_GESTION → RESUELTA.',
          );
        }

        alerta.estado = estado;
        alerta.idUsuarioGestiona = idUsuario;
        await alertaRepo.save(alerta);

        const actualizada = await alertaRepo.findOne({
          where: { id },
          relations: { material: true, usuarioGestiona: true },
        });

        return this.mapAlertaReposicionAdmin(actualizada ?? alerta);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Error al actualizar el estado de la alerta de reposición ${id}:`,
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo actualizar el estado de la alerta de reposición',
      );
    }
  }

  /**
   * Genera una reposición a partir de una alerta de stock mínimo (3.9.2).
   * No modifica existencias. Evita duplicar una reposición activa de la misma alerta.
   */
  async generarReposicionDesdeAlertaAdmin(
    idAlerta: number,
    user: AuthenticatedUser,
    dto?: CreateReposicionDesdeAlertaDto,
  ): Promise<Record<string, unknown>> {
    if (!idAlerta || !Number.isInteger(idAlerta) || idAlerta <= 0) {
      throw new BadRequestException(
        'El identificador de la alerta debe ser un número entero mayor a cero',
      );
    }

    const rawUserId = user?.idUsuario ?? user?.userId;
    const idUsuario = Number(rawUserId);
    if (!idUsuario || Number.isNaN(idUsuario)) {
      throw new BadRequestException(
        'No se pudo identificar a la administradora responsable',
      );
    }

    const estadosActivos = [
      EstadoReposicionMaterial.PENDIENTE,
      EstadoReposicionMaterial.EN_GESTION,
      EstadoReposicionMaterial.COMPRA_REGISTRADA,
      EstadoReposicionMaterial.PENDIENTE_RECEPCION,
      EstadoReposicionMaterial.RECIBIDA,
    ];

    try {
      return await withDbRetry(async () => {
        return await this.materialRepository.manager.transaction(async (manager) => {
          const alertaRepo = manager.getRepository(AlertaReposicion);
          const reposicionRepo = manager.getRepository(ReposicionMaterial);
          const detalleRepo = manager.getRepository(DetalleReposicionMaterial);

          const alerta = await alertaRepo.findOne({
            where: { id: idAlerta },
            relations: { material: true },
          });

          if (!alerta) {
            throw new NotFoundException(
              `Alerta de reposición con ID ${idAlerta} no encontrada`,
            );
          }

          if (alerta.estado === EstadoAlertaReposicion.RESUELTA) {
            throw new BadRequestException(
              'La alerta ya fue resuelta y no requiere una nueva reposición',
            );
          }

          const material = alerta.material;
          if (!material || !alerta.idMaterial) {
            throw new BadRequestException(
              'La alerta no está asociada a un material válido',
            );
          }

          if (!material.activo) {
            throw new BadRequestException(
              `El material "${material.nombre}" se encuentra inactivo y no puede reponerse`,
            );
          }

          const duplicada = await reposicionRepo.findOne({
            where: {
              idAlertaReposicion: alerta.id,
              estado: In(estadosActivos),
            },
          });

          if (duplicada) {
            throw new ConflictException(
              `Ya existe una reposición activa (${duplicada.codigo ?? duplicada.id}) para esta alerta`,
            );
          }

          const cantidad =
            dto?.cantidad ??
            Math.max(alerta.stockMinimo - alerta.stockActual, 1);

          const totalReposiciones = await reposicionRepo.count();
          const codigo = `REP-${String(totalReposiciones + 1).padStart(4, '0')}`;

          const stockAntes = material.stockActual;
          const nueva = reposicionRepo.create({
            codigo,
            fechaGeneracion: new Date(),
            origen: OrigenReposicionMaterial.ALERTA_STOCK_MINIMO,
            estado: EstadoReposicionMaterial.PENDIENTE,
            idAlertaReposicion: alerta.id,
            idSolicitudMaterial: null,
            idUsuarioResponsable: idUsuario,
            observacion: dto?.observacion?.trim() || null,
            detalles: [
              detalleRepo.create({
                idMaterial: material.id,
                cantidad,
              }),
            ],
          });

          const guardada = await reposicionRepo.save(nueva);
          const recargada = await reposicionRepo.findOne({
            where: { id: guardada.id },
            relations: {
              detalles: { material: true },
              alertaReposicion: true,
              usuarioResponsable: true,
            },
          });

          const materialDespues = await manager.getRepository(Material).findOne({
            where: { id: material.id },
          });
          if (
            materialDespues &&
            materialDespues.stockActual !== stockAntes
          ) {
            this.logger.warn(
              `La generación de reposición no debe alterar stock. Material ${material.id} cambió de ${stockAntes} a ${materialDespues.stockActual}`,
            );
          }

          return this.mapReposicionMaterialAdmin(recargada ?? guardada);
        });
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Error al generar reposición desde la alerta ${idAlerta}:`,
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo generar la reposición a partir de la alerta',
      );
    }
  }

  /**
   * Listado administrativo de reposiciones de materiales (3.9.4).
   */
  async listarReposicionesAdmin(
    query?: QueryReposicionesDto,
  ): Promise<{
    data: Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const reposicionRepo =
      this.reposicionMaterialRepository ??
      this.materialRepository.manager.getRepository(ReposicionMaterial);

    const take = query?.limit && query.limit > 0 ? Number(query.limit) : 10;
    const pageNum = query?.page && query.page > 0 ? Number(query.page) : 1;

    try {
      return await withDbRetry(async () => {
        const countQb = reposicionRepo.createQueryBuilder('reposicion');

        if (query?.estado) {
          countQb.andWhere('reposicion.estado = :estado', { estado: query.estado });
        }

        if (query?.origen) {
          countQb.andWhere('reposicion.origen = :origen', { origen: query.origen });
        }

        const total = await countQb.getCount();

        const qb = reposicionRepo
          .createQueryBuilder('reposicion')
          .leftJoinAndSelect('reposicion.detalles', 'detalle')
          .leftJoinAndSelect('detalle.material', 'material')
          .leftJoinAndSelect('reposicion.proveedor', 'proveedor')
          .leftJoinAndSelect('reposicion.usuarioResponsable', 'usuarioResponsable');

        if (query?.estado) {
          qb.andWhere('reposicion.estado = :estado', { estado: query.estado });
        }

        if (query?.origen) {
          qb.andWhere('reposicion.origen = :origen', { origen: query.origen });
        }

        qb.orderBy('reposicion.fechaGeneracion', 'DESC').addOrderBy(
          'reposicion.id',
          'DESC',
        );

        const skip = (pageNum - 1) * take;
        qb.skip(skip).take(take);
        const reposiciones = await qb.getMany();

        return {
          data: reposiciones.map((reposicion) =>
            this.mapReposicionMaterialAdmin(reposicion),
          ),
          total,
          page: pageNum,
          limit: take,
          totalPages: Math.ceil(total / take) || 0,
        };
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Error al consultar las reposiciones de materiales:', error);
      throw new InternalServerErrorException(
        'No se pudieron consultar las reposiciones de materiales',
      );
    }
  }

  /**
   * Detalle administrativo de una reposición (3.9.4).
   */
  async obtenerReposicionAdmin(id: number): Promise<Record<string, unknown>> {
    if (!id || !Number.isInteger(id) || id <= 0) {
      throw new BadRequestException(
        'El identificador de la reposición debe ser un número entero mayor a cero',
      );
    }

    const reposicionRepo =
      this.reposicionMaterialRepository ??
      this.materialRepository.manager.getRepository(ReposicionMaterial);

    try {
      const reposicion = await withDbRetry(() =>
        reposicionRepo.findOne({
          where: { id },
          relations: {
            detalles: { material: true },
            proveedor: true,
            usuarioResponsable: true,
            alertaReposicion: true,
            solicitudMaterial: true,
          },
        }),
      );

      if (!reposicion) {
        throw new NotFoundException(`Reposición con ID ${id} no encontrada`);
      }

      return this.mapReposicionMaterialAdmin(reposicion);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error al consultar la reposición ${id}:`, error);
      throw new InternalServerErrorException(
        'No se pudo consultar la reposición de materiales',
      );
    }
  }

  /**
   * Registra la compra asociada a una reposición (3.9.3).
   * No modifica existencias. Actualiza proveedor, fecha, detalles y estado.
   */
  async registrarCompraReposicionAdmin(
    idReposicion: number,
    dto: RegistrarCompraReposicionDto,
    user: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    if (!idReposicion || !Number.isInteger(idReposicion) || idReposicion <= 0) {
      throw new BadRequestException(
        'El identificador de la reposición debe ser un número entero mayor a cero',
      );
    }

    const rawUserId = user?.idUsuario ?? user?.userId;
    const idUsuario = Number(rawUserId);
    if (!idUsuario || Number.isNaN(idUsuario)) {
      throw new BadRequestException(
        'No se pudo identificar a la administradora responsable',
      );
    }

    const idProveedor = dto.idProveedor ?? dto.proveedorId;
    if (!idProveedor || !Number.isInteger(idProveedor) || idProveedor <= 0) {
      throw new BadRequestException(
        'El identificador del proveedor es obligatorio y debe ser mayor a cero',
      );
    }

    const estadosPermitidos = [
      EstadoReposicionMaterial.PENDIENTE,
      EstadoReposicionMaterial.EN_GESTION,
    ];

    try {
      return await withDbRetry(async () => {
        return await this.materialRepository.manager.transaction(async (manager) => {
          const reposicionRepo = manager.getRepository(ReposicionMaterial);
          const detalleRepo = manager.getRepository(DetalleReposicionMaterial);
          const materialRepo = manager.getRepository(Material);
          const proveedorRepo = manager.getRepository(Proveedor);

          const reposicion = await reposicionRepo.findOne({
            where: { id: idReposicion },
            relations: { detalles: { material: true } },
          });

          if (!reposicion) {
            throw new NotFoundException(
              `Reposición con ID ${idReposicion} no encontrada`,
            );
          }

          if (!estadosPermitidos.includes(reposicion.estado)) {
            if (
              reposicion.estado === EstadoReposicionMaterial.COMPRA_REGISTRADA ||
              reposicion.estado === EstadoReposicionMaterial.PENDIENTE_RECEPCION
            ) {
              throw new ConflictException(
                `La reposición ${reposicion.codigo ?? reposicion.id} ya tiene una compra registrada`,
              );
            }

            throw new BadRequestException(
              `No se puede registrar una compra cuando la reposición está en estado ${reposicion.estado}`,
            );
          }

          if (!reposicion.detalles?.length) {
            throw new BadRequestException(
              'La reposición no tiene materiales asociados para registrar la compra',
            );
          }

          const proveedor = await proveedorRepo.findOne({
            where: { id: idProveedor },
          });

          if (!proveedor) {
            throw new NotFoundException(
              `Proveedor con ID ${idProveedor} no encontrado`,
            );
          }

          if (!proveedor.activo) {
            throw new BadRequestException(
              `El proveedor "${proveedor.nombre}" se encuentra inactivo y no puede utilizarse`,
            );
          }

          const idsReposicion = new Set(
            reposicion.detalles.map((detalle) => detalle.idMaterial),
          );
          const idsCompra = new Set<number>();

          for (const item of dto.detalles) {
            const idMaterial = item.idMaterial ?? item.materialId;
            if (!idMaterial || !Number.isInteger(idMaterial) || idMaterial <= 0) {
              throw new BadRequestException(
                'Cada detalle de compra debe indicar un material válido',
              );
            }

            if (idsCompra.has(idMaterial)) {
              throw new BadRequestException(
                `El material ${idMaterial} está repetido en los detalles de la compra`,
              );
            }
            idsCompra.add(idMaterial);

            if (!idsReposicion.has(idMaterial)) {
              throw new BadRequestException(
                `El material ${idMaterial} no pertenece a la reposición ${reposicion.codigo ?? reposicion.id}`,
              );
            }

            const material = await materialRepo.findOne({
              where: { id: idMaterial },
            });

            if (!material) {
              throw new NotFoundException(
                `Material con ID ${idMaterial} no encontrado`,
              );
            }

            if (!material.activo) {
              throw new BadRequestException(
                `El material "${material.nombre}" se encuentra inactivo y no puede comprarse`,
              );
            }
          }

          if (idsCompra.size !== idsReposicion.size) {
            throw new BadRequestException(
              'Debe registrar la compra de todos los materiales incluidos en la reposición',
            );
          }

          const stocksAntes = new Map<number, number>();
          for (const detalle of reposicion.detalles) {
            stocksAntes.set(detalle.idMaterial, detalle.material?.stockActual ?? 0);
          }

          for (const item of dto.detalles) {
            const idMaterial = item.idMaterial ?? item.materialId;
            const detalle = reposicion.detalles.find(
              (d) => d.idMaterial === idMaterial,
            );
            if (!detalle) {
              continue;
            }

            detalle.cantidad = item.cantidad;
            if (item.observacion !== undefined) {
              detalle.observacion = item.observacion?.trim() || null;
            }
            await detalleRepo.save(detalle);
          }

          reposicion.idProveedor = proveedor.id;
          reposicion.fechaCompra = dto.fechaCompra;
          reposicion.idUsuarioResponsable = idUsuario;
          reposicion.estado = EstadoReposicionMaterial.PENDIENTE_RECEPCION;
          reposicion.observacion = this.construirObservacionCompra(
            dto.referenciaCompra,
            dto.observacion,
          );

          await reposicionRepo.save(reposicion);

          const recargada = await reposicionRepo.findOne({
            where: { id: reposicion.id },
            relations: {
              detalles: { material: true },
              proveedor: true,
              usuarioResponsable: true,
            },
          });

          for (const [idMaterial, stockAntes] of stocksAntes) {
            const materialDespues = await materialRepo.findOne({
              where: { id: idMaterial },
            });
            if (
              materialDespues &&
              materialDespues.stockActual !== stockAntes
            ) {
              this.logger.warn(
                `Registrar compra no debe alterar stock. Material ${idMaterial} cambió de ${stockAntes} a ${materialDespues.stockActual}`,
              );
            }
          }

          return this.mapReposicionMaterialAdmin(recargada ?? reposicion);
        });
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Error al registrar compra de la reposición ${idReposicion}:`,
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo registrar la compra de la reposición',
      );
    }
  }

  /**
   * Actualiza el estado de una reposición de materiales (3.9.6).
   * Valida transiciones, registra responsable y updatedAt. No modifica existencias.
   */
  async cambiarEstadoReposicionAdmin(
    id: number,
    estado: EstadoReposicionMaterial,
    user: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    if (!id || !Number.isInteger(id) || id <= 0) {
      throw new BadRequestException(
        'El identificador de la reposición debe ser un número entero mayor a cero',
      );
    }

    const rawUserId = user?.idUsuario ?? user?.userId;
    const idUsuario = Number(rawUserId);
    if (!idUsuario || Number.isNaN(idUsuario)) {
      throw new BadRequestException(
        'No se pudo identificar a la administradora responsable',
      );
    }

    const reposicionRepo =
      this.reposicionMaterialRepository ??
      this.materialRepository.manager.getRepository(ReposicionMaterial);

    try {
      return await withDbRetry(async () => {
        const reposicion = await reposicionRepo.findOne({
          where: { id },
          relations: {
            detalles: { material: true },
            proveedor: true,
            usuarioResponsable: true,
          },
        });

        if (!reposicion) {
          throw new NotFoundException(`Reposición con ID ${id} no encontrada`);
        }

        if (reposicion.estado === estado) {
          throw new BadRequestException(
            `La reposición ya se encuentra en estado ${reposicion.estado}`,
          );
        }

        if (!esTransicionEstadoReposicionValida(reposicion.estado, estado)) {
          throw new BadRequestException(
            `No se puede cambiar una reposición de ${reposicion.estado} a ${estado}. ${MENSAJE_TRANSICIONES_ESTADO_REPOSICION}`,
          );
        }

        if (
          estado === EstadoReposicionMaterial.PENDIENTE_RECEPCION &&
          (!reposicion.idProveedor || !reposicion.fechaCompra)
        ) {
          throw new BadRequestException(
            'No se puede marcar pendiente de recepción sin una compra registrada',
          );
        }

        if (
          estado === EstadoReposicionMaterial.RECIBIDA &&
          (!reposicion.idProveedor || !reposicion.fechaCompra)
        ) {
          throw new BadRequestException(
            'No se puede marcar como recibida una reposición sin compra registrada',
          );
        }

        if (
          estado === EstadoReposicionMaterial.COMPLETADA &&
          !reposicion.fechaRecepcion
        ) {
          throw new BadRequestException(
            'No se puede completar una reposición que aún no fue recibida',
          );
        }

        reposicion.estado = estado;
        reposicion.idUsuarioResponsable = idUsuario;

        if (
          estado === EstadoReposicionMaterial.RECIBIDA &&
          !reposicion.fechaRecepcion
        ) {
          reposicion.fechaRecepcion = new Date();
        }

        await reposicionRepo.save(reposicion);

        const actualizada = await reposicionRepo.findOne({
          where: { id },
          relations: {
            detalles: { material: true },
            proveedor: true,
            usuarioResponsable: true,
            alertaReposicion: true,
            solicitudMaterial: true,
          },
        });

        return this.mapReposicionMaterialAdmin(actualizada ?? reposicion);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Error al actualizar el estado de la reposición ${id}:`,
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo actualizar el estado de la reposición',
      );
    }
  }

  /**
   * Consulta y valida de manera centralizada la existencia física disponible de un material
   * antes de autorizar cualquier operación de salida (Regla 4.5.2).
   *
   * @param idMaterial Identificador del material en catálogo
   * @param cantidad Cantidad física solicitada a retirar
   * @param customRepo Repositorio opcional (por ejemplo dentro de una transacción activa)
   * @returns Resultado detallado de la validación, cálculo de stock final y datos del material
   */
  async validarDisponibilidadStock(
    idMaterial: number,
    cantidad: number,
    customRepo?: Repository<Material>,
  ): Promise<ResultadoValidacionStock & { material: Material }> {
    if (!idMaterial || isNaN(idMaterial) || idMaterial <= 0) {
      throw new BadRequestException(
        'El identificador del material debe ser un número entero mayor a cero',
      );
    }

    const repo = customRepo ?? this.materialRepository;
    const material = await withDbRetry(() =>
      repo.findOne({
        where: { id: idMaterial },
      }),
    );

    if (!material) {
      throw new NotFoundException(
        `Material con ID ${idMaterial} no encontrado en el inventario`,
      );
    }

    const validacion = assertStockDisponible(material, cantidad);

    return {
      ...validacion,
      material,
    };
  }

  /**
   * Consulta los movimientos de salida vinculados a una avería específica.
   */
  async findMovimientosByAveria(
    idAveria: number,
  ): Promise<MovimientoInventario[]> {
    if (!idAveria || isNaN(idAveria) || idAveria <= 0) {
      throw new BadRequestException('ID de avería inválido');
    }
    return withDbRetry(() =>
      this.movimientoRepository.find({
        where: { idAveria, tipo: TipoMovimientoInventario.SALIDA },
        relations: { material: true },
        order: { id: 'DESC' },
      }),
    );
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
        `Documento adjuntado exitosamente al movimiento ${movimientoId}: "${nuevoDoc.nombreOriginal}" (ID: ${documentoGuardado.id}) por usuario ${user?.userId ?? (user as { idUsuario?: number | string } | undefined)?.idUsuario ?? 'sistema'}`,
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

  /**
   * Registra una solicitud de materiales realizada por un Fontanero.
   *
   * Reglas de negocio fundamentales:
   * 1. La identidad del fontanero solicitante se extrae obligatoriamente del token JWT (no manipulable).
   * 2. Se debe incluir al menos un material, cada uno con cantidad entera estrictamente mayor a 0.
   * 3. Cada material debe existir en el inventario y encontrarse activo (activo === true).
   * 4. Si se especifica una avería, esta debe existir y estar asignada al Fontanero solicitante.
   * 5. Si se repiten materiales en la solicitud, se consolidan automáticamente sumando sus cantidades.
   * 6. Regla crítica de inventario: REGISTRAR UNA SOLICITUD NO MODIFICA NI RESERVA STOCK.
   *    El stockActual de los materiales permanece inmutable; el egreso físico se ejecutará
   *    posteriormente en una salida real autorizada.
   */
  async registrarSolicitudMaterial(
    dto: RegistrarSolicitudMaterialDto,
    user: AuthenticatedUser,
  ): Promise<SolicitudMaterial> {
    const userAny = user as unknown as Record<string, unknown>;
    const rawUserId =
      user?.userId ?? userAny?.id ?? userAny?.idUsuario ?? userAny?.sub;
    const idFontanero = Number(rawUserId);

    if (!idFontanero || isNaN(idFontanero)) {
      throw new BadRequestException(
        'No se pudo identificar el usuario fontanero responsable de la solicitud',
      );
    }

    if (
      !dto.materiales ||
      !Array.isArray(dto.materiales) ||
      dto.materiales.length === 0
    ) {
      throw new BadRequestException(
        'La solicitud debe incluir al menos un material requerido',
      );
    }

    type ItemConsolidado = {
      idMaterial: number;
      cantidad: number;
      observacion: string | null;
    };

    const consolidadoMap = new Map<number, ItemConsolidado>();

    for (const item of dto.materiales) {
      const idMat = item.idMaterial ?? item.materialId;
      if (
        !idMat ||
        typeof idMat !== 'number' ||
        !Number.isInteger(idMat) ||
        idMat <= 0
      ) {
        throw new BadRequestException(
          'Cada ítem debe especificar un identificador de material válido',
        );
      }

      if (
        item.cantidad === undefined ||
        item.cantidad === null ||
        typeof item.cantidad !== 'number' ||
        !Number.isInteger(item.cantidad) ||
        item.cantidad <= 0
      ) {
        throw new BadRequestException(
          'La cantidad solicitada para cada material debe ser un número entero mayor a cero',
        );
      }

      const itemObs = item.observacion ? item.observacion.trim() : null;
      const existing = consolidadoMap.get(idMat);

      if (existing) {
        existing.cantidad += item.cantidad;
        if (itemObs) {
          existing.observacion = existing.observacion
            ? `${existing.observacion}; ${itemObs}`
            : itemObs;
        }
      } else {
        consolidadoMap.set(idMat, {
          idMaterial: idMat,
          cantidad: item.cantidad,
          observacion: itemObs,
        });
      }
    }

    const itemsConsolidados = Array.from(consolidadoMap.values());
    const idAveria = dto.idAveria ?? dto.averiaId ?? null;

    return await withDbRetry(async () => {
      return await this.materialRepository.manager.transaction(
        async (manager) => {
          const materialRepo = manager.getRepository(Material);
          const averiaRepo = manager.getRepository(Averia);
          const solicitudRepo = manager.getRepository(SolicitudMaterial);
          const detalleRepo = manager.getRepository(DetalleSolicitudMaterial);

          // 1. Validar cada material en la lista consolidada
          for (const item of itemsConsolidados) {
            const material = await materialRepo.findOne({
              where: { id: item.idMaterial },
            });

            if (!material) {
              throw new NotFoundException(
                `Material con ID ${item.idMaterial} no encontrado en el inventario`,
              );
            }

            if (!material.activo) {
              throw new BadRequestException(
                `El material "${material.nombre}" se encuentra inactivo y no puede ser solicitado`,
              );
            }
          }

          // 2. Validar avería si viene provista
          let averiaAsociada: Averia | null = null;
          if (idAveria !== null && idAveria !== undefined) {
            averiaAsociada = await averiaRepo.findOne({
              where: { id: idAveria },
            });

            if (!averiaAsociada) {
              throw new NotFoundException(
                `Avería con ID ${idAveria} no encontrada`,
              );
            }

            if (averiaAsociada.idFontaneroAsignado !== idFontanero) {
              throw new ForbiddenException(
                'La avería indicada no está asignada al Fontanero autenticado',
              );
            }
          }

          // 3. Generar código correlativo amigable
          const totalSolicitudes = await solicitudRepo.count();
          const codigo = `SOL-${String(totalSolicitudes + 1).padStart(4, '0')}`;

          // 4. Instanciar y persistir cabecera
          const nuevaSolicitud = solicitudRepo.create({
            codigo,
            fechaSolicitud: new Date(),
            estado: EstadoSolicitudMaterial.PENDIENTE,
            observacion: dto.observacion ? dto.observacion.trim() : null,
            idFontanero,
            idAveria: averiaAsociada ? averiaAsociada.id : null,
          });

          // 5. Instanciar renglones de detalle (sin alterar existencias)
          nuevaSolicitud.detalles = itemsConsolidados.map((item) =>
            detalleRepo.create({
              idMaterial: item.idMaterial,
              cantidad: item.cantidad,
              observacion: item.observacion,
            }),
          );

          const solicitudGuardada = await solicitudRepo.save(nuevaSolicitud);

          return (await solicitudRepo.findOne({
            where: { id: solicitudGuardada.id },
            relations: {
              detalles: {
                material: true,
              },
              averia: true,
              fontanero: true,
            },
          }))!;
        },
      );
    });
  }

  /**
   * Consulta las solicitudes de materiales registradas por el Fontanero autenticado.
   *
   * Admite respuesta directa en arreglo o estructura paginada { data, total, page, limit, totalPages }.
   */
  async listarSolicitudesMaterialFontanero(
    user: AuthenticatedUser,
    query?: QuerySolicitudesMaterialDto,
  ): Promise<any> {
    const idFontanero = Number(user.userId);

    const solicitudRepo =
      this.solicitudMaterialRepository ??
      this.materialRepository.manager.getRepository(SolicitudMaterial);

    return withDbRetry(async () => {
      const qb = solicitudRepo
        .createQueryBuilder('solicitud')
        .leftJoinAndSelect('solicitud.averia', 'averia')
        .leftJoinAndSelect('solicitud.detalles', 'detalles')
        .leftJoinAndSelect('detalles.material', 'material')
        .where('solicitud.idFontanero = :idFontanero', { idFontanero });

      if (query?.estado) {
        qb.andWhere('solicitud.estado = :estado', { estado: query.estado });
      }

      const averiaFiltro = query?.idAveria ?? query?.averiaId;
      if (averiaFiltro) {
        qb.andWhere('solicitud.idAveria = :idAveria', {
          idAveria: averiaFiltro,
        });
      }

      qb.orderBy('solicitud.fechaSolicitud', 'DESC').addOrderBy(
        'solicitud.id',
        'DESC',
      );

      const total = await qb.getCount();

      const isPaginated =
        query?.page !== undefined || query?.limit !== undefined;
      const take = query?.limit && query.limit > 0 ? Number(query.limit) : 10;
      const pageNum = query?.page && query.page > 0 ? Number(query.page) : 1;
      let solicitudes: SolicitudMaterial[];

      if (isPaginated) {
        const skip = (pageNum - 1) * take;

        qb.skip(skip).take(take);
        solicitudes = await qb.getMany();
      } else {
        solicitudes = await qb.getMany();
      }

      const mapItem = (sol: SolicitudMaterial) => {
        const cantidadMateriales = sol.detalles?.length ?? 0;
        const totalMateriales =
          sol.detalles?.reduce((acc, d) => acc + (d.cantidad || 0), 0) ?? 0;

        return {
          id: sol.id,
          codigo: sol.codigo,
          fechaSolicitud: sol.fechaSolicitud,
          estado: sol.estado,
          idFontanero: sol.idFontanero,
          idAveria: sol.idAveria,
          observacion: sol.observacion,
          cantidadMateriales,
          totalMateriales,
          averia: sol.averia
            ? {
                id: sol.averia.id,
                codigo: sol.averia.codigoSeguimiento,
                numero: sol.averia.codigoSeguimiento,
                referencia: sol.averia.codigoSeguimiento,
                codigoSeguimiento: sol.averia.codigoSeguimiento,
              }
            : null,
          detalles: (sol.detalles || []).map((d) => ({
            id: d.id,
            idSolicitud: d.idSolicitud,
            idMaterial: d.idMaterial,
            cantidad: d.cantidad,
            observacion: d.observacion,
            material: d.material
              ? {
                  id: d.material.id,
                  nombre: d.material.nombre,
                  unidadMedida: d.material.unidadMedida,
                  stockActual: d.material.stockActual,
                }
              : null,
          })),
        };
      };

      const mappedData = solicitudes.map(mapItem);

      if (isPaginated) {
        const totalPages = Math.ceil(total / take) || 0;

        return {
          data: mappedData,
          total,
          page: pageNum,
          limit: take,
          totalPages,
        };
      }

      return mappedData;
    });
  }

  /**
   * Listado administrativo de solicitudes de materiales (3.7.1).
   * Por defecto muestra solo PENDIENTE. No modifica stock.
   */
  async listarSolicitudesMaterialAdmin(
    query?: QuerySolicitudesMaterialDto,
  ): Promise<{
    data: Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const solicitudRepo =
      this.solicitudMaterialRepository ??
      this.materialRepository.manager.getRepository(SolicitudMaterial);

    const estado = query?.estado ?? EstadoSolicitudMaterial.PENDIENTE;
    const take = query?.limit && query.limit > 0 ? Number(query.limit) : 10;
    const pageNum = query?.page && query.page > 0 ? Number(query.page) : 1;

    return withDbRetry(async () => {
      const qb = solicitudRepo
        .createQueryBuilder('solicitud')
        .leftJoinAndSelect('solicitud.averia', 'averia')
        .leftJoinAndSelect('solicitud.fontanero', 'fontanero')
        .leftJoinAndSelect('solicitud.detalles', 'detalles')
        .leftJoinAndSelect('detalles.material', 'material')
        .where('solicitud.estado = :estado', { estado });

      const averiaFiltro = query?.idAveria ?? query?.averiaId;
      if (averiaFiltro) {
        qb.andWhere('solicitud.idAveria = :idAveria', {
          idAveria: averiaFiltro,
        });
      }

      qb.orderBy('solicitud.fechaSolicitud', 'DESC').addOrderBy(
        'solicitud.id',
        'DESC',
      );

      const total = await qb.getCount();
      const skip = (pageNum - 1) * take;
      qb.skip(skip).take(take);
      const solicitudes = await qb.getMany();

      const data = solicitudes.map((sol) => {
        const cantidadMateriales = sol.detalles?.length ?? 0;
        const fontaneroNombre = this.nombreUsuarioResumen(sol.fontanero);

        return {
          id: sol.id,
          codigo: sol.codigo,
          fechaSolicitud: sol.fechaSolicitud,
          estado: sol.estado,
          idFontanero: sol.idFontanero,
          fontanero: {
            id: sol.idFontanero,
            nombre: fontaneroNombre,
          },
          idAveria: sol.idAveria,
          cantidadMateriales,
          averia: sol.averia
            ? {
                id: sol.averia.id,
                codigo: sol.averia.codigoSeguimiento,
                codigoSeguimiento: sol.averia.codigoSeguimiento,
              }
            : null,
        };
      });

      return {
        data,
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take) || 0,
      };
    });
  }

  /**
   * Aprueba una solicitud PENDIENTE (3.7.2).
   * No modifica stock. Una solicitud ya procesada no puede aprobarse de nuevo.
   */
  async aprobarSolicitudMaterialAdmin(
    id: number,
    user: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    const solicitudRepo =
      this.solicitudMaterialRepository ??
      this.materialRepository.manager.getRepository(SolicitudMaterial);

    return withDbRetry(async () => {
      const solicitud = await solicitudRepo.findOne({
        where: { id },
        relations: {
          averia: true,
          fontanero: true,
          detalles: { material: true },
        },
      });

      if (!solicitud) {
        throw new NotFoundException(
          `Solicitud de material con ID ${id} no encontrada`,
        );
      }

      return this.aplicarDecisionSolicitudAdmin(
        solicitudRepo,
        solicitud,
        user,
        EstadoSolicitudMaterial.APROBADA,
      );
    });
  }

  /**
   * Rechaza una solicitud PENDIENTE (3.7.3).
   * Motivo opcional. No modifica stock. Una solicitud ya procesada no se reabre.
   */
  async rechazarSolicitudMaterialAdmin(
    id: number,
    user: AuthenticatedUser,
    motivoRechazo?: string,
  ): Promise<Record<string, unknown>> {
    const solicitudRepo =
      this.solicitudMaterialRepository ??
      this.materialRepository.manager.getRepository(SolicitudMaterial);

    return withDbRetry(async () => {
      const solicitud = await solicitudRepo.findOne({
        where: { id },
        relations: {
          averia: true,
          fontanero: true,
          detalles: { material: true },
        },
      });

      if (!solicitud) {
        throw new NotFoundException(
          `Solicitud de material con ID ${id} no encontrada`,
        );
      }

      return this.aplicarDecisionSolicitudAdmin(
        solicitudRepo,
        solicitud,
        user,
        EstadoSolicitudMaterial.RECHAZADA,
        motivoRechazo,
      );
    });
  }

  private async aplicarDecisionSolicitudAdmin(
    solicitudRepo: Repository<SolicitudMaterial>,
    solicitud: SolicitudMaterial,
    user: AuthenticatedUser,
    estadoDestino: EstadoSolicitudMaterial,
    motivoRechazo?: string,
  ): Promise<Record<string, unknown>> {
    if (solicitud.estado !== EstadoSolicitudMaterial.PENDIENTE) {
      const accion =
        estadoDestino === EstadoSolicitudMaterial.APROBADA
          ? 'aprobar'
          : 'rechazar';
      throw new BadRequestException(
        `Solo se puede ${accion} una solicitud en estado PENDIENTE. Estado actual: ${solicitud.estado}`,
      );
    }

    solicitud.estado = estadoDestino;
    solicitud.fechaRevision = new Date();
    solicitud.idUsuarioAprobador = Number(user.userId);
    solicitud.motivoRechazo =
      estadoDestino === EstadoSolicitudMaterial.RECHAZADA
        ? motivoRechazo?.trim() || null
        : null;

    await solicitudRepo.save(solicitud);

    const persistida = await solicitudRepo.findOne({
      where: { id: solicitud.id },
      relations: {
        averia: true,
        fontanero: true,
        detalles: { material: true },
      },
    });

    return this.mapSolicitudAdminDecision(persistida ?? solicitud);
  }

  /**
   * Detalle administrativo de una solicitud (3.7.5).
   * Incluye materiales, cantidades, unidad y stock actual. No modifica existencias.
   */
  async obtenerSolicitudMaterialAdmin(
    id: number,
  ): Promise<Record<string, unknown>> {
    const solicitudRepo =
      this.solicitudMaterialRepository ??
      this.materialRepository.manager.getRepository(SolicitudMaterial);

    return withDbRetry(async () => {
      const solicitud = await solicitudRepo.findOne({
        where: { id },
        relations: {
          averia: true,
          fontanero: true,
          usuarioAprobador: true,
          detalles: { material: true },
        },
      });

      if (!solicitud) {
        throw new NotFoundException(
          `Solicitud de material con ID ${id} no encontrada`,
        );
      }

      return this.mapSolicitudAdminDecision(solicitud);
    });
  }

  private mapSolicitudAdminDecision(
    solicitud: SolicitudMaterial,
  ): Record<string, unknown> {
    const cantidadMateriales = solicitud.detalles?.length ?? 0;
    const totalMateriales =
      solicitud.detalles?.reduce((acc, d) => acc + (d.cantidad || 0), 0) ?? 0;

    return {
      id: solicitud.id,
      codigo: solicitud.codigo,
      fechaSolicitud: solicitud.fechaSolicitud,
      estado: solicitud.estado,
      idFontanero: solicitud.idFontanero,
      fontanero: {
        id: solicitud.idFontanero,
        nombre: this.nombreUsuarioResumen(solicitud.fontanero),
      },
      idAveria: solicitud.idAveria,
      observacion: solicitud.observacion,
      cantidadMateriales,
      totalMateriales,
      idUsuarioAprobador: solicitud.idUsuarioAprobador,
      fechaRevision: solicitud.fechaRevision,
      motivoRechazo: solicitud.motivoRechazo,
      updatedAt: solicitud.updatedAt,
      usuarioAprobador: solicitud.idUsuarioAprobador
        ? {
            id: solicitud.idUsuarioAprobador,
            nombre: this.nombreUsuarioResumen(solicitud.usuarioAprobador),
          }
        : null,
      averia: solicitud.averia
        ? {
            id: solicitud.averia.id,
            codigo: solicitud.averia.codigoSeguimiento,
            codigoSeguimiento: solicitud.averia.codigoSeguimiento,
          }
        : null,
      detalles: (solicitud.detalles || []).map((d) => ({
        id: d.id,
        idSolicitud: d.idSolicitud,
        idMaterial: d.idMaterial,
        cantidad: d.cantidad,
        observacion: d.observacion,
        material: d.material
          ? {
              id: d.material.id,
              nombre: d.material.nombre,
              unidadMedida: d.material.unidadMedida,
              stockActual: d.material.stockActual,
            }
          : null,
      })),
    };
  }

  private construirObservacionCompra(
    referencia?: string,
    observacion?: string,
  ): string | null {
    const partes: string[] = [];
    const ref = referencia?.trim();
    const obs = observacion?.trim();
    if (ref) {
      partes.push(`Referencia: ${ref}`);
    }
    if (obs) {
      partes.push(obs);
    }
    return partes.length ? partes.join('. ') : null;
  }

  private mapReposicionMaterialAdmin(
    reposicion: ReposicionMaterial,
  ): Record<string, unknown> {
    return {
      id: reposicion.id,
      codigo: reposicion.codigo,
      fechaGeneracion: reposicion.fechaGeneracion,
      origen: reposicion.origen,
      estado: reposicion.estado,
      idAlertaReposicion: reposicion.idAlertaReposicion,
      idSolicitudMaterial: reposicion.idSolicitudMaterial,
      idUsuarioResponsable: reposicion.idUsuarioResponsable,
      idProveedor: reposicion.idProveedor,
      fechaCompra: reposicion.fechaCompra,
      fechaRecepcion: reposicion.fechaRecepcion,
      observacion: reposicion.observacion,
      updatedAt: reposicion.updatedAt,
      proveedor: reposicion.idProveedor
        ? {
            id: reposicion.idProveedor,
            nombre: reposicion.proveedor?.nombre ?? null,
          }
        : null,
      usuarioResponsable: reposicion.idUsuarioResponsable
        ? {
            id: reposicion.idUsuarioResponsable,
            nombre: this.nombreUsuarioResumen(reposicion.usuarioResponsable),
          }
        : null,
      alertaReposicion: reposicion.idAlertaReposicion
        ? { id: reposicion.idAlertaReposicion }
        : null,
      solicitudMaterial: reposicion.idSolicitudMaterial
        ? { id: reposicion.idSolicitudMaterial }
        : null,
      detalles: (reposicion.detalles || []).map((detalle) => ({
        id: detalle.id,
        idMaterial: detalle.idMaterial,
        cantidad: detalle.cantidad,
        observacion: detalle.observacion,
        material: detalle.material
          ? {
              id: detalle.material.id,
              nombre: detalle.material.nombre,
              unidadMedida: detalle.material.unidadMedida,
              stockActual: detalle.material.stockActual,
            }
          : null,
      })),
    };
  }

  private mapAlertaReposicionAdmin(alerta: AlertaReposicion): Record<string, unknown> {
    return {
      id: alerta.id,
      idMaterial: alerta.idMaterial,
      stockActual: alerta.stockActual,
      stockMinimo: alerta.stockMinimo,
      estado: alerta.estado,
      fechaGeneracion: alerta.fechaGeneracion,
      updatedAt: alerta.updatedAt,
      idUsuarioGestiona: alerta.idUsuarioGestiona,
      material: alerta.material
        ? {
            id: alerta.material.id,
            nombre: alerta.material.nombre,
            unidadMedida: alerta.material.unidadMedida,
          }
        : null,
      usuarioGestiona: alerta.idUsuarioGestiona
        ? {
            id: alerta.idUsuarioGestiona,
            nombre: this.nombreUsuarioResumen(alerta.usuarioGestiona),
          }
        : null,
    };
  }

  private nombreUsuarioResumen(usuario: unknown): string | null {
    if (!usuario || typeof usuario !== 'object') {
      return null;
    }
    const record = usuario as Record<string, unknown>;
    const partes = [record.nombre, record.name, record.apellidos, record.lastName]
      .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
      .map((value) => value.trim());
    if (partes.length === 0) {
      return null;
    }
    return [...new Set(partes)].join(' ');
  }

  /**
   * Obtiene el detalle de una solicitud de material específica para el Fontanero autenticado.
   */
  async obtenerSolicitudMaterialFontanero(
    id: number,
    user: AuthenticatedUser,
  ): Promise<any> {
    const idFontanero = Number(user.userId);

    const solicitudRepo =
      this.solicitudMaterialRepository ??
      this.materialRepository.manager.getRepository(SolicitudMaterial);

    return withDbRetry(async () => {
      const solicitud = await solicitudRepo.findOne({
        where: { id },
        relations: {
          averia: true,
          detalles: {
            material: true,
          },
        },
      });

      if (!solicitud) {
        throw new NotFoundException(
          `Solicitud de material con ID ${id} no encontrada`,
        );
      }

      if (Number(solicitud.idFontanero) !== idFontanero) {
        throw new ForbiddenException(
          'No tiene permiso para consultar esta solicitud de materiales',
        );
      }

      const cantidadMateriales = solicitud.detalles?.length ?? 0;
      const totalMateriales =
        solicitud.detalles?.reduce((acc, d) => acc + (d.cantidad || 0), 0) ?? 0;

      return {
        id: solicitud.id,
        codigo: solicitud.codigo,
        fechaSolicitud: solicitud.fechaSolicitud,
        estado: solicitud.estado,
        idFontanero: solicitud.idFontanero,
        idAveria: solicitud.idAveria,
        observacion: solicitud.observacion,
        createdAt: solicitud.createdAt,
        updatedAt: solicitud.updatedAt,
        cantidadMateriales,
        totalMateriales,
        averia: solicitud.averia
          ? {
              id: solicitud.averia.id,
              codigo: solicitud.averia.codigoSeguimiento,
              numero: solicitud.averia.codigoSeguimiento,
              referencia: solicitud.averia.codigoSeguimiento,
              codigoSeguimiento: solicitud.averia.codigoSeguimiento,
            }
          : null,
        detalles: (solicitud.detalles || []).map((d) => ({
          id: d.id,
          idSolicitud: d.idSolicitud,
          idMaterial: d.idMaterial,
          cantidad: d.cantidad,
          observacion: d.observacion,
          material: d.material
            ? {
                id: d.material.id,
                nombre: d.material.nombre,
                unidadMedida: d.material.unidadMedida,
                stockActual: d.material.stockActual,
              }
            : null,
        })),
      };
    });
  }
}
