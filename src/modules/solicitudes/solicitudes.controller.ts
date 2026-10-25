import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  MAX_SOLICITUD_DOCUMENT_BYTES,
  type SolicitudDocumentFile,
} from '../../common/media/public-media';
import { CambiarEstadoSolicitudDto } from './dto/cambiar-estado-solicitud.dto';
import { CambioEstadoSolicitudResponseDto } from './dto/cambio-estado-solicitud.response';
import { ConsultarSeguimientoSolicitudDto } from './dto/consultar-seguimiento-solicitud.dto';
import { HistorialSolicitudItemDto } from './dto/historial-solicitud.response';
import { CreateSolicitudAfiliacionDto } from './dto/create-solicitud-afiliacion.dto';
import { CreateSolicitudArregloPagoDto } from './dto/create-solicitud-arreglo-pago.dto';
import { CreateSolicitudCambioTitularDto } from './dto/create-solicitud-cambio-titular.dto';
import { CreateSolicitudDisponibilidadServiciosDto } from './dto/create-solicitud-disponibilidad-servicios.dto';
import { CreateSolicitudInfraestructuraLinderosDto } from './dto/create-solicitud-infraestructura-linderos.dto';
import { CreateSolicitudConstanciaServicioDto } from './dto/create-solicitud-constancia-servicio.dto';
import { QuerySolicitudesDto } from './dto/query-solicitudes.dto';
import { SeguimientoSolicitudPublicoDto } from './dto/seguimiento-solicitud-publico.response';

import { SolicitudesAprobadaPendientesResponseDto } from './dto/solicitudes-aprobada-pendientes-response.dto';
import { Solicitud } from './entities/solicitud.entity';
import { SolicitudSeguimientoNoEncontradaException } from './errors/solicitud.errors';
import { SolicitudesService } from './solicitudes.service';

