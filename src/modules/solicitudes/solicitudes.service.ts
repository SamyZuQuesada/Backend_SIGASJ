import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import {
  isPlazoArregloPagoValido,
  PLAZOS_ARREGLO_PAGO_PERMITIDOS,
} from '../../common/enums/plazo-arreglo-pago.enum';
import { SolicitudEstado } from '../../common/enums/solicitud-estado.enum';
import { CalidadTitularCambioTitular } from '../../common/enums/calidad-titular-cambio-titular.enum';
import {
  DOCUMENTOS_DISPONIBILIDAD_ESTACION_COMBUSTIBLE,
  DOCUMENTOS_DISPONIBILIDAD_OBLIGATORIOS,
  DOCUMENTOS_DISPONIBILIDAD_REPRESENTANTE,
  DOCUMENTOS_INFRA_OBLIGATORIOS,
  DOCUMENTOS_INFRA_REUNION_FINCAS,
  isTipoDocumentoSolicitud,
  TipoDocumentoSolicitud,
} from '../../common/enums/tipo-documento-solicitud.enum';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { MedioNotificacionCambioTitular } from '../../common/enums/medio-notificacion-cambio-titular.enum';
import {
  propositoDisponibilidadRequierePlano,
  PropositoDisponibilidadServiciosConfirmado,
} from '../../common/enums/proposito-disponibilidad-servicios.enum';
import { PropositoInfraestructuraLinderosConfirmado } from '../../common/enums/proposito-infraestructura-linderos.enum';
import {
  isMotivoConstanciaServicioValido,
  isMotivoOtro,
  MOTIVOS_CONSTANCIA_SERVICIO,
} from '../../common/enums/motivo-constancia-servicio.enum';
import {
  deleteSolicitudDocumentFile,
  linkSolicitudDocumentFile,
  saveSolicitudDocumentPending,
  type SolicitudDocumentFile,
} from '../../common/media/public-media';
import { CreateSolicitudAfiliacionDto } from './dto/create-solicitud-afiliacion.dto';
import { CreateSolicitudArregloPagoDto } from './dto/create-solicitud-arreglo-pago.dto';
import { CreateSolicitudCambioTitularDto } from './dto/create-solicitud-cambio-titular.dto';
import { CreateSolicitudDisponibilidadServiciosDto } from './dto/create-solicitud-disponibilidad-servicios.dto';
import { CreateSolicitudInfraestructuraLinderosDto } from './dto/create-solicitud-infraestructura-linderos.dto';
import { CreateSolicitudConstanciaServicioDto } from './dto/create-solicitud-constancia-servicio.dto';
import { DocumentoSolicitudReferenciaDto } from './dto/documento-solicitud-referencia.dto';
import { QuerySolicitudesDto } from './dto/query-solicitudes.dto';
import { SolicitudPendienteDto } from './dto/solicitud-pendiente.dto';
import { SolicitudesAprobadaPendientesResponseDto } from './dto/solicitudes-aprobada-pendientes-response.dto';
import { DocumentoSolicitud } from './entities/documento-solicitud.entity';
import { SolicitudAfiliacion } from './entities/solicitud-afiliacion.entity';
import { SolicitudArregloPago } from './entities/solicitud-arreglo-pago.entity';
import { SolicitudCambioTitular } from './entities/solicitud-cambio-titular.entity';
import { SolicitudDisponibilidadServicios } from './entities/solicitud-disponibilidad-servicios.entity';
import { SolicitudInfraestructuraLinderos } from './entities/solicitud-infraestructura-linderos.entity';
import { SolicitudConstanciaServicio } from './entities/solicitud-constancia-servicio.entity';
import { SolicitudServicio } from './entities/solicitud-servicio.entity';
import { Solicitud } from './entities/solicitud.entity';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';
import { SolicitudNoEncontradaException } from './errors/solicitud.errors';
import { TiposSolicitudService } from './tipos-solicitud.service';

