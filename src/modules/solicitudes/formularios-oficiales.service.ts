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
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { FormularioOficialItemDto } from './dto/formulario-oficial-response.dto';
import { FormularioOficial } from './entities/formulario-oficial.entity';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';

export const MAX_FORMULARIO_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

export interface UploadedPdfFile {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

@Injectable()
export class FormulariosOficialesService {
  private readonly logger = new Logger(FormulariosOficialesService.name);
  private readonly storageRoot = join(
    process.cwd(),
    'uploads',
    'formularios-oficiales',
  );

  constructor(
    @InjectRepository(FormularioOficial)
    private readonly formularioRepo: Repository<FormularioOficial>,
    @InjectRepository(TipoSolicitud)
    private readonly tipoSolicitudRepo: Repository<TipoSolicitud>,
  ) {
    if (!existsSync(this.storageRoot)) {
      mkdirSync(this.storageRoot, { recursive: true });
    }
  }

  /**
   * Obtiene el listado de los 6 trámites oficiales con el estado de su formulario en PDF.
   * Siempre devuelve los 6 tipos, indicando si tienen o no archivo vigente.
   */
  async listarFormulariosOficialesAdmin(): Promise<FormularioOficialItemDto[]> {
    const tipos = await this.tipoSolicitudRepo.find({
      relations: { formularioOficial: true },
      order: { id: 'ASC' },
    });

    // Filtrar estrictamente a los 6 trámites oficiales
    const tiposOficiales = tipos.filter((t) =>
      Object.values(TipoSolicitudSlug).includes(t.slug as TipoSolicitudSlug),
    );

    return tiposOficiales.map((tipo) => {
      const form = tipo.formularioOficial;
      return {
        tipoSolicitudId: tipo.id,
        nombre: tipo.nombre,
        slug: tipo.slug,
        tienePdf: Boolean(form),
        nombreArchivo: form?.nombreArchivoOriginal ?? null,
        tamano: form?.tamano ?? null,
        fechaActualizacion: form?.fechaCarga ?? null,
      };
    });
  }

  /**
   * Valida rigurosamente que el archivo subido sea un documento PDF auténtico y seguro.
   */
  validarArchivoPdf(
    file: UploadedPdfFile | undefined,
  ): asserts file is UploadedPdfFile {
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

    if (file.size > MAX_FORMULARIO_PDF_BYTES) {
      throw new BadRequestException(
        `El archivo excede el tamaño máximo permitido de ${MAX_FORMULARIO_PDF_BYTES / (1024 * 1024)} MB.`,
      );
    }

    // Validación de firma / magic bytes (%PDF-) para evitar archivos ejecutables, imágenes o HTML renombrados a .pdf
    const esPdfReal =
      file.buffer.length >= 5 &&
      file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';

    if (!esPdfReal) {
      throw new BadRequestException(
        'El contenido del archivo no corresponde a un documento PDF válido.',
      );
    }
  }

