import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  ESTADOS_HISTORIAL_FONTANERO,
  EstadoActividadFontanero,
} from '../../common/enums/estado-actividad-fontanero.enum';
import { Role } from '../../common/enums/role.enum';
import { TipoActividadFontaneroCodigo } from '../../common/enums/tipo-actividad-fontanero-codigo.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  deleteActividadDocument,
  saveActividadDocument,
  validateActividadDocument,
  type ActividadDocumentFile,
} from '../../common/media/public-media';
import { CorregirActividadDto } from './dto/corregir-actividad.dto';
import { CreateActividadDto } from './dto/create-actividad.dto';
import { QueryHistorialActividadesDto } from './dto/query-historial-actividades.dto';
import { QueryListadoActividadesAdminDto } from './dto/query-listado-actividades-admin.dto';
import { QueryReporteActividadesDto } from './dto/query-reporte-actividades.dto';
import { QueryResumenActividadesDto } from './dto/query-resumen-actividades.dto';
import { RevisarActividadDto } from './dto/revisar-actividad.dto';
import { SolicitarCorreccionDto } from './dto/solicitar-correccion.dto';
import { ACTIVIDADES_MSG } from './actividades-fontanero.messages';
import { validarDatosEspecificosActividad } from './validators/datos-especificos-actividad.validator';
import { ActividadFontanero } from './entities/actividad-fontanero.entity';
import { DocumentoActividadFontanero } from './entities/documento-actividad-fontanero.entity';
import { TipoActividadFontanero } from './entities/tipo-actividad-fontanero.entity';
import { withDbRetry } from '../../common/persistence/with-db-retry';

export type ActividadFontaneroResponse = {
  id: number;
  tipoActividadId: number;
  tipoActividadNombre: string;
  tipoActividadCodigo?: string;
  fechaActividad: string;
  fechaRegistro?: Date;
  titulo: string;
  descripcion: string | null;
  ubicacion: string | null;
  observaciones: string | null;
  datosEspecificos?: Record<string, unknown> | null;
  estado: EstadoActividadFontanero;
  estadoRevision?: string;
  observacionCorreccion: string | null;
  createdAt: Date;
  updatedAt: Date;
  fechaRevision?: Date | null;
  documentos?: DocumentoActividadResponse[];
};

export type ActividadFontaneroAdminResponse = ActividadFontaneroResponse & {
  fontaneroId: string;
  fontaneroNombre?: string | null;
  revisadoPorId: string | null;
  fechaRevision: Date | null;
  estadoRevision: string;
};

export type ListadoActividadesResponse = {
  data: ActividadFontaneroResponse[];
  total: number;
};

