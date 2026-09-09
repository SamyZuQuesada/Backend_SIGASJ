import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ActividadIdPipe } from './actividad-id.pipe';
import { ActividadesFontaneroService } from './actividades-fontanero.service';
import { CorregirActividadDto } from './dto/corregir-actividad.dto';
import { CreateActividadDto } from './dto/create-actividad.dto';
import { QueryHistorialActividadesDto } from './dto/query-historial-actividades.dto';
import { QueryListadoActividadesAdminDto } from './dto/query-listado-actividades-admin.dto';
import { QueryReporteActividadesDto } from './dto/query-reporte-actividades.dto';
import { RevisarActividadDto } from './dto/revisar-actividad.dto';
import { SolicitarCorreccionDto } from './dto/solicitar-correccion.dto';
import {
  MAX_ACTIVIDAD_DOCUMENT_BYTES,
  MAX_ACTIVIDAD_DOCUMENT_FILES,
  type UploadedImageFile,
} from '../../common/media/public-media';

@ApiTags('Actividades Fontanero')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ActividadesFontaneroController {
  constructor(
    private readonly actividadesFontaneroService: ActividadesFontaneroService,
  ) {}

  // ── Fontanero ────────────────────────────────────────────────────────────

  @Post('fontanero/actividades')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.FONTANERO)
  @UseInterceptors(
    FilesInterceptor('documentos', MAX_ACTIVIDAD_DOCUMENT_FILES, {
      limits: {
        fileSize: MAX_ACTIVIDAD_DOCUMENT_BYTES,
        files: MAX_ACTIVIDAD_DOCUMENT_FILES,
      },
    }),
  )
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiOperation({
    summary: 'Registrar una actividad propia (Fontanero)',
  })
  registrar(
    @Body() dto: CreateActividadDto,
    @UploadedFiles() files: UploadedImageFile[] | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actividadesFontaneroService.registrar(dto, user, files);
  }

  @Get('fontanero/actividades')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.FONTANERO)
  @ApiOperation({
    summary: 'Listar actividades propias (Fontanero)',
  })
  listarPropias(@CurrentUser() user: AuthenticatedUser) {
    return this.actividadesFontaneroService.listarPropias(user);
  }

  @Get('fontanero/actividades/historial')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.FONTANERO)
  @ApiOperation({
    summary: 'Consultar historial propio (Fontanero)',
    description:
      'Actividades APROBADA, RECHAZADA o CORREGIDA del fontanero autenticado. ' +
      'Filtro de periodo inclusivo sobre fechaActividad. Paginación en servidor.',
  })
  @ApiQuery({ name: 'fechaInicio', required: false, example: '2026-09-01' })
  @ApiQuery({ name: 'fechaFin', required: false, example: '2026-09-30' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  historialPropio(
    @Query() query: QueryHistorialActividadesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actividadesFontaneroService.historialPropio(user, query);
  }

  @Get('fontanero/actividades/correcciones')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.FONTANERO)
  @ApiOperation({
    summary: 'Consultar correcciones pendientes propias (Fontanero)',
  })
  correccionesPendientes(@CurrentUser() user: AuthenticatedUser) {
    return this.actividadesFontaneroService.correccionesPendientes(user);
  }

  @Get('fontanero/actividades/tipos')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.FONTANERO, Role.ADMINISTRADORA)
  @ApiOperation({
    summary:
      'Consultar catálogo de tipos de actividad (Fontanero y Administradora)',
  })
  listarTipos() {
    return this.actividadesFontaneroService.listarTipos();
  }

  @Get('fontanero/actividades/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.FONTANERO)
  @ApiOperation({
    summary: 'Consultar detalle de una actividad propia (Fontanero)',
  })
  detallePropio(
    @Param('id', ActividadIdPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actividadesFontaneroService.detallePropio(id, user);
  }

  @Post('fontanero/actividades/:id/documentos')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.FONTANERO)
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: MAX_ACTIVIDAD_DOCUMENT_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Adjuntar documento a una actividad propia (Fontanero)',
  })
  adjuntarDocumento(
    @Param('id', ActividadIdPipe) id: number,
    @UploadedFile() file: UploadedImageFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actividadesFontaneroService.adjuntarDocumento(id, file, user);
  }

  @Patch('fontanero/actividades/:id/corregir')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.FONTANERO)
  @ApiOperation({
    summary: 'Corregir y reenviar una actividad propia (Fontanero)',
  })
  corregirPropia(
    @Param('id', ActividadIdPipe) id: number,
    @Body() dto: CorregirActividadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actividadesFontaneroService.corregirPropia(id, dto, user);
  }

  // ── Administradora ───────────────────────────────────────────────────────

  @Get('admin/actividades')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Listar actividades reportadas (Administradora)',
    description:
      'Endpoint para consultar y filtrar las actividades reportadas por los fontaneros con soporte para paginación.',
  })
  @ApiQuery({ name: 'fontaneroId', required: false, example: 'fontanero-123' })
  @ApiQuery({ name: 'tipoActividadId', required: false, example: 1 })
  @ApiQuery({ name: 'fechaInicio', required: false, example: '2026-08-01' })
  @ApiQuery({ name: 'fechaFin', required: false, example: '2026-08-31' })
  @ApiQuery({
    name: 'estado',
    required: false,
    description: 'Estado de la actividad',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  listarAdmin(@Query() query: QueryListadoActividadesAdminDto) {
    return this.actividadesFontaneroService.listarAdmin(query);
  }

  @Get('admin/actividades/historial')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Consultar historial de actividades (Administradora)',
  })
  historialAdmin() {
    return this.actividadesFontaneroService.historialAdmin();
  }

  @Get('admin/actividades/reportes')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Consultar reportes agregados de actividades (Administradora)',
    description:
      'Reporte de solo lectura con total, agregados por estado/tipo/fontanero y detalle. ' +
      'Filtros opcionales combinables con AND. Sin resultados → 200 con colecciones vacías.',
  })
  @ApiQuery({ name: 'fechaInicio', required: false, example: '2026-09-01' })
  @ApiQuery({ name: 'fechaFin', required: false, example: '2026-09-30' })
  @ApiQuery({ name: 'fontaneroId', required: false, example: 'fontanero-1' })
  @ApiQuery({ name: 'tipoActividadId', required: false, example: 1 })
  reportesAdmin(@Query() query: QueryReporteActividadesDto) {
    return this.actividadesFontaneroService.reportesAdmin(query);
  }

  @Get(['admin/actividades/:id', 'admin/actividades-fontanero/:id'])
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Consultar detalle de una actividad (Administradora)',
    description:
      'Obtiene toda la información de una actividad reportada por un Fontanero, ' +
      'incluyendo fontanero responsable, tipo de actividad, fecha, estado de revisión, ' +
      'datos específicos, observaciones y documentos adjuntos.',
  })
  detalleAdmin(@Param('id', ActividadIdPipe) id: number) {
    return this.actividadesFontaneroService.detalleAdmin(id);
  }

  @Patch([
    'admin/actividades/:id/revisar',
    'admin/actividades-fontanero/:id/revisar',
  ])
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Revisar una actividad reportada (Administradora)',
    description:
      'Registra que la actividad fue consultada y revisada administrativamente por la Administradora. ' +
      'Guarda la fecha/hora de revisión y el usuario revisor, estableciendo el estado en REVISADA. ' +
      'No modifica los datos técnicos registrados originalmente por el fontanero ni implica aprobación o rechazo.',
  })
  revisar(
    @Param('id', ActividadIdPipe) id: number,
    @Body() dto: RevisarActividadDto = new RevisarActividadDto(),
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actividadesFontaneroService.revisar(id, dto, user);
  }

  @Patch('admin/actividades/:id/solicitar-correccion')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Solicitar corrección de una actividad (Administradora)',
  })
  solicitarCorreccion(
    @Param('id', ActividadIdPipe) id: number,
    @Body() dto: SolicitarCorreccionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actividadesFontaneroService.solicitarCorreccion(id, dto, user);
  }

  // ── Consulta de Detalle Completo (Fontanero y Administradora) ───────────

  @Get(['actividades-fontanero/:id', 'actividades/:id'])
  @HttpCode(HttpStatus.OK)
  @Roles(Role.FONTANERO, Role.ADMINISTRADORA)
  @ApiOperation({
    summary:
      'Consultar detalle completo de una actividad (Fontanero y Administradora)',
    description:
      'Obtiene toda la información asociada a una actividad registrada a partir de su ID. ' +
      'El Fontanero solo puede consultar actividades propias. La Administradora puede consultar cualquier actividad.',
  })
  consultarDetalle(
    @Param('id', ActividadIdPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actividadesFontaneroService.consultarDetalle(id, user);
  }
}
