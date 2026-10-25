import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { basename, extname, join } from 'path';
import { Repository } from 'typeorm';
import { withDbRetry } from '../../common/persistence/with-db-retry';
import { CreateFormularioDescargableDto } from './dto/create-formulario-descargable.dto';
import { FormularioDescargableAdminResponse } from './dto/formulario-descargable-admin.response';
import { FormularioDescargablePublicoResponse } from './dto/formulario-descargable-publico.response';
import { UpdateFormularioDescargableDto } from './dto/update-formulario-descargable.dto';
import { FormularioDescargable } from './entities/formulario-descargable.entity';

/** Mismo límite que formularios oficiales / documentos públicos (10 MB). */
export const MAX_FORMULARIO_DESCARGABLE_PDF_BYTES = 10 * 1024 * 1024;

export type UploadedFormularioPdfFile = {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const STORAGE_FOLDER = 'formularios-descargables';

@Injectable()
export class FormulariosDescargablesService {
  private readonly logger = new Logger(FormulariosDescargablesService.name);
  private readonly storageRoot = join(process.cwd(), 'uploads', STORAGE_FOLDER);

  constructor(
    @InjectRepository(FormularioDescargable)
    private readonly formularioRepo: Repository<FormularioDescargable>,
  ) {
    if (!existsSync(this.storageRoot)) {
      mkdirSync(this.storageRoot, { recursive: true });
    }
  }

  /**
   * Listado administrativo: activos e inactivos.
   * Orden: fechaPublicacion DESC (nulls al final vía COALESCE implícito por createdAt), luego createdAt DESC.
   */
  async listarAdmin(): Promise<FormularioDescargableAdminResponse[]> {
    const rows = await withDbRetry(() =>
      this.formularioRepo.find({
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
    );
    return rows.map((row) => this.toAdminResponse(row));
  }

  /**
   * Catálogo público: únicamente activos.
   * No crea Solicitud ni inicia trámite.
   */
  async listarPublicos(): Promise<FormularioDescargablePublicoResponse[]> {
    const rows = await withDbRetry(() =>
      this.formularioRepo.find({
        where: { activo: true },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
    );
    return rows.map((row) => this.toPublicResponse(row));
  }

  /**
   * Descarga pública del PDF si el formulario está activo.
   * No crea Solicitud, no genera código de seguimiento.
   */
  async obtenerStreamDescargaPublica(
    id: number,
  ): Promise<{ streamableFile: StreamableFile; filename: string }> {
    const form = await withDbRetry(() =>
      this.formularioRepo.findOne({ where: { id, activo: true } }),
    );

    if (!form) {
      throw new NotFoundException(
        'El formulario solicitado no está disponible para descarga.',
      );
    }

    const safeName = basename(form.nombreArchivoInterno);
    const rutaFisica = join(this.storageRoot, safeName);

    if (!existsSync(rutaFisica)) {
      this.logger.error(
        `Archivo físico ausente para FormularioDescargable #${form.id}`,
      );
      throw new NotFoundException(
        'El archivo del formulario no se encuentra disponible en este momento.',
      );
    }

    const filenameDescarga = basename(
      form.nombreArchivoOriginal || `formulario-${form.id}.pdf`,
    );

    const streamableFile = new StreamableFile(createReadStream(rutaFisica), {
      type: 'application/pdf',
      disposition: `attachment; filename="${filenameDescarga}"`,
    });

    return { streamableFile, filename: filenameDescarga };
  }

  /**
   * Crea formulario con PDF obligatorio (entity NOT NULL en campos de archivo).
   * Orden: validar → escribir disco → persistir BD → si BD falla, borrar archivo nuevo.
   */
  async crear(
    dto: CreateFormularioDescargableDto,
    file: UploadedFormularioPdfFile | undefined,
  ): Promise<FormularioDescargableAdminResponse> {
    this.validarArchivoPdf(file);

    const nombreInterno = `${randomUUID()}.pdf`;
    const rutaFisica = join(this.storageRoot, nombreInterno);
    const ubicacionRelativa = `${STORAGE_FOLDER}/${nombreInterno}`;

    writeFileSync(rutaFisica, file.buffer);

    try {
      const activo = dto.activo === true;
      const entity = this.formularioRepo.create({
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        nombreArchivoOriginal: basename(file.originalname),
        nombreArchivoInterno: nombreInterno,
        ubicacionArchivo: ubicacionRelativa,
        activo,
        fechaPublicacion: dto.fechaPublicacion
          ? new Date(dto.fechaPublicacion)
          : null,
      });

      const saved = await withDbRetry(() => this.formularioRepo.save(entity));
      this.logger.log(
        `FormularioDescargable #${saved.id} creado (${saved.nombreArchivoInterno})`,
      );
      return this.toAdminResponse(saved);
    } catch (error) {
      this.eliminarArchivoSeguro(rutaFisica);
      throw error;
    }
  }

  /**
   * Edita solo metadata. No toca PDF ni activo.
   */
  async actualizarMetadata(
    id: number,
    dto: UpdateFormularioDescargableDto,
  ): Promise<FormularioDescargableAdminResponse> {
    const form = await this.obtenerOFallar(id);

    if (dto.nombre !== undefined) {
      form.nombre = dto.nombre;
    }
    if (dto.descripcion !== undefined) {
      form.descripcion = dto.descripcion;
    }
    if (dto.fechaPublicacion !== undefined) {
      form.fechaPublicacion =
        dto.fechaPublicacion === null ? null : new Date(dto.fechaPublicacion);
    }

    const saved = await withDbRetry(() => this.formularioRepo.save(form));
    return this.toAdminResponse(saved);
  }

  /**
   * Reemplazo seguro de PDF:
   * 1) validar 2) guardar nuevo 3) actualizar BD 4) borrar anterior.
   * Si falla BD tras upload: se elimina el nuevo y se conserva la referencia anterior.
   */
  async reemplazarArchivo(
    id: number,
    file: UploadedFormularioPdfFile | undefined,
  ): Promise<FormularioDescargableAdminResponse> {
    this.validarArchivoPdf(file);
    const form = await this.obtenerOFallar(id);

    const nombreInternoAnterior = form.nombreArchivoInterno;
    const rutaAnterior = join(
      this.storageRoot,
      basename(nombreInternoAnterior),
    );

    const nombreInternoNuevo = `${randomUUID()}.pdf`;
    const rutaNueva = join(this.storageRoot, nombreInternoNuevo);
    const ubicacionRelativa = `${STORAGE_FOLDER}/${nombreInternoNuevo}`;

    writeFileSync(rutaNueva, file.buffer);

    const snapshot = {
      nombreArchivoOriginal: form.nombreArchivoOriginal,
      nombreArchivoInterno: form.nombreArchivoInterno,
      ubicacionArchivo: form.ubicacionArchivo,
    };

    form.nombreArchivoOriginal = basename(file.originalname);
    form.nombreArchivoInterno = nombreInternoNuevo;
    form.ubicacionArchivo = ubicacionRelativa;

    try {
      const saved = await withDbRetry(() => this.formularioRepo.save(form));

      if (
        nombreInternoAnterior &&
        nombreInternoAnterior !== nombreInternoNuevo
      ) {
        this.eliminarArchivoSeguro(rutaAnterior);
      }

      this.logger.log(
        `FormularioDescargable #${id} PDF reemplazado → ${nombreInternoNuevo}`,
      );
      return this.toAdminResponse(saved);
    } catch (error) {
      // Conservar referencia anterior en memoria y en BD (save no confirmó).
      form.nombreArchivoOriginal = snapshot.nombreArchivoOriginal;
      form.nombreArchivoInterno = snapshot.nombreArchivoInterno;
      form.ubicacionArchivo = snapshot.ubicacionArchivo;
      this.eliminarArchivoSeguro(rutaNueva);
      throw error;
    }
  }

  /**
   * Activa o inactiva. No elimina registro ni PDF.
   * No asigna automáticamente fechaPublicacion (regla no definida en backlog).
   */
  async cambiarEstado(
    id: number,
    activo: boolean,
  ): Promise<FormularioDescargableAdminResponse> {
    const form = await this.obtenerOFallar(id);
    form.activo = activo;
    const saved = await withDbRetry(() => this.formularioRepo.save(form));
    return this.toAdminResponse(saved);
  }

  /**
   * Validación PDF: extensión + MIME + tamaño + magic bytes %PDF-
   * (mismo criterio que FormulariosOficialesService).
   */
  validarArchivoPdf(
    file: UploadedFormularioPdfFile | undefined,
  ): asserts file is UploadedFormularioPdfFile {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Debe adjuntar un archivo PDF no vacío.');
    }

    if (!file.originalname || file.originalname.trim().length === 0) {
      throw new BadRequestException(
        'El nombre del archivo no puede estar vacío.',
      );
    }

    if (file.originalname.length > 255) {
      throw new BadRequestException(
        'El nombre del archivo no puede exceder 255 caracteres.',
      );
    }

    const extension = extname(file.originalname).toLowerCase();
    if (extension !== '.pdf') {
      throw new BadRequestException(
        'Extensión de archivo no permitida. Solo se admiten documentos con extensión .pdf',
      );
    }

    const mime = file.mimetype?.toLowerCase();
    if (mime !== 'application/pdf') {
      throw new BadRequestException(
        'Tipo MIME no permitido. Se esperaba application/pdf.',
      );
    }

    if (!Number.isSafeInteger(file.size) || file.size <= 0) {
      throw new BadRequestException('El tamaño del archivo no es válido.');
    }

    if (file.size !== file.buffer.length) {
      throw new BadRequestException(
        'El tamaño declarado del archivo no coincide con su contenido real.',
      );
    }

    if (file.size > MAX_FORMULARIO_DESCARGABLE_PDF_BYTES) {
      throw new BadRequestException(
        `El archivo excede el tamaño máximo permitido de ${MAX_FORMULARIO_DESCARGABLE_PDF_BYTES / (1024 * 1024)} MB.`,
      );
    }

    const esPdfReal =
      file.buffer.length >= 5 &&
      file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';

    if (!esPdfReal) {
      throw new BadRequestException(
        'El contenido del archivo no corresponde a un documento PDF válido.',
      );
    }
  }

  private async obtenerOFallar(id: number): Promise<FormularioDescargable> {
    const form = await withDbRetry(() =>
      this.formularioRepo.findOne({ where: { id } }),
    );
    if (!form) {
      throw new NotFoundException(
        `Formulario descargable con ID ${id} no encontrado.`,
      );
    }
    return form;
  }

  private toAdminResponse(
    row: FormularioDescargable,
  ): FormularioDescargableAdminResponse {
    return {
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion,
      nombreArchivoOriginal: row.nombreArchivoOriginal,
      activo: row.activo,
      fechaPublicacion: row.fechaPublicacion,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toPublicResponse(
    row: FormularioDescargable,
  ): FormularioDescargablePublicoResponse {
    return {
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion,
      nombreArchivoOriginal: row.nombreArchivoOriginal,
      activo: row.activo,
    };
  }

  private eliminarArchivoSeguro(ruta: string): void {
    if (!existsSync(ruta)) {
      return;
    }
    try {
      unlinkSync(ruta);
    } catch (err) {
      this.logger.warn(
        `No se pudo eliminar archivo ${basename(ruta)}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