export type ListadoActividadesAdminResponse = {
  data: ActividadFontaneroAdminResponse[];
  actividades?: ActividadFontaneroAdminResponse[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
};

export type ReporteActividadPorTipo = {
  tipoActividadId: number | null;
  tipoActividadNombre: string;
  cantidad: number;
};

export type ReporteActividadPorFontanero = {
  fontaneroId: string;
  cantidad: number;
};

/** Detalle controlado del reporte (sin entidad TypeORM completa). */
export type ReporteActividadDetalle = {
  id: number;
  fechaActividad: string | null;
  estado: EstadoActividadFontanero;
  tipoActividadId: number | null;
  tipoActividadNombre: string;
  fontaneroId: string;
};

export type ReporteActividadesResponse = {
  /** Total filtrado (alias administrativo de totalActividades). */
  total: number;
  porEstado: Record<EstadoActividadFontanero, number>;
  porTipo: ReporteActividadPorTipo[];
  porFontanero: ReporteActividadPorFontanero[];
  actividades: ReporteActividadDetalle[];
};

export type ResumenActividadesResponse = {
  total: number;
  porEstado: Record<EstadoActividadFontanero, number>;
};

export type TipoActividadFontaneroResponse = {
  id: number;
  codigo: string;
  nombre: string;
  orden: number;
};

export type ListadoTiposActividadResponse = {
  data: TipoActividadFontaneroResponse[];
  total: number;
};

export type DocumentoActividadResponse = {
  id: number;
  actividadId: number;
  nombreOriginal: string;
  tipoArchivo: string;
  rutaReferenciaArchivo: string;
  tamanio: number;
  fechaCarga: Date;
};

const HISTORIAL_PAGE_DEFAULT = 1;
const HISTORIAL_LIMIT_DEFAULT = 10;
const HISTORIAL_LIMIT_MAX = 50;

type FiltroFechaActividad = {
  fechaInicio?: string;
  fechaFin?: string;
};

@Injectable()
export class ActividadesFontaneroService {
  constructor(
    @InjectRepository(ActividadFontanero)
    private readonly actividadRepository: Repository<ActividadFontanero>,
    @InjectRepository(TipoActividadFontanero)
    private readonly tipoActividadRepository: Repository<TipoActividadFontanero>,
    @InjectRepository(DocumentoActividadFontanero)
    private readonly documentoRepository: Repository<DocumentoActividadFontanero>,
  ) {}

  async listarTipos(): Promise<ListadoTiposActividadResponse> {
    const tipos = await this.tipoActividadRepository.find({
      where: { activo: true },
      order: { orden: 'ASC', id: 'ASC' },
    });

    return {
      data: tipos.map((tipo) => ({
        id: tipo.id,
        codigo: tipo.codigo,
        nombre: tipo.nombre,
        orden: tipo.orden,
      })),
      total: tipos.length,
    };
  }

  async registrar(
    dto: CreateActividadDto,
    user: AuthenticatedUser,
    files: ActividadDocumentFile[] = [],
  ): Promise<ActividadFontaneroResponse> {
    const tipoActividad = await this.requireTipoActividadActivo(
      dto.tipoActividadId,
    );
    const datosEspecificos = this.extractDatosEspecificos(dto);
    if (files.length > 0) {
      datosEspecificos.documentos = files.map((file) => file.originalname);
    } else if (
      tipoActividad.codigo ===
      TipoActividadFontaneroCodigo.INCAPACIDAD_VACACIONES
    ) {
      delete datosEspecificos.documentos;
    }
    const erroresEspecificos = validarDatosEspecificosActividad({
      codigo: tipoActividad.codigo,
      datos: datosEspecificos,
    });
    if (erroresEspecificos.length > 0) {
      throw new BadRequestException(erroresEspecificos);
    }
    for (const file of files) validateActividadDocument(file);
    const idUsuario = this.parseOptionalUsuarioId(user.userId);

    const actividad = this.actividadRepository.create({
      titulo: dto.titulo,
      descripcion: dto.descripcion ?? null,
      ubicacion: dto.ubicacion ?? null,
      observaciones: dto.observaciones ?? null,
      datosEspecificos:
        Object.keys(datosEspecificos).length > 0 ? datosEspecificos : null,
      fechaActividad: dto.fechaActividad,
      tipoActividad,
      fontanero: idUsuario ? { idUsuario } : null,
      estado: EstadoActividadFontanero.REPORTADA,
      fontaneroId: user.userId,
      observacionCorreccion: null,
      revisadoPorId: null,
    });

    const writtenDocuments: Array<{
      actividadId: number;
      rutaReferenciaArchivo: string;
    }> = [];

    try {
      return await this.actividadRepository.manager.transaction(
        async (manager) => {
          const saved = await manager.save(ActividadFontanero, actividad);
          const savedDocuments: DocumentoActividadResponse[] = [];

          for (const file of files) {
            const { rutaReferenciaArchivo } = saveActividadDocument(
              saved.id,
              file,
            );
            writtenDocuments.push({
              actividadId: saved.id,
              rutaReferenciaArchivo,
            });

            const document = manager.create(DocumentoActividadFontanero, {
              nombreOriginal: file.originalname,
              tipoArchivo: file.mimetype,
              rutaReferenciaArchivo,
              tamanio: file.size,
              actividad: saved,
            });
            const savedDocument = await manager.save(
              DocumentoActividadFontanero,
              document,
            );
            savedDocuments.push({
              id: savedDocument.id,
              actividadId: saved.id,
              nombreOriginal: savedDocument.nombreOriginal,
              tipoArchivo: savedDocument.tipoArchivo,
              rutaReferenciaArchivo: savedDocument.rutaReferenciaArchivo,
              tamanio: savedDocument.tamanio,
              fechaCarga: savedDocument.fechaCarga,
            });
          }

          return {
            ...this.toFontaneroResponse(saved, tipoActividad),
            documentos: savedDocuments,
          };
        },
      );
    } catch (error) {
      for (const document of writtenDocuments) {
        try {
          deleteActividadDocument(
            document.actividadId,
            document.rutaReferenciaArchivo,
          );
        } catch {
          // Se conserva el error original y se intenta limpiar cada archivo.
        }
      }
      throw error;
    }
  }

  async listarPropias(
    user: AuthenticatedUser,
  ): Promise<ListadoActividadesResponse> {
    const data = await this.actividadRepository.find({
      where: { fontaneroId: user.userId },
      relations: { tipoActividad: true },
      order: { createdAt: 'DESC' },
    });

    return {
      data: data.map((item) => this.toFontaneroResponse(item)),
      total: data.length,
    };
  }

  async historialPropio(
    user: AuthenticatedUser,
    query: QueryHistorialActividadesDto = {},
  ): Promise<ListadoActividadesResponse> {
    this.assertRangoFechasInclusive(query);

    const page = query.page ?? HISTORIAL_PAGE_DEFAULT;
    const limit = Math.min(
      query.limit ?? HISTORIAL_LIMIT_DEFAULT,
      HISTORIAL_LIMIT_MAX,
    );

    const qb = this.createHistorialPropioQb(user.userId, query);
    qb.orderBy('actividad.updatedAt', 'DESC').addOrderBy(
      'actividad.id',
      'DESC',
    );

    const total = await qb.getCount();
    // Clamp: evita data=[] con total>0 cuando page supera la última página válida.
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(
      Math.max(page, HISTORIAL_PAGE_DEFAULT),
      totalPages,
    );

    const data = await qb
      .skip((safePage - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data: data.map((item) => this.toFontaneroResponse(item)),
      total,
    };
  }

  async correccionesPendientes(
    user: AuthenticatedUser,
  ): Promise<ListadoActividadesResponse> {
    const data = await this.actividadRepository.find({
      where: {
        fontaneroId: user.userId,
        estado: EstadoActividadFontanero.REQUIERE_CORRECCION,
      },
      relations: { tipoActividad: true },
      order: { updatedAt: 'DESC' },
    });

    return {
      data: data.map((item) => this.toFontaneroResponse(item)),
      total: data.length,
    };
  }

  async detallePropio(
    id: number,
    user: AuthenticatedUser,
  ): Promise<ActividadFontaneroAdminResponse> {
    return this.consultarDetalle(id, user);
  }

  async adjuntarDocumento(
    actividadId: number,
    file: ActividadDocumentFile | undefined,
    user: AuthenticatedUser,
  ): Promise<DocumentoActividadResponse> {
    const actividad = await this.requireOwnedActividad(
      actividadId,
      user.userId,
    );
    validateActividadDocument(file);

    const { rutaReferenciaArchivo } = saveActividadDocument(actividadId, file);

    const documento = this.documentoRepository.create({
      nombreOriginal: file.originalname,
      tipoArchivo: file.mimetype,
      rutaReferenciaArchivo,
      tamanio: file.size,
      actividad,
    });

    let saved: DocumentoActividadFontanero;
    try {
      saved = await this.documentoRepository.save(documento);
    } catch (error) {
      try {
        deleteActividadDocument(actividadId, rutaReferenciaArchivo);
      } catch {
        // Se conserva el error original de persistencia.
      }
      throw error;
    }

    return {
      id: saved.id,
      actividadId,
      nombreOriginal: saved.nombreOriginal,
      tipoArchivo: saved.tipoArchivo,
      rutaReferenciaArchivo: saved.rutaReferenciaArchivo,
      tamanio: saved.tamanio,
      fechaCarga: saved.fechaCarga,
    };
  }

  async corregirPropia(
    id: number,
    dto: CorregirActividadDto,
    user: AuthenticatedUser,
  ): Promise<ActividadFontaneroResponse> {
    const actividad = await this.requireOwnedActividad(id, user.userId);

    if (actividad.estado !== EstadoActividadFontanero.REQUIERE_CORRECCION) {
      throw new ForbiddenException(ACTIVIDADES_MSG.forbidden);
    }

    const datosEspecificos = this.extractDatosEspecificos(dto);
    if (actividad.tipoActividad) {
      const erroresEspecificos = validarDatosEspecificosActividad({
        codigo: actividad.tipoActividad.codigo,
        datos: datosEspecificos,
      });
      if (erroresEspecificos.length > 0) {
        throw new BadRequestException(erroresEspecificos);
      }
    }

    actividad.titulo = dto.titulo;
    actividad.descripcion = dto.descripcion ?? null;
    actividad.ubicacion = dto.ubicacion ?? null;
    if (Object.keys(datosEspecificos).length > 0) {
      actividad.datosEspecificos = datosEspecificos;
    }
    actividad.estado = EstadoActividadFontanero.CORREGIDA;
    actividad.observacionCorreccion = null;

    const saved = await this.actividadRepository.save(actividad);
    return this.toFontaneroResponse(saved);
  }

  async listarAdmin(
    query: QueryListadoActividadesAdminDto = {},
  ): Promise<ListadoActividadesAdminResponse> {
    return withDbRetry(async () => {
      const rawPage = Number(query.page);
      const rawLimit = Number(query.limit);
      const page =
        !isNaN(rawPage) && rawPage > 0 ? rawPage : HISTORIAL_PAGE_DEFAULT;
      const limit = Math.min(
        !isNaN(rawLimit) && rawLimit > 0 ? rawLimit : HISTORIAL_LIMIT_DEFAULT,
        HISTORIAL_LIMIT_MAX,
      );

      const qb = this.actividadRepository
        .createQueryBuilder('actividad')
        .leftJoinAndSelect('actividad.tipoActividad', 'tipo');

      if (query.estado) {
        qb.andWhere('actividad.estado = :estado', { estado: query.estado });
      }

      if (query.fontaneroId) {
        qb.andWhere('actividad.fontaneroId = :fontaneroId', {
          fontaneroId: query.fontaneroId,
        });
      }

      if (
        query.tipoActividadId !== undefined &&
        query.tipoActividadId !== null &&
        !isNaN(Number(query.tipoActividadId))
      ) {
        qb.andWhere('tipo.id = :tipoActividadId', {
          tipoActividadId: Number(query.tipoActividadId),
        });
      }

      this.applyFechaActividadFilters(qb, query);

      qb.orderBy('actividad.createdAt', 'DESC').addOrderBy(
        'actividad.id',
        'DESC',
      );

      const total = await qb.getCount();
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.max(1, page);
      const skip = (safePage - 1) * limit;

      const data = await qb
        .skip(skip)
        .take(limit)
        .getMany();

      const mapped = data.map((item) => this.toAdminResponse(item));

      return {
        data: mapped,
        actividades: mapped,
        total,
        page: safePage,
        limit,
        totalPages,
      };
    });
  }

  async historialAdmin(): Promise<ListadoActividadesAdminResponse> {
    return withDbRetry(async () => {
      const data = await this.actividadRepository.find({
        relations: { tipoActividad: true },
        order: { updatedAt: 'DESC' },
      });

      const mapped = data.map((item) => this.toAdminResponse(item));
      return {
        data: mapped,
        actividades: mapped,
        total: data.length,
      };
    });
  }

  async resumenPropio(
    user: AuthenticatedUser,
    query: QueryResumenActividadesDto = {},
  ): Promise<ResumenActividadesResponse> {
    this.assertRangoFechasInclusive(query);

    return withDbRetry(async () => {
      const qb = this.actividadRepository
        .createQueryBuilder('actividad')
        .where('actividad.fontaneroId = :fontaneroId', {
          fontaneroId: user.userId,
        });
      this.applyFechaActividadFilters(qb, query);
      return this.buildResumenActividades(qb);
    });
  }

  async resumenAdmin(
    query: QueryResumenActividadesDto = {},
  ): Promise<ResumenActividadesResponse> {
    this.assertRangoFechasInclusive(query);

    return withDbRetry(async () => {
      const qb = this.actividadRepository.createQueryBuilder('actividad');
      this.applyFechaActividadFilters(qb, query);
      return this.buildResumenActividades(qb);
    });
  }

  async reportesAdmin(
    filters: QueryReporteActividadesDto = {},
  ): Promise<ReporteActividadesResponse> {
    this.assertRangoFechasReporte(filters);

    return withDbRetry(async () => {
      const total = await this.createReportBaseQb(filters).getCount();

      const porEstadoRows = await this.createReportBaseQb(filters)
        .select('actividad.estado', 'estado')
        .addSelect('COUNT(*)', 'cantidad')
        .groupBy('actividad.estado')
        .getRawMany<{ estado: EstadoActividadFontanero; cantidad: string }>();

      const porTipoRows = await this.createReportBaseQb(filters)
        .select('tipo.id', 'tipoActividadId')
        .addSelect('tipo.nombre', 'tipoActividadNombre')
        .addSelect('COUNT(*)', 'cantidad')
        .groupBy('tipo.id')
        .addGroupBy('tipo.nombre')
        .orderBy('cantidad', 'DESC')
        .addOrderBy('tipo.nombre', 'ASC')
        .getRawMany<{
          tipoActividadId: number | string | null;
          tipoActividadNombre: string | null;
          cantidad: string;
        }>();

      const porFontaneroRows = await this.createReportBaseQb(filters)
        .select('actividad.fontaneroId', 'fontaneroId')
        .addSelect('COUNT(*)', 'cantidad')
        .groupBy('actividad.fontaneroId')
        .orderBy('cantidad', 'DESC')
        .addOrderBy('actividad.fontaneroId', 'ASC')
        .getRawMany<{ fontaneroId: string; cantidad: string }>();

      const actividadRows = await this.createReportBaseQb(filters)
        .select([
          'actividad.id',
          'actividad.fechaActividad',
          'actividad.estado',
          'actividad.fontaneroId',
          'tipo.id',
          'tipo.nombre',
        ])
        .orderBy('actividad.fechaActividad', 'DESC')
        .addOrderBy('actividad.id', 'DESC')
        .getMany();

      const porEstado = Object.values(EstadoActividadFontanero).reduce(
        (acc, estado) => {
          acc[estado] = 0;
          return acc;
        },
        {} as Record<EstadoActividadFontanero, number>,
      );

      for (const row of porEstadoRows) {
        if (row.estado in porEstado) {
          porEstado[row.estado] = Number(row.cantidad);
        }
      }

      return {
        total,
        porEstado,
        porTipo: porTipoRows.map((row) => ({
          tipoActividadId:
            row.tipoActividadId === null || row.tipoActividadId === undefined
              ? null
              : Number(row.tipoActividadId),
          tipoActividadNombre: row.tipoActividadNombre ?? '',
          cantidad: Number(row.cantidad),
        })),
        porFontanero: porFontaneroRows.map((row) => ({
          fontaneroId: row.fontaneroId,
          cantidad: Number(row.cantidad),
        })),
        actividades: actividadRows.map((actividad) => ({
          id: actividad.id,
          fechaActividad: actividad.fechaActividad,
          estado: actividad.estado,
          tipoActividadId: actividad.tipoActividad?.id ?? null,
          tipoActividadNombre: actividad.tipoActividad?.nombre ?? '',
          fontaneroId: actividad.fontaneroId,
        })),
      };
    });
  }

  private createHistorialPropioQb(
    fontaneroId: string,
    query: QueryHistorialActividadesDto,
  ): SelectQueryBuilder<ActividadFontanero> {
    const qb = this.actividadRepository
      .createQueryBuilder('actividad')
      .leftJoinAndSelect('actividad.tipoActividad', 'tipo')
      .where('actividad.fontaneroId = :fontaneroId', { fontaneroId })
      .andWhere('actividad.estado IN (:...estadosHistorial)', {
        estadosHistorial: [...ESTADOS_HISTORIAL_FONTANERO],
      });

    this.applyFechaActividadFilters(qb, query);
    return qb;
  }

  /**
   * `fechaActividad` es columna `date` (YYYY-MM-DD): comparación inclusiva directa.
   * Registros con fechaActividad NULL quedan excluidos cuando hay filtro de fechas.
   */
  private applyFechaActividadFilters(
    qb: SelectQueryBuilder<ActividadFontanero>,
    filters: FiltroFechaActividad,
  ): void {
    if (filters.fechaInicio) {
      qb.andWhere('actividad.fechaActividad >= :fechaInicio', {
        fechaInicio: filters.fechaInicio,
      });
    }
    if (filters.fechaFin) {
      qb.andWhere('actividad.fechaActividad <= :fechaFin', {
        fechaFin: filters.fechaFin,
      });
    }
  }

  private applyReportFilters(
    qb: SelectQueryBuilder<ActividadFontanero>,
    filters: QueryReporteActividadesDto,
  ): void {
    this.applyFechaActividadFilters(qb, filters);
    if (filters.fontaneroId) {
      qb.andWhere('actividad.fontaneroId = :fontaneroId', {
        fontaneroId: filters.fontaneroId,
      });
    }
    if (filters.tipoActividadId !== undefined) {
      qb.andWhere('tipo.id = :tipoActividadId', {
        tipoActividadId: filters.tipoActividadId,
      });
    }
  }

  private async buildResumenActividades(
    qb: SelectQueryBuilder<ActividadFontanero>,
  ): Promise<ResumenActividadesResponse> {
    const total = await qb.getCount();

    const porEstadoRows = await qb
      .clone()
      .select('actividad.estado', 'estado')
      .addSelect('COUNT(*)', 'cantidad')
      .groupBy('actividad.estado')
      .getRawMany<{ estado: EstadoActividadFontanero; cantidad: string }>();

    const porEstado = Object.values(EstadoActividadFontanero).reduce(
      (acc, estado) => {
        acc[estado] = 0;
        return acc;
      },
      {} as Record<EstadoActividadFontanero, number>,
    );

    for (const row of porEstadoRows) {
      if (row.estado in porEstado) {
        porEstado[row.estado] = Number(row.cantidad);
      }
    }

    return { total, porEstado };
  }

  private createReportBaseQb(
    filters: QueryReporteActividadesDto,
  ): SelectQueryBuilder<ActividadFontanero> {
    const qb = this.actividadRepository
      .createQueryBuilder('actividad')
      .leftJoin('actividad.tipoActividad', 'tipo');
    this.applyReportFilters(qb, filters);
    return qb;
  }

  private assertRangoFechasInclusive(filters: FiltroFechaActividad): void {
    if (filters.fechaInicio && filters.fechaFin) {
      if (filters.fechaInicio > filters.fechaFin) {
        throw new BadRequestException(ACTIVIDADES_MSG.rangoFechasInvalido);
      }
    }
  }

  private assertRangoFechasReporte(filters: QueryReporteActividadesDto): void {
    this.assertRangoFechasInclusive(filters);
  }

  async detalleAdmin(id: number): Promise<ActividadFontaneroAdminResponse> {
    return withDbRetry(async () => {
      const actividad = await this.actividadRepository.findOne({
        where: { id },
        relations: {
          tipoActividad: true,
          documentos: true,
          fontanero: true,
        },
      });
      if (!actividad) {
        throw new NotFoundException(ACTIVIDADES_MSG.actividadNotFound);
      }
      return this.toAdminResponse(actividad);
    });
  }

  async consultarDetalle(
    id: number,
    user: AuthenticatedUser,
  ): Promise<ActividadFontaneroAdminResponse> {
    return withDbRetry(async () => {
      const actividad = await this.actividadRepository.findOne({
        where: { id },
        relations: {
          tipoActividad: true,
          documentos: true,
          fontanero: true,
        },
      });
      if (!actividad) {
        throw new NotFoundException(ACTIVIDADES_MSG.actividadNotFound);
      }

      if (user.role === Role.FONTANERO) {
        if (actividad.fontaneroId !== user.userId) {
          throw new ForbiddenException(ACTIVIDADES_MSG.forbidden);
        }
      } else if (user.role !== Role.ADMINISTRADORA) {
        throw new ForbiddenException(ACTIVIDADES_MSG.forbidden);
      }

      return this.toAdminResponse(actividad);
    });
  }

  async revisar(
    id: number,
    dto: RevisarActividadDto = {},
    user: AuthenticatedUser,
  ): Promise<ActividadFontaneroAdminResponse> {
    return withDbRetry(async () => {
      const actividad = await this.requireActividad(id);

      if (actividad.estado === EstadoActividadFontanero.REVISADA) {
        throw new BadRequestException(ACTIVIDADES_MSG.yaRevisada);
      }

      actividad.estado = dto.estado ?? EstadoActividadFontanero.REVISADA;
      actividad.revisadoPorId = user.userId;
      actividad.fechaRevision = new Date();
      if (dto.observacion !== undefined) {
        actividad.observacionCorreccion = dto.observacion;
      }

      const saved = await this.actividadRepository.save(actividad);
      return this.toAdminResponse(saved);
    });
  }

  async solicitarCorreccion(
    id: number,
    dto: SolicitarCorreccionDto,
    user: AuthenticatedUser,
  ): Promise<ActividadFontaneroAdminResponse> {
    return withDbRetry(async () => {
      const actividad = await this.requireActividad(id);
      actividad.estado = EstadoActividadFontanero.REQUIERE_CORRECCION;
      actividad.observacionCorreccion = dto.observacion;
      actividad.revisadoPorId = user.userId;

      const saved = await this.actividadRepository.save(actividad);
      return this.toAdminResponse(saved);
    });
  }

  private async requireTipoActividadActivo(
    id: number,
  ): Promise<TipoActividadFontanero> {
    return withDbRetry(async () => {
      const tipo = await this.tipoActividadRepository.findOneBy({ id });
      if (!tipo) {
        throw new NotFoundException(ACTIVIDADES_MSG.tipoNotFound);
      }
      if (!tipo.activo) {
        throw new BadRequestException(ACTIVIDADES_MSG.tipoInactivo);
      }
      return tipo;
    });
  }

  private parseOptionalUsuarioId(userId: string): number | null {
    if (!/^\d+$/.test(userId)) {
      return null;
    }
    const parsed = Number.parseInt(userId, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private async requireActividad(id: number): Promise<ActividadFontanero> {
    return withDbRetry(async () => {
      const actividad = await this.actividadRepository.findOne({
        where: { id },
        relations: { tipoActividad: true },
      });
      if (!actividad) {
        throw new NotFoundException(ACTIVIDADES_MSG.actividadNotFound);
      }
      return actividad;
    });
  }

  private async requireOwnedActividad(
    id: number,
    fontaneroId: string,
  ): Promise<ActividadFontanero> {
    const actividad = await this.requireActividad(id);
    if (actividad.fontaneroId !== fontaneroId) {
      throw new ForbiddenException(ACTIVIDADES_MSG.forbidden);
    }
    return actividad;
  }

  private extractDatosEspecificos(
    dto: CreateActividadDto | CorregirActividadDto,
  ): Record<string, unknown> {
    const datos: Record<string, unknown> = { ...(dto.datos ?? {}) };
    if (dto.presionMedida !== undefined)
      datos.presionMedida = dto.presionMedida;
    if (dto.caudal !== undefined) datos.caudal = dto.caudal;
    if (dto.cantidadCloro !== undefined)
      datos.cantidadCloro = dto.cantidadCloro;
    if (dto.ubicacionFuga !== undefined)
      datos.ubicacionFuga = dto.ubicacionFuga;
    if (dto.resultadoVisita !== undefined)
      datos.resultadoVisita = dto.resultadoVisita;
    if (dto.documentos !== undefined) datos.documentos = dto.documentos;
    return datos;
  }

  private toFontaneroResponse(
    actividad: ActividadFontanero,
    tipoActividad?: TipoActividadFontanero | null,
  ): ActividadFontaneroResponse {
    const tipo = tipoActividad ?? actividad.tipoActividad;
    const estadoRevision =
      actividad.fechaRevision !== null ||
      actividad.estado === EstadoActividadFontanero.REVISADA
        ? 'REVISADA'
        : 'PENDIENTE';

    return {
      id: actividad.id,
      tipoActividadId: tipo?.id ?? 0,
      tipoActividadNombre: tipo?.nombre ?? actividad.titulo ?? 'Sin tipo',
      tipoActividadCodigo: tipo?.codigo,
      fechaActividad: actividad.fechaActividad ?? '',
      fechaRegistro: actividad.createdAt,
      titulo: actividad.titulo,
      descripcion: actividad.descripcion ?? null,
      ubicacion: actividad.ubicacion ?? null,
      observaciones: actividad.observaciones ?? null,
      datosEspecificos: actividad.datosEspecificos ?? null,
      estado: actividad.estado,
      estadoRevision,
      observacionCorreccion: actividad.observacionCorreccion ?? null,
      createdAt: actividad.createdAt,
      updatedAt: actividad.updatedAt,
      fechaRevision: actividad.fechaRevision ?? null,
      documentos: (actividad.documentos ?? []).map((doc) => ({
        id: doc.id,
        actividadId: actividad.id,
        nombreOriginal: doc.nombreOriginal,
        tipoArchivo: doc.tipoArchivo,
        rutaReferenciaArchivo: doc.rutaReferenciaArchivo,
        tamanio: doc.tamanio,
        fechaCarga: doc.fechaCarga,
      })),
    };
  }

  private toAdminResponse(
    actividad: ActividadFontanero,
  ): ActividadFontaneroAdminResponse {
    const estadoRevision =
      actividad.fechaRevision !== null ||
      actividad.estado === EstadoActividadFontanero.REVISADA
        ? 'REVISADA'
        : 'PENDIENTE';

    const fontanero = actividad.fontanero as
      | Record<string, unknown>
      | null
      | undefined;
    const fontaneroNombre =
      fontanero && (fontanero.nombre || fontanero.apellidos)
        ? `${fontanero.nombre ?? ''} ${fontanero.apellidos ?? ''}`.trim()
        : null;

    return {
      ...this.toFontaneroResponse(actividad),
      fontaneroId: actividad.fontaneroId,
      fontaneroNombre,
      revisadoPorId: actividad.revisadoPorId ?? null,
      fechaRevision: actividad.fechaRevision ?? null,
      estadoRevision,
    };
  }
}
