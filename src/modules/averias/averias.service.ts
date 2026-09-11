import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ESTADO_AVERIA_LABELS,
  EstadoAveria,
} from '../../common/enums/estado-averia.enum';
import { CreatePublicAveriaDto } from './dto/create-public-averia.dto';
import { RegistroPublicoAveriaResponseDto } from './dto/registro-publico-averia-response.dto';
import {
  buildCodigoSeguimiento,
  CODIGO_SEGUIMIENTO_MAX_RETRIES,
  isCodigoSeguimientoUniqueViolation,
  parseConsecutiveFromCodigo,
} from './averias.codigo-seguimiento';
import { Averia } from './entities/averia.entity';

const REGISTRO_OK = 'Avería registrada correctamente.';
const REGISTRO_ERROR = 'No se pudo registrar la avería. Intente nuevamente.';

@Injectable()
export class AveriasService {
  private readonly logger = new Logger(AveriasService.name);

  constructor(
    @InjectRepository(Averia)
    private readonly averiaRepository: Repository<Averia>,
  ) {}

  /**
   * Registro público de una avería. No exige JWT, Usuario ni Abonado.
   * `now` es inyectable para tests de año; el controller no lo expone.
   */
  async createPublicReport(
    dto: CreatePublicAveriaDto,
    now: Date = new Date(),
  ): Promise<RegistroPublicoAveriaResponseDto> {
    const year = now.getFullYear();
    let consecutive = await this.suggestNextConsecutive(year);

    for (
      let attempt = 1;
      attempt <= CODIGO_SEGUIMIENTO_MAX_RETRIES;
      attempt++
    ) {
      const codigoSeguimiento = buildCodigoSeguimiento(year, consecutive);
      const averia = this.buildPublicAveria(dto, codigoSeguimiento, now);

      try {
        const saved = await this.averiaRepository.save(averia);
        return this.toPublicResponse(saved);
      } catch (error) {
        if (
          isCodigoSeguimientoUniqueViolation(error) &&
          attempt < CODIGO_SEGUIMIENTO_MAX_RETRIES
        ) {
          const suggested = await this.suggestNextConsecutive(year);
          consecutive = Math.max(consecutive + 1, suggested);
          continue;
        }

        if (isCodigoSeguimientoUniqueViolation(error)) {
          this.logger.error(
            `No se pudo generar un codigoSeguimiento único tras ${CODIGO_SEGUIMIENTO_MAX_RETRIES} intentos`,
          );
          throw new InternalServerErrorException(REGISTRO_ERROR);
        }

        if (error instanceof HttpException) {
          throw error;
        }

        this.logger.error(
          'Error inesperado al registrar una avería pública',
          error,
        );
        throw new InternalServerErrorException(REGISTRO_ERROR);
      }
    }

    throw new InternalServerErrorException(REGISTRO_ERROR);
  }

  private buildPublicAveria(
    dto: CreatePublicAveriaDto,
    codigoSeguimiento: string,
    fechaReporte: Date,
  ): Averia {
    return this.averiaRepository.create({
      codigoSeguimiento,
      fechaReporte,
      nombreReportante: dto.nombreReportante,
      identificacionReportante: dto.identificacionReportante ?? null,
      telefonoReportante: dto.telefonoReportante,
      correoReportante: dto.correoReportante ?? null,
      ubicacion: dto.ubicacion,
      sectorComunidad: dto.sectorComunidad,
      descripcion: dto.descripcion,
      estado: EstadoAveria.RECIBIDA,
      idAbonado: null,
      tipoAveria: null,
      prioridad: null,
      idFontaneroAsignado: null,
      fontaneroAsignado: null,
      fechaAsignacion: null,
      fechaInicioAtencion: null,
      fechaResolucion: null,
      observacionesAtencion: null,
    });
  }

  private toPublicResponse(averia: Averia): RegistroPublicoAveriaResponseDto {
    return {
      message: REGISTRO_OK,
      data: {
        codigoSeguimiento: averia.codigoSeguimiento,
        fechaReporte: averia.fechaReporte.toISOString(),
        estado: ESTADO_AVERIA_LABELS[averia.estado] ?? averia.estado,
      },
    };
  }

  private async suggestNextConsecutive(year: number): Promise<number> {
    const prefix = `AV-${year}-`;
    const last = await this.averiaRepository
      .createQueryBuilder('averia')
      .select('averia.codigoSeguimiento', 'codigoSeguimiento')
      .where('averia.codigoSeguimiento LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('averia.codigoSeguimiento', 'DESC')
      .getRawOne<{ codigoSeguimiento?: string }>();

    const parsed = last?.codigoSeguimiento
      ? parseConsecutiveFromCodigo(last.codigoSeguimiento, year)
      : null;
    return (parsed ?? 0) + 1;
  }
}
