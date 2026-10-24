import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  MAX_SOLICITUD_DOCUMENT_BYTES,
  type SolicitudDocumentFile,
} from '../../common/media/public-media';
import { CreateSolicitudAfiliacionDto } from './dto/create-solicitud-afiliacion.dto';
import { CreateSolicitudArregloPagoDto } from './dto/create-solicitud-arreglo-pago.dto';
import { CreateSolicitudCambioTitularDto } from './dto/create-solicitud-cambio-titular.dto';
import { CreateSolicitudDisponibilidadServiciosDto } from './dto/create-solicitud-disponibilidad-servicios.dto';
import { CreateSolicitudInfraestructuraLinderosDto } from './dto/create-solicitud-infraestructura-linderos.dto';
import { CreateSolicitudConstanciaServicioDto } from './dto/create-solicitud-constancia-servicio.dto';
import { QuerySolicitudesDto } from './dto/query-solicitudes.dto';

import { SolicitudesAprobadaPendientesResponseDto } from './dto/solicitudes-aprobada-pendientes-response.dto';
import { Solicitud } from './entities/solicitud.entity';
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

  @Get('seguimiento/:codigoSeguimiento')
  @ApiOperation({
    summary:
      'Consultar avance de solicitud por código de seguimiento (Público)',
    description:
      'Permite a los ciudadanos consultar el estado y avance de su trámite mediante su código único (Card 8).',
  })
  @ApiResponse({
    status: 200,
    description: 'Información actual de la solicitud',
    type: Solicitud,
  })
  @ApiResponse({
    status: 404,
    description: 'Solicitud no encontrada para el código especificado',
  })
  findByCodigoSeguimiento(
    @Param('codigoSeguimiento') codigoSeguimiento: string,
  ): Promise<Solicitud> {
    return this.solicitudesService.findByCodigoSeguimiento(codigoSeguimiento);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA, Role.FONTANERO)
  @ApiOperation({
    summary: 'Consultar solicitud por ID interno',
  })
  @ApiResponse({
    status: 200,
    type: Solicitud,
  })
  findById(@Param('id', ParseIntPipe) id: number): Promise<Solicitud> {
    return this.solicitudesService.findById(id);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Listar solicitudes digitales con filtros administrativos',
  })
  findAll(
    @Query() query: QuerySolicitudesDto,
  ): Promise<{ solicitudes: Solicitud[]; total: number }> {
    return this.solicitudesService.findAll(query);
  }
}
