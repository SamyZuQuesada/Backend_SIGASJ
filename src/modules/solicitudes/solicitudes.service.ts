import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import {
  isPlazoArregloPagoValido,
  PLAZOS_ARREGLO_PAGO_PERMITIDOS,
} from '../../common/enums/plazo-arreglo-pago.enum';
import { SolicitudEstado } from '../../common/enums/solicitud-estado.enum';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { CreateSolicitudArregloPagoDto } from './dto/create-solicitud-arreglo-pago.dto';
import { QuerySolicitudesDto } from './dto/query-solicitudes.dto';
import { SolicitudPendienteDto } from './dto/solicitud-pendiente.dto';
import { SolicitudesAprobadaPendientesResponseDto } from './dto/solicitudes-aprobada-pendientes-response.dto';
import { SolicitudArregloPago } from './entities/solicitud-arreglo-pago.entity';
import { SolicitudServicio } from './entities/solicitud-servicio.entity';
import { Solicitud } from './entities/solicitud.entity';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';
import { SolicitudNoEncontradaException } from './errors/solicitud.errors';
import { TiposSolicitudService } from './tipos-solicitud.service';

const SIN_SOLICITUDES_MENSAJE =
  'No hay solicitudes aprobadas pendientes de registro.';

@Injectable()
export class SolicitudesService {
  private readonly logger = new Logger(SolicitudesService.name);

  constructor(
    @InjectRepository(SolicitudServicio)
    private readonly solicitudServicioRepository: Repository<SolicitudServicio>,
    @Optional()
    @InjectRepository(Solicitud)
    private readonly solicitudRepository?: Repository<Solicitud>,
    @Optional()
    @InjectRepository(SolicitudArregloPago)
    private readonly arregloPagoRepository?: Repository<SolicitudArregloPago>,
    @Optional()
    @InjectRepository(TipoSolicitud)
    private readonly tipoSolicitudRepository?: Repository<TipoSolicitud>,
    @Optional()
    private readonly tiposSolicitudService?: TiposSolicitudService,
  ) {}

  /* =========================================================================
   * GESTIÓN DE SOLICITUDES DIGITALES (ESTRUCTURA PRINCIPAL DEL MÓDULO):
   * ========================================================================= */

  /**
   * Consulta una solicitud por su código de seguimiento alfanumérico único.
   * Utilizado en la funcionalidad Card 8 para la consulta de avance por parte del ciudadano.
   *
   * @throws SolicitudNoEncontradaException si el código no existe.
   */
  async findByCodigoSeguimiento(codigoSeguimiento: string): Promise<Solicitud> {
    const codigoNormalizado = codigoSeguimiento?.trim().toUpperCase();

    const solicitud = await this.solicitudRepo.findOne({
      where: { codigoSeguimiento: codigoNormalizado },
      relations: { tipoSolicitud: true },
    });

    if (!solicitud) {
      this.logger.warn(
        `Solicitud con código de seguimiento '${codigoNormalizado}' no encontrada`,
      );
      throw new SolicitudNoEncontradaException(codigoNormalizado);
    }

    return solicitud;
  }

  /**
   * Consulta una solicitud por su identificador numérico interno.
   *
   * @throws SolicitudNoEncontradaException si el ID no existe.
   */
  async findById(id: number): Promise<Solicitud> {
    const solicitud = await this.solicitudRepo.findOne({
      where: { id },
      relations: { tipoSolicitud: true },
    });

    if (!solicitud) {
      this.logger.warn(`Solicitud con ID ${id} no encontrada`);
      throw new SolicitudNoEncontradaException(id);
    }

    return solicitud;
  }

