import {
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
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CorrelacionSolicitudAusenciaService } from './correlacion-solicitud-ausencia.service';
import { QuerySolicitudesAusenciaDto } from './dto/query-solicitudes-ausencia.dto';
import { RechazarSolicitudAusenciaDto } from './dto/rechazar-solicitud-ausencia.dto';
import { SolicitudesAusenciaService } from './solicitudes-ausencia.service';

@ApiTags('RRHH · Solicitudes de ausencia')
@ApiBearerAuth()
@Controller('rrhh/solicitudes-ausencia')
export class SolicitudesAusenciaController {
  constructor(
    private readonly solicitudesService: SolicitudesAusenciaService,
    private readonly correlacionService: CorrelacionSolicitudAusenciaService,
  ) {}

  @Post('correlacion')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FONTANERO)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Emitir token de correlación para el embed de Jotform',
    description:
      'Vincula la sesión del Fontanero con la submission. El token viaja como campo oculto del formulario.',
  })
  emitirCorrelacion(@CurrentUser() user: AuthenticatedUser) {
    const usuarioId = user.idUsuario ?? Number(user.userId);
    return this.correlacionService.emitirParaUsuario(usuarioId);
  }

  /** PBI 6.5.4 — cola administrativa (solo ADMINISTRADORA). */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Listar solicitudes de ausencia',
    description:
      'Filtros SQL: estado, colaboradorId, tipo. Paginación page/limit. Orden: createdAt DESC, id DESC.',
  })
  @ApiResponse({ status: 401, description: 'Sin JWT' })
  @ApiResponse({ status: 403, description: 'Rol distinto de ADMINISTRADORA' })
  findAll(@Query() query: QuerySolicitudesAusenciaDto) {
    return this.solicitudesService.findAll(query);
  }

  /** PBI 6.5.4 — detalle administrativo (solo ADMINISTRADORA). */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Detalle de solicitud (incluye saldo si es vacaciones)',
  })
  @ApiResponse({ status: 403, description: 'Rol distinto de ADMINISTRADORA' })
  @ApiResponse({ status: 404, description: 'No existe' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.solicitudesService.findOneDetalle(id);
  }

  @Get(':id/documentos/:filename')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Descargar o ver evidencia de una solicitud' })
  async descargarDocumento(
    @Param('id', ParseIntPipe) id: number,
    @Param('filename') filename: string,
  ): Promise<StreamableFile> {
    const { absolutePath, mimeType, documento } =
      await this.solicitudesService.obtenerArchivoDocumento(id, filename, {
        rolAdministradora: true,
      });
    return new StreamableFile(createReadStream(absolutePath), {
      type: mimeType,
      disposition: `inline; filename="${encodeURIComponent(documento.nombreOriginal)}"`,
    });
  }

  @Patch(':id/aprobar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aprobar solicitud pendiente',
    description:
      'Crea PermisoColaborador o MovimientoVacaciones DISFRUTADO vía servicios RRHH existentes. ' +
      'Transacción atómica con claim UPDATE WHERE estado=PENDIENTE (anti doble aprobación).',
  })
  @ApiResponse({ status: 200, description: 'Solicitud aprobada' })
  @ApiResponse({ status: 401, description: 'Sin JWT' })
  @ApiResponse({ status: 403, description: 'Solo ADMINISTRADORA' })
  @ApiResponse({ status: 404, description: 'Solicitud inexistente' })
  @ApiResponse({
    status: 409,
    description: 'Ya procesada (APROBADA/RECHAZADA) o carrera concurrente',
  })
  aprobar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const usuarioId = user.idUsuario ?? Number(user.userId);
    return this.solicitudesService.aprobar(id, usuarioId);
  }

  @Patch(':id/rechazar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rechazar solicitud pendiente (no crea registros RRHH)',
  })
  @ApiResponse({ status: 200, description: 'Solicitud rechazada' })
  @ApiResponse({ status: 401, description: 'Sin JWT' })
  @ApiResponse({ status: 403, description: 'Solo ADMINISTRADORA' })
  @ApiResponse({ status: 404, description: 'Solicitud inexistente' })
  @ApiResponse({
    status: 409,
    description: 'Ya procesada; no se puede rechazar de nuevo',
  })
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RechazarSolicitudAusenciaDto,
  ) {
    const usuarioId = user.idUsuario ?? Number(user.userId);
    return this.solicitudesService.rechazar(id, usuarioId, dto);
  }
}