@ApiTags('Solicitudes')
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Post('arreglo-pago')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Registrar nueva solicitud digital de Arreglo de Pago Domiciliar (Público)',
    description:
      'Recibe los datos oficiales del formulario digital, valida el plazo y la información del abonado, y genera una Solicitud con su código único de seguimiento.',
  })
  @ApiResponse({
    status: 201,
    description: 'Solicitud de arreglo de pago registrada con éxito',
    type: Solicitud,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de validación inválidos o plazo no permitido',
  })
  crearArregloPago(
    @Body() dto: CreateSolicitudArregloPagoDto,
  ): Promise<Solicitud> {
    return this.solicitudesService.crearSolicitudArregloPago(dto);
  }

  @Post('cambio-titular')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar nueva solicitud digital de Cambio de Titular (Público)',
    description:
      'Recibe los datos del formulario de Cambio de Nombre del Titular del Servicio, valida opciones oficiales y genera la Solicitud con su detalle relacionado.',
  })
  @ApiResponse({
    status: 201,
    description: 'Solicitud de cambio de titular registrada con éxito',
    type: Solicitud,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de validación inválidos u opciones no permitidas',
  })
  crearCambioTitular(
    @Body() dto: CreateSolicitudCambioTitularDto,
  ): Promise<Solicitud> {
    return this.solicitudesService.crearSolicitudCambioTitular(dto);
  }

  @Post('documentos')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: MAX_SOLICITUD_DOCUMENT_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Subir adjunto pendiente de una solicitud pública',
    description:
      'Almacena el archivo y devuelve id + tokenReclamo para reclamarlo al registrar el trámite (JSON). No cambia el endpoint de creación a multipart.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo', 'tipoDocumento'],
      properties: {
        archivo: { type: 'string', format: 'binary' },
        tipoDocumento: {
          type: 'string',
          enum: [
            'identificacion',
            'plano-catastrado',
            'poder',
            'plano-agrimensura',
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Documento pendiente creado' })
  @ApiResponse({ status: 400, description: 'Archivo o tipo inválido' })
  subirDocumento(
    @UploadedFile() file: SolicitudDocumentFile | undefined,
    @Body('tipoDocumento') tipoDocumento: string,
  ) {
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo.');
    }
    return this.solicitudesService.subirDocumentoSolicitud(file, tipoDocumento);
  }

  @Post('infraestructura-linderos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Registrar Constancia de Infraestructura Frente a Linderos (Público)',
    description:
      'Recibe los datos del formulario de Constancia de Infraestructura Frente a Linderos de un Inmueble. Valida tipo de persona, propósito, ubicación, planos condicionales, referencias de adjuntos (documentos[]) y genera la Solicitud con su detalle relacionado.',
  })
  @ApiResponse({
    status: 201,
    description: 'Solicitud de infraestructura/linderos registrada con éxito',
    type: Solicitud,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos, opciones no permitidas o documento condicional faltante',
  })
  crearInfraestructuraLinderos(
    @Body() dto: CreateSolicitudInfraestructuraLinderosDto,
  ): Promise<Solicitud> {
    return this.solicitudesService.crearSolicitudInfraestructuraLinderos(dto);
  }

  @Post('afiliacion')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar nueva Solicitud de Afiliación (Público)',
    description:
      'Recibe los datos del formulario de Solicitud de Afiliación, valida solicitante, contacto, abonado, plano, folio, firma y ambas recomendaciones de afiliados activos. Genera la Solicitud con su detalle relacionado. No acepta campos de Junta Directiva ni administrativos.',
  })
  @ApiResponse({
    status: 201,
    description: 'Solicitud de afiliación registrada con éxito',
    type: Solicitud,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos de validación inválidos, recomendación faltante o correo inválido',
  })
  crearAfiliacion(
    @Body() dto: CreateSolicitudAfiliacionDto,
  ): Promise<Solicitud> {
    return this.solicitudesService.crearSolicitudAfiliacion(dto);
  }

  @Post('disponibilidad-servicios')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar Constancia de Disponibilidad de Servicios (Público)',
    description:
      'Recibe los datos del formulario de Constancia de Disponibilidad de Servicios. Valida titular (física/jurídica), notificaciones, ubicación, inmueble, naturaleza, calidad, propósito confirmado, descripción de proyecto obligatoria, campos de proyecto opcionales, autorización de inspección, referencias documentales reales (id+token) y genera la Solicitud con su detalle. No acepta campos administrativos.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Solicitud de disponibilidad de servicios registrada con éxito',
    type: Solicitud,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos, propósito/naturaleza no permitidos, descripción ausente, documento faltante o referencia inválida',
  })
  crearDisponibilidadServicios(
    @Body() dto: CreateSolicitudDisponibilidadServiciosDto,
  ): Promise<Solicitud> {
    return this.solicitudesService.crearSolicitudDisponibilidadServicios(dto);
  }

  @Post('servicio-existente')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar Constancia de Servicio Existente (Público)',
    description:
      'Recibe los datos del formulario de Constancia de Servicio Existente. Valida tipo de servicio, NIS, solicitante, propietario, inmueble, ubicación, motivo (exigiendo descripción para "Otro"), trámite por realizar y medios de notificación. Genera la Solicitud con su detalle relacionado.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Solicitud de constancia de servicio existente registrada con éxito',
    type: Solicitud,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos, motivo no permitido, descripción de otroMotivo faltante o campos obligatorios ausentes',
  })
  crearServicioExistente(
    @Body() dto: CreateSolicitudConstanciaServicioDto,
  ): Promise<Solicitud> {
    return this.solicitudesService.crearSolicitudConstanciaServicio(dto);
  }

  @Post('constancia-servicio')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Registrar Constancia de Servicio Existente (Alias ruta constancia-servicio)',
    description:
      'Alias amigable para registrar la solicitud de constancia de servicio existente.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Solicitud de constancia de servicio existente registrada con éxito',
    type: Solicitud,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos',
  })
  crearConstanciaServicio(
    @Body() dto: CreateSolicitudConstanciaServicioDto,
  ): Promise<Solicitud> {
    return this.solicitudesService.crearSolicitudConstanciaServicio(dto);
  }

  @Get('aprobadas-pendientes')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary:
      'Listar solicitudes de servicio aprobadas pendientes de procesamiento',
  })
  findAprobadasPendientes(): Promise<SolicitudesAprobadaPendientesResponseDto> {
    return this.solicitudesService.findAprobadasPendientes();
  }

  @Post('seguimiento')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consultar avance de solicitud (público, seguro)',
    description:
      'Requiere código de seguimiento + identificación del solicitante. ' +
      'Valida la combinación en una sola consulta (anti-enumeración). ' +
      'Devuelve únicamente datos públicos: estado, tipo, fecha e historial con observacionPublica. ' +
      'Nunca expone notaInterna, usuarios administrativos, documentos ni datos personales.',
  })
  @ApiBody({ type: ConsultarSeguimientoSolicitudDto })
  @ApiResponse({
    status: 200,
    description: 'Datos públicos de seguimiento',
    type: SeguimientoSolicitudPublicoDto,
  })
  @ApiResponse({
    status: 400,
    description: 'DTO inválido (faltan campos o formato incorrecto)',
  })
  @ApiResponse({
    status: 404,
    description:
      'Combinación no localizada (mismo mensaje genérico si el código o la identificación no corresponden)',
  })
  consultarSeguimientoPublico(
    @Body() dto: ConsultarSeguimientoSolicitudDto,
  ): Promise<SeguimientoSolicitudPublicoDto> {
    return this.solicitudesService.consultarSeguimientoPublico(dto);
  }

  /**
   * El seguimiento por código solo (4.11.2) revelaba existencia de solicitudes.
   * Se mantiene la ruta para no romper clientes, pero ya no devuelve datos:
   * use POST /solicitudes/seguimiento con código + identificación.
   */
  @Get('seguimiento/:codigoSeguimiento')
  @ApiOperation({
    summary: 'Seguimiento por código solo (retirado por privacidad)',
    description:
      'Un código por sí solo no permite obtener información. ' +
      'Use POST /solicitudes/seguimiento con código e identificación.',
    deprecated: true,
  })
  @ApiResponse({
    status: 404,
    description: 'Respuesta genérica; no revela si el código existe',
  })
  findByCodigoSeguimiento(
    @Param('codigoSeguimiento') codigoSeguimiento: string,
  ): never {
    void codigoSeguimiento;
    throw new SolicitudSeguimientoNoEncontradaException();
  }

  @Get([':solicitudId/documentos/:documentoId/descargar', ':solicitudId/documentos/:documentoId'])
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA, Role.FONTANERO)
  @ApiOperation({
    summary:
      'Descargar o visualizar archivo binario de un documento de solicitud (Protegido)',
    description:
      'Transmite el contenido binario del archivo adjunto especificado, validando pertenencia a la solicitud, permisos y existencia física.',
  })
  @ApiParam({
    name: 'solicitudId',
    type: Number,
    description: 'ID de la solicitud asociada',
    example: 15,
  })
  @ApiParam({
    name: 'documentoId',
    type: Number,
    description: 'ID del documento adjunto',
    example: 40,
  })
  @ApiResponse({
    status: 200,
    description: 'Contenido binario del archivo adjunto',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado (401)',
  })
  @ApiResponse({
    status: 403,
    description: 'No autorizado (403)',
  })
  @ApiResponse({
    status: 404,
    description:
      'Solicitud o documento inexistente, o documento no perteneciente a la solicitud (404)',
  })
  async descargarDocumento(
    @Param('solicitudId', ParseIntPipe) solicitudId: number,
    @Param('documentoId', ParseIntPipe) documentoId: number,
    @Res() response: Response,
  ) {
    const documento = await this.solicitudesService.obtenerDocumento(
      solicitudId,
      documentoId,
    );

    response.setHeader('Content-Type', documento.mimeType);
    response.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(documento.nombreOriginal)}`,
    );

    return response.sendFile(documento.rutaAbsoluta);
  }

  @Get(':id/detalle')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA, Role.FONTANERO)
  @ApiOperation({
    summary:
      'Obtener toda la información necesaria para revisar una solicitud específica (Detalle administrativo)',
    description:
      'Reconoce el tipo de formulario y devuelve la información base, detalle específico, documentos identificados, estado, historial y campos de uso de la ASADA.',
  })
  @ApiResponse({
    status: 200,
    description: 'Información completa de la solicitud para revisión',
    type: Solicitud,
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  obtenerDetalle(@Param('id', ParseIntPipe) id: number): Promise<Solicitud> {
    return this.solicitudesService.obtenerDetalle(id);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA, Role.FONTANERO)
  @ApiOperation({
    summary: 'Consultar detalle de solicitud por ID interno (Protegido)',
    description:
      'Devuelve la información completa requerida para revisar la solicitud (tipo de formulario, detalle específico, documentos, historial y estado).',
  })
  @ApiResponse({
    status: 200,
    description: 'Información de la solicitud obtenida correctamente',
    type: Solicitud,
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  findById(@Param('id', ParseIntPipe) id: number): Promise<Solicitud> {
    return this.solicitudesService.findById(id);
  }

  @Get(':id/historial')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Historial cronológico de una solicitud (admin)',
    description:
      'Devuelve eventos de HistorialSolicitud ordenados de antiguo a reciente. ' +
      'Incluye observacionPublica y notaInterna (solo roles administrativos).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de eventos (puede ser vacía)',
    type: [HistorialSolicitudItemDto],
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Sin rol ADMINISTRADORA ni SECRETARIA',
  })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  findHistorial(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<HistorialSolicitudItemDto[]> {
    return this.solicitudesService.findHistorialBySolicitudId(id);
  }

  @Patch(':id/estado')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Cambiar estado de una solicitud con trazabilidad',
    description:
      'Actualiza Solicitud.estado y crea HistorialSolicitud en la misma transacción. ' +
      'El responsable se toma del JWT (sub/idUsuario). No enviar usuarioId, estadoAnterior ni fecha. ' +
      'Roles: ADMINISTRADORA, SECRETARIA.',
  })
  @ApiBody({ type: CambiarEstadoSolicitudDto })
  @ApiResponse({
    status: 200,
    description: 'Estado actualizado e historial registrado',
    type: CambioEstadoSolicitudResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Estado inválido o sin cambio' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Sin rol ADMINISTRADORA ni SECRETARIA',
  })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'Conflicto por cambio concurrente de estado',
  })
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoSolicitudDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CambioEstadoSolicitudResponseDto> {
    return this.solicitudesService.actualizarEstado(id, dto, user);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA, Role.FONTANERO)
  @ApiOperation({
    summary:
      'Listar solicitudes digitales con filtros administrativos (Protegido)',
    description:
      'Consulta paginada de solicitudes con filtros por código, tipo, estado, rango de fechas e identificación. Ordenado cronológicamente y optimizado para omitir archivos pesados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado paginado de solicitudes obtenido correctamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: 'No autorizado (solo personal administrativo)',
  })
  findAll(@Query() query: QuerySolicitudesDto) {
    return this.solicitudesService.findAll(query);
  }
}