  /**
   * Sube o reemplaza el PDF oficial de un tipo de solicitud oficial.
   * Si ya existía un archivo previo, lo elimina del disco de manera segura.
   */
  async subirOReemplazarPdf(
    tipoSolicitudId: number,
    file: UploadedPdfFile,
  ): Promise<FormularioOficialItemDto> {
    this.validarArchivoPdf(file);

    // 1. Validar que el tipo de solicitud exista y sea uno de los 6 oficiales
    const tipo = await this.tipoSolicitudRepo.findOne({
      where: { id: tipoSolicitudId },
      relations: { formularioOficial: true },
    });

    if (!tipo) {
      throw new NotFoundException(
        `Tipo de solicitud con ID ${tipoSolicitudId} no encontrado.`,
      );
    }

    const esOficial = Object.values(TipoSolicitudSlug).includes(
      tipo.slug as TipoSolicitudSlug,
    );
    if (!esOficial) {
      throw new BadRequestException(
        `El tipo de solicitud '${tipo.slug}' no corresponde a uno de los seis trámites oficiales autorizados.`,
      );
    }

    // 2. Generar nombre interno seguro
    const nombreInterno = `${randomUUID()}.pdf`;
    const rutaFisicaNueva = join(this.storageRoot, nombreInterno);
    const ubicacionRelativa = `formularios-oficiales/${nombreInterno}`;

    // 3. Escribir archivo nuevo en disco
    writeFileSync(rutaFisicaNueva, file.buffer);

    let registroAnterior = tipo.formularioOficial;
    if (!registroAnterior) {
      registroAnterior =
        (await this.formularioRepo.findOne({
          where: { tipoSolicitudId: tipo.id },
        })) || undefined;
    }

    try {
      let formularioPersistido: FormularioOficial;

      if (registroAnterior) {
        // Reemplazo
        const rutaAnterior = join(
          this.storageRoot,
          basename(registroAnterior.nombreArchivoInterno),
        );

        registroAnterior.nombreArchivoOriginal = basename(file.originalname);
        registroAnterior.nombreArchivoInterno = nombreInterno;
        registroAnterior.mimeType = 'application/pdf';
        registroAnterior.tamano = file.size;
        registroAnterior.ubicacionArchivo = ubicacionRelativa;
        registroAnterior.fechaCarga = new Date();

        formularioPersistido = await this.formularioRepo.save(registroAnterior);

        // Retirar archivo anterior de disco
        if (existsSync(rutaAnterior)) {
          try {
            unlinkSync(rutaAnterior);
          } catch (err) {
            this.logger.warn(
              `No se pudo eliminar el archivo previo ${rutaAnterior}: ${err}`,
            );
          }
        }
      } else {
        // Nueva carga
        const nuevo = this.formularioRepo.create({
          tipoSolicitudId: tipo.id,
          nombreArchivoOriginal: basename(file.originalname),
          nombreArchivoInterno: nombreInterno,
          mimeType: 'application/pdf',
          tamano: file.size,
          ubicacionArchivo: ubicacionRelativa,
          fechaCarga: new Date(),
        });

        formularioPersistido = await this.formularioRepo.save(nuevo);
      }

      this.logger.log(
        `PDF oficial para trámite '${tipo.slug}' actualizado con éxito: ${formularioPersistido.nombreArchivoInterno}`,
      );

      return {
        tipoSolicitudId: tipo.id,
        nombre: tipo.nombre,
        slug: tipo.slug,
        tienePdf: true,
        nombreArchivo: formularioPersistido.nombreArchivoOriginal,
        tamano: formularioPersistido.tamano,
        fechaActualizacion: formularioPersistido.fechaCarga,
      };
    } catch (dbError) {
      // Si la persistencia en DB falla, eliminar el archivo nuevo para no dejar archivos huérfanos
      if (existsSync(rutaFisicaNueva)) {
        try {
          unlinkSync(rutaFisicaNueva);
        } catch {}
      }
      throw dbError;
    }
  }

  /**
   * Obtiene el stream del PDF oficial para descarga pública por slug.
   * No crea Solicitud, no genera código de seguimiento ni modifica historial.
   */
  async obtenerStreamDescargaPublica(
    slug: string,
  ): Promise<{ streamableFile: StreamableFile; filename: string }> {
    const slugNormalizado = slug?.trim().toLowerCase();

    const tipo = await this.tipoSolicitudRepo.findOne({
      where: { slug: slugNormalizado },
      relations: { formularioOficial: true },
    });

    if (!tipo) {
      throw new NotFoundException(
        `El trámite '${slugNormalizado}' no fue encontrado.`,
      );
    }

    const form =
      tipo.formularioOficial ||
      (await this.formularioRepo.findOne({
        where: { tipoSolicitudId: tipo.id },
      }));

    if (!form) {
      throw new NotFoundException(
        'El formulario oficial todavía no se encuentra disponible.',
      );
    }

    const safeName = basename(form.nombreArchivoInterno);
    const rutaFisica = join(this.storageRoot, safeName);

    if (!existsSync(rutaFisica)) {
      this.logger.error(
        `El archivo físico ${rutaFisica} no existe para el formulario con ID ${form.id}`,
      );
      throw new NotFoundException(
        'El archivo físico del formulario oficial no se encuentra en el servidor.',
      );
    }

    // Sanitizar nombre para Content-Disposition
    const filenameDescarga = basename(
      form.nombreArchivoOriginal || `${tipo.slug}.pdf`,
    );

    const streamableFile = new StreamableFile(createReadStream(rutaFisica), {
      type: 'application/pdf',
      disposition: `attachment; filename="${filenameDescarga}"`,
    });

    return {
      streamableFile,
      filename: filenameDescarga,
    };
  }
}