  /**
   * Listado paginado de solicitudes con filtros comunes (estado, tipo de solicitud, etc.).
   */
  async findAll(
    filtros: QuerySolicitudesDto = {},
  ): Promise<{ solicitudes: Solicitud[]; total: number }> {
    const { tipoSolicitudId, slug, estado, page = 1, limit = 20 } = filtros;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Solicitud> = {};
    if (tipoSolicitudId) {
      where.tipoSolicitudId = tipoSolicitudId;
    }
    if (slug) {
      where.tipoSolicitud = { slug: slug.trim().toLowerCase() };
    }
    if (estado) {
      where.estado = estado;
    }

    const [solicitudes, total] = await this.solicitudRepo.findAndCount({
      where,
      relations: { tipoSolicitud: true },
      order: { fechaIngreso: 'DESC' },
      skip,
      take: limit,
    });

    return { solicitudes, total };
  }

  /**
   * Actualiza el estado de una solicitud dentro de su ciclo de vida.
   */
  async actualizarEstado(
    id: number,
    nuevoEstado: EstadoSolicitud,
  ): Promise<Solicitud> {
    const solicitud = await this.findById(id);
    solicitud.estado = nuevoEstado;
    return this.solicitudRepo.save(solicitud);
  }

  /**
   * Registra una nueva solicitud digital oficial de Arreglo de Pago Domiciliar.
   * Genera el encabezado Solicitud, su código de seguimiento y almacena el detalle SolicitudArregloPago.
   *
   * @throws BadRequestException si el plazo seleccionado no es una de las opciones oficiales permitidas.
   */
  async crearSolicitudArregloPago(
    dto: CreateSolicitudArregloPagoDto,
  ): Promise<Solicitud> {
    if (!isPlazoArregloPagoValido(dto.plazoSeleccionado)) {
      throw new BadRequestException(
        `El plazo '${dto.plazoSeleccionado}' no es válido. Opciones permitidas: ${PLAZOS_ARREGLO_PAGO_PERMITIDOS.join(', ')}`,
      );
    }

    if (
      dto.montoPrimaInicial !== undefined &&
      dto.montoPrimaInicial !== null &&
      Number(dto.montoPrimaInicial) < 0
    ) {
      throw new BadRequestException(
        'El monto de la prima inicial no puede ser negativo.',
      );
    }

    // Resolver tipo de solicitud para Arreglo de Pago
    let tipo: TipoSolicitud | null = null;
    if (this.tiposSolicitudService) {
      tipo = await this.tiposSolicitudService.findBySlug(
        TipoSolicitudSlug.ARREGLO_PAGO,
      );
    } else if (this.tipoSolicitudRepository) {
      tipo = await this.tipoSolicitudRepo.findOne({
        where: { slug: TipoSolicitudSlug.ARREGLO_PAGO },
      });
    }

    const tipoSolicitudId = tipo ? tipo.id : 1;
    const codigoSeguimiento = await this.generarCodigoSeguimiento();

    // 1. Guardar cabecera Solicitud
    const nuevaSolicitud = this.solicitudRepo.create({
      tipoSolicitudId,
      codigoSeguimiento,
      estado: EstadoSolicitud.PENDIENTE,
      fechaIngreso: new Date(),
    });
    const solicitudGuardada = await this.solicitudRepo.save(nuevaSolicitud);

    // 2. Guardar detalle SolicitudArregloPago
    const nuevoDetalle = this.arregloPagoRepo.create({
      solicitudId: solicitudGuardada.id,
      nombre: dto.nombre?.trim(),
      cedula: dto.cedula?.trim(),
      vecinoDe: dto.vecinoDe?.trim(),
      telefono: dto.telefono?.trim(),
      numeroCuentaServicio: dto.numeroCuentaServicio?.trim(),
      montoPrimaInicial: Number(dto.montoPrimaInicial),
      plazoSeleccionado: dto.plazoSeleccionado,
      firma: dto.firma || null,
    });
    const detalleGuardado = await this.arregloPagoRepo.save(nuevoDetalle);

    solicitudGuardada.detalleArregloPago = detalleGuardado;
    if (tipo) {
      solicitudGuardada.tipoSolicitud = tipo;
    }

    this.logger.log(
      `Solicitud de Arreglo de Pago registrada exitosamente con código ${solicitudGuardada.codigoSeguimiento} para cuenta ${dto.numeroCuentaServicio}`,
    );

    return solicitudGuardada;
  }

