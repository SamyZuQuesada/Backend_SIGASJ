import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EstadoActividadFontanero } from '../../common/enums/estado-actividad-fontanero.enum';
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
import { RevisarActividadDto } from './dto/revisar-actividad.dto';
import { SolicitarCorreccionDto } from './dto/solicitar-correccion.dto';
import { validarDatosEspecificosActividad } from './validators/datos-especificos-actividad.validator';
import { ActividadFontanero } from './entities/actividad-fontanero.entity';
import { DocumentoActividadFontanero } from './entities/documento-actividad-fontanero.entity';
import { TipoActividadFontanero } from './entities/tipo-actividad-fontanero.entity';

export type ActividadFontaneroResponse = {
  id: number;
  tipoActividadId: number;
  tipoActividadNombre: string;
  fechaActividad: string;
  titulo: string;
  descripcion: string | null;
  ubicacion: string | null;
  observaciones: string | null;
  datosEspecificos?: Record<string, unknown> | null;
  estado: EstadoActividadFontanero;
  observacionCorreccion: string | null;
  createdAt: Date;
  updatedAt: Date;
  documentos?: DocumentoActividadResponse[];
};

export type ActividadFontaneroAdminResponse = ActividadFontaneroResponse & {
  fontaneroId: string;
  revisadoPorId: string | null;
};

export type ListadoActividadesResponse = {
  data: ActividadFontaneroResponse[];
  total: number;
};

export type ListadoActividadesAdminResponse = {
  data: ActividadFontaneroAdminResponse[];
  total: number;
};

export type ReporteActividadesResponse = {
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
  ): Promise<ListadoActividadesResponse> {
    const data = await this.actividadRepository.find({
      where: {
        fontaneroId: user.userId,
        estado: In([
          EstadoActividadFontanero.APROBADA,
          EstadoActividadFontanero.RECHAZADA,
          EstadoActividadFontanero.CORREGIDA,
        ]),
      },
      relations: { tipoActividad: true },
      order: { updatedAt: 'DESC' },
    });

    return {
      data: data.map((item) => this.toFontaneroResponse(item)),
      total: data.length,
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
  ): Promise<ActividadFontaneroResponse> {
    const actividad = await this.requireOwnedActividad(id, user.userId);
    return this.toFontaneroResponse(actividad);
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
      throw new ForbiddenException('Acceso denegado');
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

  async listarAdmin(): Promise<ListadoActividadesAdminResponse> {
    const data = await this.actividadRepository.find({
      where: {
        estado: In([
          EstadoActividadFontanero.REPORTADA,
          EstadoActividadFontanero.EN_REVISION,
          EstadoActividadFontanero.CORREGIDA,
          EstadoActividadFontanero.REQUIERE_CORRECCION,
        ]),
      },
      relations: { tipoActividad: true },
      order: { createdAt: 'DESC' },
    });

    return {
      data: data.map((item) => this.toAdminResponse(item)),
      total: data.length,
    };
  }

  async historialAdmin(): Promise<ListadoActividadesAdminResponse> {
    const data = await this.actividadRepository.find({
      relations: { tipoActividad: true },
      order: { updatedAt: 'DESC' },
    });

    return {
      data: data.map((item) => this.toAdminResponse(item)),
      total: data.length,
    };
  }

  async reportesAdmin(): Promise<ReporteActividadesResponse> {
    const actividades = await this.actividadRepository.find();
    const porEstado = Object.values(EstadoActividadFontanero).reduce(
      (acc, estado) => {
        acc[estado] = 0;
        return acc;
      },
      {} as Record<EstadoActividadFontanero, number>,
    );

    for (const actividad of actividades) {
      porEstado[actividad.estado] += 1;
    }

    return {
      total: actividades.length,
      porEstado,
    };
  }

  async detalleAdmin(id: number): Promise<ActividadFontaneroAdminResponse> {
    const actividad = await this.requireActividad(id);
    return this.toAdminResponse(actividad);
  }

  async revisar(
    id: number,
    dto: RevisarActividadDto,
    user: AuthenticatedUser,
  ): Promise<ActividadFontaneroAdminResponse> {
    const actividad = await this.requireActividad(id);
    actividad.estado = dto.estado;
    actividad.revisadoPorId = user.userId;
    if (dto.observacion !== undefined) {
      actividad.observacionCorreccion = dto.observacion;
    }

    const saved = await this.actividadRepository.save(actividad);
    return this.toAdminResponse(saved);
  }

  async solicitarCorreccion(
    id: number,
    dto: SolicitarCorreccionDto,
    user: AuthenticatedUser,
  ): Promise<ActividadFontaneroAdminResponse> {
    const actividad = await this.requireActividad(id);
    actividad.estado = EstadoActividadFontanero.REQUIERE_CORRECCION;
    actividad.observacionCorreccion = dto.observacion;
    actividad.revisadoPorId = user.userId;

    const saved = await this.actividadRepository.save(actividad);
    return this.toAdminResponse(saved);
  }

  private async requireTipoActividadActivo(
    id: number,
  ): Promise<TipoActividadFontanero> {
    const tipo = await this.tipoActividadRepository.findOneBy({ id });
    if (!tipo) {
      throw new NotFoundException('Tipo de actividad no encontrado');
    }
    if (!tipo.activo) {
      throw new BadRequestException('El tipo de actividad no está activo');
    }
    return tipo;
  }

  private parseOptionalUsuarioId(userId: string): number | null {
    if (!/^\d+$/.test(userId)) {
      return null;
    }
    const parsed = Number.parseInt(userId, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private async requireActividad(id: number): Promise<ActividadFontanero> {
    const actividad = await this.actividadRepository.findOne({
      where: { id },
      relations: { tipoActividad: true },
    });
    if (!actividad) {
      throw new NotFoundException('Actividad no encontrada');
    }
    return actividad;
  }

  private async requireOwnedActividad(
    id: number,
    fontaneroId: string,
  ): Promise<ActividadFontanero> {
    const actividad = await this.requireActividad(id);
    if (actividad.fontaneroId !== fontaneroId) {
      throw new ForbiddenException('Acceso denegado');
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

    return {
      id: actividad.id,
      tipoActividadId: tipo?.id ?? 0,
      tipoActividadNombre: tipo?.nombre ?? '',
      fechaActividad: actividad.fechaActividad ?? '',
      titulo: actividad.titulo,
      descripcion: actividad.descripcion,
      ubicacion: actividad.ubicacion,
      observaciones: actividad.observaciones,
      datosEspecificos: actividad.datosEspecificos ?? null,
      estado: actividad.estado,
      observacionCorreccion: actividad.observacionCorreccion,
      createdAt: actividad.createdAt,
      updatedAt: actividad.updatedAt,
    };
  }

  private toAdminResponse(
    actividad: ActividadFontanero,
  ): ActividadFontaneroAdminResponse {
    return {
      ...this.toFontaneroResponse(actividad),
      fontaneroId: actividad.fontaneroId,
      revisadoPorId: actividad.revisadoPorId,
    };
  }
}