export type DocumentoSolicitudUploadResponse = {
  id: number;
  tipoDocumento: TipoDocumentoSolicitud;
  nombreOriginal: string;
  tipoArchivo: string;
  tamanio: number;
  tokenReclamo: string;
  fechaCarga: Date;
};

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
    @InjectRepository(DocumentoSolicitud)
    private readonly documentoSolicitudRepository?: Repository<DocumentoSolicitud>,
    @Optional()
    private readonly tiposSolicitudService?: TiposSolicitudService,
  ) {}

  /**
   * Sube un adjunto ciudadano pendiente de reclamo (público).
   * Devuelve id + tokenReclamo para incluir en el POST del trámite.
   */
  async subirDocumentoSolicitud(
    file: SolicitudDocumentFile,
    tipoDocumentoRaw: string,
  ): Promise<DocumentoSolicitudUploadResponse> {
    const tipoDocumento = tipoDocumentoRaw?.trim();
    if (!tipoDocumento || !isTipoDocumentoSolicitud(tipoDocumento)) {
      throw new BadRequestException(
        `El tipo de documento no es válido. Opciones: ${Object.values(TipoDocumentoSolicitud).join(', ')}`,
      );
    }

    const { rutaReferenciaArchivo } = saveSolicitudDocumentPending(file);
    const tokenReclamo = randomUUID().replace(/-/g, '');

    try {
      const pendiente = this.documentoSolicitudRepo.create({
        solicitudId: null,
        tipoDocumento,
        nombreOriginal: file.originalname,
        tipoArchivo: file.mimetype,
        rutaReferenciaArchivo,
        tamanio: file.size,
        tokenReclamo,
      });
      const saved = await this.documentoSolicitudRepo.save(pendiente);
      return {
        id: saved.id,
        tipoDocumento: saved.tipoDocumento,
        nombreOriginal: saved.nombreOriginal,
        tipoArchivo: saved.tipoArchivo,
        tamanio: saved.tamanio,
        tokenReclamo: saved.tokenReclamo,
        fechaCarga: saved.fechaCarga,
      };
    } catch (error) {
      deleteSolicitudDocumentFile(rutaReferenciaArchivo);
      throw error;
    }
  }

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
   * Registra una solicitud pública de Cambio de Nombre del Titular del Servicio.
   * Crea cabecera `Solicitud` + detalle `SolicitudCambioTitular` en una sola transacción.
   * El estado, tipo, código y timestamps se asignan internamente (no desde el body).
   */
  async crearSolicitudCambioTitular(
    dto: CreateSolicitudCambioTitularDto,
  ): Promise<Solicitud> {
    let tipo: TipoSolicitud | null = null;
    if (this.tiposSolicitudService) {
      tipo = await this.tiposSolicitudService.findBySlug(
        TipoSolicitudSlug.CAMBIO_TITULAR,
      );
    } else if (this.tipoSolicitudRepository) {
      tipo = await this.tipoSolicitudRepo.findOne({
        where: { slug: TipoSolicitudSlug.CAMBIO_TITULAR },
      });
    }

    const tipoSolicitudId = tipo ? tipo.id : 2;
    const codigoSeguimiento = await this.generarCodigoSeguimiento();

    const resultado = await this.solicitudRepo.manager.transaction(
      async (manager) => {
        const solicitudRepo = manager.getRepository(Solicitud);
        const detalleRepo = manager.getRepository(SolicitudCambioTitular);

        const nuevaSolicitud = solicitudRepo.create({
          tipoSolicitudId,
          codigoSeguimiento,
          estado: EstadoSolicitud.PENDIENTE,
          fechaIngreso: new Date(),
        });
        const solicitudGuardada = await solicitudRepo.save(nuevaSolicitud);

        const nuevoDetalle = detalleRepo.create({
          solicitudId: solicitudGuardada.id,
          nombreSolicitante: dto.nombreSolicitante,
          identificacionSolicitante: dto.identificacionSolicitante,
          telefono: dto.telefono,
          nombrePropietarioRegistral: dto.nombrePropietarioRegistral,
          identificacionPropietario: dto.identificacionPropietario,
          folioReal: dto.folioReal?.trim() ? dto.folioReal.trim() : null,
          planoCatastrado: dto.planoCatastrado?.trim()
            ? dto.planoCatastrado.trim()
            : null,
          planoAgrimensura: dto.planoAgrimensura?.trim()
            ? dto.planoAgrimensura.trim()
            : null,
          naturalezaInmueble: dto.naturalezaInmueble,
          calidadTitular: dto.calidadTitular,
          nis: dto.nis,
          facturaANombreDe: dto.facturaANombreDe,
          medioNotificacionPrincipal: dto.medioNotificacionPrincipal,
          medioNotificacionSecundario: dto.medioNotificacionSecundario ?? null,
          firma: dto.firma?.trim() ? dto.firma.trim() : null,
        });
        const detalleGuardado = await detalleRepo.save(nuevoDetalle);

        solicitudGuardada.detalleCambioTitular = detalleGuardado;
        if (tipo) {
          solicitudGuardada.tipoSolicitud = tipo;
        }
        return solicitudGuardada;
      },
    );

    this.logger.log(
      `Solicitud de Cambio de Titular registrada con código ${resultado.codigoSeguimiento}`,
    );

    return resultado;
  }

  /**
   * Registra una solicitud pública de Constancia de Infraestructura Frente a Linderos.
   * Crea cabecera `Solicitud` + detalle `SolicitudInfraestructuraLinderos` en una transacción.
   * Estado, tipo, código y timestamps se asignan internamente (no desde el body).
   */
  async crearSolicitudInfraestructuraLinderos(
    dto: CreateSolicitudInfraestructuraLinderosDto,
  ): Promise<Solicitud> {
    this.validarNotificacionesInfraestructura(dto);
    this.validarRequisitosDocumentalesPorProposito(dto);

    const documentosPendientes = await this.resolverDocumentosPendientes(
      dto.documentos,
    );
    this.validarTiposDocumentalesInfraestructura(
      dto.proposito,
      documentosPendientes,
    );

    let tipo: TipoSolicitud | null = null;
    if (this.tiposSolicitudService) {
      tipo = await this.tiposSolicitudService.findBySlug(
        TipoSolicitudSlug.INFRAESTRUCTURA_LINDEROS,
      );
    } else if (this.tipoSolicitudRepository) {
      tipo = await this.tipoSolicitudRepo.findOne({
        where: { slug: TipoSolicitudSlug.INFRAESTRUCTURA_LINDEROS },
      });
    }

    const tipoSolicitudId = tipo ? tipo.id : 3;
    const codigoSeguimiento = await this.generarCodigoSeguimiento();
    const linkedPaths: string[] = [];

    try {
      const resultado = await this.solicitudRepo.manager.transaction(
        async (manager) => {
          const solicitudRepo = manager.getRepository(Solicitud);
          const detalleRepo = manager.getRepository(
            SolicitudInfraestructuraLinderos,
          );
          const documentoRepo = manager.getRepository(DocumentoSolicitud);

          const nuevaSolicitud = solicitudRepo.create({
            tipoSolicitudId,
            codigoSeguimiento,
            estado: EstadoSolicitud.PENDIENTE,
            fechaIngreso: new Date(),
          });
          const solicitudGuardada = await solicitudRepo.save(nuevaSolicitud);

          const nuevoDetalle = detalleRepo.create({
            solicitudId: solicitudGuardada.id,
            nis: dto.nis,
            tipoPersona: dto.tipoPersona,
            nombreFisica: dto.nombreFisica?.trim()
              ? dto.nombreFisica.trim()
              : null,
            apellidosFisica: dto.apellidosFisica?.trim()
              ? dto.apellidosFisica.trim()
              : null,
            identificacionFisica: dto.identificacionFisica?.trim()
              ? dto.identificacionFisica.trim()
              : null,
            telefonoFisica: dto.telefonoFisica?.trim()
              ? dto.telefonoFisica.trim()
              : null,
            razonSocial: dto.razonSocial?.trim()
              ? dto.razonSocial.trim()
              : null,
            cedulaJuridica: dto.cedulaJuridica?.trim()
              ? dto.cedulaJuridica.trim()
              : null,
            nombreRepresentante: dto.nombreRepresentante?.trim()
              ? dto.nombreRepresentante.trim()
              : null,
            identificacionRepresentante: dto.identificacionRepresentante?.trim()
              ? dto.identificacionRepresentante.trim()
              : null,
            telefonoRepresentante: dto.telefonoRepresentante?.trim()
              ? dto.telefonoRepresentante.trim()
              : null,
            calidadTitular: dto.calidadTitular,
            provincia: dto.provincia,
            canton: dto.canton,
            distrito: dto.distrito,
            direccionExacta: dto.direccionExacta,
            folioReal: dto.folioReal?.trim() ? dto.folioReal.trim() : null,
            planoCatastrado: dto.planoCatastrado,
            planoAgrimensura: dto.planoAgrimensura?.trim()
              ? dto.planoAgrimensura.trim()
              : null,
            proposito: dto.proposito,
            medioNotificacionPrincipal: dto.medioNotificacionPrincipal,
            valorNotificacionPrincipal: dto.valorNotificacionPrincipal?.trim()
              ? dto.valorNotificacionPrincipal.trim()
              : null,
            medioNotificacionSecundario:
              dto.medioNotificacionSecundario ?? null,
            valorNotificacionSecundario: dto.valorNotificacionSecundario?.trim()
              ? dto.valorNotificacionSecundario.trim()
              : null,
            firma: dto.firma?.trim() ? dto.firma.trim() : null,
          });
          const detalleGuardado = await detalleRepo.save(nuevoDetalle);

          const documentosVinculados: DocumentoSolicitud[] = [];
          for (const pendiente of documentosPendientes) {
            const linked = linkSolicitudDocumentFile(
              solicitudGuardada.id,
              pendiente.rutaReferenciaArchivo,
            );
            linkedPaths.push(linked.rutaReferenciaArchivo);
            pendiente.solicitudId = solicitudGuardada.id;
            pendiente.rutaReferenciaArchivo = linked.rutaReferenciaArchivo;
            // Token consumido: evita reutilizar el mismo adjunto en otra solicitud.
            pendiente.tokenReclamo = `used:${pendiente.id}:${randomUUID().replace(/-/g, '').slice(0, 16)}`;
            documentosVinculados.push(await documentoRepo.save(pendiente));
          }

          solicitudGuardada.detalleInfraestructuraLinderos = detalleGuardado;
          solicitudGuardada.documentos = documentosVinculados;
          if (tipo) {
            solicitudGuardada.tipoSolicitud = tipo;
          }
          return solicitudGuardada;
        },
      );

      this.logger.log(
        `Solicitud de Infraestructura/Linderos registrada con código ${resultado.codigoSeguimiento}`,
      );

      return resultado;
    } catch (error) {
      for (const path of linkedPaths) {
        try {
          deleteSolicitudDocumentFile(path);
        } catch {
          // Conservar error original; limpieza best-effort.
        }
      }
      throw error;
    }
  }

  /**
   * Registra una solicitud pública de Afiliación.
   * Crea cabecera `Solicitud` + detalle `SolicitudAfiliacion` (con ambas
   * recomendaciones embebidas) en una sola transacción.
   * Estado, tipo, código y timestamps se asignan internamente (no desde el body).
   * Campos de Junta Directiva no existen en el modelo 4.7.1 (BLOCKED/PDF).
   */
  async crearSolicitudAfiliacion(
    dto: CreateSolicitudAfiliacionDto,
  ): Promise<Solicitud> {
    let tipo: TipoSolicitud | null = null;
    if (this.tiposSolicitudService) {
      tipo = await this.tiposSolicitudService.findBySlug(
        TipoSolicitudSlug.AFILIACION,
      );
    } else if (this.tipoSolicitudRepository) {
      tipo = await this.tipoSolicitudRepo.findOne({
        where: { slug: TipoSolicitudSlug.AFILIACION },
      });
    }

    const tipoSolicitudId = tipo ? tipo.id : 4;
    const codigoSeguimiento = await this.generarCodigoSeguimiento();

    const resultado = await this.solicitudRepo.manager.transaction(
      async (manager) => {
        const solicitudRepo = manager.getRepository(Solicitud);
        const detalleRepo = manager.getRepository(SolicitudAfiliacion);

        const nuevaSolicitud = solicitudRepo.create({
          tipoSolicitudId,
          codigoSeguimiento,
          estado: EstadoSolicitud.PENDIENTE,
          fechaIngreso: new Date(),
        });
        const solicitudGuardada = await solicitudRepo.save(nuevaSolicitud);

        const nuevoDetalle = detalleRepo.create({
          solicitudId: solicitudGuardada.id,
          fechaSolicitud: dto.fechaSolicitud,
          nombre: dto.nombre,
          identificacion: dto.identificacion,
          vecinoDe: dto.vecinoDe,
          estadoCivil: dto.estadoCivil,
          telefono: dto.telefono,
          correoElectronico: dto.correoElectronico,
          numeroAbonado: dto.numeroAbonado,
          numeroPlano: dto.numeroPlano,
          folioReal: dto.folioReal?.trim() ? dto.folioReal.trim() : null,
          firmaSolicitante: dto.firmaSolicitante?.trim()
            ? dto.firmaSolicitante.trim()
            : null,
          recomendacion1Nombre: dto.recomendacion1Nombre,
          recomendacion1Identificacion: dto.recomendacion1Identificacion,
          recomendacion1NumeroAbonado: dto.recomendacion1NumeroAbonado,
          recomendacion1Firma: dto.recomendacion1Firma?.trim()
            ? dto.recomendacion1Firma.trim()
            : null,
          recomendacion2Nombre: dto.recomendacion2Nombre,
          recomendacion2Identificacion: dto.recomendacion2Identificacion,
          recomendacion2NumeroAbonado: dto.recomendacion2NumeroAbonado,
          recomendacion2Firma: dto.recomendacion2Firma?.trim()
            ? dto.recomendacion2Firma.trim()
            : null,
        });
        const detalleGuardado = await detalleRepo.save(nuevoDetalle);

        solicitudGuardada.detalleAfiliacion = detalleGuardado;
        if (tipo) {
          solicitudGuardada.tipoSolicitud = tipo;
        }
        return solicitudGuardada;
      },
    );

    this.logger.log(
      `Solicitud de Afiliación registrada con código ${resultado.codigoSeguimiento}`,
    );

    return resultado;
  }

  /**
   * Registra una solicitud pública de Constancia de Disponibilidad de Servicios.
   * Valida reglas de negocio (planos, documentos, notificaciones) ANTES de persistir.
   * Crea Solicitud + detalle + reclama documentos en una sola transacción.
   */
  async crearSolicitudDisponibilidadServicios(
    dto: CreateSolicitudDisponibilidadServiciosDto,
  ): Promise<Solicitud> {
    this.validarReglasNegocioDisponibilidad(dto);
    this.validarNotificacionesDisponibilidad(dto);

    const documentosPendientes = await this.resolverDocumentosPendientes(
      dto.documentos,
    );
    this.validarTiposDocumentalesDisponibilidad(dto, documentosPendientes);

    let tipo: TipoSolicitud | null = null;
    if (this.tiposSolicitudService) {
      tipo = await this.tiposSolicitudService.findBySlug(
        TipoSolicitudSlug.DISPONIBILIDAD_SERVICIOS,
      );
    } else if (this.tipoSolicitudRepository) {
      tipo = await this.tipoSolicitudRepo.findOne({
        where: { slug: TipoSolicitudSlug.DISPONIBILIDAD_SERVICIOS },
      });
    }

    const tipoSolicitudId = tipo ? tipo.id : 5;
    const codigoSeguimiento = await this.generarCodigoSeguimiento();
    const linkedPaths: string[] = [];

    try {
      const resultado = await this.solicitudRepo.manager.transaction(
        async (manager) => {
          const solicitudRepo = manager.getRepository(Solicitud);
          const detalleRepo = manager.getRepository(
            SolicitudDisponibilidadServicios,
          );
          const documentoRepo = manager.getRepository(DocumentoSolicitud);

          const nuevaSolicitud = solicitudRepo.create({
            tipoSolicitudId,
            codigoSeguimiento,
            estado: EstadoSolicitud.PENDIENTE,
            fechaIngreso: new Date(),
          });
          const solicitudGuardada = await solicitudRepo.save(nuevaSolicitud);

          const nuevoDetalle = detalleRepo.create({
            solicitudId: solicitudGuardada.id,
            tipoPersona: dto.tipoPersona,
            nombreFisica: dto.nombreFisica?.trim()
              ? dto.nombreFisica.trim()
              : null,
            primerApellidoFisica: dto.primerApellidoFisica?.trim()
              ? dto.primerApellidoFisica.trim()
              : null,
            segundoApellidoFisica: dto.segundoApellidoFisica?.trim()
              ? dto.segundoApellidoFisica.trim()
              : null,
            identificacionFisica: dto.identificacionFisica?.trim()
              ? dto.identificacionFisica.trim()
              : null,
            telefonoFisica: dto.telefonoFisica?.trim()
              ? dto.telefonoFisica.trim()
              : null,
            razonSocial: dto.razonSocial?.trim()
              ? dto.razonSocial.trim()
              : null,
            identificacionJuridica: dto.identificacionJuridica?.trim()
              ? dto.identificacionJuridica.trim()
              : null,
            nombreRepresentante: dto.nombreRepresentante?.trim()
              ? dto.nombreRepresentante.trim()
              : null,
            identificacionRepresentante: dto.identificacionRepresentante?.trim()
              ? dto.identificacionRepresentante.trim()
              : null,
            telefonoRepresentante: dto.telefonoRepresentante?.trim()
              ? dto.telefonoRepresentante.trim()
              : null,
            medioNotificacionPrincipal: dto.medioNotificacionPrincipal,
            valorNotificacionPrincipal: dto.valorNotificacionPrincipal?.trim()
              ? dto.valorNotificacionPrincipal.trim()
              : null,
            medioNotificacionSecundario:
              dto.medioNotificacionSecundario ?? null,
            valorNotificacionSecundario: dto.valorNotificacionSecundario?.trim()
              ? dto.valorNotificacionSecundario.trim()
              : null,
            provincia: dto.provincia,
            canton: dto.canton,
            distrito: dto.distrito,
            direccionExacta: dto.direccionExacta,
            folioReal: dto.folioReal?.trim() ? dto.folioReal.trim() : null,
            planoCatastrado: dto.planoCatastrado?.trim()
              ? dto.planoCatastrado.trim()
              : null,
            planoAgrimensura: dto.planoAgrimensura?.trim()
              ? dto.planoAgrimensura.trim()
              : null,
            nis: dto.nis?.trim() ? dto.nis.trim() : null,
            naturalezaInmueble: dto.naturalezaInmueble,
            calidadTitular: dto.calidadTitular,
            proposito: dto.proposito,
            numeroDisponibilidadAnterior:
              dto.numeroDisponibilidadAnterior?.trim()
                ? dto.numeroDisponibilidadAnterior.trim()
                : null,
            descripcionProyecto: dto.descripcionProyecto.trim(),
            cantidadDormitorios:
              dto.cantidadDormitorios !== undefined
                ? dto.cantidadDormitorios
                : null,
            unidadesHabitacionales:
              dto.unidadesHabitacionales !== undefined
                ? dto.unidadesHabitacionales
                : null,
            areaConstruccion:
              dto.areaConstruccion !== undefined ? dto.areaConstruccion : null,
            niveles: dto.niveles !== undefined ? dto.niveles : null,
            caudalRequerido:
              dto.caudalRequerido !== undefined ? dto.caudalRequerido : null,
            autorizacionInspeccion: dto.autorizacionInspeccion,
            firma: dto.firma?.trim() ? dto.firma.trim() : null,
          });
          const detalleGuardado = await detalleRepo.save(nuevoDetalle);

          const documentosVinculados: DocumentoSolicitud[] = [];
          for (const pendiente of documentosPendientes) {
            const linked = linkSolicitudDocumentFile(
              solicitudGuardada.id,
              pendiente.rutaReferenciaArchivo,
            );
            linkedPaths.push(linked.rutaReferenciaArchivo);
            pendiente.solicitudId = solicitudGuardada.id;
            pendiente.rutaReferenciaArchivo = linked.rutaReferenciaArchivo;
            pendiente.tokenReclamo = `used:${pendiente.id}:${randomUUID().replace(/-/g, '').slice(0, 16)}`;
            documentosVinculados.push(await documentoRepo.save(pendiente));
          }

          solicitudGuardada.detalleDisponibilidadServicios = detalleGuardado;
          solicitudGuardada.documentos = documentosVinculados;
          if (tipo) {
            solicitudGuardada.tipoSolicitud = tipo;
          }
          return solicitudGuardada;
        },
      );

      this.logger.log(
        `Solicitud de Disponibilidad de Servicios registrada con código ${resultado.codigoSeguimiento}`,
      );

      return resultado;
    } catch (error) {
      for (const path of linkedPaths) {
        try {
          deleteSolicitudDocumentFile(path);
        } catch {
          // Conservar error original; limpieza best-effort.
        }
      }
      throw error;
    }
  }

  /**
   * Valida reglas de negocio para Constancia de Servicio Existente:
   * - Motivo válido según catálogo oficial.
   * - Exige descripción en `otroMotivo` cuando se utiliza la opción "Otro".
   * - Medios de notificación no idénticos.
   */
  validarConstanciaServicio(dto: CreateSolicitudConstanciaServicioDto): void {
    if (!isMotivoConstanciaServicioValido(dto.motivo)) {
      throw new BadRequestException(
        `El motivo '${dto.motivo}' no es válido. Opciones permitidas: ${MOTIVOS_CONSTANCIA_SERVICIO.join(', ')}`,
      );
    }

    if (isMotivoOtro(dto.motivo)) {
      if (!dto.otroMotivo || !dto.otroMotivo.trim()) {
        throw new BadRequestException(
          'Debe especificar el motivo en otroMotivo cuando selecciona la opción "Otro".',
        );
      }
    }

    if (
      dto.medioNotificacionSecundario &&
      dto.medioNotificacionPrincipal.toLowerCase() ===
        dto.medioNotificacionSecundario.toLowerCase()
    ) {
      throw new BadRequestException(
        'El medio de notificación secundario no puede ser idéntico al principal.',
      );
    }
  }

  /**
   * Registra una solicitud pública de Constancia de Servicio Existente.
   * Crea cabecera `Solicitud` + detalle `SolicitudConstanciaServicio` en una sola transacción.
   * Estado, tipo, código y timestamps se asignan internamente (no desde el body).
   * Maneja documentos adjuntos pendientes opcionales si se envían referencias.
   */
  async crearSolicitudConstanciaServicio(
    dto: CreateSolicitudConstanciaServicioDto,
  ): Promise<Solicitud> {
    this.validarConstanciaServicio(dto);

    let documentosPendientes: DocumentoSolicitud[] = [];
    if (dto.documentos && dto.documentos.length > 0) {
      documentosPendientes = await this.resolverDocumentosPendientes(
        dto.documentos,
      );
    }

    let tipo: TipoSolicitud | null = null;
    if (this.tiposSolicitudService) {
      tipo = await this.tiposSolicitudService.findBySlug(
        TipoSolicitudSlug.SERVICIO_EXISTENTE,
      );
    } else if (this.tipoSolicitudRepository) {
      tipo = await this.tipoSolicitudRepo.findOne({
        where: { slug: TipoSolicitudSlug.SERVICIO_EXISTENTE },
      });
    }

    const tipoSolicitudId = tipo ? tipo.id : 6;
    const codigoSeguimiento = await this.generarCodigoSeguimiento();
    const linkedPaths: string[] = [];

    try {
      const resultado = await this.solicitudRepo.manager.transaction(
        async (manager) => {
          const solicitudRepo = manager.getRepository(Solicitud);
          const detalleRepo = manager.getRepository(
            SolicitudConstanciaServicio,
          );
          const documentoRepo = manager.getRepository(DocumentoSolicitud);

          const nuevaSolicitud = solicitudRepo.create({
            tipoSolicitudId,
            codigoSeguimiento,
            estado: EstadoSolicitud.PENDIENTE,
            fechaIngreso: new Date(),
          });
          const solicitudGuardada = await solicitudRepo.save(nuevaSolicitud);

          const nuevoDetalle = detalleRepo.create({
            solicitudId: solicitudGuardada.id,
            tipoServicio: dto.tipoServicio,
            nis: dto.nis,
            propietarioInmueble: dto.propietarioInmueble,
            nombreSolicitante: dto.nombreSolicitante,
            identificacionSolicitante: dto.identificacionSolicitante,
            correoElectronico: dto.correoElectronico,
            telefono: dto.telefono,
            folioReal: dto.folioReal?.trim() ? dto.folioReal.trim() : null,
            planoCatastrado: dto.planoCatastrado?.trim()
              ? dto.planoCatastrado.trim()
              : null,
            planoAgrimensura: dto.planoAgrimensura?.trim()
              ? dto.planoAgrimensura.trim()
              : null,
            naturalezaInmueble: dto.naturalezaInmueble,
            calidadTitular: dto.calidadTitular,
            provincia: dto.provincia,
            canton: dto.canton,
            distrito: dto.distrito,
            direccionExacta: dto.direccionExacta,
            motivo: dto.motivo,
            otroMotivo: isMotivoOtro(dto.motivo)
              ? dto.otroMotivo?.trim() ?? null
              : null,
            tramitePorRealizar: dto.tramitePorRealizar?.trim()
              ? dto.tramitePorRealizar.trim()
              : null,
            medioNotificacionPrincipal: dto.medioNotificacionPrincipal,
            medioNotificacionSecundario:
              dto.medioNotificacionSecundario ?? null,
            firma: dto.firma?.trim() ? dto.firma.trim() : null,
          });
          const detalleGuardado = await detalleRepo.save(nuevoDetalle);

          const documentosVinculados: DocumentoSolicitud[] = [];
          for (const pendiente of documentosPendientes) {
            const linked = linkSolicitudDocumentFile(
              solicitudGuardada.id,
              pendiente.rutaReferenciaArchivo,
            );
            linkedPaths.push(linked.rutaReferenciaArchivo);
            pendiente.solicitudId = solicitudGuardada.id;
            pendiente.rutaReferenciaArchivo = linked.rutaReferenciaArchivo;
            // Token consumido: evita reutilizar el mismo adjunto en otra solicitud.
            pendiente.tokenReclamo = `used:${pendiente.id}:${randomUUID().replace(/-/g, '').slice(0, 16)}`;
            documentosVinculados.push(await documentoRepo.save(pendiente));
          }

          solicitudGuardada.detalleConstanciaServicio = detalleGuardado;
          solicitudGuardada.detalleServicioExistente = detalleGuardado;
          solicitudGuardada.documentos = documentosVinculados;
          if (tipo) {
            solicitudGuardada.tipoSolicitud = tipo;
          }
          return solicitudGuardada;
        },
      );

      this.logger.log(
        `Solicitud de Constancia de Servicio Existente registrada con código ${resultado.codigoSeguimiento}`,
      );

      return resultado;
    } catch (error) {
      for (const path of linkedPaths) {
        try {
          deleteSolicitudDocumentFile(path);
        } catch {
          // Conservar error original; limpieza best-effort.
        }
      }
      throw error;
    }
  }

  /**
   * Reglas documentales (texto + adjuntos) según documentRequirementsConfig:
   * - Referencia textual planoCatastrado: siempre (DTO).
   * - Referencia textual planoAgrimensura: si propósito = «Reunión de fincas».
   * - Adjuntos binarios: identificación + plano-catastrado; + plano-agrimensura si Reunión.
   */
  private validarRequisitosDocumentalesPorProposito(
    dto: CreateSolicitudInfraestructuraLinderosDto,
  ): void {
    if (
      dto.proposito ===
        PropositoInfraestructuraLinderosConfirmado.REUNION_FINCAS &&
      !dto.planoAgrimensura?.trim()
    ) {
      throw new BadRequestException(
        'El plano de agrimensura es obligatorio cuando el propósito es Reunión de fincas',
      );
    }
  }

  private async resolverDocumentosPendientes(
    referencias: DocumentoSolicitudReferenciaDto[],
  ): Promise<DocumentoSolicitud[]> {
    if (!referencias?.length) {
      throw new BadRequestException(
        'Debe adjuntar al menos un documento requerido',
      );
    }

    const ids = referencias.map((ref) => ref.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      throw new BadRequestException(
        'No se permiten documentos duplicados en la solicitud',
      );
    }

    const pendientes = await this.documentoSolicitudRepo.find({
      where: { id: In(ids), solicitudId: IsNull() },
    });

    if (pendientes.length !== ids.length) {
      throw new BadRequestException(
        'Uno o más documentos no existen, ya fueron utilizados o no están disponibles',
      );
    }

    const byId = new Map(pendientes.map((doc) => [doc.id, doc]));
    for (const ref of referencias) {
      const doc = byId.get(ref.id);
      if (!doc || doc.tokenReclamo !== ref.tokenReclamo.trim()) {
        throw new BadRequestException(
          'La referencia de documento no es válida (id o token incorrecto)',
        );
      }
    }

    return pendientes;
  }

  private validarTiposDocumentalesInfraestructura(
    proposito: PropositoInfraestructuraLinderosConfirmado,
    documentos: DocumentoSolicitud[],
  ): void {
    const tiposPresentes = new Set(documentos.map((d) => d.tipoDocumento));
    const requeridos: TipoDocumentoSolicitud[] = [
      ...DOCUMENTOS_INFRA_OBLIGATORIOS,
    ];
    if (
      proposito === PropositoInfraestructuraLinderosConfirmado.REUNION_FINCAS
    ) {
      requeridos.push(...DOCUMENTOS_INFRA_REUNION_FINCAS);
    }

    for (const requerido of requeridos) {
      if (!tiposPresentes.has(requerido)) {
        throw new BadRequestException(
          `Falta el documento requerido de tipo «${requerido}»`,
        );
      }
    }
  }

  /** Si el medio es correo y hay valor, exige formato de email. */
  private validarNotificacionesInfraestructura(
    dto: CreateSolicitudInfraestructuraLinderosDto,
  ): void {
    this.validarFormatoEmailNotificacion(
      dto.medioNotificacionPrincipal,
      dto.valorNotificacionPrincipal,
      'principal',
    );
    this.validarFormatoEmailNotificacion(
      dto.medioNotificacionSecundario,
      dto.valorNotificacionSecundario,
      'secundario',
    );
  }

  /**
   * Reglas de negocio Disponibilidad (fuente: documentRequirementsConfig FE).
   * Condición exacta de numeroDisponibilidadAnterior: BLOCKED (PDF).
   */
  private validarReglasNegocioDisponibilidad(
    dto: CreateSolicitudDisponibilidadServiciosDto,
  ): void {
    if (!dto.descripcionProyecto?.trim()) {
      throw new BadRequestException(
        'La descripción del proyecto es obligatoria',
      );
    }

    const tienePlanoCatastrado = Boolean(dto.planoCatastrado?.trim());
    const tienePlanoAgrimensura = Boolean(dto.planoAgrimensura?.trim());

    // FE: si no hay plano catastrado, aportar plano de agrimensura.
    if (!tienePlanoCatastrado && !tienePlanoAgrimensura) {
      throw new BadRequestException(
        'Debe indicar plano catastrado o plano de agrimensura',
      );
    }

    if (
      propositoDisponibilidadRequierePlano(dto.proposito) &&
      !tienePlanoCatastrado &&
      !tienePlanoAgrimensura
    ) {
      throw new BadRequestException(
        `El propósito «${dto.proposito}» requiere referencia de plano catastrado o de agrimensura`,
      );
    }

    // Estación de combustible (FE special): exige plano catastrado textual.
    if (
      dto.proposito ===
        PropositoDisponibilidadServiciosConfirmado.ESTACION_COMBUSTIBLE &&
      !tienePlanoCatastrado
    ) {
      throw new BadRequestException(
        'El propósito Estación de combustible requiere plano catastrado',
      );
    }
  }

  private validarTiposDocumentalesDisponibilidad(
    dto: CreateSolicitudDisponibilidadServiciosDto,
    documentos: DocumentoSolicitud[],
  ): void {
    const tiposPresentes = new Set(documentos.map((d) => d.tipoDocumento));
    const requeridos: TipoDocumentoSolicitud[] = [
      ...DOCUMENTOS_DISPONIBILIDAD_OBLIGATORIOS,
    ];

    if (
      dto.calidadTitular === CalidadTitularCambioTitular.REPRESENTANTE_LEGAL
    ) {
      requeridos.push(...DOCUMENTOS_DISPONIBILIDAD_REPRESENTANTE);
    }

    if (
      dto.proposito ===
      PropositoDisponibilidadServiciosConfirmado.ESTACION_COMBUSTIBLE
    ) {
      for (const extra of DOCUMENTOS_DISPONIBILIDAD_ESTACION_COMBUSTIBLE) {
        if (!requeridos.includes(extra)) {
          requeridos.push(extra);
        }
      }
    }

    for (const requerido of requeridos) {
      if (!tiposPresentes.has(requerido)) {
        throw new BadRequestException(
          `Falta el documento requerido de tipo «${requerido}»`,
        );
      }
    }

    // Fraccionamiento / urbanización / derechos / estación: al menos un plano adjunto.
    if (propositoDisponibilidadRequierePlano(dto.proposito)) {
      const tienePlanoAdjunto =
        tiposPresentes.has(TipoDocumentoSolicitud.PLANO_CATASTRADO) ||
        tiposPresentes.has(TipoDocumentoSolicitud.PLANO_AGRIMENSURA);
      if (!tienePlanoAdjunto) {
        throw new BadRequestException(
          'Debe adjuntar plano catastrado o plano de agrimensura según el propósito',
        );
      }
    }

    // Sin plano catastrado textual → adjunto de agrimensura (FE).
    if (
      !dto.planoCatastrado?.trim() &&
      !tiposPresentes.has(TipoDocumentoSolicitud.PLANO_AGRIMENSURA)
    ) {
      throw new BadRequestException(
        'Si no aporta plano catastrado, debe adjuntar el plano de agrimensura',
      );
    }
  }

  private validarNotificacionesDisponibilidad(
    dto: CreateSolicitudDisponibilidadServiciosDto,
  ): void {
    this.validarFormatoEmailNotificacion(
      dto.medioNotificacionPrincipal,
      dto.valorNotificacionPrincipal,
      'principal',
    );
    this.validarFormatoEmailNotificacion(
      dto.medioNotificacionSecundario,
      dto.valorNotificacionSecundario,
      'secundario',
    );
  }

  private validarFormatoEmailNotificacion(
    medio: MedioNotificacionCambioTitular | undefined,
    valor: string | undefined,
    etiqueta: 'principal' | 'secundario',
  ): void {
    const emailSimple = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (
      medio === MedioNotificacionCambioTitular.CORREO &&
      valor?.trim() &&
      !emailSimple.test(valor.trim())
    ) {
      throw new BadRequestException(
        `El valor de notificación ${etiqueta} debe ser un correo electrónico válido`,
      );
    }
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
   * Consulta adjuntos ciudadanos vinculados a una solicitud.
   */
  async findDocumentosBySolicitudId(id: number): Promise<DocumentoSolicitud[]> {
    await this.findById(id);
    return this.documentoSolicitudRepo.find({
      where: { solicitudId: id },
      order: { id: 'ASC' },
    });
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

  private get documentoSolicitudRepo(): Repository<DocumentoSolicitud> {
    if (!this.documentoSolicitudRepository) {
      throw new Error(
        'DocumentoSolicitudRepository no inyectado en SolicitudesService.',
      );
    }
    return this.documentoSolicitudRepository;
  }
}