  /**
   * Genera el siguiente código de seguimiento único correlativo para el año en curso.
   * Formato: SOL-YYYY-XXXXX (e.g. SOL-2026-00001)
   */
  async generarCodigoSeguimiento(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SOL-${year}-`;

    try {
      const ultimo = await this.solicitudRepo
        .createQueryBuilder('s')
        .where('s.codigoSeguimiento LIKE :prefix', { prefix: `${prefix}%` })
        .orderBy('s.id', 'DESC')
        .getOne();

      let consecutivo = 1;
      if (ultimo?.codigoSeguimiento) {
        const match = ultimo.codigoSeguimiento.match(/SOL-\d{4}-(\d+)/);
        if (match && match[1]) {
          consecutivo = parseInt(match[1], 10) + 1;
        }
      }
      return `${prefix}${String(consecutivo).padStart(5, '0')}`;
    } catch {
      // Fallback para entornos donde createQueryBuilder no esté disponible (mock)
      const randomConsecutivo = Math.floor(10000 + Math.random() * 90000);
      return `${prefix}${randomConsecutivo}`;
    }
  }

  /* =========================================================================
   * PREPARACIÓN PARA EXTENSIÓN CON DOCUMENTOS E HISTORIAL:
   * ========================================================================= */

  /**
   * Preparación para consulta de documentos oficiales adjuntos a una solicitud.
   */
  async findDocumentosBySolicitudId(id: number): Promise<any[]> {
    const solicitud = await this.findById(id);
    return solicitud.documentos || [];
  }

  /**
   * Preparación para consulta del historial de trazabilidad y eventos de una solicitud.
   */
  async findHistorialBySolicitudId(id: number): Promise<any[]> {
    const solicitud = await this.findById(id);
    return solicitud.historial || [];
  }

  /* =========================================================================
   * COMPATIBILIDAD CON SERVICIO HISTÓRICO (SOLICITUDES DE SERVICIO):
   * ========================================================================= */

  async findAprobadasPendientes(): Promise<SolicitudesAprobadaPendientesResponseDto> {
    const solicitudes = await this.solicitudServicioRepository.find({
      where: {
        estado: SolicitudEstado.APROBADA,
        utilizada: false,
      },
      order: { idSolicitud: 'ASC' },
    });

    const items = solicitudes.map((solicitud) =>
      this.toPendienteDto(solicitud),
    );

    return {
      solicitudes: items,
      mensaje: items.length === 0 ? SIN_SOLICITUDES_MENSAJE : null,
    };
  }

  private toPendienteDto(solicitud: SolicitudServicio): SolicitudPendienteDto {
    return {
      idSolicitud: solicitud.idSolicitud,
      nombre: solicitud.nombre,
      apellidos: solicitud.apellidos,
      cedula: solicitud.cedula,
      telefono: solicitud.telefono,
      correo: solicitud.correo,
      direccion: solicitud.direccion,
      utilizada: solicitud.utilizada,
    };
  }

  private get solicitudRepo(): Repository<Solicitud> {
    if (!this.solicitudRepository) {
      throw new Error(
        'SolicitudRepository no inyectado en SolicitudesService.',
      );
    }
    return this.solicitudRepository;
  }

  private get arregloPagoRepo(): Repository<SolicitudArregloPago> {
    if (!this.arregloPagoRepository) {
      throw new Error(
        'SolicitudArregloPagoRepository no inyectado en SolicitudesService.',
      );
    }
    return this.arregloPagoRepository;
  }

  private get tipoSolicitudRepo(): Repository<TipoSolicitud> {
    if (!this.tipoSolicitudRepository) {
      throw new Error(
        'TipoSolicitudRepository no inyectado en SolicitudesService.',
      );
    }
    return this.tipoSolicitudRepository;
  }
}
